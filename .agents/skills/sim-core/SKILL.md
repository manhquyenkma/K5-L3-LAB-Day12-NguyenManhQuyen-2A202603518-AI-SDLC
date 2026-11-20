---
name: sim-core
description: Quy tắc viết lõi mô phỏng thuần src/sim.js, src/terrain.js, src/entities/* (12 bước bắt buộc trong 1 tick, tính tất định RNG, và tránh cấp phát rác).
---

# Skill: sim-core

Dùng skill này khi chỉnh sửa `src/sim.js`, `src/terrain.js`, `src/entities/shade.js`, `src/entities/drifter.js`.

## 1. Quy tắc thuần khiết & Tất định
- **Cấm tuyệt đối:** `Math.random()`, `Date`, `performance`, `window`, `document`, `fs`, `console` trong lõi.
- Mọi giá trị ngẫu nhiên chỉ lấy từ `this.rng()` (mulberry32 khởi tạo theo `--seed`).
- Thứ tự duyệt thực thể phải cố định (theo thứ tự sinh / `id` tăng dần) để 2 lần chạy cùng đầu vào cho output JSONL giống hệt từng byte.
- Tọa độ và số thực xuất ra snapshot làm tròn 3 chữ số thập phân bằng `r3()` (đổi `-0` thành `0`).

## 2. Thứ tự 12 bước bắt buộc trong mỗi tick (`Sim.step`)
1. Đọc input: xử lý `pause` (`false -> true`) trước; nếu vừa tạm dừng thì dừng bước tại đây (khi đang `paused`, `tick` tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên).
2. Giảm bộ đếm: thời gian đêm, hồi chiêu (lướt, tỏa sáng), bất tử, choáng, hiệu lực bùa, TTL đom đóm rơi, hồi bùa, trạng thái rơi/hồi sinh, chu kỳ gió.
3. Di chuyển Mây (tăng/giảm tốc, nhảy, lướt, bục nhảy khóa vận tốc, gió Đêm 3, va chạm vách/tháp) → kiểm tra rơi `Y < -10`.
4. Nhặt đom đóm và Bùa Gió (XZ ≤ 1.0 m và |ΔY| ≤ 1.5 m; không nhặt khi đang chờ hồi sinh).
5. Tương tác với đèn chưa sáng gần nhất (XZ ≤ 2.0 m, |ΔY| ≤ 1.5 m, hòa chọn `id` nhỏ hơn); cộng +10/đom đóm nạp, +100 khi thắp.
6. Cập nhật vùng an toàn (bán kính 6 m quanh **đèn đã sáng**; đẩy Bóng Mực đang ở trong ra mép trong tối đa 30 tick, không gây sát thương lúc đẩy).
7. Tỏa Sáng (tốn 3 đom đóm, tâm = chân Mây + 0.8 m, 3D ≤ 5 m, chốt mục tiêu ngay tick kích hoạt, choáng 120 tick, đẩy 4 m trong 15 tick đầu, hồi chiêu 180 tick, +5 mỗi Bóng Mực trúng; đuổi/thả Gió Lạc).
8. Di chuyển Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`) và Gió Lạc (`idle`, `chase`, `flee`, `removed`).
9. Chạm: Gió Lạc cướp trước (XZ ≤ 1.2 m, bỏ qua bất tử & vùng an toàn), rồi Bóng Mực gây hit theo `id` tăng dần (tối đa 1 lần mất Ngọn Lửa mỗi tick, lùi `recoil` 2 m trong 60 tick).
10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch cố định (thực thể mới chỉ tương tác từ tick sau).
11. Xét thắng/thua: hết Ngọn Lửa → luôn thua (`no_flames`); còn sống và mọi đèn sáng → thắng (`all_lit`, kể cả đúng tick hết giờ); còn lại hết giờ → thua (`dawn`).
12. Ghi snapshot nếu tới lượt (do runner/headless gọi sau `step()`).

## 3. Hiệu năng vòng lặp nóng
- Tránh tạo object/mảng thừa trong `step()` (dùng phép tính số trực tiếp thay vì `.map`/`.filter` lặp đi lặp lại trong inner loop) để 21.600 tick chạy dưới 5 giây (ngưỡng đề ≤ 30 s).
