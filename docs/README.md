# RAKSHA-REKHA

> **See risk earlier. Move people safer.**

RAKSHA-REKHA is an AI-driven GIS disaster-management platform that backtests against past disasters to predict relocation. It combines habitation-level mapping, red-zone scoring, historical validation, and explainable recommendations in one interface.

## The Problem

Disaster teams often work across disconnected maps, datasets, and assessments. By the time risk is visible, relocation decisions may be rushed, difficult to validate, and hard to explain to the communities affected.

## The Solution

RAKSHA-REKHA puts risk intelligence on a live map. It scores habitations, surfaces potential red zones, validates its approach against the 2024 Wayanad landslide data, and provides an explainability panel for every recommendation.

## Core Capabilities

- Red Zone scoring engine
- Live Mapbox map with habitation data
- Backtest Mode for the 2024 Wayanad landslide
- Explainability UI for risk and relocation recommendations

## Tech Stack

- React.js
- Node.js
- Express.js
- MongoDB Atlas with GeoJSON and `2dsphere` spatial indexes
- Mapbox

## Project Layout

The project follows a strict MVC structure across the React client and Express server. See [FILE_STRUCTURE.md](FILE_STRUCTURE.md) for the directory contract and [PRD.md](PRD.md) for product requirements.

## Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- A MongoDB Atlas connection string
- A Mapbox access token

### 1. Initialize the empty MVC structure

From the repository root, run the PowerShell scaffold script:

```powershell
.\scripts\init-mvc-structure.ps1
```

The script creates directories and empty placeholder files only. It does not install dependencies or add application logic.

### 2. Configure the backend

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Set the MongoDB Atlas connection string and server port in `server/.env` once backend configuration is implemented.

### 3. Configure the frontend

```powershell
cd ..\client
npm install
Copy-Item .env.example .env
```

Set the Mapbox public token in `client/.env` once the frontend configuration is implemented.

### 4. Run locally

In one terminal:

```powershell
cd server
npm run dev
```

In a second terminal:

```powershell
cd client
npm run dev
```

The exact development ports and package scripts will be defined when the client and server applications are initialized.

## Hackathon Focus

The first milestone is a convincing end-to-end vertical slice: map habitations, calculate or display red-zone scores, run the Wayanad backtest view, and explain each result clearly.