import { writeFileSync } from 'node:fs';
import { TUNING } from '../src/tuning.js';

const contract = {
  contract_version: '1.3',
  team: '2A202603518-nguyen-manh-quyen',
  build_cmd: 'npm install --no-audit --no-fund',
  run_cmd: 'node server.js',
  headless_cmd: 'node headless.js',
  bench_cmd: 'node bench.js',
  soak_cmd: 'node soak.js',
  tuning: TUNING,
};

writeFileSync(new URL('../game.contract.json', import.meta.url), JSON.stringify(contract, null, 2) + '\n');
console.log('Đã ghi game.contract.json (v1.3)');
