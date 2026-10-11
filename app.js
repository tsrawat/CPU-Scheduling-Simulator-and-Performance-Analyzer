(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const examples = {
    main: [{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2},{id:'P4',arrival:3,burst:1}],
    batch: [{id:'P1',arrival:0,burst:8},{id:'P2',arrival:0,burst:4},{id:'P3',arrival:0,burst:2},{id:'P4',arrival:0,burst:1}],
    idle: [{id:'P1',arrival:2,burst:3},{id:'P2',arrival:8,burst:2}]
  };
  let results = [], step = -1;
  const colors = ['#c4dcf1','#ffd7b9','#c9e4cd','#ead2ee','#eae2b4','#c4e8e6'];
  const fmt = x => x.toFixed(2);
  const escape = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function invalidate() { results = []; $('results').hidden = true; $('error').textContent = ''; }
  function addRow(p) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><input class="pid" aria-label="Process ID" value="${escape(p.id)}" maxlength="12"></td><td><input class="arrival" aria-label="Arrival time" type="number" min="0" max="100000" value="${p.arrival}"></td><td><input class="burst" aria-label="Burst time" type="number" min="1" max="1000" value="${p.burst}"></td><td><button type="button" aria-label="Remove process">Remove</button></td>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); invalidate(); });
    row.addEventListener('input', invalidate);
    $('inputs').append(row);
  }
  function loadExample() {
    $('inputs').replaceChildren(); examples[$('example').value].forEach(addRow); invalidate();
  }
  function readInput() {
    return [...$('inputs').children].map(row => ({ id: row.querySelector('.pid').value.trim(),
      arrival: row.querySelector('.arrival').value === '' ? NaN : Number(row.querySelector('.arrival').value),
      burst: row.querySelector('.burst').value === '' ? NaN : Number(row.querySelector('.burst').value) }));
  }
  function run() {
    try {
      const q = $('quantum').value === '' ? NaN : Number($('quantum').value);
      results = Scheduler.compare(readInput(), q);
      $('error').textContent = ''; $('results').hidden = false;
      $('comparison').innerHTML = results.map(r => `<tr data-algorithm="${r.algorithm}"><td>${r.algorithm}${r.algorithm === 'RR' ? ' (q = '+q+')' : ''}</td><td>${fmt(r.averages.waiting)}</td><td>${fmt(r.averages.turnaround)}</td><td>${fmt(r.averages.response)}</td><td>${fmt(r.utilization)}%</td><td>${r.handoffs}</td></tr>`).join('');
      [...$('comparison').children].forEach(row => row.addEventListener('click', () => { $('algorithm').value = row.dataset.algorithm; renderSchedule(); }));
      const bestWait = Math.min(...results.map(r => r.averages.waiting));
      const bestResponse = Math.min(...results.map(r => r.averages.response));
      const names = key => results.filter(r => Math.abs(r.averages[key] - (key === 'waiting' ? bestWait : bestResponse)) < 1e-9).map(r=>r.algorithm).join(', ');
      $('finding').textContent = `For this workload, lowest average waiting: ${names('waiting')} (${fmt(bestWait)}). Lowest average response: ${names('response')} (${fmt(bestResponse)}). Rankings depend on the workload and quantum.`;
      renderSchedule();
    } catch (error) { results = []; $('results').hidden = true; $('error').textContent = error.message; }
  }
  function selected() { return results.find(r => r.algorithm === $('algorithm').value); }
  function renderSchedule() {
    const r = selected(); if (!r) return;
    step = -1;
    const names = r.metrics.map(p=>p.id);
    $('description').textContent = ({ FCFS: 'FCFS executes in arrival order without preemption.', SJN: 'SJN selects the shortest burst from the ready processes and runs it to completion.', RR: `Round Robin uses a quantum of ${r.quantum} time units and a FIFO ready queue.` })[r.algorithm];
    const minDuration = Math.min(...r.segments.map(s=>s.end-s.start));
    const scale = Math.max(900 / r.elapsed, 60 / minDuration);
    const fragment = document.createDocumentFragment();
    r.segments.forEach(s => {
      const box=document.createElement('div');box.className='slice';
      box.style.width=`${(s.end-s.start)*scale}px`;
      box.style.background=s.id==='IDLE'?'#e5e7eb':colors[names.indexOf(s.id)%colors.length];
      box.innerHTML=`${escape(s.id)}<small>${s.start}–${s.end}</small>`;fragment.append(box);
    });
    $('gantt').replaceChildren(fragment);
    $('metrics').innerHTML=r.metrics.map(p=>`<tr>${['id','arrival','burst','firstStart','completion','turnaround','waiting','response'].map(k=>`<td>${escape(p[k])}</td>`).join('')}</tr>`).join('');
    $('totals').textContent=`Busy ${r.busy} / elapsed ${r.elapsed} time units. Idle ${r.idle}. Throughput ${r.throughput.toFixed(4)} processes per time unit. Execution slices ${r.slices}. Handoffs ${r.handoffs}.`;
    [...$('comparison').children].forEach(row=>row.classList.toggle('selected',row.dataset.algorithm===r.algorithm));
    updateStep();
  }
  function updateStep() {
    const r=selected();if(!r)return;
    [...$('gantt').children].forEach((box,i)=>box.classList.toggle('active',i===step));
    $('previous').disabled=step<0;$('next').disabled=step>=r.segments.length-1;
    $('step').textContent=step<0?'Ready to begin':`Slice ${step+1} of ${r.segments.length}`;
    if(step<0){$('step-detail').textContent='Use Next slice to highlight each CPU execution or idle interval.';return;}
    const s=r.segments[step];
    $('step-detail').textContent=s.id==='IDLE'?`CPU idle from ${s.start} to ${s.end}. No process is ready.`:`${s.id} runs from ${s.start} to ${s.end} for ${s.end-s.start} time units.`;
    $('gantt').children[step].scrollIntoView({block:'nearest',inline:'nearest'});
  }
  $('load').addEventListener('click',loadExample);
  $('add').addEventListener('click',()=>{
    if($('inputs').children.length>=20){$('error').textContent='The limit is 20 processes.';return;}
    const used=new Set(readInput().map(p=>p.id));let i=1;while(used.has('P'+i))i++;
    addRow({id:'P'+i,arrival:0,burst:1});invalidate();
  });
  $('quantum').addEventListener('input',invalidate);
  $('run').addEventListener('click',run);
  $('algorithm').addEventListener('change',renderSchedule);
  $('next').addEventListener('click',()=>{step++;updateStep();});
  $('previous').addEventListener('click',()=>{step--;updateStep();});
  $('reset').addEventListener('click',()=>{step=-1;updateStep();});
  $('csv').addEventListener('click',()=>{
    const lines=['algorithm,quantum,process,arrival,burst,first_start,completion,turnaround,waiting,response'];
    results.forEach(r=>r.metrics.forEach(p=>lines.push([r.algorithm,r.quantum??'',p.id,p.arrival,p.burst,p.firstStart,p.completion,p.turnaround,p.waiting,p.response].join(','))));
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='scheduling-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  loadExample();run();
})();
