# ADR-001: Chuyển đổi mô hình trạng thái đèn sang nhiên liệu nguyên 1/60 và luật thắng sinh tồn tới bình minh (Phase 3 / Contract v1.2)

- **Trạng thái:** Đã áp dụng (Phase 3, `contract_version: "1.2"`)
- **Bối cảnh:** [TICKET-03.md](TICKET-03.md) thay thế 4 quy tắc cốt lõi của Phase 1–2: (1) đèn đã sáng bị hao dầu và cần châm/thắp lại, (2) Bóng Mực có thể vào vùng đèn yếu (`fuel < 30`) để hút dầu (`drain`), (3) bỏ thắng sớm `all_lit`, thay bằng sinh tồn tới bình minh (`dawn_survived`) với ≥ 60% đèn sáng, và (4) toàn bộ công thức điểm mới + sức chứa tăng dần.

## 1. Quyết định thiết kế — Mô hình trạng thái Đèn Lồng

### Vấn đề
Ở Phase 1–2, mỗi đèn chỉ có 2 trường trạng thái `{ lit: boolean, deposited: int }`, chuyển một chiều `unlit → lit`. Khi thêm hao hụt `1/60` đơn vị/tick và hút dầu `5/60` đơn vị/tick, nếu lưu `fuel` bằng số thực IEEE-754 (`fuel -= 1/60`) sẽ phát sinh sai số tích lũy tại mốc biên nhạy cảm `fuel === 30` (vùng an toàn) và `fuel <= 0` (tắt đèn), làm lệch tính tất định giữa các kịch bản.

### Giải pháp đã chọn
- **Đơn vị nguyên `fuelU` (1 đơn vị = `1/60` dầu):**
  - `FUEL_MAX_U = 6000` (`100.0`), `LOW_FUEL_U = 1800` (`30.0`), `FUEL_PER_MOTE_U = 600` (`10.0`).
  - Hao tự nhiên mỗi tick ở Bước 2: `-1`; mỗi Bóng Mực đang `drain`: `-5` (cộng dồn nhiều con).
  - So sánh vùng an toàn chính xác tuyệt đối bằng số nguyên: `L.lit && L.fuelU >= 1800` (đúng `30.0` vẫn còn vùng an toàn; `29.983` = `1799` mất vùng an toàn).
  - Chỉ đổi sang số thực 1 chữ số thập phân `r1(L.fuelU / 60)` tại ranh giới xuất snapshot/sự kiện (`fuel: 0` khi tắt).
- **Vòng đời đèn mở rộng:** `{ lit, deposited, fuelU, everLit, relitCount }`:
  - `unlit (everLit=false)` cần `10` đom đóm → thắp lần đầu: `lit=true, fuelU=6000, everLit=true`, `lantern_lit { relight: false }`, `+100`.
  - `lit` có thể châm dầu nếu `fuelU < 6000`: `used = min(carried, ceil((6000 - fuelU) / 600))`. Đèn đầy (`used === 0`) bị loại ngay khỏi vòng chọn tương tác để Mây tự động nạp cho đèn khác trong tầm (nếu có). Khi châm từ `< 1800` lên `>= 1800`, tái kích hoạt đẩy Bóng Mực trong `6 m` ra mép trong ≤ 30 tick (tái sử dụng cơ chế `expelTicks` của Phase 2).
  - `fuelU <= 0` ngay sau Bước 2 → `lit=false, fuelU=0, deposited=0, everLit=true`, phát `lantern_out`.
  - `unlit (everLit=true)` chỉ cần `5` đom đóm (`relight_cost`) → thắp lại: `relitCount++`, `lantern_lit { relight: true }`, `+40`.

### Bóng Mực 6 trạng thái (`src/entities/shade.js`)
- Bổ sung trạng thái thứ 6: `drain`, kèm `targetLanternId` và `drainTickCount`.
- Chỉ trạng thái `wander` đi săn đèn yếu (`lit && fuelU < 1800`, hòa chọn `id` nhỏ hơn); không có đèn yếu thì đi về đèn tắt gần nhất (hòa chọn `id` nhỏ hơn) với tốc độ `wander`; khi có đèn yếu chủ động tiếp cận bằng `shadeSpeed` để kịp hút trước khi Mây châm dầu. Bóng đang `chase` giữ nguyên mục tiêu Mây.
- Đứng trong `≤ 2 m` XZ của đèn yếu → `drain` (đứng yên, hút `5/60` mỗi tick ở Bước 2, ghi `fuel_drain` mỗi 60 tick).
- Thoát `drain` theo đúng 4 điều kiện: Mây `≤ 6 m` → `chase`; trúng Tỏa Sáng → `stunned` (cộng tổng `+15` thay vì `+5`); đèn tắt / `fuelU >= 1800` / cách đèn `> 2 m` → `wander`.

## 2. Quyết định thiết kế — Luật thắng sinh tồn tới Bình Minh & Sức chứa tăng dần

- **Bỏ nhánh thắng sớm `all_lit` ở Bước 11:** Việc thắp đủ đèn chỉ tăng ánh sáng môi trường, mở rộng sức chứa và giúp chống hao hụt tới cuối đêm.
- **Thứ tự xét kết thúc tại Bước 11 (giữ bất biến ưu tiên thua):**
  1. `p.flames <= 0` → luôn thua ngay `no_flames` (kể cả tại tick cuối).
  2. `this.timeLeft <= 1e-9` (đạt tick bình minh `14400 / 16200 / 18000` tương ứng `240 / 270 / 300 s`):
     - Nếu `litCount >= Math.ceil(T.win_ratio * this.lanterns.length)` (`3/5`, `4/6`, `5/7`): thắng `dawn_survived`, cộng điểm cuối đêm `Σ (50 + Math.floor(L.fuelU / 60))` cho mọi đèn đang sáng + `50 * p.flames`. Không cộng thưởng thời gian.
     - Ngược lại: thua `dawn`.
- **Sức chứa động (`player.capacity`):** tính bằng hàm thuần `Math.min(20, 10 + 2 * p.successfulLights)`, trong đó `successfulLights` chỉ tăng khi Mây thắp thành công trong Đêm (hoặc đọc từ `scenario.player.successful_lights`), đặt lại về `0` khi tạo `Sim` mới cho mỗi Đêm.

## 3. Hệ quả & Quản lý Breaking Changes
- **Các test cũ bị ảnh hưởng trực tiếp** (đã cập nhật rõ lý do, không skip âm thầm):
  - `tests/run.mjs`: 5 test liên quan đến thời lượng Đêm 1 (`300 → 240 s`), công thức điểm (`+10 → +5/đom đóm`, bỏ thưởng thời gian), và kết thúc thắng (`all_lit → dawn_survived`).
  - `tests/phase2/m1-data-contract.mjs`, `m3`, `m6`, `m7`, `m10-golden.mjs`: cập nhật lên Contract v1.2, thời lượng mới, điểm mới và log vàng v1.2.
- **Các test không bị thay thế** (di chuyển, nhảy, lướt, bục nhảy, rơi/hồi sinh, cầu, dốc/vách/tháp, gió Đêm 3, Gió Lạc, Bùa Gió, tạm dừng, tất định, mã thoát 0/1/2) giữ nguyên 100% và tiếp tục xanh.
