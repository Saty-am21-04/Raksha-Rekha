# RAKSHA-REKHA Landing Page Content Update

Update the existing single-section "Apogee" landing page to the full RAKSHA-REKHA content from the uploaded brief while preserving the current dark/glass/animated vibe.

## Scope

- Hero: RAKSHA-REKHA name, tagline, subtext, "Watch Demo" + "View on GitHub" CTAs.
- Sections to add in order: The Problem, The Solution, Backtest Mode, How It Works, Live Demo / Screenshots, Tech Stack, Differentiation, Built for SIH 2026, Footer.
- Keep existing animations, glass cards, nav, and dark theme; adapt accent colors toward forest green + amber where the brief specifies.
- Update route metadata and nav labels to match the project.

## Technical Details

- Expand `src/components/Hero.tsx` into a full landing-page component or create a new `LandingPage.tsx` that imports the hero.
- Update `src/routes/index.tsx` meta tags.
- Generate or use placeholder visuals for dashboard/explainability/architecture screenshots.
- Preserve the existing Tailwind animation classes and glass-card styling.
