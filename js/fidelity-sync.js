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
if(!button||!message||!details||!paste||!pasteButton)return;
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
  li.textContent=a.name+": "+fmtMoney(c.reportedEquity)+" reported equity; "+(c.positionCount??0)+" positions; provider data "+(c.asOf||"timestamp unavailable");
  ul.append(li);
 }
 details.append(ul);
 const note=document.createElement("p");
 note.className="muted";
 note.textContent="Fidelity totals use SnapTrade-reported equity. Reported cash overlapping SPAXX/FDRXX is shown for reference but not added twice.";
 details.append(note);
}
button.addEventListener("click",()=>{
 if(working)return;
 nonce=crypto.randomUUID();
 const url=AZURE_ORIGIN+"/api/brokerage/fidelity?sync="+encodeURIComponent(nonce);
 popup=window.open(url,"marketPortfolioFidelitySync");
 if(!popup){showStatus("Your browser blocked the Fidelity window. Allow pop-ups for this site and try again.");return}
 showStatus("In the secure Fidelity window, click Retrieve Fidelity preview, then Send to Market Portfolio.");
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
   newHoldings.push({...h,basketId});
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
 next.dividends=state.dividends.filter(d=>!oldHoldingIds.has(d.holdingId));
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
  const ok=confirm("REPLACE Fidelity records in this browser?\n\n"+rows+
   "\n\n"+converted.length+" connected accounts; reported equity "+fmtMoney(sum)+
   "\nRemove "+previous.length+" existing Fidelity account records and their old holdings, cash, adjustments and related transaction/dividend records."+
   "\nAll other brokerages stay unchanged. No extra backup will be created.\n\nConfirm only if ALL accounts above are Fidelity.");
  if(!ok){showStatus("Replacement canceled. Nothing changed.");return}
  const built=buildReplacement(converted);
  const old=state;
  try{state=built.next;await save()}
  catch(e){state=old;render();throw e}
  showStatus("Fidelity sync complete: "+converted.length+" connected accounts, "+built.positions+" positions. Replaced "+built.removed+" old Fidelity accounts.");
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