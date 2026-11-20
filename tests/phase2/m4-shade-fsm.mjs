// Test M4: Bóng Mực — FSM 5 trạng thái (spawning/wander/chase/recoil/stunned), phát hiện 12 m / bỏ đuổi 18 m, recoil 2 m/60 tick, lịch sinh 3 đêm.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m4-'));
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

console.log('Phase 2 M4 — Shade 5-State FSM & Spawn Schedule');

test('shade-fsm: đủ 5 trạng thái, phát hiện <=12 m, bỏ đuổi >18 m, recoil lùi 2 m trong 60 tick', () => {
  // 1. Ngoài 12 m -> wander; lại gần <=12 m -> chase; chạy ra >18 m -> wander
  const r1 = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0] },
      shades: [
        { id: 'S1', pos: [15, 1, 0], state: 'wander' }, // 15 m > 12 m -> giữ wander
        { id: 'S2', pos: [19, 1, 0], state: 'chase' },  // 19 m > 18 m -> bỏ đuổi về wander
        { id: 'S3', pos: [11, 1, 0], state: 'wander' }, // 11 m <= 12 m -> chuyển chase
        { id: 'S4', pos: [25, 1, 0], state: 'spawning', state_ticks_left: 2 },
      ],
    },
    ticks: 5, every: 1, name: 'fsm-states',
  });
  const s1 = r1.snaps[1].shades;
  assert.equal(s1.find((z) => z.id === 'S1').state, 'wander');
  assert.equal(s1.find((z) => z.id === 'S2').state, 'wander');
  assert.equal(s1.find((z) => z.id === 'S3').state, 'chase');
  assert.equal(s1.find((z) => z.id === 'S4').state, 'spawning');
  assert.equal(r1.snaps[2].shades.find((z) => z.id === 'S4').state, 'wander');

  // 2. Chạm gây hit -> chuyển recoil, lùi tổng ~2 m trong 60 tick; chạm lúc Mây bất tử không recoil
  const r2 = sim({
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], flames: 3 },
      shades: [{ id: 'S1', pos: [0.8, 1, 0], state: 'chase' }],
    },
    ticks: 70, every: 1, name: 'fsm-recoil',
  });
  const hit = r2.events.find((e) => e.name === 'player_hit');
  assert.ok(hit);
  assert.equal(r2.snaps[hit.tick].shades[0].state, 'recoil');
  const startX = r2.snaps[hit.tick].shades[0].pos[0];
  const endX = r2.snaps[hit.tick + 59].shades[0].pos[0];
  assert.ok(endX - startX > 1.8 && endX - startX < 2.2, `recoil dist=${endX - startX}`);
  assert.notEqual(r2.snaps[hit.tick + 61].shades[0].state, 'recoil');

  // 3. Chạm lúc bất tử không làm gì (không recoil, không mất lửa)
  const r3 = sim({
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 0], invuln_ticks: 50 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] },
    ticks: 10, every: 1, name: 'fsm-invuln',
  });
  assert.equal(r3.events.filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(r3.snaps[1].shades[0].state, 'chase');
});

test('shade-schedule: 2 con tick 300 (trạng thái spawning), đúng chu kỳ & trần 3 đêm, cách người >=15 m, Đêm 3 chạy 4.5 m/s', () => {
  // Đêm 1: 2 con ở tick 300, rồi mỗi 480 tick, tối đa 6
  const n1 = sim({ night: 1, scenario: { random_motes: false, random_shades: true }, ticks: 3200, every: 300, name: 'sched-n1' });
  const sp1 = n1.events.filter((e) => e.name === 'shade_spawned');
  assert.equal(sp1.length, 6, `Đêm 1 trần 6, thực tế=${sp1.length}`);
  assert.equal(sp1[0].tick, 300);
  assert.equal(sp1[1].tick, 300);
  assert.equal(sp1[2].tick, 780);
  assert.equal(sp1[3].tick, 1260);
  assert.deepEqual(sp1.map((e) => e.data.id), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  // Tại tick 300 mới sinh -> trạng thái phải là spawning và cách người chơi >= 15 m
  const at300 = n1.snaps.find((s) => s.tick === 300);
  assert.equal(at300.shades.length, 2);
  for (const z of at300.shades) {
    assert.equal(z.state, 'spawning');
    assert.ok(Math.hypot(z.pos[0] - at300.player.pos[0], z.pos[2] - at300.player.pos[2]) >= 14.99);
  }

  // Đêm 2: chu kỳ 420 tick, trần 8
  const n2 = sim({ night: 2, scenario: { random_motes: false, random_shades: true, random_drifters: false }, ticks: 4000, every: 500, name: 'sched-n2' });
  const sp2 = n2.events.filter((e) => e.name === 'shade_spawned');
  assert.equal(sp2.length, 8);
  assert.equal(sp2[2].tick, 720);

  // Đêm 3: chu kỳ 360 tick, trần 10, tốc độ 4.5 m/s
  const n3 = sim({ night: 3, scenario: { random_motes: false, random_shades: true, random_drifters: false, wind_enabled: false }, ticks: 4500, every: 500, name: 'sched-n3' });
  const sp3 = n3.events.filter((e) => e.name === 'shade_spawned');
  assert.equal(sp3.length, 10);
  assert.equal(sp3[2].tick, 660);

  const spd3 = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 0, -25] }, shades: [{ id: 'S1', pos: [10, 1, -25], state: 'chase' }] },
    ticks: 60, every: 60, name: 'spd-n3',
  });
  assert.ok(Math.abs(spd3.snaps.at(-1).shades[0].pos[0] - (10 - 4.5)) < 0.05, `n3 x=${spd3.snaps.at(-1).shades[0].pos[0]}`);
});

console.log(`\nM4: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
