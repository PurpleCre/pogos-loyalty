export function assessSecurityAudit(value){
  const levels=['info','low','moderate','high','critical'];
  if(!value||value.error||!value.metadata?.vulnerabilities||!value.vulnerabilities||typeof value.vulnerabilities!=='object'||Array.isArray(value.vulnerabilities)||typeof value.metadata.vulnerabilities!=='object'||Array.isArray(value.metadata.vulnerabilities))throw Error('A complete registry audit response is required.');
  const counts={};for(const name of levels){const n=value.metadata.vulnerabilities[name];if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid audit counts.');counts[name]=n;}
  const findings=[];
  for(const [name,item]of Object.entries(value.vulnerabilities)){
    if(!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name)||!levels.includes(item.severity))throw Error('Invalid audit finding.');
    findings.push({package:name,severity:item.severity,direct:item.isDirect===true,
      advisories:[...new Set((item.via??[]).filter(x=>x&&typeof x==='object').map(x=>x.url).filter(url=>typeof url==='string'&&/^https:\/\/github.com\/advisories\/GHSA-[a-z0-9-]+$/.test(url)))],fixReported:item.fixAvailable===true||!!item.fixAvailable?.version});
  }
  const blocked=!!(counts.high||counts.critical||findings.some(x=>['high','critical'].includes(x.severity)));
  return {status:blocked?'blocked':'clear',releaseReady:!blocked,counts,findings};
}
