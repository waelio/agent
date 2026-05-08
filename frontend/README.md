# @waelio/agent

`@waelio/agent` is the Cloudflare-ready PWA frontend package for the waelio Google ADK project.

It provides the browser UI used to talk to either a local ADK API server or the included Cloudflare Worker backend.

- Live app: `https://waelio-agent.pages.dev/`
- Repository: `https://github.com/waelio/agent`

## Highlights

- Installable PWA powered by Vite
- Simple chat UI for an ADK or Worker backend
- Backend URL override saved in the browser
- Cloudflare Pages friendly static frontend
- Designed to run locally with the companion Python ADK service

## How the frontend connects

The app resolves its backend in this order:

1. a saved browser override from the sidebar
2. `VITE_API_BASE_URL` from the environment
3. `http://localhost:8000` when running on localhost

That makes local development friction-free while still letting deployed builds point at a production Worker or remote ADK server.

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

The frontend will automatically use `http://localhost:8000` on localhost, so no manual sidebar setup is needed for the default local flow.

## Environment variables

- `VITE_API_BASE_URL` — optional default backend URL for deployed builds
- `VITE_AGENT_APP_NAME` — app name used for ADK sessions, defaults to `Agent`

The package ships `frontend/.env.example` values in the published tarball as `.env.example`.

## Deploy on Cloudflare Pages

This repository is ready to host the **frontend only** on Cloudflare Pages as a PWA.

For production in this repo, the intended backend is now the Worker in
`../backend/`, deployed separately on Cloudflare Workers.

### Recommended Cloudflare Pages settings

- **Project root:** repository root
- **Build command:** `pnpm --filter ./frontend build`
- **Build output directory:** `frontend/dist`
- **Deploy command:** leave empty

### Required environment variables

Set these in your Cloudflare Pages project:

- `VITE_API_BASE_URL=https://your-api.example.com`
- `VITE_AGENT_APP_NAME=Agent`

If `VITE_API_BASE_URL` is not set, the app still supports a saved browser override, and it only falls back to `http://localhost:8000` on local development hosts.

### Recommended production pairing

- deploy `../backend/` to Cloudflare Workers
- use the resulting Worker URL as `VITE_API_BASE_URL`
- deploy the built frontend to Cloudflare Pages

### Important backend note

Cloudflare Pages hosts the static frontend, **not** the Python ADK backend.
You should either:

- use the included Cloudflare Worker backend in `../backend/`, or
- run the ADK API server somewhere else (for example a VM, Cloud Run,
  or another HTTPS host) and allow your Pages domain in backend CORS.

Example production backend command:

- `adk api_server --port 8000 --allow_origins "https://your-pages-domain.example.com" .`

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

## License

MIT
