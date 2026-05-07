# @waelio/agent

`@waelio/agent` is the React + Vite frontend package for the waelio Google ADK project.

It provides the browser UI used to talk to the ADK-backed research agent.

## Highlights

- React + TypeScript app powered by Vite
- Simple chat UI for an ADK agent backend
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

## Repository

- GitHub: `https://github.com/waelio/agent`

## License

MIT
