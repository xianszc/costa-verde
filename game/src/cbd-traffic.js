// AZZURA HEIST — CBD directed-lane traffic (Xian 21 Nov 15:22).
// Cars drive the CBD grid's data-driven streets in REAL lanes:
// right-hand traffic, 4 lanes per direction on avenues and streets,
// stop at red signals, change lanes mid-segment, turn at intersections.
// The lane graph is built from the same CBD_NS / CBD_EW data that
// cbd-grid.js draws (one source of truth for geometry, markings,
// traffic AI and the minimap), so a car never leaves a road.
//
// Heading convention (same as vehicles.js): angle 0 = east (+x),
// PI/2 = north (-z), PI = west, -PI/2 = south (+z). A car's forward
// vector is (cos a, -sin a) in (x, z).
import { CBD_NS, CBD_EW, signalPhase } from './cbd-grid.js';
import { buildTrafficCar, buildPoliceCruiser, createCar, ROAD_Y } from './vehicles.js';
import { updateCarWheels } from './wheels.js';

// Lane offsets from the street centreline (matches the painted
// markings in cbd-grid.js): avenue 0.825/1.175/1.525/1.875,
// street 0.15/0.45/0.75/1.05.
const LANE_OFFS = { avenue: [0.825, 1.175, 1.525, 1.875], street: [0.15, 0.45, 0.75, 1.05] };
const CRUISE = { avenue: 9, street: 7 };

// Direction unit vectors, keyed by axis + dir.
const DIR_VEC = {
  NS: { '-1': { x: 0, z: -1 }, 1: { x: 0, z: 1 } }, // -1 north, +1 south
  EW: { '-1': { x: -1, z: 0 }, 1: { x: 1, z: 0 } }, // -1 west, +1 east
};
// Lateral unit vector pointing from the centreline toward the car's
// side of the road (right-hand traffic: northbound = east half).
const SIDE_VEC = {
  NS: { '-1': { x: 1, z: 0 }, 1: { x: -1, z: 0 } },
  EW: { '-1': { x: 0, z: -1 }, 1: { x: 0, z: 1 } },
};
// Heading angle for a direction.
const HEADING = {
  NS: { '-1': Math.PI / 2, 1: -Math.PI / 2 },
  EW: { '-1': Math.PI, 1: 0 },
};

function streetOf(axis, index) {
  return axis === 'NS' ? CBD_NS[index] : CBD_EW[index];
}
function laneOffs(axis, index) {
  return LANE_OFFS[streetOf(axis, index).kind];
}
function segCount(axis, index) {
  // Segments along a street: one between each pair of intersections.
  return axis === 'NS' ? CBD_EW.length - 1 : CBD_NS.length - 1;
}
// Half-width of the CROSSING street at node (axis, index, nodeIdx):
// the intersection box the car must clear before the stop line.
function crossHalf(axis, index, nodeIdx) {
  const cross = axis === 'NS' ? CBD_EW[nodeIdx] : CBD_NS[nodeIdx];
  return cross.w / 2;
}
// Node centre coordinates: NS street `index` meets EW street `nodeIdx`.
function nodeXY(axis, index, nodeIdx) {
  return axis === 'NS'
    ? { x: CBD_NS[index].x, z: CBD_EW[nodeIdx].z }
    : { x: CBD_NS[nodeIdx].x, z: CBD_EW[index].z };
}
// Segment endpoints: A = just past the start node's box, B = the stop
// line before the end node's box. dir +1 runs node k -> k+1.
function segmentEnds(axis, index, dir, seg) {
  const k0 = dir > 0 ? seg : seg + 1;
  const k1 = dir > 0 ? seg + 1 : seg;
  const n0 = nodeXY(axis, index, k0);
  const n1 = nodeXY(axis, index, k1);
  const d = DIR_VEC[axis][dir];
  const gap0 = crossHalf(axis, index, k0) + 1.4;
  const gap1 = crossHalf(axis, index, k1) + 1.4;
  const A = { x: n0.x + d.x * gap0, z: n0.z + d.z * gap0 };
  const B = { x: n1.x - d.x * gap1, z: n1.z - d.z * gap1 };
  return { A, B, len: Math.hypot(B.x - A.x, B.z - A.z) };
}
// Parametric point on a segment at progress s with lateral offset.
function pointOn(axis, index, dir, lane, seg, s, offset) {
  const { A, B, len } = segmentEnds(axis, index, dir, seg);
  const d = DIR_VEC[axis][dir];
  const sv = SIDE_VEC[axis][dir];
  const along = s * len;
  return {
    x: A.x + d.x * along + sv.x * offset,
    z: A.z + d.z * along + sv.z * offset,
    len,
  };
}

// Turn the car onto a new segment (straight, left or right from the
// node it just reached). Returns the waypoint list the car must drive
// through the intersection box before it resumes parametric following.
function chooseNext(car, nodeIdx) {
  const { axis, index, dir } = car;
  const options = [];
  // Straight: same street, next segment in the same direction.
  const straightSeg = dir > 0 ? car.seg + 1 : car.seg - 1;
  if (straightSeg >= 0 && straightSeg < segCount(axis, index)) {
    options.push({ kind: 'straight', w: 0.6, axis, index, dir, seg: straightSeg });
  }
  // Left / right: the crossing street from this node. The car is AT
  // NS street `index` (or EW street `index`); the crossing street's
  // segments run between the car's street and its neighbours, so the
  // segment index comes from `index`, not from the node index.
  const crossAxis = axis === 'NS' ? 'EW' : 'NS';
  const crossIndex = nodeIdx; // the EW (or NS) street at this node
  // Heading -> left/right exit direction on the crossing street.
  const turnDir = leftRight(axis, dir);
  for (const [turn, tdir] of [['left', turnDir.left], ['right', turnDir.right]]) {
    const seg = tdir > 0 ? index : index - 1;
    if (seg >= 0 && seg < segCount(crossAxis, crossIndex)) {
      options.push({ kind: turn, w: 0.2, axis: crossAxis, index: crossIndex, dir: tdir, seg });
    }
  }
  if (!options.length) {
    // Dead end (should not happen on this grid): U-turn in place.
    return { via: [], uTurn: true };
  }
  let total = 0;
  for (const o of options) total += o.w;
  let r = Math.random() * total;
  let pick = options[options.length - 1];
  for (const o of options) { r -= o.w; if (r <= 0) { pick = o; break; } }
  const node = nodeXY(axis, index, nodeIdx);
  const exit = DIR_VEC[pick.axis][pick.dir];
  const { A } = segmentEnds(pick.axis, pick.index, pick.dir, pick.seg);
  // Straight: drive the box from the stop line to the next segment's
  // start. Turn: cut the corner through a midpoint just past the
  // node centre toward the exit, then the new segment's start.
  const via = pick.kind === 'straight'
    ? [A]
    : [{ x: node.x + exit.x * 0.6, z: node.z + exit.z * 0.6 }, A];
  return { via, pick };
}

// For a heading (axis, dir), the exit directions of a left / right turn.
function leftRight(axis, dir) {
  // Facing south (+z): left = east, right = west.
  // Facing north (-z): left = west, right = east.
  // Facing east (+x): left = north, right = south.
  // Facing west (-x): left = south, right = north.
  // Crossing street dir: EW +1 = east, -1 = west; NS +1 = south, -1 = north.
  if (axis === 'NS') {
    return dir > 0 ? { left: 1, right: -1 } : { left: -1, right: 1 };
  }
  return dir > 0 ? { left: -1, right: 1 } : { left: 1, right: -1 };
}

// Place a car on a segment (used at spawn and by shot staging).
export function placeCbdCar(car, axis, index, dir, lane, seg, s = 0) {
  const offs = laneOffs(axis, index);
  car.axis = axis;
  car.index = index;
  car.dir = dir;
  car.lane = Math.max(0, Math.min(lane, offs.length - 1));
  car.seg = Math.max(0, Math.min(seg, segCount(axis, index) - 1));
  car.s = Math.max(0, Math.min(s, 1));
  car.offset = offs[car.lane];
  car.targetOffset = car.offset;
  car.via = [];
  const p = pointOn(axis, index, dir, car.lane, car.seg, car.s, car.offset);
  car.x = p.x;
  car.z = p.z;
  car.angle = HEADING[axis][dir];
  car.mesh.position.set(car.x, ROAD_Y, car.z);
  // AUDIT M-1: NO +PI/2 — the traffic-car model is long on X (body
  // 4.2 x 1.9), so rotation.y = angle already points it along its
  // heading (cos a, -sin a), like the hero car and the ring traffic.
  // The old +PI/2 turned every CBD car 90 deg sideways to its lane.
  car.mesh.rotation.y = car.angle;
}

// Spawn the CBD traffic: defs = [{ axis:'NS'|'EW', index, dir, lane,
// seg, s, police, kind, color }]. Missing seg/s are picked at random.
export function createCbdTraffic(defs) {
  const cars = [];
  for (const d of defs) {
    const mesh = d.police ? buildPoliceCruiser() : buildTrafficCar(d.color, d.kind);
    const car = createCar(mesh, { noMesh: true });
    car.police = !!d.police;
    car.cruise = d.police ? 10 : CRUISE[streetOf(d.axis, d.index).kind];
    car.speed = car.cruise * (0.7 + Math.random() * 0.3);
    car.targetSpeed = car.cruise;
    const seg = d.seg !== undefined ? d.seg : Math.floor(Math.random() * segCount(d.axis, d.index));
    const s = d.s !== undefined ? d.s : Math.random() * 0.8;
    placeCbdCar(car, d.axis, d.index, d.dir, d.lane ?? 0, seg, s);
    cars.push(car);
  }
  return cars;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// One simulation step for all CBD cars. obstacles = [{x, z, angle}]
// (the player car / player on foot / loop traffic) to yield to.
export function stepCbdTraffic(cars, dt, obstacles = []) {
  const t = performance.now() / 1000;
  for (const c of cars) {
    const offs = laneOffs(c.axis, c.index);
    const ends = segmentEnds(c.axis, c.index, c.dir, c.seg);
    const distToStop = Math.max(0, (1 - c.s) * ends.len);
    let targetSpeed = c.cruise;

    if (c.via.length) {
      // Driving through an intersection box toward a waypoint.
      // Accelerate back up to cruise (the car may have waited at red).
      c.speed += (c.cruise - c.speed) * Math.min(1, dt * 1.6);
      const wp = c.via[0];
      const dx = wp.x - c.x, dz = wp.z - c.z;
      const dist = Math.hypot(dx, dz);
      const stepLen = c.speed * dt;
      if (stepLen >= dist) {
        c.x = wp.x; c.z = wp.z;
        c.via.shift();
      } else {
        c.x += (dx / dist) * stepLen;
        c.z += (dz / dist) * stepLen;
      }
      const desired = Math.atan2(-dz, dx);
      const dA = wrapAngle(desired - c.angle);
      c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, dA));
    } else {
      // Signal check: the phase of the intersection ahead.
      const nodeIdx = c.dir > 0 ? c.seg + 1 : c.seg;
      // signalPhase(ix, iz, t): for an NS street the node is
      // (ix = street index, iz = nodeIdx); for an EW street it is
      // (ix = nodeIdx, iz = street index).
      const ph = c.axis === 'NS'
        ? signalPhase(c.index, nodeIdx, t)
        : signalPhase(nodeIdx, c.index, t);
      const green = ph === c.axis;
      const amber = ph === `${c.axis}_AMBER`;
      if (c.s > 0.55) {
        if (!green) {
          if (amber && distToStop < 4) {
            // Amber and already committed: run it.
          } else {
            targetSpeed = Math.max(0, Math.min(c.cruise, (distToStop - 0.3) * 1.5));
          }
        }
      }
      // Yield to a car / obstacle ahead in the same lane.
      const fx = Math.cos(c.angle), fz = -Math.sin(c.angle);
      for (const o of [...cars, ...obstacles]) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 7 && dist > 0.01) {
          const dot = (dx * fx + dz * fz) / dist;
          if (dot > 0.6) { targetSpeed = 0; break; }
        }
      }
      // Lane change mid-segment (never near an intersection).
      if (c.s > 0.25 && c.s < 0.7 && Math.random() < 0.1 * dt) {
        const next = c.lane + (Math.random() < 0.5 ? -1 : 1);
        if (next >= 0 && next < offs.length) {
          c.lane = next;
          c.targetOffset = offs[next];
        }
      }
      c.offset += (c.targetOffset - c.offset) * Math.min(1, dt * 2);
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.6);
      c.s += (c.speed * dt) / ends.len;
      const p = pointOn(c.axis, c.index, c.dir, c.lane, c.seg, Math.min(c.s, 1), c.offset);
      c.x = p.x;
      c.z = p.z;
      const desired = HEADING[c.axis][c.dir];
      const dA = wrapAngle(desired - c.angle);
      c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, dA));
      if (c.s >= 1) {
        // At the stop line: pick the next segment (or wait for green).
        if (green) {
          const { via, pick, uTurn } = chooseNext(c, nodeIdx);
          if (uTurn) {
            // Dead end (never on this grid): reverse on the same
            // segment — the new segment's start IS the old stop line,
            // so the car is already at it, just on the other side.
            c.dir = -c.dir;
            c.s = 0;
            c.via = [];
            c.angle = HEADING[c.axis][c.dir];
            const p2 = pointOn(c.axis, c.index, c.dir, c.lane, c.seg, 0, c.offset);
            c.x = p2.x; c.z = p2.z;
          } else {
            const newOffs = laneOffs(pick.axis, pick.index);
            c.lane = Math.min(c.lane, newOffs.length - 1);
            c.axis = pick.axis;
            c.index = pick.index;
            c.dir = pick.dir;
            c.seg = pick.seg;
            c.s = 0;
            c.offset = newOffs[c.lane];
            c.targetOffset = c.offset;
            c.via = via;
          }
        } else {
          c.s = 1; // wait at the stop line
        }
      }
    }
    c.mesh.position.set(c.x, ROAD_Y, c.z);
    // AUDIT M-1: same fix as the spawn above — no +PI/2 (see comment).
    c.mesh.rotation.y = c.angle;
    updateCarWheels(c, dt, c.speed);
  }
}
