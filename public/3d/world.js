// Plano unico de la oficina, en metros. Agencia a la izquierda (x negativo), Askitar a la derecha (x positivo),
// y en el centro lo compartido: cocina, sala y recepcion. X = este, Z = sur (hacia la camara inicial), Y = arriba.
// yaw 0 mira hacia +Z (sur), PI hacia -Z (norte), PI/2 hacia +X (este), -PI/2 hacia -X (oeste).

export const OFFICE = { x0: -11, x1: 11, z0: -7, z1: 7, h: 2.9, wall: 0.14 };
const S_ = 0, N_ = Math.PI, E_ = Math.PI / 2, W_ = -Math.PI / 2;
export const YAW = { S: S_, N: N_, E: E_, W: W_ };

// ---------------------------------------------------------------- rejilla de navegacion
export const CELL = 0.25;
const GX0 = OFFICE.x0 - 0.5, GZ0 = OFFICE.z0 - 0.5;
export const GW = Math.ceil((OFFICE.x1 - OFFICE.x0 + 1) / CELL), GH = Math.ceil((OFFICE.z1 - OFFICE.z0 + 2) / CELL);
const blocked = new Uint8Array(GW * GH);
const toCell = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
const cellCenter = (i, j) => [GX0 + (i + .5) * CELL, GZ0 + (j + .5) * CELL];
const isFree = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i];
export function blockRect(x0, z0, x1, z1, inflate = 0.2) {
  const [a, b] = toCell(Math.min(x0, x1) - inflate, Math.min(z0, z1) - inflate);
  const [c, d] = toCell(Math.max(x0, x1) + inflate, Math.max(z0, z1) + inflate);
  for (let j = Math.max(0, b); j <= Math.min(GH - 1, d); j++) for (let i = Math.max(0, a); i <= Math.min(GW - 1, c); i++) blocked[j * GW + i] = 1;
}
export function unblockRect(x0, z0, x1, z1) {
  const [a, b] = toCell(Math.min(x0, x1), Math.min(z0, z1));
  const [c, d] = toCell(Math.max(x0, x1), Math.max(z0, z1));
  for (let j = Math.max(0, b); j <= Math.min(GH - 1, d); j++) for (let i = Math.max(0, a); i <= Math.min(GW - 1, c); i++) blocked[j * GW + i] = 0;
}
export function freeAt(x, z) { const [i, j] = toCell(x, z); return isFree(i, j); }
export function nearestFree(x, z) {
  let [i, j] = toCell(x, z);
  if (isFree(i, j)) return { x, z };
  for (let r = 1; r < 24; r++) {
    let best = null, bd = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !isFree(i + di, j + dj)) continue;
      const [cx, cz] = cellCenter(i + di, j + dj), d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bd) { bd = d; best = { x: cx, z: cz }; }
    }
    if (best) return best;
  }
  return { x, z };
}
function lineFree(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / (CELL * .45));
  for (let k = 1; k < n; k++) {
    const t = k / n, [i, j] = toCell(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (!isFree(i, j)) return false;
  }
  return true;
}
// A* de 8 vecinos y luego se tensa la ruta para que caminen en linea recta y no en zigzag
export function findPath(x0, z0, x1, z1) {
  const a = nearestFree(x0, z0), b = nearestFree(x1, z1);
  const [si, sj] = toCell(a.x, a.z), [gi, gj] = toCell(b.x, b.z);
  const key = (i, j) => j * GW + i;
  const start = key(si, sj), goal = key(gi, gj);
  if (start === goal) return [{ x: x1, z: z1 }];
  const g = new Float32Array(GW * GH).fill(1e9), prev = new Int32Array(GW * GH).fill(-1), open = [start];
  const inOpen = new Uint8Array(GW * GH);
  g[start] = 0; inOpen[start] = 1;
  const h = (k) => { const i = k % GW, j = (k / GW) | 0; const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return dx + dz - .59 * Math.min(dx, dz); };
  let guard = 0;
  while (open.length && guard++ < 20000) {
    let bi = 0, bf = 1e9;
    for (let q = 0; q < open.length; q++) { const f = g[open[q]] + h(open[q]); if (f < bf) { bf = f; bi = q; } }
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop(); inOpen[cur] = 0;
    if (cur === goal) break;
    const ci = cur % GW, cj = (cur / GW) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (!isFree(ni, nj) || (di && dj && (!isFree(ci + di, cj) || !isFree(ci, cj + dj)))) continue;
      const nk = key(ni, nj), c = g[cur] + (di && dj ? 1.414 : 1);
      if (c < g[nk]) { g[nk] = c; prev[nk] = cur; if (!inOpen[nk]) { open.push(nk); inOpen[nk] = 1; } }
    }
  }
  if (prev[goal] < 0) return null;
  const raw = [];
  for (let k = goal; k !== -1 && k !== start; k = prev[k]) { const [cx, cz] = cellCenter(k % GW, (k / GW) | 0); raw.push({ x: cx, z: cz }); }
  raw.reverse();
  const out = []; let px = a.x, pz = a.z, i = 0;
  while (i < raw.length) {
    let far = i;
    for (let q = raw.length - 1; q > i; q--) if (lineFree(px, pz, raw[q].x, raw[q].z)) { far = q; break; }
    out.push(raw[far]); px = raw[far].x; pz = raw[far].z; i = far + 1;
  }
  if (Math.hypot(x1 - b.x, z1 - b.z) < .4) out[out.length - 1] = { x: x1, z: z1 };
  return out;
}

// ---------------------------------------------------------------- paredes
// side marca la pared exterior que se esconde cuando la camara queda por fuera de ese lado
export const WALLS = [
  { a: [-11, -7], b: [11, -7], kind: 'ext', side: 'N', open: [
    { x0: -6.0, x1: -3.6, type: 'window' }, { x0: 3.6, x1: 6.0, type: 'window' },
    { x0: -9.6, x1: -7.8, type: 'window' }, { x0: 7.8, x1: 9.6, type: 'window' }] },
  { a: [-11, 7], b: [11, 7], kind: 'ext', side: 'S', open: [
    { x0: -1.0, x1: 1.0, type: 'entrance' }, { x0: -3.0, x1: -1.4, type: 'window' }, { x0: 1.4, x1: 3.0, type: 'window' },
    { x0: -6.0, x1: -3.6, type: 'window' }, { x0: 3.6, x1: 6.0, type: 'window' }, { x0: -10.4, x1: -7.2, type: 'window' }] },
  { a: [-11, -7], b: [-11, 7], kind: 'ext', side: 'W', open: [
    { x0: -6.5, x1: -3.2, type: 'window' }, { x0: -2.1, x1: 2.1, type: 'window' }, { x0: 3.2, x1: 6.5, type: 'window' }] },
  { a: [11, -7], b: [11, 7], kind: 'ext', side: 'E', open: [
    { x0: -6.5, x1: -3.2, type: 'window' }, { x0: -2.1, x1: 2.1, type: 'window' }] },
  // gerencia Agencia y sala de juntas (vidrio)
  { a: [-6.4, -7], b: [-6.4, -2.6], kind: 'glass' },
  { a: [-11, -2.6], b: [-6.4, -2.6], kind: 'glass', open: [{ x0: -7.7, x1: -6.7, type: 'door', sign: 'MICHAEL\nJefe Agencia' }] },
  { a: [-6.4, 2.6], b: [-6.4, 7], kind: 'glass' },
  { a: [-11, 2.6], b: [-6.4, 2.6], kind: 'glass', open: [{ x0: -7.7, x1: -6.7, type: 'door', sign: 'SALA DE JUNTAS' }] },
  // gerencia Askitar y estudio (vidrio)
  { a: [6.4, -7], b: [6.4, -2.6], kind: 'glass' },
  { a: [6.4, -2.6], b: [11, -2.6], kind: 'glass', open: [{ x0: 6.7, x1: 7.7, type: 'door', sign: 'JAN\nJefa Askitar' }] },
  { a: [6.4, 2.6], b: [6.4, 7], kind: 'glass' },
  { a: [6.4, 2.6], b: [11, 2.6], kind: 'glass', open: [{ x0: 6.7, x1: 7.7, type: 'door', sign: 'ESTUDIO\nGrabando' }] },
  // cocina
  { a: [-3.2, -7], b: [-3.2, -3], kind: 'solid', paint: 'agency' },
  { a: [3.2, -7], b: [3.2, -3], kind: 'solid', paint: 'askitar' },
  { a: [-2.2, -3], b: [2.2, -3], kind: 'half' },
  // biombo de listones con el logo: deja ver la sala desde la recepcion
  { a: [-1.9, 2.4], b: [1.9, 2.4], kind: 'slats' },
];
for (const w of WALLS) {
  const horiz = w.a[1] === w.b[1], t = w.kind === 'glass' ? 0.04 : 0.07;
  const cuts = (w.open || []).filter((o) => o.type === 'door' || o.type === 'entrance').sort((p, q) => p.x0 - q.x0);
  let c = horiz ? w.a[0] : w.a[1], end = horiz ? w.b[0] : w.b[1];
  const seg = (u0, u1) => { if (u1 - u0 > 0.01) { if (horiz) blockRect(u0, w.a[1] - t, u1, w.a[1] + t, .2); else blockRect(w.a[0] - t, u0, w.a[0] + t, u1, .2); } };
  for (const o of cuts) { seg(c, o.x0); c = o.x1; }
  seg(c, end);
}
// afuera de la oficina no se camina, salvo el pasillo de la puerta principal
blockRect(-11.5, 7.14, 11.5, 8.5, 0); blockRect(-11.5, -7.5, 11.5, -7.14, 0); blockRect(-11.5, -7.5, -11.14, 8.5, 0); blockRect(11.14, -7.5, 11.5, 8.5, 0);
unblockRect(-0.8, 6.7, 0.8, 8.5);

// ---------------------------------------------------------------- escritorios
export const DESKS = {};
const DW = 1.7, DD = 0.8;
function desk(dept, id, x, z, face, o = {}) {
  const w = o.w || DW, d = o.d || DD;
  const sgn = face === 'S' ? -1 : 1; // S: la persona se sienta al norte y mira al sur
  const seat = { x, z: z + sgn * (d / 2 + .27), yaw: YAW[face], y: .55 };
  const stand = nearestFree(x, z + sgn * (d / 2 + .86));
  const k = dept + '.' + id;
  DESKS[k] = { key: k, dept, id, x, z, w, d, face, yaw: YAW[face], seat, stand, boss: !!o.boss };
  blockRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, .16);
  blockRect(seat.x - .22, seat.z - .22, seat.x + .22, seat.z + .22, .08);
}
function deskPair(dept, ids, x, z) { desk(dept, ids[0], x, z - .42, 'S'); desk(dept, ids[1], x, z + .42, 'N'); }
// Agencia
deskPair('agency', ['A1', 'A2'], -9.5, 0);
deskPair('agency', ['A3', 'A4'], -7.5, 0);
deskPair('agency', ['B1', 'B2'], -4.9, 0);
desk('agency', 'B3', -4.9, -5.2, 'S'); desk('agency', 'B4', -4.9, -3.0, 'S');
desk('agency', 'C1', -4.9, 3.4, 'S'); desk('agency', 'C2', -4.9, 5.6, 'S');
desk('agency', 'M', -8.7, -5.3, 'S', { boss: true, w: 2.0, d: .9 });
// Askitar (Dwight y Jim frente a frente, como en la serie)
deskPair('askitar', ['A1', 'A2'], 9.5, 0);
deskPair('askitar', ['B1', 'B2'], 7.5, 0);
deskPair('askitar', ['A3', 'A4'], 4.9, 0);
desk('askitar', 'B4', 4.9, -5.2, 'S'); desk('askitar', 'B3', 4.9, -3.0, 'S');
desk('askitar', 'C1', 4.9, 3.4, 'S'); desk('askitar', 'C2', 4.9, 5.6, 'S');
desk('askitar', 'M', 8.7, -5.3, 'S', { boss: true, w: 2.0, d: .9 });
export const SPARE_IDS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2'];

// ---------------------------------------------------------------- muebles que estorban al caminar (huella en planta)
export const FOOT = {
  // cocina
  counter: [-2.42, -7, 2.42, -6.35], fridge: [-3.14, -6.95, -2.42, -6.25], vending: [2.3, -6.95, 3.14, -6.2], table: [-.92, -5.05, .92, -4.15],
  // sala
  console: [-1, -2.95, 1, -2.55], sofaMain: [-1.38, .45, 1.38, 1.38], coffee: [-.6, -.65, .6, -.05], sofaSide: [2.05, -1.4, 2.95, .42], armchair: [-2.85, -.95, -1.95, -.05],
  // recepcion
  reception: [-1.35, 3.55, 1.35, 4.3], cart: [2.1, 4.3, 3.15, 6.45], waitA: [-2.95, 4.7, -2.15, 5.45], waitB: [-2.95, 5.75, -2.15, 6.5], waitTable: [-2.9, 5.45, -2.3, 5.75],
  // junta Agencia
  confTable: [-10.4, 4.3, -7, 5.5],
  // gerencias
  fpV1: [-10.0, -4.7, -9.5, -4.2], fpV2: [-7.9, -4.7, -7.4, -4.2], akV1: [9.5, -4.7, 10.0, -4.2], akV2: [7.4, -4.7, 7.9, -4.2],
  fpCouch: [-10.92, -4.95, -10.05, -3.1], fpShelf: [-10.6, -6.95, -8, -6.6], akCouch: [10.05, -4.95, 10.92, -3.1], akShelf: [8, -6.95, 10.6, -6.6],
  // copiadora y servidores
  copier: [-3.95, -2.9, -3.3, -2.15], rack: [3.3, -2.9, 3.95, -2.15], fpCooler: [-3.7, 1.95, -3.35, 2.3], akCooler: [3.35, 1.95, 3.7, 2.3],
  fpFiles: [-10.95, -1.9, -10.55, 1.9], akShelfE: [10.55, -1.9, 10.95, 1.9],
  // estudio
  green: [7.5, 6.3, 10.95, 6.95], stoolA: [8.95, 5.1, 9.45, 5.6], stoolB: [7.95, 5.1, 8.45, 5.6], camera: [8.9, 3.75, 9.5, 4.3], softA: [7.2, 4.2, 7.7, 4.7], softB: [10.45, 4.2, 10.95, 4.7],
  studioSofa: [8.05, 2.75, 9.9, 3.45],
};
for (const k of Object.keys(FOOT)) { const r = FOOT[k]; blockRect(r[0], r[1], r[2], r[3], .14); }

// ---------------------------------------------------------------- puntos a donde van los personajes
const pt = (x, z, yaw = 0) => { const p = nearestFree(x, z); return { x: p.x, z: p.z, yaw }; };
const seat = (x, z, yaw, y, sx, sz) => ({ x, z, yaw, y, sit: 1, stand: nearestFree(sx, sz) });
const crowd = (cx, sgn) => [[0, -3.55], [-.7, -3.55], [.7, -3.55], [-1.3, -3.1], [-.45, -3.1], [.45, -3.1], [1.3, -3.1], [-1.5, -3.75]].map(([dx, z]) => pt(cx + dx * sgn, z, N_));

export const DOOR = { out: { x: 0, z: 8.2 }, in: { x: 0, z: 6.3 } };

export const SPOTS = {
  agency: {
    deliver: [pt(-8.7, -4.35, N_), pt(-8.0, -4.1, N_), pt(-9.4, -4.1, N_)],
    crowd: crowd(-8.3, 1),
    cooler: [pt(-3.95, 2.15, E_), pt(-3.5, 1.6, N_)],
    copier: pt(-4.3, -2.5, E_),
    meeting: [
      seat(-9.6, 3.95, S_, .55, -9.6, 3.2), seat(-8.5, 3.95, S_, .55, -8.5, 3.2), seat(-7.4, 3.95, S_, .55, -7.4, 3.2),
      seat(-9.6, 5.85, N_, .55, -9.6, 6.5), seat(-8.5, 5.85, N_, .55, -8.5, 6.5), seat(-7.4, 5.85, N_, .55, -7.4, 6.5),
      seat(-10.75, 4.9, E_, .55, -10.6, 3.5),
    ],
    couch: [seat(-10.45, -4.5, E_, .56, -9.75, -4.5), seat(-10.45, -3.6, E_, .56, -9.75, -3.6)],
    nap: { x: -10.46, z: -4.03, yaw: N_, y: .55, stand: nearestFree(-9.7, -4.0) },
  },
  askitar: {
    deliver: [pt(8.7, -4.35, N_), pt(8.0, -4.1, N_), pt(9.4, -4.1, N_)],
    crowd: crowd(8.3, -1),
    cooler: [pt(3.95, 2.15, W_), pt(3.5, 1.6, N_)],
    copier: pt(4.3, -2.5, W_),
    meeting: [
      seat(8.4, 3.1, S_, .55, 8.4, 3.75), seat(9.0, 3.1, S_, .55, 9.0, 3.75), seat(9.6, 3.1, S_, .55, 9.6, 3.75),
      seat(9.2, 5.35, N_, .78, 9.2, 4.75), seat(8.2, 5.35, N_, .78, 8.2, 4.75),
    ],
    couch: [seat(10.45, -4.5, W_, .56, 9.75, -4.5), seat(10.45, -3.6, W_, .56, 9.75, -3.6)],
    nap: { x: 10.46, z: -4.03, yaw: S_, y: .55, stand: nearestFree(9.7, -4.0) },
  },
};
export const SHARED = {
  fridge: pt(-2.72, -5.75, N_),
  vending: pt(2.72, -5.75, N_),
  coffee: [pt(-1.15, -5.85, N_), pt(-.35, -5.85, N_), pt(1.5, -5.85, N_), pt(1.95, 5.4, E_)],
  lunch: [
    seat(-.5, -5.42, S_, .52, -.5, -5.9), seat(.5, -5.42, S_, .52, .5, -5.9),
    seat(-.5, -3.78, N_, .52, -.5, -3.3), seat(.5, -3.78, N_, .52, .5, -3.3),
    seat(-1.3, -4.6, E_, .52, -1.85, -4.6), seat(1.3, -4.6, W_, .52, 1.85, -4.6),
  ],
  lounge: [
    seat(-.75, .85, N_, .56, -.75, .1), seat(.75, .85, N_, .56, .75, .1),
    seat(-2.4, -.5, E_, .56, -1.75, .2),
    seat(2.5, -.95, W_, .56, 1.8, -.95), seat(2.5, -.05, W_, .56, 1.8, -.05),
    seat(-2.55, 5.08, E_, .56, -1.9, 5.08), seat(-2.55, 6.12, E_, .56, -1.9, 6.12),
  ],
  naps: [
    { x: 0, z: .88, yaw: E_, y: .55, stand: nearestFree(0, .15), blocks: [0, 1] },
    { x: 2.5, z: -.5, yaw: S_, y: .55, stand: nearestFree(1.8, -.5), blocks: [3, 4] },
  ],
};

// ---------------------------------------------------------------- cuartos (camara y minimapa)
// cam = desde donde mira la camara, look = a donde mira
export const ROOMS = [
  { id: 'fp_floor', dept: 'agency', label: 'Agencia', rect: [-11, -2.6, 7.8, 5.2], cam: [-7.2, 7.4, 5.0], look: [-7.2, .3, -.2] },
  { id: 'fp_boss', dept: 'agency', label: 'Oficina de Michael', rect: [-11, -7, 4.6, 4.4], cam: [-6.75, 2.25, -3.0], look: [-9.2, .7, -5.3] },
  { id: 'fp_conf', dept: 'agency', label: 'Sala de juntas', rect: [-11, 2.6, 4.6, 4.4], cam: [-6.75, 2.3, 3.05], look: [-9.2, .6, 5.2] },
  { id: 'kitchen', dept: null, label: 'Cocina', rect: [-3.2, -7, 6.4, 4], cam: [0, 2.55, -1.6], look: [0, .75, -5.3] },
  { id: 'lounge', dept: null, label: 'Sala', rect: [-3.2, -3, 6.4, 5.4], cam: [1.6, 2.7, 2.2], look: [-.1, .5, -1] },
  { id: 'lobby', dept: null, label: 'Recepción', rect: [-3.2, 2.4, 6.4, 4.6], cam: [-.6, 1.9, 6.6], look: [.05, 1.1, 2.6] },
  { id: 'ak_floor', dept: 'askitar', label: 'Askitar', rect: [3.2, -2.6, 7.8, 5.2], cam: [7.2, 7.4, 5.0], look: [7.2, .3, -.2] },
  { id: 'ak_boss', dept: 'askitar', label: 'Oficina de Jan', rect: [6.4, -7, 4.6, 4.4], cam: [6.75, 2.25, -3.0], look: [9.2, .7, -5.3] },
  { id: 'ak_studio', dept: 'askitar', label: 'Estudio', rect: [6.4, 2.6, 4.6, 4.4], cam: [8.2, 2.5, 2.95], look: [9.5, .85, 5.8] },
];
