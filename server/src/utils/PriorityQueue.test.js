const assert = require('node:assert/strict');
const { PriorityQueue, calculateEvacuationPriority } = require('./PriorityQueue');

const queue = new PriorityQueue();
queue.enqueue({ id: 'low' }, { priority: 10 });
queue.enqueue({ id: 'high' }, { priority: 90 });
queue.enqueue({ id: 'middle' }, { priority: 50 });
assert.equal(queue.dequeue().id, 'high');
queue.updatePriority('low', { priority: 100 });
assert.equal(queue.peek().id, 'low');
assert.equal(queue.remove('middle').id, 'middle');
assert.equal(queue.size(), 1);

queue.clear();
queue.enqueue({ id: 'first' }, { priority: 50 });
queue.enqueue({ id: 'second' }, { priority: 50 });
assert.equal(queue.dequeue().id, 'first');
assert.equal(queue.dequeue().id, 'second');
assert.equal(queue.dequeue(), undefined);
assert.equal(queue.isEmpty(), true);

const dynamicPriority = calculateEvacuationPriority({
  zoneRiskScore: 95,
  population: 1800,
  elderlyAndChildrenRatio: 0.4,
  structuralFragility: 0.8,
  accessRoadsCutoffRisk: true,
  isBacktest: true
});
assert.equal(dynamicPriority, 97);

queue.enqueue({ id: 'dynamic-low' }, { zoneRiskScore: 20, population: 100 });
queue.enqueue({ id: 'dynamic-high' }, { zoneRiskScore: 90, population: 2000, accessRoadsCutoffRisk: true });
assert.equal(queue.peek().id, 'dynamic-high');
queue.updatePriority('dynamic-low', { zoneRiskScore: 100, population: 5000, accessRoadsCutoffRisk: true });
assert.equal(queue.peek().id, 'dynamic-low');

console.log('PriorityQueue smoke test passed.');
