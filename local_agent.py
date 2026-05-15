import json
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

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
    
    async def event_stream():
        try:
            # We connect directly to Ollama running locally.
            # Change 'gemma.4' to 'deepseek-coder' or 'qwen' if you prefer!
            client = ollama.AsyncClient()
            response_stream = await client.chat(
                model='gemma.4', 
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
            payload = {"error": f"Ollama connection error: {str(e)}. Make sure Ollama is running and you have pulled the model!"}
            yield f"data: {json.dumps(payload)}\n\n"
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    # The UI connects to port 8000 by default for localhost
    uvicorn.run(app, host="127.0.0.1", port=8000)
