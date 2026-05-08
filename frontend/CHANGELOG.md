# Changelog

All notable changes to `@waelio/agent` will be documented in this file.

The format is based on Keep a Changelog, and versions in this file track package releases from `frontend/package.json`.

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