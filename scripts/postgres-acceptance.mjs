import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {acceptanceImage,acceptanceLabel,assertLocalDocker,localBinding,assertOwnedContainer,containerArguments,acceptanceMode} from './postgres-acceptance-safety.mjs';

// Own a new, ephemeral local server. No URL, existing DB, hosted credentials,
// .env loading, volume mount, implicit image pull or existing-container reuse.
function command(program,args,{env=process.env,timeout=30000,output=false,trackTest=false}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(program,args,{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
    if(trackTest)activeTest=child;
    let forcedStop;
    const timer=setTimeout(()=>{child.kill('SIGTERM');forcedStop=setTimeout(()=>child.kill('SIGKILL'),5000);},timeout);
    child.stdout.on('data',chunk=>{stdout+=chunk;if(output)process.stdout.write(chunk);});
    child.stderr.on('data',chunk=>{stderr+=chunk;if(output)process.stderr.write(chunk);});
    child.on('error',error=>{clearTimeout(timer);clearTimeout(forcedStop);reject(error);});
    child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(forcedStop);if(trackTest)activeTest=null;resolve({code,signal,stdout,stderr});});
  });
}
const docker=(args,options)=>command('docker',args,options);
const runId=randomBytes(16).toString('hex'),password=randomBytes(24).toString('hex');
let container=null,removing=null,interrupted=false,activeTest=null,launchAttempted=false;
async function cleanup(){
  if(!container&&!launchAttempted)return;
  if(removing)return removing;
  removing=(async()=>{
    const target=container??`pogos-acceptance-${runId}`;
    const identity=await docker(['inspect','--format',`{{.Id}} {{index .Config.Labels "${acceptanceLabel}"}}`,target]);
    if(identity.code!==0){
      if(/No such (object|container)/i.test(identity.stderr)){container=null;return;}
      throw Error(`Inspect acceptance container ${target} before manual cleanup; its identity could not be confirmed.`);
    }
    const [actualId,label]=identity.stdout.trim().split(' ');
    assertOwnedContainer(actualId,label,runId);container=actualId;
    const removed=await docker(['rm','--force',container]);
    if(removed.code!==0)throw Error(`Acceptance container ${container} needs manual cleanup.`);
    container=null;
  })();return removing;
}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{interrupted=true;activeTest?.kill('SIGTERM');});
let report={kind:'local-postgres-concurrency',runId,node:process.version,startedAt:new Date().toISOString(),hostedAcceptance:false,
  authEvidence:'Synthetic SQL roles and claims; no Auth/JWT/PostgREST/device/vendor acceptance',status:'failed'};
let mode='concurrency';
try{
  mode=acceptanceMode(process.argv.slice(2));report.kind=`local-postgres-${mode}`;
  const context=await docker(['context','inspect','--format','{{.Endpoints.docker.Host}}']);
  if(context.code!==0)throw Error('Local Docker context unavailable.');
  assertLocalDocker(context.stdout,process.env.DOCKER_HOST);
  if((await docker(['version','--format','{{.Server.Version}}'])).code!==0)throw Error('Docker is stopped or inaccessible; start Docker Desktop and rerun npm run test:postgres.');
  const image=await docker(['image','inspect','--format','{{.Id}}',acceptanceImage]);
  if(image.code!==0)throw Error(`Missing local ${acceptanceImage}; run npm run test:postgres:pull first.`);
  report.image=acceptanceImage;report.imageId=image.stdout.trim();
  if(interrupted)throw Error('Acceptance execution was interrupted before launch.');
  launchAttempted=true;
  const launched=await docker(containerArguments(runId),{env:{...process.env,POSTGRES_PASSWORD:password}});
  if(launched.code!==0||!/^[a-f0-9]{64}$/.test(launched.stdout.trim()))throw Error('Could not start the isolated acceptance server. No existing container is reused.');
  container=launched.stdout.trim();
  const binding=await docker(['port',container,'5432/tcp']);
  if(binding.code!==0)throw Error('Could not discover the isolated server binding.');
  const config={runId,host:'127.0.0.1',port:localBinding(binding.stdout),database:`pogos_acceptance_${runId}`,user:'pogos_acceptance',password};
  let ready=false;
  for(let i=0;i<40&&!interrupted;i++){
    const client=new pg.Client({...config,ssl:false,connectionTimeoutMillis:1000});
    try{await client.connect();const r=await client.query('SHOW server_version');report.postgres=r.rows[0].server_version;ready=true;}
    catch{/* Server may still be initialising. */}finally{await client.end().catch(()=>{});}
    if(ready)break;await delay(250);
  }
  if(!ready||interrupted)throw Error('Acceptance server did not become ready, or execution was interrupted.');
  const files=['package.json','package-lock.json','scripts/test-database.mjs','scripts/postgres-acceptance.mjs','scripts/postgres-acceptance-safety.mjs','scripts/postgres-image.mjs','scripts/performance-evidence.mjs'];
  for(const dir of ['supabase/migrations','tests/postgres'])for(const f of (await readdir(dir)).sort())if(/\.(sql|mjs)$/.test(f))files.push(`${dir}/${f}`);
  const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0');}report.sourceSha256=hash.digest('hex');
  const result=await command(process.execPath,['--test','--test-reporter=tap',`tests/postgres/${mode}.test.mjs`],
    {env:{...process.env,POGOS_ACCEPTANCE_CONFIG:JSON.stringify(config),POGOS_ACCEPTANCE_CONTAINER:container},timeout:mode==='performance'?300000:180000,output:true,trackTest:true});
  if(mode==='resilience'){
    const metrics=result.stdout.match(/^# RESILIENCE_METRICS (.+)$/m);
    if(!metrics)throw Error('A complete resilience measurement report is required.');
    report.rehearsal=JSON.parse(metrics[1]);
    report.performanceAccepted=false;report.recoveryTargetsApproved=false;
  }
  if(mode==='performance'){
    const metrics=result.stdout.match(/^# PERFORMANCE_METRICS (.+)$/m);
    if(!metrics)throw Error('A complete performance measurement report is required.');
    report.measurements=JSON.parse(metrics[1]);report.performanceAccepted=false;report.targetsApproved=false;
  }
  report.tests=Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]??0);
  report.passed=Number(result.stdout.match(/^# pass (\d+)$/m)?.[1]??0);
  report.failed=Number(result.stdout.match(/^# fail (\d+)$/m)?.[1]??0);
  if(result.code!==0||interrupted||report.tests===0||report.tests!==report.passed)throw Error('PostgreSQL acceptance checks failed or were interrupted.');
  if(mode==='performance'&&report.measurements.profile_complete!==true)throw Error('The fixed performance profile did not complete.');
  report.status='passed';
}catch(error){process.exitCode=1;console.error(error.message);}
finally{
  try{await cleanup();report.cleanup='complete';}catch(error){report.cleanup='needs_review';report.status='failed';process.exitCode=1;console.error(error.message);}
  report.finishedAt=new Date().toISOString();
  const directory=mode==='performance'?'dist/performance-acceptance':mode==='resilience'?'dist/resilience-acceptance':'dist/postgres-acceptance';
  await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`Local PostgreSQL ${mode}: ${report.status}. Evidence: ${directory}/report.json`);
}
