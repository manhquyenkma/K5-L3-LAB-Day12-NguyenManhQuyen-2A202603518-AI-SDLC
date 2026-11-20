// Test M1: Số liệu chuẩn v1.1, game.contract.json v1.1, và dữ liệu bản đồ chuẩn 3 Đêm.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { TUNING as T } from '../../src/tuning.js';
import { getNight } from '../../src/nights/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 2 M1 — Tuning v1.1, Contract & 3 Nights Data');

test('game.contract.json là v1.1, đúng team và khớp toàn bộ số chuẩn TICKET-02', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.1');
  assert.equal(c.team, '2A202603518-nguyen-manh-quyen');
  assert.deepEqual(c.tuning, T);
  assert.equal(T.player_speed, 6);
  assert.equal(T.dash_speed, 14);
  assert.equal(T.dash_duration_s, 0.2);
  assert.equal(T.dash_cooldown_s, 1.5);
  assert.equal(T.carry_capacity, 10);
  assert.equal(T.lantern_cost, 10);
  assert.equal(T.pickup_radius, 1);
  assert.equal(T.interact_radius, 2);
  assert.equal(T.safe_radius, 6);
  assert.equal(T.pulse_cost, 3);
  assert.equal(T.pulse_radius, 5);
  assert.equal(T.pulse_cooldown_s, 3);
  assert.equal(T.pulse_stun_s, 2);
  assert.equal(T.pulse_push_m, 4);
  assert.equal(T.invuln_s, 1.5);
  assert.equal(T.fall_enabled, true);
  assert.equal(T.night1_duration_s, 300);
  assert.equal(T.night2_duration_s, 330);
  assert.equal(T.night3_duration_s, 360);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('Đêm 1 (Đảo Bến): 5 đèn đúng tọa độ, 24 điểm sinh đom đóm, 12 điểm sinh Bóng Mực', () => {
  const n1 = getNight(1);
  assert.equal(n1.duration_s, 300);
  assert.equal(n1.lanterns.length, 5);
  assert.deepEqual(n1.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 25]],
    ['L2', [23.8, 0, 7.7]],
    ['L3', [14.7, 0, -20.2]],
    ['L4', [-14.7, 0, -20.2]],
    ['L5', [-23.8, 0, 7.7]],
  ]);
  assert.equal(n1.moteSpawns.length, 24);
  assert.equal(n1.shadeSpawns.length, 12);
  assert.equal(n1.shadeIntervalTicks, 480);
  assert.equal(n1.shadeMax, 6);
  // Kiểm tra góc đo từ +X ngược chiều kim đồng hồ: điểm đầu của vòng r=12 ở 0° -> (12, 0, 0), điểm 2 ở 45° -> (+8.485, 0, +8.485)
  assert.deepEqual(n1.moteSpawns[0], [12, 0, 0]);
  assert.ok(n1.moteSpawns[1][0] > 8.48 && n1.moteSpawns[1][2] > 8.48);
  // Điểm sinh Bóng Mực đầu ở 15° bán kính 37
  assert.ok(Math.abs(n1.shadeSpawns[0][0] - 37 * Math.cos(Math.PI / 12)) < 0.01);
  assert.ok(Math.abs(n1.shadeSpawns[0][2] - 37 * Math.sin(Math.PI / 12)) < 0.01);
});

test('Đêm 2 (Đảo Cau): 2 đảo + cầu, 6 đèn, 24 điểm đom đóm, 16 điểm Bóng Mực, 2 bục nhảy, 1 Bùa Gió', () => {
  const n2 = getNight(2);
  assert.equal(n2.duration_s, 330);
  assert.equal(n2.islands.length, 2);
  assert.deepEqual(n2.bridge, { xMin: 26, xMax: 44, zMin: -2, zMax: 2, y: 0 });
  assert.equal(n2.lanterns.length, 6);
  assert.deepEqual(n2.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 20]],
    ['L2', [17, 0, -10]],
    ['L3', [-17, 0, -10]],
    ['L4', [70, 0, 20]],
    ['L5', [87, 0, -10]],
    ['L6', [53, 0, -10]],
  ]);
  assert.equal(n2.moteSpawns.length, 24);
  assert.equal(n2.shadeSpawns.length, 16);
  assert.equal(n2.jumpPads.length, 2);
  assert.deepEqual(n2.jumpPads[0].pos, [20, 0, 18]);
  assert.deepEqual(n2.jumpPads[1].pos, [50, 0, -18]);
  assert.deepEqual(n2.charms, [{ id: 'C1', pos: [35, 0, 0] }]);
  assert.equal(n2.shadeIntervalTicks, 420);
  assert.equal(n2.shadeMax, 8);
  assert.equal(n2.driftersEnabled, true);
});

test('Đêm 3 (Đảo Chuông): 3 tầng + 2 dốc + tháp + bục nhảy, 7 đèn, 30 điểm đom đóm, 16 điểm Bóng Mực, 2 Bùa Gió', () => {
  const n3 = getNight(3);
  assert.equal(n3.duration_s, 360);
  assert.equal(n3.lanterns.length, 7);
  assert.deepEqual(n3.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 6, 6]],
    ['L2', [18, 3, 10]],
    ['L3', [-18, 3, 10]],
    ['L4', [35, 0, -10]],
    ['L5', [-35, 0, -10]],
    ['L6', [20, 0, -35]],
    ['L7', [-20, 0, -35]],
  ]);
  assert.equal(n3.moteSpawns.length, 30);
  assert.equal(n3.moteSpawns.filter((p) => p[1] === 0).length, 18);
  assert.equal(n3.moteSpawns.filter((p) => p[1] === 3).length, 8);
  assert.equal(n3.moteSpawns.filter((p) => p[1] === 6).length, 4);
  // Mọi điểm sinh đom đóm tầng 1 (20°..160°) đều có z > 0
  assert.ok(n3.moteSpawns.filter((p) => p[1] === 3).every((p) => p[2] > 0));
  assert.equal(n3.shadeSpawns.length, 16);
  assert.equal(n3.ramps.length, 2);
  assert.deepEqual(n3.jumpPads[0].pos, [0, 3, 13]);
  assert.deepEqual(n3.tower, { cx: 0, cz: 0, r: 2, yBase: 6, height: 8 });
  assert.deepEqual(n3.charms, [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }]);
  assert.equal(n3.shadeSpeed, 4.5);
  assert.equal(n3.shadeIntervalTicks, 360);
  assert.equal(n3.shadeMax, 10);
  assert.equal(n3.windEnabled, true);
});

console.log(`\nM1: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
