import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderPrivacyPages(contact,notice=null,{release=false}={}) {
  if(release&&!notice)throw Error('Release pages require a reviewed approved notice record.');
  const email=notice?.support_email??contact.supportEmail;
  if(!z.email().safeParse(email).success)throw Error('A valid public privacy contact is required.');
  if(notice&&(!notice.version||!notice.controller_name||typeof notice.body!=='string'||notice.body.trim().length<40||!notice.approval_reference||!notice.approved_by||!Number.isFinite(Date.parse(notice.approved_at))))throw Error('An approved notice record with controller, version and approval evidence is required.');
  const mail=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Pogo’s account deletion request')}&body=${encodeURIComponent('Account email: \n\nI would like to request deletion of my Pogo’s account and associated data.\n\nPlease do not include passwords, authenticator codes or payment details.')}`;
  const shell=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="${release?'index,follow':'noindex,nofollow'}"><title>${escape(title)} · Pogo’s Zimbabwe</title><style>body{margin:0;background:#fff7f7;color:#17202c;font:18px/1.6 system-ui,sans-serif}header,main,footer{max-width:760px;margin:auto;padding:24px}header{font-weight:800;color:#a51630}main{background:white;border-radius:20px;padding:32px}h1{font-size:2rem;line-height:1.2}h2{font-size:1.3rem}a{color:#9f1239;overflow-wrap:anywhere}a:focus-visible{outline:3px solid #9f1239;outline-offset:4px}.button{display:inline-block;background:#9f1239;color:white;padding:12px 20px;border-radius:9px;text-decoration:none;font-weight:700}.notice{white-space:pre-wrap}.muted{color:#555}footer{font-size:15px}nav{display:flex;gap:24px;flex-wrap:wrap}</style></head><body><header>Pogo’s Zimbabwe</header><main><h1>${escape(title)}</h1>${body}</main><footer><nav><a href="../privacy/">Privacy information</a><a href="../account-deletion/">Account deletion</a><a href="mailto:${escape(encodeURIComponent(email))}">Contact privacy support</a></nav></footer></body></html>`;
  return {
    privacy:shell('Privacy information',notice?`<p><strong>${escape(notice.controller_name)}</strong> · Notice ${escape(notice.version)}</p><div class="notice">${escape(notice.body)}</div><p>Privacy contact: <a href="mailto:${escape(encodeURIComponent(email))}">${escape(email)}</a></p>`:`<p>Pogo’s full privacy notice is being prepared. Contact us for privacy questions before sharing information you are unsure about.</p><p>Privacy contact: <a href="mailto:${escape(encodeURIComponent(email))}">${escape(email)}</a></p><p>You can also <a href="../account-deletion/">request account deletion</a>.</p>`),
    deletion:shell('Delete your Pogo’s account',`<p>You can request deletion of your Pogo’s account and associated data without reinstalling the app.</p><h2>Request deletion by email</h2><ol><li>Email <a href="mailto:${escape(encodeURIComponent(email))}">${escape(email)}</a> with the subject “Pogo’s account deletion request”.</li><li>Include the email used for your Pogo’s account. Do not send passwords, authenticator codes or payment details.</li><li>We will verify that the request belongs to you before acting and explain any records that must be retained.</li></ol><p><a class="button" href="${escape(mail)}">Compose deletion request</a></p><h2>Request from the app</h2><p>Open Profile → Privacy, account export and deletion. Verify your identity, choose Request account deletion, and confirm. You can follow updates there.</p><h2>What happens next</h2><p>Submitting a request does not erase your account immediately. Active orders, reward collections, staff responsibilities and cash handovers may need to be settled first. The privacy team reviews the applicable retention rules before processing.</p><p>Some financial, fiscal and security records may need to be retained. Ask for the approved privacy notice and the categories, reasons and retention periods that apply to your request.</p>${notice?'':'<p class="muted">Pogo’s full notice and retention periods are still being confirmed. Contact privacy support for an update.</p>'}`),
  };
}
export async function buildPrivacyPages({output='dist/privacy-pages',noticePath=null,release=false}={}) {
  const contact=JSON.parse(await readFile(new URL('../config/privacy-contact.json',import.meta.url),'utf8'));
  const notice=noticePath?JSON.parse(await readFile(resolve(noticePath),'utf8')):null;
  if(release&&!notice)throw Error('Release pages require --notice=PATH with a reviewed approved notice record.');
  const pages=renderPrivacyPages(contact,notice,{release});
  for(const [name,html]of [['privacy',pages.privacy],['account-deletion',pages.deletion]]){
    const dir=join(resolve(output),name);await mkdir(dir,{recursive:true});await writeFile(join(dir,'index.html'),html);
  }
  return resolve(output);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const noticePath=process.argv.find(value=>value.startsWith('--notice='))?.slice('--notice='.length)??null;
  console.log(`Prepared privacy pages: ${await buildPrivacyPages({noticePath,release:process.argv.includes('--release')})}`);
}
