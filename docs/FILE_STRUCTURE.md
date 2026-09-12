# RAKSHA-REKHA File Structure

The project uses a strict MVC separation. Each layer has one responsibility and should communicate through explicit interfaces.

## Repository Structure

```text
RAKSHA-REKHA/
|-- client/                    # React.js frontend (View-focused MVC)
|-- server/                    # Node.js and Express.js backend (MVC)
|-- docs/
|   |-- FILE_STRUCTURE.md
|   |-- PRD.md
|   `-- README.md
`-- scripts/
    `-- init-mvc-structure.ps1
```

## Frontend: React MVC

```text
client/
|-- public/
|-- src/
|   |-- models/                # Client-side domain types and data models
|   |   |-- habitation.model.js
|   |   |-- risk-score.model.js
|   |   `-- backtest.model.js
|   |-- views/                 # Renderable React pages and presentational UI
|   |   |-- map/
|   |   |   |-- MapPage.jsx
|   |   |   `-- HabitationMap.jsx
|   |   |-- backtest/
|   |   |   `-- BacktestPage.jsx
|   |   |-- explainability/
|   |   |   `-- ExplainabilityPanel.jsx
|   |   `-- shared/
|   |       `-- LoadingState.jsx
|   |-- controllers/           # Hooks/controllers coordinating views and APIs
|   |   |-- useHabitationController.js
|   |   |-- useBacktestController.js
|   |   `-- useRiskController.js
|   |-- services/              # HTTP clients and external frontend integrations
|   |   |-- apiClient.js
|   |   `-- mapboxService.js
|   |-- routes/                # Client-side route definitions
|   |   `-- AppRoutes.jsx
|   |-- App.jsx
|   `-- main.jsx
|-- .env.example
|-- package.json
`-- vite.config.js
```

### Frontend MVC Rules

- **Models** describe client-side data shape and normalization only.
- **Views** render UI and receive state or callbacks; they do not fetch data directly.
- **Controllers** own view state, user-event coordination, and calls to services.
- **Services** isolate API and Mapbox integration details from controllers and views.

## Backend: Express MVC

```text
server/
|-- src/
|   |-- config/                # Environment and database configuration
|   |   |-- env.js
|   |   `-- database.js
|   |-- models/                # Mongoose schemas and spatial indexes
|   |   |-- Habitation.js
|   |   |-- RiskScore.js
|   |   `-- Backtest.js
|   |-- controllers/           # Request handlers and response orchestration
|   |   |-- habitationController.js
|   |   |-- riskController.js
|   |   `-- backtestController.js
|   |-- services/              # Domain operations used by controllers
|   |   |-- scoringService.js
|   |   |-- backtestService.js
|   |   `-- explainabilityService.js
|   |-- routes/                # HTTP endpoint declarations
|   |   |-- habitationRoutes.js
|   |   |-- riskRoutes.js
|   |   `-- backtestRoutes.js
|   |-- middleware/            # Cross-cutting request and error handling
|   |   |-- errorHandler.js
|   |   `-- notFound.js
|   |-- app.js                 # Express application assembly
|   `-- server.js              # Process entry point
|-- .env.example
|-- package.json
`-- README.md
```

### Backend MVC Rules

- **Models** own MongoDB schemas, GeoJSON shape definitions, and `2dsphere` indexes.
- **Views** are HTTP responses serialized by controllers; they contain no domain decisions.
- **Controllers** validate request context, call services, and shape responses.
- **Services** own scoring, backtesting, and explainability rules.
- **Routes** map HTTP methods and paths to controllers only.
- **Middleware** handles cross-cutting concerns and must not contain feature-specific scoring logic.