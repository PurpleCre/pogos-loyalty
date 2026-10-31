// Log a stable operation label and a bounded machine code; database error
// messages/details can repeat submitted addresses, emails or other personal data.
export function logPrivateError(operation:string,error:unknown) {
  const candidate=error&&typeof error==='object'&&'code'in error?error.code:undefined;
  const code=typeof candidate==='string'&&/^[a-zA-Z0-9_]{1,32}$/.test(candidate)?candidate:'unknown';
  console.error(operation,{code});
}
export function safeTelemetryUrl(value:string):string {
  try{const url=new URL(value);return `${url.protocol}//${url.host}${url.pathname}`;}catch{return '[omitted]';}
}
const sensitive=/token|secret|password|authorization|cookie|email|address|latitude|longitude|phone|full_name|user_agent|claim_code|code_verifier|^user$|^request$|^extra$|^contexts$|^vars$|^value$|^message$|^logentry$|^attachments$/i;
export function sanitizeTelemetry<T>(event:T):T {
  const walk=(value:unknown,depth:number):unknown=>{
    if(depth>14)return '[omitted]';
    if(typeof value==='string'){
      if(/^[a-z][a-z0-9+.-]*:\/\//i.test(value))return safeTelemetryUrl(value);
      return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email omitted]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[token omitted]')
        .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g,'[key omitted]');
    }
    if(Array.isArray(value))return value.slice(0,200).map(item=>walk(item,depth+1));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!sensitive.test(key)).slice(0,100).map(([key,item])=>[key,walk(item,depth+1)]));
    return value;
  };
  return walk(event,0) as T;
}
