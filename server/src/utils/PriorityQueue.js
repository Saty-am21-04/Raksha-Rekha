const boundScore = (value) => Math.round(Math.min(Math.max(Number(value) || 0, 0), 100));

class PriorityQueue {
  constructor(compare = (first, second) => {
    if (second.priority !== first.priority) return second.priority - first.priority;
    return first.sequence - second.sequence;
  }) {
    this.compare = compare;
    this.heap = [];
    this.positions = new Map();
    this.sequence = 0;
  }

  size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }
  peek() { return this.heap[0]?.item; }
  clear() { this.heap = []; this.positions.clear(); }

  enqueue(item, priorityData = {}) {
    const id = this.getId(item);
    if (!id || id === 'undefined') throw new Error('PriorityQueue item requires id, _id, or name.');
    if (this.positions.has(id)) return this.updatePriority(id, priorityData);
    const priority = priorityData.priority ?? calculateEvacuationPriority(priorityData);
    const entry = { id, item, priority: boundScore(priority), priorityData, sequence: this.sequence++ };
    this.heap.push(entry);
    this.positions.set(id, this.heap.length - 1);
    this.bubbleUp(this.heap.length - 1);
    return item;
  }

  dequeue() {
    if (this.isEmpty()) return undefined;
    const top = this.heap[0];
    this.removeAt(0);
    return top.item;
  }

  updatePriority(itemId, priorityData = {}) {
    const index = this.positions.get(itemId);
    if (index === undefined) return undefined;
    this.heap[index].priorityData = priorityData;
    this.heap[index].priority = boundScore(priorityData.priority ?? calculateEvacuationPriority(priorityData));
    this.bubbleUp(index);
    this.bubbleDown(this.positions.get(itemId));
    return this.heap[this.positions.get(itemId)]?.item;
  }

  remove(itemId) {
    const index = this.positions.get(itemId);
    if (index === undefined) return undefined;
    const entry = this.heap[index];
    this.removeAt(index);
    return entry.item;
  }

  toArray() { return [...this.heap].sort((first, second) => this.compareEntries(first, second)).map((entry) => entry.item); }
  entries() {
    return [...this.heap].sort((first, second) => this.compareEntries(first, second)).map((entry) => ({
      item: entry.item,
      priority: entry.priority,
      priorityData: entry.priorityData
    }));
  }

  getId(item) { return String(item?._id ?? item?.id ?? item?.name); }
  compareEntries(first, second) { return this.compare(first, second) || first.sequence - second.sequence; }

  swap(firstIndex, secondIndex) {
    [this.heap[firstIndex], this.heap[secondIndex]] = [this.heap[secondIndex], this.heap[firstIndex]];
    this.positions.set(this.heap[firstIndex].id, firstIndex);
    this.positions.set(this.heap[secondIndex].id, secondIndex);
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compareEntries(this.heap[index], this.heap[parent]) >= 0) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  bubbleDown(index) {
    if (index === undefined) return;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.heap.length && this.compareEntries(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < this.heap.length && this.compareEntries(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  removeAt(index) {
    const removed = this.heap[index];
    const last = this.heap.pop();
    this.positions.delete(removed?.id);
    if (index >= this.heap.length || !last) return;
    this.heap[index] = last;
    this.positions.set(last.id, index);
    this.bubbleUp(index);
    this.bubbleDown(this.positions.get(last.id));
  }
}

const calculateEvacuationPriority = (risk = {}) => {
  const vulnerability = Number(risk.vulnerability)
    || (Number(risk.elderlyAndChildrenRatio) || 0) * 55
      + (Number(risk.structuralFragility) || 0) * 45;

  return boundScore(
    (Number(risk.zoneRiskScore) || Number(risk.hazardIntensity) || 0) * 0.45
    + Math.min((Number(risk.population) || 0) / 1000 * 20, 20)
    + vulnerability * 0.25
    + (risk.accessRoadsCutoffRisk ? 15 : 0)
    + (risk.disasterHistory || risk.isBacktest ? 5 : 0)
  );
};

module.exports = { PriorityQueue, calculateEvacuationPriority };
