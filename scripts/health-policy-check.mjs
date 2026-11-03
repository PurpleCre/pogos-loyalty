import {readFile} from 'node:fs/promises';
import {validateHealthPolicy,healthSignals} from './operational-health.mjs';
import {validateWorkerPolicy,workerNames} from './worker-health.mjs';
import {validateIntegrityPolicy,integritySignals} from './integrity-health.mjs';
try{
  if(process.argv.length!==2)throw Error('No target arguments accepted.');
  const policy=validateHealthPolicy(JSON.parse(await readFile(new URL('../config/operational-health.json',import.meta.url),'utf8')));
  console.log(`Queue health policy structurally valid; ${healthSignals.filter(name=>policy.rules[name]!==null).length}/8 rules configured; freshness ${policy.max_snapshot_age_seconds===null?'unconfigured':'configured'}.`);
  console.log('Configuration is not approval or activation. Unconfigured observations evaluate to unknown.');
  const workers=validateWorkerPolicy(JSON.parse(await readFile(new URL('../config/worker-health.json',import.meta.url),'utf8')));
  console.log(`Worker monitoring policy valid; ${workerNames.filter(name=>workers.workers[name]!==null).length}/3 workers configured. No schedule or alert activated.`);
  const integrity=validateIntegrityPolicy(JSON.parse(await readFile(new URL('../config/integrity-health.json',import.meta.url),'utf8')));
  console.log(`Integrity policy valid; ${integritySignals.filter(name=>integrity.rules[name]!==null).length}/2 rules configured. No repair or dispatch enabled.`);
}catch{console.error('Queue health policy validation failed. No submitted values are logged.');process.exitCode=1;}
