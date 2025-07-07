const crypto = require('crypto');

function rad2deg(rad) {
  return Math.round((rad * 180) / Math.PI);
}

function ms2kt(ms) {
  return parseFloat((ms * 1.94384).toFixed(1));
}

module.exports = function stateToEntry(state, text, author = '') {
  const now = new Date().toISOString();
  let authorStr = '';
  if (typeof author === 'string') {
    authorStr = author;
  } else if (author && typeof author === 'object' && author.name) {
    authorStr = author.name;
  }
  const data = {
    datetime: state['navigation.datetime'] || now,
    text,
    author: authorStr,
    audit: {
      createdAt: now,
      modifiedAt: null,
    },
    vesselState: state['navigation.state'] || null,
    environment: {
      temperature: state['environment.outside.temperature'] || null,
      windSpeed: state['environment.wind.speedApparent'] || null,
      barometricPressure: state['environment.outside.pressure'] || null,
    },
  };
  if (state['navigation.position']) {
    data.position = {
      latitude: state['navigation.position'].latitude,
      longitude: state['navigation.position'].longitude,
    };
  }
  if (state['navigation.gnss.type'] && data.position) {
    data.position.source = state['navigation.gnss.type'];
  }
  if (!Number.isNaN(Number(state['navigation.headingTrue']))) {
    data.heading = rad2deg(state['navigation.headingTrue']);
  }
  if (!Number.isNaN(Number(state['navigation.courseOverGroundTrue']))) {
    data.course = rad2deg(state['navigation.courseOverGroundTrue']);
  }
  if (!Number.isNaN(Number(state['navigation.speedThroughWater']))) {
    if (!data.speed) {
      data.speed = {};
    }
    data.speed.stw = ms2kt(state['navigation.speedThroughWater']);
  }
  if (!Number.isNaN(Number(state['navigation.speedOverGround']))) {
    if (!data.speed) {
      data.speed = {};
    }
    data.speed.sog = ms2kt(state['navigation.speedOverGround']);
  }
  if (!Number.isNaN(Number(state['navigation.log']))) {
    data.log = parseFloat((state['navigation.log'] / 1852).toFixed(1));
  }
  if (state['navigation.courseRhumbline.nextPoint.position']
    && !Number.isNaN(Number(state['navigation.courseRhumbline.nextPoint.position'].latitude))) {
    data.waypoint = state['navigation.courseRhumbline.nextPoint.position'];
  }
  if (!Number.isNaN(Number(state['environment.outside.cloudCoverage']))) {
    if (!data.observations) {
      data.observations = {};
    }
    data.observations.cloudCoverage = state['environment.outside.cloudCoverage'];
  }
  if (!Number.isNaN(Number(state['environment.outside.visibility']))) {
    if (!data.observations) {
      data.observations = {};
    }
    data.observations.visibility = state['environment.outside.visibility'];
  }
  Object.keys(state).forEach((key) => {
    if (!key.match(/propulsion\.[A-Za-z0-9]+\.runTime/)) {
      return;
    }
    if (!Number.isNaN(Number(state[key]))) {
      if (!data.engine) {
        data.engine = {};
      }
      data.engine.hours = parseFloat((state[key] / 60 / 60).toFixed(1));
    }
  });
  if (state['communication.vhf.channel']) {
    data.vhf = state['communication.vhf.channel'];
  }
  if (state['communication.crewNames']) {
    data.crewNames = state['communication.crewNames'];
  }
  const hashData = { ...data };
  const hash = crypto.createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
  data.signature = hash;
  return data;
};
