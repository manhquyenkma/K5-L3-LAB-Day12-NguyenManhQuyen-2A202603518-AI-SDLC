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
