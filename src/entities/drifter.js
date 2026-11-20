// Máy trạng thái Gió Lạc (Đêm 2 & 3, thuần JS, không Math.random/DOM/I/O).
// Trạng thái: idle -> chase -> flee -> removed.
import { EXTRA as X } from '../tuning.js';

export function createDrifter({ id, pos, state = 'idle', stolen = 0, fleeTicks = null, spawnTick = -1, rng }) {
  const ang = rng ? rng() * Math.PI * 2 : 0;
  return {
    id,
    pos: pos.slice(),
    state,
    stolen,
    hasStolen: state === 'flee' || state === 'removed' || stolen > 0,
    fleeTicks: state === 'flee' ? (fleeTicks ?? X.drifter_flee_ticks) : 0,
    spawnTick,
    idleDirX: Math.cos(ang),
    idleDirZ: Math.sin(ang),
    idleTurnTicks: 90,
  };
}

export function tickDrifterTimers(d) {
  if (d.state === 'flee') {
    d.fleeTicks--;
    if (d.fleeTicks <= 0) {
      d.state = 'removed';
      d.fleeTicks = 0;
    }
  }
}

export function stepDrifter(d, sim, dt) {
  if (d.state === 'removed' || d.spawnTick >= sim.simTick) return;
  const p = sim.player;
  const dx = p.pos[0] - d.pos[0];
  const dz = p.pos[2] - d.pos[2];
  const dist = Math.hypot(dx, dz);

  if (d.state === 'flee') {
    // Bay ra xa Mây với tốc độ 7 m/s (không bị vùng an toàn chặn)
    let fx = -dx;
    let fz = -dz;
    const fl = Math.hypot(fx, fz);
    if (fl < 1e-9) { fx = 1; fz = 0; } else { fx /= fl; fz /= fl; }
    d.pos[0] += fx * X.drifter_fast_speed * dt;
    d.pos[2] += fz * X.drifter_fast_speed * dt;
    return;
  }

  // Kiểm tra chuyển đổi idle <-> chase mỗi tick
  const canChase = !d.hasStolen && p.respawnTicks === 0 && p.carried >= X.drifter_trigger_carried && dist <= X.drifter_trigger_r;
  if (d.state === 'idle' && canChase) {
    d.state = 'chase';
  } else if (d.state === 'chase' && !canChase) {
    d.state = 'idle';
  }

  if (d.state === 'chase') {
    if (dist > 1e-9) {
      const st = Math.min(X.drifter_fast_speed * dt, dist);
      d.pos[0] += (dx / dist) * st;
      d.pos[2] += (dz / dist) * st;
    }
    return;
  }

  // Trạng thái idle: lượn chậm 2 m/s
  d.idleTurnTicks--;
  if (d.idleTurnTicks <= 0) {
    const ang = sim.rng() * Math.PI * 2;
    d.idleDirX = Math.cos(ang);
    d.idleDirZ = Math.sin(ang);
    d.idleTurnTicks = 90;
  }
  d.pos[0] += d.idleDirX * X.drifter_idle_speed * dt;
  d.pos[2] += d.idleDirZ * X.drifter_idle_speed * dt;
}
