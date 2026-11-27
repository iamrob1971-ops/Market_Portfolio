/* Local-first research threads with opt-in Gemini browser requests. */
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
"#marketAiRail input[type=password]{width:100%;box-sizing:border-box}",
"#marketAiRail .ai-message small{display:block;opacity:.75;margin-bottom:5px}",
".market-ai-row{border:1px solid #c5d3e7;background:#eaf1fc;color:#224d91;border-radius:6px;padding:2px 6px;margin-left:5px;font-size:12px}",
"body.market-ai-open main{margin-right:min(var(--ai-rail-width,420px),40vw);max-width:none}",
"@media(max-width:1100px){body.market-ai-open main{margin-right:0}#marketAiRail{width:min(420px,94vw)}}"
].join("\n");document.head.append(css);
const launch=document.createElement("button");launch.type="button";launch.id="marketAiOpen";launch.className="btn secondary";launch.textContent="✨ AI Research";launch.setAttribute("aria-controls","marketAiRail");launch.setAttribute("aria-expanded","false");document.querySelector("header .row")?.append(launch);
const rail=document.createElement("aside");rail.id="marketAiRail";rail.hidden=true;rail.setAttribute("aria-label","AI research sidebar");
rail.innerHTML='<div class="ai-head"><strong id="aiTitle">AI Research</strong><div><button class="btn secondary" type="button" id="aiExpand">Expand</button> <button class="btn secondary" type="button" id="aiClose">Collapse</button></div></div><div class="ai-body"><p class="ai-note" id="aiProviderNote">Local research workspace · Gemini available by explicit request</p><details id="aiSettings"><summary>AI Settings ⚙</summary><p class="ai-note">Gemini keys stay in this browser only. For private financial data, use the protected Azure gateway instead.</p><label>Preferred connection<select id="aiConnection"><option value="local">Local research</option><option value="azure">Azure (not connected)</option><option value="browser">Browser · Gemini</option></select></label><label>Free Gemini API key<input id="aiFreeKey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste free key"></label><label>Paid Gemini API key<input id="aiPaidKey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste paid key"></label><label><input id="aiRememberKeys" type="checkbox" style="width:auto"> Remember keys on this device (less secure)</label><div class="ai-actions"><button id="aiVerifyFree" type="button">Verify Free key &amp; models</button><button id="aiVerifyPaid" type="button">Verify Paid key &amp; models</button><button id="aiForgetKeys" type="button">Forget keys</button></div><label>Preferred tier<select id="aiTier"><option value="free">Free</option><option value="paid">Paid</option></select></label><label>Primary model<select id="aiModel"><option value="">Verify a key to discover models</option></select></label><label>Fallback model<select id="aiFallback"><option value="">None</option></select></label><label><input id="aiAllowFallback" type="checkbox" style="width:auto"> Prefer same-tier fallback</label><p class="ai-note">Private position context: disabled. Only your typed research question and this thread’s previous user/assistant messages are sent.</p><p class="ai-note" id="aiKeyStatus">Gemini key not verified.</p><button type="button" class="btn secondary" id="aiSaveSettings">Save preferences</button></details><label for="aiScope">Scope</label><select id="aiScope"><option value="security">Security</option><option value="portfolio">Portfolio</option><option value="market">Market</option></select><div id="aiTickerBox"><label for="aiTicker">Ticker</label><input id="aiTicker" maxlength="24" placeholder="NVDA"><button class="btn secondary" type="button" id="aiGoTicker">Open ticker</button></div><div class="ai-actions"><button id="aiNew" type="button">New session</button><button id="aiFork" type="button">Fork</button><button id="aiRename" type="button">Rename</button><button id="aiDelete" type="button">Delete</button></div><strong>Sessions</strong><div id="aiHistory" class="ai-history"></div><button id="aiShowAll" type="button" class="btn secondary">Show all</button><h3 id="aiSessionTitle"></h3><div id="aiMessages" aria-live="polite"></div><div class="ai-actions" id="aiPrompts"></div><label for="aiSavedPrompt">Saved prompt library</label><select id="aiSavedPrompt"><option value="">Choose a saved prompt</option></select><label for="aiQuestion">Editable research question</label><textarea id="aiQuestion" placeholder="Write your research question"></textarea><p class="ai-note">Send requests transmit typed thread messages to Google Gemini. No local portfolio, account, holdings or cost-basis records are attached. Save question locally does not contact Gemini.</p><button id="aiSave" type="button" class="btn secondary">Save question locally</button> <button id="aiSend" type="button" class="btn">Send to Gemini</button><details style="margin-top:12px"><summary>Add a research note or source</summary><label for="aiNote">Research note (manual)</label><textarea id="aiNote" maxlength="20000" placeholder="Record findings or a source-based answer"></textarea><label for="aiSource">Source URL or reference (optional)</label><input id="aiSource" maxlength="500" placeholder="Source reference"><label for="aiSourceDate">Source observation date (optional)</label><input id="aiSourceDate" type="date"><button id="aiSaveNote" class="btn secondary" type="button">Save research note</button></details><p id="aiStatus" role="status" class="ai-note"></p></div>';
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
 $("aiMessages").innerHTML=(current?.messages||[]).map(m=>'<div class="ai-message"><small>'+clean(m.role==="note"?"Manual research note":m.role==="assistant"?"Gemini · "+(m.model||"model unknown")+" · "+(m.tier||"free"):m.status==="complete"?"Question sent":m.status==="error"?"Send failed":"Saved question, not sent")+' · '+clean(m.createdAt)+'</small><div>'+clean(m.content)+'</div>'+(m.source?'<small>Source: '+clean(m.source)+'</small>':"")+(m.sourceDate?'<small>Source date: '+clean(m.sourceDate)+'</small>':"")+'</div>').join("")||'<p class="ai-note">No entries saved yet.</p>';
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
 $("aiStatus").textContent="Research session ready.";draw();
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

/* Gemini browser-key profiles are intentionally independent of portfolio state/backup. */
const prefsKey="market_ai_preferences_v1";
const keySession="market_ai_gemini_keys_session_v1",keyRemember="market_ai_gemini_keys_device_v1";
const modelCatalog={free:[],paid:[]};
const modelsFallback=["gemini-2.5-flash","gemini-2.5-flash-lite"];
let sending=false;
function readKeyStore(storage){try{return JSON.parse(storage.getItem(storage===localStorage?keyRemember:keySession)||"{}")}catch{return {}}}
function loadKeys(){const k={...readKeyStore(localStorage),...readKeyStore(sessionStorage)};$("aiFreeKey").value=k.free||"";$("aiPaidKey").value=k.paid||"";$("aiRememberKeys").checked=!!localStorage.getItem(keyRemember)}
function saveKeys(){const values={free:$("aiFreeKey").value.trim(),paid:$("aiPaidKey").value.trim()};if($("aiRememberKeys").checked){localStorage.setItem(keyRemember,JSON.stringify(values));sessionStorage.removeItem(keySession)}else{sessionStorage.setItem(keySession,JSON.stringify(values));localStorage.removeItem(keyRemember)}}
function forgetKeys(){localStorage.removeItem(keyRemember);sessionStorage.removeItem(keySession);$("aiFreeKey").value="";$("aiPaidKey").value="";modelCatalog.free=[];modelCatalog.paid=[];populateModels();$("aiKeyStatus").textContent="Keys removed from browser storage."}
function getKey(tier){return (tier==="paid"?$("aiPaidKey"):$("aiFreeKey")).value.trim()}
const modelName=x=>String(x||"").replace(/^models\//,"");
function populateModels(){
 const tier=$("aiTier").value,options=modelCatalog[tier].length?modelCatalog[tier]:modelsFallback;
 const previousModel=$("aiModel").value||$("aiModel").dataset.preference||modelsFallback[0];
 const previousFallback=$("aiFallback").value||$("aiFallback").dataset.preference||"";
 for(const [id,empty] of [["aiModel",false],["aiFallback",true]]){
  const el=$(id),prior=empty?previousFallback:previousModel;el.replaceChildren();
  if(empty)el.add(new Option("No fallback",""));
  for(const model of options)el.add(new Option(model,model));
  if(prior&&!options.includes(prior))el.add(new Option(prior+" (not verified)",prior));
  el.value=prior&&(options.includes(prior)||!modelCatalog[tier].length)?prior:empty?"":options[0]||"";
 }
}
function apiError(response,data){const err=new Error(data?.error?.message||"Gemini request failed ("+response.status+")");err.status=response.status;return err}
async function verifyKey(tier){
 const key=getKey(tier);if(!key){$("aiKeyStatus").textContent="Enter a "+tier+" API key.";return}
 const button=$(tier==="paid"?"aiVerifyPaid":"aiVerifyFree");button.disabled=true;$("aiKeyStatus").textContent="Verifying "+tier+" key...";
 try{
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",{headers:{"x-goog-api-key":key}});
  const data=await response.json();if(!response.ok)throw apiError(response,data);
  const models=[...new Set((data.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/^models\/gemini-/.test(m.name)&&!/image|audio|tts|robotics|embedding/i.test(m.name)).map(m=>modelName(m.name)))];
  if(!models.length)throw Error("No text generation models returned by this key.");
  modelCatalog[tier]=models;saveKeys();if($("aiTier").value===tier)populateModels();
  $("aiKeyStatus").textContent=tier+" key verified · "+models.length+" available models. Model availability and billing depend on Google account settings.";
 }catch(e){$("aiKeyStatus").textContent="Verification failed: "+e.message}finally{button.disabled=false}
}
const requestCandidates=()=>{
 const primary=$("aiModel").value.trim(),fallback=$("aiFallback").value.trim();
 if(!primary)throw Error("Choose a primary model.");
 return [primary,...($("aiAllowFallback").checked&&fallback&&fallback!==primary?[fallback]:[])];
};
async function generate(model,key,history){
 const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
  method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
  body:JSON.stringify({contents:history,generationConfig:{temperature:0.5}})
 });
 const data=await response.json();if(!response.ok)throw apiError(response,data);
 const parts=data.candidates?.[0]?.content?.parts||[];
 const answer=parts.filter(p=>typeof p.text==="string").map(p=>p.text).join("\n").trim();
 if(!answer)throw Error("No text returned by Gemini"+(data.promptFeedback?.blockReason?" ("+data.promptFeedback.blockReason+")":"")+".");
 return {answer,usage:data.usageMetadata||{}};
}
$("aiSend").onclick=async()=>{
 if(sending)return;
 const t=current,question=$("aiQuestion").value.trim(),tier=$("aiTier").value,connection=$("aiConnection").value;
 if(connection!=="browser"){$("aiStatus").textContent="Select Browser · Gemini and save preferences first.";return}
 if(!t||!topics().includes(t)||!question){$("aiStatus").textContent="Open a session and enter a question.";return}
 if(question.length>12000){$("aiStatus").textContent="Keep questions under 12,000 characters.";return}
 const key=getKey(tier);if(!key){$("aiSettings").open=true;$("aiStatus").textContent="Enter a "+tier+" Gemini key in AI Settings.";return}
 let models;try{models=requestCandidates();saveKeys()}catch(e){$("aiStatus").textContent=e.message;return}
 const userMessage={messageId:uuid(),role:"user",content:question,createdAt:stamp(),contextScope:"public_market_only",includedPosition:false,status:"saved_not_sent"};
 const history=(t.messages||[]).filter(m=>(m.role==="user"&&m.status==="complete")||(m.role==="assistant"&&m.status==="complete")).slice(-28).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content)}]}));
 history.push({role:"user",parts:[{text:question}]});
 sending=true;$("aiSend").disabled=true;$("aiStatus").textContent="Sending to Gemini ("+tier+")...";
 try{
  let result,usedModel;
  for(let i=0;i<models.length;i++){
   try{result=await generate(models[i],key,history);usedModel=models[i];break}
   catch(e){if(i===models.length-1||![429,500,502,503,504].includes(e.status))throw e;$("aiStatus").textContent="Primary unavailable; trying same-tier fallback..."}
  }
  if(!topics().includes(t))throw Error("Original session no longer exists; response was not saved.");
  userMessage.status="complete";userMessage.tier=tier;userMessage.model=usedModel;
  t.messages.push(userMessage,{messageId:uuid(),role:"assistant",content:result.answer,createdAt:stamp(),contextScope:"public_market_only",includedPosition:false,status:"complete",model:usedModel,tier,usage:result.usage});
  t.lastUsedModel=usedModel;t.tierPreference=tier;t.updatedAt=stamp();t.revision++;
  await persist();if(current===t)$("aiQuestion").value="";
  $("aiStatus").textContent="Gemini response saved locally · "+usedModel+" · "+tier+" tier.";
 }catch(e){$("aiStatus").textContent="Gemini error: "+e.message+" — question remains in editor for retry."}
 finally{sending=false;$("aiSend").disabled=false}
};
$("aiVerifyFree").onclick=()=>verifyKey("free");
$("aiVerifyPaid").onclick=()=>verifyKey("paid");
$("aiForgetKeys").onclick=forgetKeys;
$("aiTier").onchange=populateModels;
$("aiFreeKey").onchange=saveKeys;
$("aiPaidKey").onchange=saveKeys;
$("aiRememberKeys").onchange=saveKeys;
loadKeys();

try{const p=JSON.parse(localStorage.getItem(prefsKey)||"{}");$("aiConnection").value=["local","azure","browser"].includes(p.connection)?p.connection:"local";$("aiTier").value=p.tier==="paid"?"paid":"free";$("aiModel").dataset.preference=String(p.model||"");$("aiFallback").dataset.preference=String(p.fallback||"");$("aiAllowFallback").checked=!!p.allowFallback}catch(e){}
populateModels();
$("aiSaveSettings").onclick=()=>{try{localStorage.setItem(prefsKey,JSON.stringify({connection:$("aiConnection").value,tier:$("aiTier").value,model:$("aiModel").value.trim(),fallback:$("aiFallback").value.trim(),allowFallback:$("aiAllowFallback").checked}));saveKeys();$("aiStatus").textContent="AI preferences saved. "+($("aiConnection").value==="browser"?"Browser Gemini ready for a verified key.":"Select Browser · Gemini to send questions.")}catch(e){$("aiStatus").textContent="Preferences could not be saved."}};
$("aiSavedPrompt").onchange=()=>{const p=(state.aiPrompts||[]).find(p=>p.promptId===$("aiSavedPrompt").value);if(p&&current)$("aiQuestion").value=String(p.text||"").replaceAll("{{TICKER}}",current.topicKey)};
window.addEventListener("market-portfolio-sync-complete",draw);
window.addEventListener("market-portfolio-prompts-changed",draw);
window.MarketPortfolioAI={openTopic};
})();
