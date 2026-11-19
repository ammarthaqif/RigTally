# RigTally

A drilling engineering workstation for building conductor, casing, and tubing running tallies with automated depth space-out, make-up loss, segment weights, connection crossover (`XO`) detection, cantilever deck staging, and real-time `.xlsx` / `.pdf` export.

## Key Capabilities

- **Running Tally & Bulk Editing**: Manual inline entry, batch joint generation, clipboard paste, multi-sheet `.xlsx`/`.xls`/`.csv` import, Shift+Click multi-row selection, and bulk discard/restore, weight, connection, and delete actions.
- **Connection Crossover (XO) Alerts**: Tracks thread connections per joint/component and automatically flags adjacent mismatched connections with one-click crossover sub insertion.
- **Cantilever Deck & Space-Out**: Layer-by-layer pipe deck staging, rejected/discarded joint tracking while preserving sequential joint numbering, section TD / shoe offset calculation, hanger landing depth, and cementing-head stick-up verification.
- **Live Depth Visualization & Local Draft Auto-Save**: D3.js cumulative length chart against target shoe depth and section TD, plus automatic `localStorage` draft persistence.
- **Server-Side Export**: Live-formula Excel workbooks (`.xlsx`) and landscape print-ready PDFs (`.pdf`).

## Local Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

### Production Build & Self-Hosted Start

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

## Deploying to Vercel

This repository is preconfigured with `vercel.json` and `api/index.ts` so the React frontend and Express API routes (`/api/*`) deploy together without extra setup:

1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and import your GitHub repository.
3. Click **Deploy** (Vercel automatically reads `vercel.json`, builds `dist/`, and deploys `api/index.ts` as a serverless function).

> **Note**: Standard Vercel serverless payloads have a 4.5 MB request body limit, which easily accommodates running tallies and Excel uploads.

## GitHub Actions CI

`.github/workflows/ci.yml` automatically runs `npm ci`, `npm run lint`, and `npm run build` on every push and pull request targeting `main` or `master`.
