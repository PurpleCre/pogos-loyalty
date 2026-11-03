import {readFile} from 'node:fs/promises';
import {validateReportingBindings} from '../lib/error-reporting.ts';
try {
  if(process.argv.length!==2)throw Error('No target arguments accepted.');
  const bindings=JSON.parse(await readFile(new URL('../config/error-reporting.json',import.meta.url),'utf8'));
  validateReportingBindings(bindings);
  for(const [name,value] of Object.entries(bindings))console.log(`${name}: ${value===null?'unconfigured; reporting stays disabled':'isolated destination configured; ownership/provider acceptance still required'}`);
} catch {
  console.error('Error-reporting binding validation failed. Check the local configuration; no destination or credential values are logged.');
  process.exitCode=1;
}
