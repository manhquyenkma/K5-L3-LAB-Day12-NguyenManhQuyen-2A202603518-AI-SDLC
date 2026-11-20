// Bản chơi 3D Three.js (Phase 2 — Ba hòn đảo), chạy trên cùng lõi Sim với chế độ headless.
// Mọi màu sắc bám sát bảng màu chuẩn TICKET-02 Phần 3; mô hình/chất liệu điêu khắc tại public/assets.js.
import * as THREE from 'three';
import { Sim, DT, TPS } from '/src/sim.js';
import { TUNING as T, EXTRA as X } from '/src/tuning.js';
import { getNight } from '/src/nights/index.js';
import { AudioEngine } from '/audio.js';
import { createAssetPack } from '/assets.js';

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
  shadeRimColorblind: 0x00b3ff, // TICKET-03 Phần 6: chế độ mù màu (#00B3FF)
  shadeStun: 0x3a3450,
  mayRobe: 0xe8e2d0,
  mayScarfCharm: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
  danger: 0xff5a5f,
  dangerColorblind: 0xffffff,
  uiText: 0xf5f1e6,
};

const $ = (id) => document.getElementById(id);

// ---------- Cài đặt lưu bền vững (localStorage, gồm Bảng màu dễ phân biệt) ----------
const SETTINGS_KEY = 'ddl_settings_v1';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        volume: Math.max(0, Math.min(1, Number(s.volume ?? 0.7))),
        mouseSens: Math.max(0.1, Math.min(1, Number(s.mouseSens ?? 0.35))),
        colorblind: !!s.colorblind,
      };
    }
  } catch { /* bỏ qua */ }
  return { volume: 0.7, mouseSens: 0.35, colorblind: false };
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
const settings = loadSettings();
document.body.classList.toggle('colorblind', settings.colorblind);
const audio = new AudioEngine(settings.volume);

// ---------- HUD đom đóm động (10 -> 20 theo sức chứa tăng dần) & SVG Ngọn Lửa ----------
const moteBar = $('mote-bar');
const moteSlots = [];
for (let i = 0; i < T.capacity_max; i++) {
  const d = document.createElement('div');
  d.className = 'mote-slot';
  if (i >= T.carry_capacity) d.style.display = 'none';
  moteBar.appendChild(d);
  moteSlots.push(d);
}
const moteCountLbl = document.createElement('span');
moteCountLbl.className = 'mote-count-lbl';
moteCountLbl.textContent = `0/${T.carry_capacity}`;
moteBar.appendChild(moteCountLbl);

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

// ---------- Renderer, Scene & Asset Pack ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatioCap = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatioCap);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.prepend(renderer.domElement);

const assets = createAssetPack(PALETTE);
const tex = assets.textures;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0075);
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 340);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0x98aff5, PALETTE.fog, 0.15);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xd0ddff, 0.48);
moonLight.position.set(-55, 82, -45);
scene.add(moonLight);
const rimBackLight = new THREE.DirectionalLight(0xffb347, 0.18);
rimBackLight.position.set(40, 28, 50);
scene.add(rimBackLight);

// Bầu trời sao lấp lánh + Mặt trăng hào quang
const starCount = 260;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const phi = Math.acos(0.16 + ((i * 73) % 100) / 120);
  const theta = (i * 2.39996) % (Math.PI * 2);
  const r = 185 + (i % 6) * 8;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi);
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: PALETTE.moteCore, map: tex.moteGlow, size: 3.0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
);
scene.add(stars);

const moonOrb = new THREE.Mesh(
  new THREE.SphereGeometry(7.2, 24, 18),
  new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, fog: false }),
);
moonOrb.position.set(-90, 96, -80);
const moonHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: tex.moonGlow, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
);
moonHalo.scale.set(48, 48, 1);
moonOrb.add(moonHalo);
scene.add(moonOrb);

// Biển mây tầng sâu có họa tiết trôi chậm (#12384A)
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(300, 64),
  new THREE.MeshBasicMaterial({ map: tex.cloudSea }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -11;
scene.add(sea);

const cloudRing = new THREE.Group();
const cloudMat = new THREE.MeshStandardMaterial({ color: 0x263566, emissive: PALETTE.fog, emissiveIntensity: 0.25, roughness: 0.95, transparent: true, opacity: 0.62 });
const cloudGeo = new THREE.DodecahedronGeometry(6.5, 1);
for (let i = 0; i < 20; i++) {
  const ang = (i / 20) * Math.PI * 2;
  const dist = 66 + (i % 4) * 15;
  const c = new THREE.Mesh(cloudGeo, cloudMat);
  c.position.set(Math.cos(ang) * dist, -6.4 + (i % 3) * 1.5, Math.sin(ang) * dist);
  c.scale.set(1.6 + (i % 3) * 0.45, 0.34, 1.2 + (i % 2) * 0.35);
  cloudRing.add(c);
}
scene.add(cloudRing);

// Bụi đom đóm khí quyển bay lơ lửng nhẹ (1 Points draw call)
const ambientDustCount = 90;
const dustPos = new Float32Array(ambientDustCount * 3);
for (let i = 0; i < ambientDustCount; i++) {
  dustPos[i * 3] = (((i * 47) % 90) - 45);
  dustPos[i * 3 + 1] = 0.8 + (i % 12) * 0.9;
  dustPos[i * 3 + 2] = (((i * 83) % 90) - 45);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const ambientDust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({ map: tex.moteGlow, color: PALETTE.moteHalo, size: 0.65, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
);
scene.add(ambientDust);

// Nhóm cảnh thay đổi theo từng Đêm
let worldGroup = new THREE.Group();
scene.add(worldGroup);

// Tối đa 2 đèn điểm thật cho 2 Đèn Lồng Lớn sáng gần nhất (O5)
const sharedLanternLights = [
  new THREE.PointLight(PALETTE.lanternLit, 0, 34, 1.7),
  new THREE.PointLight(PALETTE.lanternLit, 0, 34, 1.7),
];
scene.add(sharedLanternLights[0], sharedLanternLights[1]);

// Nhân vật Mây điêu khắc từ public/assets.js
const playerRig = assets.buildPlayer();
scene.add(playerRig.root);

// Hiệu ứng vòng Tỏa Sáng, vệt lướt C3, gợn sương đáp C3
const pulseRing = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: tex.runeRing, color: PALETTE.lanternCore, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 99;

const dashTrail = new THREE.Mesh(
  new THREE.PlaneGeometry(0.95, 2.8),
  new THREE.MeshBasicMaterial({ map: tex.warmGlow, color: PALETTE.moteHalo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
);
dashTrail.rotation.x = -Math.PI / 2;
scene.add(dashTrail);

const landRipple = new THREE.Mesh(
  new THREE.RingGeometry(0.45, 0.88, 28),
  new THREE.MeshBasicMaterial({ color: PALETTE.uiText, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
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

// InstancedMesh đom đóm (lõi tinh thể + quầng mềm + cánh nhỏ) & lá gió Đêm 3
const MAX_MOTE_INST = 48;
const moteCoreInst = new THREE.InstancedMesh(
  new THREE.OctahedronGeometry(0.2, 1),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
  MAX_MOTE_INST,
);
const moteHaloInst = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.46, 10, 8),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }),
  MAX_MOTE_INST,
);
moteCoreInst.count = 0;
moteHaloInst.count = 0;
scene.add(moteCoreInst, moteHaloInst);

const LEAF_COUNT = 44;
const leafInst = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.48, 0.22),
  new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
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

const cachedTextures = new Set(Object.values(tex));
const cachedGeos = new Set(Object.values(assets.geos));

function disposeGroup(g) {
  g.traverse((obj) => {
    if (obj.geometry && !cachedGeos.has(obj.geometry)) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && cachedTextures.has(m.map)) continue;
        m.dispose();
      }
    }
  });
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

  const grassMat = new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.88 });
  const sandMat = new THREE.MeshStandardMaterial({ map: tex.sandStone, roughness: 0.86 });
  const woodMat = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.84 });
  const cliffMat = new THREE.MeshStandardMaterial({ map: tex.sandStone, color: 0x8b7e6a, roughness: 0.94 });

  // Đảo nổi có mặt cỏ hội họa, vách đá tầng & khối đá thuôn nhọn dưới biển mây
  for (const isl of nightCfg.islands) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r - 0.8, 1.8, 56), [sandMat, grassMat, cliffMat]);
    top.position.set(isl.cx, isl.y - 0.9, isl.cz);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(isl.r - 0.7, isl.r * 0.72, 3.6, 28), cliffMat);
    skirt.position.set(isl.cx, isl.y - 3.6, isl.cz);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(isl.r * 0.72, 6.2, 20), cliffMat);
    tip.rotation.x = Math.PI;
    tip.position.set(isl.cx, isl.y - 8.5, isl.cz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(isl.r - 0.25, 0.45, 8, 56), sandMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(isl.cx, isl.y - 0.12, isl.cz);
    worldGroup.add(top, skirt, tip, rim);
  }

  // Cây cối, khóm tre, đá tảng & lối đá trang trí (InstancedMesh)
  assets.addScenery(worldGroup, nightCfg);

  // Cầu tre Đêm 2: thân tre ghép ván, trụ tre hai bên & dây thừng trang trí (không cản rơi)
  if (nightCfg.bridge) {
    const b = nightCfg.bridge;
    const w = b.xMax - b.xMin;
    const d = b.zMax - b.zMin;
    const bg = new THREE.Group();
    bg.position.set((b.xMin + b.xMax) / 2, b.y, (b.zMin + b.zMax) / 2);
    const beamL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, w + 1, 8), woodMat);
    beamL.rotation.z = Math.PI / 2;
    beamL.position.set(0, -0.18, d / 2 - 0.25);
    const beamR = beamL.clone();
    beamR.position.z = -(d / 2 - 0.25);
    bg.add(beamL, beamR);

    for (let x = -w / 2 + 0.35; x < w / 2; x += 0.75) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, d + 0.12), (Math.round(x * 2) % 2 === 0) ? woodMat : sandMat);
      plank.position.set(x, -0.06, 0);
      bg.add(plank);
    }
    // Cột tre đầu & giữa cầu (chỉ trang trí thị giác)
    for (const px of [-w / 2 + 0.5, 0, w / 2 - 0.5]) {
      for (const pz of [-d / 2 - 0.15, d / 2 + 0.15]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 6), woodMat);
        post.position.set(px, 0.65, pz);
        bg.add(post);
      }
    }
    bridgeVisual = bg;
    worldGroup.add(bg);
  }

  // Các tầng đá Đêm 3 (vách đá + mặt cỏ + viền đá cát)
  for (const t of nightCfg.tiers) {
    if (t.kind === 'disk') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(t.rMax, t.rMax + 0.35, t.y, 44), [cliffMat, grassMat, cliffMat]);
      m.position.set(0, t.y / 2, 0);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(t.rMax, 0.24, 8, 44), sandMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = t.y - 0.04;
      worldGroup.add(m, trim);
    } else if (t.kind === 'halfRing') {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, t.rMax, 0, Math.PI, true);
      shape.absarc(0, 0, t.rMin, Math.PI, 0, false);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: t.y, bevelEnabled: false, curveSegments: 40 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, [grassMat, cliffMat]);
      worldGroup.add(m);
    }
  }

  // 2 dốc gỗ bậc thang Đêm 3
  for (const r of nightCfg.ramps) {
    const rad = (r.deg * Math.PI) / 180;
    const lenH = r.rFoot - r.rTop;
    const dy = r.yTop - r.yFoot;
    const slopeLen = Math.hypot(lenH, dy);
    const pitch = Math.atan2(dy, lenH);
    const rMid = (r.rFoot + r.rTop) / 2;
    const g = new THREE.Group();
    g.position.set(rMid * Math.cos(rad), (r.yFoot + r.yTop) / 2 - 0.1, rMid * Math.sin(rad));
    g.rotation.y = -rad;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.5, 0.28, r.width), woodMat);
    plank.rotation.z = -pitch;
    g.add(plank);
    // Bậc gỗ nổi + gờ hai bên
    for (let s = -slopeLen * 0.42; s <= slopeLen * 0.42; s += 0.9) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, r.width - 0.15), sandMat);
      step.position.set(s * Math.cos(pitch), -s * Math.sin(pitch) + 0.15, 0);
      step.rotation.z = -pitch;
      g.add(step);
    }
    const railL = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.35, 0.16, 0.16), sandMat);
    railL.position.set(0, 0.18, r.width / 2 - 0.08);
    railL.rotation.z = -pitch;
    const railR = railL.clone();
    railR.position.z = -(r.width / 2 - 0.08);
    g.add(railL, railR);
    worldGroup.add(g);
  }

  // Tháp chuông cổ Đêm 3 (đế đá + 4 trụ sơn đỏ + mái đình cong 2 tầng + chuông đồng điêu khắc)
  if (nightCfg.tower) {
    const tw = nightCfg.tower;
    const tg = new THREE.Group();
    tg.position.set(tw.cx, tw.yBase, tw.cz);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(tw.r, tw.r + 0.28, 1.4, 12), sandMat);
    base.position.y = 0.7;
    const coreCol = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 0.72, tw.r * 0.85, tw.height - 2.6, 12), woodMat);
    coreCol.position.y = (tw.height - 2.6) / 2 + 1.2;
    const pillarMat = new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfCharm, roughness: 0.65 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, tw.height, 8), pillarMat);
      col.position.set(Math.cos(a) * (tw.r - 0.22), tw.height / 2, Math.sin(a) * (tw.r - 0.22));
      tg.add(col);
    }
    const roof1 = new THREE.Mesh(assets.geos.pagodaRoof, pillarMat);
    roof1.scale.set(tw.r * 1.15, 2.2, tw.r * 1.15);
    roof1.position.y = tw.height - 0.3;
    const roof2 = new THREE.Mesh(assets.geos.pagodaRoof, pillarMat);
    roof2.scale.set(tw.r * 0.78, 1.7, tw.r * 0.78);
    roof2.position.y = tw.height + 1.5;
    const goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.55, roughness: 0.28, emissive: PALETTE.lanternLit, emissiveIntensity: 0.2 });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 8), goldMat);
    spire.position.y = tw.height + 3.4;
    const bell = new THREE.Mesh(assets.geos.bell, goldMat);
    bell.scale.set(1.15, 1.25, 1.15);
    bell.position.y = tw.height - 1.15;
    bellVisual = bell;
    tg.add(base, coreCol, roof1, roof2, spire, bell);
    worldGroup.add(tg);
  }

  // Bục nhảy gió (bệ đá + vòng hoa văn rune phát sáng)
  for (const pad of nightCfg.jumpPads) {
    const g = new THREE.Group();
    g.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r * 1.2, 0.24, 24), sandMat);
    base.position.y = 0.12;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.r * 0.88, pad.r * 0.88, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.lanternLit, emissiveIntensity: 0.7, roughness: 0.3 }),
    );
    disc.position.y = 0.25;
    const rune = new THREE.Mesh(
      new THREE.PlaneGeometry(pad.r * 2.4, pad.r * 2.4),
      new THREE.MeshBasicMaterial({ map: tex.runeRing, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.34;
    g.add(base, disc, rune);
    worldGroup.add(g);
  }

  // Đèn Lồng Lớn kiểu miếu Hội An
  for (const L of nightCfg.lanterns) {
    const v = assets.buildLantern(L, T.safe_radius);
    worldGroup.add(v.g);
    lanternViews.set(L.id, v);
  }

  scene.add(worldGroup);
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
  $('set-cb').checked = !!settings.colorblind;
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
$('set-cb').onchange = (e) => {
  settings.colorblind = !!e.target.checked;
  document.body.classList.toggle('colorblind', settings.colorblind);
  saveSettings(settings);
};
$('btn-settings-back').onclick = () => {
  if (prevSettingsReturn === 'paused') showOnly('ov-pause');
  else showOnly('ov-menu');
};

// ---------- Điều khiển ----------
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
  const warnPrefix = settings.colorblind ? '⚠ ' : '';
  switch (e.name) {
    case 'mote_picked': audio.playPickup(e.data.carried); break;
    case 'deposit': audio.playDeposit(); toast(`Nạp ${e.data.amount} ánh sáng vào ${e.data.lantern_id}`); break;
    case 'refuel': audio.playDeposit(); toast(`🛢 Châm dầu ${e.data.lantern_id}: ${e.data.fuel}%`); break;
    case 'lantern_lit':
      audio.playLanternLit();
      flashScreen('lit');
      bellRingT = 1.6;
      toast(e.data.relight ? `🏮 Đã thắp lại ${e.data.lantern_id}! (+40 · Sức chứa ${sim.playerCapacity})` : `🏮 Đã thắp sáng ${e.data.lantern_id}! (+100 · Sức chứa ${sim.playerCapacity})`);
      showHintOnce('first_lit', 'Ông Đăng: "Hãy châm dầu khi đèn xuống thấp — giữ đủ đèn tới bình minh!"');
      break;
    case 'lantern_out':
      audio.playHit();
      toast(`${warnPrefix}Đèn ${e.data.lantern_id} đã cạn dầu và tắt! (Thắp lại chỉ cần 5 đom đóm)`);
      break;
    case 'fuel_drain':
      toast(`${warnPrefix}Bóng Mực đang hút dầu đèn ${e.data.lantern_id} (${e.data.fuel}%)!`);
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
      if (e.data.by === 'fall') toast(`${warnPrefix}Rơi xuống biển mây! −1 Ngọn Lửa`);
      else showHintOnce('first_hit', `${warnPrefix}Ông Đăng: "Cẩn thận! Giữ 3 đom đóm và nhấn F để Tỏa Sáng đẩy lùi Bóng Mực."`);
      break;
    case 'shade_spawned': audio.playShadeSpawn(); break;
    case 'game_over': finishNight(e.data); break;
  }
}

// ---------- Đồng bộ hiển thị 3D + HUD ----------
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

  cloudRing.rotation.y = timeSec * 0.014;
  tex.cloudSea.offset.x = (timeSec * 0.006) % 1;
  tex.cloudSea.offset.y = (timeSec * 0.004) % 1;
  ambientDust.position.y = Math.sin(timeSec * 0.6) * 0.4;

  const blink1Hz = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2); // nhấp nháy chậm 1 Hz khi fuel < 30

  for (const L of sim.lanterns) {
    if (L.lit) { litCount++; litList.push(L); }
    else {
      const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
      if (d < nearestUnlitDist) { nearestUnlitDist = d; nearestUnlit = L; }
    }
    const v = lanternViews.get(L.id);
    if (!v) continue;
    const cost = L.everLit ? T.relight_cost : T.lantern_cost;
    const prog = L.lit ? 1 : L.deposited / cost;
    const fuelPct = L.lit ? (L.fuelU / 6000) : 0;
    const lowFuel = L.lit && L.fuelU < T.low_fuel_threshold * 60;

    // Phân biệt đèn tắt/sáng không cần màu (TICKET-03 §6): đèn tắt xẹp 20% + giấy rách; đèn sáng căng phồng + giấy lành
    const wantMap = L.lit ? tex.lanternSilk : tex.lanternSilkTorn;
    if (v.glowMat.map !== wantMap) {
      v.glowMat.map = wantMap;
      v.glowMat.needsUpdate = true;
    }
    v.body.scale.set(L.lit ? 1 : 1.06, L.lit ? 1 : 0.8, L.lit ? 1 : 1.06);

    const pulseMul = lowFuel ? (0.35 + 0.65 * blink1Hz) : 1;
    v.glowMat.color.setHex(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    v.glowMat.emissive.setHex(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    v.glowMat.emissiveIntensity = L.lit ? (1.6 * pulseMul) : (0.15 + prog * 0.72);
    v.core.material.opacity = L.lit ? (0.96 * pulseMul) : prog * 0.45;
    v.halo.material.opacity = L.lit ? ((0.78 + Math.sin(timeSec * 2.5 + L.pos[2]) * 0.1) * pulseMul) : prog * 0.35;
    v.lanternGroup.rotation.z = Math.sin(timeSec * 1.5 + L.pos[0]) * 0.04;
    // Vùng an toàn chỉ tồn tại khi đèn sáng VÀ fuel >= 30
    const safeActive = L.lit && !lowFuel;
    v.ring.material.opacity = safeActive ? (0.42 + Math.sin(timeSec * 2.0) * 0.08) : 0;
    if (safeActive) v.ring.rotation.z = timeSec * 0.14;

    // Thanh dầu 3D trên đèn đang sáng (nhấp nháy 1 Hz khi fuel < 30)
    v.fuelBarGroup.visible = L.lit;
    if (L.lit) {
      v.fuelBarGroup.lookAt(camera.position);
      const frac = Math.max(0.01, Math.min(1, fuelPct));
      v.fuelFill.scale.x = frac;
      v.fuelFill.position.x = -(1 - frac) * 0.89;
      v.fuelFillMat.color.setHex(lowFuel ? (settings.colorblind ? PALETTE.dangerColorblind : PALETTE.danger) : PALETTE.lanternLit);
      v.fuelFillMat.opacity = lowFuel ? (0.3 + 0.7 * blink1Hz) : 1;
      v.fuelFillMat.transparent = lowFuel;
    }
  }

  // Công thức ánh sáng môi trường bắt buộc: 0.15 + 0.55 * (đèn sáng / tổng đèn)
  hemi.intensity = 0.15 + 0.55 * (litCount / Math.max(1, sim.lanterns.length));
  audio.setLitCount(litCount);

  litList.sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]));
  for (let i = 0; i < sharedLanternLights.length; i++) {
    const sl = sharedLanternLights[i];
    if (i < litList.length) {
      sl.position.set(litList[i].pos[0], litList[i].pos[1] + 3.4, litList[i].pos[2]);
      sl.intensity = 125;
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
    const bob = 0.8 + Math.sin(timeSec * 3.0 + i) * 0.22;
    const pulseS = 0.9 + Math.sin(timeSec * 5.2 + i * 1.3) * 0.16;
    dummy.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
    dummy.scale.set(pulseS, pulseS, pulseS);
    dummy.rotation.set(0, timeSec * 2 + i, 0);
    dummy.updateMatrix();
    moteCoreInst.setMatrixAt(i, dummy.matrix);
    moteHaloInst.setMatrixAt(i, dummy.matrix);
  }
  moteCoreInst.instanceMatrix.needsUpdate = true;
  moteHaloInst.instanceMatrix.needsUpdate = true;

  // Bóng Mực (hỗ trợ trạng thái drain + chế độ mù màu #00B3FF cho viền & mắt)
  const rimHex = settings.colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
  const eyeHex = settings.colorblind ? PALETTE.shadeRimColorblind : PALETTE.uiText;
  const liveS = new Set();
  for (const z of sim.shades) {
    liveS.add(z.id);
    let v = shadeViews.get(z.id);
    if (!v) { v = assets.buildShade(); scene.add(v.g); shadeViews.set(z.id, v); }
    const stunned = z.state === 'stunned';
    const draining = z.state === 'drain';
    v.g.position.set(z.pos[0], z.pos[1] + Math.sin(timeSec * (draining ? 7 : 3.5) + z.pos[0]) * 0.14, z.pos[2]);
    v.g.scale.set(stunned ? 1.2 : 1, stunned ? 0.45 : (draining ? 1.12 : 1), stunned ? 1.2 : 1);
    v.bodyMat.color.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeBody);
    v.bodyMat.emissive.setHex(stunned ? PALETTE.shadeStun : rimHex);
    v.bodyMat.emissiveIntensity = stunned ? 0.22 : (draining ? 0.95 : 0.52 + Math.sin(timeSec * 7) * 0.1);
    v.eyeMat.color.setHex(eyeHex);
    v.aura.material.color.setHex(settings.colorblind ? PALETTE.shadeRimColorblind : 0xffffff);
    v.aura.material.opacity = stunned ? 0.18 : (draining ? 0.85 : 0.58);
    for (let i = 0; i < v.tendrils.length; i++) {
      const td = v.tendrils[i];
      td.mesh.rotation.z = Math.sin(timeSec * 6 + td.phase) * 0.26;
      td.mesh.position.y = -0.76 - Math.sin(timeSec * 4 + td.phase) * 0.12;
    }
    v.g.lookAt(p.pos[0], v.g.position.y, p.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!liveS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  // Gió Lạc (dải lụa 7 đốt mềm mại)
  const liveD = new Set();
  for (const d of sim.drifters) {
    if (d.state === 'removed') continue;
    liveD.add(d.id);
    let v = drifterViews.get(d.id);
    if (!v) { v = assets.buildDrifter(); scene.add(v.g); drifterViews.set(d.id, v); }
    v.g.position.set(d.pos[0], d.pos[1] + Math.sin(timeSec * 6) * 0.22, d.pos[2]);
    v.g.rotation.y = Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
    v.segMat.emissiveIntensity = d.stolen > 0 ? 0.9 : 0.42;
    v.swirl.rotation.z = timeSec * 4;
    for (let i = 0; i < v.segs.length; i++) {
      v.segs[i].position.y = Math.sin(timeSec * 10 - i * 0.75) * 0.14;
      v.segs[i].position.x = Math.cos(timeSec * 8 - i * 0.65) * 0.1;
    }
  }
  for (const [id, v] of drifterViews) if (!liveD.has(id)) { scene.remove(v.g); drifterViews.delete(id); }

  // Bùa Gió
  for (const c of sim.charms) {
    let v = charmViews.get(c.id);
    if (!v) { v = assets.buildCharm(c.pos); scene.add(v.g); charmViews.set(c.id, v); }
    v.g.visible = c.available;
    if (c.available) {
      v.g.rotation.y = timeSec * 1.8;
      v.ring.rotation.x = timeSec * 2.2;
      v.g.position.y = c.pos[1] + 1.15 + Math.sin(timeSec * 3.2) * 0.18;
    }
  }

  // Lá bay báo gió Đêm 3
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

  // Mây (hoạt họa chạy, tay áo, khăn bay, đèn nón lá lắc)
  const pr = playerRig;
  pr.root.position.set(p.pos[0], p.pos[1], p.pos[2]);
  pr.root.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  pr.root.visible = p.respawnTicks === 0 && !(p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0);
  const spd = Math.hypot(p.vel[0], p.vel[2]);
  const stride = Math.min(1, spd / 6);
  const walkSin = Math.sin(timeSec * 12) * stride;
  pr.leftLeg.rotation.x = walkSin * 0.55;
  pr.rightLeg.rotation.x = -walkSin * 0.55;
  pr.leftArm.rotation.x = -walkSin * 0.45;
  pr.rightArm.rotation.x = walkSin * 0.45;
  pr.hangPivot.rotation.z = Math.sin(timeSec * 9.5) * Math.min(0.45, spd * 0.045);
  pr.scarfTail1.rotation.x = 0.3 + stride * 0.5 + Math.sin(timeSec * 11) * 0.1;
  pr.scarfTail2.rotation.x = 0.38 + stride * 0.55 + Math.cos(timeSec * 10) * 0.12;
  pr.shadow.visible = p.grounded;

  if (mode === 'menu' || mode === 'intro') {
    const orbit = timeSec * 0.13;
    camera.position.set(Math.sin(orbit) * 35, 17.5, Math.cos(orbit) * 35);
    camera.lookAt(0, 2.2, 0);
  } else {
    const th = (yaw * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    const sx = shakeAmt > 0.01 ? (Math.sin(timeSec * 60) * shakeAmt) : 0;
    const sy = shakeAmt > 0.01 ? (Math.cos(timeSec * 53) * shakeAmt * 0.7) : 0;
    shakeAmt *= 0.88;
    camTarget.set(p.pos[0] - fx * 11.8 + sx, p.pos[1] + 8.2 + sy, p.pos[2] - fz * 11.8);
    camera.position.lerp(camTarget, 0.22);
    camLook.set(p.pos[0], p.pos[1] + 1.35, p.pos[2]);
    camera.lookAt(camLook);
  }

  if (pulseT < 0.5) {
    pulseT += DT * 2;
    const r = T.pulse_radius * Math.min(1, pulseT * 2.2) + 0.1;
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.14, p.pos[2]);
    pulseRing.scale.set(r, r, 1);
    pulseRing.rotation.z = timeSec * 2.5;
    pulseRing.material.opacity = Math.max(0, 0.92 - pulseT * 1.85);
  } else pulseRing.material.opacity = 0;

  if (!lowFx && p.dashTicks > 0) {
    dashTrail.position.set(p.pos[0] - p.facing[0] * 1.15, p.pos[1] + 0.6, p.pos[2] - p.facing[1] * 1.15);
    dashTrail.rotation.z = -Math.atan2(p.facing[0], p.facing[1]);
    dashTrail.material.opacity = 0.72;
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

  if (bridgeVisual) bridgeVisual.rotation.x = Math.sin(timeSec * 2.2) * 0.022;
  if (bellVisual) {
    if (bellRingT > 0) {
      bellRingT = Math.max(0, bellRingT - DT);
      bellVisual.rotation.z = Math.sin(timeSec * 18) * 0.32 * (bellRingT / 1.6);
    } else {
      bellVisual.rotation.z = 0;
    }
  }
  if (mode === 'dawn') {
    dawnBlend = Math.min(1, dawnBlend + DT * 0.35);
    curSkyColor.copy(skyColor).lerp(dawnColor, dawnBlend * 0.68);
    scene.background.copy(curSkyColor);
    for (const v of lanternViews.values()) {
      v.glowMat.emissiveIntensity = Math.max(0.25, 1.6 * (1 - dawnBlend * 0.7));
      v.halo.material.opacity = Math.max(0.1, 0.78 * (1 - dawnBlend * 0.75));
    }
  }

  // HUD 7 thành phần (TICKET-03: sức chứa động carried/capacity, ngưỡng đèn bình minh, cảnh báo ⚠ mù màu)
  renderFlames(p.flames);
  $('charm-badge').classList.toggle('hidden', p.charmTicks <= 0);
  if (p.charmTicks > 0) $('h-charm').textContent = `${(p.charmTicks / TPS).toFixed(1)}s`;
  const timeDanger = sim.timeLeft <= 30;
  $('h-time-ico').textContent = (timeDanger && settings.colorblind) ? '⚠' : '🌙';
  $('h-time').textContent = fmt(sim.timeLeft);
  $('h-time-pill').classList.toggle('danger', timeDanger);
  const winNeed = Math.ceil(T.win_ratio * sim.lanterns.length);
  $('h-lit').textContent = `${litCount}/${sim.lanterns.length} (≥${winNeed})`;
  $('h-score').textContent = String(sim.score);

  const cap = sim.playerCapacity;
  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].style.display = i < cap ? '' : 'none';
    moteSlots[i].classList.toggle('filled', i < p.carried);
  }
  moteCountLbl.textContent = `${p.carried}/${cap}`;

  const dashCooling = p.dashCd > 0 && p.charmTicks <= 0;
  $('sk-dash').classList.toggle('cooling', dashCooling);
  $('sk-dash').classList.toggle('boosted', p.charmTicks > 0);
  $('cd-dash').textContent = p.charmTicks > 0 ? '∞ Bùa' : dashCooling ? `${(p.dashCd / TPS).toFixed(1)}s` : 'Sẵn sàng';

  const pulseCooling = p.pulseCd > 0 || p.carried < T.pulse_cost;
  $('sk-pulse').classList.toggle('cooling', pulseCooling);
  $('cd-pulse').textContent = p.pulseCd > 0 ? `${(p.pulseCd / TPS).toFixed(1)}s` : p.carried < T.pulse_cost ? `Cần ${T.pulse_cost}✦` : 'Sẵn sàng';

  let nearLantern = null;
  let nearDist = Infinity;
  for (const L of sim.lanterns) {
    if (L.lit && L.fuelU >= T.fuel_max * TPS) continue;
    const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
    if (d <= T.interact_radius && Math.abs(L.pos[1] - p.pos[1]) <= X.interact_dy && d < nearDist) {
      nearLantern = L;
      nearDist = d;
    }
  }
  const promptEl = $('interact-prompt');
  if (nearLantern && mode === 'playing') {
    if (nearLantern.lit) {
      promptEl.textContent = `E — Châm dầu ${nearLantern.id} (${Math.round(nearLantern.fuelU / 60)}%)`;
    } else {
      const cost = nearLantern.everLit ? T.relight_cost : T.lantern_cost;
      promptEl.textContent = `E — ${nearLantern.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${nearLantern.deposited}/${cost})`;
    }
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
