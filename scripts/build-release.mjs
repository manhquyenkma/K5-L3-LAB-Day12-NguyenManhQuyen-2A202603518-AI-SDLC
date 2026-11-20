#!/usr/bin/env node
// Đóng gói bản phát hành v1.0.0 chạy ngay không cần npm install (TICKET-04 Phần 5).
// Dùng: npm run build:release -> tạo dist/dao-den-long-v1.0.0/ và dist/dao-den-long-v1.0.0.zip
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(root, 'dist');
const outDir = join(distRoot, 'dao-den-long-v1.0.0');
const zipPath = join(distRoot, 'dao-den-long-v1.0.0.zip');

rmSync(outDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(outDir, { recursive: true });

// Sao chép toàn bộ mã chạy (server, headless, bench, soak, lõi src, lib, public, three.js vendor)
for (const dir of ['public', 'src', 'lib']) {
  cpSync(join(root, dir), join(outDir, dir), { recursive: true });
}
const threeBuild = join(root, 'node_modules', 'three', 'build');
if (!existsSync(threeBuild)) {
  throw new Error('Thiếu node_modules/three/build — hãy chạy npm install trước.');
}
cpSync(threeBuild, join(outDir, 'vendor'), { recursive: true });

for (const f of ['server.js', 'headless.js', 'bench.js', 'soak.js', 'game.contract.json', 'package.json', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md']) {
  if (existsSync(join(root, f))) cpSync(join(root, f), join(outDir, f));
}

writeFileSync(join(outDir, 'README-RELEASE.txt'), [
  'ĐẢO ĐÈN LỒNG — Bản phát hành v1.0.0 (Contract v1.3)',
  '===================================================',
  'Yêu cầu: Node.js >= 18 (KHÔNG cần npm install — three.js đã được đóng gói sẵn trong vendor/).',
  '',
  'Cách chạy:',
  '  1. Giải nén thư mục này',
  '  2. Chạy: node server.js',
  '  3. Mở trình duyệt: http://localhost:8080',
  '',
  'Lệnh phụ trợ:',
  '  node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  '  node bench.js --seed 42 --duration 30 --out bench.json',
  '  node soak.js --seed 7 --nights 10 --out soak.json',
  '  node server.js --export-leaderboard leaderboard.json',
  '',
].join('\n'), 'utf8');

// Tạo file .zip phát hành để đính kèm GitHub Release v1.0.0
if (platform() === 'win32') {
  const r = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${outDir}', '${zipPath}')`,
  ], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(zipPath)) throw new Error(`Lỗi tạo zip: ${r.stderr || r.stdout}`);
} else {
  const r = spawnSync('zip', ['-r', zipPath, '.'], { cwd: outDir, encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(zipPath)) throw new Error(`Lỗi tạo zip: ${r.stderr}`);
}

console.log(`Đã đóng gói bản phát hành v1.0.0 tại:\n  - ${outDir}\n  - ${zipPath}`);
