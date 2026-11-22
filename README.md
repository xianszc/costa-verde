# Azzura Heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xianszc/costa-verde/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xianszc/costa-verde/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Azzura Heist — a cliffside Mediterranean riviera open-world crime game built with Three.js. Nine districts with their own architecture, including the Downtown Bay Skyline (12 towers, 20–60 floors) against eight low-rise riviera districts; three crews, 11 story missions + 4 street races, a day/night cycle and a storm event. Everything procedural: geometry, textures and audio, zero network requests.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

## Missions — 11 story missions

| id | code | ch | Title |
|----|------|----|-------|
| 0 | M1 | 1 | THE FERRY JOB |
| 1 | M2 | 1 | SALT IN THE WOUND |
| 2 | M3 | 2 | ROOFS OF THE OLD TOWN |
| 3 | M4 | 2 | THE BELL TOWER DROP |
| 4 | M5 | 3 | THE FORTRESS LEDGER |
| 5 | M6 | 3 | CASINO ROYALE AZZURA |
| 6 | M7 | 4 | THE TOWER SCOUT |
| 7 | M8 | 4 | STORM WARNING |
| 8 | M9 | 5 | THREE-STAR CHASE |
| 9 | M11 | 6 | THE AZZURA TOWER JOB |
| 10 | M12 | 7 | THE LAST LEDGER |

M10 (RIVIERA GRAND PRIX) was cut 22 Nov — unwinnable race, removed
cleanly. The 4 street races (R1 BOULEVARD SPRINT, R2 CBD LOOP, R3 OLD
TOWN RUN, R4 MARINA DASH) are defined in `game/src/side-races.js`.

## What works

Verified in Playwright, not just claimed: the 11 story missions
(test driver: drive + escape stages played for real; goto/deliver/
interact stages currently teleport the player — see
`reports/missions-run.json`); the Captain's Logbook hub (Tab/H, 6 tabs:
Logbook, Crew, Chart, Garage, Vault, Waves); save/load (3 slots,
localStorage); a day/night cycle (one in-game day = 8 real minutes);
storm rain (M8 + `?shot=storm`); traffic (23 cars on 24 lanes) and 40
pedestrians; wanted 1–5 + combat; 3 procedural radio stations.

Not wired into play yet (code exists in `game/src/side-*.js` +
`sidecontent.js`, but `attachSideContent()` is never called): shops,
side jobs, street races, stunt jumps, collectibles, standing and
rank-gated unlocks. Full audit: `reports/item0-answers-2026-11-22.md`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bkces50p&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
