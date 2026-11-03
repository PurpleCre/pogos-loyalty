import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {validateIntegrityPolicy,evaluateIntegrityHealth,collectIntegrityHealth} from '../scripts/integrity-health.mjs';
import {syntheticIntegrityPolicy,emptyIntegritySnapshot} from './helpers/integrity-fixture.mjs';
import {renderHealthReport} from '../scripts/health-report.mjs';
const now=Date.parse('2026-11-03T12:00:00.000Z');
test('committed integrity policy is unconfigured and cannot silently activate either signal',async()=>{
  const policy=JSON.parse(await readFile(new URL('../config/integrity-health.json',import.meta.url),'utf8'));assert.doesNotThrow(()=>validateIntegrityPolicy(policy));
  assert.equal(policy.max_snapshot_age_seconds,null);assert.ok(Object.values(policy.rules).every(x=>x===null));assert.equal(evaluateIntegrityHealth(emptyIntegritySnapshot(now),policy,now).status,'unknown');
});
test('a configured ledger rule cannot tolerate mismatches or invent an age threshold',()=>{
  for(const mutate of [x=>{x.rules.loyalty_mismatches.critical_count=2;},x=>{x.rules.loyalty_mismatches.warning_count=0;},x=>{x.rules.loyalty_mismatches.warning_age_seconds=1;},x=>{x.rules.extra=null;},x=>{x.max_snapshot_age_seconds=0;}]){const policy=syntheticIntegrityPolicy();mutate(policy);assert.throws(()=>validateIntegrityPolicy(policy));}
  const policy=syntheticIntegrityPolicy();policy.rules.push_materialisation_due.warning_count=3;assert.throws(()=>validateIntegrityPolicy(policy));
});
test('any observed ledger mismatch is critical after explicit activation, including a clipped count',()=>{
  for(const count of [1,2,1000]){const sample=emptyIntegritySnapshot(now);sample.metrics.loyalty_mismatches={count,clipped:count===1000};const result=evaluateIntegrityHealth(sample,syntheticIntegrityPolicy(),now);assert.equal(result.status,'critical');assert.equal(result.metrics[0].oldest_age_seconds,undefined);}
});
test('push materialisation uses count/age thresholds and a disabled service cannot report a clear backlog',()=>{
  const sample=emptyIntegritySnapshot(now),policy=syntheticIntegrityPolicy();assert.equal(evaluateIntegrityHealth(sample,policy,now).status,'clear');
  sample.metrics.push_materialisation_due={count:1,clipped:false,oldest_age_seconds:0};assert.equal(evaluateIntegrityHealth(sample,policy,now).status,'warning');
  sample.metrics.push_materialisation_due.oldest_age_seconds=300;assert.equal(evaluateIntegrityHealth(sample,policy,now).status,'critical');
  sample.push_enabled=false;const disabled=evaluateIntegrityHealth(sample,policy,now);assert.equal(disabled.status,'unknown');assert.equal(disabled.metrics[1].reason,'push_disabled');
  sample.metrics.loyalty_mismatches.count=1;assert.equal(evaluateIntegrityHealth(sample,policy,now).status,'critical');
});
test('stale, future and malformed integrity observations fail closed without echoing source data',()=>{
  const policy=syntheticIntegrityPolicy();assert.equal(evaluateIntegrityHealth(emptyIntegritySnapshot(now),policy,now+60001).reason,'snapshot_stale');assert.equal(evaluateIntegrityHealth(emptyIntegritySnapshot(now),policy,now-1).reason,'snapshot_in_future');
  for(const mutate of [x=>{x.private='contact';},x=>{x.metrics.loyalty_mismatches.count='1';},x=>{x.metrics.loyalty_mismatches.oldest_age_seconds=123;},x=>{x.metrics.push_materialisation_due.count=1;},x=>{x.metrics.push_materialisation_due.oldest_age_seconds=-1;},x=>{x.push_enabled='true';},x=>{x.observed_at='private';},x=>{x.metrics.loyalty_mismatches.clipped=true;}]){const sample=emptyIntegritySnapshot(now);mutate(sample);const result=evaluateIntegrityHealth(sample,policy,now);assert.equal(result.status,'unknown');assert.ok(!JSON.stringify(result).includes('private'));}
});
test('unconfigured rules stay unknown and clipped backlog cannot become falsely clear under age-only rules',()=>{
  const sample=emptyIntegritySnapshot(now),policy=syntheticIntegrityPolicy();policy.rules.loyalty_mismatches=null;assert.equal(evaluateIntegrityHealth(sample,policy,now).status,'unknown');
  policy.rules.push_materialisation_due={warning_count:null,critical_count:null,warning_age_seconds:60,critical_age_seconds:300};sample.metrics.push_materialisation_due={count:1000,clipped:true,oldest_age_seconds:0};assert.equal(evaluateIntegrityHealth(sample,policy,now).metrics[1].reason,'count_clipped');
});
test('actual SDK collector calls only the fixed integrity RPC with bounded cancellation and no hidden retry',async()=>{
  const calls=[];const client=createClient('https://synthetic.supabase.co','synthetic-service',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init.body),signal:init.signal,headers:new Headers(init.headers)});return Response.json(emptyIntegritySnapshot(now));}}});
  const result=await collectIntegrityHealth(client,syntheticIntegrityPolicy(),{now:()=>now});assert.equal(result.status,'clear');assert.equal(calls.length,1);assert.equal(calls[0].url,'https://synthetic.supabase.co/rest/v1/rpc/operational_integrity_snapshot');assert.deepEqual(calls[0].body,{});assert.ok(calls[0].signal instanceof AbortSignal);assert.equal(calls[0].headers.get('Authorization'),'Bearer synthetic-service');
});
test('upstream failures and timeouts remain unknown; invalid policy does not query the backend',async()=>{
  let calls=0;const client=createClient('https://synthetic.supabase.co','synthetic-service',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>{calls++;return Response.json({message:'private upstream data'},{status:500});}}});
  const result=await collectIntegrityHealth(client,syntheticIntegrityPolicy());assert.equal(result.reason,'collection_failed');assert.equal(calls,1);assert.ok(!JSON.stringify(result).includes('private'));
  const noCalls={rpc(){throw Error('Unexpected query');}};assert.equal((await collectIntegrityHealth(noCalls,{})).reason,'policy_invalid');
  let aborted=false;const hung={rpc(){return {abortSignal(signal){signal.addEventListener('abort',()=>{aborted=true;});return {retry:()=>new Promise(()=>{})};}};}};
  assert.equal((await collectIntegrityHealth(hung,syntheticIntegrityPolicy(),{timeoutMs:5})).reason,'collection_timeout');assert.equal(aborted,true);
});
test('integrity dashboard labels its domain, absent ledger age and separate delivery evidence',()=>{
  const result=evaluateIntegrityHealth(emptyIntegritySnapshot(now),syntheticIntegrityPolicy(),now),html=renderHealthReport([{label:'<private>',result}],{mode:'integrity'});
  assert.ok(html.includes('Ledger and notification integrity'));assert.ok(html.includes('Ledger mismatch age is unavailable'));assert.ok(html.includes('separate provider and device delivery evidence'));assert.ok(html.includes('&lt;private&gt;'));assert.ok(!html.includes('<private>'));
});
