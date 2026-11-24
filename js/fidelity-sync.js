(function(){
"use strict";
// Connected Fidelity import: data moves only after explicit user action from the
// Entra-authenticated Azure viewer to this browser. Nothing is committed to GitHub.
const AZURE_ORIGIN="https://market-portfolio-gateway-dafrbba7grdjgbhn.westus3-01.azurewebsites.net";
const MESSAGE_TYPE="market-portfolio:fidelity-v1";
const button=document.getElementById("fidelity-sync-open");
const message=document.getElementById("fidelity-sync-status");
const details=document.getElementById("fidelity-sync-details");
const paste=document.getElementById("fidelity-sync-paste");
const pasteButton=document.getElementById("fidelity-sync-paste-apply");
const loginButton=document.getElementById("fidelity-login");
const diagnosticButton=document.getElementById("fidelity-diagnostic");
if(!button||!message||!details||!paste||!pasteButton||!loginButton||!diagnosticButton)return;
let popup=null,nonce=null,working=false;
const validNumber=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const number=v=>Number(v);
const text=v=>String(v??"").trim();
const isFidelity=a=>text(a.broker).toLowerCase()==="fidelity";
const isConnected=a=>a.connected?.provider==="snaptrade";
const checkedMoney=v=>validNumber(v)?number(v):null;
const fmtMoney=n=>n==null?"Unavailable":money(n);
function connectedAccounts(){return state.accounts.filter(a=>isFidelity(a)&&isConnected(a))}
function showStatus(s){message.textContent=s}
function renderConnected(){
 const list=connectedAccounts();
 if(!list.length){details.textContent="No connected Fidelity accounts have been loaded into this browser. Existing CSV entries will be replaced on the first successful import.";return}
 const last=list.map(a=>a.connected.syncedAt).filter(Boolean).sort().at(-1);
 details.replaceChildren();
 const p=document.createElement("p");
 p.textContent=list.length+" Fidelity accounts connected via SnapTrade. Last dashboard sync: "+(last?new Date(last).toLocaleString():"unknown")+".";
 details.append(p);
 const ul=document.createElement("ul");
 for(const a of list){
  const li=document.createElement("li"),c=a.connected;
  li.textContent=a.name+": "+fmtMoney(c.reportedEquity)+" reported equity; "+(c.positionCount??0)+" positions; "+(c.basisMissing||0)+" missing basis; provider as-of "+(c.asOf||"unknown");
  ul.append(li);
 }
 details.append(ul);
 const note=document.createElement("p");
 note.className="muted";
 note.textContent="Fidelity totals use SnapTrade-reported equity. Reported cash overlapping SPAXX/FDRXX is shown for reference but not added twice.";
 details.append(note);
}
// Primary path: direct authenticated GET to Azure. Browser must allow the
// approved GitHub Pages origin with credentials; Azure still checks Entra OID.
async function refreshDirect(){
 if(working)return;
 button.disabled=true;
 showStatus("Connecting securely to Azure and requesting the Fidelity snapshot...");
 try{
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),45000);
  let response;
  try{
   response=await fetch(AZURE_ORIGIN+"/api/brokerage/fidelity/preview",{
    method:"GET",mode:"cors",credentials:"include",cache:"no-store",
    headers:{"Accept":"application/json"},signal:ctrl.signal
   });
  }finally{clearTimeout(timeout)}
  if(response.status===401||response.status===403){
   showStatus("Microsoft sign-in is required or this identity is not authorized ("+response.status+"). Use Sign in / reconnect, then Refresh Fidelity.");
   return;
  }
  const type=response.headers.get("content-type")||"";
  if(!response.ok||!type.includes("application/json")){
   let detail="";if(type.includes("application/json"))try{detail=(await response.json()).error||""}catch(_){}
   throw Error("Azure HTTP "+response.status+(detail?": "+detail:""));
  }
  const data=await response.json();
  // Reuse the same validation and explicit confirmation as the existing import.
  await receiveSnapshot(data);
 }catch(error){
  showStatus(error?.name==="AbortError"?
   "Fidelity request timed out; no records changed.":
   error instanceof TypeError?
   "Browser could not read the secure Azure response. Sign in using the same browser, then retry. If this persists, Azure cross-origin credential/CORS settings may need updating. Existing data was not changed.":
   "Refresh failed: "+String(error.message||error)+". Existing data was not changed.");
 }finally{button.disabled=false}
}
button.addEventListener("click",()=>void refreshDirect());
loginButton.addEventListener("click",()=>{
 const win=window.open(AZURE_ORIGIN+"/.auth/login/aad","marketPortfolioAzureLogin");
 if(!win)showStatus("Allow pop-ups for this site to open the Microsoft sign-in page.");
 else showStatus("Complete Microsoft sign-in in the new window, then return here and click Refresh Fidelity.");
});
diagnosticButton.addEventListener("click",()=>{
 const win=window.open(AZURE_ORIGIN+"/api/brokerage/fidelity","marketPortfolioFidelityDiagnostic");
 if(!win)showStatus("Allow pop-ups to open the secure diagnostic viewer.");
});
function prepare(payload){
 if(!payload||payload.source!=="SnapTrade Commercial Test / Fidelity"||!Array.isArray(payload.accounts))throw Error("Unexpected brokerage preview format.");
 if(payload.accounts.length!==payload.investmentAccountCount||payload.accounts.length===0)throw Error("Incomplete account list. No records changed.");
 if(payload.accounts.length!==5)throw Error("Expected 5 connected Fidelity accounts, received "+payload.accounts.length+". Review connection scope before replacing records.");
 const ids=new Set(),converted=[];
 for(const a of payload.accounts){
  const id=text(a.id),name=text(a.name),balance=a.balances;
  const equity=balance?.netValue?.amount??a.reportedNetValue?.amount;
  const currency=text(balance?.netValue?.currency||a.reportedNetValue?.currency||"USD");
  if(!id||ids.has(id)||!name||!Array.isArray(a.positions)||!balance||!validNumber(equity)||!Number.isFinite(Number(equity))||currency!=="USD"||a.errors?.length)throw Error("Incomplete or duplicate account: "+(name||"unnamed")+". No records changed.");
  ids.add(id);
  const positions=[],positionIds=new Set();
  let positionTotal=0,moneyMarketValue=0,basisMissing=0;
  for(const p of a.positions){
   const symbol=text(p.symbol).toUpperCase(),units=checkedMoney(p.units),price=checkedMoney(p.price);
   const pc=text(p.currency||"USD");
   if(!symbol||units===null||units<0||price===null||price<0||pc!=="USD")throw Error("Missing or unsupported position data for "+name+". No records changed.");
   const basisUnit=checkedMoney(p.costBasisPerUnit);
   const instrumentId=text(p.instrumentId);
   const key=instrumentId||symbol;
   const occurrence=positions.filter(x=>x.providerPositionKey===key).length+1;
   const positionId="snaptrade:"+id+":"+key+":"+occurrence;
   if(positionIds.has(positionId))throw Error("Duplicate provider position identity in "+name);
   positionIds.add(positionId);
   const isMoney=p.cashEquivalent===true||["SPAXX","FDRXX"].includes(symbol);
   const marketValue=units*price;
   const totalBasis=basisUnit===null?null:units*basisUnit;
   if(totalBasis===null)basisMissing++;
   positionTotal+=marketValue;
   if(isMoney)moneyMarketValue+=marketValue;
   positions.push({id:positionId,accountId:"snaptrade:"+id,providerPositionKey:key,
    instrumentId:instrumentId||null,symbol,description:text(p.description),quantity:units,
    price,marketValue,kind:isMoney?"money":"security",basis:totalBasis,
    currency:"USD",quoteSource:"SnapTrade / Fidelity",quoteAsOf:a.positionsAsOf||balance.asOf||payload.retrievedAt,
    source:"snaptrade",basketId:null});
  }
  const rawCash=Array.isArray(balance.cash)?balance.cash.filter(c=>text(c.currency)==="USD"&&validNumber(c.amount)).reduce((v,c)=>v+number(c.amount),0):null;
  converted.push({id:"snaptrade:"+id,providerId:id,name,
    ownerId:"me",broker:"Fidelity",type:text(a.accountType)||"Other",positions,
    connected:{provider:"snaptrade",reportedEquity:number(equity),currency:"USD",
     reportedCash:rawCash,flaggedMoneyMarketValue:moneyMarketValue,
     reconstructedPositionValue:positionTotal,basisMissing,positionCount:positions.length,
     asOf:balance.asOf||a.positionsAsOf||null,positionsAsOf:a.positionsAsOf||null,
     syncedAt:payload.retrievedAt||new Date().toISOString(),maskedAccountNumber:text(a.maskedAccountNumber),
     institutionId:text(a.institutionId),cashOrMargin:text(balance.cashOrMargin)}});
 }
 return converted;
}
function matchOldBasket(oldAccounts,oldHoldings,oldAccount,position){
 const candidates=oldHoldings.filter(h=>h.symbol===position.symbol&&h.basketId&&oldAccounts.some(a=>a.id===h.accountId));
 const named=candidates.filter(h=>{
   const old=oldAccounts.find(a=>a.id===h.accountId);
   return old&&text(old.name).toLowerCase()===text(oldAccount.name).toLowerCase();
 });
 if(named.length===1)return named[0].basketId;
 const distinct=[...new Set(candidates.map(h=>h.basketId))];
 return distinct.length===1?distinct[0]:null;
}
function buildReplacement(converted){
 const next={...state};
 const obsolete=state.accounts.filter(isFidelity);
 const oldIds=new Set(obsolete.map(a=>a.id));
 const oldHoldings=state.holdings.filter(h=>oldIds.has(h.accountId));
 const oldHoldingIds=new Set(oldHoldings.map(h=>h.id));
 const oldByProvider=new Map(state.accounts.filter(a=>isFidelity(a)&&isConnected(a)).map(a=>[a.id,a]));
 for(const incoming of converted){
  const previous=oldByProvider.get(incoming.id);
  const previousCount=previous?state.holdings.filter(h=>h.accountId===previous.id).length:0;
  if(previousCount>0&&incoming.positions.length===0&&incoming.connected.reportedEquity!==0)
   throw Error("Previously funded account "+incoming.name+" returned no positions. Refusing incomplete refresh.");
 }
 const owner=state.owners.find(o=>o.id==="me")||state.owners.find(o=>o.primary);
 if(!owner)throw Error("No primary owner group found.");
 const accountsToAdd=converted.map(x=>{
  const old=oldByProvider.get(x.id);
  return {id:x.id,broker:"Fidelity",name:x.name,type:x.type,ownerId:old?.ownerId||owner.id,
   source:"snaptrade",connected:x.connected};
 });
 const newHoldings=[];
 for(const a of converted){
  const oldConnected=state.holdings.filter(h=>h.accountId===a.id);
  for(const h of a.positions){
   const same=oldConnected.find(x=>x.id===h.id);
   const basketId=same?.basketId||matchOldBasket(obsolete,oldHoldings,a,h)||null;
   // Keep locally verified reference data and annotations without modifying
   // broker-owned quantity, price, basis or reported account equity.
   const kept=same?{
     previousClose:same.previousClose??null,
     previousCloseSource:same.previousCloseSource||null,
     previousCloseAsOf:same.previousCloseAsOf||null,
     localNotes:same.localNotes||null
   }:{};
   newHoldings.push({...h,...kept,basketId});
  }
 }
 next.accounts=[...state.accounts.filter(a=>!oldIds.has(a.id)),...accountsToAdd];
 next.holdings=[...state.holdings.filter(h=>!oldIds.has(h.accountId)),...newHoldings];
 // Provider cash duplicates SPAXX/FDRXX in the tested Fidelity feed.
 // Keep it in connected metadata, but no independent cash entry is created.
 next.cash=state.cash.filter(c=>!oldIds.has(c.accountId));
 next.pendingAdjustments=state.pendingAdjustments.filter(p=>!oldIds.has(p.accountId));
 next.reconciliations=state.reconciliations.filter(r=>!oldIds.has(r.parentAccountId)&&!oldIds.has(r.childAccountId));
 next.transactions=state.transactions.filter(t=>!oldIds.has(t.accountId)&&!oldHoldingIds.has(t.holdingId));
 // Preserve custom dividend profiles for the same stable SnapTrade holding IDs.
 const newIds=new Set(newHoldings.map(h=>h.id));
 next.dividends=state.dividends.filter(d=>!oldHoldingIds.has(d.holdingId)||newIds.has(d.holdingId));
 // Keep non-Fidelity manual data, owner groups, baskets, watchlists and historical snapshots.
 return {next,removed:obsolete.length,positions:newHoldings.length};
}
async function receiveSnapshot(payload){
 if(working)return;
 working=true;button.disabled=true;pasteButton.disabled=true;
 try{
  const converted=prepare(payload);
  const previous=state.accounts.filter(isFidelity);
  const sum=converted.reduce((n,a)=>n+a.connected.reportedEquity,0);
  const rows=converted.map(a=>a.name+" - "+fmtMoney(a.connected.reportedEquity)+" ("+a.positions.length+" positions)").join("\n");
  const ok=confirm("REPLACE / REFRESH Fidelity records in this browser?\n\n"+rows+
   "\n\n"+converted.length+" connected accounts; reported equity "+fmtMoney(sum)+
   "\nRefresh "+previous.length+" existing Fidelity account records, replacing old Fidelity holdings/cash/adjustments. Local dividend profiles on matching connected positions are retained."+
   "\nAll other brokerages stay unchanged. No extra backup will be created.\n\nConfirm only if ALL accounts above are Fidelity.");
  if(!ok){showStatus("Replacement canceled. Nothing changed.");return}
  const built=buildReplacement(converted);
  const old=state;
  try{state=built.next;await save()}
  catch(e){state=old;render();throw e}
  showStatus("Fidelity refreshed: "+converted.length+" connected accounts and "+built.positions+" positions. Source snapshot "+(payload.retrievedAt||"time unknown")+". Replaced "+built.removed+" Fidelity account records; unrelated brokers untouched.");
  paste.value=""; // Do not retain a second copy of the private snapshot in the input field.
  nonce=null;
  renderConnected();
 }catch(e){showStatus("Fidelity not replaced: "+String(e.message||e));}
 finally{working=false;button.disabled=false;pasteButton.disabled=false}
}

window.addEventListener("message",event=>{
 if(event.origin!==AZURE_ORIGIN||event.source!==popup||!nonce||event.data?.type!==MESSAGE_TYPE||event.data?.nonce!==nonce)return;
 void receiveSnapshot(event.data.payload);
});
pasteButton.addEventListener("click",()=>{
 let data;
 try{data=JSON.parse(paste.value);}
 catch(_){showStatus("Paste the complete Fidelity snapshot JSON copied from the secure Azure viewer.");return}
 if(!data||data.transferFormat!=="market-portfolio-fidelity-snapshot-v1"||!data.payload){showStatus("Unrecognized Fidelity snapshot. Use Copy for dashboard in the secure viewer.");return}
 void receiveSnapshot(data.payload);
});
const previousRender=render;
render=function(){previousRender();renderConnected()};
renderConnected();
})();