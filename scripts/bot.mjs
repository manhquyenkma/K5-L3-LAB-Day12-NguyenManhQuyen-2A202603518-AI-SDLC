// Bot tham lam: chứng minh Đêm 1 thắng được với số liệu hiện tại, và ghi lại inputs để phát lại qua headless.
// Dùng: node scripts/bot.mjs <seed> <inputs-out.json>
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/sim.js';
import { TUNING as T } from '../src/tuning.js';

const seed = Number(process.argv[2] ?? 1);
const outFile = process.argv[3];
const sim = new Sim({ seed });
const frames = [];
let prev = { move: [0, 0], interact: false, pulse: false };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (let k = 0; k < 18000 && sim.state === 'playing'; k++) {
  const p = sim.player;
  const near = sim.shades.filter((z) => z.state !== 'stunned').sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
  let target = null, interact = false, pulse = false;
  const unlit = sim.lanterns.filter((l) => !l.lit).sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos));

  if (near && dist(p.pos, near.pos) < 4 && p.carried >= T.pulse_cost && p.pulseCd === 0) pulse = !prev.pulse;
  if (p.carried >= T.carry_capacity || (p.carried > 0 && sim.motes.length === 0)) {
    const L = unlit[0];
    target = L.pos;
    if (dist(p.pos, L.pos) <= T.interact_radius - 0.2) interact = !prev.interact;
  } else {
    const m = sim.motes.slice().sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
    target = m ? m.pos : unlit[0].pos;
  }
  let move = [0, 0];
  if (target && !(interact)) {
    const dx = target[0] - p.pos[0], dz = target[2] - p.pos[2], d = Math.hypot(dx, dz);
    if (d > 0.05) move = [Math.round((dx / d) * 1e3) / 1e3, Math.round((dz / d) * 1e3) / 1e3];
  }
  const cur = { move, interact, pulse };
  const f = { tick: k };
  if (move[0] !== prev.move[0] || move[1] !== prev.move[1]) f.move = move;
  if (cur.interact !== prev.interact) f.interact = cur.interact;
  if (cur.pulse !== prev.pulse) f.pulse = cur.pulse;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = cur;
  sim.step({ move, interact, pulse });
  sim.drainEvents();
}
console.log(JSON.stringify({ seed, state: sim.state, ticks: sim.tick, score: sim.score, flames: sim.player.flames, lit: sim.lanterns.filter((l) => l.lit).length }));
if (outFile) writeFileSync(outFile, JSON.stringify({ frames }));
