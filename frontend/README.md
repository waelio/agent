# @waelio/agent

`@waelio/agent` is the installable Vite frontend package for the waelio Google ADK project.

It provides the browser UI used to talk to the ADK-backed research agent.

## Highlights

- Installable PWA powered by Vite
- Simple chat UI for an ADK agent backend
- Cloudflare Pages friendly static frontend
- Designed to run locally with the companion Python ADK service

## Local development

From the repository root:

1. Install workspace dependencies.
2. Start the frontend dev server.
3. Run the ADK backend API server.

### Frontend

Use the workspace script from the repository root:

- `pnpm dev`

Or run the frontend package directly:

- `pnpm --filter ./frontend dev`

### Backend

Start the ADK API server from the repository root:

- `source .venv/bin/activate`
- `adk api_server --port 8000 --allow_origins "regex:http://(127\\.0\\.0\\.1|localhost):3000" .`

Then open `http://127.0.0.1:3000`.

## Deploy on Cloudflare Pages

This repository is ready to host the **frontend only** on Cloudflare Pages as a PWA.

### Recommended Cloudflare Pages settings

- **Project root:** repository root
- **Build command:** `pnpm --filter ./frontend build`
- **Build output directory:** `frontend/dist`

### Required environment variables

Set these in your Cloudflare Pages project:

- `VITE_API_BASE_URL=https://your-api.example.com`
- `VITE_AGENT_APP_NAME=Agent`

If `VITE_API_BASE_URL` is not set, the frontend falls back to:

- `http://localhost:8000` during local development
- the current origin in production

### Important backend note

Cloudflare Pages hosts the static frontend, **not** the Python ADK backend.
You should run the ADK API server somewhere else (for example a VM, Cloud Run,
or another HTTPS host) and allow your Pages domain in backend CORS.

Example production backend command:

- `adk api_server --port 8000 --allow_origins "https://your-pages-domain.example.com" .`

### PWA behavior

- The app generates a web manifest and service worker at build time.
- Cloudflare SPA routing is enabled via `public/_redirects`.
- An install button appears automatically in supported browsers.

## Repository

- GitHub: `https://github.com/waelio/agent`

## License

MIT
