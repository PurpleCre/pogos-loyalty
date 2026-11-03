import {collectOperationalHealth} from './operational-health.mjs';
import {evaluateWorkerHealth,validateWorkerPolicy} from './worker-health.mjs';
import {advanceAlerts,dispatchLocalAlerts} from './monitoring-alerts.mjs';
import {collectIntegrityHealth} from './integrity-health.mjs';
export async function collectWorkerHealth(client,policy,{now=Date.now,timeoutMs=8000}={}){
  const unknown=reason=>({status:'unknown',reason,workers:[]});let timer;const controller=new AbortController();
  try{
    validateWorkerPolicy(policy);if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return unknown('collector_configuration_invalid');
    const result=await Promise.race([Promise.resolve().then(()=>client.rpc('worker_health_snapshot',{}).abortSignal(controller.signal).retry(false)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Timeout'));},timeoutMs);})]);
    return result.error?unknown('collection_failed'):evaluateWorkerHealth(result.data,policy,now());
  }catch{return unknown(controller.signal.aborted?'collection_timeout':'collection_failed');}finally{clearTimeout(timer);}
}
/** Server job entrypoint with injected approved client/store/provider. This
 * installs no schedule and has no environment/URL/recipient discovery. */
export async function runMonitoringCycle({client,queuePolicy,workerPolicy,integrityPolicy,store,deliver,now=Date.now}){
  const epoch=await store.withLock(async tx=>{const state=await tx.read();state.collection_epoch++;state.revision++;await tx.write(state);return state.collection_epoch;});
  let [queue,workers,integrity]=await Promise.all([collectOperationalHealth(client,queuePolicy,{now}),collectWorkerHealth(client,workerPolicy,{now}),collectIntegrityHealth(client,integrityPolicy,{now})]);
  await store.withLock(async tx=>{
    const state=await tx.read();if(state.collection_epoch!==epoch)throw Error('Monitoring cycle superseded; discard its observations.');
    // A slow integrity scan must not let an earlier fast sample clear an
    // incident after that sample has become stale. Check again under the lock.
    const checkedAt=now();
    const current=(result,policy,field)=>{
      if(!result.observed_at)return result;
      const age=checkedAt-Date.parse(result.observed_at);
      if(!Number.isFinite(age)||age<0||age>policy.max_snapshot_age_seconds*1000)return {status:'unknown',reason:'snapshot_stale_at_commit',[field]:[]};
      return Object.hasOwn(result,'snapshot_age_seconds')?{...result,snapshot_age_seconds:Math.floor(age/1000)}:result;
    };
    queue=current(queue,queuePolicy,'metrics');workers=current(workers,workerPolicy,'workers');integrity=current(integrity,integrityPolicy,'metrics');
    const observations=Object.fromEntries([
      ...queue.metrics.map(x=>[`queue.${x.signal}`,x.status]),...workers.workers.map(x=>[`worker.${x.worker}`,x.status]),...integrity.metrics.map(x=>[`integrity.${x.signal}`,x.status]),
      ['collector.queue',queue.observed_at?'clear':'unknown'],['collector.worker',workers.observed_at?'clear':'unknown'],['collector.integrity',integrity.observed_at?'clear':'unknown'],
    ]);
    await tx.write(advanceAlerts(state,observations));
  });
  const state=await dispatchLocalAlerts(store,deliver);
  return {queue,workers,integrity,alerts:{active:Object.values(state.incidents).filter(x=>x.active).length,unknown_delivery:state.outbox.filter(x=>x.state==='unknown').length,ready:state.outbox.filter(x=>x.state==='ready').length,accepted:state.outbox.filter(x=>x.state==='accepted').length},revision:state.revision};
}
