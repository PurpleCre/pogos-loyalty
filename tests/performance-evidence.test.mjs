import assert from 'node:assert/strict';
import {test} from 'node:test';
import {latencySummary,summariseExplain} from '../scripts/performance-evidence.mjs';
test('latency evidence uses nearest-rank percentiles without mutating samples or accepting incomplete values',()=>{
  const values=[40,10,30,20];assert.deepEqual(latencySummary(values),{samples:4,p50_ms:20,p95_ms:40,p99_ms:40,max_ms:40});assert.deepEqual(values,[40,10,30,20]);
  assert.equal(latencySummary(Array.from({length:100},(_,i)=>i+1)).p95_ms,95);
  for(const value of [[],[NaN],[Infinity],[-1],[null],null])assert.throws(()=>latencySummary(value));
});
const plan=()=>[{'Planning Time':1.25,'Execution Time':5.5,Plan:{'Node Type':'Aggregate','Actual Rows':1,'Actual Loops':1,'Shared Hit Blocks':12,'Shared Read Blocks':3,'Temp Read Blocks':0,'Temp Written Blocks':0,
  'Output':['private@example.invalid'],'Plans':[{'Node Type':'Seq Scan','Relation Name':'loyalty_ledger','Actual Rows':100,'Actual Loops':2,Filter:'secret-token',Plans:[]},{'Node Type':'Sort','Actual Rows':1,'Actual Loops':1,'Sort Space Type':'Disk'}]}}];
test('query evidence counts looped scans and root buffers once and drops all raw expressions and unknown identifiers',()=>{
  const p=plan();p[0].Plan.Plans.push({'Node Type':'private-custom-node','Relation Name':'private_customer_identifier','Actual Rows':4,'Actual Loops':1});
  const result=summariseExplain(p);assert.deepEqual(result.scan_output_rows,{loyalty_ledger:200});assert.equal(result.shared_hit_blocks,12);assert.equal(result.disk_sort_nodes,1);assert.equal(result.node_types.Other,1);
  for(const text of ['private','secret','Filter','Output'])assert.ok(!JSON.stringify(result).includes(text));
});
test('query evidence rejects estimated-only, malformed, recursive and excessive plans',()=>{
  for(const change of [p=>delete p[0]['Execution Time'],p=>delete p[0].Plan['Shared Read Blocks'],p=>p[0].Plan['Actual Rows']=-1,p=>p[0].Plan.Plans={},p=>p[0].Plan.Plans=[p[0].Plan]]){const p=plan();change(p);assert.throws(()=>summariseExplain(p));}
});
