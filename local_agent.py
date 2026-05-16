import json
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import ollama

app = FastAPI()

DEFAULT_MODEL = "qwen3:8b"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "Agent API is running on port 8000! Paste this URL into your frontend."
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/models")
async def list_models():
    """Return all locally available Ollama models."""
    try:
        client = ollama.AsyncClient()
        result = await client.list()
        models = [m.model for m in result.models]
        return {"models": models, "default": DEFAULT_MODEL}
    except Exception as e:
        return {"models": [], "default": DEFAULT_MODEL, "error": str(e)}

@app.post("/apps/{app_id}/users/{user_id}/sessions")
async def create_session(app_id: str, user_id: str):
    # Returns a dummy session ID to satisfy the UI
    return {"id": f"session-{uuid.uuid4()}"}

@app.post("/run_sse")
async def run_sse(request: Request):
    data = await request.json()
    new_message = data.get("new_message", {})
    parts = new_message.get("parts", [])
    user_text = parts[0].get("text", "") if parts else ""
    model = data.get("model", DEFAULT_MODEL)

    async def event_stream():
        try:
            client = ollama.AsyncClient()
            response_stream = await client.chat(
                model=model,
                messages=[{'role': 'user', 'content': user_text}],
                stream=True
            )
            async for chunk in response_stream:
                content = chunk['message']['content']
                if content:
                    payload = {
                        "content": {
                            "parts": [{"text": content}]
                        }
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
        except Exception as e:
            payload = {"error": f"Ollama error ({model}): {str(e)}. Make sure Ollama is running and the model is pulled!"}
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    # The UI connects to port 8000 by default for localhost
    uvicorn.run(app, host="0.0.0.0", port=8000)
