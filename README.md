# Đảo Đèn Lồng (Phase 1, Đêm 1 – Đảo Bến)

Game 3D: Mây, người giữ đèn nhỏ tuổi, nhặt đom đóm, thắp lại 5 Đèn Lồng Lớn và xua Bóng Mực trước khi trời sáng.
Lõi logic (`src/sim.js`) dùng chung cho bản chơi trên trình duyệt (Three.js) và chế độ headless theo Test Contract v1.0.

## Cài đặt và chạy (3 lệnh)

Yêu cầu: Node.js >= 18 (đã thử trên v22), macOS/Linux.

```bash
npm install --no-audit --no-fund   # chỉ cài three.js cho bản đồ họa
npm test                           # (tùy chọn) 24 test tự chấm theo contract
npm start                          # mở http://localhost:8080 (đổi cổng: node server.js 9000)
```

Chế độ headless **không cần** `npm install` (không phụ thuộc gói ngoài):

```bash
node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl
node headless.js --seed 7 --night 1 --scenario s.json --inputs i.json --ticks 1800 --out out.jsonl --snapshot-every 10
```

Mã thoát: `0` thành công · `1` sai tham số/lỗi chạy · `2` file inputs/scenario sai định dạng (stderr có thông báo).

## Điều khiển

| Phím | Tác dụng |
|---|---|
| W A S D / mũi tên | Di chuyển (theo hướng camera) |
| Space | Nhảy |
| E | Nạp ánh sáng đang mang vào đèn gần nhất (trong 3 m) |
| F | Tỏa sáng: choáng và đẩy lùi Bóng Mực trong 8 m, tốn 1 ánh sáng |
| Q / R hoặc kéo chuột | Xoay camera |
| Enter | Chơi lại sau khi thắng/thua |

## Luật chơi và cách tính điểm

- Mây có 3 ngọn lửa (máu). Bóng Mực chạm vào: mất 1 lửa, đánh rơi một nửa số ánh sáng đang mang (làm tròn xuống), bất tử 2 giây.
- Mang tối đa 5 ánh sáng. Mỗi đèn cần 5 ánh sáng để sáng.
- Thắng khi cả 5 đèn sáng. Thua khi hết lửa hoặc hết 300 giây (trời sáng).
- Bóng Mực không vào được trong 4 m quanh mỗi đèn (đèn là nơi trú).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp sáng 1 đèn | +100 |
| Làm choáng 1 Bóng Mực | +20 |
| Thắng: mỗi giây còn lại | +2 |
| Thắng: mỗi ngọn lửa còn lại | +50 |

## Test Contract v1.0

- `game.contract.json`: sinh từ `src/tuning.js` (`npm run contract`); test đối chiếu để khai không sai.
- Mọi giá trị `tuning` đều có trong game. `fall_enabled=false`: rìa đảo chỉ chặn người chơi, không có rơi hay phạt rơi (nên không bao giờ ghi sự kiện `player_hit` với `by: "fall"`).
- Hằng số nội bộ ngoài contract (`src/tuning.js`, mục `EXTRA`): bán kính đảo 40 m, đèn xếp vòng bán kính 25 m, 20 đom đóm ban đầu (tối đa 24, mỗi 3 s hồi 1), Bóng Mực đầu tiên ở giây thứ 8 rồi mỗi 12 s (tối đa 4), nhảy cao khoảng 1,6 m.

## Sáng tạo của tôi

Chỉ là phần hiển thị và âm thanh trên trình duyệt, **không** đụng tới lõi `Sim`, nên đầu ra headless không đổi:

- Đảo sáng dần: ánh sáng môi trường tăng theo số đèn đã thắp; đèn đang được nạp sáng dần theo lượng ánh sáng đã nạp.
- Vòng cam quanh mỗi đèn thể hiện vùng trú an toàn 4 m; vòng tỏa sáng lan ra khi bấm F.
- Mây đội nón lá treo đèn lồng nhỏ, nhấp nháy khi đang bất tử; Bóng Mực dẹt lại khi bị choáng.
- Âm thanh bíp bằng Web Audio khi nhặt, nạp, thắp đèn, tỏa sáng và bị chạm.

Bằng chứng phần cũ vẫn đúng: `npm test` (24 đạt) và `evidence/bot-seed1.*` (xem `docs/NOTES.md`).

## Cấu trúc

```
src/tuning.js   số liệu (nguồn sự thật)   src/sim.js   lõi mô phỏng 60 tick/s, tất định
headless.js     CLI contract              server.js    máy chủ tĩnh cho bản chơi
public/         index.html + main.js (Three.js)        tests/run.mjs   bộ test
scripts/        gen-contract.js, bot.mjs  evidence/    bằng chứng chạy      docs/   kế hoạch, ghi chú
```
