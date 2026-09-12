const Zone = require('../models/Zone');
const Habitation = require('../models/Habitation');
const SafeSite = require('../models/SafeSite');

const buildSnapshot = async () => {
  const [zones, habitations, safeSites] = await Promise.all([
    Zone.find({}).sort({ riskScore: -1 }).limit(8).lean(),
    Habitation.find({}).sort({ evacuationPriority: -1 }).limit(12).lean(),
    SafeSite.find({}).lean()
  ]);

  const availableCapacity = safeSites.reduce(
    (total, site) => total + Math.max(Number(site.totalCapacity || 0) - Number(site.currentOccupancy || 0), 0),
    0
  );
  const priorityPopulation = habitations.reduce((total, habitation) => total + Number(habitation.population || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    sourceDataTimestamp: new Date().toISOString(),
    zones: zones.map((zone) => ({ name: zone.name, status: zone.status, riskScore: zone.riskScore, hazardType: zone.hazardType })),
    habitations: habitations.map((habitation) => ({
      name: habitation.name,
      population: habitation.population,
      evacuationPriority: habitation.evacuationPriority
    })),
    capacity: {
      safeSiteCount: safeSites.length,
      availableCapacity,
      priorityPopulation,
      deficit: Math.max(priorityPopulation - availableCapacity, 0)
    }
  };
};

const requestGeminiSitrep = async (snapshot, fetcher = fetch) => {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GEMINI_TIMEOUT_MS) || 8000);
  try {
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create a concise disaster operations situation report. Treat this as decision support, not an evacuation order. Data: ${JSON.stringify(snapshot)}`
            }]
          }]
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini request failed with ${response.status}.`);
    const payload = await response.json();
    return String(payload.candidates?.[0]?.content?.parts?.[0]?.text || '').slice(0, 4000);
  } finally {
    clearTimeout(timeout);
  }
};

const generateSitrep = async (providers = {}) => {
  const snapshot = providers.snapshot || await buildSnapshot();
  const report = await requestGeminiSitrep(snapshot, providers.fetcher);
  return { generatedAt: new Date().toISOString(), sourceDataTimestamp: snapshot.sourceDataTimestamp, report, decisionSupportOnly: true };
};

module.exports = { buildSnapshot, generateSitrep, requestGeminiSitrep };
