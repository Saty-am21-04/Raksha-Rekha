import assert from 'node:assert/strict';
import { fetchSafeRoute, findNearestSafeSite } from './routeService.js';

const habitation = { name: 'Origin', location: { coordinates: [76, 11] } };
const safeSites = [
  { name: 'Far', location: { coordinates: [77, 12] } },
  { name: 'Near', location: { coordinates: [76.1, 11.1] } }
];

assert.equal(findNearestSafeSite(habitation, safeSites).name, 'Near');

const blocked = await fetchSafeRoute(habitation, safeSites[1], [{
  status: 'RED',
  geometry: { type: 'Polygon', coordinates: [[[76.03, 11.03], [76.08, 11.03], [76.08, 11.08], [76.03, 11.08], [76.03, 11.03]]] }
}], undefined, async () => ({
  ok: true,
  json: async () => ({ routes: [{ geometry: { type: 'LineString', coordinates: [[76, 11], [76.05, 11.05], [76.1, 11.1]] } }] })
}));

assert.equal(blocked.properties.intersectsRedZone, true);

const clear = await fetchSafeRoute(habitation, safeSites[1], [{
  status: 'RED',
  geometry: { type: 'Polygon', coordinates: [[[80, 20], [81, 20], [81, 21], [80, 21], [80, 20]]] }
}], undefined, async () => ({
  ok: true,
  json: async () => ({ routes: [{ geometry: { type: 'LineString', coordinates: [[76, 11], [76.1, 11.1]] } }] })
}));

assert.equal(clear.properties.intersectsRedZone, false);
console.log('Route service smoke test passed.');
