import {healthSignals} from './operational-health.mjs';
import {workerNames} from './worker-health.mjs';
import {integritySignals} from './integrity-health.mjs';
export const alertSignals=Object.freeze([...healthSignals.map(x=>`queue.${x}`),...workerNames.map(x=>`worker.${x}`),...integritySignals.map(x=>`integrity.${x}`),'collector.queue','collector.worker','collector.integrity']);
const severities=['clear','warning','critical','unknown'],states=['ready','sending','accepted','failed','unknown'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export const emptyAlertState=()=>({schema_version:1,revision:0,sequence:0,collection_epoch:0,incidents:{},outbox:[]});
export function validateAlertState(value){
  const fail=()=>{throw Error('Invalid local monitoring state; preserve it for review.');};
  if(!exact(value,['schema_version','revision','sequence','collection_epoch','incidents','outbox'])||value.schema_version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Number.isSafeInteger(value.collection_epoch)||value.collection_epoch<0||!Number.isSafeInteger(value.sequence)||value.sequence<0||!object(value.incidents)||!Array.isArray(value.outbox)||value.outbox.length>64)fail();
  const keys=new Set();
  for(const event of value.outbox){
    if(!exact(event,['key','signal','severity','active','state','attempts'])||!alertSignals.includes(event.signal)||!severities.includes(event.severity)||!states.includes(event.state)||event.active!==(event.severity!=='clear')||typeof event.key!=='string'||!event.key.startsWith(`${event.signal}:`)||!/^\d+$/.test(event.key.slice(event.signal.length+1))||!Number.isSafeInteger(event.attempts)||event.attempts<0||event.attempts>100||keys.has(event.key))fail();keys.add(event.key);
  }
  for(const [signal,item]of Object.entries(value.incidents))if(!alertSignals.includes(signal)||!exact(item,['severity','active','acknowledged','event_key'])||!severities.includes(item.severity)||item.active!==(item.severity!=='clear')||typeof item.acknowledged!=='boolean'||(item.event_key!==null&&!keys.has(item.event_key)))fail();
  return value;
}
export function advanceAlerts(previous,observations){
  validateAlertState(previous);
  if(!object(observations)||Object.entries(observations).some(([key,value])=>!alertSignals.includes(key)||!severities.includes(value)))throw Error('Invalid monitoring observations.');
  const next=structuredClone(previous);
  for(const signal of alertSignals){const severity=observations[signal]??'unknown',old=next.incidents[signal];
    if(old?.severity===severity)continue;
    let key=null;
    if(old||severity!=='clear'){
      if(next.outbox.length>=64)throw Error('Local alert outbox full; archive under an approved procedure before continuing.');
      key=`${signal}:${++next.sequence}`;next.outbox.push({key,signal,severity,active:severity!=='clear',state:'ready',attempts:0});
    }
    next.incidents[signal]={severity,active:severity!=='clear',acknowledged:false,event_key:key};
  }
  next.revision++;return validateAlertState(next);
}
export function acknowledgeAlert(previous,signal,eventKey){
  validateAlertState(previous);const next=structuredClone(previous),item=next.incidents[signal];
  if(!item||item.event_key!==eventKey||!item.active)throw Error('Incident changed; refresh before acknowledgement.');
  item.acknowledged=true;next.revision++;return next;
}
/** Persist before delivery. An abandoned send or uncertain response remains
 * unknown and is never automatically resent. Accepted != human acknowledgement. */
export async function dispatchLocalAlerts(store,deliver,{timeoutMs=8000}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid alert transport deadline.');
  return store.withLock(async transaction=>{
    const state=validateAlertState(await transaction.read());
    for(const event of state.outbox)if(event.state==='sending')event.state='unknown';
    await transaction.write(state);
    let sent=0;
    for(const event of state.outbox){
      if(event.state!=='ready')continue;
      if(sent++===4)break;
      if(event.attempts>=100)throw Error('Alert attempt limit reached.');
      event.state='sending';event.attempts++;state.revision++;await transaction.write(state);
      const controller=new AbortController();let timer;
      try{const result=await Promise.race([Promise.resolve().then(()=>deliver({key:event.key,signal:event.signal,severity:event.severity,active:event.active},{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Alert transport timed out'));},timeoutMs);})]);event.state=['accepted','failed'].includes(result)?result:'unknown';}catch{event.state='unknown';}finally{clearTimeout(timer);}
      state.revision++;await transaction.write(state);
    }
    return state;
  });
}
