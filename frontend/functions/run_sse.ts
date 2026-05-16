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
  
  const aiResponseStream = await env.AI.run('@cf/google/gemma-7b-it-lora', {
      messages: [{ role: 'user', content: prompt }],
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
