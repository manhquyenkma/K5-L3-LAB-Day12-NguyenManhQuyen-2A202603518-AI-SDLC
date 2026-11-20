// Test M5: Gió Lạc (drifter-steal, drifter-pulse-chase, drifter-pulse-flee-drop) và Bùa Gió (charm).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m5-'));
let passed = 0, failed = 0;

function sim({ night = 2, scenario, frames, ticks, seed = 1, every = 1, name = 'x' }) {
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

console.log('Phase 2 M5 — Drifters (Gió Lạc) & Wind Charms (Bùa Gió)');

test('drifter-steal: idle->chase (mang>=5 & <=15m), cướp min(3,mang) bất chấp bất tử & vùng an toàn, không mất lửa, flee 240t -> removed', () => {
  // Mây đứng trong vùng an toàn đèn L1 (lit) và đang bất tử, mang 6 đom đóm -> vẫn bị cướp 3, không mất lửa
  const r = sim({
    night: 2,
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 20], carried: 6, flames: 3, invuln_ticks: 90 },
      lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }],
      drifters: [{ id: 'D1', pos: [3, 1, 20] }],
    },
    ticks: 300, every: 1, name: 'drifter-steal',
  });
  const steals = r.events.filter((e) => e.name === 'drifter_steal');
  assert.equal(steals.length, 1, 'mỗi con chỉ cướp đúng 1 lần');
  assert.deepEqual(steals[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0, 'không mất Ngọn Lửa');
  const tSteal = steals[0].tick;
  assert.equal(r.snaps[tSteal].drifters[0].state, 'flee');
  assert.equal(r.snaps[tSteal].drifters[0].stolen, 3);
  // Sau đúng 240 tick flee -> removed
  assert.equal(r.snaps[tSteal + 240].drifters[0].state, 'removed');

  // Kiểm tra lịch sinh tick 1200, 2400 tối đa 2 con ở Đêm 2
  const sched = sim({
    night: 2,
    scenario: { random_motes: false, random_shades: false, random_drifters: true },
    ticks: 3700, every: 1200, name: 'drifter-sched',
  });
  assert.equal(sched.snaps[0].drifters.length, 0);
  assert.equal(sched.snaps[1].drifters.length, 1); // tick 1200 -> D1
  assert.equal(sched.snaps[2].drifters.length, 2); // tick 2400 -> D2
  assert.equal(sched.snaps[3].drifters.length, 2); // tick 3600 -> đã đủ trần 2
  assert.deepEqual(sched.snaps[2].drifters.map((d) => d.id), ['D1', 'D2']);
});

test('drifter-pulse-chase: Tỏa Sáng trúng Gió Lạc đang chase -> chuyển flee không cướp', () => {
  const r = sim({
    night: 2,
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 6 },
      drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'chase' }],
    },
    frames: [{ tick: 0, pulse: true }],
    ticks: 30, every: 1, name: 'drifter-pulse-chase',
  });
  assert.equal(r.events.filter((e) => e.name === 'drifter_steal').length, 0);
  assert.equal(r.snaps[1].drifters[0].state, 'flee');
  assert.equal(r.snaps[1].drifters[0].stolen, 0);
});

test('drifter-pulse-flee-drop: Tỏa Sáng trúng Gió Lạc đang flee có đồ -> thả lại toàn bộ tại chỗ, drifter_drop, biến mất sau 120 tick', () => {
  const r = sim({
    night: 2,
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 5 },
      drifters: [{ id: 'D1', pos: [2, 1, 0], state: 'flee', stolen: 3 }],
    },
    frames: [{ tick: 0, pulse: true }],
    ticks: 130, every: 1, name: 'drifter-pulse-drop',
  });
  const drops = r.events.filter((e) => e.name === 'drifter_drop');
  assert.equal(drops.length, 1);
  assert.deepEqual(drops[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(r.snaps[1].drifters[0].stolen, 0);
  assert.equal(r.snaps[1].motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(r.snaps[120].drifters[0].state, 'flee');
  assert.equal(r.snaps[121].drifters[0].state, 'removed');
});

test('charm: Bùa Gió Đêm 2/3, hiệu lực 600t (7.2 m/s, lướt không hồi chiêu nhưng bỏ qua khi đang lướt), làm mới & hồi sau 2700t', () => {
  const r = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { pos: [34.5, 0, 0] } }, // ngay cạnh C1 (35,0,0) trên cầu
    frames: [
      { tick: 1, move: [1, 0] }, // chạy 60 tick kiểm tra tốc độ 7.2 m/s (dừng ở x=35 + ...)
      { tick: 2, dash: true },
      { tick: 3, dash: false },
      { tick: 5, dash: true },  // đang lướt -> phải bị bỏ qua
      { tick: 6, dash: false },
      { tick: 15, dash: true }, // hết 12 tick lướt -> lướt tiếp ngay được vì không hồi chiêu!
      { tick: 16, dash: false, move: [0, 0] },
    ],
    ticks: 2720, every: 1, name: 'charm',
  });
  const picked = r.events.filter((e) => e.name === 'charm_picked');
  assert.equal(picked.length, 1);
  assert.deepEqual(picked[0].data, { charm_id: 'C1', charm_ticks: 600 });
  const dashes = r.events.filter((e) => e.name === 'dash');
  assert.equal(dashes.length, 2, 'lần 2 giữa chừng bị bỏ qua, lần 3 sau 12 tick ăn ngay không cần cooldown 90t');
  assert.equal(r.snaps[1].charms[0].available, false);
  // Tái xuất hiện sau 2700 tick kể từ tick nhặt (tick 1 -> tick 2701)
  assert.equal(r.snaps[2700].charms[0].available, false);
  assert.equal(r.snaps[2701].charms[0].available, true);

  // Kiểm tra tốc độ chạy 7.2 m/s khi có bùa
  const spd = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 0, -25], charm_ticks: 600 } },
    frames: [{ tick: 0, move: [1, 0] }],
    ticks: 60, every: 60, name: 'charm-speed',
  });
  const vx = spd.snaps.at(-1).player.vel[0];
  assert.ok(Math.abs(vx - 7.2) < 0.05, `charm speed vx=${vx}`);
});

console.log(`\nM5: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
