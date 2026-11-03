import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {healthSignals,validateHealthPolicy,evaluateOperationalHealth,collectOperationalHealth} from '../scripts/operational-health.mjs';
import {syntheticHealthPolicy} from './helpers/health-fixture.mjs';
import {renderHealthReport} from '../scripts/health-report.mjs';
const now=Date.parse('2026-11-03T12:00:00.000Z');
const sample=()=>({schema_version:1,scope:'all-branches',coverage:'queue-state-only',observed_at:new Date(now).toISOString(),metrics:Object.fromEntries(healthSignals.map(name=>[name,{count:0,clipped:false,oldest_age_seconds:null}]))});
const policy=()=>syntheticHealthPolicy(healthSignals);
test('committed health policy remains an explicit unconfigured draft',async()=>{
  const value=JSON.parse(await readFile(new URL('../config/operational-health.json',import.meta.url),'utf8'));
  assert.doesNotThrow(()=>validateHealthPolicy(value));assert.equal(value.max_snapshot_age_seconds,null);assert.ok(Object.values(value.rules).every(rule=>rule===null));
  assert.equal(evaluateOperationalHealth(sample(),value,now).status,'unknown');
});
test('policy rejects missing/unknown signals, invalid thresholds, shared null pairs and unsupported fields',()=>{
  for(const mutate of [value=>{delete value.rules.push_unknown;},value=>{value.rules.extra=null;},value=>{value.url='private';},value=>{value.max_snapshot_age_seconds=0;},value=>{value.rules.cash_expiry_due.warning_count=1001;},value=>{value.rules.cash_expiry_due.warning_count=3;},value=>{value.rules.cash_expiry_due.warning_count=null;},value=>{value.rules.cash_expiry_due.extra='private';},value=>{value.rules.cash_expiry_due.warning_age_seconds=Infinity;},value=>{value.rules.cash_expiry_due={warning_count:null,critical_count:null,warning_age_seconds:null,critical_age_seconds:null};}]){
    const value=policy();mutate(value);assert.throws(()=>validateHealthPolicy(value),error=>!error.message.includes('private'));
  }
});
test('clear means observed queues are below configured thresholds and always declares missing coverage',()=>{
  const result=evaluateOperationalHealth(sample(),policy(),now);assert.equal(result.status,'clear');assert.equal(result.metrics.length,8);assert.equal(result.coverage,'queue-state-only');
  assert.ok(result.missing_coverage.includes('worker_heartbeats'));assert.ok(result.missing_coverage.includes('loyalty_ledger_reconciliation'));
});
test('threshold boundaries distinguish warning and critical and do not lose proven alerts behind unknown rules',()=>{
  const value=sample();value.metrics.push_unknown={count:1,clipped:false,oldest_age_seconds:0};assert.equal(evaluateOperationalHealth(value,policy(),now).status,'warning');
  value.metrics.push_unknown.count=2;const rules=policy();rules.rules.cash_expiry_due=null;
  const result=evaluateOperationalHealth(value,rules,now);assert.equal(result.status,'critical');assert.equal(result.metrics.find(x=>x.signal==='cash_expiry_due').status,'unknown');
});
test('age rules use age at observation and ignore an empty queue',()=>{
  const value=sample(),rules=policy();rules.rules.cash_expiry_due={warning_count:null,critical_count:null,warning_age_seconds:60,critical_age_seconds:300};
  assert.equal(evaluateOperationalHealth(value,rules,now).status,'clear');value.metrics.cash_expiry_due={count:1,clipped:false,oldest_age_seconds:60};
  assert.equal(evaluateOperationalHealth(value,rules,now).status,'warning');value.metrics.cash_expiry_due.oldest_age_seconds=300;assert.equal(evaluateOperationalHealth(value,rules,now).status,'critical');
});
test('stale, future, malformed and invalid-clock observations can never be clear',()=>{
  assert.equal(evaluateOperationalHealth(sample(),policy(),now+60001).reason,'snapshot_stale');assert.equal(evaluateOperationalHealth(sample(),policy(),now+60000).status,'clear');
  assert.equal(evaluateOperationalHealth(sample(),policy(),now-1).reason,'snapshot_in_future');assert.equal(evaluateOperationalHealth(sample(),policy(),NaN).reason,'clock_invalid');
  for(const mutate of [x=>{x.observed_at='2026-02-30T12:00:00.000Z';},x=>{x.observed_at='2026-11-03T14:00:00+02:00';},x=>{delete x.metrics.cash_expiry_due;},x=>{x.metrics.private='private';},x=>{x.user='private';},x=>{x.schema_version=2;},x=>{x.metrics.push_unknown.count='1';},x=>{x.metrics.push_unknown.oldest_age_seconds=3;}]){const x=sample();mutate(x);const result=evaluateOperationalHealth(x,policy(),now);assert.equal(result.status,'unknown');assert.ok(!JSON.stringify(result).includes('private'));}
});
test('clipping is explicit and cannot create a false clear',()=>{
  const value=sample();value.metrics.push_unknown={count:1000,clipped:true,oldest_age_seconds:0};
  assert.equal(evaluateOperationalHealth(value,policy(),now).status,'critical');
  const rules=policy();rules.rules.push_unknown={warning_count:null,critical_count:null,warning_age_seconds:60,critical_age_seconds:300};
  const result=evaluateOperationalHealth(value,rules,now);assert.equal(result.status,'unknown');assert.equal(result.metrics.find(x=>x.signal==='push_unknown').reason,'count_clipped');
  value.metrics.push_unknown.count=999;assert.equal(evaluateOperationalHealth(value,rules,now).reason,'snapshot_invalid');
});
test('unconfigured rules and invalid policy remain unknown without forwarding policy content',()=>{
  const rules=policy();rules.rules.push_unknown=null;assert.equal(evaluateOperationalHealth(sample(),rules,now).status,'unknown');
  assert.deepEqual(evaluateOperationalHealth(sample(),{private:'contact'},now).metrics,[]);
  assert.equal(evaluateOperationalHealth(null,policy(),now).reason,'snapshot_invalid');
});
test('SDK collector uses a fixed read-only RPC, server credentials, cancellation and no implicit retry',async()=>{
  const calls=[];const client=createClient('https://synthetic.supabase.co','synthetic-server-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
    calls.push({url:String(url),body:JSON.parse(init.body),headers:new Headers(init.headers),signal:init.signal});return Response.json(sample());
  }}});
  const result=await collectOperationalHealth(client,policy(),{now:()=>now});assert.equal(result.status,'clear');assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://synthetic.supabase.co/rest/v1/rpc/operational_health_snapshot');assert.deepEqual(calls[0].body,{});assert.equal(calls[0].headers.get('Authorization'),'Bearer synthetic-server-key');assert.ok(calls[0].signal instanceof AbortSignal);
});
test('backend errors do not get logged or turn into a healthy empty snapshot',async()=>{
  let calls=0;const client=createClient('https://synthetic.supabase.co','synthetic-server-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>{calls++;return Response.json({message:'private upstream contact',details:'private',code:'XX000'},{status:500});}}});
  const result=await collectOperationalHealth(client,policy());assert.equal(calls,1);assert.equal(result.status,'unknown');assert.equal(result.reason,'collection_failed');assert.ok(!JSON.stringify(result).includes('private'));
});
test('hung collection is bounded and cancelled without treating it as a clear queue',async()=>{
  let aborted=false;
  const client={rpc(){return {abortSignal(signal){signal.addEventListener('abort',()=>{aborted=true;});return {retry(){return new Promise(()=>{});}};}};}};
  const result=await collectOperationalHealth(client,policy(),{timeoutMs:5});assert.equal(aborted,true);assert.equal(result.reason,'collection_timeout');assert.equal(result.status,'unknown');
});
test('invalid collector settings and policy are rejected before a database call',async()=>{
  const client={rpc(){throw Error('Unexpected private target');}};
  assert.equal((await collectOperationalHealth(client,{},{})).reason,'policy_invalid');
  assert.equal((await collectOperationalHealth(client,policy(),{timeoutMs:0})).reason,'collector_configuration_invalid');
});
test('local dashboard labels synthetic scope, keeps unknown explicit and escapes HTML content',()=>{
  const result=evaluateOperationalHealth(sample(),policy(),now);
  const html=renderHealthReport([{label:'<script>alert("private")</script>',result},{label:'Unavailable',result:evaluateOperationalHealth(null,policy(),now)}]);
  assert.ok(html.includes('Synthetic local demo'));assert.ok(html.includes('worker heartbeats'));assert.ok(html.includes('Unknown — no current verdict available.'));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<script src='));assert.ok(html.includes("default-src 'none'"));
});
test('health commands refuse targets and never echo supplied target text',async()=>{
  const {spawnSync}=await import('node:child_process');
  for(const script of ['health-policy-check','health-demo']){
    const result=spawnSync(process.execPath,[`scripts/${script}.mjs`,'https://private-target.example/secret'],{encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(result.status,1);assert.ok(!result.stdout.includes('private-target'));assert.ok(!result.stderr.includes('private-target'));
  }
});
