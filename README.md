# COSTA VERDE

A 3D third-person open-world crime game in the spirit of GTA 6, built for the
make.fun bounty **gta6-01** ("Make GTA 6", $1,666 USDC).

Costa Verde is a sunny coastal city at golden hour. You are **Leo Marín**, a
driver with one last debt to pay. **Ana Ruiz**, the fixer who owns the Marina,
has a job for you — and a lime-green wedge supercar, the Verde GT, with your
name on it.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: the game is plain static files under `game/`
(Three.js is vendored at `game/vendor/three.module.min.js`).

## Controls

- **W A S D** — move / drive
- **Shift** — sprint (on foot)
- **E** — enter / exit vehicle
- **Space** — handbrake (while driving)
- **Drag mouse** — look around (third-person camera)
- **P** — pause (saves the game)

## Slice 1 (this build)

- Start menu (New Game / Continue / Controls / Settings / Credits)
- Golden-hour coastal city: grid + coastal boulevard, distinct districts
  (Marina Bay, Old Town, Downtown, Palms Row), palms, billboards, storefronts
- Third-person on-foot movement with a human-shaped low-poly character
- One drivable vehicle — the acid-lime Verde GT — with arcade handling,
  enter/exit, plus ambient traffic and pedestrians
- HUD: mission panel, wanted stars, cash, clock, speed, minimap, district name
- First objective: meet Ana at the Marina, then take the GT for a spin
- Save / Continue via localStorage

## Layout

- `game/index.html` — page shell, HUD, menus
- `game/src/config.js` — palette, districts, vehicles, tuning (data-driven)
- `game/src/world.js` — city generation (ground, buildings, palms, sea, sky)
- `game/src/characters.js` — human-shaped low-poly people + walk cycle
- `game/src/vehicles.js` — wedge cars + arcade driving + collision
- `game/src/main.js` — loop, camera, input, HUD, menu, save, objectives
- `main.ts` — entry program (copies `game/` + `screenshots/` to `/output`)
- `REQUIREMENTS.md` — the checklist this build is measured against

Original work only: own city, characters, vehicles, names, story and art.
Nothing from Rockstar Games' Grand Theft Auto series or any other commercial game.
