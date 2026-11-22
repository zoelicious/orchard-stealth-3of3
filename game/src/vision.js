// vision.js — cones, light and the detection meter.
// A guard sees the player only inside its cone, with a clear sight line, and
// the closer and brighter the player, the faster the meter climbs.

const CONE_HALF_ANGLE = 0.62; // radians either side of facing

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Is the player inside this guard's cone right now (range + angle + sight line)?
function coneHit(g, px, py, lv) {
  const dx = px - g.x, dy = py - g.y;
  const dist = Math.hypot(dx, dy);
  const range = g.kind === "dog" ? 165 : 195;
  if (dist > range) return { seen: false, dist };
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, g.angle)) > CONE_HALF_ANGLE) return { seen: false, dist };
  if (losBlocked(g.x, g.y, px, py, lv)) return { seen: false, dist };
  return { seen: true, dist, range };
}

// How fast this guard's suspicion meter climbs per second while the player is seen.
function detectionRate(g, p, lv, hit) {
  const shadow = inShadow(p.x, p.y, lv);
  const lit = nearLantern(p.x, p.y, lv);
  let rate = 62 * (1.7 - hit.dist / hit.range);
  if (p.crouch) rate *= 0.55;
  if (shadow) rate *= 0.45;
  if (lit) rate *= 1.35;
  if (p.moving) rate *= 1.25;
  if (g.state === "alarm") rate *= 1.2;
  return Math.max(6, rate);
}

// Meter decay per second while unseen.
function decayRate(g) {
  return g.state === "alarm" ? 7 : 15;
}
