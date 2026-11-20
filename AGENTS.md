# AGENTS.md — Harness AI cho Đảo Đèn Lồng (Phase 4, Contract v1.3, v1.0.0)

Quy tắc bắt buộc cho mọi agent làm việc trong repo này.

## Nguyên tắc cốt lõi
1. **Nguồn sự thật duy nhất:** `docs/TICKET-04.md` (Phase 4, Contract v1.3 — kế thừa toàn bộ luật v1.2 tại `docs/TICKET-03.md`, `docs/ADR-001-phase3-lantern-fuel-and-win-rule.md` và phần không bị thay thế của `docs/TICKET-02.md`). **Không đổi số chuẩn, không làm thêm ngoài đề.**
2. **Tách sạch lõi & hiển thị:** `src/tuning.js`, `src/nights/*`, `src/terrain.js`, `src/entities/*`, `src/sim.js` là JS thuần. **Cấm** `Math.random`, `Date`, `performance`, DOM, I/O trong `src/`. Mọi ngẫu nhiên chỉ qua `this.rng` (mulberry32 theo `--seed`). Logic lưu đĩa (như bảng xếp hạng `lib/leaderboard.js`) phải nằm ngoài `src/`.
3. **Sáng tạo không làm lệch headless/bench/soak:** Mọi sáng tạo hiển thị/âm thanh nằm ở `public/`, tuyệt đối không làm đổi đầu ra `headless.js`, và phải tắt/không ảnh hưởng số đo trong `bench.js` và `soak.js`.
4. **Không có bằng chứng thì chưa xong:** Mỗi mốc phải: viết test → code → `npm test` xanh toàn bộ (hồi quy Phase 1–3 + Phase 4 + log vàng) → đo thật (`bench.json`, `soak.json`) → commit nhỏ, rõ ràng.
5. **Trung thực & tiết kiệm token:** Không sửa tay số đo, không tắt test cũ âm thầm. Giữ commit gọn, đọc đúng file cần sửa.

## Kiến trúc tổng thể (v1.0.0)
- **Lõi thuần (`src/`):** `tuning.js` · `nights/{n1,n2,n3,index}.js` · `terrain.js` · `entities/{shade,drifter}.js` · `sim.js`.
- **CLI & Công cụ đo (Contract v1.3):**
  - `headless.js` — mô phỏng 60 tick/s theo Contract v1.3 (mã thoát `0/1/2`).
  - `bench.js` — benchmark đồ họa 3D 1280×720 (`--seed 42 --duration 30 --out bench.json`, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng).
  - `soak.js` — kiểm thử bền bỉ 10 Đêm liên tiếp cùng tiến trình (`--seed 7 --nights 10 --out soak.json`).
  - `server.js` + `lib/leaderboard.js` — máy chủ chơi 3D, API bảng xếp hạng lưu đĩa cục bộ & `--export-leaderboard out.json`.
- **Hiển thị & Tiếp cận (`public/`):** `index.html`, `main.js`, `assets.js`, `audio.js` (InstancedMesh Bóng Mực/Đom đóm, chế độ mù màu, đổi phím có báo trùng, phụ đề/mũi tên, giảm chuyển động, chữ ≥ 18 px & ×1.25).
- **Bảo mật & Git:** Cấm commit `.env`/key; cấm xóa harness hoặc force-push sau khi gắn tag (`phase-1`..`phase-4`).

## Skills chuyên biệt (nạp đúng skill theo tác vụ)
- `.agents/skills/sim-core/SKILL.md` — Lõi thuần v1.3, 12 bước tick, nhiên liệu nguyên `1/60`, 6 trạng thái Bóng Mực & `benchMode`.
- `.agents/skills/headless-contract/SKILL.md` — Test Contract v1.3, schema v1.2/v1.3, `bench_cmd`, `soak_cmd`, mã thoát `0/1/2`.
- `.agents/skills/night-data/SKILL.md` — Quy ước bản đồ chuẩn 3 Đêm.
- `.agents/skills/verify-phase/SKILL.md` — Cổng kiểm chứng cuối phase (test, bench, soak, clean-clone ≤ 3 lệnh) trước khi gắn tag.
- `.agents/skills/review-diff/SKILL.md` — Rà soát độc lập trước phát hành.

## Lệnh chuẩn
- Cài & chạy: `npm install --no-audit --no-fund` · `npm start`
- Kiểm thử & hợp đồng: `npm run contract` · `npm test`
- Chế độ Contract v1.3:
  - `node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`
  - `node bench.js --seed 42 --duration 30 --out bench.json`
  - `node soak.js --seed 7 --nights 10 --out soak.json`
  - `node server.js --export-leaderboard out.json`
- Đóng gói phát hành: `npm run build:release`
