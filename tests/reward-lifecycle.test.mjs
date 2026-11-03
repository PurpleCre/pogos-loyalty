import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {z} from 'zod';
import {accessFailure} from '../lib/read-resource.ts';
// Execute the actual hook with deterministic effects and mocked AppState/API.
// This exercises callback/subscription behavior; native React/device acceptance
// remains separate from this small lifecycle harness.
function harness(role='user'){
 const slots=[],effects=[],listeners=new Set();let cursor=0;const calls=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const React={
  useRef(value){const at=cursor++;if(!slots[at])slots[at]={current:value};return slots[at];},
  useState(value){const at=cursor++;if(!slots[at])slots[at]={value:typeof value==='function'?value():value};return [slots[at].value,next=>{slots[at].value=typeof next==='function'?next(slots[at].value):next;}];},
  useCallback(fn,deps){const at=cursor++;if(!slots[at]||!same(slots[at].deps,deps))slots[at]={fn,deps};return slots[at].fn;},
  useEffect(fn,deps){const at=cursor++;if(!slots[at]||!same(slots[at].deps,deps)){const old=slots[at];slots[at]={deps,cleanup:undefined};effects.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}},
 };
 const appState={currentState:'active',addEventListener(_name,fn){listeners.add(fn);return {remove(){listeners.delete(fn);}};}};
 const channel={on(){return this;},subscribe(){return this;}};
 const query=name=>new Proxy({},{get(_object,field){if(field==='then')return(resolve,reject)=>{calls.push(name);return Promise.resolve({data:name==='user_points'||name==='loyalty_accounts'?null:[],error:null}).then(resolve,reject);};return()=>query(name);}});
 const modules={
  react:React,'react-native':{AppState:appState},zod:{z},'@/lib/read-resource':{accessFailure},
  '@/lib/supabase':{supabase:{from:query,rpc:query,channel:()=>channel,removeChannel:async()=>{}}},
  './useAuth':{useAuth:()=>({user:{id:'fixture-owner'},userRole:role})},
  '@/lib/cash-orders':{accessTokenFor:async()=>'fixture-token'},
  '@/lib/reward-orders':{rewardRecovery:{load:async()=>null},submitRewardCommand:async()=>({}),rewardError:()=> 'Refresh failed'},
  '@/lib/reward-redemption':{offerSchema:z.unknown()},
 };
 const source=readFileSync(new URL('../hooks/useRewardReservations.ts',import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const module={exports:{}};
 new Function('require','exports','module','setInterval','clearInterval',outputText)(name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];},module.exports,module,()=>1,()=>{});
 const branch=randomUUID();
 return {
  calls,
  render(enabled=true,staffView=false){cursor=0;const result=module.exports.useRewardReservations(branch,staffView,enabled);while(effects.length)effects.shift()();return result;},
  emit(state){appState.currentState=state;for(const fn of [...listeners])fn(state);},
  stop(){for(const slot of slots)slot?.cleanup?.();},
 };
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
test('reward screen refreshes again after background, loss of focus, foreground and refocus',async()=>{
 const app=harness();try{
  app.render();await flush();assert.equal(app.render().fresh,true);const previous=app.calls.length;
  app.emit('background');app.render(false);app.emit('active');app.render(true);await flush();
  assert.ok(app.calls.length>previous);assert.equal(app.render(true).fresh,true);
 }finally{app.stop();}
});
test('an assigned manager can refresh the staff reward worklist while inactive screens do not read',async()=>{
 const app=harness('manager');try{
  app.render(true,true);await flush();assert.equal(app.render(true,true).fresh,true);
  app.render(false,true);const previous=app.calls.length;app.emit('background');app.emit('active');await flush();assert.equal(app.calls.length,previous);
  app.render(true,true);await flush();assert.equal(app.render(true,true).fresh,true);
 }finally{app.stop();}
});
