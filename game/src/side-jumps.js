// AZZURA HEIST — side content: 8 stunt jumps.
// Each jump is a gold ring standing across a road (built by
// sidecontent.js). Drive through it in the Stella at 58 km/h or more
// (16 m/s) to land it. `dir` is the road's direction: 'ew' roads run
// east–west (the ring faces east), 'ns' roads run north–south.
export const SIDE_JUMPS = [
  { id: 'SJ1', name: 'Boulevard Flyer', anchor: 'boulevard_mid', dx: 0, dz: 0, dir: 'ew', district: 'boulevard' },
  { id: 'SJ2', name: 'West Gate', anchor: 'race_start_1', dx: 0, dz: 0, dir: 'ew', district: 'boulevard' },
  { id: 'SJ3', name: 'Corso Launch', anchor: 'skyline_avenue', dx: 0, dz: 0, dir: 'ns', district: 'cbd' },
  { id: 'SJ4', name: 'Promenade Leap', anchor: 'promenade_mid', dx: 0, dz: 0, dir: 'ew', district: 'promenade' },
  { id: 'SJ5', name: 'Quay Hop', anchor: 'quay_end', dx: 0, dz: 0, dir: 'ew', district: 'quay' },
  { id: 'SJ6', name: 'Cobble Jump', anchor: 'oldtown_main_street', dx: 0, dz: 0, dir: 'ew', district: 'old town' },
  { id: 'SJ7', name: 'Marina Air', anchor: 'harbormaster_pavilion', dx: 0, dz: 0, dir: 'ew', district: 'marina' },
  { id: 'SJ8', name: 'Casino Rise', anchor: 'casino_entrance', dx: 0, dz: 0, dir: 'ns', district: 'promenade' },
];
