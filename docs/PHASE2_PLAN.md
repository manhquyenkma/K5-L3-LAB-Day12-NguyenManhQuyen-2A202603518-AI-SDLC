# Kế hoạch Phase 2: "Ba hòn đảo" (TICKET-02, Contract v1.1)

Nguồn sự thật là [TICKET-02.md](TICKET-02.md). Không làm thêm ngoài đề; giữ các sáng tạo Phase 1 đã có trong `public/`.

## Kiến trúc Phase 2

```text
src/tuning.js        số chuẩn v1.1 (nguồn sự thật cho game.contract.json)
src/nights/n1.js n2.js n3.js    dữ liệu bản đồ 3 Đêm
src/terrain.js       truy vấn địa hình thuần: độ cao mặt đỡ, vách, dốc, bục nhảy, tháp
src/sim.js           Sim.step theo đúng 12 bước bắt buộc của TICKET-02
src/entities/        shade.js, drifter.js (máy trạng thái thuần)
headless.js          CLI v1.1 (--night 1|2|3, scenario/inputs v1.1)
public/              menu, intro Ông Đăng, HUD đầy đủ, pause, cài đặt, âm thanh, cảnh 3 đêm
tests/               run.mjs (hồi quy Phase 1 số chuẩn) + tests/phase2/*.mjs
docs/                TICKET-02.md, SPEC-PHASE2.md, ASSUMPTIONS.md, PHASE2_PLAN.md, NOTES.md
```

## Mốc thực hiện (M0 → M9)

- **M0. Chuẩn bị:** `TICKET-02.md`, nhánh `phase-2`, `SPEC-PHASE2.md`, `ASSUMPTIONS.md`, cập nhật `AGENTS.md` & tạo 3 skill `.agents/skills/{sim-core,headless-contract,night-data}/SKILL.md`, chạy baseline `npm test`.
- **M1. Số liệu chuẩn, contract v1.1, dữ liệu 3 đêm:** `src/tuning.js`, `scripts/gen-contract.js`, `src/nights/n1..n3.js`, test dữ liệu bản đồ + cập nhật test hồi quy Phase 1 sang số chuẩn.
- **M2. Địa hình và chuyển động:** `src/terrain.js`, vận tốc/accel/decel, nhảy, lướt (`dash`), bục nhảy Đêm 2/3, rơi `Y < -10` & hồi sinh, gió mạnh Đêm 3.
- **M3. Đom đóm, đèn, vùng an toàn, Tỏa Sáng:** lịch sinh đom đóm 20/30/240 tick, nạp nhiều lần +10, safe zone 6 m chỉ đèn sáng + đẩy bóng tối đa 30 tick, Tỏa Sáng 3D 5 m / tốn 3 / đẩy 4 m trong 15 tick / choáng 120 tick / +5, bị đánh rơi vành 1.5–2.5 m TTL 480 tick.
- **M4. Bóng Mực:** FSM 5 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`), 12 m / 18 m, recoil 2 m / 60 tick, lịch sinh cố định 3 đêm.
- **M5. Gió Lạc và Bùa Gió:** `src/entities/drifter.js` (idle/chase/flee/removed, cướp, pulse đuổi/thả), Bùa Gió C1/C2 (600 tick, 7.2 m/s, lướt không cooldown, hồi 2700 tick).
- **M6. Schema v1.1, tạm dừng, thắng/thua, CLI:** đủ trường snapshot/scenario/input/events v1.1, `pause`/`resume`, đúng 12 bước tick, `--night 1|2|3`.
- **M7. Hiệu năng và tất định:** 3 đêm đầy đủ ≤ 30 s, so sánh byte-by-byte tất định cho cả 3 đêm.
- **M8. Bản chơi (GUI Three.js):** Menu → Intro Ông Đăng → 3 Đêm → Bình Minh, Pause (Esc/P), Settings lưu `localStorage`, Audio (nhạc nền + 10 SFX), HUD 7 thành phần, bảng màu chuẩn & ánh sáng môi trường, ≥ 30 FPS ở 1280×720.
- **M9. Spec, bằng chứng, nộp:** hoàn thiện `SPEC-PHASE2.md`, đủ scenario bắt buộc, bằng chứng log/test/FPS, cập nhật `README.md` & `docs/NOTES.md`, gắn tag `phase-2`, đẩy lên repo public.
