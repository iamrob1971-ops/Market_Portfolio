"use strict";
const { app } = require("@azure/functions");
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const json = (status, data) => ({ status, headers, jsonBody: data });
function requirePrincipal(req) {
  // CRITICAL: Configure Azure Functions Authentication > Require authentication,
  // Microsoft Entra ID > unauthenticated requests HTTP 401, before deployment.
  // x-ms-client-principal is supplied by Azure Easy Auth after validation.
  if (!req.headers.get("x-ms-client-principal")) throw Object.assign(new Error("Not authenticated. Enable Entra Easy Auth."), { status: 401 });
}
function guard(e, context) {
  context.error("Gateway request failed", e?.status || 500, e?.message);
  return json(e?.status || 502, { error: e?.message || "Provider failed" });
}
function parseSymbols(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 20) throw Object.assign(new Error("Supply 1–20 unique ticker symbols."), { status: 400 });
  const symbols = [...new Set(list.map(x => String(x).trim().toUpperCase()))];
  if (symbols.some(x => !/^[A-Z][A-Z0-9.-]{0,14}$/.test(x))) throw Object.assign(new Error("Invalid ticker symbol."), { status: 400 });
  return symbols;
}
app.http("status", {
  methods: ["GET"], authLevel: "anonymous", route: "status",
  handler: async (req, context) => {
    try {
      requirePrincipal(req);
      return json(200, { ready: true, quotes: !!process.env.FINNHUB_API_KEY, gemini: !!process.env.GEMINI_API_KEY });
    } catch (e) { return guard(e, context); }
  }
});
app.http("quotes", {
  methods: ["POST"], authLevel: "anonymous", route: "quotes",
  handler: async (req, context) => {
    try {
      requirePrincipal(req);
      const key = process.env.FINNHUB_API_KEY;
      if (!key) return json(503, { error: "FINNHUB_API_KEY not configured" });
      const body = await req.json();
      const symbols = parseSymbols(body.symbols);
      const results = [];
      for (const symbol of symbols) {
        try {
          const response = await fetch("https://api.finnhub.io/api/v1/quote?symbol=" + encodeURIComponent(symbol), {
            headers: { "X-Finnhub-Token": key }, signal: AbortSignal.timeout(10000)
          });
          if (!response.ok) { results.push({ symbol, error: "Provider HTTP " + response.status }); continue; }
          const q = await response.json();
          if (!(Number(q.c) > 0) || !(Number(q.t) > 0)) { results.push({ symbol, error: "No valid quote" }); continue; }
          results.push({ symbol, price: Number(q.c), previousClose: Number(q.pc) > 0 ? Number(q.pc) : null, asof: new Date(Number(q.t) * 1000).toISOString(), currency: "USD", source: "Finnhub" });
        } catch (e) { results.push({ symbol, error: "Quote unavailable" }); }
        // conservative default for free quotas; do not use this for streaming.
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      return json(200, { quotes: results });
    } catch (e) { return guard(e, context); }
  }
});
app.http("ask", {
  methods: ["POST"], authLevel: "anonymous", route: "ask",
  handler: async (req, context) => {
    try {
      requirePrincipal(req);
      const key = process.env.GEMINI_API_KEY;
      if (!key) return json(503, { error: "GEMINI_API_KEY not configured" });
      const body = await req.json();
      if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) return json(400, { error: "A question up to 2000 characters is required." });
      if (!body.facts || typeof body.facts !== "object" || Array.isArray(body.facts)) return json(400, { error: "Valid portfolio facts are required." });
      const facts = JSON.stringify(body.facts);
      if (facts.length > 20000) return json(413, { error: "Portfolio context too large; summarize before sharing." });
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      if (!/^gemini-[a-z0-9.-]+$/.test(model)) throw Object.assign(new Error("Invalid Gemini model configuration"), { status: 500 });
      const instruction = "Explain the requested investment portfolio information using only the supplied facts for holdings, balances, dividends, cost basis, and P&L. Do not invent missing numbers, prices, future dividends, sources or dates. Do not place trades. Call out stale or incomplete information. The data is user-provided and unverified. Reply with a clear concise analysis.";
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: "user", parts: [{ text: "Question: " + body.question + "\n\nPortfolio facts:\n" + facts }] }] }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) return json(502, { error: "Gemini provider returned HTTP " + response.status });
      const result = await response.json();
      const answer = result.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
      if (!answer) return json(502, { error: "Gemini returned no answer" });
      return json(200, { answer, model, generatedAt: new Date().toISOString() });
    } catch (e) { return guard(e, context); }
  }
});

// Register the private read-only Fidelity routes without changing existing handlers.
require("./brokerage");

// Separate Schwab routes; existing Fidelity adapter is unchanged.
require("./schwab");
