"use strict";
// Private, read-only SnapTrade Commercial Test adapter.
// Easy Auth must REQUIRE authentication at the platform layer.
// BROKERAGE_ALLOWED_OBJECT_ID must be set to the authorized Entra user's object ID.
const { app } = require("@azure/functions");
const { Snaptrade, SnaptradeAuth } = require("snaptrade-typescript-sdk");
const noStore = { "Cache-Control": "no-store, private", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const reply = (status, body) => ({ status, headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" }, jsonBody: body });
const fail = (status, error) => reply(status, { error });
function authorize(req) {
  const raw = req.headers.get("x-ms-client-principal");
  if (!raw) return { status: 401, error: "Microsoft sign-in required." };
  const permitted = (process.env.BROKERAGE_ALLOWED_OBJECT_ID || "").trim().toLowerCase();
  if (!permitted) return { status: 503, error: "Brokerage user authorization not configured." };
  try {
    const p = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    const oid = (p.claims || []).find(c => ["http://schemas.microsoft.com/identity/claims/objectidentifier", "oid"].includes(c.typ))?.val || p.userId;
    if (!oid || String(oid).toLowerCase() !== permitted) return { status: 403, error: "Not authorized for brokerage data." };
  } catch (_) { return { status: 401, error: "Invalid authenticated principal." }; }
  return null;
}
const clean = value => value == null ? null : String(value);
const amount = value => value == null || value === "" ? null : String(value);
function normalizePositions(payload) {
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  return rows.map((p, i) => ({
    row: i + 1,
    instrumentId: clean(p.instrument?.id),
    kind: clean(p.instrument?.kind),
    symbol: clean(p.instrument?.symbol || p.instrument?.raw_symbol),
    description: clean(p.instrument?.description),
    units: amount(p.units),
    price: amount(p.price),
    costBasisPerUnit: amount(p.cost_basis),
    currency: clean(p.currency || p.instrument?.currency),
    cashEquivalent: p.cash_equivalent === true
  }));
}
function normalizeBalances(b) {
  if (!b) return null;
  const entries = values => Array.isArray(values) ? values.map(x => ({
    currency: clean(x.currency), amount: amount(x.amount),
    ...(x.basis ? { basis: clean(x.basis) } : {})
  })) : null;
  return {
    netValue: b.net_value ? { amount: amount(b.net_value.amount), currency: clean(b.net_value.currency) } : null,
    cashOrMargin: clean(b.cash_or_margin),
    cash: entries(b.cash), buyingPower: entries(b.buying_power),
    marginLoanBalances: entries(b.margin?.loan_balances),
    asOf: clean(b.data_freshness?.as_of)
  };
}
async function preview() {
  const keys = ["SNAPTRADE_CLIENT_ID", "SNAPTRADE_CONSUMER_KEY", "SNAPTRADE_USER_ID", "SNAPTRADE_USER_SECRET"];
  if (keys.some(k => !process.env[k] || process.env[k].startsWith("@Microsoft.KeyVault("))) {
    return reply(503, { error: "One or more SnapTrade Key Vault references are unavailable." });
  }
  const api = new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({
      clientId: process.env.SNAPTRADE_CLIENT_ID,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY
    })
  });
  const userId = process.env.SNAPTRADE_USER_ID;
  const userSecret = process.env.SNAPTRADE_USER_SECRET;
  const list = await api.accountInformation.listAllUserAccounts({ userId, userSecret });
  const all = Array.isArray(list.data?.results) ? list.data.results : [];
  // /accounts/all does not supply an institution name; show all investment accounts
  // for this one-user Fidelity test connection. Verify identities before wider brokerage use.
  const fidelity = all.filter(a => a.kind === "investment");
  const accounts = await Promise.all(fidelity.map(async a => {
    const result = {
      id: clean(a.id), name: clean(a.display_name || a.name), accountType: clean(a.raw_type || a.type),
      institutionId: clean(a.institution_id), maskedAccountNumber: clean(a.masked_account_number),
      reportedNetValue: a.net_value || null, balances: null, positions: [], positionsAsOf: null, errors: []
    };
    const [balances, positions] = await Promise.allSettled([
      api.accountInformation.getAccountBalancesV2({ accountId: a.id, userId, userSecret }),
      api.accountInformation.getAllAccountPositions({ accountId: a.id, userId, userSecret })
    ]);
    if (balances.status === "fulfilled") result.balances = normalizeBalances(balances.value.data);
    else result.errors.push("Balance retrieval unavailable");
    if (positions.status === "fulfilled") {
      result.positions = normalizePositions(positions.value.data);
      result.positionsAsOf = clean(positions.value.data?.data_freshness?.as_of);
    } else result.errors.push("Positions retrieval unavailable");
    return result;
  }));
  return reply(200, {
    source: "SnapTrade Commercial Test / Fidelity",
    retrievedAt: new Date().toISOString(),
    providerDataMayBeCached: true,
    allAccountCount: all.length, investmentAccountCount: fidelity.length,
    note: "Broker-reported net equity is authoritative; do not add cash twice to cash-equivalent holdings. Null margin loan is unknown, not proof of a loan.",
    accounts
  });
}
app.http("fidelityPreview", {
  methods: ["GET"], authLevel: "anonymous", route: "brokerage/fidelity/preview",
  handler: async (req, ctx) => {
    const denied = authorize(req);
    if (denied) return reply(denied.status, { error: denied.error });
    try { return await preview(); }
    catch (e) {
      // Never log request data, account data, provider errors or raw secrets.
      ctx.error("Fidelity preview provider request failed (sanitized)");
      return reply(502, { error: "SnapTrade request failed. Check the existing connection and Azure settings." });
    }
  }
});
const page = String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fidelity  -  Connected Preview</title><style>body{font:15px system-ui;background:#f4f7fb;color:#16283e;margin:0}main{max-width:1200px;margin:auto;padding:22px}h1{font-size:25px}button{background:#2457bb;color:white;border:0;border-radius:8px;padding:11px 17px;cursor:pointer}button:disabled{opacity:.6}section{background:white;border:1px solid #dce4ef;border-radius:12px;padding:18px;margin:14px 0}.muted{color:#62758b}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{border-bottom:1px solid #e8eef5;text-align:left;padding:9px}td.num{text-align:right}th{font-size:12px;color:#64748b}strong{font-weight:700}</style><main><h1>Fidelity  -  Connected Preview</h1><p class="muted">Read-only SnapTrade Commercial Test data. Nothing is imported into the dashboard or saved in IndexedDB. Account listing may be cached. Verify these accounts belong to Fidelity before trusting the preview.</p><button id="load">Retrieve Fidelity preview</button> <span id="message" role="status"></span><div id="results"></div></main><script>
"use strict";
const root=document.getElementById("results"),msg=document.getElementById("message"),btn=document.getElementById("load");
const fmt=(v,c)=>v===null||v===undefined||v===""?"--":c&&Number.isFinite(Number(v))?new Intl.NumberFormat(undefined,{style:"currency",currency:c}).format(Number(v)):String(v);
const node=(tag,txt,parent,cls)=>{const e=document.createElement(tag);e.textContent=txt??"";if(cls)e.className=cls;parent.append(e);return e};
function table(parent,heads,rows){const wrap=node("div","",parent,"scroll"),t=node("table","",wrap),tr=node("tr","",t);heads.forEach(x=>node("th",x,tr));rows.forEach(r=>{const tr=node("tr","",t);r.forEach((v,i)=>node("td",v,tr,i>0?"num":""))})}
btn.onclick=async()=>{
  btn.disabled=true;msg.textContent="Requesting brokerage data...";root.replaceChildren();
  try{
    const res=await fetch("/api/brokerage/fidelity/preview",{method:"GET",credentials:"same-origin",headers:{"Accept":"application/json"}});
    const d=await res.json();
    if(!res.ok)throw Error(d.error||"HTTP "+res.status);
    msg.textContent="Retrieved "+new Date(d.retrievedAt).toLocaleString()+"  -  "+d.investmentAccountCount+" connected investment accounts";
    if(!d.accounts.length){node("section","No investment accounts were returned. "+d.allAccountCount+" connected accounts were returned; no data was modified.",root);return}
    for(const a of d.accounts){
      const s=node("section","",root);node("h2",a.name||"Investment account",s);
      node("p","Provider account ID: "+(a.id||"--")+"  -  Type: "+(a.accountType||"--"),s,"muted");
      const b=a.balances;node("p","Net equity: "+(b?.netValue?fmt(b.netValue.amount,b.netValue.currency):"Unavailable")+
       "  -  Margin classification: "+(b?.cashOrMargin||"Unknown")+"  -  Balance as of: "+(b?.asOf||"Unknown"),s);
      if(b?.cash?.length)table(s,["Reported cash currency","Amount"],b.cash.map(x=>[x.currency,fmt(x.amount,x.currency)]));
      if(b?.marginLoanBalances?.length)table(s,["Reported margin loan currency","Amount"],b.marginLoanBalances.map(x=>[x.currency,fmt(x.amount,x.currency)]));
      else node("p","Margin loan detail: "+(b?.marginLoanBalances===null?"Not reported":"No reported loan entries"),s,"muted");
      node("h3","Positions ("+a.positions.length+")",s);
      table(s,["Symbol","Type","Units","Price","Average basis/unit","Currency","Counted in cash"],a.positions.map(p=>[
        (p.symbol||"--")+"  -  "+(p.description||""),p.kind||"--",fmt(p.units),fmt(p.price,p.currency),fmt(p.costBasisPerUnit,p.currency),
        p.currency||"--",p.cashEquivalent?"Yes":"No"
      ]));
      node("p","Positions as of: "+(a.positionsAsOf||"Unknown"),s,"muted");
      a.errors.forEach(x=>node("p","Unavailable: "+x,s,"muted"));
    }
  }catch(e){msg.textContent=e.message||"Unable to retrieve Fidelity data"}
  finally{btn.disabled=false}
};
</script></html>`;
app.http("fidelityViewer", {
  methods: ["GET"], authLevel: "anonymous", route: "brokerage/fidelity",
  handler: async req => {
    const denied = authorize(req);
    if (denied) return { status: denied.status, headers: { ...noStore, "Content-Type": "text/plain" }, body: denied.error };
    return { status: 200, headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }, body: page };
  }
});
