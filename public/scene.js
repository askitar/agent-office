'use strict';
// Escena: dos alas (Agencia y Askitar), props, fondo estatico y dibujo de personajes (todo con codigo, pixel art).

const T = 16, WCOLS = 40, COLS = 80, ROWS = 26, W = COLS * T, H = ROWS * T;
const INK = '#1b1620';

function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- personajes
const LOOKS = {
  michael:  { skin: '#f2c9a5', hair: '#6b4a2b', hs: 'slick', jacket: '#27324f', shirt: '#ffffff', tie: '#c0242f', pants: '#27324f' },
  jan:      { skin: '#f3cfae', hair: '#2a1a12', hs: 'quiff', jacket: '#2a2a3a', shirt: '#c9a0e0', skirt: '#2a2a3a' },
  dwight:   { skin: '#efc39a', hair: '#4a3220', hs: 'bowl',  shirt: '#c9a227', tie: '#5b3a1e', pants: '#6b5a3a', glasses: true },
  jim:      { skin: '#f0c7a0', hair: '#7a5230', hs: 'messy', shirt: '#5a7da6', tie: '#2d3a52', pants: '#3a4048' },
  pam:      { skin: '#f3cfae', hair: '#b5642e', hs: 'long',  shirt: '#e8a0b5', skirt: '#6b6f86' },
  ryan:     { skin: '#d9a87c', hair: '#201a18', hs: 'quiff', jacket: '#1f2430', shirt: '#e9e9e9', tie: '#111111', pants: '#1f2430' },
  angela:   { skin: '#f5d2b3', hair: '#e8cf7a', hs: 'bun',   shirt: '#b9a3d6', skirt: '#7b6f93' },
  kelly:    { skin: '#c58c5e', hair: '#1d1411', hs: 'long',  shirt: '#e85a7c', skirt: '#2b2b38' },
  andy:     { skin: '#f1c9a6', hair: '#c0562a', hs: 'short', shirt: '#2e6f4f', pants: '#cbb68a' },
  erin:     { skin: '#f3cfae', hair: '#6a4528', hs: 'long',  shirt: '#f2d04a', skirt: '#4a5a7a' },
  kevin:    { skin: '#e9bf98', hair: '#3b2a1c', hs: 'thin',  shirt: '#8a8f99', pants: '#41454f', wide: true },
  toby:     { skin: '#f0c7a0', hair: '#d2b878', hs: 'thin',  shirt: '#a88f6a', pants: '#4b4638', glasses: true },
  phyllis:  { skin: '#f1cfb2', hair: '#8c8c9a', hs: 'curly', shirt: '#8f5fb0', skirt: '#4a3f5a' },
  stanley:  { skin: '#8a5a3a', hair: '#1a1a1a', hs: 'bald',  jacket: '#6f737b', shirt: '#dddddd', tie: '#7f2a2a', pants: '#4a4d55', stache: true, wide: true },
  creed:    { skin: '#e6c3a1', hair: '#cfd2d6', hs: 'wild',  jacket: '#5c6a3d', shirt: '#d8d3c4', pants: '#4a4a3a' },
  meredith: { skin: '#f0c7a0', hair: '#c44a2a', hs: 'curly', shirt: '#2a2630', skirt: '#3a3446' },
  darryl:   { skin: '#7a4c32', hair: '#141010', hs: 'short', shirt: '#3a6fb0', pants: '#3a3a44' },
  gabe:     { skin: '#f2d2b6', hair: '#2a2a3a', hs: 'quiff', shirt: '#5b5fc7', tie: '#e0e0e0', pants: '#2c2f44' },
  holly:    { skin: '#f0c7a0', hair: '#d8a84a', hs: 'long',  shirt: '#d46a6a', skirt: '#5a4a6a' },
  pete:     { skin: '#e0b48a', hair: '#3a2a1a', hs: 'short', shirt: '#4a6a5a', pants: '#3a3a3a', glasses: true },
  clark:    { skin: '#d0a070', hair: '#222222', hs: 'thin',  shirt: '#7a7a8a', pants: '#3a3d4a' },
  nellie:   { skin: '#f5d2b3', hair: '#8a4a2a', hs: 'bun',   shirt: '#2a8a8a', skirt: '#2a3a4a' },
  roy:      { skin: '#e9bf98', hair: '#5a4030', hs: 'short', shirt: '#6a6a6a', pants: '#34363e', wide: true },
  hide:     { skin: '#e8c8a0', hair: '#111111', hs: 'bowl',  shirt: '#c85a5a', pants: '#2a2a34', glasses: true },
  jo:       { skin: '#a8734a', hair: '#222222', hs: 'curly', shirt: '#e8e0b0', skirt: '#3a5a4a' },
  wally:    { skin: '#f0c7a0', hair: '#999999', hs: 'thin',  jacket: '#555566', shirt: '#eeeeee', tie: '#333366', pants: '#555566' },
};

const HAIR = {
  short: { top: [[-5, -26, 10, 4]], sides: [[-5, -22, 2, 3], [3, -22, 2, 3]] },
  slick: { top: [[-5, -26, 10, 4]], sides: [[-5, -22, 2, 2], [3, -22, 2, 2]] },
  bowl:  { top: [[-6, -26, 12, 5]], sides: [[-6, -21, 2, 3], [4, -21, 2, 3]] },
  messy: { top: [[-5, -26, 10, 4], [-5, -28, 3, 2], [0, -28, 4, 2], [-2, -29, 2, 1]], sides: [[-5, -22, 2, 3], [3, -22, 2, 3]] },
  long:  { top: [[-5, -26, 10, 4]], sides: [[-6, -25, 2, 13], [4, -25, 2, 13]], back: [-5, -26, 10, 14] },
  bun:   { top: [[-5, -26, 10, 4], [-2, -30, 4, 4]], sides: [[-5, -22, 2, 3], [3, -22, 2, 3]] },
  quiff: { top: [[-5, -26, 10, 4], [-3, -28, 7, 2]], sides: [[-5, -22, 2, 2], [3, -22, 2, 2]] },
  thin:  { top: [[-4, -26, 8, 2]], sides: [[-5, -23, 1, 4], [4, -23, 1, 4]] },
  curly: { top: [[-6, -27, 12, 6]], sides: [[-6, -21, 2, 4], [4, -21, 2, 4]] },
  bald:  { top: [], sides: [[-5, -22, 1, 3], [4, -22, 1, 3]], noBack: true },
  wild:  { top: [[-6, -28, 12, 7], [-7, -26, 2, 3], [5, -26, 2, 3], [-3, -30, 2, 2], [1, -30, 3, 2]], sides: [[-6, -22, 2, 3], [4, -22, 2, 3]] },
};

function charRects(L, dir, pose, tm, sleeping) {
  const r = [];
  const P = (x, y, w, h, col) => r.push([x, y, w, h, col]);
  const running = pose === 'run';
  const walking = pose === 'walk' || running;
  const sitting = pose === 'sit' || pose === 'type' || pose === 'sleepdesk';
  const step = walking ? (Math.floor(tm * (running ? 13 : 7)) % 2) : 0;
  const tw = L.wide ? 12 : 10;
  const body = L.jacket || L.shirt || '#888';
  const legCol = L.skirt ? L.skin : (L.pants || '#444');
  const shoe = '#2a2230';
  const side = dir === 'left' || dir === 'right';
  const sx = dir === 'left' ? -1 : 1;
  const H_ = HAIR[L.hs] || HAIR.short;
  const hair = L.hair;

  // ----- piernas
  if (!sitting) {
    if (!side) {
      const lift = [step ? 1 : 0, step ? 0 : 1];
      P(-4, -6 + lift[0], 4, 6 - lift[0], legCol); P(0, -6 + lift[1], 4, 6 - lift[1], legCol);
      P(-4, -1 - lift[0], 4, 1, shoe); P(0, -1 - lift[1], 4, 1, shoe);
      if (!L.skirt) P(0, -6, 1, 5, 'rgba(0,0,0,.25)');
    } else {
      const o = walking ? (step ? (running ? 3 : 2) : (running ? -3 : -2)) : 0;
      P(-3 + o, -6, 3, 6, legCol); P(0 - o, -6, 3, 6, legCol);
      P(-3 + o + (sx > 0 ? 0 : -1), -1, 4, 1, shoe); P(0 - o + (sx > 0 ? 0 : -1), -1, 4, 1, shoe);
    }
  } else {
    P(-4, -3, 4, 3, legCol); P(0, -3, 4, 3, legCol);
    if (side) P(sx > 0 ? 0 : -6, -3, 6, 2, legCol);
    P(-4, -1, 4, 1, shoe); P(0, -1, 4, 1, shoe);
  }
  if (L.skirt) P(-5, -9, 10, 4, L.skirt);

  // ----- torso
  const tx = side ? -4 : -tw / 2, twid = side ? 8 : tw;
  P(tx, -16, twid, 10, body);
  if (!side && dir === 'down') {
    if (L.jacket) P(-2, -16, 4, 6, L.shirt);
    if (L.tie) P(-1, -15, 2, 7, L.tie);
    else P(-2, -16, 4, 1, 'rgba(255,255,255,.5)');
  }
  if (!side && dir === 'up' && L.jacket) P(-1, -16, 2, 9, 'rgba(0,0,0,.15)');

  // ----- brazos
  const sw = walking ? (step ? (running ? 2 : 1) : (running ? -2 : -1)) : 0;
  if (!side) {
    if (pose === 'type') {
      const a = Math.floor(tm * 9) % 2;
      P(-tw / 2 - 2, -15, 2, 6, body); P(tw / 2, -15, 2, 6, body);
      P(-tw / 2, -10 + (a ? 0 : 1), 3, 2, body); P(tw / 2 - 3, -10 + (a ? 1 : 0), 3, 2, body);
      P(-tw / 2 + 2, -9 + (a ? 0 : 1), 2, 2, L.skin); P(tw / 2 - 4, -9 + (a ? 1 : 0), 2, 2, L.skin);
    } else if (pose === 'sit' || pose === 'sleepdesk') {
      P(-tw / 2 - 2, -15, 2, 7, body); P(tw / 2, -15, 2, 7, body);
      P(-tw / 2 - 2, -9, 2, 2, L.skin); P(tw / 2, -9, 2, 2, L.skin);
    } else if (running) {
      P(-tw / 2 - 2, -16 + sw, 2, 6, body); P(tw / 2, -16 - sw, 2, 6, body);
      P(-tw / 2 - 2, -11 + sw, 2, 2, L.skin); P(tw / 2, -11 - sw, 2, 2, L.skin);
    } else {
      P(-tw / 2 - 2, -15 + sw, 2, 7, body); P(tw / 2, -15 - sw, 2, 7, body);
      P(-tw / 2 - 2, -9 + sw, 2, 2, L.skin); P(tw / 2, -9 - sw, 2, 2, L.skin);
    }
  } else {
    const o = walking ? (step ? 2 : -2) : 0;
    if (pose === 'type') {
      const a = Math.floor(tm * 9) % 2;
      P(sx > 0 ? -1 : -2, -15, 3, 5, body); P(sx > 0 ? 2 : -5, -11 + (a ? 0 : 1), 3, 2, body); P(sx > 0 ? 4 : -7, -10 + (a ? 0 : 1), 2, 2, L.skin);
    } else {
      P(-1 + o, -15, 3, 7, body); P(-1 + o, -9, 3, 2, L.skin);
    }
  }

  // ----- cabeza
  P(-5, -25, 10, 10, L.skin);
  const eye = (x, y) => { if (sleeping) P(x - 1, y + 1, 3, 1, INK); else P(x, y, 1, 2, INK); };
  if (dir === 'down') {
    for (const q of H_.top) P(q[0], q[1], q[2], q[3], hair);
    for (const q of H_.sides) P(q[0], q[1], q[2], q[3], hair);
    if (L.hs === 'bowl' || L.hs === 'long' || L.hs === 'quiff') P(-5, -23, 10, 1, hair);
    if (L.glasses) {
      const g = '#2a2230';
      P(-4, -22, 4, 1, g); P(-4, -19, 4, 1, g); P(-4, -22, 1, 4, g); P(-1, -22, 1, 4, g);
      P(1, -22, 4, 1, g); P(1, -19, 4, 1, g); P(1, -22, 1, 4, g); P(4, -22, 1, 4, g); P(0, -21, 1, 1, g);
    }
    eye(-3, -21); eye(2, -21);
    if (sleeping) P(-1, -17, 2, 2, '#a8553f'); else P(-1, -17, 2, 1, '#a8553f');
    if (L.stache) P(-3, -18, 6, 1, hair);
    if (!L.glasses && !L.stache) { P(-4, -18, 1, 1, 'rgba(255,120,120,.35)'); P(3, -18, 1, 1, 'rgba(255,120,120,.35)'); }
    if (L.hs === 'long') for (const q of H_.sides) P(q[0], q[1], q[2], q[3], hair);
  } else if (dir === 'up') {
    if (!H_.noBack) { const b = H_.back || [-5, -26, 10, 11]; P(b[0], b[1], b[2], b[3], hair); }
    for (const q of H_.top) P(q[0], q[1], q[2], q[3], hair);
    for (const q of H_.sides) P(q[0], q[1], q[2], q[3], hair);
  } else {
    for (const q of H_.top) P(q[0], q[1], q[2], q[3], hair);
    const bx = sx > 0 ? -5 : 0;
    if (!H_.noBack) P(bx, -23, 5, L.hs === 'long' ? 13 : 6, hair); else P(bx, -22, 1, 3, hair);
    if (L.hs === 'bowl') P(sx > 0 ? 1 : -6, -22, 5, 2, hair);
    eye(sx > 0 ? 2 : -3, -21);
    if (L.glasses) { const g = '#2a2230', gx = sx > 0 ? 1 : -4; P(gx, -22, 4, 1, g); P(gx, -19, 4, 1, g); P(gx, -22, 1, 4, g); P(gx + 3, -22, 1, 4, g); P(sx > 0 ? -4 : 1, -21, 5, 1, g); }
    P(sx > 0 ? 3 : -4, -17, 2, 1, '#a8553f');
    if (L.stache) P(sx > 0 ? 2 : -5, -18, 3, 1, hair);
  }
  return r;
}

const FOODS = {
  sandwich: (c, x, y) => { R(c, x, y, 7, 5, INK); R(c, x + 1, y + 1, 5, 1, '#e6c27a'); R(c, x + 1, y + 2, 5, 1, '#5fbf5f'); R(c, x + 1, y + 3, 5, 1, '#e6c27a'); },
  donut: (c, x, y) => { R(c, x, y, 7, 6, INK); R(c, x + 1, y + 1, 5, 4, '#f08ab4'); R(c, x + 3, y + 2, 1, 2, INK); },
  apple: (c, x, y) => { R(c, x + 1, y, 5, 6, INK); R(c, x + 2, y + 1, 3, 4, '#d6342c'); R(c, x + 3, y - 1, 1, 2, '#3f9b4f'); },
  pizza: (c, x, y) => { R(c, x, y, 8, 5, INK); R(c, x + 1, y + 1, 6, 3, '#f0b840'); R(c, x + 2, y + 2, 1, 1, '#c0392b'); R(c, x + 5, y + 2, 1, 1, '#c0392b'); },
  chips: (c, x, y) => { R(c, x, y - 1, 6, 8, INK); R(c, x + 1, y, 4, 6, '#3a7bd5'); R(c, x + 2, y + 2, 2, 2, '#f5e04a'); },
  salad: (c, x, y) => { R(c, x, y + 1, 8, 5, INK); R(c, x + 1, y + 2, 6, 3, '#e8e8e8'); R(c, x + 2, y + 1, 4, 2, '#4cb35e'); R(c, x + 4, y + 1, 1, 1, '#d6342c'); },
};

function drawChar(c, a) {
  const L = LOOKS[a.id] || LOOKS.kevin;
  const pose = a.pose;
  const sleeping = !!a.sleeping || pose === 'sleepdesk';
  const rects = charRects(L, a.dir, pose === 'fall' ? 'stand' : pose, a.anim, sleeping);
  c.save();
  c.translate(Math.round(a.x), Math.round(a.y));
  c.globalAlpha = a.alpha == null ? 1 : a.alpha;
  const lying = pose === 'fall';
  if (pose !== 'sit' && pose !== 'type' && pose !== 'sleepdesk') R(c, lying ? -12 : -5, -1, lying ? 24 : 10, 2, 'rgba(0,0,0,.22)');
  let bob = 0;
  if (pose === 'walk') bob = (Math.floor(a.anim * 7) % 2) ? -1 : 0;
  else if (pose === 'run') bob = (Math.floor(a.anim * 13) % 2) ? -2 : 0;
  else if (pose === 'stand') bob = (Math.floor(a.anim * 1.6) % 2) ? -1 : 0;
  else if (pose === 'type') bob = (Math.floor(a.anim * 3) % 2) ? -1 : 0;
  else if (a.eating) bob = (Math.floor(a.anim * 4) % 2) ? -1 : 0;
  else if (pose === 'sleepdesk') bob = 7 + ((Math.floor(a.anim * .8) % 2) ? 1 : 0);
  else if (sleeping) bob = 1 + ((Math.floor(a.anim * .8) % 2) ? 1 : 0);
  c.translate(0, bob);
  if (lying) { c.translate(0, -1); c.rotate((a.fallDir || 1) * Math.PI / 2); }
  else if (pose === 'run') c.translate(a.dir === 'left' ? -1 : (a.dir === 'right' ? 1 : 0), 0);
  for (const q of rects) R(c, q[0] - 1, q[1] - 1, q[2] + 2, q[3] + 2, INK);
  for (const q of rects) R(c, q[0], q[1], q[2], q[3], q[4]);
  if (a.carry) {
    const hx = a.dir === 'left' ? -11 : 6;
    R(c, hx - 1, -14, 8, 9, INK); R(c, hx, -13, 6, 7, '#f7f7f2'); R(c, hx + 1, -11, 4, 1, '#9aa'); R(c, hx + 1, -9, 4, 1, '#9aa');
  }
  if (a.mug) {
    const hx = a.dir === 'left' ? -9 : 6;
    R(c, hx - 1, -12, 6, 7, INK); R(c, hx, -11, 4, 5, '#ffffff'); R(c, hx + 4, -10, 2, 3, '#ffffff'); R(c, hx, -11, 4, 1, '#7a4a2a');
  }
  if (a.food && FOODS[a.food]) {
    const fx = a.dir === 'left' ? -9 : (a.dir === 'right' ? 3 : -3);
    FOODS[a.food](c, fx, -10);
  }
  c.restore();
  if (lying) { // estrellitas
    const t = a.anim * 6;
    for (let i = 0; i < 3; i++) { const an = t + i * 2.1; R(c, Math.round(a.x + Math.cos(an) * 9) - 1, Math.round(a.y - 28 + Math.sin(an) * 3) - 1, 3, 3, '#ffd23f'); }
  }
}

// ---------------------------------------------------------------- mapa
const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
function block(x, y, w = 1, h = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (blocked[j] && i >= 0 && i < COLS) blocked[j][i] = true; }

const DESKS = {};        // 'dept.id' -> {key, dept, id, sx, sy, w, tx, ty, x, y}
const DESK_IDS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4'];
const seatTiles = new Set();
const PROPS = [];
const SPOTS = {};        // dept -> spots
const ROOMS = {};        // dept -> [{id,label,rect:[x,y,w,h] en pixeles de mundo}]
const SIGNS = [];        // letreros DOM
function addProp(sortY, draw) { PROPS.push({ sortY, draw }); }

const THEMES = {
  agency: {
    wall: '#dcd5c2', wallTop: '#efe9d8', wallShade: '#b5ad98', wallSide: '#cfc7b2', face2: '#d6d0be',
    carpet: ['#6d7a8c', '#647183', '#78869a'], wood: ['#b3834f', '#9c6d3d'], conf: ['#4b566b', '#434e62', '#566278'],
    rug: ['#7a4a3a', '#8e5a46'], sign: { bg: '#1f3a6b', hi: '#3b5fa8', txt: 'AGENCIA MGMT', col: '#ffffff' }, windows: true,
    glassTint: 'rgba(190,225,240,.5)', mat: ['#7b3b3b', '#8f4a4a'],
  },
  askitar: {
    wall: '#3b3656', wallTop: '#4d4770', wallShade: '#26233b', wallSide: '#312d4b', face2: '#35304e',
    carpet: ['#4a4266', '#413a5c', '#554d74'], wood: ['#7a5a48', '#664a3a'], conf: ['#2a2540', '#241f38', '#322c4c'],
    rug: ['#2a5a6a', '#357080'], sign: { bg: '#12121c', hi: '#ff3fa4', txt: 'ASKITAR STUDIO', col: '#ff7fc8' }, windows: false,
    glassTint: 'rgba(160,190,240,.4)', mat: ['#6a2a5a', '#843a70'],
  },
};
const WINGS = [{ name: 'agency', ox: 0, theme: THEMES.agency }, { name: 'askitar', ox: 40, theme: THEMES.askitar }];

const DESK_STYLES = {
  std:  { top: '#c99a62', hi: '#ddb583', edge: '#8f6338', front: '#a77a47', drawer: '#8f6338' },
  boss: { top: '#6a4630', hi: '#85583b', edge: '#3d261a', front: '#573824', drawer: '#3d261a' },
  rec:  { top: '#e6e2d6', hi: '#ffffff', edge: '#a9a493', front: '#7c8a9a', drawer: '#66727f' },
  neon: { top: '#3d3a52', hi: '#6a64a0', edge: '#1f1c30', front: '#2c2940', drawer: '#1f1c30' },
};

function seatPos(d) { return { x: d.sx * T + 8, y: (d.sy + 1) * T + 5 }; }

function drawDeskSprite(c, px, py, w, st, active, extra) {
  const Wd = w * T;
  R(c, px, py, Wd, 8, st.top); R(c, px, py, Wd, 1, st.hi); R(c, px, py + 7, Wd, 1, st.edge);
  R(c, px, py + 8, Wd, 8, st.front); R(c, px, py + 15, Wd, 1, '#00000055');
  R(c, px, py + 8, 1, 8, st.edge); R(c, px + Wd - 1, py + 8, 1, 8, st.edge);
  R(c, px + Wd - 20, py + 10, 16, 5, st.drawer); R(c, px + Wd - 14, py + 12, 4, 1, '#d8c7a0');
  const mx = px + 3;
  R(c, mx, py - 7, 13, 11, '#242832'); R(c, mx + 1, py - 6, 11, 9, '#323744'); R(c, mx + 5, py + 4, 3, 2, '#242832');
  R(c, mx + 10, py + 1, 1, 1, active ? '#3ddc84' : '#c0392b');
  if (active) { c.fillStyle = 'rgba(120,180,255,.22)'; c.fillRect(mx - 1, py + 4, 15, 3); R(c, mx + 2, py - 5, 7, 1, 'rgba(120,180,255,.35)'); }
  R(c, px + Wd - 12, py + 2, 8, 5, '#f4f4ee'); R(c, px + Wd - 11, py + 3, 5, 1, '#99a'); R(c, px + Wd - 11, py + 5, 4, 1, '#99a');
  if (extra === 'mug') { R(c, px + Wd - 20, py + 1, 4, 5, '#fff'); R(c, px + Wd - 19, py + 2, 2, 1, '#c0242f'); }
  if (extra === 'plant') { R(c, px + Wd - 21, py + 2, 4, 4, '#b5651d'); R(c, px + Wd - 22, py - 3, 6, 5, '#3f9b4f'); }
  if (extra === 'bell') { R(c, px + Wd - 22, py + 3, 5, 3, '#d4af37'); R(c, px + Wd - 21, py + 1, 3, 2, '#e8c75a'); }
  if (extra === 'mic') { R(c, px + Wd - 20, py - 4, 2, 7, '#444'); R(c, px + Wd - 22, py - 7, 6, 4, '#222'); R(c, px + Wd - 21, py - 6, 4, 2, '#777'); }
}

function pot(c, x, y, col) { R(c, x + 4, y + 8, 8, 6, '#b5651d'); R(c, x + 4, y + 8, 8, 1, '#d27c2e'); R(c, x + 2, y - 2, 12, 11, col || '#3f9b4f'); R(c, x + 4, y - 6, 8, 6, '#4cb35e'); R(c, x + 6, y - 9, 4, 4, '#4cb35e'); R(c, x + 3, y + 2, 3, 3, '#2f7a3c'); }

function drawCouch(c, x, y, w, base, light, dark) {
  R(c, x, y - 8, w, 26, INK); R(c, x + 1, y - 7, w - 2, 12, base); R(c, x + 1, y + 4, w - 2, 12, light);
  R(c, x + 1, y - 7, w - 2, 2, light);
  const n = Math.floor((w - 8) / 22);
  for (let i = 0; i < Math.max(1, n); i++) R(c, x + 4 + i * 22, y + 5, 19, 10, dark);
  R(c, x, y - 2, 4, 18, base); R(c, x + w - 4, y - 2, 4, 18, base);
}

function buildWing(w) {
  const ox = w.ox, name = w.name, th = w.theme, g = (x) => x + ox;
  const isAsk = name === 'askitar';
  const key = (id) => name + '.' + id;
  const px = (tx) => (tx + ox) * T;

  // ---- bloqueos
  block(g(0), 0, WCOLS, 2); block(g(0), 2, 1, 22); block(g(39), 2, 1, 22);
  block(g(0), 24, 19, 2); block(g(22), 24, 18, 2);
  block(g(11), 2, 1, 7); block(g(1), 9, 4, 1); block(g(7), 9, 5, 1);
  block(g(28), 2, 1, 5); block(g(28), 9, 1, 2); block(g(29), 10, 10, 1);
  block(g(1), 13, 11, 2);
  block(g(29), 16, 4, 2); block(g(35), 16, 4, 2);

  function addDesk(id, sx, sy, wd, style, extra) {
    const x0 = sx - Math.floor(wd / 2);
    const d = { key: key(id), dept: name, id, sx: g(sx), sy, w: wd, tx: g(sx), ty: sy };
    Object.assign(d, seatPos(d));
    DESKS[d.key] = d; seatTiles.add(d.tx + ',' + d.ty);
    block(g(x0), sy + 1, wd, 1);
    const st = DESK_STYLES[style || 'std'];
    addProp(d.y - 1, (c) => { const cx = d.x; R(c, cx - 8, d.y - 20, 16, 15, INK); R(c, cx - 7, d.y - 19, 14, 13, isAsk ? '#5a3a6a' : '#3a3f4e'); R(c, cx - 7, d.y - 19, 14, 2, isAsk ? '#7a5a8a' : '#4d5466'); });
    addProp((sy + 2) * T, (c, S) => drawDeskSprite(c, g(x0) * T, (sy + 1) * T, wd, st, !!(S && S.deskActive && S.deskActive[d.key]), extra));
  }
  function addBox(x, y, wd, h, up, drawFn, sortAdj) {
    block(g(x), y, wd, h);
    addProp((y + h) * T + (sortAdj || 0), (c, S, tm) => drawFn(c, g(x) * T, y * T, wd * T, h * T, up, S, tm));
  }

  // ---- escritorios
  addDesk('M', 6, 4, 5, isAsk ? 'neon' : 'boss', isAsk ? 'mic' : 'mug');
  const rowsY = { A: 4, B: 9, C: 14 }, xs = [14, 18, 22, 26];
  for (const r of ['A', 'B', 'C']) xs.forEach((x, i) => addDesk(r + (i + 1), x, rowsY[r], 3, isAsk ? 'neon' : 'std', i % 3 === 0 ? 'mug' : (i % 3 === 1 ? 'plant' : null)));
  addDesk('R1', 20, 20, 3, 'rec', 'bell');

  // ---- gerencia
  addBox(1, 2, 3, 1, 22, (c, x, y, wd) => {
    R(c, x, y - 22, wd, 38, INK); R(c, x + 1, y - 21, wd - 2, 36, isAsk ? '#3a2a55' : '#7a5230');
    for (let s = 0; s < 3; s++) {
      R(c, x + 2, y - 19 + s * 11, wd - 4, 9, isAsk ? '#241838' : '#4a2f1a');
      const cols = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#ecf0f1'];
      for (let k = 0; k < 9; k++) R(c, x + 3 + k * 5, y - 18 + s * 11 + (k % 3), 4, 8 - (k % 3), cols[(k + s) % cols.length]);
    }
    if (isAsk) { R(c, x + 30, y - 17, 10, 8, '#d4af37'); R(c, x + 33, y - 15, 4, 4, '#b8312f'); }
  });
  addBox(8, 7, 3, 1, 8, (c, x, y, wd) => drawCouch(c, x, y, wd, isAsk ? '#5a3a8a' : '#8c4a3a', isAsk ? '#6e4aa0' : '#a85a48', isAsk ? '#7e5ab4' : '#b86a56'));
  addBox(10, 2, 1, 1, 8, (c, x, y) => pot(c, x, y - 4));
  addBox(1, 8, 1, 1, 8, (c, x, y) => pot(c, x, y - 4));

  // ---- pasillo
  addBox(12, 3, 1, 1, 8, (c, x, y) => pot(c, x, y - 4));
  addBox(27, 11, 1, 1, 8, (c, x, y) => pot(c, x, y - 2));
  addBox(12, 12, 1, 1, 8, (c, x, y) => pot(c, x, y - 2));
  addBox(17, 22, 1, 1, 8, (c, x, y) => pot(c, x, y - 2));
  addBox(23, 22, 1, 1, 8, (c, x, y) => pot(c, x, y - 2));

  // ---- sala de juntas / estudio
  const meeting = [];
  if (!isAsk) {
    addBox(31, 5, 6, 2, 0, (c, x, y, wd, h) => {
      R(c, x, y, wd, h, INK); R(c, x + 1, y + 1, wd - 2, 22, '#7b5233'); R(c, x + 1, y + 1, wd - 2, 2, '#946440'); R(c, x + 1, y + 23, wd - 2, 8, '#5a3a22');
      R(c, x + 40, y + 9, 16, 5, '#2b2f3a'); R(c, x + 44, y + 10, 8, 3, '#3b404d');
      R(c, x + 8, y + 6, 8, 6, '#f4f4ee'); R(c, x + 72, y + 12, 8, 6, '#f4f4ee'); R(c, x + 20, y + 14, 5, 5, '#fff');
    });
    for (const [sx_, sy_] of [[31, 4], [33, 4], [35, 4], [31, 7], [33, 7], [35, 7], [30, 5], [37, 6]]) {
      addProp(sy_ * T + 10, (c) => { R(c, g(sx_) * T + 3, sy_ * T + 3, 10, 11, '#262a35'); R(c, g(sx_) * T + 4, sy_ * T + 4, 8, 4, '#3a3f4e'); });
    }
    meeting.push(...[[31, 4, 'down'], [33, 4, 'down'], [35, 4, 'down'], [31, 7, 'up'], [33, 7, 'up'], [35, 7, 'up'], [30, 5, 'right'], [37, 6, 'left']].map(([x, y, d]) => ({ x: g(x), y, dir: d, sit: 1, py: d === 'down' ? (y + 1) * T + 5 : y * T + 12 })));
    addBox(38, 2, 1, 1, 8, (c, x, y) => pot(c, x, y - 4));
    addBox(29, 2, 1, 1, 8, (c, x, y) => pot(c, x, y - 4));
  } else {
    // estudio de grabacion
    addBox(32, 6, 3, 1, 8, (c, x, y, wd) => drawCouch(c, x, y, wd, '#2a6a8a', '#3a86aa', '#4aa0c8'));
    for (const sx_ of [30, 36]) addBox(sx_, 6, 1, 1, 0, (c, x, y) => { R(c, x + 2, y + 4, 12, 10, INK); R(c, x + 3, y + 5, 10, 6, '#c0392b'); R(c, x + 3, y + 5, 10, 2, '#e05a4a'); R(c, x + 6, y + 11, 4, 3, '#555'); });
    for (const sx_ of [30, 37]) addBox(sx_, 3, 1, 1, 22, (c, x, y) => { R(c, x + 1, y - 18, 14, 22, INK); R(c, x + 2, y - 17, 12, 20, '#1a1a22'); R(c, x + 3, y - 15, 10, 14, '#fff7e0'); R(c, x + 7, y + 4, 2, 10, '#555'); R(c, x + 3, y + 13, 10, 2, '#333'); });
    addBox(36, 8, 1, 1, 24, (c, x, y, wd, h, up, S, tm) => { R(c, x + 7, y - 8, 2, 20, '#444'); R(c, x + 2, y - 22, 12, 12, INK); R(c, x + 3, y - 21, 10, 10, '#ffe9a8'); R(c, x + 5, y - 19, 6, 6, '#3a3a44'); R(c, x + 4, y + 10, 8, 2, '#333'); });
    addBox(33, 9, 1, 1, 18, (c, x, y) => { R(c, x + 3, y - 16, 10, 8, INK); R(c, x + 4, y - 15, 8, 6, '#2a2f3a'); R(c, x + 6, y - 13, 4, 3, '#6a8aff'); R(c, x + 7, y - 8, 2, 8, '#555'); R(c, x + 3, y + 1, 4, 4, '#444'); R(c, x + 9, y + 1, 4, 4, '#444'); });
    meeting.push(...[[32, 6, 'down'], [33, 6, 'down'], [34, 6, 'down']].map(([x, y, d]) => ({ x: g(x), y, dir: d, sit: 1, py: y * T + 18 })), { x: g(30), y: 6, dir: 'right', sit: 1, py: 6 * T + 17 }, { x: g(36), y: 6, dir: 'left', sit: 1, py: 6 * T + 17 });
  }

  // ---- copiadora, archivadores, enfriador
  addBox(30, 11, 2, 1, 14, (c, x, y, wd) => {
    R(c, x, y - 12, wd, 28, INK); R(c, x + 1, y - 11, wd - 2, 26, '#c9ccd2'); R(c, x + 1, y - 11, wd - 2, 5, '#e8eaee');
    R(c, x + 4, y - 3, 14, 4, '#3a3f4e'); R(c, x + 22, y - 4, 6, 3, '#3ddc84'); R(c, x + 2, y + 7, wd - 4, 6, '#9aa0aa');
  });
  for (let i = 0; i < 4; i++) addBox(33 + i, 11, 1, 1, 14, (c, x, y) => {
    R(c, x, y - 12, 16, 28, INK); R(c, x + 1, y - 11, 14, 26, '#8f9aa6'); R(c, x + 3, y - 8, 10, 8, '#a7b1bc'); R(c, x + 3, y + 2, 10, 8, '#a7b1bc'); R(c, x + 6, y - 5, 4, 1, '#333'); R(c, x + 6, y + 5, 4, 1, '#333');
  });
  addBox(32, 13, 1, 1, 12, (c, x, y) => {
    R(c, x + 2, y - 14, 12, 28, INK); R(c, x + 3, y - 13, 10, 12, '#7fc4f0'); R(c, x + 4, y - 12, 3, 8, '#bfe6ff'); R(c, x + 3, y - 1, 10, 14, '#dfe3e8'); R(c, x + 6, y + 3, 4, 2, '#3a6ea8');
  });
  // sala de descanso (para siestas)
  addBox(35, 14, 3, 1, 8, (c, x, y, wd) => drawCouch(c, x, y, wd, isAsk ? '#7a3a6a' : '#3a6a8a', isAsk ? '#8e4a7e' : '#4a80a4', isAsk ? '#a05a90' : '#5a96bc'));
  addBox(38, 14, 1, 1, 8, (c, x, y) => pot(c, x, y - 2));
  addBox(34, 13, 1, 1, 0, (c, x, y) => { R(c, x + 3, y + 6, 10, 8, INK); R(c, x + 4, y + 7, 8, 5, '#c9a46a'); R(c, x + 6, y + 3, 4, 4, '#f4e9c8'); });

  // ---- cocina
  addBox(1, 15, 1, 1, 18, (c, x, y) => { R(c, x, y - 18, 16, 34, INK); R(c, x + 1, y - 17, 14, 32, '#eceff2'); R(c, x + 1, y - 2, 14, 1, '#9aa'); R(c, x + 11, y - 12, 2, 6, '#9aa'); R(c, x + 11, y + 2, 2, 6, '#9aa'); });
  for (let i = 2; i <= 9; i++) {
    addBox(i, 15, 1, 1, 0, (c, x, y) => {
      R(c, x, y, 16, 16, INK); R(c, x, y + 1, 16, 5, '#efe9da'); R(c, x, y + 6, 16, 9, '#8a6a4f'); R(c, x + 2, y + 8, 12, 6, '#775a41'); R(c, x + 7, y + 9, 2, 1, '#d8c7a0');
      if (i === 3) { R(c, x + 3, y - 1, 10, 4, '#aab'); R(c, x + 7, y - 6, 2, 5, '#aab'); }
      if (i === 6) { R(c, x + 3, y - 6, 10, 8, '#3a3f4e'); R(c, x + 4, y - 4, 6, 4, '#7a8aa0'); R(c, x + 11, y - 4, 2, 4, '#ccc'); }
      if (i === 8) { R(c, x + 4, y - 9, 8, 10, '#2b2f3a'); R(c, x + 5, y - 6, 4, 5, '#d4521f'); R(c, x + 10, y - 4, 1, 1, '#3ddc84'); }
    }, 1);
  }
  addBox(10, 15, 1, 1, 18, (c, x, y) => {
    R(c, x - 1, y - 18, 18, 34, INK); R(c, x, y - 17, 16, 32, '#c0392b'); R(c, x + 2, y - 15, 12, 14, '#243b55');
    for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++) R(c, x + 3 + m * 4, y - 14 + k * 4, 3, 3, ['#f1c40f', '#e67e22', '#2ecc71', '#ecf0f1'][(k + m) % 4]);
    R(c, x + 4, y + 2, 8, 3, '#111'); R(c, x + 12, y - 2, 2, 3, '#f1c40f');
  });
  addBox(4, 18, 3, 2, 0, (c, x, y, wd, h) => {
    R(c, x, y + 2, wd, h - 2, INK); R(c, x + 1, y + 3, wd - 2, 16, '#d8d2c2'); R(c, x + 1, y + 3, wd - 2, 2, '#efe9da'); R(c, x + 1, y + 19, wd - 2, 9, '#a89f8a');
    R(c, x + 18, y + 8, 8, 6, '#c0392b'); R(c, x + 6, y + 8, 5, 5, '#fff'); R(c, x + 34, y + 9, 5, 5, '#fff');
  });
  for (const [cx, cy] of [[3, 18], [3, 19], [7, 18], [7, 19], [5, 17]]) {
    addProp(cy * T + 10, (c) => { R(c, g(cx) * T + 3, cy * T + 4, 10, 9, '#2b6e9b'); R(c, g(cx) * T + 4, cy * T + 5, 8, 3, '#3d8ec4'); });
  }
  addBox(9, 22, 1, 1, 6, (c, x, y) => { R(c, x + 3, y + 2, 10, 12, INK); R(c, x + 4, y + 3, 8, 10, '#6d7480'); R(c, x + 3, y + 1, 10, 2, '#8b929e'); });

  // ---- bodega
  for (const [bx, by, n] of [[35, 18, 2], [36, 18, 3], [37, 19, 2], [30, 22, 2], [31, 22, 1], [36, 22, 2], [37, 22, 3]]) {
    addBox(bx, by, 1, 1, n * 12 - 12, (c, x, y) => {
      for (let k = 0; k < n; k++) { R(c, x + 1, y - k * 12 + 1, 14, 14, INK); R(c, x + 2, y - k * 12 + 2, 12, 12, '#b98b52'); R(c, x + 2, y - k * 12 + 2, 12, 3, '#d1a76a'); R(c, x + 6, y - k * 12 + 8, 4, 2, '#7a5a30'); }
    });
  }
  addBox(29, 18, 3, 1, 22, (c, x, y, wd) => {
    R(c, x, y - 22, wd, 38, INK); R(c, x + 1, y - 21, wd - 2, 36, '#5b6470');
    for (let s = 0; s < 3; s++) { R(c, x + 2, y - 19 + s * 12, wd - 4, 10, '#39404a'); for (let k = 0; k < 5; k++) R(c, x + 4 + k * 8, y - 17 + s * 12, 6, 8, k % 2 ? '#b98b52' : '#d1a76a'); }
  });
  addBox(33, 20, 3, 2, 0, (c, x, y, wd, h) => { R(c, x, y + 4, wd, h - 8, INK); R(c, x + 1, y + 5, wd - 2, h - 10, '#a98355'); for (let k = 0; k < 4; k++) R(c, x + 1, y + 9 + k * 4, wd - 2, 1, '#7a5a30'); });

  // ---- puntos de interes
  const sp = (x, y, dir, extra) => ({ x: g(x), y, dir, ...(extra || {}) });
  const lounge = [35, 36, 37].map((x) => sp(x, 14, 'down', { sit: 1, py: 14 * T + 18 }));
  const sleepSpots = [...lounge, sp(9, 7, 'down', { sit: 1, py: 7 * T + 18 })];
  SPOTS[name] = {
    boss: sp(6, 6, 'up'),
    bossQueue: [sp(5, 6, 'up'), sp(7, 6, 'up'), sp(6, 7, 'up')],
    crowd: [sp(4, 6, 'up'), sp(5, 6, 'up'), sp(6, 6, 'up'), sp(7, 6, 'up'), sp(8, 6, 'up'), sp(5, 7, 'up'), sp(6, 7, 'up'), sp(7, 7, 'up'), sp(4, 7, 'up'), sp(3, 6, 'right')],
    door: { x: g(20), y: 25 },
    cooler: [sp(31, 13, 'right'), sp(33, 13, 'left'), sp(32, 14, 'up')],
    coffee: [sp(6, 16, 'up'), sp(3, 16, 'up'), sp(8, 16, 'up')],
    fridge: [sp(1, 16, 'up')],
    vending: [sp(10, 16, 'up')],
    lunch: [sp(3, 18, 'right', { sit: 1 }), sp(3, 19, 'right', { sit: 1 }), sp(7, 18, 'left', { sit: 1 }), sp(7, 19, 'left', { sit: 1 }), sp(5, 17, 'down', { sit: 1, py: 18 * T + 5 })],
    meeting,
    couch: [sp(9, 7, 'down', { sit: 1, py: 7 * T + 18 })],
    lounge,
    sleepSpots,
  };
  for (const k of ['lunch', 'meeting', 'couch', 'lounge']) for (const s of SPOTS[name][k]) seatTiles.add(s.x + ',' + s.y);

  const rc = (x, y, wd, h) => [g(x) * T, y * T, wd * T, h * T];
  ROOMS[name] = [
    { id: 'boss', label: 'Gerencia', rect: rc(1, 2, 11, 8) },
    { id: 'desks', label: 'Escritorios', rect: rc(12, 2, 16, 14) },
    { id: 'room', label: isAsk ? 'Estudio' : 'Sala de juntas', rect: rc(28, 1, 12, 10) },
    { id: 'lounge', label: 'Descanso', rect: rc(28, 11, 12, 6) },
    { id: 'kitchen', label: 'Cocina', rect: rc(1, 13, 11, 12) },
    { id: 'recep', label: 'Recepción', rect: rc(13, 17, 15, 9) },
    { id: 'bodega', label: 'Bodega', rect: rc(28, 16, 12, 9) },
  ];

  SIGNS.push({ txt: th.sign.txt, x: g(20) * T, y: 13, fs: isAsk ? 4.6 : 5.4, col: th.sign.col });
  SIGNS.push({ txt: 'COCINA', x: g(5) * T + 16, y: 13 * T + 9, fs: 4.2, col: '#fff' });
  SIGNS.push({ txt: 'BODEGA', x: g(31) * T + 8, y: 16 * T + 9, fs: 4.2, col: '#fff' });
}
for (const w of WINGS) buildWing(w);
const SPARE = (dept, used) => DESK_IDS.filter((id) => !used.has(dept + '.' + id)).map((id) => dept + '.' + id);

// ---------------------------------------------------------------- pathfinding
function walkable(x, y, goal, start) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (goal && goal.x === x && goal.y === y) return true;
  if (start && start.x === x && start.y === y) return true;
  if (blocked[y][x]) return false;
  if (seatTiles.has(x + ',' + y)) return false;
  return true;
}
function findPath(sx, sy, gx, gy) {
  if (sx === gx && sy === gy) return [];
  const goal = { x: gx, y: gy }, start = { x: sx, y: sy };
  const key = (x, y) => y * COLS + x;
  const prev = new Map(); prev.set(key(sx, sy), -1);
  const q = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    if (x === gx && y === gy) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (prev.has(key(nx, ny))) continue;
      if (!walkable(nx, ny, goal, start)) continue;
      if (dx && dy && (!walkable(x + dx, y, goal, start) || !walkable(x, y + dy, goal, start))) continue;
      prev.set(key(nx, ny), key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(gx, gy))) return null;
  const path = []; let k = key(gx, gy);
  while (k !== -1 && k !== key(sx, sy)) { path.push({ x: k % COLS, y: Math.floor(k / COLS) }); k = prev.get(k); }
  return path.reverse();
}

// ---------------------------------------------------------------- fondo estatico
function drawWingBg(c, w, rnd) {
  const ox = w.ox, th = w.theme, isAsk = w.name === 'askitar', g = (x) => x + ox;
  const zone = (x, y) => {
    if (x >= 1 && x <= 10 && y >= 2 && y <= 8) return 'wood';
    if (x >= 29 && x <= 38 && y >= 2 && y <= 9) return 'conf';
    if (x >= 1 && x <= 11 && y >= 15 && y <= 23) return 'lino';
    if (x >= 29 && x <= 38 && y >= 18 && y <= 23) return 'concrete';
    if (x >= 29 && x <= 38 && y >= 11 && y <= 15) return 'lounge';
    return 'carpet';
  };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < WCOLS; x++) {
    const z = zone(x, y), px = g(x) * T, py = y * T;
    if (z === 'carpet') { R(c, px, py, T, T, th.carpet[0]); for (let k = 0; k < 7; k++) R(c, px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 1, rnd() > .5 ? th.carpet[1] : th.carpet[2]); }
    else if (z === 'lounge') { R(c, px, py, T, T, isAsk ? '#5a4a78' : '#7a8598'); for (let k = 0; k < 6; k++) R(c, px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 1, isAsk ? '#6a5a88' : '#6a7588'); }
    else if (z === 'wood') { R(c, px, py, T, T, th.wood[0]); R(c, px, py + 7, T, 1, th.wood[1]); R(c, px, py + 15, T, 1, th.wood[1]); R(c, px + ((y % 2) ? 5 : 11), py, 1, 7, th.wood[1]); R(c, px + ((y % 2) ? 12 : 3), py + 8, 1, 7, th.wood[1]); }
    else if (z === 'lino') { R(c, px, py, T, T, (x + y) % 2 ? '#d9d3c3' : '#c6bfab'); }
    else if (z === 'conf') { R(c, px, py, T, T, th.conf[0]); for (let k = 0; k < 6; k++) R(c, px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 1, rnd() > .5 ? th.conf[1] : th.conf[2]); }
    else { R(c, px, py, T, T, '#8a8d92'); for (let k = 0; k < 5; k++) R(c, px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 2, 1, rnd() > .5 ? '#7f8287' : '#95989d'); }
  }
  // alfombras
  R(c, g(3) * T, 3 * T, 7 * T, 4 * T - 4, th.rug[0]); R(c, g(3) * T + 3, 3 * T + 3, 7 * T - 6, 4 * T - 10, th.rug[1]);
  R(c, g(19) * T, 22 * T + 2, 3 * T, 2 * T - 4, th.mat[0]); R(c, g(19) * T + 3, 22 * T + 5, 3 * T - 6, 2 * T - 10, th.mat[1]);
  R(c, g(29) * T, 18 * T, 10 * T, 1, '#e0b400');
  if (isAsk) { R(c, g(30) * T, 3 * T, 8 * T, 7 * T, '#1d1a2c'); R(c, g(30) * T + 2, 3 * T + 2, 8 * T - 4, 7 * T - 4, '#2a2540'); } // tarima del estudio

  // pared norte
  R(c, g(0) * T, 0, WCOLS * T, 2 * T, th.wall); R(c, g(0) * T, 0, WCOLS * T, 3, th.wallTop); R(c, g(0) * T, 2 * T - 4, WCOLS * T, 4, th.wallShade); R(c, g(0) * T, 2 * T - 5, WCOLS * T, 1, th.wallSide);
  // laterales y sur
  R(c, g(0) * T, 2 * T, T, 22 * T, th.wallSide); R(c, g(1) * T - 3, 2 * T, 3, 22 * T, th.wallShade);
  R(c, g(39) * T, 2 * T, T, 22 * T, th.wallSide); R(c, g(39) * T, 2 * T, 3, 22 * T, th.wallShade);
  R(c, g(0) * T, 24 * T, 19 * T, 2 * T, th.wallSide); R(c, g(22) * T, 24 * T, 18 * T, 2 * T, th.wallSide); R(c, g(0) * T, 24 * T, WCOLS * T, 3, th.wallShade);
  // puerta
  R(c, g(19) * T, 24 * T, 3 * T, 2 * T, '#2b2f3a'); R(c, g(19) * T + 2, 24 * T + 2, 3 * T - 4, 2 * T - 4, '#bfe3ff'); R(c, g(20) * T + 7, 24 * T + 2, 2, 2 * T - 4, '#5b6a7a'); R(c, g(19) * T + 2, 24 * T + 2, 3 * T - 4, 2, '#7d8da0');
  // caras de pared de cocina y bodega
  const wallFace = (x, y, wd) => { R(c, g(x) * T, y * T, wd * T, 2 * T, th.face2); R(c, g(x) * T, y * T, wd * T, 2, th.wallTop); R(c, g(x) * T, (y + 2) * T - 4, wd * T, 4, th.wallShade); };
  wallFace(1, 13, 11); wallFace(29, 16, 4); wallFace(35, 16, 4);
  // ventanas / afiches neon
  const neonCols = [['#ff3fa4', '#3fd8ff'], ['#ffd23f', '#a43fff'], ['#3fff9a', '#ff6a3f']];
  let wi = 0;
  for (const wx of [2, 5, 13, 16, 24, 27, 36]) {
    const x0 = g(wx) * T;
    if (th.windows) {
      R(c, x0, 5, 2 * T, 20, '#6e7a8a'); R(c, x0 + 2, 7, 2 * T - 4, 16, '#9fd3ff'); R(c, x0 + 2, 7, 2 * T - 4, 6, '#c8e8ff'); R(c, x0 + T - 1, 7, 2, 16, '#6e7a8a'); R(c, x0 + 2, 18, 2 * T - 4, 1, 'rgba(255,255,255,.5)');
    } else {
      const cc = neonCols[wi++ % 3];
      R(c, x0 + 2, 5, 2 * T - 4, 20, INK); R(c, x0 + 4, 7, 2 * T - 8, 16, '#14121f'); R(c, x0 + 6, 9, 8, 3, cc[0]); R(c, x0 + 6, 14, 14, 3, cc[1]); R(c, x0 + 6, 19, 6, 2, cc[0]);
    }
  }
  // pizarra de sala / pantalla verde del estudio
  if (!isAsk) {
    R(c, g(31) * T - 2, 3, 6 * T + 4, 24, '#6e6e76'); R(c, g(31) * T, 5, 6 * T, 20, '#f4f6f8');
    R(c, g(31) * T + 6, 10, 30, 1, '#2e86c1'); R(c, g(31) * T + 6, 14, 44, 1, '#c0392b'); R(c, g(31) * T + 6, 18, 22, 1, '#27ae60'); R(c, g(31) * T + 56, 9, 26, 12, '#e9f0ff'); R(c, g(31) * T + 60, 12, 18, 1, '#2e86c1'); R(c, g(31) * T + 60, 16, 12, 1, '#2e86c1');
  } else {
    R(c, g(30) * T, 2, 8 * T, 2 * T - 6, INK); R(c, g(30) * T + 2, 4, 8 * T - 4, 2 * T - 10, '#2fbf5a'); for (let k = 1; k < 4; k++) R(c, g(30) * T + 2 + k * 32, 4, 1, 2 * T - 10, '#28a84e');
  }
  // cuadros y reloj
  const frame = (x, y, wd, h, col) => { R(c, x, y, wd, h, INK); R(c, x + 1, y + 1, wd - 2, h - 2, '#f4f1e6'); R(c, x + 3, y + 3, wd - 6, h - 6, col); };
  frame(g(8) * T + 2, 6, 14, 14, isAsk ? '#a43fff' : '#7fb7a4'); frame(g(11) * T + 8, 7, 12, 12, isAsk ? '#ff3fa4' : '#e2a36b');
  R(c, g(19) * T - 4, 6, 14, 14, INK); R(c, g(19) * T - 3, 7, 12, 12, '#fff'); R(c, g(19) * T + 3, 9, 1, 5, INK); R(c, g(19) * T + 3, 13, 4, 1, INK);
  frame(g(3) * T, 4, 12, 16, isAsk ? '#3fd8ff' : '#c97b84');
  // carteles
  R(c, g(5) * T - 4, 13 * T + 3, 40, 12, INK); R(c, g(5) * T - 3, 13 * T + 4, 38, 10, '#2b6e9b');
  R(c, g(31) * T - 4, 16 * T + 3, 40, 12, INK); R(c, g(31) * T - 3, 16 * T + 4, 38, 10, '#8a6d12');
  // banner del departamento
  R(c, g(17) * T + 2, 3, 6 * T - 4, 20, INK); R(c, g(17) * T + 4, 5, 6 * T - 8, 16, th.sign.bg); R(c, g(17) * T + 4, 5, 6 * T - 8, 2, th.sign.hi);
}

function glassWing(c, w) {
  const g = (x) => x + w.ox, tint = w.theme.glassTint;
  const vert = (x, y0, y1) => { for (let y = y0; y <= y1; y++) { R(c, g(x) * T + 5, y * T, 6, T, tint); R(c, g(x) * T + 5, y * T, 1, T, '#7d98a8'); R(c, g(x) * T + 10, y * T, 1, T, '#7d98a8'); } R(c, g(x) * T + 4, y0 * T, 8, 2, '#5d7686'); };
  const horiz = (x0, x1, y) => { for (let x = x0; x <= x1; x++) { R(c, g(x) * T, y * T + 1, T, 14, tint); R(c, g(x) * T, y * T + 1, T, 2, '#5d7686'); R(c, g(x) * T, y * T + 13, T, 2, '#5d7686'); if (x % 2 === 0) R(c, g(x) * T, y * T + 1, 1, 14, '#7d98a8'); } };
  vert(11, 2, 8); horiz(1, 4, 9); horiz(7, 11, 9);
  vert(28, 2, 6); vert(28, 9, 10); horiz(29, 38, 10);
  R(c, g(11) * T + 4, 9 * T, 8, 2, '#5d7686');
}

function buildBackground() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const rnd = mulberry(7);
  for (const w of WINGS) drawWingBg(c, w, rnd);
  for (const w of WINGS) glassWing(c, w);
  // division entre alas
  R(c, 40 * T - 3, 0, 6, H, '#15131f'); R(c, 40 * T - 1, 0, 2, H, '#2a2640');
  return cv;
}
