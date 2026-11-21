// AZZURA HEIST — missions 1–4 (M2: stages, dialogue scenes, rewards).
// The first four story missions from GAME_BIBLE.md chapters 1–2. Every
// target is a real place in District 4 (Lungomare): the harbormaster
// pavilion, the boulevard, the casino, the trattoria, the back-row
// stair-street and the old bell tower. Stages are: goto (reach the
// marker), interact (press E at the marker), tail (stay near the moving
// smuggler marker), escape (reach the marker with no wanted stars).
// Dialogue scenes play in the HUD dialogue box with a procedural
// portrait per speaker. Rewards pay soli + XP and unlock the next mission.
//
// All stage targets are NAMED ANCHORS (anchors.js) — no raw coordinates
// in mission code. The layout rebuild only moves anchors; mission code
// never changes when the city does.
import { ANCHORS, anchor, anchorXZ } from './anchors.js';
export const PORTRAITS = {
  ELIO: { bg: '#f2a35e', skin: '#e8b98a', hair: '#2b2b2b', accent: '#e4572e', item: 'scarf' },
  VI: { bg: '#8a6a4a', skin: '#e8b98a', hair: '#d8d2c4', accent: '#1e2a32', item: 'shawl' },
  LIDIA: { bg: '#1f7a8c', skin: '#e8b98a', hair: '#3a2a1a', accent: '#f2f0ea', item: 'cap' },
  DOM: { bg: '#5a6a48', skin: '#d9a06f', hair: '#8a8a8a', accent: '#c9a86a', item: 'pipe' },
  FELIX: { bg: '#c93a6b', skin: '#e8b98a', hair: '#2b2b2b', accent: '#f2a541', item: 'sunglasses' },
  ALDO: { bg: '#1e2a32', skin: '#d9a06f', hair: '#d8d2c4', accent: '#f2a541', item: 'cane' },
  BIANCA: { bg: '#16324f', skin: '#e8b98a', hair: '#3a2a1a', accent: '#f2f0ea', item: 'cap' },
  IRIS: { bg: '#2e7f8f', skin: '#e8b98a', hair: '#3a2a1a', accent: '#a8cbb0', item: 'headphones' },
  GUS: { bg: '#8a4b2e', skin: '#d9a06f', hair: '#2b2b2b', accent: '#e4572e', item: 'wrench' },
};

export const MISSIONS = [
  {
    id: 0, code: 'M1', chapter: 1, title: 'THE FERRY JOB',
    brief: 'Steal the ferry manifest from the harbormaster\u2019s office, then lose the Guard on the promenade.',
    reward: { money: 400, xp: 300 },
    stages: [
      { name: 'RECON', text: 'Reach the harbormaster pavilion at the east end of the quay.', type: 'goto', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'ELIO', line: 'The ledger\u2019s on the ferry. We go in quiet \u2014 no sirens, no heroes.' }] },
      { name: 'STEAL', text: 'Take the manifest from the office desk. Press E.', type: 'interact', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'VI', line: 'The Guard changes shift at dusk. That\u2019s your window, Elio.' }] },
      { name: 'ESCAPE', text: 'Lose the Guard and reach the middle of the boulevard.', type: 'escape', target: anchor('boulevard_mid', 5),
        dialogue: [{ who: 'ELIO', line: 'Manifest\u2019s mine. Now we vanish into the crowd.' }] },
    ],
  },
  {
    id: 1, code: 'M2', chapter: 1, title: 'SALT IN THE WOUND',
    brief: 'Meet Lidia at the marina, tail the smuggler\u2019s car along the boulevard, then dock back at the quay.',
    reward: { money: 600, xp: 400 },
    stages: [
      { name: 'MEET', text: 'Meet Captain Lidia at the marina pavilion.', type: 'goto', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'LIDIA', line: 'The smuggler runs the boulevard every dusk. Follow him \u2014 don\u2019t spook him.' }] },
      { name: 'TAIL', text: 'Stay within 18 m of the smuggler’s car for 20 seconds.', type: 'tail', target: anchor('smuggler_start', 18), timer: 20,
        dialogue: [{ who: 'ELIO', line: 'Easy does it. He leads us straight to the drop.' }] },
      { name: 'DOCK', text: 'Return to the marina pavilion and report back.', type: 'goto', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'LIDIA', line: 'He docks at the old crane tonight. The Mariners owe you one.' }] },
    ],
  },
  {
    id: 2, code: 'M3', chapter: 2, title: 'ROOFS OF THE OLD TOWN',
    brief: 'Courier run over the back-row rooftops: pick up three parcels at the stair-street and deliver them along the north row.',
    reward: { money: 700, xp: 450 },
    stages: [
      { name: 'CLIMB', text: 'Reach the stair-street at the north end of the district.', type: 'goto', target: anchor('stair_street_north', 4),
        dialogue: [{ who: 'DOM', line: 'The roofs are the fastest road in Azzura, boy. Mind the tiles.' }] },
      { name: 'DELIVER', text: 'Drop parcels at the three north-row doors.', type: 'deliver', target: anchor('north_door_1', 3), count: 3,
        dialogue: [{ who: 'ELIO', line: 'Three doors, three parcels. Nobody saw a thing.' }] },
      { name: 'RETURN', text: 'Return to the casino forecourt.', type: 'goto', target: anchor('casino_forecourt', 5),
        dialogue: [{ who: 'VI', line: 'The old town talks, Elio. Today it says thank you.' }] },
    ],
  },
  {
    id: 3, code: 'M4', chapter: 2, title: 'THE BELL TOWER DROP',
    brief: 'Take the package from Vi at the trattoria, leave it at the old bell tower, and slip away clean.',
    reward: { money: 800, xp: 500 },
    stages: [
      { name: 'MEET', text: 'Meet Vi at the trattoria on the front row.', type: 'goto', target: anchor('trattoria_front', 4),
        dialogue: [{ who: 'VI', line: 'The package goes to the bell tower. No names, no questions.' }] },
      { name: 'DROP', text: 'Leave the package at the foot of the old bell tower.', type: 'interact', target: anchor('bell_tower', 4),
        dialogue: [{ who: 'ELIO', line: 'Package is down. If anyone asks, I was never here.' }] },
      { name: 'ESCAPE', text: 'Slip away with no wanted stars.', type: 'escape', target: anchor('boulevard_mid', 5),
        dialogue: [{ who: 'DOM', line: 'Clean as the morning tide. The tower keeps its secrets.' }] },
    ],
  },
  {
    id: 4, code: 'M5', chapter: 3, title: 'THE FORTRESS LEDGER',
    brief: 'Aldo moved a copy of his ledger to the old town fortress. Take it from the plaza chapel, then slip away to the marina.',
    reward: { money: 900, xp: 550 },
    stages: [
      { name: 'RECON', text: 'Reach the fortress plaza in the old town.', type: 'goto', target: anchor('fortress_plaza', 4),
        dialogue: [{ who: 'VI', line: 'Aldo keeps a copy of his ledger in the old town. The chapel arcade — go quiet, Elio.' }] },
      { name: 'TAKE', text: 'Take the ledger from the chapel arcade. Press E.', type: 'interact', target: anchor('fortress_plaza', 4),
        dialogue: [{ who: 'ELIO', line: 'Ledger\u2019s in the bag. The old town keeps its secrets — and now so do I.' }] },
      { name: 'ESCAPE', text: 'Slip away to the marina pavilion with no wanted stars.', type: 'escape', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'DOM', line: 'The fortress watched you, boy. It approves.' }] },
    ],
  },
  {
    id: 5, code: 'M6', chapter: 3, title: 'CASINO ROYALE AZZURA',
    brief: 'F\u00e9lix has a way into the Casino Azzura. Plant his bug at the entrance, then vanish down the boulevard.',
    reward: { money: 1000, xp: 600 },
    stages: [
      { name: 'MEET', text: 'Meet Félix at the casino forecourt.', type: 'goto', target: anchor('casino_forecourt', 5),
        dialogue: [{ who: 'FELIX', line: 'The casino door is the only door in Azzura that never locks. Walk in like you own it.' }] },
      { name: 'PLANT', text: 'Plant the bug at the casino entrance. Press E.', type: 'interact', target: anchor('casino_entrance', 4),
        dialogue: [{ who: 'ELIO', line: 'Bug\u2019s planted. Aldo\u2019s own neon will light our way in.' }] },
      { name: 'VANISH', text: 'Vanish to the west end of the boulevard with no wanted stars.', type: 'escape', target: anchor('boulevard_west', 5),
        dialogue: [{ who: 'ALDO', line: 'Someone touched my casino tonight. Find them — quietly.' }] },
    ],
  },
  {
    id: 6, code: 'M7', chapter: 4, title: 'THE TOWER SCOUT',
    brief: 'Iris needs the Azzura Tower\u2019s network map before the big job. Scan the lobby from the central plaza, then walk back to the quay.',
    reward: { money: 1100, xp: 650 },
    stages: [
      { name: 'CROSS', text: 'Cross the boulevard to the central plaza.', type: 'goto', target: anchor('skyline_plaza', 5),
        dialogue: [{ who: 'IRIS', line: 'The tower\u2019s lobby is the front door to the vault. Scan it and walk away — don\u2019t linger.' }] },
      { name: 'SCAN', text: 'Scan the Azzura Tower lobby. Press E.', type: 'interact', target: anchor('skyline_plaza', 4),
        dialogue: [{ who: 'ELIO', line: 'Scan\u2019s done. Sixty floors of glass and gold — and one weak lock.' }] },
      { name: 'RETURN', text: 'Walk back to the quay.', type: 'goto', target: anchor('quay_end', 5),
        dialogue: [{ who: 'GUS', line: 'Plaza is clear, Elio. Bring that scan home and I\u2019ll build the way in.' }] },
    ],
  },
  {
    id: 7, code: 'M8', chapter: 4, title: 'STORM WARNING',
    brief: 'Dom\u2019s storm is coming off the sea. Reach the quay, signal the smuggler boat, and bring her home to the marina.',
    reward: { money: 1200, xp: 700 },
    storm: true,
    stages: [
      { name: 'QUAY', text: 'Reach the quay before the storm hits.', type: 'goto', target: anchor('quay_end', 5),
        dialogue: [{ who: 'DOM', line: 'The sea\u2019s turning, boy. When the rain comes, the Guard stays ashore — that\u2019s your window.' }] },
      { name: 'SIGNAL', text: 'Signal the smuggler boat with the lamp. Press E.', type: 'interact', target: anchor('quay_end', 4),
        dialogue: [{ who: 'ELIO', line: 'Lamp\u2019s lit. The boat will find us in the rain.' }] },
      { name: 'HARBOR', text: 'Bring her home to the marina pavilion with no wanted stars.', type: 'escape', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'LIDIA', line: 'Storm\u2019s on us and the harbor\u2019s ours. Bring her home, Elio.' }] },
    ],
  },
  {
    id: 8, code: 'M9', chapter: 5, title: 'THREE-STAR CHASE',
    brief: 'The Guard is on you — three stars and closing. Outrun them to the old town safehouse, lose the heat, and report to Dom.',
    reward: { money: 1500, xp: 800 },
    wantedAtStart: 3,
    failOn: ['busted', 'wasted'],
    stages: [
      { name: 'RUN', text: 'Outrun the Guard to the old town safehouse.', type: 'goto', target: anchor('fortress_plaza', 5),
        dialogue: [{ who: 'VI', line: 'Three stars, Elio — the whole Guard is coming. The old town safehouse, now.' }] },
      { name: 'LAY LOW', text: 'Lose the Guard at the safehouse.', type: 'escape', target: anchor('fortress_plaza', 5),
        dialogue: [{ who: 'ELIO', line: 'They\u2019re circling the plaza. Stay low, stay quiet.' }] },
      { name: 'REPORT', text: 'Report to Dom at the safehouse. Press E.', type: 'interact', target: anchor('fortress_plaza', 4),
        dialogue: [{ who: 'DOM', line: 'You shook three stars, boy. Aldo\u2019s getting nervous — that means we\u2019re close.' }] },
    ],
  },
  {
    id: 9, code: 'M10', chapter: 6, title: 'RIVIERA GRAND PRIX',
    brief: 'F\u00e9lix put your name on the street race. Four checkpoints, one winner — beat the clock or the car is scrap.',
    reward: { money: 2000, xp: 850 },
    timeLimit: 120,
    failOn: ['busted', 'wasted', 'timeout', 'wrecked'],
    stages: [
      { name: 'LINE UP', text: 'Line up at the start on the boulevard.', type: 'goto', target: anchor('race_start_1', 4),
        dialogue: [{ who: 'FELIX', line: 'Four checkpoints, one winner. Don\u2019t scratch the paint — it\u2019s mine on loan.' }] },
      { name: 'RACE', text: 'Race the checkpoints — old town, casino, promenade, finish. Beat the clock.', type: 'race',
        target: anchor('fortress_plaza', 6),
        targets: [anchorXZ('fortress_plaza'), anchorXZ('casino_forecourt'), anchorXZ('promenade_mid'), anchorXZ('boulevard_mid')],
        dialogue: [{ who: 'ELIO', line: 'Flat out. No brakes till the boulevard.' }] },
      { name: 'PODIUM', text: 'Collect the prize from Félix at the finish. Press E.', type: 'interact', target: anchor('boulevard_mid', 4),
        dialogue: [{ who: 'FELIX', line: 'You drive like the sea is on fire. The prize is yours.' }] },
    ],
  },
  {
    id: 10, code: 'M11', chapter: 7, title: 'THE AZZURA TOWER JOB',
    brief: 'The big one: walk into the Azzura Tower, ride the service lift to the penthouse, crack the vault, and slip away before the Guard locks the bay down.',
    reward: { money: 2500, xp: 900 },
    failOn: ['busted', 'wasted'],
    stages: [
      { name: 'LOBBY', text: 'Reach the Azzura Tower lobby.', type: 'goto', target: anchor('tower_lobby', 5),
        dialogue: [{ who: 'IRIS', line: 'The lobby is the front door to the vault. Walk in like you belong there.' }] },
      { name: 'LIFT', text: 'Ride the service lift to the penthouse. Press E.', type: 'interact', target: anchor('tower_lobby', 4),
        dialogue: [{ who: 'GUS', line: 'Lift\u2019s rigged. Up you go — sixty floors, no stopping.' }] },
      { name: 'VAULT', text: 'Crack the penthouse vault. Press E.', type: 'interact', target: anchor('tower_lobby', 4), heat: 35,
        dialogue: [{ who: 'ELIO', line: 'Vault\u2019s open. Sixty floors of gold — and one loud alarm.' }] },
      { name: 'ESCAPE', text: 'Slip away to the quay with no wanted stars.', type: 'escape', target: anchor('quay_end', 5),
        dialogue: [{ who: 'VI', line: 'The tower job is done. Bring it home, Elio.' }] },
    ],
  },
  {
    id: 11, code: 'M12', chapter: 8, title: 'THE LAST LEDGER',
    brief: 'It ends where it started: Aldo, the casino forecourt, and the ledger. Put him down, take what\u2019s yours, and bring the story home to the marina.',
    reward: { money: 5000, xp: 1500 },
    failOn: ['busted', 'wasted'],
    stages: [
      { name: 'CONFRONT', text: 'Face Aldo at the casino forecourt.', type: 'goto', target: anchor('casino_forecourt', 5), heat: 60,
        dialogue: [{ who: 'ALDO', line: 'So the wheelman comes to collect. You built all this on my ledger, boy.' }] },
      { name: 'DUEL', text: 'Put Aldo down. His Guard is closing in.', type: 'duel', target: anchor('casino_forecourt', 6),
        dialogue: [{ who: 'ELIO', line: 'The ledger ends tonight, Aldo.' }] },
      { name: 'AFTERMATH', text: 'Take the ledger from Aldo. Press E.', type: 'interact', target: anchor('casino_forecourt', 4),
        dialogue: [{ who: 'ELIO', line: 'It\u2019s over. The ledger is mine — and so is this town.' }] },
      { name: 'EPILOGUE', text: 'Return to the marina — the story ends where it began.', type: 'goto', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'DOM', line: 'The sea keeps its secrets, boy. And tonight, so do you. Azzura is yours.' }] },
    ],
  },
];

// Mission engine: tracks the current mission + stage, the moving tail
// marker, and the dialogue queue. The game owns the world (positions,
// wanted level, E-key); the engine only decides stage transitions.
// LIST defaults to the story MISSIONS (game.js calls it with no args —
// unchanged behaviour). The side-content systems pass their own list
// (side jobs + races), so one engine runs one activity at a time.
export function createMissionEngine(LIST = MISSIONS) {
  let missionId = 0;
  let stage = 0;
  let done = false;
  let tailTimer = 0;
  let deliverLeft = 0;
  let deliverTargets = [];
  let tailPos = anchorXZ('smuggler_start');
  let dialogueQueue = [];
  let elapsed = 0; // seconds since the current mission started (M10 race clock)
  let raceTimes = {}; // mission id -> best race seconds (persisted via save)
  let raceLast = null; // seconds for the last finished race stage

  function mission() { return LIST[missionId]; }
  function stageDef() { return mission().stages[stage]; }
  function start(id) {
    missionId = Math.max(0, Math.min(LIST.length - 1, id));
    stage = 0;
    done = false;
    tailTimer = 0;
    deliverLeft = 0;
    deliverTargets = [];
    tailPos = anchorXZ('smuggler_start');
    dialogueQueue = [...(stageDef().dialogue || [])];
    elapsed = 0;
    raceLast = null;
    return mission();
  }
  function objective() {
    const s = stageDef();
    if (!s) return null;
    if (s.type === 'tail') return { x: tailPos.x, z: tailPos.z, r: s.target.r, type: 'tail' };
    if ((s.type === 'deliver' || s.type === 'race') && deliverTargets.length) {
      const t = deliverTargets[0];
      return { x: t.x, z: t.z, r: s.target.r, type: s.type, left: deliverLeft };
    }
    return { x: s.target.x, z: s.target.z, r: s.target.r, type: s.type };
  }
  // Called every frame with the player's position + wanted level.
  // Returns an event: {type:'stage'} | {type:'complete', reward} |
  // {type:'checkpoint'} | {type:'fail', reason} | null.
  // carDamage is the player car's damage % (M10: wrecked at 100).
  function update(px, pz, wanted, dt, carDamage = 0) {
    if (done) return null;
    const s = stageDef();
    if (!s) return null;
    elapsed += dt;
    const m = mission();
    // M10 race clock: only enforced while the race stage is live, so a
    // slow walk to the podium after the finish line cannot fail it.
    if (m.timeLimit && s.type === 'race' && elapsed > m.timeLimit) {
      return { type: 'fail', reason: 'timeout', mission: m };
    }
    const d = Math.hypot(px - (s.type === 'tail' ? tailPos.x : s.target.x), pz - (s.type === 'tail' ? tailPos.z : s.target.z));
    if (s.type === 'tail') {
      // The smuggler drives the boulevard loop, east to west.
      tailPos.x -= dt * 6;
      if (tailPos.x < ANCHORS.tail_loop_west.x) tailPos.x = ANCHORS.tail_loop_east.x;
      tailPos.z = ANCHORS.smuggler_start.z;
      if (d < s.target.r) {
        tailTimer += dt;
        if (tailTimer >= (s.timer || 20)) return advance();
      }
      // Out of range the timer HOLDS (it does not decay): a bump that
      // knocks the player's car out of range, or the smuggler pulling
      // away after a touch, must not erase the tail progress. Catch
      // up to resume it. (M2 game fix, 21 Nov 21:31 order.)
      return null;
    }
    if (s.type === 'deliver' || s.type === 'race') {
      // Checkpoint sequence: 'deliver' uses the hardcoded north-row
      // doors; 'race' uses the stage's own targets list.
      if (s.type === 'race' && carDamage >= 100) {
        return { type: 'fail', reason: 'wrecked', mission: m };
      }
      if (!deliverTargets.length) {
        deliverTargets = s.targets ? [...s.targets]
          : [anchorXZ('north_door_1'), anchorXZ('north_door_2'), anchorXZ('north_door_3')];
        deliverLeft = s.count || deliverTargets.length;
      }
      const t = deliverTargets[0];
      if (Math.hypot(px - t.x, pz - t.z) < s.target.r) {
        deliverTargets.shift();
        deliverLeft--;
        if (deliverLeft <= 0) {
          if (s.type === 'race') {
            raceLast = elapsed;
            const best = raceTimes[m.id];
            if (best === undefined || elapsed < best) raceTimes[m.id] = elapsed;
          }
          return advance();
        }
        if (s.type === 'race') {
          const total = (s.targets || []).length;
          return { type: 'checkpoint', done: total - deliverLeft, total, mission: m };
        }
      }
      return null;
    }
    if (s.type === 'escape') {
      if (wanted === 0 && d < s.target.r) return advance();
      return null;
    }
    if (s.type === 'goto') {
      if (d < s.target.r) return advance();
      return null;
    }
    return null; // 'interact' stages advance via interact(); 'duel' via the game
  }
  // The player pressed E at the current objective.
  function interact(px, pz) {
    if (done) return null;
    const s = stageDef();
    if (!s || s.type !== 'interact') return null;
    if (Math.hypot(px - s.target.x, pz - s.target.z) < s.target.r) return advance();
    return null;
  }
  function advance() {
    stage++;
    if (stage >= mission().stages.length) {
      done = true;
      const reward = mission().reward;
      return { type: 'complete', reward, mission: mission(), raceTime: raceLast };
    }
    dialogueQueue = [...(stageDef().dialogue || [])];
    return { type: 'stage', stage, mission: mission() };
  }
  function nextDialogue() {
    return dialogueQueue.length ? dialogueQueue.shift() : null;
  }
  function peekDialogue() { return dialogueQueue[0] || null; }
  return {
    get missionId() { return missionId; },
    get stage() { return stage; },
    get done() { return done; },
    get tailTimer() { return tailTimer; },
    get tailPos() { return tailPos; },
    get elapsed() { return elapsed; },
    get raceBest() { return raceTimes; },
    get raceLast() { return raceLast; },
    setRaceBest(t) { raceTimes = { ...(t || {}) }; },
    mission, stageDef, objective, start, update, interact, advance, nextDialogue, peekDialogue,
  };
}
