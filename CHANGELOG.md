# Changelog

## [phase-1] — Đêm 1: Đảo Bến (Test Contract v1.0)
- Xây dựng lõi mô phỏng 60 tick/s thuần JS, tất định theo seed (`src/tuning.js`, `src/sim.js`).
- Cài đặt CLI chế độ headless tuân thủ Test Contract v1.0 (`headless.js`, `game.contract.json`, `scripts/gen-contract.js`).
- Viết bộ 24 test tự chấm theo contract (`tests/run.mjs`) và bot tham lam chứng minh Đêm 1 thắng được (`scripts/bot.mjs`, `evidence/`).
- Xây dựng bản chơi 3D góc nhìn thứ ba bằng Three.js + Web Audio API (`server.js`, `public/index.html`, `public/main.js`).
- Thiết lập Harness AI (`AGENTS.md`, `.agents/skills/`), GitHub Actions CI (`.github/workflows/ci.yml`), `LICENSE`, `CREDITS.md`.
