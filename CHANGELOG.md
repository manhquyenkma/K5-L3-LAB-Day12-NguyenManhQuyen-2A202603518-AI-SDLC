# Changelog

## [phase-2] — "Ba hòn đảo" (TICKET-02, Test Contract v1.1)
- Chuẩn hóa toàn bộ số liệu v1.1 (`src/tuning.js`, `game.contract.json`) và dữ liệu bản đồ chuẩn 3 Đêm (`src/nights/n1..n3.js`).
- Xây dựng truy vấn địa hình thuần (`src/terrain.js`: đảo, cầu tre, 3 tầng, vách đứng, 2 dốc 30°/150°, tháp chuông, bục nhảy), chuyển động vận tốc/lướt/rơi/gió Đêm 3.
- Hoàn thiện 12 bước tick bắt buộc, FSM 5 trạng thái Bóng Mực (`src/entities/shade.js`), Gió Lạc (`src/entities/drifter.js`), Bùa Gió, tạm dừng (`pause`/`resume`) và CLI `--night 1|2|3`.
- Nâng cấp bản chơi 3D (`public/index.html`, `public/main.js`, `public/audio.js`) với chuỗi 3 Đêm, giới thiệu Ông Đăng, Bình Minh, Pause 4 nút, Cài đặt lưu `localStorage`, nhạc nền + 10 SFX, HUD 7 thành phần, bảng màu chuẩn và ánh sáng môi trường.
- Bộ kiểm thử mở rộng lên 58/58 test xanh (24 hồi quy Phase 1 số chuẩn + 34 test Phase 2).

## [phase-1] — Đêm 1: Đảo Bến (Test Contract v1.0)
- Xây dựng lõi mô phỏng 60 tick/s thuần JS, tất định theo seed (`src/tuning.js`, `src/sim.js`).
- Cài đặt CLI chế độ headless tuân thủ Test Contract v1.0 (`headless.js`, `game.contract.json`, `scripts/gen-contract.js`).
- Viết bộ 24 test tự chấm theo contract (`tests/run.mjs`) và bot tham lam chứng minh Đêm 1 thắng được (`scripts/bot.mjs`, `evidence/`).
- Xây dựng bản chơi 3D góc nhìn thứ ba bằng Three.js + Web Audio API (`server.js`, `public/index.html`, `public/main.js`).
- Thiết lập Harness AI (`AGENTS.md`, `.agents/skills/`), GitHub Actions CI (`.github/workflows/ci.yml`), `LICENSE`, `CREDITS.md`.
