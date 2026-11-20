// Benchmark hiệu năng headless 3 đêm đầy đủ ở --snapshot-every 10 và --snapshot-every 1 (M10).
// Dùng: node scripts/bench.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim } from '../src/sim.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-bench-'));

console.log(`Môi trường: Node ${process.version} · ${platform()}/${arch()} · ${cpus()[0]?.model || 'CPU'}`);
console.log('--- Đo headless CLI (3 đêm đầy đủ) ---');

const cases = [
  { night: 1, ticks: 18000, every: 10 },
  { night: 2, ticks: 19800, every: 10 },
  { night: 3, ticks: 21600, every: 10 },
  { night: 1, ticks: 18000, every: 1 },
  { night: 2, ticks: 19800, every: 1 },
  { night: 3, ticks: 21600, every: 1 },
];

for (const c of cases) {
  const out = join(tmp, `n${c.night}-e${c.every}.jsonl`);
  const t0 = performance.now();
  const r = spawnSync(
    process.execPath,
    [join(root, 'headless.js'), '--seed', '7', '--night', String(c.night), '--ticks', String(c.ticks), '--out', out, '--snapshot-every', String(c.every)],
    { encoding: 'utf8' },
  );
  const ms = performance.now() - t0;
  if (r.status !== 0) {
    console.error(`LỖI Đêm ${c.night}: ${r.stderr}`);
    process.exit(1);
  }
  const sizeMB = (statSync(out).size / (1024 * 1024)).toFixed(2);
  console.log(`Đêm ${c.night} (${c.ticks} tick, every=${c.every}): ${ms.toFixed(0)} ms · file=${sizeMB} MB`);
}

console.log('--- Đo bộ nhớ đỉnh in-process (Đêm 3, 21600 tick, snapshot mỗi tick) ---');
let peakRss = 0;
let peakHeap = 0;
const t0 = performance.now();
const sim = new Sim({ seed: 7, night: 3 });
sim.drainEvents();
for (let k = 0; k < 21600 && sim.state === 'playing'; k++) {
  sim.step({ move: [0, 0] });
  sim.drainEvents();
  sim.snapshot();
  if (k % 2000 === 0) {
    const mu = process.memoryUsage();
    if (mu.rss > peakRss) peakRss = mu.rss;
    if (mu.heapUsed > peakHeap) peakHeap = mu.heapUsed;
  }
}
const simMs = performance.now() - t0;
const muEnd = process.memoryUsage();
peakRss = Math.max(peakRss, muEnd.rss);
peakHeap = Math.max(peakHeap, muEnd.heapUsed);
console.log(`In-process Đêm 3 (21600 tick + 21600 snapshot): ${simMs.toFixed(0)} ms · peak RSS=${(peakRss / 1048576).toFixed(1)} MB · peak heap=${(peakHeap / 1048576).toFixed(1)} MB`);
