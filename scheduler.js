/* Group 2 OS PBL. Pure scheduling functions shared by the browser and Node.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validate(input, quantum = 2) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 20)
      throw new Error('Enter between 1 and 20 processes.');
    if (!Number.isInteger(quantum) || quantum < 1 || quantum > 1000)
      throw new Error('Quantum must be an integer between 1 and 1000.');
    const ids = new Set();
    return input.map((p, order) => {
      if (!p || typeof p.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,11}$/.test(p.id))
        throw new Error('Use a process ID starting with a letter, up to 12 letters, digits, underscores or hyphens.');
      if (ids.has(p.id)) throw new Error('Process IDs must be unique.');
      if (p.id.toUpperCase() === 'IDLE') throw new Error('IDLE is reserved for CPU idle intervals.');
      ids.add(p.id);
      if (!Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > 100000)
        throw new Error('Arrival time must be an integer between 0 and 100000.');
      if (!Number.isInteger(p.burst) || p.burst < 1 || p.burst > 1000)
        throw new Error('Burst time must be an integer between 1 and 1000.');
      return { id: p.id, arrival: p.arrival, burst: p.burst, order,
        remaining: p.burst, first: null, completion: null };
    });
  }

  function summarize(algorithm, processes, segments, quantum) {
    const metrics = processes.slice().sort((a, b) => a.order - b.order).map(p => ({
      id: p.id, arrival: p.arrival, burst: p.burst,
      firstStart: p.first, completion: p.completion,
      turnaround: p.completion - p.arrival,
      waiting: p.completion - p.arrival - p.burst,
      response: p.first - p.arrival
    }));
    const average = key => metrics.reduce((sum, p) => sum + p[key], 0) / metrics.length;
    const busy = processes.reduce((sum, p) => sum + p.burst, 0);
    const end = segments[segments.length - 1].end;
    let handoffs = 0;
    for (let i = 1; i < segments.length; i++) {
      const a = segments[i - 1], b = segments[i];
      if (a.id !== 'IDLE' && b.id !== 'IDLE' && a.id !== b.id) handoffs++;
    }
    return { algorithm, quantum: algorithm === 'RR' ? quantum : null,
      segments, metrics, averages: { waiting: average('waiting'),
        turnaround: average('turnaround'), response: average('response') },
      busy, elapsed: end, idle: end - busy, utilization: 100 * busy / end,
      throughput: processes.length / end, handoffs,
      slices: segments.filter(s => s.id !== 'IDLE').length };
  }

  function simulate(input, algorithm, quantum = 2) {
    if (!['FCFS', 'SJN', 'RR'].includes(algorithm)) throw new Error('Unknown algorithm.');
    const processes = validate(input, quantum);
    const arrivalOrder = processes.slice().sort((a, b) => a.arrival - b.arrival || a.order - b.order);
    const segments = [];
    let time = 0;
    const execute = (p, duration) => {
      if (p.first === null) p.first = time;
      segments.push({ id: p.id, start: time, end: time + duration });
      time += duration;
      p.remaining -= duration;
      if (p.remaining === 0) p.completion = time;
    };
    const idleUntil = next => {
      if (time < next) segments.push({ id: 'IDLE', start: time, end: next });
      time = next;
    };

    if (algorithm === 'RR') {
      const ready = [];
      let next = 0;
      const enqueueArrivals = () => {
        while (next < arrivalOrder.length && arrivalOrder[next].arrival <= time)
          ready.push(arrivalOrder[next++]);
      };
      while (next < arrivalOrder.length || ready.length) {
        if (!ready.length && next < arrivalOrder.length) idleUntil(arrivalOrder[next].arrival);
        enqueueArrivals();
        const p = ready.shift();
        execute(p, Math.min(quantum, p.remaining));
        // Include arrivals at the slice boundary BEFORE requeueing the running process.
        enqueueArrivals();
        if (p.remaining > 0) ready.push(p);
      }
    } else {
      const pending = arrivalOrder.slice();
      while (pending.length) {
        let ready = pending.filter(p => p.arrival <= time);
        if (!ready.length) {
          idleUntil(Math.min(...pending.map(p => p.arrival)));
          ready = pending.filter(p => p.arrival <= time);
        }
        ready.sort((a, b) => (algorithm === 'SJN' ? a.burst - b.burst : 0)
          || a.arrival - b.arrival || a.order - b.order);
        const p = ready[0];
        pending.splice(pending.indexOf(p), 1);
        execute(p, p.remaining);
      }
    }
    return summarize(algorithm, processes, segments, quantum);
  }
  function compare(input, quantum = 2) {
    return ['FCFS', 'SJN', 'RR'].map(a => simulate(input, a, quantum));
  }
  return { validate, simulate, compare };
});
