import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {edgeRuntimeArguments,edgeRuntimeEnvironment} from './edge-runtime-plan.mjs';

const require=createRequire(import.meta.url),mode=process.argv[2];
let active=null,interrupted=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{interrupted=true;active?.kill('SIGTERM');});
function run(args,{output=true}={}){
  return new Promise((accept,reject)=>{
    const child=spawn(process.execPath,[require.resolve('deno/bin.cjs'),...args],{env:edgeRuntimeEnvironment(process.env,resolve('.local/deno-edge-cache')),stdio:['ignore','pipe','pipe']});
    active=child;let stdout='',stderr='';const timeout=setTimeout(()=>child.kill('SIGTERM'),120000);
    child.stdout.on('data',data=>{stdout+=data;if(output)process.stdout.write(data);});
    child.stderr.on('data',data=>{stderr+=data;if(output)process.stderr.write(data);});
    child.on('error',error=>{clearTimeout(timeout);active=null;reject(error);});
    child.on('close',code=>{clearTimeout(timeout);active=null;accept({code,stdout,stderr});});
  });
}
let report={kind:'local-deno-edge',mode,startedAt:new Date().toISOString(),status:'failed',hostedAcceptance:false,
  scope:'Deno handler HTTP and real SDK against local fake backend; provider responses simulated; no gateway/Auth/PostgREST/real delivery proof'};
try{
  if(process.argv.length!==3)throw Error('No extra target or permission arguments are accepted.');
  const args=edgeRuntimeArguments(mode);
  await mkdir('.local/deno-edge-cache',{recursive:true,mode:0o700});
  await mkdir('dist/edge-runtime',{recursive:true});
  const version=await run(['--version'],{output:false});
  const expected=require('deno/package.json').version;
  if(version.code!==0||!version.stdout.startsWith(`deno ${expected} `))throw Error('Installed Deno binary does not match its pinned dependency.');
  report.deno=expected;report.sdk=require('@supabase/supabase-js/package.json').version;
  const files=['package.json','package-lock.json','deno.edge.json','supabase/config.toml','scripts/edge-runtime-check.mjs','scripts/edge-runtime-plan.mjs'];
  async function add(directory){for(const name of(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=`${directory}/${name.name}`;if(name.isDirectory())await add(path);else if(/\.(ts|json)$/.test(path))files.push(path);}}
  await add('supabase/functions');await add('tests/edge');
  const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0');}report.sourceSha256=hash.digest('hex');
  const result=await run(args);
  if(result.code!==0||interrupted)throw Error('Deno acceptance failed or was interrupted.');
  if(mode==='test'){
    const match=result.stdout.match(/ok \| (\d+) passed \| (\d+) failed/);
    if(!match||Number(match[1])===0||Number(match[2])!==0)throw Error('A complete successful Deno test summary is required.');
    report.passed=Number(match[1]);report.failed=Number(match[2]);
  }
  report.status='passed';
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  if(['check','test'].includes(mode)){
    report.finishedAt=new Date().toISOString();await mkdir('dist/edge-runtime',{recursive:true});
    await writeFile(`dist/edge-runtime/${mode}-report.json`,`${JSON.stringify(report,null,2)}\n`);
    console.log(`Local Deno ${mode}: ${report.status}. Evidence: dist/edge-runtime/${mode}-report.json`);
  }
}
