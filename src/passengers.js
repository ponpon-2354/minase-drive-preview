// 長距離ドライブモード：同乗者・運転者のキャラクター（性別・年齢・服装・表情）と、車内の座席配置
// キャラクターはローポリの汎用人形（実在の人物・キャラクターではない）。年齢は体格・髪・顔・服装の細部に反映する
import { rng } from './math.js?v=0.7.0';

export const AGE_OPTS = [['child', '子ども（約9歳）'], ['10', '10代'], ['20', '20代'], ['30', '30代'], ['40', '40代'], ['50', '50代'], ['60', '60代以上']];
export const OUTFIT_OPTS = [
  ['casual', 'カジュアル', ['spring', 'summer', 'autumn', 'winter']],
  ['smart', 'きれいめ', ['spring', 'summer', 'autumn', 'winter']],
  ['light', '春夏向けの軽装', ['spring', 'summer']],
  ['coat', '秋冬向けの上着', ['autumn', 'winter']],
  ['outdoor', 'アウトドアウェア', ['spring', 'summer', 'autumn', 'winter']],
  ['travel', '旅行用の服装', ['spring', 'summer', 'autumn', 'winter']],
  ['kids', '子ども用カジュアルウェア', ['spring', 'summer', 'autumn', 'winter']]
];
export const SEAT_OPTS = [['front', '助手席'], ['rearR', '後席右'], ['rearL', '後席左']];
export const SEASON_NAMES = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
// ミライースの乗車定員は4名（運転者＋同乗者3名まで）。このモードは同乗者2名まで
export const CAR_CAPACITY = 4;

// 季節と年齢に合う服装だけを選べるようにする（子どもは子ども用、大人は子ども用を選べない）
export function outfitAllowed(id, season, age) {
  const o = OUTFIT_OPTS.find(q => q[0] === id); if (!o) return false;
  if (!o[2].includes(season)) return false;
  if (age === 'child') return id === 'kids' || id === 'outdoor' || id === 'casual';
  return id !== 'kids';
}
export function defaultOutfit(season, age) { return age === 'child' ? 'kids' : season === 'winter' || season === 'autumn' ? 'coat' : 'casual'; }
// 子どもは後席（ジュニアシート）に座る
export function seatAllowed(seat, age) { return age !== 'child' || seat !== 'front'; }

// 運転者（車両選択の 年代3×性別2×服装3）をキャラクター設定に変換
export function driverChar(d, season) {
  const age = ['20', '40', '60'][d.age] || '30';
  const outfit = d.outfit === 2 ? 'smart' : d.outfit === 1 ? 'casual' : (season === 'winter' || season === 'autumn' ? 'coat' : 'travel');
  return { sex: d.sex, age, outfit, seed: 11 };
}

const SKINS = [[0.94, 0.8, 0.68], [0.9, 0.74, 0.62], [0.86, 0.7, 0.58]];
function look(ch) {
  const R = rng((ch.seed || 1) * 131 + (ch.sex ? 7 : 3) + ch.age.length * 17 + ch.outfit.length * 5);
  const child = ch.age === 'child', teen = ch.age === '10', old = ch.age === '60', mid = ch.age === '50';
  const H = child ? 1.32 : teen ? (ch.sex ? 1.57 : 1.64) : old ? (ch.sex ? 1.52 : 1.65) : (ch.sex ? 1.58 : 1.71);
  const hair = old ? [0.72, 0.72, 0.7] : mid && R() < 0.5 ? [0.35, 0.33, 0.32] : R() < 0.25 ? [0.3, 0.2, 0.12] : [0.1, 0.08, 0.07];
  return { R, child, teen, old, mid, H, k: H / 1.7, hs: child ? 1.18 : 1, skin: SKINS[(R() * 3) | 0], hair };
}
// 服装のパーツ（色・袖丈・裾丈・帽子・マフラー など）。季節で中身を少し変える（夏は半袖、冬は厚手）
function clothes(ch, season, R) {
  const W = season === 'winter', S = season === 'summer', A = season === 'autumn';
  const pick = a => a[(R() * a.length) | 0];
  const c = { top: [0.6, 0.6, 0.6], leg: [0.25, 0.3, 0.45], shoe: [0.9, 0.9, 0.9], sleeve: 'long', bottom: 'pants', coat: 0, hat: null, scarf: null, collar: null, bag: null, puffy: 0 };
  switch (ch.outfit) {
    case 'casual': c.top = pick(S ? [[0.95, 0.95, 0.92], [0.3, 0.55, 0.8], [0.9, 0.55, 0.45]] : W ? [[0.55, 0.2, 0.2], [0.25, 0.3, 0.4], [0.75, 0.7, 0.6]] : [[0.45, 0.6, 0.45], [0.85, 0.8, 0.65], [0.4, 0.45, 0.65]]);
      c.sleeve = S ? 'short' : 'long'; c.leg = [0.22, 0.3, 0.48]; if (W) { c.coat = 0.12; c.puffy = 0.03; c.hat = [0.75, 0.25, 0.2]; } break;
    case 'smart': c.top = ch.sex ? pick([[0.95, 0.92, 0.88], [0.85, 0.75, 0.8], [0.7, 0.8, 0.9]]) : pick([[0.92, 0.94, 0.97], [0.6, 0.7, 0.85]]);
      c.leg = ch.sex ? [0.3, 0.28, 0.35] : [0.25, 0.25, 0.3]; c.shoe = [0.15, 0.1, 0.08]; c.bottom = ch.sex ? 'skirt' : 'pants'; c.collar = [0.98, 0.98, 0.98]; c.sleeve = S ? 'short' : 'long';
      if (W || A) { c.coat = 0.05; c.top = ch.sex ? [0.55, 0.42, 0.35] : [0.3, 0.32, 0.38]; } break;
    case 'light': c.top = pick([[0.98, 0.98, 0.95], [0.6, 0.82, 0.92], [0.98, 0.85, 0.5], [0.75, 0.9, 0.7]]); c.sleeve = 'short';
      c.bottom = ch.sex ? 'skirt' : 'shorts'; c.leg = ch.sex ? [0.4, 0.55, 0.75] : [0.7, 0.62, 0.48]; c.shoe = [0.55, 0.4, 0.3]; if (S) c.hat = ch.sex ? [0.95, 0.9, 0.75] : [0.9, 0.88, 0.8]; break;
    case 'coat': c.top = pick(W ? [[0.2, 0.22, 0.28], [0.55, 0.45, 0.35], [0.6, 0.15, 0.18]] : [[0.62, 0.5, 0.35], [0.35, 0.4, 0.32], [0.45, 0.35, 0.4]]); c.coat = 0.35; c.leg = [0.2, 0.2, 0.25]; c.shoe = [0.2, 0.15, 0.12];
      c.scarf = W ? pick([[0.85, 0.2, 0.2], [0.9, 0.88, 0.8], [0.3, 0.5, 0.7]]) : null; if (W) c.hat = [0.3, 0.3, 0.35]; break;
    case 'outdoor': c.top = pick([[0.95, 0.55, 0.1], [0.2, 0.5, 0.35], [0.2, 0.35, 0.65], [0.75, 0.15, 0.15]]); c.leg = [0.3, 0.32, 0.3]; c.shoe = [0.4, 0.3, 0.2];
      c.sleeve = S ? 'short' : 'long'; c.coat = S ? 0 : 0.1; c.puffy = W ? 0.06 : 0.02; c.hat = W ? [0.85, 0.85, 0.8] : [0.25, 0.3, 0.25]; break;
    case 'travel': c.top = pick([[0.78, 0.72, 0.62], [0.35, 0.42, 0.55], [0.6, 0.45, 0.5]]); c.collar = [0.95, 0.95, 0.93]; c.leg = [0.65, 0.58, 0.45]; c.shoe = [0.3, 0.22, 0.18];
      c.sleeve = S ? 'short' : 'long'; c.coat = W ? 0.2 : 0.06; c.bag = [0.35, 0.25, 0.18]; if (W) c.scarf = [0.7, 0.65, 0.55]; break;
    case 'kids': c.top = pick([[0.95, 0.75, 0.15], [0.3, 0.7, 0.9], [0.95, 0.45, 0.55], [0.4, 0.8, 0.4]]); c.leg = [0.25, 0.3, 0.5]; c.shoe = [0.9, 0.3, 0.3];
      c.sleeve = S ? 'short' : 'long'; c.bottom = S ? 'shorts' : 'pants'; c.hat = S ? [0.95, 0.85, 0.2] : W ? [0.4, 0.6, 0.85] : null; if (W) { c.coat = 0.12; c.puffy = 0.06; } break;
    case 'yukata': // 温泉宿の浴衣と羽織（冬のエンディング専用。設定画面では選ばない）
      c.top = ch.sex ? [0.85, 0.35, 0.4] : [0.18, 0.28, 0.5]; c.leg = c.top; c.bottom = 'pants'; c.coat = W ? 0.2 : 0.05; c.collar = [0.96, 0.95, 0.92]; c.shoe = [0.55, 0.4, 0.28]; c.sleeve = 'long'; c.scarf = null; c.hat = null; break;
  }
  return c;
}
// 表情（顔のパーツだけ。体とは別のメッシュにして切り替える）：neutral / smile / talk / blink / eat / laugh
export function buildFace(gb, ch, expr, pose = 'sit') {
  const L = look(ch), { k, hs } = L, hip = pose === 'bath' ? -0.42 * k : poseHip(pose, L), shY = hip + 0.5 * k * (L.child ? 0.92 : 1), hy = shY + 0.06 * k, lean = poseLean(pose), hz = lean * 0.6 * k + 0.1 * k * hs + 0.002;
  const dark = { c: [0.08, 0.06, 0.05] }, z = hz, eyeY = hy + 0.13 * k * hs, w = 0.032 * k * hs;
  const lid = expr === 'blink' || expr === 'laugh';
  for (const s of [-1, 1]) {
    if (lid) gb.box(s * 0.035 * k * hs - w / 2, eyeY - 0.004, z, s * 0.035 * k * hs + w / 2, eyeY + 0.004, z + 0.006, dark);
    else { gb.box(s * 0.035 * k * hs - w / 2 + 0.004, eyeY - 0.012 * hs, z, s * 0.035 * k * hs + w / 2 - 0.004, eyeY + 0.012 * hs, z + 0.006, dark); gb.box(s * 0.035 * k * hs + 0.002, eyeY + 0.003, z + 0.004, s * 0.035 * k * hs + 0.008, eyeY + 0.009, z + 0.008, { c: [1, 1, 1] }); }
    const by = eyeY + 0.03 * hs + (expr === 'smile' || expr === 'laugh' ? 0.005 : 0);
    gb.box(s * 0.035 * k * hs - w / 2, by, z, s * 0.035 * k * hs + w / 2, by + 0.006, z + 0.006, { c: L.hair });
    if (L.child || ch.sex) gb.box(s * 0.05 * k * hs - 0.012, eyeY - 0.04 * hs, z - 0.001, s * 0.05 * k * hs + 0.012, eyeY - 0.03 * hs, z + 0.004, { c: [0.95, 0.62, 0.6] }); // 頬
  }
  const my = hy + 0.055 * k * hs, mw = 0.03 * k * hs, red = { c: [0.6, 0.2, 0.2] };
  if (expr === 'talk' || expr === 'laugh') gb.box(-mw * 0.7, my - 0.012, z, mw * 0.7, my + 0.006, z + 0.006, red);
  else if (expr === 'smile') { gb.box(-mw, my, z, mw, my + 0.005, z + 0.006, red); gb.box(-mw - 0.006, my + 0.004, z, -mw, my + 0.01, z + 0.006, red); gb.box(mw, my + 0.004, z, mw + 0.006, my + 0.01, z + 0.006, red); }
  else if (expr === 'eat') gb.box(-mw * 0.5, my - 0.004, z, mw * 0.5, my + 0.006, z + 0.006, red);
  else gb.box(-mw * 0.7, my, z, mw * 0.7, my + 0.005, z + 0.006, red);
  if (L.old || (L.mid && !ch.sex)) for (const s of [-1, 1]) gb.box(s * 0.035 * k * hs - 0.024, eyeY - 0.018, z + 0.008, s * 0.035 * k * hs + 0.024, eyeY + 0.018, z + 0.012, { c: [0.2, 0.2, 0.22] }); // 眼鏡（50代男性・60代以上）
}
function poseHip(pose, L) { return pose === 'stand' || pose === 'walk0' || pose === 'walk1' ? 0.86 * L.k * (L.child ? 0.92 : 1) : pose === 'floor' ? 0.12 : 0; }
function poseLean(pose) { return pose === 'sit' ? -0.1 : pose === 'floor' ? -0.04 : 0.02; }
// 体（服を着た全身）。pose：sit（椅子・座席。腰が原点）/ floor（床・座布団・シートに座る）/ stand / walk0 / walk1 / bath（湯に肩までつかる：頭と肩だけ）
// opt.hands：[左手, 右手] の目標位置（体の座標）、opt.footY：足の高さの下限、opt.held：手に持つ物（'cup' / 'chopsticks' / 'bowl' / 'camera'）
export function buildChar(gb, ch, season, pose = 'sit', opt = {}) {
  const L = look(ch), { k, hs, R } = L, C = clothes(ch, season, R), sex = ch.sex;
  const skin = { c: L.skin }, hair = { c: L.hair }, top = { c: C.top }, leg = { c: C.leg }, shoe = { c: C.shoe }, legSkin = C.bottom !== 'pants' ? skin : leg;
  const sit = pose === 'sit', floor = pose === 'floor', bath = pose === 'bath', sw = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;
  const hipY = bath ? -0.42 * k : poseHip(pose, L), lean = poseLean(pose), shY = hipY + 0.5 * k * (L.child ? 0.92 : 1);
  const hw = (sex ? 0.165 : 0.195) * k * (L.child ? 0.92 : 1) + C.puffy, dz = 0.11 * k + C.puffy;
  if (!bath) {
    // 胴体・コート（裾が腰より下へ）・襟・マフラー・ショルダーバッグ
    gb.box(-hw, hipY, -dz + lean * 0.3, hw, shY, dz + lean * 0.3, top);
    if (C.coat > 0 && !sit && !floor) gb.box(-hw - 0.01, hipY - C.coat, -dz - 0.01, hw + 0.01, hipY + 0.05, dz + 0.01, top);
    else if (C.coat > 0) gb.box(-hw - 0.01, hipY - 0.02, -dz - 0.01, hw + 0.01, hipY + 0.08, dz + 0.04 + C.coat * 0.6, top);
    if (C.collar) gb.box(-0.06 * k, shY - 0.15 * k, dz + lean * 0.3, 0.06 * k, shY, dz + lean * 0.3 + 0.006, { c: C.collar });
    if (C.scarf) gb.box(-0.1 * k, shY - 0.04 * k, -0.08 * k + lean * 0.3, 0.1 * k, shY + 0.05 * k, dz + lean * 0.3 + 0.02, { c: C.scarf });
    if (C.bag && !floor) { gb.beam([hw * 0.8, shY, 0], [-hw * 0.9, hipY + 0.12, dz * 0.6], 0.015, { c: C.bag }); gb.cbox(-hw - 0.03, hipY + 0.08, 0.02, 0.05, 0.14, 0.16, { c: C.bag }); }
    gb.box(-hw * 0.95, hipY - 0.1 * k, -0.11 * k, hw * 0.95, hipY + 0.02, 0.11 * k, C.bottom === 'skirt' ? { c: C.leg } : leg);
    // 脚（スカート・半ズボンは膝から下が肌）
    for (const s of [-1, 1]) {
      const hx = s * hw * 0.5; let knee, foot;
      if (sit) { const f0 = hipY - 0.4 * k, fy = opt.footY != null ? Math.max(f0, opt.footY) : f0; knee = [hx, hipY + 0.04 + (fy - f0) * 0.5, 0.42 * k]; foot = [hx * 1.1, fy, 0.5 * k + (fy - f0) * 0.4]; }
      else if (floor) { knee = [hx + s * 0.13 * k, hipY + 0.12 * k, 0.32 * k]; foot = [-s * 0.08 * k, hipY - 0.06, 0.42 * k]; }
      else { const a = sw * s * 0.38; knee = [hx, hipY * 0.5, Math.sin(a) * hipY * 0.5]; foot = [hx, 0.05, Math.sin(a) * hipY * 0.85 + (a < 0 ? -0.04 : 0.04)]; }
      const up = [hx, hipY, 0.02];
      if (C.bottom === 'skirt') { gb.beam(up, [(up[0] + knee[0]) / 2, (up[1] + knee[1]) / 2, (up[2] + knee[2]) / 2], 0.085 * k, { c: C.leg }); gb.beam([(up[0] + knee[0]) / 2, (up[1] + knee[1]) / 2, (up[2] + knee[2]) / 2], knee, 0.055 * k, skin); }
      else gb.beam(up, knee, 0.075 * k + C.puffy * 0.3, leg);
      gb.beam(knee, foot, 0.06 * k, C.bottom === 'shorts' || C.bottom === 'skirt' ? legSkin : leg);
      gb.cbox(foot[0], foot[1] + 0.03, foot[2] + 0.04, 0.1 * k, 0.07, 0.24 * k, shoe);
    }
  } else {
    // 湯につかる：肩から上だけ。肩には湯気よけのタオルは掛けない（湯の上は頭と首・肩の線だけ）
    gb.box(-hw, shY - 0.08, -dz, hw, shY + 0.02, dz, skin);
  }
  // 頭・髪（子どもは頭を大きめに）。女性は長い後ろ髪、10代は前髪多め
  const hy = shY + 0.06 * k, hz = lean * 0.6 * k, hk = k * hs;
  gb.box(-0.02 * k, shY, hz - 0.03, 0.02 * k, hy + 0.01, hz + 0.03, skin); // 首
  gb.box(-0.085 * hk, hy, hz - 0.1 * hk, 0.085 * hk, hy + 0.22 * hk, hz + 0.1 * hk, skin);
  gb.box(-0.095 * hk, hy + 0.155 * hk, hz - 0.115 * hk, 0.095 * hk, hy + 0.255 * hk, hz + 0.09 * hk, hair);
  gb.box(-0.095 * hk, hy + 0.05 * hk, hz - 0.12 * hk, 0.095 * hk, hy + 0.2 * hk, hz - 0.06 * hk, hair);
  for (const s of [-1, 1]) gb.box(s * 0.086 * hk - (s > 0 ? 0 : 0.012), hy + 0.12 * hk, hz - 0.08 * hk, s * 0.086 * hk + (s > 0 ? 0.012 : 0), hy + 0.22 * hk, hz + 0.05 * hk, hair); // もみあげ
  if (sex) { gb.box(-0.1 * hk, hy - (L.child ? 0.02 : 0.06) * hk, hz - 0.13 * hk, 0.1 * hk, hy + 0.2 * hk, hz - 0.05 * hk, hair); if (L.teen || L.child) gb.box(-0.105 * hk, hy + 0.12 * hk, hz - 0.12 * hk, -0.07 * hk, hy + 0.22 * hk, hz + 0.02, hair); }
  if (L.teen && !sex) gb.box(-0.09 * hk, hy + 0.19 * hk, hz + 0.06 * hk, 0.09 * hk, hy + 0.23 * hk, hz + 0.105 * hk, hair); // 前髪
  gb.box(-0.012 * hk, hy + 0.08 * hk, hz + 0.1 * hk, 0.012 * hk, hy + 0.12 * hk, hz + 0.115 * hk, skin); // 鼻
  if (bath) { gb.box(-0.1 * hk, hy + 0.24 * hk, hz - 0.08 * hk, 0.1 * hk, hy + 0.29 * hk, hz + 0.08 * hk, { c: [0.97, 0.97, 0.95] }); } // 頭に手ぬぐい
  else if (C.hat) { const hat = { c: C.hat }; if (ch.outfit === 'light' && sex) { gb.box(-0.17 * hk, hy + 0.22 * hk, hz - 0.17 * hk, 0.17 * hk, hy + 0.235 * hk, hz + 0.17 * hk, hat); gb.box(-0.1 * hk, hy + 0.22 * hk, hz - 0.11 * hk, 0.1 * hk, hy + 0.3 * hk, hz + 0.1 * hk, hat); }
    else if (season === 'winter' || (ch.outfit === 'kids' && season === 'winter')) gb.box(-0.1 * hk, hy + 0.17 * hk, hz - 0.12 * hk, 0.1 * hk, hy + 0.3 * hk, hz + 0.105 * hk, hat); // ニット帽
    else { gb.box(-0.1 * hk, hy + 0.2 * hk, hz - 0.11 * hk, 0.1 * hk, hy + 0.28 * hk, hz + 0.1 * hk, hat); gb.box(-0.08 * hk, hy + 0.2 * hk, hz + 0.08 * hk, 0.08 * hk, hy + 0.215 * hk, hz + 0.18 * hk, hat); } } // キャップ・麦わら帽子
  if (bath) return;
  // 腕（袖の長さ：半袖は肘から先が肌）
  for (const s of [-1, 1]) {
    const sh = [s * (hw + 0.03 * k), shY - 0.05 * k, lean * 0.3 * k];
    let hand = opt.hands ? opt.hands[s < 0 ? 0 : 1] : null;
    if (!hand) { if (sit || floor) hand = [s * (hw * 0.6), hipY + 0.1, 0.28 * k]; else { const a = -sw * s * 0.45; hand = [s * (hw + 0.06 * k), shY - 0.55 * k, Math.sin(a) * 0.5 * k]; } }
    const mid = [(sh[0] + hand[0]) / 2 + s * 0.06 * k, (sh[1] + hand[1]) / 2 - 0.05 * k, (sh[2] + hand[2]) / 2 - 0.03];
    gb.beam(sh, mid, 0.058 * k + C.puffy * 0.4, top);
    gb.beam(mid, hand, 0.048 * k, C.sleeve === 'short' ? skin : top);
    gb.cbox(hand[0], hand[1], hand[2], 0.075 * k, 0.08 * k, 0.085 * k, skin);
  }
  // 手に持つ物
  const H = opt.hands, h = H ? H[1] : null, l = H ? H[0] : null;
  if (opt.held === 'cup' && h) { gb.cyl(h[0], h[1] - 0.02, h[2] + 0.03, 0.035, 0.09, 8, { c: opt.cupCol || [0.95, 0.95, 0.93] }); }
  if (opt.held === 'chopsticks' && h) { gb.beam([h[0], h[1], h[2]], [h[0] - 0.03, h[1] + 0.02, h[2] + 0.2], 0.006, { c: [0.55, 0.35, 0.2] }); gb.beam([h[0] + 0.01, h[1], h[2]], [h[0] - 0.015, h[1] + 0.03, h[2] + 0.2], 0.006, { c: [0.55, 0.35, 0.2] }); }
  if (opt.held === 'bowl' && l) { gb.cyl(l[0], l[1] - 0.03, l[2] + 0.02, 0.07, 0.06, 10, { c: [0.6, 0.12, 0.1] }); }
  if (opt.held === 'camera' && h) { gb.cbox((l[0] + h[0]) / 2, (l[1] + h[1]) / 2, (l[2] + h[2]) / 2, 0.14, 0.09, 0.06, { c: [0.15, 0.15, 0.17] }); }
}
// 顔の中心（体の座標）：ムービーのカメラの狙いに使う
export function headPos(ch, pose = 'sit') { const L = look(ch), hip = pose === 'bath' ? -0.42 * L.k : poseHip(pose, L), shY = hip + 0.5 * L.k * (L.child ? 0.92 : 1); return [0, shY + 0.06 * L.k + 0.12 * L.k * L.hs, poseLean(pose) * 0.6 * L.k + 0.1]; }
export function charHeight(ch) { return look(ch).H; }

// ---- 車内の座席 ----
// 車体座標：運転席は右（x=-0.36）、助手席は左（x=+0.36）。前席の座面の上面 y=0.5（z=-1.02〜-0.5）、後席 y=0.5（z=-1.52〜-1.18）
export const SEAT_POS = { driver: [-0.36, 0.5, -0.86], front: [0.36, 0.5, -0.86], rearR: [-0.36, 0.5, -1.36], rearL: [0.36, 0.5, -1.36] };
export function buildPassengersInCar(gb, passengers, season) {
  for (const p of passengers) {
    const sp = SEAT_POS[p.seat]; if (!sp) continue;
    const child = p.ch.age === 'child', lift = child ? 0.12 : 0;
    if (child) { // ジュニアシート（座面を上げ、左右のサイドサポートと背もたれ）
      const js = { c: [0.15, 0.17, 0.22] };
      gb.box(sp[0] - 0.2, sp[1], sp[2] - 0.17, sp[0] + 0.2, sp[1] + lift, sp[2] + 0.22, js);
      for (const s of [-1, 1]) gb.box(sp[0] + s * 0.2 - 0.03, sp[1] + lift, sp[2] - 0.17, sp[0] + s * 0.2 + 0.03, sp[1] + lift + 0.18, sp[2] + 0.15, js);
      gb.box(sp[0] - 0.2, sp[1], sp[2] - 0.22, sp[0] + 0.2, sp[1] + 0.68, sp[2] - 0.15, js);
    }
    // 腰を座面の上（背もたれ寄り）に置き、足は床（y=0.26）の上。手は膝の上
    const hip = [sp[0], sp[1] + lift + 0.06, sp[2] - 0.04];
    gb.setXf(hip[0], hip[1], hip[2], 0);
    const k = charHeight(p.ch) / 1.7;
    buildChar(gb, p.ch, season, 'sit', { footY: 0.27 - hip[1], hands: [[-0.1 * k, 0.12, 0.3 * k], [0.1 * k, 0.12, 0.3 * k]] });
    buildFace(gb, p.ch, 'smile', 'sit');
    // シートベルト（肩から腰へ斜めに）
    const sx = p.seat === 'front' || p.seat === 'rearL' ? 1 : -1;
    gb.beam([sx * 0.16 * k, 0.48 * k, 0.0], [-sx * 0.12 * k, 0.05, 0.12], 0.012, { c: [0.12, 0.12, 0.13] });
    gb.clearXf();
  }
}
