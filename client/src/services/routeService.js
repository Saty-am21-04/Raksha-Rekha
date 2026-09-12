import { booleanIntersects, distance, lineString, point, polygon } from '@turf/turf';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

const coordinatesOf = (record) => record?.location?.coordinates;

export const findNearestSafeSite = (habitation, safeSites = []) => {
  const origin = coordinatesOf(habitation);
  if (!origin) return null;
  return safeSites
    .filter((site) => coordinatesOf(site))
    .map((site) => ({ site, distanceKm: distance(point(origin), point(coordinatesOf(site)), { units: 'kilometers' }) }))
    .sort((first, second) => first.distanceKm - second.distanceKm)[0]?.site || null;
};

export const fetchSafeRoute = async (habitation, safeSite, redZones = [], signal, fetcher = fetch) => {
  const origin = coordinatesOf(habitation);
  const destination = coordinatesOf(safeSite);
  if (!origin || !destination) throw new Error('Route endpoints require GeoJSON Point coordinates.');

  const response = await fetcher(`${OSRM_URL}/${origin.join(',')};${destination.join(',')}?overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error(`OSRM request failed with ${response.status}.`);
  const payload = await response.json();
  const route = payload.routes?.[0]?.geometry;
  if (!route || route.type !== 'LineString') throw new Error('OSRM returned no usable route.');

  const routeLine = lineString(route.coordinates);
  const intersectsRedZone = redZones.some((zone) => zone.geometry?.type === 'Polygon'
    && booleanIntersects(routeLine, polygon(zone.geometry.coordinates)));

  return {
    type: 'Feature',
    geometry: route,
    properties: { safeSite: safeSite.name, intersectsRedZone }
  };
};
