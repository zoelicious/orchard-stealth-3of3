// guard.js — Farmer Aldous and Dog Bramble.
// Both patrol fixed routes. Suspicion climbs in stages (calm → suspicious →
// alarm), the dog's ears rise as a warning before it barks, and a bark pulls
// the farmer toward the noise. Hide to let the meter fall back.

function newGuards() {
  return [
    {
      name: "Farmer Aldous", kind: "farmer",
      x: 200, y: 330, angle: 0, speed: 42,
      patrol: [{ x: 200, y: 330 }, { x: 850, y: 330 }, { x: 850, y: 140 }, { x: 200, y: 140 }],
      wp: 1, meter: 0, state: "calm",
      lastSeen: null, alarmT: 0, barked: false, earsUp: false,
      distract: null, sniffT: 0,
    },
    {
      name: "Dog Bramble", kind: "dog",
      x: 700, y: 520, angle: Math.PI, speed: 96,
      patrol: [{ x: 700, y: 520 }, { x: 300, y: 520 }, { x: 300, y: 140 }, { x: 700, y: 140 }],
      wp: 1, meter: 0, state: "calm",
      lastSeen: null, alarmT: 0, barked: false, earsUp: false,
      distract: null, sniffT: 0,
    },
  ];
}

function guardWord(g) {
  if (g.meter >= 75) return "SPOTTED!";
  if (g.meter >= 55) return "GLIMPSED";
  if (g.meter >= 35) return "UNEASY";
  return "CALM";
}

function moveToward(g, tx, ty, speed, dt) {
  const dx = tx - g.x, dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  g.x += dx / d * step;
  g.y += dy / d * step;
  g.angle = Math.atan2(dy, dx);
  return d - step < 3;
}

function updateGuard(G, g, dt) {
  const p = G.player;
  const hit = coneHit(g, p.x, p.y, G.level);
  const wasState = g.state;

  if (hit.seen && !G.over) {
    g.meter = Math.min(100, g.meter + detectionRate(g, p, G.level, hit) * dt);
    g.lastSeen = { x: p.x, y: p.y, t: 0 };
  } else {
    g.meter = Math.max(0, g.meter - decayRate(g) * dt);
    if (g.lastSeen) g.lastSeen.t += dt;
  }

  // Stage changes.
  if (g.meter >= 75) g.state = "alarm";
  else if (g.meter >= 35) g.state = "suspicious";
  else g.state = "calm";

  // Ears rise as a warning while suspicious; the bark comes with the alarm.
  g.earsUp = g.state !== "calm";
  if (g.state === "suspicious" && wasState === "calm") {
    showBanner(G, "WHAT WAS THAT?", 1800);
  }
  if (g.state === "alarm" && wasState !== "alarm") {
    AudioSys.sting();
    if (g.kind === "dog") AudioSys.bark();
    G.spotted += 1;
    G.strikes = Math.min(3, G.strikes + 1);
    showBanner(G, g.kind === "dog" ? "BRAMBLE IS BARKING!" : "ALDOUS HAS SEEN YOU!", 2000);
    if (G.strikes >= 3) return endGame(G, false, "Caught three times — the farmer locks the gate.");
  }
  if (g.state === "alarm") g.alarmT += dt; else g.alarmT = 0;

  // Movement: distraction first, then alarm chase, then the patrol route.
  if (g.distract) {
    const done = moveToward(g, g.distract.x, g.distract.y, g.speed * 1.35, dt);
    if (done) {
      g.sniffT += dt;
      if (g.sniffT > 1.6) { g.distract = null; g.sniffT = 0; g.earsUp = false; }
    }
    g.distract.t -= dt;
    if (g.distract.t <= 0) { g.distract = null; g.sniffT = 0; }
    return;
  }
  if (g.state === "alarm" && g.lastSeen && g.lastSeen.t < 4) {
    moveToward(g, g.lastSeen.x, g.lastSeen.y, g.speed * 1.7, dt);
    return;
  }
  if (g.state === "alarm") { g.meter = Math.max(0, g.meter - 10 * dt); }
  const target = g.patrol[g.wp];
  const arrived = moveToward(g, target.x, target.y, g.speed, dt);
  if (arrived) g.wp = (g.wp + 1) % g.patrol.length;
}

// Draw a guard: the farmer carries a warm lantern, the dog is low and fast
// with ears that stand up when it is suspicious. "?" floats over a suspicious
// guard, "!" over an alarmed one, and the cone is drawn by main.js.
function drawGuard(ctx, G, g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (g.kind === "farmer") {
    // body + hat
    ctx.fillStyle = "#5a4632";
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7a5c38";
    ctx.beginPath(); ctx.arc(0, -6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a2c1c";
    ctx.beginPath(); ctx.ellipse(0, -11, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    // face
    ctx.fillStyle = "#e8c898";
    ctx.beginPath(); ctx.arc(Math.cos(g.angle) * 4, -6 + Math.sin(g.angle) * 4, 4, 0, Math.PI * 2); ctx.fill();
    // lantern glow in hand
    const lx = Math.cos(g.angle) * 18, ly = Math.sin(g.angle) * 18;
    const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 26);
    glow.addColorStop(0, "rgba(255,200,90,0.9)");
    glow.addColorStop(1, "rgba(255,200,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(lx, ly, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffca55";
    ctx.fillRect(lx - 3, ly - 5, 6, 10);
  } else {
    // dog body, low to the ground, head toward facing
    const hx = Math.cos(g.angle) * 10, hy = Math.sin(g.angle) * 10;
    ctx.fillStyle = "#6b4a2a";
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, g.angle, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7d5a34";
    ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
    // ears: flat when calm, standing tall when alert
    ctx.fillStyle = "#4a3018";
    const earH = g.earsUp ? 9 : 3;
    const px = -Math.sin(g.angle), py = Math.cos(g.angle);
    ctx.beginPath();
    ctx.moveTo(hx + px * 4, hy + py * 4); ctx.lineTo(hx + px * 7 - Math.cos(g.angle) * 2, hy + py * 7 - Math.sin(g.angle) * 2 - earH); ctx.lineTo(hx + px * 1, hy + py * 1);
    ctx.moveTo(hx - px * 4, hy - py * 4); ctx.lineTo(hx - px * 7 - Math.cos(g.angle) * 2, hy - py * 7 - Math.sin(g.angle) * 2 - earH); ctx.lineTo(hx - px * 1, hy - py * 1);
    ctx.fill();
    // nose
    ctx.fillStyle = "#241608";
    ctx.beginPath(); ctx.arc(hx + Math.cos(g.angle) * 6, hy + Math.sin(g.angle) * 6, 2.4, 0, Math.PI * 2); ctx.fill();
    // running legs hint when distracted
    if (g.distract) {
      ctx.strokeStyle = "rgba(255,220,150,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-22, 3); ctx.moveTo(-14, 0); ctx.lineTo(-22, -3); ctx.stroke();
    }
  }
  ctx.restore();
  // "?" / "!" bubble above the guard
  if (g.state !== "calm") {
    ctx.save();
    ctx.font = "900 22px Verdana"; ctx.textAlign = "center";
    const mark = g.state === "alarm" ? "!" : "?";
    ctx.fillStyle = g.state === "alarm" ? "#ff5a3c" : "#ffd97a";
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 4;
    const bx = g.x, by = g.y - 30;
    ctx.strokeText(mark, bx, by);
    ctx.fillText(mark, bx, by);
    ctx.restore();
  }
  // name tag under the guard
  ctx.save();
  ctx.font = "bold 11px Verdana"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  const w = ctx.measureText(g.name).width + 10;
  ctx.fillRect(g.x - w / 2, g.y + 16, w, 15);
  ctx.fillStyle = g.kind === "dog" ? "#e8b06a" : "#ffd97a";
  ctx.fillText(g.name, g.x, g.y + 27);
  ctx.restore();
}
