// Retired: video status is read from AgentSky (route=media-status).
Deno.serve(() =>
  new Response(JSON.stringify({ error: true, message: "Video generation moved to AgentSky." }), {
    status: 410,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  }),
);
