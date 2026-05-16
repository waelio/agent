export async function onRequestPost(context) {
  // Return a dummy session ID to satisfy the frontend's session requirement
  return new Response(JSON.stringify({ id: "serverless-session" }), {
    headers: { "Content-Type": "application/json" }
  });
}
