// 長距離ドライブモードのムービー（休憩：4季節×1〜3人、到着：4季節×1〜3人 ＝ 24通り）
// 3Dの人物と3Dの場面を、カメラの移動・人物の動作（食べる・飲む・話す・眺める・寝そべる・歩く）・表情の切り替えで見せる。
// 画面の文字（字幕・時刻）はHTMLで重ねる。スキップしても休憩・時刻・クリアの処理は呼び出し側で必ず行う。
import { GB } from './geo.js?v=0.9.3';
import { L, FONT, renderLayer } from './textures.js?v=0.9.3';
import { rng, clamp, lerp } from './math.js?v=0.9.3';
import { buildChar, buildFace, headPos, charHeight } from './passengers.js?v=0.9.3';
import { MENU, MOVIE, mealFor, voiceKey } from './ld_lines.js?v=0.9.3';

const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const V = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---- 料理・飲み物（季節と施設で変える）：メニューは会話側（ld_events）と共用（修正115） ----
function dishMesh(g, x, y, z, season, kind, R) { // 料理の見た目（器と中身の色）
  const bowl = { c: [0.85, 0.2, 0.15] }, white = { c: [0.97, 0.96, 0.93] };
  if (kind === 0) { // 主食（どんぶり・皿）
    g.cyl(x, y, z, 0.11, 0.07, 12, season === 'winter' ? { c: [0.15, 0.15, 0.17] } : white);
    const top = { spring: [0.55, 0.42, 0.28], summer: [0.98, 0.85, 0.3], autumn: [0.62, 0.42, 0.25], winter: [0.85, 0.6, 0.3] }[season];
    g.cyl(x, y + 0.06, z, 0.095, 0.012, 12, { c: top }); if (season === 'summer') { g.box(x - 0.05, y + 0.072, z - 0.02, x + 0.05, y + 0.08, z + 0.01, { c: [0.9, 0.2, 0.2] }); g.box(x - 0.02, y + 0.072, z + 0.02, x + 0.06, y + 0.08, z + 0.05, { c: [0.3, 0.7, 0.3] }); }
    if (season === 'winter') g.box(x - 0.04, y + 0.072, z - 0.03, x + 0.0, y + 0.08, z + 0.03, { c: [0.98, 0.92, 0.8] });
  } else if (kind === 1) { // 副菜・甘味
    if (season === 'summer') { g.cyl(x, y, z, 0.05, 0.05, 8, { c: [0.75, 0.85, 0.95] }); g.cyl(x, y + 0.05, z, 0.055, 0.06, 8, { c: [0.98, 0.4, 0.45] }); }
    else if (season === 'spring') { g.box(x - 0.08, y, z - 0.05, x + 0.08, y + 0.015, z + 0.05, { c: [0.3, 0.5, 0.3] }); for (const dx of [-0.04, 0.04]) g.cbox(x + dx, y + 0.03, z, 0.06, 0.035, 0.05, { c: [0.98, 0.72, 0.8] }); }
    else { g.cyl(x, y, z, 0.07, 0.05, 10, bowl); g.cyl(x, y + 0.045, z, 0.06, 0.01, 10, { c: season === 'autumn' ? [0.95, 0.75, 0.35] : [0.9, 0.82, 0.6] }); }
  } else { // 飲み物（夏は冷たいグラス、それ以外は湯のみ・マグ）
    if (season === 'summer') { g.cyl(x, y, z, 0.035, 0.12, 8, { c: [0.65, 0.4, 0.25] }); g.cyl(x, y + 0.1, z, 0.037, 0.02, 8, { c: [0.9, 0.95, 1] }); }
    else g.cyl(x, y, z, 0.04, 0.08, 8, { c: season === 'spring' ? [0.6, 0.75, 0.45] : [0.9, 0.88, 0.82] });
  }
  void R;
}
// ---- 文字のテクスチャ（ムービー用：DYN90〜95 を使う） ----
let dynK = 90; // 90〜95（0〜89 は長距離コースの標識が使う）
function textLay(R, txt, bg = '#3a2a1a', fg = '#fff') { const k = dynK++; if (dynK > 95) dynK = 90; const lay = L['DYN' + k]; R.setLayer(lay, renderLayer(ctx => { ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.scale(1, 4); let sz = 40; ctx.font = `800 ${sz}px ${FONT}`; const w = ctx.measureText(txt).width; if (w > 236) { sz *= 236 / w; ctx.font = `800 ${sz}px ${FONT}`; } ctx.fillText(txt, 128, 32); ctx.restore(); })); return lay; }
function patternLay(R, kind) { const k = dynK++; if (dynK > 95) dynK = 90; const lay = L['DYN' + k]; R.setLayer(lay, renderLayer(ctx => {
  if (kind === 'tatami') { ctx.fillStyle = '#c9c48a'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = 'rgba(120,115,60,.35)'; ctx.lineWidth = 2; for (let y = 0; y < 256; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); } ctx.fillStyle = '#3a4a2a'; ctx.fillRect(0, 0, 256, 10); ctx.fillRect(0, 246, 256, 10); }
  else if (kind === 'shoji') { ctx.fillStyle = '#f4efe2'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 6; for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); } for (let y = 0; y <= 256; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); } }
  else if (kind === 'sheet') { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#2f6fd0' : '#f2f4f8'; ctx.fillRect(x * 32, y * 32, 32, 32); } }
  else if (kind === 'tile') { ctx.fillStyle = '#d8d2c6'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#b8b0a2'; ctx.lineWidth = 3; for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(256, x); ctx.stroke(); } }
  else if (kind === 'wood') { ctx.fillStyle = '#b08458'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = 'rgba(80,50,25,.35)'; for (let y = 0; y < 256; y += 32) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); for (let x = 0; x < 256; x += 20) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 6 + (x % 7)); ctx.lineTo(x + 14, y + 8 + (x % 5)); ctx.stroke(); } } }
  else if (kind === 'yukata') { ctx.fillStyle = '#1e3a6e'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 3; for (let y = 16; y < 256; y += 40) for (let x = 16; x < 256; x += 40) { ctx.beginPath(); ctx.arc(x + (y % 80 ? 20 : 0), y, 9, 0, 7); ctx.stroke(); } }
})); return lay; }

// ---- 屋外の背景（窓の外・場面の奥）：季節の木・山・空 ----
function tree(g, kind, x, y, z, s, R) {
  if (kind === 'sakura') { g.cyl(x, y, z, 0.2 * s, 2.6 * s, 6, { c: [0.35, 0.25, 0.22] }); for (let k = 0; k < 5; k++) { const a = k * 1.3 + R(); g.cbox(x + Math.cos(a) * 1.1 * s, y + 3.3 * s + R() * s, z + Math.sin(a) * 1.1 * s, 2.4 * s, 1.7 * s, 2.4 * s, { c: [1, 0.78 + R() * 0.08, 0.86] }); } return; }
  if (kind === 'maple') { const c = [[0.92, 0.25, 0.12], [0.95, 0.5, 0.12], [0.95, 0.72, 0.2]][(R() * 3) | 0]; g.cyl(x, y, z, 0.15 * s, 2.5 * s, 6, { c: [0.35, 0.25, 0.2] }); g.cbox(x, y + 3.4 * s, z, 3.2 * s, 2.4 * s, 3.2 * s, { c }); g.cbox(x + 0.5 * s, y + 4.5 * s, z, 2 * s, 1.4 * s, 2 * s, { c }); return; }
  if (kind === 'snowpine' || kind === 'pine') { g.cyl(x, y, z, 0.2 * s, 1.5 * s, 5, { c: [0.35, 0.25, 0.2] }); for (let l = 0; l < 3; l++) { const y0 = y + 1.2 * s + l * 1.8 * s, r = 1.9 * s * (1 - l * 0.28); for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.283, a1 = (k + 1) / 6 * 6.283; g.tri([x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x, y0 + 2.4 * s, z], { c: kind === 'pine' ? [0.28, 0.48, 0.32] : [0.93, 0.95, 1] }, [0, 0], [0, 0], [0, 0], [x, y0 - 1, z]); } } return; }
  if (kind === 'birch') { g.cyl(x, y, z, 0.12 * s, 4.4 * s, 6, { c: [0.95, 0.94, 0.9] }); g.cbox(x, y + 5 * s, z, 2.4 * s, 2.4 * s, 2.4 * s, { c: [0.45, 0.72, 0.32], lay: L.TREE }); return; }
  g.cyl(x, y, z, 0.17 * s, 2.6 * s, 6, { c: [0.35, 0.25, 0.2] }); g.cbox(x, y + 3.8 * s, z, 3.5 * s, 3 * s, 3.5 * s, { c: [0.3 + R() * 0.1, 0.56, 0.26], lay: L.TREE });
}
const TREE = { spring: 'sakura', summer: 'green', autumn: 'maple', winter: 'snowpine' };
function outside(g, season, z0, R, opt = {}) { // z0 から奥に広がる景色
  const gc = { spring: [0.55, 0.78, 0.4], summer: [0.36, 0.64, 0.28], autumn: [0.68, 0.56, 0.3], winter: [0.95, 0.96, 1] }[season];
  for (let x = -60; x < 60; x += 20) for (let z = z0; z < z0 + 120; z += 20) g.flat(x, z, x + 20, z + 20, opt.y || 0, { c: gc, lay: season === 'winter' ? L.WHITE : L.GRASS }, 6);
  for (let k = 0; k < (opt.n || 16); k++) tree(g, TREE[season], -40 + R() * 80, opt.y || 0, z0 + 8 + R() * 50, 0.9 + R() * 0.6, R);
  const mc = season === 'winter' ? [0.9, 0.92, 0.97] : season === 'autumn' ? [0.75, 0.45, 0.28] : [0.4, 0.58, 0.48];
  for (let k = 0; k < 7; k++) { const x = -150 + k * 50 + R() * 20, z = z0 + 160 + R() * 60, r = 60 + R() * 50, h = 40 + R() * 50; for (let s = 0; s < 6; s++) { const a0 = s / 6 * 6.283, a1 = (s + 1) / 6 * 6.283; g.tri([x + Math.cos(a0) * r, -2, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, -2, z + Math.sin(a1) * r], [x, h, z], { c: mc, mat: 9 }, [0, 0], [0, 0], [0, 0], [x, h / 3, z]); } }
}
// 3D頂点をx軸まわりに回す（ハンモックで寝そべる姿勢）
function rotX(g, i0, ang, cy, cz) { const a = g.a, c = Math.cos(ang), s = Math.sin(ang); for (let i = i0; i < a.length; i += 13) { const y = a[i + 1] - cy, z = a[i + 2] - cz; a[i + 1] = cy + y * c - z * s; a[i + 2] = cz + y * s + z * c; const ny = a[i + 4], nz = a[i + 5]; a[i + 4] = ny * c - nz * s; a[i + 5] = ny * s + nz * c; } }

// ---- セリフ（人数・季節・場面別）。role: driver / p1 / p2、mono は心の声 ----
// 修正115：休憩で食べるもの（meal）は会話側と同じ値（longdrive が ld_events.restStart で決めて info.meal に入れる）。
// 修正118：同乗者のセリフは性別×年齢帯（ld_lines.js の MOVIE）で変える
function lines(kind, season, n, party, fac, meal) {
  const p1 = party[1], p2 = party[2], kid = q => q && q.ch.age === 'child', k1 = p1 && voiceKey(p1.ch), k2 = p2 && voiceKey(p2.ch);
  const M = meal || mealFor(fac ? fac.type : 'SA', season), fill = t => t.replace(/\{dest\}/g, DEST[season]);
  const pick = (tbl, k, i, alt) => { const a = MOVIE[tbl][k]; return a[(alt && k1 === k2 ? i + 1 : i) % a.length]; };
  if (kind === 'rest') {
    if (n === 1) return [['mono', `（${fac.name}でひと休み。${M.main}にしよう）`], ['mono', `（${{ spring: '窓の外の桜がきれいだ', summer: '外は暑いけど、ここは涼しい', autumn: '山がすっかり色づいている', winter: '外は一面の銀世界だ' }[season]}）`], ['mono', '（目的地まで、あと少し。ゆっくり休んでいこう）']];
    const it1 = M.req || (kid(p1) ? M.sweet : M.main), it2 = kid(p2) ? M.sweet : M.drink;
    const out = [['driver', `${M.main}にしてよかった。いただきます`], ['p1', pick('rest', k1, 0).replace('{item}', it1)]];
    if (n >= 3) out.push(['p2', pick('rest', k2, 0).replace('{item}', it2)]);
    out.push(['driver', `${{ spring: '桜が満開だったね', summer: '海がきらきらしてたね', autumn: '紅葉がすごかったね', winter: 'あの雪の壁、高かったね' }[season]}`], ['p1', pick('rest', k1, 1)]);
    if (n >= 3) out.push(['p2', pick('rest', k2, 1, true)]);
    out.push(['p1', pick('rest', k1, 2)]);
    return out;
  }
  if (n === 1) return [['mono', `（${DEST[season]}に着いた。400km、走りきった）`], ['mono', `（${{ spring: '満開の桜の下で、ひとりのお花見', summer: 'ハンモックに揺られて、風の音を聞く', autumn: '紅葉を眺めながら、温かいお茶を一杯', winter: '雪見の露天風呂。体の芯まで温まる' }[season]}）`], ['mono', '（いい旅だった）']];
  const out = [['p1', fill(pick('arrive', k1, 0))]];
  if (n >= 3) out.push(['p2', fill(pick('arrive', k2, 0, true))]);
  out.push(['driver', `${{ spring: '桜、満開だね', summer: '涼しくて気持ちいいね', autumn: '窓の外、真っ赤だね', winter: '足湯、あったかいね' }[season]}`], ['p1', fill(pick('arrive', k1, 1))]);
  if (n >= 3) out.push(['p2', fill(pick('arrive', k2, 1, true))]);
  out.push(['driver', n >= 3 ? 'みんなで記念にもう一枚' : 'また一緒に来よう']);
  return out;
}
const DEST = { spring: '桜ヶ丘城', summer: '青凪高原', autumn: '楓見山荘', winter: '雪灯温泉郷' };

// ======== 場面の組み立て ========
// 返す値：{ env: GB, dyn: [{ g, m(t) }], actors: [{ ch, at:[x,y,z], yaw, base:'sit'|'floor'|..., poses:{name:opt}, act(t, talking) }], shots: [...], light, particles, title }
function sceneRest(R, season, party, fac, rnd) {
  const n = party.length, g = new GB(), type = fac.type, wood = type === 'MICHI', PA = type === 'PA';
  const floorLay = patternLay(R, wood ? 'wood' : 'tile');
  const actors = [], dyn = [];
  if (PA) { // PA：展望スペースのベンチ（外）
    outside(g, season, 4, rnd, { n: 20, y: -0.6 });
    for (let x = -10; x < 10; x += 4) for (let z = -8; z < 4; z += 4) g.flat(x, z, x + 4, z + 4, 0, { c: [0.75, 0.6, 0.45], lay: floorLay }, 2);
    for (let x = -6; x <= 6; x += 1) g.box(x - 0.04, 0, 3.9, x + 0.04, 1.05, 4.0, { c: [0.45, 0.33, 0.22] }); g.box(-6, 1.0, 3.9, 6, 1.08, 4.02, { c: [0.45, 0.33, 0.22] });
    for (let k = 0; k < 3; k++) g.box(-7 + k * 1.1, 0, -4, -6.2 + k * 1.1, 1.85, -3.3, { c: [[0.85, 0.2, 0.2], [0.2, 0.4, 0.8], [0.95, 0.95, 0.95]][k], mat: 18 });
    g.panel(-7.2, -3.25, -4, -3.25, 1.9, 2.4, 0.01, [0, 0, 1], { c: [1, 1, 1], mat: 16, lay: textLay(R, fac.name, '#0b6b3a') });
    g.box(-1.6, 0.42, 1.6, 1.6, 0.48, 2.1, { c: [0.6, 0.42, 0.28] }); g.box(-1.6, 0.48, 1.56, 1.6, 0.9, 1.63, { c: [0.6, 0.42, 0.28] }); /* 景色の側を向いて座るベンチ（背もたれは手前） */ for (const x of [-1.4, 1.4]) g.box(x - 0.05, 0, 1.7, x + 0.05, 0.42, 2.0, { c: [0.3, 0.3, 0.3] });
    const xs = n === 1 ? [0] : n === 2 ? [-0.4, 0.4] : [-0.75, 0, 0.75];
    party.forEach((p, i) => actors.push({ ...p, at: [xs[i], 0.48, 1.8], yaw: 0, base: 'sit', table: 0.62 }));
  } else {
    // フードコート／道の駅の食堂：床・壁・大きな窓（奥 z=+5 が窓）・天井の照明・カウンター
    for (let x = -8; x < 8; x += 4) for (let z = -6; z < 5; z += 4) g.flat(x, z, x + 4, Math.min(5, z + 4), 0, { c: [1, 1, 1], lay: floorLay }, 2);
    const wall = { c: wood ? [0.78, 0.62, 0.45] : [0.93, 0.92, 0.9] };
    g.box(-8, 0, -6.2, 8, 3.4, -6, wall); g.box(-8.2, 0, -6.2, -8, 3.4, 5.2, wall); g.box(8, 0, -6.2, 8.2, 3.4, 5.2, wall);
    g.box(-8, 3.4, -6.2, 8, 3.5, 5.2, { c: wood ? [0.55, 0.4, 0.28] : [0.95, 0.95, 0.95] });
    for (let x = -6; x <= 6; x += 3) for (const z of [-3, 1.5]) g.box(x - 0.5, 3.36, z - 0.5, x + 0.5, 3.4, z + 0.5, { c: [1, 0.96, 0.88], mat: 8 });
    g.box(-8, 0, 5, 8, 0.6, 5.2, wall); g.box(-8, 2.9, 5, 8, 3.4, 5.2, wall); for (let x = -8; x <= 8; x += 2) g.box(x - 0.05, 0.6, 5.05, x + 0.05, 2.9, 5.15, { c: [0.3, 0.3, 0.32] }); // 窓枠
    if (wood) for (let x = -7; x <= 7; x += 3.5) g.box(x - 0.12, 3.0, -6, x + 0.12, 3.25, 5, { c: [0.45, 0.3, 0.2] }); // 梁
    outside(g, season, 6, rnd, { n: 18 });
    // 奥のカウンター（店名の看板・メニュー）
    g.box(-7, 0, -6, 7, 1.05, -5.2, { c: wood ? [0.55, 0.38, 0.25] : [0.8, 0.78, 0.75] });
    const signs = wood ? ['地元の味 食堂', `名物 ${(MENU.MICHI[season])[0]}`, '地元野菜 直売'] : ['フードコート', `${(MENU.SA[season])[0]}`, '軽食・カフェ'];
    signs.forEach((t, i) => g.panel(-6 + i * 4.5, -5.95, -2.5 + i * 4.5, -5.95, 2.2, 2.9, 0.01, [0, 0, 1], { c: [1, 1, 1], mat: 16, lay: textLay(R, t, wood ? '#5a3a1a' : '#b8321e') }));
    g.panel(-3, -6.15, 3, -6.15, 2.95, 3.35, 0.01, [0, 0, 1], { c: [1, 1, 1], mat: 16, lay: textLay(R, fac.name, wood ? '#2c6e2c' : '#0b6b3a') });
    if (wood) for (let k = 0; k < 4; k++) { const x = -7.6 + k * 0.0; g.box(-7.9, 0, -4 + k * 2, -7.2, 1.4, -2.6 + k * 2, { c: [0.6, 0.45, 0.3] }); for (let j = 0; j < 4; j++) g.cbox(-7.55, 1.45, -3.8 + k * 2 + j * 0.3, 0.25, 0.12, 0.25, { c: [[0.9, 0.3, 0.2], [0.95, 0.75, 0.2], [0.4, 0.7, 0.3], [0.6, 0.35, 0.6]][(j + k) % 4] }); void x; }
    // 自分たちのテーブル（窓際）
    let tbl; if (n === 1) { tbl = [-1.5, 0.74, 4.3, 1.5, 4.8]; g.box(-3, 0.72, 4.35, 3, 0.76, 4.9, { c: [0.55, 0.4, 0.28] }); for (const x of [-2.8, 2.8]) g.box(x - 0.05, 0, 4.6, x + 0.05, 0.72, 4.7, { c: [0.3, 0.3, 0.3] }); }
    else { const w = n === 2 ? 0.45 : 0.7; tbl = [-w, 0.74, 1.6, w, 3.0]; g.box(-w, 0.72, 1.6, w, 0.76, 3.0, { c: [0.55, 0.4, 0.28] }); g.box(-0.06, 0, 2.25, 0.06, 0.72, 2.35, { c: [0.3, 0.3, 0.3] }); }
    void tbl;
    const chair = (x, z, yaw) => { g.setXf(x, 0, z, yaw); g.box(-0.22, 0.42, -0.22, 0.22, 0.46, 0.22, { c: [0.35, 0.3, 0.28] }); g.box(-0.22, 0.46, -0.25, 0.22, 0.95, -0.21, { c: [0.35, 0.3, 0.28] }); for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) g.box(dx - 0.02, 0, dz - 0.02, dx + 0.02, 0.42, dz + 0.02, { c: [0.25, 0.25, 0.25] }); g.clearXf(); };
    const seats = n === 1 ? [[0, 3.95, 0]] : n === 2 ? [[0, 1.3, 0], [0, 3.3, Math.PI]] : [[-0.35, 1.3, 0], [0.35, 1.3, 0], [0, 3.3, Math.PI]];
    // 子どもは同じ側の大人の隣、2人のときは向かい合わせ
    party.forEach((p, i) => { const [x, z, yaw] = seats[i]; chair(x, z, yaw); actors.push({ ...p, at: [x, 0.46, z], yaw, base: 'sit', table: 0.76 });
      const f = yaw === 0 ? 1 : -1; dishMesh(g, x - 0.12 * f, 0.76, z + 0.42 * f, season, 0, rnd); dishMesh(g, x + 0.16 * f, 0.76, z + 0.36 * f, season, 1, rnd); dishMesh(g, x + 0.26 * f, 0.76, z + 0.5 * f, season, 2, rnd); });
    // ほかの利用客（周りのテーブル）
    for (let k = 0; k < 5; k++) { const x = -6 + k * 3, z = k % 2 ? -2.6 : -0.6; g.box(x - 0.5, 0.72, z - 0.4, x + 0.5, 0.76, z + 0.4, { c: [0.55, 0.4, 0.28] }); const ch = { sex: rnd() < 0.5 ? 1 : 0, age: ['20', '30', '40', '60', 'child'][(rnd() * 5) | 0], outfit: rnd() < 0.5 ? 'casual' : 'travel', seed: 40 + k };
      g.setXf(x, 0.46, z - 0.62, 0); buildChar(g, ch, season, 'sit', { hands: [[-0.12, 0.3, 0.32], [0.12, 0.3, 0.32]], lod: 1 }); /* 修正121：利用客は一段軽い高ポリ版 */ buildFace(g, ch, 'smile'); g.clearXf(); dishMesh(g, x, 0.76, z - 0.2, season, k % 3, rnd); }
  }
  // 動作：食べる・飲む・話す・窓の外を眺める
  for (const a of actors) a.poses = seatedPoses(a.ch, a.table - a.at[1]);
  const S = actors.length, tgt = PA ? [0, 1.2, 1.8] : n === 1 ? [0, 1.1, 4.0] : [0, 1.1, 2.3];
  const shots = PA ? [
    { d: 5, cam: [0, 1.6, -3], cam2: [0, 1.5, -1.2], look: [0, 1.0, 2], look2: tgt, acts: 'drink' },
    { d: 6, cam: [1.7, 1.15, 3.5], cam2: [1.1, 1.1, 3.6], look: [0, 0.95, 1.9], look2: [0, 0.95, 1.9], acts: n > 1 ? 'talk' : 'drink' },
    { d: 6, cam: [0, 1.3, 0.2], cam2: [0, 2.5, -1], look: [0, 1.0, 6], look2: [0, 3, 20], acts: 'look' }
  ] : n === 1 ? [
    { d: 4.5, cam: [0, 2.4, -5], cam2: [0, 1.8, -1], look: [0, 1.4, 2], look2: tgt, acts: 'rest' },
    { d: 6, cam: [1.2, 1.1, 3.2], cam2: [0.9, 1.05, 3.4], look: [0, 1.05, 4.1], look2: [0, 1.05, 4.1], acts: 'eat' },
    { d: 5, cam: [0.5, 1.2, 6.3], cam2: [0.4, 1.15, 6.0], look: [0, 1.1, 4.0], look2: [0, 1.1, 4.0], acts: 'drink' },
    { d: 6, cam: [0.8, 1.35, 3.4], cam2: [0.7, 1.5, 3.7], look: [-0.4, 1.2, 10], look2: [-0.4, 2, 30], acts: 'look' }
  ] : [
    { d: 4.5, cam: [3.5, 2.4, -2.5], cam2: [2.2, 1.7, 0.2], look: [0, 1.2, 2], look2: tgt, acts: 'rest' },
    { d: 6.5, cam: [1.8, 1.25, 2.3], cam2: [1.5, 1.2, 2.2], look: tgt, look2: tgt, acts: 'eat' },
    { d: 6.5, cam: [-1.7, 1.3, 2.4], cam2: [-1.4, 1.25, 2.1], look: tgt, look2: tgt, acts: 'talk' },
    { d: 5, cam: [0, 1.6, -1.2], cam2: [0, 1.5, -0.6], look: tgt, look2: tgt, acts: 'drink' }
  ];
  void S;
  return { env: g, dyn, actors, shots, light: 'day', title: `${fac.name}　休憩` };
}
// 座っているときの手の位置（体の座標。hip=0、tableY＝テーブル上面の高さ）
function seatedPoses(ch, tableY, floor = false) {
  const k = charHeight(ch) / 1.7, h = headPos(ch, floor ? 'floor' : 'sit'), base = floor ? 'floor' : 'sit';
  const mouth = [0.02, h[1] - 0.06 * k, h[2] + 0.1];
  const rest = [[-0.15 * k, tableY + 0.04, 0.34], [0.15 * k, tableY + 0.04, 0.34]];
  return {
    rest: { pose: base, opt: { hands: rest } },
    eat: { pose: base, opt: { hands: [[-0.07, tableY + 0.12, 0.3], [mouth[0] + 0.04, mouth[1] - 0.02, mouth[2] + 0.1]], held: 'chopsticks' } },
    drink: { pose: base, opt: { hands: [[-0.15 * k, tableY + 0.04, 0.34], [mouth[0], mouth[1] - 0.05, mouth[2] + 0.05]], held: 'cup' } },
    lap: { pose: base, opt: { hands: [[-0.12 * k, floor ? 0.12 : 0.1, 0.3 * k], [0.12 * k, floor ? 0.12 : 0.1, 0.3 * k]] } }
  };
}
function sceneEnding(R, season, party, rnd) {
  const n = party.length, g = new GB(), actors = [], dyn = []; let shots, title, light = 'day', particles = null;
  const kids = party.some(p => p.ch.age === 'child');
  if (season === 'spring') { // 桜ヶ丘城でお花見：レジャーシート・お弁当・城を背景に記念写真
    title = '桜ヶ丘城　お花見';
    for (let x = -40; x < 40; x += 20) for (let z = -20; z < 60; z += 20) g.flat(x, z, x + 20, z + 20, 0, { c: [0.55, 0.78, 0.4], lay: L.GRASS }, 6);
    for (let k = 0; k < 26; k++) { const a = k / 26 * 6.283, r = 7 + rnd() * 9, x = Math.cos(a) * r, z = Math.sin(a) * r + 4; if (Math.abs(x) < 7 && (z < 0 || z > 6)) continue; tree(g, 'sakura', x, 0, z, 1.0 + rnd() * 0.3, rnd); } // 手前（カメラ側）と城への視線はあけておく
    for (let k = 0; k < 10; k++) tree(g, 'sakura', (k % 2 ? 1 : -1) * (12 + (k >> 1) * 4), 0, 20 + rnd() * 10, 1.1, rnd);
    // 城：石垣と三層の天守（奥 z=40）
    g.box(-12, 0, 36, 12, 7, 56, { c: [0.72, 0.7, 0.64] }); for (let y = 1; y < 7; y += 1.2) g.box(-12.02, y, 35.98, 12.02, y + 0.06, 36.0, { c: [0.55, 0.53, 0.48] }); /* 石垣 */
    let w = 14; for (let l = 0; l < 3; l++) { const y0 = 7 + l * 5; g.box(-w / 2, y0, 46 - w / 2 + 2, w / 2, y0 + 3.6, 46 + w / 2 - 2, { c: [0.97, 0.97, 0.95] }); for (let x = -w / 2 + 1; x < w / 2 - 0.8; x += 1.6) g.box(x, y0 + 1.4, 46 - w / 2 + 1.97, x + 0.6, y0 + 2.4, 46 - w / 2 + 2.0, { c: [0.2, 0.2, 0.22] }); /* 白壁の天守と窓 */ g.gable(-w / 2 - 1.5, 46 - w / 2 + 0.5, w / 2 + 1.5, 46 + w / 2 - 0.5, y0 + 3.6, 2, { c: [0.25, 0.3, 0.35], lay: L.KAWARA, tw: 2, gc: [0.97, 0.97, 0.95] }); w *= 0.74; }
    g.flat(-1.6, -1.4, 1.6, 1.4, 0.01, { c: [1, 1, 1], lay: patternLay(R, 'sheet') }, 0);
    for (let k = 0; k < n; k++) { g.box(-0.4 + k * 0.4, 0.01, -0.2, -0.15 + k * 0.4, 0.09, 0.1, { c: [0.15, 0.12, 0.1] }); g.box(-0.38 + k * 0.4, 0.09, -0.18, -0.17 + k * 0.4, 0.1, 0.08, { c: [[0.98, 0.95, 0.9], [0.95, 0.6, 0.7], [0.5, 0.75, 0.35]][k % 3] }); }
    g.cyl(0.6, 0.01, 0.4, 0.05, 0.22, 8, { c: [0.85, 0.95, 0.9] }); g.cyl(0.75, 0.01, 0.3, 0.035, 0.1, 8, { c: [0.6, 0.75, 0.45] });
    const pos = n === 1 ? [[0, 0.7, Math.PI]] : n === 2 ? [[-0.5, 0.7, Math.PI + 0.25], [0.5, 0.7, Math.PI - 0.25]] : [[-0.8, 0.65, Math.PI + 0.3], [0.8, 0.65, Math.PI - 0.3], [0, 0.9, Math.PI]];
    party.forEach((p, i) => actors.push({ ...p, at: [pos[i][0], 0.02, pos[i][1]], yaw: pos[i][2], base: 'floor', table: 0.1 }));
    particles = 'petal';
    shots = [
      { d: 5, cam: [0, 7, -14], cam2: [0, 3, -7], look: [0, 9, 40], look2: [0, 1.5, 6], acts: 'look' },
      { d: 6.5, cam: [2.2, 1.2, -1.6], cam2: [1.7, 1.1, -1.3], look: [0, 0.6, 0.5], look2: [0, 0.6, 0.5], acts: 'eat' },
      { d: 6.5, cam: [-2.2, 1.0, -0.6], cam2: [-1.6, 1.1, -1.0], look: [0, 0.7, 0.6], look2: [0, 2.0, 8], acts: n > 1 ? 'talk' : 'drink' },
      { d: 5.5, cam: [0, 1.15, -2.4], cam2: [0, 1.15, -2.3], look: [0, 2.0, 8], look2: [0, 2.0, 8], acts: 'photo', photo: true }
    ];
  } else if (season === 'summer') { // 青凪高原：コテージのテラスとハンモック
    title = '青凪高原リゾート　休暇';
    for (let x = -40; x < 40; x += 20) for (let z = -20; z < 60; z += 20) g.flat(x, z, x + 20, z + 20, 0, { c: [0.4, 0.68, 0.3], lay: L.GRASS }, 6);
    outside(g, 'summer', 20, rnd, { n: 10 }); for (let k = 0; k < 8; k++) tree(g, 'birch', -14 + rnd() * 28, 0, 8 + rnd() * 10, 1.1, rnd);
    // コテージとテラス
    g.box(-5, 0, -9, 5, 3.2, -4, { c: [0.66, 0.47, 0.3] }); for (let x = -4.5; x < 5; x += 0.5) g.box(x, 0, -4.02, x + 0.04, 3.2, -3.98, { c: [0.5, 0.35, 0.22] }); g.box(-0.5, 0.4, -3.99, 0.5, 2.4, -3.95, { c: [0.4, 0.28, 0.18] }); for (const x of [-3, 3]) g.box(x - 0.8, 1.2, -3.99, x + 0.8, 2.4, -3.95, { c: [0.55, 0.75, 0.85], mat: 3 }); /* ログハウス風のコテージ（扉と窓） */ g.gable(-5.5, -9.5, 5.5, -3.5, 3.2, 2.2, { c: [0.25, 0.4, 0.35], lay: L.METAL, tw: 2, gc: [0.7, 0.5, 0.32] });
    g.box(-6, 0, -4, 6, 0.4, 0, { c: [0.62, 0.46, 0.3] }); for (let x = -6; x <= 6; x += 1.5) g.box(x - 0.04, 0.4, -0.05, x + 0.04, 1.3, 0.05, { c: [0.5, 0.36, 0.24] });
    g.box(-1.5, 0.4, -2.6, 0.3, 1.1, -1.8, { c: [0.85, 0.85, 0.82] }); for (let k = 0; k < Math.max(1, n); k++) g.cyl(-1.2 + k * 0.4, 1.1, -2.2, 0.035, 0.12, 8, { c: [0.98, 0.7, 0.25] });
    // ハンモック（2本の木の間。揺れる）
    for (const x of [2.4, 6.6]) tree(g, 'green', x, 0, 3, 1.0, rnd);
    const hg = new GB(); for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8, y0 = 1.0 - Math.sin(t0 * Math.PI) * 0.35, y1 = 1.0 - Math.sin(t1 * Math.PI) * 0.35; hg.quadN([-0.45, y0, -1.6 + t0 * 3.2], [0.45, y0, -1.6 + t0 * 3.2], [0.45, y1, -1.6 + t1 * 3.2], [-0.45, y1, -1.6 + t1 * 3.2], [0, 1, 0], { c: [0.95, 0.55, 0.25] }); }
    for (const z of [-1.6, 1.6]) for (const x of [-0.45, 0.45]) hg.beam([x, 1.0, z], [0, 1.6, z * 1.4], 0.012, { c: [0.85, 0.8, 0.7] });
    const hamPos = [4.5, 0, 3]; // ハンモックの中心
    const inHam = n === 1 ? [0] : n === 2 ? [0] : [2];
    const hm = { g: hg, at: hamPos, yaw: Math.PI / 2, sway: true }; dyn.push(hm);
    party.forEach((p, i) => { if (inHam.includes(i)) actors.push({ ...p, at: hamPos, yaw: Math.PI / 2, base: 'lie', lie: true, ham: hm }); else { const seat = [[-2.2, 0.4, -1.4, 0.3], [0.5, 0.4, -1.4, -0.3]][actors.filter(a => !a.lie).length]; g.box(seat[0] - 0.3, 0.4, seat[2] - 0.3, seat[0] + 0.3, 0.85, seat[2] + 0.3, { c: [0.55, 0.4, 0.28] }); actors.push({ ...p, at: [seat[0], 0.85, seat[2]], yaw: seat[3], base: 'sit', table: 1.1 }); } });
    shots = [
      { d: 5, cam: [-4, 5, 12], cam2: [-1, 3, 9], look: [0, 1.5, -4], look2: [3, 1, 2], acts: 'rest' },
      { d: 7, cam: [4.5, 2.1, 0.8], cam2: [4.6, 1.7, 1.4], look: [4.5, 0.85, 3], look2: [4.5, 0.85, 3], acts: 'lie' },
      { d: 6.5, cam: n > 1 ? [-0.9, 1.5, 1.5] : [1.5, 1.6, 6], cam2: n > 1 ? [-0.6, 1.4, 1.0] : [2.5, 1.5, 6.5], look: n > 1 ? [-0.85, 1.1, -1.4] : [4.5, 1, 3], look2: n > 1 ? [-0.85, 1.1, -1.4] : [4.5, 1.1, 3], acts: n > 1 ? 'talk' : 'lie' },
      { d: 5, cam: [8, 2, 8], cam2: [10, 4, 12], look: [4.5, 0.9, 3], look2: [3, 2, -6], acts: 'lie' }
    ];
  } else if (season === 'autumn') { // 楓見山荘：和室（畳・座卓・座布団・障子・窓の外の紅葉・温かいお茶）
    title = '楓見山荘　和室';
    const tat = patternLay(R, 'tatami'), shoji = patternLay(R, 'shoji');
    for (let x = -3.6; x < 3.6; x += 1.8) for (let z = -3.6; z < 1.8; z += 0.9) g.flat(x, z, x + 1.8, z + 0.9, 0, { c: [1, 1, 1], lay: tat }, 0);
    g.box(-3.7, 0, -3.8, 3.7, 2.6, -3.6, { c: [0.85, 0.78, 0.62] }); g.box(-1.2, 0.3, -3.62, 1.2, 2.2, -3.58, { c: [0.95, 0.93, 0.88] }); g.box(-0.3, 0.6, -3.58, 0.3, 2.0, -3.55, { c: [0.92, 0.9, 0.82] }); g.box(-1.4, 0, -3.6, 1.4, 0.3, -2.9, { c: [0.45, 0.3, 0.2] }); // 床の間・掛け軸
    for (const s of [-1, 1]) g.panel(s * 3.65, -3.6, s * 3.65, 1.8, 0, 2.6, 0, [-s, 0, 0], { c: [1, 1, 1], lay: shoji }, [[0, 1], [3, 1], [3, 0], [0, 0]]);
    g.box(-3.7, 2.6, -3.8, 3.7, 2.7, 1.9, { c: [0.6, 0.45, 0.3] }); g.box(-0.6, 2.58, -1.6, 0.6, 2.6, -0.8, { c: [1, 0.92, 0.78], mat: 8 });
    g.box(-3.7, 0, 1.8, -1.6, 2.6, 1.9, { c: [0.85, 0.78, 0.62] }); g.box(1.6, 0, 1.8, 3.7, 2.6, 1.9, { c: [0.85, 0.78, 0.62] }); g.box(-1.6, 2.2, 1.8, 1.6, 2.6, 1.9, { c: [0.6, 0.45, 0.3] }); g.box(-1.6, 0, 1.8, 1.6, 0.3, 2.5, { c: [0.55, 0.4, 0.28] }); // 窓（縁側）
    outside(g, 'autumn', 3, rnd, { n: 28, y: -1 });
    g.box(-0.6, 0.3, -1.4, 0.6, 0.34, -0.4, { c: [0.3, 0.18, 0.1] }); for (const [x, z] of [[-0.55, -1.35], [0.55, -1.35], [-0.55, -0.45], [0.55, -0.45]]) g.box(x - 0.04, 0, z - 0.04, x + 0.04, 0.3, z + 0.04, { c: [0.25, 0.15, 0.08] }); // 座卓
    g.cyl(0, 0.34, -0.9, 0.07, 0.1, 10, { c: [0.25, 0.35, 0.25] }); for (let k = 0; k < n; k++) g.cyl(-0.25 + k * 0.25, 0.34, -0.75 + (k % 2) * -0.3, 0.035, 0.07, 8, { c: [0.85, 0.82, 0.75] }); g.box(0.25, 0.34, -1.25, 0.45, 0.37, -1.1, { c: [0.6, 0.3, 0.3] });
    const pos = n === 1 ? [[0, -0.05, Math.PI]] : n === 2 ? [[-0.1, -0.05, Math.PI], [0, -1.8, 0]] : [[-0.35, -0.05, Math.PI], [0.35, -1.8, 0], [-0.85, -0.9, Math.PI / 2]];
    party.forEach((p, i) => { const [x, z, yaw] = pos[i]; g.setXf(x, 0, z, yaw); g.box(-0.3, 0, -0.3, 0.3, 0.08, 0.3, { c: [0.45, 0.2, 0.45] }); g.clearXf(); actors.push({ ...p, at: [x, 0.1, z], yaw, base: 'floor', table: 0.34 }); });
    particles = 'steamCup'; light = 'room';
    shots = [
      { d: 5, cam: [0, 1.5, 6], cam2: [0, 1.3, 2.6], look: [0, 0.8, -1], look2: [0, 0.8, -0.9], acts: 'rest' },
      { d: 6.5, cam: [1.6, 1.0, -0.2], cam2: [1.3, 0.95, -0.5], look: [0, 0.6, -0.9], look2: [0, 0.6, -0.9], acts: 'drink' },
      { d: 6.5, cam: [-1.8, 1.05, -2.6], cam2: [-1.2, 1.0, -2.4], look: [0, 0.6, -0.6], look2: [0, 0.6, -0.6], acts: n > 1 ? 'talk' : 'look' },
      { d: 6, cam: [-2.4, 1.2, -2.8], cam2: [-2.1, 1.3, -3.2], look: [0, 0.9, 1.5], look2: [0, 2, 12], acts: 'look' }
    ];
  } else { // 雪灯温泉郷：1人＝雪見の露天風呂（肩までつかる）、2人＝足湯（浴衣）、3人＝夜の温泉街の散策（浴衣・羽織）
    light = 'dusk'; particles = 'steam';
    if (n === 1) { title = '雪灯温泉郷　露天風呂';
      for (const [x0, z0, x1, z1] of [[-20, -15, 20, -3.6], [-20, 3.6, 20, 25], [-20, -3.6, -3.6, 3.6], [3.6, -3.6, 20, 3.6]]) g.flat(x0, z0, x1, z1, 0.4, { c: [0.95, 0.96, 1], lay: L.WHITE }, 0); g.cyl(0, -0.2, 0, 3.6, 0.6, 16, { c: [0.35, 0.33, 0.3] }, false); // 湯船（地面に穴をあける）
      for (let k = 0; k < 20; k++) { const a = k / 20 * 6.283, r = 3.2 + rnd() * 0.4; g.cbox(Math.cos(a) * r, 0.25, Math.sin(a) * r, 0.9, 0.7, 0.9, { c: [0.45, 0.43, 0.4], lay: L.ROCK }); g.cbox(Math.cos(a) * r, 0.62, Math.sin(a) * r, 0.8, 0.08, 0.8, { c: [0.97, 0.98, 1] }); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.tri([0, 0.2, 0], [Math.cos(a) * 3.3, 0.2, Math.sin(a) * 3.3], [Math.cos(a + 0.524) * 3.3, 0.2, Math.sin(a + 0.524) * 3.3], { c: [0.55, 0.75, 0.72], lay: L.WATER, mat: 21 }, [0, 0], [0, 0], [0, 0], [0, -5, 0]); }
      for (let x = -8; x <= 8; x += 0.4) g.box(x, 0, 6, x + 0.3, 2.4, 6.15, { c: [0.45, 0.32, 0.22] });
      for (let k = 0; k < 10; k++) tree(g, 'snowpine', -12 + rnd() * 24, 0.4, -6 - rnd() * 10, 1, rnd);
      g.cyl(2.8, 0.4, 3.6, 0.15, 1.2, 6, { c: [0.5, 0.5, 0.48] }); g.box(2.6, 1.6, 3.4, 3.0, 2.0, 3.8, { c: [1, 0.75, 0.4], mat: 8 }); // 石灯籠
      actors.push({ ...party[0], at: [-0.4, 0.2, 0.3], yaw: 0.3, base: 'bath' });
      shots = [
        { d: 5, cam: [0, 6, 11], cam2: [0, 3, 7], look: [0, 0, -3], look2: [0, 0.5, 0], acts: 'rest' },
        { d: 7, cam: [1.8, 0.9, 2.3], cam2: [1.4, 0.85, 1.9], look: [-0.4, 0.6, 0.3], look2: [-0.4, 0.6, 0.3], acts: 'rest' },
        { d: 6, cam: [-0.4, 0.8, 1.2], cam2: [-0.4, 1.4, 1.5], look: [0, 1.5, -8], look2: [0, 4, -16], acts: 'look' }
      ];
    } else if (n === 2) { title = '雪灯温泉郷　足湯';
      for (let x = -20; x < 20; x += 10) for (let z = -15; z < 25; z += 10) g.flat(x, z, x + 10, z + 10, 0, { c: [0.95, 0.96, 1], lay: L.WHITE }, 0);
      g.box(-3, 0, -0.9, 3, 0.35, 0.9, { c: [0.5, 0.48, 0.45], lay: L.ROCK }); g.flat(-2.7, -0.6, 2.7, 0.6, 0.33, { c: [0.55, 0.75, 0.72], lay: L.WATER, mat: 21 }, 0);
      g.box(-3, 0, -1.6, 3, 0.45, -1.0, { c: [0.55, 0.4, 0.28] }); for (const x of [-3, 3]) for (const z of [-1.9, 1.9]) g.box(x - 0.1, 0, z - 0.1, x + 0.1, 2.6, z + 0.1, { c: [0.4, 0.28, 0.2] }); g.gable(-3.5, -2.3, 3.5, 2.3, 2.6, 1.0, { c: [0.3, 0.3, 0.32], lay: L.KAWARA, tw: 2 }); g.box(-3.6, 3.2, -2.4, 3.6, 3.5, 2.4, { c: [0.97, 0.98, 1] });
      for (const x of [-2.4, 2.4]) { g.box(x - 0.2, 1.9, 1.6, x + 0.2, 2.4, 2.0, { c: [1, 0.7, 0.35], mat: 8 }); }
      for (let k = 0; k < 10; k++) tree(g, 'snowpine', -14 + rnd() * 28, 0, -6 - rnd() * 10, 1, rnd);
      for (let k = 0; k < 5; k++) { const x = -12 + k * 6; g.box(x - 2.5, 0, 9, x + 2.5, 4, 13, { c: [0.6, 0.45, 0.32] }); g.box(x - 2.7, 4, 8.8, x + 2.7, 4.6, 13.2, { c: [0.97, 0.98, 1] }); g.box(x - 0.6, 1.2, 8.98, x + 0.6, 2.2, 9.0, { c: [1, 0.78, 0.45], mat: 8 }); }
      party.forEach((p, i) => actors.push({ ...p, ch: { ...p.ch, outfit: 'yukata' }, at: [-0.45 + i * 0.9, 0.45, -1.3], yaw: 0, base: 'sit', table: 0.9, footY: 0.1 - 0.45 }));
      shots = [
        { d: 5, cam: [0, 4, 9], cam2: [0, 2.5, 5], look: [0, 1, -1], look2: [0, 0.8, -1], acts: 'rest' },
        { d: 7, cam: [1.6, 1.2, 0.9], cam2: [1.2, 1.1, 0.6], look: [0, 1.0, -1.3], look2: [0, 1.0, -1.3], acts: 'talk' },
        { d: 6, cam: [-1.8, 1.0, 0.6], cam2: [-1.4, 1.8, 1.0], look: [0, 0.9, -1.3], look2: [0, 2.5, 6], acts: 'look' }
      ];
    } else { title = '雪灯温泉郷　湯けむりの温泉街';
      for (let z = -30; z < 30; z += 10) { g.flat(-3, z, 3, z + 10, 0.01, { c: [0.6, 0.6, 0.62], lay: L.ASPHALT, mat: 7 }, 4); for (const s of [-1, 1]) g.flat(s > 0 ? 3 : -12, z, s > 0 ? 12 : -3, z + 10, 0.03, { c: [0.95, 0.96, 1], lay: L.WHITE }, 0); }
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) { const z = -27 + k * 10, x = s * 7.5; g.box(x - 3.5, 0, z - 4, x + 3.5, 5, z + 4, { c: [0.5, 0.36, 0.24] }); for (const dz of [-2.4, 0, 2.4]) g.box(x - s * 3.53, 3.0, z + dz - 0.7, x - s * 3.5, 4.1, z + dz + 0.7, { c: [1, 0.85, 0.6], mat: 8 }); g.box(x - s * 3.6, 2.6, z - 4, x - s * 3.5, 2.75, z + 4, { c: [0.3, 0.22, 0.15] }); g.box(x - 3.8, 5, z - 4.3, x + 3.8, 5.8, z + 4.3, { c: [0.97, 0.98, 1] }); g.box(x - s * 3.52, 1.3, z - 1.2, x - s * 3.5, 2.6, z + 1.2, { c: [1, 0.78, 0.45], mat: 8 }); }
      for (let z = -28; z < 30; z += 4) for (const s of [-1, 1]) { g.cyl(s * 3.4, 0, z, 0.05, 2.6, 6, { c: [0.3, 0.25, 0.2] }); g.cbox(s * 3.4, 2.75, z, 0.35, 0.45, 0.35, { c: [1, 0.55, 0.3], mat: 8 }); }
      for (let z = -25; z < 30; z += 12) g.cbox(0, 0.15, z, 0.6, 0.3, 0.6, { c: [0.4, 0.38, 0.35], lay: L.ROCK }); // 湯けむりの出る湯だまり
      party.forEach((p, i) => actors.push({ ...p, ch: { ...p.ch, outfit: 'yukata' }, at: [-0.9 + i * 0.9, 0, -14], yaw: 0, base: 'walk', walk: 0.9 }));
      shots = [
        { d: 6, cam: [0, 6, 14], cam2: [0, 3.5, 6], look: [0, 1, -8], look2: [0, 1.2, -8], acts: 'walk' },
        { d: 7, cam: [2.2, 1.5, -5], cam2: [2.2, 1.5, -1], look: [0, 1.4, -8], look2: [0, 1.4, -3], acts: 'walkTalk' },
        { d: 6, cam: [0, 1.6, 6], cam2: [0, 2.4, 9], look: [0, 1.4, 0], look2: [0, 3, -20], acts: 'walk' }
      ];
    }
  }
  for (const a of actors) if (a.base === 'sit' || a.base === 'floor') a.poses = seatedPoses(a.ch, a.table - a.at[1] + (a.base === 'floor' ? 0.12 : 0), a.base === 'floor');
  void kids;
  return { env: g, dyn, actors, shots, light, particles, title };
}

export class Cutscene {
  // ctx：{ R, M4, meshes, $ }。kind：'rest' | 'ending'。info：{ season, party, fac? }
  constructor(ctx, kind, info, onDone) {
    this.ctx = ctx; this.kind = kind; this.info = info; this.onDone = onDone; this.t = 0; this.done = false;
    const R = ctx.R, rnd = rng(kind === 'rest' ? 17 : 29), season = info.season; dynK = 90;
    this.sc = kind === 'rest' ? sceneRest(R, season, info.party, info.fac, rnd) : sceneEnding(R, season, info.party, rnd);
    R.mips();
    this.envMesh = R.mesh(this.sc.env.build());
    for (const d of this.sc.dyn) d.mesh = R.mesh(d.g.build());
    // 人物：姿勢ごとの体と、表情ごとの顔
    for (const a of this.sc.actors) {
      a.mesh = {}; a.face = {};
      const mk = (name, pose, opt) => { const g = new GB(); buildChar(g, a.ch, season, pose, { ...opt, footY: a.footY ?? opt?.footY }); a.mesh[name] = R.mesh(g.build()); };
      if (a.poses) for (const k in a.poses) mk(k, a.poses[k].pose, a.poses[k].opt);
      if (a.base === 'bath') mk('rest', 'bath', {});
      if (a.base === 'walk') { mk('walk0', 'walk0', {}); mk('walk1', 'walk1', {}); mk('rest', 'stand', {}); }
      if (a.base === 'lie') { const g = new GB(); buildChar(g, a.ch, season, 'stand', {}); rotX(g, 0, -Math.PI / 2, 0, 0); const H = charHeight(a.ch); for (let i = 0; i < g.a.length; i += 13) { g.a[i + 1] += 0.85; g.a[i + 2] += H * 0.5; } a.mesh.rest = R.mesh(g.build());
        const f = new GB(); buildFace(f, a.ch, 'blink', 'stand'); rotX(f, 0, -Math.PI / 2, 0, 0); for (let i = 0; i < f.a.length; i += 13) { f.a[i + 1] += 0.85; f.a[i + 2] += H * 0.5; } a.face.blink = R.mesh(f.build());
        const f2 = new GB(); buildFace(f2, a.ch, 'smile', 'stand'); rotX(f2, 0, -Math.PI / 2, 0, 0); for (let i = 0; i < f2.a.length; i += 13) { f2.a[i + 1] += 0.85; f2.a[i + 2] += H * 0.5; } a.face.smile = R.mesh(f2.build()); }
      else { const fp = a.base === 'walk' ? 'stand' : a.base === 'bath' ? 'bath' : a.base === 'floor' ? 'floor' : 'sit'; for (const e of ['neutral', 'smile', 'talk', 'blink', 'eat', 'laugh']) { const g = new GB(); buildFace(g, a.ch, e, fp); a.face[e] = R.mesh(g.build()); } }
    }
    // 字幕（人数・季節・場面別のセリフを場面全体に割り振る）
    this.lines = lines(kind, season, info.party.length, info.party, info.fac, info.meal);
    // 修正111：到着が夕方・夜なら、その時間帯らしいひと言を最後に添える（空と照明は render で切り替え）
    this.tod = info.tod === 'evening' || info.tod === 'night' ? info.tod : 'day';
    if (kind === 'ending' && this.tod !== 'day' && info.party.length > 1) { const p = info.party[1]; this.lines.push([p.role, MOVIE[this.tod][voiceKey(p.ch)][0]]); } // 修正111・118：夕方・夜の到着のひと言
    this.total = this.sc.shots.reduce((t, s) => t + s.d, 0);
    const per = (this.total - 1.5) / this.lines.length; this.subs = this.lines.map((l, i) => ({ t0: 0.8 + i * per, t1: 0.8 + (i + 1) * per - 0.3, role: l[0], text: l[1] }));
    const $ = ctx.$; this.ui = $('cut'); this.ui.classList.add('on'); $('cutTitle').textContent = this.sc.title; $('cutTitle').classList.add('on'); setTimeout(() => $('cutTitle').classList.remove('on'), 2600);
    $('cutSkip').onclick = () => this.finish();
    $('cutInfo').textContent = '';
  }
  speaker(t) { const s = this.subs.find(q => t >= q.t0 && t < q.t1); return s || null; }
  render(dt, aspect) {
    if (this.done) return;
    const { R, M4, meshes, $ } = this.ctx, sc = this.sc;
    this.t += dt; const t = this.t;
    if (t >= this.total) { this.finish(); return; }
    // 今のカット
    let acc = 0, shot = sc.shots[0], lt = 0; for (const s of sc.shots) { if (t < acc + s.d) { shot = s; lt = (t - acc) / s.d; break; } acc += s.d; }
    const e = ease(lt), camP = V(shot.cam, shot.cam2, e), look = V(shot.look, shot.look2, e);
    const view = M4.lookAt(camP, look, [0, 1, 0]), proj = M4.persp(55 * Math.PI / 180, aspect, 0.05, 900), vp = M4.mul(proj, view);
    const L0 = sc.light, tod = this.tod; let night = L0 === 'dusk' ? 0.85 : 0;
    let env = L0 === 'room' ? { fog: [0.85, 0.78, 0.65], zen: [0.45, 0.6, 0.85], sun: [0.3, 0.8, 0.5], sunC: [0.75, 0.68, 0.55], amb: [0.62, 0.56, 0.48] }
      : L0 === 'dusk' ? { fog: [0.25, 0.28, 0.38], zen: [0.12, 0.15, 0.3], sun: [0.3, 0.5, -0.8], sunC: [0.25, 0.25, 0.35], amb: [0.36, 0.36, 0.45] }
      : { fog: { spring: [0.85, 0.85, 0.92], summer: [0.7, 0.82, 0.95], autumn: [0.85, 0.8, 0.72], winter: [0.85, 0.88, 0.95] }[this.info.season], zen: { spring: [0.45, 0.62, 0.9], summer: [0.25, 0.55, 0.95], autumn: [0.45, 0.6, 0.85], winter: [0.6, 0.7, 0.85] }[this.info.season], sun: [0.4, 0.8, 0.35], sunC: [1.0, 0.96, 0.88], amb: [0.52, 0.53, 0.58] };
    // 修正111：到着時刻による空と照明の版。夕方＝低い橙色の太陽と夕焼けの空、夜＝暗い空と暖色の灯り（屋外の夕暮れの場面は夜版と共通）
    if (tod === 'evening') { env = L0 === 'room' ? { fog: [0.95, 0.68, 0.5], zen: [0.55, 0.42, 0.6], sun: [0.85, 0.22, 0.3], sunC: [1.0, 0.62, 0.36], amb: [0.6, 0.48, 0.42] }
        : { fog: [0.98, 0.62, 0.42], zen: [0.38, 0.32, 0.6], sun: [0.85, 0.18, 0.35], sunC: [1.05, 0.6, 0.32], amb: [0.5, 0.4, 0.42] }; night = Math.max(night, 0.3); }
    else if (tod === 'night') { env = L0 === 'room' ? { fog: [0.2, 0.2, 0.3], zen: [0.06, 0.08, 0.2], sun: [0.3, 0.8, 0.5], sunC: [0.42, 0.36, 0.3], amb: [0.55, 0.47, 0.38] }
        : { fog: [0.16, 0.18, 0.28], zen: [0.05, 0.07, 0.18], sun: [0.3, 0.5, -0.8], sunC: [0.22, 0.22, 0.32], amb: [0.32, 0.32, 0.42] }; night = L0 === 'room' ? 0.7 : 0.9; }
    const s = Math.hypot(...env.sun); env.sun = env.sun.map(v => v / s);
    R.frame({ vp, fog: env.fog, sun: env.sun, sunC: env.sunC, amb: env.amb, cam: camP, fogN: 60, fogF: 600, night, wet: 0, hOn: 0, hP: [0, 0, 0], hD: [0, 0, 1], lit: [0.3, 0.3], urban: 0, time: t });
    const gl = R.gl; gl.depthMask(false); R.draw(meshes.sky, new Float32Array([800, 0, 0, 0, 0, 800, 0, 0, 0, 0, 800, 0, camP[0], camP[1], camP[2], 1]), env.zen); gl.depthMask(true);
    R.draw(this.envMesh);
    for (const d of sc.dyn) { const sw = d.sway ? Math.sin(t * 1.3) * 0.12 : 0; R.draw(d.mesh, M4.trs(d.at[0], d.at[1], d.at[2], d.yaw, 0, sw)); }
    // 人物
    const sp = this.speaker(t), acts = shot.acts;
    sc.actors.forEach((a, i) => {
      const talking = sp && (sp.role === a.role || (sp.role === 'mono' && a.role === 'driver' && false));
      let pose = 'rest', expr = 'smile', dx = 0, dz = 0, dyaw = 0, bob = Math.sin(t * 1.6 + i) * 0.006;
      const ph = (t + i * 1.1) % 3.4;
      if (a.base === 'walk') { const v = a.walk || 1, z = a.at[2] + t * v; dz = z - a.at[2]; pose = Math.floor(t * 2.2 + i) % 2 ? 'walk0' : 'walk1'; expr = talking ? (Math.floor(t * 7) % 2 ? 'talk' : 'smile') : 'smile'; }
      else if (a.base === 'lie') { pose = 'rest'; expr = Math.floor(t / 4) % 2 ? 'blink' : 'smile'; }
      else if (a.base === 'bath') { pose = 'rest'; expr = Math.floor(t / 3) % 3 === 0 ? 'blink' : 'smile'; bob = Math.sin(t * 0.8) * 0.01; }
      else {
        if (acts === 'eat') { pose = ph < 1.3 ? 'eat' : 'rest'; expr = ph < 1.3 ? 'eat' : 'smile'; }
        else if (acts === 'drink' || acts === 'photo' && false) { pose = ph < 1.5 ? 'drink' : 'rest'; expr = ph < 1.5 ? 'eat' : 'smile'; }
        else if (acts === 'look') { pose = 'rest'; dyaw = 0.35 * Math.sin(t * 0.4 + i); expr = 'smile'; }
        else if (acts === 'talk') { pose = (i + Math.floor(t / 2.7)) % 3 === 0 ? 'drink' : 'rest'; expr = 'smile'; }
        else if (acts === 'photo') { pose = 'lap'; expr = 'laugh'; }
        else pose = 'rest';
        if (talking) { expr = Math.floor(t * 7) % 2 ? 'talk' : 'smile'; if (pose === 'eat' || pose === 'drink') pose = 'rest'; }
        else if (sp && sp.role !== 'mono' && acts !== 'eat') { dyaw += 0.25 * Math.sign((sc.actors.find(b => b.role === sp.role)?.at[0] ?? a.at[0]) - a.at[0]) * (a.yaw === 0 ? -1 : 1); }
        if (!a.mesh[pose]) pose = 'rest';
      }
      if ((t * 1.3 + i * 0.7) % 4 < 0.12 && expr !== 'talk') expr = 'blink';
      let M;
      if (a.ham) { const sw = Math.sin(t * 1.3) * 0.12; M = M4.trs(a.at[0], a.at[1], a.at[2], a.yaw, 0, sw); }
      else M = M4.trs(a.at[0] + dx, a.at[1] + bob, a.at[2] + dz, a.yaw + dyaw);
      R.draw(a.mesh[pose] || a.mesh.rest, M);
      const f = a.face[expr] || a.face.smile || a.face.blink; if (f) R.draw(f, M);
    });
    // 粒子：花びら・湯けむり・湯のみの湯気・雪
    if (sc.particles) { R.blend('alpha'); gl.depthMask(false);
      const P = sc.particles, n = P === 'steamCup' ? 6 : 40;
      for (let k = 0; k < n; k++) { const ph = (t * (P === 'petal' ? 0.12 : 0.2) + k / n) % 1, r0 = rng(k + 1);
        let x, y, z, s;
        if (P === 'petal') { x = (r0() - 0.5) * 12 + Math.sin(t + k) * 0.5; y = 6 - ph * 6; z = (r0() - 0.5) * 10; s = 0.05; R.alpha(0.9); }
        else if (P === 'steamCup') { x = -0.25 + (k % 3) * 0.25; y = 0.45 + ph * 0.5; z = -0.8; s = 0.04 + ph * 0.12; R.alpha(0.35 * (1 - ph)); }
        else { const a = r0() * 6.283, rr = r0() * 3; x = Math.cos(a) * rr; z = Math.sin(a) * rr + (sc.title.includes('温泉街') ? (k % 6) * 10 - 25 : 0); y = 0.3 + ph * 3; s = 0.6 + ph * 1.6; R.alpha(0.28 * (1 - ph)); }
        const m = M4.trs(x, y, z, Math.atan2(camP[0] - x, camP[2] - z), P === 'petal' ? t + k : 0, 0); for (const i of [0, 1, 2]) { m[i] *= s; m[4 + i] *= s; m[8 + i] *= s; }
        R.draw(P === 'petal' ? (this.petal || (this.petal = (() => { const g = new GB(); g.quadN([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 1], { c: [1, 0.75, 0.85], mat: 5 }); g.quadN([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0], [0, 0, -1], { c: [1, 0.75, 0.85], mat: 5 }); return R.mesh(g.build()); })())) : meshes.puff, m); }
      gl.depthMask(true); R.alpha(1); R.blend(null); }
    // 記念写真（春の最後）：シャッターの白い光と「記念写真」の枠
    const ph = shot.photo && lt > 0.55; this.ui.classList.toggle('photo', !!ph); if (shot.photo && lt > 0.55 && lt < 0.6) this.ui.classList.add('flash'); else this.ui.classList.remove('flash');
    // 字幕・休憩中の時計
    $('cutSub').innerHTML = sp ? (sp.role === 'mono' ? `<i>${sp.text}</i>` : `<b>${(this.info.party.find(p => p.role === sp.role) || {}).name || ''}</b>「${sp.text}」`) : '';
    if (this.kind === 'rest') { const m = this.info.from + (this.info.to - this.info.from) * clamp(t / this.total, 0, 1), hh = Math.floor(m / 60), mm = Math.floor(m % 60); $('cutInfo').textContent = `休憩 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}（45分）`; }
    $('cutFade').style.opacity = String(t < 0.6 ? 1 - t / 0.6 : t > this.total - 0.8 ? (t - (this.total - 0.8)) / 0.8 : 0);
  }
  finish() { if (this.done) return; this.done = true; this.dispose(); this.onDone && this.onDone(); }
  dispose() {
    const R = this.ctx.R; R.free(this.envMesh); for (const d of this.sc.dyn) R.free(d.mesh); for (const a of this.sc.actors) { for (const k in a.mesh) R.free(a.mesh[k]); for (const k in a.face) R.free(a.face[k]); } if (this.petal) R.free(this.petal);
    this.ui.classList.remove('on', 'photo', 'flash'); this.ctx.$('cutSub').innerHTML = ''; this.ctx.$('cutInfo').textContent = '';
  }
}
