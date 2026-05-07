interface Env {
    GOOGLE_API_KEY?: string;
    GEMINI_MODEL?: string;
}

interface SessionResponse {
    id: string;
}

interface RunSseRequest {
    app_name?: string;
    user_id?: string;
    session_id?: string;
    new_message?: {
        role?: string;
        parts?: Array<{
            text?: string;
        }>;
    };
    streaming?: boolean;
}

interface GeminiPart {
    text?: string;
}

interface GeminiGroundingChunk {
    web?: {
        uri?: string;
        title?: string;
    };
}

interface GeminiCandidate {
    content?: {
        parts?: GeminiPart[];
    };
    finishReason?: string;
    groundingMetadata?: {
        groundingChunks?: GeminiGroundingChunk[];
    };
}

interface GeminiResponse {
    candidates?: GeminiCandidate[];
    promptFeedback?: {
        blockReason?: string;
    };
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const SYSTEM_INSTRUCTION = "You help users research topics thoroughly.";
const SESSION_PATH_PATTERN = /^\/apps\/[^/]+\/users\/[^/]+\/sessions\/?$/;
const ALLOWED_ORIGIN_PATTERNS = [
    /^https:\/\/(?:[a-z0-9-]+\.)?waelio-agent\.pages\.dev$/i,
    /^https:\/\/(?:[a-z0-9-]+\.)?waelio-com\.pages\.dev$/i,
    /^https:\/\/(?:www\.)?waelio\.com$/i,
    /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i,
];

function getModelName(env: Env): string {
    const raw = env.GEMINI_MODEL?.trim();
    if (!raw) {
        return DEFAULT_MODEL;
    }

    return raw.startsWith("models/") ? raw.slice("models/".length) : raw;
}

function getAllowedOrigin(origin: string | null): string | null {
    if (!origin) {
        return null;
    }

    return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin)) ? origin : null;
}

function buildCorsHeaders(origin: string | null): Headers {
    const headers = new Headers();
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");

    if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
    }

    return headers;
}

function jsonResponse(payload: unknown, status: number, origin: string | null): Response {
    const headers = buildCorsHeaders(origin);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(status: number, message: string, origin: string | null): Response {
    return jsonResponse({ error: message }, status, origin);
}

function sseResponse(text: string, origin: string | null): Response {
    const headers = buildCorsHeaders(origin);
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");

    const body = `data: ${JSON.stringify({ content: { parts: [{ text }] } })}\n\n`;
    return new Response(body, { status: 200, headers });
}

function extractPrompt(body: RunSseRequest): string {
    const parts = body.new_message?.parts ?? [];
    return parts
        .map((part) => part.text?.trim() ?? "")
        .filter((part) => part.length > 0)
        .join("\n\n")
        .trim();
}

function extractText(candidate: GeminiCandidate | undefined): string {
    const parts = candidate?.content?.parts ?? [];
    return parts
        .map((part) => part.text?.trim() ?? "")
        .filter((part) => part.length > 0)
        .join("\n\n")
        .trim();
}

function appendSources(text: string, candidate: GeminiCandidate | undefined): string {
    const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const seen = new Set<string>();
    const sources: Array<{ title: string; uri: string }> = [];

    for (const chunk of chunks) {
        const uri = chunk.web?.uri?.trim();
        if (!uri || seen.has(uri)) {
            continue;
        }

        seen.add(uri);
        sources.push({ title: chunk.web?.title?.trim() || uri, uri });

        if (sources.length >= 6) {
            break;
        }
    }

    if (sources.length === 0) {
        return text;
    }

    const suffix = sources
        .map((source, index) => `${index + 1}. ${source.title} — ${source.uri}`)
        .join("\n");

    return `${text}\n\nSources:\n${suffix}`;
}

async function generateGroundedReply(prompt: string, env: Env): Promise<string> {
    const apiKey = env.GOOGLE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing GOOGLE_API_KEY secret.");
    }

    const model = getModelName(env);
    const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
    endpoint.searchParams.set("key", apiKey);

    const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            ],
            tools: [{ google_search: {} }],
            generationConfig: {
                responseMimeType: "text/plain",
            },
        }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`Gemini API request failed with ${response.status}: ${responseText.slice(0, 500)}`);
    }

    const payload = JSON.parse(responseText) as GeminiResponse;
    const candidate = payload.candidates?.[0];
    const text = extractText(candidate);

    if (text) {
        return appendSources(text, candidate);
    }

    if (payload.promptFeedback?.blockReason) {
        throw new Error(`Prompt blocked by Gemini (${payload.promptFeedback.blockReason}).`);
    }

    if (candidate?.finishReason) {
        throw new Error(`Gemini did not return text (${candidate.finishReason}).`);
    }

    throw new Error("Gemini returned no text response.");
}

async function handleSession(origin: string | null): Promise<Response> {
    const payload: SessionResponse = { id: crypto.randomUUID() };
    return jsonResponse(payload, 200, origin);
}

async function handleRunSse(request: Request, env: Env, origin: string | null): Promise<Response> {
    let body: RunSseRequest;

    try {
        body = (await request.json()) as RunSseRequest;
    } catch {
        return errorResponse(400, "Invalid JSON body.", origin);
    }

    const prompt = extractPrompt(body);
    if (!prompt) {
        return errorResponse(400, "Missing new_message.parts[].text in request body.", origin);
    }

    try {
        const reply = await generateGroundedReply(prompt, env);
        return sseResponse(reply, origin);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown backend error.";
        return errorResponse(502, message, origin);
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const requestOrigin = request.headers.get("Origin");
        const allowedOrigin = getAllowedOrigin(requestOrigin);

        if (requestOrigin && !allowedOrigin) {
            return errorResponse(403, "Origin not allowed.", null);
        }

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: allowedOrigin ? 204 : 403,
                headers: buildCorsHeaders(allowedOrigin),
            });
        }

        if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
            return jsonResponse(
                {
                    ok: true,
                    service: "waelio-agent-api",
                    model: getModelName(env),
                },
                200,
                allowedOrigin,
            );
        }

        if (request.method === "POST" && SESSION_PATH_PATTERN.test(url.pathname)) {
            return handleSession(allowedOrigin);
        }

        if (request.method === "POST" && url.pathname === "/run_sse") {
            return handleRunSse(request, env, allowedOrigin);
        }

        return errorResponse(404, "Not found.", allowedOrigin);
    },
};
