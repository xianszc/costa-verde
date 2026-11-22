// AZZURA HEIST — the Captain's Logbook (M2: hub with 6 tabs).
// A leather-bound book UI over the game: Logbook (story missions),
// Crew (crews + abilities), Chart (map), Garage (vehicles), Vault
// (bank + money + save slots), Waves (radio). Every tab reads live game
// state through the api the game passes in — live numbers, and anything
// not wired yet (crew abilities, unowned garage vehicles) is marked
// "coming soon" instead of reading as a working system (AUDIT m-14).
// The hub pauses the simulation while open (Tab / H to open,
// Esc / Tab to close).
// AUDIO (22 Nov 23:31): the Waves tab holds the per-bus volume sliders
// + mute (persisted by the engine in localStorage); tab/station/
// save/load clicks play the UI click.
import { getAudioEngine } from './audio.js';
const TABS = ['Logbook', 'Crew', 'Chart', 'Garage', 'Vault', 'Waves'];

const CREWS = [
  { name: 'I Marinai', leader: 'Captain Lidia Costa', color: '#1F7A8C', item: 'Captain\u2019s cap', ability: 'Harbor Master — boats arrive at the nearest dock, free.', unlocked: true },
  { name: 'Il Raccolto', leader: 'Teresa Greco', color: '#7A8B5A', item: 'Straw hat + apron', ability: 'Country Roads — off-road vehicles handle like tarmac.', unlocked: false },
  { name: 'Le Luci', leader: 'F\u00e9lix Moreau', color: '#C93A6B', item: 'Mirrored sunglasses', ability: 'Neon Alibi — wanted drops one star faster near the promenade.', unlocked: false },
];
const GARAGE = [
  { name: 'Stella Roadster', desc: 'Coral hero car. Yours.', owned: true, rank: 'DRIFTER' },
  { name: 'Lumino 50 Scooter', desc: 'Nimble, cheap, loud.', owned: false, rank: 'DECKHAND' },
  { name: 'Mulo Pickup', desc: 'Hauls anything, anywhere.', owned: false, rank: 'WHEELMAN' },
  { name: 'Barca Fishing Boat', desc: 'The harbor is a road too.', owned: false, rank: 'WHEELMAN' },
  { name: 'Sirena Yacht', desc: 'White, fast, impossible to miss.', owned: false, rank: 'FIXER' },
  { name: 'Filobus City Bus', desc: 'Seats forty. Steals attention.', owned: false, rank: 'CAPO' },
  { name: 'Gabbiano H1 Helicopter', desc: 'Rideable from the Torre Eliporto helipad.', owned: false, rank: 'KING OF THE RIVIERA' },
];
const DISTRICTS = [
  ['Cliff Villas', 'Ville della Scogliera'], ['Yacht Marina', 'Porto Turistico'],
  ['Fortress Old Town', 'Citt\u00e0 Vecchia'], ['Seaside Promenade', 'Lungomare'],
  ['Lighthouse Point', 'Punta del Faro'], ['Funicular Hills', 'Collina della Funicolare'],
  ['Olive-Grove Countryside', 'Campagna'], ['Quarry / Industrial', 'La Cava'],
  ['Downtown Bay Skyline', 'Baia Alta'],
];

export function createHub(api) {
  let open = false;
  let tab = 'Logbook';
  const el = document.getElementById('hub-overlay');
  const body = document.getElementById('hub-body');
  const tabsEl = document.getElementById('hub-tabs');

  function tabButton(name) {
    return `<button class="hub-tab${name === tab ? ' sel' : ''}" data-tab="${name}">${name}</button>`;
  }
  function render() {
    if (!el || !body) return;
    tabsEl.innerHTML = TABS.map(tabButton).join('');
    tabsEl.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { getAudioEngine()?.ui('ui_click'); tab = b.dataset.tab; render(); });
    });
    const s = api.getState();
    if (tab === 'Logbook') {
      body.innerHTML = `<h3>Story missions</h3>` + s.missions.map((m) => `
        <div class="hub-row${m.id === s.missionId ? ' active' : ''}">
          <b>${m.code} — ${m.title}</b>
          <span>${m.status}</span>
          <p>${m.brief}</p>
          <p class="hub-sub">Reward: S ${m.reward.money} · ${m.reward.xp} XP</p>
        </div>`).join('') +
        `<p class="hub-note">Current: ${s.missions[s.missionId].code} — stage ${s.missionStage + 1} of ${s.missions[s.missionId].stages}.</p>`;
    } else if (tab === 'Crew') {
      body.innerHTML = `<h3>Crews of Porto Azzura</h3>` + CREWS.map((c) => `
        <div class="hub-row">
          <b style="color:${c.color}">${c.name}</b>
          <span>${c.unlocked ? 'RECRUITED' : 'LOCKED — finish its chapter'}</span>
          <p>Leader: ${c.leader} · ${c.item}</p>
          <p class="hub-sub">${c.ability} <i>(coming soon)</i></p>
        </div>`).join('');
    } else if (tab === 'Chart') {
      body.innerHTML = `<h3>Chart of Porto Azzura</h3>
        <p class="hub-note">One continuous map, roughly 1.2 km across — cliff villas in the north, the harbor in the south, the glass skyline across the bay.</p>` +
        DISTRICTS.map(([a, b], i) => `
        <div class="hub-row${i === 3 ? ' active' : ''}"><b>${i + 1}. ${a}</b><span>${b}</span></div>`).join('');
    } else if (tab === 'Garage') {
      body.innerHTML = `<h3>Garage</h3>` + GARAGE.map((v) => `
        <div class="hub-row${v.owned ? ' active' : ''}">
          <b>${v.name}</b><span>${v.owned ? 'OWNED' : 'Coming soon · unlocks at ' + v.rank}</span>
          <p>${v.desc}</p>
        </div>`).join('');
    } else if (tab === 'Vault') {
      body.innerHTML = `<h3>Vault — Bank of Azzura</h3>
        <p class="hub-big">S ${s.money.toLocaleString('en-US')}</p>
        <p>Rank: <b>${s.rank}</b> · XP ${s.xp.toLocaleString('en-US')} / ${s.xpMax.toLocaleString('en-US')}</p>
        <p class="hub-note">Missions pay S 400–S 3,000. Money buys vehicles, garage upgrades, weapons and bribes.</p>
        <h3>Save slots</h3>
        <div class="hub-saves">${s.saves.map((sv, i) => `
          <div class="hub-save">
            <span>Slot ${i + 1} — ${sv.label}</span>
            <button data-save="${i}">Save</button>
            <button data-load="${i}"${sv.empty ? ' disabled' : ''}>Load</button>
          </div>`).join('')}</div>
        <p class="hub-note" id="hub-save-msg">${s.saveMsg || 'Saving is allowed while the Guard is off your back.'}</p>`;
      body.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => { getAudioEngine()?.ui('ui_click'); api.save(+b.dataset.save); render(); }));
      body.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => { getAudioEngine()?.ui('ui_click'); api.load(+b.dataset.load); }));
    } else { // Waves
      const a = s.audioSettings || { master: 0.7, music: 0.8, sfx: 1, ambience: 0.8, ui: 1, muted: false };
      const busRow = (bus, label) => `<p class="hub-note">${label}: <input type="range" data-bus="${bus}" min="0" max="100" value="${Math.round(a[bus] * 100)}"> <span data-bus-val="${bus}">${Math.round(a[bus] * 100)}%</span></p>`;
      body.innerHTML = `<h3>Waves — Radio</h3>` + s.radioStations.map((r, i) => `
        <div class="hub-row${i === s.radio ? ' active' : ''}">
          <b>${r.name}</b><span>${i === s.radio ? 'NOW PLAYING' : ''}</span>
          <p>${r.track}</p>
          <button data-station="${i}">${i === s.radio ? 'Playing' : 'Tune in'}</button>
        </div>`).join('') +
        `<h3>Audio</h3>` +
        busRow('master', 'Master') + busRow('music', 'Musik') + busRow('sfx', 'Efek') +
        busRow('ambience', 'Suasana') + busRow('ui', 'Antarmuka') +
        `<p><button id="hub-mute">${a.muted ? 'Unmute' : 'Mute'}</button> <span class="hub-note">Volume tersimpan otomatis.</span></p>`;
      body.querySelectorAll('[data-station]').forEach((b) => b.addEventListener('click', () => { getAudioEngine()?.ui('ui_click'); api.setRadio(+b.dataset.station); render(); }));
      body.querySelectorAll('[data-bus]').forEach((sl) => sl.addEventListener('input', () => {
        api.setAudioVolume(sl.dataset.bus, sl.value / 100);
        const v = body.querySelector(`[data-bus-val="${sl.dataset.bus}"]`);
        if (v) v.textContent = sl.value + '%';
      }));
      const muteBtn = document.getElementById('hub-mute');
      if (muteBtn) muteBtn.addEventListener('click', () => { api.setAudioMuted(!a.muted); render(); });
    }
  }
  function setOpen(on, t) {
    open = on;
    if (t) tab = t;
    if (!el) return;
    el.style.display = on ? 'flex' : 'none';
    if (on) render();
  }
  return {
    get open() { return open; },
    setOpen, render,
  };
}
