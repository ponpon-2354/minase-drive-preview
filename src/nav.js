// 全体マップ画面（ドラッグ・拡大縮小）、目的地設定、最短経路案内（ダイクストラ法）、ミニマップへの経路表示
export const LABELS = [['水瀬駅', -60, -420], ['商店街', -250, -200], ['オフィス街', 250, -250], ['本町通り', 0, 25], ['駅前ロータリー', -60, -330], ['国道ロードサイド', 1300, -40], ['水瀬バイパス', 1000, 200], ['水瀬工業団地', -1750, 0], ['郊外住宅地', -1000, -760], ['郊外住宅地', 700, -760], ['水瀬川', 0, 565], ['田園地帯', -1000, 1300], ['みなせ峠', 0, -1450], ['道の駅 みなせ峠', -470, -1530], ['水瀬トンネル', 0, -1692], ['学園地区', 500, 1150], ['ニュータウン（若葉台）', 1500, 1150], ['旧水瀬街道', -1250, -760], ['市役所', 250, -250], ['中央公園', -125, 60]];
const MAJOR = new Set(['station', 'univ', 'school', 'koban', 'temple', 'farm', 'park', 'view', 'hosp']);
const POI_ICON = { bus: ['#2b7', 'バ'], koban: ['#24a', '交'], bridge: ['#864', '橋'], univ: ['#1d3c6e', '大'], school: ['#1f5d2c', '文'], park: ['#3a8a3a', '園'], conv: ['#1f8a4c', 'コ'], food: ['#c0392b', '食'], shop: ['#b8742a', '店'], temple: ['#555', '卍'], farm: ['#6b8e23', '農'], view: ['#2a6', '展'], station: ['#1d4fa0', '駅'], hosp: ['#c0392b', '病'] };

export function installNav(city, ui) {
  const N = city.nodes, E = city.edges;
  let dest = null, route = null, offT = 0, lastPlan = -9, cv = null, view = null, img = null, geo = null;
  const nearestEdge = (x, z, yaw) => {
    let best = null, bd = 1e9;
    for (const e of E) {
      let s0 = 0;
      for (let i = 0; i < e.pts.length - 1; i++) {
        const a = e.pts[i], b = e.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l = Math.hypot(vx, vz) || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (l * l)));
        const d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z) + (yaw == null ? 0 : (1 - Math.cos(Math.atan2(vx, vz) - yaw)) * 12);
        if (d < bd) { bd = d; best = { e, s: s0 + l * t, d }; }
        s0 += l;
      }
    }
    return best;
  };
  const nearestNode = (x, z) => { let b = null, bd = 1e9; for (const n of N) { if (!n.out.length) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } } return b; };
  // ダイクストラ（ノード数は数百なので単純な配列で十分）
  function plan(p) {
    const st = nearestEdge(p.x, p.z, p.yaw); if (!st || !dest) return null;
    const goal = nearestNode(dest.x, dest.z); if (!goal) return null;
    const dist = new Float64Array(N.length).fill(Infinity), prev = new Int32Array(N.length).fill(-1), done = new Uint8Array(N.length);
    const s0 = st.e.to; dist[s0] = st.e.len - st.s;
    for (;;) {
      let u = -1, bd = Infinity; for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === goal.id) break; done[u] = 1;
      for (const eid of N[u].out) { const e = E[eid], c = bd + e.len + (e.sp.kind === 'minor' ? e.len * 0.3 : 0) + 8; if (c < dist[e.to]) { dist[e.to] = c; prev[e.to] = eid; } }
    }
    if (!isFinite(dist[goal.id])) return null;
    const list = []; for (let v = goal.id; v !== s0; ) { const eid = prev[v]; if (eid < 0) break; list.unshift(E[eid]); v = E[eid].from; }
    list.unshift(st.e);
    const pts = []; for (const e of list) for (const q of e.pts) pts.push(q);
    pts.push([dest.x, dest.z]);
    return { edges: list, pts, startS: st.s, len: dist[goal.id] };
  }
  const turnAt = (a, b) => { const c = a.dEnd[0] * b.d[1] - a.dEnd[1] * b.d[0], d = a.dEnd[0] * b.d[0] + a.dEnd[1] * b.d[1]; return d > 0.7 ? 0 : c > 0 ? 1 : -1; }; // 1=右 -1=左（z前方・x右手系ではなく画面座標）
  function guidance(p) {
    if (!route) return null;
    const cur = nearestEdge(p.x, p.z, p.yaw); let idx = route.edges.indexOf(cur && cur.e);
    if (idx < 0) return null;
    let d = cur.e.len - cur.s;
    for (let i = idx; i < route.edges.length - 1; i++) {
      const t = turnAt(route.edges[i], route.edges[i + 1]);
      if (t !== 0) return { turn: t, d };
      d += route.edges[i + 1].len;
    }
    return { turn: 0, d: d + 0 };
  }
  function offRoute(p) {
    let bd = 1e9; const P = route.pts;
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / l2)); bd = Math.min(bd, Math.hypot(a[0] + vx * t - p.x, a[1] + vz * t - p.z)); }
    return bd;
  }
  const api = {
    get dest() { return dest; }, get route() { return route; },
    set(x, z) { dest = { x, z }; route = plan(ui.player); lastPlan = performance.now() / 1000; if (!route) ui.toast('そこまでの道が見つかりません'); else ui.toast(`目的地を設定しました（約${(route.len / 1000).toFixed(1)}km）`, 1800); if (cv) drawMap(); },
    clear() { dest = null; route = null; if (cv) drawMap(); },
    update(dt) {
      const p = ui.player, el = ui.$('nav');
      if (!dest) { el.classList.remove('on'); return; }
      const dd = Math.hypot(p.x - dest.x, p.z - dest.z);
      if (dd < 50) { ui.toast('目的地に到着しました', 2200); api.clear(); el.classList.remove('on'); return; }
      if (route && offRoute(p) > 22) offT += dt; else offT = 0;
      const now = performance.now() / 1000;
      // ルートを外れたら1秒で再検索（3秒以内に新しいルートを表示）
      if ((offT > 1 || !route) && now - lastPlan > 1.5) { const t0 = now; lastPlan = now; const had = !!route; if (had) { el.textContent = 'ルートを再検索しています…'; api.lastReroute = { off: t0 - offT }; } offT = 0; route = plan(p); if (route && had) { ui.toast('ルートを再検索しました', 1200); api.lastReroute.done = performance.now() / 1000; } }
      const g = guidance(p);
      el.classList.add('on');
      el.textContent = g ? `${g.turn < 0 ? '⬅ 左折' : g.turn > 0 ? '➡ 右折' : '⬆ 直進'} ${g.d < 1000 ? Math.round(g.d / 10) * 10 + 'm' : (g.d / 1000).toFixed(1) + 'km'}　目的地まで ${(dd / 1000).toFixed(1)}km` : `目的地まで ${(dd / 1000).toFixed(1)}km（ルート外）`;
    },
    // ミニマップ上に経路と目的地を描く（MM座標）
    drawMini(c, X, Z, k) {
      if (route) { c.strokeStyle = 'rgba(80,170,255,.95)'; c.lineWidth = 4 / k; c.beginPath(); route.pts.forEach((q, i) => i ? c.lineTo(X(q[0]), Z(q[1])) : c.moveTo(X(q[0]), Z(q[1]))); c.stroke(); }
      if (dest) { c.fillStyle = '#ff4b3a'; c.beginPath(); c.arc(X(dest.x), Z(dest.z), 5 / k, 0, 7); c.fill(); }
    },
    open(MM, x0, z0, s) {
      img = MM; geo = { x0, z0, s }; cv = ui.$('mapC');
      const p = ui.player; view = view || { k: 1.6, cx: p.x, cz: p.z }; view.cx = p.x; view.cz = p.z;
      if (!cv.bound) bind(); drawMap();
    },
    close() { cv = null; }
  };
  function W2S(x, z) { const w = cv.width, h = cv.height; return [w / 2 + (x - view.cx) * geo.s * view.k * devicePixelRatio, h / 2 + (z - view.cz) * geo.s * view.k * devicePixelRatio]; }
  function S2W(sx, sy) { const w = cv.width, h = cv.height; return [view.cx + (sx - w / 2) / (geo.s * view.k * devicePixelRatio), view.cz + (sy - h / 2) / (geo.s * view.k * devicePixelRatio)]; }
  function drawMap() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = devicePixelRatio; cv.width = r.width * dpr; cv.height = r.height * dpr;
    const c = cv.getContext('2d'), k = view.k * dpr;
    c.fillStyle = '#1a2418'; c.fillRect(0, 0, cv.width, cv.height);
    c.save(); c.translate(cv.width / 2, cv.height / 2); c.scale(k, k); c.translate(-(view.cx - geo.x0) * geo.s, -(view.cz - geo.z0) * geo.s);
    c.imageSmoothingEnabled = view.k < 3; c.drawImage(img, 0, 0);
    api.drawMini(c, x => (x - geo.x0) * geo.s, z => (z - geo.z0) * geo.s, view.k);
    c.restore();
    // 地名・施設
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // 修正97-5：地名の文字はズームに応じて大きく（等倍で16px、拡大するほど最大28pxまで）。スマホでも読める大きさを確保
    const fs = Math.max(16, Math.min(28, 16 + 6 * Math.log2(Math.max(1, view.k))));
    for (const [n, x, z] of LABELS) { const [sx, sy] = W2S(x, z); c.font = `800 ${fs * dpr}px sans-serif`; c.lineWidth = 5 * dpr; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(n, sx, sy); c.fillStyle = '#ffe9b8'; c.fillText(n, sx, sy); }
    // ズーム段階：〜1.2倍＝地区名、〜3倍＝主要施設、3倍〜＝店舗・バス停まで
    for (const q of city.pois || []) { const ic = POI_ICON[q.t]; if (!ic) continue; if (view.k < 1.2 || (view.k < 3 && !MAJOR.has(q.t))) continue; const [sx, sy] = W2S(q.x, q.z); c.fillStyle = ic[0]; c.beginPath(); c.arc(sx, sy, 10 * dpr, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = `800 ${12 * dpr}px sans-serif`; c.fillText(ic[1], sx, sy); if ((view.k > 4 || MAJOR.has(q.t)) && q.name) { c.font = `700 ${Math.min(18, 13 + view.k * 0.6) * dpr}px sans-serif`; c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(q.name, sx, sy + 20 * dpr); c.fillText(q.name, sx, sy + 20 * dpr); } }
    // 自車
    const p = ui.player, [px, py] = W2S(p.x, p.z);
    c.save(); c.translate(px, py); c.rotate(Math.PI - p.yaw); c.fillStyle = '#ffb63a'; c.beginPath(); c.moveTo(0, -14 * dpr); c.lineTo(-9 * dpr, 10 * dpr); c.lineTo(0, 5 * dpr); c.lineTo(9 * dpr, 10 * dpr); c.fill(); c.restore();
    c.fillStyle = '#fff'; c.font = `800 ${16 * dpr}px sans-serif`; c.fillText('N↑', 30 * dpr, 30 * dpr);
  }
  function bind() {
    cv.bound = true; const pts = new Map(); let moved = 0, pinch = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId), dx = e.clientX - o[0], dy = e.clientY - o[1];
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); view.cx -= dx / (geo.s * view.k); view.cz -= dy / (geo.s * view.k); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) view.k = Math.max(0.5, Math.min(8, view.k * d / pinch)); pinch = d; moved = 99; }
      drawMap();
    });
    const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size === 0 && moved < 8 && e.type === 'pointerup') { const r = cv.getBoundingClientRect(), w = S2W((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio); api.set(w[0], w[1]); } if (pts.size < 2) pinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); view.k = Math.max(0.5, Math.min(8, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); drawMap(); }, { passive: false });
    addEventListener('resize', () => drawMap());
  }
  return api;
}
