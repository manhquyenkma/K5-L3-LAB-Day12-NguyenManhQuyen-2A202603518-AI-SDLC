# Credits & Nguồn Tài Nguyên — Đảo Đèn Lồng v1.0.0

Mọi nhân vật, địa danh và cốt truyện (**Mây**, **Ông Đăng**, **Đảo Bến**, **Đảo Cau**, **Đảo Chuông**, **Đèn Lồng Lớn**, **Bóng Mực**, **Gió Lạc**, **Bùa Gió**) thuộc đề bài gốc của bài lab Day 12 AI SDLC.

## Thư viện & Nền tảng mã nguồn mở
- **Three.js** (`0.160.0` / MIT License) — Kết xuất đồ họa 3D WebGL2 trên trình duyệt (kết hợp `InstancedMesh` cho 200+ Bóng Mực và 100+ đom đóm).
- **Node.js** (MIT License) — Chạy lõi mô phỏng thuần (`src/`), chế độ headless (`headless.js`), benchmark (`bench.js`), soak test (`soak.js`), máy chủ tĩnh & API bảng xếp hạng (`server.js`), bộ test tự chấm và công cụ đóng gói phát hành.

## Tài sản đồ họa (100% Procedural — không dùng asset ngoài có bản quyền)
- **Chất liệu procedural (`public/assets.js`):** 9 `CanvasTexture` tự sinh lúc khởi động: mặt cỏ hội họa (`#2F5D50`), đá cát ven đảo (`#C9B48A`), gỗ/tre có vân (`#6B4A2F`), nón lá đan tre, lụa đèn lồng Hội An (bản lành & bản rách răng cưa cho chế độ không cần màu), lá Bùa Gió chữ triện (`#C8102E`), biển mây cuộn (`#12384A`), vòng hoa văn sen vùng an toàn 6 m, cùng các kết cấu hào quang mềm và bóng đổ tiếp xúc.
- **Mô hình 3D điêu khắc (`public/assets.js` & `public/main.js`):** Sinh hoàn toàn bằng `LatheGeometry`, `ExtrudeGeometry` và `InstancedMesh` (Mây đội nón lá treo đèn mini & khăn bay, miếu Đèn Lồng Hội An có thanh dầu 3D, Tháp Chuông 2 tầng mái cong, Bóng Mực 6 tua mực & mắt đổi màu mù màu `#7A3CFF → #00B3FF`, Gió Lạc 7 đốt lụa, cầu tre, cây tán tầng, khóm tre, đá rêu, bục nhảy rune).
- **Biểu tượng UI:** SVG thuần nội tuyến trong `public/index.html` (Ngọn Lửa, biểu tượng Đèn Lồng) và ký tự Unicode chuẩn (`⚠`, `🏮`, `⭐`, `🌙`).

## Âm thanh (100% Tổng hợp Web Audio API — không dùng file âm thanh ngoài)
- **Bộ tổng hợp âm thanh (`public/audio.js`):** Nhạc nền đêm ngũ cung *Đảo hát* (số nốt hòa âm tăng theo số đèn đang sáng) và 10+ hiệu ứng SFX (nhặt đom đóm, nạp/châm dầu, thắp đèn, Tỏa Sáng, bị đánh, nhảy, lướt, Bùa Gió, Bóng Mực xuất hiện, cảnh báo gió, đếm ngược 10 giây cuối, thắng, thua, tiếng chuông tháp Đêm 3).

## Công cụ AI đã sử dụng (minh bạch theo quy định lab)
- **Claude (chat):** Hỗ trợ phân tích PRD-0 & Test Contract v1.0, xây dựng bản lõi Phase 1 (`src/sim.js`, `headless.js`, 24 test đầu tiên, bot tham lam và nguyên mẫu Three.js).
- **Antigravity (Gemini):** Hỗ trợ xuyên suốt Phase 1–4 — thiết lập Harness AI (`AGENTS.md`, 5 skill chuyên biệt tại `.agents/skills/`), mở rộng kiến trúc Phase 2 (3 Đêm, địa hình, FSM Bóng Mực, Gió Lạc, Bùa Gió, tối ưu log vàng & sáng tạo đồ họa/âm thanh thuần `public/`), thực thi Change Request Phase 3 (ADR-001, nhiên liệu nguyên `1/60`, `drain`, luật thắng bình minh, chế độ mù màu), và hoàn thiện phát hành Phase 4 v1.0.0 (`bench.js`, `soak.js`, `InstancedMesh` 200 bóng, bảng xếp hạng lưu đĩa, tiếp cận đầy đủ, đóng gói phát hành & retro).
