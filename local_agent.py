import os
import json
import uuid
import re
import html
import urllib.parse
import urllib.request
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import ollama

app = FastAPI()

KNOWLEDGE_DIR = "knowledge"
DEFAULT_MODEL = "qwen3:8b"

WEB_SEARCH_HINTS = re.compile(
    r"\b(today|now|current|currently|latest|recent|news|weather|price|score|stock|"
    r"who is|what is|when did|how much|look up|search|find online|internet|website|"
    r"online|live|happening|update|waelio\.com|webmd|health|medical|symptom|symptoms|"
    r"disease|treatment|diagnosis|medicine|drug|drugs|doctor|pain|sleep|diabetes|"
    r"cancer|allergy|allergies)\b",
    re.IGNORECASE,
)
URL_PATTERN = re.compile(r'https?://[^\s<>"\']+', re.IGNORECASE)
ALLOWED_FETCH_HOSTS = ("webmd.com", "waelio.com")
SMALL_TALK = re.compile(
    r"^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good night)\b",
    re.IGNORECASE,
)

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

def needs_web_search(text: str) -> bool:
    prompt = text.strip()
    if len(prompt) < 4:
        return False
    if SMALL_TALK.match(prompt):
        return False
    return bool(WEB_SEARCH_HINTS.search(prompt) or "?" in prompt)

def parse_tool_arguments(raw) -> dict:
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return raw if isinstance(raw, dict) else {}

def strip_html(value: str) -> str:
    return re.sub(r"<[^>]+>", "", value)

def normalize_host(host: str) -> str:
    return host.lower().removeprefix("www.")

def is_allowed_fetch_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False

    host = normalize_host(parsed.netloc)
    return any(host == allowed or host.endswith(f".{allowed}") for allowed in ALLOWED_FETCH_HOSTS)

def extract_urls(text: str) -> list[str]:
    return URL_PATTERN.findall(text)

def html_to_text(page: str, limit: int = 4000) -> str:
    cleaned = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", page)
    text = strip_html(cleaned)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]

def fetch_allowed_url(url: str) -> str:
    if not is_allowed_fetch_url(url):
        return f"Fetching is not allowed for {url}."

    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        page = urllib.request.urlopen(request, timeout=15).read().decode("utf-8", "ignore")
        text = html_to_text(page)
        if not text:
            return f"Fetched {url} but no readable text was found."
        return f"Fetched {url}:\n{text}"
    except Exception as e:
        return f"Failed to fetch {url}: {e}"

def gather_web_context(user_text: str) -> tuple[str | None, list[str]]:
    parts: list[str] = []
    status: list[str] = []

    for url in extract_urls(user_text):
        if is_allowed_fetch_url(url):
            status.append(f"*🌐 Fetching:* `{url}`")
            parts.append(fetch_allowed_url(url))

    if "webmd" in user_text.lower() and not any("webmd.com" in url for url in extract_urls(user_text)):
        webmd_url = "https://www.webmd.com/"
        status.append(f"*🌐 Fetching:* `{webmd_url}`")
        parts.append(fetch_allowed_url(webmd_url))

    query = user_text.strip()
    if needs_web_search(query):
        status.append(f"*🔍 Searching the web for:* `{query}`")
        parts.append(web_search(query))

    if not parts:
        return None, status

    return "\n\n".join(parts), status

def web_search(query: str) -> str:
    """Search the web for the given query and return a summary."""
    try:
        body = urllib.parse.urlencode({"q": query}).encode()
        request = urllib.request.Request(
            "https://html.duckduckgo.com/html/",
            data=body,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        page = urllib.request.urlopen(request, timeout=15).read().decode("utf-8", "ignore")
        links = re.findall(
            r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            page,
            re.S,
        )
        snippets = re.findall(
            r'class="result__snippet"[^>]*>(.*?)</(?:a|td|div)>',
            page,
            re.S,
        )

        lines = []
        for index, (href, title) in enumerate(links[:5], start=1):
            snippet = strip_html(html.unescape(snippets[index - 1])) if index - 1 < len(snippets) else ""
            clean_title = strip_html(html.unescape(title))
            clean_href = html.unescape(href)
            block = f"{index}. {clean_title}\n{clean_href}"
            if snippet:
                block += f"\n{snippet}"
            lines.append(block)

        if not lines:
            return "No web results were found for that query."

        return "\n\n".join(lines)
    except Exception as e:
        return f"Search failed: {e}"

def build_system_prompt() -> str:
    return (
        "You are Waelio's personal AI agent with live internet search.\n"
        "When web search results are provided, use them and cite what you found.\n"
        "Never say you lack internet access when search results are included.\n"
        "For medical or health content from WebMD, summarize carefully and remind the "
        "user that WebMD is general information only, not medical advice.\n"
        "Use the following personal knowledge base about Waelio when relevant:\n"
        f"{load_knowledge()}\n"
    )

def build_user_message(user_text: str, search_context: str | None = None) -> str:
    if not search_context:
        return user_text
    return (
        f"{user_text}\n\n"
        "[Live web search results]\n"
        f"{search_context}\n\n"
        "Answer using the live web search results above when they are relevant."
    )

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
            search_context, status_messages = gather_web_context(user_text)

            for status in status_messages:
                yield f"data: {json.dumps({'content': {'parts': [{'text': f'\\n{status}\\n\\n'}]}})}\n\n"

            messages = [
                {'role': 'system', 'content': build_system_prompt()},
                {'role': 'user', 'content': build_user_message(user_text, search_context)}
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

            response = await client.chat(
                model=model,
                messages=messages,
                tools=[tool_schema]
            )

            msg = response.get('message', {})
            tool_calls = msg.get('tool_calls', [])

            if tool_calls:
                messages.append(msg)

                for tool in tool_calls:
                    func = tool.get('function', {})
                    if func.get('name') == 'web_search':
                        args = parse_tool_arguments(func.get('arguments', {}))
                        query = args.get('query', '').strip()
                        if query:
                            yield f"data: {json.dumps({'content': {'parts': [{'text': f'\\n*🔍 Searching the web for:* `{query}`\\n\\n'}]}})}\n\n"
                            search_res = web_search(query)
                            messages.append({
                                'role': 'tool',
                                'content': search_res,
                                'name': 'web_search'
                            })

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
