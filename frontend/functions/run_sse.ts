const WEB_SEARCH_HINTS =
  /\b(today|now|current|currently|latest|recent|news|weather|price|score|stock|who is|what is|when did|how much|look up|search|find online|internet|website|online|live|happening|update|waelio\.com|webmd|health|medical|symptom|symptoms|disease|treatment|diagnosis|medicine|drug|drugs|doctor|pain|sleep|diabetes|cancer|allergy|allergies)\b/i;
const SMALL_TALK = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good night)\b/i;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const ALLOWED_FETCH_HOSTS = ["webmd.com", "waelio.com"];

function needsWebSearch(prompt: string): boolean {
  const text = prompt.trim();
  if (text.length < 4) return false;
  if (SMALL_TALK.test(text)) return false;
  return WEB_SEARCH_HINTS.test(text) || text.includes("?");
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function isAllowedFetchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      return false;
    }
    const host = normalizeHost(parsed.hostname);
    return ALLOWED_FETCH_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function extractUrls(text: string): string[] {
  return text.match(URL_PATTERN) ?? [];
}

function htmlToText(page: string, limit = 4000): string {
  const cleaned = page.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const text = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, limit);
}

async function fetchAllowedUrl(url: string): Promise<string> {
  if (!isAllowedFetchUrl(url)) {
    return `Fetching is not allowed for ${url}.`;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const page = await response.text();
    const text = htmlToText(page);
    if (!text) {
      return `Fetched ${url} but no readable text was found.`;
    }
    return `Fetched ${url}:\n${text}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return `Failed to fetch ${url}: ${message}`;
  }
}

async function gatherWebContext(prompt: string): Promise<{ context: string; status: string[] }> {
  const parts: string[] = [];
  const status: string[] = [];

  for (const url of extractUrls(prompt)) {
    if (isAllowedFetchUrl(url)) {
      status.push(`*🌐 Fetching:* \`${url}\``);
      parts.push(await fetchAllowedUrl(url));
    }
  }

  if (prompt.toLowerCase().includes("webmd") && !extractUrls(prompt).some((url) => url.includes("webmd.com"))) {
    const webmdUrl = "https://www.webmd.com/";
    status.push(`*🌐 Fetching:* \`${webmdUrl}\``);
    parts.push(await fetchAllowedUrl(webmdUrl));
  }

  if (needsWebSearch(prompt)) {
    status.push(`*🔍 Searching the web for:* \`${prompt}\``);
    parts.push(await fetchWebContext(prompt));
  }

  return {
    context: parts.join("\n\n"),
    status,
  };
}

async function fetchWebContext(prompt: string): Promise<string> {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("weather")) {
    const wttrReq = await fetch("https://wttr.in/?format=3", {
      headers: { "User-Agent": "curl/7.68.0" },
    });
    const wttrText = await wttrReq.text();
    return `The current weather is ${wttrText}`;
  }

  const ddgRes = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({ q: prompt }).toString(),
  });
  const page = await ddgRes.text();
  const links = [...page.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
  const snippets = [...page.matchAll(/class="result__snippet"[^>]*>(.*?)<\/(?:a|td|div)>/gs)];

  if (links.length === 0) {
    return "No web results were found for that query.";
  }

  return links
    .slice(0, 5)
    .map((match, index) => {
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const href = match[1];
      const snippet = snippets[index]?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      return snippet ? `${index + 1}. ${title}\n${href}\n${snippet}` : `${index + 1}. ${title}\n${href}`;
    })
    .join("\n\n");
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const data = await request.json();
  const prompt = data.new_message.parts.map((part) => part.text).join("\n");

  const systemPrompt = `You are Waelio's personal AI agent with live internet search.
Wael Wahbeh (Waelio) is a full-stack software engineer.
He builds:
- Agent: A local privacy-first AI assistant using Ollama and FastAPI
- Negotiate: An autonomous AI negotiation engine built as a Cloudflare Worker using Llama 3
- Siteforge: A persistent, automated website rendering engine on Cloudflare Workers
- Waelio Toolkit: A Chrome Extension companion tool

When live web data is provided, use it and do not say you lack internet access.
For medical or health content from WebMD, summarize carefully and remind the user that WebMD is general information only, not medical advice.
CRITICAL INSTRUCTION: Waelio does NOT build cryptocurrency wallets, blockchains, or Web3 projects. Do NOT hallucinate or invent projects. If asked about his projects, ONLY list the ones above.`;

  let searchContext = "";
  let statusMessages: string[] = [];

  try {
    const gathered = await gatherWebContext(prompt);
    searchContext = gathered.context;
    statusMessages = gathered.status;
  } catch (error) {
    console.error("Search failed", error);
    searchContext = "Web search failed for this question.";
  }

  const finalPrompt = searchContext
    ? `${prompt}\n\n[Live web search results]\n${searchContext}\n\nAnswer using the live web search results above when they are relevant. Do not say you lack internet access.`
    : prompt;

  const aiResponseStream = await env.AI.run("@cf/google/gemma-7b-it-lora", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: finalPrompt },
    ],
    stream: true,
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  context.waitUntil(
    (async () => {
      try {
        for (const status of statusMessages) {
          const statusEvent = {
            content: {
              parts: [{ text: `\n${status}\n\n` }],
            },
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(statusEvent)}\n\n`));
        }

        const reader = aiResponseStream.getReader
          ? aiResponseStream.getReader()
          : aiResponseStream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  const outEvent = {
                    content: { parts: [{ text: parsed.response }] },
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}\n\n`));
                }
              } catch {
                // Ignore malformed stream chunks.
              }
            }
          }
        }
      } catch (err) {
        const outEvent = { error: err.message || "AI Error" };
        await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}\n\n`));
      } finally {
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      }
    })(),
  );

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
