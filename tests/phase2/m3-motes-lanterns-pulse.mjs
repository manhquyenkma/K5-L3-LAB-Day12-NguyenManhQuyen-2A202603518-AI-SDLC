// Test M3: Đom đóm (lịch sinh, TTL, vành rơi), Đèn (nạp nhiều lần, hòa id), Vùng an toàn (đẩy <=30 tick), Tỏa Sáng (3D, 15 tick đẩy, làm mới).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m3-'));
let passed = 0, failed = 0;

function sim({ night = 1, scenario, frames, ticks, seed = 1, every = 1, name = 'x' }) {
  const out = join(tmp, name + '.jsonl');
  const args = ['--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) { const f = join(tmp, name + '.sc.json'); writeFileSync(f, JSON.stringify(scenario)); args.push('--scenario', f); }
  if (frames) { const f = join(tmp, name + '.in.json'); writeFileSync(f, JSON.stringify({ frames })); args.push('--inputs', f); }
  const r = spawnSync(process.execPath, [join(root, 'headless.js'), ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return {
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines[lines.length - 1],
  };
}
const NO_RANDOM = { random_motes: false, random_shades: false, random_drifters: false };
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 2 M3 — Motes, Lanterns, Safe Zone & Pulse');

test('mote-schedule: 20 điểm khác nhau lúc đầu, sinh ở tick 240/480, dừng khi hết điểm trống (24 ở Đêm 1, 30 ở Đêm 3)', () => {
  const r = sim({ night: 1, scenario: { random_motes: true, random_shades: false }, ticks: 1500, every: 240, name: 'mote-n1' });
  assert.equal(r.snaps[0].motes_active, 20);
  const keys = new Set(r.snaps[0].motes.map((m) => m.pos.join(',')));
  assert.equal(keys.size, 20, '20 đom đóm đầu phải ở 20 điểm khác nhau');
  assert.equal(r.snaps[1].motes_active, 21, 'tick 240 sinh thêm 1');
  assert.equal(r.snaps[2].motes_active, 22, 'tick 480 sinh thêm 1');
  // Đêm 1 có 24 điểm sinh -> tối đa 24 khi không nhặt (hết điểm trống thì bỏ lượt)
  assert.equal(r.snaps.at(-1).motes_active, 24);

  // Đêm 3 có 30 điểm sinh -> lên đúng trần 30
  const r3 = sim({ night: 3, scenario: { random_motes: true, random_shades: false, random_drifters: false, wind_enabled: false }, ticks: 3000, every: 600, name: 'mote-n3' });
  assert.equal(r3.snaps[0].motes_active, 20);
  assert.equal(r3.snaps.at(-1).motes_active, 30);
});

test('deposit-multi: nạp nhiều lần nhớ tiến độ, hòa khoảng cách chọn id nhỏ hơn, +10/đom đóm nạp + 100 thắp', () => {
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 4 },
      lanterns: [
        { id: 'L2', pos: [1.5, 0, 0], deposited: 0 },
        { id: 'L1', pos: [-1.5, 0, 0], deposited: 0 },
      ],
      // Đặt 6 đom đóm ở z=2.2 (ngoài pickup_radius=1 lúc tick 0) để tách 2 lần nạp
      motes: [[0, 0, 2.2], [0, 0, 2.2], [0, 0, 2.2], [0, 0, 2.2], [0, 0, 2.2], [0, 0, 2.2]],
    },
    frames: [
      { tick: 0, interact: true }, // nạp 4 vào L1 (cùng 1.5 m, L1 < L2)
      { tick: 1, interact: false, move: [0, 1] }, // chạy lên z=2.2 nhặt 6 đom đóm
      { tick: 25, move: [0, -1] }, // quay lại (0,0,0)
      { tick: 50, move: [0, 0], interact: true }, // nạp tiếp 6 vào L1 -> đủ 10 thắp L1
    ],
    ticks: 60, every: 1, name: 'dep-multi',
  });
  const deps = r.events.filter((e) => e.name === 'deposit');
  assert.equal(deps.length, 2);
  assert.deepEqual(deps[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.deepEqual(deps[1].data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  const lit = r.events.filter((e) => e.name === 'lantern_lit');
  assert.equal(lit.length, 1);
  assert.deepEqual(lit[0].data, { lantern_id: 'L1', relight: false }); // [TICKET-03] thêm relight
  assert.equal(r.end.score, 10 * 5 + 100); // [TICKET-03] điểm nạp đổi +10 -> +5 mỗi đom đóm
});

test('safe-zone-block: đèn chưa sáng KHÔNG chặn Bóng Mực; đèn đã sáng chặn ở mép 6 m', () => {
  const unlit = sim({
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: false }], shades: [{ id: 'S1', pos: [0, 1, 22] }] },
    ticks: 60, every: 5, name: 'safe-unlit',
  });
  assert.ok(unlit.events.some((e) => e.name === 'player_hit'), 'đèn chưa sáng không có vùng an toàn');

  const lit = sim({
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], shades: [{ id: 'S1', pos: [0, 1, 16] }] },
    ticks: 180, every: 5, name: 'safe-lit',
  });
  assert.equal(lit.events.filter((e) => e.name === 'player_hit').length, 0);
  for (const s of lit.snaps) {
    const z = s.shades[0];
    assert.ok(Math.hypot(z.pos[0], z.pos[2] - 25) >= 6 - 0.01, `tick ${s.tick}: d=${Math.hypot(z.pos[0], z.pos[2] - 25)}`);
  }
});

test('lantern-lit-expel: Bóng Mực đang trong vùng 6 m khi đèn vừa thắp bị đẩy ra mép trong <=30 tick và không gây sát thương', () => {
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 10 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 }],
      shades: [{ id: 'S1', pos: [0, 1, 24.5] }], // sát Mây & nằm trong bán kính 6 m của L1
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 40, every: 1, name: 'expel',
  });
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0, 'không được gây sát thương khi đang bị đẩy ra');
  const s30 = r.snaps[31].shades[0];
  const dist30 = Math.hypot(s30.pos[0], s30.pos[2] - 25);
  assert.ok(dist30 >= 6 - 0.01, `sau 30 tick phải ra mép 6 m: dist=${dist30}`);
});

test('pulse: tâm 3D (y+0.8 <= 5 m), đẩy tổng 4 m trong 15 tick, trùng XZ đẩy +X, làm mới khi pulse lại (+5), dừng gặp tháp', () => {
  // 1. Đẩy 4 m trải đều trong 15 tick, trùng XZ đẩy +X, ngoài 3D 5 m không trúng
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 6 },
      shades: [
        { id: 'S1', pos: [0, 1, 0] }, // trùng XZ, 3D dist = 0.2 <= 5 -> đẩy +X
        { id: 'S2', pos: [3, 1, 0] }, // 3D dist ~ 3.007 <= 5 -> đẩy +X
        { id: 'S3', pos: [0, 6.2, 0] }, // 3D dist = 5.4 > 5 -> không trúng
      ],
    },
    frames: [{ tick: 0, pulse: true }],
    ticks: 20, every: 1, name: 'pulse-15t',
  });
  const pe = r.events.find((e) => e.name === 'pulse');
  assert.deepEqual(pe.data, { stunned_ids: ['S1', 'S2'] });
  assert.equal(r.snaps[1].score, 10); // 2 * 5
  // Sau tick 1 chưa đẩy hết 4 m (chỉ ~1/15), sau tick 15 đủ 4 m
  assert.ok(r.snaps[1].shades[0].pos[0] > 0.1 && r.snaps[1].shades[0].pos[0] < 1.0, `tick1 x=${r.snaps[1].shades[0].pos[0]}`);
  assert.ok(Math.abs(r.snaps[15].shades[0].pos[0] - 4) < 0.05, `tick15 S1.x=${r.snaps[15].shades[0].pos[0]}`);
  assert.ok(Math.abs(r.snaps[15].shades[1].pos[0] - 7) < 0.05, `tick15 S2.x=${r.snaps[15].shades[1].pos[0]}`);

  // 2. Pulse lại khi đang choáng (dùng pulse_cd_ticks = 0 qua kịch bản hoặc chờ 180t, test cộng điểm khi đang choáng)
  const re = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 6 },
      shades: [{ id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 50 }],
    },
    frames: [{ tick: 0, pulse: true }],
    ticks: 130, every: 1, name: 'pulse-refresh',
  });
  assert.equal(re.snaps[1].score, 5, 'vẫn +5 khi trúng con đang choáng');
  assert.equal(re.snaps[100].shades[0].state, 'stunned', 'choáng được làm mới đủ 120 tick');

  // 3. Đẩy gặp vật cản (tháp chuông tầng 2 Đêm 3 r=2) thì dừng
  const obs = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 6, 5], carried: 3 }, shades: [{ id: 'S1', pos: [0, 7, 3] }] },
    frames: [{ tick: 0, pulse: true }],
    ticks: 20, every: 1, name: 'pulse-tower',
  });
  assert.ok(obs.snaps[16].shades[0].pos[2] >= 1.99, `xuyên tháp khi bị đẩy: z=${obs.snaps[16].shades[0].pos[2]}`);
});

test('hit-drop: rơi floor(mang/2) vào vành 1.5-2.5 m, kind=dropped, TTL 480 tick, không nhặt ngay tick rơi, bất tử 90 tick', () => {
  // Đèn L1 lit tại (0,0,25) để sau khi bị đánh, Mây chạy vào vùng an toàn chờ kiểm tra TTL 480 tick
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 17], carried: 7, flames: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }],
      shades: [{ id: 'S1', pos: [0.5, 1, 17] }],
    },
    frames: [
      { tick: 1, move: [0, 1] }, // chạy vào vùng an toàn quanh L1 (0,0,25)
      { tick: 90, move: [0, 0] },
    ],
    ticks: 495, every: 1, name: 'hit-drop',
  });
  const hit = r.events.find((e) => e.name === 'player_hit');
  assert.deepEqual(hit.data, { by: 'shade', flames: 2, dropped: 3 });
  const sHit = r.snaps[hit.tick];
  assert.equal(sHit.motes.length, 3);
  for (const m of sHit.motes) {
    assert.equal(m.kind, 'dropped');
    const dist = Math.hypot(m.pos[0], m.pos[2] - 17);
    assert.ok(dist >= 1.49 && dist <= 2.51, `dist=${dist}`);
  }
  // Bất tử kéo dài 90 tick: tick hit+89 vẫn invuln, tick hit+90 hết invuln
  assert.equal(r.snaps[hit.tick + 89].player.invuln, true);
  assert.equal(r.snaps[hit.tick + 90].player.invuln, false);
  // Sau 480 tick -> mọi đom đóm rơi chưa nhặt đều hết TTL biến mất
  assert.equal(r.snaps[hit.tick + 480].motes.length, 0);
});

console.log(`\nM3: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
