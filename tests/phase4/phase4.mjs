// Bộ test tự động Phase 4 (TICKET-04, Test Contract v1.3):
// Contract v1.3, Soak 10 đêm, Bench Sim Mode (200 bóng + 100 đom đóm), Bảng xếp hạng cục bộ + --export-leaderboard,
// Dễ tiếp cận (đổi phím + báo trùng + mặc định, phụ đề + mũi tên, giảm chuyển động, chữ >= 18px & x1.25), đóng gói phát hành.
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { TUNING as T } from '../../src/tuning.js';
import { Sim, mulberry32 } from '../../src/sim.js';
import { getNight } from '../../src/nights/index.js';
import { validatePlayerName, addLeaderboardEntry, loadLeaderboard } from '../../lib/leaderboard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-p4-'));
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 4 (TICKET-04, Contract v1.3) — Benchmark, Soak, Leaderboard, Accessibility & Release');

test('contract-v1.3: game.contract.json có contract_version 1.3, bench_cmd, soak_cmd và giữ nguyên tuning', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.3');
  assert.equal(c.bench_cmd, 'node bench.js');
  assert.equal(c.soak_cmd, 'node soak.js');
  assert.equal(c.run_cmd, 'node server.js');
  assert.equal(c.headless_cmd, 'node headless.js');
  assert.deepEqual(c.tuning, T);
});

test('soak-10-nights: chạy 10 đêm liên tiếp (seed 7..16), 0 crash, mem_end_mb <= 1.2 * mem_start_mb, tất định', () => {
  const out1 = join(tmp, 'soak1.json');
  const out2 = join(tmp, 'soak2.json');
  const r1 = spawnSync(process.execPath, [join(root, 'soak.js'), '--seed', '7', '--nights', '10', '--out', out1], { encoding: 'utf8' });
  assert.equal(r1.status, 0, r1.stderr);
  const r2 = spawnSync(process.execPath, [join(root, 'soak.js'), '--seed', '7', '--nights', '10', '--out', out2], { encoding: 'utf8' });
  assert.equal(r2.status, 0, r2.stderr);

  const s1 = JSON.parse(readFileSync(out1, 'utf8'));
  const s2 = JSON.parse(readFileSync(out2, 'utf8'));
  assert.equal(s1.nights, 10);
  assert.equal(s1.crashes, 0);
  assert.equal(s1.results.length, 10);
  assert.deepEqual(s1.results, s2.results, 'soak phải tất định theo seed');
  assert.ok(s1.mem_start_mb > 0 && s1.mem_end_mb > 0);
  assert.ok(s1.mem_end_mb <= 1.2 * s1.mem_start_mb, `mem_end (${s1.mem_end_mb}) > 1.2 * mem_start (${s1.mem_start_mb})`);
  assert.ok(s1.duration_s >= 0);
});

test('bench-scene-sim: 200 Bóng Mực wander + 100 đom đóm + L1-L3 sáng fuel=100; tắt hao dầu, sát thương, nhặt, kết thúc Đêm', () => {
  const n1 = getNight(1);
  const rng = mulberry32(42);
  const litLanterns = n1.lanterns.slice(0, 3);
  const shades = [];
  for (let i = 0; i < 200; i++) {
    let x = 0, z = 0;
    for (let a = 0; a < 25; a++) {
      const r = Math.sqrt(rng()) * 37.5;
      const th = rng() * Math.PI * 2;
      x = Math.cos(th) * r; z = Math.sin(th) * r;
      if (litLanterns.every((L) => Math.hypot(x - L.pos[0], z - L.pos[2]) >= T.safe_radius + 0.6)) break;
    }
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' });
  }
  const motes = Array.from({ length: 100 }, () => {
    const r = Math.sqrt(rng()) * 36.5;
    const th = rng() * Math.PI * 2;
    return [Math.cos(th) * r, 0, Math.sin(th) * r];
  });

  const sim = new Sim({
    seed: 42,
    night: 1,
    benchMode: true,
    scenario: {
      random_motes: false, random_shades: false, random_drifters: false,
      player: { pos: [0, 0, 0] },
      lanterns: [{ id: 'L1', lit: true, fuel: 100 }, { id: 'L2', lit: true, fuel: 100 }, { id: 'L3', lit: true, fuel: 100 }],
      shades,
      motes,
    },
  });
  const startPos0 = sim.shades[0].pos.slice();
  for (let k = 0; k < 300; k++) { sim.step({}); sim.drainEvents(); }

  assert.equal(sim.state, 'playing');
  assert.equal(sim.shades.length, 200);
  assert.equal(sim.motes.length, 100);
  assert.equal(sim.player.flames, T.flames);
  assert.equal(sim.player.carried, 0);
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  for (const id of ['L1', 'L2', 'L3']) {
    const L = sim.lanterns.find((x) => x.id === id);
    assert.equal(L.lit, true);
    assert.equal(L.fuelU, 6000, 'không được hao dầu trong benchMode');
  }
  assert.ok(sim.shades.every((z) => z.state === 'wander'), 'mọi bóng trong bench phải giữ trạng thái wander');
  assert.ok(Math.hypot(sim.shades[0].pos[0] - startPos0[0], sim.shades[0].pos[2] - startPos0[2]) > 0.5, 'bóng trong bench phải di chuyển');
});

test('leaderboard-local-and-export: validate tên 3-12 (gồm tiếng Việt), top 10, hòa ai đạt trước đứng trên, --export-leaderboard', () => {
  assert.equal(validatePlayerName('Ab').ok, false);
  assert.equal(validatePlayerName('TooLongPlayerName1').ok, false);
  assert.equal(validatePlayerName('Bad Name!').ok, false);
  assert.equal(validatePlayerName('May_01').ok, true);
  assert.equal(validatePlayerName('Quyền_2026').ok, true);

  const lbFile = join(tmp, 'lb.json');
  // Thêm 12 mục gồm 2 mục bằng điểm 850 (đạt trước phải đứng trên)
  addLeaderboardEntry({ name: 'SecondTie', score: 850, nights_won: 2, seed: 2, achieved_at: '2026-11-20T10:05:00+07:00' }, lbFile);
  addLeaderboardEntry({ name: 'FirstTie', score: 850, nights_won: 2, seed: 1, achieved_at: '2026-11-20T10:00:00+07:00' }, lbFile);
  addLeaderboardEntry({ name: 'Mây_Đỉnh', score: 1500, nights_won: 3, seed: 9, achieved_at: '2026-11-20T11:00:00+07:00' }, lbFile);
  for (let i = 1; i <= 9; i++) {
    addLeaderboardEntry({ name: `Player_${i}`, score: 100 * i, nights_won: 1, seed: i, achieved_at: `2026-11-20T09:0${i}:00+07:00` }, lbFile);
  }

  const list = loadLeaderboard(lbFile);
  assert.equal(list.length, 10, 'chỉ giữ top 10');
  assert.equal(list[0].name, 'Mây_Đỉnh');
  assert.equal(list[0].score, 1500);
  assert.equal(list[1].name, 'Player_9');
  assert.equal(list[2].name, 'FirstTie', 'bằng điểm 850: ai đạt trước phải đứng trên');
  assert.equal(list[3].name, 'SecondTie');
  assert.ok(/(Z|[+-]\d{2}:\d{2})$/.test(list[0].achieved_at), 'achieved_at phải là ISO 8601 có múi giờ');

  // Kiểm tra CLI chuẩn: node server.js --export-leaderboard out.json
  const expOut = join(tmp, 'exported-lb.json');
  const r = spawnSync(process.execPath, [join(root, 'server.js'), '--export-leaderboard', expOut], {
    encoding: 'utf8',
    env: { ...process.env, DDL_LEADERBOARD_PATH: lbFile },
  });
  assert.equal(r.status, 0, r.stderr);
  const exp = JSON.parse(readFileSync(expOut, 'utf8'));
  assert.ok(Array.isArray(exp.entries) && exp.entries.length === 10);
  assert.equal(exp.entries[0].name, 'Mây_Đỉnh');
  assert.equal(exp.entries[2].name, 'FirstTie');
});

test('accessibility-ui-contract: đổi phím 9 hành động + báo trùng + khôi phục, phụ đề/mũi tên, giảm chuyển động, chữ >=18px & x1.25', () => {
  const html = readFileSync(join(root, 'public/index.html'), 'utf8');
  const mainJs = readFileSync(join(root, 'public/main.js'), 'utf8');

  // Đổi phím đầy đủ + phát hiện trùng + khôi phục mặc định
  for (const act of ['up:', 'down:', 'left:', 'right:', 'jump:', 'dash:', 'interact:', 'pulse:', 'pause:']) {
    assert.ok(mainJs.includes(act), `thiếu hành động đổi phím ${act}`);
  }
  assert.ok(mainJs.includes('Trùng phím'), 'thiếu cảnh báo trùng phím');
  assert.ok(html.includes('Khôi phục mặc định') && html.includes('id="btn-reset-keys"'), 'thiếu nút Khôi phục mặc định');

  // Phụ đề & mũi tên chỉ hướng Bóng Mực + gió + 10 s cuối + fuel < 30
  assert.ok(html.includes('id="caption-bar"') && html.includes('id="shade-arrows"'), 'thiếu thanh phụ đề và mũi tên Bóng Mực');
  assert.ok(mainJs.includes('Bóng Mực vừa xuất hiện') && mainJs.includes('Gió mạnh sắp thổi') && mainJs.includes('10 giây cuối') && mainJs.includes('sắp cạn dầu'), 'thiếu nội dung phụ đề');

  // Giảm chuyển động
  assert.ok(html.includes('Giảm chuyển động') && html.includes('body.reduce-motion'), 'thiếu cài đặt Giảm chuyển động');
  assert.ok(mainJs.includes('settings.reduceMotion'), 'main.js chưa áp dụng reduceMotion');

  // Cỡ chữ tối thiểu 18px ở 1280x720 + Chữ lớn x1.25
  assert.ok(html.includes('font-size: calc(18px * var(--ui-scale))'), 'thiếu gốc cỡ chữ 18px');
  assert.ok(html.includes('--ui-scale: 1.25') && html.includes('Chữ lớn (×1.25)'), 'thiếu tùy chọn Chữ lớn x1.25');
  const smallPx = [...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n < 18);
  assert.deepEqual(smallPx, [], `có font-size nhỏ hơn 18px: ${smallPx.join(', ')}`);

  // Bảng xếp hạng UI
  assert.ok(html.includes('id="ov-leaderboard"') && html.includes('id="lb-save-box"') && html.includes('id="btn-menu-leaderboard"'), 'thiếu màn hình hoặc form Bảng xếp hạng');
});

test('release-and-syntax: cú pháp bench.js, soak.js, lib/leaderboard.js, scripts/build-release.mjs & kiểm tra schema bench.json/soak.json', () => {
  for (const f of ['bench.js', 'soak.js', 'server.js', 'lib/leaderboard.js', 'scripts/build-release.mjs']) {
    const r = spawnSync(process.execPath, ['--check', join(root, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
  assert.ok(existsSync(join(root, 'Dockerfile')), 'thiếu Dockerfile');
  assert.ok(existsSync(join(root, 'LICENSE')), 'thiếu LICENSE');
  assert.ok(existsSync(join(root, 'CREDITS.md')), 'thiếu CREDITS.md');
  assert.ok(existsSync(join(root, 'CHANGELOG.md')), 'thiếu CHANGELOG.md');

  if (existsSync(join(root, 'bench.json'))) {
    const b = JSON.parse(readFileSync(join(root, 'bench.json'), 'utf8'));
    assert.equal(b.contract_version, '1.3');
    for (const k of ['avg_fps', 'p1_low_fps', 'frame_ms_p95', 'frames', 'load_ms']) {
      assert.equal(typeof b[k], 'number', `bench.json thiếu số ${k}`);
    }
    assert.ok('peak_mem_mb' in b && (b.peak_mem_mb === null || typeof b.peak_mem_mb === 'number'));
    assert.equal(typeof b.vsync_off, 'boolean');
    assert.equal(typeof b.renderer, 'string');
    assert.equal(typeof b.os, 'string');
  }
  if (existsSync(join(root, 'soak.json'))) {
    const s = JSON.parse(readFileSync(join(root, 'soak.json'), 'utf8'));
    assert.equal(s.nights, 10);
    assert.equal(s.crashes, 0);
    assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb);
  }
});

console.log(`\nPhase 4: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
