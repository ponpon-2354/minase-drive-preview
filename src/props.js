// v0.3 道路わき・街の小物（標識・カーブミラー・バス停・自販機・ポスト・自転車・看板類）と、道路の細部
import { L } from './textures.js?v=0.9.3';
import { rng } from './math.js?v=0.9.3';
import { MODELS as MODELS_REF } from './carmodels.js?v=0.9.3';

const BACK = { SP30: 'BACK_RND', SP40: 'BACK_RND', SP50: 'BACK_RND', SP60: 'BACK_RND', NOENTRY: 'BACK_RND', BUSSTOP: 'BACK_RND', STOP: 'BACK_TRI', CURVE: 'BACK_DIA' };
const WHITE = [0.95, 0.95, 0.93];
const BYP_X = 1000;

export function installProps(City) {
  const P = City.prototype;
  // 標識：表は図柄、裏は無地の金属面（鏡文字にしない）
  P.signPole = function (gb, x, z, d, lay, w, h, y, cut = 1) {
    gb.cyl(x, 0, z, 0.04, y + h * 0.5, 6, { c: [0.7, 0.72, 0.72] });
    const r = [-d[1], d[0]];
    const Q = (off, n, o) => gb.quadN([x - r[0] * w / 2 - d[0] * off, y, z - r[1] * w / 2 - d[1] * off], [x + r[0] * w / 2 - d[0] * off, y, z + r[1] * w / 2 - d[1] * off],
      [x + r[0] * w / 2 - d[0] * off, y + h, z + r[1] * w / 2 - d[1] * off], [x - r[0] * w / 2 - d[0] * off, y + h, z - r[1] * w / 2 - d[1] * off], n, o);
    Q(0.06, [-d[0], 0, -d[1]], { c: [1, 1, 1], lay, mat: cut ? 17 : 0 });
    const name = Object.keys(L).find(k => L[k] === lay && BACK[k]);
    Q(0.04, [d[0], 0, d[1]], cut ? { c: [0.55, 0.57, 0.58], lay: L[BACK[name] || 'BACK_RND'], mat: 17 } : { c: [0.55, 0.57, 0.58] });
  };
  // 街灯：幹線は白色LED、生活道路・郊外は橙色（ナトリウム灯）
  P.streetLight = function (g, x, z, d, arm, led = true) {
    const l = [d[1], -d[0]], hx = x - l[0] * arm, hz = z - l[1] * arm;
    g.det.cyl(x, 0, z, 0.09, 8, 6, { c: [0.6, 0.62, 0.62] }, false);
    g.det.beam([x, 7.9, z], [hx, 8.1, hz], 0.05, { c: [0.6, 0.62, 0.62] });
    g.det.cbox(hx, 8.0, hz, 0.5, 0.14, 0.3, { c: led ? [0.95, 0.97, 1] : [1, 0.75, 0.4], mat: 8 });
    g.glow.flat(hx - 9, hz - 9, hx + 9, hz + 9, 0.06, { c: led ? [0.9, 0.92, 1] : [1, 0.7, 0.38], mat: 5, lay: L.GLOW });
  };
  P.utilPole = function (g, x, z, d, lamp) {
    g.det.cyl(x, 0, z, 0.17, 10, 6, { c: [0.66, 0.66, 0.63] });
    const l = [d[1], -d[0]];
    g.det.beam([x - l[0] * 0.8, 9.4, z - l[1] * 0.8], [x + l[0] * 0.8, 9.4, z + l[1] * 0.8], 0.06, { c: [0.4, 0.4, 0.4] });
    if ((Math.abs(x * 3 + z) | 0) % 3 === 0) g.det.cyl(x + d[0] * 0.35, 6.5, z + d[1] * 0.35, 0.3, 0.9, 6, { c: [0.55, 0.57, 0.56] });
    if ((Math.abs(x * 7 + z * 3) | 0) % 9 === 0) g.det.box(x - 0.19, 0.3, z - 0.19, x + 0.19, 2.6, z + 0.19, { c: [0.35, 0.55, 0.3], lay: L.TREE, noTop: true }); // 蔦
    if (lamp) {
      const hx = x - l[0] * 1.1, hz = z - l[1] * 1.1;
      g.det.beam([x, 5.5, z], [hx, 5.7, hz], 0.03, { c: [0.6, 0.6, 0.6] });
      g.det.cbox(hx, 5.62, hz, 0.35, 0.1, 0.18, { c: [1, 0.78, 0.45], mat: 8 });
      g.glow.flat(hx - 5.5, hz - 5.5, hx + 5.5, hz + 5.5, 0.06, { c: [1, 0.72, 0.4], mat: 5, lay: L.GLOW });
    }
  };
  // カーブミラー：橙色のポール、橙色の縁の丸い凸面鏡（直径0.6m級）、見通しの悪い方向へ向ける
  P.curveMirror = function (gb, x, z, yaw, y0 = 0, two = false) {
    const org = { c: [0.95, 0.45, 0.1] };
    gb.cyl(x, y0, z, 0.038, 3.3, 6, org);
    const one = (yy) => {
      gb.setXf(x, y0 + 2.9, z, yy);
      gb.beam([0, 0, 0], [0, 0, 0.18], 0.025, org);
      for (let k = 0; k < 12; k++) {
        const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2, R0 = 0.34, R1 = 0.3;
        gb.tri([0, 0, 0.24], [Math.cos(a0) * R0, Math.sin(a0) * R0, 0.2], [Math.cos(a1) * R0, Math.sin(a1) * R0, 0.2], org, [0, 0], [0, 0], [0, 0], [0, 0, 0]);
        gb.tri([0, 0, 0.255], [Math.cos(a0) * R1, Math.sin(a0) * R1, 0.215], [Math.cos(a1) * R1, Math.sin(a1) * R1, 0.215], { c: [0.72 + 0.12 * Math.sin(a0 + 1), 0.8, 0.88] }, [0, 0], [0, 0], [0, 0], [0, 0, -1]);
        gb.tri([0, 0, 0.17], [Math.cos(a0) * R0, Math.sin(a0) * R0, 0.2], [Math.cos(a1) * R0, Math.sin(a1) * R0, 0.2], org, [0, 0], [0, 0], [0, 0], [0, 0, 1]);
      }
      gb.clearXf();
    };
    one(yaw); if (two) one(yaw + Math.PI / 2);
  };
  P.vending = function (g, x, z, yaw, k) {
    const cols = [[0.85, 0.15, 0.15], [0.15, 0.35, 0.75], [0.95, 0.95, 0.95], [0.2, 0.6, 0.3]], c = cols[k % 4];
    g.det.setXf(x, 0, z, yaw);
    g.det.box(-0.5, 0, -0.35, 0.5, 1.83, 0.35, { c });
    g.det.box(-0.42, 0.95, 0.35, 0.42, 1.7, 0.37, { c: [0.95, 0.95, 0.9], mat: 18 });           // 商品見本（常時発光）
    g.det.box(-0.42, 0.25, 0.35, 0.42, 0.5, 0.37, { c: [0.1, 0.1, 0.1] });
    g.det.clearXf();
    g.glow.flat(x - 2.4, z - 2.4, x + 2.4, z + 2.4, 0.06, { c: [0.9, 0.95, 1], mat: 5, lay: L.GLOW });
  };
  P.postBox = function (gb, x, z) { // 赤い丸ポスト
    gb.cyl(x, 0, z, 0.22, 1.2, 10, { c: [0.85, 0.1, 0.1] });
    gb.cyl(x, 1.2, z, 0.26, 0.08, 10, { c: [0.8, 0.08, 0.08] });
    gb.cbox(x, 0.95, z + 0.2, 0.18, 0.03, 0.05, { c: [0.1, 0.1, 0.1] });
  };
  P.busStop = function (gb, x, z, d) { // ポール＋丸い標識＋時刻表板
    gb.cyl(x, 0, z, 0.05, 2.4, 6, { c: [0.8, 0.8, 0.8] });
    gb.cyl(x, 0, z, 0.28, 0.12, 8, { c: [0.5, 0.5, 0.5] });
    const r = [-d[1], d[0]];
    for (const sgn of [1, -1]) gb.quadN([x - r[0] * 0.3, 2.4, z - r[1] * 0.3], [x + r[0] * 0.3, 2.4, z + r[1] * 0.3], [x + r[0] * 0.3, 3.0, z + r[1] * 0.3], [x - r[0] * 0.3, 3.0, z - r[1] * 0.3], [-d[0] * sgn, 0, -d[1] * sgn], { c: [1, 1, 1], lay: L.BUSSTOP, mat: 17 });
    gb.box(x - r[0] * 0.18 - 0.03, 1.2, z - r[1] * 0.18 - 0.03, x + r[0] * 0.18 + 0.03, 1.8, z + r[1] * 0.18 + 0.03, { c: [0.95, 0.95, 0.92] });
  };
  P.bike = function (gb, x, z, yaw, k, lean = 0) { // 自転車（ママチャリ風）
    const cols = [[0.85, 0.85, 0.85], [0.2, 0.3, 0.6], [0.7, 0.15, 0.2], [0.15, 0.15, 0.15], [0.3, 0.55, 0.4]], c = { c: cols[k % 5] };
    gb.setXf(x, 0, z, yaw);
    for (const zz of [-0.5, 0.5]) gb.cylX(0, 0.33, zz, 0.33, 0.04, 8, { c: [0.1, 0.1, 0.1] }, false);
    gb.beam([0, 0.33, -0.5], [0, 0.8, 0.1 + lean], 0.025, c); gb.beam([0, 0.8, 0.1 + lean], [0, 0.33, 0.5], 0.025, c); gb.beam([0, 0.45, -0.1], [0, 0.85, -0.25], 0.025, c);
    gb.cbox(0, 0.88, -0.25, 0.12, 0.05, 0.22, { c: [0.15, 0.15, 0.15] });
    if (k % 2 === 0) gb.cbox(0, 0.9, 0.58, 0.3, 0.2, 0.25, { c: [0.4, 0.4, 0.42] }); // 前かご
    gb.clearXf();
  };
  P.tobidashi = function (gb, x, z, yaw) {
    gb.cyl(x, 0, z, 0.03, 0.4, 4, { c: [0.5, 0.5, 0.5] });
    gb.setXf(x, 0.3, z, yaw);
    gb.quadN([-0.3, 0, 0], [0.3, 0, 0], [0.3, 1.1, 0], [-0.3, 1.1, 0], [0, 0, 1], { c: [1, 1, 1], lay: L.TOBIDASHI, mat: 17 });
    gb.quadN([-0.3, 0, -0.01], [0.3, 0, -0.01], [0.3, 1.1, -0.01], [-0.3, 1.1, -0.01], [0, 0, -1], { c: [0.9, 0.9, 0.9], lay: L.TOBIDASHI, mat: 17 }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
    gb.clearXf();
  };
  P.garbage = function (gb, x, z) { // ゴミ集積所：黄色いカラスよけネットをかぶせた袋の山
    gb.box(x - 1.2, 0, z - 0.7, x + 1.2, 0.08, z + 0.7, { c: [0.6, 0.6, 0.58] });
    for (let k = 0; k < 7; k++) gb.cbox(x - 0.9 + (k % 4) * 0.55, 0.3 + (k > 3 ? 0.3 : 0), z - 0.2 + (k % 2) * 0.35, 0.5, 0.45, 0.4, { c: [0.85, 0.87, 0.8] });
    gb.box(x - 1.15, 0.05, z - 0.65, x + 1.15, 0.85, z + 0.65, { c: [0.95, 0.85, 0.1], noTop: false });
  };
  P.nobori = function (gb, x, z, yaw) {
    gb.cyl(x, 0, z, 0.02, 2.6, 4, { c: [0.85, 0.85, 0.85] });
    gb.setXf(x, 0, z, yaw);
    for (const sg of [1, -1]) gb.quadN([0.03 * sg, 0.9, 0], [0.03 * sg, 0.9, 0.55], [0.03 * sg, 2.5, 0.55], [0.03 * sg, 2.5, 0], [sg, 0, 0], { c: [1, 1, 1], lay: L.NOBORI });
    gb.clearXf();
  };
  P.cone = function (gb, x, z) { gb.cyl(x, 0, z, 0.17, 0.08, 6, { c: [0.9, 0.3, 0.1] }); for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI * 2, a1 = (k + 1) / 6 * Math.PI * 2; gb.tri([x + Math.cos(a0) * 0.14, 0.08, z + Math.sin(a0) * 0.14], [x + Math.cos(a1) * 0.14, 0.08, z + Math.sin(a1) * 0.14], [x, 0.72, z], { c: k % 2 ? [0.95, 0.35, 0.1] : [0.95, 0.95, 0.95] }, [0, 0], [0, 0], [0, 0], [x, 0.3, z]); } };
  // 路面の文字（とまれ・徐行・スクールゾーン）：手前から読める向き
  P.roadText = function (gb, e, s, lay, o, w = 2.2, len = 4.2) {
    const a = this.edgePt(e, s - len, o - w / 2), b = this.edgePt(e, s - len, o + w / 2), c = this.edgePt(e, s, o + w / 2), d = this.edgePt(e, s, o - w / 2);
    // a/b：手前（運転者側）＝テクスチャ下端、c/d：奥＝上端。進行方向の左右で文字が正しく並ぶよう右→左に a→b
    gb.quadN(b, a, d, c, [0, 1, 0], { c: [1, 1, 1], lay, mat: 17 }, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  };

  // ---- エッジ単位の設備（v0.3 版） ----
  P.edgeProps = function (e, A, B) {
    const sp = e.sp, R = rng(e.id * 31 + 7), fwd = e.seg.fwd === e;
    if (sp.kind === 'mtn' || !e.straight) { if (sp.kind === 'byp') this.bypassProps(e); return; }
    const side = (s, o) => this.edgePt(e, s, sp.hw + o);
    const nearByp = p => Math.abs(p[0] - BYP_X) < 25 && Math.abs(p[2]) < 320;
    const items = [];
    if (e.len > 40) items.push(['sp', 8]);
    if (e.ctrl === 'stop') items.push(['stop', e.len - 1]);
    if (sp.oneway) items.push(['ow', 20]);
    for (const [t, s] of items) {
      const p = side(s, sp.sw > 0 ? 0.8 : 0.6);
      if (this.inDrive(p[0], p[2])) continue;
      this.addBox(p[0] - 0.15, p[2] - 0.15, p[0] + 0.15, p[2] + 0.15, 'p');
      this.add(p[0], p[2], g => {
        if (t === 'sp') this.signPole(g.det, p[0], p[2], e.d, sp.lim === 30 ? L.SP30 : sp.lim === 40 ? L.SP40 : sp.lim === 60 ? L.SP60 : L.SP50, 0.6, 0.6, 2.2);
        else if (t === 'stop') this.signPole(g.det, p[0], p[2], e.d, L.STOP, 0.8, 0.7, 2.0);
        else if (t === 'ow') this.signPole(g.det, p[0], p[2], [-e.d[0], -e.d[1]], L.ONEWAY, 0.9, 0.9, 2.3, 0);
      });
    }
    // 一時停止：路面の「止まれ」
    if (e.ctrl === 'stop' && e.len > 12) { const o = e.base + e.lanes * e.lw / 2, mid = this.edgePt(e, e.len - 3, o); this.add(mid[0], mid[2], g => this.roadText(g.d2, e, e.len - 1.6, L.TOMARE, o, Math.min(2.2, e.lw * 0.85), 4.0)); }
    if (sp.oneway) {
      const q = this.edgePt(e, e.len + 1.5, -sp.hw - 0.6);
      this.addBox(q[0] - 0.15, q[2] - 0.15, q[0] + 0.15, q[2] + 0.15, 'p');
      this.add(q[0], q[2], g => this.signPole(g.det, q[0], q[2], [-e.d[0], -e.d[1]], L.NOENTRY, 0.6, 0.6, 2.2));
    }
    const led = sp.kind === 'art' || sp.kind === 'nat' || sp.kind === 'byp';
    if (sp.kind === 'shop') { // 商店街のアーケード（歩道の上の屋根と柱）
      const m0 = this.edgePt(e, e.len / 2, 0); this.stats.arcade = (this.stats.arcade || 0) + 1;
      this.add(m0[0], m0[2], g => { for (const sg of [1, -1]) { const o0 = sg * (sp.hw + 0.3), o1 = sg * (sp.ext + 0.2); this.band(g.s, e, 0, e.len, Math.min(o0, o1), Math.max(o0, o1), { c: [0.75, 0.82, 0.88] }, 4.2); for (let s = 3; s < e.len; s += 9) { const q = this.edgePt(e, s, sg * (sp.hw + 0.35)); g.det.cyl(q[0], 0.12, q[2], 0.08, 4.1, 6, { c: [0.6, 0.62, 0.64] }); } } });
      for (const sg of [1, -1]) for (let s = 3; s < e.len; s += 9) { const q = this.edgePt(e, s, sg * (sp.hw + 0.35)); this.addBox(q[0] - 0.1, q[2] - 0.1, q[0] + 0.1, q[2] + 0.1, 'p'); }
    }
    if (sp.kind === 'art' || sp.kind === 'nat') {
      for (let s = 6; s < e.len - 4; s += 16) { const p = side(s, sp.sw - 1.0); if (nearByp(p) || this.inDrive(p[0], p[2])) continue; this.add(p[0], p[2], g => { this.tree(g.det, p[0], p[2], rng(e.id * 7 + s), (e.id + (s | 0)) % 3); const Rl = rng(e.id * 3 + (s | 0)); for (let k = 0; k < 5; k++) { const lx = p[0] + (Rl() - 0.5) * 3, lz = p[2] + (Rl() - 0.5) * 3; g.d2.flat(lx - 0.12, lz - 0.08, lx + 0.12, lz + 0.08, 0.125, { c: [0.75, 0.5 + Rl() * 0.2, 0.2] }); } }); this.addBox(p[0] - 0.3, p[2] - 0.3, p[0] + 0.3, p[2] + 0.3, 'p'); }
      for (let s = 14; s < e.len; s += 32) { const p = side(s, 0.5); if (nearByp(p) || this.inDrive(p[0], p[2])) continue; this.addBox(p[0] - 0.15, p[2] - 0.15, p[0] + 0.15, p[2] + 0.15, 'p'); this.add(p[0], p[2], g => this.streetLight(g, p[0], p[2], e.d, sp.hw * 0.4, led)); }
    } else if (sp.kind === 'ring' || sp.kind === 'byp') {
      if (fwd) for (let s = 20; s < e.len; s += 45) { const p = side(s, 0.6); if (nearByp(p) || this.inDrive(p[0], p[2])) continue; this.addBox(p[0] - 0.15, p[2] - 0.15, p[0] + 0.15, p[2] + 0.15, 'p'); this.add(p[0], p[2], g => this.streetLight(g, p[0], p[2], e.d, sp.hw * 0.5, led)); }
    } else if (fwd) { // 電柱（路肩の外側、片側）と電線
      const spacing = 30; let prev = null;
      for (let s = 4; s < e.len; s += spacing) {
        const p = side(s, sp.sw > 0 ? sp.sw - 0.4 : 0.65), pr = prev;
        const lamp = (s / spacing | 0) % (sp.kind === 'out' ? 4 : 2) === 0;
        if (this.inDrive(p[0], p[2], 1.2)) { prev = null; continue; }
        this.add(p[0], p[2], g => {
          this.utilPole(g, p[0], p[2], e.d, lamp);
          if (pr) for (const [ox, oy] of [[-0.6, 9.4], [0.6, 9.4], [0, 8.3]]) g.lines.line([pr[0] + e.d[1] * ox, oy, pr[2] - e.d[0] * ox], [p[0] + e.d[1] * ox, oy, p[2] - e.d[0] * ox], [0.1, 0.1, 0.1]);
        });
        this.addBox(p[0] - 0.2, p[2] - 0.2, p[0] + 0.2, p[2] + 0.2, 'p');
        prev = p;
      }
    }
    // 路面の細部：マンホール、補修跡、側溝（歩道のない道路）
    const segs = [];
    for (let s = 15 + R() * 20; s < e.len - 8; s += 30 + R() * 30) segs.push(['mh', s, e.base + (R() * e.lanes | 0) * e.lw + e.lw * 0.5]);
    const np = 2 + (R() * 4 | 0); for (let k = 0; k < np; k++) segs.push(['patch', 5 + R() * (e.len - 10), e.base + R() * e.lanes * e.lw, 1 + R() * 3, 1 + R() * 4]);
    const mid = this.edgePt(e, e.len / 2, 0);
    this.add(mid[0], mid[2], g => {
      for (const it of segs) {
        if (it[0] === 'mh') { const c = this.edgePt(e, it[1], it[2]); g.d2.flat(c[0] - 0.33, c[2] - 0.33, c[0] + 0.33, c[2] + 0.33, 0, { c: [1, 1, 1], lay: L.MANHOLE, mat: 17 }); }
        else this.band(g.d2, e, it[1], Math.min(e.len, it[1] + it[4]), it[2], it[2] + it[3], { c: [0.8, 0.8, 0.83], mat: 7, lay: L.ASPHALT });
      }
      if (sp.sw === 0 && (sp.kind === 'minor' || sp.kind === 'out')) this.band(g.d2, e, 0, e.len, sp.hw - 0.05, sp.hw + 0.3, { c: [0.8, 0.8, 0.8], lay: L.GRATE });
    });
  };
}

// ================= 街全体の追加設備（街区生成のあとに呼ぶ） =================
const DEST = [['水瀬駅', 0, -420], ['市役所', 250, -250], ['みなせ峠', 0, -1450], ['水瀬川', 0, 565], ['工業団地', -1750, 0], ['水瀬IC', 1000, 300], ['田園地帯', -1000, 1300], ['道の駅', -470, -1500], ['県庁方面', 2000, 0], ['旧水瀬街道', -1250, -760]]; // 修正99-4：路面電車の電停名に由来する「西水瀬」は撤去（西側の行き先は工業団地と旧水瀬街道）
export function txt(ctx, s, x, y, size, col, align = 'center', w = 999) {
  ctx.font = `700 ${size}px 'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif`;
  const m = ctx.measureText(s).width; ctx.save(); ctx.translate(x, y); if (m > w) ctx.scale(w / m, 1);
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore();
}
function arrow(ctx, x, y, dir, col) { // dir: 0=上 -1=左 1=右
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir * Math.PI / 2); ctx.fillStyle = col;
  ctx.fillRect(-5, -6, 10, 26); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-15, -4); ctx.lineTo(15, -4); ctx.fill(); ctx.restore();
}
export function installDyn(city) { // 動的テクスチャ（案内標識・校名など）の割り当て。全体で96枚
  if (city.newDyn) return; city.dyn = city.dyn || []; let k = 0;
  city.newDyn = draw => { if (k >= 96) return null; const lay = L['DYN' + k++]; city.dyn.push({ lay, draw }); return lay; };
}
export function roadExtras(city) {
  installDyn(city);
  const R = rng(9090), st = city.stats, dyn = city.dyn;
  const pois = city.pois = city.pois || [];
  const newDyn = draw => city.newDyn(draw);
  const okSide = p => !city.inDrive(p[0], p[2], 1.0) && ![...city.query(p[0], p[2], 0.6)].some(b => b.kind !== 'x' && p[0] > b.x0 - 0.6 && p[0] < b.x1 + 0.6 && p[2] > b.z0 - 0.6 && p[2] < b.z1 + 0.6);
  // ---- 案内標識（実際の方向と距離） ----
  let guides = 0;
  for (const e of city.edges) {
    const sp = e.sp, B = city.nodes[e.to];
    if (!e.straight || !(sp.kind === 'art' || sp.kind === 'nat' || sp.kind === 'out') || e.len < 120 || B.ctrl !== 'signal' || guides >= 28) continue;
    if ((e.id * 7) % 3 !== 0 && sp.kind !== 'nat') continue;
    const dirs = [[e.d, 0], [[e.d[1], -e.d[0]], -1], [[-e.d[1], e.d[0]], 1]]; // 直進・左・右（左側通行：左= (dz,-dx)）
    const rows = [];
    for (const [d, a] of dirs) {
      let best = null, bs = -1;
      for (const D of DEST) { const vx = D[1] - B.x, vz = D[2] - B.z, l = Math.hypot(vx, vz); if (l < 300) continue; const c = (vx * d[0] + vz * d[1]) / l; if (c > 0.72 && c - l / 20000 > bs) { bs = c - l / 20000; best = [D[0], l]; } }
      if (best) rows.push([a, best[0], (best[1] / 1000).toFixed(1)]);
    }
    if (rows.length < 2) continue;
    const nat = sp.kind === 'nat';
    const lay = newDyn((ctx, S) => {
      ctx.fillStyle = '#1d4fa0'; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeRect(6, 6, S - 12, S - 12);
      rows.forEach((r, i) => { const y = 52 + i * 72; arrow(ctx, 34, y, r[0], '#fff'); txt(ctx, r[1], 64, y - 8, 34, '#fff', 'left', 130); txt(ctx, r[2] + 'km', S - 18, y + 18, 22, '#fff', 'right'); });
      if (nat) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(196, 14); ctx.lineTo(244, 14); ctx.lineTo(240, 40); ctx.lineTo(220, 52); ctx.lineTo(200, 40); ctx.fill(); txt(ctx, '588', 220, 30, 18, '#1d4fa0'); }
    });
    if (lay == null) break;
    const p = city.edgePt(e, e.len - 55, sp.hw + (sp.sw > 0 ? 0.8 : 0.6));
    if (!okSide(p)) continue;
    city.addBox(p[0] - 0.15, p[2] - 0.15, p[0] + 0.15, p[2] + 0.15, 'p');
    city.add(p[0], p[2], g => { // 片持ちの案内標識（車道側に張り出す）
      const l = [e.d[1], -e.d[0]], arm = Math.min(3, sp.hw * 0.6), hx = p[0] - l[0] * arm, hz = p[2] - l[1] * arm;
      g.det.cyl(p[0], 0, p[2], 0.12, 6.4, 6, { c: [0.7, 0.72, 0.72] });
      g.det.beam([p[0], 6.1, p[2]], [hx, 6.1, hz], 0.08, { c: [0.7, 0.72, 0.72] });
      city.signPole(g.det, hx, hz, e.d, lay, 2.6, 2.6, 4.7, 0);
    });
    guides++;
  }
  st.guides = guides;
  // ---- 信号のない横断歩道（中間部）＋ダイヤマーク ----
  let cw = 0; city.crosswalks = [];
  for (const e of city.edges) {
    const sp = e.sp; if (e.seg.fwd !== e || !e.straight || sp.oneway || sp.med || e.len < 110 || !['art', 'out', 'ring', 'minor', 'nt', 'gak'].includes(sp.kind)) continue;
    if (cw >= 34 || (e.id * 5) % 3 === 1) continue;
    const s = e.len * 0.5, m = city.edgePt(e, s, 0);
    if (city.inDrive(m[0], m[2], 6) || (Math.abs(m[0] - BYP_X) < 30)) continue;
    const rev = e.rev != null ? city.edges[e.rev] : null, sr = rev ? (m[0] - rev.x0) * rev.d[0] + (m[2] - rev.z0) * rev.d[1] : 0; cw++;
    city.crosswalks.push({ e: e.id, s, x: m[0], z: m[2] }); if (rev) city.crosswalks.push({ e: rev.id, s: sr, x: m[0], z: m[2] });
    city.add(m[0], m[2], g => {
      for (let o = -sp.hw + 0.4; o < sp.hw - 0.3; o += 0.9) city.band(g.d2, e, s - 2, s + 2, o, Math.min(o + 0.45, sp.hw - 0.3), { c: WHITE });
      for (const [ee, ss] of [[e, s], [rev, sr]]) if (ee) {
        const o = ee.base + ee.lw * 0.5;
        for (const back of [30, 50]) { if (ss - back < 4) continue; const c = city.edgePt(ee, ss - back, o); const a = ee.d; // ダイヤ（◇）
          const V = [[3, 0], [0, 0.75], [-3, 0], [0, -0.75]].map(([u, w]) => [c[0] + a[0] * u + a[1] * w, c[2] + a[1] * u - a[0] * w]);
          for (let q = 0; q < 4; q++) { const A = V[q], B = V[(q + 1) % 4], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), nx = -dz / l * 0.08, nz = dx / l * 0.08; g.d2.quadN([A[0] - nx, 0, A[1] - nz], [B[0] - nx, 0, B[1] - nz], [B[0] + nx, 0, B[1] + nz], [A[0] + nx, 0, A[1] + nz], [0, 1, 0], { c: WHITE }); } }
      }
    });
    // 横断歩道の標識（両側）
    for (const sg of [1, -1]) { const p = city.edgePt(e, s + 2.6 * sg, sg * (sp.hw + 0.6)); if (!okSide(p)) continue; city.addBox(p[0] - 0.12, p[2] - 0.12, p[0] + 0.12, p[2] + 0.12, 'p'); city.add(p[0], p[2], g => city.signPole(g.det, p[0], p[2], sg > 0 ? e.d : [-e.d[0], -e.d[1]], L.CROSSW, 0.6, 0.6, 2.3)); }
  }
  st.crosswalks = cw;
  // ---- バス停・ポスト・自販機・交番・飛び出し注意・ゴミ集積所 ----
  const candidates = [];
  for (const e of city.edges) { if (!e.straight || e.len < 60) continue; for (let s = 20; s < e.len - 20; s += 40) candidates.push([e, s]); }
  for (let i = candidates.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  const used = [];
  const free = (p, r) => !used.some(q => (q[0] - p[0]) ** 2 + (q[1] - p[2]) ** 2 < r * r);
  const place = (want, filt, r, fn) => {
    let n = 0;
    for (const [e, s] of candidates) {
      if (n >= want) break; if (!filt(e)) continue;
      const sp = e.sp, p = city.edgePt(e, s, sp.hw + (sp.sw > 0 ? Math.min(1.6, sp.sw - 0.6) : 0.8));
      if (!free(p, r) || !okSide(p) || Math.abs(p[0] - BYP_X) < 25 || (p[2] > 520 && p[2] < 610)) continue;
      used.push([p[0], p[2]]); fn(e, s, p); n++;
    }
    return n;
  };
  st.busStops = place(14, e => ['art', 'nat', 'out', 'ring'].includes(e.sp.kind), 120, (e, s, p) => {
    city.addBox(p[0] - 0.2, p[2] - 0.2, p[0] + 0.2, p[2] + 0.2, 'p'); city.busStops = city.busStops || []; city.busStops.push({ e: e.id, s, x: p[0], z: p[2] });
    pois.push({ t: 'bus', x: p[0], z: p[2], name: 'バス停' });
    city.add(p[0], p[2], g => { city.busStop(g.det, p[0], p[2], e.d); const Y = { c: [0.95, 0.8, 0.15] }, o0 = e.sp.hw - 2.6, o1 = e.sp.hw - 0.4; city.band(g.d2, e, s - 10, s + 6, o0, o0 + 0.15, Y); city.band(g.d2, e, s - 10, s - 9.85, o0, o1, Y); city.band(g.d2, e, s + 5.85, s + 6, o0, o1, Y); /* バス停の黄色い枠 */ });
  });
  st.postBoxes = place(10, e => e.sp.sw > 0 || e.sp.kind === 'minor', 90, (e, s, p) => { city.addBox(p[0] - 0.25, p[2] - 0.25, p[0] + 0.25, p[2] + 0.25, 'p'); city.add(p[0], p[2], g => city.postBox(g.det, p[0], p[2])); });
  st.vending = (st.vending || 0) + place(34 - (st.vending || 0), e => e.sp.kind !== 'nat', 50, (e, s, p) => {
    const q = city.edgePt(e, s, e.sp.ext + 0.6); if (!okSide(q)) return;
    city.addBox(q[0] - 0.55, q[2] - 0.55, q[0] + 0.55, q[2] + 0.55, 'p'); city.add(q[0], q[2], g => city.vending(g, q[0], q[2], Math.atan2(-e.d[1], e.d[0]) + Math.PI, (q[0] * 7 + q[2]) & 3));
  });
  st.tobidashi = place(14, e => e.sp.kind === 'minor' || e.sp.kind === 'out', 70, (e, s, p) => city.add(p[0], p[2], g => city.tobidashi(g.det, p[0], p[2], Math.atan2(-e.d[0], -e.d[1]))));
  st.garbage = place(12, e => e.sp.kind === 'minor' || e.sp.kind === 'out', 110, (e, s, p) => { const q = city.edgePt(e, s, e.sp.ext + 1.3); city.addBox(q[0] - 1.2, q[2] - 0.7, q[0] + 1.2, q[2] + 0.7, 'p'); city.add(q[0], q[2], g => city.garbage(g.det, q[0], q[2])); });
  // 路面標示「徐行」「スクールゾーン」（生活道路）
  let rt = 0;
  for (const e of city.edges) { if (rt >= 24 || e.sp.kind !== 'minor' || !e.straight || e.len < 60 || e.id % 4) continue; const o = e.base + e.lw / 2, sz = e.id % 8 === 0, mid = city.edgePt(e, 25, o); rt++;
    city.add(mid[0], mid[2], g => { city.roadText(g.d2, e, 26, sz ? L.SCHOOLZ : L.JOKO, o, Math.min(2.2, e.lw * 0.8), 4.0); if (sz) city.band(g.d2, e, 10, e.len - 10, e.sp.hw - 0.95, e.sp.hw - 0.4, { c: [0.35, 0.65, 0.35] }); }); }
  st.roadText = rt;
  // 交番（2か所）
  st.koban = 0;
  for (const [x, z] of [[-120, -330], [380, 120]]) {
    let best = null, bd = 1e9; for (const n of city.nodes) { if (n.ctrl !== 'signal') continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    if (!best) continue;
    const kx = best.x + best.hx + 4.5, kz = best.z + best.hz + 4.5;
    city.addBox(kx - 2.5, kz - 2, kx + 2.5, kz + 2); st.koban++;
    pois.push({ t: 'koban', x: kx, z: kz, name: '交番' });
    city.add(kx, kz, g => {
      g.s.box(kx - 2.5, 0, kz - 2, kx + 2.5, 3.2, kz + 2, { c: [0.9, 0.88, 0.82], mat: 3, side: { lay: L.SHOP, tw: 5, th: 3.2 } });
      g.s.gable(kx - 2.5, kz - 2, kx + 2.5, kz + 2, 3.2, 1.2, { c: [0.35, 0.3, 0.3], lay: L.KAWARA, tw: 2 });
      g.s.panel(kx - 1.5, kz - 2, kx + 1.5, kz - 2, 2.4, 3.0, 0.05, [0, 0, -1], { c: [1, 1, 1], mat: 16, lay: L.SG_KOBAN });
      g.det.cyl(kx + 2.8, 3.0, kz - 2.2, 0.18, 0.3, 8, { c: [1, 0.15, 0.1], mat: 18 }); // 赤色灯
    });
    { const m = MODELS_REF.find(q => q.name === 'クラウン'); if (m && city.query && ![...city.query(kx + 5.5, kz, 3)].some(b => b.kind !== 'x' && kx + 5.5 > b.x0 - 2.5 && kx + 5.5 < b.x1 + 2.5 && kz > b.z0 - 1.2 && kz < b.z1 + 1.2)) { city.addCarBox(kx + 5.5, kz, 0, m); city.add(kx + 5.5, kz, g => { city.bakeCar(g.det, m, { rgb: [0.95, 0.95, 0.95] }, kx + 5.5, kz, 0); g.det.cbox(kx + 5.5, m.H + 0.08, kz - 0.2, 0.9, 0.14, 0.22, { c: [1, 0.1, 0.1], mat: 18 }); }); st.patrolCar = (st.patrolCar || 0) + 1; } } // 交番の前のパトロールカー（静止）
  }
  // ---- 橋の銘板 ----
  const BN = ['みなせばし', 'ほんまちばし', 'さくらばし', 'ひがしばし', 'かわぞえばし', 'にしばし', 'しんみなせばし'];
  for (const [i, b] of (city.bridges || []).entries()) {
    const name = BN[i % BN.length], lay = newDyn((ctx, S) => { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#d7c49a'; ctx.fillRect(14, 14, S - 28, S - 28); txt(ctx, name, S / 2, S / 2, 46, '#3a2a18', 'center', 210); });
    if (lay == null) break;
    pois.push({ t: 'bridge', x: b.x, z: 565, name });
    city.add(b.x, 529, g => g.det.quadN([b.x - b.hw - 0.45, 1.0, 528.7], [b.x - b.hw + 0.05, 1.0, 528.7], [b.x - b.hw + 0.05, 1.5, 528.7], [b.x - b.hw - 0.45, 1.5, 528.7], [0, 0, -1], { c: [1, 1, 1], lay }));
  }
  zoneAndSurface(city);
}

// ---- 地区分類（交通量の目標）と路面種別ラスター（2mグリッド） ----
function zoneAndSurface(city) {
  city.zoneClass = (x, z) => {
    if (z < -1000) return 'mtn';
    if (Math.abs(x) <= 260 && z > -470 && z < 300) return 'center';
    if (Math.abs(x) <= 500 && Math.abs(z) <= 500) return 'res';
    if (z >= 1000 && x >= 0) return x < 1000 ? 'gak' : 'nt'; // 学園地区・ニュータウン
    if (x < -1000 && z > -1020 && z < 500) return 'ind'; // 工業団地（トラック・トレーラーが多い）
    if (z > 600 && x >= 1000) return 'sub';
    if (z > 600 && z < 1000 && x >= -1000) return 'sub'; // 川の南の住宅地
    if (x > 500 && z > -520 && z < 520) return 'sub'; // 国道ロードサイド
    if (z > 600 || Math.abs(x) > 1500) return 'farm';
    if (Math.abs(z) < 40 && x > 500) return 'sub';
    return 'sub';
  };
  const X0 = -2100, Z0 = -2100, N = 2100, C = 2, G = new Uint8Array(N * N); // 0=草地 1=舗装 2=歩道/縁石 3=砂利・土
  const paint = (x0, z0, x1, z1, v) => { const a = Math.max(0, (Math.min(x0, x1) - X0) / C | 0), b = Math.min(N - 1, (Math.max(x0, x1) - X0) / C | 0), c = Math.max(0, (Math.min(z0, z1) - Z0) / C | 0), d = Math.min(N - 1, (Math.max(z0, z1) - Z0) / C | 0); for (let j = c; j <= d; j++) G.fill(v, j * N + a, j * N + b + 1); };
  // 中心市街地の街区は舗装・敷地（砂利）扱い
  paint(-505, -505, 505, 505, 3);
  for (const r of city.mm.blds) paint(r.x0, r.z0, r.x1, r.z1, 3);
  for (const e of city.edges) { if (!e.straight || e.seg.fwd !== e) continue; const sp = e.sp; const a = city.edgePt(e, 0, 0), b = city.edgePt(e, e.len, 0); const ns = e.axis === 'ns'; const nx = city.nodes[e.from], nz = city.nodes[e.to]; void nx; void nz;
    if (sp.sw > 0) paint(Math.min(a[0], b[0]) - (ns ? sp.ext : 0), Math.min(a[2], b[2]) - (ns ? 0 : sp.ext), Math.max(a[0], b[0]) + (ns ? sp.ext : 0), Math.max(a[2], b[2]) + (ns ? 0 : sp.ext), 2);
    else paint(Math.min(a[0], b[0]) - (ns ? sp.hw + 1.2 : 0), Math.min(a[2], b[2]) - (ns ? 0 : sp.hw + 1.2), Math.max(a[0], b[0]) + (ns ? sp.hw + 1.2 : 0), Math.max(a[2], b[2]) + (ns ? 0 : sp.hw + 1.2), 3);
  }
  for (const r of city.mm.lots) paint(r.x0, r.z0, r.x1, r.z1, 1);
  for (const l of city.mm.lanes) { if (l.poly) continue; const w = l.w + 0.3, v = l.kind === 'farm' ? 3 : 1; const ex = l.kind === 'lane' || l.kind === 'farm' ? 2 : l.w; if (l.axis === 'ns') paint(l.c - w, l.a - ex, l.c + w, l.b + ex, v); else paint(l.a - ex, l.c - w, l.b + ex, l.c + w, v); }
  for (const r of city.driveways) paint(r.x0, r.z0, r.x1, r.z1, 1);
  // 曲線道路（学園地区・ニュータウン・旧街道）：中心線に沿って歩道→車道の順に塗る
  for (const s of city.curveSegs || []) { const sp = s.road.sp, P = s.full;
    for (const [w, v] of [[sp.ext, sp.sw > 0 ? 2 : 3], [sp.hw + 0.3, 1]]) for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5); for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n, r = w * 0.72; paint(x - r, z - r, x + r, z + r, v); } } }
  for (const n of city.nodes) if (n.cfill || city.extraNb.get(n).size === 1) paint(n.x - Math.max(n.hx, 11), n.z - Math.max(n.hz, 11), n.x + Math.max(n.hx, 11), n.z + Math.max(n.hz, 11), 1);
  for (const n of city.nodes) paint(n.x - n.hx - 0.5, n.z - n.hz - 0.5, n.x + n.hx + 0.5, n.z + n.hz + 0.5, 1);
  city.surfGrid = G;
  city.surfaceAt = (x, z, y = 0) => {
    if (y > 1.2) return 1; // 高架・橋の上
    if (z < -1000) { const m = city.mtnRoadAt && city.mtnRoadAt(x, z); if (m) return 1; const n = city.mtnNearest && city.mtnNearest(x, z); if (n && n.d < city.mtn.hw + 3.4) return 3; const p = city.restPad; if (p && x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return 1; if (city.padLinkD && city.padLinkD(x, z) < 5) return 1; return 0; }
    if (z > 524 && z < 606) { for (const b of city.bridges || []) if (Math.abs(x - b.x) < b.hw + 0.3) return 1; }
    const i = (x - X0) / C | 0, j = (z - Z0) / C | 0; if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return G[j * N + i];
  };
}
