// Vercel serverless handler. The Meta access token must be a SERVER-SIDE environment variable.
import type { IncomingMessage, ServerResponse } from "node:http";

const PIXEL_ID = "162157623233063";
const eventNames = new Set(["Lead", "Contact"]);
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
  const token = process.env.META_DIAGNOSTIC_CAPI_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) {
    res.statusCode = 503; res.end(JSON.stringify({ error: "server_tracking_unavailable" })); return;
  }
  try {
    let raw = "";
    for await (const part of req) {
      raw += part.toString();
      if (raw.length > 4000) { res.statusCode = 413; res.end(); return; }
    }
    const input = JSON.parse(raw) as { eventName?: string; eventId?: string; resultToken?: string };
    if (!eventNames.has(input.eventName ?? "") ||
        !/^[a-z0-9-]{8,120}$/i.test(input.eventId ?? "") ||
        !/^[0-9a-f-]{36}$/i.test(input.resultToken ?? "")) {
      res.statusCode = 400; res.end(); return;
    }
    // Validate against the saved diagnostic before accepting a conversion.
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/public_diagnostic_result`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ result_token: input.resultToken }),
    });
    if (!result.ok || !(await result.json())) {
      res.statusCode = 404; res.end(); return;
    }
    const host = req.headers.host ?? "";
    const meta = await fetch(`https://graph.facebook.com/v23.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: `https://${host}/diagnostico`,
        user_data: { client_user_agent: req.headers["user-agent"] ?? "" },
      }] }),
    });
    res.statusCode = meta.ok ? 200 : 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: meta.ok }));
  } catch {
    res.statusCode = 400; res.end(JSON.stringify({ error: "invalid_request" }));
  }
}
