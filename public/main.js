// Bản chơi 3D Three.js (Phase 2 — Ba hòn đảo), chạy trên cùng lõi Sim với chế độ headless.
// Mọi màu sắc bám sát bảng màu chuẩn TICKET-02 Phần 3; sáng tạo chỉ nằm ở public/ không chạm src/.
import * as THREE from 'three';
import { Sim, DT, TPS } from '/src/sim.js';
import { TUNING as T, EXTRA as X } from '/src/tuning.js';
import { getNight } from '/src/nights/index.js';
import { AudioEngine } from '/audio.js';

// ---------- Bảng màu chuẩn TICKET-02 ----------
export const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  sea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  mayRobe: 0xe8e2d0,
  mayScarfCharm: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
  danger: 0xff5a5f,
  uiText: 0xf5f1e6,
};

const $ = (id) => document.getElementById(id);

// ---------- Texture hào quang tạo procedural (không cần file ảnh ngoài) ----------
function makeGlowTexture(innerHex, outerRgba) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, innerHex);
  g.addColorStop(0.35, outerRgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

const warmGlowTex = makeGlowTexture('#FFF6C2', 'rgba(255, 179, 71, 0.55)');
const moonGlowTex = makeGlowTexture('#FFE9B0', 'rgba(242, 193, 78, 0.25)');
const violetGlowTex = makeGlowTexture('rgba(122, 60, 255, 0.7)', 'rgba(122, 60, 255, 0.15)');

// ---------- Cài đặt lưu bền vững (localStorage) ----------
const SETTINGS_KEY = 'ddl_settings_v1';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        volume: Math.max(0, Math.min(1, Number(s.volume ?? 0.7))),
        mouseSens: Math.max(0.1, Math.min(1, Number(s.mouseSens ?? 0.35))),
      };
    }
  } catch { /* bỏ qua */ }
  return { volume: 0.7, mouseSens: 0.35 };
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
const settings = loadSettings();
const audio = new AudioEngine(settings.volume);

// ---------- Khởi tạo thanh 10 ô đom đóm & SVG Ngọn Lửa ----------
const moteBar = $('mote-bar');
const moteSlots = [];
for (let i = 0; i < T.carry_capacity; i++) {
  const d = document.createElement('div');
  d.className = 'mote-slot';
  moteBar.appendChild(d);
  moteSlots.push(d);
}

const FLAME_SVG = `<svg width="18" height="20" viewBox="0 0 20 22" fill="none"><path d="M10 1.5C10 1.5 16.5 7.2 16.5 12.8C16.5 16.9 13.6 20 10 20C6.4 20 3.5 16.9 3.5 12.8C3.5 9.6 5.4 6.7 7.1 4.9C7.1 7.1 8.4 8.2 9.2 8.2C8.6 5.8 10 1.5 10 1.5Z" fill="#FFB347"/><path d="M10 9.5C10 9.5 13 12.3 13 14.9C13 16.8 11.7 18.2 10 18.2C8.3 18.2 7 16.8 7 14.9C7 12.3 10 9.5 10 9.5Z" fill="#FFF6C2"/></svg>`;
let lastFlamesRendered = -1;
function renderFlames(flames) {
  if (flames === lastFlamesRendered) return;
  lastFlamesRendered = flames;
  let html = '';
  for (let i = 0; i < T.flames; i++) {
    html += `<span class="flame-ico ${i < flames ? 'on' : 'off'}">${FLAME_SVG}</span>`;
  }
  $('h-flames').innerHTML = html;
}
renderFlames(T.flames);

function flashScreen(kind) {
  const el = $('fx-flash');
  el.className = kind;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 360);
}

// ---------- Renderer & Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatioCap = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatioCap);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0085);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 320);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0x8fa4ee, PALETTE.fog, 0.15);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xc2d0ff, 0.42);
moonLight.position.set(-45, 75, -35);
scene.add(moonLight);

// Bầu trời sao & Mặt trăng phát sáng
const starCount = 240;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const phi = Math.acos(0.18 + ((i * 73) % 100) / 122);
  const theta = (i * 2.39996) % (Math.PI * 2);
  const r = 175 + (i % 5) * 8;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi);
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: PALETTE.moteCore, size: 1.5, transparent: true, opacity: 0.85, fog: false }),
);
scene.add(stars);

const moonOrb = new THREE.Mesh(
  new THREE.SphereGeometry(7, 20, 16),
  new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, fog: false }),
);
moonOrb.position.set(-85, 92, -75);
const moonHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: moonGlowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
);
moonHalo.scale.set(42, 42, 1);
moonOrb.add(moonHalo);
scene.add(moonOrb);

// Biển mây sâu + vòng mây trôi bồng bềnh quanh đảo
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(280, 56),
  new THREE.MeshBasicMaterial({ color: PALETTE.sea }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -11;
scene.add(sea);

const cloudRing = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({ color: PALETTE.fog, transparent: true, opacity: 0.55 });
const cloudGeo = new THREE.SphereGeometry(6, 12, 8);
for (let i = 0; i < 18; i++) {
  const ang = (i / 18) * Math.PI * 2;
  const dist = 62 + (i % 4) * 14;
  const c = new THREE.Mesh(cloudGeo, cloudMat);
  c.position.set(Math.cos(ang) * dist, -6.5 + (i % 3) * 1.4, Math.sin(ang) * dist);
  c.scale.set(1.4 + (i % 3) * 0.5, 0.36, 1.1 + (i % 2) * 0.4);
  cloudRing.add(c);
}
scene.add(cloudRing);

// Nhóm cảnh thay đổi theo từng Đêm (dispose sạch khi đổi Đêm)
let worldGroup = new THREE.Group();
scene.add(worldGroup);

// Tối đa 2 đèn điểm thật cho 2 Đèn Lồng Lớn sáng gần nhất (O5 giữ FPS cao)
const sharedLanternLights = [
  new THREE.PointLight(PALETTE.lanternLit, 0, 30, 1.8),
  new THREE.PointLight(PALETTE.lanternLit, 0, 30, 1.8),
];
scene.add(sharedLanternLights[0], sharedLanternLights[1]);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra });

// ---------- Nhân vật Mây (áo kem #E8E2D0, khăn đỏ #C8102E, nón lá treo đèn lồng phát sáng) ----------
const playerMesh = new THREE.Group();
const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.54, 1.05, 14), mat(PALETTE.mayRobe));
pBody.position.y = 0.62;
const pScarf = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), mat(PALETTE.mayScarfCharm));
pScarf.rotation.x = Math.PI / 2;
pScarf.position.y = 1.16;
const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.06), mat(PALETTE.mayScarfCharm));
scarfTail.position.set(0, 0.94, -0.38);
scarfTail.rotation.x = 0.32;
const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), mat(0xe9c9a0));
pHead.position.y = 1.48;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.98, 0.54, 24), mat(PALETTE.sand));
hat.position.y = 1.94;
const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.035, 6, 24), mat(PALETTE.wood));
hatRim.rotation.x = Math.PI / 2;
hatRim.position.y = 1.68;

const hangPivot = new THREE.Group();
hangPivot.position.set(0.74, 1.72, 0);
const hangCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 6), mat(PALETTE.wood));
hangCord.position.y = -0.11;
const hangLantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore }));
hangLantern.position.y = -0.26;
const hangGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: warmGlowTex, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }),
);
hangGlow.scale.set(1.5, 1.5, 1);
hangGlow.position.y = -0.26;
hangPivot.add(hangCord, hangLantern, hangGlow);

const pLight = new THREE.PointLight(PALETTE.lanternLit, 18, 18, 1.8);
pLight.position.set(0.74, 1.5, 0);
playerMesh.add(pBody, pScarf, scarfTail, pHead, hat, hatRim, hangPivot, pLight);
scene.add(playerMesh);

// Vòng Tỏa Sáng, vệt lướt C3, gợn sương đáp C3
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.84, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 99;

const dashTrail = new THREE.Mesh(
  new THREE.PlaneGeometry(0.78, 2.4),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
dashTrail.rotation.x = -Math.PI / 2;
scene.add(dashTrail);

const landRipple = new THREE.Mesh(
  new THREE.RingGeometry(0.52, 0.86, 28),
  new THREE.MeshBasicMaterial({ color: PALETTE.uiText, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
landRipple.rotation.x = -Math.PI / 2;
scene.add(landRipple);
let rippleT = 99;
let lowFx = false;
let bridgeVisual = null;
let bellVisual = null;
let bellRingT = 0;
let dawnBlend = 0;
let shakeAmt = 0;
const skyColor = new THREE.Color(PALETTE.sky);
const dawnColor = new THREE.Color(PALETTE.lanternLit);
const curSkyColor = new THREE.Color(PALETTE.sky);

// InstancedMesh đom đóm & lá bay báo gió Đêm 3 (O6)
const MAX_MOTE_INST = 48;
const moteCoreInst = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.17, 10, 8),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
  MAX_MOTE_INST,
);
const moteHaloInst = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.38, 10, 8),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.36 }),
  MAX_MOTE_INST,
);
moteCoreInst.count = 0;
moteHaloInst.count = 0;
scene.add(moteCoreInst, moteHaloInst);

const LEAF_COUNT = 44;
const leafInst = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.45, 0.2),
  new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.82 }),
  LEAF_COUNT,
);
leafInst.count = 0;
scene.add(leafInst);
const leafState = Array.from({ length: LEAF_COUNT }, (_, i) => ({
  ox: ((i * 37) % 50) - 25,
  oy: 0.6 + (i % 7) * 0.9,
  oz: ((i * 53) % 50) - 25,
  phase: i * 0.7,
}));

const lanternViews = new Map();
const shadeViews = new Map();
const drifterViews = new Map();
const charmViews = new Map();

function disposeGroup(g) {
  g.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material && obj.material.map !== warmGlowTex && obj.material.map !== moonGlowTex && obj.material.map !== violetGlowTex) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

function addDecorativeProps(nightCfg) {
  // Cụm cỏ & bụi tre nhỏ trang trí ven mép đảo (InstancedMesh: 1 draw call, không cản tầm nhìn)
  const tufts = [];
  for (const isl of nightCfg.islands) {
    const count = Math.round(isl.r * 0.9);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + 0.13;
      const r = isl.r - 2.2 - (i % 3) * 0.9;
      const x = isl.cx + Math.cos(ang) * r;
      const z = isl.cz + Math.sin(ang) * r;
      // Tránh vùng cầu tre Đêm 2
      if (nightCfg.bridge && x > 23 && x < 47 && Math.abs(z) < 5) continue;
      tufts.push([x, isl.y, z, 0.7 + (i % 4) * 0.22]);
    }
  }
  if (tufts.length > 0) {
    const tuftGeo = new THREE.ConeGeometry(0.28, 0.95, 5);
    const tuftMat = mat(PALETTE.grass, { roughness: 0.95 });
    const inst = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
    const dm = new THREE.Object3D();
    for (let i = 0; i < tufts.length; i++) {
      const [x, y, z, s] = tufts[i];
      dm.position.set(x, y + 0.4 * s, z);
      dm.scale.set(s, s, s);
      dm.rotation.set(0, i * 1.1, 0);
      dm.updateMatrix();
      inst.setMatrixAt(i, dm.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    worldGroup.add(inst);
  }
}

function buildNightScene(nightCfg) {
  scene.remove(worldGroup);
  disposeGroup(worldGroup);
  worldGroup = new THREE.Group();
  bridgeVisual = null;
  bellVisual = null;
  bellRingT = 0;
  dawnBlend = 0;
  scene.background.setHex(PALETTE.sky);
  lanternViews.clear();
  shadeViews.forEach((v) => scene.remove(v.g));
  shadeViews.clear();
  drifterViews.forEach((v) => scene.remove(v.g));
  drifterViews.clear();
  charmViews.forEach((v) => scene.remove(v.g));
  charmViews.clear();

  // Đảo chính: mặt cỏ (#2F5D50) + viền cát ấm (#C9B48A) + đáy đá nổi lơ lửng trên biển mây
  for (const isl of nightCfg.islands) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r - 1.2, 2.2, 56), mat(PALETTE.grass));
    top.position.set(isl.cx, isl.y - 1.1, isl.cz);
    const under = new THREE.Mesh(new THREE.ConeGeometry(isl.r - 1.5, 9, 28), mat(PALETTE.wood, { roughness: 0.96 }));
    under.rotation.x = Math.PI;
    under.position.set(isl.cx, isl.y - 6.7, isl.cz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(isl.r - 0.35, 0.55, 8, 56), mat(PALETTE.sand));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(isl.cx, isl.y - 0.08, isl.cz);
    worldGroup.add(top, under, rim);
  }

  addDecorativeProps(nightCfg);

  // Cầu tre Đêm 2 (#6B4A2F) — thanh ván ngang + cột tre trang trí (C5: đung đưa nhẹ hình ảnh)
  if (nightCfg.bridge) {
    const b = nightCfg.bridge;
    const w = b.xMax - b.xMin;
    const d = b.zMax - b.zMin;
    const bg = new THREE.Group();
    bg.position.set((b.xMin + b.xMax) / 2, b.y, (b.zMin + b.zMax) / 2);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat(PALETTE.wood));
    deck.position.y = -0.15;
    bg.add(deck);
    const plankMat = mat(PALETTE.sand, { roughness: 0.9 });
    for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, d + 0.1), plankMat);
      p.position.set(x, 0.01, 0);
      bg.add(p);
    }
    bridgeVisual = bg;
    worldGroup.add(bg);
  }

  // Các tầng cao Đêm 3 (có viền đá sáng phân biệt tầng rõ rệt)
  for (const t of nightCfg.tiers) {
    if (t.kind === 'disk') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(t.rMax, t.rMax + 0.3, t.y, 40), mat(PALETTE.grass));
      m.position.set(0, t.y / 2, 0);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(t.rMax, 0.22, 6, 40), mat(PALETTE.sand));
      trim.rotation.x = Math.PI / 2;
      trim.position.y = t.y - 0.05;
      worldGroup.add(m, trim);
    } else if (t.kind === 'halfRing') {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, t.rMax, 0, Math.PI, true);
      shape.absarc(0, 0, t.rMin, Math.PI, 0, false);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: t.y, bevelEnabled: false, curveSegments: 36 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(PALETTE.grass));
      worldGroup.add(m);
    }
  }

  // 2 dốc thẳng Đêm 3 (#6B4A2F có bậc gỗ rõ ràng)
  for (const r of nightCfg.ramps) {
    const rad = (r.deg * Math.PI) / 180;
    const lenH = r.rFoot - r.rTop;
    const dy = r.yTop - r.yFoot;
    const slopeLen = Math.hypot(lenH, dy);
    const pitch = Math.atan2(dy, lenH);
    const rMid = (r.rFoot + r.rTop) / 2;
    const g = new THREE.Group();
    g.position.set(rMid * Math.cos(rad), (r.yFoot + r.yTop) / 2 - 0.12, rMid * Math.sin(rad));
    g.rotation.y = -rad;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.45, 0.28, r.width), mat(PALETTE.wood));
    plank.rotation.z = -pitch;
    const railL = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.3, 0.14, 0.14), mat(PALETTE.sand));
    railL.position.set(0, 0.18, r.width / 2 - 0.08);
    railL.rotation.z = -pitch;
    const railR = railL.clone();
    railR.position.z = -(r.width / 2 - 0.08);
    g.add(plank, railL, railR);
    worldGroup.add(g);
  }

  // Tháp chuông Đêm 3 (kiến trúc mái đình 2 tầng + chuông đồng vàng)
  if (nightCfg.tower) {
    const tw = nightCfg.tower;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 0.95, tw.r, tw.height, 24), mat(PALETTE.wood));
    body.position.set(tw.cx, tw.yBase + tw.height / 2, tw.cz);
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(tw.r + 1.15, 2.0, 8), mat(PALETTE.mayScarfCharm));
    roof1.position.set(tw.cx, tw.yBase + tw.height + 0.6, tw.cz);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(tw.r + 0.4, 1.5, 8), mat(PALETTE.mayScarfCharm));
    roof2.position.set(tw.cx, tw.yBase + tw.height + 2.0, tw.cz);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 1.2, 8), mat(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.35 }));
    spire.position.set(tw.cx, tw.yBase + tw.height + 3.0, tw.cz);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.05, 14), mat(PALETTE.gold, { metalness: 0.45, roughness: 0.3, emissive: PALETTE.lanternLit, emissiveIntensity: 0.18 }));
    bell.position.set(tw.cx, tw.yBase + tw.height - 0.85, tw.cz);
    bellVisual = bell;
    worldGroup.add(body, roof1, roof2, spire, bell);
  }

  // Bục nhảy gió (đế gỗ + vòng rune phát sáng vàng)
  for (const pad of nightCfg.jumpPads) {
    const g = new THREE.Group();
    g.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r * 1.18, 0.24, 24), mat(PALETTE.wood));
    base.position.y = 0.12;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.r * 0.88, pad.r * 0.88, 0.08, 24),
      mat(PALETTE.gold, { emissive: PALETTE.lanternLit, emissiveIntensity: 0.65 }),
    );
    disc.position.y = 0.25;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(pad.r * 0.95, 0.06, 8, 28),
      new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.42;
    g.add(base, disc, ring);
    worldGroup.add(g);
  }

  // Đèn Lồng Lớn kiểu Hội An (cột gỗ, mái che, thân lồng đèn, lõi sáng, tua rua đỏ, hào quang additive)
  for (const L of nightCfg.lanterns) {
    const g = new THREE.Group();
    g.position.set(L.pos[0], L.pos[1], L.pos[2]);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.35, 8), mat(PALETTE.sand));
    pedestal.position.y = 0.17;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 3.0, 10), mat(PALETTE.wood));
    post.position.y = 1.6;
    const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 8), mat(PALETTE.wood));
    capTop.position.y = 4.35;
    const capGold = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 16), mat(PALETTE.gold));
    capGold.rotation.x = Math.PI / 2;
    capGold.position.y = 4.05;

    const glowMat = new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, emissive: PALETTE.lanternOff, emissiveIntensity: 0.15, roughness: 0.32 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.86, 16, 12), glowMat);
    glow.scale.set(0.95, 1.12, 0.95);
    glow.position.y = 3.35;

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0.1 }));
    core.position.y = 3.35;

    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), mat(PALETTE.mayScarfCharm));
    tassel.rotation.x = Math.PI;
    tassel.position.y = 2.22;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: warmGlowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.position.y = 3.35;
    halo.scale.set(5.8, 5.8, 1);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(T.safe_radius - 0.14, T.safe_radius, 56),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;

    g.add(pedestal, post, capTop, capGold, glow, core, tassel, halo, ring);
    worldGroup.add(g);
    lanternViews.set(L.id, { g, glowMat, core, halo, ring, pos: L.pos });
  }

  scene.add(worldGroup);
}

// C4: Bóng Mực giọt mực đen (#120A1A) + hào quang tím (#7A3CFF) + giọt nhỏ + mắt nhìn theo Mây
function makeShadeMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, emissive: PALETTE.shadeRim, emissiveIntensity: 0.48, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.84, 16, 12), bodyMat);
  const topTip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 12), bodyMat);
  topTip.position.y = 0.72;

  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: violetGlowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  aura.scale.set(2.9, 2.9, 1);

  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.uiText });
  for (const sx of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    eye.position.set(sx, 0.14, 0.72);
    g.add(eye);
  }
  const drip1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMat);
  drip1.position.set(-0.4, -0.7, 0.15);
  const drip2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bodyMat);
  drip2.position.set(0.35, -0.62, -0.2);

  g.add(body, topTip, aura, drip1, drip2);
  scene.add(g);
  return { g, bodyMat, aura, drip1, drip2 };
}

// Gió Lạc: dải lụa xám xanh (#8FA3B8) mềm mại nhiều đốt bay uốn lượn
function makeDrifterMesh() {
  const g = new THREE.Group();
  const segMat = new THREE.MeshStandardMaterial({ color: PALETTE.drifter, emissive: PALETTE.drifter, emissiveIntensity: 0.4, roughness: 0.35 });
  const segs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.42 - i * 0.07, 0.12, 0.52), segMat);
    s.position.z = -i * 0.48;
    g.add(s);
    segs.push(s);
  }
  scene.add(g);
  return { g, segs, segMat };
}

// Bùa Gió: lá bùa đỏ (#C8102E) viền vàng (#F2C14E) + vòng sáng
function makeCharmMesh(pos) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1] + 1.1, pos[2]);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.92, 0.08), mat(PALETTE.mayScarfCharm, { emissive: PALETTE.mayScarfCharm, emissiveIntensity: 0.4 }));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.02, 0.05), mat(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.55 }));
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: warmGlowTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.scale.set(2.4, 2.4, 1);
  g.add(border, tag, halo);
  scene.add(g);
  return { g };
}

// ---------- Quản lý luồng 3 Đêm & UI ----------
let mode = 'menu'; // menu | intro | playing | paused | result | dawn
let currentNight = 1;
let totalCampaignScore = 0;
let prevSettingsReturn = 'menu';
let sim = new Sim({ seed: 1, night: 1 });
let yaw = 0;
let acc = 0;
let lastNow = performance.now();
let lastCountdownSec = 11;
let pendingPauseToggle = false;
let prevGrounded = true;
const hintsShown = new Set();

function showHintOnce(key, msg) {
  if (hintsShown.has(key)) return;
  hintsShown.add(key);
  toast(msg);
}

function showOnly(id) {
  for (const ov of ['ov-menu', 'ov-intro', 'ov-pause', 'ov-settings', 'ov-result']) {
    $(ov).classList.toggle('hidden', ov !== id);
  }
  $('hud').classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); }, 1850);
}

function openIntro(nightId, resetTotal = false) {
  if (resetTotal) totalCampaignScore = 0;
  currentNight = nightId;
  const cfg = getNight(nightId);
  buildNightScene(cfg);
  sim = new Sim({ seed: 1, night: nightId });
  $('intro-sub').textContent = `Đêm ${nightId} / 3`;
  $('intro-title').textContent = cfg.name;
  $('intro-quote').textContent = cfg.intro;
  mode = 'intro';
  showOnly('ov-intro');
}

function startNight(nightId) {
  currentNight = nightId;
  const cfg = getNight(nightId);
  buildNightScene(cfg);
  sim = new Sim({ seed: (Date.now() & 0x7fffffff) || 1, night: nightId });
  sim.drainEvents();
  yaw = 0;
  acc = 0;
  pulseT = 99;
  rippleT = 99;
  shakeAmt = 0;
  hintsShown.clear();
  lastCountdownSec = 11;
  prevGrounded = true;
  pendingPauseToggle = false;
  lastFlamesRendered = -1;
  renderFlames(sim.player.flames);
  $('h-night-name').textContent = `Đêm ${nightId} — ${cfg.name}`;
  mode = 'playing';
  showOnly(null);
  audio.startBgm();
}

function togglePause() {
  if (mode === 'playing') {
    pendingPauseToggle = true;
    sim.step({ pause: true });
    sim.drainEvents();
    sim.step({ pause: false });
    pendingPauseToggle = false;
    mode = 'paused';
    audio.stopBgm();
    showOnly('ov-pause');
  } else if (mode === 'paused') {
    sim.step({ pause: true });
    sim.drainEvents();
    sim.step({ pause: false });
    mode = 'playing';
    lastNow = performance.now();
    showOnly(null);
    audio.startBgm();
  }
}

function finishNight(data) {
  audio.stopBgm();
  const ov = $('ov-result');
  ov.classList.remove('dawn');
  if (data.result === 'won') {
    audio.playWin();
    totalCampaignScore += sim.score;
    if (currentNight < 3) {
      mode = 'result';
      $('res-kicker').textContent = `Hoàn thành Đêm ${currentNight}`;
      $('res-title').textContent = `${sim.nightCfg.name} Bừng Sáng!`;
      $('res-desc').textContent = 'Ánh đèn đã xua tan sương đen. Ngọn Lửa của Mây sẽ hồi đầy trước Đêm tiếp theo.';
      $('res-score').textContent = `Điểm Đêm ${currentNight}: ${sim.score} · Tổng điểm: ${totalCampaignScore}`;
      $('btn-res-primary').textContent = `Sang Đêm ${currentNight + 1} →`;
      $('btn-res-primary').onclick = () => openIntro(currentNight + 1, false);
    } else {
      mode = 'dawn';
      audio.playTowerBell();
      ov.classList.add('dawn');
      $('res-kicker').textContent = 'Hành trình hoàn tất';
      $('res-title').textContent = 'Bình Minh Trên Ba Hòn Đảo!';
      $('res-desc').textContent = 'Cả Đảo Bến, Đảo Cau và Đảo Chuông đã rực sáng. Ông Đăng mỉm cười đón ánh bình minh đầu tiên.';
      $('res-score').textContent = `Điểm Đêm 3: ${sim.score} · Tổng điểm toàn hành trình: ${totalCampaignScore}`;
      $('btn-res-primary').textContent = 'Chơi lại từ Đêm 1';
      $('btn-res-primary').onclick = () => openIntro(1, true);
    }
  } else {
    audio.playLose();
    mode = 'result';
    $('res-kicker').textContent = `Đêm ${currentNight} — ${sim.nightCfg.name}`;
    $('res-title').textContent = 'Ngọn Đèn Chưa Kịp Sáng';
    $('res-desc').textContent = data.reason === 'no_flames' ? 'Ngọn Lửa của Mây đã tắt giữa màn sương.' : 'Trời đã sáng trước khi đủ Đèn Lồng Lớn được thắp.';
    $('res-score').textContent = `Điểm Đêm ${currentNight}: ${sim.score}`;
    $('btn-res-primary').textContent = `Chơi lại Đêm ${currentNight}`;
    $('btn-res-primary').onclick = () => startNight(currentNight);
  }
  showOnly('ov-result');
}

// Gắn sự kiện nút UI
$('btn-play').onclick = () => openIntro(1, true);
document.querySelectorAll('[data-night]').forEach((b) => {
  b.onclick = () => openIntro(Number(b.dataset.night), true);
});
$('btn-start-night').onclick = () => startNight(currentNight);
$('btn-intro-menu').onclick = () => { mode = 'menu'; showOnly('ov-menu'); };
$('btn-resume').onclick = () => togglePause();
$('btn-retry-pause').onclick = () => startNight(currentNight);
$('btn-pause-menu').onclick = () => { audio.stopBgm(); mode = 'menu'; showOnly('ov-menu'); };
$('btn-res-menu').onclick = () => { audio.stopBgm(); mode = 'menu'; showOnly('ov-menu'); };

function openSettings(from) {
  prevSettingsReturn = from;
  $('set-vol').value = String(Math.round(settings.volume * 100));
  $('set-vol-val').textContent = `${Math.round(settings.volume * 100)}%`;
  $('set-sens').value = String(Math.round(settings.mouseSens * 100));
  $('set-sens-val').textContent = `${Math.round(settings.mouseSens * 100)}%`;
  showOnly('ov-settings');
}
$('btn-menu-settings').onclick = () => openSettings('menu');
$('btn-pause-settings').onclick = () => openSettings('paused');
$('set-vol').oninput = (e) => {
  const v = Number(e.target.value) / 100;
  settings.volume = v;
  $('set-vol-val').textContent = `${Math.round(v * 100)}%`;
  audio.setVolume(v);
  saveSettings(settings);
};
$('set-sens').oninput = (e) => {
  const v = Number(e.target.value) / 100;
  settings.mouseSens = v;
  $('set-sens-val').textContent = `${Math.round(v * 100)}%`;
  saveSettings(settings);
};
$('btn-settings-back').onclick = () => {
  if (prevSettingsReturn === 'paused') showOnly('ov-pause');
  else showOnly('ov-menu');
};

// ---------- Điều khiển bàn phím & chuột ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (mode === 'playing' || mode === 'paused') {
      togglePause();
      return;
    }
  }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
addEventListener('mousedown', () => { drag = true; });
addEventListener('mouseup', () => { drag = false; });
addEventListener('mousemove', (e) => {
  if (drag && mode === 'playing') yaw -= e.movementX * settings.mouseSens;
});

function readInput() {
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const fwd = keys.has('KeyW') || keys.has('ArrowUp');
  const back = keys.has('KeyS') || keys.has('ArrowDown');
  return {
    move: [(left ? 1 : 0) - (right ? 1 : 0), (fwd ? 1 : 0) - (back ? 1 : 0)],
    cam_yaw_deg: yaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: pendingPauseToggle,
  };
}

function onEvent(e) {
  switch (e.name) {
    case 'mote_picked': audio.playPickup(e.data.carried); break;
    case 'deposit': audio.playDeposit(); toast(`Nạp ${e.data.amount} ánh sáng vào ${e.data.lantern_id} (${e.data.deposited}/${T.lantern_cost})`); break;
    case 'lantern_lit':
      audio.playLanternLit();
      flashScreen('lit');
      bellRingT = 1.6;
      toast(`🏮 Đã thắp sáng ${e.data.lantern_id}!`);
      showHintOnce('first_lit', 'Ông Đăng: "Ánh đèn đã tạo vùng trú 6 m — Bóng Mực không thể tiến vào!"');
      break;
    case 'pulse': audio.playPulse(); pulseT = 0; shakeAmt = 0.25; break;
    case 'dash': audio.playDash(); break;
    case 'charm_picked':
      audio.playCharm();
      flashScreen('lit');
      showHintOnce('first_charm', 'Ông Đăng: "Bùa Gió giúp chạy nhanh và Lướt (Shift) liên tục!"');
      break;
    case 'drifter_steal':
      audio.playHit();
      showHintOnce('first_steal', 'Ông Đăng: "Dùng Tỏa Sáng (F) gần Gió Lạc đang bỏ chạy để đòi lại đom đóm!"');
      break;
    case 'drifter_drop': audio.playPickup(5); toast(`✦ Gió Lạc làm rơi ${e.data.amount} đom đóm!`); break;
    case 'player_hit':
      audio.playHit();
      flashScreen('hit');
      shakeAmt = 0.45;
      if (e.data.by === 'fall') toast('Rơi xuống biển mây! −1 Ngọn Lửa');
      else showHintOnce('first_hit', 'Ông Đăng: "Cẩn thận! Giữ 3 đom đóm và nhấn F để Tỏa Sáng đẩy lùi Bóng Mực."');
      break;
    case 'shade_spawned': audio.playShadeSpawn(); break;
    case 'game_over': finishNight(e.data); break;
  }
}

// ---------- Đồng bộ hiển thị 3D + HUD (chỉ đọc state từ Sim) ----------
const dummy = new THREE.Object3D();
const tmpProj = new THREE.Vector3();
const camTarget = new THREE.Vector3(0, 9, -12);
const camLook = new THREE.Vector3(0, 1.2, 0);

function fmt(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function syncViews(timeSec) {
  const p = sim.player;
  const litList = [];
  let litCount = 0;
  let nearestUnlit = null;
  let nearestUnlitDist = Infinity;

  // Mây nền trôi nhẹ
  cloudRing.rotation.y = timeSec * 0.015;

  for (const L of sim.lanterns) {
    if (L.lit) { litCount++; litList.push(L); }
    else {
      const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
      if (d < nearestUnlitDist) { nearestUnlitDist = d; nearestUnlit = L; }
    }
    const v = lanternViews.get(L.id);
    if (!v) continue;
    const prog = L.lit ? 1 : L.deposited / T.lantern_cost;
    v.glowMat.color.setHex(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    v.glowMat.emissive.setHex(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    v.glowMat.emissiveIntensity = L.lit ? 1.55 + Math.sin(timeSec * 3.2 + L.pos[0]) * 0.16 : 0.15 + prog * 0.72;
    v.core.material.opacity = L.lit ? 0.96 : prog * 0.45;
    v.halo.material.opacity = L.lit ? 0.72 + Math.sin(timeSec * 2.5 + L.pos[2]) * 0.1 : prog * 0.35;
    v.ring.material.opacity = L.lit ? 0.28 + Math.sin(timeSec * 2) * 0.05 : 0;
  }

  // Công thức ánh sáng môi trường bắt buộc: 0.15 + 0.55 * (đèn sáng / tổng đèn)
  hemi.intensity = 0.15 + 0.55 * (litCount / Math.max(1, sim.lanterns.length));
  audio.setLitCount(litCount);

  litList.sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]));
  for (let i = 0; i < sharedLanternLights.length; i++) {
    const sl = sharedLanternLights[i];
    if (i < litList.length) {
      sl.position.set(litList[i].pos[0], litList[i].pos[1] + 3.4, litList[i].pos[2]);
      sl.intensity = 120;
    } else {
      sl.intensity = 0;
    }
  }

  // Đom đóm (InstancedMesh)
  const mCount = Math.min(sim.motes.length, MAX_MOTE_INST);
  moteCoreInst.count = mCount;
  moteHaloInst.count = mCount;
  for (let i = 0; i < mCount; i++) {
    const m = sim.motes[i];
    const bob = 0.78 + Math.sin(timeSec * 2.8 + i) * 0.2;
    const pulseS = 0.92 + Math.sin(timeSec * 5 + i * 1.3) * 0.14;
    dummy.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
    dummy.scale.set(pulseS, pulseS, pulseS);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    moteCoreInst.setMatrixAt(i, dummy.matrix);
    moteHaloInst.setMatrixAt(i, dummy.matrix);
  }
  moteCoreInst.instanceMatrix.needsUpdate = true;
  moteHaloInst.instanceMatrix.needsUpdate = true;

  // Bóng Mực (C4: thân giọt mực + giọt nhỏ + tan sương khi choáng + mắt nhìn theo Mây)
  const liveS = new Set();
  for (const z of sim.shades) {
    liveS.add(z.id);
    let v = shadeViews.get(z.id);
    if (!v) { v = makeShadeMesh(); shadeViews.set(z.id, v); }
    const stunned = z.state === 'stunned';
    v.g.position.set(z.pos[0], z.pos[1] + Math.sin(timeSec * 3.4 + z.pos[0]) * 0.12, z.pos[2]);
    v.g.scale.set(stunned ? 1.15 : 1, stunned ? 0.48 : 1, stunned ? 1.15 : 1);
    v.bodyMat.color.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeBody);
    v.bodyMat.emissive.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeRim);
    v.bodyMat.emissiveIntensity = stunned ? 0.2 : 0.48 + Math.sin(timeSec * 7) * 0.08;
    v.aura.material.opacity = stunned ? 0.18 : 0.52;
    v.drip1.position.y = -0.65 - Math.abs(Math.sin(timeSec * 3.2)) * 0.28;
    v.drip2.position.y = -0.58 - Math.abs(Math.cos(timeSec * 2.7)) * 0.28;
    v.g.lookAt(p.pos[0], v.g.position.y, p.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!liveS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  // Gió Lạc (dải lụa xám xanh uốn lượn)
  const liveD = new Set();
  for (const d of sim.drifters) {
    if (d.state === 'removed') continue;
    liveD.add(d.id);
    let v = drifterViews.get(d.id);
    if (!v) { v = makeDrifterMesh(); drifterViews.set(d.id, v); }
    v.g.position.set(d.pos[0], d.pos[1] + Math.sin(timeSec * 6) * 0.22, d.pos[2]);
    v.g.rotation.y = Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
    v.segMat.emissiveIntensity = d.stolen > 0 ? 0.85 : 0.38;
    for (let i = 0; i < v.segs.length; i++) {
      v.segs[i].position.y = Math.sin(timeSec * 9 - i * 0.9) * 0.14;
      v.segs[i].position.x = Math.cos(timeSec * 7 - i * 0.8) * 0.08;
    }
  }
  for (const [id, v] of drifterViews) if (!liveD.has(id)) { scene.remove(v.g); drifterViews.delete(id); }

  // Bùa Gió
  for (const c of sim.charms) {
    let v = charmViews.get(c.id);
    if (!v) { v = makeCharmMesh(c.pos); charmViews.set(c.id, v); }
    v.g.visible = c.available;
    if (c.available) {
      v.g.rotation.y = timeSec * 1.9;
      v.g.position.y = c.pos[1] + 1.05 + Math.sin(timeSec * 3.2) * 0.18;
    }
  }

  // Lá bay báo gió trước 2 s & trong cơn gió Đêm 3
  const showWind = sim.windEnabled && (sim.wind.active || sim.wind.warnTicks > 0);
  $('wind-badge').classList.toggle('hidden', !showWind);
  if (showWind) {
    $('wind-badge').textContent = sim.wind.active ? '💨 Gió mạnh!' : '🍃 Sắp có gió...';
    const wr = (sim.wind.dir_deg * Math.PI) / 180;
    const wx = Math.cos(wr), wz = Math.sin(wr);
    leafInst.count = LEAF_COUNT;
    for (let i = 0; i < LEAF_COUNT; i++) {
      const lf = leafState[i];
      const flow = ((timeSec * (sim.wind.active ? 15 : 6.5) + lf.phase * 5) % 42) - 21;
      dummy.position.set(p.pos[0] + lf.ox * 0.5 + wx * flow, p.pos[1] + lf.oy, p.pos[2] + lf.oz * 0.5 + wz * flow);
      dummy.rotation.set(timeSec * 3.5 + lf.phase, wr, timeSec * 2.2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leafInst.setMatrixAt(i, dummy.matrix);
    }
    leafInst.instanceMatrix.needsUpdate = true;
  } else {
    leafInst.count = 0;
  }

  // Mây & camera mượt (quay nhẹ quanh đảo ở màn Menu!)
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerMesh.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  playerMesh.visible = p.respawnTicks === 0 && !(p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0);
  const spd = Math.hypot(p.vel[0], p.vel[2]);
  hangPivot.rotation.z = Math.sin(timeSec * 9.5) * Math.min(0.45, spd * 0.045);
  scarfTail.rotation.x = 0.3 + Math.min(0.55, spd * 0.07) + Math.sin(timeSec * 10) * 0.08;

  if (mode === 'menu' || mode === 'intro') {
    const orbit = timeSec * 0.14;
    camera.position.set(Math.sin(orbit) * 34, 18, Math.cos(orbit) * 34);
    camera.lookAt(0, 2, 0);
  } else {
    const th = (yaw * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    const sx = shakeAmt > 0.01 ? (Math.sin(timeSec * 60) * shakeAmt) : 0;
    const sy = shakeAmt > 0.01 ? (Math.cos(timeSec * 53) * shakeAmt * 0.7) : 0;
    shakeAmt *= 0.88;
    camTarget.set(p.pos[0] - fx * 12 + sx, p.pos[1] + 8.4 + sy, p.pos[2] - fz * 12);
    camera.position.lerp(camTarget, 0.22);
    camLook.set(p.pos[0], p.pos[1] + 1.3, p.pos[2]);
    camera.lookAt(camLook);
  }

  if (pulseT < 0.5) {
    pulseT += DT * 2;
    const r = T.pulse_radius * Math.min(1, pulseT * 2.2) + 0.1;
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.12, p.pos[2]);
    pulseRing.scale.set(r, r, 1);
    pulseRing.material.opacity = Math.max(0, 0.9 - pulseT * 1.8);
  } else pulseRing.material.opacity = 0;

  if (!lowFx && p.dashTicks > 0) {
    dashTrail.position.set(p.pos[0] - p.facing[0] * 1.05, p.pos[1] + 0.55, p.pos[2] - p.facing[1] * 1.05);
    dashTrail.rotation.z = -Math.atan2(p.facing[0], p.facing[1]);
    dashTrail.material.opacity = 0.62;
  } else {
    dashTrail.material.opacity = 0;
  }

  if (!lowFx && rippleT < 0.45) {
    rippleT += DT * 1.5;
    const rr = 0.6 + rippleT * 3.4;
    landRipple.scale.set(rr, rr, 1);
    landRipple.material.opacity = Math.max(0, 0.65 - rippleT * 1.45);
  } else {
    landRipple.material.opacity = 0;
  }

  // C5: Không khí từng đảo
  if (bridgeVisual) bridgeVisual.rotation.x = Math.sin(timeSec * 2.2) * 0.025;
  if (bellVisual) {
    if (bellRingT > 0) {
      bellRingT = Math.max(0, bellRingT - DT);
      bellVisual.rotation.z = Math.sin(timeSec * 18) * 0.3 * (bellRingT / 1.6);
    } else {
      bellVisual.rotation.z = 0;
    }
  }
  if (mode === 'dawn') {
    dawnBlend = Math.min(1, dawnBlend + DT * 0.35);
    curSkyColor.copy(skyColor).lerp(dawnColor, dawnBlend * 0.68);
    scene.background.copy(curSkyColor);
    for (const v of lanternViews.values()) {
      v.glowMat.emissiveIntensity = Math.max(0.25, 1.55 * (1 - dawnBlend * 0.7));
      v.halo.material.opacity = Math.max(0.1, 0.72 * (1 - dawnBlend * 0.75));
    }
  }

  // HUD 7 thành phần
  renderFlames(p.flames);
  $('charm-badge').classList.toggle('hidden', p.charmTicks <= 0);
  if (p.charmTicks > 0) $('h-charm').textContent = `${(p.charmTicks / TPS).toFixed(1)}s`;
  $('h-time').textContent = fmt(sim.timeLeft);
  $('h-time-pill').classList.toggle('danger', sim.timeLeft <= 30);
  $('h-lit').textContent = `${litCount}/${sim.lanterns.length}`;
  $('h-score').textContent = String(sim.score);

  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle('filled', i < p.carried);
  }

  const dashCooling = p.dashCd > 0 && p.charmTicks <= 0;
  $('sk-dash').classList.toggle('cooling', dashCooling);
  $('sk-dash').classList.toggle('boosted', p.charmTicks > 0);
  $('cd-dash').textContent = p.charmTicks > 0 ? '∞ Bùa' : dashCooling ? `${(p.dashCd / TPS).toFixed(1)}s` : 'Sẵn sàng';

  const pulseCooling = p.pulseCd > 0 || p.carried < T.pulse_cost;
  $('sk-pulse').classList.toggle('cooling', pulseCooling);
  $('cd-pulse').textContent = p.pulseCd > 0 ? `${(p.pulseCd / TPS).toFixed(1)}s` : p.carried < T.pulse_cost ? `Cần ${T.pulse_cost}✦` : 'Sẵn sàng';

  let nearLantern = null;
  for (const L of sim.lanterns) {
    if (L.lit) continue;
    if (Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius && Math.abs(L.pos[1] - p.pos[1]) <= X.interact_dy) {
      nearLantern = L;
      break;
    }
  }
  const promptEl = $('interact-prompt');
  if (nearLantern && mode === 'playing') {
    promptEl.textContent = `E — Nạp ánh sáng (${nearLantern.deposited}/${T.lantern_cost})`;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }

  const arrowEl = $('lantern-arrow');
  if (nearestUnlit && mode === 'playing') {
    tmpProj.set(nearestUnlit.pos[0], nearestUnlit.pos[1] + 3.4, nearestUnlit.pos[2]).project(camera);
    const inFront = tmpProj.z <= 1;
    const onScreen = inFront && Math.abs(tmpProj.x) <= 0.92 && Math.abs(tmpProj.y) <= 0.92;
    if (onScreen) {
      arrowEl.classList.add('hidden');
    } else {
      const sx = inFront ? tmpProj.x : -tmpProj.x;
      const sy = inFront ? tmpProj.y : -tmpProj.y;
      const ang = Math.atan2(sy, sx);
      const px = innerWidth * 0.5 + Math.cos(ang) * (innerWidth * 0.43);
      const py = innerHeight * 0.5 - Math.sin(ang) * (innerHeight * 0.40);
      arrowEl.style.left = `${px - 21}px`;
      arrowEl.style.top = `${py - 21}px`;
      arrowEl.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
      arrowEl.classList.remove('hidden');
    }
  } else {
    arrowEl.classList.add('hidden');
  }
}

// ---------- Bộ đếm FPS (?fps) & Tự hạ pixelRatio (O7) ----------
const showFps = new URLSearchParams(location.search).has('fps');
if (showFps) $('fps-box').classList.remove('hidden');
const fpsSamples = [];
let fpsWindowAcc = 0, fpsWindowFrames = 0;

buildNightScene(getNight(1));

function frame(now) {
  const dt = Math.min(0.25, (now - lastNow) / 1000);
  lastNow = now;

  if (dt > 0) {
    const instFps = 1 / dt;
    fpsSamples.push(instFps);
    if (fpsSamples.length > 300) fpsSamples.shift();
    fpsWindowAcc += dt;
    fpsWindowFrames++;
    if (fpsWindowAcc >= 3) {
      const avg = fpsWindowFrames / fpsWindowAcc;
      if (avg < 40 && pixelRatioCap > 1.0) {
        pixelRatioCap = 1.0;
        renderer.setPixelRatio(1.0);
      }
      lowFx = avg < 35;
      fpsWindowAcc = 0;
      fpsWindowFrames = 0;
    }
    if (showFps && fpsSamples.length > 5) {
      const sorted = fpsSamples.slice().sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p5 = sorted[Math.floor(sorted.length * 0.05)];
      $('fps-box').textContent = `FPS avg: ${avg.toFixed(1)} | p5: ${p5.toFixed(1)} | dpr: ${pixelRatioCap}`;
    }
  }

  if (mode === 'playing') {
    if (keys.has('KeyQ')) yaw += 95 * dt;
    if (keys.has('KeyR')) yaw -= 95 * dt;
    acc += dt;
    while (acc >= DT && mode === 'playing') {
      const wasWarn = sim.wind.warnTicks;
      const inp = readInput();
      sim.step(inp);
      if (prevGrounded && !sim.player.grounded && sim.player.vel[1] > 1) audio.playJump();
      if (!prevGrounded && sim.player.grounded) {
        landRipple.position.set(sim.player.pos[0], sim.player.pos[1] + 0.06, sim.player.pos[2]);
        rippleT = 0;
      }
      prevGrounded = sim.player.grounded;
      if (wasWarn === 0 && sim.wind.warnTicks > 0) audio.playWindWarn();
      const secLeft = Math.ceil(sim.timeLeft);
      if (secLeft <= 10 && secLeft >= 1 && secLeft < lastCountdownSec) {
        lastCountdownSec = secLeft;
        audio.playCountdown(secLeft);
      }
      for (const e of sim.drainEvents()) onEvent(e);
      acc -= DT;
    }
  }

  syncViews(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
