export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const data = await request.json();
  const prompt = data.new_message.parts.map(p => p.text).join('\n');
  
  const systemPrompt = `You are Waelio's personal AI agent.
Wael Wahbeh (Waelio) is a full-stack software engineer.
He builds:
- Agent: A local privacy-first AI assistant using Ollama and FastAPI
- Negotiate: An autonomous AI negotiation engine built as a Cloudflare Worker using Llama 3
- Siteforge: A persistent, automated website rendering engine on Cloudflare Workers
- Waelio Toolkit: A Chrome Extension companion tool

CRITICAL INSTRUCTION: Waelio does NOT build cryptocurrency wallets, blockchains, or Web3 projects. Do NOT hallucinate or invent projects. If asked about his projects, ONLY list the ones above.`;

  let searchContext = "";
  const lowerPrompt = prompt.toLowerCase();
  
  try {
      if (lowerPrompt.includes("weather")) {
          const wttrReq = await fetch("https://wttr.in/?format=3");
          const wttrText = await wttrReq.text();
          searchContext = `\n\n[Live Web Data]: The current weather is ${wttrText}`;
      } else if (lowerPrompt.includes("today") || lowerPrompt.includes("news") || lowerPrompt.includes("current") || lowerPrompt.includes("price") || lowerPrompt.includes("latest")) {
          const ddgRes = await fetch("https://lite.duckduckgo.com/lite/", {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ q: prompt }).toString()
          });
          const html = await ddgRes.text();
          const snippets = [...html.matchAll(/class="result-snippet"[^>]*>(.*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 3).join("\n");
          if (snippets) {
              searchContext = `\n\n[Live Web Data for "${prompt}"]:\n${snippets}`;
          }
      }
  } catch (e) {
      console.error("Search failed", e);
  }

  const finalSystemPrompt = systemPrompt + searchContext + "\nUse the Live Web Data above to answer the user's question accurately if it is present. Do NOT say you don't have real time info if the info is right there.";

  const aiResponseStream = await env.AI.run('@cf/google/gemma-7b-it-lora', {
      messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: prompt }
      ],
      stream: true
  });
  
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  
  context.waitUntil((async () => {
      try {
          // env.AI.run returns a ReadableStream if stream: true
          const reader = aiResponseStream.getReader ? aiResponseStream.getReader() : aiResponseStream.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                  if (line.startsWith('data: ')) {
                      const dataStr = line.slice(6).trim();
                      if (dataStr === '[DONE]') continue;
                      
                      try {
                          const parsed = JSON.parse(dataStr);
                          if (parsed.response) {
                              const outEvent = {
                                  content: { parts: [{ text: parsed.response }] }
                              };
                              await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}\n\n`));
                          }
                      } catch (e) {}
                  }
              }
          }
      } catch (err) {
          const outEvent = { error: err.message || "AI Error" };
          await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}\n\n`));
      } finally {
          await writer.write(encoder.encode(`data: [DONE]\n\n`));
          await writer.close();
      }
  })());
  
  return new Response(readable, {
      headers: { 
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
      }
  });
}
