// Dữ liệu bản đồ chuẩn Đêm 1 — Đảo Bến (TICKET-02 Phần 2).
// Góc đo từ +X, ngược chiều kim đồng hồ trên XZ: x = cx + r*cos(rad), z = cz + r*sin(rad).
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

export const NIGHT_1 = {
  id: 1,
  name: 'Đảo Bến',
  intro: 'Ông Đăng: "Sương đen đã phủ kín Đảo Bến. Hãy gom đom đóm, thắp lại 5 Đèn Lồng Lớn trước khi trời sáng, và coi chừng Bóng Mực trong màn sương."',
  duration_s: 300,
  spawn: [0, 0, 0],
  facing: [0, 1],
  islands: [{ id: 'A', cx: 0, cz: 0, r: 40, y: 0 }],
  bridge: null,
  tiers: [],
  ramps: [],
  tower: null,
  jumpPads: [],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  moteSpawns: [
    ...ring(0, 0, 0, 12, 8, 0),
    ...ring(0, 0, 0, 33, 16, 0),
  ],
  shadeSpawns: ring(0, 0, 0, 37, 12, 15),
  shadeSpeed: 4.0,
  shadeIntervalTicks: 480, // 8 s
  shadeMax: 6,
  charms: [],
  driftersEnabled: false,
  windEnabled: false,
};
