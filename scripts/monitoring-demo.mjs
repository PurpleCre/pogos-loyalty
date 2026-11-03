import {mkdtemp,mkdir,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createTestDatabase,asRole} from './test-database.mjs';
import {healthSignals} from './operational-health.mjs';
import {workerNames} from './worker-health.mjs';
import {runMonitoringCycle} from './monitoring-cycle.mjs';
import {localAlertStore} from './local-alert-store.mjs';
import {renderHealthReport} from './health-report.mjs';
import {syntheticHealthPolicy} from '../tests/helpers/health-fixture.mjs';
import {syntheticIntegrityPolicy,seedIntegrityFixture} from '../tests/helpers/integrity-fixture.mjs';
let db,directory;
try{
  if(process.argv.length!==2)throw Error('No targets accepted.');db=await createTestDatabase();directory=await mkdtemp(join(tmpdir(),'pogos-monitoring-demo-'));
  await db.query(`UPDATE public.push_settings SET enabled=true,expo_project_id=$1,enabled_since=now()`,[randomUUID()]);
  const store=localAlertStore(directory),workerPolicy={max_snapshot_age_seconds:60,workers:Object.fromEntries(workerNames.map(name=>[name,{expected_interval_seconds:60,max_run_seconds:30,max_success_age_seconds:120}]))};
  const client={rpc(name){return {abortSignal(){return {retry:async()=>({data:await asRole(db,'service_role',null,async()=>{
    if(name==='operational_integrity_snapshot')return(await db.query('SELECT public.operational_integrity_snapshot() AS value')).rows[0].value;
    if(name==='worker_health_snapshot')return(await db.query('SELECT public.worker_health_snapshot() AS value')).rows[0].value;
    if(name==='operational_health_snapshot')return(await db.query('SELECT public.operational_health_snapshot() AS value')).rows[0].value;
    throw Error('Unexpected RPC');
  }),error:null})};}};}};
  // PGlite serialises work on one connection; use a tiny adapter mutex so
  // independent collection paths cannot interleave synthetic role cleanup.
  let pending=Promise.resolve();const serial={rpc(name){return {abortSignal(){return {retry(){const task=pending.then(()=>client.rpc(name).abortSignal().retry());pending=task.catch(()=>{});return task;}};}};}};
  let delivered=0;const deliver=async()=>{delivered++;return 'accepted';};
  const options={client:serial,queuePolicy:syntheticHealthPolicy(healthSignals),workerPolicy,integrityPolicy:syntheticIntegrityPolicy(),store,deliver};
  const first=await runMonitoringCycle(options),duplicate=await runMonitoringCycle(options);if(first.alerts.active!==3||delivered!==3||duplicate.alerts.accepted!==3)throw Error('Deduplication failed');
  for(const worker of workerNames){const run=randomUUID();for(const outcome of ['running','success'])await asRole(db,'service_role',null,()=>db.query('SELECT public.record_worker_observation($1,$2,$3)',[worker,run,outcome]));}
  const recovered=await runMonitoringCycle(options);if(recovered.alerts.active!==0||delivered!==6)throw Error('Recovery failed');
  const fixture=await seedIntegrityFixture(db);await fixture.fund();
  await db.exec('BEGIN');await db.query('UPDATE public.loyalty_accounts SET balance=balance+1 WHERE user_id=$1',[fixture.user]);
  const integrityIncident=await runMonitoringCycle(options);if(integrityIncident.alerts.active!==2||delivered!==8)throw Error('Integrity incident failed');
  await runMonitoringCycle(options);if(delivered!==8)throw Error('Integrity deduplication failed');
  await db.exec('ROLLBACK'); // Restore an exclusively synthetic corruption fixture; never a repair API.
  await asRole(db,'service_role',null,()=>db.query('SELECT public.claim_push_deliveries(10)'));
  const integrityRecovered=await runMonitoringCycle(options);if(integrityRecovered.alerts.active!==0||delivered!==10)throw Error('Integrity recovery failed');
  const unavailable=await runMonitoringCycle({...options,client:{rpc(){throw Error('Synthetic outage');}},deliver:async()=>{throw Error('Synthetic ambiguous send');}});
  if(unavailable.alerts.active!==16||unavailable.alerts.unknown_delivery!==4||unavailable.alerts.ready!==12)throw Error('Unknown handling failed');
  const files=['package.json','package-lock.json','scripts/monitoring-demo.mjs','scripts/health-report.mjs','scripts/monitoring-cycle.mjs','scripts/monitoring-alerts.mjs','scripts/local-alert-store.mjs','scripts/operational-health.mjs','scripts/worker-health.mjs','scripts/test-database.mjs','config/operational-health.json','config/worker-health.json','config/integrity-health.json','scripts/integrity-health.mjs','tests/helpers/integrity-fixture.mjs','tests/integrity-health.test.mjs','tests/integrity-evaluator.test.mjs','tests/helpers/health-fixture.mjs','tests/monitoring-cycle.test.mjs','tests/monitoring-alerts.test.mjs','tests/worker-health.test.mjs'];
  for(const name of(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort())files.push(`supabase/migrations/${name}`);
  const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0');}
  const evidence={kind:'synthetic-monitoring-cycle',status:'passed',sourceSha256:hash.digest('hex'),generated_at:new Date().toISOString(),hostedAcceptance:false,deliverySimulated:true,thresholdApproval:false,first,duplicate,recovered,integrityIncident,integrityRecovered,unavailable};
  await mkdir('dist/monitoring-cycle',{recursive:true});await writeFile('dist/monitoring-cycle/report.json',JSON.stringify(evidence,null,2)+'\n');console.log('Synthetic monitoring cycle passed: missed runs, durable deduplication, recovery and uncertain alert delivery. No real messages sent.');
  await mkdir('dist/integrity-health',{recursive:true});await writeFile('dist/integrity-health/index.html',renderHealthReport([
    {label:'Consistent projections / no missing pairs',result:first.integrity},
    {label:'Projection mismatch and missing delivery pair',result:integrityIncident.integrity},
    {label:'Pair materialised / delivery needs separate evidence',result:integrityRecovered.integrity},
    {label:'Collector unavailable',result:unavailable.integrity},
  ],{mode:'integrity'}));
}catch{console.error('Synthetic monitoring rehearsal failed; raw payloads are not logged.');process.exitCode=1;}
finally{await db?.close();if(directory)await rm(directory,{recursive:true,force:true});}
