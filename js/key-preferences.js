/* Per-browser opt-in API key storage. Never included in IndexedDB portfolio, JSON exports or GitHub. */
(function(){
"use strict";
const defs=[
 {id:"fh-key",label:"Finnhub",slug:"finnhub"},
 {id:"fmp-key",label:"FMP",slug:"fmp"}
];
for(const def of defs){
 const input=document.getElementById(def.id);if(!input)continue;
 const sessionKey="portfolio-keys-session-"+def.slug;
 const persistentKey="portfolio-keys-remember-"+def.slug;
 const parent=input.closest("label")||input.parentElement;
 const options=document.createElement("div");
 options.className="actions";
 const rememberLabel=document.createElement("label");
 rememberLabel.style.cssText="display:inline-flex;align-items:center;gap:7px;font-size:13px";
 const checkbox=document.createElement("input");
 checkbox.type="checkbox";checkbox.style.width="auto";
 const desc=document.createElement("span");desc.textContent="Remember key on this device (less secure)";
 rememberLabel.append(checkbox,desc);
 const clear=document.createElement("button");clear.type="button";clear.className="btn secondary";clear.textContent="Forget "+def.label+" key";
 options.append(rememberLabel,clear);
 const warning=document.createElement("small");
 warning.textContent="Default: remembered only in this browser tab (including reloads). Device remembering uses localStorage; scripts and browser extensions on this origin can access it. Do not use on shared computers.";
 parent.insertAdjacentElement("afterend",options);
 options.insertAdjacentElement("afterend",warning);
 let persisted="";let inSession="";
 try{persisted=localStorage.getItem(persistentKey)||"";inSession=sessionStorage.getItem(sessionKey)||""}catch(e){}
 if(persisted){input.value=persisted;checkbox.checked=true}else if(inSession){input.value=inSession}
 const keep=()=>{
  let key=input.value.trim();
  try{
   if(key)sessionStorage.setItem(sessionKey,key);else sessionStorage.removeItem(sessionKey);
   if(checkbox.checked&&key)localStorage.setItem(persistentKey,key);
   else localStorage.removeItem(persistentKey);
  }catch(e){warning.textContent="Browser storage is blocked. Key remains in this page only."}
 };
 input.addEventListener("input",keep);
 input.addEventListener("change",keep);
 checkbox.addEventListener("change",keep);
 clear.addEventListener("click",()=>{
  input.value="";checkbox.checked=false;
  try{sessionStorage.removeItem(sessionKey);localStorage.removeItem(persistentKey)}catch(e){}
  const s=document.getElementById(def.slug==="finnhub"?"fh-status":"fmp-status");
  if(s)s.textContent=def.label+" key cleared from this browser. Existing data is unchanged.";
 });
 // Existing Finnhub Clear API key control must also forget stored versions.
 if(def.slug==="finnhub"){
  const legacy=document.getElementById("fh-clear");
  legacy?.addEventListener("click",()=>clear.click());
 }
}
})();