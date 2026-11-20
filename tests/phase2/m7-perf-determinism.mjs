// Test M7: Hiệu năng 3 đêm đầy đủ (<= 30 s), tất định byte-by-byte cho cả 3 đêm, và kiểm tra thuần khiết lõi src/.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m7-'));
let passed = 0, failed = 0;

function runHeadless({ night, ticks, seed, frames, every = 10, name }) {
  const out = join(tmp, name + '.jsonl');
  const args = ['--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (frames) {
    const f = join(tmp, name + '.in.json');
    writeFileSync(f, JSON.stringify({ frames }));
    args.push('--inputs', f);
  }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(root, 'headless.js'), ...args], { encoding: 'utf8' });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 0, r.stderr);
  return { raw: readFileSync(out, 'utf8'), elapsed };
}

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 2 M7 — Full-Night Performance, 3-Night Determinism & Pure Core Audit');

test('night-full: cả 3 đêm đầy đủ (14400/16200/18000 tick theo TICKET-03) chạy headless <= 30 s và tất định byte-by-byte', () => {
  const frames = [
    { tick: 0, move: [0.6, 0.8] },
    { tick: 60, dash: true },
    { tick: 61, dash: false, move: [-0.5, 0.7] },
    { tick: 180, move: [0, 0] },
  ];
  for (const [night, ticks] of [[1, 14400], [2, 16200], [3, 18000]]) {
    const a = runHeadless({ night, ticks, seed: 77, frames, every: 10, name: `n${night}-a` });
    const b = runHeadless({ night, ticks, seed: 77, frames, every: 10, name: `n${night}-b` });
    assert.ok(a.elapsed < 30000, `Đêm ${night} quá chậm: ${a.elapsed} ms`);
    assert.equal(a.raw, b.raw, `Đêm ${night} không tất định giữa 2 lần chạy`);
    console.log(`    [Đêm ${night}: ${ticks} tick -> ${a.elapsed} ms, ${a.raw.length} bytes, byte-identical PASS]`);
  }
});

test('pure-core-audit: src/ không dùng Math.random, Date, performance, DOM, I/O hay import từ public/', () => {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.js')) files.push(full);
    }
  }
  walk(join(root, 'src'));
  assert.ok(files.length >= 6);
  const banned = [/\bMath\.random\b/, /\bDate\b/, /\bperformance\b/, /\bwindow\b/, /\bdocument\b/, /from\s+['"]node:/, /public\//];
  for (const f of files) {
    // Bỏ qua chú thích // (cả dòng và cuối dòng)
    const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const re of banned) {
      assert.ok(!re.test(code), `Vi phạm lõi thuần tại ${f}: khớp ${re}`);
    }
  }
});

console.log(`\nM7: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
