// main.js — boot, the game loop, input, and all canvas rendering for
// ORCHARD AT DUSK. Top-down stealth in a fruit orchard at dusk: fill three
// baskets from the marked trees, shake branches to distract the dog, and
// leave through the green gate before the farmer's round ends.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const G = {
  level: buildLevel(),
  player: newPlayer(),
  guards: newGuards(),
  timeLeft: 180, // the farmer's round: 3:00
  score: 0,
  spotted: 0,
  strikes: 0,
  over: false,
  staged: false,
  stagedShot: 0,
  nearTree: null,
  mouse: { x: 0, y: 0 },
  time: 0,
};

const input = { up: false, down: false, left: false, right: false, crouch: false, pick: false };

function resetGame() {
  G.level = buildLevel();
  G.player = newPlayer();
  G.guards = newGuards();
  G.timeLeft = 180;
  G.score = 0; G.spotted = 0; G.strikes = 0;
  G.over = false; G.staged = false; G.stagedShot = 0; G.nearTree = null;
  document.getElementById("endcard").classList.add("hidden");
  document.getElementById("banner").classList.add("hidden");
  const shot = new URLSearchParams(location.search).get("shot");
  if (shot) applyShot(G, parseInt(shot, 10) || 1);
  updateHud(G);
}

// --- input -------------------------------------------------------------------

const KEYMAP = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
  KeyC: "crouch", ShiftLeft: "crouch", ShiftRight: "crouch", KeyE: "pick",
};
window.addEventListener("keydown", (e) => {
  AudioSys.init();
  if (e.code === "KeyR") { resetGame(); return; }
  if (e.code === "KeyM") { AudioSys.muted = !AudioSys.muted; return; }
  if (e.code === "KeyF") { throwFruit(G, G.mouse.x, G.mouse.y); return; }
  const k = KEYMAP[e.code];
  if (k) { input[k] = true; e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  G.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener("click", (e) => {
  AudioSys.init();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  shakeTree(G, x, y);
});
document.getElementById("throwBtn").addEventListener("click", () => {
  AudioSys.init();
  throwFruit(G, G.mouse.x, G.mouse.y);
});

// --- update ------------------------------------------------------------------

function update(dt) {
  if (G.over) return;
  G.time += dt;
  if (!G.staged) {
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) {
      G.timeLeft = 0;
      endGame(G, false, "The round ended — the farmer locks the gate at dusk.");
      updateHud(G);
      return;
    }
  } else {
    G.timeLeft = Math.max(1, G.timeLeft - dt);
  }

  // Fireflies drift and blink.
  for (const f of G.level.fireflies) {
    f.ph += dt * f.sp;
    f.x += Math.sin(f.ph) * 6 * dt;
    f.y += Math.cos(f.ph * 0.8) * 4 * dt;
  }
  // Shake animation decays; falling fruit settles.
  for (const t of G.level.trees) if (t.shake > 0) t.shake = Math.max(0, t.shake - dt * 0.8);
  for (const fr of G.level.fallenFruit) {
    if (fr.fall > 0) fr.fall = Math.max(0, fr.fall - dt);
    fr.t -= dt;
  }
  G.level.fallenFruit = G.level.fallenFruit.filter((fr) => fr.t > 0 && !fr.eaten);
  // Thrown fruit arcs, lands, and becomes a distraction.
  const th = G.level.thrownFruit;
  if (th) {
    th.t += dt;
    if (th.t >= th.dur && !th.landed) {
      th.landed = true;
      AudioSys.thud();
      G.level.fallenFruit.push({ x: th.x, y: th.y, t: 10, eaten: false, fall: 0 });
      const dog = G.guards[1];
      dog.distract = { x: th.x, y: th.y, t: 5 };
      dog.earsUp = true;
    }
    if (th.t > th.dur + 0.05) G.level.thrownFruit = null;
  }
  // Dog eats fallen fruit it reaches.
  const dog = G.guards[1];
  for (const fr of G.level.fallenFruit) {
    if (!fr.eaten && Math.hypot(dog.x - fr.x, dog.y - fr.y) < 20) fr.eaten = true;
  }

  if (!G.staged) {
    updatePlayer(G, dt, input);
    for (const g of G.guards) updateGuard(G, g, dt);
    // Win: all baskets full and Wren reaches the open gate.
    if (G.player.baskets >= 3 && G.level.gate.open) {
      const gt = G.level.gate;
      if (Math.hypot(G.player.x - gt.x, G.player.y - gt.y) < 46) {
        endGame(G, true, "Three baskets, one quiet orchard, zero alarms raised.");
      }
    }
  }
  updateHud(G);
}

// --- rendering ---------------------------------------------------------------

function drawCone(g) {
  const range = g.kind === "dog" ? 165 : 195;
  const half = CONE_HALF_ANGLE + (g.state === "alarm" ? 0.18 : g.state === "suspicious" ? 0.07 : 0);
  const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, range);
  const hot = g.state === "alarm";
  grad.addColorStop(0, hot ? "rgba(255,90,50,0.5)" : "rgba(255,205,90,0.42)");
  grad.addColorStop(0.7, hot ? "rgba(255,90,50,0.22)" : "rgba(255,205,90,0.16)");
  grad.addColorStop(1, "rgba(255,205,90,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.arc(g.x, g.y, range, g.angle - half, g.angle + half);
  ctx.closePath();
  ctx.fill();
  // cone edges
  ctx.strokeStyle = hot ? "rgba(255,110,70,0.75)" : "rgba(255,215,120,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle - half) * range, g.y + Math.sin(g.angle - half) * range);
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle + half) * range, g.y + Math.sin(g.angle + half) * range);
  ctx.stroke();
}

function drawGround() {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, "#232a1e");
  grad.addColorStop(0.5, "#1b2117");
  grad.addColorStop(1, "#141a12");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // dusk sky glow at the top edge
  const sky = ctx.createLinearGradient(0, 0, 0, 90);
  sky.addColorStop(0, "rgba(120,70,140,0.35)");
  sky.addColorStop(1, "rgba(120,70,140,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, 90);
  // dirt speckles
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < 260; i++) {
    const x = (i * 137.5) % WORLD_W, y = (i * 89.3) % WORLD_H;
    ctx.fillRect(x, y, 2, 2);
  }
  // mown lanes between the rows
  ctx.fillStyle = "rgba(90,110,60,0.12)";
  for (const y of [225, 415, 605]) ctx.fillRect(0, y, WORLD_W, 34);
}

// In-world text label with a dark backing so it reads over trees and cones.
function labelTag(text, x, y, align) {
  ctx.font = "bold 11px Verdana";
  ctx.textAlign = align || "center";
  const w = ctx.measureText(text).width + 12;
  const bx = align === "left" ? x - 6 : x - w / 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx, y - 13, w, 16);
  ctx.fillStyle = "#ffe9b0";
  ctx.fillText(text, x, y);
}

function drawLevel() {
  const lv = G.level;
  // tall grass patches
  for (const g of lv.grass) {
    ctx.fillStyle = "rgba(58,92,44,0.85)";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(140,190,90,0.9)";
    ctx.lineWidth = 1.5;
    for (let x = g.x + 8; x < g.x + g.w; x += 14) {
      for (let y = g.y + 10; y < g.y + g.h - 6; y += 18) {
        ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 3, y - 4); ctx.moveTo(x + 6, y + 8); ctx.lineTo(x + 8, y - 2); ctx.stroke();
      }
    }
    labelTag(g.label, g.x + g.w / 2, g.y + 16);
  }
  // lantern light pools on the ground
  for (const l of lv.lanterns) {
    const glow = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r);
    glow.addColorStop(0, "rgba(255,190,80,0.30)");
    glow.addColorStop(1, "rgba(255,190,80,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a2c1c";
    ctx.fillRect(l.x - 2, l.y - 26, 4, 26);
    ctx.fillStyle = "#ffca55";
    ctx.beginPath(); ctx.arc(l.x, l.y - 28, 6, 0, Math.PI * 2); ctx.fill();
  }
  // fireflies along the safe shadow path
  for (const f of lv.fireflies) {
    const a = 0.35 + 0.55 * Math.abs(Math.sin(f.ph));
    const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
    glow.addColorStop(0, "rgba(190,255,120," + a + ")");
    glow.addColorStop(1, "rgba(190,255,120,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(230,255,170," + Math.min(1, a + 0.3) + ")";
    ctx.beginPath(); ctx.arc(f.x, f.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  labelTag("FIREFLIES: SAFE SHADOW PATH", 84, 628, "left");
  // haystacks
  for (const h of lv.haystacks) {
    ctx.fillStyle = "#8a6a2a";
    ctx.beginPath(); ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c9a44a"; ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(h.x + h.w / 2 + i * 12, h.y + 6); ctx.lineTo(h.x + h.w / 2 + i * 8, h.y + h.h - 6); ctx.stroke();
    }
    labelTag("HAYSTACK: COVER", h.x + h.w / 2, h.y - 6);
  }
  // crates
  for (const c of lv.crates) {
    ctx.fillStyle = "#6b4a24";
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = "#a87c3f"; ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h); ctx.stroke();
  }
  // exit gate
  const gt = lv.gate;
  ctx.save();
  ctx.fillStyle = gt.open ? "#9fe870" : "#4a7a3a";
  ctx.fillRect(gt.x - gt.w / 2, gt.y - gt.h / 2, 8, gt.h);
  ctx.fillRect(gt.x + gt.w / 2 - 8, gt.y - gt.h / 2, 8, gt.h);
  ctx.fillRect(gt.x - gt.w / 2, gt.y - gt.h / 2, gt.w, 9);
  if (gt.open) {
    const glow = ctx.createRadialGradient(gt.x, gt.y, 4, gt.x, gt.y, 60);
    glow.addColorStop(0, "rgba(159,232,112,0.55)");
    glow.addColorStop(1, "rgba(159,232,112,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(gt.x, gt.y, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#dff5c0";
    labelTag("EXIT — OPEN", gt.x, gt.y - gt.h / 2 - 12);
  } else {
    labelTag("EXIT", gt.x, gt.y - gt.h / 2 - 12);
  }
  ctx.restore();
  // trees (canopy + trunk + fruit)
  for (const t of lv.trees) {
    const wob = t.shake > 0 ? Math.sin(G.time * 22) * 4 * t.shake : 0;
    ctx.save();
    ctx.translate(wob, 0);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r - 4, t.r, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a3018";
    ctx.fillRect(t.x - 4, t.y + 6, 8, 16);
    const cg = ctx.createRadialGradient(t.x - 6, t.y - 8, 4, t.x, t.y, t.r + 4);
    cg.addColorStop(0, t.marked ? "#4a7a2e" : "#33511f");
    cg.addColorStop(1, "#1d3013");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(140,190,90,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r - 3, 0, Math.PI * 2); ctx.stroke();
    // fruit dots
    ctx.fillStyle = t.marked ? "#ff5a2e" : "#c94a2e";
    for (let i = 0; i < (t.marked ? 7 : 3); i++) {
      const a = i * 2.4 + (t.marked ? 0.4 : 0);
      ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * (t.r - 9), t.y + Math.sin(a) * (t.r - 9), 3, 0, Math.PI * 2); ctx.fill();
    }
    if (t.marked) {
      ctx.strokeStyle = t.picked ? "#9fe870" : "#ffd97a";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 6, 0, Math.PI * 2); ctx.stroke();
      labelTag(t.picked ? "✓ BASKET FILLED" : "★ " + t.label + " — CLICK TO SHAKE", t.x, t.y - t.r - 12);
    }
    ctx.restore();
  }
  // row label
  labelTag("TREE ROW: COVER — BLOCKS THEIR SIGHT", 84, 78, "left");
  // fallen fruit on the ground
  for (const fr of lv.fallenFruit) {
    const y = fr.y - fr.fall * 30;
    ctx.fillStyle = "#e23b2e";
    ctx.beginPath(); ctx.arc(fr.x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd97a";
    ctx.beginPath(); ctx.arc(fr.x - 1.5, y - 1.5, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // thrown fruit in flight
  const th = lv.thrownFruit;
  if (th) {
    const k = th.t / th.dur;
    const x = th.sx + (th.x - th.sx) * k;
    const y = th.sy + (th.y - th.sy) * k - Math.sin(k * Math.PI) * 46;
    ctx.fillStyle = "#e23b2e";
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // "LANTERN: DANGER" tag
  labelTag("LANTERN: DANGER", lv.lanterns[0].x, lv.lanterns[0].y - 42);
}

function render() {
  drawGround();
  // vision cones first, so trees and cover visually cut across them
  for (const g of G.guards) drawCone(g);
  drawLevel();
  for (const g of G.guards) drawGuard(ctx, G, g);
  drawPlayer(ctx, G);
  // vignette: dusk closing in at the edges
  const vg = ctx.createRadialGradient(490, 360, 260, 490, 360, 720);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(5,5,12,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // dusk skyline silhouette at the very top
  ctx.fillStyle = "rgba(20,12,30,0.85)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= 980; x += 40) ctx.lineTo(x, 18 + ((x * 7) % 23));
  ctx.lineTo(980, 0);
  ctx.closePath();
  ctx.fill();
}

// --- loop --------------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
