#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.1.
// Dùng: node headless.js --seed 1 --night 1|2|3 [--scenario f.json] [--inputs f.json]
//                        --ticks N --out out.jsonl [--snapshot-every K]
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim } from './src/sim.js';

class UsageError extends Error {}
class FormatError extends Error {}

function parseArgs(argv) {
  const a = {};
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--') || !known.has(k.slice(2))) throw new UsageError(`Tham số không hợp lệ: ${k}`);
    if (i + 1 >= argv.length) throw new UsageError(`Thiếu giá trị cho ${k}`);
    a[k.slice(2)] = argv[++i];
  }
  const int = (name, min) => {
    if (!/^-?\d+$/.test(a[name] ?? '')) throw new UsageError(`--${name} phải là số nguyên`);
    const v = Number(a[name]);
    if (v < min) throw new UsageError(`--${name} phải >= ${min}`);
    return v;
  };
  const o = {
    seed: int('seed', -2147483648),
    night: int('night', 1),
    ticks: int('ticks', 0),
    snapEvery: a['snapshot-every'] === undefined ? 10 : int('snapshot-every', 1),
    scenario: a.scenario,
    inputs: a.inputs,
    out: a.out,
  };
  if (o.night < 1 || o.night > 3) throw new UsageError('Chỉ hỗ trợ --night 1, 2, hoặc 3');
  if (!o.out) throw new UsageError('Thiếu --out');
  return o;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonNegInt = (v) => Number.isInteger(v) && v >= 0;

function readJson(path, what) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { throw new FormatError(`Không đọc được file ${what}: ${path}`); }
  try { return JSON.parse(text); } catch (e) { throw new FormatError(`File ${what} không phải JSON hợp lệ: ${e.message}`); }
}

function validateScenario(s, night) {
  const bad = (m) => { throw new FormatError('scenario: ' + m); };
  if (!isObj(s)) bad('phải là object');
  if (s.player !== undefined) {
    if (!isObj(s.player)) bad('player phải là object');
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) bad('player.pos phải là [x,y,z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (s.player[k] !== undefined && !nonNegInt(s.player[k])) bad(`player.${k} phải là số nguyên >= 0`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (s[k] !== undefined && typeof s[k] !== 'boolean') bad(`${k} phải là boolean`);
  }
  if (s.motes !== undefined && !(Array.isArray(s.motes) && s.motes.every(isVec3))) bad('motes phải là mảng [x,y,z]');
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades)) bad('shades phải là mảng');
    for (const z of s.shades) {
      if (!isObj(z) || !isVec3(z.pos)) bad('mỗi shade cần pos [x,y,z]');
      if (z.id !== undefined && typeof z.id !== 'string') bad('shade.id phải là chuỗi');
      if (z.state !== undefined && typeof z.state !== 'string') bad('shade.state phải là chuỗi');
      if (z.state_ticks_left !== undefined && !nonNegInt(z.state_ticks_left)) bad('shade.state_ticks_left phải là số nguyên >= 0');
    }
  }
  if (s.drifters !== undefined) {
    if (!Array.isArray(s.drifters)) bad('drifters phải là mảng');
    for (const d of s.drifters) {
      if (!isObj(d) || !isVec3(d.pos)) bad('mỗi drifter cần pos [x,y,z]');
      if (d.id !== undefined && typeof d.id !== 'string') bad('drifter.id phải là chuỗi');
    }
  }
  if (s.charms !== undefined) {
    if (!Array.isArray(s.charms)) bad('charms phải là mảng');
    for (const c of s.charms) {
      if (!isObj(c) || !isVec3(c.pos)) bad('mỗi charm cần pos [x,y,z]');
      if (c.id !== undefined && typeof c.id !== 'string') bad('charm.id phải là chuỗi');
    }
  }
  const maxL = night === 1 ? 5 : night === 2 ? 6 : 7;
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) bad('lanterns phải là mảng');
    for (const l of s.lanterns) {
      if (!isObj(l) || typeof l.id !== 'string') bad('mỗi lantern cần id (chuỗi)');
      if (l.pos !== undefined && !isVec3(l.pos)) bad('lantern.pos phải là [x,y,z]');
      if (l.deposited !== undefined && !nonNegInt(l.deposited)) bad('lantern.deposited phải là số nguyên >= 0');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad('lantern.lit phải là boolean');
      const m = /^L(\d+)$/.exec(l.id);
      if ((!m || Number(m[1]) < 1 || Number(m[1]) > maxL) && l.pos === undefined) bad(`lantern ${l.id} không có trong màn và thiếu pos`);
    }
  }
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s >= 0)) bad('time_left_s phải là số >= 0');
}

function validateInputs(inp) {
  const bad = (m) => { throw new FormatError('inputs: ' + m); };
  if (!isObj(inp) || !Array.isArray(inp.frames)) bad('cần {"frames": [...]}');
  let last = -1;
  for (const f of inp.frames) {
    if (!isObj(f) || !nonNegInt(f.tick)) bad('mỗi frame cần tick là số nguyên >= 0');
    if (f.tick <= last) bad(`tick phải tăng nghiêm ngặt (gặp ${f.tick} sau ${last})`);
    last = f.tick;
    if (f.move !== undefined && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => isNum(v) && v >= -1 && v <= 1))) bad('move phải là [x,z] trong [-1,1]');
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) bad('cam_yaw_deg phải là số');
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (f[b] !== undefined && typeof f[b] !== 'boolean') bad(`${b} phải là boolean`);
    }
  }
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const scenario = o.scenario ? readJson(o.scenario, 'scenario') : null;
  if (scenario) validateScenario(scenario, o.night);
  const inputs = o.inputs ? readJson(o.inputs, 'inputs') : { frames: [] };
  if (o.inputs) validateInputs(inputs);

  const sim = new Sim({ seed: o.seed, night: o.night, scenario });
  const lines = [];
  const emit = (obj) => lines.push(JSON.stringify(obj));
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;

  for (const e of sim.drainEvents()) emit(e);
  emit(sim.snapshot());
  for (let k = 0; k < o.ticks && (sim.state === 'playing' || sim.state === 'paused'); k++) {
    while (fi < inputs.frames.length && inputs.frames[fi].tick <= k) {
      const f = inputs.frames[fi++];
      for (const key of ['move', 'cam_yaw_deg', 'jump', 'interact', 'pulse', 'dash', 'pause']) {
        if (f[key] !== undefined) cur[key] = f[key];
      }
    }
    sim.step(cur);
    for (const e of sim.drainEvents()) emit(e);
    if (sim.tick % o.snapEvery === 0) emit(sim.snapshot());
  }
  emit({ type: 'end', ticks: sim.tick, state: sim.state, score: sim.score });
  writeFileSync(o.out, lines.join('\n') + '\n');
}

try {
  main();
} catch (e) {
  if (e instanceof FormatError) { process.stderr.write(`Lỗi định dạng: ${e.message}\n`); process.exit(2); }
  if (e instanceof UsageError) { process.stderr.write(`Lỗi tham số: ${e.message}\n`); process.exit(1); }
  process.stderr.write(`Lỗi: ${e.stack || e}\n`);
  process.exit(1);
}
