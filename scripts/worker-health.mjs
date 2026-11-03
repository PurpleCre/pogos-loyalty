export const workerNames=Object.freeze(['push','cash-expiry','reward-expiry']);
const keys=(value,names)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const seconds=value=>Number.isSafeInteger(value)&&value>=0;
export function validateWorkerPolicy(policy){
  const fail=()=>{throw Error('Invalid worker monitoring policy.');};
  if(!keys(policy,['max_snapshot_age_seconds','workers'])||!keys(policy.workers,workerNames))fail();
  if(policy.max_snapshot_age_seconds!==null&&(!seconds(policy.max_snapshot_age_seconds)||policy.max_snapshot_age_seconds<1||policy.max_snapshot_age_seconds>86400))fail();
  for(const name of workerNames){const rule=policy.workers[name];if(rule===null)continue;
    if(!keys(rule,['expected_interval_seconds','max_run_seconds','max_success_age_seconds'])||Object.values(rule).some(value=>!seconds(value)||value<1||value>86400)||rule.max_success_age_seconds<rule.expected_interval_seconds)fail();}
  return policy;
}
export function evaluateWorkerHealth(snapshot,policy,now=Date.now()){
  const unknown=reason=>({status:'unknown',reason,workers:[]});
  try{
    try{validateWorkerPolicy(policy);}catch{return unknown('policy_invalid');}
    if(!keys(snapshot,['schema_version','observed_at','workers'])||snapshot.schema_version!==1||!keys(snapshot.workers,workerNames)||typeof snapshot.observed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.observed_at)||new Date(snapshot.observed_at).toISOString()!==snapshot.observed_at)return unknown('snapshot_invalid');
    if(!Number.isFinite(now))return unknown('clock_invalid');
    if(policy.max_snapshot_age_seconds===null)return unknown('freshness_unconfigured');
    const elapsed=now-Date.parse(snapshot.observed_at);if(elapsed<0)return unknown('snapshot_in_future');if(elapsed>policy.max_snapshot_age_seconds*1000)return unknown('snapshot_stale');
    for(const value of Object.values(snapshot.workers)){
      if(!keys(value,['outcome','started_age_seconds','completed_age_seconds','last_success_age_seconds'])||!['never','running','success','failed','unresolved'].includes(value.outcome)||['started_age_seconds','completed_age_seconds','last_success_age_seconds'].some(key=>value[key]!==null&&!seconds(value[key])))return unknown('snapshot_invalid');
      if(value.outcome==='never'&&(value.started_age_seconds!==null||value.completed_age_seconds!==null||value.last_success_age_seconds!==null))return unknown('snapshot_invalid');
      if(value.outcome!=='never'&&value.started_age_seconds===null||value.outcome==='running'&&value.completed_age_seconds!==null||['success','failed','unresolved'].includes(value.outcome)&&value.completed_age_seconds===null||value.outcome==='success'&&value.last_success_age_seconds===null)return unknown('snapshot_invalid');
      if(value.completed_age_seconds!==null&&value.completed_age_seconds>value.started_age_seconds||value.outcome==='success'&&value.last_success_age_seconds!==value.completed_age_seconds)return unknown('snapshot_invalid');
    }
    const workers=workerNames.map(worker=>{
      const value=snapshot.workers[worker],rule=policy.workers[worker];let status='clear',reason='within_configured_windows';
      if(rule===null){status='unknown';reason='worker_unconfigured';}
      else if(value.outcome==='never'){status='critical';reason='never_observed';}
      else if(['failed','unresolved'].includes(value.outcome)){status='critical';reason='unsuccessful_run';}
      else if(value.outcome==='running'&&value.started_age_seconds>rule.max_run_seconds){status='critical';reason='run_overdue';}
      else if(value.started_age_seconds>rule.expected_interval_seconds){status='critical';reason='missed_run';}
      else if(value.last_success_age_seconds===null){status='unknown';reason='success_not_observed';}
      else if(value.last_success_age_seconds>rule.max_success_age_seconds){status='critical';reason='success_overdue';}
      return {worker,status,reason,...value};
    });
    return {status:workers.some(x=>x.status==='critical')?'critical':workers.some(x=>x.status==='unknown')?'unknown':'clear',observed_at:snapshot.observed_at,workers,limitation:'An application batch success is not provider delivery or external scheduler/collector availability.'};
  }catch{return unknown('snapshot_invalid');}
}
