import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");
const USER_AGENT = "TXTAlbumTracker/1.0 +https://github.com/tu-usuario/txt-album-tracker";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path, params } = await req.json();
    // path ej: "/database/search" o "/masters/123/versions"

    const url = new URL(`https://api.discogs.com${path}`);
    Object.entries(params ?? {}).forEach(([key, value]) =>
      url.searchParams.set(key, String(value))
    );

    const discogsRes = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Authorization: `Discogs token=${DISCOGS_TOKEN}`,
      },
    });

    const data = await discogsRes.json();

    return new Response(JSON.stringify(data), {
      status: discogsRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});