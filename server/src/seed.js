require('dotenv').config();

const mongoose = require('mongoose');
const Zone = require('./models/Zone');
const Habitation = require('./models/Habitation');
const SafeSite = require('./models/SafeSite');

const STATES = [
  {
    name: 'Kerala',
    code: 'KL',
    longitude: 76.10,
    latitude: 11.50,
    hazardTypes: ['landslide', 'flood']
  },
  {
    name: 'Maharashtra',
    code: 'MH',
    longitude: 73.80,
    latitude: 19.20,
    hazardTypes: ['flood', 'landslide', 'cyclone']
  },
  {
    name: 'Assam',
    code: 'AS',
    longitude: 91.70,
    latitude: 26.10,
    hazardTypes: ['flood', 'landslide']
  },
  {
    name: 'Odisha',
    code: 'OD',
    longitude: 85.80,
    latitude: 20.30,
    hazardTypes: ['cyclone', 'flood']
  }
];

const ZONES_PER_STATE = 5;
const HABITATIONS_PER_ZONE = 15;
const SAFE_SITES_PER_STATE = 10;
const RANDOM_SEED = 26191;

const createRandom = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const randomBetween = (random, minimum, maximum) => minimum + random() * (maximum - minimum);
const randomInteger = (random, minimum, maximum) => Math.floor(randomBetween(random, minimum, maximum + 1));
const round = (value, decimals = 4) => Number(value.toFixed(decimals));
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const createZoneGeometry = (longitude, latitude, width = 0.08, height = 0.06) => ({
  type: 'Polygon',
  coordinates: [[
    [round(longitude - width), round(latitude - height)],
    [round(longitude + width), round(latitude - height)],
    [round(longitude + width), round(latitude + height)],
    [round(longitude - width), round(latitude + height)],
    [round(longitude - width), round(latitude - height)]
  ]]
});

const createMetrics = (random, hazardType) => {
  const profiles = {
    landslide: { rainfallMinimum: 250, rainfallMaximum: 650, slopeMinimum: 25, slopeMaximum: 48, saturationMinimum: 70, saturationMaximum: 99 },
    flood: { rainfallMinimum: 180, rainfallMaximum: 580, slopeMinimum: 2, slopeMaximum: 22, saturationMinimum: 65, saturationMaximum: 98 },
    cyclone: { rainfallMinimum: 220, rainfallMaximum: 620, slopeMinimum: 3, slopeMaximum: 28, saturationMinimum: 60, saturationMaximum: 95 }
  };
  const profile = profiles[hazardType];

  return {
    rainfall72h: round(randomBetween(random, profile.rainfallMinimum, profile.rainfallMaximum), 1),
    slopeAngle: round(randomBetween(random, profile.slopeMinimum, profile.slopeMaximum), 1),
    soilSaturation: round(randomBetween(random, profile.saturationMinimum, profile.saturationMaximum), 1)
  };
};

const calculateRiskScore = (metrics) => {
  const rainfallScore = clamp(metrics.rainfall72h / 600 * 50, 0, 50);
  const slopeScore = clamp(metrics.slopeAngle / 45 * 35, 0, 35);
  const saturationScore = clamp(metrics.soilSaturation / 100 * 15, 0, 15);
  return Math.round(clamp(rainfallScore + slopeScore + saturationScore, 0, 100));
};

const statusForScore = (riskScore) => {
  if (riskScore >= 70) return 'RED';
  if (riskScore >= 40) return 'YELLOW';
  return 'SAFE';
};

const createZones = (random) => STATES.flatMap((state, stateIndex) => {
  return Array.from({ length: ZONES_PER_STATE }, (_, zoneIndex) => {
    const row = Math.floor(zoneIndex / 3);
    const column = zoneIndex % 3;
    const longitude = state.longitude + (column - 1) * 0.24 + stateIndex * 0.01;
    const latitude = state.latitude + (row - 0.5) * 0.20;
    const hazardType = state.hazardTypes[zoneIndex % state.hazardTypes.length];
    const metrics = createMetrics(random, hazardType);
    const riskScore = calculateRiskScore(metrics);

    return {
      name: `${state.name} ${hazardType} zone ${zoneIndex + 1}`,
      hazardType,
      geometry: createZoneGeometry(longitude, latitude),
      riskScore,
      status: statusForScore(riskScore),
      metrics,
      isBacktest: true,
      _seedState: state.name,
      _seedCenter: [longitude, latitude]
    };
  });
});

const createHabitations = (random, zones) => zones.flatMap((zone) => {
  const [zoneLongitude, zoneLatitude] = zone._seedCenter;
  const stateName = zone._seedState;
  const stateCode = STATES.find((state) => state.name === stateName).code;

  return Array.from({ length: HABITATIONS_PER_ZONE }, (_, habitationIndex) => {
    const longitude = zoneLongitude + randomBetween(random, -0.065, 0.065);
    const latitude = zoneLatitude + randomBetween(random, -0.045, 0.045);
    const population = randomInteger(random, 180, 1800);
    const vulnerabilityFactors = {
      elderlyAndChildrenRatio: round(randomBetween(random, 0.18, 0.62), 2),
      structuralFragility: round(randomBetween(random, 0.35, 0.95), 2),
      accessRoadsCutoffRisk: random() >= 0.42
    };

    return {
      name: `${stateCode} habitation ${zone._seedState} ${habitationIndex + 1}`,
      location: { type: 'Point', coordinates: [round(longitude), round(latitude)] },
      population,
      vulnerabilityFactors,
      evacuationPriority: randomInteger(random, 35, 98),
      isBacktest: true,
      _seedState: stateName
    };
  });
});

const createSafeSites = (random) => STATES.flatMap((state) => Array.from(
  { length: SAFE_SITES_PER_STATE },
  (_, siteIndex) => ({
    name: `${state.name} Emergency Shelter ${siteIndex + 1}`,
    location: {
      type: 'Point',
      coordinates: [
        round(state.longitude + 0.75 + randomBetween(random, -0.18, 0.18)),
        round(state.latitude + randomBetween(random, -0.45, 0.45))
      ]
    },
    totalCapacity: randomInteger(random, 500, 3500),
    currentOccupancy: randomInteger(random, 0, 650),
    _seedState: state.name
  })
));

const stripSeedMetadata = (documents) => documents.map(({ _seedState, _seedCenter, ...document }) => document);

const generateSeedData = (seed = RANDOM_SEED) => {
  const random = createRandom(seed);
  const generatedZones = createZones(random);
  const generatedHabitations = createHabitations(random, generatedZones);
  const generatedSafeSites = createSafeSites(random);

  return {
    zones: stripSeedMetadata(generatedZones),
    habitations: stripSeedMetadata(generatedHabitations),
    safeSites: stripSeedMetadata(generatedSafeSites),
    stateCounts: STATES.reduce((counts, state) => {
      counts[state.name] = {
        zones: generatedZones.filter((zone) => zone._seedState === state.name).length,
        habitations: generatedHabitations.filter((habitation) => habitation._seedState === state.name).length,
        safeSites: generatedSafeSites.filter((site) => site._seedState === state.name).length
      };
      return counts;
    }, {})
  };
};

const seed = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to seed the database.');
  }

  const { zones, habitations, safeSites, stateCounts } = generateSeedData();
  await mongoose.connect(process.env.MONGO_URI);

  await Promise.all([
    Zone.deleteMany({}),
    Habitation.deleteMany({}),
    SafeSite.deleteMany({})
  ]);

  const [insertedZones, insertedHabitations, insertedSafeSites] = await Promise.all([
    Zone.insertMany(zones),
    Habitation.insertMany(habitations),
    SafeSite.insertMany(safeSites)
  ]);

  console.log(`Pan-India seed completed: ${insertedZones.length} zones, ${insertedHabitations.length} habitations, ${insertedSafeSites.length} safe sites.`);
  console.table(stateCounts);
};

if (require.main === module) {
  seed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Pan-India seed failed:', error.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { generateSeedData };
