// Bản chơi 3D (Three.js) chạy trên cùng lõi Sim với chế độ headless.
import * as THREE from 'three';
import { Sim, DT } from '/src/sim.js';
import { TUNING as T, EXTRA as X } from '/src/tuning.js';

const $ = (id) => document.getElementById(id);
const hud = { flames: $('h-flames'), carried: $('h-carried'), lit: $('h-lit'), score: $('h-score'), time: $('h-time') };

// ---------- Cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1430);
scene.fog = new THREE.Fog(0x0e1430, 25, 90);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0x6e78c8, 0x1b2350, 0.5);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8f9bff, 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const ground = new THREE.Mesh(new THREE.CylinderGeometry(X.island_radius, X.island_radius - 3, 3, 64), mat(0x2d4a3e));
ground.position.y = -1.5;
scene.add(ground);
const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshBasicMaterial({ color: 0x1b2350 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -8;
scene.add(sea);
for (let i = 0; i < 14; i++) { // mây trang trí quanh đảo
  const c = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 4), 12, 8), new THREE.MeshBasicMaterial({ color: 0x232c5e, transparent: true, opacity: 0.8 }));
  const a = (i / 14) * Math.PI * 2;
  c.position.set(Math.sin(a) * (X.island_radius + 12 + (i % 3) * 5), -5 + (i % 3), Math.cos(a) * (X.island_radius + 12 + (i % 3) * 5));
  c.scale.y = 0.5;
  scene.add(c);
}

// ---------- Đối tượng ----------
const lanternViews = new Map();
function makeLantern(L) {
  const g = new THREE.Group();
  g.position.set(L.pos[0], 0, L.pos[2]);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 3, 8), mat(0x5a3d2b));
  post.position.y = 1.5;
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x2b1f4d, emissive: 0x7a3cff, emissiveIntensity: 0.2, roughness: 0.4 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), glowMat);
  glow.position.y = 3.4;
  const light = new THREE.PointLight(0xffb347, 0, 32, 2);
  light.position.y = 3.4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(post, glow, light, ring);
  scene.add(g);
  return { g, glow, glowMat, light, ring };
}

const moteGeo = new THREE.SphereGeometry(0.22, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe58a });
const moteViews = new Map();

const shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a0f33, emissive: 0x7a3cff, emissiveIntensity: 0.35, roughness: 0.6 }));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf5f1e6 });
  for (const sx of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    eye.position.set(sx, 0.15, 0.75);
    g.add(eye);
  }
  g.add(body);
  scene.add(g);
  return { g, body };
}

// Mây: thân + nón lá + đèn lồng nhỏ treo trên nón
const player = new THREE.Group();
const bodyM = mat(0xf0e2c0);
const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.1, 12), bodyM);
pBody.position.y = 0.7;
const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat(0xe9c9a0));
pHead.position.y = 1.55;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.55, 20), mat(0xd9b36a));
hat.position.y = 2.0;
const hang = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
hang.position.set(0.7, 1.55, 0);
const pLight = new THREE.PointLight(0xffb347, 18, 16, 2);
pLight.position.set(0.7, 1.55, 0);
player.add(pBody, pHead, hat, hang, pLight);
scene.add(player);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 99;

// ---------- Âm thanh (Web Audio, tùy chọn) ----------
let actx = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.05) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch { /* không có âm thanh cũng không sao */ }
}

// ---------- Điều khiển ----------
const keys = new Set();
let yaw = 0;
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Enter' && sim.state !== 'playing' && !$('overlay').classList.contains('hidden')) startGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
addEventListener('mousedown', () => { drag = true; });
addEventListener('mouseup', () => { drag = false; });
addEventListener('mousemove', (e) => { if (drag) yaw -= e.movementX * 0.3; });

function readInput() {
  // Ở yaw=0 camera nhìn về +Z; sang phải màn hình là -X của thế giới (Contract: move[0] dương = +X).
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
  };
}

// ---------- Vòng lặp ----------
let sim = new Sim({ seed: 1 });
let running = false;
let acc = 0, last = performance.now();
const toastEl = $('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.style.opacity = 0), 1600);
}

function onEvent(e) {
  switch (e.name) {
    case 'mote_picked': beep(660 + e.data.carried * 90, 0.08); break;
    case 'deposit': beep(440, 0.15, 'triangle'); toast(`Nạp ánh sáng vào ${e.data.lantern_id}: ${e.data.deposited}/${T.lantern_cost}`); break;
    case 'lantern_lit': beep(880, 0.4, 'triangle', 0.08); toast(`🏮 Đã thắp ${e.data.lantern_id}!`); break;
    case 'pulse': beep(520, 0.3, 'sine', 0.07); pulseT = 0; break;
    case 'player_hit': beep(120, 0.3, 'sawtooth', 0.06); toast(e.data.dropped ? `Bị Bóng Mực chạm! Rơi ${e.data.dropped} ánh sáng` : 'Bị Bóng Mực chạm!'); break;
    case 'shade_spawned': toast('Bóng Mực xuất hiện trong sương…'); break;
    case 'game_over': endGame(e.data); break;
  }
}

function startGame() {
  sim = new Sim({ seed: (Date.now() & 0x7fffffff) || 1 });
  $('overlay').classList.add('hidden');
  running = true;
  acc = 0; last = performance.now();
}

function endGame(d) {
  running = false;
  const won = d.result === 'won';
  const why = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo bừng sáng trở lại!', dawn: 'Trời đã sáng, nhưng đảo vẫn chưa đủ đèn.', no_flames: 'Ngọn lửa của Mây đã tắt.' }[d.reason];
  $('o-title').textContent = won ? 'Chiến thắng!' : 'Thua rồi';
  $('o-text').textContent = `${why} Điểm: ${sim.score}. Nhấn Enter hoặc nút bên dưới để chơi lại.`;
  $('o-btn').textContent = 'Chơi lại';
  $('overlay').classList.remove('hidden');
}
$('o-btn').addEventListener('click', startGame);

function fmt(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function syncViews(time) {
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  hemi.intensity = 0.5 + litCount * 0.18; // đảo sáng dần lên khi thắp đèn
  for (const L of sim.lanterns) {
    let v = lanternViews.get(L.id);
    if (!v) { v = makeLantern(L); lanternViews.set(L.id, v); }
    const k = L.lit ? 1 : L.deposited / T.lantern_cost;
    v.glowMat.color.setHex(L.lit ? 0xffe9b0 : 0x2b1f4d);
    v.glowMat.emissive.setHex(L.lit ? 0xffb347 : 0x7a3cff);
    v.glowMat.emissiveIntensity = L.lit ? 1.6 + Math.sin(time * 3 + L.pos[0]) * 0.2 : 0.2 + k * 0.8;
    v.light.intensity = L.lit ? 140 : k * 30;
    v.ring.material.opacity = L.lit ? 0.3 : 0.1;
  }
  const liveM = new Set();
  for (const m of sim.motes) {
    liveM.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) { v = new THREE.Mesh(moteGeo, moteMat); scene.add(v); moteViews.set(m.id, v); }
    v.position.set(m.pos[0], 0.8 + Math.sin(time * 2 + m.pos[0]) * 0.2, m.pos[2]);
  }
  for (const [id, v] of moteViews) if (!liveM.has(id)) { scene.remove(v); moteViews.delete(id); }
  const liveS = new Set();
  for (const z of sim.shades) {
    liveS.add(z.id);
    let v = shadeViews.get(z.id);
    if (!v) { v = makeShade(); shadeViews.set(z.id, v); }
    const stunned = z.state === 'stunned';
    v.g.position.set(z.pos[0], z.pos[1] + Math.sin(time * 3) * 0.1, z.pos[2]);
    v.g.scale.set(1, stunned ? 0.5 : 1, 1);
    v.body.material.emissiveIntensity = stunned ? 0.05 : 0.35 + Math.sin(time * 8) * 0.1;
    v.g.lookAt(sim.player.pos[0], v.g.position.y, sim.player.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!liveS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  const p = sim.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = (yaw * Math.PI) / 180;
  player.visible = !(p.invuln > 0 && Math.floor(p.invuln / 6) % 2 === 0); // nhấp nháy khi bất tử
  const th = (yaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th); // hướng nhìn của camera
  camera.position.set(p.pos[0] - fx * 11, p.pos[1] + 8, p.pos[2] - fz * 11);
  camera.lookAt(p.pos[0], p.pos[1] + 1, p.pos[2]);

  if (pulseT < 0.5) {
    pulseT += DT * 2;
    const r = T.pulse_radius * Math.min(1, pulseT * 2.2) + 0.1;
    pulseRing.position.set(p.pos[0], 0.08, p.pos[2]);
    pulseRing.scale.set(r, r, 1);
    pulseRing.material.opacity = Math.max(0, 0.8 - pulseT * 1.6);
  } else pulseRing.material.opacity = 0;

  hud.flames.textContent = p.flames;
  hud.carried.textContent = `${p.carried}/${T.carry_capacity}`;
  hud.lit.textContent = `${litCount}/${sim.lanterns.length}`;
  hud.score.textContent = sim.score;
  hud.time.textContent = fmt(sim.timeLeft);
}

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (running) {
    if (keys.has('KeyQ')) yaw += 90 * dt;
    if (keys.has('KeyR')) yaw -= 90 * dt;
    acc += dt;
    while (acc >= DT && running) {
      sim.step(readInput());
      for (const e of sim.drainEvents()) onEvent(e);
      acc -= DT;
    }
  }
  syncViews(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('o-btn').addEventListener('click', () => { if (actx && actx.state === 'suspended') actx.resume(); });
