---
name: verify-phase
description: Quy trình chuẩn kiểm chứng cuối mỗi phase (chạy npm test, kiểm tra contract v1.3, bench, soak, leaderboard export, clean-clone <= 3 lệnh và cập nhật bằng chứng trước khi gắn tag).
---

# Skill: verify-phase

Dùng skill này ở bước **Verify** của mỗi phase (CP1–CP4) trước khi gắn tag `phase-N` và Release `v1.0.0`.

## Các bước bắt buộc

1. **Đồng bộ Contract v1.3 & chạy toàn bộ bộ test (hồi quy Phase 1–3 + Phase 4 + log vàng):**
   ```bash
   npm run contract
   npm test
   ```
   Nếu bất kỳ test nào đỏ, **dừng lại và sửa ngay** — không được gắn tag khi đỏ.

2. **Kiểm tra cú pháp toàn bộ module & tính thuần khiết `src/`:**
   ```bash
   node --check src/tuning.js && node --check src/sim.js && node --check headless.js && node --check bench.js && node --check soak.js && node --check server.js && node --check lib/leaderboard.js && node --check public/main.js && node --check public/assets.js && node --check public/audio.js
   ```

3. **Chạy đo thật Benchmark, Soak & Xuất Bảng xếp hạng:**
   ```bash
   node bench.js --seed 42 --duration 30 --out bench.json
   node soak.js --seed 7 --nights 10 --out soak.json
   node server.js --export-leaderboard evidence/phase4/leaderboard-export.json
   ```

4. **Kiểm tra đóng gói & Clone sạch ≤ 3 lệnh:**
   - Chạy `npm run build:release` tạo gói phát hành tĩnh.
   - Clone repo sang thư mục tạm sạch, chạy đúng hướng dẫn README (≤ 3 lệnh), xác nhận `npm test` và `server.js` khởi động sạch không lỗi.

5. **Lưu bằng chứng thật, rà soát bảo mật & cập nhật tài liệu:**
   - Kiểm tra không có `.env`, API key, token trong working tree và lịch sử git.
   - Đủ `bench.json`, `soak.json`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE`, `docs/RETRO.md`, `docs/NOTES.md`, `README.md` (có ảnh chụp & link video demo ở đầu), rồi mới commit và gắn tag `phase-4`.
