import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceImage,assertLocalDocker,localBinding,validateAcceptanceConfig,assertOwnedContainer,containerArguments,acceptanceMode} from '../scripts/postgres-acceptance-safety.mjs';
const runId='a'.repeat(32),id='b'.repeat(64);
const config=()=>({runId,host:'127.0.0.1',port:32123,database:`pogos_acceptance_${runId}`,user:'pogos_acceptance',password:'c'.repeat(48)});
test('recovery/load mode never accepts a caller-selected target or arbitrary test path',()=>{
  assert.equal(acceptanceMode([]),'concurrency');assert.equal(acceptanceMode(['--resilience']),'resilience');
  for(const args of [['https://remote'],['--resilience','--target=remote'],['tests/other.mjs'],['--all']])assert.throws(()=>acceptanceMode(args));
});
test('acceptance cannot redirect Docker operations to a remote daemon',()=>{
  assert.doesNotThrow(()=>assertLocalDocker('unix:///var/run/docker.sock'));
  for(const endpoint of [undefined,'','tcp://127.0.0.1:2375','ssh://remote','https://docker.example'])assert.throws(()=>assertLocalDocker(endpoint));
  assert.throws(()=>assertLocalDocker('unix:///var/run/docker.sock','tcp://remote:2375'));
});
test('database publication accepts exactly one IPv4 loopback binding',()=>{
  assert.equal(localBinding('127.0.0.1:32123\n'),32123);
  for(const value of ['0.0.0.0:32123','[::]:32123','127.0.0.1:0','127.0.0.1:65536','127.0.0.1:1\n0.0.0.0:1','host:5432'])assert.throws(()=>localBinding(value));
});
test('test clients refuse hosted URLs, foreign databases and driver option injection',()=>{
  assert.deepEqual(validateAcceptanceConfig(config()),config());
  for(const change of [{host:'db.example'},{database:'postgres'},{database:'pogos_acceptance_other'},{user:'postgres'},{connectionString:'postgres://remote/db'},{ssl:true},{port:NaN},{password:''},{runId:'../other'}])assert.throws(()=>validateAcceptanceConfig({...config(),...change}));
  assert.throws(()=>validateAcceptanceConfig(null));
});
test('cleanup is scoped to the exact container ID and matching run label',()=>{
  assert.doesNotThrow(()=>assertOwnedContainer(id,runId,runId));
  for(const values of [[id,'another-run',runId],['other-container',runId,runId],[id,undefined,runId],[id,runId,'']])assert.throws(()=>assertOwnedContainer(...values));
});
test('container plan has no mounted user data, remote port, persistent volume, password argument or implicit pull',()=>{
  const args=containerArguments(runId);
  assert.ok(args.includes(acceptanceImage));assert.ok(args.includes('--pull=never'));assert.ok(args.includes('--rm'));
  assert.equal(args[args.indexOf('--publish')+1],'127.0.0.1::5432');
  assert.ok(args.includes('POSTGRES_PASSWORD'));assert.ok(!args.some(value=>value.startsWith('POSTGRES_PASSWORD=')));
  assert.ok(!args.includes('--volume'));assert.ok(!args.includes('--mount'));assert.ok(!args.includes('--network=host'));
  assert.throws(()=>containerArguments('invalid/run'));
});
