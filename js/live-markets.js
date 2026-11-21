(function(){
"use strict";
const $=id=>document.getElementById(id),safe=v=>esc(String(v??"")),num=v=>Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}),symok=s=>/^[A-Z][A-Z0-9.-]{0,14}$/.test(s);
const stocks=()=>[...new Set(holdings().filter(h=>h.kind!=="money").map(h=>h.symbol.toUpperCase()))].sort();
function init(){if(!Array.isArray(state.focusGroups))state.focusGroups=[{id:"focus",name:"Focus",symbols:[]}]}
function addPage(id,name,html){const button=document.createElement("button");button.dataset.tab=id;button.textContent=name;document.querySelector("nav").append(button);const panel=document.createElement("section");panel.id=id;panel.className="tab";panel.innerHTML=html;document.querySelector("main").append(panel);button.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("show",t===panel));document.querySelectorAll("nav button").forEach(t=>t.classList.toggle("active",t===button))};return panel}
addPage("live-focus","Watchlists & Live",'<div class="card"><h2>Focus Watchlists</h2><p>Select stocks you own, or follow other symbols. Group locally; no brokerage trades occur.</p><div class="formgrid"><label>Group<select id="fw-group"></select></label><label>New group<input id="fw-group-name" placeholder="Tech watch"></label><label>Symbol<input id="fw-symbol" placeholder="NVDA"></label><label>From my holdings<select id="fw-holdings"></select></label></div><div class="actions"><button class="btn secondary" id="fw-create">Create group</button><button class="btn secondary" id="fw-add">Add symbol</button><button class="btn secondary" id="fw-add-held">Add holding</button><button class="btn secondary" id="fw-del-group">Delete group</button></div><div id="fw-list"></div></div><div class="card"><h2>Finnhub Live Trade Stream</h2><p>One browser WebSocket for up to 20 selected symbols. Trades can be sparse, come from a limited exchange feed, and need not match a consolidated brokerage quote.</p><div class="actions"><button class="btn" id="fw-start">Start live updates</button><button class="btn secondary" id="fw-stop">Stop</button><button class="btn secondary" id="fw-apply">Apply streamed prices to holdings</button></div><p id="fw-status" class="muted" role="status">Disconnected. Enter Finnhub token in Price Refresh.</p><div id="fw-table"></div><small>Connection closes when this browser tab is hidden and resumes when visible unless stopped. No stream changes your saved holdings without applying.</small></div>');
const focusSymbols=()=>[...new Set((state.focusGroups||[]).flatMap(g=>g.symbols||[]))];
function group(){return state.focusGroups.find(g=>g.id===$("fw-group").value)}
function renderGroups(){
 init();let select=$("fw-group"),prior=select.value;select.innerHTML=state.focusGroups.map(g=>'<option value="'+safe(g.id)+'">'+safe(g.name)+'</option>').join("");if(state.focusGroups.some(g=>g.id===prior))select.value=prior;
 const held=stocks(),h=$("fw-holdings"),old=h.value;h.innerHTML=held.map(t=>'<option value="'+safe(t)+'">'+safe(t)+'</option>').join("");if(held.includes(old))h.value=old;
 const g=group();$("fw-list").innerHTML='<p><strong>'+safe(g?.name||"Focus")+'</strong> ('+(g?.symbols?.length||0)+' tickers)</p><div class="actions">'+(g?.symbols||[]).map(s=>'<button class="btn secondary" data-rm="'+safe(s)+'">'+safe(s)+' ×</button>').join("")+'</div>';
 renderLive();
}
$("fw-group").onchange=renderGroups;
$("fw-create").onclick=async()=>{init();let name=$("fw-group-name").value.trim().slice(0,50);if(!name)return alert("Enter a group name.");if(state.focusGroups.some(g=>g.name.toLowerCase()===name.toLowerCase()))return alert("Already exists.");const id=uid();state.focusGroups.push({id,name,symbols:[]});await save();renderGroups();$("fw-group").value=id;renderGroups();$("fw-group-name").value=""};
async function addSymbol(t){init();let symbol=String(t||"").trim().toUpperCase();if(!symok(symbol))return alert("Invalid symbol.");let g=group();if(!g)return;if(g.symbols.includes(symbol))return alert("Already in this group.");if(!focusSymbols().includes(symbol)&&focusSymbols().length>=20)return alert("20 unique live symbols maximum for this initial version.");g.symbols.push(symbol);await save();renderGroups();subscribeCurrent()}
$("fw-add").onclick=()=>addSymbol($("fw-symbol").value);
$("fw-add-held").onclick=()=>addSymbol($("fw-holdings").value);
$("fw-del-group").onclick=async()=>{let g=group();if(!g||!confirm("Delete watchlist group "+g.name+"? No holdings will be removed."))return;state.focusGroups=state.focusGroups.filter(x=>x!==g);if(!state.focusGroups.length)state.focusGroups=[{id:uid(),name:"Focus",symbols:[]}];await save();renderGroups();subscribeCurrent()};
$("fw-list").onclick=async e=>{let b=e.target.closest("[data-rm]");if(!b)return;let g=group();g.symbols=g.symbols.filter(x=>x!==b.dataset.rm);await save();renderGroups();subscribeCurrent()};
const live=new Map();let sock=null,manualStop=true,retry=null,retries=0,ticks=0;
const streamStatus=s=>$("fw-status").textContent=s;
function getPrice(s){const t=live.get(s);if(t)return t;let h=holdings().find(h=>h.symbol.toUpperCase()===s);return h?{price:Number(h.price),asof:h.quoteAsOf||null,source:h.quoteSource||"Saved",previousClose:h.previousClose}:null}
function renderLive(){let items=focusSymbols().map(s=>{let q=getPrice(s);return '<tr><td>'+safe(s)+'</td><td>'+(q&&Number(q.price)>0?num(q.price):"—")+'</td><td>'+safe(q?.source||"Unavailable")+'</td><td>'+safe(q?.asof?new Date(q.asof).toLocaleString():"Unknown")+'</td></tr>'});$("fw-table").innerHTML='<table><thead><tr><th>Symbol</th><th>Last $</th><th>Source</th><th>Time</th></tr></thead><tbody>'+items.join("")+'</tbody></table>'}
function subscribeCurrent(){if(!sock||sock.readyState!==WebSocket.OPEN)return;let before=new Set(sock._symbols||[]),want=new Set(focusSymbols());for(let s of before)if(!want.has(s))sock.send(JSON.stringify({type:"unsubscribe",symbol:s}));for(let s of want)if(!before.has(s))sock.send(JSON.stringify({type:"subscribe",symbol:s}));sock._symbols=[...want];streamStatus("Connected; "+want.size+" symbols; "+ticks+" trade updates received.")}
function closeStream(stop){manualStop=stop;if(retry){clearTimeout(retry);retry=null}if(sock){let old=sock;sock=null;old.onclose=null;old.close()}streamStatus(stop?"Stopped.":"Paused: page not visible.")}
function openStream(){if(document.hidden)return;if(sock)return;let key=$("fh-key")?.value.trim();if(!key)return streamStatus("Enter Finnhub API key in Price Refresh first.");if(!focusSymbols().length)return streamStatus("Add symbols to a watchlist first.");manualStop=false;
 try{const ws=new WebSocket("wss://ws.finnhub.io?token="+encodeURIComponent(key));sock=ws;ws._symbols=[];streamStatus("Connecting...");
 ws.onopen=()=>{if(sock!==ws)return;retries=0;subscribeCurrent()};
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type!=="trade"||!Array.isArray(m.data))return;let allowed=new Set(focusSymbols()),changed=false;for(let p of m.data){let s=String(p.s||"").toUpperCase(),price=Number(p.p),time=Number(p.t);if(!allowed.has(s)||!(price>0)||!Number.isFinite(time))continue;const previousClose=getPrice(s)?.previousClose??null;live.set(s,{price,asof:new Date(time).toISOString(),source:"Finnhub streamed trade",previousClose});ticks++;changed=true}if(changed){renderLive();streamStatus("Live; "+ticks+" trade updates; last "+new Date().toLocaleTimeString())}};
 ws.onerror=()=>{if(sock===ws)streamStatus("WebSocket connection / entitlement error.")};
 ws.onclose=e=>{if(sock!==ws)return;sock=null;if(!manualStop&&!document.hidden&&retries<5){let ms=Math.min(30000,1500*2**retries++);streamStatus("Disconnected ("+e.code+"); retrying in "+Math.round(ms/1000)+"s");retry=setTimeout(()=>{retry=null;openStream()},ms)}else streamStatus("Disconnected; use Start to retry.")};
 }catch(e){streamStatus("WebSocket unavailable: "+e.message)}
}
$("fw-start").onclick=openStream;$("fw-stop").onclick=()=>closeStream(true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)closeStream(false);else if(!manualStop)openStream()});
$("fw-apply").onclick=async()=>{const selected=focusSymbols().filter(s=>live.has(s));if(!selected.length)return alert("No streamed trades received.");if(!confirm("Apply latest trades for "+selected.length+" symbols to matching holdings?"))return;let updated=0;for(let s of selected){let q=live.get(s);for(let h of state.holdings.filter(h=>h.symbol.toUpperCase()===s&&h.kind!=="money")){h.price=q.price;h.marketValue=null;h.quoteSource=q.source;h.quoteAsOf=q.asof;updated++}}await save();toast(updated+" positions repriced")};
addPage("real-indexes","Actual Indexes",'<div class="card"><h2>Actual Dow, S&P 500 and Nasdaq Composite</h2><p>Tests the FMP individual quote endpoint for ^DJI, ^GSPC and ^IXIC, not the paid batch endpoint. Index points, not ETFs. Verify free-plan entitlement and freshness.</p><div class="formgrid"><label>FMP key (session only)<input id="fmp-key" type="password" autocomplete="off"></label><label>Auto interval<select id="fmp-interval"><option value="360000" selected>6 minutes (recommended)</option><option value="480000">8 minutes</option><option value="600000">10 minutes</option></select></label></div><div class="actions"><button class="btn" id="fmp-start">Enable visible-only auto updates</button><button class="btn secondary" id="fmp-test">Test once</button><button class="btn secondary" id="fmp-stop">Stop</button></div><p id="fmp-status" class="muted">No index provider connected.</p><div id="fmp-results"></div><small>Auto: weekdays 9:30 a.m.–4 p.m. ET, only while this page is visible. Three individual requests per refresh. About 195–198 calls for a six-minute trading-day cadence. Conservative 210-call browser budget; other device and account usage also counts. This is not a guaranteed licensed real-time exchange feed.</small></div>');
let timer=null,enabled=false,lastQuery=0,pending=false,used=0;
const indexes=[["^DJI","Dow Jones Industrial Average"],["^GSPC","S&P 500"],["^IXIC","Nasdaq Composite"]];
function marketOpen(){const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));let t=Number(parts.hour)*60+Number(parts.minute);return !["Sat","Sun"].includes(parts.weekday)&&t>=570&&t<=960}
function budget(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const d=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 const key="portfolio-index-individual-"+d.year+"-"+d.month+"-"+d.day;
 let count=used;try{count=Number(sessionStorage.getItem(key))||0}catch(e){}
 return {key,count};
}
function consume(){const b=budget();used=b.count+1;try{sessionStorage.setItem(b.key,String(used))}catch(e){}}
const fmtChange=n=>Number.isFinite(n)?(n>0?"+":"")+num(n):"—";
function renderIndexes(){let data=state.indexQuotes||{},rows=indexes.map(([symbol,name])=>{let v=data[symbol],p=Number(v?.price),c=v?.change===null?NaN:Number(v?.change),pct=Number.isFinite(c)&&p-c!==0?100*c/(p-c):NaN;return '<tr><td>'+safe(name)+'</td><td>'+(p>0?num(p):"—")+'</td><td>'+fmtChange(c)+'</td><td>'+(Number.isFinite(pct)?pct.toFixed(2)+"%":"—")+'</td><td>'+safe(v?.asof?new Date(v.asof).toLocaleString():v?.fetchedAt?"Fetched "+new Date(v.fetchedAt).toLocaleString()+" (quote time not supplied)":"—")+'</td></tr>'}).join("");const html='<table><thead><tr><th>Index</th><th>Points</th><th>Change</th><th>% Chg</th><th>As of</th></tr></thead><tbody>'+rows+'</tbody></table>';$("fmp-results").innerHTML=html;$("fmp-dashboard").innerHTML=html}
const panel=document.createElement("div");panel.className="card";panel.innerHTML='<div class="row"><h2>Actual Index Levels</h2><button class="btn secondary" id="fmp-settings">Configure</button></div><p class="muted">Dow, S&P 500, Nasdaq Composite · actual index points (FMP), not ETF share prices. A source must be configured.</p><div id="fmp-dashboard"></div>';
const marketCard=$("marketOverview")?.closest(".card");if(marketCard)marketCard.insertAdjacentElement("beforebegin",panel);panel.style.display="none"; // Legacy FMP test remains in Actual Indexes tab; TradingView is the main dashboard index view.
$("fmp-settings").onclick=()=>document.querySelector('nav button[data-tab="real-indexes"]').click();
async function fetchIndexes(force){
 if(pending||document.hidden||(!force&&!marketOpen()))return;
 const key=$("fmp-key").value.trim();
 if(!key){enabled=false;return $("fmp-status").textContent="Enter FMP key for individual index quotes."}
 const interval=Number($("fmp-interval").value);
 if(Date.now()-lastQuery<20000)return $("fmp-status").textContent="Please wait before testing again.";
 if(!force&&Date.now()-lastQuery<interval)return;
 if(budget().count+3>210){enabled=false;return $("fmp-status").textContent="Conservative 210-call daily browser budget reached; auto stopped."}
 pending=true;lastQuery=Date.now();
 let hits=0,errors=[],updates={};
 try{
  for(const [symbol,label] of indexes){
   if(budget().count>=210){errors.push("Daily browser request allowance reached.");break}
   consume();
   $("fmp-status").textContent="Testing "+label+" via /stable/quote ("+budget().count+" calls today)...";
   try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
    let response;
    try{response=await fetch("https://financialmodelingprep.com/stable/quote?symbol="+encodeURIComponent(symbol)+"&apikey="+encodeURIComponent(key),{cache:"no-store",signal:ctrl.signal})}
    finally{clearTimeout(timer)}
    if(!response.ok){
     errors.push(label+": HTTP "+response.status+(response.status===402?" — plan does not include this endpoint":""));
     if([401,402,403,429].includes(response.status)){enabled=false;break}
     continue;
    }
    const body=await response.json();
    const q=Array.isArray(body)?body.find(row=>String(row.symbol||"").toUpperCase()===symbol):null;
    if(!(Number(q?.price)>0)){errors.push(label+": no usable index quote returned");continue}
    let asof=null;
    if(q.timestamp!==null&&q.timestamp!==undefined&&Number(q.timestamp)>0){
      const ts=Number(q.timestamp);asof=new Date(ts>1e11?ts:ts*1000).toISOString()
    }
    let change=q.change===null||q.change===undefined?null:Number(q.change);
    if(!Number.isFinite(change))change=null;
    updates[symbol]={price:Number(q.price),change,asof,fetchedAt:new Date().toISOString(),source:"FMP individual index quote"};hits++;
   }catch(e){errors.push(label+": "+(e?.name==="AbortError"?"timeout":String(e.message||e)))}
   if(symbol!==indexes[indexes.length-1][0])await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(hits){
   state.indexQuotes={...(state.indexQuotes||{}),...updates};
   await save();renderIndexes();
   $("fmp-status").textContent=hits+" of 3 index quotes updated; "+budget().count+" browser calls today."+(errors.length?" Issues: "+errors.join("; "):"");
  }else{
   enabled=false;
   $("fmp-status").textContent="No valid actual index quotes. "+errors.join("; ")+" Auto stopped; previously saved data untouched.";
  }
  if(errors.length)enabled=false;
 }finally{pending=false}
}
function startTimer(){if(timer)clearInterval(timer);timer=setInterval(()=>{if(enabled&&!document.hidden)void fetchIndexes(false)},15000)}
$("fmp-start").onclick=()=>{if(!$("fmp-key").value.trim())return alert("Enter FMP key.");enabled=true;startTimer();if(marketOpen())void fetchIndexes(true);else $("fmp-status").textContent="Auto enabled for regular market hours. Use Test once to check individual index access now."};
$("fmp-test").onclick=()=>void fetchIndexes(true);
$("fmp-stop").onclick=()=>{enabled=false;if(timer)clearInterval(timer);timer=null;$("fmp-status").textContent="Automatic refresh stopped."};
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&enabled)void fetchIndexes(false)});
const prior=render;render=function(){prior();renderGroups();renderIndexes()};renderGroups();renderIndexes();
})();