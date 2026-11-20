// Thư viện tạo chất liệu procedural (CanvasTexture) và mô hình 3D phong cách Hội An / đảo nổi.
// Thuần Three.js, không dùng file ảnh/mô hình ngoài có bản quyền, giữ đúng bảng màu chuẩn TICKET-02.
import * as THREE from 'three';

function makeCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 1. Bộ chất liệu procedural (tạo 1 lần duy nhất lúc khởi động) ----------
export function createAssetPack(PALETTE) {
  const glowTex = (inner, mid, outer = 'rgba(0,0,0,0)') => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, mid);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  };

  const textures = {
    warmGlow: glowTex('#FFF6C2', 'rgba(255, 179, 71, 0.52)'),
    moteGlow: glowTex('#FFFFFF', 'rgba(255, 229, 138, 0.65)'),
    moonGlow: glowTex('#FFE9B0', 'rgba(242, 193, 78, 0.22)'),
    violetGlow: glowTex('rgba(122, 60, 255, 0.72)', 'rgba(122, 60, 255, 0.16)'),
    shadowDisc: glowTex('rgba(6, 10, 24, 0.62)', 'rgba(6, 10, 24, 0.22)'),

    // Mặt cỏ hội họa (#2F5D50) có mảng rêu đậm/nhạt & hoa đốm nhỏ
    grass: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2F5D50';
      ctx.fillRect(0, 0, w, h);
      let s = 1337;
      const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(34, 72, 62, 0.35)' : 'rgba(62, 114, 96, 0.28)';
        ctx.beginPath();
        ctx.arc(rnd() * w, rnd() * h, 6 + rnd() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 650; i++) {
        const x = rnd() * w, y = rnd() * h;
        ctx.strokeStyle = rnd() > 0.4 ? 'rgba(72, 130, 108, 0.45)' : 'rgba(25, 55, 48, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 4, y - 5 - rnd() * 5);
        ctx.stroke();
      }
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = rnd() > 0.3 ? 'rgba(255, 246, 194, 0.45)' : 'rgba(201, 180, 138, 0.55)';
        ctx.beginPath();
        ctx.arc(rnd() * w, rnd() * h, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }),

    // Đá cát ven đảo (#C9B48A)
    sandStone: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#C9B48A';
      ctx.fillRect(0, 0, w, h);
      let s = 4242;
      const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(165, 142, 100, 0.32)' : 'rgba(225, 208, 170, 0.3)';
        ctx.beginPath();
        ctx.ellipse(rnd() * w, rnd() * h, 8 + rnd() * 16, 4 + rnd() * 10, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(107, 74, 47, 0.25)';
      ctx.lineWidth = 1.5;
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }),

    // Gỗ / tre có vân & đốt (#6B4A2F)
    wood: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#6B4A2F';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const y = (i / 70) * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(84, 56, 34, 0.45)' : 'rgba(130, 92, 58, 0.32)';
        ctx.fillRect(0, y, w, 2 + (i % 3));
      }
      ctx.strokeStyle = 'rgba(42, 26, 14, 0.45)';
      ctx.lineWidth = 2;
      for (let x = 32; x < w; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
    }),

    // Đan nón lá tre (#C9B48A)
    conicalHat: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#C9B48A';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(107, 74, 47, 0.35)';
      ctx.lineWidth = 2;
      for (let y = 8; y < h; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(232, 226, 208, 0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
    }),

    // Lụa đèn lồng Hội An có nan tre dọc & họa tiết cánh sen
    lanternSilk: makeCanvas(256, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#D98B2B');
      g.addColorStop(0.5, '#FFE9B0');
      g.addColorStop(1, '#D98B2B');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Nan tre dọc chia múi đèn lồng
      ctx.strokeStyle = 'rgba(107, 74, 47, 0.55)';
      ctx.lineWidth = 3;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // Họa tiết cánh sen tinh tế ở giữa thân đèn
      ctx.fillStyle = 'rgba(200, 16, 46, 0.22)';
      for (let x = 16; x < w; x += 32) {
        ctx.beginPath();
        ctx.ellipse(x, h * 0.5, 9, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }),

    // Giấy đèn lồng tắt có vết rách răng cưa rõ nét (TICKET-03 Phần 6: phân biệt không cần màu)
    lanternSilkTorn: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#5B5F6E';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(28, 30, 42, 0.7)';
      ctx.lineWidth = 3;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // Các vết rách giấy rõ rệt (lỗ đen răng cưa + viền giấy sờn)
      const tears = [
        [[40, 62], [74, 88], [62, 128], [86, 168], [52, 192], [32, 148], [46, 108]],
        [[148, 48], [186, 76], [174, 122], [198, 152], [164, 184], [140, 134]],
        [[212, 92], [240, 118], [228, 174], [202, 150]],
      ];
      for (const poly of tears) {
        ctx.fillStyle = '#0E1430';
        ctx.strokeStyle = '#9EA4B8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }),

    // Lá Bùa Gió đỏ viền vàng có chữ triện gió
    charmPaper: makeCanvas(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#C8102E';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#F2C14E';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      // Ký hiệu xoáy gió vàng
      ctx.strokeStyle = '#FFE9B0';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(36, 95); ctx.bezierCurveTo(90, 70, 96, 130, 44, 138);
      ctx.moveTo(34, 158); ctx.bezierCurveTo(96, 148, 92, 195, 50, 195);
      ctx.stroke();
    }),

    // Biển mây tầng sâu (#12384A)
    cloudSea: makeCanvas(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#12384A';
      ctx.fillRect(0, 0, w, h);
      let s = 9001;
      const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      for (let i = 0; i < 90; i++) {
        const x = rnd() * w, y = rnd() * h, r = 24 + rnd() * 68;
        const g = ctx.createRadialGradient(x, y, 4, x, y, r);
        g.addColorStop(0, rnd() > 0.4 ? 'rgba(34, 82, 108, 0.35)' : 'rgba(27, 35, 80, 0.38)');
        g.addColorStop(1, 'rgba(18, 56, 74, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }),

    // Vòng hoa văn sen cho vùng an toàn 6 m & bục nhảy
    runeRing: makeCanvas(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = '#FFB347';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 114, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 233, 176, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.arc(0, 0, 102, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = '#FFE9B0';
        ctx.beginPath();
        ctx.moveTo(108, 0); ctx.lineTo(118, -4); ctx.lineTo(123, 0); ctx.lineTo(118, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }),
  };

  for (const k of ['grass', 'sandStone', 'wood', 'cloudSea']) {
    textures[k].wrapS = THREE.RepeatWrapping;
    textures[k].wrapT = THREE.RepeatWrapping;
  }
  textures.grass.repeat.set(9, 9);
  textures.sandStone.repeat.set(6, 2);
  textures.wood.repeat.set(3, 3);
  textures.cloudSea.repeat.set(5, 5);

  // ---------- 2. Hình học điêu khắc dùng lại ----------
  // Thân áo Mây (LatheGeometry xòe mềm)
  const robePts = [
    new THREE.Vector2(0.01, 0.14),
    new THREE.Vector2(0.56, 0.14),
    new THREE.Vector2(0.48, 0.45),
    new THREE.Vector2(0.36, 0.85),
    new THREE.Vector2(0.28, 1.15),
    new THREE.Vector2(0.20, 1.22),
  ];
  // Nón lá cong mượt (LatheGeometry)
  const hatPts = [
    new THREE.Vector2(0.0, 0.62),
    new THREE.Vector2(0.26, 0.44),
    new THREE.Vector2(0.62, 0.22),
    new THREE.Vector2(1.04, 0.0),
    new THREE.Vector2(0.96, -0.02),
    new THREE.Vector2(0.35, 0.26),
  ];
  // Thân Đèn Lồng Hội An phình giữa thon hai đầu
  const lanternPts = [
    new THREE.Vector2(0.01, -0.95),
    new THREE.Vector2(0.38, -0.88),
    new THREE.Vector2(0.76, -0.52),
    new THREE.Vector2(0.94, 0.0),
    new THREE.Vector2(0.78, 0.55),
    new THREE.Vector2(0.40, 0.88),
    new THREE.Vector2(0.01, 0.94),
  ];
  // Mái đình cong uốn lên cho Đèn Lồng & Tháp Chuông
  const pagodaRoofPts = [
    new THREE.Vector2(0.0, 0.85),
    new THREE.Vector2(0.32, 0.56),
    new THREE.Vector2(0.75, 0.24),
    new THREE.Vector2(1.22, 0.08),
    new THREE.Vector2(1.36, 0.14),
    new THREE.Vector2(1.18, 0.0),
  ];
  // Chuông đồng cổ
  const bellPts = [
    new THREE.Vector2(0.01, 0.65),
    new THREE.Vector2(0.30, 0.58),
    new THREE.Vector2(0.42, 0.25),
    new THREE.Vector2(0.54, -0.25),
    new THREE.Vector2(0.72, -0.55),
    new THREE.Vector2(0.60, -0.55),
  ];
  // Thân Bóng Mực giọt mực u ám
  const shadePts = [
    new THREE.Vector2(0.01, -0.82),
    new THREE.Vector2(0.45, -0.70),
    new THREE.Vector2(0.84, -0.22),
    new THREE.Vector2(0.82, 0.28),
    new THREE.Vector2(0.56, 0.72),
    new THREE.Vector2(0.18, 1.15),
    new THREE.Vector2(0.0, 1.38),
  ];

  const geos = {
    robe: new THREE.LatheGeometry(robePts, 20),
    hat: new THREE.LatheGeometry(hatPts, 28),
    lanternBody: new THREE.LatheGeometry(lanternPts, 20),
    pagodaRoof: new THREE.LatheGeometry(pagodaRoofPts, 8),
    bell: new THREE.LatheGeometry(bellPts, 18),
    shadeBody: new THREE.LatheGeometry(shadePts, 12),
    shadowPlane: new THREE.PlaneGeometry(1, 1),
  };

  function makeContactShadow(radius = 1.6) {
    const m = new THREE.Mesh(
      geos.shadowPlane,
      new THREE.MeshBasicMaterial({ map: textures.shadowDisc, transparent: true, depthWrite: false, opacity: 0.75 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(radius, radius, 1);
    m.position.y = 0.03;
    return m;
  }

  // ---------- 3. Tạo nhân vật Mây (có chân, tay áo, khăn bay, tóc, nón lá nan tre & đèn lồng mini) ----------
  function buildPlayer() {
    const root = new THREE.Group();
    const shadow = makeContactShadow(1.85);

    const bootMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 6, 8), bootMat);
    leftLeg.position.set(-0.17, 0.22, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.17;

    const robe = new THREE.Mesh(geos.robe, new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe, roughness: 0.82 }));
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 20), new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.5 }));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.16;

    const sleeveGeo = new THREE.ConeGeometry(0.18, 0.58, 10);
    const sleeveMat = new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe, roughness: 0.85 });
    const leftArm = new THREE.Mesh(sleeveGeo, sleeveMat);
    leftArm.position.set(-0.38, 0.9, 0.04);
    leftArm.rotation.z = 0.35;
    const rightArm = new THREE.Mesh(sleeveGeo, sleeveMat);
    rightArm.position.set(0.38, 0.9, 0.04);
    rightArm.rotation.z = -0.35;

    // Khăn quàng đỏ (#C8102E) + 2 dải khăn bay
    const scarfMat = new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfCharm, roughness: 0.72 });
    const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.095, 10, 18), scarfMat);
    scarfCollar.rotation.x = Math.PI / 2;
    scarfCollar.position.y = 1.22;

    const scarfTail1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.045), scarfMat);
    scarfTail1.position.set(-0.08, 0.94, -0.36);
    scarfTail1.rotation.set(0.34, 0, 0.08);
    const scarfTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.04), scarfMat);
    scarfTail2.position.set(0.09, 0.98, -0.34);
    scarfTail2.rotation.set(0.42, 0, -0.12);

    // Đầu + tóc + mắt
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 14), new THREE.MeshStandardMaterial({ color: 0xf1d4b0, roughness: 0.75 }));
    head.position.y = 1.5;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0x1a1528, roughness: 0.85 }));
    hair.position.set(0, 1.54, -0.04);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x120a1a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), eyeMat);
    eyeL.position.set(-0.1, 1.5, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;

    // Nón lá đan tre + vành gỗ
    const hat = new THREE.Mesh(geos.hat, new THREE.MeshStandardMaterial({ map: textures.conicalHat, roughness: 0.85, side: THREE.DoubleSide }));
    hat.position.y = 1.66;
    const hatRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.032, 8, 28), new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 }));
    hatRim.rotation.x = Math.PI / 2;
    hatRim.position.y = 1.66;

    // Đèn lồng mini treo trên vành nón lá (có dây, nan lồng & hào quang ấm)
    const hangPivot = new THREE.Group();
    hangPivot.position.set(0.92, 1.66, 0.14);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), new THREE.MeshStandardMaterial({ color: PALETTE.wood }));
    cord.position.y = -0.12;
    const miniLantern = new THREE.Mesh(
      geos.lanternBody,
      new THREE.MeshBasicMaterial({ map: textures.lanternSilk, color: PALETTE.lanternCore }),
    );
    miniLantern.scale.set(0.2, 0.22, 0.2);
    miniLantern.position.y = -0.34;
    const miniTassel = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), scarfMat);
    miniTassel.rotation.x = Math.PI;
    miniTassel.position.y = -0.58;
    const hangGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures.warmGlow, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    hangGlow.scale.set(1.7, 1.7, 1);
    hangGlow.position.y = -0.34;
    hangPivot.add(cord, miniLantern, miniTassel, hangGlow);

    const pLight = new THREE.PointLight(PALETTE.lanternLit, 22, 20, 1.7);
    pLight.position.set(0.9, 1.45, 0.2);

    root.add(shadow, leftLeg, rightLeg, robe, hem, leftArm, rightArm, scarfCollar, scarfTail1, scarfTail2, head, hair, eyeL, eyeR, hat, hatRim, hangPivot, pLight);
    return { root, shadow, leftLeg, rightLeg, leftArm, rightArm, scarfTail1, scarfTail2, hangPivot };
  }

  // ---------- 4. Tạo Đèn Lồng Lớn kiểu miếu Hội An ----------
  function buildLantern(L, safeRadius) {
    const g = new THREE.Group();
    g.position.set(L.pos[0], L.pos[1], L.pos[2]);

    const shadow = makeContactShadow(2.4);
    const stoneMat = new THREE.MeshStandardMaterial({ map: textures.sandStone, roughness: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.85 });
    const goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.45, roughness: 0.35 });

    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.12, 0.28, 8), stoneMat);
    base1.position.y = 0.14;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.26, 8), stoneMat);
    base2.position.y = 0.4;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.15, 10), woodMat);
    post.position.set(-0.62, 2.45, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.16), woodMat);
    beam.position.set(-0.12, 4.42, 0);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.11, 0.11), woodMat);
    brace.position.set(-0.36, 4.1, 0);
    brace.rotation.z = 0.75;

    // Mái che nhỏ cong uốn trên đèn
    const roof = new THREE.Mesh(geos.pagodaRoof, new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfCharm, roughness: 0.75 }));
    roof.scale.set(0.88, 0.72, 0.88);
    roof.position.set(0.24, 4.12, 0);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), goldMat);
    finial.position.set(0.24, 4.78, 0);

    // Thân đèn lồng lụa điêu khắc
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0.24, 3.22, 0);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.14, 14), goldMat);
    capTop.position.y = 0.88;
    const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.14, 14), goldMat);
    capBot.position.y = -0.88;

    const glowMat = new THREE.MeshStandardMaterial({
      map: textures.lanternSilkTorn,
      color: PALETTE.lanternOff,
      emissive: PALETTE.lanternOff,
      emissiveIntensity: 0.15,
      roughness: 0.38,
    });
    const body = new THREE.Mesh(geos.lanternBody, glowMat);
    body.scale.set(1.06, 0.8, 1.06); // đèn tắt xẹp 20%

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0.1 }),
    );

    const tassel = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfCharm, roughness: 0.7 }),
    );
    tassel.rotation.x = Math.PI;
    tassel.position.y = -1.28;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), goldMat);
    bead.position.y = -0.96;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures.warmGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.set(7.2, 7.2, 1);

    // Thanh dầu 3D phía trên mỗi đèn đang sáng (TICKET-03 Phần 1)
    const fuelBarGroup = new THREE.Group();
    fuelBarGroup.position.set(0.24, 5.25, 0);
    fuelBarGroup.visible = false;
    const fuelBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x0e1430, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    const fuelFillMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, side: THREE.DoubleSide });
    const fuelFill = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.15), fuelFillMat);
    fuelFill.position.z = 0.01;
    fuelBarGroup.add(fuelBg, fuelFill);

    lanternGroup.add(capTop, capBot, body, core, bead, tassel, halo);

    // Vòng hoa văn sen vùng an toàn 6 m
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(safeRadius * 2.08, safeRadius * 2.08),
      new THREE.MeshBasicMaterial({ map: textures.runeRing, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;

    g.add(shadow, base1, base2, post, beam, brace, roof, finial, lanternGroup, fuelBarGroup, ring);
    return { g, lanternGroup, body, glowMat, core, halo, ring, fuelBarGroup, fuelFill, fuelFillMat, pos: L.pos };
  }

  // ---------- 5. Tạo Bóng Mực (linh hồn giọt mực + 6 tua mực uốn lượn + mắt dõi theo Mây) ----------
  function buildShade() {
    const g = new THREE.Group();
    const shadow = makeContactShadow(1.7);
    shadow.position.y = -0.95;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.shadeBody,
      emissive: PALETTE.shadeRim,
      emissiveIntensity: 0.52,
      roughness: 0.42,
      metalness: 0.15,
    });
    const body = new THREE.Mesh(geos.shadeBody, bodyMat);
    body.scale.set(0.95, 0.95, 0.95);

    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures.violetGlow, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    aura.scale.set(3.4, 3.4, 1);

    // 6 tua mực uốn lượn bên dưới thân
    const tendrils = [];
    const tendrilGeo = new THREE.ConeGeometry(0.14, 0.85, 7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const t = new THREE.Mesh(tendrilGeo, bodyMat);
      t.rotation.x = Math.PI;
      t.position.set(Math.cos(a) * 0.42, -0.78, Math.sin(a) * 0.42);
      g.add(t);
      tendrils.push({ mesh: t, phase: i * 1.1 });
    }

    // Đôi mắt sáng sắc sảo nhìn về +Z (mặc định #7A3CFF, mù màu đổi sang #00B3FF theo TICKET-03 §6)
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    const eyeGeo = new THREE.SphereGeometry(0.13, 10, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.scale.set(1.25, 0.72, 0.6);
    eyeL.position.set(-0.27, 0.12, 0.74);
    eyeL.rotation.z = -0.22;
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.27;
    eyeR.rotation.z = 0.22;

    g.add(shadow, body, aura, eyeL, eyeR);
    return { g, body, bodyMat, eyeMat, aura, tendrils };
  }

  // ---------- 5b. Gộp BufferGeometry nhẹ để dựng 200+ Bóng Mực bằng InstancedMesh (chỉ 5 draw calls!) ----------
  function mergeSimpleGeos(list) {
    let vertCount = 0;
    const expanded = list.map((src) => {
      const g = src.index ? src.toNonIndexed() : src.clone();
      vertCount += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(vertCount * 3);
    const norm = new Float32Array(vertCount * 3);
    let offset = 0;
    for (const g of expanded) {
      const p = g.attributes.position.array;
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.normal.array;
      pos.set(p, offset);
      norm.set(n, offset);
      offset += p.length;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    return merged;
  }

  function buildShadeInstanced(maxCount = 256) {
    // 2 mắt hợp nhất thành 1 geometry nhẹ (16 tam giác/bóng, giữ dáng mắt sắc & tiết kiệm 12x vertex)
    const eL = new THREE.OctahedronGeometry(0.13, 0);
    eL.scale(1.25, 0.72, 0.6);
    eL.rotateZ(-0.22);
    eL.translate(-0.27, 0.12, 0.74);
    const eR = new THREE.OctahedronGeometry(0.13, 0);
    eR.scale(1.25, 0.72, 0.6);
    eR.rotateZ(0.22);
    eR.translate(0.27, 0.12, 0.74);
    const eyesGeo = mergeSimpleGeos([eL, eR]);
    eL.dispose(); eR.dispose();

    // 6 tua mực hợp nhất thành 1 geometry duy nhất (4 mặt/tua để giữ hình khối mà nhẹ GPU)
    const tParts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = new THREE.ConeGeometry(0.14, 0.85, 4);
      c.rotateX(Math.PI);
      c.translate(Math.cos(a) * 0.42, -0.78, Math.sin(a) * 0.42);
      tParts.push(c);
    }
    const tendrilsGeo = mergeSimpleGeos(tParts);
    tParts.forEach((g) => g.dispose());

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: PALETTE.shadeRim,
      emissiveIntensity: 0.58,
      roughness: 0.42,
      metalness: 0.15,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    const shadowMat = new THREE.MeshBasicMaterial({ map: textures.shadowDisc, transparent: true, alphaTest: 0.04, depthWrite: false, opacity: 0.68 });
    const auraMat = new THREE.MeshBasicMaterial({
      map: textures.violetGlow,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.04,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const bodyInst = new THREE.InstancedMesh(geos.shadeBody, bodyMat, maxCount);
    const tendrilInst = new THREE.InstancedMesh(tendrilsGeo, bodyMat, maxCount);
    const eyeInst = new THREE.InstancedMesh(eyesGeo, eyeMat, maxCount);
    const shadowInst = new THREE.InstancedMesh(geos.shadowPlane, shadowMat, maxCount);
    const auraInst = new THREE.InstancedMesh(geos.shadowPlane, auraMat, maxCount);

    for (const im of [bodyInst, tendrilInst, eyeInst, shadowInst, auraInst]) {
      im.count = 0;
      im.frustumCulled = false;
    }

    const group = new THREE.Group();
    group.add(bodyInst, tendrilInst, eyeInst, shadowInst, auraInst);
    return { group, bodyInst, tendrilInst, eyeInst, shadowInst, auraInst, bodyMat, eyeMat, auraMat, maxCount };
  }

  // ---------- 6. Tạo Gió Lạc (dải lụa 7 đốt bay mềm mại + vòng gió xoáy) ----------
  function buildDrifter() {
    const g = new THREE.Group();
    const segMat = new THREE.MeshStandardMaterial({
      color: PALETTE.drifter,
      emissive: PALETTE.drifter,
      emissiveIntensity: 0.42,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), segMat);
    head.scale.set(0.9, 0.65, 1.35);
    g.add(head);

    const segs = [];
    for (let i = 0; i < 7; i++) {
      const w = 0.46 * (1 - i * 0.1);
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.38), segMat);
      s.position.z = -(i + 1) * 0.34;
      g.add(s);
      segs.push(s);
    }
    const swirl = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.03, 6, 20),
      new THREE.MeshBasicMaterial({ color: PALETTE.uiText, transparent: true, opacity: 0.45 }),
    );
    swirl.rotation.x = Math.PI / 2;
    g.add(swirl);
    return { g, segs, segMat, swirl };
  }

  // ---------- 7. Tạo Bùa Gió (lá bùa chữ triện đỏ-vàng + trục gỗ + vòng hào quang) ----------
  function buildCharm(pos) {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1] + 1.15, pos[2]);
    const scroll = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.05, 0.04),
      new THREE.MeshStandardMaterial({ map: textures.charmPaper, emissive: PALETTE.mayScarfCharm, emissiveIntensity: 0.32, roughness: 0.4 }),
    );
    const rodMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.5, roughness: 0.3 });
    const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 8), rodMat);
    topRod.rotation.z = Math.PI / 2;
    topRod.position.y = 0.54;
    const botRod = topRod.clone();
    botRod.position.y = -0.54;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.75 }),
    );
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures.warmGlow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.scale.set(2.6, 2.6, 1);
    g.add(scroll, topRod, botRod, ring, halo);
    return { g, ring };
  }

  // ---------- 8. Cây cối, khóm tre, đá rêu & đường đá trang trí (InstancedMesh: siêu nhẹ GPU) ----------
  function addScenery(worldGroup, nightCfg) {
    const trunkMats = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.9 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.85 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3b7362, roughness: 0.85 });
    const rockMat = new THREE.MeshStandardMaterial({ map: textures.sandStone, color: 0x9aa49e, roughness: 0.92 });

    const treePositions = [];
    const bambooPositions = [];
    const rockPositions = [];
    const stoneTiles = [];

    const nearBlocked = (x, z) => {
      // Giữ lối đi thoáng quanh đèn, bục nhảy, bùa, xuất phát, cầu, dốc
      if (Math.hypot(x - nightCfg.spawn[0], z - nightCfg.spawn[2]) < 5.5) return true;
      for (const L of nightCfg.lanterns) if (Math.hypot(x - L.pos[0], z - L.pos[2]) < 4.8) return true;
      for (const p of nightCfg.jumpPads) if (Math.hypot(x - p.pos[0], z - p.pos[2]) < 4.5) return true;
      for (const c of nightCfg.charms) if (Math.hypot(x - c.pos[0], z - c.pos[2]) < 4.0) return true;
      if (nightCfg.bridge && x > 22 && x < 48 && Math.abs(z) < 6) return true;
      return false;
    };

    for (const isl of nightCfg.islands) {
      const count = Math.round(isl.r * 0.55);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + 0.17;
        const r = isl.r - 2.6 - (i % 3) * 1.4;
        const x = isl.cx + Math.cos(ang) * r;
        const z = isl.cz + Math.sin(ang) * r;
        if (nearBlocked(x, z)) continue;
        if (nightCfg.id === 2 || i % 3 === 0) bambooPositions.push([x, isl.y, z, 0.85 + (i % 4) * 0.18, ang]);
        else treePositions.push([x, isl.y, z, 0.85 + (i % 3) * 0.25, ang]);
      }
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + 0.41;
        const r = isl.r - 1.5 - (i % 2) * 1.2;
        const x = isl.cx + Math.cos(ang) * r;
        const z = isl.cz + Math.sin(ang) * r;
        if (nearBlocked(x, z)) continue;
        rockPositions.push([x, isl.y, z, 0.5 + (i % 4) * 0.25, ang]);
      }
    }

    // Phiến đá dẫn lối nhẹ từ tâm đảo ra các Đèn tầng 0
    for (const L of nightCfg.lanterns) {
      if (L.pos[1] !== 0) continue;
      const cx = L.pos[0] > 35 ? 70 : 0;
      const dx = L.pos[0] - cx, dz = L.pos[2];
      const len = Math.hypot(dx, dz);
      for (let d = 5; d < len - 3; d += 3.2) {
        const tx = cx + (dx / len) * d;
        const tz = (dz / len) * d;
        if (nightCfg.tiers.length > 0 && Math.hypot(tx, tz) < 25) continue;
        stoneTiles.push([tx, 0.03, tz, Math.atan2(dx, dz)]);
      }
    }

    const dm = new THREE.Object3D();

    // Cây đảo nhiều tầng tán mềm (InstancedMesh: 3 draw calls tổng cộng!)
    if (treePositions.length > 0) {
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.3, 2.8, 7), trunkMats, treePositions.length);
      const crown1 = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.5, 1), leafMat1, treePositions.length);
      const crown2 = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.1, 1), leafMat2, treePositions.length);
      for (let i = 0; i < treePositions.length; i++) {
        const [x, y, z, s, a] = treePositions[i];
        dm.position.set(x, y + 1.3 * s, z); dm.rotation.set(0, a, 0.05); dm.scale.set(s, s, s); dm.updateMatrix();
        trunks.setMatrixAt(i, dm.matrix);
        dm.position.set(x, y + 3.1 * s, z); dm.scale.set(s * 1.1, s * 0.82, s * 1.1); dm.updateMatrix();
        crown1.setMatrixAt(i, dm.matrix);
        dm.position.set(x + 0.45 * s, y + 4.1 * s, z - 0.3 * s); dm.scale.set(s * 0.9, s * 0.72, s * 0.9); dm.updateMatrix();
        crown2.setMatrixAt(i, dm.matrix);
      }
      trunks.instanceMatrix.needsUpdate = crown1.instanceMatrix.needsUpdate = crown2.instanceMatrix.needsUpdate = true;
      worldGroup.add(trunks, crown1, crown2);
    }

    // Khóm tre Việt Nam (3 thân tre mảnh + chùm lá cao)
    if (bambooPositions.length > 0) {
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0x457b5b, roughness: 0.75 });
      const stalks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 4.6, 6), stalkMat, bambooPositions.length * 3);
      const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.95, 1.5, 6), leafMat2, bambooPositions.length * 2);
      let si = 0, ti = 0;
      for (let i = 0; i < bambooPositions.length; i++) {
        const [x, y, z, s, a] = bambooPositions[i];
        for (let k = 0; k < 3; k++) {
          const ox = Math.cos(a + k * 2.1) * 0.35;
          const oz = Math.sin(a + k * 2.1) * 0.35;
          dm.position.set(x + ox, y + 2.2 * s, z + oz);
          dm.rotation.set((k - 1) * 0.07, a, (k === 2 ? -0.06 : 0.05));
          dm.scale.set(s, s * (0.85 + k * 0.14), s);
          dm.updateMatrix();
          stalks.setMatrixAt(si++, dm.matrix);
        }
        for (let k = 0; k < 2; k++) {
          dm.position.set(x + (k ? 0.3 : -0.2), y + (3.9 + k * 0.8) * s, z);
          dm.rotation.set(0, a + k, 0);
          dm.scale.set(s, s * 0.7, s);
          dm.updateMatrix();
          tufts.setMatrixAt(ti++, dm.matrix);
        }
      }
      stalks.instanceMatrix.needsUpdate = tufts.instanceMatrix.needsUpdate = true;
      worldGroup.add(stalks, tufts);
    }

    // Đá tảng ven bờ đảo
    if (rockPositions.length > 0) {
      const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.85, 0), rockMat, rockPositions.length);
      for (let i = 0; i < rockPositions.length; i++) {
        const [x, y, z, s, a] = rockPositions[i];
        dm.position.set(x, y + 0.25 * s, z);
        dm.rotation.set(a * 0.3, a, a * 0.2);
        dm.scale.set(s * 1.3, s * 0.68, s);
        dm.updateMatrix();
        rocks.setMatrixAt(i, dm.matrix);
      }
      rocks.instanceMatrix.needsUpdate = true;
      worldGroup.add(rocks);
    }

    // Phiến đá lối mòn
    if (stoneTiles.length > 0) {
      const tiles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.72, 0.78, 0.07, 7),
        new THREE.MeshStandardMaterial({ map: textures.sandStone, roughness: 0.92 }),
        stoneTiles.length,
      );
      for (let i = 0; i < stoneTiles.length; i++) {
        const [x, y, z, a] = stoneTiles[i];
        dm.position.set(x, y, z);
        dm.rotation.set(0, a + i * 0.5, 0);
        dm.scale.set(1.1, 1, 0.85);
        dm.updateMatrix();
        tiles.setMatrixAt(i, dm.matrix);
      }
      tiles.instanceMatrix.needsUpdate = true;
      worldGroup.add(tiles);
    }
  }

  return { textures, geos, makeContactShadow, buildPlayer, buildLantern, buildShade, buildShadeInstanced, buildDrifter, buildCharm, addScenery };
}
