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
  // Kelo Arms (weapons): old town main street, 4 m east of the staging
  // spot, on the cobbles — clear of the M3/M4 targets.
  weaponsShop: { x: ANCHORS.oldtown_main_street.x + 4, z: ANCHORS.oldtown_main_street.z, district: 'old town' },
  // Sartoria Azzura (clothes): promenade walkway, 6 m west of the
  // middle — clear of the casino entrance and the M10 checkpoint.
  clothesShop: { x: ANCHORS.promenade_mid.x - 6, z: ANCHORS.promenade_mid.z, district: 'promenade' },
  // Gus' Garage (car customization): marina strip, 6 m west of the
  // harbormaster pavilion — clear of the M1/M2/M5/M8/M12 target.
  garage: { x: ANCHORS.harbormaster_pavilion.x - 6, z: ANCHORS.harbormaster_pavilion.z, district: 'marina' },
};
