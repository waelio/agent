# waelio agent

`waelio/agent` is a local AI research agent with an installable Vite frontend.

The repository contains:

- a local Python FastAPI backend (`local_agent.py`)
- a Cloudflare Worker proxy in `backend/` (optional, for deployed frontend requests)
- a PWA frontend app in `frontend/`
- Cloudflare Pages-friendly PWA output for the frontend

## What is in this repo

### Local FastAPI Agent

The primary backend is a local Python script running via FastAPI and Ollama.

- backend entry: `local_agent.py`
- model: `gemma.4` (or any local model pulled via Ollama)

Instead of requiring cloud APIs, it connects directly to Ollama, providing a zero-cost, privacy-first local chat experience.

### Frontend

The frontend lives in `frontend/` and is published as:

- npm package: `@waelio/agent`

It is built with Vite and includes:

- chat UI for the FastAPI backend
- installable PWA support
- Cloudflare Pages SPA routing
- environment-based backend URL configuration

## Requirements

### Backend

- Python 3.10+
- virtual environment in `.venv/`
- `fastapi`, `uvicorn`, `ollama`
- [Ollama](https://ollama.com/) installed and running locally with the `gemma.4` model (or your preferred model)

### Frontend

- pnpm
- Node.js compatible with the installed Vite toolchain

## Local development

### 1. Install dependencies

From the repository root:

- `pnpm install`

Create and activate the Python virtual environment:

- `python3 -m venv .venv`
- `source .venv/bin/activate`
- `pip install fastapi uvicorn ollama`

### 2. Run the frontend

From the repository root:

- `pnpm dev`

This starts Vite on `http://127.0.0.1:3000`.

### 3. Run the API backend

Start the local backend from the repository root:

- `source .venv/bin/activate`
- `python local_agent.py`

This will start the FastAPI server on `http://127.0.0.1:8000`.

## Frontend deployment on Cloudflare Pages

The frontend is set up to deploy as a static PWA on Cloudflare Pages.

For production, the simplest setup in this repository is:

1. run your FastAPI backend on a VM or securely expose your local instance
2. build the frontend with `VITE_API_BASE_URL` pointed at that backend
3. deploy `frontend/dist` to Cloudflare Pages

### Recommended Pages settings

- project root: repository root
- build command: `pnpm --filter ./frontend build`
- output directory: `frontend/dist`
- deploy command: leave empty

### Required environment variables

Set these in Cloudflare Pages:

- `VITE_API_BASE_URL=https://your-api.example.com`
- `VITE_AGENT_APP_NAME=gemma.4`

Runtime behavior:

- on localhost, the frontend falls back to `http://localhost:8000`
- in production without `VITE_API_BASE_URL`, the frontend waits for a configured backend URL instead of calling the Pages origin
- users can also save a backend URL from the app sidebar in the browser

## PWA notes

The frontend build generates:

- `manifest.webmanifest`
- `sw.js`
- Workbox assets
- `_redirects` for SPA routing
- `_headers` for Cloudflare Pages response headers

The app also includes an install button for supported browsers.

## Build

From the repository root:

- `pnpm build`

This builds the frontend into `frontend/dist`.

## Published package

The frontend package is published to npm as:

- `@waelio/agent`

For package-specific notes, see `frontend/README.md`.

## License

MIT

- [https://waelio.com/packages/@waelio/agent](https://waelio.com/packages/@waelio/agent)
