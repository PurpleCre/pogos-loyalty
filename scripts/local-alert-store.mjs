import {mkdir,open,rename,unlink,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateAlertState,emptyAlertState} from './monitoring-alerts.mjs';
// Local rehearsal store only. No automatic stale-lock breaking, damaged-state
// reset or historical event purge. Production needs owned storage/retention.
export function localAlertStore(directory){
  return {async withLock(work){
    await mkdir(directory,{recursive:true,mode:0o700});
    const info=await lstat(directory);if(!info.isDirectory()||(info.mode&0o077)!==0)throw Error('Private monitoring directory required.');
    const path=join(directory,'state.json'),lockPath=join(directory,'state.lock');
    const lock=await open(lockPath,'wx',0o600),identity=await lock.stat();
    try{return await work({async read(){
      let handle;try{handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);if((await handle.stat()).size>65536)throw Error('Oversized state');return validateAlertState(JSON.parse(await handle.readFile('utf8')));}
      catch(error){if(error.code==='ENOENT')return emptyAlertState();throw Error('Monitoring state unreadable; preserve it for review.');}finally{await handle?.close();}
    },async write(state){
      validateAlertState(state);const contents=JSON.stringify(state);if(Buffer.byteLength(contents)>65536)throw Error('Monitoring state limit reached.');
      const temporary=join(directory,`state-${randomUUID()}.tmp`);const handle=await open(temporary,'wx',0o600);
      try{await handle.writeFile(contents);await handle.sync();await handle.close();await rename(temporary,path);const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}}
      finally{await handle.close().catch(()=>{});await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    }});}finally{
      await lock.close();const actual=await lstat(lockPath);if(actual.ino!==identity.ino||actual.dev!==identity.dev)throw Error('Monitoring lock identity changed; manual review required.');await unlink(lockPath);
    }
  }};
}
