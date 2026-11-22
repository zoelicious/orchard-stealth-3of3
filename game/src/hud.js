// hud.js — the right-hand field report, the top bar, the banner and the minimap.
// Everything the player needs to read at a glance lives here, in English.

function el(id) { return document.getElementById(id); }

function alarmWord(meter) {
  if (meter >= 75) return "ALARM";
  if (meter >= 55) return "HUNTED";
  if (meter >= 35) return "UNEASY";
  return "CALM";
}

function detectionWord(G) {
  const m = Math.max(G.guards[0].meter, G.guards[1].meter);
  if (m >= 75) return ["SPOTTED!", "bad"];
  if (m >= 55) return ["GLIMPSED", "bad"];
  if (m >= 35) return ["SUSPICIOUS", "warn"];
  return ["CALM", "ok"];
}

function updateHud(G) {
  const m = Math.max(G.guards[0].meter, G.guards[1].meter);
  const [word, cls] = detectionWord(G);
  const det = el("detection");
  det.textContent = word;
  det.className = cls;
  el("alarmWord").textContent = alarmWord(m);
  el("alarmfill").style.width = Math.round(m) + "%";

  const p = G.player;
  const shadow = inShadow(p.x, p.y, G.level);
  const lit = nearLantern(p.x, p.y, G.level);
  const vis = el("visibility");
  vis.textContent = shadow ? "IN SHADOW" : lit ? "LIT BY LANTERN" : "IN THE OPEN";
  vis.className = shadow ? "ok" : "warn";
  const noise = el("noise");
  noise.textContent = !p.moving || p.crouch ? "SILENT" : "SOFT STEPS";
  noise.className = !p.moving || p.crouch ? "ok" : "warn";

  el("baskets").textContent = p.baskets + " / 3";
  el("spotted").textContent = String(G.spotted);
  el("fruitLeft").textContent = "x " + p.fruit;
  const mm = Math.floor(Math.max(0, G.timeLeft) / 60);
  const ss = Math.floor(Math.max(0, G.timeLeft) % 60);
  el("timer").textContent = mm + ":" + String(ss).padStart(2, "0");
  el("timer").style.color = G.timeLeft < 30 ? "#ff6b5e" : "#ffd97a";
  el("strikes").textContent = "●".repeat(3 - G.strikes) + "○".repeat(G.strikes);
  el("score").textContent = String(G.score);

  const roster = (g) => {
    const d = Math.round(Math.hypot(g.x - p.x, g.y - p.y) / 40);
    const status = g.distract ? "Distracted" : g.state === "alarm" ? "Hunting you" : g.state === "suspicious" ? "Suspicious" : "Patrolling";
    return status + " — " + d + "m";
  };
  el("rFarmer").textContent = roster(G.guards[0]);
  el("rDog").textContent = roster(G.guards[1]);

  drawMinimap(G);
}

function drawMinimap(G) {
  const cv = el("minimap");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const sx = cv.width / WORLD_W, sy = cv.height / WORLD_H;
  ctx.fillStyle = "#10160e";
  ctx.fillRect(0, 0, cv.width, cv.height);
  // tree rows
  ctx.fillStyle = "#2c4d28";
  for (const t of G.level.trees) {
    ctx.beginPath(); ctx.arc(t.x * sx, t.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // grass
  ctx.fillStyle = "#3f6b3a";
  for (const g of G.level.grass) ctx.fillRect(g.x * sx, g.y * sy, g.w * sx, g.h * sy);
  // gate
  ctx.fillStyle = G.level.gate.open ? "#9fe870" : "#4a7a3a";
  ctx.fillRect(G.level.gate.x * sx, G.level.gate.y * sy, 12, 10);
  // guards
  ctx.fillStyle = "#ffc95e";
  for (const g of G.guards) { ctx.beginPath(); ctx.arc(g.x * sx, g.y * sy, 3.4, 0, Math.PI * 2); ctx.fill(); }
  // player
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(G.player.x * sx, G.player.y * sy, 3.4, 0, Math.PI * 2); ctx.fill();
}

let bannerTimer = null;
function showBanner(G, text, ms) {
  const b = el("banner");
  b.textContent = text;
  b.classList.remove("hidden");
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add("hidden"), ms || 1800);
}

function endGame(G, win, reason) {
  if (G.over) return;
  G.over = true;
  const card = el("endcard");
  const title = el("endTitle");
  const text = el("endText");
  if (win) {
    const ghost = G.spotted === 0;
    if (ghost) G.score += 500;
    title.textContent = "ESCAPED!";
    title.style.color = "#9fe870";
    text.innerHTML = "Wren slips through the green gate with all three baskets.<br>" +
      (ghost ? "Unseen the whole night — <b>GHOST BONUS +500</b>." : "Spotted " + G.spotted + " time(s) — no ghost bonus this night.") +
      "<br>Final score: <b>" + G.score + "</b><br>" + reason;
    updateHud(G);
  } else {
    title.textContent = "CAUGHT";
    title.style.color = "#ff6b5e";
    text.textContent = reason + " Final score: " + G.score + ".";
  }
  card.classList.remove("hidden");
}
