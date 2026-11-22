// AZZURA HEIST — side content: 20 collectibles (golden ledger coins).
// Each coin is a small spinning gold octahedron in the world (built by
// sidecontent.js). Walk or drive within 2 m to collect it: +S 50,
// +25 XP, +1 standing in the coin's district. Positions are named
// anchors with small offsets so every coin sits on walkable ground —
// a sidewalk, a plaza or a forecourt — never inside a tower or a wall.
export const COLLECTIBLES = [
  // GAME fix (3c.3, 22 Nov ~16:05 + ~16:10): C1 was at the plaza centre
  // (-5.9,-5.9) — the middle of the fountain (collider
  // [-8,-8..-4.5,-4.5]) — and the fountain is sealed on all four
  // sides by the parked cars + kiosk with 0.35-0.55 m gaps, less
  // than the 1.0 m player diameter: the closest a player can ever
  // stand is 2.69 m from the coin (NE corner, (-4,-4)), but the
  // pickup needs < 2.0 m — no player could ever collect it (probes
  // /tmp/walk-debug4.mjs + /tmp/colliders-c1c12b.txt; the plaza is
  // only 7.7 m wide, so no parked car can move 1 m without leaving
  // the block). Moved to the plaza's open SE corner (-2.9,-9.6) —
  // still skyline_plaza, still cbd, on walkable paving just south
  // of the SE planter. (First try was the NE corner (-2.9,-2.9):
  // 1.66 m from the player spawn (-2,-1.5), so a fresh player
  // collected it without moving — money 1550 at boot. The SE
  // corner is 7.5 m from spawn.)
  { id: 'C1', anchor: 'skyline_plaza', dx: 3, dz: -3.7, district: 'cbd' },
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
  // GAME fix (3c.3, 22 Nov ~16:00): C12 was at north_door_2 + (1,0) =
  // (-46,-46.5) — 1.5 m INSIDE the old-town house plot
  // [-51,-51..-43,-45], whose nearest reachable point is the south
  // face (player centre z=-44.5), exactly 2.0 m away — and the
  // pickup needs dist < 2.0 m (COLLECT_R), so no player could ever
  // collect it (proved: /tmp/walk-debug6.mjs — C11 picks up at 1.5 m,
  // C12 does not at 2.0 m). Moved 3 m south onto the sidewalk at the
  // foot of the stair-street (-46,-43.5): still old town, still by
  // the north door, now on walkable ground like every other coin.
  { id: 'C12', anchor: 'north_door_2', dx: 1, dz: 3, district: 'old town' },
  { id: 'C13', anchor: 'casino_forecourt', dx: -3, dz: 0, district: 'promenade' },
  { id: 'C14', anchor: 'casino_entrance', dx: 0, dz: 0, district: 'promenade' },
  { id: 'C15', anchor: 'promenade_mid', dx: 2, dz: 0, district: 'promenade' },
  { id: 'C16', anchor: 'harbormaster_pavilion', dx: 0, dz: 0, district: 'marina' },
  { id: 'C17', anchor: 'quay_end', dx: 0, dz: 0, district: 'quay' },
  { id: 'C18', anchor: 'quay_cover_spot', dx: 0, dz: 0, district: 'quay' },
  { id: 'C19', anchor: 'trattoria_front', dx: 0, dz: 0, district: 'boulevard' },
  { id: 'C20', anchor: 'sidewalk_south', dx: 5, dz: 0, district: 'boulevard' },
];
