import { supabase } from './supabase';
import { accessTokenFor } from './cash-orders';
import { collectPrivacyExport, privacyRequestSchema, type PrivacySection } from './privacy';
export async function submitPrivacyRequest(owner:string,id:string,kind:'export'|'deletion') {
  const token=await accessTokenFor(owner);
  const {data,error}=await supabase.rpc('submit_privacy_request',{p_id:id,p_kind:kind}).setHeader('Authorization',`Bearer ${token}`);
  if(error)throw error;return privacyRequestSchema.parse(data);
}
export async function getPrivacyExport(owner:string,id:string,isCurrent:()=>boolean) {
  const token=await accessTokenFor(owner);
  const restarted=await supabase.rpc('restart_privacy_export',{p_id:id}).setHeader('Authorization',`Bearer ${token}`);
  if(restarted.error)throw restarted.error;
  return collectPrivacyExport(id,owner,isCurrent,{
    async page(requestId:string,section:PrivacySection,cursor:string|null) {
      const token=await accessTokenFor(owner);
      const {data,error}=await supabase.rpc('export_privacy_section',{p_id:requestId,p_section:section,...(cursor?{p_after:cursor}:{}),p_limit:100}).setHeader('Authorization',`Bearer ${token}`);
      if(error)throw error;return data;
    },
    async finish(requestId:string) {
      const token=await accessTokenFor(owner);
      const {error}=await supabase.rpc('finish_privacy_export',{p_id:requestId}).setHeader('Authorization',`Bearer ${token}`);if(error)throw error;
    },
  });
}
