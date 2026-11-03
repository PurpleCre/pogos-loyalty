import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessSecurityAudit} from '../scripts/security-audit-policy.mjs';
const response=()=>({metadata:{vulnerabilities:{info:0,low:1,moderate:0,high:0,critical:0}},vulnerabilities:{example:{severity:'low',isDirect:false,via:[],fixAvailable:false}}});
test('audit release decision blocks high/critical findings and does not mistake remediation availability for remediation',()=>{
  assert.equal(assessSecurityAudit(response()).releaseReady,true);
  for(const level of ['high','critical']){const r=response();r.metadata.vulnerabilities[level]=1;r.vulnerabilities.example.severity=level;r.vulnerabilities.example.fixAvailable=true;assert.equal(assessSecurityAudit(r).releaseReady,false);}
});
test('offline, incomplete or malformed audits cannot produce release approval',()=>{
  for(const value of [null,{}, {error:{message:'private'}}, {metadata:{vulnerabilities:{}},vulnerabilities:{}}])assert.throws(()=>assessSecurityAudit(value));
  const malformed=response();malformed.vulnerabilities=[];assert.throws(()=>assessSecurityAudit(malformed));
});
test('audit evidence excludes raw paths, arbitrary error fields and unsafe URLs',()=>{
  const r=response();r.vulnerabilities.example.nodes=['/private/customer/path'];r.vulnerabilities.example.details='private';r.vulnerabilities.example.via=[{url:'https://user:secret@foreign.example/private'},{url:'https://github.com/advisories/GHSA-abcd-1234-efgh'}];
  const result=assessSecurityAudit(r);assert.ok(!JSON.stringify(result).includes('private'));assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(result.findings[0].advisories.length,1);
});
