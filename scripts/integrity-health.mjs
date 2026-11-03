export const integritySignals=Object.freeze(['loyalty_mismatches','push_materialisation_due']);
const keys=(value,names)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
export function validateIntegrityPolicy(policy){
  const fail=()=>{throw Error('Invalid integrity monitoring policy.');};
  if(!keys(policy,['max_snapshot_age_seconds','rules'])||!keys(policy.rules,integritySignals))fail();
  if(policy.max_snapshot_age_seconds!==null&&(!integer(policy.max_snapshot_age_seconds,86400)||policy.max_snapshot_age_seconds<1))fail();
  for(const signal of integritySignals){const rule=policy.rules[signal];if(rule===null)continue;
    if(!keys(rule,['warning_count','critical_count','warning_age_seconds','critical_age_seconds']))fail();
    if(signal==='loyalty_mismatches'){
      // Financial projection invariants do not have a tolerated mismatch count
      // or an invented mismatch age. Activation still needs an explicit rule.
      if(rule.warning_count!==1||rule.critical_count!==1||rule.warning_age_seconds!==null||rule.critical_age_seconds!==null)fail();
    }else{
      let configured=false;
      for(const [warning,critical,max]of [['warning_count','critical_count',1000],['warning_age_seconds','critical_age_seconds',31536000]]){
        if(rule[warning]===null&&rule[critical]===null)continue;
        if(!integer(rule[warning],max)||rule[warning]<1||!integer(rule[critical],max)||rule[critical]<rule[warning])fail();configured=true;
      }
      if(!configured)fail();
    }
  }
  return policy;
}
const unknown=reason=>({status:'unknown',reason,metrics:[],coverage:'loyalty-and-push-materialisation'});
export function evaluateIntegrityHealth(snapshot,policy,now=Date.now()){
  try{
    try{validateIntegrityPolicy(policy);}catch{return unknown('policy_invalid');}
    if(!keys(snapshot,['schema_version','scope','coverage','observed_at','push_enabled','metrics'])||snapshot.schema_version!==1||snapshot.scope!=='all-branches'||snapshot.coverage!=='loyalty-and-push-materialisation'||typeof snapshot.push_enabled!=='boolean'||!keys(snapshot.metrics,integritySignals))return unknown('snapshot_invalid');
    if(typeof snapshot.observed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.observed_at)||new Date(snapshot.observed_at).toISOString()!==snapshot.observed_at)return unknown('snapshot_invalid');
    for(const name of integritySignals){const metric=snapshot.metrics[name];
      if(!keys(metric,name==='loyalty_mismatches'?['count','clipped']:['count','clipped','oldest_age_seconds'])||!integer(metric.count,1000)||typeof metric.clipped!=='boolean'||metric.clipped&&metric.count!==1000)return unknown('snapshot_invalid');
      if(name==='push_materialisation_due'&&(metric.count===0?metric.oldest_age_seconds!==null:!integer(metric.oldest_age_seconds)))return unknown('snapshot_invalid');
    }
    if(!Number.isFinite(now))return unknown('clock_invalid');if(policy.max_snapshot_age_seconds===null)return unknown('freshness_unconfigured');
    const age=now-Date.parse(snapshot.observed_at);if(age<0)return unknown('snapshot_in_future');if(age>policy.max_snapshot_age_seconds*1000)return unknown('snapshot_stale');
    const metrics=integritySignals.map(signal=>{
      const metric=snapshot.metrics[signal],rule=policy.rules[signal];let status='clear',reason='below_configured_thresholds';
      if(rule===null){status='unknown';reason='rule_unconfigured';}
      else if(signal==='push_materialisation_due'&&!snapshot.push_enabled){status='unknown';reason='push_disabled';}
      else if((rule.critical_count!==null&&metric.count>=rule.critical_count)||(rule.critical_age_seconds!==null&&metric.oldest_age_seconds!==null&&metric.oldest_age_seconds>=rule.critical_age_seconds)){status='critical';reason='critical_threshold';}
      else if((rule.warning_count!==null&&metric.count>=rule.warning_count)||(rule.warning_age_seconds!==null&&metric.oldest_age_seconds!==null&&metric.oldest_age_seconds>=rule.warning_age_seconds)){status='warning';reason='warning_threshold';}
      else if(metric.clipped){status='unknown';reason='count_clipped';}
      return {signal,status,reason,...metric};
    });
    const status=['critical','warning','unknown'].find(state=>metrics.some(metric=>metric.status===state))??'clear';
    return {status,observed_at:snapshot.observed_at,scope:'all-branches',coverage:snapshot.coverage,push_enabled:snapshot.push_enabled,metrics,
      limitation:'Internal projections and currently eligible missing delivery pairs only; no GAAP/cash reconciliation, financial repair or provider delivery proof.'};
  }catch{return unknown('snapshot_invalid');}
}
export async function collectIntegrityHealth(client,policy,{now=Date.now,timeoutMs=8000}={}){
  try{validateIntegrityPolicy(policy);}catch{return unknown('policy_invalid');}
  if(!integer(timeoutMs,30000)||timeoutMs<1)return unknown('collector_configuration_invalid');
  let timer;const controller=new AbortController();
  try{
    const result=await Promise.race([Promise.resolve().then(()=>client.rpc('operational_integrity_snapshot',{}).abortSignal(controller.signal).retry(false)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Collection timeout'));},timeoutMs);})]);
    return result.error?unknown('collection_failed'):evaluateIntegrityHealth(result.data,policy,now());
  }catch{return unknown(controller.signal.aborted?'collection_timeout':'collection_failed');}finally{clearTimeout(timer);}
}
