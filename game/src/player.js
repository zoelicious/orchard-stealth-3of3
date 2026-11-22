// player.js — Wren, the fruit picker. Walks, crouches, picks baskets, shakes
// branches and throws fallen fruit. Movement is WASD / arrows; E picks, F throws.

function newPlayer() {
  return {
    x: 80, y: 640, r: 13,
    vx: 0, vy: 0, angle: -Math.PI / 2,
    crouch: false, moving: false,
    baskets: 0, fruit: 3,
    channel: 0, channelTree: null, // pick progress 0..1
    stepT: 0, bob: 0,
  };
}

const PLAYER_WALK = 132;
const PLAYER_CROUCH = 62;

function updatePlayer(G, dt, input) {
  const p = G.player;
  p.crouch = input.crouch;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0 && !G.over;
  if (p.moving) {
    mx /= len; my /= len;
    const speed = p.crouch ? PLAYER_CROUCH : PLAYER_WALK;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.bob += dt * (p.crouch ? 6 : 11);
    p.stepT -= dt;
    if (p.stepT <= 0) {
      AudioSys.footstep(p.crouch);
      p.stepT = p.crouch ? 0.52 : 0.34;
    }
  } else {
    p.stepT = 0;
  }
  resolveCollision(p, p.r, G.level);

  // Picking: hold E beside an unpicked marked tree to fill a basket.
  let nearTree = null;
  for (const t of G.level.trees) {
    if (!t.marked || t.picked) continue;
    if (Math.hypot(p.x - t.x, p.y - t.y) < 58) { nearTree = t; break; }
  }
  G.nearTree = nearTree;
  if (nearTree && input.pick && !G.over) {
    if (p.channelTree !== nearTree) { p.channel = 0; p.channelTree = nearTree; }
    p.channel += dt / 1.2;
    if (p.channel >= 1) {
      nearTree.picked = true;
      p.baskets += 1;
      G.score += 100;
      p.channel = 0; p.channelTree = null;
      AudioSys.chime();
      if (p.baskets >= 3) {
        G.level.gate.open = true;
        AudioSys.chime();
        showBanner(G, "GATE OPEN — RUN TO THE GREEN GATE!", 2600);
      } else {
        showBanner(G, "BASKET " + p.baskets + " OF 3 FILLED", 1600);
      }
    }
  } else {
    p.channel = 0; p.channelTree = null;
  }
}

// Click a fruit tree close by to shake its branch: fruit falls, the dog runs to it.
function shakeTree(G, tx, ty) {
  const p = G.player;
  if (G.over || G.staged) return;
  let best = null, bestD = 1e9;
  for (const t of G.level.trees) {
    const d = Math.hypot(tx - t.x, ty - t.y);
    if (d < 34 && d < bestD) { best = t; bestD = d; }
  }
  if (!best) return;
  const pd = Math.hypot(p.x - best.x, p.y - best.y);
  if (pd > 150) { showBanner(G, "TOO FAR TO SHAKE — CREEP CLOSER", 1400); return; }
  if (best.shake > 0) return;
  best.shake = 1;
  AudioSys.thud();
  for (let i = 0; i < 3; i++) {
    G.level.fallenFruit.push({
      x: best.x + (Math.random() * 70 - 35), y: best.y + 26 + Math.random() * 26,
      t: 14, eaten: false, fall: 0.5,
    });
  }
  // Shaking close to the farmer makes him suspicious.
  const farmer = G.guards[0];
  const fd = Math.hypot(farmer.x - best.x, farmer.y - best.y);
  if (fd < 230) {
    farmer.meter = Math.min(100, farmer.meter + 32);
    if (farmer.state !== "alarm") showBanner(G, "WHAT WAS THAT?", 1800);
  }
  // The dog always hears falling fruit and runs to it.
  const dog = G.guards[1];
  const fruit = G.level.fallenFruit[G.level.fallenFruit.length - 1];
  dog.distract = { x: fruit.x, y: fruit.y, t: 5 };
  dog.earsUp = true;
}

// Throw one fallen fruit toward the mouse: the dog chases where it lands.
function throwFruit(G, tx, ty) {
  const p = G.player;
  if (G.over || G.staged || p.fruit <= 0) return;
  p.fruit -= 1;
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const range = Math.min(d, 280);
  G.level.thrownFruit = {
    sx: p.x, sy: p.y - 6,
    x: p.x + dx / d * range, y: p.y + dy / d * range,
    t: 0, dur: 0.45, landed: false,
  };
}

// Draw Wren: hooded picker with a basket, lower and smaller while crouched.
function drawPlayer(ctx, G) {
  const p = G.player;
  const crouchK = p.crouch ? 0.72 : 1;
  const bobY = p.moving ? Math.sin(p.bob) * 1.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bobY);
  // soft shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.ellipse(0, 9, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  // cloak — bright green so Wren reads against the dark dusk floor
  ctx.fillStyle = "#6da34f";
  ctx.beginPath(); ctx.arc(0, 0, 12 * crouchK + 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 12 * crouchK + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#8fbf6a";
  ctx.beginPath(); ctx.arc(0, -2, 8 * crouchK + 2, 0, Math.PI * 2); ctx.fill();
  // hood + face
  ctx.fillStyle = "#2c4d28";
  ctx.beginPath(); ctx.arc(0, -4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f2d8a8";
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, -4 + Math.sin(p.angle) * 3, 3.4, 0, Math.PI * 2); ctx.fill();
  // basket with red apples
  ctx.fillStyle = "#8a5a24";
  ctx.fillRect(9, 2, 9, 7);
  ctx.fillStyle = "#e23b2e";
  ctx.beginPath(); ctx.arc(11, 1, 2.6, 0, Math.PI * 2); ctx.arc(15, 0, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // name tag, same treatment as the guards so Wren is easy to find
  ctx.save();
  ctx.font = "bold 11px Verdana"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  const w = ctx.measureText("Wren").width + 10;
  ctx.fillRect(p.x - w / 2, p.y + 16, w, 15);
  ctx.fillStyle = "#dff5c0";
  ctx.fillText("Wren", p.x, p.y + 27);
  ctx.restore();
  if (p.channel > 0 && p.channelTree) {
    ctx.save();
    ctx.strokeStyle = "#ffd97a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y - 22, 12, -Math.PI / 2, -Math.PI / 2 + p.channel * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px Verdana";
    ctx.textAlign = "center";
    ctx.fillText("PICKING…", p.x, p.y - 40);
    ctx.restore();
  }
  // "shake me" hint over a near marked tree
  if (G.nearTree && !G.nearTree.picked && G.player.channel === 0) {
    ctx.save();
    ctx.fillStyle = "#ffd97a"; ctx.font = "bold 12px Verdana"; ctx.textAlign = "center";
    ctx.fillText("HOLD E TO PICK  •  CLICK TO SHAKE", G.nearTree.x, G.nearTree.y - 46);
    ctx.restore();
  }
}
