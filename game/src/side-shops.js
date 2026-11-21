// AZZURA HEIST — side content: shops (weapons, clothes, car garage).
// Every item is real: ammo lands in the combat system's live reserves,
// armour/health land in game state, outfits recolour Elio's figure,
// paints recolour the Stella's coral body panels, tunes raise the car's
// live maxSpeed / accel / brake. Prices are soli; a district at
// FRIENDLY standing (60+) gives 10% off its shop.
// Rank gates mirror the story ranks (Drifter → King of the Riviera).
// Weapon indices match combat.js WEAPONS: 1 Lupo P9, 2 Doppietta,
// 3 Tamburo, 4 Fucile. Fists need no ammo.
export const SHOP_SECTIONS = [
  {
    id: 'weapons', title: 'Kelo Arms — Weapons & Armour', district: 'old town',
    note: 'Old town, west end of the main street. Ammo, armour and medkits.',
    items: [
      { id: 'ammo-p9', kind: 'ammo', weapon: 1, qty: 24, name: 'Lupo P9 ammo ×24', price: 120, desc: 'Box of 9 mm for the Lupo P9.' },
      { id: 'ammo-doppietta', kind: 'ammo', weapon: 2, qty: 8, name: 'Doppietta shells ×8', price: 150, desc: 'Heavy shells for the double barrel.' },
      { id: 'ammo-tamburo', kind: 'ammo', weapon: 3, qty: 48, name: 'Tamburo ammo ×48', price: 200, desc: 'A full drum of SMG rounds.' },
      { id: 'ammo-fucile', kind: 'ammo', weapon: 4, qty: 10, name: 'Fucile rounds ×10', price: 250, desc: 'Long-range rifle rounds.' },
      { id: 'armour-plate', kind: 'armour', amount: 40, name: 'Armour plate +40', price: 300, desc: 'Bolt-on plate. Armour up to 100.' },
      { id: 'medkit', kind: 'medkit', name: 'Medkit — full health', price: 200, desc: 'Stitches, gauze and a strong coffee. Health to 100.' },
    ],
  },
  {
    id: 'clothes', title: 'Sartoria Azzura — Clothes', district: 'promenade',
    note: 'Promenade walkway, by the casino. Outfits recolour Elio on the spot.',
    items: [
      { id: 'outfit-harbour', kind: 'outfit', outfit: 'harbour', name: 'Harbor Stripes', price: 400, rank: 'DECKHAND', desc: 'Teal top, navy bottom — the Mariners\u2019 cut.' },
      { id: 'outfit-casino', kind: 'outfit', outfit: 'casino', name: 'Casino Sharp', price: 800, rank: 'WHEELMAN', desc: 'Black on black, gold accent. The house always notices.' },
      { id: 'outfit-harvest', kind: 'outfit', outfit: 'harvest', name: 'Harvest Gold', price: 600, rank: 'FIXER', desc: 'Olive and straw — countryside money, city tailoring.' },
      { id: 'outfit-king', kind: 'outfit', outfit: 'king', name: 'King of the Riviera', price: 2500, rank: 'KING OF THE RIVIERA', desc: 'Gold on black. Azzura is yours.' },
    ],
  },
  {
    id: 'garage', title: 'Gus\u2019 Garage — Car Customization', district: 'marina',
    note: 'Marina strip, by the harbormaster pavilion. Paint and tuning for the Stella.',
    items: [
      { id: 'paint-teal', kind: 'paint', paint: 0x2e7f8f, name: 'Harbor Teal paint', price: 900, rank: 'DECKHAND', desc: 'Deep sea teal for the Stella\u2019s body panels.' },
      { id: 'paint-gold', kind: 'paint', paint: 0xe8a33d, name: 'Gold Riviera paint', price: 1500, rank: 'FIXER', desc: 'Gold — loud, rich, unmistakable.' },
      { id: 'paint-magenta', kind: 'paint', paint: 0xc93a6b, name: 'Bright Lights paint', price: 1200, rank: 'CAPO', desc: 'Neon magenta. The Bright Lights approve.' },
      { id: 'tune-engine1', kind: 'tune', tune: 'engine', level: 1, name: 'Engine tune I — +2 top speed', price: 800, rank: 'WHEELMAN', desc: 'Bored-out block. Top speed 26 → 28.' },
      { id: 'tune-engine2', kind: 'tune', tune: 'engine', level: 2, name: 'Engine tune II — +2 top speed', price: 1500, rank: 'FIXER', desc: 'Twin carbs. Top speed 28 → 30.' },
      { id: 'tune-engine3', kind: 'tune', tune: 'engine', level: 3, name: 'Engine tune III — +2 top speed', price: 2500, rank: 'CAPO', desc: 'Full race build. Top speed 30 → 32.' },
      { id: 'tune-brakes1', kind: 'tune', tune: 'brakes', level: 1, name: 'Sport brakes', price: 600, rank: 'DECKHAND', desc: 'Bigger discs. Stops a third shorter.' },
    ],
  },
];

// Outfit colour sets (top / bottom / shoes / accent), applied to Elio's
// figure by recolouring the meshes that carry the stock colours.
export const OUTFITS = {
  street: { name: 'Street Coral', top: 0xf7ebd7, bottom: 0x2e4a5e, shoes: 0x6b4a2a, accent: 0xe4572e },
  harbour: { name: 'Harbor Stripes', top: 0x1f7a8c, bottom: 0x16324f, shoes: 0x16324f, accent: 0xf2f0ea },
  casino: { name: 'Casino Sharp', top: 0x1a1a1a, bottom: 0x1a1a1a, shoes: 0x1a1a1a, accent: 0xe8a33d },
  harvest: { name: 'Harvest Gold', top: 0x7a8b5a, bottom: 0x6b4a2a, shoes: 0x6b4a2a, accent: 0xd9b96a },
  king: { name: 'King of the Riviera', top: 0xf2a541, bottom: 0x1e2a32, shoes: 0x1a1a1a, accent: 0xffd27a },
};

// The Stella's stock body colour (vehicles.js buildStella): the paint
// shop rewrites exactly these vertices in the merged body mesh.
export const STOCK_PAINT = 0xe4572e;
