// プレイヤー車両（ミライース）の物理：自転車モデル＋タイヤ横力（摩擦円）＋CVT
// v0.3：後退旋回の修正、クリープ／坂道、壁でのスライド、路面種別、スタック自動復帰
import { clamp } from './math.js?v=0.8.0';
import { MIRA } from './carmodels.js?v=0.8.0';

// 路面種別：0=草地・畑 1=舗装 2=歩道 3=砂利・敷地
// 路面：草地・砂利は少し滑りやすく、アクセルは約50km/hで効かなくなる（ブレーキはかけない）。住宅街は zoneCap（約70km/h）。制限速度リミッターは前進のみ
const SURF = { 0: { mu: 0.75, rr: 0.02, drag: 0 }, 1: { mu: 1, rr: 0.012, drag: 0 }, 2: { mu: 0.95, rr: 0.015, drag: 0 }, 3: { mu: 0.88, rr: 0.016, drag: 0 } };

export class Player {
  constructor(city) {
    this.city = city;
    this.p = MIRA;
    this.m = 670 + 75;          // 車重670kg＋乗員
    this.a = 0.98; this.b = MIRA.wb - 0.98; // 重心〜前後軸（FFで前寄り）
    this.Iz = this.m * this.a * this.b * 1.05;
    this.reset(0, 0, 0);
    this.input = { thr: 0, brk: 0, steer: 0 };
    this.assist = true;
  }
  reset(x, z, yaw, cy = 0.5) {
    Object.assign(this, { scrapeT: 0, cT: null, x, z, y: this.city ? this.city.groundY(x, z, cy) : 0, yaw, vx: 0, vy: 0, w: 0, steer: 0, rpm: 800, gear: 'D', pitch: 0, roll: 0, pv: 0, rv: 0, wheelRot: 0, slip: 0, hit: 0, accel: 0, braking: false, stopT: 0, holdT: 0, stuckT: 0, stuckP: [x, z], surf: 1, aeb: 0, gearReq: false, gearResult: null, wallPivot: 0, needRescue: false, engineOn: true, isArmed: false, isT: 0, restartT: 0, cruiseV: null, bump: 0, parked: true }); // 開始・ワープ直後は最初の操作まで停止を保持（勝手にクリープで動き出さない）
    this.onReset && this.onReset(); // 表示（ギア表示・Rボタン）を実状態に合わせる
  }
  // クリープ用：進む向き（D=前、R=後ろ）のバンパーから1.5m以内に車・壁・柱があるか
  frontBlocked(dir, npcs) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), fx = s * dir, fz = c * dir, hl = MIRA.L / 2;
    for (const d of [0.4, 1.0, 1.5]) for (const lx of [-0.6, 0, 0.6]) {
      const px = this.x + fx * (hl + d) + c * lx, pz = this.z + fz * (hl + d) - s * lx;
      for (const b of this.city.query(px, pz, 1)) { if (b.kind === 'x' || this.y + 1.3 < b.y0 || this.y + 0.35 > b.y1) continue; if (b.nb != null && !this.city.shopCarsOn(b.nb, this.hour ?? 12)) continue; if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1) return true; }
      for (const n of npcs || []) { const dx = px - n.x, dz = pz - n.z; if (dx * dx + dz * dz > 100) continue; const cy = Math.cos(n.yaw), sy = Math.sin(n.yaw), ll = dx * sy + dz * cy, lt = dx * cy - dz * sy; if (Math.abs(ll) < n.m.L / 2 + 0.1 && Math.abs(lt) < n.m.W / 2 + 0.1) return true; }
    }
    return false;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get kmh() { return Math.abs(this.vx) * 3.6; }
  step(dt, env, npcs) {
    this.T0 = (this.T0 || 0) + dt;
    // 修正96：ガードレールをこすった直後の0.5秒は、車の向きを壁に沿う向きへ戻し続ける（向きがずれたままだとタイヤが横滑りして急に失速する）
    if (this.scrapeT > 0) { this.scrapeT -= dt; let d = this.scrapeYaw - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.yaw += Math.max(-3 * dt, Math.min(3 * dt, d)); }
    const inp = this.input, g = 9.81;
    // 路面（雨は濡れ具合で連続的にグリップ低下）
    const surf = this.city.surfaceAt ? this.city.surfaceAt(this.x, this.z, this.y) : 1;
    if (surf === 2 && this.surf === 1 && Math.abs(this.vx) > 3) { this.vx *= 0.82; this.hit = Math.max(this.hit, 0.2); this.curb = 1; } // 縁石に乗り上げ
    this.surf = surf;
    const S = SURF[surf], mu = S.mu * (1 - 0.28 * (env.wet || 0));
    const v = this.vx;
    if (this.gearReq) { this.gearResult = Math.abs(v) < 1.0 ? 'ok' : 'ng'; if (this.gearResult === 'ok') this.gear = this.gear === 'D' ? 'R' : 'D'; this.gearReq = false; }
    if (this.parked && (inp.thr > 0.02 || inp.brk > 0.02 || Math.abs(inp.steer) > 0.02 || this.gearReq)) this.parked = false;
    let thr = inp.thr, brk = Math.max(inp.brk, this.aeb || 0, this.parked ? 1 : 0);
    const dir = this.gear === 'R' ? -1 : 1;
    // ステアリング（車速感応）：停車〜低速は大きく素早く、50km/h以上はマイルドに（左右ボタンの小刻みな操作でもふらつかない）
    const vk = Math.abs(v) / 9, maxSt = 0.55 / (1 + vk * vk * 1.4);
    const target = inp.steer * maxSt;
    const back = Math.abs(target) < Math.abs(this.steer) || Math.sign(target) !== Math.sign(this.steer);
    const rate = (back ? 2.8 : 1.6) / (1 + Math.abs(v) / 12);
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    // ---- パワートレイン（KF型 3気筒658cc：36kW/6800rpm・57Nm/5200rpm、CVT） ----
    // アイドリングストップ：Dで一度10km/h以上出したあと、ブレーキで停止して1秒たつとエンジン停止。ブレーキを離すかアクセルで再始動
    if (this.engineOn === undefined) { this.engineOn = true; this.isArmed = false; this.isT = 0; this.restartT = 0; }
    if (Math.abs(v) * 3.6 > 10) this.isArmed = true;
    if (this.engineOn && this.isEnabled !== false && this.isArmed && dir > 0 && Math.abs(v) < 0.05 && brk > 0.3 && thr < 0.05) { this.isT += dt; if (this.isT > 1.0) { this.engineOn = false; this.isArmed = false; this.idleStopped = true; } }
    else this.isT = 0;
    if (!this.engineOn && (brk < 0.3 || thr > 0.05 || this.gearReq || dir < 0)) { this.engineOn = true; this.restartT = 0.35; this.restarted = true; }
    if (this.restartT > 0) this.restartT -= dt;
    // 速度維持（半自動クルーズ）：目標速度に合わせてアクセル開度を自動で調整（ブレーキで解除）
    if (this.cruiseV != null) { if (brk > 0.05 || dir < 0) this.cruiseV = null; else thr = clamp(0.22 + (this.cruiseV - v) * 0.35 + Math.max(0, this.slope || 0) * 2.5, 0, 0.95); }
    // 制限速度リミッター（ONのとき）：制限速度を超えないよう出力を絞る（下り坂で超えた分は絞ったまま緩やかに戻る）
    this.limitV = null;
    if (this.limiter && this.city.limitAt) { const l = this.city.limitAt(this.x, this.z); if (l) { this.limitV = l.lim / 3.6; } }
    const T_TQ = [[0, 30], [800, 38], [1500, 45], [2500, 51], [3500, 54.5], [4500, 56.5], [5200, 57], [6000, 55], [6800, 50.5], [7300, 42]];
    const tq = r => { for (let i = 1; i < T_TQ.length; i++) if (r <= T_TQ[i][0]) { const a = T_TQ[i - 1], b = T_TQ[i], t = (r - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; } return 40; };
    const kmhNow = Math.abs(v) * 3.6;
    const eng = this.engineOn && this.restartT <= 0;
    // CVT：アクセル開度と車速から目標回転数を決め、回転は先に上がって速度が後からついてくる（ラバーバンド感）
    const cruiseR = 1050 + kmhNow * 15.5, wot = 5300 + Math.min(1, kmhNow / 70) * 1200;
    let rT = !eng ? 0 : thr < 0.02 ? (kmhNow < 3 ? 800 + (this.ac ? 150 : 0) : 900 + kmhNow * 13) : cruiseR + (wot - cruiseR) * Math.pow(thr, 1.25);
    this.rpm += (rT - this.rpm) * Math.min(1, dt * (rT > this.rpm ? (thr > 0.6 ? 7 : 4) : 2.5));
    const thrE = Math.pow(Math.min(1, thr * 1.3), 0.7); // 開度→エンジン出力の割合（半開でも7割強：軽い車体でスッと出る）
    const Pe = eng ? tq(Math.max(900, this.rpm)) * Math.max(900, this.rpm) * Math.PI / 30 * thrE : 0;
    const Pac = this.ac && eng ? 1600 : 0, eta = 0.82;
    const Pw = Math.max(0, Pe - Pac) * eta;
    let Fdrive = 0;
    if (thr > 0) {
      if (dir > 0 && v < -0.3) { brk = Math.max(brk, thr); thr = 0; }
      else if (dir < 0 && v > 0.3) { brk = Math.max(brk, thr); thr = 0; }
      else Fdrive = dir * Math.min(2650 * thrE, Pw / Math.max(Math.abs(v), 2.2)); // 低速は発進時の駆動力（CVTの大きな変速比）で頭打ち
      if (dir < 0) Fdrive = clamp(Fdrive, -1400, 0);
      // 速度の目安（千葉指示）：草地・砂利の農道は約50km/h、住宅街は約70km/h でアクセルが効かなくなる（ブレーキはかけない）
      let cap = (surf === 0 || surf === 3) ? 50 / 3.6 : this.zoneCap || 0;
      if (this.limitV && dir > 0) cap = cap ? Math.min(cap, this.limitV) : this.limitV;
      if (cap && Math.abs(v) > cap - 1.5) Fdrive *= clamp((cap - Math.abs(v)) / 1.5, 0, 1);
    }
    // クリープ：D/Rでペダルを離すと6〜8km/hでゆっくり進む。前（後退中は後ろ）1.5m以内に障害物があれば止まる
    const creep = eng && thr < 0.05 && brk < 0.05;
    this.creepBlocked = false;
    if (creep) { const cv = 7 / 3.6, sv = v * dir; if (this.frontBlocked && this.frontBlocked(dir, npcs)) { this.creepBlocked = true; brk = Math.max(brk, 0.4); } else if (sv < cv + 0.3) Fdrive = dir * clamp((cv - sv) * 950, 0, 640); }
    if (dir > 0 && v * 3.6 > 140) Fdrive = Math.min(Fdrive, 0); // リミッター
    if (dir < 0 && v < -6) Fdrive = 0;
    this.thrUsed = thr; this.ecoNow = eng && thr > 0.02 && thr <= 0.4 && kmhNow > 3 && (this.accel || 0) < 1.6;
    const Frr = S.rr * (1 + Math.abs(v) / 40) * this.m * g * Math.sign(v), Fdrag = (0.5 * 1.2 * 0.36 * 1.95 + S.drag) * v * Math.abs(v); // 速度が上がるほど転がり抵抗も増える
    const Fbrk = brk * this.m * g * 0.75 * Math.min(1, mu / 0.9); // 乾燥時最大0.75g。雨は摩擦側だけで低下
    const Feb = thr < 0.05 && Math.abs(v) > 2.6 ? 260 * Math.sign(v) * Math.min(1, (Math.abs(v) - 2.6) / 3) : 0; // エンジンブレーキ（クリープ速度以下では効かない）
    // タイヤ横力：低速では速度に応じて弱め、運動学モデルに任せる（後退旋回で固まる不具合の修正）
    const lowK = clamp((Math.abs(v) - 0.5) / 2.5, 0, 1);
    const vxa = Math.max(Math.abs(v), 1.0);
    const Nf = this.m * g * this.b / MIRA.wb, Nr = this.m * g * this.a / MIRA.wb;
    const Cf = 52000, Cr = 58000;
    const af = Math.atan2(this.vy + this.w * this.a, vxa) - this.steer * Math.sign(v || dir);
    const ar = Math.atan2(this.vy - this.w * this.b, vxa);
    const fxf = Math.min(Math.abs(Fdrive), mu * Nf * 0.9) + Fbrk * 0.65;
    const fyfMax = Math.sqrt(Math.max(0, (mu * Nf) ** 2 - fxf ** 2)) + 200, fyrMax = mu * Nr;
    const Fyf = clamp(-Cf * af, -fyfMax, fyfMax) * lowK, Fyr = clamp(-Cr * ar, -fyrMax, fyrMax) * lowK;
    this.slip = Math.max(Math.abs(Fyf) / (fyfMax + 1) > 0.98 && Math.abs(v) > 8 ? 1 : 0, (Math.abs(Fyr) / (fyrMax + 1) > 0.98 && Math.abs(v) > 6) ? 1 : 0);
    // 坂道：重力の進行方向成分
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), cy = this.y + 0.5;
    const gF = this.city.groundY(this.x + fx * 1.2, this.z + fz * 1.2, cy), gB = this.city.groundY(this.x - fx * 1.2, this.z - fz * 1.2, cy);
    this.slope = clamp((gF - gB) / 2.4, -0.4, 0.4);
    const Fg = this.m * g * Math.sin(Math.atan(this.slope));
    // 坂道発進補助：ブレーキを離してから1秒は保持し、その後はクリープに負ければゆっくりずり下がる
    if (brk > 0.05) this.holdT = 1.0; else this.holdT = Math.max(0, this.holdT - dt);
    const hold = (brk > 0.05 && Math.abs(Fg) < Fbrk + 50) || (this.holdT > 0 && thr < 0.05 && Math.abs(v) < 0.2);
    let Fx = Fdrive - Frr - Fdrag - Feb - Fyf * Math.sin(this.steer) - (hold && Math.abs(v) < 0.1 ? 0 : Fg);
    const ax = Fx / this.m + this.vy * this.w;
    const bAcc = Fbrk / this.m;
    let nvx = v + ax * dt;
    if (bAcc > 0) { if (Math.abs(nvx) <= bAcc * dt) nvx = 0; else nvx -= Math.sign(nvx) * bAcc * dt; }
    if (hold && Math.abs(nvx) < 0.05) nvx = 0;
    this.accel = (nvx - v) / dt;
    this.vx = nvx;
    // 横・ヨー
    const ay = (Fyf * Math.cos(this.steer) + Fyr) / this.m - this.vx * this.w;
    const aw = (this.a * Fyf * Math.cos(this.steer) - this.b * Fyr) / this.Iz;
    this.vy += ay * dt; this.w += aw * dt;
    const piv = (this.wallPivot || 0) > 0; if (piv) this.wallPivot -= dt; // 壁際での向き変え中は低速の運動学的な補正をかけない
    const kin = piv ? 0 : clamp(1 - (Math.abs(this.vx) - 1.5) / 3, 0, 1);
    if (kin > 0) {
      const wk = this.vx * Math.tan(this.steer) / MIRA.wb;
      this.w += (wk - this.w) * kin; this.vy *= 1 - kin;
    }
    if (this.assist && !piv) { this.vy *= 1 - Math.min(1, dt * 2.5); const wk = this.vx * Math.tan(this.steer) / MIRA.wb; this.w += (wk - this.w) * Math.min(1, dt * 2.0); }
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const ox = this.x, oz = this.z;
    this.yaw += this.w * dt;
    this.x += (s * this.vx + c * this.vy) * dt;
    this.z += (c * this.vx - s * this.vy) * dt;
    this.collide(ox, oz, npcs, dt);
    const latA = this.vx * this.w;
    const kp = 60, cp = 9;
    this.pv += (-kp * (this.pitch - clamp(-this.accel * 0.006, -0.05, 0.05)) - cp * this.pv) * dt; this.pitch += this.pv * dt;
    this.slopeV = (this.slopeV || 0) + (-Math.atan(this.slope || 0) - (this.slopeV || 0)) * Math.min(1, dt * 10);
    this.rv += (-kp * (this.roll - clamp(latA * 0.006, -0.06, 0.06)) - cp * this.rv) * dt; this.roll += this.rv * dt;
    this.wheelRot += this.vx * dt / MIRA.r;
    const gy = this.city.groundY(this.x, this.z, this.y + 0.5); this.y += (gy - this.y) * Math.min(1, dt * 12);
    // 段差の突き上げ：接地高さが短い距離で急に変わったら車体を揺らして音を出す
    { const dy = gy - (this.gyPrev ?? gy); this.gyPrev = gy; if (Math.abs(this.vx) > 1.5 && Math.abs(dy) > 0.02) { this.bump = Math.max(this.bump || 0, Math.min(1, Math.abs(dy) * 8 * Math.min(1, Math.abs(this.vx) / 8))); this.pv += -dy * 6; this.rv += (Math.random() - 0.5) * dy * 8; } }
    // ブレーキランプ：ブレーキ入力中か、完全停止直後1秒だけ
    if (Math.abs(this.vx) < 0.05) this.stopT += dt; else this.stopT = 0;
    this.braking = brk > 0.05 || (this.stopT > 0 && this.stopT < 1);
    // スタック検出：アクセルを踏んでいるのに3秒まったく動けない
    if (thr > 0.5) {
      this.stuckT += dt;
      if (Math.hypot(this.x - this.stuckP[0], this.z - this.stuckP[1]) > 0.6) { this.stuckT = 0; this.stuckP = [this.x, this.z]; }
      if (this.stuckT > 3) { this.stuckT = 0; this.stuckP = [this.x, this.z]; this.needRescue = true; }
    } else { this.stuckT = 0; this.stuckP = [this.x, this.z]; }
  }
  corners() {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), hl = MIRA.L / 2, hw = MIRA.W / 2, out = [];
    for (const [lx, lz] of [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl], [hw, 0], [-hw, 0], [0, hl], [0, -hl]]) out.push([this.x + lx * c + lz * s, this.z - lx * s + lz * c]);
    return out;
  }
  collide(ox, oz, npcs, dt = 0.008) {
    const city = this.city;
    // 市の外周と川：見えない壁として扱い、壁と同じく法線方向だけ止めて滑らせる（位置を戻して止める方式だと抜け出せなくなる）
    if (!city.ld) { const Lb = 2040; let bn = null; // 長距離ドライブのコース（city.ld）には市の外周・水瀬川の見えない壁はない
      for (const p of this.corners()) {
        let nx = 0, nz = 0, d = 0;
        if (p[0] > Lb) { nx = -1; d = p[0] - Lb; } else if (p[0] < -Lb) { nx = 1; d = -Lb - p[0]; }
        else if (p[1] > Lb) { nz = -1; d = p[1] - Lb; } else if (p[1] < -Lb) { nz = 1; d = -Lb - p[1]; }
        else if (p[1] > 530 && p[1] < 600 && this.y < 0.6 && !(city.bridges || []).some(b => Math.abs(p[0] - b.x) < b.hw + 0.4)) { if (this.z < 565) { nz = -1; d = p[1] - 530; } else { nz = 1; d = 600 - p[1]; } }
        if (d > 0 && (!bn || d > bn.d)) bn = { nx, nz, d, river: Math.abs(p[0]) <= Lb && Math.abs(p[1]) <= Lb };
      }
      if (bn) { this.x += bn.nx * bn.d; this.z += bn.nz * bn.d; this.contact(bn.nx, bn.nz, bn.d, dt); this.edgeHit = bn.river ? 2 : 1; }
    }
    for (let it = 0; it < 2; it++) {
      const boxes = city.query(this.x, this.z, 3);
      let pushX = 0, pushZ = 0;
      const yy = this.y;
      for (const p of this.corners()) for (const b of boxes) {
        if (yy + 1.3 < b.y0 || yy + 0.35 > b.y1 || b.kind === 'p') continue;
        if (b.nb != null && !city.shopCarsOn(b.nb, this.hour ?? 12)) continue; // 閉店後に帰った駐車車両 // 高さ35cm未満の段差（縁石・水路の縁など）は乗り越えられる
        if (p[0] > b.x0 && p[0] < b.x1 && p[1] > b.z0 && p[1] < b.z1) {
          const dl = p[0] - b.x0, dr = b.x1 - p[0], dt2 = p[1] - b.z0, db = b.z1 - p[1], m = Math.min(dl, dr, dt2, db);
          let px = 0, pz = 0;
          if (m === dl) px = -dl; else if (m === dr) px = dr; else if (m === dt2) pz = -dt2; else pz = db;
          if (Math.abs(px) > Math.abs(pushX)) pushX = px; if (Math.abs(pz) > Math.abs(pushZ)) pushZ = pz;
        }
      }
      // 柱・樹木・標識など（円柱として扱う）
      for (const b of boxes) if (b.kind === 'p' && !(yy + 1.3 < b.y0 || yy > b.y1)) {
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = Math.max(0.25, (b.x1 - b.x0) / 2);
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = cx - this.x, dz = cz - this.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c, hw = MIRA.W / 2 + r, hl = MIRA.L / 2 + r;
        if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
          const pl = hw - Math.abs(lx), pf = hl - Math.abs(lz);
          if (pl < pf) { const k = -Math.sign(lx) * pl; pushX += k * c; pushZ += -k * s; } else { const k = -Math.sign(lz) * pf; pushX += k * s; pushZ += k * c; }
        }
      }
      if (pushX || pushZ) { this.x += pushX; this.z += pushZ; const l = Math.hypot(pushX, pushZ); this.contact(pushX / l, pushZ / l, l, dt); } else break;
    }
    // 線分の壁：法線方向だけ止め、接線方向には滑る
    for (const w of this.city.wallsNear(this.x, this.z, 4)) {
      if (this.y + 1.2 < w.y0 || this.y > w.y1) continue;
      const vx = w.x1 - w.x0, vz = w.z1 - w.z0, L2 = vx * vx + vz * vz || 1;
      for (const p of this.corners()) {
        const t = clamp(((p[0] - w.x0) * vx + (p[1] - w.z0) * vz) / L2, 0, 1), qx = p[0] - (w.x0 + vx * t), qz = p[1] - (w.z0 + vz * t), d = Math.hypot(qx, qz);
        if (d < 0.25) {
          let nx, nz;
          const cx = this.x - (w.x0 + vx * t), cz = this.z - (w.z0 + vz * t), cl = Math.hypot(cx, cz) || 1;
          if (d > 1e-5) { nx = qx / d; nz = qz / d; if (nx * cx + nz * cz < 0) { nx = -nx; nz = -nz; } } else { nx = cx / cl; nz = cz / cl; }
          const k = 0.25 - d; this.x += nx * k; this.z += nz * k; this.contact(nx, nz, k, dt);
        }
      }
    }
    // NPC車両：車体中心どうしを結ぶ方向に確実に押し分け、相手も止める
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const parts = [];
    for (const n0 of npcs) { if (n0.m.semi && n0.tr) { const S = n0.m.semi; parts.push({ x: n0.tr.x, z: n0.tr.z, yaw: n0.tr.yaw, y: n0.y, m: { L: S.tL, W: n0.m.W }, src: n0 }, { x: n0.trl.x, z: n0.trl.z, yaw: n0.trl.yaw, y: n0.y, m: { L: S.kL, W: n0.m.W }, src: n0 }); } else parts.push(n0); }
    for (const n of parts) {
      const dx = n.x - this.x, dz = n.z - this.z;
      if (dx * dx + dz * dz > (n.m.L > 9 ? 100 : 49) || Math.abs((n.y || 0) - this.y) > 3) continue;
      const nc = Math.cos(n.yaw), ns = Math.sin(n.yaw), nl = n.m.L / 2 - n.m.W / 2, nr = n.m.W / 2;
      const bs = n.m.L > 7 ? [-nl, -nl * 0.66, -nl * 0.33, 0, nl * 0.33, nl * 0.66, nl] : [-nl, 0, nl];
      let deep = 0, px0 = 0, pz0 = 0;
      for (const a of [-1.1, 0, 1.1]) {
        const px = this.x + s * a, pz = this.z + c * a;
        for (const b of bs) {
          const qx = n.x + ns * b, qz = n.z + nc * b;
          const ex = px - qx, ez = pz - qz, d = Math.hypot(ex, ez), r = 0.72 + nr;
          if (d < r) { const k = r - d; if (k > deep) { deep = k; if (d > 0.05) { px0 = ex / d; pz0 = ez / d; } else { px0 = -dx; pz0 = -dz; } } }
        }
      }
      if (deep > 0) {
        // めり込みが深いときは車体中心どうしの向きで分離（方向が定まらず固定されるのを防ぐ）
        if (deep > 0.4) { const l = Math.hypot(dx, dz) || 1; px0 = -dx / l; pz0 = -dz / l; }
        const l = Math.hypot(px0, pz0) || 1; px0 /= l; pz0 /= l;
        this.x += px0 * deep; this.z += pz0 * deep;
        this.contact(px0, pz0, deep, dt, n.m.L > 6 ? 0.3 : 0.55);
        const nn = n.src || n; nn.hitT = 4; nn.hazard = 4; nn.pushedBy = { x: this.x, z: this.z };
      }
    }
  }
  // 接触応答：法線方向の速度だけ消す（浅い角度なら滑り続ける）。新しい衝突のときだけ衝撃を記録
  contact(nx, nz, depth, dt, massK = 1) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    let wx = s * this.vx + c * this.vy, wz = c * this.vx - s * this.vy;
    const sp0 = Math.hypot(wx, wz);
    if (nx || nz) {
      const vn = wx * nx + wz * nz;
      if (vn < 0) {
        const imp = -vn;
        wx -= vn * nx * (1 + 0.2 * Math.min(1, imp / 5)); wz -= vn * nz * (1 + 0.2 * Math.min(1, imp / 5));
        // 接線方向の摩擦（正面衝突ほど強く減速）
        // 当たり続けている間（0.3秒以内の再接触）は、タイヤが向きを戻すぶんの法線成分で何度も減速しないようにする
        const sus = this.cT != null && this.T0 - this.cT < 0.3 && imp < 2.5; this.cT = this.T0 || 0;
        // 修正96：こすり続けている間の減速は時間あたりで決める（以前はフレームごとに約1%ずつ減り、120fpsでは1秒で約75%も落ちていた）。
        // 浅い角度（15度前後）でガードレールに沿って滑るときの減速は約1.2〜2m/s²
        const fk = sus ? 1 - dt * (0.1 + 0.25 * Math.min(1, imp / 3)) : (Math.max(0, 1 - imp / Math.max(sp0, 0.1) * (imp < 3 ? 0.3 : 0.6) * massK)) * 0.5 + 0.5 * (1 - dt * 0.35);
        wx *= fk; wz *= fk;
        if (imp > 1.2) this.hit = Math.max(this.hit, Math.min(1, imp / 8));
      }
    } else { wx *= -0.2; wz *= -0.2; }
    this.vx = wx * s + wz * c; this.vy = wx * c - wz * s;
    this.w *= 1 - Math.min(1, dt * 6);
    // 壁に押し付けたままハンドルを切ってアクセルを踏んだら、その場で向きを変えられるようにする（壁際で動けなくなるのを防ぐ）
    const inp = this.input || {};
    // 浅い角度で壁に当たったまま進むときは、車の向きを壁に沿わせて滑らせる（こすったまま止まってしまうのを防ぐ）
    if ((nx || nz) && Math.abs(this.vx) > 0.3) {
      const hx = Math.sin(this.yaw) * Math.sign(this.vx), hz = Math.cos(this.yaw) * Math.sign(this.vx), into = -(hx * nx + hz * nz);
      if (into > 0.02 && into < 0.8) { let tx = -nz, tz = nx; if (tx * hx + tz * hz < 0) { tx = -tx; tz = -tz; } const want = Math.atan2(tx * Math.sign(this.vx), tz * Math.sign(this.vx)); let d = want - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.yaw += clamp(d, -6 * dt, 6 * dt); this.scrapeYaw = want; this.scrapeT = 0.5; }
    }
    if ((nx || nz) && inp.thr > 0.3 && Math.abs(this.steer) > 0.05) { const sg = Math.sign(this.steer) * (this.gear === 'R' ? -1 : 1); if (Math.abs(this.w) < 0.6) this.w = sg * 0.6; this.wallPivot = 0.15; }
    void depth;
  }
}
