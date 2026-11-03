export const acceptanceImage='postgres:17-alpine';
export const acceptanceLabel='org.pogos.acceptance.run';
export function acceptanceMode(args){
  if(args.length===0)return 'concurrency';
  if(args.length===1&&args[0]==='--resilience')return 'resilience';
  throw Error('Only the fixed concurrency or resilience rehearsal is accepted; no targets are allowed.');
}
export function assertLocalDocker(endpoint,override) {
  if(typeof endpoint!=='string'||!endpoint.trim())throw Error('Acceptance requires a local Unix-socket Docker daemon.');
  for(const target of [endpoint,override].filter(value=>value!==undefined)){
    if(typeof target!=='string'||!/^unix:\/\/\//.test(target.trim()))throw Error('Acceptance requires a local Unix-socket Docker daemon. Remote Docker targets are refused.');
  }
}
export function localBinding(value){
  const match=/^127\.0\.0\.1:([0-9]+)$/.exec(value.trim());
  if(!match||Number(match[1])<1||Number(match[1])>65535)throw Error('Acceptance PostgreSQL must bind only to IPv4 loopback on a valid port.');
  return Number(match[1]);
}
export function validateAcceptanceConfig(value){
  if(!value||Object.keys(value).sort().join(',')!=='database,host,password,port,runId,user'||
    typeof value.runId!=='string'||!/^[a-f0-9]{32}$/.test(value.runId)||value.host!=='127.0.0.1'||value.database!==`pogos_acceptance_${value.runId}`||
    value.user!=='pogos_acceptance'||!Number.isInteger(value.port)||value.port<1||value.port>65535||
    typeof value.password!=='string'||!/^[a-f0-9]{48}$/.test(value.password))throw Error('Missing or invalid isolated acceptance configuration; use npm run test:postgres.');
  return value;
}
export function assertOwnedContainer(id,actual,expected){
  if(!/^[a-f0-9]{64}$/.test(id)||!/^[a-f0-9]{32}$/.test(expected)||actual!==expected)throw Error('Refusing to remove a container without the matching acceptance identity.');
}
export function containerArguments(runId){
  if(!/^[a-f0-9]{32}$/.test(runId))throw Error('Invalid acceptance run identity.');
  return ['run','--detach','--rm','--pull=never','--name',`pogos-acceptance-${runId}`,'--label',`${acceptanceLabel}=${runId}`,
    '--publish','127.0.0.1::5432','--memory','384m','--cpus','1','--pids-limit','128','--shm-size','64m',
    '--tmpfs','/var/lib/postgresql/data:rw,size=256m,mode=0700',
    '--env','POSTGRES_USER=pogos_acceptance','--env',`POSTGRES_DB=pogos_acceptance_${runId}`,'--env','POSTGRES_PASSWORD',
    acceptanceImage,'-c','shared_buffers=16MB','-c','max_connections=20'];
}
