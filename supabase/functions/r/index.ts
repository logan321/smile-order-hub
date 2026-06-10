import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED = ["stamp-catalog", "patch-catalog", "shirt-templates", "text-styles", "shirt-designs", "uv-maps"];

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  
  // Basic protection against direct usage from unauthorized domains
  // Allows requests with no origin (e.g. initial load) but blocks explicitly different origins if needed
  // For now, we'll just log and monitor, or we could enforce a strict check.
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const d = url.searchParams.get("d");

    if (!d) {
      return new Response("", { status: 400, headers: corsHeaders });
    }

    // Decode base64 param: "bucket|path"
    let decoded: string;
    try {
      decoded = atob(d);
    } catch {
      return new Response("", { status: 400, headers: corsHeaders });
    }

    const sep = decoded.indexOf("|");
    if (sep === -1) {
      return new Response("", { status: 400, headers: corsHeaders });
    }

    const bucket = decoded.substring(0, sep);
    const path = decoded.substring(sep + 1);

    if (!ALLOWED.includes(bucket) || !path) {
      return new Response("", { status: 403, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error || !data) {
      return new Response("", { status: 404, headers: corsHeaders });
    }

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const ct: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    };

    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": ct[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("", { status: 500, headers: corsHeaders });
  }
});
