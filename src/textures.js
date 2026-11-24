// テクスチャ配列（256x256 レイヤー）をCanvasで手続き生成。アルファ = 夜間発光マスク
import { rng } from './math.js?v=0.9.0';
export const TS = 256;
export const L = {};
const layers = []; // {name, draw(ctx, img)}
const names = ['WHITE', 'OFFICE', 'OFFICE2', 'APT', 'HOUSE', 'SHOP', 'SHUTTER', 'ASPHALT', 'SIDEWALK', 'GRASS', 'PADDY', 'WATER',
  'ROOF', 'KAWARA', 'METAL', 'PLATE_K', 'PLATE_W', 'STOP', 'SP30', 'SP40', 'SP50', 'SP60', 'GUIDE', 'METER', 'PANEL', 'PARK_P', 'MANSION', 'HOTEL', 'FIELD', 'TRAINWIN', 'SEAT', 'GLOW', 'TREE', 'ONEWAY', 'NOENTRY', 'RAIL', 'ROCK', 'TUNNELWALL', 'FOREST', 'CURVE', 'BACK_RND', 'BACK_TRI', 'BACK_DIA', 'TOMARE', 'JOKO', 'SCHOOLZ', 'MANHOLE', 'GRATE', 'BUSSTOP', 'TOBIDASHI', 'NOBORI', 'CROSSW', 'HOUSE_DARK', 'CLOUD', 'LAUNDRY', 'BIKE_RACK', 'WATERPAD', 'CROP', 'TEAROW', 'TACTILE', 'POSTER'];
names.forEach((n, i) => L[n] = i);

export const FONT = "'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP','Noto Sans CJK JP','Yu Gothic','Meiryo',sans-serif";

// 架空ブランド看板（実在ブランドは使用しない）
export const SIGNS = [
  ['CONBINI', 'ことりマート', '#ffffff', '#1f8a4c', '24H', '#f2a31b'],
  ['CONBINI2', 'ミドリヤ', '#2457a6', '#ffffff', 'STORE', '#ffd200'],
  ['CONBINI3', 'ことりマート', '#ffffff', '#1f8a4c', '24H', '#f2a31b'],
  ['CAFE', 'カフェ こもれび', '#ffffff', '#6b4a2b', 'COFFEE', '#f3d9a4'],
  ['IZAKAYA', '居酒屋 ほたる', '#ffffff', '#8a1f1f', '炉ばた', '#ffd200'],
  ['TEISHOKU', '定食 まるや', '#222222', '#f6efe0', 'ごはん処', '#c0392b'],
  ['BAKERY', 'ベーカリー 麦の穂', '#5a3a1a', '#fbe8c8', 'パン', '#b8742a'],
  ['CLEANING', 'クリーニング はやせ', '#ffffff', '#1d6fb8', '即日仕上げ', '#ffe25a'],
  ['BEAUTY', 'ヘアサロン ルミ', '#333333', '#f7d6e0', 'HAIR', '#b04a6e'],
  ['KARAOKE', 'カラオケ ポップ', '#ffffff', '#7a2bb8', '24H', '#ffd200'],
  ['FURUGI', '古着屋 ふるる', '#ffffff', '#2f5d50', 'USED', '#f2c14e'],
  ['SUPER2', 'スーパー わかば', '#ffffff', '#2c9a3e', '新鮮市場', '#ffe25a'],
  ['CLINIC', 'わかばクリニックモール', '#1d4f8a', '#ffffff', '内科・小児科・歯科', '#2c9a3e'],
  ['LOGI', 'みなせロジテック', '#ffffff', '#1f3f7a', '物流センター', '#7fd0ff'],
  ['FOODF', '水瀬フーズ', '#ffffff', '#c0392b', '食品工場', '#ffe25a'],
  ['MOTORS', 'ひばり自動車整備', '#ffffff', '#333333', '車検・整備', '#f39c12'],
  ['SEIKI', '東和精機', '#1f3f7a', '#ffffff', '本社工場', '#555555'],
  ['DRUG', 'ドラッグ ハルカ', '#ffe100', '#1b3c8c', '薬', '#e83b2e'],
  ['SUPER', 'スーパー いろは', '#e8412c', '#ffffff', '食品', '#ffffff'],
  ['HOMEC', 'ホームセンター カナメ', '#f28c00', '#ffffff', 'DIY', '#ffffff'],
  ['DENKI', 'でんきのヒカリ', '#d81e26', '#ffef00', '家電', '#ffffff'],
  ['MALL', 'ミナセモール', '#ffffff', '#c2185b', 'SHOPPING', '#555555'],
  ['FAMIRES', 'ファミリー亭 ふくろう', '#7a1f1f', '#ffe9b0', 'RESTAURANT', '#ffffff'],
  ['BURGER', 'バーガーミナト', '#c8102e', '#ffffff', 'BURGER', '#ffd100'],
  ['RAMEN', 'ラーメン 龍門', '#111111', '#ffcc00', '中華そば', '#ff4444'],
  ['GAS', 'オオゾラ石油', '#0a5bb5', '#ffffff', 'SELF', '#ffda1a'],
  ['DEALER', 'ミナセ自動車', '#14335c', '#ffffff', '新車・中古車', '#9fd4ff'],
  ['PACHI', 'パーラー ギャラクシー', '#5b1fa8', '#ffee00', 'P', '#ff3fbf'],
  ['BANK', 'あけぼの銀行', '#0e6e5c', '#ffffff', 'ATM', '#ffffff'],
  ['POST', '水瀬郵便局', '#d7141a', '#ffffff', '〒', '#ffffff'],
  ['CITY', '水瀬市役所', '#f4f1e8', '#222222', 'CITY HALL', '#666666'],
  ['POLICE', '水瀬警察署', '#f4f4f4', '#1d3d8f', 'POLICE', '#1d3d8f'],
  ['FIRE', '水瀬消防署', '#c4161c', '#ffffff', 'FIRE', '#ffffff'],
  ['HOSP', '水瀬総合病院', '#ffffff', '#11804a', 'HOSPITAL', '#11804a'],
  ['SCHOOL', '水瀬市立 第一小学校', '#f2efe6', '#2c2c2c', '', '#2c2c2c'],
  ['STATION', '水瀬駅  MINASE STA.', '#2a3f5f', '#ffffff', '水瀬鉄道', '#e8a33d'],
  ['HOTEL', 'ビジネスホテル 水瀬イン', '#2a2a40', '#ffd58a', 'HOTEL', '#ffffff'],
  ['BUS', '水瀬バスターミナル', '#0b7d4e', '#ffffff', 'BUS', '#ffffff'],
  ['COINP', 'コインパーキング 100円/30分', '#ffd200', '#222222', 'P', '#0a4fb5'],
  ['TSUKI', '月極駐車場 空きあり', '#ffffff', '#1a4ea8', 'P', '#e02020'],
  ['FACTORY', '水瀬精機 第二工場', '#e9e9e2', '#2a4a7a', 'FACTORY', '#2a4a7a'],
  ['SOKO', 'みなせ倉庫', '#e6e6e0', '#b5361c', 'LOGISTICS', '#b5361c'],
  ['SHOP1', '洋品店 さくら', '#f7e3e8', '#a8204a', '', '#a8204a'],
  ['SHOP2', '八百屋 まるき', '#1d6b2d', '#ffffff', '', '#ffffff'],
  ['SHOP3', 'カフェ こもれび', '#4a3424', '#f3e2c0', 'CAFE', '#f3e2c0'],
  ['SHOP4', '本の森書店', '#2b3a67', '#ffffff', 'BOOKS', '#ffffff'],
  ['SHOP5', '居酒屋 まんぷく', '#2a0f0f', '#ff5a3c', '', '#ffffff'],
  ['SHOP6', 'クリーニング みなせ', '#e8f3ff', '#0d5fb4', '', '#0d5fb4'],
  ['SHOP7', '和菓子 柳屋', '#6b4a2e', '#fff3dc', '', '#fff3dc'],
  ['SHOTEN', '水瀬銀座商店街', '#b81d24', '#ffffff', '', '#ffffff'],
  ['OFFICE_A', '東北ミナセ生命', '#ffffff', '#103d7a', '', '#103d7a'],
  ['OFFICE_B', 'みちのく電力', '#0f5aa6', '#ffffff', '', '#ffffff'],
  ['DEPT', 'ミナセ百貨店', '#efe4cf', '#6b1f2f', '', '#6b1f2f'],
  ['MALL2', 'ミナセモール東', '#ffffff', '#2a6fb0', 'SHOPPING', '#f29a1f'],
  ['GYUDON', '牛丼 まるや', '#f39800', '#ffffff', '早い', '#7a2b00'],
  ['SUSHI', '回転寿司 うず潮', '#0d4c8c', '#ffffff', '寿司', '#ffffff'],
  ['BOOKS2', '本とゲームの森', '#ffd400', '#1a1a1a', 'USED', '#1a1a1a'],
  ['DEALER2', 'みちのくモータース', '#c4161c', '#ffffff', 'CARS', '#ffffff'],
  ['TIRE', 'タイヤ館 くるま堂', '#222222', '#ffcc00', 'TIRE', '#ffffff'],
  ['TUNNEL', '水瀬トンネル  延長 300m', '#2c2c2c', '#ffffff', '', '#ffffff'],
  ['MICHI', '道の駅 みなせ峠', '#1f5d2e', '#ffffff', '休憩', '#ffffff'],
  ['RIVERPARK', '水瀬川河川公園', '#ffffff', '#1d6b3a', 'PARK', '#1d6b3a'],
  ['SHRINE', '水瀬神社', '#3a2a1a', '#f3e2c0', '', '#f3e2c0'],
  ['FARMCOOP', 'みなせ農協 農産物直売所', '#11804a', '#ffffff', '直売', '#ffffff'],
  ['INDUS2', '東北ミナセ化学', '#ffffff', '#0f5aa6', 'CHEMICAL', '#0f5aa6'],
  ['TAXI', 'タクシー乗り場', '#ffcc00', '#111111', 'TAXI', '#111111'],
  ['KOBAN', '水瀬駅前 交番', '#ffffff', '#1d3d8f', 'KOBAN', '#d7141a'],
  ['KOBAN2', '本町 交番', '#ffffff', '#1d3d8f', 'KOBAN', '#d7141a'],
  ['KASHI', '貸店舗  ☎ 0X-XXXX', '#ffffff', '#c4161c', '', '#c4161c'],
  ['GOMI', '資源ごみ回収場所', '#1d6b3a', '#ffffff', 'ゴミ', '#ffffff'],
  ['URICHI', '売地  分譲中', '#ffffff', '#c4161c', '', '#1d3d8f'],
  ['KOJI', '工事中  ご迷惑をおかけします', '#ffd200', '#111111', '', '#111111'],
  ['MUJIN', '無人販売 野菜100円', '#fff6d5', '#2a6b2a', '', '#2a6b2a'],
  ['GAS2', 'みちのくエネルギー', '#d7141a', '#ffffff', 'SELF', '#ffd200'],
  ['MAPBOARD', '水瀬市 観光案内図', '#1b4fa0', '#ffffff', 'MAP', '#ffffff'],
  ['RICECENTER', 'みなせ農協 カントリーエレベーター', '#ffffff', '#11804a', '', '#11804a'],
  ['TEMPLE', '曹洞宗 水瀬山 慈光寺', '#3a2a1a', '#f3e2c0', '', '#f3e2c0'],
  ['PARKSIGN', '水瀬中央公園', '#1d6b3a', '#ffffff', 'PARK', '#ffffff'],
];
SIGNS.forEach((s, i) => L['SG_' + s[0]] = names.length + i);
// ナンバープレートのアトラス（1レイヤーに2列×4行＝8枚）と、街の生成後に描く動的レイヤー（案内標識・橋名板など）
export const PLATES = { k580: 4, k480: 1, w500: 4, w300: 2, w400: 1, w100: 1, g500: 1 };
const EXTRA = [];
for (const [cls, n] of Object.entries(PLATES)) for (let k = 0; k < n; k++) EXTRA.push(['PL', cls, k]);
EXTRA.push(['PLME']);
export const DYN_N = 96;
for (let k = 0; k < DYN_N; k++) EXTRA.push(['DYN', k]);
const EX0 = names.length + SIGNS.length;
EXTRA.forEach((e, i) => { if (e[0] === 'PL') L['PL_' + e[1] + '_' + e[2]] = EX0 + i; else if (e[0] === 'PLME') L.PLATE_ME = EX0 + i; else L['DYN' + e[1]] = EX0 + i; });
export const LAYER_COUNT = EX0 + EXTRA.length;
// ナンバー（分類, 番号i）→ [u0, v0, layer]
export function plateUV(cls, i) { const t = i % 8; return [(t % 2) * 0.5, (t >> 1) * 0.25, L['PL_' + cls + '_' + ((i / 8) | 0) % PLATES[cls]]]; }
const HIRA_PRIV = 'さすせそたちつてとなにぬねのはひふほまみむめもやゆよらるろ', HIRA_BIZ = 'あいうえかきくけこを';
function plateText(cls, i) {
  let h = (i * 2654435761 + cls.length * 97 + cls.charCodeAt(1) * 31) >>> 0;
  const n = 1 + (h % 9999); h = (h * 1103515245 + 12345) >>> 0;
  const kana = cls === 'g500' ? HIRA_BIZ[h % HIRA_BIZ.length] : HIRA_PRIV[h % HIRA_PRIV.length];
  const num = n >= 1000 ? String(n).slice(0, 2) + '-' + String(n).slice(2) : String(n).padStart(4, '・').replace(/^(・*)(\d)/, '$1$2');
  return { top: '水瀬 ' + cls.slice(1), kana, num };
}
// 実物の様式：上段に地名と分類番号、左下にひらがな、右に大きな一連番号
function drawPlate(ctx, x, y, w, h, cls, t) {
  const kei = cls[0] === 'k', biz = cls === 'g500';
  ctx.fillStyle = biz ? '#1d6a3a' : kei ? '#f3d23a' : '#f2f2ee'; ctx.fillRect(x, y, w, h);
  const ink = biz ? '#ffffff' : kei ? '#1a1a1a' : '#0f5a2c';
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, w / 60); ctx.strokeRect(x + w * 0.03, y + h * 0.06, w * 0.94, h * 0.88);
  ctx.fillStyle = ink; ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.26}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(t.top, x + w * 0.52, y + h * 0.27);
  ctx.font = `700 ${h * 0.28}px ${FONT}`; ctx.fillText(t.kana, x + w * 0.12, y + h * 0.68);
  ctx.font = `700 ${h * 0.5}px ${FONT}`; ctx.save(); ctx.translate(x + w * 0.58, y + h * 0.68); ctx.scale(0.92, 1); ctx.fillText(t.num, 0, 0); ctx.restore();
}
function drawExtra(e, ctx) {
  ctx.clearRect(0, 0, TS, TS);
  if (e[0] === 'PL') { for (let t = 0; t < 8; t++) drawPlate(ctx, (t % 2) * 128, (t >> 1) * 64, 128, 64, e[1], plateText(e[1], e[2] * 8 + t)); }
  else if (e[0] === 'PLME') { ctx.save(); ctx.scale(1, 2); drawPlate(ctx, 0, 0, 256, 128, 'k580', { top: '水瀬 580', kana: 'さ', num: '39-27' }); ctx.restore(); }
  else { ctx.fillStyle = '#888'; ctx.fillRect(0, 0, TS, TS); }
  const im = ctx.getImageData(0, 0, TS, TS); for (let k = 3; k < im.data.length; k += 4) im.data[k] = 255;
  return im.data;
}
// 動的レイヤー用：Canvasに描いてRGBAを返す（draw(ctx)は256x256に描く）
export function renderLayer(draw, opaque = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, TS, TS); draw(ctx, TS);
  const im = ctx.getImageData(0, 0, TS, TS); if (opaque) for (let k = 3; k < im.data.length; k += 4) im.data[k] = 255;
  return im.data;
}

function px(img, x0, y0, w, h, r, g, b, a = 255) {
  const d = img.data;
  for (let y = Math.max(0, y0); y < Math.min(TS, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(TS, x0 + w); x++) {
    const i = (y * TS + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
  }
}
function noise(img, amt, R) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
}
// 窓グリッド：cols x rows 区画、各区画に窓
function windows(img, cols, rows, R, f) {
  const cw = TS / cols, ch = TS / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) f(Math.round(c * cw), Math.round(r * ch), Math.round(cw), Math.round(ch), R(), R);
}

function drawLayer(i, ctx) {
  const R = rng(1000 + i * 77);
  const img = ctx.createImageData(TS, TS);
  const n = names[i];
  const fill = (r, g, b, a = 0) => px(img, 0, 0, TS, TS, r, g, b, a);
  switch (n) {
    case 'WHITE': fill(255, 255, 255, 0); break;
    case 'OFFICE': // 4x4区画。白い壁に横長窓
      fill(236, 236, 232, 0);
      windows(img, 4, 4, R, (x, y, w, h, lit) => {
        px(img, x + 4, y + 10, w - 8, h - 22, 70, 92, 112, 128 + lit * 127 | 0);
        px(img, x + 4, y + 10 + (h - 22) / 2 | 0, w - 8, 2, 190, 196, 200, 128 + lit * 127 | 0);
        px(img, x, y + h - 6, w, 3, 200, 200, 196, 0);
      }); noise(img, 8, R); break;
    case 'OFFICE2': // 連続窓
      fill(205, 208, 212, 0);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
        const lit = R(); px(img, c * 32 + 1, r * 64 + 12, 30, 40, 55, 78, 98, 128 + lit * 127 | 0);
      }
      for (let r = 0; r < 4; r++) px(img, 0, r * 64 + 52, TS, 12, 225, 226, 228, 0); noise(img, 6, R); break;
    case 'APT': // アパート：ベランダ＋掃き出し窓
      fill(235, 230, 220, 0);
      windows(img, 4, 4, R, (x, y, w, h, lit) => {
        px(img, x + 6, y + 6, w - 12, h - 18, 120, 140, 150, 1 + lit * 126 | 0);
        px(img, x + 6, y + 6, 4, h - 18, 210, 210, 205, 0);
        px(img, x + 2, y + h - 26, w - 4, 18, 200, 200, 196, 0);
        for (let k = 0; k < w - 4; k += 6) px(img, x + 2 + k, y + h - 26, 2, 18, 150, 150, 150, 0);
        px(img, x, y + h - 8, w, 8, 180, 178, 172, 0);
      }); noise(img, 8, R); break;
    case 'MANSION':
      fill(222, 214, 200, 0);
      windows(img, 4, 4, R, (x, y, w, h, lit) => {
        px(img, x + 4, y + 4, w - 8, h - 14, 96, 112, 126, 1 + lit * 126 | 0);
        px(img, x + 2, y + h - 30, w - 4, 22, 238, 236, 230, 0);
        px(img, x + 2, y + h - 30, w - 4, 3, 160, 150, 140, 0);
        px(img, x, y + h - 8, w, 8, 196, 188, 175, 0);
      }); noise(img, 6, R); break;
    case 'HOTEL':
      fill(210, 200, 190, 0);
      windows(img, 8, 4, R, (x, y, w, h, lit) => {
        px(img, x + 6, y + 14, w - 12, h - 30, 60, 72, 88, 1 + lit * 126 | 0);
      }); noise(img, 6, R); break;
    case 'HOUSE': // 2窓 x 2階
      fill(240, 240, 240, 0);
      windows(img, 2, 2, R, (x, y, w, h, lit) => {
        px(img, x + 30, y + 30, w - 60, h - 64, 90, 110, 120, 1 + lit * 126 | 0);
        px(img, x + 30, y + 30 + (h - 64) / 2 | 0, w - 60, 3, 220, 220, 220, 1 + lit * 126 | 0);
        px(img, x + 26, y + h - 36, w - 52, 5, 160, 160, 160, 0);
        px(img, x + 64, y + 30, 3, h - 64, 220, 220, 220, 1 + lit * 126 | 0);
      }); noise(img, 10, R); break;
    case 'SHOP': // 店舗ガラス面
      fill(60, 60, 60, 0);
      px(img, 0, 30, TS, 200, 200, 210, 215, 255);
      for (let k = 0; k < 4; k++) px(img, k * 64, 30, 5, 200, 90, 90, 90, 0);
      px(img, 0, 120, TS, 4, 100, 100, 100, 200);
      px(img, 0, 0, TS, 30, 230, 230, 230, 0);
      // 店内：棚の段と、控えめなポスター2枚（色の四角を散らさない）
      for (let y = 150; y < 225; y += 18) px(img, 8, y, TS - 16, 3, 150, 150, 155, 240);
      for (let k = 0; k < 4; k++) for (let y = 152; y < 225; y += 18) px(img, k * 64 + 10, y + 4, 44, 10, 180 + (k * 17) % 50, 170, 150 + (k * 29) % 60, 240);
      px(img, 20, 45, 40, 56, 230, 220, 200, 250); px(img, 24, 52, 32, 16, 200, 70, 60, 250);
      px(img, 150, 45, 40, 56, 230, 230, 235, 250); px(img, 154, 52, 32, 16, 50, 110, 170, 250);
      break;
    case 'SHUTTER':
      fill(190, 190, 186, 0);
      for (let y = 40; y < TS; y += 8) px(img, 10, y, TS - 20, 3, 150, 150, 146, 0);
      px(img, 0, 0, TS, 40, 120, 60, 40, 0);
      px(img, 120, 60, 120, 190, 210, 200, 170, 230); break;
    case 'ASPHALT':
      fill(72, 72, 74, 0); noise(img, 22, R);
      for (let k = 0; k < 40; k++) px(img, R() * 250 | 0, R() * 250 | 0, 2 + R() * 6 | 0, 1, 50, 50, 52, 0); break;
    case 'SIDEWALK':
      fill(170, 162, 150, 0);
      for (let y = 0; y < TS; y += 32) for (let x = 0; x < TS; x += 64) {
        const o = (y / 32 % 2) * 32; const c = 150 + R() * 30;
        px(img, x + o + 2, y + 2, 60, 28, c, c - 8, c - 18, 0);
      } noise(img, 10, R); break;
    case 'GRASS': fill(86, 118, 58, 0); noise(img, 30, R); break;
    case 'PADDY':
      fill(98, 140, 62, 0);
      for (let y = 0; y < TS; y += 8) px(img, 0, y, TS, 3, 70, 110, 50, 0);
      noise(img, 16, R); px(img, 0, 0, TS, 6, 140, 125, 90, 0); px(img, 0, 0, 6, TS, 140, 125, 90, 0); break;
    case 'WATER':
      fill(60, 92, 110, 0);
      for (let k = 0; k < 120; k++) px(img, R() * 250 | 0, R() * 250 | 0, 8 + R() * 30 | 0, 2, 110, 140, 155, 0); break;
    case 'ROOF': fill(150, 150, 146, 0); noise(img, 18, R);
      for (let y = 0; y < TS; y += 64) px(img, 0, y, TS, 2, 120, 120, 118, 0); break;
    case 'KAWARA':
      fill(200, 200, 200, 0);
      for (let y = 0; y < TS; y += 16) { px(img, 0, y, TS, 4, 120, 120, 120, 0); for (let x = (y / 16 % 2) * 16; x < TS; x += 32) px(img, x, y, 3, 16, 150, 150, 150, 0); }
      noise(img, 10, R); break;
    case 'METAL':
      fill(205, 208, 210, 0);
      for (let x = 0; x < TS; x += 12) px(img, x, 0, 4, TS, 170, 174, 178, 0); noise(img, 6, R); break;
    case 'FIELD': fill(176, 150, 112, 0); noise(img, 26, R); break;
    case 'TRAINWIN':
      // 修正95：遠くからでも電車と分かる塗装（白い車体・濃い窓の帯・水瀬線グリーンの太帯・オレンジの細帯・ドア）
      fill(236, 238, 240, 0);
      px(img, 0, 46, TS, 74, 28, 34, 44, 255); // 窓の帯（濃いガラス）
      for (let x = 0; x < TS; x += 64) px(img, x, 46, 7, 74, 210, 214, 218, 0); // 窓の柱
      px(img, 0, 128, TS, 40, 24, 140, 96, 0); px(img, 0, 170, TS, 7, 238, 150, 40, 0); // 太帯・細帯
      px(img, 196, 30, 50, 200, 120, 124, 130, 0); px(img, 200, 34, 42, 192, 226, 228, 230, 0); // ドア（枠）
      px(img, 205, 50, 15, 60, 28, 34, 44, 255); px(img, 222, 50, 15, 60, 28, 34, 44, 255); px(img, 220, 34, 2, 192, 120, 124, 130, 0); // ドアの窓と合わせ目
      px(img, 200, 128, 42, 40, 24, 140, 96, 0); break;
    case 'SEAT': fill(48, 48, 52, 0); for (let y = 0; y < TS; y += 20) px(img, 0, y, TS, 3, 30, 30, 32, 0); noise(img, 10, R); break;
    case 'GLOW': {
      const d = img.data;
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const r = Math.hypot(x - 128, y - 128) / 128, v = Math.max(0, 1 - r) ** 2 * 255, k = (y * TS + x) * 4;
        d[k] = v; d[k + 1] = v; d[k + 2] = v; d[k + 3] = 255;
      } break;
    }
    case 'RAIL': fill(110, 100, 90, 0); for (let y = 0; y < TS; y += 32) px(img, 0, y, TS, 10, 80, 70, 60, 0); px(img, 60, 0, 14, TS, 160, 160, 165, 0); px(img, 182, 0, 14, TS, 160, 160, 165, 0); noise(img, 12, R); break;
    case 'ROCK': fill(120, 116, 108, 0); for (let k = 0; k < 300; k++) { const c = 90 + R() * 70; px(img, R() * 250 | 0, R() * 250 | 0, 6 + R() * 20 | 0, 3 + R() * 10 | 0, c, c - 3, c - 8, 0); } break;
    case 'TUNNELWALL': fill(170, 168, 160, 0); for (let y = 0; y < TS; y += 32) px(img, 0, y, TS, 2, 120, 118, 112, 0); for (let x = 0; x < TS; x += 64) px(img, x, 0, 2, TS, 120, 118, 112, 0); noise(img, 14, R); break;
    case 'FOREST': fill(52, 82, 44, 0); for (let k = 0; k < 900; k++) { const c = 30 + R() * 50; px(img, R() * 252 | 0, R() * 252 | 0, 3 + R() * 6 | 0, 3 + R() * 6 | 0, c * 0.7, c + 25, c * 0.5, 0); } break;
    case 'MANHOLE': { fill(0, 0, 0, 0); const d = img.data; for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const r = Math.hypot(x - 128, y - 128), k = (y * TS + x) * 4; if (r < 120) { const g = (r > 108 ? 70 : ((x + y) % 24 < 3 || (x - y + 512) % 24 < 3) ? 55 : 92); d[k] = g; d[k + 1] = g; d[k + 2] = g + 4; d[k + 3] = 255; } } break; }
    case 'GRATE': fill(60, 62, 64, 0); for (let x = 0; x < TS; x += 16) px(img, x, 20, 8, 216, 25, 25, 27, 0); break;
    case 'HOUSE_DARK': // 空き家：窓は暗いまま、雨だれ汚れ
      fill(200, 196, 186, 0);
      windows(img, 2, 2, R, (x, y, w, h) => { px(img, x + 30, y + 30, w - 60, h - 64, 50, 55, 58, 0); px(img, x + 30, y + h - 34, w - 60, 30, 170, 165, 152, 0); });
      for (let k = 0; k < 30; k++) px(img, R() * 250 | 0, 0, 2, 60 + R() * 120 | 0, 160, 155, 145, 0); noise(img, 16, R); break;
    case 'CLOUD': { const d = img.data; for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { let a = 0; for (let k = 0; k < 5; k++) { const cx = 60 + k * 34 + Math.sin(k * 7) * 10, cy = 128 + Math.cos(k * 5) * 18, r = 46 - Math.abs(k - 2) * 7; a = Math.max(a, Math.max(0, 1 - Math.hypot(x - cx, y - cy) / r)); } const i = (y * TS + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255 * (0.85 + a * 0.15); d[i + 3] = Math.min(255, a * 400); } break; }
    case 'LAUNDRY': fill(0, 0, 0, 0); for (let k = 0; k < 6; k++) { const c = [[240, 240, 240], [150, 180, 220], [230, 200, 200], [240, 240, 210]][k % 4]; px(img, 10 + k * 40, 40, 30, 120 + (k % 3) * 30, c[0], c[1], c[2], 255); } px(img, 0, 36, TS, 4, 80, 80, 80, 255); break;
    case 'BIKE_RACK': fill(0, 0, 0, 0); break;
    case 'WATERPAD': fill(150, 170, 180, 0); for (let k = 0; k < 60; k++) px(img, R() * 250 | 0, R() * 250 | 0, 20 + R() * 40 | 0, 2, 190, 205, 215, 0); for (let y = 6; y < TS; y += 22) for (let x = 6; x < TS; x += 22) px(img, x, y, 3, 5, 90, 130, 60, 0); break;
    case 'CROP': fill(110, 84, 56, 0); for (let y = 0; y < TS; y += 32) px(img, 0, y + 6, TS, 18, 70, 120, 50, 0); noise(img, 18, R); break;
    case 'TEAROW': fill(96, 74, 50, 0); for (let y = 0; y < TS; y += 42) px(img, 0, y + 4, TS, 32, 52, 96, 42, 0); noise(img, 14, R); break;
    case 'TACTILE': fill(222, 190, 40, 0); for (let y = 6; y < TS; y += 24) for (let x = 6; x < TS; x += 24) px(img, x, y, 10, 10, 245, 215, 60, 0); break;
    case 'TREE': fill(70, 110, 50, 0); for (let k = 0; k < 400; k++) { const c = 40 + R() * 60; px(img, R() * 250 | 0, R() * 250 | 0, 4 + R() * 10 | 0, 4 + R() * 8 | 0, c * 0.6, c + 30, c * 0.4, 0); } break;
    default: fill(255, 255, 255, 0);
  }
  const TEXT = ['PLATE_K', 'PLATE_W', 'STOP', 'SP30', 'SP40', 'SP50', 'SP60', 'GUIDE', 'METER', 'PANEL', 'PARK_P', 'ONEWAY', 'NOENTRY', 'CURVE', 'BACK_RND', 'BACK_TRI', 'BACK_DIA', 'TOMARE', 'JOKO', 'SCHOOLZ', 'BUSSTOP', 'TOBIDASHI', 'NOBORI', 'CROSSW', 'POSTER'];
  if (i < names.length && !TEXT.includes(n)) return img.data; // ピクセル系はCanvasを経由しない（α=0でRGBが失われるため）
  ctx.putImageData(img, 0, 0);
  // 文字・図形系
  const T = (txt, x, y, size, col, w = 700) => { ctx.fillStyle = col; ctx.font = `${w} ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); };
  if (n === 'PLATE_K' || n === 'PLATE_W') { // ナンバープレート（架空地名）横長 2:1
    ctx.fillStyle = n === 'PLATE_K' ? '#f3d23a' : '#f2f2ee'; ctx.fillRect(0, 0, TS, TS);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, TS - 12, TS - 12);
    const c = n === 'PLATE_K' ? '#1a1a1a' : '#0f5a2c';
    ctx.save(); ctx.scale(1, 2); T('水瀬 580', 128, 22, 40, c); T('12-34', 140, 80, 80, c); T(n === 'PLATE_K' ? 'あ' : 'さ', 30, 82, 40, c); ctx.restore();
  } else if (n === 'STOP') {
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, TS, TS);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(248, 20); ctx.lineTo(128, 236); ctx.fill();
    ctx.fillStyle = '#d71f26'; ctx.beginPath(); ctx.moveTo(26, 30); ctx.lineTo(230, 30); ctx.lineTo(128, 214); ctx.fill();
    T('止まれ', 128, 82, 54, '#fff');
  } else if (n && n.startsWith('SP')) {
    ctx.clearRect(0, 0, TS, TS);
    ctx.fillStyle = '#d71f26'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128, 128, 96, 0, 7); ctx.fill();
    T(n.slice(2), 128, 136, 120, '#1d3a8a');
  } else if (n === 'GUIDE') {
    ctx.fillStyle = '#1b4fa0'; ctx.fillRect(0, 0, TS, TS); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, TS - 16, TS - 16);
    ctx.save(); ctx.scale(1, 2);
    T('↑ 水瀬駅', 128, 22, 34, '#fff'); T('← 市役所   郊外 →', 128, 62, 28, '#fff'); T('Minase Sta.', 128, 42, 18, '#fff', 400); ctx.restore();
  } else if (n === 'METER') {
    ctx.fillStyle = '#0c0d10'; ctx.fillRect(0, 0, TS, TS);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(128, 140, 100, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    for (let k = 0; k <= 14; k++) {
      const a = Math.PI * 0.75 + k / 14 * Math.PI * 1.5;
      ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 100, 140 + Math.sin(a) * 100); ctx.lineTo(128 + Math.cos(a) * (k % 2 ? 90 : 82), 140 + Math.sin(a) * (k % 2 ? 90 : 82)); ctx.stroke();
      if (k % 2 === 0) T(String(k * 10), 128 + Math.cos(a) * 64, 140 + Math.sin(a) * 64, 18, '#eee');
    }
    T('km/h', 128, 190, 16, '#9cf', 400);
  } else if (n === 'PANEL') {
    ctx.fillStyle = '#26272b'; ctx.fillRect(0, 0, TS, TS);
    ctx.fillStyle = '#111'; ctx.fillRect(30, 20, 196, 60); T('FM 80.7', 128, 50, 30, '#5cf');
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#3a3b40'; ctx.beginPath(); ctx.arc(64 + k * 64, 150, 26, 0, 7); ctx.fill(); }
    T('A/C', 128, 210, 22, '#aaa');
  } else if (n === 'ONEWAY') {
    ctx.fillStyle = '#1b4fa0'; ctx.fillRect(0, 40, TS, 176); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.strokeRect(10, 50, TS - 20, 156);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(30, 110); ctx.lineTo(170, 110); ctx.lineTo(170, 80); ctx.lineTo(230, 128); ctx.lineTo(170, 176); ctx.lineTo(170, 146); ctx.lineTo(30, 146); ctx.fill();
    T('一方通行', 110, 194, 30, '#fff');
  } else if (n === 'NOENTRY') {
    ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#d71f26'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(40, 108, 176, 40);
  } else if (n === 'CURVE') {
    ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#f2c500'; ctx.beginPath(); ctx.moveTo(128, 8); ctx.lineTo(248, 128); ctx.lineTo(128, 248); ctx.lineTo(8, 128); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.stroke();
    ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(100, 190); ctx.lineTo(100, 120); ctx.quadraticCurveTo(100, 80, 150, 80); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(150, 55); ctx.lineTo(190, 80); ctx.lineTo(150, 105); ctx.fill();
  } else if (n === 'BACK_RND') { ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill();
  } else if (n === 'BACK_TRI') { ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(248, 20); ctx.lineTo(128, 236); ctx.fill();
  } else if (n === 'BACK_DIA') { ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(128, 8); ctx.lineTo(248, 128); ctx.lineTo(128, 248); ctx.lineTo(8, 128); ctx.fill();
  } else if (n === 'TOMARE' || n === 'JOKO' || n === 'SCHOOLZ') { // 路面標示（縦長に引き伸ばした文字）
    ctx.clearRect(0, 0, TS, TS);
    const txt = n === 'TOMARE' ? ['止', 'ま', 'れ'] : n === 'JOKO' ? ['徐', '行'] : ['スクール', 'ゾーン'];
    ctx.fillStyle = n === 'SCHOOLZ' ? '#ffffff' : '#ffffff';
    txt.forEach((t, k) => { ctx.save(); ctx.translate(128, (k + 0.5) * TS / txt.length); ctx.scale(n === 'SCHOOLZ' ? 1 : 1.25, 0.95); T(t, 0, 0, n === 'SCHOOLZ' ? 56 : 82, '#fff', 800); ctx.restore(); });
  } else if (n === 'BUSSTOP') {
    ctx.clearRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill(); ctx.fillStyle = '#0b7d4e'; ctx.beginPath(); ctx.arc(128, 128, 112, 0, 7); ctx.fill();
    T('水瀬交通', 128, 70, 30, '#fff'); T('バス停', 128, 140, 56, '#fff'); T('のりば', 128, 196, 30, '#ffe066');
  } else if (n === 'TOBIDASHI') { // 子どもの飛び出し注意（平看板・架空の図柄）
    ctx.clearRect(0, 0, TS, TS);
    ctx.fillStyle = '#ffd200'; ctx.beginPath(); ctx.arc(128, 46, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(98, 20, 60, 18);
    ctx.fillStyle = '#e8412c'; ctx.beginPath(); ctx.moveTo(90, 84); ctx.lineTo(166, 84); ctx.lineTo(180, 170); ctx.lineTo(76, 170); ctx.fill();
    ctx.fillStyle = '#1b4fa0'; ctx.fillRect(84, 170, 34, 70); ctx.save(); ctx.translate(150, 170); ctx.rotate(-0.4); ctx.fillRect(0, 0, 32, 74); ctx.restore();
    ctx.fillStyle = '#e8412c'; ctx.save(); ctx.translate(166, 96); ctx.rotate(-0.9); ctx.fillRect(0, 0, 70, 22); ctx.restore();
    T('とびだし', 128, 128, 26, '#fff');
  } else if (n === 'NOBORI') {
    ctx.fillStyle = '#d7141a'; ctx.fillRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.fillRect(10, 10, TS - 20, TS - 20); ctx.fillStyle = '#d7141a'; ctx.fillRect(18, 18, TS - 36, TS - 36);
    ctx.save(); ctx.scale(0.25, 1); for (const [k, t] of ['大', '売', '出', 'し'].entries()) T(t, 512, 40 + k * 56, 200, '#fff', 900); ctx.restore();
  } else if (n === 'CROSSW') {
    ctx.fillStyle = '#1b4fa0'; ctx.fillRect(0, 0, TS, TS); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(128, 18); ctx.lineTo(238, 230); ctx.lineTo(18, 230); ctx.fill();
    ctx.fillStyle = '#1b4fa0'; for (let k = 0; k < 4; k++) ctx.fillRect(60 + k * 36, 190, 18, 34);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(128, 82, 14, 0, 7); ctx.fill(); ctx.fillRect(120, 96, 16, 50); ctx.fillRect(110, 140, 12, 44); ctx.fillRect(136, 140, 12, 44);
  } else if (n === 'POSTER') { // 掲示板（架空の地域行事ポスター）
    ctx.fillStyle = '#3c5a3a'; ctx.fillRect(0, 0, TS, TS);
    const cols = ['#f6d36b', '#f2a3a3', '#a6d0f2', '#fff', '#c9e6a6', '#f6c38b'];
    for (let k = 0; k < 6; k++) { const x = 14 + (k % 3) * 80, y = 18 + (k / 3 | 0) * 118; ctx.fillStyle = cols[k]; ctx.fillRect(x, y, 70, 104); ctx.fillStyle = '#333'; ctx.fillRect(x + 8, y + 10, 54, 8); ctx.fillRect(x + 8, y + 26, 40, 5); ctx.fillRect(x + 8, y + 36, 46, 5); }
    
  } else if (n === 'PARK_P') {
    ctx.fillStyle = '#1b4fa0'; ctx.fillRect(0, 0, TS, TS); T('P', 128, 132, 210, '#fff');
  } else if (i >= names.length) {
    const s = SIGNS[i - names.length];
    const a = 4; // 表示アスペクト 4:1
    ctx.fillStyle = s[2]; ctx.fillRect(0, 0, TS, TS);
    ctx.fillStyle = s[5]; ctx.fillRect(0, TS - 18, TS, 18);
    ctx.save(); ctx.scale(1, a);
    // 修正97-1：店名は左の小さな英字ラベルと重ならない幅に収める（ラベルあり：x=62〜246、なし：x=14〜242）
    ctx.font = `700 40px ${FONT}`; const w = ctx.measureText(s[1]).width, maxW = s[4] ? 184 : 228;
    const sz = Math.min(40, 40 * maxW / Math.max(1, w));
    T(s[1], s[4] ? 154 : 128, 28, sz, s[3]);
    if (s[4]) { ctx.font = `700 22px ${FONT}`; const lw = ctx.measureText(s[4]).width; T(s[4], 30, 30, Math.min(22, 22 * 52 / Math.max(1, lw)), s[5]); }
    ctx.restore();
    const im = ctx.getImageData(0, 0, TS, TS); for (let k = 3; k < im.data.length; k += 4) im.data[k] = 255;
    return im.data;
  }
  return ctx.getImageData(0, 0, TS, TS).data;
}

// 全レイヤーを1つのUint8Arrayにまとめる
export function buildLayers() {
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const out = new Uint8Array(TS * TS * 4 * LAYER_COUNT);
  for (let i = 0; i < LAYER_COUNT; i++) {
    ctx.clearRect(0, 0, TS, TS);
    out.set(i >= EX0 ? drawExtra(EXTRA[i - EX0], ctx) : drawLayer(i, ctx), i * TS * TS * 4);
  }
  return out;
}
