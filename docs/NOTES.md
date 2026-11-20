# Ghi chú Phase 1: giả định, bằng chứng, nhật ký AI

## Giả định (PRD-0 và Contract còn mơ hồ)

| # | Chỗ mơ hồ | Giả định đã chọn |
|---|---|---|
| 1 | "Ánh sáng" mang theo và nạp vào đèn | Mỗi đom đóm nhặt = 1 đơn vị ánh sáng (`carried`). Nạp bằng phím interact vào đèn chưa sáng gần nhất trong `interact_radius`. |
| 2 | Chi phí tỏa sáng | `pulse_cost = 1` đơn vị ánh sáng đang mang; không mang gì thì không tỏa được. |
| 3 | `safe_radius` áp dụng cho đèn nào | Mọi đèn (cả chưa sáng), vì đèn là nơi trú. Biên dư 1 mm để sau làm tròn vẫn lớn hơn `safe_radius`. |
| 4 | Rơi khỏi đảo | `fall_enabled=false`: người chơi bị chặn ở mép đảo (40 m), không có sự kiện rơi. |
| 5 | Choáng và cooldown | Choáng đúng `pulse_stun_s` kể từ tick tỏa; Bóng Mực đã choáng không bị choáng lại và không tính thêm điểm. Pulse bị bỏ qua (không sự kiện) khi đang cooldown hoặc không có ánh sáng. |
| 6 | Bất tử sau khi bị chạm | `invuln_s` = 2 s, tức 120 bước kể từ bước sau lần chạm. |
| 7 | Ánh sáng rơi khi bị chạm | `floor(carried × 0.5)` đom đóm rơi quanh người chơi (cách khoảng 2,5 m), nhặt lại được. |
| 8 | Điểm thắng | Cộng `per_second_left × floor(giây còn lại)` và `per_flame_left × lửa còn lại` một lần lúc thắng; thua không cộng. `per_mote` tính lúc nhặt. |
| 9 | Snapshot cuối | Chỉ ghi snapshot ở bội của `--snapshot-every` (và tick 0); không thêm snapshot ở tick kết thúc. Trạng thái cuối nằm ở dòng `end`. |
| 10 | Đèn lạ trong scenario | Id ngoài L1-L5 chỉ được chấp nhận nếu có `pos` (thêm đèn mới); thiếu `pos` thì mã thoát 2. |
| 11 | Bóng Mực trong scenario | Hoạt động (`chase`) ngay, tâm ở độ cao y mà scenario cho; Bóng Mực tự sinh có y = 1. |

## Bằng chứng

- `npm test`: 24 test đạt, báo cáo ở `evidence/test-report.txt` (nhặt, nạp, thắp, thắng/thua, tỏa sáng, choáng, bất tử, safe_radius, tất định theo byte, mã thoát 2, hiệu năng).
- `evidence/bot-seed1.jsonl`: bot tham lam (`scripts/bot.mjs`) thắng Đêm 1 ở tick 3965 với 3 lửa, 5 sự kiện `lantern_lit`, điểm 1666. Đây là log headless phát lại từ `evidence/bot-seed1.inputs.json`; chạy lại cho kết quả giống hệt từng byte.
- `evidence/pulse-and-hit.jsonl`: scenario dựng sẵn cho thấy `pulse` choáng 2 Bóng Mực rồi `player_hit` khi hết choáng.
- Bot cũng thắng ở seed 2-5 (khoảng 2700-4000 tick), cho thấy số liệu hiện tại không bất khả thi.

## Nhật ký dùng AI & Quản lý token (Phase 1)

| Bước | Công cụ | Việc | Kiểm chứng | Ước tính token / ghi chú tiết kiệm |
|---|---|---|---|---|
| 1 | Claude (chat) | Đọc trang đề, tóm tắt PRD-0 & Test Contract v1.0, chốt 11 giả định | Đối chiếu trực tiếp với đề Phase 1 | ~12k token (chốt giả định trước khi code) |
| 2 | Claude (chat) | Sinh `src/tuning.js`, `src/sim.js`, `headless.js`, `tests/run.mjs`, `scripts/bot.mjs` | Smoke run JSONL, `npm test` 24/24 đạt, bot thắng seed 1–5 | ~28k token (tách `src/sim.js` gọn ~305 dòng) |
| 3 | Claude (chat) | Sửa lỗi biên `safe_radius`: test phát hiện Bóng Mực đứng đúng 4.000 m | Test `safe_radius` xanh sau khi cộng biên dư 1 mm | ~4k token (sửa trực tiếp theo test fail) |
| 4 | Claude (chat) | Sinh bản 3D Three.js (`public/`), `server.js`, `README.md`, `AGENTS.md` | `node --check`, `npm test` vẫn 24/24 | ~16k token |
| 5 | Antigravity (Gemini) | Rà soát độc lập (`review-diff`), đối chiếu hash `bot-seed1.jsonl`, cập nhật `team`, `.gitignore`, `.github/workflows/ci.yml`, `.agents/skills/`, `CREDITS.md`, `LICENSE` | `npm run contract`, `npm test` 24/24 đạt, SHA-256 bot replay khớp 100% | ~25k token (chỉ đọc file liên quan, gộp lệnh kiểm chứng) |

### Lỗi AI / sự cố đã phát hiện & cập nhật Harness
- **Lỗi biên số học `safe_radius`:** Bóng Mực sau làm tròn 3 chữ số đứng đúng `4.000 m` (không lớn hơn `4`). Đã sửa `_repel()` cộng biên dư `0.001 m` và phủ bằng test tự động trong `tests/run.mjs`.
- **Lỗi thiếu quy tắc bảo mật & CI khi gộp gói:** `.gitignore` ban đầu chưa chặn `.env`/key và chưa có CI tự chạy test. Đã bổ sung `.gitignore` đầy đủ, `.github/workflows/ci.yml`, và 2 skill (`.agents/skills/verify-phase`, `.agents/skills/review-diff`).
- **Thông tin cá nhân mặc định sai MSSV:** `scripts/gen-contract.js` có `team` tạm `CT060236-mquyen`; đã rà soát, cập nhật đúng `2A202603518-nguyen-manh-quyen` và chạy lại `npm run contract`.
- **Lỗi thực tế khi chạy 3D trên trình duyệt (không bấm được nút Bắt đầu):** `three@0.174.0` tách `three.core.js` khỏi `three.module.js`, nhưng `server.js` ban đầu chỉ phục vụ duy nhất `/vendor/three.module.js` → trả 404 cho `/vendor/three.core.js` làm `public/main.js` không nạp được. Đã sửa `server.js` phục vụ an toàn toàn bộ `/vendor/*` từ `node_modules/three/build/` (tương thích cả `three@0.160.0` lẫn bản mới hơn).

### Đánh giá nhanh Phase 1
- **Đạt:** Lõi `src/sim.js` thuần & tất định 60 tick/s; `headless.js` & `game.contract.json` khớp 100% Test Contract v1.0; 24/24 test tự động xanh; bot tham lam chứng minh thắng Đêm 1; hiệu năng 18.000 tick < 2s; sáng tạo hiển thị/âm thanh tách hoàn toàn trong `public/`.
- **Đang kiểm chứng trực tiếp:** Khởi chạy `node server.js` tại `http://localhost:8080` để chơi thử trên trình duyệt thật (di chuyển, nhặt, nạp đèn, tỏa sáng, chơi lại) và chụp ảnh màn hình lưu vào `evidence/`.

---

# Ghi chú Phase 2: "Ba hòn đảo" (TICKET-02, Contract v1.1)

- Chi tiết tiêu chí nghiệm thu Phần 3: xem [SPEC-PHASE2.md](SPEC-PHASE2.md).
- Chi tiết 8 luật Phase 1 bị thay thế + 11 giả định mặc định: xem [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Nhật ký dùng AI theo mốc (M0 → M9)

| Mốc | Công cụ | Việc giao | Kiểm chứng |
|---|---|---|---|
| M0 | Antigravity (Gemini) | Lưu `TICKET-02.md`, `PHASE2_PLAN.md`, `SPEC-PHASE2.md`, `ASSUMPTIONS.md`, cập nhật `AGENTS.md` + tạo 3 skill (`sim-core`, `headless-contract`, `night-data`) | `npm test` baseline 24/24 xanh, commit `e15957f` |
| M1 | Antigravity (Gemini) | Số liệu chuẩn v1.1 (`src/tuning.js`), `game.contract.json` v1.1, bản đồ 3 đêm (`src/nights/n1..n3.js`), cập nhật hồi quy Phase 1 | `npm run contract` + `npm test` 28/28 xanh, commit `4becc26` |
| M2 | Antigravity (Gemini) | `src/terrain.js` (đảo, cầu, 3 tầng, vách, 2 dốc, tháp, bục nhảy), vận tốc/accel, nhảy, lướt, rơi `Y < -10`, gió Đêm 3 | `npm test` 36/36 xanh (8 scenario M2), commit `5062ed9` |
| M3 | Antigravity (Gemini) | Lịch đom đóm 20/30/240t, TTL 480t, nạp nhiều lần + hòa id, vùng an toàn 6 m đẩy ≤ 30t, Tỏa Sáng 3D đẩy 15t + làm mới | `npm test` 42/42 xanh (6 scenario M3), commit `efe7375` |
| M4 | Antigravity (Gemini) | `src/entities/shade.js` FSM 5 trạng thái (`spawning/wander/chase/recoil/stunned`), 12/18 m, recoil 2 m/60t, lịch sinh 3 đêm | `npm test` 44/44 xanh, commit `cec734c` |
| M5 | Antigravity (Gemini) | `src/entities/drifter.js` (Gió Lạc) + Bùa Gió `C1/C2` (600t, 7.2 m/s, lướt không hồi chiêu, tái xuất 2700t) | `npm test` 48/48 xanh, commit `993ebac` |
| M6 | Antigravity (Gemini) | Schema v1.1 đầy đủ, `night_start`, `pause`/`resume`, ưu tiên thắng/thua & thứ tự 12 bước tick | `npm test` 53/53 xanh, commit `180e705` |
| M7 | Antigravity (Gemini) | Ghi log theo lô `headless.js`, test hiệu năng 3 đêm đầy đủ (158–517 ms ≪ 30 s), tất định byte-by-byte, `pure-core-audit` | `npm test` 55/55 xanh, commit `01ce9f3` |
| M8 | Antigravity (Gemini) | GUI 3D 3 đêm (`public/index.html`, `public/main.js`, `public/audio.js`): Menu → Intro Ông Đăng → 3 Đêm → Bình Minh, Pause, Settings, 10 SFX, 7 thành phần HUD, bảng màu chuẩn & ánh sáng môi trường | `npm test` 58/58 xanh, commit `0fdc560` |
| M9 | Antigravity (Gemini) | Cập nhật `scripts/bot.mjs` (v1.1), CI, `SPEC-PHASE2.md`, `README.md`, xuất log 3 đêm & báo cáo test `evidence/phase2/` | `npm test` 58/58 xanh + `node scripts/bot.mjs 3` thắng Đêm 1, commit `f4925fc` |
| M10 | Antigravity (Gemini) | Tạo `scripts/bench.mjs`, log vàng `evidence/golden/` + `tests/phase2/m10-golden.mjs`, ghi số đo thật vào `docs/PERF.md` | 3 đêm chạy 0.24–0.53 s, peak RSS 50.1 MB, log vàng 3/3 khớp byte-by-byte, commit `66affee` |
| M11 | Antigravity (Gemini) | Sáng tạo thuần `public/` (C1 Đảo hát + chuông tháp, C2 Ông Đăng gợi ý, C3 vệt lướt & gợn đáp, C5 cầu đung đưa + chuông rung + Bình Minh) | `npm test` 61/61 xanh (kể cả log vàng + `pure-core-audit`), không chạm `src/` |

## Lỗi phát hiện & cách sửa trong Phase 2
- **Bước 4 chạy trước Bước 5 trong test `deposit-multi` (M3):** Đom đóm đặt trong bán kính 1 m bị nhặt ngay ở tick 0 trước khi nạp lần 1 → sửa kịch bản test đặt đom đóm ở `z = 2.2` để tách rõ 2 lần nạp.
- **Regex `pure-core-audit` khớp chú thích cuối dòng (M7):** `src/tuning.js` có comment cuối dòng chứa `public/` → sửa bộ quét lọc cả comment `//` cuối dòng thay vì chỉ đầu dòng.
- **Tọa độ góc Đêm 3:** Kiểm chứng chéo bằng toán học xác nhận `x = cx + r*cos(deg)`, `z = cz + r*sin(deg)` khớp đồng thời cả 5 đèn Đêm 1, 2 dốc `30°/150°` và vành khăn `z > 0` (`20°..160°`) của Đêm 3.

## Đánh giá nhanh Phase 2
- **Đạt:** 58/58 test tự động xanh (24 hồi quy Phase 1 số chuẩn + 34 test Phase 2 phủ toàn bộ scenario bắt buộc); 3 đêm đầy đủ chạy headless 0.16–0.52 s (≪ 30 s) và khớp byte-by-byte; lõi `src/` 100% thuần; bản 3D đủ luồng 3 Đêm, Pause, Settings, 10 SFX, 7 HUD, bảng màu chuẩn.
- **Cần kiểm chứng bổ sung trên trình duyệt thật:** Chơi thử 3 đêm tại `http://localhost:8080/?fps` trên máy để ghi nhận FPS thực tế và chụp ảnh màn hình mỗi đêm.
