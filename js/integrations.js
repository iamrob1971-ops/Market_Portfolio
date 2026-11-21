(function(){
"use strict";
const E=esc,M=money,el=id=>document.getElementById(id);
let quotes=[],busy=false;
function scoped(all){let aa=all?state.accounts:accounts(),hs=state.holdings.filter(h=>aa.some(a=>a.id===h.accountId));return {aa,hs,t:totals(aa)}}
function symbols(){return [...new Set(scoped(false).hs.filter(h=>h.kind!=="money"&&(!h.currency||h.currency==="USD")&&/^[A-Z][A-Z0-9.-]{0,14}$/.test(h.symbol.toUpperCase())).map(h=>h.symbol.toUpperCase()))].sort()}
const nav=document.querySelector("nav"),main=document.querySelector("main");
function page(id,title,html){let b=document.createElement("button");b.dataset.tab=id;b.textContent=title;nav.append(b);let section=document.createElement("section");section.id=id;section.className="tab";section.innerHTML=html;main.append(section);b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("show",x.id===id));document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x===b)})}
page("live-prices","Price Refresh",'<div class="card"><h2>Price Refresh · Free API Test</h2><p>Fetch prices for saved US-listed ticker symbols through Finnhub, then review before applying. Quotes are not guaranteed real-time or complete.</p><div class="note">Enter a free, market-data-only API token for testing. It stays in this browser tab, is never saved to your portfolio or GitHub, and is sent only to Finnhub. Browser keys are less secure than a protected Azure Function.</div><div class="formgrid"><label>Finnhub API token (session only)<input type="password" id="fh-key" autocomplete="off" placeholder="Paste your free API key"></label><label>Max tickers per request<select id="fh-max"><option value="10">10</option><option value="20" selected>20</option><option value="40">40</option></select></label></div><div class="actions"><button class="btn" id="fh-refresh">Fetch quote preview</button><button class="btn secondary" id="fh-clear">Clear API key</button><button class="btn secondary" id="fh-copy">Copy tickers</button></div><p id="fh-status" role="status" class="muted">Not connected.</p><small>This is the initial free quote connector. Azure-hosted provider credentials will replace the browser-key test when configured.</small></div><div class="card"><div class="row"><h2>Review Quotes</h2><button class="btn" id="fh-apply" disabled>Apply selected prices</button></div><div id="fh-table" class="empty">Fetch quotes to preview them.</div></div><div class="card"><h2>Quote Coverage</h2><div id="fh-coverage"></div></div>');
page("ai-insights","AI Insights",'<div class="card"><h2>Portfolio Q&A</h2><p>Local calculations answer supported questions directly from your account records. No AI key is needed and nothing is sent to Gemini.</p><div class="formgrid"><label>Scope<select id="ai-scope"><option value="current">Selected owner view</option><option value="all">All owners including managed</option></select></label><label>Question<input id="ai-question" placeholder="What is my estimated dividend income?"></label></div><div class="actions"><button class="btn" id="ai-answer">Answer locally</button><button class="btn secondary" data-ai-q="portfolio">Portfolio overview</button><button class="btn secondary" data-ai-q="dividends">Dividends</button><button class="btn secondary" data-ai-q="energy">Energy / shipping baskets</button><button class="btn secondary" data-ai-q="pnl">Unrealized P&L</button></div><div id="ai-local" class="note">Choose a question or enter your own.</div></div><div class="card"><h2>Gemini Analysis · Review Before Sharing</h2><p>Prepare a grounded prompt using exact figures calculated by the app. Copy to Gemini and review the response. Gemini should explain—not independently invent—account figures.</p><label><input type="checkbox" id="ai-detail" style="width:auto"> Include individual positions, quantities, cost basis and account labels in the prompt</label><div class="actions"><button class="btn" id="ai-prepare">Prepare prompt</button><button class="btn secondary" id="ai-copy">Copy prompt</button></div><label>Review the data you will share<textarea id="ai-prompt" rows="10" readonly></textarea></label><p class="muted">No portfolio data is transmitted automatically. Copy/pasting is explicit; avoid sharing family details you do not want sent to another service.</p><a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">Open Google AI Studio</a></div><div class="card"><h2>Future in-app Gemini calls</h2><p>Secure Gemini requests will use Azure Functions and Entra authentication. No Gemini secret belongs in this public HTML app.</p></div>');
const status=s=>el("fh-status").textContent=s;
async function clipboard(t){try{await navigator.clipboard.writeText(t);toast("Copied to clipboard")}catch(e){alert("Clipboard permission unavailable; use HTTPS.")}}
el("fh-copy").onclick=()=>clipboard(symbols().join(", "));
el("fh-clear").onclick=()=>{el("fh-key").value="";status("Session key cleared.")};
el("fh-refresh").onclick=async()=>{
 if(busy)return;let key=el("fh-key").value.trim(),ss=symbols().slice(0,Number(el("fh-max").value));
 if(!key)return alert("Enter a free Finnhub API token for this session.");
 if(!ss.length)return alert("No eligible USD stock / ETF tickers in the selected owner view.");
 busy=true;quotes=[];el("fh-refresh").disabled=true;el("fh-apply").disabled=true;
 for(let i=0;i<ss.length;i++){
  let symbol=ss[i];status("Fetching "+(i+1)+" / "+ss.length+": "+symbol);
  try{
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);let response;
   try{response=await fetch("https://finnhub.io/api/v1/quote?symbol="+encodeURIComponent(symbol),{headers:{"X-Finnhub-Token":key},signal:c.signal})}finally{clearTimeout(timer)}
   if(!response.ok)throw Error("HTTP "+response.status);
   let j=await response.json(),price=Number(j.c),ts=Number(j.t);
   if(!(price>0)||!(ts>0))throw Error("No quote or unsupported ticker");
   quotes.push({symbol,price,asof:new Date(ts*1000).toISOString(),source:"Finnhub",ok:true,ageHours:(Date.now()-ts*1000)/3600000});
  }catch(e){quotes.push({symbol,ok:false,error:String(e.message||e)})}
  if(i<ss.length-1)await new Promise(r=>setTimeout(r,1100));
 }
 busy=false;el("fh-refresh").disabled=false;
 let good=quotes.filter(q=>q.ok).length;status(good+" of "+ss.length+" tickers returned usable quotes. Review data timestamps and coverage.");
 el("fh-table").className="tablewrap";
 el("fh-table").innerHTML='<table><thead><tr><th>Use</th><th>Symbol</th><th>Price USD</th><th>Quote timestamp</th><th>Status</th></tr></thead><tbody>'+quotes.map(q=>'<tr><td>'+(q.ok?'<input style="width:auto" type="checkbox" data-sym="'+E(q.symbol)+'" checked>':'—')+'</td><td>'+E(q.symbol)+'</td><td>'+(q.ok?M(q.price):'—')+'</td><td>'+E(q.asof||'—')+'</td><td>'+E(q.error||(q.ageHours>24?"Possibly stale — inspect":"Review"))+'</td></tr>').join("")+'</tbody></table>';
 el("fh-apply").disabled=!good;
};
el("fh-apply").onclick=async()=>{
 const selected=quotes.filter(q=>q.ok&&[...document.querySelectorAll("#fh-table [data-sym]")].some(e=>e.dataset.sym===q.symbol&&e.checked));
 if(!selected.length)return alert("Select a quote to apply.");
 if(!confirm("Apply "+selected.length+" Finnhub prices across matching USD holdings? Share quantities and cost basis will not change."))return;
 let changed=0;
 for(let q of selected){
  for(let h of state.holdings.filter(h=>h.symbol.toUpperCase()===q.symbol&&h.kind!=="money"&&(!h.currency||h.currency==="USD"))){h.price=q.price;h.marketValue=null;h.quoteSource=q.source;h.quoteAsOf=q.asof;changed++}
  state.quoteHistory.push({id:uid(),symbol:q.symbol,price:q.price,asof:q.asof,currency:"USD",source:q.source,importedAt:new Date().toISOString()});
 }
 await save();quotes=[];el("fh-apply").disabled=true;el("fh-table").innerHTML='<div class="empty">Quotes applied. Fetch again to refresh.</div>';toast(changed+" positions updated");
};
const qchoices={portfolio:"Summarize my portfolio",dividends:"How much estimated dividend income is recorded?",energy:"Show the holdings in my energy and shipping baskets",pnl:"What is my unrealized P&L?"};
document.querySelectorAll("[data-ai-q]").forEach(b=>b.onclick=()=>{el("ai-question").value=qchoices[b.dataset.aiQ];answer()});
el("ai-answer").onclick=answer;
function analysis(){let d=scoped(el("ai-scope").value==="all");return {...d,perAccount:d.aa.map(a=>({name:label(a),owner:state.owners.find(o=>o.id===a.ownerId)?.name||"",value:totals([a]).total,income:totals([a]).income}))}}
function answer(){
 const q=el("ai-question").value.toLowerCase().trim(),d=analysis();if(!q){el("ai-local").textContent="Enter a question.";return}
 let html;
 if(/dividend|distribution|income/.test(q)){html='<strong>Estimated annual income: '+M(d.t.income)+'</strong><p>Monthly equivalent: '+M(d.t.income/12)+'. Only saved dividend profiles are included; missing profiles do not imply a security pays nothing.</p>'+table(["Account","Annual estimate"],d.perAccount.map(a=>'<tr>'+td(E(a.name))+td(M(a.income))+'</tr>'))}
 else if(/basket|oil|energy|shipping/.test(q)){
  let bs=state.baskets.filter(b=>/oil|energy|shipping|bulk/i.test(b.name)),matching=d.hs.filter(h=>bs.some(b=>b.id===h.basketId));
  html='<strong>'+matching.length+' rows in matching named baskets, valued at '+M(matching.reduce((v,h)=>v+value(h),0))+'</strong><p>Baskets reflect your assigned labels, not verified industry classifications.</p>'+table(["Basket","Account","Ticker","Value"],matching.map(h=>'<tr>'+td(E(state.baskets.find(b=>b.id===h.basketId)?.name||""))+td(E(label(d.aa.find(a=>a.id===h.accountId))))+td(E(h.symbol))+td(M(value(h)))+'</tr>'))}
 else if(/p&l|gain|loss|profit|performance|return/.test(q)){html='<strong>Recorded unrealized P&L: '+M(d.t.pnl)+'</strong><p>This is not a tax-lot report or cash-flow-adjusted return. It excludes realized gains, expenses and unrecorded transactions.</p>'}
 else {html='<strong>Portfolio value: '+M(d.t.total)+'</strong><p>'+d.aa.length+' accounts and '+d.hs.length+' holdings rows. Cash: '+M(d.t.cash)+'; money market positions: '+M(d.t.moneyFund)+'; imported pending adjustment: '+M(d.t.pending)+'.</p>'+table(["Account","Value","Annual dividend estimate"],d.perAccount.map(a=>'<tr>'+td(E(a.name))+td(M(a.value))+td(M(a.income))+'</tr>'))}
 el("ai-local").innerHTML=html+'<p class="muted">Scope: '+E(el("ai-scope").value==="all"?"All owners":"Selected view")+'. Values come from local saved records, not independently verified prices.</p>';
}
el("ai-prepare").onclick=()=>{
 let d=analysis(),facts={preparedAt:new Date().toISOString(),scope:el("ai-scope").value,accountCount:d.aa.length,positionCount:d.hs.length,totalValue:d.t.total,securitiesValue:d.t.sec,cashValue:d.t.cash,moneyMarketValue:d.t.moneyFund,pendingAdjustments:d.t.pending,unrealizedPnL:d.t.pnl,estimatedAnnualDividends:d.t.income,accounts:d.perAccount,baskets:state.baskets.map(b=>({name:b.name,value:d.hs.filter(h=>h.basketId===b.id).reduce((v,h)=>v+value(h),0)}))};
 if(el("ai-detail").checked)facts.positions=d.hs.map(h=>({account:label(d.aa.find(a=>a.id===h.accountId)),ticker:h.symbol,shares:h.quantity,marketPrice:h.price,marketValue:value(h),costBasis:h.basis,quoteAsOf:h.quoteAsOf||"unknown",quoteSource:h.quoteSource||"manual/import"}));
 el("ai-prompt").value="Analyze the following portfolio facts from my local tracking app. They are the ONLY authoritative data for account totals, holdings, dividends and P&L. Do not invent market prices, payments, forecasts, or trades. Identify missing or stale information and separate analysis from fact. Do not recommend trades unless asked.\\n\\nQuestion: "+(el("ai-question").value.trim()||"Explain this portfolio and its key risks.")+"\\n\\nPortfolio facts:\\n"+JSON.stringify(facts,null,2);toast("Review prompt before copying");
};
el("ai-copy").onclick=()=>el("ai-prompt").value?clipboard(el("ai-prompt").value):alert("Prepare a prompt first.");
function coverage(){let hh=scoped(false).hs,known=hh.filter(h=>Number(h.price)>0).length;el("fh-coverage").innerHTML="<p>"+hh.length+" rows; "+known+" have recorded prices; "+symbols().length+" unique eligible USD symbols. Securities with non-USD currency or money-market status are excluded.</p>"+table(["Ticker","Last recorded source","As of"],hh.filter(h=>h.quoteAsOf).slice(0,25).map(h=>'<tr>'+td(E(h.symbol))+td(E(h.quoteSource||"—"))+td(E(h.quoteAsOf))+'</tr>'))}
const original=render;render=function(){original();coverage()};
coverage();
})();