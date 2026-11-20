// Test M10/M11: Cổng chặn "Log vàng" — bảo đảm mọi tối ưu & sáng tạo KHÔNG đổi đầu ra headless dù chỉ 1 byte.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-golden-'));
const goldenDir = join(root, 'evidence', 'golden');
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 2 M10/M11 — Golden Log Byte-by-Byte Guard');

const inputsFile = join(goldenDir, 'inputs.json');
for (const night of [1, 2, 3]) {
  test(`log vàng Đêm ${night}: khớp 100% từng byte với evidence/golden/night${night}.jsonl`, () => {
    const out = join(tmp, `n${night}.jsonl`);
    const r = spawnSync(
      process.execPath,
      [join(root, 'headless.js'), '--seed', '19', '--night', String(night), '--inputs', inputsFile, '--ticks', '2000', '--out', out, '--snapshot-every', '20'],
      { encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    const actual = readFileSync(out, 'utf8');
    const expected = readFileSync(join(goldenDir, `night${night}.jsonl`), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, expected, `Đầu ra headless Đêm ${night} lệch khỏi log vàng!`);
  });
}

console.log(`\nGolden Guard: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
