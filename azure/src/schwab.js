"use strict";
// Single authorized user, private Azure blob, no browser-held brokerage tokens.
// Easy Auth must require authentication on ALL routes including callback.
const {app}=require("@azure/functions");
const crypto=require("node:crypto");
const host="https://api.schwabapi.com";
const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const json=(status,jsonBody)=>({status,headers,jsonBody});
const error=(status,message)=>Object.assign(new Error(message),{status});
const cfg=()=>{const id=process.env.SCHWAB_CLIENT_ID,secret=process.env.SCHWAB_CLIENT_SECRET,callback=process.env.SCHWAB_CALLBACK_URL,blob=process.env.SCHWAB_TOKEN_BLOB_URL;if(!id||!secret||!callback||!blob)throw error(503,"Schwab credentials or private token blob URL not configured.");const u=new URL(blob);if(u.protocol!=="https:"||!u.hostname.endsWith(".blob.core.windows.net")||u.search||u.hash)throw error(503,"Invalid private blob URL.");return {id,secret,callback,blob}};
function authorize(req){
 const raw=req.headers.get("x-ms-client-principal"),allowed=process.env.BROKERAGE_ALLOWED_OBJECT_ID;
 if(!raw)throw error(401,"Microsoft sign-in required.");
 if(!allowed)throw error(503,"Authorized user is not configured.");
 let oid;try{const p=JSON.parse(Buffer.from(raw,"base64").toString());oid=(p.claims||[]).find(c=>["oid","http://schemas.microsoft.com/identity/claims/objectidentifier"].includes(c.typ))?.val||p.userId}catch{throw error(401,"Invalid principal.")}
 if(!oid||oid.toLowerCase()!==allowed.toLowerCase())throw error(403,"Not authorized.");
}
async function storageToken(){
 if(!process.env.IDENTITY_ENDPOINT||!process.env.IDENTITY_HEADER)throw error(503,"Enable the Function App managed identity.");
 const u=new URL(process.env.IDENTITY_ENDPOINT);u.searchParams.set("api-version","2019-08-01");u.searchParams.set("resource","https://storage.azure.com/");
 const r=await fetch(u,{headers:{"X-IDENTITY-HEADER":process.env.IDENTITY_HEADER},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw error(503,"Managed identity token unavailable.");return (await r.json()).access_token;
}
async function blobRequest(method,query="",extra={},body){
 const r=await fetch(cfg().blob+query,{method,headers:{Authorization:"Bearer "+await storageToken(),"x-ms-version":"2023-11-03","x-ms-date":new Date().toUTCString(),...extra},body,signal:AbortSignal.timeout(8000)});
 return r;
}
async function ensureBlob(){
 const r=await blobRequest("PUT","",{"x-ms-blob-type":"BlockBlob","If-None-Match":"*","Content-Type":"application/json"},"{}");
 if(!r.ok&&r.status!==412&&r.status!==409)throw error(503,"Private token storage unavailable (HTTP "+r.status+").");
}
async function locked(fn){
 await ensureBlob();
 const lease=crypto.randomUUID();
 const acquired=await blobRequest("PUT","?comp=lease",{"x-ms-lease-action":"acquire","x-ms-lease-duration":"60","x-ms-proposed-lease-id":lease},"");
 if(!acquired.ok)throw error(409,"Schwab storage busy or inaccessible. Retry shortly.");
 try{
  const r=await blobRequest("GET","",{"x-ms-lease-id":lease});if(!r.ok)throw error(503,"Cannot read private token store.");
  const record=await r.json();
  const save=async data=>{const w=await blobRequest("PUT","",{"x-ms-blob-type":"BlockBlob","x-ms-lease-id":lease,"Content-Type":"application/json"},JSON.stringify(data));if(!w.ok)throw error(503,"Cannot save Schwab authorization.");};
  return await fn(record,save);
 }finally{try{await blobRequest("PUT","?comp=lease",{"x-ms-lease-action":"release","x-ms-lease-id":lease},"")}catch{}}
}
async function exchange(fields){
 const c=cfg(),r=await fetch(host+"/v1/oauth/token",{method:"POST",headers:{"Authorization":"Basic "+Buffer.from(c.id+":"+c.secret).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw error(r.status===400||r.status===401?401:502,"Schwab token exchange failed (HTTP "+r.status+"). Reauthorization may be required.");
 const t=await r.json();if(!t.access_token||!(Number(t.expires_in)>0))throw error(502,"Incomplete Schwab token response.");
 return t;
}
function tokens(t,old={},initial=false){
 const refresh=t.refresh_token||old.refresh;if(!refresh)throw error(502,"Schwab refresh token missing.");
 return {access:t.access_token,refresh,accessUntil:Date.now()+Number(t.expires_in)*1000,authorizedAt:initial?Date.now():old.authorizedAt};
}
async function access(){return locked(async(r,save)=>{
 const t=r.tokens;if(!t?.refresh)throw error(401,"Connect Schwab first.");
 if(t.access&&t.accessUntil>Date.now()+60000)return t.access;
 const next=tokens(await exchange({grant_type:"refresh_token",refresh_token:t.refresh}),t);
 await save({...r,tokens:next});return next.access;
});}
async function provider(path){
 const token=await access(),r=await fetch(host+path,{headers:{Authorization:"Bearer "+token,Accept:"application/json"},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw error(r.status===401?401:502,"Schwab API returned HTTP "+r.status+". Check authorization and approved API products.");
 return await r.json();
}
function route(name,method,path,handler){app.http(name,{methods:[method],authLevel:"anonymous",route:"schwab/"+path,handler:async(req,ctx)=>{try{authorize(req);return await handler(req)}catch(e){ctx.error("Schwab request failed (sanitized)",e.status||500);return json(e.status||502,{error:e.status?e.message:"Schwab request unavailable. Check configuration."})}}})}
route("schwabStatus","GET","status",async()=>{cfg();return locked(async r=>json(200,{configured:true,connected:!!r.tokens?.refresh,authorizedAt:r.tokens?.authorizedAt?new Date(r.tokens.authorizedAt).toISOString():null,estimatedReauthorizeAt:r.tokens?.authorizedAt?new Date(r.tokens.authorizedAt+7*86400000).toISOString():null}))});
route("schwabConnect","POST","connect",async(req)=>{
 // Only same-origin viewer can initiate OAuth, not arbitrary cross-origin forms.
 if(req.headers.get("origin")!==new URL(cfg().callback).origin)throw error(403,"Open the secure Schwab viewer.");
 const c=cfg(),state=crypto.randomBytes(32).toString("hex");
 await locked(async(r,save)=>save({...r,pending:{state,expires:Date.now()+600000}}));
 const u=new URL(host+"/v1/oauth/authorize");u.search=new URLSearchParams({client_id:c.id,redirect_uri:c.callback,response_type:"code",state}).toString();
 return json(200,{authorizationUrl:u.toString()});
});
route("schwabCallback","GET","callback",async req=>{
 const state=req.query.get("state"),code=req.query.get("code");
 if(!state||!code||state.length!==64||! /^[a-f0-9]+$/.test(state))throw error(400,"Missing or invalid OAuth response. Restart from the Schwab viewer.");
 await locked(async(r,save)=>{
  const p=r.pending;if(!p||p.expires<Date.now()||p.state!==state)throw error(400,"Expired or invalid OAuth state. Restart authorization.");
  delete r.pending;await save(r);
  const t=await exchange({grant_type:"authorization_code",code,redirect_uri:cfg().callback});
  await save({...r,tokens:tokens(t,{},true)});
 });
 return {status:303,headers:{...headers,Location:"/api/schwab/view"}};
});
route("schwabAccounts","GET","accounts",async()=>{
 const data=await provider("/trader/v1/accounts?fields=positions");
 if(!Array.isArray(data))throw error(502,"Unexpected account response.");
 const accounts=data.map((entry,i)=>{const a=entry.securitiesAccount||{},b=a.currentBalances||{};return {label:"Schwab "+(a.type||"Account")+" •"+String(a.accountNumber||"").slice(-4),type:a.type||null,liquidationValue:b.liquidationValue??null,cashBalance:b.cashBalance??null,availableFunds:b.availableFunds??null,positions:(a.positions||[]).map(p=>({symbol:p.instrument?.symbol||null,assetType:p.instrument?.assetType||null,longQuantity:p.longQuantity??null,shortQuantity:p.shortQuantity??null,marketValue:p.marketValue??null,averagePrice:p.averagePrice??null}))}});
 return json(200,{source:"Charles Schwab",retrievedAt:new Date().toISOString(),accounts});
});
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Schwab Connection</title><style>body{font:16px system-ui;max-width:1000px;margin:35px auto;padding:16px}button{padding:10px;margin:5px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef3f8;padding:15px}</style><h1>Charles Schwab · Secure preview</h1><p>Microsoft-authenticated read-only test. No portfolio records are modified. Tokens remain on Azure.</p><button id="status">Check connection</button><button id="connect">Connect / Reauthorize Schwab</button><button id="accounts">Retrieve accounts and positions</button><pre id="out" role="status"></pre><script>
const out=document.getElementById("out");async function run(path,method="GET"){out.textContent="Requesting...";try{const r=await fetch("/api/schwab/"+path,{method,cache:"no-store",credentials:"same-origin"});const d=await r.json();if(!r.ok)throw Error(d.error||"HTTP "+r.status);if(path==="connect"){const u=new URL(d.authorizationUrl);if(u.origin!=="https://api.schwabapi.com")throw Error("Invalid authorization destination");location.assign(u.href);return}out.textContent=JSON.stringify(d,null,2)}catch(e){out.textContent=e.message}}
document.getElementById("status").onclick=()=>run("status");document.getElementById("connect").onclick=()=>run("connect","POST");document.getElementById("accounts").onclick=()=>run("accounts");run("status");
</script></html>`;
route("schwabViewer","GET","view",async()=>({status:200,headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"},body:page}));
