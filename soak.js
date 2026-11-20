#!/usr/bin/env node
// Soak test bắt buộc (TICKET-04 Phần 2, Test Contract v1.3).
// Dùng: node soak.js --seed 7 --nights 10 --out soak.json
import { writeFileSync } from 'node:fs';
import { Sim, mulberry32, TPS } from './src/sim.js';

function parseArgs(argv) {
  const a = {};
  const known = new Set(['seed', 'nights', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--') || !known.has(k.slice(2))) {
      throw new Error(`Tham số không hợp lệ: ${k}`);
    }
    if (i + 1 >= argv.length) throw new Error(`Thiếu giá trị cho ${k}`);
    a[k.slice(2)] = argv[++i];
  }
  const int = (name, def, min) => {
    const raw = a[name] ?? (def !== undefined ? String(def) : '');
    if (!/^-?\d+$/.test(raw)) throw new Error(`--${name} phải là số nguyên`);
    const v = Number(raw);
    if (v < min) throw new Error(`--${name} phải >= ${min}`);
    return v;
  };
  const out = a.out;
  if (!out) throw new Error('Thiếu --out');
  return {
    seed: int('seed', 7, -2147483648),
    nights: int('nights', 10, 1),
    out,
  };
}

const r1 = (v) => Math.round(v * 10) / 10;
const rssMb = () => process.memoryUsage().rss / (1024 * 1024);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  const results = [];
  let crashes = 0;
  let memStartMb = 0;

  // Khởi động engine (nạp dữ liệu 3 đêm & biên dịch JIT TurboFan cho toàn bộ nhánh shade/drifter/wind trước khi tải Đêm đầu tiên)
  // để mem_start_mb phản ánh đúng bộ nhớ ổn định của engine thay vì chi phí biên dịch JIT trễ của V8.
  const inp = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (const warmNight of [2, 3]) {
    let warm = new Sim({ seed: 99 + warmNight, night: warmNight });
    warm.drainEvents();
    for (let w = 0; w < 4000 && warm.state === 'playing'; w++) {
      inp.move[0] = (w % 60 < 30) ? 0.8 : -0.8;
      inp.move[1] = (w % 40 < 20) ? 0.6 : -0.6;
      inp.jump = (w % 20 === 0);
      inp.dash = (w % 35 === 0);
      inp.pulse = (w % 50 === 0);
      inp.interact = (w % 10 === 0);
      warm.step(inp);
      warm.drainEvents();
    }
    warm = null;
  }
  if (typeof globalThis.gc === 'function') globalThis.gc();

  for (let i = 0; i < opts.nights; i++) {
    const nightId = (i % 3) + 1;
    const nightSeed = opts.seed + i;
    const inpRng = mulberry32((nightSeed * 2654435761) >>> 0);
    let sim = null;

    try {
      sim = new Sim({ seed: nightSeed, night: nightId });
      sim.drainEvents();
      if (i === 0) {
        memStartMb = r1(rssMb());
      }

      const maxTicks = Math.round(sim.nightCfg.duration_s * TPS);
      for (let k = 0; k < maxTicks && sim.state === 'playing'; k++) {
        if (k % 30 === 0) {
          const ang = inpRng() * Math.PI * 2;
          inp.move[0] = Math.cos(ang);
          inp.move[1] = Math.sin(ang);
        }
        inp.jump = inpRng() < 0.05;
        inp.dash = inpRng() < 0.03;
        inp.pulse = inpRng() < 0.02;
        inp.interact = inpRng() < 0.10;
        sim.step(inp);
        sim.drainEvents();
      }
      results.push(sim.state === 'won' ? 'won' : 'lost');
    } catch (err) {
      crashes++;
      results.push('crash');
      process.stderr.write(`Soak crash ở đêm #${i + 1} (night=${nightId}, seed=${nightSeed}): ${err.stack || err}\n`);
    } finally {
      // Reset hoàn toàn tham chiếu cuối mỗi Đêm để kiểm chứng không rò rỉ bộ nhớ
      sim = null;
    }
  }

  if (typeof globalThis.gc === 'function') globalThis.gc();
  const memEndMb = r1(rssMb());
  const durationS = r1((performance.now() - t0) / 1000);

  const report = {
    nights: opts.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  writeFileSync(opts.out, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
}

try {
  main();
} catch (err) {
  process.stderr.write(`Lỗi soak: ${err.message || err}\n`);
  process.exit(1);
}
