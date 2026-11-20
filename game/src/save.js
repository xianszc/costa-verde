// AZZURA HEIST — offline save/load (M2: 3 persistent slots).
// Saves live in localStorage, so they survive a reload with no network.
// A slot stores the game's snapshot verbatim (money, health, armour, XP,
// weapon + ammo, the current mission, the player/car position, the clock
// and the radio station). Saving is refused while wanted — that rule is
// enforced by the game (the UI says so instead of silently failing).
const KEY = (slot) => `azzura-heist-save-${slot}`;
export const SAVE_SLOTS = 3;

function fmtHour(hour) {
  const h = Math.floor(hour || 0) % 24;
  const m = Math.floor(((hour || 0) % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function createSaveSystem() {
  function read(slot) {
    try {
      const raw = localStorage.getItem(KEY(slot));
      if (!raw) return null;
      const rec = JSON.parse(raw);
      if (!rec || rec.version !== 2) return null;
      return rec;
    } catch (e) { return null; }
  }
  function labelFor(rec) {
    if (!rec) return 'Empty slot';
    const d = new Date(rec.savedAt || 0);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `S ${(rec.money || 0).toLocaleString('en-US')} · M${(rec.missionId || 0) + 1} · ${fmtHour(rec.hour)} · Day ${rec.day || 1} · ${hh}:${mm}`;
  }
  return {
    listSaves() {
      const out = [];
      for (let i = 0; i < SAVE_SLOTS; i++) {
        const rec = read(i);
        out.push({ label: labelFor(rec), empty: !rec });
      }
      return out;
    },
    saveGame(slot, snapshot) {
      try {
        const rec = { ...snapshot, version: 2, savedAt: Date.now() };
        localStorage.setItem(KEY(slot), JSON.stringify(rec));
        return true;
      } catch (e) { return false; }
    },
    loadGame(slot) {
      return read(slot);
    },
    deleteSave(slot) {
      try { localStorage.removeItem(KEY(slot)); return true; } catch (e) { return false; }
    },
    saveLabel(slot) {
      return labelFor(read(slot));
    },
  };
}
