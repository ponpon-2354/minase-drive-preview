// 車両モデル：ミライース（プレイヤー）＋NPC 50車種のパラメトリック・ローポリモデル
// ※実車の正確な再現ではなく、寸法・シルエットを参考にした簡易モデル（仮モデル）。ロゴ・エンブレムは含まない。
import { GB, hex } from './geo.js?v=0.9.0';
import { clamp } from './math.js?v=0.9.0';
import { L } from './textures.js?v=0.9.0';

const C = { // 汎用カラー（実車の市販色を参考にした近似色）
  W: ['ホワイト', '#eeeeec'], PW: ['パールホワイト', '#e9e6dc'], S: ['シルバー', '#b4b8bc'], BK: ['ブラック', '#151517'],
  G: ['グレー', '#6b6f74'], BE: ['ベージュ', '#d6c5a5'], BL: ['ブルー', '#2e5c99'], LB: ['ライトブルー', '#8db3d3'],
  R: ['レッド', '#b01f29'], BR: ['ブラウン', '#6a4a36'], GR: ['グリーン', '#4d7858'], MG: ['ミントグリーン', '#a7c9b5'],
  PK: ['ピンク', '#e6b3b7'], Y: ['イエロー', '#e3c23c'], OR: ['オレンジ', '#d6782c'], NV: ['ネイビー', '#25314d'],
  DR: ['ダークレッド', '#6c1a22'], KH: ['カーキ', '#7b785b'], DG: ['ダークグレー', '#3d4044'], GD: ['ゴールド', '#b49a64']
};
const cols = s => s.split(' ').map(k => C[k]);

// カテゴリ既定値
const CAT = {
  kei: { L: 3.395, W: 1.475, H: 1.52, wb: 2.46, belt: 0.95, hood: 0.78, ws: 1.0, wsT: 1.78, rgb: 0.14, rg: 0.32, r: 0.27, rear: 'hatch', plate: 'k', perf: [2.1, 33, 1.0], w: 1.3 },
  sh: { L: 3.395, W: 1.475, H: 1.78, wb: 2.46, belt: 1.02, hood: 0.86, ws: 0.86, wsT: 1.62, rgb: 0.07, rg: 0.12, r: 0.28, rear: 'box', plate: 'k', slide: 1, perf: [1.9, 32, 0.95], w: 1.5 },
  cmp: { L: 3.95, W: 1.69, H: 1.5, wb: 2.55, belt: 0.97, hood: 0.8, ws: 1.2, wsT: 2.05, rgb: 0.2, rg: 0.5, r: 0.3, rear: 'hatch', plate: 'w', perf: [2.5, 38, 1.0], w: 1.1 },
  sed: { L: 4.65, W: 1.78, H: 1.45, wb: 2.7, belt: 0.92, hood: 0.8, ws: 1.55, wsT: 2.4, rgb: 0.95, rg: 1.55, r: 0.32, rear: 'sedan', plate: 'w', perf: [2.8, 40, 1.0], w: 0.6 },
  mv: { L: 4.7, W: 1.73, H: 1.86, wb: 2.85, belt: 1.08, hood: 0.96, ws: 1.05, wsT: 1.85, rgb: 0.08, rg: 0.14, r: 0.32, rear: 'box', plate: 'w', slide: 1, perf: [2.3, 38, 0.9], w: 0.9 },
  suv: { L: 4.4, W: 1.8, H: 1.66, wb: 2.65, belt: 1.06, hood: 0.96, ws: 1.35, wsT: 2.15, rgb: 0.18, rg: 0.45, r: 0.36, rear: 'hatch', plate: 'w', rails: 1, perf: [2.6, 39, 0.95], w: 0.8 },
  wag: { L: 4.5, W: 1.75, H: 1.47, wb: 2.67, belt: 0.92, hood: 0.8, ws: 1.4, wsT: 2.25, rgb: 0.14, rg: 0.35, r: 0.32, rear: 'hatch', plate: 'w', perf: [2.7, 40, 1.0], w: 0.5 },
  van: { L: 4.25, W: 1.69, H: 1.53, wb: 2.55, belt: 0.95, hood: 0.8, ws: 1.2, wsT: 2.0, rgb: 0.06, rg: 0.1, r: 0.3, rear: 'box', plate: 'w', perf: [2.0, 34, 0.9], w: 0.5 },
  trk: { L: 3.395, W: 1.475, H: 1.78, wb: 1.9, belt: 1.05, hood: 1.0, ws: 0.25, wsT: 0.66, cab: 1.45, r: 0.27, rear: 'truck', plate: 'k', perf: [1.6, 30, 0.9], w: 0.8 }
};

// [名称(参考車種), メーカー, カテゴリ, 上書き, 色]
const DEFS = [
  // 軽自動車 12
  ['ミライース', 'ダイハツ', 'kei', { H: 1.5, hood: 0.78 }, 'W PW S BK R LB'],
  ['アルト', 'スズキ', 'kei', { H: 1.525, hood: 0.8, light: 'round', wsT: 1.72 }, 'W S BK R BE'],
  ['ワゴンR', 'スズキ', 'kei', { H: 1.65, belt: 0.98, ws: 0.92, wsT: 1.65, rg: 0.2 }, 'PW S BK BL MG'],
  ['ムーヴ', 'ダイハツ', 'kei', { H: 1.63, belt: 0.98, ws: 0.95, wsT: 1.65, rg: 0.22, light: 'slim' }, 'PW S BK DR BL'],
  ['ムーヴキャンバス', 'ダイハツ', 'kei', { H: 1.655, belt: 0.98, ws: 0.9, wsT: 1.55, rg: 0.14, light: 'round', two: 1, slide: 1 }, 'PK MG BE LB W'],
  ['N-WGN', 'ホンダ', 'kei', { H: 1.675, belt: 0.99, ws: 0.92, wsT: 1.62, rg: 0.2, light: 'round' }, 'PW S BK LB BE'],
  ['N-ONE', 'ホンダ', 'kei', { H: 1.545, light: 'round', ws: 0.98, wsT: 1.75, rg: 0.28, two: 1 }, 'W BK R Y G'],
  ['デイズ', '日産', 'kei', { H: 1.64, belt: 0.98, ws: 0.94, wsT: 1.64, rg: 0.2, grille: 0.6 }, 'PW S BK BL BR'],
  ['eKワゴン', '三菱', 'kei', { H: 1.64, belt: 0.98, ws: 0.94, wsT: 1.64, rg: 0.22, grille: 0.4 }, 'W S BK BE NV'],
  ['ハスラー', 'スズキ', 'kei', { H: 1.68, belt: 1.0, hood: 0.88, ws: 0.88, wsT: 1.52, rg: 0.12, r: 0.29, light: 'round', two: 1, rails: 1 }, 'OR LB Y W G'],
  ['タフト', 'ダイハツ', 'kei', { H: 1.63, belt: 1.0, hood: 0.88, ws: 0.88, wsT: 1.55, rg: 0.1, r: 0.29, light: 'slim', rails: 1 }, 'KH W BK S OR'],
  ['ラパン', 'スズキ', 'kei', { H: 1.525, ws: 0.95, wsT: 1.62, rg: 0.12, light: 'round', grille: 0.1 }, 'BE PK W LB MG'],
  // 軽スーパーハイトワゴン 8
  ['タント', 'ダイハツ', 'sh', { H: 1.755 }, 'PW S BK BE LB'],
  ['タントカスタム', 'ダイハツ', 'sh', { H: 1.755, light: 'slim', grille: 1 }, 'PW BK S DR NV'],
  ['N-BOX', 'ホンダ', 'sh', { H: 1.79, ws: 0.82, wsT: 1.55, light: 'round' }, 'PW S BK BE MG GD'],
  ['N-BOXカスタム', 'ホンダ', 'sh', { H: 1.79, ws: 0.82, wsT: 1.55, light: 'slim', grille: 1 }, 'PW BK S DR NV'],
  ['スペーシア', 'スズキ', 'sh', { H: 1.785, ws: 0.84, wsT: 1.58, light: 'round', grille: 0.3 }, 'PW S BE MG OR'],
  ['スペーシアカスタム', 'スズキ', 'sh', { H: 1.785, ws: 0.84, wsT: 1.58, light: 'slim', grille: 1 }, 'PW BK S DG'],
  ['ルークス', '日産', 'sh', { H: 1.78, grille: 0.7, light: 'slim' }, 'PW S BK BE BL'],
  ['eKスペース', '三菱', 'sh', { H: 1.78, grille: 0.5 }, 'PW S BK LB'],
  // コンパクトカー 8
  ['ヤリス', 'トヨタ', 'cmp', { L: 3.94, H: 1.5, ws: 1.25, wsT: 2.1, rg: 0.55, light: 'slim' }, 'PW S BK R BL OR'],
  ['アクア', 'トヨタ', 'cmp', { L: 4.05, H: 1.485, ws: 1.25, wsT: 2.2, rg: 0.62, light: 'slim' }, 'PW S BK BL BE'],
  ['フィット', 'ホンダ', 'cmp', { L: 3.995, H: 1.54, ws: 1.05, wsT: 2.05, rg: 0.45, light: 'round' }, 'PW S BK LB BE'],
  ['ノート', '日産', 'cmp', { L: 4.045, H: 1.52, ws: 1.2, wsT: 2.1, rg: 0.5, grille: 0.6, light: 'slim' }, 'PW S BK BL R'],
  ['ルーミー', 'トヨタ', 'cmp', { L: 3.7, H: 1.735, belt: 1.02, hood: 0.9, ws: 0.95, wsT: 1.7, rgb: 0.08, rg: 0.12, rear: 'box', slide: 1, grille: 0.8 }, 'PW S BK BL BR'],
  ['スイフト', 'スズキ', 'cmp', { L: 3.86, H: 1.5, ws: 1.2, wsT: 2.0, rg: 0.5, light: 'slim' }, 'W S BK R BL'],
  ['ソリオ', 'スズキ', 'cmp', { L: 3.79, H: 1.745, belt: 1.02, hood: 0.9, ws: 0.95, wsT: 1.7, rgb: 0.08, rg: 0.12, rear: 'box', slide: 1 }, 'PW S BK LB BE'],
  ['MAZDA2', 'マツダ', 'cmp', { L: 4.065, H: 1.5, ws: 1.35, wsT: 2.2, rg: 0.55, grille: 0.7, light: 'slim' }, 'W S BK DR NV'],
  // セダン 5
  ['カローラ', 'トヨタ', 'sed', { L: 4.495, H: 1.435, light: 'slim' }, 'PW S BK BL G'],
  ['プリウス', 'トヨタ', 'sed', { L: 4.6, H: 1.43, ws: 1.45, wsT: 2.45, rgb: 0.3, rg: 1.05, rear: 'hatch', light: 'slim' }, 'PW S BK BL R'],
  ['クラウン', 'トヨタ', 'sed', { L: 4.93, W: 1.8, H: 1.455, ws: 1.7, wsT: 2.6, grille: 1 }, 'PW BK S NV'],
  ['カムリ', 'トヨタ', 'sed', { L: 4.885, W: 1.84, H: 1.445, grille: 0.8, light: 'slim' }, 'PW BK S DR'],
  ['MAZDA3セダン', 'マツダ', 'sed', { L: 4.66, W: 1.795, H: 1.445, ws: 1.75, wsT: 2.6, grille: 0.7 }, 'W S BK DR G'],
  // ミニバン 6
  ['シエンタ', 'トヨタ', 'mv', { L: 4.26, W: 1.695, H: 1.695, belt: 1.02, wb: 2.75, r: 0.3, light: 'round' }, 'PW S BK BE KH'],
  ['フリード', 'ホンダ', 'mv', { L: 4.31, W: 1.695, H: 1.755, belt: 1.03, wb: 2.74, r: 0.3 }, 'PW S BK BL BE'],
  ['ノア', 'トヨタ', 'mv', { H: 1.895, grille: 0.9, light: 'slim' }, 'PW BK S NV'],
  ['ヴォクシー', 'トヨタ', 'mv', { H: 1.895, grille: 1, light: 'slim', hood: 1.0 }, 'PW BK S G'],
  ['セレナ', '日産', 'mv', { H: 1.87, grille: 0.8 }, 'PW S BK BL BR'],
  ['アルファード', 'トヨタ', 'mv', { L: 4.995, W: 1.85, H: 1.935, wb: 3.0, belt: 1.15, hood: 1.05, grille: 1.3, light: 'slim' }, 'PW BK S DG'],
  // SUV 5
  ['ヤリスクロス', 'トヨタ', 'suv', { L: 4.18, W: 1.765, H: 1.59, r: 0.34, light: 'slim' }, 'PW S BK BE KH OR'],
  ['ライズ', 'ダイハツ', 'suv', { L: 3.995, W: 1.695, H: 1.62, r: 0.33, grille: 0.7 }, 'PW S BK R BL'],
  ['ハリアー', 'トヨタ', 'suv', { L: 4.74, W: 1.855, H: 1.66, rg: 0.7, light: 'slim', rails: 0 }, 'PW BK S DR'],
  ['CX-5', 'マツダ', 'suv', { L: 4.575, W: 1.845, H: 1.69, grille: 0.9, light: 'slim' }, 'W S BK DR G'],
  ['ヴェゼル', 'ホンダ', 'suv', { L: 4.33, W: 1.79, H: 1.59, rg: 0.6, light: 'slim', rails: 0 }, 'PW S BK BL G'],
  // ハッチバック・ステーションワゴン 2
  ['カローラツーリング', 'トヨタ', 'wag', { L: 4.495, W: 1.745, H: 1.46 }, 'PW S BK BL'],
  ['レヴォーグ', 'スバル', 'wag', { L: 4.755, W: 1.795, H: 1.5, hood: 0.84, grille: 0.6 }, 'PW S BK BL DG'],
  // 商用バン 2
  ['プロボックス', 'トヨタ', 'van', {}, 'W S PW G'],
  ['ハイエース', 'トヨタ', 'van', { L: 4.695, W: 1.695, H: 1.98, wb: 2.57, belt: 1.18, hood: 1.12, ws: 0.32, wsT: 0.95, r: 0.32, slide: 1 }, 'W S BK PW'],
  // トラック 2
  ['ハイゼットトラック', 'ダイハツ', 'trk', {}, 'W S LB G'],
  ['小型トラック(2t)', 'いすゞ等', 'trk', { L: 4.7, W: 1.7, H: 2.0, wb: 2.5, cab: 1.65, belt: 1.35, hood: 1.3, ws: 0.15, wsT: 0.55, r: 0.36, plate: 'w', perf: [1.5, 28, 0.8], w: 0.4 }, 'W S LB G'],
  // ---- v0.3 追加（地方都市で多い軽バン・軽SUVと、中・大型トラック） ----
  ['エブリイ（軽バン）', 'スズキ', 'sh', { H: 1.895, belt: 1.05, hood: 0.9, ws: 0.62, wsT: 1.3, cargo: 1, slide: 1, grille: 0.25, perf: [1.6, 30, 0.9], w: 0.9 }, 'W S BK G'],
  ['ハイゼットカーゴ（軽バン）', 'ダイハツ', 'sh', { H: 1.875, belt: 1.05, hood: 0.9, ws: 0.6, wsT: 1.28, cargo: 1, slide: 1, grille: 0.35, perf: [1.6, 30, 0.9], w: 0.9 }, 'W S LB G'],
  ['ジムニー（軽SUV）', 'スズキ', 'kei', { H: 1.725, belt: 1.04, hood: 0.96, ws: 0.95, wsT: 1.42, rgb: 0.04, rg: 0.08, r: 0.34, rear: 'box', light: 'round', grille: 0.7, perf: [1.8, 32, 0.9], w: 0.6 }, 'KH W BK Y G'],
  ['中型トラック(4t)', 'いすゞ等', 'trk', { L: 8.5, W: 2.3, H: 2.6, boxH: 3.3, wb: 4.8, cab: 1.85, belt: 1.75, hood: 1.65, ws: 0.1, wsT: 0.42, r: 0.48, plate: 'w', body: 'box', perf: [1.2, 25, 0.75], w: 0.32 }, 'W LB S G'],
  ['大型トラック(10t)', '日野等', 'trk', { L: 11.9, W: 2.49, H: 2.95, boxH: 3.75, wb: 6.0, cab: 2.2, belt: 2.0, hood: 1.9, ws: 0.1, wsT: 0.4, r: 0.53, plate: 'w', body: 'box', axles: 3, perf: [0.9, 24, 0.7], w: 0.18 }, 'W G LB S'],
  ['タンクローリー', '日野等', 'trk', { L: 8.4, W: 2.3, H: 2.6, boxH: 2.95, wb: 4.6, cab: 1.85, belt: 1.75, hood: 1.65, ws: 0.1, wsT: 0.42, r: 0.48, plate: 'w', body: 'tank', perf: [1.1, 24, 0.7], w: 0.12 }, 'W S LB G'],
  ['ダンプカー', '三菱ふそう等', 'trk', { L: 7.6, W: 2.3, H: 2.6, boxH: 2.75, wb: 4.2, cab: 1.85, belt: 1.75, hood: 1.65, ws: 0.1, wsT: 0.42, r: 0.5, plate: 'w', body: 'dump', perf: [1.1, 24, 0.7], w: 0.18 }, 'W G LB KH'],
  ['セミトレーラー(バン)', '架空', 'trk', { L: 16.5, W: 2.49, H: 2.95, boxH: 4.0, wb: 3.6, cab: 2.2, belt: 2.0, hood: 1.9, ws: 0.1, wsT: 0.4, r: 0.53, plate: 'w', body: 'tractor', axles: 3, perf: [0.75, 22, 0.6], w: 0.06, semi: { tL: 6.0, kL: 13.0, kf: 1.0, kwb: 9.6 } }, 'W G LB S'],
  ['宅配トラック(2tロング)', 'いすゞ等', 'trk', { L: 6.2, W: 1.9, H: 2.2, boxH: 2.95, wb: 3.4, cab: 1.7, belt: 1.45, hood: 1.4, ws: 0.12, wsT: 0.5, r: 0.38, plate: 'w', body: 'box', perf: [1.3, 26, 0.8], w: 0.3 }, 'W S LB G']
];

export const MODELS = DEFS.map(([name, maker, cat, ov, cs], id) => {
  const p = { ...CAT[cat], ...ov, id, name, maker, cat };
  p.colors = cols(cs).map(([n, h]) => ({ name: n, hex: h, rgb: hex(h) }));
  // 色の出現重み（白・パール・シルバー・黒は多め、同色ばかりにならない程度）
  p.cw = p.colors.map(c => /ホワイト|パール/.test(c.name) ? 1.6 : /シルバー|ブラック/.test(c.name) ? 1.3 : 1.0);
  // 車種ごとの性能：[加速, 最高速, 旋回]
  p.acc = p.perf[0]; p.vmax = p.perf[1]; p.turn = p.perf[2];
  return p;
});
export const VARIATIONS = MODELS.reduce((a, m) => a + m.colors.length, 0);
export const CAT_NAMES = { kei: '軽自動車', sh: '軽スーパーハイトワゴン', cmp: 'コンパクトカー', sed: 'セダン', mv: 'ミニバン', suv: 'SUV', wag: 'ステーションワゴン', van: '商用バン', trk: 'トラック' };

// truckK：トラックの出現倍率（工業団地・国道・バイパスで上げる）
export function pickModel(R, truckK = 1, semi = false) {
  const w = m => m.semi && !semi ? 0 : m.w * (m.cat === 'trk' && m.L > 4 ? truckK : 1);
  let t = 0; for (const m of MODELS) t += w(m); let x = R() * t;
  for (const m of MODELS) { x -= w(m); if (x <= 0) return m; } return MODELS[0];
}
// 乗用車／商用車の区別（軽トラは乗用扱い＝個人の足として多い。トラック・配送バン・タンク車・ダンプは商用）
export function isCommercial(m) { return (m.cat === 'trk' && m.L > 4.2) || !!m.body || /ハイエース|キャラバン|プロボックス|カーゴ|エブリイ/.test(m.name); }
export function pickPassenger(R) { for (let i = 0; i < 30; i++) { const m = pickModel(R, 0.3); if (!isCommercial(m) && m.L < 5.6) return m; } return MODELS[0]; }
// 修正84：駐車枠の寸法と用途に合う車だけを選ぶ。use='res'（住宅：乗用車・軽トラ・軽バンのみ）／'pass'（乗用車のみ）／'com'（商用車）
export function fitsSlot(m, maxL, maxW = 2.35) { return m.L <= maxL && m.W <= maxW && !m.semi; }
export function isResidentialOK(m) { return !isCommercial(m) || m.plate === 'k'; }
export function pickFit(R, use, maxL, maxW = 2.35) {
  const ok = m => fitsSlot(m, maxL, maxW) && (use === 'res' ? isResidentialOK(m) && (m.cat !== 'trk' || m.L <= 3.5) : use === 'pass' ? !isCommercial(m) : isCommercial(m));
  for (let i = 0; i < 40; i++) { const m = use === 'com' ? pickCommercial(R) : pickModel(R, 0.3); if (ok(m)) return m; }
  return MODELS.find(ok) || null;
}
export function pickCommercial(R) { const list = MODELS.filter(m => isCommercial(m) && !m.semi); let t = 0; for (const m of list) t += m.w; let x = R() * t; for (const m of list) { x -= m.w; if (x <= 0) return m; } return list[0]; }
// ナンバーの分類（軽乗用580・軽貨物480・普通乗用500・大型乗用300・小型貨物400・普通貨物100）
export function plateClass(m) {
  if (m.plate === 'k') return (m.cat === 'trk' || m.cargo) ? 'k480' : 'k580';
  if (m.cat === 'trk') return 'w100';
  if (m.cat === 'van') return 'w400';
  return (m.W > 1.7 || m.L > 4.7 || m.H > 2.0) ? 'w300' : 'w500';
}
export function pickColor(m, R) {
  let t = 0; for (const w of m.cw) t += w; let x = R() * t;
  for (let i = 0; i < m.cw.length; i++) { x -= m.cw[i]; if (x <= 0) return m.colors[i]; } return m.colors[0];
}

// プレイヤー：ダイハツ ミライース（LA350S型の寸法を参考）
export const MIRA = { ...CAT.kei, name: 'ミライース', L: 3.395, W: 1.475, H: 1.5, wb: 2.455, belt: 0.97, hood: 0.77, ws: 0.9975, wsT: 1.5775, rgb: 0.14, rg: 0.34, r: 0.278, light: 'slim', grille: 0.15, _zf: 1.2, _zr: -1.255 };
export const MIRA_COLORS = [
  { name: 'セラミックグリーンメタリック', hex: '#9dbcae' },
  { name: 'スカイブルーメタリック', hex: '#9ccbd8' },
  { name: 'ブライトシルバーメタリック', hex: '#bfc3c7' },
  { name: 'ファイアークォーツレッドメタリック', hex: '#a3202b' },
  { name: 'ブラックマイカメタリック', hex: '#19191d' }
].map(c => ({ ...c, rgb: hex(c.hex) }));

const DARK = [0.06, 0.06, 0.07], GLASS = [0.12, 0.15, 0.19], TIRE = [0.07, 0.07, 0.07];


// ===== NPC車両：ミライースと同じ「断面をつなぐ」方式のパラメトリック車体（v0.3） =====
// lod 0：近距離（細部あり） / 1：遠距離の走行車 / 2：駐車車両（焼き込み用・最軽量）
const CLEAR = { kei: 0.16, sh: 0.17, cmp: 0.17, sed: 0.16, mv: 0.19, suv: 0.24, wag: 0.16, van: 0.18, trk: 0.2 };
function hullSecPts(hw, yb, belt, top, H, tum) {
  const t = clamp((top - belt) / Math.max(0.01, H - belt), 0, 1);
  const mid = yb + (belt - yb) * 0.55;
  const p4y = Math.min(belt - 0.04, top - 0.03), p3y = Math.min(mid, p4y - 0.05), p2y = Math.min(yb + 0.15, p3y - 0.05);
  const P = [[0, yb], [hw * 0.92, yb], [hw, p2y], [hw, p3y], [hw * 0.985, p4y], [hw * 0.95, Math.min(belt, top)]];
  if (top <= belt + 0.001) P.push([hw * 0.86, top + 0.004], [hw * 0.55, top + 0.012], [0, top + 0.02]);
  else P.push([hw * (0.95 - tum * t), belt + (top - belt) * 0.9], [hw * (0.95 - (tum + 0.1) * t), top], [0, top + 0.012]);
  return P;
}
export function hullGeom(p) {
  const Lh = p.L / 2, Wh = p.W / 2, H = p.H, belt = p.belt, hood = p.hood, yb = CLEAR[p.cat] ?? 0.17;
  const box = p.rear === 'box', sed = p.rear === 'sedan', trk = p.rear === 'truck';
  const zW = Lh - p.ws, zFt = Lh - p.wsT;
  const zR = trk ? Lh - p.cab : -Lh;                 // 車体（キャビン）後端
  const zRt = trk ? zR + 0.06 : -Lh + p.rg, zRb = trk ? zR + 0.03 : -Lh + p.rgb;
  const deck = belt + 0.03;
  const S = [], add = (z, k, ybz, top, key) => { if (S.length && z <= S[S.length - 1][0] + 0.005) return; S.push([z, Wh * k, ybz, Math.max(ybz + 0.25, top), key || 0]); };
  if (trk) { add(zR, 0.99, yb + 0.02, H - 0.01, 2); add(zR + 0.04, 1, yb, H, 1); }
  else if (sed) {
    add(-Lh, 0.88, yb + 0.14, deck - 0.03, 2); add(-Lh + 0.07, 0.96, yb + 0.06, deck, 0); add(zRb - 0.03, 1, yb, deck + 0.02, 2);
    add(zRb + (zRt - zRb) * 0.45, 1, yb, deck + (H - deck) * 0.62, 1); add(zRt, 1, yb, H - 0.012, 2);
  } else {
    add(-Lh, 0.9, yb + 0.12, belt + 0.01, 2); add(-Lh + 0.035, 0.97, yb + 0.07, belt + 0.05, 0);
    if (zRb > -Lh + 0.05) add(zRb, 1, yb, belt + 0.07, 2);
    if (!box) add(zRb + (zRt - zRb) * 0.5, 1, yb, belt + (H - belt) * 0.6, 0);
    add(zRt, 1, yb, H - 0.012, 2);
  }
  add(zRt + 0.12, 1, yb, H, 0); add((zRt + zFt) / 2, 1, yb, H, 1); add(zFt - 0.04, 1, yb, H - 0.004, 2);
  const wsy = f => belt + 0.015 + (H - 0.01 - belt - 0.015) * (1 - f);
  add(zFt + (zW - zFt) * 0.35, 1, yb, wsy(0.35) + 0.02, 0); add(zFt + (zW - zFt) * 0.7, 1, yb, wsy(0.7) + 0.015, 0); add(zW, 1, yb, belt + 0.015, 2);
  const hd = (Lh - zW);
  add(zW + Math.min(0.04, hd * 0.2), 1, yb, belt - 0.012, 0);
  add(zW + hd * 0.5, 0.99, yb, belt + (hood - belt) * 0.55, 1);
  add(Lh - Math.min(0.14, hd * 0.3), 0.95, yb + 0.03, hood, 2);
  add(Lh - Math.min(0.05, hd * 0.12), 0.89, yb + 0.07, hood - 0.07, 0);
  add(Lh, 0.82, yb + 0.12, hood - 0.15, 2);
  return { S, Lh, Wh, H, belt, hood, yb, zW, zFt, zR, zRt, zRb, deck, box, sed, trk };
}
export function buildHull(p, gb, opt = {}) {
  const lod = opt.lod || 0, G = hullGeom(p), { Lh, Wh, H, belt, hood, yb, zW, zFt, zR, zRt, zRb, box, sed, trk } = G;
  const paint = opt.paint ? { c: opt.paint, mat: 0 } : { c: [1, 1, 1], mat: 1 };
  const roofC = p.two ? { c: p.cat === 'kei' && /N-ONE/.test(p.name) ? [0.1, 0.1, 0.11] : [0.94, 0.94, 0.92] } : paint;
  const black = { c: [0.05, 0.05, 0.06] }, under = { c: [0.08, 0.08, 0.09] }, glass = { c: [0.12, 0.15, 0.19] };
  const tum = box ? 0.05 : p.cat === 'suv' ? 0.09 : 0.12;
  let secs = lod === 2 ? G.S.filter(s => s[4] >= 2) : lod ? G.S.filter(s => s[4]) : G.S;
  // v0.5 高ポリ化（近距離用 lod 0）：隣り合う断面の間に、少し膨らませた中間断面を入れて面の流れを滑らかにする
  if (lod === 0) { const out = []; for (let i = 0; i < secs.length; i++) { out.push(secs[i]); const a = secs[i], b = secs[i + 1]; if (b && b[0] - a[0] > 0.12) out.push([(a[0] + b[0]) / 2, Math.max(a[1], b[1]) * 0.997 + Math.min(a[1], b[1]) * 0.003 + (Math.abs(a[1] - b[1]) < 0.02 ? 0.004 : 0), (a[2] + b[2]) / 2, (a[3] + b[3]) / 2 + Math.abs(a[3] - b[3]) * 0.12, 0]); } secs = out; }
  const pts = secs.map(s => hullSecPts(s[1], s[2], belt, s[3], H, tum));
  const use = lod === 2 ? [1, 3, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const zB = zW - (zW - zRt) * (p.cat === 'sh' || p.cat === 'mv' || p.slide ? 0.36 : 0.45);
  const zC = box ? zRt + 0.1 : zRt + Math.min(0.32, (zFt - zRt) * 0.18);
  const band = (b, zm) => {
    if (b === 0) return under;
    if (b <= 4) return paint;
    if (zm > zW) return paint;
    if (zm > zFt) return glass;
    if (zm > zRt) {
      if (b >= 6) return roofC;
      if (Math.abs(zm - zB) < 0.06) return black;
      if (zm < zC) return box ? black : paint;
      return glass;
    }
    if (trk) return paint;
    if (zm > zRb) return b === 5 ? (box ? black : paint) : glass;
    return paint;
  };
  for (let i = 0; i < secs.length - 1; i++) {
    const z0 = secs[i][0], z1 = secs[i + 1][0], zm = (z0 + z1) / 2, A = pts[i], B = pts[i + 1], hint = [0, (yb + H) / 2, zm];
    for (let u = 0; u < use.length - 1; u++) {
      const a0 = use[u], a1 = use[u + 1], o = band(a0, zm);
      for (const s of [1, -1]) {
        // 近距離（lod 0）は断面の各辺を3分割し、外側へわずかに膨らませる（面取り・ボディ側面の丸み）
        const ns = lod === 0 && a0 > 0 ? 3 : 1, P = (Q, t) => { const fe = (Q === A && i === 0) || (Q === B && i + 1 === secs.length - 1) ? 0 : 1; const x = Q[a0][0] + (Q[a1][0] - Q[a0][0]) * t, y = Q[a0][1] + (Q[a1][1] - Q[a0][1]) * t, bl = Math.sin(Math.PI * t) * Math.hypot(Q[a1][0] - Q[a0][0], Q[a1][1] - Q[a0][1]) * 0.05 * fe; return [s * (x + bl * (a0 < 5 ? 1 : 0.5)), y + bl * (a0 >= 5 ? 0.6 : 0)]; }; // 前後の端の断面は膨らませない（端面とすき間ができないように）
        for (let k = 0; k < ns; k++) {
          const ta = k / ns, tb = (k + 1) / ns, pa = P(A, ta), pb = P(A, tb), qa = P(B, ta), qb = P(B, tb);
          const q0 = [pa[0], pa[1], z0], q1 = [pb[0], pb[1], z0], q2 = [qb[0], qb[1], z1], q3 = [qa[0], qa[1], z1];
          gb.tri(q0, q1, q2, o, [0, 0], [0, 0], [0, 0], hint); gb.tri(q0, q2, q3, o, [0, 0], [0, 0], [0, 0], hint);
        }
      }
    }
  }
  for (const [idx, z, sg] of [[0, secs[0][0], -1], [secs.length - 1, secs[secs.length - 1][0], 1]]) {
    const P = pts[idx], c = [0, (yb + P[P.length - 1][1]) / 2, z], hint = [0, c[1], z - sg];
    for (let u = 0; u < use.length - 1; u++) for (const s of [1, -1]) gb.tri(c, [s * P[use[u]][0], P[use[u]][1], z], [s * P[use[u + 1]][0], P[use[u + 1]][1], z], paint, [0, 0], [0, 0], [0, 0], hint);
  }
  const ZF = Lh + 0.004, frontTop = hood - 0.14, fb = yb + 0.12;
  const q = (x0, y0, x1, y1, z, o, nz = 1, uv) => gb.quadN([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, nz], o, uv);
  // ---- フロント ----
  const g = p.grille ?? 0.3, lt = p.light || 'std';
  const gw = Wh * (0.28 + g * 0.22), gTop = frontTop - 0.03, gBot = gTop - 0.07 - g * 0.17;
  q(-gw, gBot, gw, gTop, ZF, { c: g > 0.8 ? [0.62, 0.64, 0.68] : [0.08, 0.08, 0.09] });
  if (g > 0.8 && lod === 0) for (let y = gBot + 0.03; y < gTop - 0.01; y += 0.045) q(-gw + 0.02, y, gw - 0.02, y + 0.012, ZF + 0.003, { c: [0.15, 0.15, 0.16] });
  const head = { c: [1, 1, 0.93], mat: 2 };
  for (const s of [1, -1]) {
    if (lt === 'slim') { // 後方へ回り込む細長いライト
      const P = [[0.42, frontTop - 0.035, ZF + 0.002], [0.84, frontTop - 0.02, Lh - 0.03], [0.95, hood - 0.04, Lh - Math.min(0.12, (Lh - zW) * 0.3)], [0.5, hood - 0.055, Lh - 0.05]].map(v => [s * v[0] * Wh, v[1] + 0.008, v[2] + 0.006]);
      gb.tri(P[0], P[1], P[2], head, [0, 0], [0, 0], [0, 0], [0, 0.3, Lh - 1]); gb.tri(P[0], P[2], P[3], head, [0, 0], [0, 0], [0, 0], [0, 0.3, Lh - 1]);
    } else if (lt === 'round') {
      const cx = s * Wh * 0.66, cy = frontTop - 0.12, r = Math.min(0.1, (frontTop - fb) * 0.35), n = lod ? 6 : 10;
      for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; gb.tri([cx, cy, ZF + 0.004], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, ZF + 0.004], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, ZF + 0.004], head, [0, 0], [0, 0], [0, 0], [cx, cy, ZF - 1]); }
    } else {
      const x0 = s * Wh * 0.46, x1 = s * Wh * 0.86;
      q(Math.min(x0, x1), frontTop - 0.16, Math.max(x0, x1), frontTop - 0.02, ZF + 0.002, head);
    }
    if (lod < 2) { const x0 = s * Wh * 0.78, x1 = s * Wh * 0.9; q(Math.min(x0, x1), fb + 0.2, Math.max(x0, x1), fb + 0.25, ZF + 0.003, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 }); }
  }
  if (lod < 2) { // 下部開口・ナンバー
    gb.quadN([-Wh * 0.55, fb + 0.02, ZF], [Wh * 0.55, fb + 0.02, ZF], [Wh * 0.45, fb + 0.15, ZF], [-Wh * 0.45, fb + 0.15, ZF], [0, 0, 1], { c: [0.1, 0.1, 0.11] });
  }
  const plateL = p.plate === 'k' ? L.PLATE_K : L.PLATE_W;
  // ナンバー：共有メッシュは描画時に車両ごとの番号を選ぶ（mat 19）。焼き込み駐車車両はアトラスの1枚を直接参照
  const pu = opt.plateUV, PO = { c: [1, 1, 1], mat: pu ? 0 : 19, lay: pu ? pu[2] : plateL };
  const puv = flip => { const b = flip ? [[1, 1], [0, 1], [0, 0], [1, 0]] : [[0, 1], [1, 1], [1, 0], [0, 0]]; return pu ? b.map(([u, v]) => [pu[0] + u * 0.5, pu[1] + v * 0.25]) : b; };
  q(-0.165, fb + 0.02, 0.165, fb + 0.185, ZF + 0.008, PO, 1, puv(false));
  // ---- リア ----
  const ZR = (trk ? -Lh : secs[0][0]) - 0.004, rTop = trk ? 0 : pts[0][pts[0].length - 1][1];
  if (!trk) {
    const tail = { c: [0.82, 0.05, 0.06], mat: 4 };
    if (sed) { // 横長
      for (const s of [1, -1]) { const x0 = s * Wh * 0.42, x1 = s * Wh * 0.86; q(Math.min(x0, x1), rTop - 0.16, Math.max(x0, x1), rTop - 0.03, ZR, tail, -1); if (lod < 2) q(Math.min(x0, x1), rTop - 0.2, Math.max(x0, x1), rTop - 0.165, ZR - 0.002, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 }, -1); }
    } else { // 縦長（ハッチバック・箱型）
      const ty0 = Math.max(fb + 0.25, belt - (box ? 0.45 : 0.3)), ty1 = Math.min(rTop - 0.02, belt + (box ? 0.0 : -0.01));
      for (const s of [1, -1]) {
        const x0 = s * Wh * 0.66, x1 = s * Wh * 0.86;
        q(Math.min(x0, x1), ty0, Math.max(x0, x1), ty1, ZR, tail, -1);
        if (lod < 2) q(Math.min(x0, x1), ty0 + (ty1 - ty0) * 0.3, Math.max(x0, x1), ty0 + (ty1 - ty0) * 0.45, ZR - 0.002, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 }, -1);
      }
      if (box && lod === 0) for (const s of [1, -1]) { // 縦長ハイマウント風の上部ランプ
        const zz = zRb + (zRt - zRb) * 0.5;
        gb.box(s * Wh * 0.93 - 0.02, belt + 0.1, zz - 0.02, s * Wh * 0.93 + 0.02, H - 0.15, zz + 0.02, { c: [0.6, 0.05, 0.05], mat: 4 });
      }
    }
    q(-0.165, fb + 0.17, 0.165, fb + 0.335, ZR - 0.004, PO, -1, puv(true));
    if (lod < 2) for (const sg of [1, -1]) q(sg > 0 ? 0.2 : -0.3, fb + 0.1, sg > 0 ? 0.3 : -0.2, fb + 0.15, ZR - 0.005, { c: [0.95, 0.95, 0.95], mat: 20 }, -1); // 後退灯
    q(-Wh * 0.8, fb - 0.03, Wh * 0.8, fb + 0.07, ZR - 0.003, { c: [0.12, 0.12, 0.13] }, -1);
    if (lod === 0 && !sed) gb.box(-0.4, H - 0.03, zRt - 0.1, 0.4, H + 0.015, zRt + 0.02, paint); // ルーフスポイラー
  } else { // トラック荷台
    const bedY = p.r * 2 + 0.12;
    gb.box(-Wh, bedY - 0.12, -Lh, Wh, bedY, zR - 0.04, { c: [0.25, 0.25, 0.26] });
    if (lod < 2) gb.box(-Wh + 0.1, bedY - 0.38, -Lh + 0.2, Wh - 0.1, bedY - 0.12, zR - 0.3, black);
    if (p.body === 'tractor') { // トラクタ（けん引車）：荷台の代わりに第五輪（カプラー）と燃料タンク・エアタンク
      gb.cyl(0, bedY, -Lh + (zR + Lh) * 0.45, 0.62, 0.12, lod ? 8 : 16, { c: [0.15, 0.15, 0.16] });
      for (const sg of [1, -1]) gb.cylX(sg * (Wh - 0.25), bedY - 0.45, zR - 0.6, 0.28, 0.5, lod ? 6 : 12, { c: [0.75, 0.77, 0.8] });
      gb.box(-Wh * 0.5, bedY, zR - 0.35, Wh * 0.5, H - 0.4, zR - 0.15, { c: [0.2, 0.2, 0.2] }); // 背面のエアホース掛け
    } else {
    gb.box(-Wh, bedY, -Lh, Wh, bedY + 0.32, -Lh + 0.04, paint);
    gb.box(-Wh, bedY, -Lh, -Wh + 0.04, bedY + 0.32, zR - 0.06, paint);
    gb.box(Wh - 0.04, bedY, -Lh, Wh, bedY + 0.32, zR - 0.06, paint);
    gb.box(-Wh, bedY, zR - 0.1, Wh, H - 0.1, zR - 0.05, { c: [0.2, 0.2, 0.2] }); // 鳥居（キャブ保護枠）
    }
    for (const s of [1, -1]) q(s > 0 ? Wh - 0.25 : -Wh + 0.05, bedY - 0.32, s > 0 ? Wh - 0.05 : -Wh + 0.25, bedY - 0.14, -Lh - 0.004, { c: [0.82, 0.05, 0.06], mat: 4 }, -1);
    q(-0.165, bedY - 0.34, 0.165, bedY - 0.175, -Lh - 0.006, PO, -1, puv(true));
    // 荷台の種類（中・大型トラック）
    const bz1 = zR - 0.14;
    if (p.body === 'box') {
      gb.box(-Wh + 0.02, bedY, -Lh, Wh - 0.02, p.boxH, bz1, { c: [0.93, 0.93, 0.91], side: { lay: L.METAL, tw: 2.4, th: p.boxH } });
      if (lod < 2) { q(-0.01, bedY + 0.1, 0.01, p.boxH - 0.1, -Lh - 0.005, black, -1); for (const sg of [1, -1]) q(sg * Wh * 0.5 - 0.02, bedY + 0.3, sg * Wh * 0.5 + 0.02, p.boxH - 0.3, -Lh - 0.005, { c: [0.6, 0.6, 0.6] }, -1); }
    } else if (p.body === 'tank') {
      const rr = (p.boxH - bedY) / 2, cy = bedY + rr, n = lod === 2 ? 6 : 12, tc = { c: [0.82, 0.84, 0.86] };
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, P = (a, z) => [Math.cos(a) * Wh * 0.95, cy + Math.sin(a) * rr, z];
        gb.tri(P(a0, -Lh + 0.1), P(a1, -Lh + 0.1), P(a1, bz1), tc, [0, 0], [0, 0], [0, 0], [0, cy, (bz1 - Lh) / 2]); gb.tri(P(a0, -Lh + 0.1), P(a1, bz1), P(a0, bz1), tc, [0, 0], [0, 0], [0, 0], [0, cy, (bz1 - Lh) / 2]);
        for (const z of [-Lh + 0.1, bz1]) gb.tri([0, cy, z], P(a0, z), P(a1, z), tc, [0, 0], [0, 0], [0, 0], [0, cy, z + (z < 0 ? 1 : -1)]);
      }
      if (lod < 2) gb.box(-0.3, p.boxH, -Lh + 1, 0.3, p.boxH + 0.12, bz1 - 1, { c: [0.6, 0.6, 0.6] });
    } else if (p.body === 'dump') {
      const dc = { c: [0.4, 0.4, 0.42] }, top = bedY + 0.95;
      gb.box(-Wh, bedY, -Lh + 0.1, -Wh + 0.08, top, bz1, dc); gb.box(Wh - 0.08, bedY, -Lh + 0.1, Wh, top, bz1, dc);
      gb.box(-Wh, bedY, -Lh + 0.1, Wh, top, -Lh + 0.18, dc); gb.box(-Wh, bedY, bz1 - 0.08, Wh, top + 0.3, bz1, dc);
      if (lod < 2) gb.box(-Wh + 0.1, bedY, -Lh + 0.2, Wh - 0.1, bedY + 0.55, bz1 - 0.1, { c: [0.55, 0.45, 0.35] }); // 土砂
    }
  }
  // ---- 側面：ホイールアーチ・ドア・ミラー・ルーフレール ----
  const zf = Lh - (p.L - p.wb) / 2 + (trk ? 0.25 : 0.05), zr = zf - p.wb, r = p.r;
  const axles = p.axles === 3 ? [zf, zr + 0.65, zr - 0.65] : [zf, zr];
  const sideX = Wh + 0.003;
  for (const z of axles) for (const s of [1, -1]) {
    const ra = r + 0.055, n = lod === 2 ? 4 : lod ? 6 : 14; // ホイールアーチの丸み
    for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n; gb.tri([s * sideX, r, z], [s * sideX, r + Math.sin(a0) * ra, z + Math.cos(a0) * ra], [s * sideX, r + Math.sin(a1) * ra, z + Math.cos(a1) * ra], black, [0, 0], [0, 0], [0, 0], [0, r, z]); }
    gb.quadN([s * sideX, 0.1, z - ra], [s * sideX, 0.1, z + ra], [s * sideX, r, z + ra], [s * sideX, r, z - ra], [s, 0, 0], black);
  }
  if (lod === 0) {
    for (const s of [1, -1]) {
      const x = s * (Wh + 0.004), ln = (z, y0, y1) => gb.quadN([x, y0, z - 0.006], [x, y0, z + 0.006], [x, y1, z + 0.006], [x, y1, z - 0.006], [s, 0, 0], black);
      ln(zW - 0.04, yb + 0.25, belt);
      if (!trk) { ln(zB, yb + 0.1, belt); ln(p.slide ? zC + 0.05 : Math.max(zr + r + 0.1, zC - 0.05), yb + 0.3, belt); }
      if (p.slide && !trk) gb.quadN([x, belt - 0.07, zB], [x, belt - 0.07, zC], [x, belt - 0.055, zC], [x, belt - 0.055, zB], [s, 0, 0], black);
      for (const z of trk ? [zW - 0.4] : [zW - 0.45, zB - 0.4]) gb.box(Math.min(x, x + s * 0.02), belt - 0.13, z - 0.06, Math.max(x, x + s * 0.02), belt - 0.1, z + 0.06, { c: [0.25, 0.25, 0.27] });
      gb.box(Math.min(s * Wh, s * (Wh + 0.13)), belt + 0.03, zW - 0.13, Math.max(s * Wh, s * (Wh + 0.13)), belt + 0.14, zW - 0.04, paint);
      gb.box(Math.min(s * Wh, s * (Wh + 0.13)), belt + 0.035, zW - 0.135, Math.max(s * Wh, s * (Wh + 0.13)), belt + 0.135, zW - 0.13, { c: [0.55, 0.62, 0.7] });
    }
  }
  if (p.rails) for (const s of [1, -1]) gb.box(s * Wh * 0.62 - 0.025, H, zRt + 0.15, s * Wh * 0.62 + 0.025, H + 0.06, zFt - 0.12, { c: [0.15, 0.15, 0.15] });
  // ---- 車輪 ----
  const alloy = p.grille > 0.8 || p.cat === 'suv' || p.cat === 'sed' || /カスタム|ハスラー|タフト/.test(p.name);
  for (const z of axles) for (const s of [1, -1]) hullWheel(gb, s * (Wh - 0.075), r, z, r, s, lod, alloy);
  gb.flat(-Wh + 0.1, -Lh + 0.2, Wh - 0.1, Lh - 0.2, 0.05, { c: [0.05, 0.05, 0.055], mat: 5 }); // 床下の暗がり（車体の外へははみ出さない：修正97-3）
  return G;
}
function hullWheel(gb, x, y, z, r, side, lod, alloy) {
  const w = 0.16, seg = lod === 2 ? 6 : lod ? 12 : 20; // タイヤを円らしく
  gb.cylX(x, y, z, r, w, seg, { c: TIRE }, lod === 0, { c: TIRE });
  if (lod === 2) return;
  const fx = x + side * (w / 2 + 0.003), rim = alloy ? [0.78, 0.79, 0.81] : [0.55, 0.56, 0.58];
  gb.cylX(fx, y, z, r * 0.66, 0.006, seg, { c: alloy ? [0.12, 0.12, 0.13] : rim }, true);
  if (lod === 0) {
    if (alloy) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; gb.beam([fx + side * 0.004, y + Math.cos(a) * 0.04, z + Math.sin(a) * 0.04], [fx + side * 0.004, y + Math.cos(a) * r * 0.63, z + Math.sin(a) * r * 0.63], 0.018, { c: rim }); }
    gb.cylX(fx + side * 0.005, y, z, 0.05, 0.008, 6, { c: alloy ? rim : [0.7, 0.7, 0.72] }, true);
  }
}

// 車体を GB に出力。opt: {paint: rgb|null, lod: 0|1, player: bool, glass: GB(透明ガラス用), noWheels}
export function buildCar(p, gb, opt = {}) {
  const lod = opt.lod || 0;
  const Lh = p.L / 2, Wh = p.W / 2, r = p.r, yb = r * 0.6, belt = p.belt, H = p.H;
  const paint = opt.paint ? { c: opt.paint, mat: 0 } : { c: [1, 1, 1], mat: 1 };
  const dark = { c: DARK }, zW = Lh - p.ws, zFt = Lh - p.wsT;
  const truck = p.rear === 'truck', cabR = truck ? Lh - p.cab : -Lh;
  const zRb = truck ? cabR + 0.03 : -Lh + p.rgb, zRt = truck ? cabR + 0.08 : -Lh + p.rg;
  // 下部ボディ
  const rearTop = p.rear === 'sedan' ? belt - 0.02 : belt;
  const lower = [[cabR + (truck ? 0 : 0.1), yb], [cabR, yb + 0.14], [cabR + 0.03, rearTop], [zW, belt + 0.02], [Lh - 0.16, p.hood], [Lh, p.hood - 0.16], [Lh, yb + 0.16], [Lh - 0.12, yb]];
  gb.loft(lower, () => Wh, paint, opt.player ? { stripO: i => i === 2 ? null : paint } : {});
  // キャビン（ガラス）
  const tum = (p.rear === 'box' ? 0.09 : 0.13);
  const hwG = y => Wh - 0.05 - Math.max(0, (y - belt) / (H - belt)) * tum;
  const gh = [[zRb, belt], [zRt, H - 0.05], [zFt, H - 0.05], [zW, belt + 0.02]];
  if (opt.player) {
    opt.glass.loft(gh, y => hwG(y) + 0.002, { c: [0.3, 0.36, 0.42] });
    // ピラー
    const pil = (z0, y0, z1, y1, t) => { for (const s of [1, -1]) gb.beam([s * (hwG(y0) - t * 0.7), y0, z0], [s * (hwG(y1) - t * 0.7), y1, z1], t, paint); };
    pil(zW, belt + 0.02, zFt, H - 0.05, 0.035); // Aピラー
    pil(zRb + 0.04, belt, zRt + 0.04, H - 0.05, 0.05); // Cピラー
    const zB = (zW + zRb) / 2 - 0.05; pil(zB, belt, zB - 0.02, H - 0.05, 0.04); // Bピラー
    // ベルトライン下の内張り
  } else {
    gb.loft(gh, hwG, { c: GLASS });
  }
  // ルーフ
  const roofC = p.two ? { c: [0.93, 0.93, 0.9] } : paint;
  gb.loft([[zRt - 0.02, H - 0.06], [zRt + 0.03, H], [zFt - 0.03, H], [zFt + 0.02, H - 0.06]], () => hwG(H) + 0.012, roofC);
  if (p.rails) for (const s of [1, -1]) gb.box(s * (hwG(H) - 0.08) - 0.025, H, zRt + 0.1, s * (hwG(H) - 0.08) + 0.025, H + 0.06, zFt - 0.1, { c: [0.15, 0.15, 0.15] });
  // トラック荷台
  if (truck) {
    const bedY = r * 2 + 0.12;
    gb.box(-Wh, bedY - 0.12, -Lh, Wh, bedY, cabR - 0.05, { c: [0.25, 0.25, 0.26] });
    gb.box(-Wh, bedY - 0.35, -Lh + 0.2, Wh, bedY - 0.12, cabR - 0.3, dark);
    const gc = paint;
    gb.box(-Wh, bedY, -Lh, Wh, bedY + 0.32, -Lh + 0.04, gc);
    gb.box(-Wh, bedY, -Lh, -Wh + 0.04, bedY + 0.32, cabR - 0.06, gc);
    gb.box(Wh - 0.04, bedY, -Lh, Wh, bedY + 0.32, cabR - 0.06, gc);
    gb.box(-Wh, bedY, cabR - 0.1, Wh, bedY + 0.45, cabR - 0.05, { c: [0.2, 0.2, 0.2] });
  }
  // フロント：グリル・ライト・バンパー
  const g = p.grille ?? 0.3;
  const gw = Wh * (0.45 + g * 0.35), gh2 = 0.08 + g * 0.16;
  gb.box(-gw, p.hood - 0.16 - gh2, Lh - 0.03, gw, p.hood - 0.15, Lh + 0.012, { c: g > 0.8 ? [0.22, 0.22, 0.24] : DARK });
  if (!lod) gb.box(-Wh * 0.5, yb + 0.05, Lh - 0.03, Wh * 0.5, yb + 0.14, Lh + 0.012, dark); // 下部開口
  const lt = p.light || 'std';
  const lw = lt === 'round' ? 0.2 : lt === 'slim' ? 0.36 : 0.3, lhgt = lt === 'slim' ? 0.1 : lt === 'round' ? 0.17 : 0.15;
  const lx0 = Wh - 0.05;
  for (const s of [1, -1]) {
    const xa = s * lx0, xb = s * (lx0 - lw);
    gb.box(Math.min(xa, xb), p.hood - 0.15 - lhgt, Lh - 0.06, Math.max(xa, xb), p.hood - 0.15, Lh + 0.015, { c: [1, 1, 0.92], mat: 2 });
    // ウインカー（前）
    if (!lod) gb.box(Math.min(s * (Wh - 0.02), s * (Wh - 0.1)), p.hood - 0.32, Lh - 0.08, Math.max(s * (Wh - 0.02), s * (Wh - 0.1)), p.hood - 0.26, Lh + 0.013, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 });
  }
  // ナンバー
  const plateL = p.plate === 'k' ? L.PLATE_K : L.PLATE_W;
  gb.quadN([-0.165, yb + 0.16, Lh + 0.02], [0.165, yb + 0.16, Lh + 0.02], [0.165, yb + 0.325, Lh + 0.02], [-0.165, yb + 0.325, Lh + 0.02], [0, 0, 1], { c: [1, 1, 1], lay: plateL });
  // リア
  const rz = truck ? -Lh : -Lh;
  const tTop = truck ? r * 2 + 0.05 : belt - 0.02, tBot = truck ? r * 2 - 0.15 : belt - 0.3;
  for (const s of [1, -1]) {
    const xa = s * (Wh - 0.02), xb = s * (Wh - 0.2);
    gb.box(Math.min(xa, xb), tBot, rz - 0.015, Math.max(xa, xb), tTop, rz + 0.03, { c: [0.8, 0.05, 0.05], mat: 4 });
    if (!lod) gb.box(Math.min(xa, xb), tBot - 0.08, rz - 0.016, Math.max(xa, xb), tBot - 0.01, rz + 0.03, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 });
  }
  const rpY = truck ? r * 2 - 0.25 : yb + 0.3;
  gb.quadN([-0.165, rpY, rz - 0.02], [0.165, rpY, rz - 0.02], [0.165, rpY + 0.165, rz - 0.02], [-0.165, rpY + 0.165, rz - 0.02], [0, 0, -1], { c: [1, 1, 1], lay: plateL }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
  gb.box(-Wh + 0.05, yb, rz - 0.03, Wh - 0.05, yb + 0.12, rz + 0.05, dark);
  // ミラー
  if (!lod) for (const s of [1, -1]) {
    const xa = s * Wh, xb = s * (Wh + 0.12);
    gb.box(Math.min(xa, xb), belt + 0.04, zW - 0.12, Math.max(xa, xb), belt + 0.16, zW - 0.02, paint);
  }
  // ドアの線・ホイールハウス
  if (lod === 0) {
    const ln = (z, y0, y1) => { for (const s of [1, -1]) gb.quadN([s * (Wh + 0.004), y0, z - 0.008], [s * (Wh + 0.004), y0, z + 0.008], [s * (Wh + 0.004), y1, z + 0.008], [s * (Wh + 0.004), y1, z - 0.008], [s, 0, 0], dark); };
    const df = zW - 0.04, dm = (zW + zRb) / 2 - 0.05;
    if (!truck) { ln(df, yb + 0.12, belt); ln(dm, yb + 0.1, belt); ln(zRb + 0.15, yb + 0.12, belt); }
    if (p.slide) for (const s of [1, -1]) gb.quadN([s * (Wh + 0.004), belt - 0.06, dm], [s * (Wh + 0.004), belt - 0.06, zRb + 0.1], [s * (Wh + 0.004), belt - 0.045, zRb + 0.1], [s * (Wh + 0.004), belt - 0.045, dm], [s, 0, 0], dark);
  }
  const zf = Lh - (p.L - p.wb) / 2 + (truck ? 0.25 : 0.05), zr = zf - p.wb;
  p._zf = zf; p._zr = zr;
  for (const z of [zf, zr]) for (const s of [1, -1]) {
    gb.quadN([s * (Wh + 0.003), 0.02, z - r - 0.06], [s * (Wh + 0.003), 0.02, z + r + 0.06], [s * (Wh + 0.003), r * 2 + 0.05, z + r + 0.06], [s * (Wh + 0.003), r * 2 + 0.05, z - r - 0.06], [s, 0, 0], { c: [0.03, 0.03, 0.03] });
  }
  if (!opt.noWheels) for (const z of [zf, zr]) for (const s of [1, -1]) wheel(gb, s * (Wh - 0.08), r, z, r, lod, s, p);
  // 影（ブロブ）
  gb.flat(-Wh + 0.1, -Lh + 0.2, Wh - 0.1, Lh - 0.2, 0.05, { c: [0.05, 0.05, 0.055], mat: 5 }); // 床下の暗がり（車体の外へははみ出さない：修正97-3）
}

export function wheel(gb, x, y, z, r, lod, side, p) {
  const w = 0.17, seg = lod ? 6 : 12;
  if (lod) { gb.cylX(x, y, z, r, w, seg, { c: TIRE }, true, { c: [0.32, 0.32, 0.34] }); return; } // 遠景でもタイヤの側面（ふた）を描いて中空の筒に見えないように
  const hub = p && (p.grille > 0.8 || p.cat === 'suv') ? [0.75, 0.76, 0.78] : [0.62, 0.63, 0.65];
  gb.cylX(x, y, z, r, w, seg, { c: TIRE }, true, { c: TIRE });
  gb.cylX(x + side * (w / 2 + 0.004), y, z, r * 0.62, 0.01, seg, { c: hub }, true);
  if (!lod) for (let i = 0; i < 4; i++) { // スポーク表現
    const a = i / 4 * Math.PI * 2;
    gb.cbox(x + side * (w / 2 + 0.012), y + Math.cos(a) * r * 0.3, z + Math.sin(a) * r * 0.3, 0.01, 0.07, 0.07, { c: [0.25, 0.25, 0.27] });
  }
}


// ===== ミライース（LA350S型を参考）：断面を前後方向につないだローポリ車体 =====
// 断面：[z, 半幅, 下端, ベルトライン, 上端]
// v0.5.2 現行型（3代目・LA350S）を参考に再設計：
//  ・ルーフは後ろまでほぼ水平（1500mm）で、リアゲートのガラスは寝かせ気味、その下のバックドアは立てる
//  ・サイドウインドウの下端（ベルトライン）はリアドアの後端でクイッと跳ね上がり、太いCピラーにつながる
//  ・前輪の上から後ろのランプへ向かって上がっていくキャラクターライン（面の折れ）
//  ・短く傾斜したボンネットと、低めの丸いノーズ
const MIRA_SEC = [
  [-1.6975, 0.64, 0.27, 0.98, 0.96], [-1.685, 0.69, 0.235, 0.99, 1.02], [-1.655, 0.718, 0.22, 1.0, 1.12], [-1.60, 0.73, 0.19, 1.02, 1.26],
  [-1.53, 0.734, 0.178, 1.04, 1.385], [-1.46, 0.736, 0.172, 1.045, 1.462], [-1.32, 0.7375, 0.17, 1.04, 1.482], [-1.22, 0.7375, 0.17, 0.985, 1.49],
  [-0.9, 0.7375, 0.17, 0.968, 1.497], [-0.4, 0.7375, 0.17, 0.955, 1.5], [-0.30, 0.7375, 0.17, 0.953, 1.4995], [-0.22, 0.7375, 0.17, 0.9518, 1.4987], [0.0, 0.7375, 0.17, 0.947, 1.497], [0.12, 0.7375, 0.17, 0.945, 1.478],
  [0.32, 0.736, 0.17, 0.94, 1.32], [0.52, 0.735, 0.172, 0.935, 1.15], [0.70, 0.733, 0.176, 0.93, 0.99], [0.74, 0.732, 0.178, 0.96, 0.958],
  [1.0, 0.729, 0.185, 0.96, 0.925], [1.25, 0.723, 0.19, 0.96, 0.888], [1.45, 0.71, 0.196, 0.96, 0.855], [1.55, 0.697, 0.2, 0.96, 0.832],
  [1.6, 0.683, 0.203, 0.96, 0.812], [1.625, 0.672, 0.205, 0.96, 0.75], [1.65, 0.66, 0.207, 0.96, 0.648], [1.675, 0.642, 0.211, 0.96, 0.545], [1.6975, 0.61, 0.218, 0.96, 0.452]
];
function miraSection([z, hw, yb, belt, top]) {
  const t = clamp((top - belt) / (1.5 - belt), 0, 1);
  const cl = 0.745 + clamp((1.45 - z) / 3.1, 0, 1) * 0.15; // キャラクターライン（前から後ろへ上がる）
  const p4y = Math.min(belt - 0.04, top - 0.03), p3y = Math.min(cl, p4y - 0.05), p2y = Math.min(yb + 0.17, p3y - 0.05);
  const P = [[0, yb], [hw * 0.92, yb], [hw * 0.993, p2y], [hw, p3y], [hw * 0.972, p4y], [hw * 0.95, Math.min(belt, top)]];
  if (top <= belt + 0.001) P.push([hw * 0.86, top + 0.004], [hw * 0.55, top + 0.012], [0, top + 0.02]);
  else P.push([hw * (0.95 - 0.1 * t), belt + (top - belt) * 0.9], [hw * (0.95 - 0.2 * t), top], [0, top + 0.012]);
  return P;
}
function miraBand(b, zm) {
  if (b === 0) return 'under';
  if (b <= 4) return 'paint';
  if (zm < -1.665) return 'paint';
  if (zm < -1.46) return b === 5 ? 'paint' : 'glass'; // リアゲートのガラス（両脇はDピラー）
  if (zm < -1.3) return b === 5 ? 'black' : 'paint'; // リアドア後ろの黒いガーニッシュ（太いCピラーの窓部分）
  if (zm < 0.12) { if (b >= 6) return 'paint'; if (zm > -0.3 && zm < -0.22) return 'black'; return 'glass'; } // サイドウインドウ（Bピラーは黒。前後ドアの長さはほぼ同じ）
  if (zm < 0.70) return 'glass'; // フロントガラス
  return 'paint';
}
// 修正101：車体の頂点法線を、同じ位置を共有し向きの近い面どうしで平均する（光の当たり方で面のカクつきが目立たないように）
function smoothNormals(gb, i0 = 0, i1 = gb.a.length, cosT = 0.8) {
  const a = gb.a, V = 13, key = i => Math.round(a[i] * 500) + ',' + Math.round(a[i + 1] * 500) + ',' + Math.round(a[i + 2] * 500), map = new Map(), fn = [];
  for (let i = i0; i < i1; i += V * 3) { const ax = a[i], ay = a[i + 1], az = a[i + 2], ux = a[i + V] - ax, uy = a[i + V + 1] - ay, uz = a[i + V + 2] - az, vx = a[i + 2 * V] - ax, vy = a[i + 2 * V + 1] - ay, vz = a[i + 2 * V + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * a[i + 3] + ny * a[i + 4] + nz * a[i + 5] < 0) { nx = -nx; ny = -ny; nz = -nz; } // 元の法線（hint で外向きにしたもの）と同じ側
    for (let k = 0; k < 3; k++) { const j = i + k * V; fn[j] = [nx, ny, nz, l]; const kk = key(j); let g = map.get(kk); if (!g) map.set(kk, g = []); g.push(j); } }
  const out = new Map();
  for (const [, g] of map) for (const j of g) { const f = fn[j]; let sx = 0, sy = 0, sz = 0; for (const q of g) { const h = fn[q]; if (h[0] * f[0] + h[1] * f[1] + h[2] * f[2] > cosT && a[q + 6] === a[j + 6] && a[q + 7] === a[j + 7]) { sx += h[0] * h[3]; sy += h[1] * h[3]; sz += h[2] * h[3]; } } const l = Math.hypot(sx, sy, sz) || 1; out.set(j, [sx / l, sy / l, sz / l]); }
  for (const [j, n] of out) { a[j + 3] = n[0]; a[j + 4] = n[1]; a[j + 5] = n[2]; }
}
// 修正123：ヘッドライトを車体表面に「載せる」造形に作り直し（自車・NPC共通）
//  旧版は平らなファン（扇形の三角形）を正面の折れ線 ZS(y) の手前に貼り、回り込み部は別体の板だったため、
//  曲面の車体と交差して食い込んだり浮いたりし、輪郭の直線区間と面の折れでシャープに見えていた。
//  新版：① 車体の断面列（rows：実際に描いている外板と同じ多角形）から、水平方向のレイキャストで外板の表面を求めて表にする。
//        ② ライトの輪郭は「表面に沿った横方向の弧長 u（車体中心からの距離）×高さ y」の2次元で設計した涙滴形（閉じたスプライン、160点）。
//        ③ 輪郭と内部の同心リングを表面へ写像し、表面の法線方向に数mm浮かせる（中央ほど高いドーム）。縁には外板の内側まで下がる
//           スカートを付けるので、外板との隙間・交差が出ない。法線は写像の偏微分から求めた滑らかな頂点法線（面の折れなし）。
//        ④ 内部のプロジェクター・ハイビーム・ウインカーも同じ写像で表面に沿わせ、明暗差を小さくする。
function buildMiraHeadlights(gb, rows) {
  const RN = rows.length;
  const inside = (x, y, z) => { // 外板の内側か（断面の多角形を z で線形補間）
    if (z < rows[0].z || z > rows[RN - 1].z) return false;
    let lo = 0, hi = RN - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].z <= z) lo = m; else hi = m; }
    const A = rows[lo].P, B = rows[hi].P, t = (z - rows[lo].z) / ((rows[hi].z - rows[lo].z) || 1), ax = Math.abs(x); let c = false;
    for (let i = 0, j = A.length - 1; i < A.length; j = i++) {
      const xi = A[i][0] + (B[i][0] - A[i][0]) * t, yi = A[i][1] + (B[i][1] - A[i][1]) * t, xj = A[j][0] + (B[j][0] - A[j][0]) * t, yj = A[j][1] + (B[j][1] - A[j][1]) * t;
      if ((yi > y) !== (yj > y) && ax < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // ① 表面の表：高さ y ごとに、軸 (0.2, y, 1.3) から水平に角度 θ の方向へ出たレイが外板を抜ける点と、横方向の弧長 u
  const AX = 0.2, AZ = 1.3, Y0 = 0.6, DY = 0.01, NY = 25, T0 = -0.55, DT = 0.015, NT = 125, tab = [];
  for (let iy = 0; iy < NY; iy++) {
    const y = Y0 + iy * DY, row = []; let u = 0, prev = null;
    for (let it = 0; it < NT; it++) {
      const th = T0 + it * DT, dx = Math.sin(th), dz = Math.cos(th); let a = 0, b = 0.02;
      while (b < 1.2 && inside(AX + dx * b, y, AZ + dz * b)) { a = b; b += 0.02; }
      for (let k = 0; k < 16; k++) { const m = (a + b) / 2; if (inside(AX + dx * m, y, AZ + dz * m)) a = m; else b = m; }
      const p = [AX + dx * a, y, AZ + dz * a];
      u = prev ? u + Math.hypot(p[0] - prev[0], p[2] - prev[2]) : p[0]; prev = p; row.push([u, p]);
    }
    tab.push(row);
  }
  const rowAt = (row, u) => { let lo = 0, hi = row.length - 1; if (u <= row[0][0]) hi = 1; else if (u >= row[hi][0]) lo = hi - 1; else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (row[m][0] <= u) lo = m; else hi = m; }
    const A = row[lo], B = row[hi], t = (u - A[0]) / ((B[0] - A[0]) || 1); return [A[1][0] + (B[1][0] - A[1][0]) * t, A[1][2] + (B[1][2] - A[1][2]) * t]; };
  const S = (u, y) => { const f = clamp((y - Y0) / DY, 0, NY - 1.001), i = Math.floor(f), t = f - i, a = rowAt(tab[i], u), b = rowAt(tab[i + 1], u); return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t]; };
  const N = (u, y) => { const e = 0.004, a = S(u + e, y), b = S(u - e, y), c = S(u, y + e), d = S(u, y - e), pu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], py = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let n = [pu[1] * py[2] - pu[2] * py[1], pu[2] * py[0] - pu[0] * py[2], pu[0] * py[1] - pu[1] * py[0]]; const p = S(u, y); if (n[0] * (p[0] - AX) + n[2] * (p[2] - AZ) < 0) n = n.map(v => -v); const l = Math.hypot(...n) || 1; return n.map(v => v / l); };
  // ② 涙滴形の輪郭（u, y）。内側の先端は細く丸く、外側は角を曲がって側面へ回り込み、丸く終わる。凸形（同心の縮小が破綻しない）
  const CP = [[0.288, 0.692], [0.33, 0.674], [0.41, 0.664], [0.51, 0.663], [0.61, 0.669], [0.70, 0.68], [0.77, 0.696], [0.815, 0.722], [0.828, 0.756], [0.81, 0.789],
    [0.76, 0.802], [0.66, 0.803], [0.56, 0.792], [0.47, 0.772], [0.39, 0.745], [0.33, 0.716]];
  const OL = []; for (let i = 0; i < CP.length; i++) { const a = CP[(i - 1 + CP.length) % CP.length], b = CP[i], c = CP[(i + 1) % CP.length], d = CP[(i + 2) % CP.length];
    for (let k = 0; k < 10; k++) { const t = k / 10, t2 = t * t, t3 = t2 * t; OL.push([0, 1].map(j => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3))); } }
  const n2 = OL.length, cen = OL.reduce((q, v) => [q[0] + v[0] / n2, q[1] + v[1] / n2], [0, 0]);
  const inset = d => OL.map((p, i) => { const a = OL[(i - 1 + n2) % n2], b = OL[(i + 1) % n2]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (nx * (cen[0] - p[0]) + ny * (cen[1] - p[1]) < 0) { nx = -nx; ny = -ny; } return [p[0] + nx * d, p[1] + ny * d]; });
  const IN = inset(0.009); // 縁（ベゼル）の内側
  // 輪郭内の点の「中心からの比率」t（0=中心、1=ベゼルの内側）：ドームの高さと色のグラデーションに使う
  const tOf = (u, y) => { const dx = u - cen[0], dy = y - cen[1], r = Math.hypot(dx, dy); if (r < 1e-6) return 0; let best = 1e9;
    for (let i = 0; i < n2; i++) { const A = IN[i], B = IN[(i + 1) % n2], ex = B[0] - A[0], ey = B[1] - A[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue; const s = ((A[0] - cen[0]) * ey - (A[1] - cen[1]) * ex) / den, w = ((A[0] - cen[0]) * dy - (A[1] - cen[1]) * dx) / den; if (s > 0 && w >= 0 && w <= 1) best = Math.min(best, s); }
    return best > 1e8 ? 1 : 1 / best; };
  const dome = t => 0.006 + 0.007 * (1 - t * t); // 表面からの浮き（m）：縁 6mm → 中央 13mm
  for (const sg of [1, -1]) {
    const V = (u, y, off) => { const p = S(u, y), n = N(u, y); return { p: [sg * (p[0] + n[0] * off), p[1] + n[1] * off, p[2] + n[2] * off], n: [sg * n[0], n[1], n[2]] }; };
    const T3 = (a, b, c, ca, cb, cc, mat) => { // 頂点法線つき三角形（巻き順は法線に合わせる）
      const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2], vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      if (fx * (a.n[0] + b.n[0] + c.n[0]) + fy * (a.n[1] + b.n[1] + c.n[1]) + fz * (a.n[2] + b.n[2] + c.n[2]) < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
      gb.vert(a.p, a.n, ca, [0, 0], mat, 0); gb.vert(b.p, b.n, cb, [0, 0], mat, 0); gb.vert(c.p, c.n, cc, [0, 0], mat, 0); };
    const strip = (A, B, cA, cB, mat) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; T3(A[i], A[j], B[j], cA, cA, cB, mat); T3(A[i], B[j], B[i], cA, cB, cB, mat); } };
    // 縁：外板の内側（-6mm）から立ち上がるスカート → ベゼル（ドームの縁の高さへ）。濃すぎないグレー
    const bez = [0.27, 0.28, 0.3];
    strip(OL.map(([u, y]) => V(u, y, -0.006)), OL.map(([u, y]) => V(u, y, 0.004)), bez, bez, 0);
    strip(OL.map(([u, y]) => V(u, y, 0.004)), IN.map(([u, y]) => V(u, y, dome(1))), bez, [0.42, 0.44, 0.47], 0);
    // レンズ越しの拡散面：同心リングのドーム。外周はやや暗く、中央ほど明るい（点灯時は mat 2 で面全体が光る）
    const TS = [1, 0.86, 0.7, 0.52, 0.34, 0.17], col = t => { const k = 0.64 - 0.1 * t; return [k, k + 0.02, k + 0.045]; };
    const ring = t => IN.map(([u, y]) => V(cen[0] + (u - cen[0]) * t, cen[1] + (y - cen[1]) * t, dome(t)));
    for (let r = 0; r < TS.length - 1; r++) strip(ring(TS[r]), ring(TS[r + 1]), col(TS[r]), col(TS[r + 1]), 2);
    { const C = V(cen[0], cen[1], dome(0)), R = ring(TS[TS.length - 1]), c1 = col(TS[TS.length - 1]); for (let i = 0; i < n2; i++) T3(C, R[i], R[(i + 1) % n2], col(0), c1, c1, 2); }
    // 内部の部品：ドームの表面から少し浮かせた円（u, y の楕円を表面に写像）。リング状に分割して曲面に沿わせる
    const disc = (u0, y0, ru, ry, lift, cIn, cOut, mat, n = 24) => { const P = (k, s) => { const a = k / n * Math.PI * 2, u = u0 + Math.cos(a) * ru * s, y = y0 + Math.sin(a) * ry * s; return V(u, y, dome(tOf(u, y)) + lift); };
      const Cc = V(u0, y0, dome(tOf(u0, y0)) + lift), mix = s => cIn.map((v, j) => v + (cOut[j] - v) * s);
      for (let k = 0; k < n; k++) { T3(Cc, P(k, 0.5), P(k + 1, 0.5), cIn, mix(0.5), mix(0.5), mat); T3(P(k, 0.5), P(k, 1), P(k + 1, 1), mix(0.5), cOut, cOut, mat); T3(P(k, 0.5), P(k + 1, 1), P(k + 1, 0.5), mix(0.5), cOut, mix(0.5), mat); } };
    disc(0.40, 0.722, 0.044, 0.04, 0.0012, [0.56, 0.58, 0.61], [0.5, 0.52, 0.55], 0); // プロジェクターの台座（控えめなグレー）
    disc(0.40, 0.722, 0.03, 0.027, 0.0024, [0.93, 0.94, 0.96], [0.76, 0.78, 0.81], 2); // プロジェクターのレンズ（中心ほど明るい）
    disc(0.50, 0.73, 0.034, 0.031, 0.0012, [0.84, 0.85, 0.87], [0.66, 0.68, 0.71], 2); // ハイビームの反射鏡
    disc(0.735, 0.712, 0.036, 0.014, 0.0016, [1, 0.62, 0.1], [0.95, 0.5, 0.06], sg > 0 ? 10 : 11, 20); // 外側下のウインカー（アンバー、角のない長円）
    // 上縁に沿う細いLEDライン（輪郭の上辺を内側へ寄せた帯。周りの拡散面に近い明るさ）
    { const a = inset(0.013), b = inset(0.019), i0 = Math.round(n2 * 0.6), i1 = Math.round(n2 * 0.95), cl = [0.8, 0.82, 0.85];
      for (let i = i0; i < i1; i++) { const A0 = V(...a[i], dome(tOf(...a[i])) + 0.0015), A1 = V(...a[i + 1], dome(tOf(...a[i + 1])) + 0.0015), B0 = V(...b[i], dome(tOf(...b[i])) + 0.0015), B1 = V(...b[i + 1], dome(tOf(...b[i + 1])) + 0.0015); T3(A0, A1, B1, cl, cl, cl, 2); T3(A0, B1, B0, cl, cl, cl, 2); } }
  }
}
export function buildMira(gb, glassGB, opt = {}) {
  const i0body = gb.a.length;
  const paint = opt.paint ? { c: opt.paint, mat: 0 } : { c: [1, 1, 1], mat: 1 };
  const black = { c: [0.05, 0.05, 0.06] }, under = { c: [0.08, 0.08, 0.09] }, dglass = { c: [0.12, 0.15, 0.19] };
  // v0.5.1 高ポリ化：断面の間に補間断面（Catmull-Rom）を入れ、各断面の輪郭も辺の中点を外側へ少し膨らませて2分割（車体の面数 約4倍）
  const lerpSec = (i, t) => { const g = k => MIRA_SEC[Math.max(0, Math.min(MIRA_SEC.length - 1, k))]; const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2), t2 = t * t, t3 = t2 * t; return b.map((_, j) => j === 0 ? b[0] + (c[0] - b[0]) * t : 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)); };
  const subP = P => { const o = [P[0]]; for (let b = 0; b < P.length - 1; b++) { const A = P[b], B = P[b + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1; let nx = dy / l, ny = -dx / l; if (nx * mx + ny * (my - 0.75) < 0) { nx = -nx; ny = -ny; } const k = b === 0 ? 0 : 0.025 * l; o.push([Math.max(0, mx + nx * k), my + ny * k], B); } return o; };
  // 修正101：面取りの分割を増やしてカクつきを減らす。断面の間の補間は4分割（以前は2分割）。
  //  自車は断面の輪郭も2回分割（角の丸みが4段）、NPCのミライースは1回分割（遠方LODは従来どおり）
  const sub = opt.player ? (P => subP(subP(P))) : subP, bandSh = opt.player ? 2 : 1, NS = 4;
  const rows = [];
  for (let i = 0; i < MIRA_SEC.length - 1; i++) for (let q = 0; q < NS; q++) { const m = q ? lerpSec(i, q / NS) : MIRA_SEC[i]; rows.push({ z: m[0], P: sub(miraSection(m)) }); }
  rows.push({ z: MIRA_SEC[MIRA_SEC.length - 1][0], P: sub(miraSection(MIRA_SEC[MIRA_SEC.length - 1])) });
  for (let r = 0; r < rows.length - 1; r++) rows[r].zm = (rows[r].z + rows[r + 1].z) / 2; rows[rows.length - 1].zm = 9;
  if (opt.rowsOut) opt.rowsOut.push(...rows); // 修正124：干渉チェック用（work-shots/tests/pen_check.mjs）に外板の断面列を渡す
  for (let r = 0; r < rows.length - 1; r++) {
    const z0 = rows[r].z, z1 = rows[r + 1].z, zm = rows[r].zm, A = rows[r].P, B = rows[r + 1].P;
    const hint = [0, 0.75, (z0 + z1) / 2];
    for (let sb = 0; sb < A.length - 1; sb++) {
      const k = miraBand(sb >> bandSh, zm);
      for (const s of [1, -1]) {
        const p0 = [s * A[sb][0], A[sb][1], z0], p1 = [s * A[sb + 1][0], A[sb + 1][1], z0], p2 = [s * B[sb + 1][0], B[sb + 1][1], z1], p3 = [s * B[sb][0], B[sb][1], z1];
        if (k === 'glass' && glassGB) { glassGB.tri(p0, p1, p2, { c: [0.3, 0.36, 0.42] }, [0, 0], [0, 0], [0, 0], hint); glassGB.tri(p0, p2, p3, { c: [0.3, 0.36, 0.42] }, [0, 0], [0, 0], [0, 0], hint); continue; }
        const o = k === 'paint' ? paint : k === 'black' ? black : k === 'under' ? under : dglass;
        gb.tri(p0, p1, p2, o, [0, 0], [0, 0], [0, 0], hint); gb.tri(p0, p2, p3, o, [0, 0], [0, 0], [0, 0], hint);
      }
    }
  }
  for (const row of [rows[0], rows[rows.length - 1]]) {
    const P = row.P, z = row.z, c = [0, (P[0][1] + P[P.length - 1][1]) / 2, z], hint = [0, c[1], z - Math.sign(z)]; // 修正101：中心を断面の内側に（以前は y=0.6 固定で、前端では断面より上に三角形が飛び出していた）
    for (let b = 0; b < P.length - 1; b++) for (const s of [1, -1]) gb.tri(c, [s * P[b][0], P[b][1], z], [s * P[b + 1][0], P[b + 1][1], z], paint, [0, 0], [0, 0], [0, 0], hint);
  }
  smoothNormals(gb, i0body, gb.a.length); // 車体の外板だけ（灯火類・グリルなどの部品は角を立てたまま）
  const ZF = 1.6975, ZR = -1.6975;
  // ---- フロント（LA350S を参考）：左右のライトをつなぐ細いグリル、台形の下部開口（横桟入り）、中央のナンバー ----
  const H4 = (a, b, c, d, o, hint = [0, 0.4, 1.2]) => { gb.tri(a, b, c, o, [0, 0], [0, 0], [0, 0], hint); gb.tri(a, c, d, o, [0, 0], [0, 0], [0, 0], hint); };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // v0.6.1 実車写真を参考に作り直し：
  //  ・ボンネット先端（ライトの間）に楕円のエンブレム（ロゴなし）
  //  ・その下、左右のライトの内側の角をつなぐ横長の上部グリル（黒い横スリット3本）
  //  ・バンパー中央にナンバー、その下に横長の下部グリル（横桟1本）、バンパー両端に縦長の凹みと丸いリフレクター
  // 正面はバンパー（y≦0.45）が垂直、その上（グリル・ライト・エンブレム）はボンネットへ向かって後ろへ寝る面
  // 断面の上端（中央）の実際の位置（補間断面を含む）から作った折れ線：正面の部品はこの面の少し手前に貼る
  const ZSP = rows.filter(r => r.z > 1.5).map(r => [r.P[r.P.length - 1][1] - 0.012, r.z]).sort((p, q) => p[0] - q[0]);
  const ZS = y => { if (y <= ZSP[0][0]) return ZF; for (let i = 0; i < ZSP.length - 1; i++) if (y <= ZSP[i + 1][0]) { const [y0, z0] = ZSP[i], [y1, z1] = ZSP[i + 1]; return z0 + (z1 - z0) * (y - y0) / (y1 - y0); } return 1.55; };
  const F = (x0, y0, x1, y1, xb0, xb1, dz, o) => gb.quadN([xb0, y0, ZS(y0) + dz], [xb1, y0, ZS(y0) + dz], [x1, y1, ZS(y1) + dz], [x0, y1, ZS(y1) + dz], [0, 0.25, 1], o);
  const dk = { c: [0.06, 0.06, 0.07] };
  F(-0.29, 0.52, 0.29, 0.648, -0.33, 0.33, 0.026, dk); // 上部グリル（下が広い台形）
  for (const [y, w] of [[0.552, 0.305], [0.594, 0.3]]) F(-w, y, w, y + 0.012, -w - 0.01, w + 0.01, 0.029, { c: [0.25, 0.26, 0.28] }); // 横スリットの間の桟（ボディ色）
  for (let k = 0; k < 14; k++) { const a0 = k / 14 * Math.PI * 2, a1 = (k + 1) / 14 * Math.PI * 2, cy = 0.68, y0 = cy + Math.sin(a0) * 0.036, y1 = cy + Math.sin(a1) * 0.036; gb.tri([0, cy, ZS(cy) + 0.016], [Math.cos(a0) * 0.052, y0, ZS(y0) + 0.016], [Math.cos(a1) * 0.052, y1, ZS(y1) + 0.016], { c: [0.72, 0.74, 0.77] }, [0, 0], [0, 0], [0, 0], [0, 0.4, 1]); } // エンブレム
  for (let k = 0; k < 14; k++) { const a0 = k / 14 * Math.PI * 2, a1 = (k + 1) / 14 * Math.PI * 2, cy = 0.68, y0 = cy + Math.sin(a0) * 0.024, y1 = cy + Math.sin(a1) * 0.024; gb.tri([0, cy, ZS(cy) + 0.019], [Math.cos(a0) * 0.036, y0, ZS(y0) + 0.019], [Math.cos(a1) * 0.036, y1, ZS(y1) + 0.019], { c: [0.3, 0.33, 0.37] }, [0, 0], [0, 0], [0, 0], [0, 0.4, 1]); }
  F(-0.45, 0.222, 0.45, 0.272, -0.42, 0.42, 0.004, dk); // 下部グリル
  F(-0.43, 0.243, 0.43, 0.251, -0.43, 0.43, 0.006, { c: [0.2, 0.2, 0.21] });
  F(-0.2, 0.278, 0.2, 0.448, -0.2, 0.2, 0.004, { c: [0.1, 0.1, 0.11] }); // ナンバー周りのくぼみ
  gb.quadN([-0.165, 0.28, ZF + 0.012], [0.165, 0.28, ZF + 0.012], [0.165, 0.445, ZF + 0.012], [-0.165, 0.445, ZF + 0.012], [0, 0, 1], { c: [1, 1, 1], lay: opt.player ? L.PLATE_ME : L.PLATE_K, mat: opt.player ? 0 : 19 });
  for (const sg of [1, -1]) { // バンパー両端の縦長の凹みと丸いリフレクター
    gb.quadN([sg * 0.47, 0.24, ZF + 0.004], [sg * 0.58, 0.25, ZF - 0.012], [sg * 0.58, 0.42, ZF - 0.012], [sg * 0.49, 0.43, ZF + 0.004], [0, 0, 1], { c: [0.1, 0.1, 0.11] });
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2, cx = sg * 0.53, cy = 0.33, rr = 0.022; gb.tri([cx, cy, ZF + 0.006], [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, ZF + 0.006], [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, ZF + 0.006], { c: [0.75, 0.76, 0.78] }, [0, 0], [0, 0], [0, 0], [0, 0.4, 1]); }
  }
  // ヘッドライト：修正123で車体表面に沿う涙滴形に作り直し（buildMiraHeadlights。自車・NPC共通、発光面は mat 2）
  buildMiraHeadlights(gb, rows);
  // リア：縦長のコンビランプ、ナンバー、スポイラー、ハイマウントストップ、ワイパー、マフラー
  for (const s of [1, -1]) { // 縦長のリアコンビランプ（バックドアの両端。側面へ回り込む）
    const x0 = s * 0.44, x1 = s * 0.625;
    gb.quadN([x0, 0.70, ZR - 0.004], [x1, 0.69, ZR - 0.004], [x1, 0.95, ZR - 0.004], [x0, 0.955, ZR - 0.004], [0, 0, -1], { c: [0.82, 0.05, 0.06], mat: 4 });
    gb.quadN([x0, 0.78, ZR - 0.006], [x1, 0.775, ZR - 0.006], [x1, 0.83, ZR - 0.006], [x0, 0.835, ZR - 0.006], [0, 0, -1], { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 });
    gb.quadN([x0, 0.715, ZR - 0.006], [x1, 0.705, ZR - 0.006], [x1, 0.745, ZR - 0.006], [x0, 0.75, ZR - 0.006], [0, 0, -1], { c: [0.95, 0.95, 0.95], mat: 20 });
    gb.quadN([x0 * 1.02, 0.95, ZR - 0.005], [x1, 0.95, ZR - 0.005], [x1, 0.965, ZR - 0.005], [x0 * 1.02, 0.97, ZR - 0.005], [0, 0, -1], black);
    // 側面への回り込み
    const w0 = [s * 0.652, -1.692], w1 = [s * 0.728, -1.62];
    gb.quadN([w0[0], 0.72, w0[1]], [w1[0], 0.74, w1[1]], [w1[0], 0.96, w1[1]], [w0[0], 0.955, w0[1]], [s * 0.7, 0, -0.7], { c: [0.82, 0.05, 0.06], mat: 4 });
  }
  gb.quadN([-0.42, 0.79, ZR - 0.005], [0.42, 0.79, ZR - 0.005], [0.42, 0.8, ZR - 0.005], [-0.42, 0.8, ZR - 0.005], [0, 0, -1], { c: [0.25, 0.25, 0.27] }); // バックドアの折れ線（ナンバーの上）
  gb.quadN([-0.2, 0.57, ZR - 0.004], [0.2, 0.57, ZR - 0.004], [0.2, 0.79, ZR - 0.004], [-0.2, 0.79, ZR - 0.004], [0, 0, -1], { c: [0.1, 0.1, 0.11] }); // ナンバー周りのくぼみ
  gb.quadN([-0.165, 0.6, ZR - 0.006], [0.165, 0.6, ZR - 0.006], [0.165, 0.765, ZR - 0.006], [-0.165, 0.765, ZR - 0.006], [0, 0, -1], { c: [1, 1, 1], lay: opt.player ? L.PLATE_ME : L.PLATE_K, mat: opt.player ? 0 : 19 }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
  gb.quadN([-0.66, 0.5, ZR - 0.004], [0.66, 0.5, ZR - 0.004], [0.66, 0.515, ZR - 0.004], [-0.66, 0.515, ZR - 0.004], [0, 0, -1], black);
  gb.box(-0.55, 0.3, ZR - 0.02, 0.55, 0.38, ZR + 0.03, { c: [0.12, 0.12, 0.13] });
  gb.box(-0.56, 1.45, -1.56, 0.56, 1.5, -1.44, paint); // ルーフスポイラー
  gb.box(-0.14, 1.46, -1.565, 0.14, 1.48, -1.555, { c: [0.8, 0.05, 0.05], mat: 4 });
  gb.beam([0.02, 1.12, -1.604], [-0.38, 1.27, -1.56], 0.008, black);
  gb.cylX(-0.4, 0.22, ZR + 0.05, 0.03, 0.01, 6, { c: [0.25, 0.25, 0.25] });
  // ホイールアーチ
  for (const z of [MIRA._zf, MIRA._zr]) for (const s of [1, -1]) {
    const hw = 0.7375, r = MIRA.r + 0.05, cy = MIRA.r, pts = [];
    for (let k = 0; k <= 24; k++) { const a = Math.PI * (k / 24); pts.push([cy + Math.sin(a) * r, z + Math.cos(a) * r]); }
    const ax = hw + 0.014; // 車体側面の膨らみ（高ポリ化）より外側に描く
    for (let k = 0; k < pts.length - 1; k++) gb.tri([s * ax, cy, z], [s * ax, pts[k][0], pts[k][1]], [s * ax, pts[k + 1][0], pts[k + 1][1]], black, [0, 0], [0, 0], [0, 0], [0, cy, z]);
    gb.quadN([s * ax, 0.12, z - r], [s * ax, 0.12, z + r], [s * ax, cy, z + r], [s * ax, cy, z - r], [s, 0, 0], black);
  }
  // ドアの見切り線・ドアハンドル・サイドミラー・サイドターンランプ・給油口（v0.6.1 実車写真を参考に配置。アンテナは修正106で撤去）
  for (const s of [1, -1]) {
    const x = s * 0.7515;
    // 前ドア前端（前輪アーチのすぐ後ろ）／Bピラー下／リアドア後端（後輪アーチの上を回る）
    for (const [z, y0, y1] of [[0.8, 0.5, 0.935], [-0.255, 0.3, 0.955], [-1.26, 0.6, 1.0]]) gb.quadN([x, y0, z - 0.006], [x, y0, z + 0.006], [x, y1, z + 0.006], [x, y1, z - 0.006], [s, 0, 0], black);
    gb.quadN([x, 0.5, 0.8], [x, 0.3, 0.6], [x, 0.3, 0.588], [x, 0.5, 0.788], [s, 0, 0], black); // 前ドア前端の下部（アーチに沿って斜め）
    gb.quadN([x, 0.6, -1.26], [x, 0.56, -1.05], [x, 0.572, -1.05], [x, 0.612, -1.26], [s, 0, 0], black); // リアドア後端（アーチの上）
    gb.quadN([x, 0.3, 0.6], [x, 0.3, -1.05], [x, 0.312, -1.05], [x, 0.312, 0.6], [s, 0, 0], black); // ドア下端
    // グリップ式のドアハンドル（メッキ）
    for (const z of [-0.06, -1.06]) { gb.box(Math.min(x, x + s * 0.025), 0.835, z - 0.075, Math.max(x, x + s * 0.025), 0.865, z + 0.075, { c: [0.78, 0.8, 0.83] }); gb.box(Math.min(x, x + s * 0.004), 0.825, z - 0.09, Math.max(x, x + s * 0.004), 0.875, z + 0.09, { c: [0.08, 0.08, 0.09] }); }
    // サイドミラー：ドアの前端に黒い台座、ボディ色の丸みのあるハウジング
    gb.quadN([x + s * 0.002, 0.94, 0.78], [x + s * 0.002, 0.94, 0.6], [x + s * 0.002, 1.05, 0.62], [x + s * 0.002, 1.05, 0.74], [s, 0, 0], black);
    gb.box(Math.min(x, x + s * 0.06), 0.97, 0.62, Math.max(x, x + s * 0.06), 1.0, 0.7, black);
    gb.box(Math.min(s * 0.78, s * 0.95), 0.955, 0.6, Math.max(s * 0.78, s * 0.95), 1.085, 0.7, paint);
    gb.box(Math.min(s * 0.8, s * 0.94), 0.94, 0.62, Math.max(s * 0.8, s * 0.94), 0.955, 0.69, paint);
    gb.box(Math.min(s * 0.79, s * 0.945), 0.965, 0.595, Math.max(s * 0.79, s * 0.945), 1.075, 0.6, { c: [0.55, 0.62, 0.7] });
    // フェンダーのサイドターンランプ（前輪アーチの後ろ上）
    gb.box(Math.min(x, x + s * 0.012), 0.775, 0.87, Math.max(x, x + s * 0.012), 0.8, 0.92, { c: [1, 0.55, 0.05], mat: s > 0 ? 10 : 11 });
  }
  // 給油口（左後ろ）
  for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI * 2, a1 = (k + 1) / 10 * Math.PI * 2, cz = -1.47, cy = 0.79, x = 0.7535; gb.tri([x, cy, cz], [x, cy + Math.sin(a1) * 0.075, cz + Math.cos(a1) * 0.085], [x, cy + Math.sin(a0) * 0.075, cz + Math.cos(a0) * 0.085], { c: [0.08, 0.08, 0.09] }, [0, 0], [0, 0], [0, 0], [1, cy, cz]); gb.tri([x + 0.001, cy, cz], [x + 0.001, cy + Math.sin(a1) * 0.068, cz + Math.cos(a1) * 0.078], [x + 0.001, cy + Math.sin(a0) * 0.068, cz + Math.cos(a0) * 0.078], paint, [0, 0], [0, 0], [0, 0], [1, cy, cz]); }
  // 修正106：ルーフのロッドアンテナは撤去（自車・NPCのミライースとも buildMira を共用）
}
// 14インチ・アルミホイール（5本ダブルスポーク）
export function miraWheel(gb, side) {
  const r = MIRA.r, w = 0.155, x = side * (w / 2 + 0.003), sv = [0.78, 0.79, 0.81];
  gb.cylX(0, 0, 0, r, w, 24, { c: TIRE }, true, { c: TIRE });
  gb.cylX(x, 0, 0, r * 0.7, 0.006, 24, { c: [0.12, 0.12, 0.13] }, true);
  gb.cylX(x + side * 0.004, 0, 0, 0.055, 0.01, 8, { c: sv }, true);
  for (let i = 0; i < 10; i++) { // 5本のダブルスポーク（実車の14インチアルミ）
    const a = (Math.floor(i / 2) / 5 + (i % 2 ? 0.018 : -0.018)) * Math.PI * 2, a2 = (Math.floor(i / 2) / 5 + (i % 2 ? 0.038 : -0.038)) * Math.PI * 2;
    gb.beam([x + side * 0.006, Math.cos(a) * 0.05, Math.sin(a) * 0.05], [x + side * 0.004, Math.cos(a2) * r * 0.68, Math.sin(a2) * r * 0.68], 0.013, { c: sv });
  }
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * Math.PI * 2, a1 = (i + 1) / 16 * Math.PI * 2; gb.beam([x + side * 0.004, Math.cos(a0) * r * 0.7, Math.sin(a0) * r * 0.7], [x + side * 0.004, Math.cos(a1) * r * 0.7, Math.sin(a1) * r * 0.7], 0.012, { c: sv }); }
}
// NPC用のミライース（同じ車体・塗装はtint）
export function buildMiraNPC(gb) {
  buildMira(gb, null);
  for (const s of [1, -1]) { const g = new GB(); miraWheel(g, s); const a = g.a; for (const z of [MIRA._zf, MIRA._zr]) for (let i = 0; i < a.length; i += 13) gb.a.push(a[i] + s * 0.6665, a[i + 1] + MIRA.r, a[i + 2] + z, ...a.slice(i + 3, i + 13)); }
  gb.flat(-0.64, -1.5, 0.64, 1.5, 0.05, { c: [0.05, 0.05, 0.055], mat: 5 });
}

// プレイヤー車両：外装・ガラス・内装・ホイール・ステアリング・メーター針を個別メッシュで生成
export function buildPlayerCar() {
  const p = MIRA;
  const body = new GB(), glass = new GB(), interior = new GB(), wheelG = new GB(), wheelR = new GB(), steer = new GB(), needle = new GB();
  buildMira(body, glass, { player: true });
  for (const s of [1, -1]) body.beam([s * 0.682, 0.955, 0.70], [s * 0.528, 1.48, 0.125], 0.028, { c: [1, 1, 1], mat: 1 }); // Aピラー
  body.flat(-0.64, -1.5, 0.64, 1.5, 0.05, { c: [0.05, 0.05, 0.055], mat: 5 });
  miraWheel(wheelG, 1); miraWheel(wheelR, -1);
  const Wh = p.W / 2, belt = p.belt, zW = p.L / 2 - p.ws;
  const trim = { c: [0.16, 0.16, 0.17] }, beige = { c: [0.3, 0.3, 0.31] };
  // 内装：ダッシュボード
  interior.box(-Wh + 0.06, belt - 0.32, zW - 0.62, Wh - 0.06, belt - 0.02, zW - 0.05, trim);
  // 修正93-5：ダッシュボード上面はフロントガラスへ向かって下がる斜面（平板な箱にしない）。中央にディスプレイと空調吹き出し口
  { const dk = { c: [0.2, 0.2, 0.21] }, yR = belt + 0.04, yF = belt - 0.03, /* 修正114：ダッシュボード上面を 3cm 下げる */ zR = zW - 0.62, zF = zW - 0.08;
    interior.quadN([-Wh + 0.06, yR, zR], [Wh - 0.06, yR, zR], [Wh - 0.06, yF, zF], [-Wh + 0.06, yF, zF], [0, 1, 0.2], dk);
    interior.quadN([-Wh + 0.06, belt - 0.32, zR], [Wh - 0.06, belt - 0.32, zR], [Wh - 0.06, yR, zR], [-Wh + 0.06, yR, zR], [0, 0, -1], { c: [0.17, 0.17, 0.18] });
    interior.quadN([-0.13, belt - 0.12, zR - 0.006], [0.13, belt - 0.12, zR - 0.006], [0.13, belt + 0.03, zR - 0.006], [-0.13, belt + 0.03, zR - 0.006], [0, 0, -1], { c: [0.06, 0.09, 0.12], mat: 5 }); // ディスプレイ
    for (const vx of [-0.2, 0.2, Wh - 0.16, -Wh + 0.16]) for (let k = 0; k < 3; k++) interior.quadN([vx - 0.05, belt - 0.07 + k * 0.025, zR - 0.006], [vx + 0.05, belt - 0.07 + k * 0.025, zR - 0.006], [vx + 0.05, belt - 0.058 + k * 0.025, zR - 0.006], [vx - 0.05, belt - 0.058 + k * 0.025, zR - 0.006], [0, 0, -1], { c: [0.05, 0.05, 0.05] }); // 吹き出し口
    interior.quadN([0.2, belt - 0.27, zR - 0.006], [Wh - 0.12, belt - 0.27, zR - 0.006], [Wh - 0.12, belt - 0.265, zR - 0.006], [0.2, belt - 0.265, zR - 0.006], [0, 0, -1], { c: [0.08, 0.08, 0.08] }); } // グローブボックスの見切り
  // メーターフード（右ハンドル：運転席は -x 側）。メーターはハンドルの上から見える高さに置く
  const dx = -0.36;
  // 修正97-4：メーターとフードを低く小さくし、ハンドルを下げて、運転席の目線（y=1.16）からハンドル上部の内側にメーター全体が見えるようにする
  // 修正114：運転者視点の前方視界を確保。メーターフードの上端を belt+0.14 → belt+0.05 に下げて薄くし、メーター（13cm角）はハンドルのリムの上から読める高さに置く
  //  運転席の目（eye）は座った人の実際の目の位置（座面の上、背もたれの前）へ。ダッシュボード・フードは画面下部の約25%に収まる（自己テストで計測）
  interior.box(dx - 0.12, belt + 0.03, zW - 0.68, dx + 0.12, belt + 0.05, zW - 0.56, { c: [0.1, 0.1, 0.11] });
  for (const sx of [dx - 0.12, dx + 0.1]) interior.box(sx, belt - 0.1, zW - 0.68, sx + 0.02, belt + 0.03, zW - 0.57, { c: [0.1, 0.1, 0.11] });
  interior.quadN([dx - 0.065, belt - 0.09, zW - 0.651], [dx + 0.065, belt - 0.09, zW - 0.651], [dx + 0.065, belt + 0.04, zW - 0.651], [dx - 0.065, belt + 0.04, zW - 0.651], [0, 0, -1], { c: [0.9, 0.9, 0.9], lay: L.METER, mat: 0 }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
  // センターパネル
  interior.quadN([-0.14, belt - 0.32, zW - 0.63], [0.14, belt - 0.32, zW - 0.63], [0.14, belt - 0.06, zW - 0.63], [-0.14, belt - 0.06, zW - 0.63], [0, 0, -1], { c: [1, 1, 1], lay: L.PANEL }, [[1, 1], [0, 1], [0, 0], [1, 0]]);
  interior.box(-0.14, 0.25, zW - 1.2, 0.14, belt - 0.32, zW - 0.6, trim); // センターコンソール
  // シート（修正113：実車 LA350S の寸法感。前席は幅0.46・奥行き0.46に小ぶりにして前へ寄せ、背もたれは薄く少し寝かせてヘッドレスト付き。
  //  後席はベンチシート（座面・やや寝た背もたれ・左右のヘッドレスト）で、前席の背もたれとの間に足元空間（大人の膝の前に約0.16m）を確保）
  const seat = { c: [1, 1, 1], side: { lay: L.SEAT, tw: 0.5, th: 0.5 }, top: { lay: L.SEAT, tw: 0.5 } }, seatD = { c: [0.78, 0.78, 0.8], side: { lay: L.SEAT, tw: 0.5, th: 0.5 }, top: { lay: L.SEAT, tw: 0.5 } };
  for (const sx of [-0.36, 0.36]) {
    interior.box(sx - 0.23, 0.3, -0.68, sx + 0.23, 0.47, -0.22, seat); // 座面（前席）
    interior.box(sx - 0.23, 0.44, -0.76, sx + 0.23, 0.82, -0.7, seat); // 背もたれ（下）
    interior.box(sx - 0.22, 0.82, -0.81, sx + 0.22, 1.12, -0.75, seat); // 背もたれ（上・少し後ろへ寝かせる）
    interior.box(sx - 0.13, 1.16, -0.83, sx + 0.13, 1.31, -0.77, seatD); // ヘッドレスト
    for (const hx of [-0.08, 0.08]) interior.box(sx + hx - 0.008, 1.12, -0.8, sx + hx + 0.008, 1.16, -0.78, { c: [0.6, 0.6, 0.62] });
    interior.box(sx - 0.18, 0.26, -0.66, sx + 0.18, 0.3, -0.26, { c: [0.1, 0.1, 0.1] }); // シートレール・脚
  }
  interior.box(-Wh + 0.1, 0.28, -1.52, Wh - 0.1, 0.45, -1.1, seat); // 後席の座面（ベンチ）
  // 修正124：後席の背もたれ上部とヘッドレストがリアゲート（ガラス・バックドア）の外へ突き出していた（旧 z=-1.68〜-1.58／-1.69〜-1.62）。
  //  背もたれの前面（z=-1.54、修正113）は変えずに厚みを詰め、ヘッドレストを前へ寄せて、寝たリアガラスの内側（1.5cm以上）に収める
  interior.box(-Wh + 0.1, 0.42, -1.62, Wh - 0.1, 0.8, -1.54, seat); // 後席の背もたれ（下）
  interior.box(-Wh + 0.1, 0.8, -1.63, Wh - 0.1, 1.04, -1.555, seat); // 後席の背もたれ（上・わずかに寝かせる）
  for (const sx of [-0.34, 0.34]) { interior.box(sx - 0.12, 1.06, -1.61, sx + 0.12, 1.165, -1.567, seatD); for (const hx of [-0.07, 0.07]) interior.box(sx + hx - 0.008, 1.04, -1.595, sx + hx + 0.008, 1.06, -1.58, { c: [0.6, 0.6, 0.62] }); } // 後席のヘッドレスト（ステー付き）
  // 床（後席の足元は一段低く）・内張り・天井（後席の頭上まで）
  // 修正124：床板の角（ロッカー部）・左右の内張り（ベルトライン付近と後端）・天井の内張り（ルーフの角とリアガラス）が外板を貫通していたので、外板の内側に収める
  interior.box(-Wh + 0.07, 0.22, -1.5, Wh - 0.07, 0.26, zW - 0.1, { c: [0.12, 0.12, 0.12] });
  for (const s of [1, -1]) interior.box(s * (Wh - 0.095) - 0.02, 0.3, -1.5, s * (Wh - 0.095) + 0.02, belt + 0.03, zW - 0.2, beige);
  interior.box(-Wh + 0.16, p.H - 0.09, -1.42, Wh - 0.16, p.H - 0.06, p.L / 2 - p.wsT - 0.05, { c: [0.75, 0.73, 0.68] });
  // ルームミラー
  const zFt = p.L / 2 - p.wsT;
  interior.box(-0.11, p.H - 0.22, zFt - 0.12, 0.11, p.H - 0.15, zFt - 0.08, { c: [0.1, 0.1, 0.1] });
  interior.beam([0, p.H - 0.07, zFt - 0.04], [0, p.H - 0.15, zFt - 0.1], 0.012, { c: [0.12, 0.12, 0.12] }); // ミラーの支柱（天井から）
  for (const sx of [-1, 1]) { interior.box(sx > 0 ? 0.06 : -0.52, p.H - 0.115, zFt - 0.34, sx > 0 ? 0.52 : -0.06, p.H - 0.093, zFt - 0.06, { c: [0.72, 0.7, 0.65] }); interior.beam([sx * 0.08, p.H - 0.07, zFt - 0.08], [sx * 0.08, p.H - 0.1, zFt - 0.08], 0.008, { c: [0.3, 0.3, 0.3] }); } // サンバイザー（天井に付く）
  interior.box(-0.1, p.H - 0.215, zFt - 0.121, 0.1, p.H - 0.155, zFt - 0.119, { c: [0.6, 0.7, 0.8], mat: 5 });
  // ステアリング（原点中心、z+向きに面する）
  const sr = 0.18, n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    steer.beam([Math.cos(a0) * sr, Math.sin(a0) * sr, 0], [Math.cos(a1) * sr, Math.sin(a1) * sr, 0], 0.018, { c: [0.2, 0.2, 0.22] });
  }
  steer.cbox(0, 0, 0.01, 0.12, 0.09, 0.05, { c: [0.12, 0.12, 0.13] });
  steer.beam([0, 0, 0], [-sr, 0, 0], 0.014, { c: [0.1, 0.1, 0.1] }); steer.beam([0, 0, 0], [sr, 0, 0], 0.014, { c: [0.1, 0.1, 0.1] });
  steer.beam([0, 0, 0], [0, -sr, 0], 0.014, { c: [0.1, 0.1, 0.1] });
  steer.beam([0, 0, 0.02], [0, 0, 0.35], 0.03, { c: [0.1, 0.1, 0.1] });
  needle.box(-0.003, 0, -0.002, 0.003, 0.055, 0.002, { c: [1, 0.3, 0.1], mat: 5 });
  const meterGlow = new GB(); meterGlow.quadN([dx - 0.07, belt - 0.095, zW - 0.653], [dx + 0.07, belt - 0.095, zW - 0.653], [dx + 0.07, belt + 0.045, zW - 0.653], [dx - 0.07, belt + 0.045, zW - 0.653], [0, 0, -1], { c: [0.2, 1, 0.45], mat: 8 }); // エコ運転中のグリーン照明
  return { p, body, glass, interior, wheel: wheelG, wheelR, steer, needle, driverX: dx, eye: [dx, 1.2, -0.51], /* 修正113・114：旧 [dx, 1.16, -0.42]（座面より前に浮いていた） */ wheelPos: [[-0.6665, p._zf, 1], [0.6665, p._zf, 1], [-0.6665, p._zr, 0], [0.6665, p._zr, 0]], steerPos: [dx, 0.85, -0.15], meterGlow, meterPos: [dx, belt - 0.025, zW - 0.656] }; // 修正114：旧 steerPos [dx, belt-0.19, zW-0.76]、meterPos [dx, belt+0.03, zW-0.656]
}

// v0.5.1 セミトレーラー：トラクタ（けん引車）は buildHull に車長 tL で作り、トレーラー（バン型・後3軸）は別メッシュ。描画時に連結角を付けて並べる
export function tractorDef(m) { return { ...m, L: m.semi.tL }; }
export function buildTrailer(gb, m, lod = 0) {
  const W = m.W, Wh = W / 2, L = m.semi.kL, zF = L / 2, zR = -L / 2, r = 0.5, bedY = 1.25, top = m.boxH, n = lod ? 8 : 16;
  const wall = { c: [0.94, 0.94, 0.92], side: { lay: L_METAL(), tw: 2.4, th: top - bedY } }, dark = { c: [0.12, 0.12, 0.13] };
  gb.box(-Wh, bedY, zR, Wh, top, zF, wall); // 荷箱
  gb.box(-Wh + 0.3, bedY - 0.25, zR + 0.3, Wh - 0.3, bedY, zF - 0.6, dark); // 台枠
  gb.box(-0.12, bedY - 0.35, zF - 1.1, 0.12, bedY, zF - 0.9, dark); // キングピン
  for (const sg of [1, -1]) { // 補助脚
    gb.box(sg * (Wh - 0.35) - 0.06, 0.12, zF - 3.2, sg * (Wh - 0.35) + 0.06, bedY - 0.25, zF - 3.05, { c: [0.3, 0.3, 0.32] });
    gb.box(sg * (Wh - 0.35) - 0.15, 0.1, zF - 3.25, sg * (Wh - 0.35) + 0.15, 0.14, zF - 3.0, { c: [0.3, 0.3, 0.32] });
  }
  gb.box(-Wh, 0.35, zR + 2.8, -Wh + 0.05, bedY - 0.25, zF - 4.5, { c: [0.85, 0.85, 0.85] }); gb.box(Wh - 0.05, 0.35, zR + 2.8, Wh, bedY - 0.25, zF - 4.5, { c: [0.85, 0.85, 0.85] }); // サイドガード
  if (lod < 2) { gb.quadN([-0.01, bedY + 0.1, zR - 0.006], [0.01, bedY + 0.1, zR - 0.006], [0.01, top - 0.1, zR - 0.006], [-0.01, top - 0.1, zR - 0.006], [0, 0, -1], dark); }
  gb.box(-Wh, 0.45, zR - 0.05, Wh, 0.6, zR + 0.1, dark); // リアバンパー
  for (const sg of [1, -1]) { const x0 = sg * (Wh - 0.08), x1 = sg * (Wh - 0.42); gb.quadN([Math.min(x0, x1), 0.62, zR - 0.06], [Math.max(x0, x1), 0.62, zR - 0.06], [Math.max(x0, x1), 0.8, zR - 0.06], [Math.min(x0, x1), 0.8, zR - 0.06], [0, 0, -1], { c: [0.82, 0.05, 0.06], mat: 4 }); }
  for (const sg of [1, -1]) for (let k = 0; k < 4; k++) gb.box(sg * Wh - 0.02, bedY + 0.05, zR + 1 + k * 3.6, sg * Wh + 0.02, bedY + 0.12, zR + 1.15 + k * 3.6, { c: [1, 0.55, 0.05], mat: 8 }); // 側面のマーカー
  for (const z of [zR + 1.2, zR + 2.5, zR + 3.8]) for (const sg of [1, -1]) gb.cylX(sg * (Wh - 0.25), r, z, r, 0.45, n, { c: [0.1, 0.1, 0.1] }, true, { c: [0.55, 0.56, 0.58] });
  gb.flat(-Wh + 0.1, zR + 0.2, Wh - 0.1, zF - 0.2, 0.05, { c: [0.05, 0.05, 0.055], mat: 5 });
}
function L_METAL() { return L.METAL; }
