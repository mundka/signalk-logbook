const CircularBuffer = require('circular-buffer');
const timezones = require('timezones-list');
const Log = require('./Log');
const stateToEntry = require('./format');
const { processTriggers, processHourly } = require('./triggers');
const openAPI = require('../schema/openapi.json');

const timezonesList = [
  {
    tzCode: 'UTC',
    label: 'UTC',
  },
  ...timezones.default,
];

function parseJwt(token) {
  if (!token) {
    return {};
  }
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

function sendDelta(app, plugin, time, path, value) {
  app.handleMessage(plugin.id, {
    context: `vessels.${app.selfId}`,
    updates: [
      {
        source: {
          label: plugin.id,
        },
        timestamp: time.toISOString(),
        values: [
          {
            path,
            value,
          },
        ],
      },
    ],
  });
}
function sendCrewNames(app, plugin) {
  const { configuration } = app.readPluginOptions();
  if (!configuration) {
    return;
  }
  sendDelta(app, plugin, new Date(), 'communication.crewNames', configuration.crewNames || []);
}

module.exports = (app) => {
  const plugin = {};
  let unsubscribes = [];
  let interval;
  let autoInterval;

  plugin.id = 'signalk-logbook';
  plugin.name = 'Logbook';
  plugin.description = 'Semi-automatic electronic logbook for sailing vessels';

  const setStatus = app.setPluginStatus || app.setProviderStatus;

  // The paths we want to listen and collect data for
  const paths = [
    'navigation.state', // Under way/stopped
    'navigation.datetime', // Current time, for automated hourly entries
    'navigation.position',
    'navigation.gnss.type',
    'navigation.headingTrue',
    'navigation.courseOverGroundTrue',
    'navigation.speedThroughWater',
    'navigation.speedOverGround',
    'navigation.log',
    'navigation.courseRhumbline.nextPoint.position',
    'environment.outside.pressure',
    'environment.wind.directionTrue',
    'environment.wind.speedOverGround',
    'environment.water.swell.state',
    'propulsion.*.state',
    'propulsion.*.runTime',
    'sails.inventory.*',
    'steering.autopilot.state',
    'communication.crewNames',
    'communication.vhf.channel',
  ];

  // We keep 15min of past state to allow slight backdating of entries
  const buffer = new CircularBuffer(16);

  let log;
  let state = {};

  plugin.start = () => {
    log = new Log(app.getDataDirPath());
    const { configuration } = app.readPluginOptions();
    const autoIntervalMinutes = configuration?.autoLogInterval || 5;
    const enableAutoLogging = configuration?.enableAutoLogging !== false;
    const subscription = {
      context: 'vessels.self',
      subscribe: paths.map((p) => ({
        path: p,
        period: 1000,
      })),
    };

    app.subscriptionmanager.subscribe(
      subscription,
      unsubscribes,
      (subscriptionError) => {
        app.error(`Error:${subscriptionError}`);
      },
      (delta) => {
        if (!delta.updates) {
          return;
        }
        delta.updates.reduce((prev, u) => prev.then(() => {
          if (!u.values) {
            return Promise.resolve();
          }
          return u.values.reduce((
            previousPromise,
            v,
          ) => previousPromise.then(() => processTriggers(v.path, v.value, state, log, app)
            .then((stateUpdates) => {
              if (!stateUpdates) {
                return;
              }
              // Trigger wants to write state
              Object.keys(stateUpdates).forEach((key) => {
                state[key] = stateUpdates[key];
              });
            }, (err) => {
              app.setPluginError(`Failed to store entry: ${err.message}`);
            })
            .then(() => {
              if (u.$source === 'signalk-logbook.XX' && v.path !== 'communication.crewNames') {
                // Don't store our reports into state
                return;
              }
              // Copy new value into state
              state[v.path] = v.value;
            })), Promise.resolve());
        }), Promise.resolve());
      },
    );

    interval = setInterval(() => {
      // Save old state to buffer
      if (!state.datetime) {
        state.datetime = new Date().toISOString();
      }
      if (new Date(state.datetime).getMinutes() === 0) {
        // Store hourly log entry
        processHourly(state, log, app)
          .catch((err) => {
            app.setPluginError(`Failed to store entry: ${err.message}`);
          });
        sendCrewNames(app, plugin);
      }
      buffer.enq(state);
      // We can keep a clone of the previous values
      state = {
        ...state,
        datetime: null,
      };
    }, 60000);

    // Automaatne logikirje iga 5 minuti järel
    if (enableAutoLogging) {
      autoInterval = setInterval(() => {
        // Loome automaatse logikirje
        const author = { name: 'Automatic', role: 'System' };
        const entry = stateToEntry(state, 'Automaatne logikirje', author);
        const dateString = new Date(entry.datetime).toISOString().substr(0, 10);
        log.appendEntry(dateString, entry)
          .then(() => {
            setStatus('Automaatne logikirje salvestatud');
            app.debug && app.debug('Automatic log entry saved:', entry);
          })
          .catch((err) => {
            app.setPluginError(`Automaatse logikirje salvestus ebaõnnestus: ${err.message}`);
          });
      }, autoIntervalMinutes * 60 * 1000);
    }

    app.registerPutHandler('vessels.self', 'communication.crewNames', (ctx, path, value, cb) => {
      if (!Array.isArray(value)) {
        return {
          state: 'COMPLETED',
          statusCode: 400,
          message: 'crewNames must be an array',
        };
      }
      const faulty = value.findIndex((v) => typeof v !== 'string');
      if (faulty !== -1) {
        return {
          state: 'COMPLETED',
          statusCode: 400,
          message: 'Each crewName must be a string',
        };
      }
      let { configuration } = app.readPluginOptions();
      if (!configuration) {
        configuration = {};
      }
      configuration.crewNames = value;
      app.savePluginOptions(configuration, (err) => {
        if (err) {
          cb({
            state: 'COMPLETED',
            statusCode: 500,
            message: err.message,
          });
          return;
        }
        sendCrewNames(app, plugin);
        cb({
          state: 'COMPLETED',
          statusCode: 200,
        });
      });
      return {
        state: 'PENDING',
      };
    });
    sendCrewNames(app, plugin);

    setStatus('Waiting for updates');
  };

  plugin.registerWithRouter = (router) => {
    function handleError(error, res) {
      if (error.code === 'ENOENT') {
        res.sendStatus(404);
        return;
      }
      if (error.stack && error.message) {
        app.debug(error.stack);
        res.status(400);
        res.send({
          message: error.stack,
        });
        return;
      }
      app.debug(error.message);
      res.sendStatus(500);
    }
    router.get('/logs', (req, res) => {
      res.contentType('application/json');
      log.listDates()
        .then((dates) => {
          res.send(JSON.stringify(dates));
        }, (e) => handleError(e, res));
    });
    router.post('/logs', (req, res) => {
      res.contentType('application/json');
      const user = parseJwt(req.cookies.JAUTHENTICATION);
      if (!user || !user.id || !user.role || !['Captain', 'Officer'].includes(user.role)) {
        res.sendStatus(403);
        return;
      }
      let stats;
      if (req.body.ago > buffer.size()) {
        // We don't have history that far, sadly
        res.sendStatus(404);
        return;
      }
      if (buffer.size() > 0) {
        stats = buffer.get(req.body.ago);
      } else {
        stats = {
          ...state,
        };
      }
      const author = { name: user.id, role: user.role || 'Crew' };
      const data = stateToEntry(stats, req.body.text, author);
      if (req.body.category) {
        data.category = req.body.category;
      } else {
        data.category = 'navigation';
      }
      if (req.body.observations) {
        data.observations = {
          ...req.body.observations,
        };
        if (!Number.isNaN(Number(data.observations.seaState))) {
          sendDelta(
            app,
            plugin,
            new Date(data.datetime),
            'environment.water.swell.state',
            data.observations.seaState,
          );
        }
      }
      if (req.body.position) {
        data.position = {
          ...req.body.position,
        };
        // TODO: Send delta on manually entered position?
      }
      const dateString = new Date(data.datetime).toISOString().substr(0, 10);
      log.appendEntry(dateString, data)
        .then(() => {
          setStatus(`Manual log entry: ${req.body.text}`);
          res.sendStatus(201);
        }, (e) => handleError(e, res));
    });
    router.get('/logs/:date', (req, res) => {
      res.contentType('application/json');
      log.getDate(req.params.date)
        .then((date) => {
          res.send(JSON.stringify(date));
        }, (e) => handleError(e, res));
    });
    router.get('/logs/:date/:entry', (req, res) => {
      res.contentType('application/json');
      if (req.params.entry.substr(0, 10) !== req.params.date) {
        res.sendStatus(404);
        return;
      }
      log.getEntry(req.params.entry)
        .then((entry) => {
          res.send(JSON.stringify(entry));
        }, (e) => handleError(e, res));
    });
    router.put('/logs/:date/:entry', (req, res) => {
      res.contentType('application/json');
      const user = parseJwt(req.cookies.JAUTHENTICATION);
      if (!user || !user.id || !user.role || !['Captain', 'Officer'].includes(user.role)) {
        res.sendStatus(403);
        return;
      }
      if (req.params.entry.substr(0, 10) !== req.params.date) {
        res.sendStatus(404);
        return;
      }
      const entry = {
        ...req.body,
      };
      if (user && user.id && !entry.author) {
        entry.author = { name: user.id, role: user.role || 'Crew' };
      }
      if (!entry.audit) entry.audit = {};
      entry.audit.modifiedAt = new Date().toISOString();
      log.writeEntry(entry)
        .then(() => {
          res.sendStatus(200);
        }, (e) => handleError(e, res));
    });
    router.delete('/logs/:date/:entry', (req, res) => {
      const user = parseJwt(req.cookies.JAUTHENTICATION);
      if (!user || !user.id || !user.role || !['Captain', 'Officer'].includes(user.role)) {
        res.sendStatus(403);
        return;
      }
      if (req.params.entry.substr(0, 10) !== req.params.date) {
        res.sendStatus(404);
        return;
      }
      log.deleteEntry(req.params.entry)
        .then(() => {
          res.sendStatus(204);
        }, (e) => handleError(e, res));
    });
  };

  plugin.stop = () => {
    unsubscribes.forEach((f) => f());
    unsubscribes = [];
    clearInterval(interval);
    clearInterval(autoInterval);
  };

  plugin.schema = {
    type: 'object',
    properties: {
      crewNames: {
        type: 'array',
        default: [],
        title: 'Crew list',
        items: {
          type: 'string',
        },
      },
      displayTimeZone: {
        type: 'string',
        default: 'UTC',
        title: 'Select the display time zone',
        oneOf: timezonesList.map((tz) => ({
          const: tz.tzCode,
          title: tz.label,
        })),
      },
      autoLogInterval: {
        type: 'number',
        default: 5,
        title: 'Automaatse logikirje intervall (minutites)',
        description: 'Kui sageli salvestatakse automaatseid logikirjeid',
        minimum: 1,
        maximum: 60,
      },
      enableAutoLogging: {
        type: 'boolean',
        default: true,
        title: 'Luba automaatne logikirje',
        description: 'Kas salvestada automaatseid logikirjeid',
      },
    },
  };

  plugin.getOpenApi = () => openAPI;

  return plugin;
};
