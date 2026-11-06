import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const sdk=resolve('node_modules/expo-router/build');
const {DrawerRouter}=require(`${sdk}/react-navigation/routers/DrawerRouter.js`);
const {StackRouter}=require(`${sdk}/react-navigation/routers/StackRouter.js`);
const {CommonActions}=require(`${sdk}/react-navigation/routers/index.js`);
const Stack=Object.assign(()=>null,{Screen:()=>null});
const Drawer=Object.assign(()=>null,{Screen:()=>null});
// Evaluate the actual layouts without starting Auth, Sentry or native services.
function layout(file){
 const noop=()=>null;
 const modules={
  'expo-router':{Stack,Redirect:noop},
  'expo-router/drawer':{Drawer,DrawerContentScrollView:noop,DrawerItemList:noop},
  'react/jsx-runtime':require('react/jsx-runtime'),
  'react-native':{View:noop,Text:noop,ActivityIndicator:noop},
  'react-native-gesture-handler':{GestureHandlerRootView:noop},
  'react-native-safe-area-context':{SafeAreaProvider:noop},
  '@tanstack/react-query':{QueryClient:class{},QueryClientProvider:noop},
  'lucide-react-native':new Proxy({},{get:()=>noop}),
  '@/lib/theme':{colors:{primary:'teal',brand:{50:'white'}}},
  '@/hooks/useAuth':{useAuth:()=>({session:null,loading:false,userRole:'customer'}),AuthProvider:noop},
  '@/lib/environment':{runtimeEnvironment:{name:'development'}},
  '@/lib/error-reporting':{errorReportingOptions:()=>({})},
  '@/config/error-reporting.json':{},
  '@sentry/react-native':{init:()=>{},wrap:value=>value},
  'expo-constants':{default:{expoConfig:{version:'test'}}},
  'expo-updates':{},
  'expo-status-bar':{StatusBar:noop},
  '../global.css':{},
 };
 for(const [name,symbol]of [['components/BrandLogo','BrandLogo'],['components/LegacyOfflineNotice','LegacyOfflineNotice'],['components/auth/PrivacyExportCleanup','PrivacyExportCleanup'],['contexts/CartContext','CartProvider'],['contexts/CheckoutDraftContext','CheckoutDraftProvider'],['contexts/OrderContext','OrderProvider'],['hooks/usePushNotifications','PushNotificationsProvider']])modules[`@/${name}`]={[symbol]:noop};
 const exports={};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env:{}},require:name=>{assert.ok(name in modules,`Unexpected layout dependency: ${name}`);return modules[name];}},{filename:file});
 return exports;
}
const root=layout('app/_layout.tsx');
const app=layout('app/(app)/_layout.tsx');
function find(element,type){if(!element||typeof element!=='object')return null;if(element.type===type)return element;for(const child of [element.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}return null;}
const drawerOptions=find(app.default(),Drawer).props;
const config=state=>({routeNames:state.routeNames,routeGetIdList:{}});
function initial(type,names){return {stale:false,type,key:type,routeKeySeq:names.length,index:0,routeNames:names,routes:names.map((name,i)=>({key:`${type}-${i}`,name})),...(type==='drawer'?{default:'closed',history:[{type:'route',key:`${type}-0`}]}:{})};}
function act(router,state,action){const result=router.getStateForAction(state,action,config(state));assert.ok(result?.state,`Expected ${action.type} to be handled`);return result.state;}
function hardware(navigate){
 let listener,removed=false;
 const exports={};
 // Exercise Expo's installed Android handler, including its event consumption.
 vm.runInNewContext(readFileSync(`${sdk}/fork/useBackButton.native.js`,'utf8'),{exports,require:name=>{
  if(name==='react')return {useEffect:effect=>{const cleanup=effect();navigate.cleanup=cleanup;}};
  if(name==='react-native')return {BackHandler:{addEventListener:(event,callback)=>{assert.equal(event,'hardwareBackPress');listener=callback;return {remove:()=>{removed=true;}};}}};
  if(name==='../react-navigation/native')return {CommonActions};
  throw Error(`Unexpected native handler dependency: ${name}`);
 }});
 exports.useBackButton({current:navigate});
 return {press:()=>listener(),cleanup:()=>{navigate.cleanup();assert.equal(removed,true);}};
}
function harness(router,initialState){let state=initialState;const next=()=>router.getStateForAction(state,{type:'GO_BACK'},config(state));const back=hardware({canGoBack:()=>!!next()?.state,dispatchSync:action=>{state=act(router,state,action);}});return {get state(){return state;},back,send:action=>{state=act(router,state,action);}};}
const navigate=(name,params)=>({type:'NAVIGATE',payload:{name,params}});

test('root and sign-in layouts mount native stacks; cold links have a Home anchor',()=>{
 assert.ok(find(root.default(),Stack));
 assert.equal(find(root.default(),Stack).props.screenOptions.headerShown,false);
 assert.equal(root.unstable_settings.anchor,'index');
 assert.ok(find(layout('app/(auth)/_layout.tsx').default(),Stack));
});
test('Android Back retains repeated menu/cart visits instead of exhausting history early',()=>{
 const h=harness(DrawerRouter({backBehavior:drawerOptions.backBehavior}),initial('drawer',['menu','cart']));
 h.send(navigate('cart'));h.send(navigate('menu'));
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'cart');
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'menu');
 assert.equal(h.back.press(),false,'Only the actual drawer entry has no earlier visit');h.back.cleanup();
});
test('Android Back closes an open drawer before leaving its current screen',()=>{
 const h=harness(DrawerRouter({backBehavior:drawerOptions.backBehavior}),initial('drawer',['menu','cart']));
 h.send(navigate('cart'));h.send({type:'OPEN_DRAWER'});
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'cart');
 assert.equal(h.state.history.some(entry=>entry.type==='drawer'),false);
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'menu');h.back.cleanup();
});
test('Android Back returns through root detail screens to Home and only then falls through',()=>{
 const h=harness(StackRouter({initialRouteName:root.unstable_settings.anchor}),initial('stack',['index']));
 // A cold link is seeded above the configured anchor by Expo Router.
 h.state.routeNames.push('support','privacy-policy');
 h.send({type:'PUSH',payload:{name:'support'}});h.send({type:'PUSH',payload:{name:'privacy-policy'}});
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'support');
 assert.equal(h.back.press(),true);assert.equal(h.state.routes[h.state.index].name,'index');
 assert.equal(h.back.press(),false);h.back.cleanup();
});
