# AGENTS.md: harness AI cho Đảo Đèn Lồng

Quy tắc cho mọi agent làm việc trong repo này (Claude Code, Claude chat, v.v.).

## Nguyên tắc
1. **Đúng yêu cầu > phức tạp.** Đọc PRD-0 và Test Contract v1.0 trước; mọi thay đổi không được phá contract.
2. **Lõi trước, sáng tạo sau.** Sáng tạo chỉ nằm ở `public/` (hiển thị/âm thanh) trừ khi chứng minh được headless không đổi.
3. **Không có bằng chứng thì chưa xong.** "Agent bảo chạy rồi" không tính; phải có `npm test` xanh hoặc log JSONL.
4. **Tiết kiệm token.** Không đọc lại cả repo; `src/sim.js` (khoảng 250 dòng) là nơi duy nhất chứa luật chơi.

## Quy ước kỹ thuật
- `src/sim.js` thuần: cấm `Math.random`, `Date`, DOM, I/O. Ngẫu nhiên chỉ qua `this.rng` (mulberry32 theo `--seed`).
- Mọi con số gameplay nằm ở `src/tuning.js`. Sửa số thì chạy `npm run contract` rồi `npm test`.
- Tick cố định 1/60 s. Bước k đọc input tick k, tạo trạng thái k+1, sự kiện ghi `tick = k+1`.
- Khoảng cách tính trên mặt phẳng XZ, "trong bán kính r" nghĩa là `<= r`. Tọa độ xuất ra làm tròn 3 chữ số.

## Quy trình mỗi thay đổi
1. Viết/đổi test trong `tests/run.mjs` (hoặc xác nhận test hiện có bao phủ).
2. Sửa mã. 3. `npm test`. 4. Nếu đổi số liệu: `npm run contract`. 5. Ghi vào `docs/NOTES.md` (nhật ký AI).

## Lệnh
`npm test` · `npm run contract` · `node scripts/bot.mjs <seed> [inputs.json]` (bot chứng minh thắng được) · `npm start`

## Hooks gợi ý (Claude Code, `.claude/settings.json`)
Chạy `npm test` sau mỗi lần sửa `src/**` để bắt lỗi contract sớm.
