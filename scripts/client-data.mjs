import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {packSchema,jsonSchema} from './client-onboarding/schema.mjs';
import {assessPack,contentDigest,canonical} from './client-onboarding/validate.mjs';
import {buildConfigurationPlan} from './client-onboarding/plan.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const templatePath=resolve(root,'config/client-intake/pack.template.json');
const bindings=JSON.parse(await readFile(resolve(root,'config/environments.json'),'utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Harare',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function json(path){const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>4000000)throw Error('Input must be a regular JSON file smaller than four megabytes.');return JSON.parse(await readFile(path,'utf8'));}
async function writeNew(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
const args=process.argv.slice(2),command=args.shift();
try{
 if(!['init','status','check','plan','digest','hash','template-check','schema'].includes(command))throw Error('Use init, status, check, plan, digest, hash, schema or template-check.');
 const positional=[],flags={};
 while(args.length){const arg=args.shift();if(arg.startsWith('--')){if(!['--scope','--out'].includes(arg)||arg in flags||!args.length)throw Error('Invalid or duplicate option.');flags[arg]=args.shift();}else positional.push(arg);}
 const scope=flags['--scope']??'chain';if(!['chain','pilot'].includes(scope))throw Error('Scope must be chain or pilot.');
 if(command==='init'){
  if(positional.length>1||flags['--out']||flags['--scope'])throw Error('Use init [new-private-pack.json].');
  const path=resolve(positional[0]??'.local/client-data/pack.json');await writeNew(path,await json(templatePath));console.log('Created a new private draft. Existing files are never overwritten.');
 }else if(command==='schema'){
  if(positional.length||flags['--scope']||!flags['--out'])throw Error('Use schema --out new-schema.json.');await writeNew(resolve(flags['--out']),jsonSchema);console.log('Created schema.');
 }else if(command==='hash'){
  if(positional.length!==1||Object.keys(flags).length)throw Error('Use hash path-to-source-file.');const info=await lstat(resolve(positional[0]));if(!info.isFile()||info.size>64000000)throw Error('Source must be a regular file smaller than 64 megabytes.');
  console.log(createHash('sha256').update(await readFile(resolve(positional[0]))).digest('hex'));
 }else if(command==='template-check'){
  if(positional.length||Object.keys(flags).length)throw Error('Template check accepts no options.');
  const input=await json(templatePath),report=assessPack(input,{scope:'chain',asOf:today,bindings});
  const checkedSchema=await json(resolve(root,'config/client-intake/pack.schema.json'));
  if(!report.schemaValid||report.configurationReviewReady||input.approvals.length||input.sources.length||input.branches.some(b=>b.menu.length||b.mapping.id)||canonical(checkedSchema)!==canonical(jsonSchema))throw Error('Draft template/schema drift or unreviewed sample data.');
  console.log('Draft template is structurally valid, contains no approvals or trading data, and correctly blocks configuration review.');
 }else{
  if(positional.length>1)throw Error('Supply at most one client pack.');
  const input=await json(resolve(positional[0]??(command==='status'?templatePath:'.local/client-data/pack.json')));
  if(command==='digest'){
   if(Object.keys(flags).length)throw Error('Digest accepts only a client pack.');packSchema.parse(input);console.log(contentDigest(input));
  }else{
   const report=assessPack(input,{scope,asOf:today,bindings});
   if(command==='plan'){
    if(!flags['--out'])throw Error('Plan requires --out new-private-review.json.');
    if(!report.configurationReviewReady){console.log(JSON.stringify(report,null,2));process.exitCode=1;}
    else{const plan=buildConfigurationPlan(input,{scope,asOf:today,bindings});await writeNew(resolve(flags['--out']),plan);console.log(JSON.stringify({written:true,format:plan.format,contentSha256:plan.contentSha256,rows:plan.rows.length,activationAllowed:false,productionReady:false}));}
   }else{
    if(flags['--out'])throw Error('Report commands print redacted JSON; --out is available only for plan.');
    console.log(JSON.stringify(report,null,2));if(command==='check'&&!report.configurationReviewReady)process.exitCode=1;
   }
  }
 }
}catch(error){
 // Do not print parser snippets, field values, filenames or raw Zod messages:
 // client packs and source documents may contain confidential business input.
 console.error(JSON.stringify({error:'client_data_command_failed',message:'Check command arguments, schema, file permissions and exclusive output paths. Input content was not printed.'}));process.exitCode=2;
}
