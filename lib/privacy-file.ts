// The native implementation is selected by Metro on Android/iOS.
export async function savePrivacyExport(value:unknown,id:string,isCurrent:()=>boolean,purpose:'account'|'finance'='account') {
  if(!isCurrent())throw new Error('Your account changed.');
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try {
    if(!isCurrent())throw new Error('Your account changed.');
    const link=document.createElement('a');link.href=url;link.download=`pogos-${purpose}-export-${id}.json`;document.body.appendChild(link);link.click();link.remove();
  } finally {setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export async function clearPrivacyExportFiles() { /* Browser object URLs are revoked after use. */ }
