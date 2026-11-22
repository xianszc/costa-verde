// AZZURA HEIST — side content: 8 stunt jumps.
// Each jump is a gold ring standing across a road (built by
// sidecontent.js). Drive through it in the Stella at 36 km/h or more
// (10) to land it. `dir` is the road's direction: 'ew' roads run
// east–west (the ring faces east), 'ns' roads run north–south.
export const SIDE_JUMPS = [
  { id: 'SJ1', name: 'Boulevard Flyer', anchor: 'boulevard_mid', dx: 0, dz: 0, dir: 'ew', district: 'boulevard' },
  { id: 'SJ2', name: 'West Gate', anchor: 'race_start_1', dx: 0, dz: 0, dir: 'ew', district: 'boulevard' },
  { id: 'SJ3', name: 'Corso Launch', anchor: 'skyline_avenue', dx: 0, dz: 0, dir: 'ns', district: 'cbd' },
  { id: 'SJ4', name: 'Promenade Leap', anchor: 'promenade_mid', dx: 0, dz: 3, dir: 'ew', district: 'promenade' }, // GAME fix (3c.4, 22 Nov ~16:55): the gate at (35,29) stood INSIDE the casino-entrance collider (33.8,28.8)..(36.2,31.2) and the approach was walled by (28.5,27.75)..(31.5,30.25) — no car could ever reach it (probe /tmp/sj4-debug.mjs: car wedged at x=28.0, damage +4.8). Moved 3u south onto the open waterfront plaza (35,32): no colliders on the z=32 approach, car reaches 19 m/s within 5u, 0 damage (probe /tmp/sj4-route.mjs).
  { id: 'SJ5', name: 'Quay Hop', anchor: 'quay_end', dx: 0, dz: 0, dir: 'ew', district: 'quay' },
  { id: 'SJ6', name: 'Cobble Jump', anchor: 'oldtown_main_street', dx: 0, dz: 0, dir: 'ew', district: 'old town' },
  { id: 'SJ7', name: 'Marina Air', anchor: 'harbormaster_pavilion', dx: 0, dz: 0, dir: 'ew', district: 'marina' },
  { id: 'SJ8', name: 'Casino Rise', anchor: 'casino_entrance', dx: 22, dz: 5, dir: 'ew', district: 'promenade' },
];
