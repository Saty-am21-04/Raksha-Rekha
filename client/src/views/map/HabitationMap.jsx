import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useMemo, useRef } from 'react';
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/maplibre';

const zoneFill = {
  id: 'zone-fill',
  type: 'fill',
  paint: {
    'fill-color': ['match', ['get', 'status'], 'RED', '#e11d48', 'YELLOW', '#fbbf24', '#10b981'],
    'fill-opacity': 0.24
  }
};

const zoneLine = {
  id: 'zone-line',
  type: 'line',
  paint: {
    'line-color': ['match', ['get', 'status'], 'RED', '#e11d48', 'YELLOW', '#fbbf24', '#10b981'],
    'line-width': 2
  }
};

const routeLine = {
  id: 'relocation-route',
  type: 'line',
  paint: {
    'line-color': ['case', ['get', 'intersectsRedZone'], '#ef4444', '#10b981'],
    'line-width': 4,
    'line-opacity': 0.92
  }
};

const getRadius = (priority = 0) => {
  const boundedPriority = Math.min(Math.max(Number(priority) || 0, 0), 100);
  return Math.round(14 + boundedPriority * 0.12);
};
const toArray = (value) => Array.isArray(value) ? value : [];
const toPointGeometry = (location) => {
  if (!Array.isArray(location?.coordinates) || location.coordinates.length !== 2) return null;
  return { type: 'Point', coordinates: location.coordinates };
};

const priorityStatus = (priority = 0) => {
  if (priority >= 70) return 'RED';
  if (priority >= 40) return 'YELLOW';
  return 'SAFE';
};

const asZoneFeatureCollection = (zones) => ({
  type: 'FeatureCollection',
  features: toArray(zones)
    .filter((zone) => zone.geometry?.type === 'Polygon' && Array.isArray(zone.geometry.coordinates))
    .map((zone) => ({
      type: 'Feature',
      geometry: zone.geometry,
      properties: {
        name: zone.name || 'Unnamed zone',
        hazardType: zone.hazardType || 'unknown',
        riskScore: Number(zone.riskScore) || 0,
        status: zone.status || 'SAFE',
        rainfall72h: Number(zone.metrics?.rainfall72h) || 0,
        slopeAngle: Number(zone.metrics?.slopeAngle) || 0,
        soilSaturation: Number(zone.metrics?.soilSaturation) || 0,
        isBacktest: Boolean(zone.isBacktest)
      }
    }))
});

const getZoneBounds = (featureCollection) => {
  const points = featureCollection.features.flatMap((feature) => (
    feature.geometry?.coordinates?.flatMap((ring) => ring) || []
  ));

  if (!points.length) return null;

  return points.reduce(
    ([minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude], [longitude, latitude]) => [
      Math.min(minimumLongitude, longitude),
      Math.min(minimumLatitude, latitude),
      Math.max(maximumLongitude, longitude),
      Math.max(maximumLatitude, latitude)
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
};

const emptyRoutes = { type: 'FeatureCollection', features: [] };

const HabitationMap = ({ zones = [], habitations = [], safeSites = [], routeFeature, onSelect }) => {
  const mapRef = useRef(null);
  const zoneFeatures = useMemo(() => asZoneFeatureCollection(zones), [zones]);
  const habitationFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: toArray(habitations)
      .map((habitation) => ({ habitation, geometry: toPointGeometry(habitation.location) }))
      .filter(({ geometry }) => geometry)
      .map(({ habitation, geometry }) => {
        const priority = Number(habitation.evacuationPriority) || 0;
        return {
          type: 'Feature',
          geometry,
          properties: {
            name: habitation.name || 'Unnamed habitation',
            population: Number(habitation.population) || 0,
            evacuationPriority: priority,
            radius: getRadius(priority),
            status: priorityStatus(priority),
            elderlyAndChildrenRatio: Number(habitation.vulnerabilityFactors?.elderlyAndChildrenRatio) || 0,
            structuralFragility: Number(habitation.vulnerabilityFactors?.structuralFragility) || 0,
            accessRoadsCutoffRisk: Boolean(habitation.vulnerabilityFactors?.accessRoadsCutoffRisk),
            isBacktest: Boolean(habitation.isBacktest)
          }
        };
      })
  }), [habitations]);
  const safeSiteFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: toArray(safeSites)
      .map((site) => ({ site, geometry: toPointGeometry(site.location) }))
      .filter(({ geometry }) => geometry)
      .map(({ site, geometry }) => ({
        type: 'Feature',
        geometry,
        properties: {
          name: site.name || 'Unnamed safe site',
          totalCapacity: Number(site.totalCapacity) || 0,
          currentOccupancy: Number(site.currentOccupancy) || 0,
          status: 'SAFE',
          radius: 7
        }
      }))
  }), [safeSites]);
  const routeFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: routeFeature ? [routeFeature] : []
  }), [routeFeature]);

  useEffect(() => {
    const bounds = getZoneBounds(zoneFeatures);
    if (!bounds || !mapRef.current) return;

    const fitMap = () => {
      mapRef.current.resize();
      mapRef.current.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        { padding: 80, maxZoom: 6, duration: 0 }
      );
    };

    const timer = window.setTimeout(fitMap, 250);
    return () => window.clearTimeout(timer);
  }, [zoneFeatures]);

  return (
    <div className="h-full w-full min-h-0 overflow-hidden">
      <Map
        reuseMaps
        ref={mapRef}
        initialViewState={{
          longitude: 82,
          latitude: 20.5,
          zoom: 4.5
        }}
        mapStyle={{
          version: 8,
          sources: {
            'esri-dark': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
              ],
              tileSize: 256
            }
          },
          layers: [
            {
              id: 'esri-dark-layer',
              type: 'raster',
              source: 'esri-dark',
              minzoom: 0,
              maxzoom: 16 // Esri caps this layer at zoom 16, which is plenty for our region
            }
          ]
        }}
        interactiveLayerIds={['zone-fill', 'habitation-circles', 'safe-site-circles']}
        style={{ height: '100%', width: '100%' }}
        onLoad={(event) => { mapRef.current = event.target; }}
        onClick={(event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          if (feature.layer?.id === 'zone-fill') {
            onSelect?.({
              type: 'zone',
              data: {
                ...feature.properties,
                metrics: {
                  rainfall72h: feature.properties.rainfall72h,
                  slopeAngle: feature.properties.slopeAngle,
                  soilSaturation: feature.properties.soilSaturation
                }
              }
            });
          } else if (feature.layer?.id === 'habitation-circles') {
            onSelect?.({
              type: 'habitation',
              data: {
                ...feature.properties,
                vulnerabilityFactors: {
                  elderlyAndChildrenRatio: feature.properties.elderlyAndChildrenRatio,
                  structuralFragility: feature.properties.structuralFragility,
                  accessRoadsCutoffRisk: feature.properties.accessRoadsCutoffRisk
                }
              }
            });
          } else if (feature.layer?.id === 'safe-site-circles') {
            onSelect?.({ type: 'safeSite', data: feature.properties });
          }
        }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <Source id="risk-zones" type="geojson" data={zoneFeatures}>
          <Layer {...zoneFill} />
          <Layer {...zoneLine} />
        </Source>

        <Source id="relocation-route-source" type="geojson" data={routeFeatures || emptyRoutes}>
          <Layer {...routeLine} />
        </Source>

        <Source id="habitations-source" type="geojson" data={habitationFeatures}>
          <Layer
            id="habitation-circles"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'evacuationPriority'], 0, 4, 40, 7, 70, 11, 100, 16],
              'circle-color': ['match', ['get', 'status'], 'RED', '#e11d48', 'YELLOW', '#fbbf24', '#10b981'],
              'circle-opacity': 0.42,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': ['match', ['get', 'status'], 'RED', '#e11d48', 'YELLOW', '#fbbf24', '#10b981'],
              'circle-stroke-opacity': 0.9
            }}
          />
        </Source>

        <Source id="safe-sites-source" type="geojson" data={safeSiteFeatures}>
          <Layer
            id="safe-site-circles"
            type="circle"
            paint={{
              'circle-radius': ['get', 'radius'],
              'circle-color': '#10b981',
              'circle-opacity': 0.42,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#10b981',
              'circle-stroke-opacity': 0.9
            }}
          />
        </Source>
      </Map>
    </div>
  );
};

export default HabitationMap;
