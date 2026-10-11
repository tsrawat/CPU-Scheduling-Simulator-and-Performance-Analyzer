# Group 2 Process Scheduling Simulator

Open **index.html** in Microsoft Edge or another modern desktop browser. The program works offline. No installation, server, internet connection or external library is required to use it.

## Group details

Bharati Vidyapeeth's College of Engineering, New Delhi, Department of Computer Science and Engineering. Operating System, CIC-305T. B.Tech CSE-2, third year, odd semester 2026. Faculty: Dr. Aarti.

- Tanuj Singh Rawat — 06511502724
- Devasya Modi — 07011502724
- Akshita Sachdeva — 07311502724

## Use

1. Load a sample workload or enter 1–20 processes.
2. Enter unique process IDs, nonnegative arrival times and positive burst times.
3. Set a positive integer Round Robin quantum.
4. Click **Run all algorithms**.
5. Compare averages, choose an algorithm, and inspect its Gantt chart and process metrics.
6. Use **Next slice** to follow execution. Use **Download CSV** to export every process result.

Times are abstract units. Inputs must be integers. Arrival limits: 0–100000. Burst and quantum limits: 1–1000. The ID `IDLE` is reserved for idle intervals.

## Algorithms and conventions

- FCFS: non-preemptive arrival order.
- SJN: non-preemptive Shortest Job Next, also called SJF. Select the minimum burst from processes that have arrived.
- RR: FIFO ready queue. Run for min(quantum, remaining burst). Add arrivals through the end of the slice before requeueing the unfinished process.
- Ties: arrival time, then original input order.
- One CPU, one known CPU burst per process, no I/O, no priority and zero context switch cost.
- CPU idle time is shown explicitly. Utilization is busy time / elapsed time from 0 × 100.
- Handoffs count consecutive non-idle execution blocks belonging to different processes. Adjacent slices of the same process do not count as a handoff.

## Verify

If Node.js is installed, open a terminal in this directory and run:

```text
node test_scheduler.js
```

The included test suite passed 14 test groups on 11 October 2026, including 300 deterministic random workloads across all three algorithms (900 comparisons against an independent time-tick model). The actual browser interface passed 10 checks in Microsoft Edge, including CSV export, validation, stepping and mobile width. The browser QA script is a build tool and is not required to run the simulator.

The tests regenerate `results/verified_results.json` and `results/comparison.csv`. The main workload gives:

| Algorithm | Average WT | Average TAT | Average RT |
|---|---:|---:|---:|
| FCFS | 7.00 | 10.75 | 7.00 |
| SJN | 5.50 | 9.25 | 5.50 |
| RR q=2 | 5.00 | 8.75 | 2.00 |

These rankings describe this workload only. When all four processes arrive at 0, SJN has average waiting 2.75 and RR q=2 has 6.00. A smaller RR quantum adds handoffs, whose time cost is excluded from this model.

## Source files

- `index.html`: browser interface
- `styles.css`: responsive layout
- `scheduler.js`: complete scheduling engine and metrics
- `app.js`: inputs, Gantt chart, results, stepping and CSV export
- `test_scheduler.js`: deterministic, validation and randomized tests
- `results/`: verified experimental outputs

## References

1. Supplied Group 2 allocation: `OS PBL-448eefeed8c6.docx`.
2. Arpaci-Dusseau and Arpaci-Dusseau, Operating Systems: Three Easy Pieces, Chapter 7: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf
3. John Bell, UIC CPU Scheduling notes: https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/6_CPU_Scheduling.html
4. Linux sched(7), SCHED_RR policy, verified source version 6.13: https://kernel.googlesource.com/pub/scm/docs/man-pages/man-pages/+/refs/tags/man-pages-6.13/man/man7/sched.7

The supplied micro-project report and presentation were formatting references. Their air-pollution project content is unrelated to this simulator.
