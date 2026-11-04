// Fixed aggregate evidence only: never persist SQL, plan expressions, parameters,
// account IDs, tokens, raw backend errors or unrestricted EXPLAIN JSON.
const relations=new Set(['loyalty_accounts','user_points','loyalty_ledger','reward_reservations','notification_events','push_devices','push_settings','user_roles','push_deliveries','orders','users','privacy_requests']);
const nodeTypes=new Set(['Result','Aggregate','HashAggregate','GroupAggregate','Seq Scan','Index Scan','Index Only Scan','Bitmap Heap Scan','Bitmap Index Scan','CTE Scan','Subquery Scan','Function Scan','Values Scan','WorkTable Scan','Nested Loop','Hash Join','Merge Join','Hash','Sort','Incremental Sort','Limit','Append','Merge Append','Unique','Materialize','Memoize','Gather','Gather Merge','SetOp','WindowAgg']);
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const rounded=value=>Math.round(value*100)/100;
export function latencySummary(values){
  if(!Array.isArray(values)||values.length===0||!values.every(finite))throw Error('Complete non-negative latency samples required.');
  const sorted=[...values].sort((a,b)=>a-b),percentile=p=>rounded(sorted[Math.ceil(p*sorted.length)-1]);
  return {samples:sorted.length,p50_ms:percentile(.5),p95_ms:percentile(.95),p99_ms:percentile(.99),max_ms:rounded(sorted.at(-1))};
}
export function summariseExplain(value){
  if(!Array.isArray(value)||value.length!==1||!value[0]?.Plan||!finite(value[0]['Execution Time'])||!finite(value[0]['Planning Time']))throw Error('Complete measured query plan required.');
  const root=value[0].Plan,out={planning_ms:rounded(value[0]['Planning Time']),execution_ms:rounded(value[0]['Execution Time']),node_types:{},scan_output_rows:{},disk_sort_nodes:0};
  for(const [key,field]of Object.entries({shared_hit_blocks:'Shared Hit Blocks',shared_read_blocks:'Shared Read Blocks',temp_read_blocks:'Temp Read Blocks',temp_written_blocks:'Temp Written Blocks'})){
    if(!finite(root[field]))throw Error('Measured buffer counts required.');out[key]=root[field];
  }
  let nodes=0;
  function visit(node,depth=0){
    if(!node||typeof node!=='object'||depth>64||++nodes>4096||!finite(node['Actual Rows'])||!finite(node['Actual Loops']))throw Error('Invalid or excessive measured query plan.');
    const type=nodeTypes.has(node['Node Type'])?node['Node Type']:'Other';out.node_types[type]=(out.node_types[type]??0)+1;
    if(relations.has(node['Relation Name'])&&type.endsWith('Scan'))out.scan_output_rows[node['Relation Name']]=(out.scan_output_rows[node['Relation Name']]??0)+node['Actual Rows']*node['Actual Loops'];
    if(node['Sort Space Type']==='Disk')out.disk_sort_nodes++;
    if(node.Plans!==undefined){if(!Array.isArray(node.Plans))throw Error('Invalid query children.');for(const child of node.Plans)visit(child,depth+1);}
  }
  visit(root);return out;
}
