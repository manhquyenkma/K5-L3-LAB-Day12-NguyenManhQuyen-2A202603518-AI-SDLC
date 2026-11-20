// Dữ liệu bản đồ chuẩn Đêm 3 — Đảo Chuông (TICKET-02 Phần 2).
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

function arc(cx, cz, y, radius, degs) {
  return degs.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [r3(cx + radius * Math.cos(rad)), y, r3(cz + radius * Math.sin(rad))];
  });
}

export const NIGHT_3 = {
  id: 3,
  name: 'Đảo Chuông',
  intro: 'Ông Đăng: "Đỉnh Đảo Chuông là nơi sương đen dày đặc nhất. Gió đêm thổi xiết, Bóng Mực nhanh hơn — hãy leo lên ba tầng đá, thắp đủ 7 Đèn Lồng Lớn để đón Bình Minh!"',
  duration_s: 300,
  spawn: [0, 0, -15],
  facing: [0, 1],
  islands: [{ id: 'A', cx: 0, cz: 0, r: 45, y: 0 }],
  bridge: null,
  tiers: [
    // Tầng 1: vành khăn bán kính 12..24 m ở nửa z > 0, Y = 3
    { id: 'T1', kind: 'halfRing', rMin: 12, rMax: 24, zPositiveOnly: true, y: 3 },
    // Tầng 2: đĩa bán kính 8 m ở tâm, Y = 6
    { id: 'T2', kind: 'disk', rMax: 8, y: 6 },
  ],
  ramps: [
    // 2 dốc thẳng rộng 3 m dọc bán kính ở góc 30° và 150°: chân r=30 (Y=0), đỉnh r=24 (Y=3)
    { id: 'R1', deg: 30, width: 3, rFoot: 30, rTop: 24, yFoot: 0, yTop: 3 },
    { id: 'R2', deg: 150, width: 3, rFoot: 30, rTop: 24, yFoot: 0, yTop: 3 },
  ],
  tower: { cx: 0, cz: 0, r: 2, yBase: 6, height: 8 },
  jumpPads: [
    // Bục nhảy bán kính 1 m tại (0,3,13): vy=12, vh=8 hướng -Z -> đáp lên tầng 2
    { id: 'P1', pos: [0, 3, 13], r: 1, vy: 12, vh: 8, dir: [0, -1] },
  ],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  moteSpawns: [
    ...ring(0, 0, 0, 34, 18, 0),
    ...arc(0, 0, 3, 18, [20, 40, 60, 80, 100, 120, 140, 160]),
    ...arc(0, 0, 6, 5, [45, 135, 225, 315]),
  ],
  shadeSpawns: ring(0, 0, 0, 43, 16, 0),
  shadeSpeed: 4.5,
  shadeIntervalTicks: 360, // 6 s
  shadeMax: 10,
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  driftersEnabled: true,
  windEnabled: true,
};
