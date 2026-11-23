// 行列・ベクトル演算（列優先 / column-major）
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export const M4 = {
  ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b, out = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return out;
  },
  // R = Ry(yaw) * Rx(pitch) * Rz(roll), then translate
  trs(x, y, z, yaw = 0, pitch = 0, roll = 0, out = new Float32Array(16)) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // Ry*Rx
    const a = [cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp]; // row-major 3x3
    // (Ry*Rx)*Rz
    const m = [
      a[0] * cr + a[1] * sr, -a[0] * sr + a[1] * cr, a[2],
      a[3] * cr + a[4] * sr, -a[3] * sr + a[4] * cr, a[5],
      a[6] * cr + a[7] * sr, -a[6] * sr + a[7] * cr, a[8]];
    out[0] = m[0]; out[1] = m[3]; out[2] = m[6]; out[3] = 0;
    out[4] = m[1]; out[5] = m[4]; out[6] = m[7]; out[7] = 0;
    out[8] = m[2]; out[9] = m[5]; out[10] = m[8]; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
    return out;
  },
  apply(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
  frustum(m) {
    const p = [];
    const row = i => [m[i], m[4 + i], m[8 + i], m[12 + i]];
    const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
    for (const [r, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]]) {
      const q = [r3[0] + s * r[0], r3[1] + s * r[1], r3[2] + s * r[2], r3[3] + s * r[3]];
      const l = Math.hypot(q[0], q[1], q[2]); p.push([q[0] / l, q[1] / l, q[2] / l, q[3] / l]);
    }
    return p;
  },
  sphereIn(planes, x, y, z, r) {
    for (const p of planes) if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
    return true;
  }
};

// 2次ベジェ
export function bez(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
