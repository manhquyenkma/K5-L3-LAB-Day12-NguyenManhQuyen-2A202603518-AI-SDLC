// Bot tham lam (v1.1): chứng minh Đêm 1 thắng được với số liệu chuẩn TICKET-02, và ghi inputs để phát lại qua headless.
// Dùng: node scripts/bot.mjs [seed] [inputs-out.json]
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/sim.js';
import { TUNING as T } from '../src/tuning.js';

const seed = Number(process.argv[2] ?? 1);
const outFile = process.argv[3];
const sim = new Sim({ seed, night: 1 });
const frames = [];
let prev = { move: [0, 0], interact: false, pulse: false, dash: false };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (let k = 0; k < 18000 && sim.state === 'playing'; k++) {
  const p = sim.player;
  const near = sim.shades
    .filter((z) => z.state !== 'stunned' && z.state !== 'spawning' && z.state !== 'recoil')
    .sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
  let target = null, interact = false, pulse = false, dash = false;
  const unlit = sim.lanterns.filter((l) => !l.lit).sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos));

  if (near && dist(p.pos, near.pos) < 4.2 && p.carried >= T.pulse_cost && p.pulseCd === 0) pulse = !prev.pulse;
  if (p.carried >= T.carry_capacity || (p.carried > 0 && unlit.length > 0 && p.carried >= T.lantern_cost - unlit[0].deposited) || (p.carried > 0 && sim.motes.length === 0)) {
    const L = unlit[0];
    target = L.pos;
    if (dist(p.pos, L.pos) <= T.interact_radius - 0.15) interact = !prev.interact;
  } else {
    const m = sim.motes.slice().sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
    target = m ? m.pos : unlit[0].pos;
  }
  let move = [0, 0];
  if (target && !interact) {
    let dx = target[0] - p.pos[0], dz = target[2] - p.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 0.05) { dx /= d; dz /= d; } else { dx = 0; dz = 0; }
    // Né Bóng Mực đang đuổi ở cự ly gần (< 7 m)
    for (const z of sim.shades) {
      if (z.state === 'stunned' || z.state === 'spawning' || z.state === 'recoil') continue;
      const sx = p.pos[0] - z.pos[0], sz = p.pos[2] - z.pos[2], sd = Math.hypot(sx, sz);
      if (sd > 0.01 && sd < 7) {
        const w = (7 - sd) / 3;
        dx += (sx / sd) * w;
        dz += (sz / sd) * w;
      }
    }
    // Giữ cách mép đảo 3 m để không rơi biển mây
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > 36) { dx -= (p.pos[0] / pr) * 2; dz -= (p.pos[2] / pr) * 2; }
    const ml = Math.hypot(dx, dz);
    if (ml > 0.05) {
      move = [Math.round((dx / ml) * 1e3) / 1e3, Math.round((dz / ml) * 1e3) / 1e3];
      if ((d > 8 || (near && dist(p.pos, near.pos) < 3.5)) && p.dashCd === 0 && p.dashTicks === 0 && Math.hypot(p.pos[0] + (dx / ml) * 4, p.pos[2] + (dz / ml) * 4) < 36) {
        dash = !prev.dash;
      }
    }
  }
  const cur = { move, interact, pulse, dash };
  const f = { tick: k };
  if (move[0] !== prev.move[0] || move[1] !== prev.move[1]) f.move = move;
  if (cur.interact !== prev.interact) f.interact = cur.interact;
  if (cur.pulse !== prev.pulse) f.pulse = cur.pulse;
  if (cur.dash !== prev.dash) f.dash = cur.dash;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = cur;
  sim.step({ move, interact, pulse, dash });
  sim.drainEvents();
}
console.log(JSON.stringify({ seed, night: 1, state: sim.state, ticks: sim.tick, score: sim.score, flames: sim.player.flames, lit: sim.lanterns.filter((l) => l.lit).length }));
if (outFile) writeFileSync(outFile, JSON.stringify({ frames }));
