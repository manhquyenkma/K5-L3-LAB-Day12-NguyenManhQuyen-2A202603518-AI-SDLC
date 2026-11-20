// Bản chơi 3D Three.js (Phase 2 — Ba hòn đảo), chạy trên cùng lõi Sim với chế độ headless.
// Mọi màu sắc bám sát bảng màu chuẩn TICKET-02 Phần 3.
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
  } catch { /* bỏ qua lỗi storage */ }
  return { volume: 0.7, mouseSens: 0.35 };
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
const settings = loadSettings();
const audio = new AudioEngine(settings.volume);

// ---------- Khởi tạo thanh 10 ô đom đóm ----------
const moteBar = $('mote-bar');
const moteSlots = [];
for (let i = 0; i < T.carry_capacity; i++) {
  const d = document.createElement('div');
  d.className = 'mote-slot';
  moteBar.appendChild(d);
  moteSlots.push(d);
}

// ---------- Renderer & Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatioCap = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatioCap);
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 28, 125);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 260);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0x8899dd, PALETTE.fog, 0.15);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaab8ff, 0.32);
moon.position.set(-25, 50, -15);
scene.add(moon);

// Biển mây nền cố định
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(240, 48),
  new THREE.MeshBasicMaterial({ color: PALETTE.sea }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -11;
scene.add(sea);

// Nhóm cảnh thay đổi theo từng Đêm (dispose sạch khi đổi Đêm)
let worldGroup = new THREE.Group();
scene.add(worldGroup);

// Pool tối đa 2 đèn điểm thật cho các Đèn Lồng Lớn gần Mây nhất (giữ FPS cao trên Đêm 3)
const sharedLanternLights = [
  new THREE.PointLight(PALETTE.lanternLit, 0, 28, 2),
  new THREE.PointLight(PALETTE.lanternLit, 0, 28, 2),
];
scene.add(sharedLanternLights[0], sharedLanternLights[1]);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });

// ---------- Nhân vật Mây (giữ sáng tạo Phase 1: nón lá treo đèn lồng + khăn đỏ bảng màu chuẩn) ----------
const playerMesh = new THREE.Group();
const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.52, 1.05, 12), mat(PALETTE.mayRobe));
pBody.position.y = 0.65;
const pScarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 16), mat(PALETTE.mayScarfCharm));
pScarf.rotation.x = Math.PI / 2;
pScarf.position.y = 1.18;
const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat(0xe9c9a0));
pHead.position.y = 1.5;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.52, 18), mat(PALETTE.sand));
hat.position.y = 1.95;
const hangPivot = new THREE.Group();
hangPivot.position.set(0.68, 1.75, 0);
const hangLantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit }));
hangLantern.position.y = -0.22;
hangPivot.add(hangLantern);
const pLight = new THREE.PointLight(PALETTE.lanternLit, 16, 16, 2);
pLight.position.set(0.68, 1.55, 0);
playerMesh.add(pBody, pScarf, pHead, hat, hangPivot, pLight);
scene.add(playerMesh);

// Vòng Tỏa Sáng lan ra khi bấm F (sáng tạo Phase 1)
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.88, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 99;

// InstancedMesh cho đom đóm (lõi + quầng) & lá bay báo gió Đêm 3 (O6 giữ FPS >= 30)
const MAX_MOTE_INST = 48;
const moteCoreInst = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.18, 8, 6),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
  MAX_MOTE_INST,
);
const moteHaloInst = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.34, 8, 6),
  new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.35 }),
  MAX_MOTE_INST,
);
moteCoreInst.count = 0;
moteHaloInst.count = 0;
scene.add(moteCoreInst, moteHaloInst);

const LEAF_COUNT = 40;
const leafInst = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.45, 0.2),
  new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  LEAF_COUNT,
);
leafInst.count = 0;
scene.add(leafInst);
const leafState = Array.from({ length: LEAF_COUNT }, (_, i) => ({
  ox: ((i * 37) % 50) - 25,
  oy: 0.5 + (i % 7) * 0.9,
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
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

function buildNightScene(nightCfg) {
  scene.remove(worldGroup);
  disposeGroup(worldGroup);
  worldGroup = new THREE.Group();
  lanternViews.clear();
  shadeViews.forEach((v) => scene.remove(v.g));
  shadeViews.clear();
  drifterViews.forEach((v) => scene.remove(v.g));
  drifterViews.clear();
  charmViews.forEach((v) => scene.remove(v.g));
  charmViews.clear();

  // Đảo chính (cỏ #2F5D50 + viền cát #C9B48A)
  for (const isl of nightCfg.islands) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r - 1.5, 2.5, 48), mat(PALETTE.grass));
    top.position.set(isl.cx, isl.y - 1.25, isl.cz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(isl.r - 0.4, 0.55, 6, 48), mat(PALETTE.sand));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(isl.cx, isl.y - 0.1, isl.cz);
    worldGroup.add(top, rim);
  }

  // Cầu tre Đêm 2 (#6B4A2F)
  if (nightCfg.bridge) {
    const b = nightCfg.bridge;
    const w = b.xMax - b.xMin;
    const d = b.zMax - b.zMin;
    const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), mat(PALETTE.wood));
    bridgeMesh.position.set((b.xMin + b.xMax) / 2, b.y - 0.18, (b.zMin + b.zMax) / 2);
    worldGroup.add(bridgeMesh);
  }

  // Các tầng cao Đêm 3
  for (const t of nightCfg.tiers) {
    if (t.kind === 'disk') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(t.rMax, t.rMax, t.y, 36), mat(PALETTE.grass));
      m.position.set(0, t.y / 2, 0);
      worldGroup.add(m);
    } else if (t.kind === 'halfRing') {
      // Vành khăn z > 0 (góc 0..PI theo atan2(z, x)): trong Shape 2D (x, y) sau khi xoay X=-PI/2 sẽ map y -> -z, nên vẽ cung 0..-PI!
      const shape = new THREE.Shape();
      shape.absarc(0, 0, t.rMax, 0, Math.PI, true);
      shape.absarc(0, 0, t.rMin, Math.PI, 0, false);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: t.y, bevelEnabled: false, curveSegments: 32 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(PALETTE.grass));
      m.position.y = 0;
      worldGroup.add(m);
    }
  }

  // 2 dốc thẳng Đêm 3 (#6B4A2F)
  for (const r of nightCfg.ramps) {
    const rad = (r.deg * Math.PI) / 180;
    const lenH = r.rFoot - r.rTop;
    const dy = r.yTop - r.yFoot;
    const slopeLen = Math.hypot(lenH, dy);
    const pitch = Math.atan2(dy, lenH);
    const rMid = (r.rFoot + r.rTop) / 2;
    const g = new THREE.Group();
    g.position.set(rMid * Math.cos(rad), (r.yFoot + r.yTop) / 2 - 0.15, rMid * Math.sin(rad));
    g.rotation.y = -rad;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.4, 0.3, r.width), mat(PALETTE.wood));
    plank.rotation.z = -pitch;
    g.add(plank);
    worldGroup.add(g);
  }

  // Tháp chuông Đêm 3 (trụ bán kính 2 m, cao 8 m tại tâm tầng 2)
  if (nightCfg.tower) {
    const tw = nightCfg.tower;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(tw.r, tw.r, tw.height, 24), mat(PALETTE.wood));
    body.position.set(tw.cx, tw.yBase + tw.height / 2, tw.cz);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(tw.r + 0.9, 2.2, 8), mat(PALETTE.mayScarfCharm));
    roof.position.set(tw.cx, tw.yBase + tw.height + 1.1, tw.cz);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.0, 12), mat(PALETTE.gold, { metalness: 0.4, roughness: 0.35 }));
    bell.position.set(tw.cx, tw.yBase + tw.height - 0.8, tw.cz);
    worldGroup.add(body, roof, bell);
  }

  // Bục nhảy
  for (const pad of nightCfg.jumpPads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r * 1.15, 0.25, 20), mat(PALETTE.gold, { emissive: PALETTE.lanternLit, emissiveIntensity: 0.45 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.12, pad.pos[2]);
    worldGroup.add(m);
  }

  // Đèn Lồng Lớn
  for (const L of nightCfg.lanterns) {
    const g = new THREE.Group();
    g.position.set(L.pos[0], L.pos[1], L.pos[2]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.0, 8), mat(PALETTE.wood));
    post.position.y = 1.5;
    const glowMat = new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, emissive: PALETTE.lanternOff, emissiveIntensity: 0.15, roughness: 0.35 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.88, 14, 10), glowMat);
    glow.position.y = 3.35;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0.1 }));
    core.position.y = 3.35;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(post, glow, core, ring);
    worldGroup.add(g);
    lanternViews.set(L.id, { g, glowMat, core, ring, pos: L.pos });
  }

  scene.add(worldGroup);
}

function makeShadeMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, emissive: PALETTE.shadeRim, emissiveIntensity: 0.45, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.88, 14, 10), bodyMat);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.uiText });
  for (const sx of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat);
    eye.position.set(sx, 0.15, 0.75);
    g.add(eye);
  }
  g.add(body);
  scene.add(g);
  return { g, bodyMat };
}

function makeDrifterMesh() {
  const g = new THREE.Group();
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.15, 1.5),
    new THREE.MeshStandardMaterial({ color: PALETTE.drifter, emissive: PALETTE.drifter, emissiveIntensity: 0.35, roughness: 0.4 }),
  );
  g.add(ribbon);
  scene.add(g);
  return { g, ribbon };
}

function makeCharmMesh(pos) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1] + 1.0, pos[2]);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.08), mat(PALETTE.mayScarfCharm, { emissive: PALETTE.mayScarfCharm, emissiveIntensity: 0.35 }));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.98, 0.05), mat(PALETTE.gold, { emissive: PALETTE.gold, emissiveIntensity: 0.4 }));
  g.add(border, tag);
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

function showOnly(id) {
  for (const ov of ['ov-menu', 'ov-intro', 'ov-pause', 'ov-settings', 'ov-result']) {
    $(ov).classList.toggle('hidden', ov !== id);
  }
  $('hud').classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 1700);
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
  lastCountdownSec = 11;
  prevGrounded = true;
  pendingPauseToggle = false;
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
      $('res-title').textContent = `Thắng Đêm ${currentNight} — ${sim.nightCfg.name}!`;
      $('res-desc').textContent = 'Ánh đèn đã xua tan sương đen. Ngọn Lửa của Mây sẽ hồi đầy trước Đêm tiếp theo.';
      $('res-score').textContent = `Điểm Đêm ${currentNight}: ${sim.score} · Tổng điểm: ${totalCampaignScore}`;
      $('btn-res-primary').textContent = `Sang Đêm ${currentNight + 1}`;
      $('btn-res-primary').onclick = () => openIntro(currentNight + 1, false);
    } else {
      mode = 'dawn';
      ov.classList.add('dawn');
      $('res-title').textContent = 'Bình Minh Trên Ba Hòn Đảo!';
      $('res-desc').textContent = 'Cả ba hòn đảo Đảo Bến, Đảo Cau và Đảo Chuông đã bừng sáng. Ông Đăng mỉm cười đón ánh bình minh đầu tiên.';
      $('res-score').textContent = `Điểm Đêm 3: ${sim.score} · Tổng điểm toàn hành trình: ${totalCampaignScore}`;
      $('btn-res-primary').textContent = 'Chơi lại từ Đêm 1';
      $('btn-res-primary').onclick = () => openIntro(1, true);
    }
  } else {
    audio.playLose();
    mode = 'result';
    $('res-title').textContent = `Thua Đêm ${currentNight}`;
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
    case 'lantern_lit': audio.playLanternLit(); toast(`🏮 Đã thắp sáng ${e.data.lantern_id}!`); break;
    case 'pulse': audio.playPulse(); pulseT = 0; break;
    case 'dash': audio.playDash(); break;
    case 'charm_picked': audio.playCharm(); toast('🧧 Đã nhặt Bùa Gió! Chạy nhanh & lướt liên tục'); break;
    case 'drifter_steal': audio.playHit(); toast(`💨 Gió Lạc cướp ${e.data.amount} đom đóm!`); break;
    case 'drifter_drop': audio.playPickup(5); toast(`✦ Gió Lạc làm rơi ${e.data.amount} đom đóm!`); break;
    case 'player_hit': audio.playHit(); toast(e.data.by === 'fall' ? 'Rơi xuống biển mây! −1 Ngọn Lửa' : `Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`); break;
    case 'shade_spawned': audio.playShadeSpawn(); break;
    case 'game_over': finishNight(e.data); break;
  }
}

// ---------- Đồng bộ hiển thị 3D + HUD (chỉ đọc state từ Sim) ----------
const dummy = new THREE.Object3D();
const tmpProj = new THREE.Vector3();

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
    v.glowMat.emissiveIntensity = L.lit ? 1.5 + Math.sin(timeSec * 3 + L.pos[0]) * 0.15 : 0.15 + prog * 0.7;
    v.core.material.opacity = L.lit ? 0.95 : prog * 0.45;
    v.ring.material.opacity = L.lit ? 0.28 : 0; // vùng an toàn 6 m chỉ hiện ở đèn đã sáng
  }

  // Công thức ánh sáng môi trường bắt buộc: 0.15 + 0.55 * (đèn sáng / tổng đèn)
  hemi.intensity = 0.15 + 0.55 * (litCount / Math.max(1, sim.lanterns.length));
  audio.setLitCount(litCount);

  // Gán 2 đèn điểm thật cho 2 đèn đã sáng gần Mây nhất (giữ FPS)
  litList.sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]));
  for (let i = 0; i < sharedLanternLights.length; i++) {
    const sl = sharedLanternLights[i];
    if (i < litList.length) {
      sl.position.set(litList[i].pos[0], litList[i].pos[1] + 3.4, litList[i].pos[2]);
      sl.intensity = 110;
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
    const bob = 0.75 + Math.sin(timeSec * 2.5 + i) * 0.18;
    dummy.position.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    moteCoreInst.setMatrixAt(i, dummy.matrix);
    moteHaloInst.setMatrixAt(i, dummy.matrix);
  }
  moteCoreInst.instanceMatrix.needsUpdate = true;
  moteHaloInst.instanceMatrix.needsUpdate = true;

  // Bóng Mực
  const liveS = new Set();
  for (const z of sim.shades) {
    liveS.add(z.id);
    let v = shadeViews.get(z.id);
    if (!v) { v = makeShadeMesh(); shadeViews.set(z.id, v); }
    const stunned = z.state === 'stunned';
    v.g.position.set(z.pos[0], z.pos[1] + Math.sin(timeSec * 3) * 0.1, z.pos[2]);
    v.g.scale.set(1, stunned ? 0.52 : 1, 1);
    v.bodyMat.color.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeBody);
    v.bodyMat.emissive.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeRim);
    v.bodyMat.emissiveIntensity = stunned ? 0.2 : 0.45;
    v.g.lookAt(p.pos[0], v.g.position.y, p.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!liveS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  // Gió Lạc
  const liveD = new Set();
  for (const d of sim.drifters) {
    if (d.state === 'removed') continue;
    liveD.add(d.id);
    let v = drifterViews.get(d.id);
    if (!v) { v = makeDrifterMesh(); drifterViews.set(d.id, v); }
    v.g.position.set(d.pos[0], d.pos[1] + Math.sin(timeSec * 6) * 0.2, d.pos[2]);
    v.g.rotation.y = Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
  }
  for (const [id, v] of drifterViews) if (!liveD.has(id)) { scene.remove(v.g); drifterViews.delete(id); }

  // Bùa Gió
  for (const c of sim.charms) {
    let v = charmViews.get(c.id);
    if (!v) { v = makeCharmMesh(c.pos); charmViews.set(c.id, v); }
    v.g.visible = c.available;
    if (c.available) {
      v.g.rotation.y = timeSec * 1.8;
      v.g.position.y = c.pos[1] + 1.0 + Math.sin(timeSec * 3) * 0.15;
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
      const flow = ((timeSec * (sim.wind.active ? 14 : 6) + lf.phase * 5) % 40) - 20;
      dummy.position.set(p.pos[0] + lf.ox * 0.5 + wx * flow, p.pos[1] + lf.oy, p.pos[2] + lf.oz * 0.5 + wz * flow);
      dummy.rotation.set(timeSec * 3 + lf.phase, wr, timeSec * 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leafInst.setMatrixAt(i, dummy.matrix);
    }
    leafInst.instanceMatrix.needsUpdate = true;
  } else {
    leafInst.count = 0;
  }

  // Mây & camera
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerMesh.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  playerMesh.visible = p.respawnTicks === 0 && !(p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0);
  const spd = Math.hypot(p.vel[0], p.vel[2]);
  hangPivot.rotation.z = Math.sin(timeSec * 9) * Math.min(0.4, spd * 0.04);

  const th = (yaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  camera.position.set(p.pos[0] - fx * 12, p.pos[1] + 8.5, p.pos[2] - fz * 12);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  if (pulseT < 0.5) {
    pulseT += DT * 2;
    const r = T.pulse_radius * Math.min(1, pulseT * 2.2) + 0.1;
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
    pulseRing.scale.set(r, r, 1);
    pulseRing.material.opacity = Math.max(0, 0.85 - pulseT * 1.7);
  } else pulseRing.material.opacity = 0;

  // HUD 7 thành phần
  $('h-flames').textContent = p.flames > 0 ? '🔥'.repeat(p.flames) : '💀';
  $('charm-badge').classList.toggle('hidden', p.charmTicks <= 0);
  if (p.charmTicks > 0) $('h-charm').textContent = `${(p.charmTicks / TPS).toFixed(1)}s`;
  $('h-time').textContent = fmt(sim.timeLeft);
  $('h-time-pill').classList.toggle('danger', sim.timeLeft <= 30);
  $('h-lit').textContent = `${litCount}/${sim.lanterns.length}`;
  $('h-score').textContent = String(sim.score);

  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle('filled', i < p.carried);
  }

  // Hồi chiêu Lướt & Tỏa Sáng
  const dashCooling = p.dashCd > 0 && p.charmTicks <= 0;
  $('sk-dash').classList.toggle('cooling', dashCooling);
  $('cd-dash').textContent = p.charmTicks > 0 ? '∞ Bùa' : dashCooling ? `${(p.dashCd / TPS).toFixed(1)}s` : 'Sẵn sàng';

  const pulseCooling = p.pulseCd > 0 || p.carried < T.pulse_cost;
  $('sk-pulse').classList.toggle('cooling', pulseCooling);
  $('cd-pulse').textContent = p.pulseCd > 0 ? `${(p.pulseCd / TPS).toFixed(1)}s` : p.carried < T.pulse_cost ? `Cần ${T.pulse_cost}✦` : 'Sẵn sàng';

  // Nhắc tương tác "E — Nạp ánh sáng (x/10)" khi gần đèn chưa sáng
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

  // Mũi tên chỉ tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  const arrowEl = $('lantern-arrow');
  if (nearestUnlit && mode === 'playing') {
    tmpProj.set(nearestUnlit.pos[0], nearestUnlit.pos[1] + 3.4, nearestUnlit.pos[2]).project(camera);
    const inFront = tmpProj.z <= 1;
    const onScreen = inFront && Math.abs(tmpProj.x) <= 0.92 && Math.abs(tmpProj.y) <= 0.92;
    if (onScreen) {
      arrowEl.classList.add('hidden');
    } else {
      let sx = inFront ? tmpProj.x : -tmpProj.x;
      let sy = inFront ? tmpProj.y : -tmpProj.y;
      const ang = Math.atan2(sy, sx);
      const px = innerWidth * 0.5 + Math.cos(ang) * (innerWidth * 0.43);
      const py = innerHeight * 0.5 - Math.sin(ang) * (innerHeight * 0.40);
      arrowEl.style.left = `${px - 17}px`;
      arrowEl.style.top = `${py - 17}px`;
      arrowEl.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
      arrowEl.classList.remove('hidden');
    }
  } else {
    arrowEl.classList.add('hidden');
  }
}

// ---------- Bộ đếm FPS (?fps) & Tự hạ pixelRatio khi FPS < 40 (O7) ----------
const showFps = new URLSearchParams(location.search).has('fps');
if (showFps) $('fps-box').classList.remove('hidden');
const fpsSamples = [];
let fpsWindowAcc = 0, fpsWindowFrames = 0;

// Dựng sẵn cảnh nền Đêm 1 cho Menu chính
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
