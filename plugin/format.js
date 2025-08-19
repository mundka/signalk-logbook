const crypto = require("crypto");

function rad2deg(rad) {
  let deg = Math.round((rad * 180) / Math.PI);
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}

function ms2kt(ms) {
  return parseFloat((ms * 1.94384).toFixed(1));
}

function paToHpa(pa) {
  if (pa == null || Number.isNaN(Number(pa))) return null;
  const v = Number(pa);
  return v > 2000 ? parseFloat((v / 100).toFixed(2)) : parseFloat(v.toFixed(2));
}

function pickWindKts(state) {
  const keys = [
    "environment.wind.speedTrue",
    "environment.wind.speedApparent",
    "environment.wind.speedOverGround",
  ];
  for (const k of keys) {
    const v = state[k];
    if (!Number.isNaN(Number(v))) return ms2kt(Number(v));
  }
  return null;
}

function pickWindDeg(state) {
  const keys = [
    "environment.wind.directionTrue",
    "environment.wind.directionApparent",
  ];
  for (const k of keys) {
    const v = state[k];
    if (!Number.isNaN(Number(v))) return rad2deg(Number(v));
  }
  return null;
}

function beaufortAndWave(kts) {
  if (kts == null || Number.isNaN(Number(kts))) {
    return { bft: null, h: null };
  }
  const v = Number(kts);
  const t = [
    { m: 1, b: 0, h: 0.0 },
    { m: 3, b: 1, h: 0.1 },
    { m: 6, b: 2, h: 0.2 },
    { m: 10, b: 3, h: 0.6 },
    { m: 16, b: 4, h: 1.0 },
    { m: 21, b: 5, h: 2.0 },
    { m: 27, b: 6, h: 3.0 },
    { m: 33, b: 7, h: 4.0 },
    { m: 40, b: 8, h: 5.5 },
    { m: 47, b: 9, h: 7.0 },
    { m: 55, b: 10, h: 9.0 },
    { m: 63, b: 11, h: 11.5 },
  ];
  for (const r of t) if (v <= r.m) return { bft: r.b, h: r.h };
  return { bft: 12, h: 14.0 };
}

function visibilityIndexFromMeters(m) {
  if (m == null || Number.isNaN(Number(m))) return null;
  const val = Number(m);
  const NM = 1852;
  if (val < 45) return 1;         // Dense fog
  if (val < 180) return 2;        // Thick fog
  if (val < 360) return 3;        // Fog
  if (val < 0.5 * NM) return 4;   // Moderate fog
  if (val < 1 * NM) return 5;     // Thin fog
  if (val < 2 * NM) return 6;     // Poor
  if (val < 5 * NM) return 7;     // Moderate
  if (val < 10 * NM) return 8;    // Good
  if (val < 30 * NM) return 9;    // Very good
  return 10;                      // Excellent
}

function estimateVisibilityIndexFromWind(kts) {
  if (kts == null || Number.isNaN(Number(kts))) return null;
  const v = Number(kts);
  if (v <= 8) return 10;
  if (v <= 12) return 9;
  if (v <= 20) return 8;
  if (v <= 28) return 7;
  if (v <= 35) return 6;
  if (v <= 45) return 5;
  return 4;
}

module.exports = function stateToEntry(state, text, author = "") {
  const now = new Date().toISOString();
  let authorStr = "";
  if (typeof author === "string") authorStr = author;
  else if (author && typeof author === "object" && author.name) authorStr = author.name;

  const data = {
    datetime: state["navigation.datetime"] || now,
    text,
    author: authorStr,
    audit: { createdAt: now, modifiedAt: null },
    vesselState: state["navigation.state"] || null,
    environment: {
      temperature: state["environment.outside.temperature"] || null,
      windSpeed: null,
      windDirection: null,
      barometricPressure: paToHpa(state["environment.outside.pressure"]),
    },
  };

  if (state["navigation.position"]) {
    data.position = {
      latitude: state["navigation.position"].latitude,
      longitude: state["navigation.position"].longitude,
    };
  }
  if (state["navigation.gnss.type"] && data.position) {
    data.position.source = state["navigation.gnss.type"];
  }
  if (!Number.isNaN(Number(state["navigation.headingTrue"]))) {
    data.heading = rad2deg(state["navigation.headingTrue"]);
  }
  if (!Number.isNaN(Number(state["navigation.courseOverGroundTrue"]))) {
    data.course = rad2deg(state["navigation.courseOverGroundTrue"]);
  }
  if (!Number.isNaN(Number(state["navigation.speedThroughWater"]))) {
    if (!data.speed) data.speed = {};
    data.speed.stw = ms2kt(state["navigation.speedThroughWater"]);
  }
  if (!Number.isNaN(Number(state["navigation.speedOverGround"]))) {
    if (!data.speed) data.speed = {};
    data.speed.sog = ms2kt(state["navigation.speedOverGround"]);
  }
  if (!Number.isNaN(Number(state["navigation.log"]))) {
    data.log = parseFloat((state["navigation.log"] / 1852).toFixed(1));
  }
  if (
    state["navigation.courseRhumbline.nextPoint.position"] &&
    !Number.isNaN(
      Number(state["navigation.courseRhumbline.nextPoint.position"].latitude)
    )
  ) {
    data.waypoint = state["navigation.courseRhumbline.nextPoint.position"];
  }
  if (!Number.isNaN(Number(state["environment.outside.cloudCoverage"]))) {
    if (!data.observations) data.observations = {};
    data.observations.cloudCoverage = state["environment.outside.cloudCoverage"];
  }
  if (!Number.isNaN(Number(state["environment.outside.visibility"]))) {
    if (!data.observations) data.observations = {};
    const visIdx = visibilityIndexFromMeters(
      state["environment.outside.visibility"]
    );
    if (visIdx != null) data.observations.visibility = visIdx;
  }

  // Engine hours from any propulsion.*.runTime seconds field
  Object.keys(state).forEach((key) => {
    if (!key.match(/propulsion\.[A-Za-z0-9]+\.runTime/)) return;
    if (!Number.isNaN(Number(state[key]))) {
      if (!data.engine) data.engine = {};
      data.engine.hours = parseFloat((state[key] / 3600).toFixed(1));
    }
  });

  if (state["communication.vhf.channel"]) {
    data.vhf = state["communication.vhf.channel"];
  }
  if (state["communication.crewNames"]) {
    data.crewNames = state["communication.crewNames"];
  }

  // Wind details
  const windKts = pickWindKts(state);
  const windDeg = pickWindDeg(state);
  if (windKts != null) data.environment.windSpeed = windKts;
  if (windDeg != null) data.environment.windDirection = windDeg;

  if (windKts != null || windDeg != null) {
    data.wind = {};
    if (windKts != null) data.wind.speed = windKts;
    if (windDeg != null) data.wind.direction = windDeg;
  }
  if (data.environment.barometricPressure != null) {
    data.barometer = data.environment.barometricPressure;
  }

  // Sea state: prefer existing, else derive from Beaufort
  if (!data.observations) data.observations = {};
  if (!Number.isNaN(Number(state["environment.water.swell.state"]))) {
    data.observations.seaState = Number(
      state["environment.water.swell.state"]
    );
  }
  if (data.observations.seaState == null && windKts != null) {
    const { bft, h } = beaufortAndWave(windKts);
    data.observations.seaState = bft; // Beaufort number
    data.observations.waveHeight = h != null ? parseFloat(h.toFixed(1)) : null;
  }

  // Visibility: if not provided, estimate from wind
  if (data.observations.visibility == null) {
    const idx = estimateVisibilityIndexFromWind(windKts);
    if (idx != null) data.observations.visibility = idx;
  }

  const hashData = { ...data };
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashData))
    .digest("hex");
  data.signature = hash;
  return data;
};

