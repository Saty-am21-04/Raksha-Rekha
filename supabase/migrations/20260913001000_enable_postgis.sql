-- ============================================================
-- Migration 00001: Enable PostGIS extension
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
