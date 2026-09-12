# RAKSHA-REKHA Execution Playbook

**Project:** RAKSHA-REKHA  
**Problem ID:** SIH26191  
**Purpose:** Enterprise-grade, real-time disaster operations engine  
**Usage:** Copy and execute one phase prompt at a time. Do not begin the next phase until the current phase's implementation and verification checks pass.

## Operating Rules

- Preserve existing functionality and work with the current repository conventions.
- Inspect the relevant files before editing them.
- Keep secrets in environment variables and never commit credentials.
- Use GeoJSON coordinate order: `[longitude, latitude]`.
- Add focused tests or executable smoke checks for every new integration.
- Report changed files, commands run, and known limitations after each phase.
- Do not claim a live integration works unless it has been exercised locally.

## Phase 1: The Pan-India Massive Seed

Copy and execute this prompt:

```text
You are an expert Node.js, MongoDB, and GeoJSON engineer. Upgrade the RAKSHA-REKHA database seed in server/src/seed.js into a procedural Pan-India disaster-data generator.

Before editing, inspect the current Zone, Habitation, and SafeSite Mongoose schemas, the scoring service, server package scripts, and environment configuration. Preserve existing schema contracts and use process.env.MONGO_URI. Do not hardcode credentials.

Rewrite server/src/seed.js so it:

1. Connects to MongoDB with dotenv and awaits the connection.
2. Clears the Zone, Habitation, and SafeSite collections before inserting new data.
3. Procedurally generates at least:
   - 300 habitations
   - 20 hazard zones
   - 40 safe sites
4. Distributes the generated data across four Indian states. Use four clearly named state regions with realistic approximate coordinates, such as Kerala, Maharashtra, Assam, and Odisha. Keep every coordinate valid and use [longitude, latitude] order.
5. Generates valid GeoJSON:
   - Zones must use closed Polygon rings.
   - Habitations and safe sites must use Point geometry.
   - Ensure generated habitation points are inside or deliberately near their associated hazard zones.
   - Ensure safe sites are outside their associated hazard zones where practical.
6. Uses realistic data ranges:
   - Multiple hazard types such as landslide, flood, cyclone, and wildfire where supported by the current schema.
   - Risk scores from 0 to 100.
   - RED, YELLOW, and SAFE statuses consistent with risk scores.
   - Rainfall, slope angle, and soil saturation metrics appropriate to each hazard.
   - Population and vulnerability factors for every habitation.
   - Capacity and occupancy for every safe site.
7. Uses insertMany for bulk insertion of generated documents. Keep the generation deterministic by using a seeded pseudo-random generator or a clearly documented deterministic strategy so repeated runs are reproducible.
8. Marks the generated dataset with an explicit backtest or dataset identifier only if the existing schemas support it. Do not invent fields without updating the schema and explaining why.
9. Logs a concise summary including the inserted counts by entity and state.
10. Disconnects from MongoDB and exits with code 0 on success and code 1 on failure.

Do not modify unrelated application logic. If the current schema cannot represent the required data, make the smallest compatible schema change and call it out explicitly.

Verification required before finishing:
- Run node --check on the seed and any changed CommonJS files.
- Run a validation-only or mocked generation check that confirms at least 300 habitations, 20 zones, and 40 safe sites, valid closed polygons, valid point coordinates, and no schema validation errors.
- If a live MongoDB connection is available, run the seed and verify collection counts. Clearly distinguish live verification from mocked verification.
- Report all changed files, commands, counts, and any data realism limitations.
```

## Phase 2: The Custom Priority Queue Engine

Copy and execute this prompt:

```text
You are an expert data-structures and disaster-operations engineer. Create server/src/utils/PriorityQueue.js for RAKSHA-REKHA.

Before editing, inspect the current scoring service, habitation model, controllers, package configuration, and test conventions. Preserve the existing CommonJS module style unless the repository requires another format.

Implement a true heap-based Priority Queue in JavaScript, adapting standard C-style queue logic into a clear, idiomatic JavaScript class. The queue must manage evacuation order dynamically as incoming risk variables change.

Requirements:

1. Implement a binary heap, not an array sort performed only at dequeue time.
2. Support a configurable comparator or priority calculation.
3. Expose practical operations:
   - enqueue(item, priorityData)
   - dequeue()
   - peek()
   - updatePriority(itemId, priorityData) or an equivalent decrease/increase-priority operation
   - remove(itemId) if needed for stale or evacuated records
   - clear()
   - size()
   - isEmpty()
   - toArray()
4. Maintain stable behavior for equal priorities using a deterministic tie-breaker.
5. Calculate evacuation priority from incoming risk variables, including at minimum:
   - Hazard intensity or zone risk score
   - Population exposure
   - Elderly/children vulnerability
   - Structural fragility
   - Access-road cutoff risk
   - Disaster-history or backtest signal when available
6. Keep the priority calculation bounded and documented, preferably on a 0-100 scale consistent with the existing scoring service.
7. Make updates efficient. Avoid rebuilding the entire queue for a single priority update.
8. Make duplicate item handling explicit and safe.
9. Export the class and any small pure helper required by controllers or services.
10. Do not add UI code in this phase.

Integrate the queue into the smallest appropriate backend service only if the existing architecture has a clear integration point. Otherwise, implement and test the utility without speculative controller changes, and explain the next integration point.

Verification required before finishing:
- Add focused tests or an executable smoke test covering heap ordering, equal-priority stability, priority updates, removal, empty behavior, and dynamic risk recalculation.
- Confirm enqueue and update operations preserve heap invariants.
- Run node --check and the focused test command.
- Report time complexity for enqueue, dequeue, peek, update, and remove.
```

## Phase 3: WebSockets & The IoT Simulator

Copy and execute this prompt:

```text
You are an expert real-time Node.js and React systems engineer. Integrate Socket.IO into RAKSHA-REKHA so live sensor updates can trigger evacuation Priority Queue recalculation.

Before editing, inspect server/src/server.js, server/src/app.js, the current PriorityQueue implementation, scoring services, React entrypoint, MapPage, API services, and package manifests. Preserve the current HTTP API and do not break graceful shutdown.

Implement the following:

1. Install and configure compatible socket.io and socket.io-client packages.
2. Integrate Socket.IO into server/src/server.js using the existing HTTP server instance. Do not replace the Express app or create a second HTTP listener.
3. Add clear connection, disconnection, validation, and error handling.
4. Define a small documented event contract, for example:
   - client -> server: sensor:update
   - server -> clients: risk:update
   - server -> clients: priority:update
   - server -> clients: sensor:error
5. Validate incoming sensor payloads before processing them. A sensor update must include a zone or habitation identifier and numeric rainfall/soil-saturation values with sensible bounds.
6. Update the relevant zone metrics, recalculate risk, and trigger the heap-based Priority Queue recalculation.
7. Broadcast only normalized, serializable payloads to connected clients. Do not broadcast Mongoose documents with internal state.
8. Add a React client integration that connects to the Socket.IO server, subscribes to risk/update events, updates the map and priority list, and cleans up listeners on unmount.
9. Keep the UI responsive while updates arrive. Handle reconnecting, disconnected, and invalid-update states visibly but unobtrusively.
10. Create server/scripts/iot-simulator.js as a standalone Node script. It must:
    - Connect as a Socket.IO client to the configured server URL.
    - Emit randomized but bounded rainfall and soil-saturation data every 3 seconds.
    - Target valid generated zone or habitation identifiers, or clearly support a configured demo identifier.
    - Log each emitted reading.
    - Stop cleanly on SIGINT/SIGTERM.
    - Keep the server URL and interval configurable through environment variables.
11. Do not expose secrets in logs or source files.

Verification required before finishing:
- Run focused server and client lint/build checks.
- Start the server and simulator locally.
- Confirm at least one sensor:update produces a risk:update or priority:update event.
- Confirm a browser client receives the event and updates state without duplicate listeners.
- Test clean shutdown for both server and simulator.
- Report the event contract, changed files, commands, and any limitations around persistence.
```

## Phase 4: Dynamic OSRM Routing

Copy and execute this prompt:

```text
You are an expert GIS frontend engineer. Integrate dynamic route planning into the RAKSHA-REKHA MapLibre dashboard using the free OSRM public API at http://router.project-osrm.org.

Before editing, inspect HabitationMap.jsx, MapPage.jsx, the current GeoJSON zone shape, safe-site data shape, package.json, and existing map layer patterns. Preserve the existing raster basemap, zone overlays, markers, callbacks, and pure-black tactical styling.

Implement the following:

1. Add a route request flow from a selected Habitation to the nearest Safe Site.
2. Determine the nearest safe site from the available safe-site Point coordinates using Turf.js distance calculations or a server-provided nearest-site result.
3. Call the OSRM route service using the correct coordinate order:
   http://router.project-osrm.org/route/v1/driving/{habitationLongitude},{habitationLatitude};{safeSiteLongitude},{safeSiteLatitude}?overview=full&geometries=geojson
4. Add the Turf.js dependency if it is not already installed.
5. Render the returned route as a GeoJSON Feature with a LineString geometry on the MapLibre map.
6. Style the route for the tactical UI and distinguish route-loading, route-ready, route-blocked, and route-error states.
7. Use Turf.js to verify whether the route intersects any RED Zone Polygon. Account for the route being a LineString and zones potentially containing holes.
8. If the route intersects a RED Zone, mark it unsafe, explain the conflict, and do not present it as an approved relocation route. Provide a clear alternate action such as selecting another safe site or requesting authority review.
9. If no safe site or route is available, render an explicit empty/error state instead of failing silently.
10. Clean up route layers and source data when the selected habitation changes or the component unmounts.
11. Keep API calls cancellable or stale-response safe so an older route cannot overwrite a newer selection.
12. Do not claim OSRM public API availability or route safety without checking the actual response.

Verification required before finishing:
- Use a known demo habitation and safe site to confirm a LineString is drawn.
- Add a test case where the route crosses a RED Zone and verify it is marked unsafe.
- Add a test case where the route avoids RED Zones and verify it is marked eligible for review.
- Run the client lint/build and a focused Turf/route smoke test.
- Report the OSRM response handling, intersection policy, changed files, and public-service limitations.
```

## Phase 5: Twilio SMS & Gemini AI Sit-Reps

Copy and execute this prompt:

```text
You are an expert secure Express integrations engineer. Add two production-shaped operational endpoints to RAKSHA-REKHA: a Twilio alert dispatch route with a Nodemailer fallback, and a Gemini-powered Situation Report route.

Before editing, inspect server/src/app.js, server/src/server.js, current controllers/routes, models, services, package.json, and environment conventions. Preserve existing APIs, error middleware, and startup behavior. Do not expose credentials or call external services at module import time.

Implement endpoint 1: Twilio SMS dispatch with email fallback.

1. Create a dedicated controller/service and route for dispatching an emergency notification.
2. Accept a validated payload containing recipients, message, and an optional subject/context.
3. Use Twilio only when its environment variables are configured:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_FROM_NUMBER
4. Send SMS messages to validated recipients through Twilio.
5. If Twilio is not configured or the SMS dispatch fails, use Nodemailer as an email fallback using environment-driven SMTP configuration.
6. Return a normalized response stating which channel was attempted, which recipients succeeded, and which failed. Never return secrets.
7. Add authentication/authorization or an explicit development-only guard before allowing emergency dispatch in a real deployment.
8. Add rate limiting, input limits, and structured error handling appropriate for a disaster alert endpoint.

Implement endpoint 2: Gemini AI Situation Report.

1. Create a route that consumes the current live zone, habitation, safe-site, capacity, and recent sensor data.
2. Use the Gemini API through an environment variable such as GEMINI_API_KEY. Do not hardcode the key.
3. Send a compact, structured prompt containing only the data needed for the report.
4. Request a Markdown or plain-text Situation Report containing:
   - Current operating status
   - Highest-risk zones
   - Priority habitations and populations
   - Safe-site capacity and deficit/overflow
   - Recent sensor changes
   - Recommended coordination actions
   - Explicit uncertainty and data-freshness notes
5. Treat the model output as decision support, not an authoritative evacuation order.
6. Validate and constrain the response length, handle provider timeouts, and return a useful error when Gemini is unavailable.
7. Do not let model-generated text execute as code or override server-side risk calculations.
8. Include a generated-at timestamp and the source-data timestamp in the response.

For both endpoints:

- Add the required dependencies only if missing.
- Add safe .env.example entries without real secrets.
- Keep provider clients injectable or easy to mock.
- Add focused tests with external providers mocked.
- Document local setup and curl/PowerShell examples.

Verification required before finishing:
- Run syntax, lint, and focused tests.
- Verify the Twilio path with a mocked provider.
- Verify the Nodemailer fallback with a mocked SMTP transport.
- Verify the Gemini route with a mocked provider response and a provider-failure case.
- Verify unauthorized or malformed dispatch requests are rejected.
- Report all environment variables, endpoint paths, response shapes, and remaining production hardening work.
```

## Phase Gate

After each phase, record:

- Implementation status
- Files changed
- Verification commands and results
- External services used
- Known limitations and follow-up work

Only proceed when the phase's focused checks pass and the next phase's assumptions are documented.

## Phase Completion Notes

### Phase 2: Custom Priority Queue Engine

- Implementation status: Complete structural slice.
- Files changed: `server/src/utils/PriorityQueue.js`, `server/src/utils/PriorityQueue.test.js`, `server/src/services/priorityService.js`, `server/package.json`.
- Verification command: `cd server && npm test`.
- Complexity: `enqueue` O(log n), `dequeue` O(log n), `peek` O(1), `updatePriority` O(log n), `remove` O(log n).
- External services used: None.
- Known limitations: Integrated into live sensor recalculation only; persistence of recalculated priority is still API/event-level, not database writeback.

### Phase 3: WebSockets & IoT Simulator

- Implementation status: Complete structural slice.
- Files changed: `server/src/server.js`, `server/scripts/iot-simulator.js`, `client/src/services/realtimeService.js`, `client/src/views/map/MapPage.jsx`, `server/package.json`.
- Event contract: client to server `sensor:update`; server to clients `risk:update`, `priority:update`, `sensor:error`.
- Verification commands: `cd server && node --check src/server.js`, `cd server && npm run simulate:iot` with the API server running.
- External services used: None.
- Known limitations: Sensor updates broadcast recalculated values but do not persist metric mutations to MongoDB.

### Phase 4: Dynamic OSRM Routing

- Implementation status: Complete structural slice.
- Files changed: `client/src/services/routeService.js`, `client/src/services/routeService.smoke.mjs`, `client/src/views/map/HabitationMap.jsx`, `client/src/views/map/MapPage.jsx`, `client/package.json`.
- Verification commands: `cd client && npm run test:route`, `cd client && npm run lint`, `cd client && npm run build`.
- External services used: OSRM public API at runtime only.
- Known limitations: Public OSRM has no uptime guarantee and routing is road-network-only; RED-zone intersection is advisory decision support.

### Phase 5: Twilio SMS & Gemini AI Sit-Reps

- Implementation status: Complete structural endpoint shells with provider guards.
- Files changed: `server/src/routes/opsRoutes.js`, `server/src/controllers/opsController.js`, `server/src/services/notificationService.js`, `server/src/services/sitrepService.js`, `server/src/services/opsService.test.js`, `server/src/app.js`, `server/.env.example`, `server/package.json`.
- Endpoint paths: `POST /api/ops/dispatch-alert`, `POST /api/ops/sitrep`.
- Verification command: `cd server && npm test`.
- External services used: Twilio, SMTP, and Gemini only when environment variables are configured.
- Known limitations: Alert dispatch has a development guard and in-memory rate limiting; production should add real auth, audit logs, durable delivery history, and provider-specific retry queues.
