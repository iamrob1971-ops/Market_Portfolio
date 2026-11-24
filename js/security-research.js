(function(){
"use strict";
const panel=document.getElementById("dashboardResearchPanel");
const toggle=document.getElementById("dashboardResearchToggle");
if(!panel||!toggle)return;
const E=v=>esc(String(v??"")),val=n=>Number.isFinite(Number(n))&&n!==null&&n!==""?Number(n):null;
let busy=false,lastCall=0;
const header='<div class="row"><h2 style="margin:0">Security lookup</h2><button type="button" class="btn secondary" id="researchClose">Close ×</button></div>'+
 '<p class="muted">Search stocks and ETFs beyond your holdings using your existing Finnhub token. Data availability and quote freshness vary.</p>'+
 '<form id="researchForm" class="research-actions"><input id="researchTerm" type="search" placeholder="Ticker or company name, e.g. NVDA or Microsoft" required autocomplete="off"><button class="btn" type="submit">Search</button></form>'+
 '<div id="researchStatus" role="status" class="muted" style="margin-top:9px"></div><div id="researchResults" class="research-results"></div><div id="researchDetails"></div>';
function key(){return document.getElementById("fh-key")?.value.trim()||""}
function status(t){const el=document.getElementById("researchStatus");if(el)el.textContent=t}
function toggleOpen(open){panel.classList.toggle("hidden",!open);toggle.setAttribute("aria-expanded",String(open));if(open&&!panel.innerHTML){panel.innerHTML=header;document.getElementById("researchTerm").focus()}}
toggle.onclick=()=>toggleOpen(panel.classList.contains("hidden"));
panel.addEventListener("click",e=>{
 if(e.target.closest("#researchClose")){toggleOpen(false);return}
 const btn=e.target.closest("[data-research-symbol]");
 if(btn)void loadDetails(btn.dataset.researchSymbol);
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(endpoint,params={}){
 if(!key())throw Error("Enter your Finnhub API key in Price Refresh first.");
 const delay=Math.max(0,1500-(Date.now()-lastCall));if(delay)await pause(delay);
 lastCall=Date.now();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const query=new URLSearchParams({...params,token:key()});
  const response=await fetch("https://finnhub.io/api/v1/"+endpoint+"?"+query.toString(),{method:"GET",cache:"no-store",signal:controller.signal});
  if(!response.ok)throw Error("Finnhub HTTP "+response.status+(response.status===429?" — request limit reached":""));
  return await response.json();
 }finally{clearTimeout(timer)}
}
panel.addEventListener("submit",async e=>{
 if(e.target.id!=="researchForm")return;e.preventDefault();
 if(busy)return;
 const q=document.getElementById("researchTerm").value.trim();
 if(!q)return;
 busy=true;status("Searching…");document.getElementById("researchResults").innerHTML="";document.getElementById("researchDetails").innerHTML="";
 try{
  const result=await api("search",{q}),items=Array.isArray(result.result)?result.result:[];
  const clean=items.filter(x=>/^[A-Z][A-Z0-9.-]{0,14}$/i.test(String(x.symbol||""))).slice(0,12);
  document.getElementById("researchResults").innerHTML=clean.map(item=>'<button type="button" class="research-result" data-research-symbol="'+E(item.symbol)+'"><strong>'+E(item.displaySymbol||item.symbol)+'</strong><small style="display:block">'+E(item.description||"")+'</small></button>').join("");
  status(clean.length?clean.length+" matching securities. Select one to load its details.":"No covered symbols found.");
  if(clean.length===1&&String(clean[0].symbol).toUpperCase()===q.toUpperCase())void loadDetails(clean[0].symbol);
 }catch(err){status("Search unavailable: "+String(err.message||err))}
 finally{busy=false}
});
const moneyVal=(v,unit="USD")=>v===null?"Unavailable":(unit==="USD"?"$":"")+v.toLocaleString("en-US",{maximumFractionDigits:2});
const fmtNumber=v=>v===null?"Unavailable":v.toLocaleString("en-US",{maximumFractionDigits:2});
function box(label,text){return '<div class="research-stat"><small>'+E(label)+'</small><strong>'+E(text)+'</strong></div>'}
async function loadDetails(symbol){
 if(busy)return;
 if(!/^[A-Z][A-Z0-9.-]{0,14}$/i.test(symbol))return;
 busy=true;status("Loading "+symbol+" quote and available fundamentals…");
 const output=document.getElementById("researchDetails");output.innerHTML="";
 const errors=[];
 const get=async(endpoint,params)=>{
  try{return await api(endpoint,params)}catch(err){errors.push(endpoint+": "+String(err.message||err));return null}
 };
 try{
  const quote=await get("quote",{symbol});
  const profile=await get("stock/profile2",{symbol});
  const metrics=await get("stock/metric",{symbol,metric:"all"});
  const today=new Date().toISOString().slice(0,10),future=new Date(Date.now()+90*86400000).toISOString().slice(0,10);
  const calendar=await get("calendar/dividend",{from:today,to:future,symbol});
  const m=metrics?.metric||{},price=val(quote?.c),prior=val(quote?.pc),open=val(quote?.o),high=val(quote?.h),low=val(quote?.l);
  const hi52=val(m["52WeekHigh"]),lo52=val(m["52WeekLow"]);
  const dividend=val(m.dividendPerShareAnnual),yieldValue=val(m.dividendYieldIndicatedAnnual);
  const entries=Array.isArray(calendar?.dividendCalendar)?calendar.dividendCalendar:[];
  const upcoming=entries.filter(x=>String(x.symbol||"").toUpperCase()===symbol.toUpperCase()).sort((a,b)=>String(a.date||a.exDate).localeCompare(String(b.date||b.exDate)))[0];
  const dated=quote?.t>0?new Date(quote.t*1000).toLocaleString():"Timestamp unavailable";
  const priceChange=price!==null&&prior>0?price-prior:null;
  const pctChange=priceChange!==null?priceChange/prior*100:null;
  const stats=[
   box("Last quote",moneyVal(price,profile?.currency||"USD")),
   box("Change vs previous close",priceChange===null?"Unavailable":(priceChange>=0?"+":"")+moneyVal(priceChange)+" ("+(pctChange>=0?"+":"")+pctChange.toFixed(2)+"%)"),
   box("Previous close",moneyVal(prior)),
   box("Open / Day high / Day low",[open,high,low].map(v=>moneyVal(v)).join(" / ")),
   box("52-week range",lo52!==null&&hi52!==null?moneyVal(lo52)+" – "+moneyVal(hi52):"Unavailable"),
   box("Annual indicated dividend/share",moneyVal(dividend)),
   box("Indicated annual dividend yield",yieldValue===null?"Unavailable":yieldValue.toFixed(2)+"%"),
   box("Next announced ex-date",upcoming?.date||upcoming?.exDate||"Not available"),
   box("Next announced payment",upcoming?.payDate||upcoming?.paymentDate||"Not available"),
   box("Market capitalization",val(profile?.marketCapitalization)===null?"Unavailable":fmtNumber(val(profile.marketCapitalization))+" million"),
   box("Industry",profile?.finnhubIndustry||"Unavailable"),
   box("Exchange",profile?.exchange||"Unavailable")
  ];
  output.innerHTML='<h3>'+E(profile?.name||symbol)+' <small>('+E(symbol)+')</small></h3><p class="muted">Quote as of '+E(dated)+' · Finnhub. For some securities last trade may be delayed or stale. Dividend dates are not estimates.</p><div class="research-data">'+stats.join("")+'</div>'+
   (errors.length?'<details><summary>Some data unavailable</summary><p class="muted">'+E(errors.join(" · "))+'</p></details>':'');
  status("Showing "+symbol+". All unavailable fields are explicitly labeled.");
 }catch(err){status("Could not load security: "+String(err.message||err))}
 finally{busy=false}
}
})();
