// Nguồn sự thật DUY NHẤT cho các con số của game.
// game.contract.json được sinh từ đây (npm run contract) và có test đối chiếu.
export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 3,
  pulse_cost: 1,
  pulse_radius: 8,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 3,
  pulse_cooldown_s: 1.5,
  safe_radius: 4,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 20, per_second_left: 2, per_flame_left: 50 },
};

// Hằng số nội bộ, KHÔNG thuộc contract (đã ghi trong README).
export const EXTRA = {
  island_radius: 40,
  lantern_ring_radius: 25,
  gravity: 25,
  jump_speed: 9,
  initial_motes: 20,
  max_motes: 24,
  mote_respawn_s: 3,
  shade_first_spawn_s: 8,
  shade_spawn_every_s: 12,
  max_shades: 4,
  shade_height: 1,
};
