import os
import json
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import ollama
from duckduckgo_search import DDGS

app = FastAPI()

KNOWLEDGE_DIR = "knowledge"
DEFAULT_MODEL = "qwen3:8b"

def load_knowledge():
    """Reads all markdown files in the knowledge directory to inject as context."""
    context = ""
    if os.path.exists(KNOWLEDGE_DIR):
        for filename in os.listdir(KNOWLEDGE_DIR):
            if filename.endswith(".md"):
                filepath = os.path.join(KNOWLEDGE_DIR, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        context += f"\n--- {filename} ---\n{f.read()}\n"
                except Exception:
                    pass
    return context

def web_search(query: str) -> str:
    """Search the web for the given query and return a summary."""
    try:
        results = DDGS().text(query, max_results=3)
        return json.dumps(list(results))
    except Exception as e:
        return f"Search failed: {e}"

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

@app.get("/knowledge")
def list_knowledge():
    """Return all knowledge files."""
    files = {}
    if os.path.exists(KNOWLEDGE_DIR):
        for filename in os.listdir(KNOWLEDGE_DIR):
            if filename.endswith(".md"):
                filepath = os.path.join(KNOWLEDGE_DIR, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        files[filename] = f.read()
                except Exception:
                    pass
    return {"files": files}

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
            
            # 1. Prepare system prompt with knowledge base
            system_prompt = (
                "You are Waelio's personal AI agent. "
                "Use the following personal knowledge base about Waelio if relevant to the user's query:\n"
                f"{load_knowledge()}\n"
            )
            
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_text}
            ]

            tool_schema = {
                'type': 'function',
                'function': {
                    'name': 'web_search',
                    'description': 'Search the web for current events, news, or fresh information not in your knowledge base.',
                    'parameters': {
                        'type': 'object',
                        'properties': {
                            'query': {
                                'type': 'string',
                                'description': 'The exact search query to look up'
                            }
                        },
                        'required': ['query']
                    }
                }
            }

            # 2. Ask model (non-streaming first) if it wants to use a tool
            response = await client.chat(
                model=model,
                messages=messages,
                tools=[tool_schema]
            )

            msg = response.get('message', {})
            tool_calls = msg.get('tool_calls', [])

            if tool_calls:
                messages.append(msg)
                
                # Execute each tool
                for tool in tool_calls:
                    func = tool.get('function', {})
                    if func.get('name') == 'web_search':
                        query = func.get('arguments', {}).get('query', '')
                        if query:
                            # Notify UI that we are searching
                            yield f"data: {json.dumps({'content': {'parts': [{'text': f'\\n*🔍 Searching the web for:* `{query}`\\n\\n'}]}})}\n\n"
                            
                            # Perform search
                            search_res = web_search(query)
                            
                            # Append tool response
                            messages.append({
                                'role': 'tool',
                                'content': search_res,
                                'name': 'web_search'
                            })
                
                # Now stream the final response given the tool results
                response_stream = await client.chat(
                    model=model,
                    messages=messages,
                    stream=True
                )
                async for chunk in response_stream:
                    content = chunk['message'].get('content', '')
                    if content:
                        yield f"data: {json.dumps({'content': {'parts': [{'text': content}]}})}\n\n"
            else:
                # No tool calls, just yield the content it generated
                content = msg.get('content', '')
                if content:
                    yield f"data: {json.dumps({'content': {'parts': [{'text': content}]}})}\n\n"

        except Exception as e:
            payload = {"error": f"Ollama error ({model}): {str(e)}. Make sure Ollama is running and the model is pulled!"}
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    # The UI connects to port 8000 by default for localhost
    uvicorn.run(app, host="0.0.0.0", port=8000)
