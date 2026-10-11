'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./scheduler.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const main=[{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2},{id:'P4',arrival:3,burst:1}];
const batch=main.map(p=>({...p,arrival:0}));
const idle=[{id:'P1',arrival:2,burst:3},{id:'P2',arrival:8,burst:2}];
const trace=r=>r.segments.map(s=>`${s.id}:${s.start}-${s.end}`).join(',');
test('FCFS hand-calculated staggered schedule',()=>{
 const r=S.simulate(main,'FCFS');
 assert.equal(trace(r),'P1:0-8,P2:8-12,P3:12-14,P4:14-15');
 assert.deepEqual(r.averages,{waiting:7,turnaround:10.75,response:7});
});
test('SJN chooses the shortest arrived process without preemption',()=>{
 const r=S.simulate(main,'SJN');
 assert.equal(trace(r),'P1:0-8,P4:8-9,P3:9-11,P2:11-15');
 assert.deepEqual(r.averages,{waiting:5.5,turnaround:9.25,response:5.5});
});
test('RR q2 schedule and process metrics',()=>{
 const r=S.simulate(main,'RR',2);
 assert.equal(trace(r),'P1:0-2,P2:2-4,P3:4-6,P1:6-8,P4:8-9,P2:9-11,P1:11-13,P1:13-15');
 assert.deepEqual(r.averages,{waiting:5,turnaround:8.75,response:2});
 assert.deepEqual(r.metrics.map(p=>p.completion),[15,11,6,9]);
 assert.equal(r.handoffs,6);assert.equal(r.slices,8);
});
test('Simultaneous arrivals and SJN tie breaking',()=>{
 const r=S.simulate(batch,'SJN');
 assert.equal(trace(r),'P4:0-1,P3:1-3,P2:3-7,P1:7-15');
 assert.equal(r.averages.waiting,2.75);
 const tie=[{id:'A',arrival:0,burst:2},{id:'B',arrival:0,burst:2}];
 assert.equal(trace(S.simulate(tie,'SJN')),'A:0-2,B:2-4');
});
test('Initial idle and later idle gaps',()=>{
 for(const a of ['FCFS','SJN','RR']){
  const r=S.simulate(idle,a,2);assert.equal(r.elapsed,10);assert.equal(r.idle,5);assert.equal(r.utilization,50);
  assert.equal(r.segments[0].id,'IDLE');assert.equal(r.handoffs,0);
 }
});
test('Boundary arrivals enter RR queue before requeued process',()=>{
 const ps=[{id:'A',arrival:0,burst:4},{id:'B',arrival:2,burst:1}];
 assert.equal(trace(S.simulate(ps,'RR',2)),'A:0-2,B:2-3,A:3-5');
});
test('RR with large quantum matches FCFS completion times',()=>{
 assert.deepEqual(S.simulate(main,'RR',100).metrics,S.simulate(main,'FCFS').metrics);
});
test('One process and quantum one',()=>{
 const r=S.simulate([{id:'A',arrival:0,burst:3}],'RR',1);
 assert.equal(r.slices,3);assert.equal(r.handoffs,0);assert.equal(r.averages.waiting,0);
});
test('Unsorted arrival input retains correct original output order',()=>{
 const ps=[{id:'B',arrival:4,burst:1},{id:'A',arrival:0,burst:2}];
 assert.equal(trace(S.simulate(ps,'FCFS')),'A:0-2,IDLE:2-4,B:4-5');
 assert.deepEqual(S.simulate(ps,'FCFS').metrics.map(p=>p.id),['B','A']);
});
test('Input is not mutated',()=>{
 const copy=JSON.stringify(main);S.compare(main,2);assert.equal(JSON.stringify(main),copy);
});
test('Reject empty inputs and unknown algorithms',()=>{
 assert.throws(()=>S.simulate([],'FCFS'));assert.throws(()=>S.simulate(main,'BAD'));
});
test('Reject negative, fractional, empty and zero timings',()=>{
 for(const [key,value] of [['arrival',-1],['arrival',0.5],['arrival',NaN],['burst',0],['burst',1.2],['burst',1001]])
  assert.throws(()=>S.simulate([{id:'A',arrival:0,burst:1,[key]:value}],'FCFS'));
 for(const q of [0,-1,1.5,NaN,1001])assert.throws(()=>S.simulate(main,'RR',q));
});
test('Reject duplicate or invalid process IDs and oversized sets',()=>{
 assert.throws(()=>S.simulate([{id:'A',arrival:0,burst:1},{id:'A',arrival:0,burst:2}],'FCFS'));
 assert.throws(()=>S.simulate([{id:'<script>',arrival:0,burst:1}],'FCFS'));
 assert.throws(()=>S.simulate([{id:'IDLE',arrival:0,burst:1}],'FCFS'));
 assert.throws(()=>S.simulate(Array.from({length:21},(_,i)=>({id:'P'+i,arrival:0,burst:1})),'FCFS'));
});
// Independent time-tick reference implementation for randomized differential tests.
function reference(ps,a,q){
 const p=ps.map((x,i)=>({...x,i,left:x.burst,first:null,end:null}));
 let t=0,running=null,used=0,finished=0;const ready=[];
 while(finished<p.length){
  p.filter(x=>x.arrival===t).forEach(x=>ready.push(x));
  if(a==='RR'&&running&&(running.left===0||used===q)){
   if(running.left>0)ready.push(running);running=null;used=0;
  }else if(running&&running.left===0)running=null;
  if(!running&&ready.length){
   if(a==='SJN')ready.sort((x,y)=>x.burst-y.burst||x.arrival-y.arrival||x.i-y.i);
   running=ready.shift();used=0;if(running.first===null)running.first=t;
  }
  if(running){running.left--;used++;if(!running.left){running.end=t+1;finished++;}}
  t++;
 }
 return p.map(x=>({id:x.id,firstStart:x.first,completion:x.end,waiting:x.end-x.arrival-x.burst,response:x.first-x.arrival}));
}
let seed=305;
const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
test('300 random workloads match an independent time-tick model',()=>{
 for(let k=0;k<300;k++){
  const ps=Array.from({length:1+random(6)},(_,i)=>({id:'P'+(i+1),arrival:random(11),burst:1+random(9)}));const q=1+random(5);
  for(const a of ['FCFS','SJN','RR']){
   const r=S.simulate(ps,a,q),ref=reference(ps,a,q);
   assert.deepEqual(r.metrics.map(x=>({id:x.id,firstStart:x.firstStart,completion:x.completion,waiting:x.waiting,response:x.response})),ref);
   assert.equal(r.segments[0].start,0);
   r.segments.forEach((s,i)=>{assert.ok(s.end>s.start);if(i)assert.equal(s.start,r.segments[i-1].end);});
   ps.forEach(p=>assert.equal(r.segments.filter(s=>s.id===p.id).reduce((sum,s)=>sum+s.end-s.start,0),p.burst));
  }
 }
});
const evidence={generatedAt:'2026-10-11',testGroupsPassed:passed,randomWorkloads:300,randomAlgorithmRuns:900,
 main:{input:main,quantum:2,results:S.compare(main,2)},batch:{input:batch,results:S.compare(batch,2)},
 idle:{input:idle,results:S.compare(idle,2)},quantumStudy:[1,2,4,8].map(q=>S.simulate(main,'RR',q))};
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'results','verified_results.json'),JSON.stringify(evidence,null,2));
const lines=['workload,algorithm,quantum,avg_waiting,avg_turnaround,avg_response,utilization,handoffs,slices'];
for(const name of ['main','batch','idle'])evidence[name].results.forEach(r=>lines.push([name,r.algorithm,r.quantum??'',r.averages.waiting,r.averages.turnaround,r.averages.response,r.utilization,r.handoffs,r.slices].join(',')));
evidence.quantumStudy.forEach(r=>lines.push(['quantum',r.algorithm,r.quantum,r.averages.waiting,r.averages.turnaround,r.averages.response,r.utilization,r.handoffs,r.slices].join(',')));
fs.writeFileSync(path.join(__dirname,'results','comparison.csv'),lines.join('\n'));
console.log(`\n${passed} test groups passed. 900 randomized algorithm runs checked. Evidence saved in results/.`);
