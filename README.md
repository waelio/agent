# waelio agent

`waelio/agent` is a Google ADK-powered research agent with an installable Vite frontend.

The repository contains:

- a Python ADK agent package exposed from `Agent/agent.py`
- a frontend app in `frontend/`
- Cloudflare Pages-friendly PWA output for the frontend

## What is in this repo

### ADK agent

The agent package lives in `Agent/` and exposes `root_agent` for ADK.

- package entry: `Agent/agent.py`
- root agent name: `researcher`
- model: `gemini-flash-latest`
- tool: Google Search grounding via `google_search`

### Frontend

The frontend lives in `frontend/` and is published as:

- npm package: `@waelio/agent`

It is built with Vite and includes:

- chat UI for the ADK backend
- installable PWA support
- Cloudflare Pages SPA routing
- environment-based backend URL configuration

## Project structure

- `Agent/` — ADK agent package with `root_agent`
- `frontend/` — static frontend/PWA app
- `.env` — backend environment values such as `GOOGLE_API_KEY`
- `package.json` — workspace scripts
- `.vscode/tasks.json` — saved backend run task

## Requirements

### Backend

- Python 3.10+
- virtual environment in `.venv/`
- `google-adk`
- `GOOGLE_API_KEY` in the repo root `.env`

### Frontend

- pnpm
- Node.js compatible with the installed Vite toolchain

## Local development

### 1. Install dependencies

From the repository root:

- `pnpm install`

If needed for Python dependencies, activate the virtualenv and install backend packages there.

### 2. Configure environment

Backend `.env` at the repository root:

- `GOOGLE_API_KEY=...`

Frontend example env file:

- `frontend/.env.example`

Frontend variables:

- `VITE_API_BASE_URL`
- `VITE_AGENT_APP_NAME`

### 3. Run the frontend

From the repository root:

- `pnpm dev`

This starts Vite on `http://127.0.0.1:3000`.

### 4. Run the ADK API backend

From the repository root:

- `source .venv/bin/activate`
- `adk api_server --port 8000 --allow_origins "regex:http://(127\\.0\\.0\\.1|localhost):3000" .`

There is also a saved VS Code task in `.vscode/tasks.json` for the backend server.

### 5. Optional: run ADK web UI

If you want ADK's built-in web UI instead of the custom frontend:

- `source .venv/bin/activate`
- `adk web .`

Run that command from the repository root, not from inside `Agent/`.

## Frontend deployment on Cloudflare Pages

The frontend is set up to deploy as a static PWA on Cloudflare Pages.

### Recommended Pages settings

- project root: repository root
- build command: `pnpm --filter ./frontend build`
- output directory: `frontend/dist`
- deploy command: leave empty

### Required environment variables

Set these in Cloudflare Pages:

- `VITE_API_BASE_URL=https://your-api.example.com`
- `VITE_AGENT_APP_NAME=Agent`

Runtime behavior:

- on localhost, the frontend falls back to `http://localhost:8000`
- in production without `VITE_API_BASE_URL`, it falls back to the current origin

### Important architecture note

Cloudflare Pages hosts the **frontend only**.

The Python ADK backend must run somewhere else, such as:

- Cloud Run
- a VM
- another HTTPS service you control

Make sure your backend CORS allows your Pages domain.

Example production backend command:

- `adk api_server --port 8000 --allow_origins "https://your-pages-domain.example.com" .`

### Troubleshooting Cloudflare deploys

If Cloudflare runs `npx wrangler deploy` from the repository root, deployment will fail because this repo is a pnpm workspace and there is no root Wrangler app configuration.

For a **Pages** project, do not set a deploy command at all. Pages only needs the build command and output directory above.

If you want to do a manual direct upload instead of Git-integrated Pages builds, use a Pages-specific command such as:

- `npx wrangler pages deploy frontend/dist --project-name <your-pages-project>`

## PWA notes

The frontend build now generates:

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
