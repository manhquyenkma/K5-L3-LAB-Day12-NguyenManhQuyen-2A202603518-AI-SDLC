// Máy trạng thái 6 trạng thái cho Bóng Mực (Phase 3 / Contract v1.2, thuần JS).
// Trạng thái bắt buộc: spawning, wander, chase, recoil, stunned, drain.
import { TUNING as T, EXTRA as X } from '../tuning.js';
import { resolveHorizontalMove, moveOnWalkable } from '../terrain.js';

const VALID_STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
const LOW_FUEL_U = Math.round(T.low_fuel_threshold * 60);

const d2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function createShade({ id, pos, state = 'spawning', stateTicks = null, targetLanternId = null, rng }) {
  const st = VALID_STATES.has(state) ? state : 'wander';
  let ticksLeft = stateTicks;
  if (ticksLeft === null || ticksLeft === undefined) {
    if (st === 'spawning') ticksLeft = 1;
    else if (st === 'stunned') ticksLeft = Math.round(T.pulse_stun_s * 60);
    else if (st === 'recoil') ticksLeft = X.shade_recoil_ticks;
    else ticksLeft = 0;
  }
  const ang = rng ? rng() * Math.PI * 2 : 0;
  return {
    id,
    pos: pos.slice(),
    state: st,
    stateTicks: ticksLeft,
    targetLanternId: targetLanternId || null,
    drainTickCount: 0,
    pushTicks: 0,
    pushDx: 0,
    pushDz: 0,
    recoilDx: 0,
    recoilDz: 0,
    expelTicks: 0,
    expelLantern: null,
    wanderDirX: Math.cos(ang),
    wanderDirZ: Math.sin(ang),
    wanderTurnTicks: 120,
  };
}

export function tickShadeTimers(z) {
  if (z.state === 'spawning') {
    z.stateTicks--;
    if (z.stateTicks <= 0) {
      z.state = 'wander';
      z.stateTicks = 0;
    }
  } else if (z.state === 'stunned') {
    z.stateTicks--;
    if (z.stateTicks <= 0) {
      z.state = 'wander';
      z.stateTicks = 0;
      z.pushTicks = 0;
    }
  } else if (z.state === 'recoil') {
    z.stateTicks--;
    if (z.stateTicks <= 0) {
      z.state = 'wander';
      z.stateTicks = 0;
      z.recoilDx = 0;
      z.recoilDz = 0;
    }
  }
}

export function stunShade(z, px, pz, stunTicks) {
  z.state = 'stunned';
  z.stateTicks = stunTicks;
  z.targetLanternId = null;
  z.drainTickCount = 0;
  let ex = z.pos[0] - px;
  let ez = z.pos[2] - pz;
  const e = Math.hypot(ex, ez);
  if (e < 1e-9) { ex = 1; ez = 0; } else { ex /= e; ez /= e; }
  z.pushTicks = X.pulse_push_ticks;
  z.pushDx = (ex * T.pulse_push_m) / X.pulse_push_ticks;
  z.pushDz = (ez * T.pulse_push_m) / X.pulse_push_ticks;
}

export function triggerShadeRecoil(z, px, pz) {
  z.state = 'recoil';
  z.stateTicks = X.shade_recoil_ticks;
  z.targetLanternId = null;
  z.drainTickCount = 0;
  let ex = z.pos[0] - px;
  let ez = z.pos[2] - pz;
  const e = Math.hypot(ex, ez);
  if (e < 1e-9) { ex = 1; ez = 0; } else { ex /= e; ez /= e; }
  z.recoilDx = (ex * X.shade_recoil_m) / X.shade_recoil_ticks;
  z.recoilDz = (ez * X.shade_recoil_m) / X.shade_recoil_ticks;
}

function findNearestLantern(lanterns, x, z, predicate) {
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < lanterns.length; i++) {
    const L = lanterns[i];
    if (!predicate(L)) continue;
    const d = d2(x, z, L.pos[0], L.pos[2]);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && L.id < best.id)) {
      best = L;
      bd = d;
    }
  }
  return best;
}

export function stepShade(z, sim, dt) {
  if (z.expelTicks > 0 || z.state === 'spawning') return;
  const p = sim.player;
  const groundY = z.pos[1] - X.shade_height;

  if (z.state === 'stunned') {
    if (z.pushTicks > 0) {
      resolveHorizontalMove(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + z.pushDx, z.pos[2] + z.pushDz, groundY, sim._moveTmp);
      z.pos[0] = sim._moveTmp.x;
      z.pos[2] = sim._moveTmp.z;
      sim._repel(z.pos);
      if (sim._moveTmp.blocked) z.pushTicks = 0;
      else z.pushTicks--;
    }
    return;
  }

  if (z.state === 'recoil') {
    moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + z.recoilDx, z.pos[2] + z.recoilDz, groundY, sim._moveTmp);
    z.pos[0] = sim._moveTmp.x;
    z.pos[2] = sim._moveTmp.z;
    sim._repel(z.pos);
    return;
  }

  const dx = p.pos[0] - z.pos[0];
  const dz = p.pos[2] - z.pos[2];
  const distToPlayer = Math.hypot(dx, dz);

  // Trạng thái drain: đứng yên hút dầu, kiểm tra điều kiện thoát mỗi tick
  if (z.state === 'drain') {
    if (p.respawnTicks === 0 && distToPlayer <= X.shade_drain_alert_r) {
      z.state = 'chase';
      z.targetLanternId = null;
      z.drainTickCount = 0;
    } else {
      const L = z.targetLanternId ? sim.lanterns.find((x) => x.id === z.targetLanternId) : null;
      if (!L || !L.lit || L.fuelU >= LOW_FUEL_U || d2(z.pos[0], z.pos[2], L.pos[0], L.pos[2]) > X.shade_drain_r) {
        z.state = 'wander';
        z.targetLanternId = null;
        z.drainTickCount = 0;
      } else {
        return; // tiếp tục đứng yên hút dầu
      }
    }
  }

  // Chuyển đổi giữa wander và chase (12 m phát hiện / 18 m bỏ đuổi). Bóng đang chase KHÔNG đổi mục tiêu sang đèn yếu.
  if (z.state === 'wander') {
    if (!sim.benchMode && p.respawnTicks === 0 && distToPlayer <= X.shade_detect_r) {
      z.state = 'chase';
      z.targetLanternId = null;
      z.drainTickCount = 0;
    }
  } else if (z.state === 'chase') {
    if (p.respawnTicks > 0 || distToPlayer > X.shade_leash_r) {
      z.state = 'wander';
    }
  }

  if (z.state === 'chase') {
    if (distToPlayer > 1e-9) {
      const st = Math.min(sim.nightCfg.shadeSpeed * dt, distToPlayer);
      moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + (dx / distToPlayer) * st, z.pos[2] + (dz / distToPlayer) * st, groundY, sim._moveTmp);
      z.pos[0] = sim._moveTmp.x;
      z.pos[2] = sim._moveTmp.z;
      z.pos[1] = sim._moveTmp.y + X.shade_height;
    }
    sim._repel(z.pos);
    return;
  }

  // Trạng thái wander: ưu tiên chọn đèn sáng có fuel < 30 gần nhất (bằng nhau chọn id nhỏ hơn)
  let weak = null;
  if (z.targetLanternId) {
    const fixed = sim.lanterns.find((L) => L.id === z.targetLanternId);
    if (fixed && fixed.lit && fixed.fuelU < LOW_FUEL_U) weak = fixed;
    else z.targetLanternId = null;
  }
  if (!weak) {
    weak = findNearestLantern(sim.lanterns, z.pos[0], z.pos[2], (L) => L.lit && L.fuelU < LOW_FUEL_U);
  }
  if (weak) {
    const dl = d2(z.pos[0], z.pos[2], weak.pos[0], weak.pos[2]);
    if (dl <= X.shade_drain_r) {
      z.state = 'drain';
      z.targetLanternId = weak.id;
      z.drainTickCount = 0;
      return;
    }
    const st = Math.min(sim.nightCfg.shadeSpeed * dt, dl);
    const ux = (weak.pos[0] - z.pos[0]) / dl;
    const uz = (weak.pos[2] - z.pos[2]) / dl;
    moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + ux * st, z.pos[2] + uz * st, groundY, sim._moveTmp);
    z.pos[0] = sim._moveTmp.x;
    z.pos[2] = sim._moveTmp.z;
    z.pos[1] = sim._moveTmp.y + X.shade_height;
    sim._repel(z.pos);
    if (d2(z.pos[0], z.pos[2], weak.pos[0], weak.pos[2]) <= X.shade_drain_r) {
      z.state = 'drain';
      z.targetLanternId = weak.id;
      z.drainTickCount = 0;
    }
    return;
  }

  // Không có đèn yếu -> đi về đèn tắt gần nhất (trong benchMode lượn tự do khắp đảo để giữ 200 bóng rải đều)
  const unlit = sim.benchMode ? null : findNearestLantern(sim.lanterns, z.pos[0], z.pos[2], (L) => !L.lit);
  if (unlit) {
    const dl = d2(z.pos[0], z.pos[2], unlit.pos[0], unlit.pos[2]);
    if (dl > 1.5) {
      const wst = Math.min(X.shade_wander_speed * dt, dl);
      moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + ((unlit.pos[0] - z.pos[0]) / dl) * wst, z.pos[2] + ((unlit.pos[2] - z.pos[2]) / dl) * wst, groundY, sim._moveTmp);
      z.pos[0] = sim._moveTmp.x;
      z.pos[2] = sim._moveTmp.z;
      z.pos[1] = sim._moveTmp.y + X.shade_height;
      sim._repel(z.pos);
      return;
    }
  }

  z.wanderTurnTicks--;
  if (z.wanderTurnTicks <= 0) {
    const ang = sim.rng() * Math.PI * 2;
    z.wanderDirX = Math.cos(ang);
    z.wanderDirZ = Math.sin(ang);
    z.wanderTurnTicks = 120;
  }
  const wst = X.shade_wander_speed * dt;
  moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + z.wanderDirX * wst, z.pos[2] + z.wanderDirZ * wst, groundY, sim._moveTmp);
  z.pos[0] = sim._moveTmp.x;
  z.pos[2] = sim._moveTmp.z;
  z.pos[1] = sim._moveTmp.y + X.shade_height;
  if (sim._moveTmp.blocked) {
    const ang = sim.rng() * Math.PI * 2;
    z.wanderDirX = Math.cos(ang);
    z.wanderDirZ = Math.sin(ang);
    z.wanderTurnTicks = 60;
  }
  sim._repel(z.pos);
}

export function compareShadeId(a, b) {
  const ma = /^S(\d+)$/.exec(a.id);
  const mb = /^S(\d+)$/.exec(b.id);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
