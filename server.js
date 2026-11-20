// Máy chủ tĩnh tối giản (không phụ thuộc gói ngoài). Chạy: node server.js [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

function resolvePath(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/' || p === '/index.html') return join(root, 'public', 'index.html');
  if (p.startsWith('/vendor/')) {
    const f = normalize(join(root, 'node_modules', 'three', 'build', p.slice('/vendor/'.length)));
    return f.startsWith(join(root, 'node_modules', 'three', 'build')) ? f : null;
  }
  if (p === '/main.js' || p === '/audio.js' || p === '/assets.js' || p === '/style.css') return join(root, 'public', p.slice(1));
  if (p.startsWith('/src/')) {
    const f = normalize(join(root, p));
    return f.startsWith(join(root, 'src')) ? f : null;
  }
  return null;
}

createServer(async (req, res) => {
  const f = resolvePath(req.url || '/');
  if (!f) { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(f);
    res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
