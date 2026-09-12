const { PriorityQueue, calculateEvacuationPriority } = require('../utils/PriorityQueue');

const buildEvacuationQueue = (habitations = [], zone = {}) => {
  const queue = new PriorityQueue();

  habitations.forEach((habitation) => {
    const factors = habitation.vulnerabilityFactors || {};
    queue.enqueue(habitation, {
      zoneRiskScore: zone.riskScore,
      population: habitation.population,
      elderlyAndChildrenRatio: factors.elderlyAndChildrenRatio,
      structuralFragility: factors.structuralFragility,
      accessRoadsCutoffRisk: factors.accessRoadsCutoffRisk,
      isBacktest: habitation.isBacktest || zone.isBacktest
    });
  });

  return queue;
};

const normalizePriorityUpdate = (queue) => ({
  priorities: queue.entries().map(({ item, priority }) => ({
    id: item._id?.toString() || item.id || item.name,
    name: item.name,
    population: item.population,
    evacuationPriority: priority
  }))
});

module.exports = {
  buildEvacuationQueue,
  calculateEvacuationPriority,
  normalizePriorityUpdate
};
