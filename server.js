#!/usr/bin/env node
// Máy chủ tĩnh & API Bảng xếp hạng cục bộ (không phụ thuộc gói ngoài).
// Dùng:
//   node server.js [port]
//   node server.js --export-leaderboard out.json
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLeaderboard, addLeaderboardEntry, exportLeaderboard } from './lib/leaderboard.js';

const root = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

// Hỗ trợ lệnh xuất bảng xếp hạng: <run_cmd> --export-leaderboard out.json
const expIdx = argv.indexOf('--export-leaderboard');
if (expIdx !== -1) {
  const outPath = argv[expIdx + 1];
  if (!outPath || outPath.startsWith('--')) {
    process.stderr.write('Thiếu đường dẫn file cho --export-leaderboard\n');
    process.exit(1);
  }
  const entries = exportLeaderboard(outPath);
  console.log(`Đã xuất ${entries.length} mục bảng xếp hạng ra ${outPath}`);
  process.exit(0);
}

const portArg = argv.find((x) => /^\d+$/.test(x));
const port = Number(portArg || process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

function resolvePath(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/' || p === '/index.html') return join(root, 'public', 'index.html');
  if (p.startsWith('/vendor/')) {
    const rel = p.slice('/vendor/'.length);
    const bundledDir = join(root, 'vendor');
    const nmDir = join(root, 'node_modules', 'three', 'build');
    const f1 = normalize(join(bundledDir, rel));
    if (f1.startsWith(bundledDir) && existsSync(f1)) return f1;
    const f2 = normalize(join(nmDir, rel));
    return f2.startsWith(nmDir) ? f2 : null;
  }
  if (p === '/main.js' || p === '/audio.js' || p === '/assets.js' || p === '/style.css') return join(root, 'public', p.slice(1));
  if (p.startsWith('/src/')) {
    const f = normalize(join(root, p));
    return f.startsWith(join(root, 'src')) ? f : null;
  }
  return null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 65536) { reject(new Error('Payload quá lớn')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('JSON không hợp lệ')); }
    });
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  if (pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-cache' });
      return res.end(JSON.stringify({ entries: loadLeaderboard() }));
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const result = addLeaderboardEntry(body);
        res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-cache' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': types['.json'] });
        return res.end(JSON.stringify({ error: err.message || 'Dữ liệu không hợp lệ' }));
      }
    }
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  const f = resolvePath(req.url || '/');
  if (!f) { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(f);
    res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
