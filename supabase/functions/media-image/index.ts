// Retired: image generation runs through AgentSky.
Deno.serve(() =>
  new Response(JSON.stringify({ error: true, message: "Image generation moved to AgentSky." }), {
    status: 410,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  }),
);
