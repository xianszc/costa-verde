// AZZURA HEIST — missions 1–4 (M2: stages, dialogue scenes, rewards).
// The first four story missions from GAME_BIBLE.md chapters 1–2. Every
// target is a real place in District 4 (Lungomare): the harbormaster
// pavilion, the boulevard, the casino, the trattoria, the back-row
// stair-street and the old bell tower. Stages are: goto (reach the
// marker), interact (press E at the marker), tail (stay near the moving
// smuggler marker), escape (reach the marker with no wanted stars).
// Dialogue scenes play in the HUD dialogue box with a procedural
// portrait per speaker. Rewards pay soli + XP and unlock the next mission.
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
      { name: 'RECON', text: 'Reach the harbormaster pavilion at the east end of the quay.', type: 'goto', target: { x: 50, z: -19, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'The ledger\u2019s on the ferry. We go in quiet \u2014 no sirens, no heroes.' }] },
      { name: 'STEAL', text: 'Take the manifest from the office desk. Press E.', type: 'interact', target: { x: 50, z: -19, r: 4 },
        dialogue: [{ who: 'VI', line: 'The Guard changes shift at dusk. That\u2019s your window, Elio.' }] },
      { name: 'ESCAPE', text: 'Lose the Guard and reach the middle of the boulevard.', type: 'escape', target: { x: 0, z: 0, r: 5 },
        dialogue: [{ who: 'ELIO', line: 'Manifest\u2019s mine. Now we vanish into the crowd.' }] },
    ],
  },
  {
    id: 1, code: 'M2', chapter: 1, title: 'SALT IN THE WOUND',
    brief: 'Meet Lidia at the marina, tail the smuggler\u2019s car along the boulevard, then dock back at the quay.',
    reward: { money: 600, xp: 400 },
    stages: [
      { name: 'MEET', text: 'Meet Captain Lidia at the marina pavilion.', type: 'goto', target: { x: 50, z: -19, r: 4 },
        dialogue: [{ who: 'LIDIA', line: 'The smuggler runs the boulevard every dusk. Follow him \u2014 don\u2019t spook him.' }] },
      { name: 'TAIL', text: 'Stay within 18 m of the smuggler\u2019s car for 20 seconds.', type: 'tail', target: { x: -20, z: -3.4, r: 18 }, timer: 20,
        dialogue: [{ who: 'ELIO', line: 'Easy does it. He leads us straight to the drop.' }] },
      { name: 'DOCK', text: 'Return to the marina pavilion and report back.', type: 'goto', target: { x: 50, z: -19, r: 4 },
        dialogue: [{ who: 'LIDIA', line: 'He docks at the old crane tonight. The Mariners owe you one.' }] },
    ],
  },
  {
    id: 2, code: 'M3', chapter: 2, title: 'ROOFS OF THE OLD TOWN',
    brief: 'Courier run over the back-row rooftops: pick up three parcels at the stair-street and deliver them along the north row.',
    reward: { money: 700, xp: 450 },
    stages: [
      { name: 'CLIMB', text: 'Reach the stair-street at the north end of the district.', type: 'goto', target: { x: 0, z: -38, r: 4 },
        dialogue: [{ who: 'DOM', line: 'The roofs are the fastest road in Azzura, boy. Mind the tiles.' }] },
      { name: 'DELIVER', text: 'Drop parcels at the three north-row doors.', type: 'deliver', target: { x: -30, z: -35, r: 3 }, count: 3,
        dialogue: [{ who: 'ELIO', line: 'Three doors, three parcels. Nobody saw a thing.' }] },
      { name: 'RETURN', text: 'Return to the casino forecourt.', type: 'goto', target: { x: -10, z: -19, r: 5 },
        dialogue: [{ who: 'VI', line: 'The old town talks, Elio. Today it says thank you.' }] },
    ],
  },
  {
    id: 3, code: 'M4', chapter: 2, title: 'THE BELL TOWER DROP',
    brief: 'Take the package from Vi at the trattoria, leave it at the old bell tower, and slip away clean.',
    reward: { money: 800, xp: 500 },
    stages: [
      { name: 'MEET', text: 'Meet Vi at the trattoria on the front row.', type: 'goto', target: { x: -17, z: -19, r: 4 },
        dialogue: [{ who: 'VI', line: 'The package goes to the bell tower. No names, no questions.' }] },
      { name: 'DROP', text: 'Leave the package at the foot of the old bell tower.', type: 'interact', target: { x: -47, z: -36, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'Package is down. If anyone asks, I was never here.' }] },
      { name: 'ESCAPE', text: 'Slip away with no wanted stars.', type: 'escape', target: { x: 0, z: 0, r: 5 },
        dialogue: [{ who: 'DOM', line: 'Clean as the morning tide. The tower keeps its secrets.' }] },
    ],
  },
  {
    id: 4, code: 'M5', chapter: 3, title: 'THE FORTRESS LEDGER',
    brief: 'Aldo moved a copy of his ledger to the old town fortress. Take it from the plaza chapel, then slip away to the marina.',
    reward: { money: 900, xp: 550 },
    stages: [
      { name: 'RECON', text: 'Reach the fortress plaza in the old town.', type: 'goto', target: { x: -29, z: -70, r: 4 },
        dialogue: [{ who: 'VI', line: 'Aldo keeps a copy of his ledger in the old town. The chapel arcade — go quiet, Elio.' }] },
      { name: 'TAKE', text: 'Take the ledger from the chapel arcade. Press E.', type: 'interact', target: { x: -29, z: -70, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'Ledger\u2019s in the bag. The old town keeps its secrets — and now so do I.' }] },
      { name: 'ESCAPE', text: 'Slip away to the marina pavilion with no wanted stars.', type: 'escape', target: { x: 50, z: -19, r: 5 },
        dialogue: [{ who: 'DOM', line: 'The fortress watched you, boy. It approves.' }] },
    ],
  },
  {
    id: 5, code: 'M6', chapter: 3, title: 'CASINO ROYALE AZZURA',
    brief: 'F\u00e9lix has a way into the Casino Azzura. Plant his bug at the entrance, then vanish down the boulevard.',
    reward: { money: 1000, xp: 600 },
    stages: [
      { name: 'MEET', text: 'Meet F\u00e9lix at the casino forecourt.', type: 'goto', target: { x: 88, z: -10, r: 5 },
        dialogue: [{ who: 'FELIX', line: 'The casino door is the only door in Azzura that never locks. Walk in like you own it.' }] },
      { name: 'PLANT', text: 'Plant the bug at the casino entrance. Press E.', type: 'interact', target: { x: 88, z: -10, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'Bug\u2019s planted. Aldo\u2019s own neon will light our way in.' }] },
      { name: 'VANISH', text: 'Vanish to the west end of the boulevard with no wanted stars.', type: 'escape', target: { x: -50, z: 0, r: 5 },
        dialogue: [{ who: 'ALDO', line: 'Someone touched my casino tonight. Find them — quietly.' }] },
    ],
  },
  {
    id: 6, code: 'M7', chapter: 4, title: 'THE TOWER SCOUT',
    brief: 'Iris needs the Azzura Tower\u2019s network map before the big job. Scan the lobby from the waterfront plaza, then walk back over the bridge.',
    reward: { money: 1100, xp: 650 },
    stages: [
      { name: 'CROSS', text: 'Cross the bridge to the waterfront plaza.', type: 'goto', target: { x: 0, z: 66, r: 5 },
        dialogue: [{ who: 'IRIS', line: 'The tower\u2019s lobby is the front door to the vault. Scan it and walk away — don\u2019t linger.' }] },
      { name: 'SCAN', text: 'Scan the Azzura Tower lobby. Press E.', type: 'interact', target: { x: 0, z: 66, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'Scan\u2019s done. Sixty floors of glass and gold — and one weak lock.' }] },
      { name: 'RETURN', text: 'Walk back over the bridge to the quay.', type: 'goto', target: { x: 0, z: 13, r: 5 },
        dialogue: [{ who: 'GUS', line: 'Bridge is clear, Elio. Bring that scan home and I\u2019ll build the way in.' }] },
    ],
  },
  {
    id: 7, code: 'M8', chapter: 4, title: 'STORM WARNING',
    brief: 'Dom\u2019s storm is coming off the sea. Reach the quay, signal the smuggler boat, and bring her home to the marina.',
    reward: { money: 1200, xp: 700 },
    storm: true,
    stages: [
      { name: 'QUAY', text: 'Reach the quay before the storm hits.', type: 'goto', target: { x: 0, z: 13, r: 5 },
        dialogue: [{ who: 'DOM', line: 'The sea\u2019s turning, boy. When the rain comes, the Guard stays ashore — that\u2019s your window.' }] },
      { name: 'SIGNAL', text: 'Signal the smuggler boat with the lamp. Press E.', type: 'interact', target: { x: 0, z: 13, r: 4 },
        dialogue: [{ who: 'ELIO', line: 'Lamp\u2019s lit. The boat will find us in the rain.' }] },
      { name: 'HARBOR', text: 'Bring her home to the marina pavilion with no wanted stars.', type: 'escape', target: { x: 50, z: -19, r: 5 },
        dialogue: [{ who: 'LIDIA', line: 'Storm\u2019s on us and the harbor\u2019s ours. Bring her home, Elio.' }] },
    ],
  },
];

// Mission engine: tracks the current mission + stage, the moving tail
// marker, and the dialogue queue. The game owns the world (positions,
// wanted level, E-key); the engine only decides stage transitions.
export function createMissionEngine() {
  let missionId = 0;
  let stage = 0;
  let done = false;
  let tailTimer = 0;
  let deliverLeft = 0;
  let deliverTargets = [];
  let tailPos = { x: -20, z: -3.4 };
  let dialogueQueue = [];

  function mission() { return MISSIONS[missionId]; }
  function stageDef() { return mission().stages[stage]; }
  function start(id) {
    missionId = Math.max(0, Math.min(MISSIONS.length - 1, id));
    stage = 0;
    done = false;
    tailTimer = 0;
    deliverLeft = 0;
    deliverTargets = [];
    tailPos = { x: -20, z: -3.4 };
    dialogueQueue = [...(stageDef().dialogue || [])];
    return mission();
  }
  function objective() {
    const s = stageDef();
    if (!s) return null;
    if (s.type === 'tail') return { x: tailPos.x, z: tailPos.z, r: s.target.r, type: 'tail' };
    if (s.type === 'deliver' && deliverTargets.length) {
      const t = deliverTargets[0];
      return { x: t.x, z: t.z, r: s.target.r, type: 'deliver', left: deliverLeft };
    }
    return { x: s.target.x, z: s.target.z, r: s.target.r, type: s.type };
  }
  // Called every frame with the player's position + wanted level.
  // Returns an event: {type:'stage'} | {type:'complete', reward} | null.
  function update(px, pz, wanted, dt) {
    if (done) return null;
    const s = stageDef();
    if (!s) return null;
    const d = Math.hypot(px - (s.type === 'tail' ? tailPos.x : s.target.x), pz - (s.type === 'tail' ? tailPos.z : s.target.z));
    if (s.type === 'tail') {
      // The smuggler drives the boulevard loop, east to west.
      tailPos.x -= dt * 6;
      if (tailPos.x < -56) tailPos.x = 56;
      tailPos.z = -3.4;
      if (d < s.target.r) {
        tailTimer += dt;
        if (tailTimer >= (s.timer || 20)) return advance();
      } else {
        tailTimer = Math.max(0, tailTimer - dt * 0.5);
      }
      return null;
    }
    if (s.type === 'deliver') {
      if (!deliverTargets.length) {
        deliverTargets = [{ x: -30, z: -35 }, { x: 10, z: -35 }, { x: 40, z: -35 }];
        deliverLeft = s.count || 3;
      }
      const t = deliverTargets[0];
      if (Math.hypot(px - t.x, pz - t.z) < s.target.r) {
        deliverTargets.shift();
        deliverLeft--;
        if (deliverLeft <= 0) return advance();
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
    return null; // 'interact' stages advance via interact()
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
      return { type: 'complete', reward, mission: mission() };
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
    mission, stageDef, objective, start, update, interact, advance, nextDialogue, peekDialogue,
  };
}
