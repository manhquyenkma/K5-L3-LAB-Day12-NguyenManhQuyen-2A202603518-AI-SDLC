# Báo cáo Hiệu năng & Tối ưu (M10 — Phase 2)

Mọi số đo dưới đây chạy trực tiếp bằng `node scripts/bench.mjs` trên máy thực tế, sau khi toàn bộ 61 test (gồm cổng chặn log vàng `tests/phase2/m10-golden.mjs`) đều xanh.

## 1. Môi trường đo
- **Runtime:** Node.js `v26.13.1` (`win32/x64`)
- **CPU:** `11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz`

## 2. Kết quả đo Headless (`node scripts/bench.mjs`)

| Kịch bản | Tick | `--snapshot-every` | Thời gian | Dung lượng file | Mục tiêu đề (≤ 30 s) | Mục tiêu nội bộ (≤ 5 s) |
|---|---:|---:|---:|---:|---|---|
| Đêm 1 — Đảo Bến | 18.000 | 10 | **313 ms** | 1.05 MB | Đạt (nhanh hơn ~95×) | Đạt |
| Đêm 2 — Đảo Cau | 19.800 | 10 | **237 ms** | 0.55 MB | Đạt (nhanh hơn ~126×) | Đạt |
| Đêm 3 — Đảo Chuông | 21.600 | 10 | **285 ms** | 0.65 MB | Đạt (nhanh hơn ~105×) | Đạt |
| Đêm 1 — Đảo Bến | 18.000 | 1 | **470 ms** | 10.46 MB | Đạt | Đạt |
| Đêm 2 — Đảo Cau | 19.800 | 1 | **416 ms** | 5.49 MB | Đạt | Đạt |
| Đêm 3 — Đảo Chuông | 21.600 | 1 | **526 ms** | 6.49 MB | Đạt | Đạt |

- **Đo in-process Đêm 3 (21.600 tick + 21.600 snapshot):** **`126 ms`**, **Peak RSS = `50.1 MB`**, **Peak Heap = `7.9 MB`** (ngưỡng mục tiêu < 300 MB → đạt dư 6×).

## 3. Các hạng mục tối ưu đã áp dụng

| Mã | Hạng mục | Thực hiện | Trạng thái cổng chặn |
|---|---|---|---|
| O1 | Ghi log headless theo luồng | `headless.js` dùng `openSync`/`writeSync` xả lô mỗi 500 dòng thay vì giữ mảng 21.600 dòng trong RAM | Log vàng khớp 100% từng byte (`m10-golden.mjs`) |
| O2 | Giảm cấp phát vòng lặp nóng | Tái dùng `this._moveTmp` trong `Sim`/`terrain.js`, dùng vòng `for` chỉ số thay vì `.slice()`/`.filter()` thừa | `npm test` 61/61 xanh |
| O3 | Truy vấn địa hình O(1) thuần | `src/terrain.js` kiểm tra khoảng cách bằng bình phương `r²`, không dùng thư viện vật lý | 3 đêm chạy 0.12–0.53 s |
| O5 | Giới hạn đèn điểm thật (GPU) | Tối đa 3 `PointLight` thật (đèn Mây + 2 đèn sáng gần nhất); các đèn còn lại dùng vật liệu `emissive` | Áp dụng trong `public/main.js` |
| O6 | `InstancedMesh` cho vật thể lặp | Gộp toàn bộ đom đóm (lõi + quầng) và 40 lá bay báo gió Đêm 3 bằng `InstancedMesh` | Áp dụng trong `public/main.js` |
| O7 | Tự giảm `devicePixelRatio` | Trần `1.5`, tự hạ xuống `1.0` nếu trung bình 3 s < 40 FPS; hỗ trợ bộ đếm `?fps` (avg + p5) | Áp dụng trong `public/main.js` |
| O9 | Dọn tài nguyên khi đổi Đêm | `disposeGroup()` giải phóng hình học/vật liệu cũ mỗi khi chuyển Đêm | Áp dụng trong `public/main.js` |
| O10 | Quản lý Web Audio gọn | Một `AudioContext`, giới hạn đồng thời tối đa 12 voice (`maxVoices = 12`) | Áp dụng trong `public/audio.js` |
