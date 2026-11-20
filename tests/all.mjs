// Trình chạy toàn bộ bộ test (hồi quy Phase 1 + Phase 2 + Phase 3 + Phase 4).
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [join(root, 'tests', 'run.mjs')];
for (const sub of ['phase2', 'phase3', 'phase4']) {
  const dir = join(root, 'tests', sub);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (f.endsWith('.mjs')) files.push(join(dir, f));
    }
  }
}

let allOk = true;
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit' });
  if (r.status !== 0) allOk = false;
}
process.exit(allOk ? 0 : 1);
