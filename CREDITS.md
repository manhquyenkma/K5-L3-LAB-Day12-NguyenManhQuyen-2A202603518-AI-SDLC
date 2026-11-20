# Credits & Nguồn Tài Nguyên

Mọi nhân vật và bối cảnh (**Mây**, **Đảo Đèn Lồng**, **Đèn Lồng Lớn**, **Bóng Mực**) đều thuộc bản gốc của bài lab Day 12 AI SDLC.

## Thư viện mã nguồn mở
- **Three.js** (`0.160.0`, MIT License) — Kết xuất đồ họa 3D WebGL trên trình duyệt.
- **Node.js** (MIT License) — Chạy lõi mô phỏng, chế độ headless, máy chủ tĩnh và bộ test tự chấm.

## Tài sản đồ họa & Âm thanh
- Toàn bộ mô hình 3D (hòn đảo, Đèn Lồng Lớn, đom đóm, Bóng Mực, Mây đội nón lá treo đèn lồng) được tạo hình procedural bằng hình khối cơ bản của Three.js, không dùng asset ngoài có bản quyền.
- Âm thanh hiệu ứng (nhặt đom đóm, nạp đèn, thắp đèn, tỏa sáng, bị chạm) được tổng hợp trực tiếp bằng Web Audio API.

## Công cụ AI đã sử dụng
- **Claude (chat)** — Hỗ trợ tóm tắt PRD-0/Test Contract, sinh lõi `src/sim.js`, `headless.js`, bộ 24 test và giao diện Three.js.
- **Antigravity (Gemini)** — Hỗ trợ thiết lập môi trường, GitHub Actions CI, bộ kỹ năng kiểm chứng/rà soát độc lập (`.agents/skills/`), rà soát mã nguồn và kiểm chứng bản chơi 3D.
