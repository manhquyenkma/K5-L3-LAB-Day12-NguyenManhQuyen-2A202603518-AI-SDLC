# Kế hoạch kiến trúc và công nghệ (Phase 1, khoảng 60 phút)

## 1. Lựa chọn công nghệ

| Tiêu chí | **Node.js + Three.js (chọn)** | Unity (C#) | C++ + raylib/SDL | Godot (headless) |
|---|---|---|---|---|
| Chạy macOS/Linux cho giảng viên | Có, chỉ cần Node | Khó (project nặng, license, build) | Có, nhưng cần biên dịch | Cần cài engine |
| Headless 60 tick/s không GPU | Tự nhiên (lõi JS thuần) | Cần tách lõi riêng | Tự nhiên | Có, hơi lệch cấu hình |
| Lệnh chạy tối đa 3 lệnh | `npm install`, `npm test`, `npm start` | Khó đạt | CMake/Make nhiều bước | 1-2 lệnh nhưng cần engine |
| Dùng chung 1 lõi cho headless và GUI | Có (ES module) | Không tự nhiên | Có | Có |
| Tính tất định giữa 2 lần chạy | Dễ (RNG tự viết) | Phải tự kiểm soát | Dễ | Phải kiểm soát |
| Rủi ro token/thời gian | Thấp | Cao | Trung bình | Trung bình |

Kết luận: tách **lõi mô phỏng thuần** (headless, được chấm) khỏi **lớp hiển thị** (Three.js, chỉ đọc trạng thái). Lõi chạy không cửa sổ nên test contract nhanh (5 phút game mô phỏng chưa tới 2 giây).

## 2. Kiến trúc

```
tuning.js ──► sim.js (Sim.step(input) → trạng thái, sự kiện)
                 ├──► headless.js  (đọc scenario/inputs → JSONL)       ← giảng viên chấm
                 └──► public/main.js (input bàn phím → Sim, vẽ bằng Three.js)  ← người chơi
```
Thứ tự một tick trong `Sim.step`: đếm giảm timer → input → di chuyển/nhảy → nhặt đom đóm → nạp đèn → tỏa sáng → Bóng Mực di chuyển/choáng → Bóng Mực chạm người → sinh ngẫu nhiên → kiểm tra thắng/thua.

## 3. Chia 60 phút

| Phút | Việc | Đầu ra kiểm chứng |
|---|---|---|
| 0-8 | Đọc PRD-0 + Contract, chốt giả định và số liệu | `tuning.js`, danh sách giả định |
| 8-25 | Lõi `sim.js` + `headless.js` | smoke run JSONL |
| 25-38 | Bộ test contract (24 test) | `npm test` xanh |
| 38-52 | Bản chơi Three.js + HUD + chơi lại | chơi thử trên trình duyệt |
| 52-60 | README, AGENTS.md, NOTES, thẻ git `phase-1` | `git tag phase-1`, push |

## 4. Nộp bài

```bash
git init && git add -A && git commit -m "Phase 1: Dao Den Long"
git tag phase-1 && git remote add origin <repo-public> && git push origin main --tags
```
Nhớ đổi `team` trong `scripts/gen-contract.js` thành `mssv-ho-ten` đúng của bạn rồi chạy `npm run contract`.
