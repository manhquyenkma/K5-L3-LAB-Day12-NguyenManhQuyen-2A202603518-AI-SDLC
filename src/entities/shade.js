// Máy trạng thái 5 trạng thái cho Bóng Mực (thuần JS, không Math.random/DOM/I/O).
// Trạng thái bắt buộc v1.1: spawning, wander, chase, recoil, stunned.
import { TUNING as T, EXTRA as X } from '../tuning.js';
import { resolveHorizontalMove, moveOnWalkable } from '../terrain.js';

const VALID_STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned']);

export function createShade({ id, pos, state = 'spawning', stateTicks = null, rng }) {
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
  let ex = z.pos[0] - px;
  let ez = z.pos[2] - pz;
  const e = Math.hypot(ex, ez);
  if (e < 1e-9) { ex = 1; ez = 0; } else { ex /= e; ez /= e; }
  z.recoilDx = (ex * X.shade_recoil_m) / X.shade_recoil_ticks;
  z.recoilDz = (ez * X.shade_recoil_m) / X.shade_recoil_ticks;
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
  const dist = Math.hypot(dx, dz);

  // Chuyển đổi giữa wander và chase (12 m phát hiện / 18 m bỏ đuổi)
  if (z.state === 'wander') {
    if (p.respawnTicks === 0 && dist <= X.shade_detect_r) {
      z.state = 'chase';
    }
  } else if (z.state === 'chase') {
    if (p.respawnTicks > 0 || dist > X.shade_leash_r) {
      z.state = 'wander';
    }
  }

  if (z.state === 'chase') {
    if (dist > 1e-9) {
      const st = Math.min(sim.nightCfg.shadeSpeed * dt, dist);
      moveOnWalkable(sim.nightCfg, z.pos[0], z.pos[2], z.pos[0] + (dx / dist) * st, z.pos[2] + (dz / dist) * st, groundY, sim._moveTmp);
      z.pos[0] = sim._moveTmp.x;
      z.pos[2] = sim._moveTmp.z;
      z.pos[1] = sim._moveTmp.y + X.shade_height;
    }
    sim._repel(z.pos);
    return;
  }

  // Trạng thái wander: đi chậm 2 m/s trên mặt đi được, đổi hướng định kỳ hoặc khi gặp cản
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
