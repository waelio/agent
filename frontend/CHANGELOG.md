# Changelog

All notable changes to `@waelio/agent` will be documented in this file.

The format is based on Keep a Changelog, and versions in this file track package releases from `frontend/package.json`.

## [0.2.2] - 2026-06-23

### Added

- **Live web search** — local backend and Cloudflare Pages function search the web automatically for current events, health, and research questions
- **Allowed site fetching** — direct reads from `webmd.com` and `waelio.com` when URLs or health topics are mentioned
- **Social tab** — working links to Waelio Chat, waelio.com, GitHub, and npm (replaces blank placeholder page)
- **`requirements.txt`** — documents Python backend dependencies for `local_agent.py`

### Changed

- Web search uses DuckDuckGo HTML results after the old search library stopped returning data
- Backend CORS allows all `*.waelio.com` subdomains

## [0.2.0] - 2026-05-16

### Added

- **Model selector** — live dropdown populated from the new `GET /models` backend endpoint; each request sends the chosen model name, defaulting to `qwen3:8b`
- **`GET /models` backend endpoint** — returns all locally pulled Ollama models so the UI always reflects what is actually available
- **Three-way theme switcher** — 🌑 Dark / 🌗 Dim / ☀️ Light toggle in the sidebar; entire design system rewritten with CSS custom properties (`var(--*)`) so all three themes share a single stylesheet
- **Copy button on agent replies** — appears on hover beneath each response; copies to clipboard and shows ✓ Copied for 2 seconds
- **Answer navigation bar** — ↑ Prev / Next ↓ pill buttons with an `n / total` counter at the top of the chat; smoothly scrolls between agent responses
- **Input history (↑/↓)** — pressing Arrow Up / Arrow Down in the text field cycles through previously sent messages, terminal-style; restores the unsent draft on Arrow Down past the last entry
- **Model feedback in "Thinking" indicator** — shows `Thinking with qwen3:8b…` so the user knows which model is running

### Changed

- Backend default model changed from `llama3:latest` to `qwen3:8b`
- `#form` restructured into a two-row flex layout: model bar row + composer row
- `backendUrl` fallback in the frontend changed from `https://waelio-agent.pages.dev` to `http://localhost:8000` for correct local-first behaviour
- All hardcoded colour values in CSS replaced with theme-aware custom properties

### Fixed

- Disk full error (`no space left on device`) caused by accumulated `-partial` Ollama blobs; documented the cleanup command in the README

## [0.1.3] - 2026-05-08

### Fixed

- added the missing `<link rel="icon">` reference so browsers actually use the existing `public/favicon.svg` asset

## [0.1.2] - 2026-05-08

### Added

- packaged `LICENSE` file for the published npm tarball
- explicit `files` allowlist for published package contents
- `pack:check` and `prepublishOnly` scripts for safer npm publishing
- npm-facing docs for backend resolution, environment variables, and published contents
- a stronger package README with hero artwork, live demo links, and a quicker getting-started flow

### Changed

- reconnected the frontend to the documented backend architecture instead of direct browser-side Gemini requests
- added backend URL resolution in this order: saved override, `VITE_API_BASE_URL`, then `http://localhost:8000` on localhost
- updated the sidebar UI to configure a backend URL rather than a Google AI Studio API key
- refreshed npm metadata for clearer positioning around ADK, Workers, Cloudflare Pages, and PWA usage

### Removed

- stale `frontend/package-lock.json`
- unused React-specific package metadata that no longer matched the shipped app