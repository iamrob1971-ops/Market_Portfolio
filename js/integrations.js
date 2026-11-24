(function(){
"use strict";
const E=esc,M=money,el=id=>document.getElementById(id);
let quotes=[],busy=false,stopRequested=false,lastStart=0;
function scoped(all){let aa=all?state.accounts:accounts(),hs=state.holdings.filter(h=>aa.some(a=>a.id===h.accountId));return {aa,hs,t:totals(aa)}}
const headerChoices=[]; // Actual major indexes are now sourced separately; no ETF substitutes.
function selectedHeaderSymbols(){const allowed=new Set(headerChoices.map(c=>c.symbol));return Array.isArray(state.headerWatch)?state.headerWatch.filter(s=>allowed.has(s)):headerChoices.map(c=>c.symbol)}
function portfolioSymbols(){return [...new Set(scoped(false).hs.filter(h=>h.kind!=="money"&&(!h.currency||h.currency==="USD")&&/^[A-Z][A-Z0-9.-]{0,14}$/.test(h.symbol.toUpperCase())).map(h=>h.symbol.toUpperCase()))].sort()}
function symbols(){return [...new Set([...portfolioSymbols(),...selectedHeaderSymbols()])].sort()}
function headerPanel(){
 const choices=selectedHeaderSymbols(),prices=state.headerQuotes||{},cards=headerChoices.filter(c=>choices.includes(c.symbol)).map(c=>{
  const q=prices[c.symbol],current=q&&Number(q.price)>0?M(q.price):"—",old=q&&Number(q.previousClose)>0?Number(q.previousClose):null;
  const change=old!==null?'<small class="'+(q.price>=old?"positive":"negative")+'">'+M(q.price-old)+' ('+((q.price-old)/old*100).toFixed(2)+'%)</small>':'<small class="muted">No prior-close comparison</small>';
  const asof=q?.asof?new Date(q.asof).toLocaleString():"Awaiting refresh";
  return '<div class="market"><small>'+E(c.label)+'</small><strong>'+current+'</strong>'+change+'<small>'+E(c.sub)+'</small><small>'+E(asof)+'</small></div>';
 }).join("");
 const spot=state.spotSummary||{};
 const spotDefs=[
  {id:"XAU",title:"Gold spot",unit:"USD / troy oz"},
  {id:"XAG",title:"Silver spot",unit:"USD / troy oz"},
  {id:"WTI",title:"WTI crude reference",unit:"USD / barrel"}
 ];
 const spotRows=spotDefs.map(def=>{
  const q=spot[def.id],valid=q&&Number(q.price)>0&&Number.isFinite(Date.parse(q.asof));
  const observation=valid?new Date(q.asof).toLocaleString():"Not retrieved yet";
  const hasChange=valid&&q.change!==null&&q.change!==undefined&&Number.isFinite(Number(q.change));
  const hasPct=valid&&q.changePct!==null&&q.changePct!==undefined&&Number.isFinite(Number(q.changePct));
  const change=hasChange?'<span class="'+(Number(q.change)>=0?"positive":"negative")+'">'+(Number(q.change)>=0?"+":"")+M(q.change)+'</span>':"—";
  const pct=hasPct?'<span class="'+(Number(q.changePct)>=0?"positive":"negative")+'">'+(Number(q.changePct)>=0?"+":"")+Number(q.changePct).toFixed(2)+'%</span>':"—";
  return '<tr><td>'+E(def.title)+'<small style="display:block">'+E(def.unit)+' · '+E(valid?q.description:"Source pending")+'</small></td><td>'+ (valid?M(q.price):"—") +'</td><td>'+change+'</td><td>'+pct+'</td><td>'+E(observation)+'</td></tr>';
 }).join("");
 const target=el("marketOverview");if(!target)return;
 const commodityTable='<div class="tablewrap"><table><thead><tr><th>Commodity</th><th>Price</th><th>Change</th><th>% Chg</th><th>As of</th></tr></thead><tbody>'+spotRows+'</tbody></table></div>';
 target.insertAdjacentHTML("afterbegin",commodityTable+(cards?'<div class="markets">'+cards+'</div>':""));
 const form=el("marketHeaderOptions");if(form)form.innerHTML=headerChoices.map(c=>'<label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" data-header-symbol="'+E(c.symbol)+'" '+(choices.includes(c.symbol)?"checked":"")+'><span>'+E(c.label)+' <small>('+E(c.sub)+')</small></span></label>').join("");
 const counts=el("refreshCounts");if(counts){let p=portfolioSymbols(),h=selectedHeaderSymbols(),duplicates=h.filter(x=>p.includes(x)).length;counts.textContent=p.length+" unique holdings tickers + "+h.length+" market indicator symbols − "+duplicates+" shared = "+symbols().length+" requests for the next full refresh."}
}
const nav=document.querySelector("nav"),main=document.querySelector("main");
function page(id,title,html){let b=document.createElement("button");b.dataset.tab=id;b.textContent=title;nav.append(b);let section=document.createElement("section");section.id=id;section.className="tab";section.innerHTML=html;main.append(section);b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("show",x.id===id));document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x===b))})}
page("live-prices","Price Refresh",'<div class="card"><h2>Price Refresh · Free API Test</h2><p>Fetch prices for saved US-listed ticker symbols through Finnhub. Valid quotes automatically update Holdings market estimates; broker snapshots stay unchanged. Review/apply is optional for manually managed holdings. Quotes are not guaranteed real-time or complete.</p><div class="note">Enter a free, market-data-only API token for testing. It is not saved to your portfolio or GitHub. The browser-only test sends it as a Finnhub URL parameter, so the token may appear in browser/network logs. The browser token is not secret from extensions or network diagnostics. Prefer a protected Azure Function.</div><div class="formgrid"><label>Finnhub API token (session only)<input type="password" id="fh-key" autocomplete="off" placeholder="Paste your free API key"></label><label>Refresh mode<select id="fh-max"><option value="all" selected>All eligible tickers (recommended)</option><option value="10">First 10 (test)</option></select></label></div><div class="actions"><button class="btn" id="fh-refresh">Refresh All — Preview Quotes</button><button class="btn secondary" id="fh-stop" disabled>Stop refresh</button><button class="btn secondary" id="fh-clear">Clear API key</button><button class="btn secondary" id="fh-copy">Copy tickers</button></div><p id="fh-status" role="status" class="muted">Not connected.</p><small>All selected-owner eligible symbols are requested once, at most 40 starts per minute (1.5 seconds apart). Rate-limit responses cause a cooldown. Existing prices are never overwritten unless you approve the preview. Azure will replace the browser-key test later.</small></div><div class="card"><div class="row"><h2>Review Quotes</h2><button class="btn" id="fh-apply" disabled>Apply to manual holdings</button></div><div id="fh-table" class="empty">Fetch quotes to preview them.</div></div><div class="card"><h2>Quote Coverage</h2><div id="fh-coverage"></div></div>');
page("ai-insights","AI Insights",'<div class="card"><h2>Portfolio Q&A</h2><p>Local calculations answer supported questions directly from your account records. No AI key is needed and nothing is sent to Gemini.</p><div class="formgrid"><label>Scope<select id="ai-scope"><option value="current">Selected owner view</option><option value="all">All owners including managed</option></select></label><label>Question<input id="ai-question" placeholder="What is my estimated dividend income?"></label></div><div class="actions"><button class="btn" id="ai-answer">Answer locally</button><button class="btn secondary" data-ai-q="portfolio">Portfolio overview</button><button class="btn secondary" data-ai-q="dividends">Dividends</button><button class="btn secondary" data-ai-q="energy">Energy / shipping baskets</button><button class="btn secondary" data-ai-q="pnl">Unrealized P&L</button></div><div id="ai-local" class="note">Choose a question or enter your own.</div></div><div class="card"><h2>Gemini Analysis · Review Before Sharing</h2><p>Prepare a grounded prompt using exact figures calculated by the app. Copy to Gemini and review the response. Gemini should explain—not independently invent—account figures.</p><label><input type="checkbox" id="ai-detail" style="width:auto"> Include individual positions, quantities, cost basis and account labels in the prompt</label><div class="actions"><button class="btn" id="ai-prepare">Prepare prompt</button><button class="btn secondary" id="ai-copy">Copy prompt</button></div><label>Review the data you will share<textarea id="ai-prompt" rows="10" readonly></textarea></label><p class="muted">No portfolio data is transmitted automatically. Copy/pasting is explicit; avoid sharing family details you do not want sent to another service.</p><a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">Open Google AI Studio</a></div><div class="card"><h2>Future in-app Gemini calls</h2><p>Secure Gemini requests will use Azure Functions and Entra authentication. No Gemini secret belongs in this public HTML app.</p></div>');
const headerSettings=document.createElement("div");
headerSettings.className="card";
headerSettings.innerHTML='<h2>Market Overview Header</h2><p>Select which market references to show at the top of the dashboard. These are ETF share prices—not direct index levels, metal spot prices, oil/barrel or Treasury yields.</p><div id="marketHeaderOptions" class="grid"></div><p class="muted" id="refreshCounts"></p><small>The Finnhub indicators are ETF proxies; gold and silver use separate spot feeds, and WTI uses a labeled oil reference. These other providers do not count toward Finnhub requests. Quotes are locally saved; Finnhub prices are applied only after review.</small>';
el("live-prices").append(headerSettings);
headerSettings.style.display="none"; // Hide retired ETF benchmark selection controls.
headerSettings.addEventListener("change",async event=>{
 const input=event.target.closest("[data-header-symbol]");
 if(!input)return;
 const chosen=new Set(selectedHeaderSymbols());
 if(input.checked)chosen.add(input.dataset.headerSymbol);else chosen.delete(input.dataset.headerSymbol);
 state.headerWatch=headerChoices.map(c=>c.symbol).filter(s=>chosen.has(s));
 await save();
});
let spotRunning=false;const spotLastById={};
const spotStatus=document.createElement("p");spotStatus.id="spot-refresh-status";spotStatus.className="muted";
const spotButton=document.createElement("button");spotButton.className="btn secondary";spotButton.textContent="Refresh Gold, Silver & WTI";spotButton.id="refresh-spot";
const headerActions=el("fh-refresh").parentElement;headerActions.append(spotButton);
headerActions.append(spotStatus);
async function fetchSpot(onlyId){
 if(spotRunning)return {error:"Market sources are refreshing."};
 const ids=onlyId?[onlyId]:["XAU","XAG","WTI"];
 if(ids.some(id=>!["XAU","XAG","WTI"].includes(id)))return {error:"Unknown commodity"};
 const now=Date.now(),blocked=ids.filter(id=>now-(spotLastById[id]||0)<60000);
 if(blocked.length){const seconds=Math.ceil(Math.max(...blocked.map(id=>60000-(now-(spotLastById[id]||0))))/1000);return {error:"Please retry "+blocked.join(", ")+" in "+seconds+" seconds."}}
 spotRunning=true;ids.forEach(id=>spotLastById[id]=now);spotButton.disabled=true;
 let successes=0,errors=[];
 try{
  for(const [id,api] of [["XAU","https://api.gold-api.com/price/XAU"],["XAG","https://api.gold-api.com/price/XAG"]]){
   if(onlyId&&onlyId!==id)continue;
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    let res;try{res=await fetch(api,{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}
    if(!res.ok)throw Error("HTTP "+res.status);
    const q=await res.json();
    const price=Number(q.price),asof=q.updatedAt;
    if(!(price>0)||!Number.isFinite(Date.parse(asof))||q.symbol!==id||q.currency!=="USD")throw Error("Invalid spot quote or timestamp");
    if(!state.spotSummary||typeof state.spotSummary!=="object")state.spotSummary={};
    state.spotSummary[id]={price,asof,source:"Gold-API",description:"Spot ("+id+"/USD) · Gold-API",change:null,changePct:null};
    successes++;
   }catch(e){errors.push(id+": "+String(e.message||e))}
  }
  if(!onlyId||onlyId==="WTI")try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   let res;try{res=await fetch("https://americasoilwatch.com/api/v1/wti",{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}
   if(!res.ok)throw Error("HTTP "+res.status);
   const q=await res.json(),price=Number(q.priceUsd);
   const asof=q.observedAt||q.sessionDate;
   if(!(price>0)||!Number.isFinite(Date.parse(asof)))throw Error("Invalid oil price or observation date");
   // A WTI front-month futures reference is NOT a physical spot assessment.
   const futures=/futures|yahoo|CL[FGHJKMNQUVXZ]\d/i.test(String(q.provider||"")+" "+String(q.dataSource||"")+" "+String(q.contract||""));
   const label=futures?"WTI front-month futures":"WTI reference / reported spot fallback";
   const pct=Number(q.changePct),delta=Number(q.changeUsd);
   if(!state.spotSummary||typeof state.spotSummary!=="object")state.spotSummary={};
   state.spotSummary.WTI={price,asof,source:"AmericasOilWatch",description:label+" · "+(q.provider||"AmericasOilWatch"),change:q.changeUsd!=null&&Number.isFinite(delta)?delta:null,changePct:q.changePct!=null&&Number.isFinite(pct)?pct:null,changeAgainst:q.changeAgainst||null,quoteType:q.quoteType||null};
   successes++;
  }catch(e){errors.push("WTI: "+String(e.message||e))}
  if(successes){await save()}
  spotStatus.textContent=successes+" of "+ids.length+" non-Finnhub market quotes updated."+(errors.length?" Unavailable: "+errors.join("; "):"")+" Finnhub request count unchanged.";
  return successes?{ok:true}:{error:"No usable market quote: "+errors.join("; ")};
 }finally{spotRunning=false;spotButton.disabled=false}
}
spotButton.onclick=()=>void fetchSpot();
window.marketSpotRefresh=id=>fetchSpot(id);

const status=s=>el("fh-status").textContent=s;
async function clipboard(t){try{await navigator.clipboard.writeText(t);toast("Copied to clipboard")}catch(e){alert("Clipboard permission unavailable; use HTTPS.")}}
el("fh-copy").onclick=()=>clipboard(symbols().join(", "));
el("fh-clear").onclick=()=>{el("fh-key").value="";status("Session key cleared.")};

const diagnosticButton=document.createElement("button");
diagnosticButton.className="btn secondary";diagnosticButton.id="fh-test-one";diagnosticButton.textContent="Test AAPL connection";
el("fh-refresh").parentElement.append(diagnosticButton);
diagnosticButton.onclick=async()=>{
 const key=el("fh-key").value.trim();if(!key)return alert("Enter the Finnhub API token first.");
 diagnosticButton.disabled=true;status("Testing one AAPL quote against api.finnhub.io...");
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  let res;try{res=await fetch("https://api.finnhub.io/api/v1/quote?symbol=AAPL&token="+encodeURIComponent(key),{method:"GET",cache:"no-store",signal:ctrl.signal})}finally{clearTimeout(timer)}
  if(!res.ok){let text=await res.text().catch(()=>"");status("API reachable. HTTP "+res.status+(res.status===401?" — key invalid":res.status===403?" — key or entitlement denied":res.status===429?" — request limit exceeded":" — provider rejected request")+". "+text.slice(0,150).replace(/[^\x20-\x7e]/g," "));return}
  const j=await res.json();
  if(Number(j.c)>0&&Number(j.t)>0){status("API reachable. AAPL quote returned: "+money(j.c)+" as of "+new Date(j.t*1000).toLocaleString()+". Now try Fetch quote preview.")}
  else status("API reachable (HTTP 200), but AAPL returned no usable quote. Check Finnhub entitlement/status.");
 }catch(e){let isAbort=e?.name==="AbortError";status(isAbort?"AAPL connection timed out.": "Browser could not contact api.finnhub.io. Check site blockers, extensions, security software, network restrictions or browser console CORS errors.");}
 finally{diagnosticButton.disabled=false}
};

const requestGapMs=1500;
// Independent market quote cache; SnapTrade quantity, price, equity and basis are immutable here.
let singleRefreshing=false;
function storeMarketQuote(symbol,q){
 if(!state.marketQuotes||typeof state.marketQuotes!=="object")state.marketQuotes={};
 const age=Date.now()-Date.parse(q.asof);
 if(!(Number(q.price)>0)||!Number.isFinite(age)||age< -300000||age>24*3600000)return false;
 const previous=state.marketQuotes[symbol];
 if(previous?.asof&&Date.parse(previous.asof)>Date.parse(q.asof))return false;
 state.marketQuotes[symbol]={price:Number(q.price),previousClose:Number(q.previousClose)>0?Number(q.previousClose):null,asof:q.asof,source:"Finnhub REST /quote",fetchedAt:new Date().toISOString()};
 return true;
}
async function refreshTicker(symbol){
 symbol=String(symbol||"").trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))return;
 if(singleRefreshing||busy){toast("Another quote refresh is in progress.");return}
 const key=el("fh-key")?.value.trim();
 if(!key){toast("Enter your Finnhub API key in Price Refresh first.");return}
 const buttons=[...document.querySelectorAll("[data-refresh-ticker]")].filter(b=>b.dataset.refreshTicker===symbol);
 singleRefreshing=true;buttons.forEach(b=>b.disabled=true);
 try{
  const wait=Math.max(0,1500-(Date.now()-lastStart));if(wait)await delay(wait);
  lastStart=Date.now();
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
  let response;
  try{response=await fetch("https://api.finnhub.io/api/v1/quote?symbol="+encodeURIComponent(symbol)+"&token="+encodeURIComponent(key),{cache:"no-store",signal:ctrl.signal})}
  finally{clearTimeout(timeout)}
  if(!response.ok)throw Error("Finnhub HTTP "+response.status+(response.status===429?" (rate limited)":""));
  const data=await response.json();
  if(!(Number(data.c)>0)||!(Number(data.t)>0))throw Error("No usable Finnhub quote for "+symbol);
  const asof=new Date(Number(data.t)*1000).toISOString(),age=Date.now()-Date.parse(asof);
  if(age>24*3600000||age< -300000)throw Error("Returned quote is stale or future-dated: "+asof);
  if(!storeMarketQuote(symbol,{price:Number(data.c),previousClose:data.pc,asof})){toast(symbol+": saved quote is already newer.");return}
  await save();
  toast(symbol+" updated: "+money(data.c)+" · "+new Date(asof).toLocaleTimeString());
  document.dispatchEvent(new CustomEvent("market-quote-updated",{detail:{symbol}}));
 }catch(error){toast(symbol+": "+String(error.message||error))}
 finally{singleRefreshing=false;buttons.forEach(b=>b.disabled=false)}
}
window.marketQuoteRefresh=refreshTicker;
document.addEventListener("click",e=>{const b=e.target.closest("[data-refresh-ticker]");if(b){e.preventDefault();void refreshTicker(b.dataset.refreshTicker)}});

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const textStatus=(completed,total,good,failed,detail)=>status(completed+" of "+total+" tickers checked · "+good+" prices · "+failed+" unavailable"+(detail?" · "+detail:""));
el("fh-stop").onclick=()=>{stopRequested=true;status("Stop requested. Completing the active request, then displaying retrieved quotes.")};
const changeText=q=>q.ok&&Number.isFinite(q.previousClose)&&q.previousClose>0?M(q.price-q.previousClose)+" ("+((q.price-q.previousClose)/q.previousClose*100).toFixed(2)+"%)":"—";
function showQuotePreview(){
 let good=quotes.filter(q=>q.ok).length,bad=quotes.length-good;
 el("fh-table").className="tablewrap";
 el("fh-table").innerHTML='<table><thead><tr><th>Use</th><th>Symbol</th><th>Current / last</th><th>Previous close</th><th>Change</th><th>Quote timestamp</th><th>Status</th></tr></thead><tbody>'+quotes.map(q=>'<tr><td>'+(q.ok?'<input style="width:auto" type="checkbox" data-sym="'+E(q.symbol)+'" checked>':'—')+'</td><td>'+E(q.symbol)+'</td><td>'+(q.ok?M(q.price):'—')+'</td><td>'+(q.ok&&q.previousClose>0?M(q.previousClose):'—')+'</td><td>'+changeText(q)+'</td><td>'+E(q.asof||'—')+'</td><td>'+E(q.error||(q.ageHours>24?"Possibly stale — inspect":"Review"))+'</td></tr>').join("")+'</tbody></table>';
 el("fh-apply").disabled=!good;
 textStatus(quotes.length,refreshTargetCount,good,bad,stopRequested?"Stopped early; available results shown":"Review retrieved prices before applying");
}
let refreshTargetCount=0;
el("fh-refresh").onclick=async()=>{
 if(busy)return;
 const key=el("fh-key").value.trim(),max=el("fh-max").value;
 const ss=max==="all"?symbols():symbols().slice(0,Number(max));
 if(!key)return alert("Enter your Finnhub token first.");
 if(!ss.length)return alert("No eligible USD stock / ETF tickers in the selected owner view.");
 busy=true;stopRequested=false;refreshTargetCount=ss.length;quotes=[];
 void fetchSpot();
 el("fh-refresh").disabled=true;el("fh-stop").disabled=false;el("fh-apply").disabled=true;
 try{
  for(let i=0;i<ss.length;i++){
   if(stopRequested)break;
   let symbol=ss[i],complete=false;
   for(let attempt=0;attempt<2&&!complete;attempt++){
    if(stopRequested)break;
    const elapsed=Date.now()-lastStart;
    if(lastStart&&elapsed<requestGapMs){textStatus(i,ss.length,quotes.filter(q=>q.ok).length,quotes.filter(q=>!q.ok).length,"Waiting for request spacing");await delay(requestGapMs-elapsed)}
    if(stopRequested)break;
    lastStart=Date.now();
    textStatus(i,ss.length,quotes.filter(q=>q.ok).length,quotes.filter(q=>!q.ok).length,"Requesting "+symbol);
    try{
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
     let response;
     try{
      response=await fetch("https://api.finnhub.io/api/v1/quote?symbol="+encodeURIComponent(symbol)+"&token="+encodeURIComponent(key),{method:"GET",cache:"no-store",signal:controller.signal});
     }finally{clearTimeout(timer)}
     if(response.status===429){
      if(attempt===0){
       const retryAfter=response.headers.get("Retry-After");
       const parsed=retryAfter&&/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:65000;
       const wait=Math.max(65000,Math.min(parsed,180000));
       status("Finnhub rate limit (429). Pausing "+Math.ceil(wait/1000)+" seconds; will retry "+symbol+" once. You may stop.");
       // Stop button remains available during this cooldown.
       const until=Date.now()+wait;
       while(Date.now()<until&&!stopRequested)await delay(Math.min(1000,until-Date.now()));
       continue;
      }
      quotes.push({symbol,ok:false,error:"Rate-limited twice (HTTP 429); remaining symbols skipped"});
      stopRequested=true;complete=true;break;
     }
     if(response.status===401||response.status===403){
      quotes.push({symbol,ok:false,error:"API authorization denied (HTTP "+response.status+"); stopped"});
      stopRequested=true;complete=true;break;
     }
     if(!response.ok)throw Error("HTTP "+response.status);
     const j=await response.json(),price=Number(j.c),ts=Number(j.t);
     if(!(price>0)||!(ts>0))throw Error("No valid quote / symbol not covered");
     quotes.push({symbol,price,previousClose:Number(j.pc)>0?Number(j.pc):null,asof:new Date(ts*1000).toISOString(),source:"Finnhub",ok:true,ageHours:(Date.now()-ts*1000)/3600000});
     complete=true;
    }catch(e){
     const message=e?.name==="AbortError"?"Request timed out":(e instanceof TypeError?"Browser/network request blocked":String(e.message||e));
     quotes.push({symbol,ok:false,error:message});complete=true;
    }
   }
   textStatus(quotes.length,ss.length,quotes.filter(q=>q.ok).length,quotes.filter(q=>!q.ok).length,"Last processed: "+symbol);
  }
 }finally{
  busy=false;el("fh-refresh").disabled=false;el("fh-stop").disabled=true;
  // Apply full-refresh quotes to the independent estimate layer automatically.
  const accepted=quotes.filter(q=>q.ok&&storeMarketQuote(q.symbol,q)).length;
  let saved=false,saveError="";
  if(accepted){try{await save();saved=true;document.dispatchEvent(new CustomEvent("market-quote-updated",{detail:{fullRefresh:true}}))}catch(err){saveError=String(err.message||err)}}
  showQuotePreview();
  if(saved)status(accepted+" market quotes saved automatically; Holdings and estimated totals updated. Broker snapshot unchanged.");
  else if(saveError)status("Quotes returned, but saving failed: "+saveError);
 }
};
el("fh-apply").onclick=async()=>{
 const selected=quotes.filter(q=>q.ok&&[...document.querySelectorAll("#fh-table [data-sym]")].some(e=>e.dataset.sym===q.symbol&&e.checked));
 if(!selected.length)return alert("Select a quote to apply.");
 if(!confirm("Apply "+selected.length+" Finnhub prices to eligible manually managed holdings? Market estimates have already been updated from fetched quotes. Connected SnapTrade broker prices remain unchanged."))return;
 let changed=0;
 for(let q of selected){
  storeMarketQuote(q.symbol,q);
  if(selectedHeaderSymbols().includes(q.symbol)){
   if(!state.headerQuotes||typeof state.headerQuotes!=="object")state.headerQuotes={};
   state.headerQuotes[q.symbol]={price:q.price,previousClose:q.previousClose??null,asof:q.asof,source:q.source};
  }
  for(let h of state.holdings.filter(h=>h.symbol.toUpperCase()===q.symbol&&h.kind!=="money"&&(!h.currency||h.currency==="USD"))){
   if(h.source==="snaptrade"||state.accounts.some(a=>a.id===h.accountId&&a.connected?.provider==="snaptrade")){
    // Preserve broker prices/equity. Separate marketQuotes drives estimates.
    if(q.previousClose>0){h.previousClose=q.previousClose;h.previousCloseAsOf=q.asof;h.previousCloseSource=q.source;changed++}
    continue;
   }
   h.price=q.price;h.marketValue=null;h.previousClose=q.previousClose>0?q.previousClose:null;h.previousCloseAsOf=q.asof;h.previousCloseSource=q.source;h.quoteSource=q.source;h.quoteAsOf=q.asof;changed++
  }
  state.quoteHistory.push({id:uid(),symbol:q.symbol,price:q.price,previousClose:q.previousClose??null,asof:q.asof,currency:"USD",source:q.source,importedAt:new Date().toISOString()});
 }
 await save();quotes=[];el("fh-apply").disabled=true;el("fh-table").innerHTML='<div class="empty">Quotes applied. Fetch again to refresh.</div>';toast(changed+" positions updated");
};
const qchoices={portfolio:"Summarize my portfolio",dividends:"How much estimated dividend income is recorded?",energy:"Show the holdings in my energy and shipping baskets",pnl:"What is my unrealized P&L?"};
document.querySelectorAll("[data-ai-q]").forEach(b=>b.onclick=()=>{el("ai-question").value=qchoices[b.dataset.aiQ];answer()});
el("ai-answer").onclick=answer;
function analysis(){let d=scoped(el("ai-scope").value==="all");return {...d,perAccount:d.aa.map(a=>({name:label(a),owner:state.owners.find(o=>o.id===a.ownerId)?.name||"",value:totals([a]).total,income:totals([a]).income}))}}
function answer(){
 const q=el("ai-question").value.toLowerCase().trim(),d=analysis();if(!q){el("ai-local").textContent="Enter a question.";return}const broker=["fidelity","schwab","ibkr","interactive brokers","merrill"].find(b=>q.includes(b));if(broker){d.aa=d.aa.filter(a=>a.broker.toLowerCase().includes(broker==="interactive brokers"?"ibkr":broker));d.hs=d.hs.filter(h=>d.aa.some(a=>a.id===h.accountId));d.t=totals(d.aa);d.perAccount=d.perAccount.filter(x=>d.aa.some(a=>label(a)===x.name));if(!d.aa.length){el("ai-local").textContent="No matching brokerage accounts in the selected owner scope.";return}}
 let html;
 if(/dividend|distribution|income/.test(q)){html='<strong>Estimated annual income: '+M(d.t.income)+'</strong><p>Monthly equivalent: '+M(d.t.income/12)+'. Only saved dividend profiles are included; missing profiles do not imply a security pays nothing.</p>'+table(["Account","Annual estimate"],d.perAccount.map(a=>'<tr>'+td(E(a.name))+td(M(a.income))+'</tr>'))}
 else if(/basket|oil|energy|shipping/.test(q)){
  let bs=state.baskets.filter(b=>/oil|energy|shipping|bulk/i.test(b.name)),matching=d.hs.filter(h=>bs.some(b=>b.id===h.basketId));
  html='<strong>'+matching.length+' rows in matching named baskets, valued at '+M(matching.reduce((v,h)=>v+value(h),0))+'</strong><p>Baskets reflect your assigned labels, not verified industry classifications.</p>'+table(["Basket","Account","Ticker","Value"],matching.map(h=>'<tr>'+td(E(state.baskets.find(b=>b.id===h.basketId)?.name||""))+td(E(label(d.aa.find(a=>a.id===h.accountId))))+td(E(h.symbol))+td(M(value(h)))+'</tr>'))}
 else if(/p&l|gain|loss|profit|performance|return/.test(q)){html='<strong>Recorded unrealized P&L: '+M(d.t.pnl)+'</strong><p>This is not a tax-lot report or cash-flow-adjusted return. It excludes realized gains, expenses and unrecorded transactions.</p>'}
 else if(/portfolio|account|overview|summary|total|value|balance|holdings/.test(q)){html='<strong>Portfolio value: '+M(d.t.total)+'</strong><p>'+d.aa.length+' accounts and '+d.hs.length+' holdings rows. Cash: '+M(d.t.cash)+'; money market positions: '+M(d.t.moneyFund)+'; imported pending adjustment: '+M(d.t.pending)+'.</p>'+table(["Account","Value","Annual dividend estimate"],d.perAccount.map(a=>'<tr>'+td(E(a.name))+td(M(a.value))+td(M(a.income))+'</tr>'))}
 else {html="This question is not supported by local calculations yet. Try portfolio overview, dividends, baskets, or unrealized P&L. For a wider analysis, prepare a Gemini prompt or use the Azure gateway."}
 el("ai-local").innerHTML=html+'<p class="muted">Scope: '+E(el("ai-scope").value==="all"?"All owners":"Selected view")+'. Values come from local saved records, not independently verified prices.</p>';
}
el("ai-prepare").onclick=()=>{
 let d=analysis(),facts={preparedAt:new Date().toISOString(),scope:el("ai-scope").value,accountCount:d.aa.length,positionCount:d.hs.length,totalValue:d.t.total,securitiesValue:d.t.sec,cashValue:d.t.cash,moneyMarketValue:d.t.moneyFund,pendingAdjustments:d.t.pending,unrealizedPnL:d.t.pnl,estimatedAnnualDividends:d.t.income,accounts:d.perAccount,baskets:state.baskets.map(b=>({name:b.name,value:d.hs.filter(h=>h.basketId===b.id).reduce((v,h)=>v+value(h),0)}))};
 if(el("ai-detail").checked)facts.positions=d.hs.map(h=>({account:label(d.aa.find(a=>a.id===h.accountId)),ticker:h.symbol,shares:h.quantity,marketPrice:h.price,marketValue:value(h),costBasis:h.basis,quoteAsOf:h.quoteAsOf||"unknown",quoteSource:h.quoteSource||"manual/import"}));
 el("ai-prompt").value="Analyze the following portfolio facts from my local tracking app. They are the ONLY authoritative data for account totals, holdings, dividends and P&L. Do not invent market prices, payments, forecasts, or trades. Identify missing or stale information and separate analysis from fact. Do not recommend trades unless asked.\\n\\nQuestion: "+(el("ai-question").value.trim()||"Explain this portfolio and its key risks.")+"\\n\\nPortfolio facts:\\n"+JSON.stringify(facts,null,2);toast("Review prompt before copying");
};
el("ai-copy").onclick=()=>el("ai-prompt").value?clipboard(el("ai-prompt").value):alert("Prepare a prompt first.");
function coverage(){let hh=scoped(false).hs,known=hh.filter(h=>Number(h.price)>0).length;el("fh-coverage").innerHTML="<p>"+hh.length+" rows; "+known+" have recorded prices; "+symbols().length+" unique eligible USD symbols. Securities with non-USD currency or money-market status are excluded.</p>"+table(["Ticker","Last recorded source","As of"],hh.filter(h=>h.quoteAsOf).slice(0,25).map(h=>'<tr>'+td(E(h.symbol))+td(E(h.quoteSource||"—"))+td(E(h.quoteAsOf))+'</tr>'))}

/* Optional Azure transport. Server credentials never reach this app. */
const gatewayCard=document.createElement("div");gatewayCard.className="card";
gatewayCard.innerHTML='<h2>Secure Azure Connection (optional)</h2><p>Use once the Azure gateway and Entra sign-in are configured. Until then, Finnhub manual refresh and the local Gemini prompt work independently.</p><label>Azure Function origin (HTTPS)<input type="url" id="gateway-url" placeholder="https://example.azurewebsites.net" autocomplete="off"></label><div class="actions"><button class="btn secondary" id="gateway-test">Test Azure connection</button><button class="btn secondary" id="gateway-fetch">Fetch quotes through Azure</button><button class="btn secondary" id="gateway-login">Open Azure sign-in</button></div><div id="gateway-result" class="muted" role="status">Not configured.</div>';
el("live-prices").append(gatewayCard);
const geminiCard=document.createElement("div");geminiCard.className="card";
geminiCard.innerHTML='<h2>Ask Gemini securely via Azure</h2><p>This requires the configured Azure Function, Entra authentication, and a Gemini API key stored only in Azure. Your question and the selected summarized portfolio facts will be sent to your Azure gateway and Google Gemini.</p><button class="btn" id="gateway-ask">Ask Gemini from current facts</button><div id="gateway-answer" style="white-space:pre-wrap;margin-top:14px" class="note">No Azure response yet.</div>';
el("ai-insights").append(geminiCard);
function gatewayBase(){let b=el("gateway-url").value.trim().replace(/\/+$/,"");if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(b))throw Error("Enter the HTTPS Azure Function origin in Price Refresh.");return b}
async function gatewayRequest(path,body){
 const base=gatewayBase();let options={method:body?"POST":"GET",credentials:"include",headers:{"Accept":"application/json"}};
 if(body){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body)}
 const response=await fetch(base+"/api/"+path,options);
 if(!response.ok){let detail="";try{detail=(await response.json()).error||""}catch(e){}throw Error("Azure HTTP "+response.status+(detail?": "+detail:"")+". Check Entra sign-in and CORS.")}
 return await response.json();
}
el("gateway-test").onclick=async()=>{try{let s=await gatewayRequest("status");el("gateway-result").textContent="Gateway ready; Finnhub="+s.quotes+"; Gemini="+s.gemini}catch(e){el("gateway-result").textContent=e.message}};
el("gateway-login").onclick=()=>{try{window.open(gatewayBase()+"/.auth/login/aad","_blank","noopener,noreferrer")}catch(e){alert(e.message)}};
el("gateway-fetch").onclick=async()=>{
 let ss=symbols().slice(0,20);if(!ss.length)return alert("No eligible tickers.");el("gateway-result").textContent="Fetching up to 20 symbols via Azure...";
 try{
  let result=await gatewayRequest("quotes",{symbols:ss});quotes=ss.map(symbol=>{let q=result.quotes?.find(z=>z.symbol===symbol);if(q&&Number(q.price)>0&&q.currency==="USD"&&Number.isFinite(Date.parse(q.asof))){return {symbol,price:Number(q.price),previousClose:Number(q.previousClose)>0?Number(q.previousClose):null,asof:q.asof,source:q.source||"Azure Finnhub",ok:true,ageHours:(Date.now()-Date.parse(q.asof))/3600000}}return {symbol,ok:false,error:q?.error||"No quote"}});
  const good=quotes.filter(q=>q.ok).length;
  el("fh-table").className="tablewrap";
  el("fh-table").innerHTML='<table><thead><tr><th>Use</th><th>Symbol</th><th>Current / last</th><th>Previous close</th><th>Change</th><th>Timestamp</th><th>Status</th></tr></thead><tbody>'+quotes.map(q=>'<tr><td>'+(q.ok?'<input style="width:auto" type="checkbox" data-sym="'+E(q.symbol)+'" checked>':'—')+'</td><td>'+E(q.symbol)+'</td><td>'+(q.ok?M(q.price):'—')+'</td><td>'+(q.ok&&q.previousClose>0?M(q.previousClose):'—')+'</td><td>'+changeText(q)+'</td><td>'+E(q.asof||'—')+'</td><td>'+E(q.error||(q.ageHours>24?"Possibly stale":"Review"))+'</td></tr>').join("")+'</tbody></table>';
  el("fh-apply").disabled=!good;el("gateway-result").textContent=good+" / "+ss.length+" valid quotes; review before applying";
 }catch(e){el("gateway-result").textContent=e.message}
};
el("gateway-ask").onclick=async()=>{
 const d=analysis(),q=el("ai-question").value.trim()||"Explain the portfolio summary and its major limitations.";
 let facts={scope:el("ai-scope").value,totalValue:d.t.total,cash:d.t.cash,moneyMarkets:d.t.moneyFund,unrealizedPnL:d.t.pnl,estimatedAnnualDividends:d.t.income,pendingAdjustments:d.t.pending,accountCount:d.aa.length,positionCount:d.hs.length,accounts:d.perAccount,baskets:state.baskets.map(b=>({name:b.name,value:d.hs.filter(h=>h.basketId===b.id).reduce((v,h)=>v+value(h),0)}))};
 if(el("ai-detail").checked)facts.positions=d.hs.map(h=>({account:label(d.aa.find(a=>a.id===h.accountId)),symbol:h.symbol,shares:h.quantity,price:h.price,basis:h.basis,marketValue:value(h),quoteSource:h.quoteSource||"manual/import",quoteAsOf:h.quoteAsOf||"unknown"}));
 if(!confirm("Send your selected portfolio facts ("+(el("ai-detail").checked?"including position details":"summary only")+") to Gemini through Azure?"))return;
 el("gateway-answer").textContent="Contacting Azure Gemini gateway...";
 try{let answer=await gatewayRequest("ask",{question:q,facts});el("gateway-answer").textContent=answer.answer||"No answer returned"}catch(e){el("gateway-answer").textContent=e.message}
};

const original=render;render=function(){original();coverage();headerPanel()};
coverage();headerPanel();
})();
(function(){
"use strict";
// Opens an authenticated SAME-ORIGIN Azure-hosted preview. No SnapTrade credentials
// or brokerage positions are embedded in public GitHub Pages JavaScript.
const nav=document.querySelector("nav"),main=document.querySelector("main");
if(!nav||!main)return;
const tab=document.createElement("button");
tab.textContent="Fidelity Connected";
tab.dataset.tab="fidelity-connected";
const section=document.createElement("section");
section.id="fidelity-connected";section.className="tab";
section.innerHTML='<div class="card"><div class="row"><h2>Fidelity · SnapTrade Connected</h2><small>Protected by Microsoft Entra ID · read-only</small></div><p>Refresh the five Fidelity accounts directly into Market Portfolio. Synced brokerage values are replaced (not duplicated), and SPAXX/FDRXX cash equivalents are counted once.</p><div class="actions"><button class="btn" type="button" id="fidelity-sync-open">Refresh Fidelity</button><button class="btn secondary" type="button" id="fidelity-login">Sign in / reconnect Microsoft</button><button class="btn secondary" type="button" id="fidelity-diagnostic">Open secure diagnostic viewer</button></div><p class="muted" id="fidelity-sync-status" role="status">Ready to request the next Fidelity snapshot.</p><div id="fidelity-sync-details" class="muted"></div><details style="margin-top:16px"><summary>Fallback: manually transfer a Fidelity snapshot</summary><p>Only if the browser blocks direct credentialed requests: use <strong>Copy for dashboard</strong> from the authenticated diagnostic viewer, then paste here. Approve the account list before replacement. The JSON contains private account information.</p><label for="fidelity-sync-paste">Secure snapshot</label><textarea id="fidelity-sync-paste" rows="3" placeholder="Paste Fidelity snapshot"></textarea><div class="actions"><button type="button" class="btn secondary" id="fidelity-sync-paste-apply">Review snapshot</button></div></details></div>';
nav.append(tab);main.append(section);
tab.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(s=>s.classList.toggle("show",s===section));
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b===tab));
});
})();
