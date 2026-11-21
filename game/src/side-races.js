// AZZURA HEIST — side content: 4 street races.
// Same shape as M10 (missions.js): LINE UP (goto), RACE (race stage
// with checkpoint targets + a time limit + best time persisted),
// PODIUM (interact). Every checkpoint is a NAMED ANCHOR. Best times
// are recorded by the engine and persisted by sidecontent.js.
import { anchor, anchorXZ } from './anchors.js';

export const SIDE_RACES = [
  {
    id: 'R1', code: 'R1', kind: 'race', title: 'BOULEVARD SPRINT',
    brief: 'The classic: boulevard start, old town, casino, promenade, finish on the boulevard. 120 seconds.',
    district: 'boulevard', reward: { money: 800, xp: 400 },
    timeLimit: 120, failOn: ['busted', 'wasted', 'timeout', 'wrecked'],
    stages: [
      { name: 'LINE UP', text: 'Line up at the start on the boulevard.', type: 'goto', target: anchor('race_start_1', 4),
        dialogue: [{ who: 'FELIX', line: 'Four checkpoints, one winner. Don\u2019t scratch the paint.' }] },
      { name: 'RACE', text: 'Race the checkpoints — old town, casino, promenade, finish.', type: 'race',
        target: anchor('fortress_plaza', 6),
        targets: [anchorXZ('fortress_plaza'), anchorXZ('casino_forecourt'), anchorXZ('promenade_mid'), anchorXZ('boulevard_mid')],
        dialogue: [{ who: 'ELIO', line: 'Flat out. No brakes till the boulevard.' }] },
      { name: 'PODIUM', text: 'Collect the prize at the finish. Press E.', type: 'interact', target: anchor('boulevard_mid', 4),
        dialogue: [{ who: 'FELIX', line: 'You drive like the sea is on fire. The prize is yours.' }] },
    ],
  },
  {
    id: 'R2', code: 'R2', kind: 'race', title: 'CBD LOOP',
    brief: 'Through the tower grid: plaza, tower lobby, the CBD street and home. 150 seconds.',
    district: 'cbd', reward: { money: 1000, xp: 450 },
    timeLimit: 150, failOn: ['busted', 'wasted', 'timeout', 'wrecked'],
    stages: [
      { name: 'LINE UP', text: 'Line up at the start on the boulevard.', type: 'goto', target: anchor('race_start_1', 4),
        dialogue: [{ who: 'IRIS', line: 'The grid is a maze at speed. Plaza, lobby, street — then home.' }] },
      { name: 'RACE', text: 'Race the checkpoints — plaza, tower lobby, CBD street, finish.', type: 'race',
        target: anchor('skyline_plaza', 6),
        targets: [anchorXZ('skyline_plaza'), anchorXZ('tower_lobby'), anchorXZ('cbd_street'), anchorXZ('boulevard_mid')],
        dialogue: [{ who: 'ELIO', line: 'Sixty floors above me, four checkpoints ahead. Go.' }] },
      { name: 'PODIUM', text: 'Collect the prize at the finish. Press E.', type: 'interact', target: anchor('boulevard_mid', 4),
        dialogue: [{ who: 'IRIS', line: 'Clean run through the grid. The towers saw everything.' }] },
    ],
  },
  {
    id: 'R3', code: 'R3', kind: 'race', title: 'OLD TOWN RUN',
    brief: 'Cobbles, stairs and the bell tower: the old town at full throttle. 150 seconds.',
    district: 'old town', reward: { money: 900, xp: 450 },
    timeLimit: 150, failOn: ['busted', 'wasted', 'timeout', 'wrecked'],
    stages: [
      { name: 'LINE UP', text: 'Line up at the west end of the old town main street.', type: 'goto', target: anchor('oldtown_main_street', 4),
        dialogue: [{ who: 'DOM', line: 'The old town is narrow, boy. Mind the tiles — and the walls.' }] },
      { name: 'RACE', text: 'Race the checkpoints — plaza, bell tower, stair-street, finish.', type: 'race',
        target: anchor('fortress_plaza', 6),
        targets: [anchorXZ('fortress_plaza'), anchorXZ('bell_tower'), anchorXZ('stair_street_north'), anchorXZ('boulevard_mid')],
        dialogue: [{ who: 'ELIO', line: 'Cobbles under the wheels, bells overhead. Full throttle.' }] },
      { name: 'PODIUM', text: 'Collect the prize at the finish. Press E.', type: 'interact', target: anchor('boulevard_mid', 4),
        dialogue: [{ who: 'DOM', line: 'The old town approves, boy. It always did.' }] },
    ],
  },
  {
    id: 'R4', code: 'R4', kind: 'race', title: 'MARINA DASH',
    brief: 'Along the water: marina, quay, casino, promenade, finish. 120 seconds.',
    district: 'marina', reward: { money: 850, xp: 400 },
    timeLimit: 120, failOn: ['busted', 'wasted', 'timeout', 'wrecked'],
    stages: [
      { name: 'LINE UP', text: 'Line up at the harbormaster pavilion.', type: 'goto', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'LIDIA', line: 'The harbor road is fast and the water is close. Don\u2019t swim.' }] },
      { name: 'RACE', text: 'Race the checkpoints — quay, casino, promenade, finish.', type: 'race',
        target: anchor('quay_end', 6),
        targets: [anchorXZ('quay_end'), anchorXZ('casino_forecourt'), anchorXZ('promenade_mid'), anchorXZ('boulevard_mid')],
        dialogue: [{ who: 'ELIO', line: 'Salt air, open road. The marina flies by.' }] },
      { name: 'PODIUM', text: 'Collect the prize at the finish. Press E.', type: 'interact', target: anchor('boulevard_mid', 4),
        dialogue: [{ who: 'LIDIA', line: 'The harbor saw that one. Fast, clean, dry.' }] },
    ],
  },
];
