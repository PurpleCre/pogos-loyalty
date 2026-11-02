import { z } from 'zod';
export const privacySections = ['account','addresses','preferences','consent_history','quotes','orders','order_items','order_events','receipts','transactions','loyalty_ledger','reward_reservations','reward_events','notifications','devices','achievements','referral_codes','referrals','gifts','pos_links','pos_activity','staff_memberships','staff_invitations','access_history','privacy_requests','branch_operations','transaction_updates','push_devices','finance_activity'] as const;
export type PrivacySection = typeof privacySections[number];
export const privacyRequestSchema = z.object({ id:z.uuid(),kind:z.enum(['export','deletion']),status:z.enum(['submitted','blocked','reviewing','processing','completed','cancelled']),version:z.number().int().nonnegative(),blocker:z.string().nullable() });
export const privacyPageSchema = z.object({ section:z.enum(privacySections),rows:z.array(z.record(z.string(),z.unknown())),next_cursor:z.uuid().nullable(),generated_at:z.string(),created_before:z.string() });
export const privacySettingsSchema = z.object({ support_email:z.email(),active_notice_version:z.string().nullable() });
export const privacyNoticeSchema = z.object({ version:z.string(),controller_name:z.string(),body:z.string(),support_email:z.email(),approved_at:z.string() });
export type PrivacyRequest = z.infer<typeof privacyRequestSchema>;
export function privacyBlockerMessage(code:string|null):string {
  return ({active_orders:'An active order or unsettled cash needs to be resolved first.',cash_custody:'Cash handover needs to be reconciled first.',active_rewards:'An active reward collection needs to be resolved first.',staff_access:'A manager must arrange staff access and responsibilities first.',policy_approval:'The privacy team must approve the applicable policy before erasure can begin.',operator_review:'The privacy team is reviewing a processing issue.'} as Record<string,string>)[code??'']??'';
}
export interface ExportApi {
  page(id:string,section:PrivacySection,cursor:string|null):Promise<unknown>;
  finish(id:string):Promise<void>;
}
// Never return/save a partial file, and never continue after account changes.
export async function collectPrivacyExport(id:string,owner:string,isCurrent:()=>boolean,api:ExportApi) {
  const sections:Record<string,unknown[]>={};let size=0;let rows=0;let cutoff:string|null=null;
  for(const section of privacySections) {
    let cursor:string|null=null;const seen=new Set<string>();sections[section]=[];
    for(let pageNumber=0;pageNumber<1000;pageNumber++) {
      if(!isCurrent())throw new Error('Your account changed. Start a fresh export.');
      const page=privacyPageSchema.parse(await api.page(id,section,cursor));
      if(!isCurrent())throw new Error('Your account changed. Start a fresh export.');
      if(page.section!==section||(cutoff!==null&&cutoff!==page.created_before))throw new Error('Export response does not match this request.');
      cutoff=page.created_before;rows+=page.rows.length;size+=JSON.stringify(page.rows).length;
      if(rows>25000||size>5000000)throw new Error('This export is too large for this device. Contact privacy support for a complete copy.');
      sections[section].push(...page.rows);
      if(!page.next_cursor)break;
      if(seen.has(page.next_cursor)||page.rows.length===0)throw new Error('Export paging did not progress. Request a fresh copy.');
      seen.add(page.next_cursor);cursor=page.next_cursor;
      if(pageNumber===999)throw new Error('Contact privacy support for this large export.');
    }
  }
  if(!isCurrent())throw new Error('Your account changed.');
  await api.finish(id);
  if(!isCurrent())throw new Error('Your account changed.');
  return {format_version:1,account_id:owner,request_id:id,prepared_at:new Date().toISOString(),created_before:cutoff,
    scope:'Customer account data. Authentication/claim/push secrets, other people’s details and internal security notes are excluded. Contact privacy support for other records or vendor-held data.',sections};
}
