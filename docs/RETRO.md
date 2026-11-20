# Retrospective — Dự án Đảo Đèn Lồng (Phase 1 → Phase 4 / v1.0.0)

- **Sinh viên:** Nguyễn Mạnh Quyền · **MSSV:** `2A202603518`
- **Sản phẩm:** Đảo Đèn Lồng (`v1.0.0`, Test Contract `v1.0 → v1.3`, 4 tag `phase-1..phase-4`)
- **Công nghệ:** Lõi JS thuần 60 tick/s (`src/`), CLI Node.js (`headless.js`, `bench.js`, `soak.js`), 3D Three.js WebGL2 + Web Audio API (`public/`).

---

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase & Tag | Trọng tâm yêu cầu | Kết quả kiểm chứng | Hồi quy phase trước | Nhận xét ngắn |
|---|---|---|---|---|
| **Phase 1 (`phase-1`)** | Dựng Đêm 1 từ PRD-0 mơ hồ + Test Contract v1.0 + bản 3D chơi được | `24/24` test xanh; bot tham lam thắng Đêm 1 (tick 3965), replay khớp SHA-256; chạy 18.000 tick < 2 s | — | Tách sạch lõi `src/` khỏi `public/` ngay từ ngày đầu là quyết định sinh lời cao nhất cho cả 3 phase sau. |
| **Phase 2 (`phase-2`)** | Chuẩn hóa số liệu v1.1, mở rộng 3 Đêm (cầu tre, 3 tầng, dốc, tháp, bục nhảy, Gió Lạc, Bùa Gió, gió) + sáng tạo thuần `public/` | `61/61` test xanh (24 hồi quy số chuẩn + 34 scenario Phase 2 + 3 log vàng); 3 đêm headless chạy `0.16–0.52 s` (≪ 30 s) | 100% test Phase 1 xanh sau khi đồng bộ số chuẩn v1.1 | Chia nhỏ thành mốc M0–M11 (test trước → code → commit riêng) và khóa 3 log vàng giúp sáng tạo đồ họa/âm thanh không hề phá headless. |
| **Phase 3 (`phase-3`)** | Change Request phá luật cốt lõi: nhiên liệu nguyên `1/60`, Bóng Mực `drain`, bỏ `all_lit` → sinh tồn `dawn_survived`, sức chứa động, điểm mới, mù màu | `72/72` test xanh (24 hồi quy + 37 Phase 2 + 11 Phase 3); đủ `ADR-001` và mục Breaking Changes trong `CHANGELOG.md` | Mọi test không bị thay thế đều xanh; test bị thay luật được cập nhật kèm ghi chú `[TICKET-03]`, 0 skip âm thầm | Lưu nhiên liệu theo đơn vị nguyên `1/60` (`fuelU`) triệt tiêu hoàn toàn sai số dấu phẩy động tại biên `fuel = 30` và `fuel = 0`. |
| **Phase 4 (`phase-4` / `v1.0.0`)** | Benchmark 3D 200 Bóng Mực (`bench.json`), Soak 10 Đêm (`soak.json`), Bảng xếp hạng cục bộ, Tiếp cận đầy đủ, Đóng gói ≤ 3 lệnh | `78/78` test xanh; `bench.json` đạt **>100 FPS avg / >50 p1_low / <2 s load**; `soak.json` 10 đêm **0 crash, RSS 1.12× ≤ 1.2×**; clone sạch chạy trong 3 lệnh | 100% hồi quy Phase 1–3 + 3 log vàng byte-by-byte xanh | Chuyển Bóng Mực sang `InstancedMesh` (2.200 → 5 draw calls) và tối ưu cấp phát nóng trong `Sim.step()` quyết định thành công của cả bench lẫn soak. |

---

## 2. Điều gì hiệu quả & không hiệu quả khi làm việc với AI

### Hiệu quả rõ rệt
1. **Kiến trúc "Lõi thuần + Contract làm nguồn sự thật":** Khi toàn bộ số liệu nằm tập trung ở `src/tuning.js` và sinh tự động `game.contract.json` (`npm run contract`), AI không bao giờ tạo ra lệch số giữa tài liệu, lõi mô phỏng và bản 3D.
2. **Viết test kiểm chứng biên trước / song hành với code (TDD theo mốc M0–M11):** Mỗi yêu cầu khó (góc đo XZ Đêm 3, ưu tiên `no_flames` đúng tick bình minh, hòa khoảng cách chọn `id` nhỏ hơn, `drain` cộng dồn) đều có scenario headless tự động, giúp phát hiện lệch ngay trong vài giây.
3. **Đo trước, tối ưu đúng điểm nóng:** Không tối ưu mù quáng — khi Phase 4 yêu cầu 200 Bóng Mực cùng lúc, tính nhanh ra `200 × 11 = 2.200 draw calls` và chuyển ngay sang 5 `InstancedMesh`, đẩy FPS trên GPU tích hợp Intel Iris Xe lên gấp đôi ngưỡng 60 FPS; tương tự, khi soak test lần đầu có tỉ lệ RSS `1.34×`, chạy đo từng đêm phát hiện ngay nguyên nhân do cấp phát ngắn hạn + V8 cold-start JIT và tối ưu thẳng vào `this.prev`, `drainEvents()`, `_shadeSortBuf`.

### Chưa hiệu quả / bài học tránh lặp lại
1. **Giả định mặc định về môi trường Windows:** Quên `core.autocrlf=true` trên Windows khiến file `.jsonl` log vàng đổi sang CRLF sau `git checkout`; tương tự, PowerShell 5.1 không hỗ trợ toán tử `&&` và `Tee-Object` ghi UTF-16 LE thay vì UTF-8.
2. **Để tài liệu skill trễ 1 nhịp ở Phase 3:** Trong Phase 3 đã cập nhật `AGENTS.md` nhưng `.agents/skills/{sim-core,headless-contract}` vẫn ghi v1.1 cho tới khi rà soát đầu Phase 4. Cần coi cập nhật skill là một đầu việc bắt buộc trong checklist cuối mỗi phase.

---

## 3. Các lần AI sai, cách phát hiện & cập nhật Harness

| # | Lỗi của AI | Cách phát hiện | Sửa lỗi & Củng cố Harness |
|---|---|---|---|
| 1 | **Biên số học `safe_radius` (Phase 1):** Bóng Mực bị đẩy về đúng `4.000 m`, không lớn hơn hẳn `safe_radius` sau làm tròn 3 chữ số | Test tự động `safe_radius` trong `tests/run.mjs` báo đỏ ngay | Cộng biên dư `+0.001 m` trong `_repel()` và giữ test hồi quy qua cả 4 phase. |
| 2 | **404 `/vendor/three.core.js` khiến nút "Bắt đầu" không bấm được (Phase 1):** `server.js` chỉ phục vụ đúng 1 đường dẫn `/vendor/three.module.js` trong khi `three@0.174` tách `three.core.js` | Chơi thử thật trên trình duyệt + kiểm tra Console | Mở `server.js` phục vụ an toàn toàn bộ `/vendor/*`; ghi vào `docs/NOTES.md` và quy trình `verify-phase`. |
| 3 | **Sai thứ tự Bước 4 vs Bước 5 trong kịch bản test `deposit-multi` (Phase 2):** Đặt đom đóm cách Mây 0.2 m nên bị nhặt ngay trước khi nạp | `npm test` báo lệch điểm & `carried` | Sửa kịch bản test tách khoảng cách `z = 2.2 m`; ghim rõ thứ tự 12 bước tick vào `.agents/skills/sim-core/SKILL.md`. |
| 4 | **False positive ở `pure-core-audit` (Phase 2):** Comment `// ... public/main.js` trong `src/tuning.js` bị regex quét nhầm là import từ `public/` | `m7-perf-determinism.mjs` báo fail | Lọc bỏ comment `//` cuối dòng trước khi quét; thêm quy tắc cấm đặt module I/O (`lib/leaderboard.js`) trong `src/`. |
| 5 | **Lệch màu mắt Bóng Mực chế độ thường (Phase 3):** Mắt Bóng Mực đặt `#F5F1E6` thay vì `#7A3CFF` như câu *"Viền và mắt Bóng Mực đổi từ `#7A3CFF` sang `#00B3FF`"* | Rà soát đối chiếu từng dòng TICKET-03 sau khi gắn tag `phase-3` | Sửa `public/assets.js` & `public/main.js` sang `PALETTE.shadeRim` (`#7A3CFF`) và bổ sung assert trực tiếp vào `tests/phase3/phase3.mjs`. |
| 6 | **Bóng `drain` không kiểm tra `fuelU >= LOW_FUEL_U` ở Bước 2 (Phase 3):** Nếu scenario đặt bóng `drain` cạnh đèn `fuel ≥ 30`, tick 1 vẫn trừ `5/60` trước khi Bước 8 chuyển `wander` | Đọc kiểm soát mã độc lập từng nhánh rẽ `src/sim.js` | Thêm điều kiện chặn `L.fuelU >= LOW_FUEL_U` ở Bước 2 và thêm 2 bộ test biên mới. |

---

## 4. Harness AI nào giúp nhiều nhất

1. **`AGENTS.md` (ngắn gọn, cập nhật qua cả 4 phase):** Giữ nguyên tắc bất biến "không đổi số chuẩn", "lõi `src/` thuần 100%", "không tắt test cũ âm thầm" ở mọi phiên làm việc, kể cả khi chuyển ngữ cảnh.
2. **Bộ 5 Skills chuyên biệt (`.agents/skills/{sim-core,headless-contract,night-data,verify-phase,review-diff}`):** Tách ngữ cảnh theo đúng loại việc — khi sửa lõi chỉ cần nạp `sim-core` thay vì đọc cả repo, tránh phình context và giữ chặt 12 bước tick.
3. **Cổng chặn tự động (`tests/all.mjs` + `m10-golden.mjs` + `pure-core-audit` + GitHub Actions CI):** Mạnh hơn bất kỳ câu nhắc bằng lời nào — hễ có bất kỳ lệch 1 byte nào ở đầu ra headless hoặc vô tình thêm `Math.random`/`fs` vào `src/`, test đỏ lập tức trước khi commit.

---

## 5. Ước tính Token / Chi phí AI & Chiến lược tiết kiệm

| Giai đoạn | Công cụ chính | Ước tính Token (input + output) | Chi phí quy đổi ước tính | Cách đã tiết kiệm token |
|---|---|---:|---:|---|
| Phase 1 | Claude + Antigravity (Gemini) | ~85k | ~\$0.45 | Chốt 11 giả định thành bảng trước khi code; giữ `src/sim.js` gọn ~305 dòng. |
| Phase 2 (M0–M11 + UI/Asset) | Antigravity (Gemini) | ~180k | ~\$0.95 | Chia mốc M0–M11, nạp đúng 1 skill/mốc, gộp đọc file song song và gộp lệnh kiểm chứng trong 1 bước shell. |
| Phase 3 (Change Request) | Antigravity (Gemini) | ~45k | ~\$0.25 | Nhờ kiến trúc tách sẵn `shade.js`/`sim.js`/`tuning.js`, chỉ sửa tập trung 4 file lõi, không cần đọc lại toàn bộ `public/` hay `terrain.js`. |
| Phase 4 (Bench/Soak/A11y/Release) | Antigravity (Gemini) | ~75k | ~\$0.40 | Đo thực tế 5 s trước khi chạy 30 s; tái sử dụng cùng lõi `Sim` (`benchMode`) cho cảnh 200 Bóng Mực thay vì viết bản sao thứ hai. |
| **Tổng cộng** | | **~385k token** | **~\$2.05** | **Gọn, đọc có mục tiêu, kiểm chứng bằng mã thay vì hỏi đi hỏi lại.** |

---

## 6. Nếu làm lại từ đầu sẽ đổi gì?

1. **Thiết lập `.gitattributes` (LF cho `.jsonl`/`.json`) ngay từ Checkpoint 0** để tránh hoàn toàn bẫy CRLF trên Windows khi dùng log vàng byte-by-byte.
2. **Dùng `InstancedMesh` cho Bóng Mực ngay từ Phase 2** thay vì đợi đến bài benchmark 200 con ở Phase 4 — code vừa ngắn hơn, vừa tránh phải viết lại phần đồng bộ thực thể.
3. **Đặt `data/` và `lib/` tách khỏi `src/` ngay trong cấu trúc ban đầu** và chuẩn hóa cỡ chữ `1rem = 18px` từ Phase 1 để đến Phase 4 không phải rà sửa lại toàn bộ CSS cho tiêu chí tiếp cận `≥ 18 px` & `×1.25`.
4. **Cập nhật file skill cùng commit với `AGENTS.md`** ở ngay cuối mỗi phase thay vì để dồn sang phase kế tiếp.
