/* Local research threads: no account transmission or provider calls. */
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
"#marketAiRail.ai-wide{width:min(600px,100vw)}",
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
"body.market-ai-open main{margin-right:min(var(--ai-rail-width,420px),40vw);max-width:none}",
"@media(max-width:1100px){body.market-ai-open main{margin-right:0}#marketAiRail{width:min(420px,94vw)}}"
].join("\n");document.head.append(css);
const launch=document.createElement("button");launch.type="button";launch.id="marketAiOpen";launch.className="btn secondary";launch.textContent="✨ AI Research";launch.setAttribute("aria-controls","marketAiRail");launch.setAttribute("aria-expanded","false");document.querySelector("header .row")?.append(launch);
const rail=document.createElement("aside");rail.id="marketAiRail";rail.hidden=true;rail.setAttribute("aria-label","AI research sidebar");
rail.innerHTML='<div class="ai-head"><strong id="aiTitle">AI Research</strong><div><button class="btn secondary" type="button" id="aiExpand">Expand</button> <button class="btn secondary" type="button" id="aiClose">Collapse</button></div></div><div class="ai-body"><p class="ai-note">Local research workspace · no AI provider connected</p><details id="aiSettings"><summary>AI Settings ⚙</summary><p class="ai-note">Preferences only. No credentials are collected or provider calls made.</p><label>Preferred connection<select id="aiConnection"><option value="local">Local research</option><option value="azure">Azure (not connected)</option><option value="browser">Browser (not connected)</option></select></label><label>Preferred tier<select id="aiTier"><option value="free">Free</option><option value="paid">Paid</option></select></label><label>Primary model preference<input id="aiModel" maxlength="100" placeholder="Not configured"></label><label>Fallback model preference<input id="aiFallback" maxlength="100" placeholder="Optional"></label><label><input id="aiAllowFallback" type="checkbox" style="width:auto"> Prefer same-tier fallback</label><p class="ai-note">Private position context: disabled. Connection status: not connected.</p><button type="button" class="btn secondary" id="aiSaveSettings">Save preferences</button></details><label for="aiScope">Scope</label><select id="aiScope"><option value="security">Security</option><option value="portfolio">Portfolio</option><option value="market">Market</option></select><div id="aiTickerBox"><label for="aiTicker">Ticker</label><input id="aiTicker" maxlength="24" placeholder="NVDA"><button class="btn secondary" type="button" id="aiGoTicker">Open ticker</button></div><div class="ai-actions"><button id="aiNew" type="button">New session</button><button id="aiFork" type="button">Fork</button><button id="aiRename" type="button">Rename</button><button id="aiDelete" type="button">Delete</button></div><strong>Sessions</strong><div id="aiHistory" class="ai-history"></div><button id="aiShowAll" type="button" class="btn secondary">Show all</button><h3 id="aiSessionTitle"></h3><div id="aiMessages" aria-live="polite"></div><div class="ai-actions" id="aiPrompts"></div><label for="aiSavedPrompt">Saved prompt library</label><select id="aiSavedPrompt"><option value="">Choose a saved prompt</option></select><label for="aiQuestion">Editable research question</label><textarea id="aiQuestion" placeholder="Write your research question"></textarea><p class="ai-note">Saving records your question in this browser, without sending it. No AI answer is generated. Portfolio holdings, account identifiers, cost basis and financial values are never attached.</p><button id="aiSave" type="button" class="btn">Save question locally</button><details style="margin-top:12px"><summary>Add a research note or source</summary><label for="aiNote">Research note (manual)</label><textarea id="aiNote" maxlength="20000" placeholder="Record findings or a source-based answer"></textarea><label for="aiSource">Source URL or reference (optional)</label><input id="aiSource" maxlength="500" placeholder="Source reference"><label for="aiSourceDate">Source observation date (optional)</label><input id="aiSourceDate" type="date"><button id="aiSaveNote" class="btn secondary" type="button">Save research note</button></details><p id="aiStatus" role="status" class="ai-note"></p></div>';
document.body.append(rail);
let current=null,opened=false,all=false;
const topics=()=>{if(!Array.isArray(state.aiThreads))state.aiThreads=[];return state.aiThreads};
const normalize=x=>String(x||"").trim().toUpperCase().replace(/[^A-Z0-9.^-]/g,"").slice(0,24);
function create(scope,key,title,forkedFrom){const t={threadId:uuid(),topicType:scope,topicKey:key,title:title||key+" — General",ownerScope:"mine",createdAt:stamp(),updatedAt:stamp(),modelPreference:null,tierPreference:"free",lastUsedModel:null,archived:false,revision:1,syncState:"local",messages:[]};if(forkedFrom)t.forkedFrom=forkedFrom;topics().push(t);return t}
const defaultThread=(scope,key)=>topics().find(x=>x.topicType===scope&&x.topicKey===key&&!x.forkedFrom&&!x.archived);
function draw(){
 if(!opened)return;
 if(current&&!topics().includes(current))current=topics().find(t=>t.threadId===current.threadId)||null;
 const scope=current?.topicType||"portfolio",key=current?.topicKey||"MY_PORTFOLIO";
 $("aiScope").value=scope;$("aiTickerBox").hidden=scope!=="security";$("aiTicker").value=scope==="security"?key:"";
 $("aiTitle").textContent=(scope==="security"?key:scope==="portfolio"?"Portfolio":"Market")+" · AI Research";
 $("aiSessionTitle").textContent=current?.title||"No session";
 const sorted=topics().slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 $("aiHistory").innerHTML=(all?sorted:sorted.slice(0,20)).map(t=>'<div class="ai-thread"><button type="button" data-thread="'+clean(t.threadId)+'" '+(current?.threadId===t.threadId?'aria-current="true"':'')+'>'+clean(t.title)+'</button><small>'+clean(t.topicType)+' · '+clean(t.updatedAt?.slice(0,16)||"")+' · '+(t.messages||[]).length+' entries</small></div>').join("")||'<p class="ai-note">No sessions</p>';
 $("aiShowAll").textContent=all?"Show recent 20":"Show all ("+sorted.length+")";
 $("aiMessages").innerHTML=(current?.messages||[]).map(m=>'<div class="ai-message"><small>'+clean(m.role==="note"?"Manual research note":m.role==="assistant"?"Recorded assistant response":"Saved question, not sent")+' · '+clean(m.createdAt)+'</small><div>'+clean(m.content)+'</div>'+(m.source?'<small>Source: '+clean(m.source)+'</small>':"")+(m.sourceDate?'<small>Source date: '+clean(m.sourceDate)+'</small>':"")+'</div>').join("")||'<p class="ai-note">No entries saved yet.</p>';
 $("aiPrompts").innerHTML=(scope==="security"?Object.keys(prompts):[]).map(k=>'<button type="button" data-template="'+clean(k)+'">'+clean(k)+'</button>').join("");
 $("aiSavedPrompt").replaceChildren(new Option("Choose a saved prompt",""));for(const p of (state.aiPrompts||[]).filter(p=>p.topicType===scope))$("aiSavedPrompt").add(new Option(p.title,p.promptId));
}
async function persist(){await save();draw()}
function openTopic(scope="portfolio",symbol="",newSession=false){
 const key=scope==="security"?normalize(symbol):scope==="market"?"MARKET":"MY_PORTFOLIO";
 if(!db)return;if(!key){$("aiStatus").textContent="Enter a ticker.";return}
 const oldCount=topics().length;current=(!newSession&&defaultThread(scope,key))||create(scope,key,newSession?key+" — New session":null);
 opened=true;rail.hidden=false;document.body.classList.add("market-ai-open");launch.setAttribute("aria-expanded","true");
 $("aiQuestion").value=scope==="security"?prompts["Risk & Catalysts"](key):scope==="market"?"What market developments should I research today?":"Which portfolio research topics should I investigate? No holdings data is attached.";
 $("aiStatus").textContent="Not connected to an AI provider.";draw();
 if(topics().length!==oldCount)persist().catch(e=>$("aiStatus").textContent="Save failed: "+e.message);
}
launch.onclick=()=>{if(!db){return}if(current&&topics().includes(current)){opened=true;rail.hidden=false;document.body.classList.add("market-ai-open");launch.setAttribute("aria-expanded","true");draw()}else openTopic("portfolio")};
$("aiExpand").onclick=()=>{const wide=rail.classList.toggle("ai-wide");$("aiExpand").textContent=wide?"Narrow":"Expand";document.body.style.setProperty("--ai-rail-width",wide?"600px":"420px")};
$("aiClose").onclick=()=>{opened=false;rail.hidden=true;document.body.classList.remove("market-ai-open");launch.setAttribute("aria-expanded","false")};
$("aiScope").onchange=e=>{if(e.target.value==="security"){ $("aiTickerBox").hidden=false;$("aiTicker").focus();$("aiStatus").textContent="Enter a ticker and select Open ticker.";return}openTopic(e.target.value)};
$("aiGoTicker").onclick=()=>openTopic("security",$("aiTicker").value);
$("aiTicker").onkeydown=e=>{if(e.key==="Enter")openTopic("security",e.target.value)};
$("aiNew").onclick=()=>openTopic(current?.topicType||"portfolio",current?.topicType==="security"?current.topicKey:"",true);
$("aiFork").onclick=async()=>{if(!current)return;const name=prompt("Name fork",current.title+" — Research");if(!name?.trim())return;const original=current;current=create(original.topicType,original.topicKey,name.trim().slice(0,100),original.threadId);current.messages=original.messages.map(m=>({...m,messageId:uuid()}));await persist()};
$("aiRename").onclick=async()=>{if(!current)return;const name=prompt("Session name",current.title);if(!name?.trim())return;current.title=name.trim().slice(0,100);current.updatedAt=stamp();current.revision++;await persist()};
$("aiDelete").onclick=async()=>{if(!current||!confirm("Delete this local session and all its questions?"))return;const old=current;state.aiThreads=topics().filter(t=>t.threadId!==old.threadId);current=defaultThread(old.topicType,old.topicKey)||topics()[0]||null;await persist()};
$("aiShowAll").onclick=()=>{all=!all;draw()};
$("aiHistory").onclick=e=>{const b=e.target.closest("[data-thread]");if(!b)return;current=topics().find(t=>t.threadId===b.dataset.thread)||current;$("aiQuestion").value="";draw()};
$("aiPrompts").onclick=e=>{const b=e.target.closest("[data-template]");if(b&&current)$("aiQuestion").value=prompts[b.dataset.template](current.topicKey)};
$("aiSave").onclick=async()=>{const question=$("aiQuestion").value.trim();if(!current||!topics().includes(current)||!question){$("aiStatus").textContent="Open a session and enter a question first.";return}if(question.length>12000){$("aiStatus").textContent="Keep questions under 12,000 characters.";return}current.messages.push({messageId:uuid(),role:"user",content:question,createdAt:stamp(),contextScope:"public_market_only",includedPosition:false,status:"saved_not_sent"});current.updatedAt=stamp();current.revision++;try{await persist();$("aiQuestion").value="";$("aiStatus").textContent="Question saved locally; not sent."}catch(e){$("aiStatus").textContent="Save failed: "+e.message}};
$("aiSaveNote").onclick=async()=>{const t=current,content=$("aiNote").value.trim();if(!t||!topics().includes(t)||!content){$("aiStatus").textContent="Open a session and enter a research note.";return}const message={messageId:uuid(),role:"note",content,createdAt:stamp(),source:$("aiSource").value.trim(),sourceDate:$("aiSourceDate").value||null,contextScope:"local_only",includedPosition:false,status:"manual"};const oldTime=t.updatedAt,oldRevision=t.revision;t.messages.push(message);t.updatedAt=stamp();t.revision++;$("aiSaveNote").disabled=true;try{await persist();if(current===t){$("aiNote").value="";$("aiSource").value="";$("aiSourceDate").value="";$("aiStatus").textContent="Research note saved locally."}}catch(e){t.messages=t.messages.filter(m=>m.messageId!==message.messageId);t.updatedAt=oldTime;t.revision=oldRevision;draw();$("aiStatus").textContent="Save failed: "+e.message}finally{$("aiSaveNote").disabled=false}};
window.addEventListener("market-portfolio-restored",()=>{current=null;$("aiQuestion").value="";$("aiNote").value="";$("aiSource").value="";$("aiSourceDate").value="";draw()});
document.addEventListener("click",e=>{const b=e.target.closest("[data-ai-holding]");if(!b)return;e.preventDefault();openTopic("security",b.dataset.aiHolding)});
const prefsKey="market_ai_preferences_v1";
try{const p=JSON.parse(localStorage.getItem(prefsKey)||"{}");$("aiConnection").value=["local","azure","browser"].includes(p.connection)?p.connection:"local";$("aiTier").value=p.tier==="paid"?"paid":"free";$("aiModel").value=String(p.model||"");$("aiFallback").value=String(p.fallback||"");$("aiAllowFallback").checked=!!p.allowFallback}catch(e){}
$("aiSaveSettings").onclick=()=>{try{localStorage.setItem(prefsKey,JSON.stringify({connection:$("aiConnection").value,tier:$("aiTier").value,model:$("aiModel").value.trim(),fallback:$("aiFallback").value.trim(),allowFallback:$("aiAllowFallback").checked}));$("aiStatus").textContent="Preferences saved. AI provider not connected."}catch(e){$("aiStatus").textContent="Preferences could not be saved."}};
$("aiSavedPrompt").onchange=()=>{const p=(state.aiPrompts||[]).find(p=>p.promptId===$("aiSavedPrompt").value);if(p&&current)$("aiQuestion").value=String(p.text||"").replaceAll("{{TICKER}}",current.topicKey)};
window.addEventListener("market-portfolio-sync-complete",draw);
window.addEventListener("market-portfolio-prompts-changed",draw);
window.MarketPortfolioAI={openTopic};
})();
