import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
const directory=()=>new Directory(Paths.cache,'pogos-privacy-exports');
export async function clearPrivacyExportFiles() {
  const folder=directory();if(folder.exists)folder.delete();
}
export async function savePrivacyExport(value:unknown,id:string,isCurrent:()=>boolean,purpose:'account'|'finance'='account') {
  if(!isCurrent())throw new Error('Your account changed.');
  if(!await Sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device. Contact support.');
  if(!isCurrent())throw new Error('Your account changed.');
  const folder=directory();folder.create({intermediates:true,idempotent:true});
  const file=new File(folder,`pogos-${purpose}-export-${id}.json`);
  try {
    file.create({overwrite:true});file.write(JSON.stringify(value,null,2));
    if(!isCurrent())throw new Error('Your account changed.');
    await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json',dialogTitle:purpose==='finance'?'Save Pogo’s branch finance report':'Save your Pogo’s account export'});
  } finally {if(file.exists)file.delete();}
}
