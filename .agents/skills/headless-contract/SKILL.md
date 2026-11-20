---
name: headless-contract
description: Quy ước Test Contract v1.3 cho headless.js, bench.js, soak.js, server.js --export-leaderboard, game.contract.json và bộ test hồi quy + scenario Phase 1–4.
---

# Skill: headless-contract (Contract v1.3)

Dùng skill này khi sửa `headless.js`, `bench.js`, `soak.js`, `server.js`, `src/tuning.js`, `scripts/gen-contract.js`, hoặc viết test trong `tests/`.

## 1. Các lệnh CLI bắt buộc (`game.contract.json` v1.3)
- `contract_version`: `"1.3"`
- `team`: `"2A202603518-nguyen-manh-quyen"`
- `build_cmd`: `"npm install --no-audit --no-fund"`
- `run_cmd`: `"node server.js"` (hỗ trợ thêm `--export-leaderboard out.json` xuất `{"entries": [...]}`)
- `headless_cmd`: `"node headless.js"` (mã thoát `0` thành công, `1` sai tham số/lỗi chạy, `2` file scenario/inputs sai định dạng)
- `bench_cmd`: `"node bench.js"` (`--seed 42 --duration 30 --out bench.json`)
- `soak_cmd`: `"node soak.js"` (`--seed 7 --nights 10 --out soak.json`)
- Bắt buộc sinh tự động `game.contract.json` từ `src/tuning.js` qua `npm run contract` và kiểm tra `assert.deepEqual(contract.tuning, TUNING)`.

## 2. Schema Snapshot / Scenario / Sự kiện (v1.2 kế thừa trong v1.3)
- **Snapshot:** `player.capacity`; mỗi đèn có `fuel` (1 chữ số thập phân, tắt = `0`), `ever_lit`, `relit_count`; Bóng Mực có 6 trạng thái (`spawning|wander|chase|recoil|stunned|drain`).
- **Scenario:** `lanterns[].{lit, fuel, ever_lit}` (`lit: true` mặc định `fuel: 100`), `player.successful_lights`, `shades[].target_lantern_id`.
- **Sự kiện:** `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`, `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick), `lantern_lit {lantern_id, relight}`, `game_over.reason` ∈ `dawn_survived | dawn | no_flames` (`all_lit` không còn dùng).

## 3. Output Benchmark & Soak (v1.3)
- `bench.json`: `contract_version: "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`. Ngưỡng máy chấm: `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`.
- `soak.json`: `nights`, `crashes`, `results`, `mem_start_mb`, `mem_end_mb`, `duration_s`. Ngưỡng: `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`.
