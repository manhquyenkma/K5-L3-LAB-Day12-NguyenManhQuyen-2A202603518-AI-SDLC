---
name: headless-contract
description: Quy ước Test Contract v1.1 cho headless.js, game.contract.json, schema snapshot/scenario/input/events và bộ test hồi quy + scenario Phase 2.
---

# Skill: headless-contract

Dùng skill này khi sửa `headless.js`, `src/tuning.js`, `scripts/gen-contract.js`, hoặc viết test trong `tests/`.

## 1. CLI & Mã thoát
- Lệnh chuẩn: `node headless.js --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json] --ticks <N> --out <out.jsonl> [--snapshot-every K]`
- Mã thoát bắt buộc:
  - `0`: Thành công
  - `1`: Sai tham số CLI hoặc lỗi chạy
  - `2`: File `--scenario` hoặc `--inputs` không đọc được / sai JSON / sai schema (ghi thông báo vào `stderr`)

## 2. `game.contract.json` (v1.1)
- `contract_version`: `"1.1"`
- `team`: `"2A202603518-nguyen-manh-quyen"`
- Bắt buộc sinh tự động từ `src/tuning.js` qua `npm run contract` và có test đối chiếu `assert.deepEqual(contract.tuning, TUNING)`.
- Các khóa mới so với v1.0: `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s` (giữ nguyên toàn bộ khóa v1.0).

## 3. Schema v1.1
- **Snapshot gốc:** `type: "snapshot"`, `tick`, `sim_tick`, `night`, `state` (`playing`/`paused`/`won`/`lost`), `time_left_s`, `score`, `wind: { active, dir_deg }`, `player: { pos, vel, grounded, flames, carried, invuln, dash_cd_s, pulse_cd_s, charm_s }`, `lanterns`, `shades` (`state` ∈ `spawning|wander|chase|recoil|stunned`), `motes` (`id, pos, kind: random|dropped, ttl_s`), `motes_active`, `drifters` (`id, pos, state, stolen`), `charms` (`id, available, respawn_s`).
- **Scenario v1.1 mở rộng:** `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms` (thay danh sách mặc định), `random_drifters`, `wind_enabled`.
- **Input v1.1 mở rộng:** `dash` và `pause` (kích hoạt cạnh lên `false -> true`).
- **Sự kiện mới:** `night_start {night}`, `dash {}`, `charm_picked {charm_id, charm_ticks}`, `drifter_steal {drifter_id, amount, carried}`, `drifter_drop {drifter_id, amount}`, `paused {}`, `resumed {}`, và `player_hit` do rơi có `by: "fall"` + `lost`.
