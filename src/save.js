// セーブ：IndexedDB（DB名 minase-drive / キー slot1）。localStorage にも同じ内容を控えとして保存し、
// どちらも使えない環境ではメモリのみ（その場合は「保存できない」と表示する）
const DB = 'minase-drive', STORE = 'save', KEY = 'slot1';
let mem = null;
function open() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
    } catch (e) { rej(e); }
  });
}
async function tx(mode, fn) {
  const db = await open();
  try {
    return await new Promise((res, rej) => { const t = db.transaction(STORE, mode), st = t.objectStore(STORE), r = fn(st); let out; if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  } finally { db.close(); } // 接続を閉じる（別タブでの更新を妨げない）
}
export async function saveGame(data) {
  mem = data;
  let ls = false;
  try { localStorage.setItem(DB, JSON.stringify(data)); ls = true; } catch (e) { /* 容量不足・プライベートモード */ }
  try { await tx('readwrite', st => st.put(data, KEY)); return 'IndexedDB'; } catch (e) { return ls ? 'localStorage' : 'memory'; }
}
export async function loadGame() {
  let a = null, b = null;
  try { a = await tx('readonly', st => st.get(KEY)); } catch (e) { /* fallthrough */ }
  try { const s = localStorage.getItem(DB); if (s) b = JSON.parse(s); } catch (e) { /* none */ }
  // 新しい方を使う（IndexedDB の書き込みが途中で失敗した場合の保険）
  const v = a && b ? ((b.at || 0) > (a.at || 0) ? b : a) : a || b || mem;
  return v && typeof v === 'object' ? v : null;
}
export async function clearSave() {
  mem = null;
  try { localStorage.removeItem(DB); } catch (e) { /* none */ }
  try { await tx('readwrite', st => st.delete(KEY)); } catch (e) { /* none */ }
}
// ---- 長距離ドライブモード専用のセーブ（市街地散策モードの slot1 とは別のキー。互いに影響しない） ----
const LD_KEY = 'ld1', LD_LS = 'minase-drive-ld', CLEAR_LS = 'minase-drive-ld-clears';
let ldMem = null;
export async function saveLD(data) {
  ldMem = data; let ls = false;
  try { localStorage.setItem(LD_LS, JSON.stringify(data)); ls = true; } catch (e) { /* none */ }
  try { await tx('readwrite', st => st.put(data, LD_KEY)); return 'IndexedDB'; } catch (e) { return ls ? 'localStorage' : 'memory'; }
}
export async function loadLD() {
  let a = null, b = null;
  try { a = await tx('readonly', st => st.get(LD_KEY)); } catch (e) { /* none */ }
  try { const s = localStorage.getItem(LD_LS); if (s) b = JSON.parse(s); } catch (e) { /* none */ }
  const v = a && b ? ((b.at || 0) > (a.at || 0) ? b : a) : a || b || ldMem;
  return v && typeof v === 'object' ? v : null;
}
export async function clearLD() {
  ldMem = null;
  try { localStorage.removeItem(LD_LS); } catch (e) { /* none */ }
  try { await tx('readwrite', st => st.delete(LD_KEY)); } catch (e) { /* none */ }
}
// クリア記録（最新20件）
export function addClear(rec) { try { const a = JSON.parse(localStorage.getItem(CLEAR_LS) || '[]'); a.unshift(rec); localStorage.setItem(CLEAR_LS, JSON.stringify(a.slice(0, 20))); } catch (e) { /* none */ } }
export function getClears() { try { return JSON.parse(localStorage.getItem(CLEAR_LS) || '[]'); } catch (e) { return []; } }
// v0.8.0 長距離ドライブの設定（修正102 BGM の ON/OFF、修正109 セリフ、修正112 ナビの観光案内・ラジオのトーク、修正122 長距離BGMの音量）と
// 修正119 タッチのハンドル操作方式（'wheel' ハンドル／'buttons' ◀▶ ボタン。市街地・長距離の両方に効く）。市街地のセーブとは別のキー。無い項目・型の違う項目は既定値で補う
const LDP_LS = 'minase-drive-ld-prefs', LDP0 = { bgm: true, talk: true, nav: true, radio: true, vol: 0.8, steer: 'wheel' };
export function loadLDPrefs() { let v = null; try { v = JSON.parse(localStorage.getItem(LDP_LS) || 'null'); } catch (e) { /* none */ } const o = { ...LDP0 }; if (v && typeof v === 'object') for (const k in LDP0) if (typeof v[k] === typeof LDP0[k]) o[k] = v[k];
  o.vol = Math.max(0, Math.min(1, +o.vol || 0)); if (o.steer !== 'buttons') o.steer = 'wheel'; return o; }
export function saveLDPrefs(p) { try { const o = {}; for (const k in LDP0) o[k] = typeof LDP0[k] === 'boolean' ? !!p[k] : p[k]; localStorage.setItem(LDP_LS, JSON.stringify(o)); return true; } catch (e) { return false; } }
