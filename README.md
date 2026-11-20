# Đảo Đèn Lồng — Phase 2: "Ba hòn đảo" (Test Contract v1.1)

> **Video demo (< 5 phút):** *(Sẽ cập nhật ở Phase 4 / Release `v1.0.0`)*

Game 3D góc nhìn thứ ba: **Mây**, người giữ đèn nhỏ tuổi, vượt qua **3 Đêm** (*Đêm 1 — Đảo Bến*, *Đêm 2 — Đảo Cau*, *Đêm 3 — Đảo Chuông*), gom đom đóm, né Bóng Mực và Gió Lạc, tận dụng bục nhảy và Bùa Gió để thắp lại toàn bộ Đèn Lồng Lớn trước khi trời sáng.
Lõi logic thuần (`src/sim.js`, `src/terrain.js`, `src/nights/*`, `src/entities/*`) dùng chung cho bản chơi 3D (Three.js) và chế độ **headless** theo **Test Contract v1.1**.

## Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js ≥ 18** (macOS / Linux / Windows).

```bash
npm install --no-audit --no-fund   # chỉ cài three.js cho bản đồ họa 3D
npm test                           # chạy toàn bộ bộ test hồi quy Phase 1 + Phase 2 (58 test)
npm start                          # mở http://localhost:8080 (bật đo FPS: http://localhost:8080/?fps)
```

Chế độ headless **không cần** `npm install` (không phụ thuộc gói ngoài):

```bash
node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl
node headless.js --seed 7 --night 2 --scenario s.json --inputs i.json --ticks 1800 --out out.jsonl --snapshot-every 10
node headless.js --seed 3 --night 3 --ticks 21600 --out night3.jsonl --snapshot-every 10
```

Mã thoát: `0` thành công · `1` sai tham số/lỗi chạy · `2` file `--inputs`/`--scenario` sai định dạng (`stderr` có thông báo).

## Điều khiển

| Phím | Tác dụng |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera, tốc độ 6.0 m/s; 7.2 m/s khi có Bùa Gió) |
| `Space` | Nhảy (7.0 m/s, chỉ khi chạm đất) |
| `Shift` | **Lướt** (14 m/s trong 0.2 s, hồi chiêu 1.5 s; không hồi chiêu khi có Bùa Gió) |
| `E` | Nạp ánh sáng vào Đèn Lồng Lớn gần nhất chưa sáng (trong 2.0 m) |
| `F` | **Tỏa Sáng** (tốn 3 đom đóm, bán kính 3D 5 m, hồi chiêu 3 s: choáng & đẩy lùi Bóng Mực, xua/làm rơi đồ Gió Lạc) |
| `Q / R` hoặc kéo chuột | Xoay camera |
| `Esc` hoặc `P` | **Tạm dừng** (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật chơi & Cách tính điểm (chuẩn hóa v1.1)

- **3 Ngọn Lửa** (hồi đầy đầu mỗi Đêm). Bị Bóng Mực chạm: `−1` lửa, rơi `floor(mang/2)` đom đóm (tồn tại 8 s), bất tử 1.5 s. Rơi biển mây (`Y < −10`): `−1` lửa, mất hết đom đóm, chờ 1 s rồi hồi sinh bất tử 1.5 s (hết lửa thua ngay).
- Mang tối đa **10 đom đóm**. Mỗi Đèn Lồng Lớn cần **10 đom đóm** (nạp nhiều lần, đèn nhớ tiến độ).
- Vùng an toàn bán kính **6 m** quanh **đèn đã sáng** chặn Bóng Mực (không chặn Gió Lạc).
- Thời lượng: Đêm 1 **300 s** (5 đèn) · Đêm 2 **330 s** (6 đèn) · Đêm 3 **360 s** (7 đèn).

| Sự kiện | Điểm |
|---|---|
| Nạp 1 đom đóm vào đèn | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn | `+100` |
| Mỗi Bóng Mực trúng Tỏa Sáng | `+5` |
| Thắng: mỗi giây còn lại (`floor`) | `+2` |
| Thắng: mỗi Ngọn Lửa còn lại | `+50` |

## Test Contract v1.1

- `game.contract.json` (`contract_version: "1.1"`, `team: "2A202603518-nguyen-manh-quyen"`) sinh tự động từ `src/tuning.js` (`npm run contract`) và được kiểm tra tự động trong `npm test`.
- Hỗ trợ đầy đủ `--night 1|2|3`, 5 trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`), Gió Lạc (`drifters`), Bùa Gió (`charms`), gió mạnh Đêm 3 (`wind`), tạm dừng (`pause`/`paused`/`resumed`), và 12 bước tick bắt buộc.

## Sáng tạo của tôi

Mọi sáng tạo chỉ nằm ở tầng hiển thị/âm thanh/chữ trong `public/`, **không** chạm tới lõi `src/`, được bảo vệ bởi bài test quét import `pure-core-audit` và kiểm chứng khớp log vàng byte-by-byte:

- **Giữ nguyên sáng tạo Phase 1:** Mây đội nón lá treo đèn lồng nhỏ (nhấp nháy khi bất tử), đảo sáng dần theo tiến độ đèn, vòng cam hiển thị vùng an toàn 6 m quanh đèn đã sáng, vòng tỏa sáng lan ra khi bấm `F`, Bóng Mực dẹt lại khi bị choáng, âm thanh Web Audio thuần.
- **Sáng tạo mở rộng Phase 2 (M11 — thuần hiển thị/âm thanh/chữ):**
  - **C1 (Đảo hát):** Mỗi Đèn Lồng Lớn thắp sáng bổ sung thêm một nốt vào hòa âm thang ngũ cung (Web Audio API); thắng Đêm 3 có tiếng chuông tháp ngân vang; tắt hoàn toàn khi âm lượng = 0.
  - **C2 (Ông Đăng gợi ý):** Hiện 1 dòng gợi ý ngắn (≤ 2 s, tối đa 1 lần mỗi tình huống trong mỗi Đêm, không che HUD) khi thắp đèn đầu tiên, bị đánh lần đầu, bị Gió Lạc cướp, hoặc nhặt Bùa Gió.
  - **C3 (Hiệu ứng nhân vật):** Đèn lồng nhỏ trên nón lá lắc theo tốc độ chạy, vệt sáng khi lướt (`Shift`), gợn sương khi đáp xuống (không thêm đèn điểm, tự tắt nếu FPS < 35).
  - **C5 (Không khí từng đảo):** Cầu tre Đêm 2 đung đưa nhẹ ở hình ảnh (va chạm `Sim` giữ nguyên), chuông tháp Đêm 3 rung khi thắp đèn, màn Bình Minh chuyển trời từ `#0E1430` sang sắc ấm `#FFB347`.

Bằng chứng phần cũ & Contract v1.1 không bị ảnh hưởng: `npm test` (**61/61 đạt**, gồm 24 hồi quy Phase 1 + 34 test Phase 2 + 3 cổng chặn log vàng `evidence/golden/` khớp 100% từng byte) và `docs/PERF.md`.

## Cấu trúc

```text
src/tuning.js         số liệu chuẩn v1.1 (nguồn sự thật)
src/nights/n1..n3.js  dữ liệu bản đồ chuẩn 3 Đêm
src/terrain.js        truy vấn địa hình thuần (đảo, cầu, 3 tầng, vách, dốc, tháp, bục nhảy)
src/entities/         shade.js (FSM 5 trạng thái), drifter.js (Gió Lạc)
src/sim.js            lõi mô phỏng 60 tick/s thuần JS, 12 bước tick, tất định theo --seed
headless.js           CLI Test Contract v1.1 (--night 1|2|3, ghi luồng theo lô)
server.js             máy chủ tĩnh cho bản chơi 3D
public/               index.html, main.js (Three.js), audio.js (Web Audio API)
tests/                run.mjs (24 hồi quy Phase 1) + phase2/m1..m8.mjs + all.mjs
scripts/              gen-contract.js, bot.mjs, bench.mjs
docs/                 TICKET-02.md, PHASE2_PLAN.md, SPEC-PHASE2.md, ASSUMPTIONS.md, NOTES.md, PERF.md
AGENTS.md             harness AI + .agents/skills/ (sim-core, headless-contract, night-data, verify-phase, review-diff)
```
