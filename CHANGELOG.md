# Changelog

## [phase-3] — Nhiên liệu đèn, Bóng Mực hút dầu, Luật thắng bình minh & Mù màu (TICKET-03, Contract v1.2)

### Breaking Changes (thay đổi phá vỡ tương thích so với `phase-2` / Contract v1.1)
- **Contract version nâng từ `"1.1"` → `"1.2"`** (`game.contract.json`):
  - Bổ sung 8 khóa `tuning`: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`.
  - Thời lượng Đêm 1 / 2 / 3 rút ngắn từ `300 / 330 / 360 s` → **`240 / 270 / 300 s`**.
- **[THAY THẾ] Luật đèn không nhận thêm đom đóm sau khi sáng:**
  - Đèn đang sáng hao `1/60` dầu mỗi tick (lưu nguyên `fuelU` theo đơn vị `1/60`, tối đa `6000`). Châm dầu bằng `interact` dùng `used = min(carried, ceil((100 - fuel)/10))`, phát sự kiện `refuel {lantern_id, amount, fuel}`. Đèn đầy dầu (`used = 0`) bị bỏ qua khi chọn tương tác.
  - Khi `fuel ≤ 0` ngay sau Bước 2: đèn tắt, `deposited = 0`, `ever_lit = true`, phát `lantern_out {lantern_id}`. Đèn đã từng sáng chỉ cần `5` đom đóm để thắp lại (`lantern_lit` thêm trường `relight: true|false`, tăng `relit_count`).
- **[THAY THẾ] Luật vùng an toàn bất biến của đèn:**
  - Đèn sáng có `fuel < 30` mất vùng an toàn (đúng `30` vẫn còn). Bóng Mực `wander` chuyển sang săn đèn yếu gần nhất và vào trạng thái mới **`drain`** (đứng yên hút `5/60` dầu/tick, cộng dồn nhiều con, ghi `fuel_drain` mỗi 60 tick). Châm dầu lên `≥ 30` đẩy Bóng Mực trong `6 m` ra mép trong ≤ 30 tick.
- **[THAY THẾ] Luật thắng sớm `all_lit`:**
  - Thắp đủ 100% đèn không còn kết thúc Đêm sớm; `game_over.reason = "all_lit"` bị loại bỏ.
  - Thay bằng thắng sinh tồn tới bình minh **`dawn_survived`**: còn sống ở tick cuối với số đèn sáng `≥ ceil(0.6 × tổng đèn)` (`3/5`, `4/6`, `5/7`). Hết Ngọn Lửa luôn thua `no_flames` trước kể cả tại tick bình minh.
- **[THAY THẾ] Toàn bộ công thức điểm:**
  - Nạp đom đóm (thắp mới / thắp lại / châm dầu): `+10` → **`+5`** mỗi đom đóm.
  - Thắp đèn: `+100` lần đầu, **`+40`** khi thắp lại.
  - Tỏa Sáng trúng Bóng Mực: `+5` mỗi con thường, tổng **`+15`** nếu ngay trước đó đang `drain`.
  - Bình minh (chỉ khi thắng): **`+50 + floor(fuel)`** mỗi đèn đang sáng + **`+50`** mỗi Ngọn Lửa còn lại; **bỏ hoàn toàn thưởng thời gian**.
- **Test & Golden Log cập nhật theo luật mới (không skip âm thầm):**
  - Cập nhật rõ lý do `[TICKET-03]` trong `tests/run.mjs`, `tests/phase2/m1-data-contract.mjs`, `m3`, `m6`, `m7`, và sinh lại log vàng v1.2 tại `evidence/golden/`.

### Tính năng mới (Phase 3)
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)` (đặt lại về 0 mỗi Đêm, xuất `player.capacity` trong snapshot và hiển thị `đang mang / sức chứa` trên HUD).
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** lưu bền vững trong `localStorage`; đổi viền & mắt Bóng Mực sang `#00B3FF`, đổi màu cảnh báo UI sang `#FFFFFF` kèm biểu tượng `⚠`; đèn tắt xẹp 20% + giấy có vết rách (phân biệt không cần màu); đèn đang sáng có thanh dầu 3D và nhấp nháy chậm `1 Hz` khi `fuel < 30`.
- **Kiến trúc & Tài liệu:** thêm quyết định thiết kế [docs/ADR-001-phase3-lantern-fuel-and-win-rule.md](docs/ADR-001-phase3-lantern-fuel-and-win-rule.md) và bộ 9 kịch bản test Phase 3 ([tests/phase3/phase3.mjs](tests/phase3/phase3.mjs)).

---

## [phase-2] — "Ba hòn đảo" (TICKET-02, Test Contract v1.1)
- Chuẩn hóa toàn bộ số liệu v1.1 (`src/tuning.js`, `game.contract.json`) và dữ liệu bản đồ chuẩn 3 Đêm (`src/nights/n1..n3.js`).
- Xây dựng truy vấn địa hình thuần (`src/terrain.js`: đảo, cầu tre, 3 tầng, vách đứng, 2 dốc 30°/150°, tháp chuông, bục nhảy), chuyển động vận tốc/lướt/rơi/gió Đêm 3.
- Hoàn thiện 12 bước tick bắt buộc, FSM 5 trạng thái Bóng Mực (`src/entities/shade.js`), Gió Lạc (`src/entities/drifter.js`), Bùa Gió, tạm dừng (`pause`/`resume`) và CLI `--night 1|2|3`.
- Nâng cấp bản chơi 3D (`public/index.html`, `public/main.js`, `public/audio.js`, `public/assets.js`) với chuỗi 3 Đêm, lời Ông Đăng, Bình Minh, Pause 4 nút, Cài đặt `localStorage`, nhạc nền + 10 SFX, HUD 7 thành phần, chất liệu hội họa procedural và mô hình điêu khắc.
- Tối ưu hóa M10 (`scripts/bench.mjs`, log vàng, `docs/PERF.md`) và sáng tạo thuần `public/` M11 (C1–C5).

## [phase-1] — Đêm 1: Đảo Bến (Test Contract v1.0)
- Xây dựng lõi mô phỏng 60 tick/s thuần JS, tất định theo seed (`src/tuning.js`, `src/sim.js`).
- Cài đặt CLI chế độ headless tuân thủ Test Contract v1.0 (`headless.js`, `game.contract.json`, `scripts/gen-contract.js`).
- Viết bộ 24 test tự chấm theo contract (`tests/run.mjs`) và bot tham lam chứng minh Đêm 1 thắng được (`scripts/bot.mjs`, `evidence/`).
- Xây dựng bản chơi 3D góc nhìn thứ ba bằng Three.js + Web Audio API (`server.js`, `public/index.html`, `public/main.js`).
- Thiết lập Harness AI (`AGENTS.md`, `.agents/skills/`), GitHub Actions CI (`.github/workflows/ci.yml`), `LICENSE`, `CREDITS.md`.
