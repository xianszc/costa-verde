// AZZURA HEIST — side content: shared data (districts + rank ladder).
// Districts use the SAME id strings as the anchor `district` field, so
// standing gains from an activity land in the district its anchor says.
export const SIDE_DISTRICTS = [
  { id: 'cbd', name: 'Downtown Bay Skyline', italian: 'Baia Alta' },
  { id: 'boulevard', name: 'Boulevard', italian: 'Lungomare' },
  { id: 'old town', name: 'Fortress Old Town', italian: 'Città Vecchia' },
  { id: 'promenade', name: 'Seaside Promenade', italian: 'Lungomare' },
  { id: 'marina', name: 'Yacht Marina', italian: 'Porto Turistico' },
  { id: 'quay', name: 'Quay', italian: 'Il Molo' },
  { id: 'skyline', name: 'Skyline', italian: 'Baia Alta' },
  // Stage 2 districts: no anchors yet, so no activities land here —
  // standing stays at the starting value and the hub marks them.
  { id: 'cliff villas', name: 'Cliff Villas', italian: 'Ville della Scogliera', coming: true },
  { id: 'lighthouse', name: 'Lighthouse Point', italian: 'Punta del Faro', coming: true },
  { id: 'funicular hills', name: 'Funicular Hills', italian: 'Collina della Funicolare', coming: true },
  { id: 'countryside', name: 'Olive-Grove Countryside', italian: 'Campagna', coming: true },
  { id: 'quarry', name: 'Quarry / Industrial', italian: 'La Cava', coming: true },
];

export const RANK_LADDER = [
  { xp: 0, name: 'DRIFTER' },
  { xp: 500, name: 'DECKHAND' },
  { xp: 1500, name: 'WHEELMAN' },
  { xp: 3000, name: 'FIXER' },
  { xp: 6000, name: 'CAPO' },
  { xp: 10000, name: 'KING OF THE RIVIERA' },
];

export function rankForXp(xp) {
  let r = RANK_LADDER[0].name;
  for (const k of RANK_LADDER) if (xp >= k.xp) r = k.name;
  return r;
}

// Claimed once when the player's XP first reaches the threshold:
// cash + one shop item unlocked free.
export const RANK_REWARDS = [
  { rank: 'DECKHAND', money: 250, unlock: 'outfit:harbour', text: 'Harbor Stripes outfit unlocked — the Mariners know your name now.' },
  { rank: 'WHEELMAN', money: 500, unlock: 'paint:teal', text: 'Harbor Teal paint unlocked — the Stella turns heads on the boulevard.' },
  { rank: 'FIXER', money: 1000, unlocks: ['outfit:casino', 'weapon:3'], text: 'Casino Sharp outfit unlocked — walk into the Azzura like you own it. Tamburo SMG unlocked — 48 rounds in the reserve.' },
  { rank: 'CAPO', money: 2000, unlock: 'paint:magenta', text: 'Bright Lights paint unlocked — neon pink, impossible to miss.' },
  { rank: 'KING OF THE RIVIERA', money: 5000, unlock: 'outfit:king', text: 'King of the Riviera outfit unlocked — gold on black. Azzura is yours.' },
];

export function standingTier(points) {
  if (points >= 85) return 'REVERED';
  if (points >= 60) return 'FRIENDLY';
  if (points >= 30) return 'NEUTRAL';
  return 'WARY';
}
