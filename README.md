# Zen

Minimalistic one-finger arcade for mobile web, Telegram browser, and GitHub Pages.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Static output lands in `dist/`. Push to `main` deploys it via GitHub Actions (`vite.config.ts` uses `base: './'`).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Play

Hold to attract the orb. Release to coast with inertia. Collect white orbs, avoid red ones.
