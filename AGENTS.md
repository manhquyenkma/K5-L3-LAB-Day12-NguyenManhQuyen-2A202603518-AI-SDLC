# AGENTS.md — Harness AI cho Đảo Đèn Lồng (Phase 3, Contract v1.2)

Quy tắc bắt buộc cho mọi agent làm việc trong repo này.

## Nguyên tắc cốt lõi
1. **Nguồn sự thật duy nhất:** `docs/TICKET-03.md` (Phase 3, Contract v1.2 — kế thừa và ghi đè các mục được đánh dấu `[THAY THẾ]` trong `docs/TICKET-02.md`) và `docs/ADR-001-phase3-lantern-fuel-and-win-rule.md`. **Không đổi số chuẩn, không làm thêm ngoài đề.**
2. **Tách sạch lõi & hiển thị:** `src/tuning.js`, `src/nights/*`, `src/terrain.js`, `src/entities/*`, `src/sim.js` là JS thuần. **Cấm** `Math.random`, `Date`, `performance`, DOM, I/O trong lõi. Mọi ngẫu nhiên chỉ qua `this.rng` (mulberry32 theo `--seed`).
3. **Sáng tạo không làm lệch headless:** Giữ nguyên các sáng tạo hiển thị/âm thanh Phase 1 trong `public/`; tuyệt đối không để phần hiển thị làm đổi đầu ra `headless.js`.
4. **Không có bằng chứng thì chưa xong:** Mỗi mốc M0..M9 phải: viết test trước → code → `npm test` xanh toàn bộ (kể cả hồi quy Phase 1) → commit riêng 1 commit rõ ràng.
5. **Trung thực & tiết kiệm token:** Chỗ đề mơ hồ dùng `docs/ASSUMPTIONS.md`, không tự bịa thêm. Không tắt test cũ âm thầm; nếu luật mới thay luật cũ phải ghi rõ lý do trong `docs/ASSUMPTIONS.md` và test.

## Kiến trúc & Quy ước Phase 2
- **Dữ liệu tách khỏi logic:** Bản đồ 3 Đêm nằm ở `src/nights/n1.js`, `n2.js`, `n3.js`; truy vấn địa hình ở `src/terrain.js`; FSM ở `src/entities/shade.js`, `src/entities/drifter.js`; vòng tick ở `src/sim.js`.
- **Thứ tự 12 bước trong `Sim.step()` là bắt buộc** (xem `.agents/skills/sim-core/SKILL.md`).
- **Hiệu năng:** Headless 1 Đêm đầy đủ (≤ 21.600 tick) phải ≤ 30 s; tránh cấp phát rác không cần thiết trong vòng lặp nóng.
- **Bảo mật & Git:** Cấm commit `.env`/key; cấm xóa harness hoặc force-push sau khi gắn tag.

## Skills chuyên biệt (nạp đúng skill theo tác vụ)
- `.agents/skills/sim-core/SKILL.md` — Quy tắc lõi thuần, 12 bước tick, RNG & tối ưu hiệu năng.
- `.agents/skills/headless-contract/SKILL.md` — Schema Test Contract v1.1, mã thoát 0/1/2, quy ước snapshot/event/scenario.
- `.agents/skills/night-data/SKILL.md` — Quy ước bản đồ chuẩn 3 Đêm, góc từ +X ngược chiều kim đồng hồ trên XZ.
- `.agents/skills/verify-phase/SKILL.md` — Cổng kiểm chứng cuối mỗi mốc/phase trước khi gắn tag.
- `.agents/skills/review-diff/SKILL.md` — Rà soát độc lập trước khi phát hành.

## Lệnh chuẩn
`npm test` · `npm run contract` · `node headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl` · `npm start`
