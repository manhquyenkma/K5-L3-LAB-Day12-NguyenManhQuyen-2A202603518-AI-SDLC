# Giả định thiết kế — Phase 2 (TICKET-02, Contract v1.1)

## A. Giả định Phase 1 đã bị thay thế bởi TICKET-02 (ghi lý do rõ ràng)

| Mục Phase 1 | Giả định cũ (Phase 1) | Luật mới bắt buộc (TICKET-02) |
|---|---|---|
| Sức chứa & chi phí đèn | `carry_capacity = 5`, `lantern_cost = 5` | `10` và `10`, nạp nhiều lần |
| Bán kính nhặt / tương tác | `pickup_radius = 1.2`, `interact_radius = 3` | `1.0` (kèm ΔY ≤ 1.5 m) và `2.0` |
| Vùng an toàn (`safe_radius`) | `4 m`, áp dụng cho mọi đèn (cả chưa sáng) | `6 m`, **chỉ đèn đã sáng**; bóng ở trong lúc đèn vừa thắp bị đẩy ra trong ≤ 30 tick |
| Tỏa Sáng (`pulse`) | Tốn 1, bán kính 8 m (XZ), choáng 3 s, đẩy 3 m ngay, hồi 1.5 s, +20 điểm | Tốn 3, bán kính 5 m (3D từ chân + 0.8 m), choáng 120 tick (2 s), đẩy tổng 4 m trong 15 tick, hồi 3 s (180 tick), +5 điểm |
| Điểm đom đóm | +10 lúc nhặt (`mote_picked`) | +10 lúc **nạp** (`deposit`) |
| Rơi khỏi đảo | `fall_enabled = false`, mép đảo chặn lại | `fall_enabled = true`, rơi khi `Y < -10`, mất 1 lửa + toàn bộ đom đóm, chờ 60 tick hồi sinh bất tử 90 tick |
| Bất tử sau bị đánh | `invuln_s = 2` (120 tick) | `invuln_s = 1.5` (90 tick) |
| Trạng thái Bóng Mực | `chase`, `stunned` | 5 trạng thái bắt buộc: `spawning`, `wander`, `chase`, `recoil`, `stunned` |

*(Toàn bộ test Phase 1 trong `tests/run.mjs` sẽ được cập nhật ở M1 để khớp số chuẩn mới theo yêu cầu hồi quy của TICKET-02, không tắt/xóa âm thầm.)*

## B. Giả định mặc định cho các chỗ chưa quy định rõ trong TICKET-02

| # | Chỗ chưa rõ trong TICKET-02 | Giả định mặc định áp dụng |
|---|---|---|
| 1 | Gia tốc / giảm tốc cụ thể để đạt tốc độ đích trong ≤ 0.1 s | Dùng gia tốc ngang `60 m/s²` (đạt 6.0 m/s trong đúng 0.10 s = 6 tick; khi có Bùa Gió 7.2 m/s dùng `72 m/s²` để vẫn ≤ 0.1 s). |
| 2 | Thời gian ở trạng thái `spawning` và hành vi `wander` của Bóng Mực | `spawning` kéo dài 1 tick (vì đề quy định thực thể mới chỉ tương tác từ tick sau); `wander` di chuyển 2.0 m/s trên mặt đi được, đổi hướng ngẫu nhiên theo RNG mỗi 120 tick hoặc khi gặp mép/vật cản. |
| 3 | "Điểm sương" sinh Gió Lạc (Đêm 2 & 3) | Dùng chính danh sách điểm sinh Bóng Mực của đêm đó, chọn bằng RNG. |
| 4 | Thời điểm phát sự kiện `night_start` | Phát tại `tick = 0` ngay sau khi khởi tạo màn (1 lần mỗi lượt chạy, trước tick 1). |
| 5 | Bóng Mực gặp mép đảo / vách tầng / tháp | Bóng Mực được giữ trên mặt đi được của tầng/đảo hiện tại và trượt dọc vật cản (không rơi xuống biển mây, không cần pathfinding phức tạp). |
| 6 | Lịch sinh Bóng Mực khởi đầu ở Đêm 2 và 3 | Giống Đêm 1: 2 con tại tick `300`, sau đó 1 con mỗi chu kỳ (`480` / `420` / `360` tick tương ứng Đêm 1 / 2 / 3). |
| 7 | Tương tác đèn có xét chênh lệch độ cao không | Áp dụng `XZ ≤ 2.0 m` và `|player.y - lantern.y| ≤ 1.5 m` (nhất quán với luật nhặt đom đóm để tránh nạp xuyên tầng ở Đêm 3). |
| 8 | Hướng "về tâm đảo kia" của bục nhảy Đêm 2 | Vector chuẩn hóa XZ từ vị trí bục đến tâm đảo đối diện: từ `(20,0,18)` hướng về `(70,0,0)`, từ `(50,0,-18)` hướng về `(0,0,0)`. |
| 9 | Hướng mặt ban đầu của Mây khi đứng yên ở lần lướt đầu | Quay mặt về `+Z` (`facing = [0, 1]`), đúng mô tả điểm xuất phát trong đề. |
| 10 | Độ cao mắt/tâm Bóng Mực cho khoảng cách 3D Tỏa Sáng | Tâm Bóng Mực nằm ở `pos.y` (khi sinh trên mặt đất `groundY`, Bóng Mực có `pos.y = groundY + 1.0`, nhất quán Phase 1). |
