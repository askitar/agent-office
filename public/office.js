'use strict';
// Simulacion de la oficina (dos departamentos), camara y interfaz. Depende de scene.js.

const $ = (s) => document.querySelector(s);
const stage = $('#stage'), cv = $('#cv'), overlay = $('#overlay');
const ctx = cv.getContext('2d');
const mini = $('#mini'), mctx = mini.getContext('2d');
const bg = buildBackground();

// ---------------------------------------------------------------- utilidades
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;
const store = {
  get(k, d) { try { const v = localStorage.getItem('oficina.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('oficina.' + k, JSON.stringify(v)); } catch (_) {} },
};

const S = {
  actors: new Map(), sel: null, parts: [], fx: [], later: [], t: 0, roster: null, depts: [], bossOf: {}, defaultDept: 'agency',
  state: { actors: {}, sessions: [], log: [], done: 0 }, history: {}, chatBusy: {}, deskActive: {}, busy: {}, banterIn: {},
  lastUser: -999, doneCount: -1, alertShown: {}, nf: 8,
};
const VIEW = { kind: 'wing', dept: null, room: null, auto: store.get('auto', true), follow: false, night: store.get('night', true), autoRoom: false };
const CAM = { x: 320, y: 208, z: 1, goal: null };

// ---------------------------------------------------------------- frases
const L = {
  hunger: ['Tengo hambre...', 'Mi estómago está rugiendo.', '¿Ya es hora de almorzar?', 'Mataría por una pizza.', 'Me comería una dona.', '¿Quedará algo en la nevera?', 'Necesito azúcar. Ya.'],
  heat: ['¡Qué calor hace aquí!', 'Alguien prenda el aire.', 'Me estoy derritiendo.', 'Hace un calor de mil demonios.'],
  cold: ['Aquí hace frío.', '¿Quién bajó el aire a 16?', 'Se me congelaron los dedos.'],
  lost: ['¿Alguien vio mi grapadora?', '¿Vieron mi taza azul?', '¿Dónde dejé mi cargador?', '¿Alguien vio el control remoto?', '¿Quién se llevó mi bolígrafo?'],
  sleepy: ['Qué sueño...', '*bosteza*', 'Necesito una siesta.', 'Casi me duermo en el teclado.'],
  time: ['Casi es viernes.', 'Falta poco para salir.', 'Este lunes no termina.', '¿Qué hora es?', 'El tiempo vuela. Mentira.'],
  gossip: ['¿Se enteraron del chisme?', 'Dicen que viene un cliente grande.', 'Oscar anda de buen humor.', 'Oí que habrá pastel.', 'Alguien dejó huellas en la nevera.'],
  work: ['Mmm, interesante.', 'Casi lo tengo.', 'Ya casi...', 'Un archivito más.', 'Esto sí compila.'],
};
const REPLIES = ['Yo no la vi.', 'Revisa el cajón.', 'Creo que la tiene Dwight.', 'Pregúntale al jefe.', 'No es mía, lo juro.', 'Ni idea.'];
const THANKS = ['Buen trabajo.', '¡Excelente!', 'Justo lo que quería.', 'Gracias, equipo.', '¡Así se hace!'];
const PERSONAL = {
  michael: ['Soy el mejor jefe del mundo.', 'Prefiero ser amado y temido.', 'Que alguien me traiga un café.', '¡Reunión en la sala, ya!'],
  jan: ['Este lugar es un caos.', 'Dije que no quería ruido.', 'Rehagan eso, por favor.'],
  dwight: ['¡Falso!', 'Quiero datos. Muchos datos.', 'Soy el asistente del jefe.', 'La remolacha es una gran verdura.'],
  jim: ['*mira a la cámara*', 'Voy a esconder algo en gelatina.', 'Esto sí es trabajo, ¿no?'],
  pam: ['¿Alguien quiere dulces?', 'Acabo de pintar algo.', 'Qué lindo está el día.'],
  ryan: ['Estoy armando una startup.', 'Eso es muy 2005.'],
  angela: ['Eso no está en el presupuesto.', 'Silencio, por favor.', 'Mis gatos lo aprobarían.'],
  kevin: ['Me gustan las galletas.', 'Si hago menos, termino antes.'],
  erin: ['¡Hola! Mejor dicho, hola.', '¿Esto cuenta como trabajo?'],
  toby: ['Por favor, firmen el formulario.', 'Soy de recursos humanos.'],
  phyllis: ['Tejí algo para todos.', 'Las flores ayudan.'],
  meredith: ['Hoy me siento libre.', 'No me juzguen.'],
  stanley: ['Hoy hago el crucigrama.', 'No me hablen.', 'Despiértenme a las cinco.'],
  creed: ['Una vez fui a una fiesta de la CIA.', 'No pregunten por el sótano.'],
  darryl: ['Hoy sí salgo temprano.', 'En la bodega todo es más fácil.'],
  kelly: ['¡Cuéntenme todo!', 'Mi celebridad favorita se casó.'],
  andy: ['♪ Nard dog ♪', 'Canté en la universidad.'],
  gabe: ['Calma, por favor.', 'Todo bajo control.'],
  holly: ['¡Qué bien se siente aquí!', 'Un abrazo para todos.'],
  pete: ['Hago lo mío en silencio.', 'Amo mi carpeta.'],
  clark: ['Sin novedad.', 'Presente.'],
  nellie: ['Yo lo haría mejor.', 'Dejen eso, lo hago yo.'],
  roy: ['Voy al almacén.', 'Eso lo arreglo yo.'],
  hide: ['Ordenado y listo.', 'Respeto la hora.'],
  jo: ['Aquí manda la lógica.', 'Hecho es mejor que perfecto.'],
  wally: ['Con permiso.', 'Hora de revisar.'],
};
const CONVOS = [
  { l: ['¿Tienes hambre?', 'Muchísima. ¿Vamos a comer algo?'], out: 'eat' },
  { l: ['Huele a pizza en la cocina.', '¡Voy corriendo!'], out: 'eat' },
  { l: ['Dicen que habrá pastel.', '¿De qué sabor?', 'De los buenos.'], out: 'eat' },
  { l: ['Tengo mucho sueño.', 'Yo igual. ¿Una siesta?'], out: 'nap' },
  { l: ['¿Café?', 'Dos, por favor.'], out: 'coffee' },
  { l: ['Qué calor hace aquí.', 'Es el aire otra vez.', 'Abre una ventana.', 'No se abren.'] },
  { l: ['¿Cómo va tu tarea?', 'Casi lista. ¿La tuya?', 'Falta un poco.'] },
  { l: ['¿Viste el último video de Oscar?', 'Quedó brutal.'] },
  { l: ['¿Quién se llevó mi bolígrafo?', 'No fui yo.', 'Siempre dices eso.'] },
  { l: ['¿Viste el correo de Oscar?', 'No lo abrí. Me da miedo.'] },
  { l: ['Hoy fue un día largo.', 'Y apenas empieza.'] },
  { l: ['¿Alguien vio mi grapadora?', 'Mírala, está en gelatina.'] },
];
const PAIRS = {
  'jim>dwight': { l: ['Dwight, tu grapadora está en gelatina.', '¡Falso!', '*mira a la cámara*'] },
  'dwight>jim': { l: ['Jim, sé que fuiste tú.', 'No sé de qué hablas.'] },
  'pam>jim': { l: ['¿Almorzamos?', '¡Siempre!'], out: 'eat' },
  'jim>pam': { l: ['¿Un café?', 'Con gusto.'], out: 'coffee' },
  'angela>dwight': { l: ['Eso no está en el presupuesto.', 'Es una remolacha, Angela.'] },
  'michael>dwight': { l: ['Dwight, ¿me trajiste café?', 'Sí, señor. Quince minutos tarde.'] },
  'ryan>jim': { l: ['Estoy armando una startup.', 'Qué sorpresa.'] },
  'andy>kelly': { l: ['♪ Nard dog ♪', '¡Otra vez!'] },
  'stanley>pam': { l: ['¿Es hora de comer?', 'Faltan dos horas, Stanley.'] },
};
const PIPE = { askitar: ['dwight', 'jim', 'pam', 'ryan', 'andy', 'stanley', 'kelly'], agency: ['erin', 'angela', 'meredith', 'toby', 'phyllis'] };

function lineFor(a) {
  const r = Math.random();
  if (a.hunger > .6 && r < .55) return { text: pick(L.hunger) };
  if (a.tired > .7 && r < .55) return { text: pick(L.sleepy) };
  const x = Math.random();
  if (x < .3 && PERSONAL[a.id]) return { text: pick(PERSONAL[a.id]) };
  if (x < .42) return { text: pick(L.lost), reply: true };
  if (x < .55) return { text: pick(L.heat) };
  if (x < .62) return { text: pick(L.cold) };
  if (x < .75) return { text: pick(L.time) };
  if (x < .88) return { text: pick(L.gossip) };
  return { text: a.mode === 'work' ? pick(L.work) : pick(L.time) };
}

// ---------------------------------------------------------------- particulas
function addPart(kind, x, y, o) { S.parts.push(Object.assign({ kind, x, y, vx: 0, vy: 0, g: 0, t: 0, life: 1.4, col: '#fff' }, o || {})); }
function confetti(x, y, n) {
  const cols = ['#ff3fa4', '#ffd23f', '#3fd8ff', '#3fff9a', '#a43fff', '#ff6a3f'];
  for (let i = 0; i < (n || 40); i++) addPart('confetti', x + rand(-6, 6), y, { vx: rand(-55, 55), vy: rand(-120, -50), g: 190, life: rand(1.2, 2.1), col: pick(cols) });
}
function sparkle(x, y, n) {
  for (let i = 0; i < (n || 10); i++) { const an = rand(0, 6.28), sp = rand(14, 40); addPart('star', x, y, { vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 10, life: rand(.5, .9), col: pick(['#ffd23f', '#ffffff', '#7fd0ff']) }); }
}
function papers(x, y, n) { for (let i = 0; i < (n || 4); i++) addPart('paper', x + rand(-5, 5), y - 12, { vx: rand(-30, 30), vy: rand(-50, -15), g: 45, life: rand(1.4, 2.2) }); }
function drawZ(c, x, y, s, col) { R(c, x, y, 3 * s, s, col); R(c, x + 2 * s, y + s, s, s, col); R(c, x + s, y + 2 * s, s, s, col); R(c, x, y + 3 * s, 3 * s, s, col); }
function drawParts(c, dt) {
  for (const p of S.parts) {
    p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = p.t / p.life;
    c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4);
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.kind === 'confetti') { const w = (Math.floor(p.t * 9 + p.x) % 2) ? 3 : 2; R(c, x, y, w, 2, p.col); }
    else if (p.kind === 'paper') { R(c, x - 1, y - 1, 7, 5, INK); R(c, x, y, 5, 3, '#fffdf2'); R(c, x + 1, y + 1, 3, 1, '#8899aa'); }
    else if (p.kind === 'z') { const s = k < .5 ? 1 : 2, zx = x + Math.round(Math.sin(p.t * 3) * 2); drawZ(c, zx + 1, y + 1, s, INK); drawZ(c, zx, y, s, '#e9f0ff'); }
    else if (p.kind === 'steam') { R(c, x, y, 1, 2, 'rgba(255,255,255,.75)'); }
    else if (p.kind === 'star') { R(c, x, y - 1, 1, 3, p.col); R(c, x - 1, y, 3, 1, p.col); }
    c.globalAlpha = 1;
  }
  S.parts = S.parts.filter((p) => p.t < p.life);
  if (S.parts.length > 400) S.parts.splice(0, S.parts.length - 400);
}
function addMemo(x0, y0, x1, y1) { S.fx.push({ x0, y0, x1, y1, t: 0, dur: 1.0 }); }
function drawFx(c, dt) {
  for (const f of S.fx) {
    f.t += dt;
    const p = Math.min(1, f.t / f.dur), e = p * p * (3 - 2 * p);
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(p * Math.PI) * 18;
    c.save(); c.translate(Math.round(x), Math.round(y));
    R(c, -5, -4, 10, 8, INK); R(c, -4, -3, 8, 6, '#fffdf2'); R(c, -3, -1, 6, 1, '#8899aa'); R(c, -3, 1, 4, 1, '#8899aa');
    c.restore();
  }
  S.fx = S.fx.filter((f) => f.t < f.dur);
}

// ---------------------------------------------------------------- actores
const deptSpots = (a) => SPOTS[a.dept] || SPOTS[S.defaultDept];
const deskOf = (a) => DESKS[a.deskId || a.home] || null;

function makeActor(ch) {
  const dept = ch.dept || S.defaultDept;
  const a = {
    id: ch.id, name: ch.name, role: ch.role, kind: ch.kind, dept, chat: !!ch.chat, agentType: ch.agentType || null,
    home: ch.desk ? dept + '.' + ch.desk : null, x: 0, y: 0, tx: 0, ty: 0, dir: 'down', pose: 'sit', anim: Math.random() * 10, alpha: 1,
    active: false, mode: 'away', path: [], carry: false, mug: false, food: null, eating: false, sleeping: false, napDesk: false,
    bubble: null, want: 'idle', sv: null, timer: 0, talk: 0, spotKey: null, deskId: null, then: null, final: null, fading: 0, run: false,
    fall: 0, fallDir: 1, hunger: rand(0, .5), tired: rand(0, .4), pingT: rand(20, 45), fxT: 0, routine: null, step: null, convo: null,
    lastBump: -99, chatCool: 0,
  };
  const door = SPOTS[dept].door;
  if (ch.kind === 'boss' || ch.kind === 'resident') {
    const d = DESKS[a.home];
    a.active = true; a.mode = 'idle_desk'; a.deskId = a.home; a.x = d.x; a.y = d.y; a.tx = d.tx; a.ty = d.ty; a.timer = rand(3, 12);
  } else {
    a.x = door.x * T + 8; a.y = door.y * T + 14; a.tx = door.x; a.ty = door.y;
  }
  a.tag = document.createElement('div'); a.tag.className = 'tag';
  a.tag.innerHTML = '<span class="nm"><i class="dot"></i><span class="n"></span></span>';
  a.tag.querySelector('.n').textContent = ch.name;
  a.bub = document.createElement('div'); a.bub.className = 'bub'; a.bub.hidden = true;
  overlay.appendChild(a.tag); overlay.appendChild(a.bub);
  return a;
}

const taken = new Map();
function takeSpot(a, s) { releaseSpot(a); const k = s.x + ',' + s.y; taken.set(k, a.id); a.spotKey = k; }
function releaseSpot(a) { if (a.spotKey && taken.get(a.spotKey) === a.id) taken.delete(a.spotKey); a.spotKey = null; }
const spotFree = (s) => !taken.has(s.x + ',' + s.y);
const seatY = (s) => (s.sit ? (s.py != null ? s.py : (s.dir === 'down' ? (s.y + 1) * T + 5 : s.y * T + 12)) : undefined);

function say(a, text, ms, cls) { a.bubble = { text, until: now() + ms / 1000, cls: cls || '' }; }
function later(sec, fn) { S.later.push({ at: now() + sec, fn }); }
function face(a, b) {
  if (a.mode === 'idle_desk' || a.mode === 'work' || a.pose === 'sit' || a.pose === 'type') return;
  const dx = b.x - a.x, dy = b.y - a.y;
  a.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// ---------------------------------------------------------------- navegacion
function goTo(a, tx, ty, o) {
  o = o || {};
  const p = findPath(a.tx, a.ty, tx, ty);
  a.then = o.then || null; a.run = !!o.run;
  a.final = { x: o.x != null ? o.x : tx * T + 8, y: o.y != null ? o.y : ty * T + 14, dir: o.dir || null, pose: o.pose || 'stand', tx, ty };
  a.path = p == null ? [] : p;
  if (p == null) { a.x = a.final.x; a.y = a.final.y; a.tx = tx; a.ty = ty; arrive(a); return; }
  if (p.length === 0) { arrive(a); return; }
  a.mode = 'moving'; a.pose = a.run ? 'run' : 'walk';
}
function arrive(a) {
  const f = a.final;
  if (f) { a.x = f.x; a.y = f.y; a.tx = f.tx; a.ty = f.ty; if (f.dir) a.dir = f.dir; a.pose = f.pose; }
  a.path = []; a.final = null; a.run = false;
  const cb = a.then; a.then = null;
  if (cb) cb();
}
function seatPose(a, d) {
  goTo(a, d.tx, d.ty, {
    x: d.x, y: d.y, dir: 'down', pose: 'sit', run: a._hurry,
    then: () => { a.mug = false; a.food = null; a.eating = false; a.sleeping = false; a.mode = (a.want === 'work' || a.want === 'wait') ? 'work' : 'idle_desk'; a.timer = rand(5, 12); },
  });
  a._hurry = false;
}
function goHome(a) {
  const d = deskOf(a);
  if (!d) { if (a.kind === 'temp' || a.kind === 'reserve') leave(a); return; }
  a.mode = 'moving';
  seatPose(a, d);
}
function leave(a) {
  releaseSpot(a); a.carry = false; a.routine = null; a.step = null;
  a.mode = 'leaving';
  const door = deptSpots(a).door;
  goTo(a, door.x, door.y, { dir: 'down', pose: 'walk', then: () => { a.fading = -1; } });
}

function assignDesk(a) {
  const homes = new Set(S.roster.characters.filter((c) => c.kind !== 'temp' && c.dept === a.dept && c.desk).map((c) => a.dept + '.' + c.desk));
  const used = new Set([...S.actors.values()].filter((o) => o !== a && o.deskId).map((o) => o.deskId));
  const cands = DESK_IDS.map((id) => a.dept + '.' + id).filter((k) => DESKS[k] && !homes.has(k));
  if (DESKS[a.dept + '.R1']) cands.push(a.dept + '.R1');
  return cands.find((k) => !used.has(k)) || pick(cands);
}

// ---------------------------------------------------------------- estados que manda el servidor
function stopActivity(a) {
  if (a.convo) endConvo(a.convo, true);
  releaseSpot(a);
  a.routine = null; a.step = null; a.mug = false; a.food = null; a.eating = false; a.sleeping = false; a.napDesk = false;
}
const hurried = (a) => (S.busy[a.dept] || 0) >= 3 || Math.random() < .3;

function appear(a) {
  a.active = true; a.alpha = 0; a.fading = 1;
  const door = deptSpots(a).door;
  a.x = door.x * T + 8; a.y = door.y * T + 14; a.tx = door.x; a.ty = door.y; a.dir = 'up'; a.pose = 'stand'; a.path = [];
  a.deskId = a.kind === 'reserve' ? a.home : assignDesk(a);
  sparkle(a.x, a.y - 14, 12);
  say(a, pick(['¡Presente!', '¡Ya llegué!', 'Me llamaron.', 'Aquí estoy.']), 2200);
}

function onWant(a) {
  const w = a.want;
  if (w === 'work' || w === 'wait') {
    const wasDeliver = a.mode === 'deliverGo' || a.mode === 'deliverWait';
    stopActivity(a);
    if (wasDeliver) a.carry = false;
    if (a.fading < 0) a.fading = 1;
    if ((a.kind === 'temp' || a.kind === 'reserve') && !a.active) appear(a);
    const d = deskOf(a);
    if (!d) return;
    if (a.tx === d.tx && a.ty === d.ty && a.mode !== 'moving' && !a.path.length) { a.x = d.x; a.y = d.y; a.mode = 'work'; a.pose = 'sit'; a.dir = 'down'; }
    else { a._hurry = hurried(a); seatPose(a, d); }
  } else if (w === 'done') {
    if (a.kind === 'boss') return;
    startDeliver(a);
  } else if (a.kind === 'temp' || a.kind === 'reserve') {
    if (a.active && !['deliverGo', 'deliverWait', 'leaving'].includes(a.mode)) { stopActivity(a); leave(a); }
  } else if (a.mode === 'work') { a.mode = 'idle_desk'; a.timer = rand(3, 7); }
}

function nextInPipe(a) {
  const ids = PIPE[a.dept] || [];
  const i = ids.indexOf(a.id);
  if (i < 0) return null;
  for (let k = 1; k < ids.length; k++) {
    const o = S.actors.get(ids[(i + k) % ids.length]);
    if (o && o.active && o !== a && (o.mode === 'work' || o.mode === 'idle_desk')) return o;
  }
  return null;
}

function startDeliver(a) {
  stopActivity(a);
  a.carry = true; say(a, '¡Listo!', 2400, 'memo');
  const W = deptSpots(a), boss = S.actors.get(S.bossOf[a.dept]);
  const nx = nextInPipe(a);
  if (nx) { addMemo(a.x, a.y - 14, nx.x, nx.y - 14); later(.5, () => { if (nx.active) say(nx, 'Recibido de ' + a.name, 2200); }); }
  const spot = [W.boss, ...W.bossQueue].find((s) => spotFree(s)) || W.boss;
  takeSpot(a, spot);
  a.mode = 'deliverGo';
  goTo(a, spot.x, spot.y, {
    dir: 'up', pose: 'stand', run: (S.busy[a.dept] || 0) >= 3,
    then: () => {
      a.mode = 'deliverWait'; a.timer = 2.8;
      if (boss) { say(boss, pick(THANKS), 2400); addMemo(a.x, a.y - 12, boss.x, boss.y - 12); }
      confetti(a.x, a.y - 22, 38); sparkle(a.x, a.y - 20, 8);
      a.carry = false;
    },
  });
}
function finishDeliver(a) {
  a.carry = false; releaseSpot(a);
  if (a.kind === 'temp' || a.kind === 'reserve') leave(a); else goHome(a);
}

// ---------------------------------------------------------------- rutinas (comer, siesta, cafe, etc.)
function runRoutine(a, steps, onEnd) { a.routine = { steps, i: 0, onEnd: onEnd || null }; nextStep(a); }
function nextStep(a) {
  const r = a.routine; if (!r) return;
  if (r.i >= r.steps.length) {
    const e = r.onEnd; a.routine = null; a.step = null; releaseSpot(a); a.sleeping = false; a.eating = false;
    if (e) e(a); else goHome(a);
    return;
  }
  const st = r.steps[r.i++]; a.step = st;
  const s = st.spot;
  takeSpot(a, s);
  a.mode = 'moving';
  goTo(a, s.x, s.y, {
    dir: s.dir, pose: s.sit ? 'sit' : 'stand', y: seatY(s), run: !!st.run,
    then: () => {
      a.mode = 'spot'; a.timer = st.dur || 1; a.talk = rand(1.5, 3.5);
      if (st.act === 'eat') a.eating = true;
      if (st.act === 'sleep') a.sleeping = true;
      if (st.act === 'drink') a.mug = true;
      if (st.say) say(a, st.say, 2400);
      if (st.on) st.on(a);
    },
  });
}
function endStep(a) {
  const st = a.step;
  if (st) {
    if (st.act === 'eat') a.eating = false;
    if (st.act === 'sleep') a.sleeping = false;
    if (st.after) st.after(a);
  }
  nextStep(a);
}

function startEat(a) {
  const W = deptSpots(a);
  const useFridge = Math.random() < .55;
  const src = useFridge ? W.fridge[0] : W.vending[0];
  if (!spotFree(src)) return false;
  stopActivity(a);
  const lunch = W.lunch.filter(spotFree);
  const foods = useFridge ? ['sandwich', 'apple', 'salad', 'pizza'] : ['chips', 'donut'];
  const steps = [{
    spot: src, dur: 2.2, say: useFridge ? pick(['*abre la nevera*', '¿Qué habrá aquí?', 'Veamos...']) : pick(['*clink clink*', '¡Se atoró!', 'Una de papas.']),
    on: (x) => { x.food = pick(foods); },
  }];
  if (lunch.length) steps.push({ spot: pick(lunch), dur: rand(8, 12), act: 'eat', chat: true, say: pick(['Mmm...', '¡Qué rico!', 'Al fin.']), after: (x) => { x.food = null; x.hunger = 0; say(x, pick(['Estaba delicioso.', 'Ahora sí, a trabajar.', 'Qué rico estuvo.']), 2400); } });
  else steps.push({ spot: src, dur: rand(7, 10), act: 'eat', after: (x) => { x.food = null; x.hunger = 0; say(x, 'Estaba rico.', 2200); } });
  runRoutine(a, steps);
  return true;
}
function startNap(a) {
  const W = deptSpots(a);
  const seats = (a.kind === 'boss' ? [...W.lounge, ...W.couch] : W.lounge).filter(spotFree);
  stopActivity(a);
  const wake = (x) => { x.tired = 0; say(x, pick(['¡Me quedé dormido!', '¿Cuánto dormí?', 'Qué bien se durmió.']), 2400); };
  if (seats.length) {
    runRoutine(a, [{ spot: pick(seats), dur: rand(16, 28), act: 'sleep', say: pick(['Solo cierro los ojos...', 'Cinco minutitos.']), after: wake }]);
  } else {
    a.napDesk = true; a.sleeping = true; a.mode = 'idle_desk'; a.timer = rand(12, 20);
  }
  return true;
}
function startCoffee(a) {
  const W = deptSpots(a), s = W.coffee.filter(spotFree);
  if (!s.length) return false;
  stopActivity(a);
  runRoutine(a, [{ spot: pick(s), dur: rand(5, 8), act: 'drink', chat: true, say: pick(['Mi café...', 'Necesito cafeína.', 'Huele delicioso.']) }]);
  return true;
}
function startCooler(a) {
  const W = deptSpots(a), s = W.cooler.filter(spotFree);
  if (!s.length) return false;
  stopActivity(a);
  runRoutine(a, [{ spot: pick(s), dur: rand(5, 8), act: 'drink', chat: true, say: pick(['Un traguito de agua.', '*glup glup*']), after: (x) => { x.mug = false; } }]);
  return true;
}
function startSpotActivity(a, kind) {
  const W = deptSpots(a), s = W[kind].filter(spotFree);
  if (!s.length) return false;
  stopActivity(a);
  runRoutine(a, [{ spot: pick(s), dur: rand(8, 14), chat: true }]);
  return true;
}
function startVisit(a) {
  const others = [...S.actors.values()].filter((o) => o !== a && o.dept === a.dept && o.active && o.kind !== 'temp' && o.mode === 'idle_desk' && !o.convo && !o.napDesk && DESKS[o.deskId]);
  if (!others.length) return false;
  const o = pick(others), d = DESKS[o.deskId];
  const spot = { x: d.sx, y: d.sy + 2, dir: 'up' };
  if (!spotFree(spot) || !blocked[spot.y] || blocked[spot.y][spot.x]) return false;
  const pair = PAIRS[a.id + '>' + o.id];
  const cv_ = pair && Math.random() < .75 ? pair : pick(CONVOS);
  stopActivity(a);
  runRoutine(a, [{ spot, dur: cv_.l.length * 2.5 + 1.6, on: (x) => { if (o.mode === 'idle_desk') { startConvo(x, o, cv_.l, cv_.out); o.timer = Math.max(o.timer, cv_.l.length * 2.5 + 2); } } }]);
  return true;
}

function startOutcome(a, out) {
  if (!a.active || a.want === 'work' || a.want === 'wait' || a.want === 'done' || a.fall) return;
  if (!['idle_desk', 'spot'].includes(a.mode)) return;
  if (out === 'eat') startEat(a); else if (out === 'nap') startNap(a); else if (out === 'coffee') startCoffee(a);
}

function chooseActivity(a) {
  const W = deptSpots(a), boss = a.kind === 'boss';
  const opts = [];
  const add = (k, w) => { if (w > 0) opts.push([k, w]); };
  const anyFree = (l) => l.some(spotFree);
  add('desk', boss ? 6 : 4);
  if (anyFree(W.cooler)) add('cooler', 2);
  if (anyFree(W.coffee)) add('coffee', 3);
  add('eat', 1 + Math.max(0, a.hunger - .35) * 14);
  if (a.tired > .55) add('nap', (a.tired - .4) * 10);
  if (anyFree(W.meeting)) add('meeting', 1.5);
  if (boss && anyFree(W.couch)) add('couch', 2);
  if (!boss) add('visit', 2.5);
  let tot = opts.reduce((s, o) => s + o[1], 0), x = Math.random() * tot, kind = 'desk';
  for (const o of opts) { x -= o[1]; if (x <= 0) { kind = o[0]; break; } }
  let ok = true;
  if (kind === 'desk') ok = false;
  else if (kind === 'cooler') ok = startCooler(a);
  else if (kind === 'coffee') ok = startCoffee(a);
  else if (kind === 'eat') { if (a.hunger > .55) say(a, pick(L.hunger), 2200); ok = startEat(a); }
  else if (kind === 'nap') { say(a, pick(L.sleepy), 2000); ok = startNap(a); }
  else if (kind === 'meeting') ok = startSpotActivity(a, 'meeting');
  else if (kind === 'couch') ok = startSpotActivity(a, 'couch');
  else if (kind === 'visit') ok = startVisit(a);
  if (!ok) a.timer = rand(6, 14);
}

// ---------------------------------------------------------------- conversaciones
const convos = [];
function startConvo(a, b, lines, out) {
  if (a.convo || b.convo) return false;
  const c = { a, b, lines, i: 0, next: now() + .4, out: out || null };
  a.convo = b.convo = c; convos.push(c);
  face(a, b); face(b, a);
  return true;
}
function endConvo(c, forced) {
  const k = convos.indexOf(c); if (k >= 0) convos.splice(k, 1);
  if (c.a.convo === c) { c.a.convo = null; c.a.chatCool = now() + rand(10, 22); }
  if (c.b.convo === c) { c.b.convo = null; c.b.chatCool = now() + rand(10, 22); }
  if (!forced && c.out) { const out = c.out; later(.5, () => { startOutcome(c.a, out); later(.4, () => startOutcome(c.b, out)); }); }
}
function tickConvos() {
  for (const c of [...convos]) {
    const { a, b } = c;
    if (a.convo !== c || b.convo !== c || !a.active || !b.active || a.fall || b.fall || a.mode === 'moving' || b.mode === 'moving' || a.mode === 'crowd' || b.mode === 'crowd') { endConvo(c, true); continue; }
    if (now() < c.next) continue;
    if (c.i >= c.lines.length) { endConvo(c, false); continue; }
    const sp = c.i % 2 === 0 ? a : b;
    say(sp, c.lines[c.i], 2400); c.i++; c.next = now() + 2.6;
    face(a, b); face(b, a);
  }
}
let proxT = 0;
function proximityTick(dt) {
  proxT -= dt; if (proxT > 0) return; proxT = 1.2;
  const sp = [...S.actors.values()].filter((a) => a.active && a.mode === 'spot' && !a.convo && !a.sleeping && a.chatCool < now() && !(a.step && a.step.act === 'eat' && false));
  for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) {
    const a = sp[i], b = sp[j];
    if (a.dept !== b.dept || a.convo || b.convo) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 42) continue;
    if (Math.random() < .5) {
      const pair = PAIRS[a.id + '>' + b.id], cv_ = pair && Math.random() < .7 ? pair : pick(CONVOS.filter((x) => !x.out || x.out === 'coffee' || Math.random() < .3));
      startConvo(a, b, cv_.l, cv_.out);
      a.timer = Math.max(a.timer, cv_.l.length * 2.5 + 1); b.timer = Math.max(b.timer, cv_.l.length * 2.5 + 1);
    } else { a.chatCool = b.chatCool = now() + 8; }
  }
}

// ---------------------------------------------------------------- charla espontanea
function banterTick(dt) {
  for (const d of S.depts) {
    S.banterIn[d.id] = (S.banterIn[d.id] == null ? rand(3, 8) : S.banterIn[d.id]) - dt;
    if (S.banterIn[d.id] > 0) continue;
    S.banterIn[d.id] = rand(6, 14);
    const tn = now();
    const cand = [...S.actors.values()].filter((a) => a.dept === d.id && a.active && a.alpha > .9 && !a.fall && !a.sleeping && !a.convo && !['crowd', 'deliverGo', 'deliverWait', 'leaving'].includes(a.mode) && (!a.bubble || tn > a.bubble.until) && (a.mode !== 'work' || Math.random() < .25));
    if (!cand.length) continue;
    const a = pick(cand), line = lineFor(a);
    say(a, line.text, 3400);
    if (line.reply) {
      const others = cand.filter((o) => o !== a);
      if (others.length) { const o = pick(others); later(2.3, () => { if (o.active && !o.sleeping && !o.fall) { say(o, pick(REPLIES), 2600); face(o, a); } }); }
    }
  }
}

// ---------------------------------------------------------------- urgencia, choques
function deptAlert(dept) { for (const a of S.actors.values()) if (a.dept === dept && a.want === 'wait') return true; return false; }
function urgency(dept, srcId) {
  if (!SPOTS[dept]) return;
  let i = 0;
  for (const a of S.actors.values()) {
    if (a.dept !== dept || !a.active || a.alpha < .8 || a.kind === 'boss' || a.id === srcId || a.want === 'wait') continue;
    if (['deliverGo', 'deliverWait', 'leaving', 'crowd'].includes(a.mode)) continue;
    later((i++) * .18 + rand(0, .4), () => joinCrowd(a));
  }
}
function joinCrowd(a) {
  if (!a.active || a.mode === 'crowd' || a.fall || a.want === 'wait') return;
  const free = deptSpots(a).crowd.filter(spotFree);
  if (!free.length) return;
  stopActivity(a);
  const s = pick(free); takeSpot(a, s);
  say(a, pick(['¿Qué pasó?', '¡Voy, voy!', '¡Corran!', '¿Es urgente?', '¡Oscar nos necesita!']), 2200);
  a.mode = 'moving';
  goTo(a, s.x, s.y, { dir: s.dir, pose: 'stand', run: true, then: () => { a.mode = 'crowd'; a.timer = rand(9, 15); } });
}
function leaveCrowd(a) {
  releaseSpot(a);
  if (a.want === 'work' || a.want === 'wait') { a.mode = 'moving'; a._hurry = true; const d = deskOf(a); if (d) seatPose(a, d); }
  else if (a.kind === 'temp' || a.kind === 'reserve') leave(a);
  else goHome(a);
}
function trip(v, o) {
  v.fall = 1.8; v.fallDir = o.x >= v.x ? 1 : -1; v.pose = 'fall';
  say(v, pick(['¡Ay!', '¡Auch!', '¡Uf!', '¡Mi rodilla!']), 1800);
  say(o, pick(['¡Perdón!', '¿Estás bien?', '¡Fíjate!', '¡Uy!']), 2000);
  if (v.carry) papers(v.x, v.y, 5); else papers(v.x, v.y, 2);
}
function checkTrips() {
  const list = [...S.actors.values()].filter((a) => a.active && a.path.length && !a.fall && a.alpha > .8);
  const tn = now();
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.dept !== b.dept) continue;
    if (Math.abs(a.x - b.x) > 9 || Math.abs(a.y - b.y) > 5) continue;
    if (tn - a.lastBump < 8 || tn - b.lastBump < 8) continue;
    const hurry = a.run || b.run || (S.busy[a.dept] || 0) >= 3;
    if (!hurry) continue;
    a.lastBump = b.lastBump = tn;
    if (Math.random() < .65) { const v = a.run ? a : (b.run ? b : (Math.random() < .5 ? a : b)); trip(v, v === a ? b : a); }
  }
}

// ---------------------------------------------------------------- vida de cada actor
function think(a, dt) {
  a.anim += dt;
  if (a.fading) {
    a.alpha = clamp(a.alpha + a.fading * dt * 2, 0, 1);
    if (a.fading > 0 && a.alpha >= 1) a.fading = 0;
    if (a.fading < 0 && a.alpha <= 0) { a.fading = 0; a.active = false; a.mode = 'away'; a.deskId = a.kind === 'reserve' ? null : null; a.path = []; releaseSpot(a); a.mug = false; a.food = null; }
  }
  if (!a.active) return;
  a.hunger = Math.min(1, a.hunger + dt / 170);
  a.tired = Math.min(1, a.tired + dt / 240);
  if (a.fall > 0) { a.fall -= dt; a.pose = 'fall'; if (a.fall <= 0) { a.fall = 0; a.pose = a.path.length ? (a.run ? 'run' : 'walk') : 'stand'; } return; }
  a.fxT -= dt;
  if (a.sleeping && a.fxT <= 0) { a.fxT = 1.1; addPart('z', a.x + 5, a.y - 30, { vy: -9, life: 1.8 }); }
  else if (a.mug && a.mode === 'spot' && a.fxT <= 0) { a.fxT = .45; addPart('steam', a.x + (a.dir === 'left' ? -7 : 7) + rand(-1, 1), a.y - 15, { vy: -11, life: .9 }); }

  if (a.path.length) {
    const n = a.path[0];
    const gx = n.x * T + 8, gy = n.y * T + 14;
    const dx = gx - a.x, dy = gy - a.y, dist = Math.hypot(dx, dy);
    let sp = a.run ? 92 : ((a.kind === 'temp' || a.kind === 'reserve' || a.carry) ? 52 : 44);
    if (!a.run && (S.busy[a.dept] || 0) >= 3) sp *= 1.25;
    sp *= dt;
    if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? 'right' : 'left'; else if (dist > 0.1) a.dir = dy > 0 ? 'down' : 'up';
    a.pose = a.run ? 'run' : 'walk';
    if (dist <= sp) { a.x = gx; a.y = gy; a.tx = n.x; a.ty = n.y; a.path.shift(); if (!a.path.length) arrive(a); }
    else { a.x += dx / dist * sp; a.y += dy / dist * sp; }
    return;
  }

  switch (a.mode) {
    case 'work': {
      a.pose = a.want === 'wait' ? 'sit' : 'type';
      a.pingT -= dt;
      if (a.pingT <= 0) {
        a.pingT = rand(25, 55);
        const mates = [...S.actors.values()].filter((o) => o !== a && o.dept === a.dept && o.active && o.alpha > .9 && (o.mode === 'work' || o.mode === 'idle_desk'));
        if (mates.length && Math.random() < .7) {
          const o = pick(mates);
          addMemo(a.x, a.y - 14, o.x, o.y - 14);
          say(a, pick(['Te paso esto.', 'Mira este archivo.', '¿Me ayudas?', 'Para ti.']), 2200);
          later(1.4, () => { if (o.active && !o.bubble) say(o, pick(['Recibido.', 'Gracias.', 'Lo reviso.']), 2000); });
        }
      }
      break;
    }
    case 'idle_desk': {
      a.pose = a.napDesk ? 'sleepdesk' : 'sit';
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.napDesk) { a.napDesk = false; a.sleeping = false; a.tired = 0; a.pose = 'sit'; say(a, '¡Me quedé dormido!', 2400); a.timer = rand(5, 10); }
        else chooseActivity(a);
      }
      break;
    }
    case 'spot': {
      a.timer -= dt;
      const st = a.step;
      if (st && st.chat && !a.convo && !a.sleeping) {
        a.talk -= dt;
        if (a.talk <= 0) { a.talk = rand(4, 8); if (Math.random() < .5) say(a, lineFor(a).text, 2600); }
      }
      if (a.timer <= 0) endStep(a);
      break;
    }
    case 'deliverWait': {
      a.pose = 'stand'; a.timer -= dt;
      if (a.timer <= 0) finishDeliver(a);
      break;
    }
    case 'crowd': {
      a.pose = 'stand'; a.timer -= dt;
      if (!deptAlert(a.dept) && a.timer > 2) a.timer = 2;
      if (a.timer <= 0) leaveCrowd(a);
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- camara
const sw = () => stage.clientWidth || 800;
const sh = () => stage.clientHeight || 600;
const minZ = () => Math.min(sw() / W, sh() / H) * 0.95;
const fitZ = (rw, rh, pad) => Math.min(sw() / (rw + pad * 2), sh() / (rh + pad * 2));
const camLeft = () => CAM.x - sw() / (2 * CAM.z);
const camTop = () => CAM.y - sh() / (2 * CAM.z);
function clampCam(c) {
  const z = clamp(c.z, minZ(), 6);
  const hw = sw() / (2 * z), hh = sh() / (2 * z);
  return { z, x: hw * 2 >= W ? W / 2 : clamp(c.x, hw, W - hw), y: hh * 2 >= H ? H / 2 : clamp(c.y, hh, H - hh) };
}
function glideTo(x, y, z, instant) {
  const g = clampCam({ x, y, z });
  if (instant) { Object.assign(CAM, g); CAM.goal = null; } else CAM.goal = g;
}
const wingX = (dept) => { const w = WINGS.find((q) => q.name === dept); return (w ? w.ox : 0) * T; };
const curDept = () => (CAM.x < WCOLS * T ? WINGS[0].name : WINGS[1].name);
function viewWing(dept, instant) {
  const z = Math.floor(fitZ(WCOLS * T, H, 3) * 20) / 20;
  glideTo(wingX(dept) + WCOLS * T / 2, H / 2, z, instant);
  VIEW.kind = 'wing'; VIEW.dept = dept; VIEW.room = null; VIEW.follow = false; VIEW.autoRoom = false;
  store.set('dept', dept); uiCam();
}
function viewAll(instant) {
  glideTo(W / 2, H / 2, fitZ(W, H, 4), instant);
  VIEW.kind = 'all'; VIEW.room = null; VIEW.follow = false; VIEW.autoRoom = false; uiCam();
}
function viewRoom(dept, id, auto) {
  const r = (ROOMS[dept] || []).find((q) => q.id === id); if (!r) return;
  const [x, y, w, h] = r.rect;
  glideTo(x + w / 2, y + h / 2, Math.min(5, fitZ(w, h, 6)), false);
  VIEW.kind = 'room'; VIEW.dept = dept; VIEW.room = id; VIEW.follow = false; VIEW.autoRoom = !!auto; uiCam();
}
function focusActor(a, z) { glideTo(a.x, a.y - 12, z || 3.2, false); VIEW.kind = 'free'; uiCam(); }
function userTouched() { S.lastUser = now(); VIEW.autoRoom = false; }
function zoomAt(px, py, f) {
  const wx = camLeft() + px / CAM.z, wy = camTop() + py / CAM.z;
  const z = clamp(CAM.z * f, minZ(), 6);
  const g = clampCam({ z, x: wx - (px - sw() / 2) / z, y: wy - (py - sh() / 2) / z });
  Object.assign(CAM, g); CAM.goal = null; VIEW.kind = 'free'; userTouched(); uiCam();
}
function stepCam(dt) {
  if (VIEW.follow && S.sel) {
    const a = S.actors.get(S.sel);
    if (a && a.active) CAM.goal = clampCam({ x: a.x, y: a.y - 12, z: Math.max(CAM.z, 2.8) });
  }
  if (CAM.goal) {
    const k = 1 - Math.exp(-dt * 5), g = CAM.goal;
    CAM.x += (g.x - CAM.x) * k; CAM.y += (g.y - CAM.y) * k; CAM.z += (g.z - CAM.z) * k;
    if (Math.abs(g.x - CAM.x) < .3 && Math.abs(g.y - CAM.y) < .3 && Math.abs(g.z - CAM.z) < .002 && !VIEW.follow) { Object.assign(CAM, g); CAM.goal = null; }
  } else { const g = clampCam(CAM); Object.assign(CAM, g); }
}
const keys = new Set();
function keyPan(dt) {
  if (!keys.size) return;
  const sp = 340 / CAM.z * dt;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= sp;
  if (keys.has('ArrowRight') || keys.has('d')) dx += sp;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= sp;
  if (keys.has('ArrowDown') || keys.has('s')) dy += sp;
  if (dx || dy) { CAM.goal = null; const g = clampCam({ z: CAM.z, x: CAM.x + dx, y: CAM.y + dy }); Object.assign(CAM, g); VIEW.kind = 'free'; userTouched(); uiCam(); }
}

// camara automatica: sigue la accion
setInterval(() => {
  if (!VIEW.auto || VIEW.follow || now() - S.lastUser < 25 || VIEW.kind === 'all' || !S.depts.length) return;
  const score = {};
  for (const d of S.depts) {
    let sc = 0;
    for (const a of S.actors.values()) if (a.dept === d.id && a.active) { if (a.want === 'wait') sc += 6; else if (a.want === 'work') sc += 2; else if (a.want === 'done') sc += 1; }
    score[d.id] = sc;
  }
  for (const d of S.depts) {
    const key = d.id + (deptAlert(d.id) ? '!' : '');
    if (deptAlert(d.id) && !S.alertShown[d.id]) { S.alertShown[d.id] = true; viewRoom(d.id, 'boss', true); return; }
    if (!deptAlert(d.id)) S.alertShown[d.id] = false;
    void key;
  }
  const alerting = S.depts.some((d) => deptAlert(d.id));
  if (VIEW.kind === 'room' && VIEW.autoRoom && !alerting) { viewWing(VIEW.dept); VIEW.autoRoom = false; return; }
  const best = S.depts.reduce((m, d) => (score[d.id] > score[m.id] ? d : m), S.depts[0]);
  const cur = curDept();
  if (score[best.id] > 0 && best.id !== cur && score[best.id] > (score[cur] || 0)) viewWing(best.id);
}, 2500);

// ---------------------------------------------------------------- dibujo
function hourNow() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
function tintFor() {
  const h = hourNow();
  if (h >= 21.5 || h < 5.5) return ['#0a1038', .28];
  if (h < 7) return ['#ff9b5e', .1 + (7 - h) * .08];
  if (h >= 18 && h < 21.5) return ['#ff8a3c', Math.min(.22, (h - 18) / 3.5 * .26)];
  return null;
}
function render(dt) {
  const dpr = window.devicePixelRatio || 1;
  const k = CAM.z * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, -Math.round(camLeft() * k), -Math.round(camTop() * k));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg, 0, 0);
  const list = PROPS.map((p) => ({ y: p.sortY, p }));
  for (const a of S.actors.values()) if (a.active) list.push({ y: a.y, a });
  list.sort((m, n) => m.y - n.y);
  for (const it of list) {
    if (it.p) it.p.draw(ctx, S, S.t);
    else {
      const a = it.a;
      if (S.sel === a.id) { ctx.fillStyle = 'rgba(80,140,255,.55)'; ctx.fillRect(Math.round(a.x) - 8, Math.round(a.y) - 1, 16, 3); ctx.fillStyle = 'rgba(160,200,255,.9)'; ctx.fillRect(Math.round(a.x) - 6, Math.round(a.y), 12, 1); }
      drawChar(ctx, a);
    }
  }
  drawParts(ctx, dt); drawFx(ctx, dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (VIEW.night) { const t = tintFor(); if (t) { ctx.globalAlpha = t[1]; ctx.fillStyle = t[0]; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; } }
}

const signEls = [];
function ensureSigns() {
  if (signEls.length) return;
  for (const s of SIGNS) { const d = document.createElement('div'); d.className = 'sign'; d.textContent = s.txt; d.style.color = s.col; overlay.appendChild(d); signEls.push({ d, s }); }
}
function placeOverlay() {
  const z = CAM.z, Lf = camLeft(), Tp = camTop(), w = sw(), h = sh(), tnow = now();
  S.nf = clamp(3.1 * z + 2, 7, 13);
  const root = document.documentElement.style;
  root.setProperty('--nf', S.nf + 'px'); root.setProperty('--bf', clamp(3.4 * z + 2.5, 8, 14) + 'px'); root.setProperty('--bw', clamp(80 * z, 140, 260) + 'px');
  ensureSigns();
  for (const { d, s } of signEls) {
    const fs = s.fs * z, x = (s.x - Lf) * z, y = (s.y - Tp) * z;
    d.style.display = fs < 4.5 || x < -200 || x > w + 200 ? 'none' : '';
    d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.fontSize = fs + 'px';
  }
  for (const a of S.actors.values()) {
    const px = (a.x - Lf) * z, top = (a.y - 31 - Tp) * z;
    const show = a.active && a.alpha > 0.3 && px > -80 && px < w + 80 && top > -40 && top < h + 60;
    a.tag.style.display = show ? '' : 'none';
    if (!show) { a.bub.hidden = true; continue; }
    let btext = null, bcls = '';
    if (a.bubble && tnow < a.bubble.until) { btext = a.bubble.text; bcls = a.bubble.cls; }
    else if (a.want === 'wait') { btext = '⚠ ' + (a.sv && a.sv.text ? a.sv.text : 'Necesito tu OK'); bcls = 'alert'; }
    else if (a.want === 'work' && a.mode === 'work' && a.sv && a.sv.text) { btext = a.sv.text; bcls = ''; }
    a.tag.style.left = px + 'px'; a.tag.style.top = top + 'px';
    a.tag.className = 'tag ' + (a.want === 'work' ? 'working' : a.want === 'wait' ? 'waiting' : '') + (S.sel === a.id ? ' sel' : '');
    if (btext) {
      if (a.bub.dataset.t !== btext) { a.bub.textContent = btext; a.bub.dataset.t = btext; }
      a.bub.className = 'bub ' + bcls;
      a.bub.hidden = false;
      const hw = (a.bub.offsetWidth || 120) / 2 + 2;
      a.bub.style.left = clamp(px, hw, Math.max(hw, w - hw)) + 'px';
      a.bub.style.top = (top - S.nf - 9) + 'px';
    } else a.bub.hidden = true;
  }
}

function drawMini() {
  const mw = mini.width, mh = mini.height, s = mw / W;
  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = 'rgba(14,16,24,.85)'; mctx.fillRect(0, 0, mw, mh);
  WINGS.forEach((wg, i) => { mctx.fillStyle = i === 0 ? '#3a4a66' : '#3a2f5a'; mctx.fillRect(wg.ox * T * s + 1, 2, WCOLS * T * s - 2, mh - 4); });
  for (const a of S.actors.values()) {
    if (!a.active) continue;
    mctx.fillStyle = a.want === 'wait' ? '#ffb020' : a.want === 'work' ? '#3ddc84' : '#cfd6e6';
    mctx.fillRect(Math.round(a.x * s) - 1, Math.round(a.y * s) - 1, 3, 3);
  }
  mctx.strokeStyle = '#7fb0ff'; mctx.lineWidth = 1;
  mctx.strokeRect(Math.round(camLeft() * s) + .5, Math.round(camTop() * s) + .5, Math.round(sw() / CAM.z * s), Math.round(sh() / CAM.z * s));
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(sw() * dpr); cv.height = Math.round(sh() * dpr);
  if (VIEW.kind === 'wing' && VIEW.dept) viewWing(VIEW.dept, true);
  else if (VIEW.kind === 'all') viewAll(true);
  else { const g = clampCam(CAM); Object.assign(CAM, g); }
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- bucle
function computeBusy() {
  S.busy = {};
  for (const a of S.actors.values()) if (a.active && (a.want === 'work' || a.want === 'wait' || a.want === 'done' || a.mode === 'crowd')) S.busy[a.dept] = (S.busy[a.dept] || 0) + 1;
}
function frame(dt) {
  S.t += dt;
  const tn = now();
  for (let i = S.later.length - 1; i >= 0; i--) { const q = S.later[i]; if (tn >= q.at) { S.later.splice(i, 1); try { q.fn(); } catch (_) {} } }
  tickConvos(); banterTick(dt); proximityTick(dt);
  for (const a of S.actors.values()) think(a, dt);
  computeBusy(); checkTrips();
  S.deskActive = {};
  for (const a of S.actors.values()) if (a.active && a.mode === 'work' && a.deskId && a.want === 'work') S.deskActive[a.deskId] = true;
  keyPan(dt); stepCam(dt);
  render(dt); placeOverlay(); drawMini();
}

// ---------------------------------------------------------------- red
let es = null;
function connect() {
  es = new EventSource('/events');
  es.onopen = () => { $('#offline').hidden = true; };
  es.onerror = () => { $('#offline').hidden = false; };
  es.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.type === 'hello') onHello(m);
    else if (m.type === 'state') onState(m);
    else if (m.type === 'cue') onCue(m);
    else if (m.type === 'chat') onChat(m);
  };
}
function onHello(m) {
  S.roster = m.roster; S.history = m.history || {};
  $('#subtitle').textContent = m.roster.office.subtitle || '';
  $('.brand').textContent = m.roster.office.name || 'OFICINA';
  if (!S.actors.size) {
    S.depts = m.roster.departments || [{ id: 'agency', name: 'Oficina', boss: 'michael', default: true }];
    S.defaultDept = (S.depts.find((d) => d.default) || S.depts[0]).id;
    for (const d of S.depts) S.bossOf[d.id] = d.boss;
    for (const ch of m.roster.characters) S.actors.set(ch.id, makeActor(ch));
    const saved = store.get('dept', S.defaultDept);
    viewWing(S.depts.some((d) => d.id === saved) ? saved : S.defaultDept, true);
    renderTeam();
  }
}
function onState(st) {
  S.state = st;
  for (const a of S.actors.values()) {
    const sv = st.actors[a.id] || null;
    a.sv = sv;
    let w = 'idle';
    if (sv) w = sv.status === 'working' ? 'work' : sv.status === 'waiting' ? 'wait' : sv.status === 'done' ? 'done' : 'idle';
    if (w !== a.want) { a.want = w; onWant(a); }
    else if (w === 'work' && a.mode === 'idle_desk') { onWant(a); }
  }
  $('#chipSessions').textContent = st.sessions.length + (st.sessions.length === 1 ? ' sesión' : ' sesiones');
  const working = [...S.actors.values()].filter((a) => a.want === 'work' || a.want === 'wait').length;
  $('#chipWorking').textContent = working + ' trabajando';
  const dn = st.done || 0;
  $('#chipDone').textContent = '✓ ' + dn + ' hoy';
  if (S.doneCount >= 0 && dn > S.doneCount) { const c = $('#chipDone'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  S.doneCount = dn;
  $('#chkSound').checked = !!st.sound;
  renderLog(); renderTeam();
}
function onCue(m) {
  const a = S.actors.get(m.charId); if (!a) return;
  const boss = S.actors.get(S.bossOf[a.dept] || S.bossOf[S.defaultDept]);
  if (m.kind === 'delegate' && boss) {
    say(boss, '→ ' + a.name + ': ' + (m.text || 'tarea nueva'), 4200, 'memo');
    const d = deskOf(a) || (DESKS[a.home]);
    const door = deptSpots(a).door;
    const tx = a.active ? a.x : (d ? d.x : door.x * T), ty = a.active ? a.y - 12 : (d ? d.y - 12 : door.y * T);
    addMemo(boss.x, boss.y - 12, tx, ty);
  } else if (m.kind === 'prompt') {
    say(a, 'Oscar dice: ' + m.text, 3200, 'memo');
  } else if (m.kind === 'alert') {
    say(a, '⚠ ' + (m.text || 'Te necesito'), 6000, 'alert');
    if (m.text !== 'Te estoy esperando') urgency(a.dept, a.id);
  }
}

// ---------------------------------------------------------------- panel
function statusText(a) {
  if (!a.active && a.kind === 'reserve') return 'En reserva, lista para usar';
  if (!a.active) return 'Libre';
  if (a.want === 'wait') return '⚠ ' + ((a.sv && a.sv.text) || 'Necesita tu permiso');
  if (a.want === 'work') return (a.sv && a.sv.text) || 'Trabajando';
  if (a.want === 'done') return 'Entregando resultado';
  if (a.mode === 'crowd') return '¡Corrió a ver qué pasa!';
  if (a.sleeping) return 'Durmiendo la siesta';
  if (a.eating) return 'Comiendo';
  if (a.convo) return 'Charlando';
  if (a.mode === 'spot') return 'En un descanso';
  return 'Disponible';
}
function renderTeam() {
  const ul = $('#teamList'); ul.innerHTML = '';
  const addItem = (a, off) => {
    const li = document.createElement('li');
    li.className = (a.want === 'work' ? 'working ' : a.want === 'wait' ? 'waiting ' : a.want === 'done' ? 'done ' : '') + (S.sel === a.id ? 'sel ' : '') + (off ? 'off' : '');
    li.innerHTML = '<span class="av"></span><div><div><span class="nm"></span> <span class="rl"></span></div><div class="st"></div></div>';
    li.querySelector('.nm').textContent = a.name; li.querySelector('.rl').textContent = a.role;
    li.querySelector('.st').textContent = statusText(a);
    li.onclick = () => { select(a.id); if (a.active) { userTouched(); focusActor(a, 2.6); } };
    ul.appendChild(li);
  };
  for (const d of S.depts) {
    const mine = [...S.actors.values()].filter((a) => a.dept === d.id);
    const h = document.createElement('li'); h.className = 'head';
    const nWork = mine.filter((a) => a.want === 'work' || a.want === 'wait').length;
    h.innerHTML = '<span></span><i></i>';
    h.firstChild.textContent = d.name; h.lastChild.textContent = nWork ? nWork + ' trabajando' : 'tranquilo';
    h.onclick = () => { userTouched(); viewWing(d.id); };
    ul.appendChild(h);
    for (const a of mine) if (a.active && a.kind !== 'temp') addItem(a, false);
    for (const a of mine) if (a.active && a.kind === 'temp') addItem(a, false);
    const res = mine.filter((a) => !a.active && a.kind === 'reserve');
    if (res.length) {
      const sub = document.createElement('li'); sub.className = 'sub'; sub.textContent = 'En reserva (' + res.length + ')'; ul.appendChild(sub);
      for (const a of res) addItem(a, true);
    }
  }
}
function renderLog() {
  const ul = $('#logList'); ul.innerHTML = '';
  for (const e of [...S.state.log].reverse()) {
    const li = document.createElement('li'); li.className = 'k-' + e.kind;
    const d = new Date(e.t); const hh = d.toTimeString().slice(0, 8);
    li.innerHTML = '<span class="t"></span><span class="who"></span><span class="tx"></span>';
    li.querySelector('.t').textContent = hh; li.querySelector('.who').textContent = e.who; li.querySelector('.tx').textContent = e.text;
    ul.appendChild(li);
  }
}
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
});

// ---------------------------------------------------------------- chat
function select(id) {
  S.sel = id;
  const a = S.actors.get(id); if (!a) return;
  $('#chat').hidden = false;
  $('#chatName').textContent = a.name; $('#chatRole').textContent = a.role;
  $('#chatStatus').textContent = statusText(a);
  const can = a.chat;
  $('#chatInput').disabled = !can; $('#chatSend').disabled = !can;
  $('#chatHint').textContent = can ? (a.agentType ? 'Habla con el agente "' + a.agentType + '". Usa tu plan de Claude.' : 'Habla con Claude (el jefe). Usa tu plan de Claude.') : 'Los pasantes son temporales: aparecen solo cuando hay un subagente trabajando.';
  renderChat(); renderTeam();
}
function renderChat() {
  const box = $('#chatMsgs'); box.innerHTML = '';
  const id = S.sel; if (!id) return;
  for (const m of (S.history[id] || [])) addMsg(m.role, m.text, false);
  if (S.chatBusy[id]) addMsg('typing', 'escribiendo…', false);
  box.scrollTop = box.scrollHeight;
}
function addMsg(role, text, scroll = true) {
  const box = $('#chatMsgs');
  const d = document.createElement('div'); d.className = 'msg ' + (role === 'typing' ? 'agent typing' : role); d.textContent = text; box.appendChild(d);
  if (scroll) box.scrollTop = box.scrollHeight;
}
function onChat(m) {
  const h = S.history[m.charId] = S.history[m.charId] || [];
  if (m.kind === 'text') { h.push({ role: 'agent', text: m.text }); }
  if (m.kind === 'done') S.chatBusy[m.charId] = false;
  if (S.sel === m.charId) renderChat();
}
$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = S.sel, txt = $('#chatInput').value.trim(); if (!id || !txt) return;
  $('#chatInput').value = '';
  (S.history[id] = S.history[id] || []).push({ role: 'user', text: txt });
  S.chatBusy[id] = true; renderChat();
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office': '1' }, body: JSON.stringify({ charId: id, text: txt }) });
    const j = await r.json();
    if (!j.ok) { S.chatBusy[id] = false; S.history[id].push({ role: 'agent', text: '⚠ ' + (j.error || 'No se pudo enviar') }); renderChat(); }
  } catch (_) { S.chatBusy[id] = false; renderChat(); }
});
$('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
$('#chatClose').onclick = () => { S.sel = null; VIEW.follow = false; uiCam(); $('#chat').hidden = true; renderTeam(); };
$('#btnDemo').onclick = () => fetch('/api/demo', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: '{}' });
$('#chkSound').onchange = (e) => fetch('/api/sound', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on: e.target.checked }) });
setInterval(() => { if (S.sel) { const a = S.actors.get(S.sel); if (a) $('#chatStatus').textContent = statusText(a); } renderTeam(); }, 1500);

// ---------------------------------------------------------------- barra de camara
let roomsFor = null;
function uiCam() {
  document.querySelectorAll('#camBar [data-view]').forEach((b) => {
    const v = b.dataset.view;
    b.classList.toggle('on', (v === 'all' && VIEW.kind === 'all') || ((VIEW.kind === 'wing' || VIEW.kind === 'room') && v === VIEW.dept));
  });
  $('#btnFollow').classList.toggle('on', VIEW.follow);
  $('#btnAuto').classList.toggle('on', VIEW.auto);
  $('#btnNight').classList.toggle('on', VIEW.night);
  const d = VIEW.kind === 'all' ? null : (VIEW.kind === 'room' ? VIEW.dept : curDept());
  const bar = $('#roomBar');
  if (d !== roomsFor || bar.dataset.room !== String(VIEW.room)) {
    roomsFor = d; bar.dataset.room = String(VIEW.room); bar.innerHTML = '';
    if (d) for (const r of ROOMS[d] || []) {
      const b = document.createElement('button'); b.textContent = r.label; if (VIEW.room === r.id) b.className = 'on';
      b.onclick = () => { userTouched(); viewRoom(d, r.id); };
      bar.appendChild(b);
    }
  }
}
document.querySelectorAll('#camBar [data-view]').forEach((b) => b.onclick = () => { userTouched(); if (b.dataset.view === 'all') viewAll(); else viewWing(b.dataset.view); });
$('#btnFollow').onclick = () => {
  if (!S.sel) { const a = [...S.actors.values()].find((x) => x.want === 'work' && x.active); if (a) select(a.id); }
  VIEW.follow = !VIEW.follow && !!S.sel; if (VIEW.follow) VIEW.kind = 'free'; userTouched(); uiCam();
};
$('#btnAuto').onclick = () => { VIEW.auto = !VIEW.auto; store.set('auto', VIEW.auto); uiCam(); };
$('#btnNight').onclick = () => { VIEW.night = !VIEW.night; store.set('night', VIEW.night); uiCam(); };
document.querySelectorAll('#camBar, #roomBar, #mini').forEach((e) => e.addEventListener('pointerdown', (ev) => ev.stopPropagation()));

// arrastrar, rueda, clic
let drag = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, cx: CAM.x, cy: CAM.y, moved: false };
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; stage.classList.add('grab'); }
  if (drag.moved) {
    const g = clampCam({ z: CAM.z, x: drag.cx - dx / CAM.z, y: drag.cy - dy / CAM.z });
    Object.assign(CAM, g); CAM.goal = null; VIEW.kind = 'free'; VIEW.follow = false; userTouched(); uiCam();
  }
});
stage.addEventListener('pointerup', (e) => {
  const d = drag; drag = null; stage.classList.remove('grab');
  if (!d || d.moved) return;
  const r = stage.getBoundingClientRect();
  const x = camLeft() + (e.clientX - r.left) / CAM.z, y = camTop() + (e.clientY - r.top) / CAM.z;
  let best = null;
  for (const a of S.actors.values()) {
    if (!a.active) continue;
    if (Math.abs(x - a.x) <= 9 && y >= a.y - 30 && y <= a.y + 2 && (!best || a.y > best.y)) best = a;
  }
  if (best) select(best.id);
});
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });
stage.addEventListener('dblclick', (e) => {
  const r = stage.getBoundingClientRect();
  const x = camLeft() + (e.clientX - r.left) / CAM.z, y = camTop() + (e.clientY - r.top) / CAM.z;
  glideTo(x, y, Math.min(6, CAM.z * 1.8), false); VIEW.kind = 'free'; userTouched(); uiCam();
});
let miniDrag = false;
function miniGo(e) {
  const r = mini.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  const g = clampCam({ z: CAM.z, x, y }); Object.assign(CAM, g); CAM.goal = null; VIEW.kind = 'free'; VIEW.follow = false; userTouched(); uiCam();
}
mini.addEventListener('pointerdown', (e) => { miniDrag = true; try { mini.setPointerCapture(e.pointerId); } catch (_) {} miniGo(e); });
mini.addEventListener('pointermove', (e) => { if (miniDrag) miniGo(e); });
mini.addEventListener('pointerup', () => { miniDrag = false; });
window.addEventListener('keydown', (e) => {
  if (['TEXTAREA', 'INPUT'].includes(document.activeElement && document.activeElement.tagName)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { keys.add(k); if (k.startsWith('Arrow')) e.preventDefault(); }
  else if (k === '+' || k === '=') zoomAt(sw() / 2, sh() / 2, 1.2);
  else if (k === '-') zoomAt(sw() / 2, sh() / 2, 1 / 1.2);
  else if (k === '0') { userTouched(); viewAll(); }
  else if (k === '1' && S.depts[0]) { userTouched(); viewWing(S.depts[0].id); }
  else if (k === '2' && S.depts[1]) { userTouched(); viewWing(S.depts[1].id); }
});
window.addEventListener('keyup', (e) => { keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });

// ---------------------------------------------------------------- arranque
resize();
uiCam();
connect();
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.25, (t - last) / 1000); last = t;
  frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.OFFICE = { S, CAM, VIEW, DESKS, SPOTS, ROOMS, viewWing, viewAll, viewRoom, urgency, startEat, startNap, startCoffee, trip, confetti, startConvo };
