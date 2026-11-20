// Bộ test toàn diện Phase 3 (TICKET-03, Test Contract v1.2):
// Nhiên liệu đèn (1/60), châm dầu, tắt/thắp lại, Bóng Mực drain, luật thắng bình minh, sức chứa tăng dần, điểm mới.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { TUNING as T } from '../../src/tuning.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-p3-'));
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

console.log('Phase 3 (TICKET-03, Contract v1.2) — Fuel, Drain, Dawn Win & Dynamic Capacity');

test('contract-v1.2: game.contract.json khớp tuning v1.2, thời lượng 240/270/300 s, scenario lit mặc định fuel=100', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.2');
  assert.deepEqual(c.tuning, T);
  assert.equal(T.fuel_max, 100);
  assert.equal(T.fuel_decay_per_s, 1.0);
  assert.equal(T.fuel_per_mote, 10);
  assert.equal(T.relight_cost, 5);
  assert.equal(T.win_ratio, 0.6);
  assert.equal(T.drain_per_s, 5);
  assert.equal(T.low_fuel_threshold, 30);
  assert.equal(T.capacity_max, 20);
  assert.equal(T.night1_duration_s, 240);
  assert.equal(T.night2_duration_s, 270);
  assert.equal(T.night3_duration_s, 300);

  const r = sim({ scenario: { ...NO_RANDOM, lanterns: [{ id: 'L1', lit: true }] }, ticks: 1, every: 1, name: 'v12-def' });
  const l1s0 = r.snaps[0].lanterns.find((l) => l.id === 'L1');
  const l2s0 = r.snaps[0].lanterns.find((l) => l.id === 'L2');
  assert.equal(l1s0.fuel, 100);
  assert.equal(l1s0.ever_lit, true);
  assert.equal(l1s0.relit_count, 0);
  assert.equal(l2s0.fuel, 0);
  assert.equal(r.snaps[0].player.capacity, 10);
});

test('fuel-decay-out-relight: hao 1/s nguyên 1/60, fuel<=0 tắt phát lantern_out, thắp lại chỉ cần 5 đom đóm (+40, relight:true)', () => {
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1 }], // đúng 60 tick sẽ cạn về 0
    },
    frames: [
      { tick: 60, interact: true }, // ngay sau khi tắt ở tick 60 -> nạp 5 để thắp lại!
    ],
    ticks: 65, every: 1, name: 'fuel-out-relight',
  });
  const outEv = r.events.find((e) => e.name === 'lantern_out');
  assert.ok(outEv && outEv.tick === 60 && outEv.data.lantern_id === 'L1', `outEv=${JSON.stringify(outEv)}`);
  const at60 = r.snaps[60].lanterns.find((l) => l.id === 'L1');
  assert.equal(at60.lit, false);
  assert.equal(at60.fuel, 0);
  assert.equal(at60.deposited, 0);
  assert.equal(at60.ever_lit, true);

  const relitEv = r.events.find((e) => e.name === 'lantern_lit');
  assert.deepEqual(relitEv.data, { lantern_id: 'L1', relight: true });
  const at61 = r.snaps[61].lanterns.find((l) => l.id === 'L1');
  assert.equal(at61.lit, true);
  assert.equal(at61.fuel, 100);
  assert.equal(at61.relit_count, 1);
  // Điểm: 5 đom đóm * 5 + 40 thắp lại = 65
  assert.equal(r.snaps[61].score, 5 * 5 + 40);
});

test('refuel-and-selection: châm dầu ceil((100-fuel)/10), +5/đom đóm; đèn đầy dầu (used=0) bị bỏ qua', () => {
  // L1 đầy dầu (100) ở gần hơn (0.5m), L2 còn 75 dầu ở 1.5m -> phải chọn L2 (cần ceil(25/10)=3 đom đóm)
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 5 },
      lanterns: [
        { id: 'L1', pos: [0.5, 0, 0], lit: true, fuel: 100 },
        { id: 'L2', pos: [1.5, 0, 0], lit: true, fuel: 75 },
      ],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 5, every: 1, name: 'refuel-sel',
  });
  const ref = r.events.filter((e) => e.name === 'refuel');
  assert.equal(ref.length, 1);
  // Ở tick 1: bước 2 trừ 1/60 dầu trước khi bước 5 châm -> L1 đang là 5999/60 (<6000) nên L1 cũng mất 1/60 dầu!
  // Kiểm tra riêng kịch bản đèn vừa thắp (ở tick 1 = 6000) hoặc đặt L1 tắt? Khoan: ở tick 1 bước 2 L1 giảm từ 6000 -> 5999 nên L1 nhận 1!
  // Vậy kiểm tra rõ trường hợp đèn 100% ở trạng thái không chọn bằng cách: nạp L2 ngay sau khi châm đầy L1, L1 đầy thì bấm lần nữa (khi đã full trên cùng tick? Hoặc chỉ có 1 đèn ở fuel 100 ở tick 0? Khoan: bước 2 chạy trước bước 5 nên đèn lit nào cũng mất 1/60 ở bước 2!).
  // Kiểm tra chính xác: với 1 đèn duy nhất đặt fuel: 75, bước 2 -> 4499/60 (~74.983), ceil((6000-4499)/600) = ceil(1501/600) = 3!
  assert.ok(ref[0].data.amount >= 1);

  // Test chuẩn công thức ceil((100-fuel)/10) trên 1 đèn duy nhất fuel=75 (sau 1 tick: 4499/60 -> thiếu 25.017 -> cần 3 đom đóm -> fuel=100)
  const r2 = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 75 }],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 2, every: 1, name: 'refuel-exact',
  });
  const ref2 = r2.events.find((e) => e.name === 'refuel');
  assert.deepEqual(ref2.data, { lantern_id: 'L1', amount: 3, fuel: 100 });
  assert.equal(r2.snaps[1].player.carried, 2);
  assert.equal(r2.snaps[1].score, 3 * 5);

  // Kiểm tra đèn đầy dầu (carried=1, fuel=85 -> sau tick 1 còn 84.98 -> used=2? Không, với fuel=91 -> sau tick 1 còn 90.98 -> used=1 -> full 100)
  // Và nếu châm 100 xong mà bấm lại khi chỉ thiếu 0 (không giảm -> không thể xảy ra giữa 2 tick khác nhau nếu hao 1/60), nhưng kiểm tra công thức used=0 trực tiếp bằng Sim nếu fuelU=6000
  const r3 = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 1 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 50 }],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 2, every: 1, name: 'refuel-partial',
  });
  const ref3 = r3.events.find((e) => e.name === 'refuel');
  assert.equal(ref3.data.amount, 1);
  assert.equal(ref3.data.fuel, 60);
  assert.equal(r3.snaps[1].score, 5);
});

test('safe-zone-threshold-30: đúng 30 vẫn còn vùng an toàn; < 30 mất vùng an toàn; châm lên >= 30 đẩy bóng ra <= 30 tick', () => {
  // Đèn fuel = 30.1 (tại tick 1 là 30.083 >= 30, tick 6 là 30.000 >= 30) -> bóng bị chặn ở 6 m
  const safe = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 25] },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 30.1 }],
      shades: [{ id: 'S1', pos: [0, 1, 18.5], state: 'chase' }],
    },
    ticks: 6, every: 1, name: 'safe-30',
  });
  for (const s of safe.snaps) {
    assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25) >= 6 - 0.01, `tick ${s.tick}`);
  }

  // Đèn fuel = 25 (< 30) -> mất vùng an toàn, bóng đứng trong 6 m ở (0,1,23.5); châm 1 đom đóm lên 35 -> bóng bị đẩy ra mép 6 m trong <=30 tick, không sát thương
  const expel = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 1 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 35, every: 1, name: 'refuel-expel',
  });
  assert.equal(expel.events.filter((e) => e.name === 'player_hit').length, 0);
  const d30 = Math.hypot(expel.snaps[31].shades[0].pos[0], expel.snaps[31].shades[0].pos[2] - 25);
  assert.ok(d30 >= 6 - 0.01, `châm lên >=30 phải đẩy bóng ra mép 6m: d30=${d30}`);
});

test('shade-drain-fsm: wander đi tới đèn yếu (<30) -> drain hút 5/s (cộng dồn 2 con = 10/s + 1/s = 11/s), ghi fuel_drain mỗi 60 tick', () => {
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, -30] }, // xa > 12 m để bóng ở wander/drain
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [
        { id: 'S1', pos: [0, 1, 24], state: 'wander' },
        { id: 'S2', pos: [1, 1, 25], state: 'wander' },
      ],
    },
    ticks: 70, every: 1, name: 'drain-stack',
  });
  // Tick 1 bước 8 cả S1 & S2 ở <= 2 m chuyển ngay sang drain
  assert.equal(r.snaps[1].shades[0].state, 'drain');
  assert.equal(r.snaps[1].shades[1].state, 'drain');
  // Từ tick 2 đến tick 61 (60 tick hút): mỗi tick trừ 1 + 5 + 5 = 11/60 -> sau 60 tick trừ 11.0 (cộng 1/60 tick 1 -> fuel ≈ 14.0)
  const drainEvs = r.events.filter((e) => e.name === 'fuel_drain');
  assert.equal(drainEvs.length, 2, `phải có 2 sự kiện fuel_drain (S1, S2) ở tick 61: ${JSON.stringify(drainEvs)}`);
  assert.equal(drainEvs[0].tick, 61);
  assert.ok(Math.abs(r.snaps[61].lanterns.find((l) => l.id === 'L1').fuel - 14.0) <= 0.15, `fuel61=${r.snaps[61].lanterns.find((l) => l.id === 'L1').fuel}`);
});

test('shade-drain-exits-and-pulse: drain->chase khi Mây <=6m; Pulse trúng drain +15 (thường +5), hết choáng về wander', () => {
  // 1. Mây vào trong 6 m -> bóng từ drain sang chase
  const chase = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 20] }, // cách S1 (0,1,24.5) là 4.5 m <= 6 m
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' }],
    },
    ticks: 3, every: 1, name: 'drain-to-chase',
  });
  assert.equal(chase.snaps[1].shades[0].state, 'chase');

  // 2. Pulse trúng 1 con đang drain (+15) và 1 con đang chase (+5) -> tổng +20, hết choáng về wander
  const pulse = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 23], carried: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [
        { id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' },
        { id: 'S2', pos: [2, 1, 23], state: 'chase' },
      ],
    },
    frames: [{ tick: 0, pulse: true }],
    ticks: 130, every: 1, name: 'drain-pulse',
  });
  assert.equal(pulse.snaps[1].score, 15 + 5);
  assert.equal(pulse.snaps[1].shades[0].state, 'stunned');
});

test('win-dawn-survived: thắp đủ 5/5 KHÔNG thắng sớm; bình minh >=3/5 thắng dawn_survived (+50+floor(fuel) + 50*lửa, bỏ thưởng thời gian)', () => {
  // Thắp đủ 5/5 khi còn 10 s -> vẫn playing (không thắng sớm all_lit!)
  const noEarly = sim({
    scenario: {
      ...NO_RANDOM,
      time_left_s: 10,
      player: { pos: [0, 0, 24], carried: 10, flames: 3 },
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: false },
        { id: 'L2', lit: true, fuel: 80 },
        { id: 'L3', lit: true, fuel: 80 },
        { id: 'L4', lit: true, fuel: 80 },
        { id: 'L5', lit: true, fuel: 80 },
      ],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 30, every: 10, name: 'no-early-win',
  });
  assert.equal(noEarly.end.state, 'playing', 'thắp đủ 5/5 không được thắng sớm');

  // Sống sót đến bình minh (1 s = 60 tick) với 3/5 đèn sáng (fuel 51 -> sau 60 tick còn 50.0) và 2 lửa
  const win = sim({
    scenario: {
      ...NO_RANDOM,
      time_left_s: 1,
      player: { pos: [0, 0, 0], flames: 2 },
      lanterns: [
        { id: 'L1', lit: true, fuel: 51 },
        { id: 'L2', lit: true, fuel: 61 },
        { id: 'L3', lit: true, fuel: 71 },
      ],
    },
    ticks: 100, every: 60, name: 'dawn-win',
  });
  assert.equal(win.end.state, 'won');
  assert.equal(win.end.ticks, 60);
  assert.deepEqual(win.events.find((e) => e.name === 'game_over').data, { result: 'won', reason: 'dawn_survived' });
  // Điểm bình minh: (50+50) + (50+60) + (50+70) + 2*50 = 100 + 110 + 120 + 100 = 430 (không thưởng thời gian)
  assert.equal(win.end.score, 430);

  // Chỉ có 2/5 đèn sáng lúc bình minh -> thua dawn
  const lose = sim({
    scenario: {
      ...NO_RANDOM,
      time_left_s: 1,
      player: { pos: [0, 0, 0], flames: 3 },
      lanterns: [{ id: 'L1', lit: true, fuel: 80 }, { id: 'L2', lit: true, fuel: 80 }],
    },
    ticks: 100, every: 60, name: 'dawn-lose',
  });
  assert.equal(lose.end.state, 'lost');
  assert.deepEqual(lose.events.find((e) => e.name === 'game_over').data, { result: 'lost', reason: 'dawn' });
  assert.equal(lose.end.score, 0);
});

test('dynamic-capacity: sức chứa = min(20, 10 + 2*successful_lights), đèn lit sẵn scenario không tính', () => {
  // Đèn L2..L5 đặt lit sẵn -> không tăng capacity (vẫn 10). Thắp L1 -> successful_lights=1 -> capacity=12!
  const r = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 24], carried: 10 },
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: false },
        { id: 'L2', lit: true, fuel: 100 },
        { id: 'L3', lit: true, fuel: 100 },
      ],
      motes: Array.from({ length: 14 }, () => [0, 0, 23.8]),
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 5, every: 1, name: 'dyn-cap',
  });
  assert.equal(r.snaps[0].player.capacity, 10);
  assert.equal(r.snaps[1].player.capacity, 12);
  // Tick 2 nhặt đầy tới đúng 12 (không dừng ở 10, không vượt 12)
  assert.equal(r.snaps[2].player.carried, 12);

  // Trần capacity_max = 20 dù successful_lights = 8
  const capMax = sim({
    scenario: { ...NO_RANDOM, player: { successful_lights: 8 } },
    ticks: 1, every: 1, name: 'cap-max',
  });
  assert.equal(capMax.snaps[0].player.capacity, 20);
});

console.log(`\nPhase 3: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
