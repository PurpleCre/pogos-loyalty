import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {assessSecurityAudit} from './security-audit-policy.mjs';
const report={kind:'registry-security-audit',generatedAt:new Date().toISOString(),registry:'https://registry.npmjs.org',status:'unknown',releaseReady:false};
try{
  if(process.argv.length!==2)throw Error('No registry or target arguments accepted.');
  const hash=createHash('sha256');for(const file of ['package.json','package-lock.json','scripts/security-audit.mjs','scripts/security-audit-policy.mjs']){hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0');}report.sourceSha256=hash.digest('hex');
  await mkdir('.local/npm-audit-cache',{recursive:true,mode:0o700});
  const env={PATH:process.env.PATH,npm_config_cache:resolve('.local/npm-audit-cache'),npm_config_userconfig:'/dev/null',npm_config_registry:report.registry,NO_COLOR:'1',CI:'true'};
  const output=await new Promise((accept,reject)=>{
    const child=spawn('npm',['audit','--json','--registry=https://registry.npmjs.org/'],{env,stdio:['ignore','pipe','pipe']});let data='',size=0;
    const timer=setTimeout(()=>child.kill('SIGTERM'),90000);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024)child.kill('SIGTERM');else data+=chunk;});child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(Error('Audit unavailable'));});child.on('close',code=>{clearTimeout(timer);if(![0,1].includes(code)||size>4*1024*1024)reject(Error('Incomplete audit'));else accept(data);});
  });
  Object.assign(report,assessSecurityAudit(JSON.parse(output)));process.exitCode=report.releaseReady?0:1;
}catch{process.exitCode=2;}
finally{
  await mkdir('dist/security-audit',{recursive:true});await writeFile('dist/security-audit/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Dependency audit: ${report.status}; production release ready: ${report.releaseReady}. Evidence: dist/security-audit/report.json`);
}
