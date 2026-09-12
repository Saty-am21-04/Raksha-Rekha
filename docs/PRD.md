# RAKSHA-REKHA Master Product Requirements Document

**Hackathon:** Smart India Hackathon 2026  
**Problem ID:** SIH26191  
**Stakeholders:** Ministry of Home Affairs / National Disaster Response Force (NDRF)  
**Final Sprint Deadline:** September 13, 2026

## 1. Executive Summary

RAKSHA-REKHA is an AI-driven GIS disaster-management platform for identifying hazard-based red zones, assessing the carrying capacity of safer sites, and prioritizing immediate relocation for vulnerable habitations.

The platform combines multi-hazard scoring, habitation-level population vulnerability, historical disaster evidence, spatial analysis, and explainable relocation intelligence in a tactical command-center dashboard.

## 2. Official Problem Statement

### Title

**Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.**

### Key Pain Point

Relocation is currently reactive. Vulnerable habitations remain in unsafe zones, leading to repeated loss of lives.

Disaster-management teams need earlier, evidence-based visibility into which habitations are exposed, why they are exposed, where people can be relocated, and whether alternative sites have sufficient carrying capacity.

### Core Requirements

RAKSHA-REKHA must:

1. Dynamically identify multi-hazard Red Zones.
2. Assess the carrying capacity of safer alternative sites.
3. Prioritize vulnerable habitations by integrating:
   - Hazard intensity
   - Population vulnerability
   - Disaster history

## 3. Product Vision

Move disaster relocation planning from reactive response to proactive, explainable readiness.

The system should help authorities answer four operational questions quickly:

- **Where is the danger?** Identify and visualize Red Zones on a live GIS map.
- **Who must move first?** Rank habitations using population and vulnerability factors.
- **Where can they go?** Locate safer alternative sites and calculate available capacity.
- **Can we trust the recommendation?** Explain the inputs, score, historical evidence, and capacity result.

## 4. Winning Edge: The Solution

### 4.1 MERN GIS Dashboard

RAKSHA-REKHA is a MERN stack GIS dashboard:

- **Frontend:** React.js
- **Backend:** Node.js and Express.js
- **Database:** MongoDB Atlas with GeoJSON documents and `2dsphere` indexes
- **Map engine:** MapLibre GL with an Esri Dark Gray Canvas raster basemap

The strict MVC structure separates React views and controllers from Express routes, controllers, domain services, and Mongoose models.

### 4.2 Wayanad 2024 Backtest Toggle

The dashboard includes a **Wayanad 2024 Backtest Toggle**. When enabled, it feeds historical disaster data into the scoring engine to demonstrate whether the platform would have identified high-risk areas before the event.

The backtest dataset includes:

- **573 mm of rainfall** over the historical event window
- The Punnapuzha Catchment Red Zone
- The actual swept-away villages represented in the dataset:
  - Punchirimattam
  - Mundakkai
  - Chooralmala
- Mock nearby relief camps with constrained capacity for overflow testing

The backtest is a demonstration and validation mode. It must be clearly separated from live operational data in the interface.

### 4.3 Tactical Command Center UX

The user experience is designed as a serious, high-signal **Tactical Command Center** rather than a marketing dashboard.

Design requirements:

- Pure black backgrounds using `bg-black`
- Extremely dark surface panels using `bg-[#050505]`
- Ultra-thin dark borders using `border-[#1a1a1a]`
- High-contrast white primary text
- Gray secondary text
- Esri Dark Gray Canvas raster maps to bypass vector-style and API-key blocks
- Strict status colors:
  - **Crimson:** Danger and Red Zone states
  - **Gold:** Warning and medium-risk states
  - **Emerald:** Safe sites and nominal states

The dashboard must prioritize scanning, spatial context, queue order, and explainability over decorative UI.

## 5. Core Product Capabilities

### 5.1 Multi-Hazard Red Zone Scoring

The scoring engine calculates a normalized risk score from 0 to 100 and assigns a zone status:

- `RED`: immediate relocation assessment required
- `YELLOW`: heightened monitoring and preparedness required
- `SAFE`: no current high-priority relocation signal from the configured inputs

The initial scoring inputs include:

- Rainfall intensity over the relevant period
- Slope angle
- Soil saturation
- Hazard type
- Historical disaster context

### 5.2 Vulnerable Habitation Prioritization

When a zone is classified as `RED`, habitations within its GeoJSON Polygon are prioritized using:

- Population
- Elderly and children ratio
- Structural fragility
- Access-road cutoff risk

The result is a ranked evacuation queue for the command-center sidebar.

### 5.3 Safe-Site Carrying Capacity

For designated safe sites, the system must calculate:

- Total capacity
- Current occupancy
- Available capacity
- Required evacuation population
- Capacity deficit or overflow
- Nearest safe-site ordering

The dashboard must make insufficient capacity immediately visible to decision-makers.

### 5.4 Explainability Panel

Selecting a zone or habitation opens an explainability panel showing:

- 72-hour rainfall
- Slope angle
- Soil saturation
- Evacuation priority
- Contributing vulnerability factors
- Safe-site capacity versus required evacuees
- Historical or backtest context when applicable

## 6. Data and Spatial Requirements

### Zone

Zones use standard GeoJSON `Polygon` geometry and a MongoDB `2dsphere` index.

Required concepts:

- Name
- Hazard type
- Polygon geometry
- Risk score
- Status
- Hazard metrics
- Backtest flag

### Habitation

Habitations use standard GeoJSON `Point` geometry and a MongoDB `2dsphere` index.

Required concepts:

- Name
- Point location
- Population
- Vulnerability factors
- Evacuation priority
- Backtest flag

### Safe Site

Safe sites use standard GeoJSON `Point` geometry and a MongoDB `2dsphere` index.

Required concepts:

- Name
- Point location
- Total capacity
- Current occupancy

All coordinates must follow GeoJSON order: `[longitude, latitude]`.

## 7. Final-Sprint User Flow

1. The authority opens the Tactical Command Center.
2. The map loads the current or backtest spatial dataset.
3. Red Zones render as crimson polygons.
4. Habitations render as priority-colored markers.
5. Safe sites render as emerald markers.
6. The metric cards show total exposed population and capacity deficit.
7. The habitation queue ranks who should be evacuated first.
8. Selecting a zone or habitation opens the explainability panel.
9. Enabling the Wayanad 2024 Backtest Toggle reloads the historical dataset.
10. The scoring result and carrying-capacity overflow are visible without requiring manual data inspection.

## 8. Acceptance Criteria

- A user can load the React dashboard without a blank screen.
- The raster basemap renders without requiring a Mapbox API key.
- Zones, habitations, and safe sites are represented with valid GeoJSON.
- A Red Zone can be selected from the map.
- A habitation can be selected from either the map or priority queue.
- The dashboard displays the Wayanad backtest state clearly.
- The 573 mm historical rainfall input is visible in backtest explainability data.
- The three Wayanad habitation records are included in backtest results.
- The API returns safe-site capacity and occupancy data.
- The UI exposes capacity deficit when required evacuees exceed available capacity.
- Loading, empty, API-error, and offline states are handled visibly.
- The frontend consumes live API results rather than silently relying on demo data in the completed sprint build.

## 9. Final-Sprint Execution Roadmap

The remaining integration work is divided across four members. Each checklist item is required for the live vertical slice.

### Backend Member 1: Express Controllers

- [ ] Implement `habitationController.js`.
- [ ] Serve habitation records from the Mongoose `Habitation` model.
- [ ] Support filtering by `isBacktest`.
- [ ] Return GeoJSON-compatible habitation locations and priority data.
- [ ] Implement `riskController.js`.
- [ ] Serve zone records from the Mongoose `Zone` model.
- [ ] Return risk scores, statuses, metrics, and Polygon geometry.
- [ ] Implement `backtestController.js`.
- [ ] Return the Wayanad zones, habitations, safe sites, and scoring results.
- [ ] Return capacity deficit and overflow information.
- [ ] Add consistent response and error shapes for all controllers.

### Backend Member 2: Routes, Middleware, and Scoring Integration

- [ ] Wire `habitationRoutes.js` to the habitation controller.
- [ ] Wire `riskRoutes.js` to the risk controller.
- [ ] Wire `backtestRoutes.js` to the backtest controller.
- [ ] Finalize `app.js` middleware and route mounting.
- [ ] Implement the real 404 middleware.
- [ ] Implement the centralized error handler.
- [ ] Connect `scoringService.js` to the live risk and backtest endpoints.
- [ ] Ensure every Red Zone response includes prioritized habitations.
- [ ] Ensure every backtest response includes carrying-capacity calculations.
- [ ] Verify MongoDB connection configuration and server startup scripts.
- [ ] Add endpoint smoke tests for health, zones, habitations, safe sites, and backtest mode.

### Frontend Member 1: API Client and Remote State

- [ ] Update `apiClient.js` to hit the finalized local API paths.
- [ ] Confirm the base URL uses `VITE_API_BASE_URL` with the local API fallback.
- [ ] Build `useHabitationController` for habitation loading, selection, and errors.
- [ ] Build `useRiskController` for zones, scores, and risk-state updates.
- [ ] Build or complete `useBacktestController` for toggle state and historical data loading.
- [ ] Normalize API response envelopes in one place.
- [ ] Add request cancellation or stale-response protection for toggle changes.
- [ ] Expose loading, empty, error, and retry state to the views.

### Frontend Member 2: Live Dashboard Wiring

- [ ] Remove the mock demo data from `MapPage.jsx` for the completed integration build.
- [ ] Connect live API zone data to MapLibre Polygon layers.
- [ ] Connect live habitation data to MapLibre markers.
- [ ] Connect live safe-site data to MapLibre markers.
- [ ] Connect live priority scores to the prioritized habitation list.
- [ ] Connect live capacity data to the metric cards.
- [ ] Connect selected API records to the Explainability slide-over panel.
- [ ] Add visible loading states while map data is requested.
- [ ] Add visible error states when the API or database is unavailable.
- [ ] Add an empty-state message when no zones or habitations are returned.
- [ ] Confirm the Wayanad 2024 Backtest Toggle refreshes all displayed data atomically.
- [ ] Verify desktop and mobile layouts in the final browser walkthrough.

## 10. Technical Definition of Done

The final sprint is complete when:

- The server connects to MongoDB Atlas and exposes the feature API.
- The frontend loads its operational data from the server.
- The map displays the raster basemap and live GeoJSON overlays.
- The scoring engine determines risk and evacuation priority through an API request.
- The backtest toggle switches between live and Wayanad historical data.
- Safe-site capacity overflow is visible in both API data and the dashboard.
- Explainability data is traceable to the scoring inputs.
- The team can run the frontend and backend locally using documented commands.
- The final demo can be completed without editing source data manually.

## 11. Scope and Safety Boundaries

RAKSHA-REKHA is a decision-support and demonstration platform for disaster-management planning. It is not an autonomous evacuation authority, an official warning system, or a replacement for NDRF and district-level command decisions.

The Wayanad backtest demonstrates historical validation and should not be presented as a live prediction for any current event without authoritative operational data and review.
