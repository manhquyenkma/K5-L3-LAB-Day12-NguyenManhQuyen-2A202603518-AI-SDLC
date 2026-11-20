# Đảo Đèn Lồng — Phase 3 (Test Contract v1.2)

> **Video demo (< 5 phút):** *(Sẽ cập nhật ở Phase 4 / Release `v1.0.0`)*

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi, vượt qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*) — thắp đèn, châm dầu giữ ánh sáng trước lũ **Bóng Mực hút dầu** và **Gió Lạc** để sống sót tới bình minh với đủ đèn sáng.
Lõi logic thuần (`src/sim.js`, `src/terrain.js`, `src/nights/*`, `src/entities/*`) dùng chung cho bản chơi 3D (Three.js) và chế độ **headless** theo **Test Contract v1.2**.

## Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js ≥ 18** (macOS / Linux / Windows).

```bash
npm install --no-audit --no-fund   # chỉ cài three.js cho bản đồ họa 3D
npm test                           # chạy toàn bộ 70 test (hồi quy Phase 1-2 + Phase 3 + log vàng)
npm start                          # mở http://localhost:8080 (bật đo FPS: http://localhost:8080/?fps)
```

Chế độ headless **không cần** `npm install` (không phụ thuộc gói ngoài):

```bash
node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl
node headless.js --seed 7 --night 2 --scenario s.json --inputs i.json --ticks 1800 --out out.jsonl --snapshot-every 10
node headless.js --seed 3 --night 3 --ticks 18000 --out night3.jsonl --snapshot-every 10
```

Mã thoát: `0` thành công · `1` sai tham số/lỗi chạy · `2` file `--inputs`/`--scenario` sai định dạng (`stderr` có thông báo).

## Điều khiển

| Phím | Tác dụng |
|---|---|
| `W A S D` / mũi tên | Di chuyển (6.0 m/s; 7.2 m/s khi có Bùa Gió) |
| `Space` | Nhảy (7.0 m/s, chỉ khi chạm đất) |
| `Shift` | **Lướt** (14 m/s trong 0.2 s, hồi chiêu 1.5 s; không hồi chiêu khi có Bùa Gió) |
| `E` | Nạp đom đóm thắp đèn (`10` lần đầu / `5` thắp lại) hoặc **châm dầu** cho đèn đang sáng (`+10` dầu/đom đóm) |
| `F` | **Tỏa Sáng** (tốn 3 đom đóm, bán kính 3D 5 m, hồi chiêu 3 s: choáng & đẩy Bóng Mực, xua/làm rơi đồ Gió Lạc) |
| `Q / R` hoặc kéo chuột | Xoay camera |
| `Esc` hoặc `P` | **Tạm dừng** (Tiếp tục / Chơi lại Đêm / Cài đặt gồm *Bảng màu dễ phân biệt* / Về menu) |

## Luật chơi & Cách tính điểm (Phase 3 / Contract v1.2)

- **Nhiên liệu đèn:** Đèn vừa thắp có `fuel = 100`, tự hao `1.0/giây` (tính nguyên `1/60` mỗi tick). Hết dầu (`≤ 0`) đèn tắt (`lantern_out`), thắp lại chỉ cần `5` đom đóm.
- **Bóng Mực hút dầu (`drain`):** Đèn có `fuel < 30` mất vùng an toàn 6 m; Bóng Mực `wander` sẽ tiến vào `≤ 2 m` đứng hút `5/giây` (cộng dồn nhiều con). Châm dầu lên `≥ 30` đẩy Bóng Mực ra mép 6 m trong ≤ 30 tick.
- **Sức chứa tăng dần:** `10 + 2 × successful_lights` (tối đa `20`), đặt lại mỗi Đêm.
- **Luật thắng bình minh (`dawn_survived`):** Không còn thắng sớm khi thắp đủ đèn. Cần sống sót tới hết giờ (**Đêm 1: 240 s** cần `≥ 3/5` đèn · **Đêm 2: 270 s** cần `≥ 4/6` đèn · **Đêm 3: 300 s** cần `≥ 5/7` đèn). Hết Ngọn Lửa luôn thua `no_flames` trước.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp mới / thắp lại / châm dầu) | `+5` |
| Thắp lần đầu / Thắp lại | `+100` / `+40` |
| Bóng Mực trúng Tỏa Sáng (thường / đang `drain`) | `+5` / `+15` |
| Bình minh (chỉ khi thắng): mỗi đèn sáng | `+50 + floor(fuel)` |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | `+50` |

## Chế độ mù màu ("Bảng màu dễ phân biệt")

Bật trong **Cài đặt** (lưu bền vững `localStorage`):
- Viền & mắt Bóng Mực đổi sang `#00B3FF`; màu cảnh báo UI đổi sang `#FFFFFF` kèm biểu tượng `⚠`.
- Đèn tắt xẹp `20%` và giấy có vết rách răng cưa để phân biệt không cần màu; đèn sáng có thanh dầu 3D và nhấp nháy chậm `1 Hz` khi `fuel < 30`.

## Sáng tạo của tôi

Mọi sáng tạo chỉ nằm ở tầng hiển thị/âm thanh/chữ trong `public/`, **không** đụng lõi `src/`, được kiểm chứng bởi `pure-core-audit` và 3 cổng chặn log vàng byte-by-byte:
- **Mô hình & chất liệu hội họa procedural (`public/assets.js`):** 9 chất liệu CanvasTexture (cỏ, đá cát, gỗ tre, nón lá đan, lụa Hội An lành & rách, Bùa Gió chữ triện, biển mây cuộn, vòng sen) + mô hình điêu khắc `LatheGeometry` cho Mây, miếu Đèn Lồng Hội An, Tháp Chuông 2 tầng mái, Bóng Mực 6 tua mực, Gió Lạc 7 đốt lụa.
- **Đảo hát (C1):** Hòa âm thang ngũ cung Web Audio tăng số nốt theo số đèn sáng + tiếng chuông tháp khi thắng Đêm 3.
- **Ông Đăng gợi ý (C2), Hiệu ứng nhân vật (C3) & Không khí từng đảo (C5):** Gợi ý ngắn ≤ 2 s, đèn nón lá lắc, vệt lướt, gợn sương đáp, cầu tre đung đưa hình ảnh, chuông rung khi thắp đèn, Bình Minh chuyển sắc ấm.

## Tài liệu thiết kế & Bằng chứng
- Quyết định kiến trúc Phase 3: [docs/ADR-001-phase3-lantern-fuel-and-win-rule.md](docs/ADR-001-phase3-lantern-fuel-and-win-rule.md)
- Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md)
- Báo cáo kiểm chứng: `evidence/phase3/test-report.txt`, `docs/PERF.md`, `docs/NOTES.md`, `docs/SPEC-PHASE2.md`
