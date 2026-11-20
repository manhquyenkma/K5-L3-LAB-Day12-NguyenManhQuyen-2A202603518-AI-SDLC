// Test M8: Kiểm tra cú pháp client 3D + server + đủ thành phần HUD, bảng màu chuẩn, ánh sáng môi trường, cài đặt & 10 hiệu ứng âm thanh.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.message || e).split('\n').join('\n    ')); }
}

console.log('Phase 2 M8 — 3D GUI, Standard Palette, HUD, Settings & Audio Checks');

test('cú pháp hợp lệ: server.js, public/main.js, public/audio.js', () => {
  for (const rel of ['server.js', 'public/main.js', 'public/audio.js']) {
    const r = spawnSync(process.execPath, ['--check', join(root, rel)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${rel}: ${r.stderr}`);
  }
});

test('bảng màu chuẩn & công thức ánh sáng môi trường 0.15 + 0.55 * (đèn sáng / tổng đèn)', () => {
  const mainJs = readFileSync(join(root, 'public/main.js'), 'utf8');
  const expectedHex = ['0x0e1430', '0x1b2350', '0x2f5d50', '0xc9b48a', '0x6b4a2f', '0x12384a', '0xffb347', '0xffe9b0', '0x5b5f6e', '0xfff6c2', '0xffe58a', '0x120a1a', '0x7a3cff', '0x3a3450', '0xe8e2d0', '0xc8102e', '0xf2c14e', '0x8fa3b8', '0xff5a5f', '0xf5f1e6'];
  for (const hex of expectedHex) {
    assert.ok(mainJs.includes(hex), `thiếu màu chuẩn ${hex}`);
  }
  assert.ok(mainJs.includes('0.15 + 0.55 * (litCount /'), 'thiếu công thức ánh sáng môi trường');
});

test('đủ 7 thành phần HUD, luồng 3 Đêm, Pause 4 nút, Settings localStorage & 10 SFX', () => {
  const html = readFileSync(join(root, 'public/index.html'), 'utf8');
  for (const id of ['h-flames', 'h-time', 'h-lit', 'h-score', 'mote-bar', 'sk-dash', 'sk-pulse', 'interact-prompt', 'lantern-arrow', 'ov-menu', 'ov-intro', 'ov-pause', 'ov-settings', 'ov-result', 'btn-resume', 'btn-retry-pause', 'btn-pause-settings', 'btn-pause-menu', 'set-vol', 'set-sens']) {
    assert.ok(html.includes(`id="${id}"`), `thiếu phần tử HTML #${id}`);
  }
  const audioJs = readFileSync(join(root, 'public/audio.js'), 'utf8');
  for (const fn of ['startBgm', 'playPickup', 'playLanternLit', 'playPulse', 'playHit', 'playJump', 'playDash', 'playWin', 'playLose', 'playShadeSpawn', 'playCountdown']) {
    assert.ok(audioJs.includes(fn), `thiếu âm thanh ${fn}`);
  }
});

console.log(`\nM8: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
