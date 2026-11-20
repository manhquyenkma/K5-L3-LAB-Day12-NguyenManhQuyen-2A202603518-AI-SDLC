# TICKET-04 — "Bình minh: phát hành v1.0.0" (Phase 4)

Loại: Non-functional + Release · Ưu tiên: Cao · Tag nộp: `phase-4` + GitHub Release `v1.0.0` · Contract: `v1.3`

## Mục tiêu
Đưa game từ "chạy được" thành sản phẩm phát hành được: đo được hiệu năng, ổn định khi chạy lâu, có bảng xếp hạng cục bộ, dễ tiếp cận, cài đặt dễ dàng (≤ 3 lệnh từ repo sạch). Trong cảnh benchmark và soak test, mọi hiệu ứng sáng tạo thêm phải tắt hoặc không ảnh hưởng số đo.

## 1. Chế độ benchmark (bắt buộc)
- Lệnh: `<bench_cmd> --seed 42 --duration 30 --out bench.json` (`bench_cmd: "node bench.js"`).
- Cửa sổ `1280×720`, không toàn màn hình; tắt vsync nếu engine cho phép (ghi rõ trong README).
- Tải Đêm 1 đầy đủ hiệu ứng & ánh sáng như lúc chơi thật.
- Sinh đúng **200 Bóng Mực** ở trạng thái `wander`, rải đều trên đảo (seed 42), và đúng **100 đom đóm**. 3 đèn `L1–L3` sáng với `fuel = 100`.
- Tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu, điều kiện kết thúc Đêm. Bóng Mực vẫn `wander` bình thường.
- Mây đứng yên tại `(0,0,0)`. Camera bay vòng tròn tâm `(0,0,0)`, bán kính `30 m`, `Y = 15 m`, luôn nhìn vào `(0,0,0)`, xuất phát góc `0°` tại `(30,15,0)`, quay ngược chiều kim đồng hồ khi nhìn từ trên xuống, `15 s` một vòng.
- `3 s` đầu khởi động (không đo), sau đó đo đúng `--duration` giây rồi tự thoát mã `0`.
- Output `bench.json`: `contract_version: "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`.
- Ngưỡng đạt trên máy chấm: `avg_fps ≥ 60` · `p1_low_fps ≥ 30` · `load_ms ≤ 10000`.

## 2. Soak test (bắt buộc)
- Lệnh: `<soak_cmd> --seed 7 --nights 10 --out soak.json` (`soak_cmd: "node soak.js"`).
- Chạy headless 10 Đêm liên tiếp trong cùng tiến trình (Đêm `1 → 2 → 3` xoay vòng), Đêm thứ `i` dùng seed `7 + i`, chạy tới khi kết thúc hoặc hết thời lượng chuẩn.
- Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng di chuyển; mỗi tick xác suất `5%` nhảy, `3%` lướt, `2%` tỏa sáng, `10%` tương tác.
- `mem_start_mb`: RSS sau khi tải xong Đêm đầu tiên; `mem_end_mb`: RSS sau khi reset xong Đêm cuối cùng.
- Output: `{"nights": 10, "crashes": 0, "results": [...], "mem_start_mb": ..., "mem_end_mb": ..., "duration_s": ...}`.
- Ngưỡng đạt: `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`.

## 3. Bảng xếp hạng cục bộ
- Hiện nhập tên sau màn Bình Minh (thắng Đêm 3) hoặc sau khi thua bất kỳ Đêm nào.
- Tên: `3–12` ký tự `[A-Za-z0-9_]` (hỗ trợ tiếng Việt có dấu).
- Lưu: `name`, `score` (tổng điểm các Đêm đã thắng), `nights_won` (`0–3`), `achieved_at` (ISO 8601 có múi giờ), `seed`.
- Giữ top 10, sắp xếp `score` giảm dần; bằng điểm ai đạt trước đứng trên.
- Lưu trên đĩa cục bộ (`data/leaderboard.json`), giữ qua các lần tắt/mở.
- Có màn hình Bảng xếp hạng từ menu chính.
- Lệnh xuất: `<run_cmd> --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự.

## 4. Dễ tiếp cận (Accessibility)
- **Đổi phím:** mọi hành động (4 hướng di chuyển, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), phát hiện trùng phím & báo người dùng, nút `"Khôi phục mặc định"`, được lưu.
- **Phụ đề / chỉ báo hình ảnh:** Bóng Mực xuất hiện (kèm mũi tên chỉ hướng mép màn hình), gió sắp thổi, 10 s cuối, đèn có `fuel < 30`.
- **Giảm chuyển động:** tắt rung camera và hiệu ứng chớp màn hình.
- **Cỡ chữ UI:** tối thiểu `18 px` ở `1280×720`; tùy chọn chữ lớn (`×1.25`).

## 5. Đóng gói & Tài liệu
- Clone repo sạch → theo README tối đa 3 lệnh → chơi được.
- `README.md` đủ link video demo đầu trang, mô tả ngắn, ảnh chụp màn hình, yêu cầu hệ thống, cài đặt, điều khiển, cách chạy test/headless/bench/soak.
- `CHANGELOG.md` đủ 4 phase · `CREDITS.md` đủ asset, âm thanh, công cụ AI · `LICENSE`.
- GitHub Release `v1.0.0` có bản chạy được (web tĩnh tự chạy / Docker kèm hướng dẫn).

## 6. Test Contract v1.3
- `contract_version: "1.3"`, `game.contract.json` thêm `bench_cmd` và `soak_cmd`. Giữ nguyên toàn bộ yêu cầu v1.0–v1.2.

## 7. Retro & Demo + DoD
- Bản retro 1–2 trang (`docs/RETRO.md`).
- Video demo `.mp4` dưới 5 phút (đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`).
- `bench.json` và `soak.json` tự chạy commit vào repo; tag `phase-4` và Release `v1.0.0`; mọi test ẩn Phase 1–3 đạt.
