// level.js — the orchard itself: tree rows, cover, grass, lanterns, fireflies, gate.
// Every coordinate lives in the 1280x720 world; the right 300px sit under the HUD panel,
// so the playable garden is laid out in the left 980px.

const WORLD_W = 1280;
const WORLD_H = 720;

function buildLevel() {
  const trees = [];
  // Three tree rows: y = 140, 330, 520. Gaps in each row are the lanes to slip through.
  const rows = [140, 330, 520];
  const gaps = { 140: [430, 700], 330: [250, 800], 520: [520] };
  for (const y of rows) {
    for (let x = 70; x <= 920; x += 62) {
      let inGap = false;
      for (const g of gaps[y]) if (Math.abs(x - g) < 46) inGap = true;
      if (inGap) continue;
      trees.push({ x, y, r: 25, marked: false, picked: false, shake: 0, kind: "row" });
    }
  }
  // Three marked fruit trees the baskets come from (golden fruit, labelled in-world).
  const marked = [
    { x: 300, y: 140, label: "APPLE TREE 1" },
    { x: 620, y: 330, label: "APPLE TREE 2" },
    { x: 180, y: 520, label: "APPLE TREE 3" },
  ];
  for (const m of marked) {
    trees.push({ x: m.x, y: m.y, r: 30, marked: true, picked: false, shake: 0, kind: "fruit", label: m.label });
  }
  // A few lone shade trees off the rows.
  trees.push({ x: 880, y: 90, r: 24, marked: false, picked: false, shake: 0, kind: "row" });
  trees.push({ x: 60, y: 330, r: 24, marked: false, picked: false, shake: 0, kind: "row" });
  trees.push({ x: 770, y: 690, r: 24, marked: false, picked: false, shake: 0, kind: "row" });

  return {
    trees,
    haystacks: [
      { x: 450, y: 205, w: 74, h: 52 },
      { x: 760, y: 420, w: 74, h: 52 },
      { x: 250, y: 610, w: 74, h: 52 },
    ],
    crates: [
      { x: 540, y: 105, w: 44, h: 44 },
      { x: 820, y: 285, w: 44, h: 44 },
      { x: 380, y: 455, w: 44, h: 44 },
    ],
    grass: [
      { x: 110, y: 245, w: 190, h: 92, label: "TALL GRASS" },
      { x: 690, y: 115, w: 170, h: 84, label: "TALL GRASS" },
      { x: 470, y: 565, w: 210, h: 92, label: "TALL GRASS" },
      { x: 850, y: 470, w: 110, h: 90, label: "TALL GRASS" },
    ],
    lanterns: [
      { x: 300, y: 240, r: 95 },
      { x: 640, y: 430, r: 95 },
      { x: 860, y: 200, r: 80 },
    ],
    // Fireflies trace the safe shadow path along the bottom of the garden.
    fireflies: makeFireflies(),
    gate: { x: 905, y: 648, w: 66, h: 54, open: false },
    fallenFruit: [],
    thrownFruit: null,
  };
}

function makeFireflies() {
  const pts = [];
  const path = [
    [90, 640], [200, 660], [330, 640], [470, 665], [600, 645],
    [720, 665], [830, 640], [880, 590], [700, 600], [560, 610], [420, 600],
  ];
  for (const [x, y] of path) {
    for (let i = 0; i < 3; i++) {
      pts.push({ x: x + (Math.random() * 36 - 18), y: y + (Math.random() * 22 - 11), ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2 });
    }
  }
  return pts;
}

// --- collision + line of sight -----------------------------------------------

function circleHitRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function pointInOccluder(x, y, lv) {
  for (const t of lv.trees) {
    const dx = x - t.x, dy = y - t.y;
    if (dx * dx + dy * dy < (t.r - 4) * (t.r - 4)) return true;
  }
  for (const h of lv.haystacks) if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) return true;
  for (const c of lv.crates) if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) return true;
  return false;
}

// True when a straight sight line between two points crosses a tree, haystack or crate.
function losBlocked(x1, y1, x2, y2, lv) {
  const steps = 26;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInOccluder(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, lv)) return true;
  }
  return false;
}

// True when the point sits in cover shadow: under a canopy, in tall grass, or far from any lantern.
function inShadow(x, y, lv) {
  for (const t of lv.trees) {
    const dx = x - t.x, dy = y - t.y;
    if (dx * dx + dy * dy < (t.r + 16) * (t.r + 16)) return true;
  }
  for (const g of lv.grass) {
    if (x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h) return true;
  }
  for (const l of lv.lanterns) {
    const dx = x - l.x, dy = y - l.y;
    if (dx * dx + dy * dy < l.r * l.r) return false;
  }
  return true;
}

function nearLantern(x, y, lv) {
  for (const l of lv.lanterns) {
    const dx = x - l.x, dy = y - l.y;
    if (dx * dx + dy * dy < l.r * l.r) return true;
  }
  return false;
}

// Push a walking circle out of trunks, haystacks and crates; returns true on a bump.
function resolveCollision(p, r, lv) {
  let bumped = false;
  for (const t of lv.trees) {
    const dx = p.x - t.x, dy = p.y - t.y;
    const d = Math.hypot(dx, dy), min = t.r - 6 + r;
    if (d < min && d > 0.01) { p.x = t.x + dx / d * min; p.y = t.y + dy / d * min; bumped = true; }
  }
  for (const box of lv.haystacks.concat(lv.crates)) {
    if (circleHitRect(p.x, p.y, r, box)) {
      const left = p.x - box.x, right = box.x + box.w - p.x;
      const top = p.y - box.y, bottom = box.y + box.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = box.x - r; else if (m === right) p.x = box.x + box.w + r;
      else if (m === top) p.y = box.y - r; else p.y = box.y + box.h + r;
      bumped = true;
    }
  }
  p.x = Math.max(16, Math.min(964, p.x));
  p.y = Math.max(56, Math.min(WORLD_H - 16, p.y));
  return bumped;
}
