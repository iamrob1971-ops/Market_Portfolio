/* Phase 1 local AI research threads: no account transmission or provider calls. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), clean=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid=()=>crypto.randomUUID(),stamp=()=>new Date().toISOString();
const prompts={
"Risk & Catalysts":t=>"What are the risks, catalysts, valuation considerations and recent developments for "+t+"?",
"Valuation":t=>"How should I evaluate "+t+"'s valuation? Identify assumptions and unverified estimates.",
"Dividends":t=>"What should I verify about "+t+"'s dividend policy and sustainability?",
"Earnings":t=>"What are the key questions for "+t+"'s earnings and guidance?",
"Compare Peers":t=>"Which public-company peers are relevant to "+t+" and what metrics should I compare?"
};
const css=document.createElement("style");
css.textContent=[
"#marketAiRail{position:fixed;z-index:90;top:0;right:0;bottom:0;width:min(420px,100vw);background:#fff;color:#16283e;border-left:1px solid #bdcad8;box-shadow:-12px 0 30px #10283b36;display:flex;flex-direction:column}",
"#marketAiRail[hidden]{display:none}",
"#marketAiRail .ai-head{padding:14px;background:#11263e;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:8px}",
"#marketAiRail .ai-body{overflow:auto;padding:14px;flex:1}",
"#marketAiRail .ai-actions{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}",
"#marketAiRail .ai-actions button{padding:6px 9px;border:1px solid #cad7e7;border-radius:7px;background:#eff4fa;color:#173c6d}",
"#marketAiRail .ai-history{max-height:200px;overflow:auto;border:1px solid #dce5f0;padding:7px;border-radius:8px}",
"#marketAiRail .ai-thread{padding:7px;border-bottom:1px solid #e4eaf2}",
"#marketAiRail .ai-thread small{display:block;color:#60728a}",
"#marketAiRail .ai-message{padding:10px;margin:8px 0;background:#f2f5fa;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}",
"#marketAiRail .ai-note{font-size:12px;color:#60728a}",
"#marketAiRail textarea{min-height:110px;resize:vertical}",
".market-ai-row{border:1px solid #c5d3e7;background:#eaf1fc;color:#224d91;border-radius:6px;padding:2px 6px;margin-left:5px;font-size:12px}",
"body.market-ai-open main{margin-right:min(420px,35vw);max-width:none}",
"@media(max-width:1100px){body.market-ai-open main{margin-right:0}#marketAiRail{width:min(420px,94vw)}}"
].join("\n");document.head.append(css);
const launch=document.createElement("button");launch.type="button";launch.id="marketAiOpen";launch.className="btn secondary";launch.textContent="✨ AI Research";launch.setAttribute("aria-controls","marketAiRail");launch.setAttribute("aria-expanded","false");document.querySelector("header .row")?.append(launch);
const rail=document.createElement("aside");rail.id="marketAiRail";rail.hidden=true;rail.setAttribute("aria-label","AI research sidebar");
rail.innerHTML='<div class="ai-head"><strong id="aiTitle">AI Research</strong><button class="btn secondary" type="button" id="aiClose">Collapse</button></div><div class="ai-body"><p class="ai-note">Phase 1 · AI provider not connected · local questions only</p><label for="aiScope">Scope</label><select id="aiScope"><option value="security">Security</option><option value="portfolio">Portfolio</option><option value="market">Market</option></select><div id="aiTickerBox"><label for="aiTicker">Ticker</label><input id="aiTicker" maxlength="24" placeholder="NVDA"><button class="btn secondary" type="button" id="aiGoTicker">Open ticker</button></div><div class="ai-actions"><button id="aiNew" type="button">New session</button><button id="aiFork" type="button">Fork</button><button id="aiRename" type="button">Rename</button><button id="aiDelete" type="button">Delete</button></div><strong>Sessions</strong><div id="aiHistory" class="ai-history"></div><button id="aiShowAll" type="button" class="btn secondary">Show all</button><h3 id="aiSessionTitle"></h3><div id="aiMessages" aria-live="polite"></div><div class="ai-actions" id="aiPrompts"></div><label for="aiQuestion">Editable research question</label><textarea id="aiQuestion" placeholder="Write your research question"></textarea><p class="ai-note">Saving records your question in this browser, without sending it. No AI answer is generated. Portfolio holdings, account identifiers, cost basis and financial values are never attached.</p><button id="aiSave" type="button" class="btn">Save question locally</button><p id="aiStatus" role="status" class="ai-note"></p></div>';
document.body.append(rail);
let current=null,opened=false,all=false;
const topics=()=>{if(!Array.isArray(state.aiThreads))state.aiThreads=[];return state.aiThreads};
const normalize=x=>String(x||"").trim().toUpperCase().replace(/[^A-Z0-9.^-]/g,"").slice(0,24);
function create(scope,key,title,forkedFrom){const t={threadId:uuid(),topicType:scope,topicKey:key,title:title||key+" — General",ownerScope:"mine",createdAt:stamp(),updatedAt:stamp(),modelPreference:null,tierPreference:"free",lastUsedModel:null,archived:false,revision:1,syncState:"local",messages:[]};if(forkedFrom)t.forkedFrom=forkedFrom;topics().push(t);return t}
const defaultThread=(scope,key)=>topics().find(x=>x.topicType===scope&&x.topicKey===key&&!x.forkedFrom&&!x.archived);
function draw(){
 if(!opened)return;
 const scope=current?.topicType||"portfolio",key=current?.topicKey||"MY_PORTFOLIO";
 $("aiScope").value=scope;$("aiTickerBox").hidden=scope!=="security";$("aiTicker").value=scope==="security"?key:"";
 $("aiTitle").textContent=(scope==="security"?key:scope==="portfolio"?"Portfolio":"Market")+" · AI Research";
 $("aiSessionTitle").textContent=current?.title||"No session";
 const sorted=topics().slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 $("aiHistory").innerHTML=(all?sorted:sorted.slice(0,20)).map(t=>'<div class="ai-thread"><button type="button" data-thread="'+clean(t.threadId)+'" '+(current?.threadId===t.threadId?'aria-current="true"':'')+'>'+clean(t.title)+'</button><small>'+clean(t.topicType)+' · '+clean(t.updatedAt?.slice(0,16)||"")+' · '+(t.messages||[]).length+' saved questions</small></div>').join("")||'<p class="ai-note">No sessions</p>';
 $("aiShowAll").textContent=all?"Show recent 20":"Show all ("+sorted.length+")";
 $("aiMessages").innerHTML=(current?.messages||[]).map(m=>'<div class="ai-message"><small>Saved, not sent · '+clean(m.createdAt)+'</small><div>'+clean(m.content)+'</div></div>').join("")||'<p class="ai-note">No questions saved yet.</p>';
 $("aiPrompts").innerHTML=(scope==="security"?Object.keys(prompts):[]).map(k=>'<button type="button" data-template="'+clean(k)+'">'+clean(k)+'</button>').join("");
}
async function persist(){await save();draw()}
function openTopic(scope="portfolio",symbol="",newSession=false){
 const key=scope==="security"?normalize(symbol):scope==="market"?"MARKET":"MY_PORTFOLIO";
 if(!key){$("aiStatus").textContent="Enter a ticker.";return}
 const oldCount=topics().length;current=(!newSession&&defaultThread(scope,key))||create(scope,key,newSession?key+" — New session":null);
 opened=true;rail.hidden=false;document.body.classList.add("market-ai-open");launch.setAttribute("aria-expanded","true");
 $("aiQuestion").value=scope==="security"?prompts["Risk & Catalysts"](key):scope==="market"?"What market developments should I research today?":"Which portfolio research topics should I investigate? No holdings data is attached.";
 $("aiStatus").textContent="Not connected to an AI provider.";draw();
 if(topics().length!==oldCount)persist().catch(e=>$("aiStatus").textContent="Save failed: "+e.message);
}
launch.onclick=()=>openTopic("portfolio");
$("aiClose").onclick=()=>{opened=false;rail.hidden=true;document.body.classList.remove("market-ai-open");launch.setAttribute("aria-expanded","false")};
$("aiScope").onchange=e=>openTopic(e.target.value,e.target.value==="security"?$("aiTicker").value||"AAPL":"");
$("aiGoTicker").onclick=()=>openTopic("security",$("aiTicker").value);
$("aiTicker").onkeydown=e=>{if(e.key==="Enter")openTopic("security",e.target.value)};
$("aiNew").onclick=()=>openTopic(current?.topicType||"portfolio",current?.topicType==="security"?current.topicKey:"",true);
$("aiFork").onclick=async()=>{if(!current)return;const name=prompt("Name fork",current.title+" — Research");if(!name?.trim())return;const original=current;current=create(original.topicType,original.topicKey,name.trim().slice(0,100),original.threadId);current.messages=original.messages.map(m=>({...m,messageId:uuid()}));await persist()};
$("aiRename").onclick=async()=>{if(!current)return;const name=prompt("Session name",current.title);if(!name?.trim())return;current.title=name.trim().slice(0,100);current.updatedAt=stamp();current.revision++;await persist()};
$("aiDelete").onclick=async()=>{if(!current||!confirm("Delete this local session and all its questions?"))return;const old=current;state.aiThreads=topics().filter(t=>t.threadId!==old.threadId);current=defaultThread(old.topicType,old.topicKey)||topics()[0]||null;await persist()};
$("aiShowAll").onclick=()=>{all=!all;draw()};
$("aiHistory").onclick=e=>{const b=e.target.closest("[data-thread]");if(!b)return;current=topics().find(t=>t.threadId===b.dataset.thread)||current;$("aiQuestion").value="";draw()};
$("aiPrompts").onclick=e=>{const b=e.target.closest("[data-template]");if(b&&current)$("aiQuestion").value=prompts[b.dataset.template](current.topicKey)};
$("aiSave").onclick=async()=>{const question=$("aiQuestion").value.trim();if(!current||!question){$("aiStatus").textContent="Enter a question first.";return}current.messages.push({messageId:uuid(),role:"user",content:question,createdAt:stamp(),contextScope:"public_market_only",includedPosition:false,status:"saved_not_sent"});current.updatedAt=stamp();current.revision++;try{await persist();$("aiQuestion").value="";$("aiStatus").textContent="Question saved locally; not sent."}catch(e){$("aiStatus").textContent="Save failed: "+e.message}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-ai-holding]");if(!b)return;e.preventDefault();openTopic("security",b.dataset.aiHolding)});
window.MarketPortfolioAI={openTopic};
})();
