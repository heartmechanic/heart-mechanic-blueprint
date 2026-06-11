# The Heart Mechanic Blueprint MVP 1

A working MVP web application for Weeks 1-3 of The Heart Mechanic Blueprint.

Live site:
https://heartmechanic.github.io/heart-mechanic-blueprint/

## Current MVP Scope

The app is a static front-end prototype built with plain HTML, CSS and JavaScript. It supports the first three course weeks only:

- Week 1: Mirror / The Census
- Week 2: Witness / Foundation Layer
- Week 3: Architect / First Kingdom Structure

Weeks 4-6 are visible as locked future weeks.

## Current Capabilities

- Manual contact entry
- CSV contact import
- iPhone vCard `.vcf` import
- Review-before-import flow
- Week 1 Census sorting: In Kingdom / Outside Kingdom
- Week 2 Foundation fields for Kingdom members
- Real name / private cast name display toggle
- Week 3 draggable and click-place relationship spheres
- First Kingdom structure: Inner Counsel, Knights, Nobles, Courtiers, Villagers
- Local browser storage

## Repository Structure

```text
/
  index.html          Live app entry point
  styles.css          App styling
  app.js              App logic and local state
  docs/               Product, deployment and planning notes
  data/               Sample or future seed data
  assets/             Future images, icons and brand assets
```

## Important Notes

GitHub Pages serves this app from the repository root. Keep `index.html`, `styles.css` and `app.js` at the root unless the Pages configuration is changed.

This prototype stores contact data locally in the user's browser. It does not currently send contacts to a backend.

MVP 1 intentionally excludes relationship scoring, trust, reciprocity, alignment, stability, influence, support, AI summaries and Sovereign Seals.
