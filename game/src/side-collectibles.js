// AZZURA HEIST — side content: 20 collectibles (golden ledger coins).
// Each coin is a small spinning gold octahedron in the world (built by
// sidecontent.js). Walk or drive within 2 m to collect it: +S 50,
// +25 XP, +1 standing in the coin's district. Positions are named
// anchors with small offsets so every coin sits on walkable ground —
// a sidewalk, a plaza or a forecourt — never inside a tower or a wall.
export const COLLECTIBLES = [
  { id: 'C1', anchor: 'skyline_plaza', dx: 0, dz: 0, district: 'cbd' },
  { id: 'C2', anchor: 'tower_lobby', dx: 3, dz: 0, district: 'cbd' },
  { id: 'C3', anchor: 'cbd_street', dx: 2, dz: 2, district: 'cbd' },
  { id: 'C4', anchor: 'cbd_center', dx: -5, dz: 5, district: 'cbd' },
  { id: 'C5', anchor: 'boulevard_mid', dx: 8, dz: 0, district: 'boulevard' },
  { id: 'C6', anchor: 'race_start_1', dx: 0, dz: 0, district: 'boulevard' },
  { id: 'C7', anchor: 'boulevard_west', dx: 0, dz: 0, district: 'boulevard' },
  { id: 'C8', anchor: 'boulevard_east', dx: 0, dz: 0, district: 'promenade' },
  { id: 'C9', anchor: 'fortress_plaza', dx: 3, dz: 2, district: 'old town' },
  { id: 'C10', anchor: 'bell_tower', dx: 0, dz: 0, district: 'old town' },
  { id: 'C11', anchor: 'stair_street_north', dx: 0, dz: 0, district: 'old town' },
  { id: 'C12', anchor: 'north_door_2', dx: 1, dz: 0, district: 'old town' },
  { id: 'C13', anchor: 'casino_forecourt', dx: -3, dz: 0, district: 'promenade' },
  { id: 'C14', anchor: 'casino_entrance', dx: 0, dz: 0, district: 'promenade' },
  { id: 'C15', anchor: 'promenade_mid', dx: 2, dz: 0, district: 'promenade' },
  { id: 'C16', anchor: 'harbormaster_pavilion', dx: 0, dz: 0, district: 'marina' },
  { id: 'C17', anchor: 'quay_end', dx: 0, dz: 0, district: 'quay' },
  { id: 'C18', anchor: 'quay_cover_spot', dx: 0, dz: 0, district: 'quay' },
  { id: 'C19', anchor: 'trattoria_front', dx: 0, dz: 0, district: 'boulevard' },
  { id: 'C20', anchor: 'sidewalk_south', dx: 5, dz: 0, district: 'boulevard' },
];
