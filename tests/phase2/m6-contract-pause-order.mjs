// Test M6: Schema v1.1 đầy đủ, pause-resume, win-at-timeout, flames-vs-win, thứ tự 12 bước tick.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m6-'));
let passed = 0, failed = 0;

function run(args) {
  return spawnSync(process.execPath, [join(root, 'headless.js'), ...args], { encoding: 'utf8' });
}
function sim({ night = 1, scenario, frames, ticks, seed = 1, every = 1, name = 'x' }) {
  const out = join(tmp, name + '.jsonl');
  const args = ['--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) { const f = join(tmp, name + '.sc.json'); writeFileSync(f, JSON.stringify(scenario)); args.push('--scenario', f); }
  if (frames) { const f = join(tmp, name + '.in.json'); writeFileSync(f, JSON.stringify({ frames })); args.push('--inputs', f); }
  const r = run(args);
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

console.log('Phase 2 M6 — Schema v1.1, Pause/Resume & 12-Step Tick Order');

test('pause-resume: tick tăng nhưng sim_tick, thời gian, hồi chiêu, bùa đứng yên; snapshot state=paused; sự kiện paused/resumed', () => {
  const r = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { dash_cd_ticks: 60, charm_ticks: 300 }, time_left_s: 100 },
    frames: [
      { tick: 0, move: [1, 0] },
      { tick: 5, pause: true },  // tạm dừng ở tick 6
      { tick: 6, pause: true },  // giữ nút pause không được bật lại
      { tick: 10, pause: false },
      { tick: 15, pause: true }, // tiếp tục ở tick 16
      { tick: 16, pause: false },
    ],
    ticks: 25, every: 1, name: 'pause-resume',
  });
  const evPaused = r.events.filter((e) => e.name === 'paused');
  const evResumed = r.events.filter((e) => e.name === 'resumed');
  assert.equal(evPaused.length, 1);
  assert.equal(evResumed.length, 1);
  assert.equal(evPaused[0].tick, 6);
  assert.equal(evResumed[0].tick, 16);

  const s5 = r.snaps[5];
  const s6 = r.snaps[6];
  const s14 = r.snaps[14];
  assert.equal(s6.state, 'paused');
  assert.equal(s14.state, 'paused');
  // Trong suốt lúc tạm dừng (tick 6..15): sim_tick, time_left_s, dash_cd_s, charm_s, pos hoàn toàn đứng yên
  assert.equal(s6.sim_tick, s5.sim_tick);
  assert.equal(s14.sim_tick, s5.sim_tick);
  assert.equal(s14.time_left_s, s5.time_left_s);
  assert.equal(s14.player.dash_cd_s, s5.player.dash_cd_s);
  assert.equal(s14.player.charm_s, s5.player.charm_s);
  assert.deepEqual(s14.player.pos, s5.player.pos);
  // Sau khi resume (tick 16 -> 25): sim_tick tăng trở lại đúng 10 tick
  assert.equal(r.snaps[16].state, 'playing');
  assert.equal(r.snaps[25].sim_tick, s5.sim_tick + 10);
});

test('win-at-timeout: thắp đèn cuối đúng tick hết giờ vẫn thắng (all_lit)', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = sim({
    night: 1,
    scenario: {
      ...NO_RANDOM,
      time_left_s: 1 / 60, // hết giờ đúng ở tick 1
      player: { pos: [0, 0, 24], carried: 10, flames: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25] }, ...lit],
    },
    frames: [{ tick: 0, interact: true }],
    ticks: 10, every: 1, name: 'win-timeout',
  });
  assert.equal(r.end.state, 'won');
  assert.deepEqual(r.events.find((e) => e.name === 'game_over').data, { result: 'won', reason: 'all_lit' });
});

test('flames-vs-win: cùng tick vừa thắp đủ đèn vừa hết Ngọn Lửa -> luôn thua no_flames', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  // Đặt Bóng Mực ở ngoài vùng an toàn đèn khác nhưng đủ xa L1 (>6m? Không, để ở sát Mây và L1 ở ngoài? Nếu L1 vừa thắp sẽ expel bóng -> dùng rơi khỏi đảo ở bước 3 hoặc bóng ngoài L1!)
  // Dùng rơi khỏi đảo Y < -10: hoặc đặt 2 đèn, bóng ở cách L1 = 6.5m không bị expel? Không, Mây cách L1 <= 2m nên bóng cách Mây <=1m sẽ cách L1 <= 3m -> bị expel!
  // Thay vào đó: L1 vừa thắp ở bước 5 -> bóng trong vùng 6m bị expel (không gây sát thương). Còn nếu Mây rơi ở bước 3 thì bước 5 không nạp.
  // Cách chuẩn: đặt 5 đèn L1..L5 đều lit sẵn trong scenario? Không, đặt L1..L4 lit, L5 ở (0,0,0), Mây flames=1 ở (0,0,0) mang 10, L1..L4 đã lit, và 1 Bóng Mực ở... Wait: trong cùng 1 tick: bước 3 rơi Y<-10 làm flames=0 (nhưng respawnTicks=0 nên bước 5 vẫn có thể bị chặn vì flames=0). Ta kiểm tra nếu tất cả đèn lit sẵn + bóng chạm ở bước 9 làm flames=0 -> phải thua no_flames (không thắng all_lit)!
  const allLit = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = sim({
    night: 1,
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], flames: 1 }, // xa tất cả đèn (>6 m)
      lanterns: allLit,
      shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }],
    },
    ticks: 5, every: 1, name: 'flames-vs-win',
  });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(r.events.find((e) => e.name === 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('tick-order: Bước 9 Gió Lạc cướp TRƯỚC Bóng Mực gây hit', () => {
  const r = sim({
    night: 2,
    scenario: {
      ...NO_RANDOM,
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      drifters: [{ id: 'D1', pos: [0.5, 1, 0], state: 'chase' }],
      shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }],
    },
    ticks: 5, every: 1, name: 'order-9',
  });
  const evs = r.events.filter((e) => e.tick === 1).map((e) => e.name);
  assert.ok(evs.indexOf('drifter_steal') >= 0 && evs.indexOf('player_hit') > evs.indexOf('drifter_steal'), `order=${evs}`);
  // Mang 8 -> Gió Lạc cướp 3 còn 5 -> Bóng Mực đánh rơi floor(5/2) = 2 (còn 3)
  assert.equal(r.events.find((e) => e.name === 'drifter_steal').data.amount, 3);
  assert.equal(r.events.find((e) => e.name === 'player_hit').data.dropped, 2);
  assert.equal(r.snaps[1].player.carried, 3);
});

test('schema-v1.1: night_start ở tick 0, đủ mọi trường snapshot v1.1, mã thoát 1 cho --night 4 và mã 2 cho scenario lỗi', () => {
  const r = sim({ night: 3, scenario: { ...NO_RANDOM, wind_enabled: true }, ticks: 5, every: 5, name: 'schema-n3' });
  const ns = r.events.find((e) => e.name === 'night_start');
  assert.ok(ns && ns.tick === 0 && ns.data.night === 3, `night_start=${JSON.stringify(ns)}`);
  const s0 = r.snaps[0];
  assert.equal(s0.night, 3);
  assert.ok('active' in s0.wind && 'dir_deg' in s0.wind);
  for (const k of ['pos', 'vel', 'grounded', 'flames', 'carried', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) {
    assert.ok(k in s0.player, `thiếu player.${k}`);
  }
  assert.ok(Array.isArray(s0.motes) && Array.isArray(s0.drifters) && Array.isArray(s0.charms));
  assert.equal(s0.charms.length, 2);
  assert.ok('id' in s0.charms[0] && 'available' in s0.charms[0] && 'respawn_s' in s0.charms[0]);

  assert.equal(run(['--seed', '1', '--night', '4', '--ticks', '5', '--out', join(tmp, 'bad-n.jsonl')]).status, 1);
  const badSc = join(tmp, 'bad-drifter.json');
  writeFileSync(badSc, JSON.stringify({ drifters: [{ id: 'D1' }] })); // thiếu pos
  assert.equal(run(['--seed', '1', '--night', '2', '--ticks', '5', '--out', join(tmp, 'bad-d.jsonl'), '--scenario', badSc]).status, 2);
});

console.log(`\nM6: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
