---
name: verify-phase
description: Quy trình chuẩn kiểm chứng cuối mỗi phase (chạy npm test, kiểm tra contract, cú pháp 3D, tất định byte-by-byte, bot replay và cập nhật bằng chứng trước khi gắn tag).
---

# Skill: verify-phase

Dùng skill này ở bước **Verify** của mỗi phase (CP1–CP4) trước khi gắn tag `phase-N`.

## Các bước bắt buộc

1. **Đồng bộ & kiểm tra Test Contract + 24+ test:**
   ```bash
   npm run contract
   npm test
   ```
   Nếu bất kỳ test nào đỏ, **dừng lại và sửa ngay** — không được gắn tag khi đỏ.

2. **Kiểm tra cú pháp & tính thuần khiết lõi:**
   ```bash
   node --check src/tuning.js && node --check src/sim.js && node --check headless.js && node --check server.js && node --check public/main.js
   ```

3. **Kiểm tra tính tất định (Determinism) & khả năng thắng:**
   - Chạy `node scripts/bot.mjs 1` và phát lại qua `node headless.js`, so sánh hash output 2 lần chạy độc lập (phải khớp 100% từng byte).

4. **Kiểm tra bản chơi 3D thật trên trình duyệt:**
   - Khởi động `npm start`, mở `http://localhost:8080`, kiểm tra Console không lỗi và chụp ảnh màn hình lưu vào `evidence/`.

5. **Lưu bằng chứng thật & cập nhật `docs/NOTES.md`:**
   - Không sửa tay output. Ghi trung thực phần đạt/chưa đạt, lỗi AI, ước tính token rồi mới commit và gắn tag `phase-N`.
