# waelio agent

`waelio/agent` is a local AI research agent with an installable Vite PWA frontend and a Python FastAPI backend powered by [Ollama](https://ollama.com/).

The repository contains:

- a local Python FastAPI backend (`local_agent.py`)
- a Cloudflare Worker proxy in `backend/` (optional, for deployed frontend requests)
- a PWA frontend app in `frontend/`
- Cloudflare Pages-friendly PWA output for the frontend

---

## What is in this repo

### Local FastAPI Agent (`local_agent.py`)

The primary backend connects directly to Ollama — zero cloud cost, fully private.

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/health` | GET | Status ping |
| `/models` | GET | List all locally pulled Ollama models |
| `/apps/{app_id}/users/{user_id}/sessions` | POST | Create a session |
| `/run_sse` | POST | Stream a response from a selected model |

The `/run_sse` endpoint accepts an optional `model` field in the request body. If omitted, it defaults to `qwen3:8b`.

### Supported Models (locally pulled via Ollama)

| Model | Size | Notes |
|---|---|---|
| `qwen3:8b` | 5.2 GB | Default model |
| `gemma4:latest` | 9.6 GB | High quality, requires more GPU memory |
| `llama3:latest` | 4.7 GB | Fast and general purpose |
| `qwen3.5:4b` | 3.4 GB | Lightweight |
| `qwen3.5:2b` | 2.7 GB | Very lightweight |
| `qwen3:0.6b` | 522 MB | Minimal footprint |

Pull any model with:

```bash
ollama pull qwen3:8b
```

### Frontend (`frontend/`)

Published as npm package `@waelio/agent`. Built with Vite + TypeScript. Includes:

- **Model selector** — dropdown populated live from the `/models` API; switches models per request
- **Three-way theme switcher** — 🌑 Dark / 🌗 Dim / ☀️ Light, toggled from the sidebar
- **Copy button** — appears on hover over any agent reply; copies to clipboard with ✓ feedback
- **Answer navigation bar** — ↑ Prev / Next ↓ buttons to jump between agent responses in the chat
- **Input history** — press ↑ / ↓ in the text field to recall previously sent messages (terminal-style)
- **Installable PWA** — install to home screen on mobile and desktop
- **Cloudflare Pages SPA routing**
- **Environment-based backend URL configuration**

---

## Requirements

### Backend

- Python 3.10+
- Virtual environment in `.venv/`
- `fastapi`, `uvicorn`, `ollama`
- [Ollama](https://ollama.com/) installed and running locally

### Frontend

- pnpm
- Node.js `^20.19.0` or `>=22.12.0`

---

## Local development

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

Create and activate the Python virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn ollama
```

### 2. Pull at least one model

```bash
ollama pull qwen3:8b
```

> **Tip:** If Ollama fails with `no space left on device`, clean up partial blobs:
> ```bash
> find ~/.ollama/models/blobs/ -name "*-partial*" -delete
> ```

### 3. Run the API backend

```bash
source .venv/bin/activate
python local_agent.py
```

This starts the FastAPI server on `http://127.0.0.1:8000`.

### 4. Run the frontend

From the repository root:

```bash
pnpm dev
```

This starts Vite on `http://127.0.0.1:3000`. The frontend auto-connects to `http://localhost:8000` on localhost.

---

## Frontend deployment on Cloudflare Pages

1. Run your FastAPI backend on a VM or securely expose your local instance
2. Build the frontend with `VITE_API_BASE_URL` pointing at that backend
3. Deploy `frontend/dist` to Cloudflare Pages

### Recommended Pages settings

| Setting | Value |
|---|---|
| Project root | repository root |
| Build command | `pnpm --filter ./frontend build` |
| Output directory | `frontend/dist` |
| Deploy command | _(leave empty)_ |

### Required environment variables

```
VITE_API_BASE_URL=https://your-api.example.com
VITE_AGENT_APP_NAME=@waelio/agent
```

---

## PWA notes

The frontend build generates:

- `manifest.webmanifest`
- `sw.js`
- Workbox assets
- `_redirects` for SPA routing
- `_headers` for Cloudflare Pages response headers

---

## Build

```bash
pnpm build
```

Outputs to `frontend/dist`.

---

## Published package

```
@waelio/agent
```

For package-specific notes, see `frontend/README.md`.

---

## License

MIT — [https://waelio.com/packages/@waelio/agent](https://waelio.com/packages/@waelio/agent)
