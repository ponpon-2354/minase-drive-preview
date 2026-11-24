// v0.4 追加：田園の作り直し（区画・畦・用水路・ため池・果樹園・茶畑・ビニールハウス・無人販売所・農道・軽トラ巡回）、
// 桜並木、墓地、工事現場、建築中・解体中の家、公園の小物、電話ボックス・案内図・掲示板・駐輪場、雑草・落ち葉、水たまり、
// 歩行者用信号、建物の影・遠景シルエット用データ
import { L } from './textures.js?v=0.9.0';
import { rng, clamp } from './math.js?v=0.9.0';
import { MODELS, pickModel, pickColor } from './carmodels.js?v=0.9.0';

const GRASS = { c: [0.5, 0.62, 0.36], lay: 0 };
export function cherry(gb, x, z, R, s = 1) { // 桜（春の花の色）
  s *= 0.9 + R() * 0.4;
  gb.cyl(x, 0, z, 0.18 * s, 2.4 * s, 5, { c: [0.35, 0.26, 0.22] }, false);
  const c = [0.98, 0.78 + R() * 0.08, 0.86];
  for (const [dx, dy, dz, r] of [[0, 3.6, 0, 2.6], [1.3, 3.1, 0.6, 1.7], [-1.2, 3.2, -0.5, 1.8], [0.2, 4.4, -0.9, 1.5]]) gb.cbox(x + dx * s, dy * s, z + dz * s, r * 2 * s, r * 1.3 * s, r * 2 * s, { c });
}
function roundTree(gb, x, z, s, c) { gb.cyl(x, 0, z, 0.08 * s, 1.0 * s, 4, { c: [0.4, 0.3, 0.2] }, false); gb.cbox(x, 1.6 * s, z, 2.0 * s, 1.5 * s, 2.0 * s, { c, lay: L.TREE }); }
function vinyl(gb, x0, z0, x1, z1) { // ビニールハウス（かまぼこ型）
  const ns = (z1 - z0) > (x1 - x0), w = ns ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = w / 2, o = { c: [0.88, 0.92, 0.93] };
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * Math.PI, a1 = (k + 1) / 8 * Math.PI, u0 = -Math.cos(a0) * r, u1 = -Math.cos(a1) * r, y0 = Math.sin(a0) * r * 0.85, y1 = Math.sin(a1) * r * 0.85;
    const n = [-Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
    if (ns) gb.quadN([cx + u0, y0, z0], [cx + u1, y1, z0], [cx + u1, y1, z1], [cx + u0, y0, z1], n, o);
    else gb.quadN([x0, y0, cz + u0], [x0, y1, cz + u1], [x1, y1, cz + u1], [x1, y0, cz + u0], [0, n[1], n[0]], o);
    for (const e of ns ? [z0, z1] : [x0, x1]) gb.tri(ns ? [cx, 0, e] : [e, 0, cz], ns ? [cx + u0, y0, e] : [e, y0, cz + u0], ns ? [cx + u1, y1, e] : [e, y1, cz + u1], { c: [0.8, 0.85, 0.86] }, [0, 0], [0, 0], [0, 0], ns ? [cx, r * 0.4, cz] : [cx, r * 0.4, cz]);
  }
}
function tractor(gb, x, z, yaw) {
  gb.setXf(x, 0, z, yaw);
  gb.box(-0.55, 0.6, -0.9, 0.55, 1.3, 0.9, { c: [0.85, 0.35, 0.1] });
  gb.box(-0.45, 1.3, -0.6, 0.45, 2.2, 0.2, { c: [0.25, 0.3, 0.32] });
  for (const s of [-1, 1]) { gb.cylX(s * 0.75, 0.62, -0.55, 0.62, 0.38, 10, { c: [0.12, 0.12, 0.12] }); gb.cylX(s * 0.68, 0.38, 0.75, 0.38, 0.25, 8, { c: [0.12, 0.12, 0.12] }); }
  gb.clearXf();
}

// ============ 田園（v0.4） ============
export function farmV4(city, r, R, opt = {}) {
  const W = r.x1 - r.x0, D = r.z1 - r.z0; if (W < 40 || D < 40) return;
  const st = city.stats, F = city.farmStats = city.farmStats || { fields: 0, water: 0, vinyl: 0, stands: 0, ponds: 0, orchard: 0, tea: 0, loops: 0 };
  city.mm.green.push(r);
  // 農家の集落（屋敷林つき）
  // 農道（砂利・幅4m）
  const xs = [r.x0], zs = [r.z0];
  for (let x = r.x0 + 110 + R() * 40; x < r.x1 - 60; x += 110 + R() * 40) xs.push(x);
  for (let z = r.z0 + 110 + R() * 40; z < r.z1 - 60; z += 110 + R() * 40) zs.push(z);
  xs.push(r.x1); zs.push(r.z1);
  // 農家の集落は農道・用水路と重ならない区画の内側に置く
  let hx = null, hz = null;
  { const cand = []; for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) if (xs[i + 1] - xs[i] > 72 && zs[j + 1] - zs[j] > 60) cand.push([i, j]);
    if (cand.length) { const [i, j] = cand[R() * cand.length | 0]; hx = xs[i] + 8 + R() * Math.max(0, xs[i + 1] - xs[i] - 72); hz = zs[j] + 6 + R() * Math.max(0, zs[j + 1] - zs[j] - 60); } }
  const hr = hx == null ? { x0: 1e9, x1: 1e9, z0: 1e9, z1: 1e9 } : { x0: hx - 4, x1: hx + 58, z0: hz - 4, z1: hz + 48 };
  const gravel = { c: [0.78, 0.74, 0.64], lay: L.FIELD };
  for (const x of xs.slice(1, -1)) { city.mm.lanes.push({ axis: 'ns', c: x, a: r.z0, b: r.z1, w: 2, kind: 'farm' }); city.add(x, (r.z0 + r.z1) / 2, g => { g.d1.flat(x - 2, r.z0, x + 2, r.z1, 0.01, gravel, 4); g.s.box(x + 2.4, -0.6, r.z0, x + 3.6, 0.05, r.z1, { c: [0.62, 0.62, 0.6], noTop: true }); g.d1.flat(x + 2.55, r.z0, x + 3.45, r.z1, -0.35, { c: [0.8, 0.9, 0.95], lay: L.WATER, mat: 21 }, 6); }); city.addBox(x + 2.4, r.z0, x + 3.6, r.z1, 'w', -50, 0.05); }
  for (const z of zs.slice(1, -1)) { city.mm.lanes.push({ axis: 'ew', c: z, a: r.x0, b: r.x1, w: 2, kind: 'farm' }); city.add((r.x0 + r.x1) / 2, z, g => g.d1.flat(r.x0, z - 2, r.x1, z + 2, 0.012, gravel, 4)); }
  // 区画（25〜60m）
  const fields = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const bx0 = xs[i] + (i ? 4 : 1), bx1 = xs[i + 1] - (i + 1 < xs.length - 1 ? 2.5 : 1), bz0 = zs[j] + (j ? 2.5 : 1), bz1 = zs[j + 1] - (j + 1 < zs.length - 1 ? 2.5 : 1);
    for (let x = bx0; x < bx1 - 20; ) { const w = Math.min(bx1 - x, 25 + R() * 35); for (let z = bz0; z < bz1 - 20; ) { const d = Math.min(bz1 - z, 25 + R() * 35); fields.push({ x0: x, z0: z, x1: x + w, z1: z + d }); z += d; } x += w; }
  }
  const kinds = []; let vinylN = 0, standN = 0;
  for (const f of fields) {
    if (f.x1 > hr.x0 && f.x0 < hr.x1 && f.z1 > hr.z0 && f.z0 < hr.z1) continue;
    const k = R(), kind = opt.terrace ? 'green' : k < 0.3 ? 'water' : k < 0.6 ? 'green' : k < 0.72 ? 'harvest' : k < 0.82 ? 'crop' : k < 0.87 ? 'tea' : k < 0.92 ? 'orchard' : k < 0.96 && vinylN < 3 ? 'vinyl' : k < 0.98 ? 'pond' : 'crop';
    if (kind === 'vinyl') vinylN++;
    kinds.push([f, kind]); F.fields++; if (kind === 'water') F.water++;
  }
  // 田園ワープの近く（出現地点から1分以内）には茶畑・果樹園・ビニールハウスを必ず置く
  const WP = [-998, 1300], dR = (q) => Math.hypot(Math.max(q.x0 - WP[0], 0, WP[0] - q.x1), Math.max(q.z0 - WP[1], 0, WP[1] - q.z1));
  const near = dR(r) < 80;
  if (near) { const order = kinds.map((k, i) => [i, Math.hypot((k[0].x0 + k[0].x1) / 2 - WP[0], (k[0].z0 + k[0].z1) / 2 - WP[1])]).sort((a, b) => a[1] - b[1]); ['tea', 'orchard', 'vinyl', 'water'].forEach((kd, j) => { if (order[j]) kinds[order[j][0]][1] = kd; }); F.showcase = (F.showcase || 0) + 1; }
  // 描画はブロック単位でまとめる
  const groups = new Map();
  for (const it of kinds) { const [f] = it, key = Math.floor((f.x0 + f.x1) / 250) + ',' + Math.floor((f.z0 + f.z1) / 250); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(it); }
  for (const list of groups.values()) {
    const f0 = list[0][0], Rg = rng(Math.abs(f0.x0 * 7 + f0.z0 * 3) | 0);
    city.add((f0.x0 + f0.x1) / 2, (f0.z0 + f0.z1) / 2, g => {
      for (const [f, kind] of list) {
        const v = 0.92 + Rg() * 0.1;
        if (kind === 'pond') { g.s.box(f.x0 + 3, -1.2, f.z0 + 3, f.x1 - 3, 0.1, f.z1 - 3, { c: [0.6, 0.6, 0.58], noTop: true }); g.d1.flat(f.x0 + 3.3, f.z0 + 3.3, f.x1 - 3.3, f.z1 - 3.3, -0.5, { c: [0.75, 0.88, 0.92], lay: L.WATER, mat: 21 }, 8); continue; }
        const lay = kind === 'water' ? L.WATERPAD : kind === 'green' ? L.PADDY : kind === 'harvest' ? L.FIELD : kind === 'crop' || kind === 'vinyl' ? L.CROP : kind === 'tea' ? L.TEAROW : L.GRASS;
        const col = kind === 'water' ? [0.8 * v, 0.82 * v, 0.84 * v] : kind === 'harvest' ? [0.95 * v, 0.82 * v, 0.6 * v] : kind === 'orchard' ? [0.8 * v, 0.95 * v, 0.75 * v] : [v, v, v];
        g.d1.flat(f.x0, f.z0, f.x1, f.z1, kind === 'water' ? 0.0 : 0.01, { c: col, lay }, kind === 'tea' || kind === 'crop' ? 6 : 10);
        if (kind === 'water' || kind === 'green' || kind === 'harvest') { // 畦
          const t = 0.25, h = 0.22, o = { c: [0.55, 0.66, 0.4], lay: L.GRASS };
          g.s.box(f.x0, -0.1, f.z0, f.x1, h, f.z0 + t, o); g.s.box(f.x0, -0.1, f.z1 - t, f.x1, h, f.z1, o); g.s.box(f.x0, -0.1, f.z0, f.x0 + t, h, f.z1, o); g.s.box(f.x1 - t, -0.1, f.z0, f.x1, h, f.z1, o);
        }
        if (kind === 'tea') for (let z = f.z0 + 1.2; z < f.z1 - 1; z += 1.8) g.s.box(f.x0 + 1, 0, z, f.x1 - 1, 0.8, z + 1.0, { c: [0.35, 0.55, 0.3], lay: L.TREE });
        if (kind === 'orchard') for (let x = f.x0 + 3; x < f.x1 - 2; x += 5) for (let z = f.z0 + 3; z < f.z1 - 2; z += 5) roundTree(g.det, x, z, 1.1, [0.55, 0.75, 0.42]);
        if (kind === 'vinyl') for (let x = f.x0 + 2; x + 6 < f.x1 - 1; x += 7.5) vinyl(g.s, x, f.z0 + 2, x + 6, f.z1 - 2);
      }
    });
    for (const [f, kind] of list) {
      if (kind === 'vinyl') { F.vinyl += Math.floor((f.x1 - f.x0 - 3) / 7.5); for (let x = f.x0 + 2; x + 6 < f.x1 - 1; x += 7.5) city.addBox(x, f.z0 + 2, x + 6, f.z1 - 2); }
      if (kind === 'pond') { F.ponds++; city.addBox(f.x0 + 3, f.z0 + 3, f.x1 - 3, f.z1 - 3, 'w', -50, 0.1); }
      if (kind === 'tea') F.tea++; if (kind === 'orchard') F.orchard++;
    }
  }
  // 無人販売所（農道沿い）・トラクター
  for (const x of xs.slice(1, -1)) {
    if (standN < 1 + (R() < 0.5 ? 1 : 0)) { let z = r.z0 + 30 + R() * (D - 60); if (zs.some(q => Math.abs(q - z) < 8)) z += 16; const sx = x - 3.3; standN++; F.stands++; city.addBox(sx - 0.6, z - 1, sx + 0.6, z + 1, 'p');
      city.add(sx, z, g => { g.s.box(sx - 0.5, 0, z - 0.9, sx + 0.5, 1.0, z + 0.9, { c: [0.6, 0.45, 0.3] }); for (const dz of [-0.85, 0.85]) g.s.cyl(sx - 0.45, 0, z + dz, 0.05, 2.0, 4, { c: [0.5, 0.38, 0.25] }); g.s.box(sx - 0.7, 2.0, z - 1.1, sx + 0.7, 2.1, z + 1.1, { c: [0.35, 0.45, 0.5] }); for (let k = 0; k < 3; k++) g.s.cbox(sx, 1.1, z - 0.6 + k * 0.6, 0.35, 0.2, 0.35, { c: [[0.85, 0.3, 0.2], [0.4, 0.7, 0.3], [0.9, 0.7, 0.2]][k] }); g.s.panel(sx + 0.52, z - 0.8, sx + 0.52, z + 0.8, 1.4, 1.8, 0.01, [1, 0, 0], { c: [1, 1, 1], mat: 16, lay: L.SG_MUJIN }); }); }
    const offRoad = z => !zs.some(q => Math.abs(q - z) < 8); // 横の農道の交差部には置かない
    if (R() < 0.6) { let z = r.z0 + 20 + R() * (D - 40); if (!offRoad(z)) z += 16; const tx = x + 6; city.addBox(tx - 1, z - 1.2, tx + 1, z + 1.2, 'p'); city.add(tx, z, g => tractor(g.det, tx, z, R() * 6)); }
  }
  // 農家
  const Rh = rng(R() * 1e6 | 0), kt = MODELS.find(m => m.name === 'ハイゼットトラック');
  if (hx != null) {
  for (let k = 0; k < 2; k++) {
    const x = hx + 4 + k * 24, z = hz + 8, w = 12 + Rh() * 3, d = 9 + Rh() * 2, wc = [[0.9, 0.86, 0.78], [0.82, 0.78, 0.7], [0.75, 0.72, 0.66]][Rh() * 3 | 0], rc = [[0.3, 0.32, 0.36], [0.45, 0.25, 0.2], [0.25, 0.3, 0.4]][Rh() * 3 | 0];
    city.addBox(x, z, x + w, z + d); city.stats.houses++; city.mm.blds.push({ x0: x, x1: x + w, z0: z, z1: z + d, h: 8 });
    city.add(x, z, g => { g.s.box(x, 0, z, x + w, 5.6, z + d, { c: wc, mat: 3, side: { lay: L.HOUSE, tw: 7, th: 5.6 } }); g.s.gable(x, z, x + w, z + d, 5.6, 2.8, { c: rc, lay: L.KAWARA, tw: 2, gc: wc }, 0.6); });
  }
  const sx = hx + 10, sz = hz + 26;
  city.addBox(sx, sz, sx + 12, sz + 8); city.addCarBox(hx + 30, hz + 31, Math.PI / 2, kt);
  city.add(sx, sz, g => {
    g.s.box(sx, 0, sz, sx + 12, 4.5, sz + 8, { c: [0.7, 0.72, 0.74], side: { lay: L.METAL, tw: 6, th: 4.5 } });
    g.s.gable(sx, sz, sx + 12, sz + 8, 4.5, 1.6, { c: [0.55, 0.3, 0.25], lay: L.METAL, tw: 3 }, 0.3);
    city.bakeCar(g.det, kt, { rgb: [0.95, 0.95, 0.95] }, hx + 30, hz + 31, Math.PI / 2);
    for (let t = 0; t < 12; t++) { const a = t / 12 * Math.PI * 2; city.tree(g.det, hx + 25 + Math.cos(a) * 28, hz + 20 + Math.sin(a) * 22, Rh); }
  });
  }
  // 軽トラックが農道を巡回（周回ルート）
  if (near && xs.length > 2) { const fz = kinds.length ? kinds.map(k => k[0]).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - WP[0], (a.z0 + a.z1) / 2 - WP[1]) - Math.hypot((b.x0 + b.x1) / 2 - WP[0], (b.z0 + b.z1) / 2 - WP[1]))[0] : null; if (fz) { const tx = WP[0] < fz.x0 ? fz.x0 + 5 : fz.x1 - 5, tz = clamp(WP[1], fz.z0 + 4, fz.z1 - 4); city.addBox(tx - 1, tz - 1.2, tx + 1, tz + 1.2, 'p'); city.add(tx, tz, g => tractor(g.det, tx, tz, 1.2)); F.tractorNearWarp = [tx, tz]; } }
  if (xs.length > 2 && zs.length > 2 && F.loops < 6 && (near || R() < 0.7)) {
    const x0 = xs[1] - 1, x1 = xs[2] ? Math.min(xs[2], r.x1 - 3) - 1 : r.x1 - 4, z0 = zs[1] - 1, z1 = zs[2] ? Math.min(zs[2], r.z1 - 3) - 1 : r.z1 - 4;
    if (x1 - x0 > 40 && z1 - z0 > 40) {
      const pts = [], rr = 4, corner = (cx, cz, a0) => { for (let k = 0; k <= 4; k++) { const a = a0 + k / 4 * Math.PI / 2; pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } };
      corner(x0 + rr, z0 + rr, Math.PI); corner(x1 - rr, z0 + rr, -Math.PI / 2); corner(x1 - rr, z1 - rr, 0); corner(x0 + rr, z1 - rr, Math.PI / 2);
      const dense = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8)); for (let k = 0; k < n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
      city.loops.push({ pts: dense, stops: [0, dense.length >> 1], vt: 6.5, farm: true, cars: [{ m: kt, rgb: [0.95, 0.95, 0.95] }] });
      F.loops++;
    }
  }
}

// ============ 寺と墓地（神社の街区の一角） ============
export function cemetery(city, cx, cz) {
  const st = city.stats; st.cemetery = 1; (city.pois = city.pois || []).push({ t: 'temple', x: cx, z: cz, name: '慈光寺・墓地' });
  city.addBox(cx - 18, cz - 12, cx + 18, cz + 12, 'w', -50, 1.2); city.addBox(cx - 7, cz - 28, cx + 7, cz - 17);
  city.add(cx, cz, g => {
    g.d1.flat(cx - 18, cz - 12, cx + 18, cz + 12, 0.03, { c: [0.8, 0.78, 0.72], lay: L.SIDEWALK }, 2);
    g.s.box(cx - 18, 0, cz - 12.3, cx + 18, 1.2, cz - 12, { c: [0.7, 0.7, 0.68] }); g.s.box(cx - 18, 0, cz + 12, cx + 18, 1.2, cz + 12.3, { c: [0.7, 0.7, 0.68] });
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) { const x = cx - 15 + i * 3.6, z = cz - 9 + j * 3.4, Rs = rng(i * 31 + j), c = 0.45 + Rs() * 0.3; g.s.box(x - 0.6, 0, z - 0.6, x + 0.6, 0.35, z + 0.6, { c: [0.62, 0.62, 0.6] }); g.s.box(x - 0.32, 0.35, z - 0.22, x + 0.32, 1.35 + Rs() * 0.3, z + 0.22, { c: [c, c, c * 1.02] }); }
    g.s.box(cx - 7, 0, cz - 28, cx + 7, 4.2, cz - 17, { c: [0.6, 0.45, 0.3] }); g.s.gable(cx - 7, cz - 28, cx + 7, cz - 17, 4.2, 4.2, { c: [0.28, 0.3, 0.32], lay: L.KAWARA, tw: 2, gc: [0.6, 0.45, 0.3] }, 1.4);
    g.s.panel(cx - 3, cz - 16.9, cx + 3, cz - 16.9, 2.7, 4.0, 0.01, [0, 0, 1], { c: [1, 1, 1], mat: 16, lay: L.SG_TEMPLE });
  });
}
// 農協のカントリーエレベーター（籾の貯蔵施設）と直売所
export function farmCenter(city, x, z) {
  city.stats.riceCenter = 1; (city.pois = city.pois || []).push({ t: 'farm', x, z, name: 'みなせ農協' });
  city.addBox(x - 14, z - 6, x + 14, z + 6); city.addBox(x - 10, z + 14, x + 10, z + 24);
  city.add(x, z, g => {
    for (let k = 0; k < 4; k++) { g.s.cyl(x - 10.5 + k * 7, 0, z, 3.2, 26, 12, { c: [0.85, 0.85, 0.82] }); g.s.cyl(x - 10.5 + k * 7, 26, z, 2.4, 1.2, 12, { c: [0.6, 0.62, 0.64] }); }
    g.s.box(x - 4, 0, z - 6, x + 4, 32, z - 3, { c: [0.8, 0.8, 0.78], side: { lay: L.METAL, tw: 4, th: 8 } });
    g.s.panel(x - 12, z - 6.01, x + 12, z - 6.01, 18, 21, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: L.SG_RICECENTER });
    // 直売所
    g.s.box(x - 10, 0, z + 14, x + 10, 4.2, z + 24, { c: [0.88, 0.82, 0.7], mat: 3, side: { lay: L.SHOP, tw: 6, th: 4.2 } });
    g.s.gable(x - 10, z + 14, x + 10, z + 24, 4.2, 1.6, { c: [0.4, 0.3, 0.25], lay: L.METAL, tw: 3 });
    g.s.panel(x - 7, z + 13.99, x + 7, z + 13.99, 4.4, 6.0, 0.02, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: L.SG_FARMCOOP });
    g.d1.flat(x - 18, z + 4, x + 18, z + 13.5, 0.02, { c: [0.95, 0.95, 0.95], mat: 7, lay: L.ASPHALT }, 8);
    for (let k = 0; k < 4; k++) city.nobori(g.det, x - 9 + k * 6, z + 13, 0);
  });
  city.mm.blds.push({ x0: x - 14, x1: x + 14, z0: z - 6, z1: z + 6, h: 30 }); city.mm.lots.push({ x0: x - 18, x1: x + 18, z0: z + 4, z1: z + 13.5 });
}
// ============ 町の追加の細部 ============
export function townExtras(city) {
  const R = rng(5150), st = city.stats, pois = city.pois = city.pois || [];
  const ok = (x, z, m = 1) => !city.inDrive(x, z, m) && ![...city.query(x, z, m + 1)].some(b => b.kind !== 'x' && x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
  // 河川敷の桜並木（堤防の上）
  let ch = 0;
  for (let x = -1900; x < 1900; x += 14) for (const z of [526.5, 603.5]) {
    if ((city.bridges || []).some(b => Math.abs(b.x - x) < b.hw + 6) || Math.abs(x - 1000) < 20) continue;
    if (!ok(x, z, 0.5)) continue;
    ch++; city.addBox(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'p'); const s = rng(x * 3 + z | 0); city.add(x, z, g => cherry(g.det, x, z, s));
  }
  st.cherry = ch;
  // 工事区間（NPCは徐行）：郊外道路・生活道路から2か所
  let works = 0; city.works = [];
  for (const e of city.edges) {
    if (works >= 2 || !e.straight || e.len < 120 || !['out', 'art'].includes(e.sp.kind) || e.lanes > 1 && e.sp.kind !== 'art' || (e.id * 13) % 7 !== 3) continue;
    const s0 = e.len * 0.4, s1 = s0 + 24, o = e.sp.hw - 0.6; works++;
    e.work = [s0 - 30, s1 + 10]; city.works.push({ e: e.id, s0, s1 });
    const mid = city.edgePt(e, (s0 + s1) / 2, o);
    city.add(mid[0], mid[2], g => {
      for (let s = s0; s <= s1; s += 3) { const p = city.edgePt(e, s, o - 0.2); city.cone(g.det, p[0], p[2]); }
      const a = city.edgePt(e, s0 - 6, o), sgn = city.edgePt(e, s0 - 12, e.sp.hw + 0.4);
      city.signPole(g.det, sgn[0], sgn[2], e.d, L.SG_KOJI, 1.6, 0.4, 1.2, 0);
      g.det.box(a[0] - 0.8, 0, a[2] - 0.8, a[0] + 0.8, 1.0, a[2] + 0.8, { c: [0.95, 0.85, 0.1] });
      const m = MODELS.find(q => q.name === 'ハイゼットトラック'), tp = city.edgePt(e, (s0 + s1) / 2, o - 0.9);
      city.bakeCar(g.det, m, { rgb: [0.95, 0.95, 0.95] }, tp[0], tp[2], Math.atan2(e.d[0], e.d[1]));
      g.d2.quadN(city.edgePt(e, s0 + 2, o - 1.6), city.edgePt(e, s1 - 2, o - 1.6), city.edgePt(e, s1 - 2, o + 0.4), city.edgePt(e, s0 + 2, o + 0.4), [0, 1, 0], { c: [0.7, 0.7, 0.72], mat: 7, lay: L.ASPHALT });
    });
    for (let s = s0; s <= s1; s += 3) { const p = city.edgePt(e, s, o - 0.2); city.addBox(p[0] - 0.2, p[2] - 0.2, p[0] + 0.2, p[2] + 0.2, 'p', -50, 0.7); }
    const tp = city.edgePt(e, (s0 + s1) / 2, o - 0.9); city.addCarBox(tp[0], tp[2], Math.atan2(e.d[0], e.d[1]), MODELS.find(q => q.name === 'ハイゼットトラック'));
  }
  st.works = works;
  // 駅前：電話ボックス、観光案内図、掲示板、駐輪場
  const sx = -20, sz = -395;
  const spot = (x0, z0, w) => { // 近くの歩道で空いている場所を探す
    let best = null, bd = 1e9;
    for (const e of city.edges) { if (!e.straight || e.sp.sw <= 1) continue; for (let s = 4; s < e.len - 4; s += 3) { const p = city.edgePt(e, s, e.sp.hw + e.sp.sw - 0.9), d = Math.hypot(p[0] - x0, p[2] - z0); if (d < bd && d < 120 && ok(p[0], p[2], w)) { bd = d; best = [p[0], p[2]]; } } }
    return best;
  };
  const place = (x, z, w, fn) => { const p = spot(x, z, w); if (!p) return false; fn(p[0], p[1]); return true; };
  st.phone = place(sx, sz, 0.8, (sx, sz) => { city.addBox(sx - 0.5, sz - 0.5, sx + 0.5, sz + 0.5); city.add(sx, sz, g => { g.det.box(sx - 0.45, 0, sz - 0.45, sx + 0.45, 2.2, sz + 0.45, { c: [0.7, 0.9, 0.75], mat: 3, side: { lay: L.SHOP, tw: 1, th: 2.2 } }); g.det.box(sx - 0.5, 2.2, sz - 0.5, sx + 0.5, 2.45, sz + 0.5, { c: [0.15, 0.6, 0.3] }); }); }) ? 1 : 0;
  const boards = [[sx + 4, sz, L.SG_MAPBOARD], [-140, -395, L.POSTER], [120, -140, L.POSTER], [-330, 60, L.POSTER]];
  st.boards = 0;
  for (const [x0b, z0b, lay] of boards) place(x0b, z0b, 1.2, (x, z) => { st.boards++; city.addBox(x - 1, z - 0.15, x + 1, z + 0.15, 'p'); city.add(x, z, g => { for (const dx of [-0.9, 0.9]) g.det.cyl(x + dx, 0, z, 0.05, 2.2, 4, { c: [0.5, 0.5, 0.5] }); g.det.panel(x - 1, z, x + 1, z, 1.0, 2.1, 0.05, [0, 0, 1], { c: [1, 1, 1], mat: lay === L.POSTER ? 0 : 16, lay }); g.det.panel(x + 1, z, x - 1, z, 1.0, 2.1, 0.05, [0, 0, -1], { c: [0.6, 0.6, 0.6] }); }); });
  // 峠の展望所（2つ目の待避所）
  if (city.pullouts && city.pullouts[1] && city.mtn) {
    const pu = city.pullouts[1], f = city.mtn.full, i = pu.i, a = f[i], b = f[Math.min(f.length - 1, i + 1)], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1, n = [d[1] / l, -d[0] / l];
    const o = pu.side * (city.mtn.hw + 3.0), x = a[0] - n[0] * o, z = a[1] - n[1] * o, y = a[2];
    st.viewpoint = 1; pois.push({ t: 'view', x, z, name: '峠の展望所' });
    city.add(x, z, g => { g.det.setXf(x, y, z, Math.atan2(d[0], d[1])); g.det.box(-0.9, 0.4, -0.25, 0.9, 0.48, 0.25, { c: [0.6, 0.42, 0.28] }); g.det.cyl(2, 0, 0, 0.06, 1.2, 6, { c: [0.3, 0.3, 0.3] }); g.det.cbox(2, 1.3, 0, 0.18, 0.18, 0.45, { c: [0.2, 0.25, 0.3] }); g.det.clearXf(); });
  }
  // 駅の駐輪場
  const bx = 30, bz = -408;
  if (ok(bx, bz, 3)) { st.bikePark = 1; city.addBox(bx - 6, bz - 1.2, bx + 6, bz + 1.2, 'p'); city.add(bx, bz, g => { g.det.box(bx - 6, 2.2, bz - 1.4, bx + 6, 2.3, bz + 1.4, { c: [0.4, 0.5, 0.55] }); for (const x of [bx - 5.8, bx + 5.8]) g.det.cyl(x, 0, bz - 1.3, 0.05, 2.2, 4, { c: [0.5, 0.5, 0.5] }); for (let k = 0; k < 18; k++) city.bike(g.det, bx - 5.4 + k * 0.62, bz, 0, k, 0); }); }
  // 公園の小物（ベンチ・トイレ・プランター）は park() 内、雑草と落ち葉
  let weeds = 0;
  for (const e of city.edges) {
    if (e.seg.fwd !== e || !e.straight || (e.sp.kind !== 'minor' && e.sp.kind !== 'out')) continue;
    const Rw = rng(e.id * 17 + 3), mid = city.edgePt(e, e.len / 2, 0), items = [];
    for (let s = 3; s < e.len - 3; s += 4 + Rw() * 8) for (const sg of [1, -1]) if (Rw() < 0.5) items.push([city.edgePt(e, s, sg * (e.sp.hw + 0.15 + Rw() * 0.3)), Rw()]);
    weeds += items.length;
    city.add(mid[0], mid[2], g => { for (const [p, k] of items) { const h = 0.2 + k * 0.35, c = [0.4 + k * 0.15, 0.55 + k * 0.1, 0.25]; g.det.tri([p[0] - 0.25, 0, p[2]], [p[0] + 0.25, 0, p[2]], [p[0], h, p[2] + 0.05], { c }, [0, 0], [0, 0], [0, 0], null); g.det.tri([p[0], 0, p[2] - 0.25], [p[0], 0, p[2] + 0.25], [p[0] + 0.05, h, p[2]], { c }, [0, 0], [0, 0], [0, 0], null); } });
  }
  st.weeds = weeds;
  // 雨の日の水たまり（雨のときだけ見える路面の窪み）
  let pud = 0;
  for (const e of city.edges) {
    if (!e.straight || e.len < 40 || (e.id % 3)) continue;
    const Rp = rng(e.id * 23 + 1), n = 1 + (Rp() * 3 | 0), mid = city.edgePt(e, e.len / 2, 0), list = [];
    for (let k = 0; k < n; k++) { const s = 8 + Rp() * (e.len - 16), o = e.sp.hw - 0.5 - Rp() * 1.2, c = city.edgePt(e, s, o), r1 = 0.7 + Rp() * 1.3, r2 = 0.5 + Rp() * 0.8; list.push([c, r1, r2]); }
    pud += n;
    city.add(mid[0], mid[2], g => { for (const [c, r1, r2] of list) g.pud.flat(c[0] - r1, c[2] - r2, c[0] + r1, c[2] + r2, 0, { c: [0.55, 0.6, 0.66], lay: L.WATERPAD, mat: 22 }); });
  }
  st.puddles = pud;
  // 歩行者用信号（横断歩道の両端。車の信号と同期して青・点滅・赤）
  city.pedHeads = [];
  for (const n of city.nodes) {
    if (n.ctrl !== 'signal') continue;
    for (const eid of n.inn) {
      const e = city.edges[eid]; if (!e.straight) continue;
      const d = e.dEnd, left = [d[1], -d[0]], ext = e.axis === 'ns' ? n.hz : n.hx;
      // この道を渡る横断歩道（停止線の先）の歩道側の端：歩行者は道路と直交方向に渡る → 交差道路の信号と同じ位相
      for (const sg of [1, -1]) { // 横断歩道の両端に1基ずつ（向かい側を向く）
        const px = n.x - d[0] * (ext + 2.5) + sg * left[0] * (e.sp.hw + 0.6), pz = n.z - d[1] * (ext + 2.5) + sg * left[1] * (e.sp.hw + 0.6);
        if (!ok(px, pz, 0.3)) continue;
        city.pedHeads.push({ node: n, axis: e.axis === 'ns' ? 'ew' : 'ns', x: px, z: pz, yaw: Math.atan2(-left[0] * sg, -left[1] * sg) });
        city.addBox(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, 'p');
        city.add(px, pz, g => { g.det.cyl(px, 0, pz, 0.07, 3.0, 6, { c: [0.55, 0.56, 0.55] }); });
      }
    }
  }
  st.pedSignals = city.pedHeads.length;
}

// ============ 建物の影（静的な落ち影）と遠景シルエット ============
// 影は太陽の高い時間を想定して北（-z）側へ短く落とす。遠景シルエットは全建物の箱を低ポリで持ち、読み込み範囲外で描く
export function shadowsAndFar(city) {
  const far = new Map();
  for (const b of city.mm.blds) {
    const h = b.h || 7, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, ch = city.chunkAt(cx, cz); if (!ch) continue;
    const off = Math.min(9, h * 0.35);
    city.add(cx, cz, g => { if (g.sh) g.sh.quadN([b.x0 - 0.3, 0.05, b.z0 - off], [b.x1 + 0.3, 0.05, b.z0 - off], [b.x1 + 0.3, 0.05, b.z1 - 0.5], [b.x0 - 0.3, 0.05, b.z1 - 0.5], [0, 1, 0], { c: [0, 0, 0], mat: 5 }); });
    let gb = far.get(ch); if (!gb) far.set(ch, gb = []); gb.push([b.x0, b.z0, b.x1, b.z1, h]);
  }
  city.farBoxes = far;
}
