// Dữ liệu bản đồ chuẩn Đêm 2 — Đảo Cau (TICKET-02 Phần 2).
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

function ring(cx, cz, y, radius, count, startDeg = 0) {
  const out = [];
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    out.push([r3(cx + radius * Math.cos(rad)), y, r3(cz + radius * Math.sin(rad))]);
  }
  return out;
}

export const NIGHT_2 = {
  id: 2,
  name: 'Đảo Cau',
  intro: 'Ông Đăng: "Đảo Cau chia đôi qua cây cầu tre hẹp. Đừng ngại dùng bục nhảy gió và Bùa Gió, nhưng hãy giữ chặt đom đóm trước lũ Gió Lạc tinh quái."',
  duration_s: 270,
  spawn: [0, 0, 0],
  facing: [0, 1],
  islands: [
    { id: 'A', cx: 0, cz: 0, r: 28, y: 0 },
    { id: 'B', cx: 70, cz: 0, r: 28, y: 0 },
  ],
  bridge: { xMin: 26, xMax: 44, zMin: -2, zMax: 2, y: 0 },
  tiers: [],
  ramps: [],
  tower: null,
  jumpPads: [
    { id: 'P1', pos: [20, 0, 18], r: 1, vy: 14, vh: 24, target: [70, 0, 0] },
    { id: 'P2', pos: [50, 0, -18], r: 1, vy: 14, vh: 24, target: [0, 0, 0] },
  ],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  moteSpawns: [
    ...ring(0, 0, 0, 10, 4, 0),
    ...ring(0, 0, 0, 22, 8, 0),
    ...ring(70, 0, 0, 10, 4, 0),
    ...ring(70, 0, 0, 22, 8, 0),
  ],
  shadeSpawns: [
    ...ring(0, 0, 0, 26, 8, 22.5),
    ...ring(70, 0, 0, 26, 8, 22.5),
  ],
  shadeSpeed: 4.0,
  shadeIntervalTicks: 420, // 7 s
  shadeMax: 8,
  charms: [
    { id: 'C1', pos: [35, 0, 0] },
  ],
  driftersEnabled: true,
  windEnabled: false,
};
