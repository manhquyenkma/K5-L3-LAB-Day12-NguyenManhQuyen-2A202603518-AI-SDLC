// Bộ test hồi quy Phase 1 với số liệu chuẩn v1.1 (TICKET-02, xem docs/ASSUMPTIONS.md).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { TUNING as T } from '../src/tuning.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-'));
let passed = 0, failed = 0;

function run(args) {
  return spawnSync(process.execPath, [join(root, 'headless.js'), ...args], { encoding: 'utf8' });
}
function sim({ scenario, frames, ticks, seed = 1, every = 10, name = 'x' }) {
  const out = join(tmp, name + '.jsonl');
  const args = ['--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) { const f = join(tmp, name + '.sc.json'); writeFileSync(f, JSON.stringify(scenario)); args.push('--scenario', f); }
  if (frames) { const f = join(tmp, name + '.in.json'); writeFileSync(f, JSON.stringify({ frames })); args.push('--inputs', f); }
  const r = run(args);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return {
    lines,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines[lines.length - 1],
    raw: readFileSync(out, 'utf8'),
  };
}
const NO_RANDOM = { random_motes: false, random_shades: false };
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Test Contract v1.1 — Hồi quy Phase 1 theo số chuẩn TICKET-02');

test('game.contract.json khớp tuning v1.1 trong mã', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.1'); // cập nhật từ 1.0 theo TICKET-02 Phần 4
  assert.deepEqual(c.tuning, T);
  assert.equal(c.tuning.lantern_count_night1, 5);
  for (const k of ['build_cmd', 'run_cmd', 'headless_cmd', 'team']) assert.equal(typeof c[k], 'string');
});

test('snapshot: bắt đầu tick 0, đúng nhịp, dòng cuối là end', () => {
  const r = sim({ scenario: NO_RANDOM, ticks: 100, every: 10 });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual(r.end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(r.snaps[0].sim_tick, 0);
  assert.equal(r.snaps[1].time_left_s, Math.round((300 - 10 / 60) * 1000) / 1000);
});

test('dựng scenario không phát sự kiện, không cộng điểm (đèn lit sẵn)', () => {
  const r = sim({ scenario: { ...NO_RANDOM, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, deposited: T.lantern_cost }], motes: [], shades: [] }, ticks: 30 });
  const gameplayEvents = r.events.filter((e) => e.name !== 'night_start');
  assert.equal(gameplayEvents.length, 0);
  assert.equal(r.snaps[0].score, 0);
  assert.equal(r.snaps[0].lanterns.find((l) => l.id === 'L1').lit, true);
});

test('di chuyển: đạt tốc độ = player_speed, chuẩn hóa vector chéo', () => {
  const r = sim({ scenario: NO_RANDOM, frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  // Cho phép biên gia tốc ≤ 0.1s (mất tối đa ~0.3m ở đầu đoạn chạy khi có tăng tốc ở M2)
  assert.ok(r.snaps.at(-1).player.pos[2] > T.player_speed - 0.5 && r.snaps.at(-1).player.pos[2] <= T.player_speed + 0.05);
  const d = sim({ scenario: NO_RANDOM, frames: [{ tick: 0, move: [1, 1] }], ticks: 60, name: 'diag' });
  const [x, , z] = d.snaps.at(-1).player.pos;
  assert.ok(Math.hypot(x, z) > T.player_speed - 0.5 && Math.hypot(x, z) <= T.player_speed + 0.05);
});

test('cam_yaw_deg=90 xoay hướng di chuyển (tiến -> +X)', () => {
  const r = sim({ scenario: NO_RANDOM, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 });
  const [x, , z] = r.snaps.at(-1).player.pos;
  assert.ok(x > T.player_speed - 0.5 && Math.abs(z) < 0.05, `pos=${x},${z}`);
});

test('nhặt đom đóm: sự kiện mote_picked (TICKET-02: điểm tính lúc nạp, không cộng lúc nhặt)', () => {
  const r = sim({ scenario: { ...NO_RANDOM, motes: [[0, 0, 5]] }, frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  const e = r.events.filter((x) => x.name === 'mote_picked');
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].data, { carried: 1 });
  assert.equal(r.snaps.at(-1).score, 0); // TICKET-02 đổi +per_mote sang lúc nạp
  assert.equal(r.snaps.at(-1).motes_active, 0);
});

test('sức chứa: không nhặt quá carry_capacity (10)', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }, ticks: 30 });
  assert.equal(r.events.filter((e) => e.name === 'mote_picked').length, 0);
  assert.equal(r.snaps.at(-1).motes_active, 1);
});

test('nạp đèn: deposit + lantern_lit + điểm (+10/đom đóm nạp + 100 thắp); interact chỉ ăn khi false→true', () => {
  const r = sim({
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 24], carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }] },
    frames: [{ tick: 0, interact: true }], ticks: 30,
  });
  const names = r.events.filter((e) => e.name !== 'night_start').map((e) => e.name);
  assert.deepEqual(names, ['deposit', 'lantern_lit']);
  assert.deepEqual(r.events.find((e) => e.name === 'deposit').data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.equal(r.snaps.at(-1).score, T.lantern_cost * T.score.per_mote + T.score.per_lantern);
  assert.equal(r.snaps.at(-1).player.carried, 0);
});

test('nạp đèn: ngoài interact_radius (2 m) thì không nạp; nạp từng phần', () => {
  const far = sim({ scenario: { ...NO_RANDOM, player: { pos: [0, 0, 22], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }] }, frames: [{ tick: 0, interact: true }], ticks: 5 });
  assert.equal(far.events.filter((e) => e.name === 'deposit').length, 0);
  const part = sim({ scenario: { ...NO_RANDOM, player: { pos: [0, 0, 24], carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 1 }] }, frames: [{ tick: 0, interact: true }], ticks: 5, name: 'part' });
  assert.deepEqual(part.events.filter((e) => e.name === 'deposit').map((e) => e.data), [{ lantern_id: 'L1', amount: 2, deposited: 3 }]);
  assert.equal(part.end.score, 2 * T.score.per_mote);
});

test('thắng: thắp hết đèn -> game_over won/all_lit, điểm thưởng, dừng sớm', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = sim({
    scenario: { ...NO_RANDOM, time_left_s: 100, player: { pos: [0, 0, 24], carried: T.lantern_cost, flames: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }, ...lit] },
    frames: [{ tick: 0, interact: true }], ticks: 600,
  });
  const go = r.events.find((e) => e.name === 'game_over');
  assert.deepEqual(go.data, { result: 'won', reason: 'all_lit' });
  assert.equal(r.end.state, 'won');
  assert.equal(r.end.ticks, 1);
  const secs = Math.floor(100 - 1 / 60);
  assert.equal(r.end.score, T.lantern_cost * T.score.per_mote + T.score.per_lantern + secs * T.score.per_second_left + 3 * T.score.per_flame_left);
});

test('tỏa sáng: choáng, đẩy lùi, trừ pulse_cost (3), +per_stun (5), cooldown', () => {
  const r = sim({
    scenario: { ...NO_RANDOM, player: { carried: 6 }, shades: [{ id: 'S1', pos: [4, 1, 0] }, { id: 'S9', pos: [20, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }], ticks: 20, every: 1,
  });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 1, 'lần 2 bị cooldown');
  assert.deepEqual(pulses[0].data, { stunned_ids: ['S1'] });
  const s1 = r.snaps[1].shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  // Sau 15 tick đẩy lùi tổng pulse_push_m = 4 m
  const s1End = r.snaps[16].shades.find((s) => s.id === 'S1');
  assert.ok(s1End.pos[0] >= 4 + T.pulse_push_m - 0.15, `s1End.x=${s1End.pos[0]}`);
  assert.equal(r.snaps[1].player.carried, 6 - T.pulse_cost);
  assert.equal(r.snaps[1].score, T.score.per_stun);
});

test('tỏa sáng cần đủ pulse_cost (3): không đủ đom đóm thì không tỏa', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [3, 1, 0] }] }, frames: [{ tick: 0, pulse: true }], ticks: 5 });
  assert.equal(r.events.filter((e) => e.name === 'pulse').length, 0);
});

test('choáng kéo dài đúng pulse_stun_s (2 s = 120 tick) rồi hết choáng', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { carried: T.pulse_cost, pos: [0, 0, -25] }, shades: [{ id: 'S1', pos: [0, 1, -22] }] }, frames: [{ tick: 0, pulse: true }], ticks: 150, every: 1 });
  const firstNotStunned = r.snaps.find((s) => s.shades[0].state !== 'stunned' && s.tick > 1);
  assert.equal(firstNotStunned.tick, 1 + T.pulse_stun_s * 60);
});

test('bị chạm: mất 1 lửa, rơi floor(carried*ratio), bất tử invuln_s (1.5 s)', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 60 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: Math.floor(5 * T.hit_drop_ratio) });
  assert.equal(r.snaps.at(-1).player.carried, 5 - 2);
  assert.equal(r.snaps.at(-1).motes_active, 2);
});

test('hết lửa -> thua no_flames', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 100 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('hết đêm -> thua dawn đúng tick 60', () => {
  const r = sim({ scenario: { ...NO_RANDOM, time_left_s: 1 }, ticks: 1000 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(r.end.ticks, 60);
  assert.equal(r.end.state, 'lost');
});

test('safe_radius (6 m, đèn đã sáng): Bóng Mực không vào vùng quanh đèn, người đứng sát đèn không bị chạm', () => {
  // TICKET-02 đổi safe_radius chỉ áp dụng cho đèn đã sáng (L1 lit: true)
  const r = sim({ scenario: { ...NO_RANDOM, player: { pos: [0, 0, 26] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], shades: [{ pos: [0, 1, 16] }, { pos: [10, 1, 25] }] }, ticks: 300, every: 5 });
  for (const s of r.snaps) for (const z of s.shades) assert.ok(Math.hypot(z.pos[0], z.pos[2] - 25) >= T.safe_radius - 0.01, `tick ${s.tick}`);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('Bóng Mực chậm hơn người chơi và đuổi theo khi trong tầm phát hiện', () => {
  const r = sim({ scenario: { ...NO_RANDOM, player: { pos: [0, 0, 0] }, shades: [{ pos: [10, 1, 0] }] }, ticks: 60, every: 60 });
  const z = r.snaps.at(-1).shades[0];
  assert.ok(Math.abs(z.pos[0] - (10 - T.shade_speed)) < 0.05, `z.x=${z.pos[0]}`);
});

test('sinh ngẫu nhiên: shade_spawned khi random_shades mặc định', () => {
  const r = sim({ ticks: 1200 });
  const sp = r.events.filter((e) => e.name === 'shade_spawned');
  assert.ok(sp.length >= 1 && /^S\d+$/.test(sp[0].data.id));
  assert.ok(r.snaps[0].motes_active >= 20);
});

test('tất định: cùng seed/scenario/inputs -> output giống hệt từng byte', () => {
  const frames = [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0.2], cam_yaw_deg: 30 }];
  const a = sim({ frames, ticks: 2000, seed: 42, name: 'a' });
  const b = sim({ frames, ticks: 2000, seed: 42, name: 'b' });
  const c = sim({ frames, ticks: 2000, seed: 43, name: 'c' });
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
});

test('tọa độ làm tròn tối đa 3 chữ số thập phân', () => {
  const r = sim({ frames: [{ tick: 0, move: [0.37, 0.91], cam_yaw_deg: 17 }], ticks: 300 });
  const dec = (v) => (String(v).split('.')[1] || '').length;
  for (const s of r.snaps) for (const v of [...s.player.pos, ...s.shades.flatMap((z) => z.pos), ...s.motes.flatMap((m) => m.pos)]) assert.ok(dec(v) <= 3, String(v));
});

test('lỗi: inputs sai định dạng -> mã 2, thông báo ở stderr', () => {
  const f = join(tmp, 'bad.json');
  writeFileSync(f, JSON.stringify({ frames: [{ tick: 5, move: [0, 1] }, { tick: 5, move: [0, 0] }] }));
  const r = run(['--seed', '1', '--night', '1', '--ticks', '10', '--out', join(tmp, 'o.jsonl'), '--inputs', f]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.length > 0);
  writeFileSync(f, '{not json');
  assert.equal(run(['--seed', '1', '--night', '1', '--ticks', '10', '--out', join(tmp, 'o.jsonl'), '--scenario', f]).status, 2);
  writeFileSync(f, JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }));
  assert.equal(run(['--seed', '1', '--night', '1', '--ticks', '10', '--out', join(tmp, 'o.jsonl'), '--inputs', f]).status, 2);
});

test('lỗi: thiếu tham số -> mã khác 0 (1)', () => {
  const r = run(['--seed', '1', '--night', '1']);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.length > 0);
});

test('hiệu năng: 18000 tick (5 phút) < 2 giây', () => {
  const t0 = Date.now();
  sim({ ticks: 18000, name: 'perf' });
  assert.ok(Date.now() - t0 < 2000, `mất ${Date.now() - t0} ms`);
});

console.log(`\nHồi quy Phase 1: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
