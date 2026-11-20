---
name: review-diff
description: Rà soát độc lập thay đổi của một phase (phát hiện test yếu/giả, vi phạm thuần khiết src/sim.js, rò rỉ bí mật, hoặc sai lệch Test Contract).
---

# Skill: review-diff

Dùng skill này ở góc nhìn reviewer độc lập **khác lượt viết code** trước khi phát hành mỗi phase.

## Danh mục kiểm tra (Checklist)

1. **Tính thuần khiết của lõi (`src/sim.js`):**
   - Cấm `Math.random`, `Date`, `performance`, DOM, `fs`/I/O. Mọi ngẫu nhiên chỉ dùng `this.rng` (mulberry32).
2. **Độ tin cậy của Test (`tests/run.mjs`):**
   - Không có test luôn đạt, không tắt/xóa test cũ âm thầm mà không ghi lý do.
3. **Tuân thủ Test Contract (`game.contract.json`, `headless.js`):**
   - `game.contract.json` khớp 100% với `src/tuning.js`, mã thoát `0 / 1 / 2` chính xác, tọa độ làm tròn ≤ 3 chữ số.
4. **Sáng tạo không làm lệch headless:**
   - Mọi phần sáng tạo chỉ nằm ở `public/` (hiển thị/âm thanh), không thay đổi `src/sim.js`.
5. **Bảo mật & sạch sẽ:**
   - Không có `.env`, API key, token trong repo hay git history.
