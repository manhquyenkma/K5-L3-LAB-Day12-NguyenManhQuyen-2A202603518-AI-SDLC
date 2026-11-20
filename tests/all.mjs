// Trình chạy toàn bộ bộ test (hồi quy Phase 1 + các mốc Phase 2).
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [join(root, 'tests', 'run.mjs')];
const p2Dir = join(root, 'tests', 'phase2');
if (existsSync(p2Dir)) {
  for (const f of readdirSync(p2Dir).sort()) {
    if (f.endsWith('.mjs')) files.push(join(p2Dir, f));
  }
}

let allOk = true;
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit' });
  if (r.status !== 0) allOk = false;
}
process.exit(allOk ? 0 : 1);
