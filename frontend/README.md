# @waelio/agent

![@waelio/agent hero artwork](https://raw.githubusercontent.com/waelio/agent/default/frontend/src/assets/hero.png)

[![npm version](https://img.shields.io/npm/v/%40waelio%2Fagent?label=npm)](https://www.npmjs.com/package/@waelio/agent)
[![live demo](https://img.shields.io/badge/demo-live-2563eb)](https://waelio-agent.pages.dev/)
[![PWA ready](https://img.shields.io/badge/pwa-ready-7c3aed)](https://waelio-agent.pages.dev/)
[![changelog](https://img.shields.io/badge/changelog-0.1.2-111827)](https://github.com/waelio/agent/blob/default/frontend/CHANGELOG.md)

`@waelio/agent` is the PWA frontend package for the waelio local AI project.

It provides the browser UI used to talk to the local Python FastAPI server running open-source models via Ollama.

- Live app: `https://waelio-agent.pages.dev/`
- Repository: `https://github.com/waelio/agent`
- Changelog: `https://github.com/waelio/agent/blob/default/frontend/CHANGELOG.md`

## Highlights

- Installable PWA powered by Vite
- Simple chat UI for a local FastAPI / Ollama backend
- Backend URL override saved in the browser
- Cloudflare Pages friendly static frontend
- Designed to run locally with the companion `local_agent.py` service for zero-cost AI

## Try it quickly

### Live demo

- Open `https://waelio-agent.pages.dev/`
- Save your local backend URL (`http://127.0.0.1:8000` or `http://localhost:8000`) in the sidebar
- Start chatting immediately

### Local development

From the repository root:

```text
pnpm install
pnpm dev
source .venv/bin/activate
pip install fastapi uvicorn ollama
python local_agent.py
```

Then open `http://127.0.0.1:3000`.

## How the frontend connects

The app resolves its backend in this order:

1. a saved browser override from the sidebar
2. `VITE_API_BASE_URL` from the environment
3. `http://localhost:8000` when running on localhost

That makes local development friction-free while still letting deployed builds point at a remote FastAPI server if needed.

## Local development

From the repository root:

1. Install workspace dependencies.
2. Start the frontend dev server.
3. Run the local backend API server.

### Frontend

Use the workspace script from the repository root:

- `pnpm dev`

Or run the frontend package directly:

- `pnpm --filter ./frontend dev`

### Backend

Start the local backend API server from the repository root:

- `source .venv/bin/activate`
- `python local_agent.py`

Then open `http://127.0.0.1:3000`.

The frontend will automatically use `http://localhost:8000` on localhost, so no manual sidebar setup is needed for the default local flow.

## Environment variables

- `VITE_API_BASE_URL` — optional default backend URL for deployed builds
- `VITE_AGENT_APP_NAME` — app name used for sessions, defaults to `gemma.4`

The package ships `frontend/.env.example` values in the published tarball as `.env.example`.

## Deploy on Cloudflare Pages

This repository is ready to host the **frontend only** on Cloudflare Pages as a PWA.

The intended backend is the local `local_agent.py` script running on your machine or deployed on a private server.

### Recommended Cloudflare Pages settings

- **Project root:** repository root
- **Build command:** `pnpm --filter ./frontend build`
- **Build output directory:** `frontend/dist`
- **Deploy command:** leave empty

### Required environment variables

Set these in your Cloudflare Pages project:

- `VITE_API_BASE_URL=https://your-api.example.com` (If deploying your FastAPI backend)
- `VITE_AGENT_APP_NAME=gemma.4`

If `VITE_API_BASE_URL` is not set, the app still supports a saved browser override, and it only falls back to `http://localhost:8000` on local development hosts.

### Important backend note

Cloudflare Pages hosts the static frontend, **not** the Python backend.
You should either:

- run `local_agent.py` on your local machine and use the browser override to point to `http://127.0.0.1:8000`, or
- run the FastAPI server on a VM or another HTTPS host and allow your Pages domain in the FastAPI backend CORS settings.

### Troubleshooting workspace deploy errors

If Cloudflare is trying to run `npx wrangler deploy` from the repository root, that is the wrong deploy flow for this Pages setup.

This repository is a pnpm workspace, so a root-level Wrangler deploy without a specific Wrangler configuration will fail with a workspace detection error.

To make that workflow safer, the repo now includes `frontend/wrangler.jsonc` plus a root redirect file at `.wrangler/deploy/config.json`, so root-level `wrangler deploy` resolves to the frontend app instead of the workspace root.

For Cloudflare Pages, keep the deploy command empty and use the build settings above.

If you want a manual CLI upload, use a Pages command instead:

- `npx wrangler pages deploy frontend/dist --project-name <your-pages-project>`

### PWA behavior

- The app generates a web manifest and service worker at build time.
- Cloudflare SPA routing is enabled via `public/_redirects`.
- An install button appears automatically in supported browsers.

## What gets published

The npm package intentionally ships the frontend source, PWA assets, deploy config, and docs needed to inspect or build the app:

- `src/`
- `public/`
- `index.html`
- `vite.config.ts`
- `wrangler.jsonc`
- `.env.example`

It does **not** publish `dist/` or workspace-only lockfiles.

## Repository

- GitHub: `https://github.com/waelio/agent`
- Releases: `https://github.com/waelio/agent/releases`
- Changelog: `https://github.com/waelio/agent/blob/default/frontend/CHANGELOG.md`

## License

MIT
