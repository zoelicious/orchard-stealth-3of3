// shots.js — staged scenes for the four screenshots. Each shot freezes the
// patrols in a composed pose (the timer still ticks) so the cover reads at a
// glance: a near miss, a patrol among fireflies, a branch-shake distraction,
// and the victory at the green gate. Normal play (no ?shot=) is untouched.

function applyShot(G, n) {
  G.staged = true;
  G.stagedShot = n;
  const p = G.player;
  const farmer = G.guards[0];
  const dog = G.guards[1];
  const lv = G.level;
  const tree2 = lv.trees.find((t) => t.marked && t.x === 620);
  const tree1 = lv.trees.find((t) => t.marked && t.x === 300);
  const tree3 = lv.trees.find((t) => t.marked && t.x === 180);

  if (n === 1) {
    // COVER — near miss: Wren crouched behind the haystack, the farmer's cone
    // sweeping past, the dog distracted by fallen fruit with a "?" overhead.
    G.timeLeft = 72; // 1:12
    p.baskets = 1; if (tree1) tree1.picked = true;
    p.x = 415; p.y = 278; p.crouch = true; p.angle = Math.PI / 2;
    farmer.x = 560; farmer.y = 300; farmer.angle = Math.PI; farmer.meter = 48; farmer.state = "suspicious";
    dog.x = 540; dog.y = 185; dog.angle = Math.PI / 2; dog.meter = 52; dog.state = "suspicious"; dog.earsUp = true;
    dog.distract = { x: 555, y: 215, t: 99 };
    if (tree2) tree2.shake = 1;
    lv.fallenFruit = [
      { x: 540, y: 205, t: 99, eaten: false, fall: 0 },
      { x: 565, y: 218, t: 99, eaten: false, fall: 0 },
      { x: 528, y: 222, t: 99, eaten: false, fall: 0 },
    ];
    G.spotted = 0; G.strikes = 0;
    showBanner(G, "WHAT WAS THAT?", 60000);
  } else if (n === 2) {
    // PATROL + FIREFLIES: Wren on the safe shadow path, both guards on route.
    G.timeLeft = 140; // 2:20
    p.baskets = 0;
    p.x = 330; p.y = 640; p.crouch = false; p.angle = 0;
    farmer.x = 300; farmer.y = 330; farmer.angle = 0; farmer.meter = 8; farmer.state = "calm";
    dog.x = 700; dog.y = 520; dog.angle = Math.PI; dog.meter = 4; dog.state = "calm";
    dog.distract = null; dog.earsUp = false;
    G.spotted = 0; G.strikes = 0;
  } else if (n === 3) {
    // BRANCH-SHAKE: Wren shaking apple tree 2, fruit falling, the dog sprinting
    // to the fruit with ears up and a "?", the farmer turning suspicious.
    G.timeLeft = 105; // 1:45
    p.baskets = 2;
    if (tree1) tree1.picked = true;
    if (tree3) tree3.picked = true;
    p.x = 585; p.y = 398; p.crouch = false; p.angle = -Math.PI / 2;
    if (tree2) tree2.shake = 1;
    farmer.x = 400; farmer.y = 330; farmer.angle = 0; farmer.meter = 44; farmer.state = "suspicious";
    dog.x = 700; dog.y = 330; dog.angle = Math.PI; dog.meter = 40; dog.state = "suspicious"; dog.earsUp = true;
    dog.distract = { x: 640, y: 372, t: 99 };
    lv.fallenFruit = [
      { x: 620, y: 368, t: 99, eaten: false, fall: 0.35 },
      { x: 640, y: 372, t: 99, eaten: false, fall: 0.1 },
      { x: 606, y: 360, t: 99, eaten: false, fall: 0.6 },
    ];
    G.spotted = 0; G.strikes = 0;
    showBanner(G, "SHAKE THE BRANCH — THE DOG HEARS FRUIT FALL", 60000);
  } else if (n === 4) {
    // VICTORY: all three baskets full, the green gate open, Wren slipping out.
    G.timeLeft = 47; // 0:47
    p.baskets = 3;
    for (const t of lv.trees) if (t.marked) t.picked = true;
    lv.gate.open = true;
    p.x = 905; p.y = 648; p.crouch = false; p.angle = 0;
    farmer.x = 300; farmer.y = 140; farmer.angle = Math.PI; farmer.meter = 5; farmer.state = "calm";
    dog.x = 700; dog.y = 520; dog.angle = 0; dog.meter = 2; dog.state = "calm";
    dog.distract = null; dog.earsUp = false;
    G.spotted = 0; G.strikes = 0; G.score = 300;
    showBanner(G, "ESCAPED UNSEEN — GHOST BONUS +500", 60000);
  }
}
