# COSTA VERDE

A 3D third-person open-world crime game in the spirit of GTA 6, built for the
make.fun bounty **gta6-01** ("Make GTA 6", $1,666 USDC).

Costa Verde is a sunny coastal city at golden hour. You are **Leo Marín**, a
driver with one last debt to pay. **Ana Ruiz**, the fixer who owns the Marina,
has a job for you — and a lime-green wedge supercar, the Verde GT, with your
name on it. Take it. Then take the city.

## What you do

- **Drive the Verde GT** through four districts — Marina Bay, Old Town,
  Downtown, Palms Row — past the sea, the beach and the palm-lined boulevard.
- **Steal cars.** Taxi cabs, delivery vans and SPD police cruisers are all
  parked around the city, each with its own feel: the taxi is slow and sturdy,
  the van is heavy, the cruiser is fast and sharp. Stealing one raises your
  wanted level.
- **Lose the cops.** Wanted stars (0–5) rise when you steal, hit a pedestrian
  or ram a cruiser. SPD patrol cars chase, ram and try to stop you; at 3 stars
  a helicopter joins with a spotlight. Break line of sight and get away, and
  the heat fades. Get caught on foot and it's **BUSTED** — a fine, then back on
  the street.
- **Fight back.** A pistol (click or F to shoot, R to reload) with a 12-round
  magazine. Four hits disable a cruiser for a while. You have a health bar —
  cop rams and bullets hurt, but you heal once the heat is gone. Go down and
  it's **WASTED** — you wake up at the safehouse.
- **Live in the city.** 18 cars of traffic that yield to you, 32 pedestrians
  who flee when a crime happens nearby, a minimap with police blips, a waypoint
  to your objective, a save that follows you.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| E | Enter / exit car |
| Click / F | Shoot pistol |
| R | Reload |
| Space | Handbrake |
| Mouse drag | Look around |
| P / Esc | Pause |
| M | Mute sound |

## Run it

```sh
node serve.ts        # http://localhost:8080
```

No build step, no network at runtime: static files under `game/`, Three.js
vendored in `game/vendor/`. `main.ts` copies `game/` + `screenshots/` to
`/output` and writes `dossier.json` (the judge's summary).

## Layout

- `game/index.html` — page, HUD, menu, BUSTED / WASTED screens
- `game/src/main.js` — game loop, camera, input, HUD, save, crimes, combat
- `game/src/world.js` — the city: districts, buildings, sea, sky, palms
- `game/src/characters.js` — Leo, Ana, pedestrians
- `game/src/vehicles.js` — cars, vans, cruisers, helicopter, traffic
- `game/src/police.js` — wanted level, pursuit, helicopter, BUSTED logic
- `game/src/combat.js` — pistol hitscan, ammo, reload
- `game/src/audio.js` — procedural WebAudio: sirens, gunshots, stings
- `game/src/config.js` — tuning: vehicles, wanted, police, pistol
- `main.ts` / `serve.ts` — entry program / local dev server

## Originality

COSTA VERDE is an original game. No Rockstar or GTA VI assets, no real brands,
no copied competitor content. All code, art and audio are original work.
