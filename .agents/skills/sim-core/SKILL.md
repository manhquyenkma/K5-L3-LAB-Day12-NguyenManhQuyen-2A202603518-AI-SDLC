---
name: sim-core
description: Quy tắc viết lõi mô phỏng thuần src/sim.js, src/terrain.js, src/entities/* (12 bước bắt buộc trong 1 tick, nhiên liệu nguyên 1/60, 6 trạng thái Bóng Mực, tính tất định RNG và benchMode).
---

# Skill: sim-core (Contract v1.3)

Dùng skill này khi chỉnh sửa `src/sim.js`, `src/terrain.js`, `src/entities/shade.js`, `src/entities/drifter.js`.

## 1. Quy tắc thuần khiết & Tất định
- **Cấm tuyệt đối:** `Math.random()`, `Date`, `performance`, `window`, `document`, `fs`, `console` trong toàn bộ `src/`.
- Mọi giá trị ngẫu nhiên chỉ lấy từ `this.rng()` (mulberry32 khởi tạo theo `--seed`).
- Nhiên liệu lưu bằng số nguyên `fuelU` theo đơn vị `1/60` (`FUEL_MAX_U = 6000`, `LOW_FUEL_U = 1800`, `FUEL_PER_MOTE_U = 600`) để tránh sai số số thực tại biên `fuel = 30` và `fuel = 0`; chỉ làm tròn `r1()` khi xuất snapshot/event.
- Tọa độ xuất ra snapshot làm tròn 3 chữ số thập phân bằng `r3()` (đổi `-0` thành `0`).

## 2. Thứ tự 12 bước bắt buộc trong mỗi tick (`Sim.step`)
1. Đọc input: xử lý `pause` (`false -> true`) trước; nếu vừa tạm dừng thì dừng bước tại đây.
2. Giảm bộ đếm (thời gian, hồi chiêu, bất tử, choáng, bùa, TTL đom đóm rơi, hồi bùa, hồi sinh, gió) + **trừ dầu đèn** (hao `1/60` + mỗi Bóng Mực `drain` hút `5/60`, phát `fuel_drain` mỗi 60 tick) → ngay sau đó tắt đèn có `fuelU ≤ 0` (`deposited = 0`, `everLit = true`, phát `lantern_out`).
3. Di chuyển Mây (gia tốc, nhảy, lướt, bục nhảy, gió Đêm 3, va chạm vách/tháp) → kiểm tra rơi `Y < -10`.
4. Nhặt đom đóm (sức chứa động `min(20, 10 + 2 * successfulLights)`) và Bùa Gió.
5. Tương tác đèn nhận được gần nhất (chưa sáng: `10` lần đầu / `5` thắp lại; hoặc sáng `fuelU < 6000`: châm dầu `used = min(carried, ceil((100-fuel)/10))`, bỏ qua đèn đầy). Châm lên `≥ 30` đẩy Bóng Mực trong `6 m` ra mép trong ≤ 30 tick.
6. Cập nhật vùng an toàn (`L.lit && L.fuelU >= 1800`, bán kính `6 m`).
7. Tỏa Sáng (tốn 3, tâm 3D `y + 0.8`, bán kính `5 m`, `+5` thường / tổng `+15` nếu ngay trước đó đang `drain`).
8. Di chuyển Bóng Mực 6 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`) và Gió Lạc.
9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit theo `id` tăng dần (tối đa 1 lửa/tick).
10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch (thực thể mới tương tác từ tick sau).
11. Xét thắng/thua: hết Ngọn Lửa → luôn thua `no_flames` trước (kể cả tick bình minh); hết giờ → thắng `dawn_survived` nếu `litCount ≥ ceil(0.6 * total)` (`3/5`, `4/6`, `5/7`), ngược lại thua `dawn`. Không thắng sớm `all_lit`.
12. Ghi snapshot nếu tới lượt.

## 3. Chế độ Benchmark (`benchMode: true`)
- Chỉ bật khi tạo `new Sim({ seed, night: 1, benchMode: true, scenario })` từ giao diện `?bench=1`.
- Tắt hao dầu/hút dầu, nhặt đom đóm, sát thương/rơi và điều kiện kết thúc Đêm; giữ nguyên di chuyển `wander` và chặn vùng an toàn 6 m quanh đèn sáng `L1–L3`.
- Khi `benchMode` là `false` (mặc định), hành vi `Sim` không thay đổi bất kỳ byte nào.
