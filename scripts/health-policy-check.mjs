import {readFile} from 'node:fs/promises';
import {validateHealthPolicy,healthSignals} from './operational-health.mjs';
try{
  if(process.argv.length!==2)throw Error('No target arguments accepted.');
  const policy=validateHealthPolicy(JSON.parse(await readFile(new URL('../config/operational-health.json',import.meta.url),'utf8')));
  console.log(`Queue health policy structurally valid; ${healthSignals.filter(name=>policy.rules[name]!==null).length}/8 rules configured; freshness ${policy.max_snapshot_age_seconds===null?'unconfigured':'configured'}.`);
  console.log('Configuration is not approval or activation. Unconfigured observations evaluate to unknown.');
}catch{console.error('Queue health policy validation failed. No submitted values are logged.');process.exitCode=1;}
