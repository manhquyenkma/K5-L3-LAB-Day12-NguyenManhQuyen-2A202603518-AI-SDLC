#!/usr/bin/env node
// Chế độ Benchmark đồ họa 3D bắt buộc (TICKET-04 Phần 1, Test Contract v1.3).
// Dùng: node bench.js --seed 42 --duration 30 --out bench.json
const tProcessStart = performance.now();

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { tmpdir, platform, release, arch, type as osType } from 'node:os';

const root = dirname(fileURLToPath(import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function parseArgs(argv) {
  const a = {};
  const known = new Set(['seed', 'duration', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--') || !known.has(k.slice(2))) throw new Error(`Tham số không hợp lệ: ${k}`);
    if (i + 1 >= argv.length) throw new Error(`Thiếu giá trị cho ${k}`);
    a[k.slice(2)] = argv[++i];
  }
  const seedRaw = a.seed ?? '42';
  if (!/^-?\d+$/.test(seedRaw)) throw new Error('--seed phải là số nguyên');
  const durRaw = a.duration ?? '30';
  const duration = Number(durRaw);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('--duration phải là số > 0');
  if (!a.out) throw new Error('Thiếu --out');
  return { seed: Number(seedRaw), duration, out: a.out };
}

function findBrowser() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const plat = platform();
  const candidates = plat === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : plat === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge',
        ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

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
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function sampleTreeMemMb(tag) {
  return new Promise((resolve) => {
    const nodeMb = process.memoryUsage().rss / (1024 * 1024);
    if (platform() === 'win32') {
      const cmd = `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${tag}*' } | Measure-Object -Property WorkingSetSize -Sum).Sum`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { timeout: 2500 }, (err, stdout) => {
        if (err) return resolve(null);
        const bytes = Number((stdout || '').trim());
        if (!Number.isFinite(bytes) || bytes <= 0) return resolve(null);
        resolve(nodeMb + bytes / (1024 * 1024));
      });
    } else {
      execFile('ps', ['-eo', 'rss,args'], { timeout: 2500 }, (err, stdout) => {
        if (err) return resolve(null);
        let kb = 0;
        for (const line of String(stdout).split('\n')) {
          if (line.includes(tag)) {
            const m = /^\s*(\d+)/.exec(line);
            if (m) kb += Number(m[1]);
          }
        }
        resolve(kb > 0 ? nodeMb + kb / 1024 : null);
      });
    }
  });
}

function killBrowser(child) {
  if (!child || child.killed) return;
  try {
    if (platform() === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch { /* noop */ }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('Không tìm thấy Google Chrome / Chromium / Edge. Hãy cài Chrome hoặc đặt biến môi trường CHROME_PATH.');
  }

  const profileTag = `ddl-bench-${process.pid}-${Date.now()}`;
  const profileDir = join(tmpdir(), profileTag);
  mkdirSync(profileDir, { recursive: true });

  let loadMs = null;
  let peakMemMb = 0;
  let memSamples = 0;
  let memTimer = null;
  let browserProc = null;
  let finished = false;
  let resolveDone;
  let rejectDone;
  const donePromise = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });

  const server = createServer(async (req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/api/bench-ready' && req.method === 'POST') {
      if (loadMs === null) loadMs = Math.round(performance.now() - tProcessStart);
      res.writeHead(200, { 'Content-Type': types['.json'] });
      return res.end('{"ok":true}');
    }
    if (pathname === '/api/bench-done' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        res.writeHead(200, { 'Content-Type': types['.json'] });
        res.end('{"ok":true}');
        if (!finished) {
          finished = true;
          resolveDone(body);
        }
      } catch (e) {
        res.writeHead(400);
        res.end('Bad request');
      }
      return;
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
  });

  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/?bench=1&seed=${opts.seed}&duration=${opts.duration}`;

  const browserArgs = [
    `--app=${url}`,
    '--window-size=1280,720',
    '--window-position=40,40',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${profileDir}`,
  ];

  browserProc = spawn(browserPath, browserArgs, { stdio: 'ignore' });
  browserProc.on('error', (err) => {
    if (!finished) { finished = true; rejectDone(err); }
  });
  browserProc.on('exit', (code) => {
    if (!finished) {
      setTimeout(() => {
        if (!finished) { finished = true; rejectDone(new Error(`Trình duyệt đóng sớm trước khi đo xong (mã ${code})`)); }
      }, 1500);
    }
  });

  const timeoutMs = (opts.duration + 35) * 1000;
  const watchdog = setTimeout(() => {
    if (!finished) { finished = true; rejectDone(new Error(`Hết thời gian chờ benchmark (${timeoutMs / 1000}s)`)); }
  }, timeoutMs);

  try {
    const result = await donePromise;
    clearTimeout(watchdog);
    if (memTimer) clearInterval(memTimer);
    // Lấy mẫu RSS cuối trước khi đóng trình duyệt
    const finalMb = await sampleTreeMemMb(profileTag);
    if (finalMb !== null && finalMb > peakMemMb) { peakMemMb = finalMb; memSamples++; }

    const report = {
      contract_version: '1.3',
      avg_fps: result.avg_fps,
      p1_low_fps: result.p1_low_fps,
      frame_ms_p95: result.frame_ms_p95,
      frames: result.frames,
      load_ms: loadMs ?? result.load_ms ?? 0,
      peak_mem_mb: memSamples > 0 ? Math.round(peakMemMb * 10) / 10 : null,
      vsync_off: true,
      renderer: result.renderer || 'Three.js 0.160.0 / WebGL2',
      os: `${osType()} ${release()} (${platform()}/${arch()})`,
    };

    const parent = dirname(opts.out);
    if (parent && parent !== '.') mkdirSync(parent, { recursive: true });
    writeFileSync(opts.out, JSON.stringify(report, null, 2) + '\n', 'utf8');
    if (process.env.DDL_BENCH_SCREENSHOT && typeof result.png === 'string' && result.png.startsWith('data:image/png;base64,')) {
      const shotPath = process.env.DDL_BENCH_SCREENSHOT;
      mkdirSync(dirname(shotPath), { recursive: true });
      writeFileSync(shotPath, Buffer.from(result.png.slice('data:image/png;base64,'.length), 'base64'));
    }
    console.log(JSON.stringify(report));
  } finally {
    clearTimeout(watchdog);
    if (memTimer) clearInterval(memTimer);
    killBrowser(browserProc);
    server.close();
    setTimeout(() => {
      try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* noop */ }
    }, 600);
  }
}

main().catch((err) => {
  process.stderr.write(`Lỗi bench: ${err.message || err}\n`);
  process.exit(1);
});
