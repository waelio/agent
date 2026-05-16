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
  return new Response(JSON.stringify({ id: "serverless-session" }), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
