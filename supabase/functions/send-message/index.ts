import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables in send-message function.");
}

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

interface SendMessagePayload {
  board_id: string;
  content: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "Backend not configured" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  let payload: SendMessagePayload;
  try {
    payload = (await req.json()) as SendMessagePayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const boardId = typeof payload.board_id === "string" ? payload.board_id.trim() : "";
  const content = typeof payload.content === "string" ? payload.content.trim() : "";

  if (!boardId || !content) {
    return new Response(JSON.stringify({ error: "board_id and content are required" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (content.length > 4096) {
    return new Response(JSON.stringify({ error: "Message is too long" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // Ensure this targets the global public board only
  const { data: board, error: boardError } = await supabaseAdmin
    .from("boards")
    .select("id, owner_id, visibility")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    console.error(boardError);
    return new Response(JSON.stringify({ error: "Failed to verify board" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  if (!board || board.owner_id !== null || board.visibility !== "public") {
    return new Response(JSON.stringify({ error: "Board not available for anonymous chat" }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  // Best-effort client IP and reverse DNS lookup
  const forwardedFor = req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    undefined;

  const ip = forwardedFor?.split(",")[0].trim() || "0.0.0.0";

  let rdns: string | null = null;
  if (ip && ip !== "0.0.0.0") {
    try {
      const ptrRecords = await Deno.resolveDns(ip, "PTR");
      if (Array.isArray(ptrRecords) && ptrRecords.length > 0) {
        rdns = String(ptrRecords[0]);
      }
    } catch (err) {
      console.warn("Reverse DNS lookup failed", err?.message ?? err);
      rdns = null;
    }
  }

  const { data: message, error: insertError } = await supabaseAdmin
    .from("messages")
    .insert({
      board_id: boardId,
      user_id: null,
      content,
      ip,
      rdns,
    })
    .select("id, content, created_at, user_id, ip, rdns")
    .single();

  if (insertError) {
    console.error(insertError);
    return new Response(JSON.stringify({ error: "Failed to store message" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  return new Response(JSON.stringify({ ok: true, message }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});
