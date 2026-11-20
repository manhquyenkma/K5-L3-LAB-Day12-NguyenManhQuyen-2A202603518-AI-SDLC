---
name: night-data
description: Quy ước dữ liệu bản đồ chuẩn cho 3 Đêm (src/nights/n1.js, n2.js, n3.js): hệ tọa độ, góc đo từ +X ngược chiều kim đồng hồ trên XZ, điểm sinh, bục nhảy, bùa, đèn.
---

# Skill: night-data

Dùng skill này khi tạo hoặc kiểm tra `src/nights/n1.js`, `src/nights/n2.js`, `src/nights/n3.js` và `src/terrain.js`.

## 1. Hệ tọa độ & Góc chuẩn (BẮT BUỘC)
- Trục Y hướng lên; mặt phẳng ngang là XZ.
- **Góc `deg` đo từ trục `+X`, ngược chiều kim đồng hồ khi nhìn từ trên xuống (`+Y` nhìn xuống XZ):**
  - Với hệ tọa độ tay phải chuẩn Three.js (`+X` phải, `+Y` lên, `+Z` hướng về người nhìn hoặc phía trước):
    - Trên mặt phẳng XZ nhìn từ `+Y` xuống: trục `+X` hướng sang phải, trục `-Z` hướng lên trên, trục `+Z` hướng xuống dưới.
    - **Kiểm tra nhất quán với tọa độ Đèn Đêm 1 & Dốc Đêm 3 trong TICKET-02:**
      - Đêm 3: tầng 1 ở nửa `z > 0`, các điểm sinh đom đóm tầng 1 ở góc `20°, 40°, ..., 160°` → với góc `0°..180°`, `sin(rad) > 0`, nên **`x = cx + r * cos(rad)`, `z = cz + r * sin(rad)`** cho `z > 0` tại `20°..160°` và dốc ở `30°` và `150°` nằm đúng trên nửa `z > 0` nối vào tầng 1!
      - Kiểm tra thêm Đèn Đêm 1: `L1 (0,0,25)` = `90°`, `L2 (23.8,0,7.7)` = `18°` (`25*cos(18°)=23.78`, `25*sin(18°)=7.73`), `L3 (14.7,0,-20.2)` = `-54°`, `L4 (-14.7,0,-20.2)` = `-126°`, `L5 (-23.8,0,7.7)` = `162°`! Khớp 100%!
  - **Công thức bắt buộc:** `x = cx + r * Math.cos(deg * Math.PI / 180)`, `z = cz + r * Math.sin(deg * Math.PI / 180)`.

## 2. Kiểm tra số lượng bắt buộc mỗi Đêm
- **Đêm 1 (Đảo Bến):** 5 đèn (`L1..L5`), 24 điểm sinh đom đóm (`8 @ r=12` + `16 @ r=33`), 12 điểm sinh Bóng Mực (`r=37`, `15°, 45°, ...`), 0 bùa, 0 Gió Lạc, thời lượng `300 s`, Bóng Mực chu kỳ `480 tick` (8 s), tối đa `6`, tốc độ `4.0`.
- **Đêm 2 (Đảo Cau):** 6 đèn (`L1..L6`), 24 điểm sinh đom đóm (mỗi đảo `4 @ r=10` + `8 @ r=22`), 16 điểm sinh Bóng Mực (mỗi đảo `8 @ r=26`), 2 bục nhảy `(20,0,18)` & `(50,0,-18)`, 1 Bùa Gió `C1 (35,0,0)`, có Gió Lạc, thời lượng `330 s`, Bóng Mực chu kỳ `420 tick` (7 s), tối đa `8`, tốc độ `4.0`.
- **Đêm 3 (Đảo Chuông):** 7 đèn (`L1..L7`), 30 điểm sinh đom đóm (`18 @ y=0,r=34` + `8 @ y=3,r=18` + `4 @ y=6,r=5`), 16 điểm sinh Bóng Mực (`r=43`), 2 dốc (`30°`, `150°`), 1 bục nhảy `(0,3,13)`, tháp trụ tâm `(0,6,0)` bán kính `2 m` cao `8 m`, 2 Bùa Gió `C1 (30,0,25)` & `C2 (-30,0,25)`, có Gió Lạc, có gió mạnh (`30 s` / `5 s` / `2 m/s`), thời lượng `360 s`, Bóng Mực chu kỳ `360 tick` (6 s), tối đa `10`, tốc độ `4.5`.
