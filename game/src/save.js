// AZZURA HEIST — offline save/load (M2: 3 persistent slots).
// Saves live in localStorage, so they survive a reload with no network.
// A slot stores money, health, armour, XP, rank, weapon + ammo, the
// current mission + stage, the player/car position, the clock and the
// radio station. Saving is refused while wanted (the Guard watches the
// docks) — the UI says so instead of silently failing.
const KEY = (slot) => `azzura-heist-save-${slot}`;
export const SAVE_SLOTS = 3;

export function listSaves() {
  const out = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(KEY(i));
      out.push(raw ? JSON.parse(raw) : null);
    } catch (e) { out.push(null); }
  }
  return out;
}

export function saveGame(slot, data) {
  try {
    const rec = {
      version: 2,
      savedAt: Date.now(),
      money: Math.floor(data.money || 0),
      health: Math.round(data.health ?? 100),
      armour: Math.round(data.armour ?? 0),
      xp: Math.floor(data.xp || 0),
      rank: data.rank || 'DRIFTER',
      weapon: data.weapon || 0,
      ammo: data.ammo || [],
      missionId: data.missionId || 0,
      missionStage: data.missionStage || 0,
      x: data.x || 0,
      z: data.z || 0,
      angle: data.angle || 0,
      onFoot: data.onFoot !== false,
      time: data.time ?? 18.7,
      day: data.day || 1,
      radio: data.radio || 0,
    };
    localStorage.setItem(KEY(slot), JSON.stringify(rec));
    return { ok: true, rec };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return { ok: false, error: 'empty slot' };
    const rec = JSON.parse(raw);
    if (!rec || rec.version !== 2) return { ok: false, error: 'bad save' };
    return { ok: true, rec };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

export function deleteSave(slot) {
  try { localStorage.removeItem(KEY(slot)); return true; } catch (e) { return false; }
}

export function saveLabel(rec) {
  if (!rec) return 'Empty slot';
  const d = new Date(rec.savedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `S ${rec.money.toLocaleString('en-US')} · ${rec.rank} · Day ${rec.day} · ${hh}:${mm}`;
}
