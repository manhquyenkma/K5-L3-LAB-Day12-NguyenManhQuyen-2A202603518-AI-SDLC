// Bản chơi 3D Three.js (v1.0.0 — Contract v1.3), chạy trên cùng lõi Sim với chế độ headless.
// Hỗ trợ: InstancedMesh 200+ Bóng Mực, chế độ Benchmark (?bench=1), Bảng xếp hạng cục bộ, Dễ tiếp cận đầy đủ.
import * as THREE from 'three';
import { Sim, DT, TPS, mulberry32 } from '/src/sim.js';
import { TUNING as T, EXTRA as X } from '/src/tuning.js';
import { getNight } from '/src/nights/index.js';
import { AudioEngine } from '/audio.js';
import { createAssetPack } from '/assets.js';

// ---------- Bảng màu chuẩn TICKET-02 & TICKET-03 ----------
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
  shadeRimColorblind: 0x00b3ff,
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
const params = new URLSearchParams(location.search);
const IS_BENCH = params.get('bench') === '1';
const BENCH_SEED = Number.isInteger(Number(params.get('seed'))) && params.has('seed') ? Number(params.get('seed')) : 42;
const BENCH_DURATION_S = Number(params.get('duration')) > 0 ? Number(params.get('duration')) : 30;
const BENCH_WARMUP_S = 3;

// ---------- Đổi phím & Cài đặt lưu bền vững (localStorage) ----------
export const DEFAULT_KEYBINDS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'Escape',
};

const ACTION_LABELS = {
  up: 'Đi lên',
  down: 'Đi xuống',
  left: 'Sang trái',
  right: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Tương tác',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng',
};

function formatKeyCode(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = {
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'R-Shift',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ControlLeft: 'Ctrl',
    AltLeft: 'Alt',
    Enter: 'Enter',
    Tab: 'Tab',
  };
  return map[code] || code;
}

const SETTINGS_KEY = 'ddl_settings_v2';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('ddl_settings_v1');
    if (raw) {
      const s = JSON.parse(raw);
      return {
        volume: Math.max(0, Math.min(1, Number(s.volume ?? 0.7))),
        mouseSens: Math.max(0.1, Math.min(1, Number(s.mouseSens ?? 0.35))),
        colorblind: !!s.colorblind,
        reduceMotion: !!s.reduceMotion,
        largeText: !!s.largeText,
        keybinds: { ...DEFAULT_KEYBINDS, ...(s.keybinds && typeof s.keybinds === 'object' ? s.keybinds : {}) },
      };
    }
  } catch { /* bỏ qua */ }
  return {
    volume: 0.7,
    mouseSens: 0.35,
    colorblind: false,
    reduceMotion: false,
    largeText: false,
    keybinds: { ...DEFAULT_KEYBINDS },
  };
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

const settings = loadSettings();
function applyAccessibilityClasses() {
  document.body.classList.toggle('colorblind', settings.colorblind);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  document.body.classList.toggle('large-text', settings.largeText);
  updateKeyLabelsOnHud();
}

function updateKeyLabelsOnHud() {
  const kb = settings.keybinds;
  $('key-dash').textContent = formatKeyCode(kb.dash);
  $('key-pulse').textContent = `${formatKeyCode(kb.pulse)} · ${T.pulse_cost}✦`;
  $('help-bar').textContent =
    `${formatKeyCode(kb.up)}/${formatKeyCode(kb.left)}/${formatKeyCode(kb.down)}/${formatKeyCode(kb.right)}: di chuyển · ` +
    `${formatKeyCode(kb.jump)}: nhảy · ${formatKeyCode(kb.dash)}: lướt · ${formatKeyCode(kb.interact)}: nạp/châm dầu · ` +
    `${formatKeyCode(kb.pulse)}: tỏa sáng · Q/R hoặc chuột: camera · ${formatKeyCode(kb.pause)}: tạm dừng`;
}

applyAccessibilityClasses();
const audio = new AudioEngine(IS_BENCH ? 0 : settings.volume);

// ---------- Bảng xếp hạng cục bộ (API lưu đĩa server.js + fallback localStorage) ----------
const LB_FALLBACK_KEY = 'ddl_leaderboard_fallback_v1';
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

function sortEntries(list) {
  return list
    .slice()
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : (Date.parse(a.achieved_at) || 0) - (Date.parse(b.achieved_at) || 0)))
    .slice(0, 10);
}

async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) return data.entries;
    }
  } catch { /* fallback */ }
  try {
    const raw = localStorage.getItem(LB_FALLBACK_KEY);
    return raw ? sortEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function submitLeaderboard(payload) {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Không thể lưu điểm.' };
    return { ok: true, entries: data.entries || [] };
  } catch {
    // Fallback cho bản chạy web tĩnh không có API
    try {
      const cur = await fetchLeaderboard();
      cur.push({ ...payload, achieved_at: new Date().toISOString() });
      const entries = sortEntries(cur);
      localStorage.setItem(LB_FALLBACK_KEY, JSON.stringify(entries));
      return { ok: true, entries };
    } catch {
      return { ok: false, error: 'Không lưu được bảng xếp hạng.' };
    }
  }
}

async function openLeaderboard(returnTo = 'menu') {
  const entries = await fetchLeaderboard();
  const tbody = $('lb-tbody');
  tbody.innerHTML = '';
  $('lb-empty').classList.toggle('hidden', entries.length > 0);
  entries.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${idx + 1}</td>` +
      `<td>${escapeHtml(e.name)}</td>` +
      `<td>${Number(e.score)}</td>` +
      `<td>${Number(e.nights_won)}/3</td>` +
      `<td>${Number(e.seed)}</td>`;
    tbody.appendChild(tr);
  });
  $('btn-lb-back').onclick = () => {
    if (returnTo === 'result') showOnly('ov-result');
    else { mode = 'menu'; showOnly('ov-menu'); }
  };
  showOnly('ov-leaderboard');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- HUD đom đóm động (10 -> 20) & SVG Ngọn Lửa ----------
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

const FLAME_SVG = `<svg width="20" height="22" viewBox="0 0 20 22" fill="none"><path d="M10 1.5C10 1.5 16.5 7.2 16.5 12.8C16.5 16.9 13.6 20 10 20C6.4 20 3.5 16.9 3.5 12.8C3.5 9.6 5.4 6.7 7.1 4.9C7.1 7.1 8.4 8.2 9.2 8.2C8.6 5.8 10 1.5 10 1.5Z" fill="#FFB347"/><path d="M10 9.5C10 9.5 13 12.3 13 14.9C13 16.8 11.7 18.2 10 18.2C8.3 18.2 7 16.8 7 14.9C7 12.3 10 9.5 10 9.5Z" fill="#FFF6C2"/></svg>`;
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
  if (settings.reduceMotion || IS_BENCH) return;
  const el = $('fx-flash');
  el.className = kind;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 360);
}

// ---------- Renderer, Scene & Asset Pack ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatioCap = IS_BENCH ? 1 : Math.min(devicePixelRatio || 1, 1.25);
renderer.setPixelRatio(pixelRatioCap);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.prepend(renderer.domElement);

function getRendererLabel() {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `Three.js r${THREE.REVISION} / WebGL2 (${gpu || 'WebGL'})`;
  } catch {
    return `Three.js r${THREE.REVISION} / WebGL`;
  }
}

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

// Bầu trời sao + Mặt trăng hào quang
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

// Biển mây tầng sâu
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

// Bụi đom đóm khí quyển (tắt trong cảnh benchmark để không ảnh hưởng số đo)
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
ambientDust.visible = !IS_BENCH;
scene.add(ambientDust);

let worldGroup = new THREE.Group();
scene.add(worldGroup);

const sharedLanternLights = [
  new THREE.PointLight(PALETTE.lanternLit, 0, 34, 1.7),
  new THREE.PointLight(PALETTE.lanternLit, 0, 34, 1.7),
];
scene.add(sharedLanternLights[0], sharedLanternLights[1]);

const playerRig = assets.buildPlayer();
scene.add(playerRig.root);

// InstancedMesh cho 200+ Bóng Mực (chỉ 5 draw calls cho toàn bộ 200 con!)
const shadePool = assets.buildShadeInstanced(256);
scene.add(shadePool.group);
const shadeColorNormal = new THREE.Color(PALETTE.shadeBody);
const shadeColorStun = new THREE.Color(PALETTE.shadeStun);

// Hiệu ứng Tỏa Sáng, vệt lướt & gợn đáp (tắt vệt/gợn sáng tạo trong benchmark)
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

// InstancedMesh đom đóm: tăng sức chứa lên 128 để hiển thị đủ 100 đom đóm trong cảnh benchmark!
const MAX_MOTE_INST = 128;
const moteCoreInst = new THREE.InstancedMesh(
  new THREE.OctahedronGeometry(0.2, 1),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
  MAX_MOTE_INST,
);
const moteHaloInst = new THREE.InstancedMesh(
  new THREE.OctahedronGeometry(0.42, 0),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
  MAX_MOTE_INST,
);
moteCoreInst.count = 0;
moteHaloInst.count = 0;
moteCoreInst.frustumCulled = false;
moteHaloInst.frustumCulled = false;
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
  drifterViews.forEach((v) => scene.remove(v.g));
  drifterViews.clear();
  charmViews.forEach((v) => scene.remove(v.g));
  charmViews.clear();

  const grassMat = new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.88 });
  const sandMat = new THREE.MeshStandardMaterial({ map: tex.sandStone, roughness: 0.86 });
  const woodMat = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.84 });
  const cliffMat = new THREE.MeshStandardMaterial({ map: tex.sandStone, color: 0x8b7e6a, roughness: 0.94 });

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

  assets.addScenery(worldGroup, nightCfg);

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

  for (const L of nightCfg.lanterns) {
    const v = assets.buildLantern(L, T.safe_radius);
    worldGroup.add(v.g);
    lanternViews.set(L.id, v);
  }

  scene.add(worldGroup);
}

// ---------- Quản lý luồng 3 Đêm, Bảng xếp hạng & Chỉ báo tiếp cận ----------
let mode = IS_BENCH ? 'bench' : 'menu'; // menu | intro | playing | paused | result | dawn | bench
let currentNight = 1;
let totalCampaignScore = 0;
let nightsWonCount = 0;
let campaignSeed = 1;
let lbSavedForRun = false;
let prevSettingsReturn = 'menu';
let listeningAction = null;
let sim = new Sim({ seed: 1, night: 1 });
let yaw = 0;
let acc = 0;
let lastNow = performance.now();
let lastCountdownSec = 11;
let pendingPauseToggle = false;
let prevGrounded = true;
const hintsShown = new Set();

// Chỉ báo tiếp cận cho Bóng Mực mới xuất hiện (kèm mũi tên mép màn hình)
const recentSpawnedShades = new Map(); // id -> expireMs
let shadeSpawnCaptionUntil = 0;

function showHintOnce(key, msg) {
  if (IS_BENCH || hintsShown.has(key)) return;
  hintsShown.add(key);
  toast(msg);
}

function showOnly(id) {
  for (const ov of ['ov-menu', 'ov-intro', 'ov-pause', 'ov-settings', 'ov-leaderboard', 'ov-result']) {
    $(ov).classList.toggle('hidden', ov !== id);
  }
  $('hud').classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
  $('help-bar').classList.toggle('hidden', IS_BENCH || (mode !== 'playing' && mode !== 'paused'));
}

function toast(msg) {
  if (IS_BENCH) return;
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); }, 1900);
}

function openIntro(nightId, resetCampaign = false) {
  if (resetCampaign) {
    totalCampaignScore = 0;
    nightsWonCount = 0;
    campaignSeed = (Date.now() & 0x7fffffff) || 1;
  }
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
  const nightSeed = (campaignSeed + nightId - 1) >>> 0 || 1;
  sim = new Sim({ seed: nightSeed, night: nightId });
  sim.drainEvents();
  yaw = 0;
  acc = 0;
  pulseT = 99;
  rippleT = 99;
  shakeAmt = 0;
  lbSavedForRun = false;
  hintsShown.clear();
  recentSpawnedShades.clear();
  shadeSpawnCaptionUntil = 0;
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

function setupLeaderboardSaveBox(show) {
  const box = $('lb-save-box');
  box.classList.toggle('hidden', !show);
  if (!show) return;
  $('lb-name').value = '';
  $('lb-name').disabled = false;
  $('btn-lb-save').disabled = false;
  $('lb-msg').textContent = '';
  $('lb-msg').className = '';
}

function finishNight(data) {
  audio.stopBgm();
  const ov = $('ov-result');
  ov.classList.remove('dawn');
  if (data.result === 'won') {
    audio.playWin();
    totalCampaignScore += sim.score;
    nightsWonCount = Math.min(3, nightsWonCount + 1);
    if (currentNight < 3) {
      mode = 'result';
      $('res-kicker').textContent = `Hoàn thành Đêm ${currentNight}`;
      $('res-title').textContent = `${sim.nightCfg.name} Bừng Sáng!`;
      $('res-desc').textContent = 'Ánh đèn đã xua tan sương đen. Ngọn Lửa của Mây sẽ hồi đầy trước Đêm tiếp theo.';
      $('res-score').textContent = `Điểm Đêm ${currentNight}: ${sim.score} · Tổng điểm: ${totalCampaignScore}`;
      $('btn-res-primary').textContent = `Sang Đêm ${currentNight + 1} →`;
      $('btn-res-primary').onclick = () => openIntro(currentNight + 1, false);
      setupLeaderboardSaveBox(false);
    } else {
      mode = 'dawn';
      audio.playTowerBell();
      ov.classList.add('dawn');
      $('res-kicker').textContent = 'Hành trình hoàn tất';
      $('res-title').textContent = 'Bình Minh Trên Ba Hòn Đảo!';
      $('res-desc').textContent = 'Cả Đảo Bến, Đảo Cau và Đảo Chuông đã giữ vững ánh sáng tới bình minh.';
      $('res-score').textContent = `Điểm Đêm 3: ${sim.score} · Tổng điểm: ${totalCampaignScore} · Đêm thắng: ${nightsWonCount}/3`;
      $('btn-res-primary').textContent = 'Chơi lại từ Đêm 1';
      $('btn-res-primary').onclick = () => openIntro(1, true);
      setupLeaderboardSaveBox(true);
    }
  } else {
    audio.playLose();
    mode = 'result';
    $('res-kicker').textContent = `Đêm ${currentNight} — ${sim.nightCfg.name}`;
    $('res-title').textContent = 'Ngọn Đèn Chưa Kịp Sáng';
    $('res-desc').textContent = data.reason === 'no_flames' ? 'Ngọn Lửa của Mây đã tắt giữa màn sương.' : 'Trời đã sáng trước khi đủ Đèn Lồng Lớn còn sáng.';
    $('res-score').textContent = `Tổng điểm các Đêm thắng: ${totalCampaignScore} · Đêm thắng: ${nightsWonCount}/3`;
    $('btn-res-primary').textContent = `Chơi lại Đêm ${currentNight}`;
    $('btn-res-primary').onclick = () => startNight(currentNight);
    setupLeaderboardSaveBox(true);
  }
  showOnly('ov-result');
}

$('btn-lb-save').onclick = async () => {
  if (lbSavedForRun) return;
  const raw = $('lb-name').value.trim();
  const msg = $('lb-msg');
  if (!NAME_RE.test(raw)) {
    msg.textContent = 'Tên phải dài 3–12 ký tự (chữ cái, số, dấu gạch dưới _).';
    msg.className = 'err';
    return;
  }
  $('btn-lb-save').disabled = true;
  const res = await submitLeaderboard({
    name: raw,
    score: totalCampaignScore,
    nights_won: nightsWonCount,
    seed: campaignSeed,
  });
  if (!res.ok) {
    msg.textContent = res.error;
    msg.className = 'err';
    $('btn-lb-save').disabled = false;
    return;
  }
  lbSavedForRun = true;
  $('lb-name').disabled = true;
  msg.textContent = `✓ Đã lưu "${raw}" (${totalCampaignScore} điểm) vào Bảng xếp hạng!`;
  msg.className = '';
};

$('btn-play').onclick = () => openIntro(1, true);
document.querySelectorAll('[data-night]').forEach((b) => {
  b.onclick = () => openIntro(Number(b.dataset.night), true);
});
$('btn-menu-leaderboard').onclick = () => openLeaderboard('menu');
$('btn-res-lb').onclick = () => openLeaderboard('result');
$('btn-start-night').onclick = () => startNight(currentNight);
$('btn-intro-menu').onclick = () => { mode = 'menu'; showOnly('ov-menu'); };
$('btn-resume').onclick = () => togglePause();
$('btn-retry-pause').onclick = () => startNight(currentNight);
$('btn-pause-menu').onclick = () => { audio.stopBgm(); mode = 'menu'; showOnly('ov-menu'); };
$('btn-res-menu').onclick = () => { audio.stopBgm(); mode = 'menu'; showOnly('ov-menu'); };

// ---------- UI Cài đặt & Đổi phím có phát hiện trùng ----------
function renderKeybindUI() {
  const list = $('keybind-list');
  list.innerHTML = '';
  for (const act of Object.keys(DEFAULT_KEYBINDS)) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    const lbl = document.createElement('span');
    lbl.textContent = ACTION_LABELS[act];
    const btn = document.createElement('button');
    btn.className = 'kb-btn' + (listeningAction === act ? ' listening' : '');
    btn.textContent = listeningAction === act ? 'Nhấn phím...' : formatKeyCode(settings.keybinds[act]);
    btn.onclick = () => {
      listeningAction = act;
      $('keybind-msg').textContent = `Đang đổi phím cho "${ACTION_LABELS[act]}" — hãy nhấn phím mới...`;
      renderKeybindUI();
    };
    row.append(lbl, btn);
    list.appendChild(row);
  }
}

function openSettings(from) {
  prevSettingsReturn = from;
  listeningAction = null;
  $('set-vol').value = String(Math.round(settings.volume * 100));
  $('set-vol-val').textContent = `${Math.round(settings.volume * 100)}%`;
  $('set-sens').value = String(Math.round(settings.mouseSens * 100));
  $('set-sens-val').textContent = `${Math.round(settings.mouseSens * 100)}%`;
  $('set-cb').checked = !!settings.colorblind;
  $('set-rm').checked = !!settings.reduceMotion;
  $('set-large-text').checked = !!settings.largeText;
  $('keybind-msg').textContent = '';
  renderKeybindUI();
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
  applyAccessibilityClasses();
  saveSettings(settings);
};
$('set-rm').onchange = (e) => {
  settings.reduceMotion = !!e.target.checked;
  applyAccessibilityClasses();
  saveSettings(settings);
};
$('set-large-text').onchange = (e) => {
  settings.largeText = !!e.target.checked;
  applyAccessibilityClasses();
  saveSettings(settings);
};
$('btn-reset-keys').onclick = () => {
  listeningAction = null;
  settings.keybinds = { ...DEFAULT_KEYBINDS };
  saveSettings(settings);
  updateKeyLabelsOnHud();
  $('keybind-msg').textContent = '✓ Đã khôi phục phím mặc định.';
  renderKeybindUI();
};
$('btn-settings-back').onclick = () => {
  listeningAction = null;
  if (prevSettingsReturn === 'paused') showOnly('ov-pause');
  else showOnly('ov-menu');
};

// ---------- Điều khiển & Đổi phím ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (IS_BENCH) return;
  // Khi đang gõ tên vào ô Bảng xếp hạng -> không chặn phím
  if (document.activeElement && document.activeElement.id === 'lb-name') return;

  // Chế độ lắng nghe đổi phím
  if (listeningAction) {
    e.preventDefault();
    const newCode = e.code;
    const conflict = Object.keys(settings.keybinds).find((k) => k !== listeningAction && settings.keybinds[k] === newCode);
    if (conflict) {
      $('keybind-msg').textContent = `⚠ Trùng phím! Phím [${formatKeyCode(newCode)}] đã gán cho "${ACTION_LABELS[conflict]}". Hãy chọn phím khác.`;
      listeningAction = null;
      renderKeybindUI();
      return;
    }
    settings.keybinds[listeningAction] = newCode;
    saveSettings(settings);
    updateKeyLabelsOnHud();
    $('keybind-msg').textContent = `✓ Đã gán "${ACTION_LABELS[listeningAction]}" → [${formatKeyCode(newCode)}].`;
    listeningAction = null;
    renderKeybindUI();
    return;
  }

  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  const pauseKey = settings.keybinds.pause;
  const isPausePress = e.code === pauseKey || (pauseKey === 'Escape' && e.code === 'KeyP');
  if (isPausePress && !e.repeat) {
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
  const kb = settings.keybinds;
  const left = keys.has(kb.left) || (kb.left === 'KeyA' && keys.has('ArrowLeft'));
  const right = keys.has(kb.right) || (kb.right === 'KeyD' && keys.has('ArrowRight'));
  const fwd = keys.has(kb.up) || (kb.up === 'KeyW' && keys.has('ArrowUp'));
  const back = keys.has(kb.down) || (kb.down === 'KeyS' && keys.has('ArrowDown'));
  const dash = keys.has(kb.dash) || (kb.dash === 'ShiftLeft' && keys.has('ShiftRight'));
  return {
    move: [(left ? 1 : 0) - (right ? 1 : 0), (fwd ? 1 : 0) - (back ? 1 : 0)],
    cam_yaw_deg: yaw,
    jump: keys.has(kb.jump),
    interact: keys.has(kb.interact),
    pulse: keys.has(kb.pulse),
    dash,
    pause: pendingPauseToggle,
  };
}

function onEvent(e) {
  if (IS_BENCH) return;
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
      toast(`${warnPrefix}Đèn ${e.data.lantern_id} đã cạn dầu và tắt! (Thắp lại cần 5 đom đóm)`);
      break;
    case 'fuel_drain':
      toast(`${warnPrefix}Bóng Mực đang hút dầu đèn ${e.data.lantern_id} (${e.data.fuel}%)!`);
      break;
    case 'pulse':
      audio.playPulse();
      pulseT = 0;
      if (!settings.reduceMotion) shakeAmt = 0.25;
      break;
    case 'dash': audio.playDash(); break;
    case 'charm_picked':
      audio.playCharm();
      flashScreen('lit');
      showHintOnce('first_charm', 'Ông Đăng: "Bùa Gió giúp chạy nhanh và Lướt liên tục!"');
      break;
    case 'drifter_steal':
      audio.playHit();
      showHintOnce('first_steal', 'Ông Đăng: "Dùng Tỏa Sáng gần Gió Lạc đang bỏ chạy để đòi lại đom đóm!"');
      break;
    case 'drifter_drop': audio.playPickup(5); toast(`✦ Gió Lạc làm rơi ${e.data.amount} đom đóm!`); break;
    case 'player_hit':
      audio.playHit();
      flashScreen('hit');
      if (!settings.reduceMotion) shakeAmt = 0.45;
      if (e.data.by === 'fall') toast(`${warnPrefix}Rơi xuống biển mây! −1 Ngọn Lửa`);
      else showHintOnce('first_hit', `${warnPrefix}Ông Đăng: "Cẩn thận! Giữ 3 đom đóm để Tỏa Sáng đẩy lùi Bóng Mực."`);
      break;
    case 'shade_spawned':
      audio.playShadeSpawn();
      recentSpawnedShades.set(e.data.id, performance.now() + 4500);
      shadeSpawnCaptionUntil = performance.now() + 3500;
      break;
    case 'game_over': finishNight(e.data); break;
  }
}

// ---------- Đồng bộ hiển thị 3D + HUD + Phụ đề tiếp cận ----------
const dummy = new THREE.Object3D();
const tmpProj = new THREE.Vector3();
const camTarget = new THREE.Vector3(0, 9, -12);
const camLook = new THREE.Vector3(0, 1.2, 0);
const litList = [];
const lowFuelIds = [];

function fmt(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function updateCaptionsAndShadeArrows(nowMs, lowFuelIds) {
  const capEl = $('caption-bar');
  const arrowsEl = $('shade-arrows');
  if (IS_BENCH || mode !== 'playing') {
    capEl.innerHTML = '';
    arrowsEl.innerHTML = '';
    return;
  }
  const warnPrefix = settings.colorblind ? '⚠ ' : '';
  const items = [];
  if (nowMs < shadeSpawnCaptionUntil) {
    items.push({ cls: 'shade', text: '👁 Bóng Mực vừa xuất hiện!' });
  }
  if (sim.windEnabled && sim.wind.warnTicks > 0) {
    items.push({ cls: 'warn', text: `${warnPrefix}🍃 Cảnh báo: Gió mạnh sắp thổi!` });
  } else if (sim.windEnabled && sim.wind.active) {
    items.push({ cls: 'warn', text: `${warnPrefix}💨 Gió mạnh đang thổi!` });
  }
  if (sim.timeLeft <= 10 && sim.timeLeft > 0) {
    items.push({ cls: 'warn', text: `${warnPrefix}⏱ 10 giây cuối tới bình minh: ${Math.ceil(sim.timeLeft)}s` });
  }
  if (lowFuelIds.length > 0) {
    items.push({ cls: 'warn', text: `${warnPrefix}🏮 Đèn ${lowFuelIds.join(', ')} sắp cạn dầu (< 30%)!` });
  }

  let html = '';
  for (const it of items) html += `<div class="caption-item ${it.cls}">${it.text}</div>`;
  if (capEl._lastHtml !== html) {
    capEl.innerHTML = html;
    capEl._lastHtml = html;
  }

  // Mũi tên chỉ hướng ở mép màn hình cho Bóng Mực mới xuất hiện
  let arrowHtml = '';
  for (const [id, exp] of recentSpawnedShades) {
    if (nowMs >= exp) { recentSpawnedShades.delete(id); continue; }
    const z = sim.shades.find((s) => s.id === id);
    if (!z) continue;
    tmpProj.set(z.pos[0], z.pos[1] + 0.5, z.pos[2]).project(camera);
    const inFront = tmpProj.z <= 1;
    const sx = inFront ? tmpProj.x : -tmpProj.x;
    const sy = inFront ? tmpProj.y : -tmpProj.y;
    const ang = Math.atan2(sy, sx);
    const px = innerWidth * 0.5 + Math.cos(ang) * (innerWidth * 0.44);
    const py = innerHeight * 0.5 - Math.sin(ang) * (innerHeight * 0.41);
    const rot = Math.PI / 2 - ang;
    arrowHtml += `<div class="shade-arrow" style="left:${(px - 22).toFixed(0)}px;top:${(py - 22).toFixed(0)}px;transform:rotate(${rot.toFixed(3)}rad)"><div class="tri"></div></div>`;
  }
  arrowsEl.innerHTML = arrowHtml;
}

function syncViews(timeSec, nowMs) {
  const p = sim.player;
  litList.length = 0;
  let litCount = 0;
  let nearestUnlit = null;
  let nearestUnlitDist = Infinity;
  lowFuelIds.length = 0;

  if (!settings.reduceMotion) {
    cloudRing.rotation.y = timeSec * 0.014;
    tex.cloudSea.offset.x = (timeSec * 0.006) % 1;
    tex.cloudSea.offset.y = (timeSec * 0.004) % 1;
    if (ambientDust.visible) ambientDust.position.y = Math.sin(timeSec * 0.6) * 0.4;
  }

  const blink1Hz = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2);

  for (let i = 0; i < sim.lanterns.length; i++) {
    const L = sim.lanterns[i];
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
    if (lowFuel) lowFuelIds.push(L.id);

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
    v.lanternGroup.rotation.z = settings.reduceMotion ? 0 : Math.sin(timeSec * 1.5 + L.pos[0]) * 0.04;

    const safeActive = L.lit && !lowFuel;
    v.ring.material.opacity = safeActive ? (0.42 + Math.sin(timeSec * 2.0) * 0.08) : 0;
    if (safeActive && !settings.reduceMotion) v.ring.rotation.z = timeSec * 0.14;

    v.fuelBarGroup.visible = L.lit && !IS_BENCH;
    if (v.fuelBarGroup.visible) {
      v.fuelBarGroup.lookAt(camera.position);
      const frac = Math.max(0.01, Math.min(1, fuelPct));
      v.fuelFill.scale.x = frac;
      v.fuelFill.position.x = -(1 - frac) * 0.89;
      v.fuelFillMat.color.setHex(lowFuel ? (settings.colorblind ? PALETTE.dangerColorblind : PALETTE.danger) : PALETTE.lanternLit);
      v.fuelFillMat.opacity = lowFuel ? (0.3 + 0.7 * blink1Hz) : 1;
      v.fuelFillMat.transparent = lowFuel;
    }
  }

  hemi.intensity = 0.15 + 0.55 * (litCount / Math.max(1, sim.lanterns.length));
  if (!IS_BENCH) audio.setLitCount(litCount);

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

  // Đom đóm (InstancedMesh, tối đa 128 -> đủ 100 cho cảnh benchmark)
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

  // Bóng Mực (InstancedMesh: 5 draw calls cho 200+ con! Viền & mắt đổi #7A3CFF -> #00B3FF khi bật mù màu)
  const rimHex = settings.colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
  shadePool.bodyMat.emissive.setHex(rimHex);
  shadePool.eyeMat.color.setHex(rimHex);
  shadePool.auraMat.color.setHex(settings.colorblind ? PALETTE.shadeRimColorblind : 0xffffff);

  const sCount = Math.min(sim.shades.length, shadePool.maxCount);
  shadePool.bodyInst.count = sCount;
  shadePool.tendrilInst.count = sCount;
  shadePool.eyeInst.count = sCount;
  shadePool.shadowInst.count = sCount;
  shadePool.auraInst.count = sCount;
  for (let i = 0; i < sCount; i++) {
    const z = sim.shades[i];
    const stunned = z.state === 'stunned';
    const draining = z.state === 'drain';
    const bob = Math.sin(timeSec * (draining ? 7 : 3.5) + i * 0.7) * 0.14;
    const faceYaw = Math.atan2(p.pos[0] - z.pos[0], p.pos[2] - z.pos[2]);
    const sx = stunned ? 1.15 : (draining ? 1.1 : 0.95);
    const sy = stunned ? 0.45 : (draining ? 1.12 : 0.95);

    dummy.position.set(z.pos[0], z.pos[1] + bob, z.pos[2]);
    dummy.rotation.set(0, faceYaw, 0);
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    shadePool.bodyInst.setMatrixAt(i, dummy.matrix);
    shadePool.eyeInst.setMatrixAt(i, dummy.matrix);
    shadePool.bodyInst.setColorAt(i, stunned ? shadeColorStun : shadeColorNormal);

    dummy.rotation.set(0, faceYaw + Math.sin(timeSec * 3.2 + i) * 0.25, 0);
    dummy.updateMatrix();
    shadePool.tendrilInst.setMatrixAt(i, dummy.matrix);
    shadePool.tendrilInst.setColorAt(i, stunned ? shadeColorStun : shadeColorNormal);

    // Bóng đổ tiếp xúc & vòng hào quang mặt đất (gọn để tránh overdraw khi nhiều bóng tụ lại)
    const gy = z.pos[1] - X.shade_height + 0.05;
    dummy.position.set(z.pos[0], gy, z.pos[2]);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(1.25, 1.25, 1);
    dummy.updateMatrix();
    shadePool.shadowInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(z.pos[0], gy + 0.03, z.pos[2]);
    const auraS = stunned ? 0.9 : (draining ? 1.85 : 1.45);
    dummy.scale.set(auraS, auraS, 1);
    dummy.updateMatrix();
    shadePool.auraInst.setMatrixAt(i, dummy.matrix);
  }
  if (sCount > 0) {
    shadePool.bodyInst.instanceMatrix.needsUpdate = true;
    shadePool.tendrilInst.instanceMatrix.needsUpdate = true;
    shadePool.eyeInst.instanceMatrix.needsUpdate = true;
    shadePool.shadowInst.instanceMatrix.needsUpdate = true;
    shadePool.auraInst.instanceMatrix.needsUpdate = true;
    if (shadePool.bodyInst.instanceColor) shadePool.bodyInst.instanceColor.needsUpdate = true;
    if (shadePool.tendrilInst.instanceColor) shadePool.tendrilInst.instanceColor.needsUpdate = true;
  }

  // Gió Lạc & Bùa Gió (không có trong Đêm 1 / bench)
  if (!IS_BENCH) {
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
  }

  // Nhân vật Mây
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
  pr.hangPivot.rotation.z = settings.reduceMotion ? 0 : Math.sin(timeSec * 9.5) * Math.min(0.45, spd * 0.045);
  pr.scarfTail1.rotation.x = 0.3 + stride * 0.5 + (settings.reduceMotion ? 0 : Math.sin(timeSec * 11) * 0.1);
  pr.scarfTail2.rotation.x = 0.38 + stride * 0.55 + (settings.reduceMotion ? 0 : Math.cos(timeSec * 10) * 0.12);
  pr.shadow.visible = p.grounded;

  // Camera
  if (IS_BENCH) {
    // TICKET-04 §1: tâm (0,0,0), r=30 m, Y=15 m, nhìn (0,0,0), xuất phát (30,15,0), ngược chiều kim đồng hồ từ trên nhìn xuống, 15 s/vòng
    const theta = (benchElapsedSec / 15) * Math.PI * 2;
    camera.position.set(30 * Math.cos(theta), 15, -30 * Math.sin(theta));
    camera.lookAt(0, 0, 0);
    return;
  }

  if (mode === 'menu' || mode === 'intro') {
    const orbit = timeSec * 0.13;
    camera.position.set(Math.sin(orbit) * 35, 17.5, Math.cos(orbit) * 35);
    camera.lookAt(0, 2.2, 0);
  } else {
    const th = (yaw * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    const sx = (!settings.reduceMotion && shakeAmt > 0.01) ? (Math.sin(timeSec * 60) * shakeAmt) : 0;
    const sy = (!settings.reduceMotion && shakeAmt > 0.01) ? (Math.cos(timeSec * 53) * shakeAmt * 0.7) : 0;
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

  if (!lowFx && !settings.reduceMotion && p.dashTicks > 0) {
    dashTrail.position.set(p.pos[0] - p.facing[0] * 1.15, p.pos[1] + 0.6, p.pos[2] - p.facing[1] * 1.15);
    dashTrail.rotation.z = -Math.atan2(p.facing[0], p.facing[1]);
    dashTrail.material.opacity = 0.72;
  } else {
    dashTrail.material.opacity = 0;
  }

  if (!lowFx && !settings.reduceMotion && rippleT < 0.45) {
    rippleT += DT * 1.5;
    const rr = 0.6 + rippleT * 3.4;
    landRipple.scale.set(rr, rr, 1);
    landRipple.material.opacity = Math.max(0, 0.65 - rippleT * 1.45);
  } else {
    landRipple.material.opacity = 0;
  }

  if (bridgeVisual && !settings.reduceMotion) bridgeVisual.rotation.x = Math.sin(timeSec * 2.2) * 0.022;
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

  // HUD 7 thành phần
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
  const interactLbl = formatKeyCode(settings.keybinds.interact);
  if (nearLantern && mode === 'playing') {
    if (nearLantern.lit) {
      promptEl.textContent = `${interactLbl} — Châm dầu ${nearLantern.id} (${Math.round(nearLantern.fuelU / 60)}%)`;
    } else {
      const cost = nearLantern.everLit ? T.relight_cost : T.lantern_cost;
      promptEl.textContent = `${interactLbl} — ${nearLantern.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${nearLantern.deposited}/${cost})`;
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
      arrowEl.style.left = `${px - 22}px`;
      arrowEl.style.top = `${py - 22}px`;
      arrowEl.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
      arrowEl.classList.remove('hidden');
    }
  } else {
    arrowEl.classList.add('hidden');
  }

  updateCaptionsAndShadeArrows(nowMs, lowFuelIds);
}

// ---------- Khởi tạo Cảnh Benchmark chuẩn (TICKET-04 §1) ----------
let benchFirstFrameSent = false;
let benchStartMs = 0;
let benchMeasureStartMs = 0;
let benchPrevFrameMs = 0;
let benchElapsedSec = 0;
let benchDoneSent = false;
const benchDts = [];
const BENCH_EMPTY_INPUT = Object.freeze({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });

function initBenchScene() {
  showOnly(null);
  $('hud').classList.add('hidden');
  $('help-bar').classList.add('hidden');
  $('vignette').classList.add('hidden');

  const n1 = getNight(1);
  buildNightScene(n1);
  const rng = mulberry32(BENCH_SEED);

  // 3 đèn L1-L3 sáng với fuel = 100
  const litLanterns = n1.lanterns.slice(0, 3);
  const lanterns = [
    { id: 'L1', lit: true, fuel: 100 },
    { id: 'L2', lit: true, fuel: 100 },
    { id: 'L3', lit: true, fuel: 100 },
    { id: 'L4', lit: false },
    { id: 'L5', lit: false },
  ];

  // Đúng 200 Bóng Mực ở trạng thái wander, rải đều trên đảo (ngoài vùng an toàn L1-L3)
  const shades = [];
  for (let i = 0; i < 200; i++) {
    let x = 0, z = 0;
    for (let attempt = 0; attempt < 25; attempt++) {
      const r = Math.sqrt(rng()) * 37.5;
      const a = rng() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      let ok = true;
      for (const L of litLanterns) {
        if (Math.hypot(x - L.pos[0], z - L.pos[2]) < T.safe_radius + 0.6) { ok = false; break; }
      }
      if (ok) break;
    }
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' });
  }

  // Đúng 100 đom đóm rải đều trên đảo
  const motes = [];
  for (let i = 0; i < 100; i++) {
    const r = Math.sqrt(rng()) * 36.5;
    const a = rng() * Math.PI * 2;
    motes.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
  }

  sim = new Sim({
    seed: BENCH_SEED,
    night: 1,
    benchMode: true,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      player: { pos: [0, 0, 0] },
      lanterns,
      shades,
      motes,
    },
  });
  sim.drainEvents();
  // Biên dịch sẵn toàn bộ shader trước khung hình đầu tiên để tránh giật biên dịch giữa lúc đo
  syncViews(0, performance.now());
  renderer.compile(scene, camera);
}

function finalizeBench() {
  benchDoneSent = true;
  const n = benchDts.length || 1;
  let sum = 0;
  for (let i = 0; i < benchDts.length; i++) sum += benchDts[i];
  const avgFps = Math.round((1000 * n / Math.max(1e-6, sum)) * 10) / 10;

  const desc = benchDts.slice().sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * n));
  let slowSum = 0;
  for (let i = 0; i < k; i++) slowSum += desc[i];
  const p1LowFps = Math.round((1000 / Math.max(1e-6, slowSum / k)) * 10) / 10;

  const asc = desc.slice().reverse();
  const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  const frameMsP95 = Math.round(asc[p95Idx] * 10) / 10;

  let png = null;
  try {
    renderer.render(scene, camera);
    png = renderer.domElement.toDataURL('image/png');
  } catch { /* noop */ }

  const payload = {
    frames: n,
    avg_fps: avgFps,
    p1_low_fps: p1LowFps,
    frame_ms_p95: frameMsP95,
    renderer: getRendererLabel(),
    png,
  };

  fetch('/api/bench-done', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => { /* noop */ });
}

// ---------- Bộ đếm FPS (?fps) & Vòng lặp render ----------
const showFps = !IS_BENCH && params.has('fps');
if (showFps) $('fps-box').classList.remove('hidden');
const fpsSamples = [];
let fpsWindowAcc = 0, fpsWindowFrames = 0;

if (IS_BENCH) initBenchScene();
else buildNightScene(getNight(1));

function frame(now) {
  if (IS_BENCH) {
    if (benchDoneSent) return;
    if (!benchFirstFrameSent) {
      benchFirstFrameSent = true;
      benchStartMs = now;
      benchMeasureStartMs = now + BENCH_WARMUP_S * 1000;
      benchPrevFrameMs = now;
      lastNow = now;
      fetch('/api/bench-ready', { method: 'POST' }).catch(() => { /* noop */ });
    }
    const rawDtMs = now - benchPrevFrameMs;
    benchPrevFrameMs = now;
    const simDt = Math.min(0.1, rawDtMs / 1000);
    benchElapsedSec = (now - benchStartMs) / 1000;

    acc += simDt;
    while (acc >= DT) {
      sim.step(BENCH_EMPTY_INPUT);
      sim.drainEvents();
      acc -= DT;
    }

    syncViews(benchElapsedSec, now);
    renderer.render(scene, camera);

    if (now >= benchMeasureStartMs) {
      if (rawDtMs > 0) benchDts.push(rawDtMs);
      if (now - benchMeasureStartMs >= BENCH_DURATION_S * 1000) {
        finalizeBench();
        return;
      }
    }
    requestAnimationFrame(frame);
    return;
  }

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

  syncViews(now / 1000, now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
