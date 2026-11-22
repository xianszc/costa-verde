// AZZURA HEIST — side content: extra spots, derived from named anchors.
// NO placeholder anchors were needed: every side system stands on a
// real anchor (anchors.js). The shop doors below are small offsets from
// real anchors — they sit beside the mission targets, never on them,
// so no shop marker ever blocks a mission interact.
// SIDE_ANCHORS stays empty by design; if a future side system needs a
// place with no anchor, its placeholder goes here (never in anchors.js).
import { ANCHORS } from './anchors.js';

export const SIDE_ANCHORS = {};

export const SIDE_SPOTS = {
  // Kelo Arms (weapons): on the old town main street staging spot
  // itself — AUDIT m-17: the old +4 put the door 1u from the fortress
  // plaza (-47,-39), inside nearestShop's 4u radius, so the plaza
  // interact and the shop prompt fought each other. At the anchor
  // (-52,-39) the door is 5u clear of the plaza. (Races start from
  // the map/hub, not an E marker, so sharing the R3 line-up spot
  // blocks no race start; the LINE UP stage is a goto.)
  weaponsShop: { x: ANCHORS.oldtown_main_street.x, z: ANCHORS.oldtown_main_street.z, district: 'old town' },
  // Sartoria Azzura (clothes): promenade walkway, 6 m west of the
  // middle — clear of the casino entrance and the M10 checkpoint.
  clothesShop: { x: ANCHORS.promenade_mid.x - 6, z: ANCHORS.promenade_mid.z, district: 'promenade' },
  // Gus' Garage (car customization): marina strip, 6 m west of the
  // harbormaster pavilion — clear of the M1/M2/M5/M8/M12 target.
  garage: { x: ANCHORS.harbormaster_pavilion.x - 6, z: ANCHORS.harbormaster_pavilion.z, district: 'marina' },
  // Farmacia Azzura (health + armour): skyline plaza, 4 m east of the
  // plaza centre — open walkable ground, clear of the M7 target.
  pharmacy: { x: ANCHORS.skyline_plaza.x + 4, z: ANCHORS.skyline_plaza.z, district: 'cbd' },
};
