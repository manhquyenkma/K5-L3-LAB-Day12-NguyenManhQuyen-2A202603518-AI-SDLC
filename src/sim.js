// Lõi logic Đảo Đèn Lồng (Phase 3, Contract v1.2): thuần JS, không DOM/Date/Math.random/I/O.
// Dùng chung cho chế độ headless (Node) và bản chơi trên trình duyệt.
import { TUNING as T, EXTRA as X } from './tuning.js';
import { getNight } from './nights/index.js';
import { getSupportHeight, resolveHorizontalMove, checkJumpPad } from './terrain.js';
import { createShade, tickShadeTimers, stunShade, triggerShadeRecoil, stepShade, compareShadeId } from './entities/shade.js';
import { createDrifter, tickDrifterTimers, stepDrifter } from './entities/drifter.js';

export const DT = 1 / 60;
export const TPS = 60;

// Đơn vị nhiên liệu nguyên 1/60 để tránh sai số dấu phẩy động (TICKET-03 Phần 1).
const FUEL_SCALE = TPS;
const FUEL_MAX_U = Math.round(T.fuel_max * FUEL_SCALE);          // 6000 = 100.0
const LOW_FUEL_U = Math.round(T.low_fuel_threshold * FUEL_SCALE); // 1800 = 30.0
const FUEL_PER_MOTE_U = Math.round(T.fuel_per_mote * FUEL_SCALE); // 600  = 10.0
const DECAY_PER_TICK_U = Math.round(T.fuel_decay_per_s);          // 1    = 1/60 mỗi tick
const DRAIN_PER_TICK_U = Math.round(T.drain_per_s);               // 5    = 5/60 mỗi tick

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // +0: đổi -0 thành 0
export const r1 = (v) => Math.round(v * 10) / 10 + 0;
const ticks = (s) => Math.round(s * TPS);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]); // khoảng cách mặt phẳng XZ

function defaultLanterns(nightCfg) {
  return nightCfg.lanterns.map((L) => ({
    id: L.id,
    pos: L.pos.slice(),
    lit: false,
    deposited: 0,
    fuelU: 0,
    everLit: false,
    relitCount: 0,
  }));
}

export class Sim {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    const sc = scenario || {};
    this.nightId = night;
    this.nightCfg = getNight(night);
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.t0 = sc.time_left_s ?? this.nightCfg.duration_s;
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;
    this.randomDrifters = sc.random_drifters !== false && this.nightCfg.driftersEnabled;
    this.windEnabled = sc.wind_enabled !== undefined ? !!sc.wind_enabled : this.nightCfg.windEnabled;

    const sp = this.nightCfg.spawn;
    this.player = {
      pos: sp.slice(),
      vel: [0, 0, 0],
      facing: this.nightCfg.facing.slice(),
      grounded: true,
      carried: 0,
      successfulLights: 0,
      flames: T.flames,
      invuln: 0,
      pulseCd: 0,
      dashCd: 0,
      dashTicks: 0,
      dashDir: this.nightCfg.facing.slice(),
      padLocked: false,
      respawnTicks: 0,
      charmTicks: 0,
    };

    // Gió mạnh Đêm 3
    this.wind = { active: false, dir_deg: 0, ticksLeft: 0, warnTicks: 0, nextTick: X.wind_interval_ticks };

    this.lanterns = defaultLanterns(this.nightCfg);
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = [];
    this.nextMote = 1;
    this.nextShade = 1;
    this.nextDrifter = 1;
    this.nextShadeTick = X.shade_first_spawn_ticks;
    this.nextMoteTick = X.mote_respawn_ticks;
    this.nextDrifterTick = X.drifter_spawn_interval_ticks;
    this._moveTmp = { x: 0, z: 0, y: 0, blocked: false };

    if (sc.player) {
      if (sc.player.pos) this.player.pos = sc.player.pos.slice();
      if (sc.player.carried !== undefined) this.player.carried = sc.player.carried;
      if (sc.player.successful_lights !== undefined) this.player.successfulLights = sc.player.successful_lights;
      if (sc.player.flames !== undefined) this.player.flames = sc.player.flames;
      if (sc.player.invuln_ticks !== undefined) this.player.invuln = sc.player.invuln_ticks;
      if (sc.player.dash_cd_ticks !== undefined) this.player.dashCd = sc.player.dash_cd_ticks;
      if (sc.player.pulse_cd_ticks !== undefined) this.player.pulseCd = sc.player.pulse_cd_ticks;
      if (sc.player.charm_ticks !== undefined) this.player.charmTicks = sc.player.charm_ticks;
    }
    const initSupport = getSupportHeight(this.nightCfg, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
    this.player.grounded = initSupport !== null && Math.abs(this.player.pos[1] - initSupport) <= 0.15;

    for (const l of sc.lanterns || []) {
      let L = this.lanterns.find((x) => x.id === l.id);
      if (!L) {
        L = { id: l.id, pos: l.pos.slice(), lit: false, deposited: 0, fuelU: 0, everLit: false, relitCount: 0 };
        this.lanterns.push(L);
      }
      if (l.pos) L.pos = l.pos.slice();
      if (l.deposited !== undefined) L.deposited = l.deposited;
      if (l.lit !== undefined) L.lit = l.lit;
      if (l.ever_lit !== undefined) L.everLit = l.ever_lit;
      else if (L.lit) L.everLit = true;
      if (L.lit) {
        const f = l.fuel !== undefined ? l.fuel : T.fuel_max;
        L.fuelU = Math.max(0, Math.min(FUEL_MAX_U, Math.round(f * FUEL_SCALE)));
      } else {
        L.fuelU = 0;
      }
    }
    if (sc.motes !== undefined) {
      for (const p of sc.motes) this.motes.push({ id: 'M' + this.nextMote++, pos: p.slice(), kind: 'random', ttl: 0, spawnTick: -1 });
    } else if (this.randomMotes) {
      for (let i = 0; i < X.initial_motes; i++) this._spawnMote(null, true);
    }
    if (sc.shades !== undefined) {
      for (const s of sc.shades) {
        let id = s.id;
        if (id === undefined) {
          while (this.shades.some((z) => z.id === 'S' + this.nextShade)) this.nextShade++;
          id = 'S' + this.nextShade++;
        }
        const defaultState = s.state ?? (d2(this.player.pos, s.pos) <= X.shade_detect_r ? 'chase' : 'wander');
        let targetId = s.target_lantern_id || null;
        if (defaultState === 'drain' && !targetId) {
          let best = null, bd = Infinity;
          for (const L of this.lanterns) {
            if (!L.lit || L.fuelU >= LOW_FUEL_U) continue;
            const d = d2(s.pos, L.pos);
            if (d <= X.shade_drain_r && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && L.id < best.id))) {
              best = L; bd = d;
            }
          }
          if (best) targetId = best.id;
        }
        this.shades.push(createShade({
          id,
          pos: s.pos,
          state: defaultState,
          stateTicks: s.state_ticks_left,
          targetLanternId: targetId,
          rng: this.rng,
        }));
      }
      while (this.shades.some((z) => z.id === 'S' + this.nextShade)) this.nextShade++;
    }
    if (sc.drifters !== undefined) {
      for (const d of sc.drifters) {
        let id = d.id;
        if (id === undefined) {
          while (this.drifters.some((x) => x.id === 'D' + this.nextDrifter)) this.nextDrifter++;
          id = 'D' + this.nextDrifter++;
        }
        this.drifters.push(createDrifter({
          id,
          pos: d.pos,
          state: d.state || 'idle',
          stolen: d.stolen || 0,
          fleeTicks: d.state_ticks_left,
          spawnTick: -1,
          rng: this.rng,
        }));
      }
      while (this.drifters.some((x) => x.id === 'D' + this.nextDrifter)) this.nextDrifter++;
    }
    const charmList = sc.charms !== undefined ? sc.charms : this.nightCfg.charms;
    for (let i = 0; i < charmList.length; i++) {
      const c = charmList[i];
      this.charms.push({
        id: c.id || ('C' + (i + 1)),
        pos: c.pos.slice(),
        available: c.available !== false,
        respawnTicks: c.respawn_ticks || 0,
      });
    }
    this._emit('night_start', { night: this.nightId });
  }

  get timeLeft() {
    return this.t0 - this.simTick / TPS;
  }

  get playerCapacity() {
    return Math.min(T.capacity_max, T.carry_capacity + X.capacity_per_light * this.player.successfulLights);
  }

  _emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  _spawnMote(near = null, initial = false) {
    let pos;
    if (near) {
      const ang = this.rng() * Math.PI * 2;
      const dist = X.dropped_mote_min_r + this.rng() * (X.dropped_mote_max_r - X.dropped_mote_min_r);
      pos = [near[0] + Math.cos(ang) * dist, near[1], near[2] + Math.sin(ang) * dist];
      const h = getSupportHeight(this.nightCfg, pos[0], pos[2], near[1]);
      if (h !== null) pos[1] = h;
      this.motes.push({ id: 'M' + this.nextMote++, pos: [r3(pos[0]), r3(pos[1]), r3(pos[2])], kind: 'dropped', ttl: X.dropped_mote_ttl_ticks, spawnTick: this.simTick });
      return;
    }
    const pts = this.nightCfg.moteSpawns;
    const free = [];
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      let used = false;
      for (let j = 0; j < this.motes.length; j++) {
        if (d2(this.motes[j].pos, pt) < 0.5 && Math.abs(this.motes[j].pos[1] - pt[1]) < 0.5) { used = true; break; }
      }
      if (!used) free.push(pt);
    }
    if (free.length === 0) return;
    const chosen = free[Math.floor(this.rng() * free.length)];
    this.motes.push({ id: 'M' + this.nextMote++, pos: [r3(chosen[0]), r3(chosen[1]), r3(chosen[2])], kind: 'random', ttl: 0, spawnTick: initial ? -1 : this.simTick });
  }

  _spawnMoteAt(pos) {
    this.motes.push({
      id: 'M' + this.nextMote++,
      pos: [r3(pos[0]), r3(pos[1]), r3(pos[2])],
      kind: 'dropped',
      ttl: X.dropped_mote_ttl_ticks,
      spawnTick: this.simTick,
    });
  }

  _spawnDrifter() {
    const pts = this.nightCfg.shadeSpawns;
    if (pts.length === 0) return;
    const pt = pts[Math.floor(this.rng() * pts.length)];
    const id = 'D' + this.nextDrifter++;
    this.drifters.push(createDrifter({
      id,
      pos: [r3(pt[0]), r3(pt[1] + 1.2), r3(pt[2])],
      state: 'idle',
      spawnTick: this.simTick,
      rng: this.rng,
    }));
  }

  _spawnShade() {
    const pts = this.nightCfg.shadeSpawns;
    const valid = [];
    for (let i = 0; i < pts.length; i++) {
      if (d2(pts[i], this.player.pos) >= X.shade_spawn_min_dist) valid.push(pts[i]);
    }
    if (valid.length === 0) return;
    const pt = valid[Math.floor(this.rng() * valid.length)];
    const id = 'S' + this.nextShade++;
    this.shades.push(createShade({
      id,
      pos: [r3(pt[0]), r3(pt[1] + X.shade_height), r3(pt[2])],
      state: 'spawning',
      stateTicks: 1,
      rng: this.rng,
    }));
    this._emit('shade_spawned', { id });
  }

  // Vùng an toàn: chỉ đèn đang sáng VÀ fuel >= 30 (fuelU >= 1800). Đèn fuel < 30 mất vùng an toàn!
  _repel(pos) {
    for (let i = 0; i < this.lanterns.length; i++) {
      const L = this.lanterns[i];
      if (!L.lit || L.fuelU < LOW_FUEL_U) continue;
      let dx = pos[0] - L.pos[0], dz = pos[2] - L.pos[2];
      let d = Math.hypot(dx, dz);
      if (d < T.safe_radius + 0.001) {
        if (d < 1e-9) { dx = 1; dz = 0; d = 1; }
        const k = (T.safe_radius + 0.001) / d;
        pos[0] = L.pos[0] + dx * k;
        pos[2] = L.pos[2] + dz * k;
      }
    }
  }

  _expelShadesAround(L) {
    for (let i = 0; i < this.shades.length; i++) {
      const z = this.shades[i];
      if (d2(z.pos, L.pos) < T.safe_radius) {
        z.expelTicks = X.safe_expel_max_ticks;
        z.expelLantern = L;
        if (z.state === 'drain') {
          z.state = 'wander';
          z.targetLanternId = null;
          z.drainTickCount = 0;
        }
      }
    }
  }

  _updateWind() {
    if (!this.windEnabled) return;
    const w = this.wind;
    if (w.active) {
      w.ticksLeft--;
      if (w.ticksLeft <= 0) {
        w.active = false;
        w.ticksLeft = 0;
        w.nextTick = this.simTick + X.wind_interval_ticks - X.wind_duration_ticks;
      }
    } else {
      if (this.simTick === w.nextTick - X.wind_warn_ticks) {
        w.dir_deg = Math.floor(this.rng() * 360);
        w.warnTicks = X.wind_warn_ticks;
      }
      if (w.warnTicks > 0) w.warnTicks--;
      if (this.simTick >= w.nextTick) {
        if (w.warnTicks === 0 && this.simTick === w.nextTick && w.dir_deg === 0 && this.simTick < X.wind_warn_ticks) {
          w.dir_deg = Math.floor(this.rng() * 360);
        }
        w.active = true;
        w.ticksLeft = X.wind_duration_ticks;
      }
    }
  }

  step(inp = {}) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.tick++;

    // Bước 1: Đọc input — xử lý pause trước; vừa tạm dừng thì dừng bước tại đây
    const pauseEdge = !!inp.pause && !this.prev.pause;
    if (this.state === 'playing' && pauseEdge) {
      this.prev.pause = true;
      this.state = 'paused';
      this._emit('paused', {});
      return;
    }
    if (this.state === 'paused') {
      this.prev.pause = !!inp.pause;
      if (pauseEdge) {
        this.state = 'playing';
        this._emit('resumed', {});
      } else {
        return;
      }
    }

    this.simTick++;
    const p = this.player;

    const jumpEdge = !!inp.jump && !this.prev.jump;
    const interactEdge = !!inp.interact && !this.prev.interact;
    const pulseEdge = !!inp.pulse && !this.prev.pulse;
    const dashEdge = !!inp.dash && !this.prev.dash;
    this.prev = { jump: !!inp.jump, interact: !!inp.interact, pulse: !!inp.pulse, dash: !!inp.dash, pause: !!inp.pause };

    // Bước 2: Giảm các bộ đếm + trừ dầu đèn (hao tự nhiên 1/60 + Bóng Mực hút 5/60) -> ngay sau đó tắt đèn có fuel <= 0
    if (p.invuln > 0) p.invuln--;
    if (p.pulseCd > 0) p.pulseCd--;
    if (p.dashCd > 0) p.dashCd--;
    if (p.charmTicks > 0) p.charmTicks--;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.kind === 'dropped') {
        m.ttl--;
        if (m.ttl <= 0) this.motes.splice(i, 1);
      }
    }
    for (let i = 0; i < this.shades.length; i++) {
      tickShadeTimers(this.shades[i]);
    }
    for (let i = 0; i < this.drifters.length; i++) {
      tickDrifterTimers(this.drifters[i]);
    }
    for (let i = 0; i < this.charms.length; i++) {
      const c = this.charms[i];
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks--;
        if (c.respawnTicks <= 0) {
          c.respawnTicks = 0;
          c.available = true;
        }
      }
    }

    // Hao dầu tự nhiên 1/60 mỗi tick cho đèn đang sáng
    for (let i = 0; i < this.lanterns.length; i++) {
      const L = this.lanterns[i];
      if (L.lit) L.fuelU -= DECAY_PER_TICK_U;
    }
    // Bóng Mực đang ở trạng thái drain hút 5/60 mỗi tick (cộng dồn nhiều con, xét theo id tăng dần)
    if (this.shades.length > 0) {
      const orderedDrain = this.shades.length > 1 ? this.shades.slice().sort(compareShadeId) : this.shades;
      for (let i = 0; i < orderedDrain.length; i++) {
        const z = orderedDrain[i];
        if (z.state !== 'drain' || !z.targetLanternId) continue;
        const L = this.lanterns.find((x) => x.id === z.targetLanternId);
        if (!L || !L.lit || d2(z.pos, L.pos) > X.shade_drain_r) continue;
        L.fuelU -= DRAIN_PER_TICK_U;
        z.drainTickCount++;
        if (z.drainTickCount % X.shade_drain_event_ticks === 0) {
          this._emit('fuel_drain', { lantern_id: L.id, shade_id: z.id, fuel: r1(Math.max(0, L.fuelU) / FUEL_SCALE) });
        }
      }
    }
    // Ngay sau bước 2: đèn có fuel <= 0 chuyển sang tắt, deposited = 0, nhớ ever_lit = true, phát lantern_out
    for (let i = 0; i < this.lanterns.length; i++) {
      const L = this.lanterns[i];
      if (L.lit && L.fuelU <= 0) {
        L.fuelU = 0;
        L.lit = false;
        L.deposited = 0;
        L.everLit = true;
        this._emit('lantern_out', { lantern_id: L.id });
      }
    }

    if (p.respawnTicks > 0) {
      p.respawnTicks--;
      if (p.respawnTicks === 0) {
        p.pos = this.nightCfg.spawn.slice();
        p.vel = [0, 0, 0];
        p.grounded = true;
        p.padLocked = false;
        p.dashTicks = 0;
        p.invuln = ticks(T.invuln_s);
      }
    }
    this._updateWind();

    // Bước 3: Di chuyển Mây (tăng/giảm tốc, nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi
    if (p.respawnTicks === 0) {
      let [mx, mz] = inp.move || [0, 0];
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const th = ((inp.cam_yaw_deg || 0) * Math.PI) / 180;
      const c = Math.cos(th), s = Math.sin(th);
      const dx = mx * c + mz * s;
      const dz = -mx * s + mz * c;
      const moveLen = Math.hypot(dx, dz);
      if (moveLen > 1e-6) {
        p.facing[0] = dx / moveLen;
        p.facing[1] = dz / moveLen;
      }

      if (dashEdge && p.dashTicks === 0 && p.dashCd === 0) {
        p.dashTicks = ticks(T.dash_duration_s);
        p.dashCd = p.charmTicks > 0 ? 0 : ticks(T.dash_cooldown_s);
        p.dashDir[0] = moveLen > 1e-6 ? dx / moveLen : p.facing[0];
        p.dashDir[1] = moveLen > 1e-6 ? dz / moveLen : p.facing[1];
        p.padLocked = false;
        p.vel[1] = 0;
        this._emit('dash', {});
      }

      if (jumpEdge && p.grounded && p.dashTicks === 0) {
        p.vel[1] = X.jump_speed;
        p.grounded = false;
      }

      if (p.dashTicks > 0) {
        p.vel[0] = p.dashDir[0] * T.dash_speed;
        p.vel[2] = p.dashDir[1] * T.dash_speed;
        p.vel[1] = 0;
      } else if (!p.padLocked) {
        const maxSpeed = p.charmTicks > 0 ? X.charm_speed : T.player_speed;
        const accel = maxSpeed * 10;
        const tvx = dx * maxSpeed;
        const tvz = dz * maxSpeed;
        const dvx = tvx - p.vel[0];
        const dvz = tvz - p.vel[2];
        const dv = Math.hypot(dvx, dvz);
        const stepV = accel * DT;
        if (dv <= stepV) {
          p.vel[0] = tvx;
          p.vel[2] = tvz;
        } else {
          p.vel[0] += (dvx / dv) * stepV;
          p.vel[2] += (dvz / dv) * stepV;
        }
      }

      let wvx = 0, wvz = 0;
      if (this.wind.active) {
        const wr = (this.wind.dir_deg * Math.PI) / 180;
        wvx = Math.cos(wr) * X.wind_push_speed;
        wvz = Math.sin(wr) * X.wind_push_speed;
      }

      const nx = p.pos[0] + (p.vel[0] + wvx) * DT;
      const nz = p.pos[2] + (p.vel[2] + wvz) * DT;
      resolveHorizontalMove(this.nightCfg, p.pos[0], p.pos[2], nx, nz, p.pos[1], this._moveTmp);
      p.pos[0] = this._moveTmp.x;
      p.pos[2] = this._moveTmp.z;

      if (p.dashTicks > 0) {
        p.dashTicks--;
        const sup = getSupportHeight(this.nightCfg, p.pos[0], p.pos[2], p.pos[1]);
        p.grounded = sup !== null && Math.abs(p.pos[1] - sup) <= 0.15;
        if (p.dashTicks === 0) {
          const maxSpeed = p.charmTicks > 0 ? X.charm_speed : T.player_speed;
          const spNow = Math.hypot(p.vel[0], p.vel[2]);
          if (spNow > maxSpeed) {
            p.vel[0] = (p.vel[0] / spNow) * maxSpeed;
            p.vel[2] = (p.vel[2] / spNow) * maxSpeed;
          }
        }
      } else {
        if (!p.grounded) p.vel[1] -= X.gravity * DT;
        const nextY = p.pos[1] + p.vel[1] * DT;
        const sup = getSupportHeight(this.nightCfg, p.pos[0], p.pos[2], p.pos[1]);
        if (sup !== null && nextY <= sup + 1e-6 && p.vel[1] <= 0) {
          p.pos[1] = sup;
          p.vel[1] = 0;
          p.grounded = true;
          p.padLocked = false;
        } else if (p.grounded && sup !== null && Math.abs(sup - p.pos[1]) <= 0.38) {
          p.pos[1] = sup;
          p.vel[1] = 0;
          p.grounded = true;
        } else {
          p.pos[1] = nextY;
          p.grounded = false;
        }
      }

      if (p.dashTicks === 0 && !p.padLocked) {
        const pad = checkJumpPad(this.nightCfg, p.pos[0], p.pos[1], p.pos[2]);
        if (pad) {
          let ux, uz;
          if (pad.dir) {
            ux = pad.dir[0];
            uz = pad.dir[1];
          } else {
            const tx = pad.target[0] - pad.pos[0];
            const tz = pad.target[2] - pad.pos[2];
            const td = Math.hypot(tx, tz) || 1;
            ux = tx / td;
            uz = tz / td;
          }
          p.vel[0] = ux * pad.vh;
          p.vel[1] = pad.vy;
          p.vel[2] = uz * pad.vh;
          p.grounded = false;
          p.padLocked = true;
        }
      }

      if (T.fall_enabled && p.pos[1] < X.fall_y) {
        const lost = p.carried;
        p.carried = 0;
        p.flames--;
        p.vel[0] = 0;
        p.vel[1] = 0;
        p.vel[2] = 0;
        p.dashTicks = 0;
        p.padLocked = false;
        this._emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
        if (p.flames > 0) p.respawnTicks = X.fall_respawn_ticks;
      }
    }

    // Bước 4: Nhặt đom đóm (sức chứa động 10 + 2*successfulLights, trần 20) và Bùa Gió
    if (p.respawnTicks === 0) {
      const cap = this.playerCapacity;
      for (let i = 0; i < this.motes.length; ) {
        if (p.carried >= cap) break;
        const m = this.motes[i];
        if (m.spawnTick < this.simTick && d2(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= X.pickup_dy) {
          this.motes.splice(i, 1);
          p.carried++;
          this._emit('mote_picked', { carried: p.carried });
        } else {
          i++;
        }
      }
      for (let i = 0; i < this.charms.length; i++) {
        const c = this.charms[i];
        if (c.available && d2(p.pos, c.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= X.pickup_dy) {
          c.available = false;
          c.respawnTicks = X.charm_respawn_ticks;
          p.charmTicks = X.charm_duration_ticks;
          p.dashCd = 0;
          this._emit('charm_picked', { charm_id: c.id, charm_ticks: X.charm_duration_ticks });
        }
      }
    }

    // Bước 5: Tương tác với đèn (chỉ xét đèn nhận được: chưa sáng hoặc sáng nhưng fuel < 100; gần nhất, hòa chọn id nhỏ)
    if (p.respawnTicks === 0 && interactEdge && p.carried > 0) {
      let best = null, bd = Infinity;
      for (let i = 0; i < this.lanterns.length; i++) {
        const L = this.lanterns[i];
        if (L.lit && L.fuelU >= FUEL_MAX_U) continue; // đèn đầy dầu (used = 0) không được chọn
        if (Math.abs(p.pos[1] - L.pos[1]) > X.interact_dy) continue;
        const d = d2(p.pos, L.pos);
        if (d <= T.interact_radius && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && L.id < best.id))) {
          best = L;
          bd = d;
        }
      }
      if (best) {
        if (best.lit) {
          // Châm dầu: used = min(carried, ceil((100 - fuel) / 10))
          const missingU = FUEL_MAX_U - best.fuelU;
          const needed = Math.ceil(missingU / FUEL_PER_MOTE_U);
          const used = Math.min(p.carried, needed);
          if (used > 0) {
            const wasLow = best.fuelU < LOW_FUEL_U;
            p.carried -= used;
            best.fuelU = Math.min(FUEL_MAX_U, best.fuelU + used * FUEL_PER_MOTE_U);
            this.score += used * T.score.per_mote;
            this._emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuelU / FUEL_SCALE) });
            if (wasLow && best.fuelU >= LOW_FUEL_U) this._expelShadesAround(best);
          }
        } else {
          // Nạp đèn tắt (lần đầu cần 10, thắp lại ever_lit cần 5)
          const cost = best.everLit ? T.relight_cost : T.lantern_cost;
          const amount = Math.min(p.carried, cost - best.deposited);
          if (amount > 0) {
            p.carried -= amount;
            best.deposited += amount;
            this.score += amount * T.score.per_mote;
            this._emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          }
          if (best.deposited >= cost) {
            const relight = best.everLit;
            best.lit = true;
            best.fuelU = FUEL_MAX_U;
            best.everLit = true;
            if (relight) best.relitCount++;
            p.successfulLights++;
            this.score += relight ? T.score.per_relight : T.score.per_lantern;
            this._emit('lantern_lit', { lantern_id: best.id, relight });
            this._expelShadesAround(best);
          }
        }
      }
    }

    // Bước 6: Cập nhật vùng an toàn (đẩy Bóng Mực đang bị expel ra mép 6 m trong tối đa 30 tick)
    for (let i = 0; i < this.shades.length; i++) {
      const z = this.shades[i];
      if (z.expelTicks > 0 && z.expelLantern) {
        const L = z.expelLantern;
        if (!L.lit || L.fuelU < LOW_FUEL_U) {
          z.expelTicks = 0;
          z.expelLantern = null;
          continue;
        }
        let dx = z.pos[0] - L.pos[0];
        let dz = z.pos[2] - L.pos[2];
        let d = Math.hypot(dx, dz);
        if (d < 1e-9) { dx = 1; dz = 0; d = 1; }
        const targetR = T.safe_radius + 0.001;
        if (d >= targetR) {
          z.expelTicks = 0;
          z.expelLantern = null;
        } else {
          const stepOut = Math.max((targetR - d) / z.expelTicks, targetR / X.safe_expel_max_ticks);
          const nextD = Math.min(targetR, d + stepOut);
          z.pos[0] = L.pos[0] + (dx / d) * nextD;
          z.pos[2] = L.pos[2] + (dz / d) * nextD;
          z.expelTicks--;
          if (nextD >= targetR - 1e-6 || z.expelTicks <= 0) {
            if (nextD < targetR) {
              z.pos[0] = L.pos[0] + (dx / d) * targetR;
              z.pos[2] = L.pos[2] + (dz / d) * targetR;
            }
            z.expelTicks = 0;
            z.expelLantern = null;
          }
        }
      }
    }

    // Bước 7: Tỏa Sáng (tâm chân + 0.8 m, 3D <= 5 m; +5/con thường, tổng +15 nếu ngay trước đó đang drain)
    if (p.respawnTicks === 0 && pulseEdge && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCd = ticks(T.pulse_cooldown_s);
      const stunned = [];
      const py = p.pos[1] + X.pulse_origin_y;
      for (let i = 0; i < this.shades.length; i++) {
        const z = this.shades[i];
        if (z.state === 'spawning') continue;
        const ox = z.pos[0] - p.pos[0];
        const oy = z.pos[1] - py;
        const oz = z.pos[2] - p.pos[2];
        if (Math.hypot(ox, oy, oz) <= T.pulse_radius) {
          const wasDraining = z.state === 'drain';
          stunShade(z, p.pos[0], p.pos[2], ticks(T.pulse_stun_s));
          this.score += wasDraining ? T.score.per_drain_stun : T.score.per_stun;
          stunned.push(z.id);
        }
      }
      for (let i = 0; i < this.drifters.length; i++) {
        const d = this.drifters[i];
        if (d.state === 'removed' || d.spawnTick >= this.simTick) continue;
        const ox = d.pos[0] - p.pos[0];
        const oy = d.pos[1] - py;
        const oz = d.pos[2] - p.pos[2];
        if (Math.hypot(ox, oy, oz) <= T.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.hasStolen = true;
            d.fleeTicks = X.drifter_flee_ticks;
          } else if (d.state === 'flee' && d.stolen > 0) {
            const amount = d.stolen;
            d.stolen = 0;
            d.fleeTicks = X.drifter_drop_despawn_ticks;
            const dropY = getSupportHeight(this.nightCfg, d.pos[0], d.pos[2], d.pos[1]) ?? 0;
            for (let j = 0; j < amount; j++) this._spawnMoteAt([d.pos[0], dropY, d.pos[2]]);
            this._emit('drifter_drop', { drifter_id: d.id, amount });
          }
        }
      }
      this._emit('pulse', { stunned_ids: stunned });
    }

    // Bước 8: Di chuyển Bóng Mực và Gió Lạc
    for (let i = 0; i < this.shades.length; i++) {
      stepShade(this.shades[i], this, DT);
    }
    for (let i = 0; i < this.drifters.length; i++) {
      stepDrifter(this.drifters[i], this, DT);
    }

    // Bước 9: Chạm — Gió Lạc cướp TRƯỚC, rồi Bóng Mực gây hit (theo id tăng dần, tối đa 1 lửa/tick)
    if (p.respawnTicks === 0 && this.drifters.length > 0) {
      for (let i = 0; i < this.drifters.length; i++) {
        const d = this.drifters[i];
        if (d.state !== 'chase' || d.hasStolen || d.spawnTick >= this.simTick) continue;
        if (d2(p.pos, d.pos) <= X.drifter_steal_r && p.carried > 0) {
          const amount = Math.min(X.drifter_steal_max, p.carried);
          p.carried -= amount;
          d.stolen = amount;
          d.hasStolen = true;
          d.state = 'flee';
          d.fleeTicks = X.drifter_flee_ticks;
          this._emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }
    }
    if (p.respawnTicks === 0 && p.invuln === 0 && this.shades.length > 0) {
      const ordered = this.shades.length > 1 ? this.shades.slice().sort(compareShadeId) : this.shades;
      for (let i = 0; i < ordered.length; i++) {
        const z = ordered[i];
        if (z.state === 'stunned' || z.state === 'spawning' || z.state === 'recoil' || z.state === 'drain' || z.expelTicks > 0) continue;
        if (d2(p.pos, z.pos) <= T.shade_hit_radius && Math.abs(p.pos[1] - (z.pos[1] - X.shade_height)) <= X.shade_hit_dy) {
          p.flames--;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          p.invuln = ticks(T.invuln_s);
          triggerShadeRecoil(z, p.pos[0], p.pos[2]);
          this._emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          for (let j = 0; j < dropped; j++) this._spawnMote(p.pos);
          break;
        }
      }
    }

    // Bước 10: Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch
    if (this.randomShades && this.simTick >= this.nextShadeTick) {
      const count = this.simTick === X.shade_first_spawn_ticks ? X.shade_first_spawn_count : 1;
      for (let i = 0; i < count; i++) {
        if (this.shades.length < this.nightCfg.shadeMax) this._spawnShade();
      }
      this.nextShadeTick += this.nightCfg.shadeIntervalTicks;
    }
    if (this.randomMotes && this.simTick >= this.nextMoteTick) {
      if (this.motes.length < X.max_motes) this._spawnMote();
      this.nextMoteTick += X.mote_respawn_ticks;
    }
    if (this.randomDrifters && this.simTick >= this.nextDrifterTick) {
      let alive = 0;
      for (let i = 0; i < this.drifters.length; i++) if (this.drifters[i].state !== 'removed') alive++;
      if (alive < X.drifter_max) this._spawnDrifter();
      this.nextDrifterTick += X.drifter_spawn_interval_ticks;
    }

    // Bước 11: Xét thắng/thua (TICKET-03: không thắng sớm; hết lửa luôn thua no_flames trước; bình minh >= ceil(0.6*n) đèn -> dawn_survived)
    if (p.flames <= 0) {
      this.state = 'lost';
      this._emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (this.timeLeft <= 1e-9) {
      let litCount = 0;
      for (let i = 0; i < this.lanterns.length; i++) if (this.lanterns[i].lit) litCount++;
      const threshold = Math.ceil(T.win_ratio * this.lanterns.length);
      if (litCount >= threshold) {
        this.state = 'won';
        for (let i = 0; i < this.lanterns.length; i++) {
          const L = this.lanterns[i];
          if (L.lit) this.score += T.score.per_lit_dawn + Math.floor(L.fuelU / FUEL_SCALE);
        }
        this.score += T.score.per_flame_left * p.flames;
        this._emit('game_over', { result: 'won', reason: 'dawn_survived' });
      } else {
        this.state = 'lost';
        this._emit('game_over', { result: 'lost', reason: 'dawn' });
      }
    }
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.nightId,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dir_deg },
      player: {
        pos: p.pos.map(r3),
        vel: p.vel.map(r3),
        grounded: p.grounded,
        flames: p.flames,
        carried: p.carried,
        capacity: this.playerCapacity,
        invuln: p.invuln > 0,
        dash_cd_s: r3(p.dashCd / TPS),
        pulse_cd_s: r3(p.pulseCd / TPS),
        charm_s: r3(p.charmTicks / TPS),
      },
      lanterns: this.lanterns.map((L) => ({
        id: L.id,
        pos: L.pos.map(r3),
        lit: L.lit,
        deposited: L.deposited,
        fuel: L.lit ? r1(L.fuelU / FUEL_SCALE) : 0,
        ever_lit: L.everLit,
        relit_count: L.relitCount,
      })),
      shades: this.shades.map((z) => ({ id: z.id, pos: z.pos.map(r3), state: z.state })),
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: r3(m.ttl / TPS) })),
      motes_active: this.motes.length,
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawnTicks / TPS) })),
    };
  }
}
