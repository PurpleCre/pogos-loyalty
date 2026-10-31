import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderPrivacyPages,buildPrivacyPages} from '../scripts/build-privacy-pages.mjs';
const contact={supportEmail:'pgonese6@gmail.com'};
test('standalone deletion resource offers the confirmed mailbox without requiring an installed app',()=>{
  const pages=renderPrivacyPages(contact);
  assert.ok(pages.deletion.includes('pgonese6@gmail.com'));assert.ok(pages.deletion.includes('Compose deletion request'));assert.ok(pages.deletion.includes('mailto:'));
  assert.ok(pages.deletion.includes('Do not send passwords'));assert.ok(!pages.deletion.includes('<script'));assert.ok(!pages.deletion.includes('supabase'));
  assert.ok(pages.privacy.includes('being prepared'));assert.ok(pages.privacy.includes('noindex,nofollow'));
});
test('approved notice text is escaped and cannot introduce markup or script execution',()=>{
  const pages=renderPrivacyPages(contact,{version:'fixture-v1',controller_name:'Fixture <controller>',body:'Approved fixture text only. <script>steal()</script> Privacy instructions here.',support_email:contact.supportEmail,approval_reference:'fixture-approval',approved_by:'Fixture reviewer',approved_at:'2026-10-31T10:00:00Z'});
  assert.ok(!pages.privacy.includes('<script>'));assert.ok(pages.privacy.includes('&lt;script&gt;'));assert.ok(pages.privacy.includes('index,follow'));
});
test('release page generation refuses an unapproved missing notice before creating output files',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pogos-privacy-pages-test-'));const output=join(directory,'release');
  try{await assert.rejects(buildPrivacyPages({release:true,output}),/approved notice/);await assert.rejects(access(output));}finally{await rm(directory,{recursive:true,force:true});}
});
test('malformed privacy contact or incomplete notice records cannot become public release pages',()=>{
  assert.throws(()=>renderPrivacyPages({supportEmail:'person@example.test?bcc=other@example.test'}));
  assert.throws(()=>renderPrivacyPages(contact,{version:'v1',body:'A draft is insufficient'}));
});
