import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@sentry/core';
import { sanitizeTelemetry, errorReportingDsn, errorReportingOptions, minimizeErrorEnvelope, validateReportingBindings } from '../lib/error-reporting.ts';

const dsn='https://0123456789abcdef0123456789abcdef@o123.ingest.sentry.io/456';
const bindings={development:{origin:'https://o123.ingest.sentry.io',projectId:'456'},staging:null,production:null};
const input={environment:'development',enabled:'true',dsn,version:'1.1.0'};
const metadata={environment:'development',release:'pogos@1.1.0',dist:'embedded'};
const event=()=>({event_id:'a'.repeat(32),exception:{values:[{type:'TypeError',value:'12 Private Street, +263771234567',stacktrace:{frames:[{filename:'file:///Users/private-person/app/main.jsbundle?token=private',lineno:1,colno:50,in_app:true}]}}]}});

test('binding validation accepts an explicit unconfigured draft without treating it as approval',()=>{
  assert.doesNotThrow(()=>validateReportingBindings({development:null,staging:null,production:null}));
  assert.doesNotThrow(()=>validateReportingBindings(bindings));
});
test('binding validation refuses incomplete, duplicate, credential-bearing or unknown configuration',()=>{
  for(const value of [null,[],{}, {development:null,staging:null}, {...bindings,other:null}, {...bindings,staging:bindings.development}, {...bindings,development:{origin:'https://user:private@o123.ingest.sentry.io',projectId:'456'}}, {...bindings,development:{origin:'https://o123.ingest.sentry.io/private',projectId:'456'}}, {...bindings,development:{origin:'https://foreign.example',projectId:'456'}}, {...bindings,development:{...bindings.development,dsn:'private'}}, {...bindings,development:{...bindings.development,projectId:456}}])assert.throws(()=>validateReportingBindings(value));
});
test('invalid binding failures and the local check command do not echo destination values',async()=>{
  assert.throws(()=>validateReportingBindings({...bindings,development:{origin:'private-contact-or-secret',projectId:'456'}}),error=>!error.message.includes('private-contact-or-secret'));
  const {spawnSync}=await import('node:child_process');
  const result=spawnSync(process.execPath,['--experimental-strip-types','--experimental-default-type=module','scripts/error-reporting-check.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(result.status,0);assert.equal((result.stdout.match(/^(development|staging|production): /gm)||[]).length,3);
  assert.ok(!result.stdout.includes('https://'));assert.ok(!result.stdout.includes('private'));
});

test('reporting needs exact opt-in, a configured isolated binding and the matching ingestion destination',()=>{
  assert.equal(errorReportingDsn(input,bindings),dsn);
  for(const enabled of [undefined,'false','TRUE','1'])assert.equal(errorReportingDsn({...input,enabled},bindings),undefined);
  for(const environment of ['staging','production','other'])assert.equal(errorReportingDsn({...input,environment},bindings),undefined);
  assert.equal(errorReportingDsn(input,{...bindings,development:null}),undefined);
  assert.equal(errorReportingDsn(input,{...bindings,staging:bindings.development}),undefined);
  assert.equal(errorReportingDsn(input,{...bindings,development:{...bindings.development,projectId:'999'}}),undefined);
});
test('invalid, credential-bearing, foreign and arbitrary DSN targets fail closed',()=>{
  for(const value of ['', 'not a URL',dsn.replace('https:','http:'),dsn.replace('@',':secret@'),dsn+'?token=private',dsn+'#private',dsn+'/route',dsn.replace('o123','o999'),dsn.replace('.sentry.io','.example.test'),dsn.replace('/456','/0'),dsn.replace('0123456789abcdef0123456789abcdef','bad'),dsn.replace('.io/','.io:8443/')])assert.equal(errorReportingDsn({...input,dsn:value},bindings),undefined,value);
});
test('regional SaaS DSNs are supported only with a matching configured binding',()=>{
  const regional=dsn.replace('.ingest.sentry.io','.ingest.de.sentry.io');
  assert.equal(errorReportingDsn({...input,dsn:regional},{...bindings,development:{origin:'https://o123.ingest.de.sentry.io',projectId:'456'}}),regional);
  assert.equal(errorReportingDsn({...input,dsn:regional},bindings),undefined);
});
test('unknown fields, exception text and private URL paths cannot escape through the payload',()=>{
  const original={...event(),description:'Private Customer',request:{url:'https://backend/orders/private-id'},user:{id:'private-id'},contexts:{trace:{transaction:'private'}},extra:{notes:'cash/contact'},tags:{account:'private'},fingerprint:['private'],transaction:'/orders/private-id',logger:'private',server_name:'private-device',modules:{'private-package':'private'},threads:{values:[{stacktrace:{frames:[{vars:{private:'data'}}]}}]},breadcrumbs:[{data:{url:'https://x/private-id'}}],arbitrary:{innocent:'Bearer secret'}};
  const result=sanitizeTelemetry(original,metadata),json=JSON.stringify(result);
  for(const value of ['private','Private','+263','cash/contact','Bearer','backend','Users'])assert.ok(!json.includes(value),value);
  assert.equal(result.exception.values[0].type,'TypeError');assert.equal(result.exception.values[0].stacktrace.frames[0].filename,'main.jsbundle');
  assert.equal(original.exception.values[0].value,'12 Private Street, +263771234567');
  assert.equal(result.environment,'development');assert.equal(result.release,'pogos@1.1.0');
});
test('frame filtering preserves generated bundle coordinates but drops source text, arbitrary names and invalid numbers',()=>{
  const original=event();original.exception.values[0].stacktrace.frames=[{filename:'https://host/customers/private-id.tsx',function:'person@example.test',abs_path:'/private/name',lineno:-1,colno:Infinity,vars:{secret:'private'},pre_context:['private'],context_line:'private',post_context:['private']},{filename:'app:///index.android.bundle',lineno:1,colno:123,in_app:true},{filename:'C:\\Users\\private\\main.jsbundle#secret',lineno:2}];
  const frames=sanitizeTelemetry(original).exception.values[0].stacktrace.frames;
  assert.deepEqual(frames,[{},{filename:'index.android.bundle',lineno:1,colno:123,in_app:true},{filename:'main.jsbundle',lineno:2}]);
});
test('deep, cyclic and oversized untrusted structures are bounded without serialising arbitrary fields',()=>{
  const original=event();original.extra=original;original.exception.values=Array.from({length:1000},()=>({type:'private custom exception',value:'private',stacktrace:{frames:Array.from({length:1000},()=>({filename:'main.jsbundle',lineno:1}))}}));
  const result=sanitizeTelemetry(original);assert.equal(result.exception.values.length,3);
  assert.ok(result.exception.values.every(x=>x.type==='Error'&&x.stacktrace.frames.length===40));
  assert.ok(JSON.stringify(result).length<10000);
});
test('unexpected message, replay, transaction and malformed events are dropped',()=>{
  for(const value of [null,[],{},'raw private', {message:'private'}, {exception:{values:[]}}, {...event(),type:'transaction'}, {...event(),type:'feedback'}, {...event(),type:'profile'}, {...event(),type:'replay_event'}])assert.equal(sanitizeTelemetry(value),null);
  assert.equal(sanitizeTelemetry(new Proxy({}, {get(){throw Error('private');}})),null);
});
test('invalid protocol identifiers/timestamps are omitted and arbitrary SDK metadata is not copied',()=>{
  const result=sanitizeTelemetry({...event(),event_id:'person@example.test',timestamp:NaN,level:'private',sdk:{private:'data'},release:'private',dist:'private',environment:'production'},metadata);
  assert.equal(result.event_id,undefined);assert.equal(result.timestamp,undefined);assert.equal(result.level,'error');assert.equal(result.sdk,undefined);
  assert.equal(result.dist,'embedded');assert.equal(result.environment,'development');
});
test('last envelope boundary removes attachments, feedback, native/session/log/trace items and arbitrary headers',()=>{
  const envelope=[{event_id:'private',trace:{transaction:'private'},sdk:{private:'data'},dsn:'private',sent_at:'private'},[[{type:'attachment',filename:'customer-list.csv'},new Uint8Array([1,2])],[{type:'event',filename:'private'},event()],...[ 'session','sessions','feedback','user_report','transaction','profile','profile_chunk','replay_event','replay_recording','log','span','metric','client_report','check_in','unknown' ].map(type=>[{type},{private:'data'}])]];
  minimizeErrorEnvelope(envelope,metadata);
  assert.equal(envelope[1].length,1);assert.deepEqual(envelope[1][0][0],{type:'event'});
  assert.deepEqual(envelope[0],{sdk:{settings:{infer_ip:'never'}},event_id:'a'.repeat(32)});
  assert.ok(!JSON.stringify(envelope).includes('private'));assert.ok(!JSON.stringify(envelope).includes('Private'));
});
test('a malformed envelope fails closed instead of preserving original items',()=>{
  const envelope=[{private:'data'},null];minimizeErrorEnvelope(envelope,metadata);assert.deepEqual(envelope,[{},[]]);
});
test('options keep secondary collection disabled and drop breadcrumbs, logs, transactions and attachments',()=>{
  const options=errorReportingOptions(input,bindings);
  for(const key of ['debug','sendDefaultPii','sendClientReports','enableNative','enableNativeCrashHandling','autoInitializeNativeSdk','enableNativeNagger','enableNdk','enableNdkScopeSync','enableAutoSessionTracking','enableLogs','enableAutoConsoleLogs','enableAutoPerformanceTracing','enableAppStartTracking','enableNativeFramesTracking','enableUserInteractionTracing','enableStallTracking','enableCaptureFailedRequests','attachScreenshot','attachViewHierarchy'])assert.equal(options[key],false,key);
  assert.equal(options.replaysSessionSampleRate,0);assert.equal(options.replaysOnErrorSampleRate,0);assert.equal(options.tracesSampleRate,undefined);assert.equal(options.profilesSampleRate,undefined);assert.deepEqual(options.tracePropagationTargets,[]);
  assert.equal(options.beforeBreadcrumb({data:{url:'private'}}),null);assert.equal(options.beforeSendTransaction({}),null);assert.equal(options.beforeSendLog({}),null);
  const hint={attachments:[{filename:'private',data:'private'}]};assert.ok(options.beforeSend(event(),hint));assert.deepEqual(hint.attachments,[]);
});
test('only named error integrations survive SDK default changes',()=>{
  const options=errorReportingOptions(input,bindings);
  const result=options.integrations(['ReactNativeErrorHandlers','RewriteFrames','DebugMeta','Dedupe','BrowserApiErrors','GlobalHandlers','Breadcrumbs','HttpContext','DeviceContext','MobileReplay','ExpoContext','ExpoConstants','FutureCollector'].map(name=>({name})));
  assert.deepEqual(result.map(x=>x.name),['ReactNativeErrorHandlers','RewriteFrames','DebugMeta','Dedupe','BrowserApiErrors','GlobalHandlers','PogosErrorEnvelope']);
});
test('release metadata uses bounded build inputs and never raw event scope',()=>{
  const options=errorReportingOptions({...input,version:'person@example.test',updateId:'private'},bindings);
  assert.equal(options.release,'pogos@unknown');assert.equal(options.dist,'embedded');
  const ota='b1234567-1234-4123-8123-123456789012';assert.equal(errorReportingOptions({...input,updateId:ota},bindings).dist,ota);
});

function sdkFixture(values=input){
  const options=errorReportingOptions(values,bindings),sent=[];
  const client=new Client({...options,stackParser:()=>[],integrations:options.integrations([]),transport:()=>({send:async envelope=>{sent.push(structuredClone(envelope));return {statusCode:200};},flush:async()=>true})});
  client.init();return {client,sent};
}
test('actual installed SDK sends only minimized error data through an injected transport',async()=>{
  const {client,sent}=sdkFixture();
  try {
    // SDK adds scope fields, attachments and envelope metadata after early hooks.
    client.on('beforeSendEvent',(payload,hint)=>{payload.extra={late:'private-late-contact'};hint.attachments=[{filename:'private.csv',data:'private'}];});
    client.captureEvent({...event(),user:{email:'private@example.test'},extra:{address:'private'}});
    assert.equal(await client.flush(1000),true);assert.equal(sent.length,1);
    assert.equal(sent[0][1].length,1);assert.ok(!JSON.stringify(sent).includes('private'));assert.ok(!JSON.stringify(sent).includes('Private'));
    assert.equal(sent[0][1][0][1].release,'pogos@1.1.0');assert.equal(sent[0][0].sdk.settings.infer_ip,'never');
  } finally {await client.close();}
});
test('actual SDK emits no error transport call when opt-in or binding is absent',async()=>{
  for(const values of [{...input,enabled:'false'},{...input,environment:'production'},{...input,dsn:'https://foreign.example/private'}]){
    const {client,sent}=sdkFixture(values);try{client.captureEvent(event());await client.flush(1000);assert.equal(sent.length,0);}finally{await client.close();}
  }
});
test('actual SDK drops raw messages and transactions before transport',async()=>{
  const {client,sent}=sdkFixture();try{
    client.captureEvent({message:'private contact'});client.captureEvent({type:'transaction',transaction:'/private',start_timestamp:1,timestamp:2});
    await client.flush(1000);assert.equal(sent.length,0);
  }finally{await client.close();}
});
