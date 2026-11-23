// ジオメトリビルダー：頂点 = pos3 nrm3 col3 uv2 (mat,layer)2 = 13 floats
// mat: 0=通常 1=塗装(uTint) 2=ヘッドランプ 3=窓(夜間発光) 4=テール/ブレーキ 5=非照明 6=空
//      7=路面(濡れ反射) 8=街灯 9=遠景 10/11=ウインカー左/右 12/13/14=信号 青/黄/赤 16=看板
export const STRIDE = 13;

export class GB {
  constructor() { this.a = []; this.xf = null; }
  setXf(x, y, z, yaw = 0) { this.xf = { x, y, z, c: Math.cos(yaw), s: Math.sin(yaw) }; }
  clearXf() { this.xf = null; }
  get count() { return this.a.length / STRIDE; }
  _p(p) {
    const t = this.xf; if (!t) return p;
    return [p[0] * t.c + p[2] * t.s + t.x, p[1] + t.y, -p[0] * t.s + p[2] * t.c + t.z];
  }
  _n(n) { const t = this.xf; if (!t) return n; return [n[0] * t.c + n[2] * t.s, n[1], -n[0] * t.s + n[2] * t.c]; }
  vert(p, n, c, uv, mat, lay) {
    p = this._p(p); n = this._n(n);
    this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], uv[0], uv[1], mat, lay);
  }
  // 三角形。hint（立体の中心）を与えると法線を外向きに揃える
  tri(p0, p1, p2, o, uv0 = [0, 0], uv1 = [0, 0], uv2 = [0, 0], hint = null) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (hint) { // 外向きに揃え、巻き順も法線に一致させる（gl_FrontFacing用）
      const cx = (p0[0] + p1[0] + p2[0]) / 3 - hint[0], cy = (p0[1] + p1[1] + p2[1]) / 3 - hint[1], cz = (p0[2] + p1[2] + p2[2]) / 3 - hint[2];
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; const t = p1; p1 = p2; p2 = t; const u = uv1; uv1 = uv2; uv2 = u; }
    }
    const n = [nx, ny, nz], c = o.c || [1, 1, 1], m = o.mat || 0, ly = o.lay ?? 0;
    this.vert(p0, n, c, uv0, m, ly); this.vert(p1, n, c, uv1, m, ly); this.vert(p2, n, c, uv2, m, ly);
  }
  // 四角形 p0..p3（周回順）。法線は n で指定
  quadN(p0, p1, p2, p3, n, o, uvs = [[0, 1], [1, 1], [1, 0], [0, 0]]) {
    const c = o.c || [1, 1, 1], m = o.mat || 0, ly = o.lay ?? 0;
    // 巻き順を法線に合わせる
    const gx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
    const gy = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
    const gz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    if (gx * n[0] + gy * n[1] + gz * n[2] < 0) { [p1, p3] = [p3, p1]; uvs = [uvs[0], uvs[3], uvs[2], uvs[1]]; }
    this.vert(p0, n, c, uvs[0], m, ly); this.vert(p1, n, c, uvs[1], m, ly); this.vert(p2, n, c, uvs[2], m, ly);
    this.vert(p0, n, c, uvs[0], m, ly); this.vert(p2, n, c, uvs[2], m, ly); this.vert(p3, n, c, uvs[3], m, ly);
  }
  // 水平面（地面・道路・標示）
  flat(x0, z0, x1, z1, y, o, tw = 0) {
    const uv = tw ? [[x0 / tw, z0 / tw], [x1 / tw, z0 / tw], [x1 / tw, z1 / tw], [x0 / tw, z1 / tw]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.quadN([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], o, uv);
  }
  // 箱：o.side = {lay, tw, th}、o.top = {lay, tw}
  box(x0, y0, z0, x1, y1, z1, o) {
    const s = o.side, t = o.top;
    const so = s ? { ...o, lay: s.lay } : o, to = t ? { ...o, lay: t.lay } : o;
    const tw = s ? s.tw : 0, th = s ? s.th : 0, uo = s && s.uo || 0;
    const wall = (a, b, n, len) => {
      const uv = tw ? [[uo, (y1 - y0) / th], [uo + len / tw, (y1 - y0) / th], [uo + len / tw, 0], [uo, 0]] : [[0, 1], [1, 1], [1, 0], [0, 0]];
      this.quadN([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, so, uv);
    };
    if (!o.noSide) {
      wall([x0, z1], [x1, z1], [0, 0, 1], x1 - x0);
      wall([x1, z0], [x0, z0], [0, 0, -1], x1 - x0);
      wall([x1, z1], [x1, z0], [1, 0, 0], z1 - z0);
      wall([x0, z0], [x0, z1], [-1, 0, 0], z1 - z0);
    }
    if (!o.noTop) {
      const w = t && t.tw ? t.tw : 0;
      const uv = w ? [[x0 / w, z1 / w], [x1 / w, z1 / w], [x1 / w, z0 / w], [x0 / w, z0 / w]] : [[0, 1], [1, 1], [1, 0], [0, 0]];
      this.quadN([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], to, uv);
    }
    if (o.bottom) this.quadN([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], o);
  }
  // 中心・寸法指定の箱
  cbox(cx, cy, cz, sx, sy, sz, o) { this.box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, { ...o, bottom: o.bottom ?? true }); }
  // 切妻屋根（棟は長辺方向）
  gable(x0, z0, x1, z1, yb, rise, o, ov = 0.4) {
    x0 -= ov; z0 -= ov; x1 += ov; z1 += ov;
    const yt = yb + rise, h = [(x0 + x1) / 2, yb + rise / 3, (z0 + z1) / 2];
    const tw = o.tw || 2;
    if (x1 - x0 >= z1 - z0) {
      const zm = (z0 + z1) / 2, d = (z1 - z0) / 2;
      const L = (x1 - x0) / tw, D = Math.hypot(d, rise) / tw;
      this._q4([x0, yb, z1], [x1, yb, z1], [x1, yt, zm], [x0, yt, zm], o, h, [[0, D], [L, D], [L, 0], [0, 0]]);
      this._q4([x1, yb, z0], [x0, yb, z0], [x0, yt, zm], [x1, yt, zm], o, h, [[0, D], [L, D], [L, 0], [0, 0]]);
      const g = { ...o, lay: o.glay ?? 0, c: o.gc || o.c };
      this.tri([x0 + ov, yb, z0 + ov], [x0 + ov, yb, z1 - ov], [x0 + ov, yt, zm], g, [0, 0], [0, 0], [0, 0], h);
      this.tri([x1 - ov, yb, z0 + ov], [x1 - ov, yb, z1 - ov], [x1 - ov, yt, zm], g, [0, 0], [0, 0], [0, 0], h);
    } else {
      const xm = (x0 + x1) / 2, d = (x1 - x0) / 2;
      const L = (z1 - z0) / tw, D = Math.hypot(d, rise) / tw;
      this._q4([x0, yb, z0], [x0, yb, z1], [xm, yt, z1], [xm, yt, z0], o, h, [[0, D], [L, D], [L, 0], [0, 0]]);
      this._q4([x1, yb, z1], [x1, yb, z0], [xm, yt, z0], [xm, yt, z1], o, h, [[0, D], [L, D], [L, 0], [0, 0]]);
      const g = { ...o, lay: o.glay ?? 0, c: o.gc || o.c };
      this.tri([x0 + ov, yb, z0 + ov], [x1 - ov, yb, z0 + ov], [xm, yt, z0 + ov], g, [0, 0], [0, 0], [0, 0], h);
      this.tri([x0 + ov, yb, z1 - ov], [x1 - ov, yb, z1 - ov], [xm, yt, z1 - ov], g, [0, 0], [0, 0], [0, 0], h);
    }
  }
  _q4(a, b, c, d, o, hint, uv) { this.tri(a, b, c, o, uv[0], uv[1], uv[2], hint); this.tri(a, c, d, o, uv[0], uv[2], uv[3], hint); }
  // 縦の円柱
  cyl(cx, y0, cz, r, h, seg, o, top = true) {
    const hint = [cx, y0 + h / 2, cz];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const p2 = [p1[0], y0 + h, p1[2]], p3 = [p0[0], y0 + h, p0[2]];
      this._q4(p0, p1, p2, p3, o, hint, [[0, 1], [1, 1], [1, 0], [0, 0]]);
      if (top) this.tri(p3, p2, [cx, y0 + h, cz], o, [0, 0], [0, 0], [0, 0], [cx, y0, cz]);
    }
  }
  // X軸方向の円柱（タイヤ）
  cylX(cx, cy, cz, r, w, seg, o, caps = true, capO = null) {
    const hint = [cx, cy, cz], x0 = cx - w / 2, x1 = cx + w / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const y0 = cy + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, y1 = cy + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      this._q4([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], o, hint, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      if (caps) {
        const co = capO || o;
        this.tri([x1, y0, z0], [x1, y1, z1], [x1, cy, cz], co, [0, 0], [0, 0], [0, 0], [cx - 1, cy, cz]);
        this.tri([x0, y0, z0], [x0, y1, z1], [x0, cy, cz], co, [0, 0], [0, 0], [0, 0], [cx + 1, cy, cz]);
      }
    }
  }
  // 側面プロファイル(z,y)の凸多角形をX方向に押し出し。hw(y)で半幅を変える
  loft(prof, hw, o, opt = {}) {
    const n = prof.length; let mz = 0, my = 0;
    for (const p of prof) { mz += p[0]; my += p[1]; }
    const hint = [0, my / n, mz / n];
    const P = s => prof.map(p => [s * hw(p[1]), p[1], p[0]]);
    const L = P(1), R = P(-1);
    if (!opt.noSides) for (let i = 1; i < n - 1; i++) {
      this.tri(L[0], L[i], L[i + 1], opt.sideO || o, [0, 0], [0, 0], [0, 0], hint);
      this.tri(R[0], R[i], R[i + 1], opt.sideO || o, [0, 0], [0, 0], [0, 0], hint);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const so = opt.stripO ? opt.stripO(i) : o;
      if (!so) continue;
      this._q4(L[i], L[j], R[j], R[i], so, hint, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  // 2点間の角柱（ピラー等）
  beam(p0, p1, t, o) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    let ax = 1, ay = 0, az = 0; // 補助ベクトル
    if (Math.abs(dx) > Math.abs(dy) + Math.abs(dz)) { ax = 0; ay = 1; }
    let ux = dy * az - dz * ay, uy = dz * ax - dx * az, uz = dx * ay - dy * ax;
    let l = Math.hypot(ux, uy, uz) || 1; ux *= t / l; uy *= t / l; uz *= t / l;
    let vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    l = Math.hypot(vx, vy, vz) || 1; vx *= t / l; vy *= t / l; vz *= t / l;
    const c = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
    const corner = (p, a, b) => [p[0] + a * ux + b * vx, p[1] + a * uy + b * vy, p[2] + a * uz + b * vz];
    const cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let i = 0; i < 4; i++) {
      const A = cs[i], B = cs[(i + 1) % 4];
      this._q4(corner(p0, A[0], A[1]), corner(p0, B[0], B[1]), corner(p1, B[0], B[1]), corner(p1, A[0], A[1]), o, c, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  // 縦の看板・壁面パネル（a→b方向、法線は外向き n）
  panel(ax, az, bx, bz, y0, y1, off, n, o, uv = [[0, 1], [1, 1], [1, 0], [0, 0]]) {
    const ox = n[0] * off, oz = n[2] * off;
    this.quadN([ax + ox, y0, az + oz], [bx + ox, y0, bz + oz], [bx + ox, y1, bz + oz], [ax + ox, y1, az + oz], n, o, uv);
  }
  line(p0, p1, c) { // LINES用
    const n = [0, 1, 0];
    this.vert(p0, n, c, [0, 0], 5, 0); this.vert(p1, n, c, [0, 0], 5, 0);
  }
  build() { return new Float32Array(this.a); }
}

export const hex = h => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
export const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
