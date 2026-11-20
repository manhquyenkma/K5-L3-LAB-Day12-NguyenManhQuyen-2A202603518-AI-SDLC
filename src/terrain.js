// Truy vấn địa hình thuần, nhanh O(1), không cấp phát rác cho 3 Đêm (TICKET-02 Phần 2).
const STEP_UP = 0.38; // đủ lớn cho bước lên dốc 1 tick (0.05 m), nhỏ hơn vách tầng (3 m)
const DEG2RAD = Math.PI / 180;

function rampHeight(ramp, x, z) {
  const rad = ramp.deg * DEG2RAD;
  const ux = Math.cos(rad);
  const uz = Math.sin(rad);
  const projR = x * ux + z * uz;
  if (projR < ramp.rTop - 0.15 || projR > ramp.rFoot + 0.15) return null;
  const projT = -x * uz + z * ux;
  if (Math.abs(projT) > ramp.width * 0.5) return null;
  const t = Math.max(0, Math.min(1, (ramp.rFoot - projR) / (ramp.rFoot - ramp.rTop)));
  return ramp.yFoot + t * (ramp.yTop - ramp.yFoot);
}

// Trả về độ cao mặt đỡ cao nhất <= currentY + STEP_UP, hoặc null nếu ngoài đảo (rơi).
export function getSupportHeight(nightCfg, x, z, currentY) {
  let best = null;
  const limit = currentY + STEP_UP;

  // 1. Đĩa đảo tầng 0
  const islands = nightCfg.islands;
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i];
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    if (dx * dx + dz * dz <= isl.r * isl.r && isl.y <= limit) {
      if (best === null || isl.y > best) best = isl.y;
    }
  }

  // 2. Cầu tre (Đêm 2)
  const b = nightCfg.bridge;
  if (b && x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax && b.y <= limit) {
    if (best === null || b.y > best) best = b.y;
  }

  // 3. Các tầng cao (Đêm 3)
  const tiers = nightCfg.tiers;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.y > limit) continue;
    const r2 = x * x + z * z;
    if (t.kind === 'disk') {
      if (r2 <= t.rMax * t.rMax && (best === null || t.y > best)) best = t.y;
    } else if (t.kind === 'halfRing') {
      if ((!t.zPositiveOnly || z > 0) && r2 >= t.rMin * t.rMin && r2 <= t.rMax * t.rMax) {
        if (best === null || t.y > best) best = t.y;
      }
    }
  }

  // 4. Dốc thẳng (Đêm 3)
  const ramps = nightCfg.ramps;
  for (let i = 0; i < ramps.length; i++) {
    const ry = rampHeight(ramps[i], x, z);
    if (ry !== null && ry <= limit && (best === null || ry > best)) best = ry;
  }

  return best;
}

// Giải quyết va chạm vách đứng tầng cao & tháp chuông trên mặt phẳng XZ ở độ cao y.
// Ghi kết quả vào out = { x, z, blocked } để tránh cấp phát rác trong vòng lặp nóng.
export function resolveHorizontalMove(nightCfg, oldX, oldZ, newX, newZ, y, out) {
  let x = newX;
  let z = newZ;
  let blocked = false;
  const eps = 1e-4;

  // 1. Tháp chuông (hình trụ không leo được)
  const tw = nightCfg.tower;
  if (tw && y < tw.yBase + tw.height) {
    const dx = x - tw.cx;
    const dz = z - tw.cz;
    const d2 = dx * dx + dz * dz;
    const minR = tw.r;
    if (d2 < minR * minR) {
      const d = Math.sqrt(d2);
      if (d < 1e-9) {
        x = tw.cx + minR + eps;
        z = tw.cz;
      } else {
        const k = (minR + eps) / d;
        x = tw.cx + dx * k;
        z = tw.cz + dz * k;
      }
      blocked = true;
    }
  }

  // 2. Vách đứng các tầng cao (chỉ chặn khi y thấp hơn mặt tầng - STEP_UP)
  const tiers = nightCfg.tiers;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (y >= t.y - STEP_UP) continue;
    const r2 = x * x + z * z;
    if (t.kind === 'disk') {
      if (r2 < t.rMax * t.rMax) {
        const d = Math.sqrt(r2);
        if (d < 1e-9) {
          x = t.rMax + eps;
          z = 0;
        } else {
          const k = (t.rMax + eps) / d;
          x *= k;
          z *= k;
        }
        blocked = true;
      }
    } else if (t.kind === 'halfRing') {
      if ((!t.zPositiveOnly || z > 0) && r2 > t.rMin * t.rMin && r2 < t.rMax * t.rMax) {
        const oldR = Math.hypot(oldX, oldZ);
        if (t.zPositiveOnly && oldZ <= 0) {
          z = -eps;
        } else if (oldR >= t.rMax - 0.05) {
          const d = Math.sqrt(r2) || 1;
          const k = (t.rMax + eps) / d;
          x *= k;
          z *= k;
        } else if (oldR <= t.rMin + 0.05) {
          const d = Math.sqrt(r2) || 1;
          const k = (t.rMin - eps) / d;
          x *= k;
          z *= k;
        } else {
          // Trường hợp biên: đẩy về biên gần nhất
          const d = Math.sqrt(r2) || 1;
          const dOut = t.rMax - d;
          const dIn = d - t.rMin;
          const dZ = t.zPositiveOnly ? z : Infinity;
          if (dZ <= dOut && dZ <= dIn) {
            z = -eps;
          } else if (dOut <= dIn) {
            const k = (t.rMax + eps) / d;
            x *= k;
            z *= k;
          } else {
            const k = (t.rMin - eps) / d;
            x *= k;
            z *= k;
          }
        }
        blocked = true;
      }
    }
  }

  out.x = x;
  out.z = z;
  out.blocked = blocked;
  return out;
}

// Giữ Bóng Mực trên mặt đi được (không rơi khỏi đảo/tầng, trượt dọc vật cản).
export function moveOnWalkable(nightCfg, oldX, oldZ, newX, newZ, groundY, out) {
  resolveHorizontalMove(nightCfg, oldX, oldZ, newX, newZ, groundY, out);
  const h = getSupportHeight(nightCfg, out.x, out.z, groundY);
  if (h !== null && Math.abs(h - groundY) <= 0.5) {
    out.y = h;
    return out;
  }
  // Thử trượt theo từng trục X / Z
  const tryX = { x: 0, z: 0, blocked: false };
  resolveHorizontalMove(nightCfg, oldX, oldZ, newX, oldZ, groundY, tryX);
  const hx = getSupportHeight(nightCfg, tryX.x, tryX.z, groundY);
  if (hx !== null && Math.abs(hx - groundY) <= 0.5) {
    out.x = tryX.x;
    out.z = tryX.z;
    out.y = hx;
    out.blocked = true;
    return out;
  }
  const tryZ = { x: 0, z: 0, blocked: false };
  resolveHorizontalMove(nightCfg, oldX, oldZ, oldX, newZ, groundY, tryZ);
  const hz = getSupportHeight(nightCfg, tryZ.x, tryZ.z, groundY);
  if (hz !== null && Math.abs(hz - groundY) <= 0.5) {
    out.x = tryZ.x;
    out.z = tryZ.z;
    out.y = hz;
    out.blocked = true;
    return out;
  }
  out.x = oldX;
  out.z = oldZ;
  out.y = groundY;
  out.blocked = true;
  return out;
}

export function checkJumpPad(nightCfg, x, y, z) {
  const pads = nightCfg.jumpPads;
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (Math.abs(y - pad.pos[1]) > 0.6) continue;
    const dx = x - pad.pos[0];
    const dz = z - pad.pos[2];
    if (dx * dx + dz * dz <= pad.r * pad.r) return pad;
  }
  return null;
}
