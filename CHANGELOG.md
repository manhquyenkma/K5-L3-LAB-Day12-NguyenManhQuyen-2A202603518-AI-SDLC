# Changelog

## [v1.0.0 / phase-4] — Bình minh: Phát hành v1.0.0 (TICKET-04, Contract v1.3)

### Hợp đồng & Đo kiểm hiệu năng / ổn định (Contract v1.3)
- Nâng `game.contract.json` lên **`contract_version: "1.3"`**, bổ sung `bench_cmd: "node bench.js"` và `soak_cmd: "node soak.js"`, giữ nguyên toàn bộ số liệu và luật v1.0–v1.2.
- **Chế độ Benchmark (`bench.js` + `?bench=1`):** Tự mở cửa sổ `1280×720` không toàn màn hình với cờ tắt vsync (`--disable-gpu-vsync --disable-frame-rate-limit`), tải Đêm 1 đủ ánh sáng & hiệu ứng với đúng **200 Bóng Mực `wander`** (seed 42), **100 đom đóm**, 3 đèn `L1–L3` sáng (`fuel = 100`), Mây đứng tại `(0,0,0)`, camera quay ngược chiều kim đồng hồ quanh `(0,0,0)` bán kính `30 m`, cao `Y = 15 m` (15 s/vòng); bỏ 3 s khởi động, đo `--duration` giây rồi xuất `bench.json` đầy đủ 10 trường chuẩn và tự thoát mã `0`.
- **Tối ưu GPU `InstancedMesh` cho Bóng Mực (`public/assets.js`, `public/main.js`):** Hợp nhất thân, 6 tua mực, đôi mắt, bóng đổ và vòng hào quang thành **5 draw calls duy nhất cho 200+ Bóng Mực** (giảm từ 2.200 draw calls) và tăng `MAX_MOTE_INST` lên `128`, giúp đạt > 100 FPS trung bình và p1_low > 50 FPS trên GPU tích hợp.
- **Soak test (`soak.js`) & tối ưu cấp phát vòng lặp nóng (`src/sim.js`):** Chạy 10 Đêm liên tiếp (Đêm `1 → 2 → 3` xoay vòng, seed `7..16`) trong cùng tiến trình với input ngẫu nhiên theo seed; loại bỏ cấp phát đối tượng `this.prev`, mảng rỗng `drainEvents()` và bộ đệm sắp xếp `_shadeSortBuf` trong vòng tick → `crashes = 0`, `mem_end_mb / mem_start_mb ≈ 1.12 ≤ 1.20`.

### Bảng xếp hạng cục bộ & Dễ tiếp cận
- **Bảng xếp hạng cục bộ (`lib/leaderboard.js`, `server.js`, `public/`):** Lưu Top 10 trên đĩa cục bộ (`data/leaderboard.json`), mở từ menu chính và cho nhập tên (`3–12` ký tự `[A-Za-z0-9_]` + hỗ trợ tiếng Việt có dấu) sau Bình Minh Đêm 3 hoặc sau khi thua bất kỳ Đêm nào; sắp xếp theo `score` giảm dần (hòa: ai đạt trước đứng trên); hỗ trợ CLI `node server.js --export-leaderboard out.json` xuất `{"entries": [...]}`.
- **Dễ tiếp cận (Accessibility):**
  - Đổi phím cho đủ 9 hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), phát hiện trùng phím & cảnh báo rõ, nút **"Khôi phục mặc định"**, lưu bền vững `localStorage`.
  - Phụ đề hình ảnh trực tiếp (`#caption-bar`) + mũi tên chỉ hướng mép màn hình (`#shade-arrows`) cho Bóng Mực xuất hiện, cảnh báo gió sắp thổi, 10 giây cuối, và đèn `fuel < 30`.
  - Tùy chọn **"Giảm chuyển động"** (tắt rung camera, tắt chớp màn hình và hoạt ảnh rung/lắc).
  - Cỡ chữ UI tối thiểu **18 px** ở `1280×720` kèm tùy chọn **"Chữ lớn (×1.25)"**.

### Đóng gói & Tài liệu phát hành
- Bổ sung công cụ đóng gói chạy độc lập không cần `npm install` (`scripts/build-release.mjs` → `dist/dao-den-long-v1.0.0.zip`), `Dockerfile`, `docs/RETRO.md`, ảnh chụp màn hình thật trong `docs/screenshots/`, cập nhật đầy đủ `README.md`, `CREDITS.md`, `AGENTS.md`, `.agents/skills/`, CI và bộ test Phase 4 (`tests/phase4/phase4.mjs`).

---

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
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** lưu bền vững trong `localStorage`; đổi viền & mắt Bóng Mực từ `#7A3CFF` sang `#00B3FF`, đổi màu cảnh báo UI sang `#FFFFFF` kèm biểu tượng `⚠`; đèn tắt xẹp 20% + giấy có vết rách (phân biệt không cần màu); đèn đang sáng có thanh dầu 3D và nhấp nháy chậm `1 Hz` khi `fuel < 30`.
- **Kiến trúc & Tài liệu:** thêm quyết định thiết kế [docs/ADR-001-phase3-lantern-fuel-and-win-rule.md](docs/ADR-001-phase3-lantern-fuel-and-win-rule.md) và bộ 11 kịch bản test Phase 3 ([tests/phase3/phase3.mjs](tests/phase3/phase3.mjs)).

---

## [phase-2] — "Ba hòn đảo" (TICKET-02, Test Contract v1.1)
- Chuẩn hóa toàn bộ số liệu v1.1 (`src/tuning.js`, `game.contract.json`) và dữ liệu bản đồ chuẩn 3 Đêm (`src/nights/n1..n3.js`).
- Xây dựng truy vấn địa hình thuần (`src/terrain.js`: đảo, cầu tre, 3 tầng, vách đứng, 2 dốc 30°/150°, tháp chuông, bục nhảy), chuyển động vận tốc/lướt/rơi/gió Đêm 3.
- Hoàn thiện 12 bước tick bắt buộc, FSM 5 trạng thái Bóng Mực (`src/entities/shade.js`), Gió Lạc (`src/entities/drifter.js`), Bùa Gió, tạm dừng (`pause`/`resume`) và CLI `--night 1|2|3`.
- Nâng cấp bản chơi 3D (`public/index.html`, `public/main.js`, `public/audio.js`, `public/assets.js`) với chuỗi 3 Đêm, lời Ông Đăng, Bình Minh, Pause 4 nút, Cài đặt `localStorage`, nhạc nền + 10 SFX, HUD 7 thành phần, chất liệu hội họa procedural và mô hình điêu khắc.
- Tối ưu hóa M10 (`scripts/bench.mjs`, log vàng, `docs/PERF.md`) và sáng tạo thuần `public/` M11 (C1–C5).

---

## [phase-1] — Đêm 1: Đảo Bến (Test Contract v1.0)
- Xây dựng lõi mô phỏng 60 tick/s thuần JS, tất định theo seed (`src/tuning.js`, `src/sim.js`).
- Cài đặt CLI chế độ headless tuân thủ Test Contract v1.0 (`headless.js`, `game.contract.json`, `scripts/gen-contract.js`).
- Viết bộ 24 test tự chấm theo contract (`tests/run.mjs`) và bot tham lam chứng minh Đêm 1 thắng được (`scripts/bot.mjs`, `evidence/`).
- Xây dựng bản chơi 3D góc nhìn thứ ba bằng Three.js + Web Audio API (`server.js`, `public/index.html`, `public/main.js`).
- Thiết lập Harness AI (`AGENTS.md`, `.agents/skills/`), GitHub Actions CI (`.github/workflows/ci.yml`), `LICENSE`, `CREDITS.md`.
