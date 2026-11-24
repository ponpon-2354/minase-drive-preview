// 長距離ドライブモード：同乗者・運転者のキャラクター（性別・年齢・服装・表情）と、車内の座席配置
// キャラクターはローポリの汎用人形（実在の人物・キャラクターではない）。年齢は体格・髪・顔・服装の細部に反映する
import { rng } from './math.js?v=0.9.3';

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
// 修正121：長距離モードの人物は高ポリゴン版（buildCharHi / buildFaceHi）。opt.lo / lo=true で従来の箱型
export function buildFace(gb, ch, expr, pose = 'sit', lo = false) { if (!lo) return buildFaceHi(gb, ch, expr, pose); buildFaceLo(gb, ch, expr, pose); }
function buildFaceLo(gb, ch, expr, pose = 'sit') {
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
export function buildChar(gb, ch, season, pose = 'sit', opt = {}) { if (!opt.lo) return buildCharHi(gb, ch, season, pose, opt); buildCharLo(gb, ch, season, pose, opt); }
function buildCharLo(gb, ch, season, pose = 'sit', opt = {}) {
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
    const sh = [s * (hw + 0.03 * k - (sit ? C.puffy * 0.5 : 0)), shY - 0.05 * k, lean * 0.3 * k]; // 修正113：座席では厚手の上着の袖を体に寄せる
    let hand = opt.hands ? opt.hands[s < 0 ? 0 : 1] : null;
    if (!hand) { if (sit || floor) hand = [s * (hw * 0.6), hipY + 0.1, 0.28 * k]; else { const a = -sw * s * 0.45; hand = [s * (hw + 0.06 * k), shY - 0.55 * k, Math.sin(a) * 0.5 * k]; } }
    const mid = [(sh[0] + hand[0]) / 2 + s * (sit ? 0.03 : 0.06) * k, (sh[1] + hand[1]) / 2 - 0.05 * k, (sh[2] + hand[2]) / 2 - 0.03]; // 修正113：座ったときは肘を張り出さない（車内の内張りに当たらない）
    gb.beam(sh, mid, 0.058 * k + C.puffy * (sit ? 0.2 : 0.4), top);
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

// ======== 修正121：高ポリゴンの人物 ========
// 顔（輪郭は顎を細めた楕円体・目は白目／虹彩／瞳／まぶた・眉・鼻・口・耳）、髪（頭を覆う曲面＋性別・年齢で後ろ髪・前髪）、
// 手指（手のひら＋4本の指と親指、関節で曲げる）、衣服（胴は楕円の断面をつないだ曲面、手足はテーパーの付いた筒と関節の球）。法線は頂点ごと（なめらかな陰影）。
// 位置・寸法・姿勢の決め方は従来版（buildCharLo）と同じなので、ムービー・車内の配置はそのまま使える。opt.lod=1 は一段軽い版（施設の利用客など）
const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
function svx(gb, p, n, o) { gb.vert(p, n, o.c || [1, 1, 1], [0, 0], o.mat || 0, o.lay ?? 0); }
function stri(gb, a, b, c, o) { svx(gb, a[0], a[1], o); svx(gb, b[0], b[1], o); svx(gb, c[0], c[1], o); }
// 格子（rows×segs の点 [p,n]）を外向きの三角形に。keep(i,j) が false のマスは張らない
function grid(gb, P, rows, segs, o, keep) { for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { if (keep && !keep(i, j)) continue; const a = P[i][j], b = P[i][j + 1], c = P[i + 1][j + 1], d = P[i + 1][j]; stri(gb, a, b, c, o); stri(gb, a, c, d, o); } }
// 楕円体（中心 c、半径 r=[rx,ry,rz]）。warp(p,n,u) で形を変形、keep(u) で一部だけ張る（u は単位球上の点）
function ellip(gb, c, r, o, rows = 8, segs = 12, keep = null, warp = null) {
  const P = [], U = [];
  for (let i = 0; i <= rows; i++) { const ph = -Math.PI / 2 + Math.PI * i / rows, row = [], ur = []; for (let j = 0; j <= segs; j++) { const th = j / segs * Math.PI * 2, u = [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
      let p = [c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], n = v3.nrm([u[0] / r[0], u[1] / r[1], u[2] / r[2]]); if (warp) [p, n] = warp(p, n, u); row.push([p, n]); ur.push(u); } P.push(row); U.push(ur); }
  grid(gb, P, rows, segs, o, keep ? (i, j) => { const a = U[i][j], b = U[i + 1][j + 1]; return keep([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); } : null);
}
// 2点を結ぶテーパーの付いた筒（r0→r1）。端は呼び出し側で球（関節）でふさぐ
function tube(gb, p0, p1, r0, r1, o, seg = 10) {
  const d = v3.nrm(v3.sub(p1, p0)), ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = v3.nrm(v3.cross(d, ref)), v = v3.cross(d, u), P = [[], []];
  for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, dir = v3.add(v3.mul(u, Math.cos(a)), v3.mul(v, Math.sin(a))); P[0].push([v3.add(p0, v3.mul(dir, r0)), dir]); P[1].push([v3.add(p1, v3.mul(dir, r1)), dir]); }
  grid(gb, P, 1, seg, o);
}
function ball(gb, c, r, o, n = 6) { ellip(gb, c, [r, r, r], o, n, n * 2 - 2 > 6 ? n * 2 - 2 : 6); }
// 法線 nz を向いた楕円の板（目・口など）。e1 を横方向に
function disc(gb, c, rx, ry, nz, o, seg = 10, e1 = [1, 0, 0]) { const n = v3.nrm(nz), x = v3.nrm(v3.sub(e1, v3.mul(n, e1[0] * n[0] + e1[1] * n[1] + e1[2] * n[2]))), y = v3.cross(n, x); let prev = null;
  for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, p = v3.add(c, v3.add(v3.mul(x, Math.cos(a) * rx), v3.mul(y, Math.sin(a) * ry))); if (prev) stri(gb, [c, n], [prev, n], [p, n], o); prev = p; } }
// 点列に沿った細い筒（眉・まぶた・口の線）
function strand(gb, pts, r, o, seg = 5) { for (let i = 0; i < pts.length - 1; i++) tube(gb, pts[i], pts[i + 1], r, r, o, seg); }
// 頭の寸法（体の座標）：顔の前面は従来どおり hz + 0.1*hk
function headGeo(ch, pose) { const L = look(ch), k = L.k, hs = L.hs, hk = k * hs, hip = pose === 'bath' ? -0.42 * k : poseHip(pose, L), shY = hip + 0.5 * k * (L.child ? 0.92 : 1), hy = shY + 0.06 * k, hz = poseLean(pose) * 0.6 * k;
  return { L, k, hs, hk, shY, hy, hz, cy: hy + 0.115 * hk, rx: 0.083 * hk, ry: 0.122 * hk, rz: 0.1 * hk }; }
// 顔の表面（x,y における前面の z と法線）
function faceZ(H, x, y) { const t = Math.max(0, (H.cy - y) / H.ry), jx = H.rx * (1 - 0.22 * t * t), q = 1 - (x / jx) ** 2 - ((y - H.cy) / H.ry) ** 2; const z = H.hz + H.rz * Math.sqrt(Math.max(0.02, q)); return [z, v3.nrm([x / (jx * jx), (y - H.cy) / (H.ry * H.ry), (z - H.hz) / (H.rz * H.rz)])]; }
const jawWarp = H => (p, n, u) => { if (u[1] < 0) { const t = -u[1], sx = 1 - 0.22 * t * t; p = [p[0] * sx, p[1], p[2] + (u[2] > 0 ? 0.006 * t * H.hk : 0)]; } return [p, n]; }; // 顎を細く・あごの先を少し前へ

export function buildCharHi(gb, ch, season, pose = 'sit', opt = {}) {
  const L = look(ch), { k, hs, R } = L, C = clothes(ch, season, R), sex = ch.sex, lod = opt.lod || 0, SG = lod ? 8 : 12, RW = lod ? 6 : 9;
  const skin = { c: L.skin }, hair = { c: L.hair }, top = { c: C.top }, leg = { c: C.leg }, shoe = { c: C.shoe }, legSkin = C.bottom !== 'pants' ? skin : leg;
  const sit = pose === 'sit', floor = pose === 'floor', bath = pose === 'bath', sw = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;
  const hipY = bath ? -0.42 * k : poseHip(pose, L), lean = poseLean(pose), shY = hipY + 0.5 * k * (L.child ? 0.92 : 1);
  const hw = (sex ? 0.165 : 0.195) * k * (L.child ? 0.92 : 1) + C.puffy, dz = 0.11 * k + C.puffy, lz = lean * 0.3;
  const H = headGeo(ch, pose), hk = H.hk;
  if (!bath) {
    // 胴：楕円の断面（腰→ウエスト→胸→肩→首元）をつないだ曲面
    const ring = [[0, 0.95, 0.95], [0.3, sex ? 0.8 : 0.9, 0.86], [0.62, 1.0, sex ? 1.02 : 0.98], [0.9, 1.02, 0.9], [1.0, 0.8, 0.72], [1.06, 0.36, 0.42]], P = [];
    for (const [t, wx, wz] of ring) { const y = hipY + (shY - hipY) * t, row = []; for (let j = 0; j <= SG; j++) { const a = j / SG * Math.PI * 2, x = Math.sin(a) * hw * wx, z = Math.cos(a) * dz * wz + lz; row.push([[x, y, z], v3.nrm([Math.sin(a) / (hw * wx), 0.0, Math.cos(a) / (dz * wz)])]); } P.push(row); }
    grid(gb, P, ring.length - 1, SG, top);
    // 腰回り（ズボン・スカートの上端）
    ellip(gb, [0, hipY - 0.02 * k, lz * 0.5], [hw * 0.96, 0.085 * k, 0.115 * k], C.bottom === 'skirt' ? { c: C.leg } : leg, lod ? 5 : 7, SG);
    // コート（立ち姿は裾が腰より下へ広がる。座ると膝の上にかかる）
    if (C.coat > 0 && !sit && !floor) tube(gb, [0, hipY + 0.06, lz], [0, hipY - C.coat, lz], Math.max(hw, dz) * 1.02, Math.max(hw, dz) * 1.12, top, SG);
    else if (C.coat > 0) ellip(gb, [0, hipY + 0.02, dz * 0.6 + lz], [hw * 1.02, 0.05, dz * 0.7 + C.coat * 0.3], top, 5, SG);
    if (C.collar) { const pts = []; for (let i = 0; i <= 8; i++) { const a = -1.2 + 2.4 * i / 8; pts.push([Math.sin(a) * 0.075 * k, shY + 0.005 - Math.abs(Math.sin(a)) * 0.02, Math.cos(a) * 0.07 * k + lz + 0.01]); } strand(gb, pts, 0.012 * k, { c: C.collar }, 5); }
    if (C.scarf) { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([Math.sin(a) * 0.085 * k, shY + 0.01 * k, Math.cos(a) * 0.08 * k + lz]); } strand(gb, pts, 0.03 * k, { c: C.scarf }, 7); tube(gb, [0.04 * k, shY, 0.09 * k + lz], [0.05 * k, shY - 0.2 * k, 0.1 * k + lz], 0.025 * k, 0.022 * k, { c: C.scarf }, 6); }
    if (C.bag && !floor) { tube(gb, [hw * 0.8, shY, 0], [-hw * 0.9, hipY + 0.12, dz * 0.6], 0.012, 0.012, { c: C.bag }, 5); ellip(gb, [-hw - 0.03, hipY + 0.08, 0.02], [0.03, 0.08, 0.09], { c: C.bag }, 4, 8); }
    // 脚：太もも・すね（テーパーの筒）と膝・足首の球、靴（丸みのある楕円体）
    for (const s of [-1, 1]) {
      const hx = s * hw * 0.5; let knee, foot;
      if (sit) { const f0 = hipY - 0.4 * k, fy = opt.footY != null ? Math.max(f0, opt.footY) : f0; knee = [hx, hipY + 0.04 + (fy - f0) * 0.5, 0.42 * k]; foot = [hx * 1.1, fy, 0.5 * k + (fy - f0) * 0.4]; }
      else if (floor) { knee = [hx + s * 0.13 * k, hipY + 0.12 * k, 0.32 * k]; foot = [-s * 0.08 * k, hipY - 0.06, 0.42 * k]; }
      else { const a = sw * s * 0.38; knee = [hx, hipY * 0.5, Math.sin(a) * hipY * 0.5]; foot = [hx, 0.05, Math.sin(a) * hipY * 0.85 + (a < 0 ? -0.04 : 0.04)]; }
      const up = [hx, hipY, 0.02], rT = 0.075 * k + C.puffy * 0.3, ankle = [foot[0], foot[1] + 0.06, foot[2]];
      if (C.bottom === 'skirt') { const m = v3.lerp(up, knee, 0.55); tube(gb, up, m, 0.09 * k, 0.085 * k, { c: C.leg }, SG); tube(gb, m, knee, 0.055 * k, 0.05 * k, skin, SG); }
      else tube(gb, up, knee, rT, 0.062 * k, leg, SG);
      ball(gb, knee, (C.bottom === 'skirt' ? 0.05 : 0.062) * k, C.bottom === 'pants' ? leg : C.bottom === 'skirt' ? skin : legSkin, lod ? 4 : 5);
      tube(gb, knee, ankle, 0.056 * k, 0.04 * k, C.bottom === 'shorts' || C.bottom === 'skirt' ? legSkin : leg, SG);
      ellip(gb, [foot[0], foot[1] + 0.035, foot[2] + 0.045], [0.05 * k, 0.038, 0.12 * k], shoe, lod ? 4 : 6, SG, null, (p, n, u) => u[1] < -0.3 ? [[p[0], foot[1] + 0.035 - 0.026, p[2]], [0, -1, 0]] : [p, n]); // 靴底は平ら
    }
  } else {
    // 湯につかる：肩の線だけ（肌）
    ellip(gb, [0, shY - 0.03, 0], [hw, 0.06, dz], skin, 6, SG, u => u[1] > -0.2);
  }
  // 首と頭（輪郭：顎を細めた楕円体）・耳・鼻
  tube(gb, [0, shY - 0.02, H.hz - 0.01], [0, H.hy + 0.03 * hk, H.hz - 0.005], 0.034 * k, 0.03 * k, skin, SG);
  ellip(gb, [0, H.cy, H.hz], [H.rx, H.ry, H.rz], skin, lod ? 8 : 12, lod ? 12 : 16, null, jawWarp(H));
  for (const s of [-1, 1]) ellip(gb, [s * H.rx * 0.98, H.cy - 0.005 * hk, H.hz - 0.01 * hk], [0.012 * hk, 0.03 * hk, 0.02 * hk], skin, 4, 8);
  { const ny = H.cy - 0.022 * hk, [nz] = faceZ(H, 0, ny); ellip(gb, [0, ny, nz - 0.004], [0.009 * hk, 0.017 * hk, 0.013 * hk], skin, 4, 8); }
  // 髪：頭を覆う曲面（前は額の上まで、横は耳の上、後ろは襟足まで）。女性は後ろ髪を肩へ、10代・子どもの女性は横の髪、10代男性は前髪
  const hr = [H.rx * 1.09, H.ry * 1.05, H.rz * 1.1], fringe = L.teen && !sex ? 0.05 : sex ? 0.22 : 0.3;
  if (!bath || true) ellip(gb, [0, H.cy + 0.004, H.hz - 0.006], hr, hair, lod ? 8 : 12, lod ? 12 : 18, u => { const fz = Math.max(0, u[2]), bz = Math.max(0, -u[2]), side = 1 - Math.abs(u[2]); return u[1] > fringe * fz + (sex ? -0.75 : -0.45) * bz + (sex ? -0.25 : 0.05) * side; });
  if (sex && !bath) { // 後ろ髪（頭の後ろから肩へ。子どもは短め）
    const yb = H.hy - (L.child ? 0.02 : 0.08) * hk - (L.old ? -0.05 : 0), P = [], NA = lod ? 6 : 9;
    for (let i = 0; i <= 4; i++) { const t = i / 4, y = H.cy + (yb - H.cy) * t, rr = 1.08 - 0.12 * t, row = []; for (let j = 0; j <= NA; j++) { const a = Math.PI * 0.55 + Math.PI * 0.9 * j / NA, d = [Math.sin(a), 0, Math.cos(a)]; row.push([[d[0] * H.rx * rr, y, H.hz + d[2] * H.rz * rr * 1.05 - 0.01 * t], d]); } P.push(row); }
    grid(gb, P, 4, NA, hair);
    if (L.teen || L.child) for (const s of [-1, 1]) tube(gb, [s * H.rx * 1.02, H.cy + 0.04 * hk, H.hz + 0.03 * hk], [s * H.rx * 0.98, H.cy - 0.09 * hk, H.hz + 0.04 * hk], 0.016 * hk, 0.01 * hk, hair, 6);
  }
  if (bath) ellip(gb, [0, H.cy + H.ry * 0.95, H.hz], [H.rx * 1.05, 0.03 * hk, H.rz * 0.95], { c: [0.97, 0.97, 0.95] }, 4, 10); // 頭に手ぬぐい
  else if (C.hat) { const hat = { c: C.hat }, ctop = [0, H.cy + 0.02 * hk, H.hz - 0.004];
    if (ch.outfit === 'light' && sex) { disc(gb, [0, H.cy + H.ry * 0.72, H.hz], 0.17 * hk, 0.17 * hk, [0, 1, 0], hat, 18); disc(gb, [0, H.cy + H.ry * 0.72 - 0.002, H.hz], 0.17 * hk, 0.17 * hk, [0, -1, 0], hat, 18); ellip(gb, [0, H.cy + H.ry * 0.7, H.hz], [H.rx * 1.12, 0.07 * hk, H.rz * 1.12], hat, 5, 14, u => u[1] > 0); }
    else if (season === 'winter') ellip(gb, ctop, [H.rx * 1.13, H.ry * 1.1, H.rz * 1.13], hat, 8, 16, u => u[1] > 0.12); // ニット帽
    else { ellip(gb, ctop, [H.rx * 1.12, H.ry * 1.06, H.rz * 1.12], hat, 7, 16, u => u[1] > 0.3); disc(gb, [0, H.cy + H.ry * 0.42, H.hz + H.rz * 0.95], 0.075 * hk, 0.06 * hk, [0, 1, 0.25], hat, 12); } }
  if (bath) return;
  // 腕：肩・肘の球、上腕・前腕の筒（半袖は前腕が肌）、手（手のひら＋指）
  for (const s of [-1, 1]) {
    const sh = [s * (hw + 0.03 * k - (sit ? C.puffy * 0.5 : 0)), shY - 0.05 * k, lean * 0.3 * k];
    let hand = opt.hands ? opt.hands[s < 0 ? 0 : 1] : null;
    if (!hand) { if (sit || floor) hand = [s * (hw * 0.6), hipY + 0.1, 0.28 * k]; else { const a = -sw * s * 0.45; hand = [s * (hw + 0.06 * k), shY - 0.55 * k, Math.sin(a) * 0.5 * k]; } }
    const mid = [(sh[0] + hand[0]) / 2 + s * (sit ? 0.03 : 0.06) * k, (sh[1] + hand[1]) / 2 - 0.05 * k, (sh[2] + hand[2]) / 2 - 0.03];
    const ru = 0.056 * k + C.puffy * (sit ? 0.2 : 0.4), dirF = v3.nrm(v3.sub(hand, mid)), wrist = v3.sub(hand, v3.mul(dirF, 0.045 * k)), sleeve = C.sleeve === 'short';
    ball(gb, sh, ru * 1.05, top, lod ? 4 : 5);
    tube(gb, sh, mid, ru, ru * 0.88, top, SG); ball(gb, mid, ru * 0.88, sleeve ? skin : top, lod ? 4 : 5);
    if (sleeve) tube(gb, mid, wrist, 0.042 * k, 0.03 * k, skin, SG); else { tube(gb, mid, v3.lerp(mid, wrist, 0.85), ru * 0.86, ru * 0.8, top, SG); tube(gb, v3.lerp(mid, wrist, 0.85), wrist, 0.032 * k, 0.03 * k, skin, SG); }
    hiHand(gb, wrist, dirF, s, k, skin, lod, opt.held && s > 0 ? 0.9 : opt.held === 'bowl' && s < 0 ? 0.8 : 0.45);
  }
  // 手に持つ物（従来と同じ）
  const HH = opt.hands, h = HH ? HH[1] : null, l = HH ? HH[0] : null;
  if (opt.held === 'cup' && h) { gb.cyl(h[0], h[1] - 0.02, h[2] + 0.03, 0.035, 0.09, 12, { c: opt.cupCol || [0.95, 0.95, 0.93] }); }
  if (opt.held === 'chopsticks' && h) { gb.beam([h[0], h[1], h[2]], [h[0] - 0.03, h[1] + 0.02, h[2] + 0.2], 0.006, { c: [0.55, 0.35, 0.2] }); gb.beam([h[0] + 0.01, h[1], h[2]], [h[0] - 0.015, h[1] + 0.03, h[2] + 0.2], 0.006, { c: [0.55, 0.35, 0.2] }); }
  if (opt.held === 'bowl' && l) { gb.cyl(l[0], l[1] - 0.03, l[2] + 0.02, 0.07, 0.06, 14, { c: [0.6, 0.12, 0.1] }); }
  if (opt.held === 'camera' && h) { gb.cbox((l[0] + h[0]) / 2, (l[1] + h[1]) / 2, (l[2] + h[2]) / 2, 0.14, 0.09, 0.06, { c: [0.15, 0.15, 0.17] }); }
}
// 手：手首 w から向き f へ。手のひら（平たい楕円体）と、2関節で曲がる4本の指・親指。curl 0..1 で握り具合
function hiHand(gb, w, f, s, k, o, lod, curl) {
  const up = Math.abs(f[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], side = v3.nrm(v3.cross(f, up)), nrm = v3.cross(side, f); // side：手の幅方向、nrm：手の甲
  const pc = v3.add(w, v3.mul(f, 0.04 * k)), seg = lod ? 4 : 6;
  // 手のひら（楕円体を手の向きに合わせて置く：軸ごとに頂点を組み立てる）
  const rows = lod ? 4 : 6, segs = lod ? 6 : 10, P = [];
  for (let i = 0; i <= rows; i++) { const ph = -Math.PI / 2 + Math.PI * i / rows, row = []; for (let j = 0; j <= segs; j++) { const th = j / segs * Math.PI * 2, a = Math.cos(ph) * Math.cos(th), b = Math.sin(ph), c = Math.cos(ph) * Math.sin(th);
    const p = v3.add(pc, v3.add(v3.mul(side, a * 0.042 * k), v3.add(v3.mul(f, b * 0.048 * k), v3.mul(nrm, c * 0.017 * k)))); row.push([p, v3.nrm(v3.add(v3.mul(side, a / 0.042), v3.add(v3.mul(f, b / 0.048), v3.mul(nrm, c / 0.017))))]); } P.push(row); }
  // 巻き順：side×f = -nrm 方向になるので、外向きにそろえるため行を逆順に
  P.reverse(); grid(gb, P, rows, segs, o);
  const tip = (base, dir, len, r) => { const b1 = v3.add(base, v3.mul(dir, len * 0.5)), d2 = v3.nrm(v3.sub(v3.mul(dir, Math.cos(curl * 1.1)), v3.mul(nrm, Math.sin(curl * 1.1)))), b2 = v3.add(b1, v3.mul(d2, len * 0.5)); tube(gb, base, b1, r, r * 0.92, o, seg); tube(gb, b1, b2, r * 0.92, r * 0.8, o, seg); ball(gb, b2, r * 0.8, o, 3); };
  for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.021 * k, base = v3.add(pc, v3.add(v3.mul(side, x), v3.mul(f, 0.044 * k))), len = [0.05, 0.058, 0.055, 0.044][i] * k, d = v3.nrm(v3.add(f, v3.mul(side, x * 1.5))); tip(base, d, len, 0.0085 * k); }
  { const base = v3.add(pc, v3.add(v3.mul(side, -s * 0.036 * k), v3.mul(f, -0.01 * k))), d = v3.nrm(v3.add(v3.mul(side, -s * 0.6), v3.add(f, v3.mul(nrm, -0.4)))); tip(base, d, 0.045 * k, 0.01 * k); }
}
// 表情（顔のパーツ）：neutral / smile / talk / blink / eat / laugh。顔の曲面に沿って置く
export function buildFaceHi(gb, ch, expr, pose = 'sit') {
  const H = headGeo(ch, pose), L = H.L, hk = H.hk, dark = { c: [0.07, 0.05, 0.04] }, white = { c: [0.97, 0.97, 0.95] }, iris = { c: [0.28, 0.18, 0.1] }, brow = { c: L.hair.map(v => Math.min(v, 0.35)) }, lip = { c: [0.72, 0.36, 0.36] };
  const at = (x, y, off = 0.0015) => { const [z, n] = faceZ(H, x, y); return [[x + n[0] * off, y + n[1] * off, z + n[2] * off], n]; };
  const eyeY = H.cy + 0.012 * hk, ex = 0.034 * hk, ew = 0.017 * hk * (L.child ? 1.12 : 1), eh = 0.011 * hk * (L.child ? 1.2 : 1);
  const closed = expr === 'blink' || expr === 'laugh', smiley = expr === 'smile' || expr === 'laugh';
  for (const s of [-1, 1]) {
    const x0 = s * ex, [c, n] = at(x0, eyeY);
    if (closed) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5, x = x0 + t * 2 * ew, y = eyeY + (expr === 'laugh' ? 1 : -0.4) * (0.25 - t * t) * 4 * eh * 0.6; pts.push(at(x, y, 0.002)[0]); } strand(gb, pts, 0.0018 * hk, dark, 4); }
    else {
      disc(gb, c, ew, eh, n, white, 14);
      const [ci] = at(x0 + s * 0.001, eyeY - 0.001 * hk, 0.0025); disc(gb, ci, eh * 0.85, eh * 0.95, n, iris, 12);
      const [cp] = at(x0 + s * 0.001, eyeY - 0.001 * hk, 0.0032); disc(gb, cp, eh * 0.42, eh * 0.46, n, dark, 10);
      const [hl] = at(x0 + 0.004 * hk, eyeY + 0.004 * hk, 0.0038); disc(gb, hl, eh * 0.18, eh * 0.18, n, white, 6);
      const lid = []; for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5, x = x0 + t * 2.1 * ew, y = eyeY + eh * (1 - 4 * t * t) * 0.95 + 0.001; lid.push(at(x, y, 0.0026)[0]); } strand(gb, lid, 0.0017 * hk, dark, 4); // 上まぶた（まつげの線）
    }
    // 眉（笑顔では少し上がる）
    const by = eyeY + 0.03 * hk + (smiley ? 0.004 * hk : 0), bp = []; for (let i = 0; i <= 5; i++) { const t = i / 5, x = s * (ex - ew * 1.0 + t * ew * 2.1), y = by + Math.sin(t * Math.PI) * 0.005 * hk - (s * x < ex ? 0 : 0.002 * hk * t); bp.push(at(x, y, 0.002)[0]); } strand(gb, bp, (L.child || ch.sex ? 0.0022 : 0.003) * hk, brow, 4);
    if (L.child || ch.sex) { const [cc, cn] = at(s * 0.05 * hk, H.cy - 0.03 * hk, 0.0012); disc(gb, cc, 0.013 * hk, 0.008 * hk, cn, { c: [0.96, 0.66, 0.64] }, 10); } // 頬
  }
  // 口
  const my = H.cy - 0.062 * hk, mw = 0.026 * hk * (L.child ? 0.9 : 1);
  if (expr === 'talk' || expr === 'laugh') { const big = expr === 'laugh', [c, n] = at(0, my - (big ? 0.006 : 0.004) * hk, 0.0015); disc(gb, c, mw * (big ? 1.0 : 0.7), (big ? 0.016 : 0.01) * hk, n, { c: [0.4, 0.1, 0.12] }, 12);
    if (big) { const [t] = at(0, my - 0.0005 * hk, 0.0022); disc(gb, t, mw * 0.8, 0.004 * hk, n, white, 10); } const [tg] = at(0, my - (big ? 0.014 : 0.009) * hk, 0.002); disc(gb, tg, mw * 0.45, 0.004 * hk, n, { c: [0.85, 0.42, 0.45] }, 8); }
  else if (expr === 'eat') { const [c, n] = at(0, my, 0.002); ellip(gb, c, [mw * 0.55, 0.008 * hk, 0.004 * hk], lip, 4, 10); void n; }
  else { const curve = expr === 'smile' ? 1 : 0.15, pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 - 0.5, x = t * 2 * mw * (expr === 'smile' ? 1.1 : 0.85), y = my + curve * (4 * t * t) * 0.007 * hk; pts.push(at(x, y, 0.002)[0]); } strand(gb, pts, 0.0028 * hk, lip, 5); }
  if (L.old || (L.mid && !ch.sex)) for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pts.push(at(s * ex + Math.cos(a) * 0.022 * hk, eyeY + Math.sin(a) * 0.016 * hk, 0.008)[0]); } strand(gb, pts, 0.0018 * hk, { c: [0.2, 0.2, 0.22] }, 4); if (s > 0) strand(gb, [at(-ex + 0.022 * hk, eyeY + 0.004 * hk, 0.009)[0], at(ex - 0.022 * hk, eyeY + 0.004 * hk, 0.009)[0]], 0.0018 * hk, { c: [0.2, 0.2, 0.22] }, 4); } // 眼鏡（50代男性・60代以上）
}
// 顔の中心（体の座標）：ムービーのカメラの狙いに使う
export function headPos(ch, pose = 'sit') { const L = look(ch), hip = pose === 'bath' ? -0.42 * L.k : poseHip(pose, L), shY = hip + 0.5 * L.k * (L.child ? 0.92 : 1); return [0, shY + 0.06 * L.k + 0.12 * L.k * L.hs, poseLean(pose) * 0.6 * L.k + 0.1]; }
export function charHeight(ch) { return look(ch).H; }

// ---- 車内の座席 ----
// 車体座標：運転席は右（x=-0.36）、助手席は左（x=+0.36）。修正113：前席の座面 y=0.47（z=-0.68〜-0.22、背もたれの前面 z=-0.70）、後席の座面 y=0.45（z=-1.52〜-1.1、背もたれの前面 z=-1.54）。同乗者の座席は左右の内張りに当たらないよう中央へ2cm寄せる
// 腰（hip）は座面の値から z を -0.04 した位置。胴の背面は腰の約0.14後ろ＝背もたれの前面に接する（旧値 driver/front z=-0.86、rear z=-1.36）
export const SEAT_POS = { driver: [-0.36, 0.47, -0.52], front: [0.34, 0.47, -0.52], rearR: [-0.34, 0.45, -1.36], rearL: [0.34, 0.45, -1.36] };
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
