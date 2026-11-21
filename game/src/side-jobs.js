// AZZURA HEIST — side content: 9 side jobs.
// Same shape as the story MISSIONS (missions.js) and run through the
// same engine (a second createMissionEngine instance), so goto /
// interact / tail / escape / deliver / race stages, timers and fail
// events behave exactly like the story missions. Every target is a
// NAMED ANCHOR — no raw coordinates. Rewards pay soli + XP and raise
// standing in the job's district (+6).
import { anchor, anchorXZ } from './anchors.js';

export const SIDE_JOBS = [
  {
    id: 'J1', code: 'J1', kind: 'job', title: 'FARE TO THE CASINO',
    brief: 'A high roller needs a ride from the west end to the Casino Azzura — fast, smooth, no sirens.',
    district: 'boulevard', giver: 'FELIX', reward: { money: 300, xp: 200 },
    timeLimit: 90,
    stages: [
      { name: 'PICKUP', text: 'Pick up the fare at the west end of the boulevard.', type: 'goto', target: anchor('boulevard_west', 4),
        dialogue: [{ who: 'FELIX', line: 'A whale from the ferry, Elio. He pays in gold if the ride is smooth.' }] },
      { name: 'DROP', text: 'Drop the fare at the casino forecourt. 90 seconds, door to door.', type: 'goto', target: anchor('casino_forecourt', 5),
        dialogue: [{ who: 'ELIO', line: 'Sit tight. The casino is six minutes away — I\u2019ll do it in two.' }] },
    ],
  },
  {
    id: 'J2', code: 'J2', kind: 'job', title: 'THREE PARCELS, ONE DUSK',
    brief: 'Dom\u2019s courier run: three parcels to the three north-row doors of the old town.',
    district: 'old town', giver: 'DOM', reward: { money: 350, xp: 250 },
    stages: [
      { name: 'PICKUP', text: 'Pick up the parcels at the stair-street.', type: 'interact', target: anchor('stair_street_north', 4),
        dialogue: [{ who: 'DOM', line: 'Three parcels, three doors. Nobody saw a thing, boy.' }] },
      { name: 'DELIVER', text: 'Drop parcels at the three north-row doors.', type: 'deliver', target: anchor('north_door_1', 3), count: 3,
        dialogue: [{ who: 'ELIO', line: 'Three doors, three parcels. The old town talks — today it says thank you.' }] },
      { name: 'RETURN', text: 'Report back at the trattoria.', type: 'goto', target: anchor('trattoria_front', 4),
        dialogue: [{ who: 'VI', line: 'The doors are happy, the parcels are gone. Clean work.' }] },
    ],
  },
  {
    id: 'J3', code: 'J3', kind: 'job', title: 'HARBOUR WATCH',
    brief: 'A thief is working the quay at dusk. Corner him at the water\u2019s edge and march him to the marina.',
    district: 'quay', giver: 'BIANCA', reward: { money: 450, xp: 300 },
    stages: [
      { name: 'CORNER', text: 'Corner the thief at the quay.', type: 'goto', target: anchor('quay_end', 4),
        dialogue: [{ who: 'BIANCA', line: 'He works the quay when the boats come in. Corner him — no guns, no fuss.' }] },
      { name: 'CUFF', text: 'Cuff the thief. Press E.', type: 'interact', target: anchor('quay_end', 4),
        dialogue: [{ who: 'ELIO', line: 'Hands where I can see them. The Guard will take it from here.' }] },
      { name: 'MARCH', text: 'March him to the marina pavilion with no wanted stars.', type: 'escape', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'BIANCA', line: 'Walk him in quiet. The harbor owes you one, Elio.' }] },
    ],
  },
  {
    id: 'J4', code: 'J4', kind: 'job', title: 'THE FERRYMAN\u2019S CRATE',
    brief: 'A sealed crate comes off the ferry. Collect it at the marina and run it to the quay before the tide turns.',
    district: 'marina', giver: 'LIDIA', reward: { money: 400, xp: 250 },
    stages: [
      { name: 'COLLECT', text: 'Collect the crate at the harbormaster pavilion. Press E.', type: 'interact', target: anchor('harbormaster_pavilion', 4),
        dialogue: [{ who: 'LIDIA', line: 'Sealed crate, no questions. The ferry doesn\u2019t wait and neither do I.' }] },
      { name: 'DELIVER', text: 'Run the crate to the quay.', type: 'goto', target: anchor('quay_end', 5),
        dialogue: [{ who: 'ELIO', line: 'Crate\u2019s heavy, the quay\u2019s close. Nobody opens it — not even me.' }] },
      { name: 'HANDOFF', text: 'Hand the crate over at the quay. Press E.', type: 'interact', target: anchor('quay_end', 4),
        dialogue: [{ who: 'LIDIA', line: 'Delivered, sealed, on time. The Mariners remember that.' }] },
    ],
  },
  {
    id: 'J5', code: 'J5', kind: 'job', title: 'THREE KEYS',
    brief: 'Félix needs three cars "borrowed" off the boulevard and brought to the marina. No alarms, no scratches.',
    district: 'boulevard', giver: 'FELIX', reward: { money: 600, xp: 400 },
    stages: [
      { name: 'SCOUT', text: 'Scout the cars parked on the boulevard.', type: 'goto', target: anchor('wheels_spot_player', 4),
        dialogue: [{ who: 'FELIX', line: 'Three cars, three keys, one quiet night. Start with the coral one.' }] },
      { name: 'LIFT', text: 'Lift all three cars — reach each one.', type: 'deliver', target: anchor('wheels_far_pickup', 4), count: 3,
        targets: [anchorXZ('wheels_far_pickup'), anchorXZ('wheels_spot_pickup'), anchorXZ('boulevard_east')],
        dialogue: [{ who: 'ELIO', line: 'One down. Two to go — and nobody saw a thing.' }] },
      { name: 'FENCE', text: 'Bring the keys to the marina pavilion.', type: 'goto', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'FELIX', line: 'Three keys, three cars, zero alarms. You drive like a ghost, Elio.' }] },
    ],
  },
  {
    id: 'J6', code: 'J6', kind: 'job', title: 'SKYLINE CIRCUIT',
    brief: 'A pilot is waiting at the Azzura Tower lobby. Walk the tour route — plaza, casino, quay — and bring the guests home.',
    district: 'cbd', giver: 'IRIS', reward: { money: 450, xp: 300 },
    stages: [
      { name: 'MEET', text: 'Meet the pilot at the Azzura Tower lobby.', type: 'goto', target: anchor('tower_lobby', 4),
        dialogue: [{ who: 'IRIS', line: 'The guests want the whole town in one walk. Plaza, casino, quay — then home.' }] },
      { name: 'TOUR', text: 'Walk the tour: plaza, casino forecourt, quay.', type: 'deliver', target: anchor('skyline_plaza', 4), count: 3,
        targets: [anchorXZ('skyline_plaza'), anchorXZ('casino_forecourt'), anchorXZ('quay_end')],
        dialogue: [{ who: 'ELIO', line: 'And on your left, sixty floors of glass and gold. Smile for the cameras.' }] },
      { name: 'RETURN', text: 'Bring the guests back to the tower lobby.', type: 'goto', target: anchor('tower_lobby', 5),
        dialogue: [{ who: 'IRIS', line: 'Tour\u2019s done, guests are happy, the pilot is impressed. Nice walking.' }] },
    ],
  },
  {
    id: 'J7', code: 'J7', kind: 'job', title: 'POSTCARDS OF AZZURA',
    brief: 'A postcard seller wants the three best views in town: the promenade, the plaza, the old town.',
    district: 'promenade', giver: 'GUS', reward: { money: 350, xp: 250 },
    stages: [
      { name: 'SHOOT', text: 'Frame the three views: promenade, plaza, fortress.', type: 'deliver', target: anchor('promenade_mid', 4), count: 3,
        targets: [anchorXZ('promenade_mid'), anchorXZ('skyline_plaza'), anchorXZ('fortress_plaza')],
        dialogue: [{ who: 'GUS', line: 'Hold still, frame it tight — the postcards sell themselves.' }] },
      { name: 'DELIVER', text: 'Deliver the shots to the marina.', type: 'goto', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'ELIO', line: 'Three views, one town. The postcards will fly off the stand.' }] },
    ],
  },
  {
    id: 'J8', code: 'J8', kind: 'job', title: 'THE QUIET DROP',
    brief: 'Tail the smuggler\u2019s car down the boulevard without spooking him, then report at the marina.',
    district: 'boulevard', giver: 'VI', reward: { money: 500, xp: 350 },
    stages: [
      { name: 'TAIL', text: 'Stay within 18 m of the smuggler\u2019s car for 20 seconds.', type: 'tail', target: anchor('smuggler_start', 18), timer: 20,
        dialogue: [{ who: 'VI', line: 'He runs the boulevard every dusk. Follow him — don\u2019t spook him.' }] },
      { name: 'REPORT', text: 'Report the drop at the marina pavilion.', type: 'goto', target: anchor('harbormaster_pavilion', 5),
        dialogue: [{ who: 'ELIO', line: 'He leads us straight to the drop. The quiet kind of win.' }] },
    ],
  },
  {
    id: 'J9', code: 'J9', kind: 'job', title: 'CASINO COURIER',
    brief: 'A sealed envelope for the tower: pick it up at the casino entrance and run it to the Azzura Tower lobby.',
    district: 'promenade', giver: 'ALDO', reward: { money: 380, xp: 250 },
    stages: [
      { name: 'PICKUP', text: 'Pick up the envelope at the casino entrance. Press E.', type: 'interact', target: anchor('casino_entrance', 4),
        dialogue: [{ who: 'ALDO', line: 'Sealed, boy. The tower waits for no one — not even me.' }] },
      { name: 'RUN', text: 'Run the envelope to the Azzura Tower lobby.', type: 'goto', target: anchor('tower_lobby', 5),
        dialogue: [{ who: 'ELIO', line: 'Envelope\u2019s light, the lobby\u2019s far. Run it like the town is watching.' }] },
    ],
  },
];
