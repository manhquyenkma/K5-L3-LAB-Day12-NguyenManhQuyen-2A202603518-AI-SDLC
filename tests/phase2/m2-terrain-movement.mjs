// Test M2: Địa hình 3 đêm (terrain.js), chuyển động vận tốc, nhảy, lướt, bục nhảy, rơi/hồi sinh, gió Đêm 3.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-m2-'));
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

console.log('Phase 2 M2 — Terrain & Movement');

test('jump: vận tốc 7 m/s, g=-20, chỉ nhảy khi chạm đất', () => {
  const r = sim({
    scenario: NO_RANDOM,
    frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }],
    ticks: 50, every: 1, name: 'jump',
  });
  const peakY = Math.max(...r.snaps.map((s) => s.player.pos[1]));
  // v^2 / (2g) = 49 / 40 = 1.225 m (tính rời rạc 60Hz gần ~1.17-1.23 m)
  assert.ok(peakY > 1.1 && peakY < 1.35, `peakY=${peakY}`);
  assert.equal(r.snaps[1].player.grounded, false);
  // Đáp lại đất sau ~0.7 s (~42 tick), không nhảy kép ở tick 5
  assert.equal(r.snaps.at(-1).player.grounded, true);
  assert.equal(r.snaps.at(-1).player.pos[1], 0);
});

test('dash: 14 m/s trong 12 tick, hướng mặt khi đứng yên (+Z), hồi chiêu 90 tick, giữ độ cao trên không, không bất tử', () => {
  const r = sim({
    scenario: NO_RANDOM,
    frames: [
      { tick: 0, dash: true },
      { tick: 1, dash: false },
      { tick: 20, dash: true }, // bị hồi chiêu
      { tick: 21, dash: false },
      { tick: 90, dash: true }, // đủ 90 tick từ tick 0 -> lướt lại được
    ],
    ticks: 105, every: 1, name: 'dash',
  });
  const dashes = r.events.filter((e) => e.name === 'dash');
  assert.equal(dashes.length, 2, `dashes=${dashes.length}`);
  assert.equal(dashes[0].tick, 1);
  assert.equal(dashes[1].tick, 91);
  // Sau 12 tick đầu (tick 12), dịch 14 * 0.2 = 2.8 m về +Z
  assert.ok(Math.abs(r.snaps[12].player.pos[2] - 2.8) < 0.05, `z12=${r.snaps[12].player.pos[2]}`);

  // Lướt trên không giữ nguyên độ cao
  const air = sim({
    scenario: NO_RANDOM,
    frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, dash: true }],
    ticks: 25, every: 1, name: 'dash-air',
  });
  const yStart = air.snaps[10].player.pos[1];
  assert.ok(yStart > 0.5);
  assert.ok(Math.abs(air.snaps[22].player.pos[1] - yStart) < 0.01, `y10=${yStart}, y22=${air.snaps[22].player.pos[1]}`);

  // Không bất tử khi lướt
  const hit = sim({
    scenario: { ...NO_RANDOM, shades: [{ id: 'S1', pos: [0, 1, 1.5] }] },
    frames: [{ tick: 0, dash: true }],
    ticks: 15, every: 1, name: 'dash-hit',
  });
  assert.ok(hit.events.some((e) => e.name === 'player_hit'), 'lướt vẫn bị đánh');
});

test('pad-night2: 2 bục nhảy bắn qua đảo kia, phím di chuyển không ghi đè', () => {
  // Bục 1 tại (20,0,18) -> đáp trong Đảo B tâm (70,0,0) bán kính 28
  const r1 = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { pos: [20, 0, 18] } },
    frames: [{ tick: 0, move: [-1, 0] }], // cố kéo ngược lại nhưng bị khóa vận tốc
    ticks: 120, every: 1, name: 'pad2a',
  });
  const land1 = r1.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(land1, 'phải đáp xuống Đảo B');
  const distB = Math.hypot(land1.player.pos[0] - 70, land1.player.pos[2]);
  assert.ok(distB < 28, `đáp ngoài Đảo B: pos=${land1.player.pos}, distB=${distB}`);

  // Bục 2 tại (50,0,-18) -> đáp trong Đảo A tâm (0,0,0) bán kính 28
  const r2 = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { pos: [50, 0, -18] } },
    ticks: 120, every: 1, name: 'pad2b',
  });
  const land2 = r2.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(land2, 'phải đáp xuống Đảo A');
  const distA = Math.hypot(land2.player.pos[0], land2.player.pos[2]);
  assert.ok(distA < 28, `đáp ngoài Đảo A: pos=${land2.player.pos}, distA=${distA}`);
});

test('pad-night3: bục (0,3,13) bắn hướng -Z đáp lên tầng 2 (Y=6)', () => {
  const r = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 3, 13] } },
    ticks: 90, every: 1, name: 'pad3',
  });
  const land = r.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(land, 'phải đáp lên tầng 2');
  assert.equal(land.player.pos[1], 6);
  const rad = Math.hypot(land.player.pos[0], land.player.pos[2]);
  assert.ok(rad > 2 && rad <= 8, `pos=${land.player.pos}, rad=${rad}`);
});

test('bridge: đi qua cầu tre Đêm 2 không rơi; bước lệch z > 2 thì rơi', () => {
  const ok = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { pos: [26, 0, 0] } },
    frames: [{ tick: 0, move: [1, 0] }],
    ticks: 200, every: 10, name: 'bridge-ok',
  });
  assert.equal(ok.events.filter((e) => e.name === 'player_hit').length, 0);
  assert.ok(ok.snaps.at(-1).player.pos[0] > 44);

  const fall = sim({
    night: 2,
    scenario: { ...NO_RANDOM, player: { pos: [35, 0, 1.5] } },
    frames: [{ tick: 0, move: [0, 1] }],
    ticks: 120, every: 5, name: 'bridge-fall',
  });
  assert.ok(fall.events.some((e) => e.name === 'player_hit' && e.data.by === 'fall'));
});

test('cliff-ramp: Đêm 3 vách tầng 1/2 & tháp chặn; 2 dốc 30° & 150° đi lên được Y=3', () => {
  // Đứng tầng 0 ở (0, 0, 26) đi vào -Z về hướng tầng 1 (r=24, z>0) -> bị vách chặn ở r >= 24
  const cliff = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 0, 26] } },
    frames: [{ tick: 0, move: [0, -1] }],
    ticks: 60, every: 10, name: 'cliff',
  });
  assert.ok(cliff.snaps.at(-1).player.pos[2] >= 23.9, `bị xuyên vách tầng 1: z=${cliff.snaps.at(-1).player.pos[2]}`);
  assert.equal(cliff.snaps.at(-1).player.pos[1], 0);

  // Đi lên dốc 30° từ chân r=31 về tâm -> lên tới tầng 1 Y=3
  const c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
  const ramp = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [31 * c30, 0, 31 * s30] } },
    frames: [{ tick: 0, move: [-c30, -s30] }],
    ticks: 120, every: 5, name: 'ramp30',
  });
  assert.equal(ramp.snaps.at(-1).player.pos[1], 3, `không lên được tầng 1 qua dốc 30°: pos=${ramp.snaps.at(-1).player.pos}`);

  // Tháp chuông tâm tầng 2 bán kính 2 m chặn không đi xuyên qua
  const tower = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 6, 5] } },
    frames: [{ tick: 0, move: [0, -1] }],
    ticks: 90, every: 10, name: 'tower',
  });
  assert.ok(Math.hypot(tower.snaps.at(-1).player.pos[0], tower.snaps.at(-1).player.pos[2]) >= 1.99, `xuyên tháp: ${tower.snaps.at(-1).player.pos}`);
});

test('fall-respawn: rơi Y<-10 đúng 1 lần, bỏ qua bất tử, mất hết đom đóm, chờ 60 tick hồi sinh bất tử 90; hết lửa thua ngay', () => {
  const r = sim({
    night: 1,
    scenario: { ...NO_RANDOM, player: { pos: [41, 0, 0], carried: 7, flames: 3, invuln_ticks: 90 } },
    ticks: 150, every: 1, name: 'fall-respawn',
  });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 7 });
  const hitTick = hits[0].tick;
  // Sau đúng 60 tick -> hồi sinh ở (0,0,0), vận tốc 0, bất tử 90 tick
  const respSnap = r.snaps[hitTick + 60];
  assert.deepEqual(respSnap.player.pos, [0, 0, 0]);
  assert.deepEqual(respSnap.player.vel, [0, 0, 0]);
  assert.equal(respSnap.player.invuln, true);
  assert.equal(respSnap.player.carried, 0);

  // Hết lửa -> thua ngay, không hồi sinh
  const die = sim({
    night: 1,
    scenario: { ...NO_RANDOM, player: { pos: [41, 0, 0], flames: 1 } },
    ticks: 200, every: 1, name: 'fall-die',
  });
  assert.equal(die.end.state, 'lost');
  assert.deepEqual(die.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.ok(die.end.ticks < 80, `phải thua ngay lúc rơi, không chờ hồi sinh: ticks=${die.end.ticks}`);
});

test('wind-night3: cứ 30 s có cơn gió 5 s đẩy 2 m/s, snapshot ghi wind, wind_enabled=false tắt gió', () => {
  const r = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: true, player: { pos: [0, 0, -25] } },
    ticks: 2200, every: 10, name: 'wind-on',
  });
  const activeSnaps = r.snaps.filter((s) => s.wind.active);
  assert.ok(activeSnaps.length >= 28 && activeSnaps.length <= 31, `activeSnaps=${activeSnaps.length}`);
  // Người đứng yên bị đẩy tổng ~2 m/s * 5 s = 10 m
  const pBefore = r.snaps.find((s) => s.tick === 1790).player.pos;
  const pAfter = r.snaps.find((s) => s.tick === 2110).player.pos;
  const moved = Math.hypot(pAfter[0] - pBefore[0], pAfter[2] - pBefore[2]);
  assert.ok(moved > 8.5 && moved < 11.5, `wind push moved=${moved}`);

  const off = sim({
    night: 3,
    scenario: { ...NO_RANDOM, wind_enabled: false, player: { pos: [0, 0, -25] } },
    ticks: 2200, every: 60, name: 'wind-off',
  });
  assert.ok(off.snaps.every((s) => !s.wind.active));
  assert.deepEqual(off.snaps.at(-1).player.pos, [0, 0, -25]);
});

console.log(`\nM2: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
