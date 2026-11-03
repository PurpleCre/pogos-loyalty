// Server/operator utilities only; never import this module into a mobile bundle.
export const healthSignals=Object.freeze(['cash_expiry_due','reward_expiry_due','push_send_due','push_receipt_due','push_lease_overdue','push_unknown','cash_custody_open','finance_variance_open']);
export const missingHealthCoverage=Object.freeze(['worker_heartbeats','unmaterialised_push_events','loyalty_ledger_reconciliation','runtime_capacity','backup_freshness','alert_delivery']);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const fail=()=>{throw Error('Invalid operational health policy. No submitted values are logged.');};

export function validateHealthPolicy(policy){
  if(!keys(policy,['max_snapshot_age_seconds','rules'])||!keys(policy.rules,healthSignals))fail();
  if(policy.max_snapshot_age_seconds!==null&&(!integer(policy.max_snapshot_age_seconds,86400)||policy.max_snapshot_age_seconds<1))fail();
  for(const name of healthSignals){
    const rule=policy.rules[name];if(rule===null)continue;
    if(!keys(rule,['warning_count','critical_count','warning_age_seconds','critical_age_seconds']))fail();
    let configured=false;
    for(const [warning,critical,max] of [['warning_count','critical_count',1000],['warning_age_seconds','critical_age_seconds',31536000]]){
      if(rule[warning]===null&&rule[critical]===null)continue;
      if(!integer(rule[warning],max)||rule[warning]<1||!integer(rule[critical],max)||rule[critical]<rule[warning])fail();
      configured=true;
    }
    if(!configured)fail();
  }
  return policy;
}
const unknown=reason=>({status:'unknown',reason,scope:'all-branches',coverage:'queue-state-only',missing_coverage:[...missingHealthCoverage],metrics:[]});
function snapshotValid(snapshot){
  if(!keys(snapshot,['schema_version','scope','coverage','observed_at','metrics'])||snapshot.schema_version!==1||snapshot.scope!=='all-branches'||snapshot.coverage!=='queue-state-only'||!keys(snapshot.metrics,healthSignals))return false;
  if(typeof snapshot.observed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.observed_at))return false;
  const time=Date.parse(snapshot.observed_at);if(!Number.isFinite(time)||new Date(time).toISOString()!==snapshot.observed_at)return false;
  return healthSignals.every(name=>{
    const value=snapshot.metrics[name];
    return keys(value,['count','clipped','oldest_age_seconds'])&&integer(value.count,1000)&&typeof value.clipped==='boolean'&&(!value.clipped||value.count===1000)&&
      (value.count===0?value.oldest_age_seconds===null:integer(value.oldest_age_seconds));
  });
}
export function evaluateOperationalHealth(snapshot,policy,now=Date.now()){
  try{
    try{validateHealthPolicy(policy);}catch{return unknown('policy_invalid');}
    if(!snapshotValid(snapshot))return unknown('snapshot_invalid');
    if(!Number.isFinite(now))return unknown('clock_invalid');
    if(policy.max_snapshot_age_seconds===null)return unknown('freshness_unconfigured');
    const age=now-Date.parse(snapshot.observed_at);
    if(age<0)return unknown('snapshot_in_future');
    if(age>policy.max_snapshot_age_seconds*1000)return unknown('snapshot_stale');
    const metrics=healthSignals.map(signal=>{
      const value=snapshot.metrics[signal],rule=policy.rules[signal];
      let status='clear',reason='below_configured_thresholds';
      if(rule===null){status='unknown';reason='rule_unconfigured';}
      else{
        const count=bound=>rule[bound]!==null&&value.count>=rule[bound];
        const age=bound=>rule[bound]!==null&&value.oldest_age_seconds!==null&&value.oldest_age_seconds>=rule[bound];
        if(count('critical_count')||age('critical_age_seconds')){status='critical';reason='critical_threshold';}
        else if(count('warning_count')||age('warning_age_seconds')){status='warning';reason='warning_threshold';}
        else if(value.clipped){status='unknown';reason='count_clipped';}
      }
      return {signal,status,reason,count:value.count,clipped:value.clipped,oldest_age_seconds:value.oldest_age_seconds};
    });
    const status=['critical','warning','unknown'].find(state=>metrics.some(value=>value.status===state))??'clear';
    return {status,scope:'all-branches',coverage:'queue-state-only',observed_at:snapshot.observed_at,snapshot_age_seconds:Math.floor(age/1000),missing_coverage:[...missingHealthCoverage],metrics};
  }catch{return unknown('snapshot_invalid');}
}

/** Fixed read-only RPC through a server-owned SDK client. Never logs backend
 * errors. A timeout/cancellation is unknown, not an empty healthy result. */
export async function collectOperationalHealth(client,policy,{now=Date.now,timeoutMs=8000}={}){
  try{validateHealthPolicy(policy);}catch{return unknown('policy_invalid');}
  if(!integer(timeoutMs,30000)||timeoutMs<1)return unknown('collector_configuration_invalid');
  const controller=new AbortController();let timer;
  try{
    const result=await Promise.race([
      Promise.resolve().then(()=>client.rpc('operational_health_snapshot',{}).abortSignal(controller.signal).retry(false)),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Collection timeout'));},timeoutMs);}),
    ]);
    if(result.error)return unknown('collection_failed');
    return evaluateOperationalHealth(result.data,policy,now());
  }catch{return unknown(controller.signal.aborted?'collection_timeout':'collection_failed');}
  finally{clearTimeout(timer);}
}
