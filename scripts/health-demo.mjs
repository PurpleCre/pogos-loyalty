import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createTestDatabase,asRole} from './test-database.mjs';
import {healthSignals,evaluateOperationalHealth,collectOperationalHealth} from './operational-health.mjs';
import {renderHealthReport} from './health-report.mjs';
import {seedHealthFixture,syntheticHealthPolicy} from '../tests/helpers/health-fixture.mjs';
let db;
try{
  if(process.argv.length!==2)throw Error('No target arguments accepted.');
  db=await createTestDatabase();
  const read=()=>asRole(db,'service_role',null,async()=>(await db.query('SELECT public.operational_health_snapshot() AS value')).rows[0].value);
  const policy=syntheticHealthPolicy(healthSignals),empty=await read();
  const reports=[{label:'Empty queues',result:evaluateOperationalHealth(empty,policy)}];
  const fixture=await seedHealthFixture(db);await fixture.order();await fixture.order({branch:fixture.second});await fixture.delivery({state:'unknown'});
  const incident=await read();reports.push({label:'Expiry backlog and unknown push',result:evaluateOperationalHealth(incident,policy)});
  reports.push({label:'Stale observation',result:evaluateOperationalHealth(incident,policy,Date.parse(incident.observed_at)+61000)});
  reports.push({label:'Collector unavailable',result:await collectOperationalHealth({rpc(){throw Error('Synthetic unavailable backend');}},policy)});
  if(reports.map(x=>x.result.status).join(',')!=='clear,critical,unknown,unknown')throw Error('Unexpected rehearsal outcomes.');
  const files=['package.json','package-lock.json','scripts/test-database.mjs','scripts/operational-health.mjs','scripts/health-policy-check.mjs','scripts/health-demo.mjs','scripts/health-report.mjs','config/operational-health.json','tests/operational-health.test.mjs','tests/health-evaluator.test.mjs','tests/helpers/health-fixture.mjs'];
  for(const name of(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort())files.push(`supabase/migrations/${name}`);
  const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0');}
  const evidence={kind:'local-synthetic-queue-health',status:'passed',generated_at:new Date().toISOString(),hostedAcceptance:false,thresholdApproval:false,sourceSha256:hash.digest('hex'),reports};
  await mkdir('dist/operational-health',{recursive:true});
  await writeFile('dist/operational-health/report.json',JSON.stringify(evidence,null,2)+'\n');
  await writeFile('dist/operational-health/index.html',renderHealthReport(reports));
  console.log('Synthetic queue-health rehearsal passed: clear, critical, stale unknown and collection-failure unknown.');
  console.log('Local artifacts: dist/operational-health/index.html and report.json; no hosted acceptance or alert delivery.');
}catch{console.error('Local synthetic queue-health rehearsal failed; no backend payloads or credentials are logged.');process.exitCode=1;}
finally{await db?.close();}
