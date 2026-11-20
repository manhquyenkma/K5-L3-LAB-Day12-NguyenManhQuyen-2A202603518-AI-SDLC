// Lõi logic Đảo Đèn Lồng: thuần JS, không DOM, không Date/Math.random.
// Dùng chung cho chế độ headless (Node) và bản chơi trên trình duyệt.
import { TUNING as T, EXTRA as X } from './tuning.js';
import { getNight } from './nights/index.js';

export const DT = 1 / 60;
export const TPS = 60;

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
const ticks = (s) => Math.round(s * TPS);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]); // khoảng cách mặt phẳng XZ

function defaultLanterns(nightCfg) {
  return nightCfg.lanterns.map((L) => ({
    id: L.id,
    pos: L.pos.slice(),
    lit: false,
    deposited: 0,
  }));
}

export class Sim {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    const sc = scenario || {};
    this.nightId = night;
    this.nightCfg = getNight(night);
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false };
    this.t0 = sc.time_left_s ?? this.nightCfg.duration_s;
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;
    this.player = { pos: this.nightCfg.spawn.slice(), vy: 0, carried: 0, flames: T.flames, invuln: 0, pulseCd: 0 };
    this.lanterns = defaultLanterns(this.nightCfg);
    this.motes = [];
    this.shades = [];
    this.nextMote = 1;
    this.nextShade = 1;
    this.nextShadeTick = X.shade_first_spawn_ticks;
    this.nextMoteTick = X.mote_respawn_ticks;

    if (sc.player) {
      if (sc.player.pos) this.player.pos = sc.player.pos.slice();
      if (sc.player.carried !== undefined) this.player.carried = sc.player.carried;
      if (sc.player.flames !== undefined) this.player.flames = sc.player.flames;
    }
    for (const l of sc.lanterns || []) {
      let L = this.lanterns.find((x) => x.id === l.id);
      if (!L) {
        L = { id: l.id, pos: l.pos.slice(), lit: false, deposited: 0 };
        this.lanterns.push(L);
      }
      if (l.pos) L.pos = l.pos.slice();
      if (l.deposited !== undefined) L.deposited = l.deposited;
      if (l.lit !== undefined) L.lit = l.lit;
    }
    if (sc.motes !== undefined) {
      for (const p of sc.motes) this.motes.push({ id: 'M' + this.nextMote++, pos: p.slice() });
    } else if (this.randomMotes) {
      for (let i = 0; i < X.initial_motes; i++) this._spawnMote();
    }
    if (sc.shades !== undefined) {
      for (const s of sc.shades) {
        let id = s.id;
        if (id === undefined) {
          while (this.shades.some((z) => z.id === 'S' + this.nextShade)) this.nextShade++;
          id = 'S' + this.nextShade++;
        }
        this.shades.push({ id, pos: s.pos.slice(), state: 'chase', stun: 0 });
      }
      while (this.shades.some((z) => z.id === 'S' + this.nextShade)) this.nextShade++;
    }
    // Dựng scenario KHÔNG phát sự kiện, KHÔNG cộng điểm.
  }

  get timeLeft() {
    return this.t0 - this.tick / TPS;
  }

  _emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  _spawnMote(near = null) {
    let pos;
    if (near) {
      const ang = this.rng() * Math.PI * 2;
      pos = [near[0] + Math.sin(ang) * 2.5, 0, near[2] + Math.cos(ang) * 2.5];
      const r = Math.hypot(pos[0], pos[2]);
      if (r > X.island_radius - 1) { pos[0] *= (X.island_radius - 1) / r; pos[2] *= (X.island_radius - 1) / r; }
    } else {
      const ang = this.rng() * Math.PI * 2;
      const r = Math.sqrt(this.rng()) * (X.island_radius - 5);
      pos = [Math.sin(ang) * r, 0, Math.cos(ang) * r];
    }
    this.motes.push({ id: 'M' + this.nextMote++, pos: [r3(pos[0]), 0, r3(pos[2])] });
  }

  _spawnShade() {
    const ang = this.rng() * Math.PI * 2;
    const r = X.island_radius - 2;
    const id = 'S' + this.nextShade++;
    this.shades.push({ id, pos: [r3(Math.sin(ang) * r), X.shade_height, r3(Math.cos(ang) * r)], state: 'chase', stun: 0 });
    this._emit('shade_spawned', { id });
  }

  // Vùng an toàn: chỉ đèn đã sáng, bán kính safe_radius (TICKET-02).
  _repel(pos) {
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      let dx = pos[0] - L.pos[0], dz = pos[2] - L.pos[2];
      let d = Math.hypot(dx, dz);
      if (d < T.safe_radius + 0.001) { // biên dư 1 mm: sau khi làm tròn 3 số lẻ vẫn > safe_radius
        if (d < 1e-9) { dx = 1; dz = 0; d = 1; }
        const k = (T.safe_radius + 0.001) / d;
        pos[0] = L.pos[0] + dx * k;
        pos[2] = L.pos[2] + dz * k;
      }
    }
  }

  step(inp = {}) {
    if (this.state !== 'playing') return;
    this.tick++;
    const p = this.player;
    if (p.invuln > 0) p.invuln--;
    if (p.pulseCd > 0) p.pulseCd--;

    const jumpEdge = !!inp.jump && !this.prev.jump;
    const interactEdge = !!inp.interact && !this.prev.interact;
    const pulseEdge = !!inp.pulse && !this.prev.pulse;
    this.prev = { jump: !!inp.jump, interact: !!inp.interact, pulse: !!inp.pulse };

    // 1. Di chuyển (theo hướng camera) + nhảy
    let [mx, mz] = inp.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((inp.cam_yaw_deg || 0) * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    const dx = mx * c + mz * s, dz = -mx * s + mz * c;
    p.pos[0] += dx * T.player_speed * DT;
    p.pos[2] += dz * T.player_speed * DT;
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > X.island_radius) { // fall_enabled=false: bị chặn ở mép đảo
      p.pos[0] *= X.island_radius / pr;
      p.pos[2] *= X.island_radius / pr;
    }
    if (jumpEdge && p.pos[1] === 0 && p.vy === 0) p.vy = X.jump_speed;
    if (p.pos[1] > 0 || p.vy !== 0) {
      p.vy -= X.gravity * DT;
      p.pos[1] += p.vy * DT;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
    }

    // 2. Nhặt đom đóm (TICKET-02: không cộng điểm lúc nhặt, cộng +per_mote lúc nạp)
    for (const m of this.motes.slice()) {
      if (p.carried >= T.carry_capacity) break;
      if (d2(p.pos, m.pos) <= T.pickup_radius) {
        this.motes.splice(this.motes.indexOf(m), 1);
        p.carried++;
        this._emit('mote_picked', { carried: p.carried });
      }
    }

    // 3. Nạp ánh sáng vào đèn gần nhất chưa sáng (hòa chọn id nhỏ hơn)
    if (interactEdge && p.carried > 0) {
      let best = null, bd = Infinity;
      for (const L of this.lanterns) {
        if (L.lit) continue;
        const d = d2(p.pos, L.pos);
        if (d <= T.interact_radius && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && L.id < best.id))) {
          best = L;
          bd = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.score += amount * T.score.per_mote;
          this._emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        }
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          this.score += T.score.per_lantern;
          this._emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }

    // 4. Tỏa sáng
    if (pulseEdge && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCd = ticks(T.pulse_cooldown_s);
      const stunned = [];
      for (const z of this.shades) {
        if (z.state === 'stunned') continue;
        if (d2(p.pos, z.pos) <= T.pulse_radius) {
          z.state = 'stunned';
          z.stun = ticks(T.pulse_stun_s) + 1;
          let ex = z.pos[0] - p.pos[0], ez = z.pos[2] - p.pos[2];
          const e = Math.hypot(ex, ez);
          if (e < 1e-9) { ex = 1; ez = 0; } else { ex /= e; ez /= e; }
          z.pos[0] += ex * T.pulse_push_m;
          z.pos[2] += ez * T.pulse_push_m;
          this._repel(z.pos);
          this.score += T.score.per_stun;
          stunned.push(z.id);
        }
      }
      this._emit('pulse', { stunned_ids: stunned });
    }

    // 5. Bóng Mực: đuổi theo / choáng
    for (const z of this.shades) {
      if (z.state === 'stunned') {
        z.stun--;
        if (z.stun <= 0) { z.state = 'chase'; z.stun = 0; }
        continue;
      }
      const ex = p.pos[0] - z.pos[0], ez = p.pos[2] - z.pos[2];
      const e = Math.hypot(ex, ez);
      if (e > 1e-9) {
        const st = Math.min(T.shade_speed * DT, e);
        z.pos[0] += (ex / e) * st;
        z.pos[2] += (ez / e) * st;
      }
      this._repel(z.pos);
    }

    // 6. Bóng Mực chạm người chơi
    if (p.invuln === 0) {
      for (const z of this.shades) {
        if (z.state === 'stunned') continue;
        if (d2(p.pos, z.pos) <= T.shade_hit_radius) {
          p.flames--;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          p.invuln = ticks(T.invuln_s) + 1;
          this._emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          for (let i = 0; i < dropped; i++) this._spawnMote(p.pos); // đom đóm rơi quanh người chơi
          break;
        }
      }
    }

    // 7. Sinh ngẫu nhiên (chỉ khi scenario cho phép)
    if (this.randomShades && this.tick >= this.nextShadeTick) {
      if (this.shades.length < this.nightCfg.shadeMax) this._spawnShade();
      this.nextShadeTick += this.nightCfg.shadeIntervalTicks;
    }
    if (this.randomMotes && this.tick >= this.nextMoteTick) {
      if (this.motes.length < X.max_motes) this._spawnMote();
      this.nextMoteTick += X.mote_respawn_ticks;
    }

    // 8. Kết thúc
    if (this.lanterns.every((L) => L.lit)) {
      this.state = 'won';
      this.score += T.score.per_second_left * Math.max(0, Math.floor(this.timeLeft + 1e-9)) + T.score.per_flame_left * p.flames;
      this._emit('game_over', { result: 'won', reason: 'all_lit' });
    } else if (p.flames <= 0) {
      this.state = 'lost';
      this._emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (this.timeLeft <= 1e-9) {
      this.state = 'lost';
      this._emit('game_over', { result: 'lost', reason: 'dawn' });
    }
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
      shades: this.shades.map((z) => ({ id: z.id, pos: z.pos.map(r3), state: z.state })),
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
      motes_active: this.motes.length,
    };
  }
}
