// Vida de la oficina: que hace cada personaje segun los eventos reales de Claude Code y su propio humor.
import { Figure, LOOKS } from './character.js';
import { DESKS, SPOTS, SHARED, DOOR, SPARE_IDS, findPath, nearestFree } from './world.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const now = () => performance.now() / 1000;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

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
  'ryan>jim': { l: ['Estoy armando una startup.', 'Qué sorpresa.'] },
  'andy>kelly': { l: ['♪ Nard dog ♪', '¡Otra vez!'] },
  'stanley>pam': { l: ['¿Es hora de comer?', 'Faltan dos horas, Stanley.'] },
  'angela>toby': { l: ['Esto no está en el presupuesto.', 'Es solo un formulario, Angela.'] },
  'michael>angela': { l: ['Angela, ¿me aprobaste el café?', 'No.'] },
  'phyllis>erin': { l: ['¿Quieres una bufanda?', '¡Sí! ¿Qué es una bufanda?'] },
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

export class Sim {
  constructor(scene, fx) {
    this.scene = scene; this.fx = fx;
    this.actors = new Map(); this.bossOf = {}; this.depts = []; this.roster = null;
    this.taken = new Map(); this.later = []; this.convos = []; this.busy = {}; this.banterIn = {}; this.proxT = 0;
    this.deskActive = {};
  }
  init(roster) {
    this.roster = roster;
    this.depts = roster.departments || [{ id: 'agency', name: 'Oficina', boss: 'michael', default: true }];
    this.defaultDept = (this.depts.find((d) => d.default) || this.depts[0]).id;
    for (const d of this.depts) this.bossOf[d.id] = d.boss;
    for (const ch of roster.characters) this.actors.set(ch.id, this.makeActor(ch));
  }
  makeActor(ch) {
    const dept = ch.dept || this.defaultDept;
    const a = {
      id: ch.id, name: ch.name, role: ch.role, kind: ch.kind, dept, chat: !!ch.chat, agentType: ch.agentType || null,
      home: ch.desk ? dept + '.' + ch.desk : null, x: DOOR.out.x, z: DOOR.out.z, yaw: Math.PI, yawT: Math.PI, fig: null,
      active: false, mode: 'away', path: [], then: null, finalYaw: null, run: false, tween: null, seat: null,
      carry: false, mug: false, food: null, eating: false, sleeping: false, napDesk: false, napHolds: null,
      bubble: null, want: 'idle', sv: null, timer: 0, talk: 0, spotKey: null, deskId: null, fall: 0, fallDir: 1,
      hunger: rand(0, .5), tired: rand(0, .4), pingT: rand(20, 45), fxT: 0, routine: null, step: null, convo: null, lastBump: -99, chatCool: 0, speed: 0,
    };
    if (ch.kind === 'boss' || ch.kind === 'resident') {
      const d = DESKS[a.home];
      this.ensureFig(a);
      a.active = true; a.mode = 'idle_desk'; a.deskId = a.home; a.timer = rand(3, 12);
      this.seatAt(a, d.seat, 'sit');
    }
    return a;
  }
  ensureFig(a) {
    if (a.fig) return;
    a.fig = new Figure(a.id);
    a.fig.root.visible = false;
    a.fig.root.userData.actor = a.id;
    a.fig.root.traverse((o) => { if (o.isMesh) { o.userData.cs = o.castShadow; o.castShadow = o.castShadow && this.actorShadows !== false; } });
    this.scene.add(a.fig.root);
  }
  setActorShadows(on) {
    this.actorShadows = on;
    for (const a of this.actors.values()) if (a.fig) a.fig.root.traverse((o) => { if (o.isMesh) o.castShadow = !!o.userData.cs && on; });
  }
  // pone al personaje sentado de una vez
  seatAt(a, seat, pose) { a.x = seat.x; a.z = seat.z; a.yaw = a.yawT = seat.yaw; a.seat = seat; a.fig.seatY = seat.y; a.fig.state = pose; a.fig.root.visible = true; }

  // ---------- reservas de puestos
  takeSpot(a, s) { this.releaseSpot(a); const k = s.x.toFixed(2) + ',' + s.z.toFixed(2); this.taken.set(k, a.id); a.spotKey = k; }
  releaseSpot(a) { if (a.spotKey && this.taken.get(a.spotKey) === a.id) this.taken.delete(a.spotKey); a.spotKey = null; if (a.napHolds) { for (const k of a.napHolds) if (this.taken.get(k) === a.id) this.taken.delete(k); a.napHolds = null; } }
  spotFree(s) { return !this.taken.has(s.x.toFixed(2) + ',' + s.z.toFixed(2)); }
  say(a, text, ms, cls) { a.bubble = { text, until: now() + ms / 1000, cls: cls || '' }; }
  after(sec, fn) { this.later.push({ at: now() + sec, fn }); }
  face(a, b) {
    if (!a.fig || !b.fig) return;
    a.fig.lookTarget = { x: b.x, z: b.z };
    if (!a.seat && !a.path.length) a.yawT = Math.atan2(b.x - a.x, b.z - a.z);
  }

  // ---------- movimiento
  goTo(a, x, z, o = {}) {
    if (a.tween) { a.tween = null; }
    if (a.seat) { const st = a.seat.stand || { x: a.x, z: a.z }; const seatWas = a.seat; a.seat = null; a.fig.state = 'stand'; a.tween = { x0: a.x, z0: a.z, x1: st.x, z1: st.z, t: 0, dur: .42, cb: () => this.startPath(a, x, z, o) }; a.path = []; a.then = null; void seatWas; return; }
    this.startPath(a, x, z, o);
  }
  startPath(a, x, z, o) {
    a.then = o.then || null; a.finalYaw = o.yaw != null ? o.yaw : null; a.run = !!o.run; a.finalPose = o.pose || 'stand';
    const p = findPath(a.x, a.z, x, z);
    a.path = p || [];
    if (!p) { a.x = x; a.z = z; this.arrive(a); return; }
    if (!p.length) { this.arrive(a); return; }
    a.fig.state = a.run ? 'run' : 'walk';
  }
  arrive(a) {
    a.path = []; a.run = false; a.speed = 0;
    if (a.finalYaw != null) a.yawT = a.finalYaw;
    if (a.fig) a.fig.state = a.finalPose || 'stand';
    const cb = a.then; a.then = null;
    if (cb) cb();
  }
  sitDown(a, seat, pose, then, o = {}) {
    this.goTo(a, seat.stand.x, seat.stand.z, {
      run: o.run, yaw: seat.yaw,
      then: () => {
        a.yawT = seat.yaw; a.fig.seatY = seat.y; a.seat = seat; a.fig.state = pose;
        a.tween = { x0: a.x, z0: a.z, x1: seat.x, z1: seat.z, t: 0, dur: .5, cb: then };
      },
    });
  }
  seatDesk(a, d, hurry) {
    this.sitDown(a, { ...d.seat, stand: d.stand }, 'sit', () => {
      a.fig.hold(null); a.mug = false; a.food = null; a.eating = false; a.sleeping = false;
      const working = a.want === 'work' || a.want === 'wait';
      a.mode = working ? 'work' : 'idle_desk'; a.timer = rand(5, 12);
    }, { run: hurry });
    if (a.mode !== 'deliverGo' && a.mode !== 'leaving') a.mode = 'moving';
  }
  deskOf(a) { return DESKS[a.deskId || a.home] || null; }
  goHome(a) {
    const d = this.deskOf(a);
    if (!d) { if (a.kind === 'temp' || a.kind === 'reserve') this.leave(a); return; }
    a.mode = 'moving';
    this.seatDesk(a, d, false);
  }
  leave(a) {
    this.releaseSpot(a); a.carry = false; a.routine = null; a.step = null; a.fig.hold(null);
    a.mode = 'leaving';
    this.goTo(a, DOOR.out.x, DOOR.out.z, { yaw: 0, then: () => { a.active = false; a.mode = 'away'; a.fig.root.visible = false; if (a.kind === 'temp') a.deskId = null; } });
  }
  assignDesk(a) {
    const homes = new Set(this.roster.characters.filter((c) => c.kind !== 'temp' && c.dept === a.dept && c.desk).map((c) => a.dept + '.' + c.desk));
    const used = new Set([...this.actors.values()].filter((o) => o !== a && o.deskId).map((o) => o.deskId));
    const cands = SPARE_IDS.map((id) => a.dept + '.' + id).filter((k) => DESKS[k] && !homes.has(k));
    return cands.find((k) => !used.has(k)) || pick(cands);
  }
  appear(a) {
    this.ensureFig(a);
    a.active = true; a.x = DOOR.out.x + rand(-.3, .3); a.z = DOOR.out.z; a.yaw = a.yawT = Math.PI; a.path = []; a.seat = null; a.tween = null;
    a.fig.state = 'stand'; a.fig.root.visible = true;
    a.deskId = a.kind === 'reserve' ? a.home : this.assignDesk(a);
    this.say(a, pick(['¡Presente!', '¡Ya llegué!', 'Me llamaron.', 'Aquí estoy.']), 2200);
    this.fx.sparkle(a.x, 1.2, 7.2, 14);
  }

  // ---------- eventos del servidor
  stopActivity(a) {
    if (a.convo) this.endConvo(a.convo, true);
    this.releaseSpot(a);
    a.routine = null; a.step = null; a.mug = false; a.food = null; a.eating = false; a.sleeping = false; a.napDesk = false;
    if (a.fig) { a.fig.hold(null); a.fig.lookTarget = null; }
  }
  hurried(a) { return (this.busy[a.dept] || 0) >= 3 || Math.random() < .3; }
  onWant(a) {
    const w = a.want;
    if (w === 'work' || w === 'wait') {
      const wasDeliver = a.mode === 'deliverGo' || a.mode === 'deliverWait';
      if ((a.kind === 'temp' || a.kind === 'reserve') && !a.active) this.appear(a);
      this.stopActivity(a);
      if (wasDeliver) a.carry = false;
      const d = this.deskOf(a);
      if (!d) return;
      if (a.seat && Math.hypot(a.x - d.seat.x, a.z - d.seat.z) < .05) { a.mode = 'work'; }
      else this.seatDesk(a, d, this.hurried(a));
    } else if (w === 'done') {
      if (a.kind === 'boss') return;
      if (!a.active) return;
      this.startDeliver(a);
    } else if (a.kind === 'temp' || a.kind === 'reserve') {
      if (a.active && !['deliverGo', 'deliverWait', 'leaving'].includes(a.mode)) { this.stopActivity(a); this.leave(a); }
    } else if (a.mode === 'work') { a.mode = 'idle_desk'; a.timer = rand(3, 7); }
  }
  nextInPipe(a) {
    const ids = PIPE[a.dept] || [], i = ids.indexOf(a.id);
    if (i < 0) return null;
    for (let k = 1; k < ids.length; k++) {
      const o = this.actors.get(ids[(i + k) % ids.length]);
      if (o && o.active && o !== a && (o.mode === 'work' || o.mode === 'idle_desk')) return o;
    }
    return null;
  }
  startDeliver(a) {
    this.stopActivity(a);
    a.carry = true; a.fig.hold('folder'); this.say(a, '¡Listo!', 2400, 'memo');
    const W = SPOTS[a.dept], boss = this.actors.get(this.bossOf[a.dept]);
    const nx = this.nextInPipe(a);
    if (nx) { this.fx.memo(a, nx); this.after(.6, () => { if (nx.active) this.say(nx, 'Recibido de ' + a.name, 2200); }); }
    const spot = W.deliver.find((s) => this.spotFree(s)) || W.deliver[0];
    this.takeSpot(a, spot);
    a.mode = 'deliverGo';
    this.goTo(a, spot.x, spot.z, {
      yaw: spot.yaw, run: (this.busy[a.dept] || 0) >= 3, pose: 'deliver',
      then: () => {
        a.mode = 'deliverWait'; a.timer = 2.8; a.fig.state = 'deliver';
        if (boss) { this.say(boss, pick(THANKS), 2400); this.fx.memo(a, boss); }
        this.fx.confetti(a.x, 1.75, a.z, 46); this.fx.sparkle(a.x, 1.6, a.z, 10);
        a.fig.hold(null); a.carry = false;
        this.after(.5, () => { if (a.mode === 'deliverWait') a.fig.state = 'cheer'; });
      },
    });
  }
  finishDeliver(a) {
    a.carry = false; a.fig.hold(null); this.releaseSpot(a);
    if (a.kind === 'temp' || a.kind === 'reserve') this.leave(a); else this.goHome(a);
  }

  // ---------- rutinas
  runRoutine(a, steps, onEnd) { a.routine = { steps, i: 0, onEnd: onEnd || null }; this.nextStep(a); }
  nextStep(a) {
    const r = a.routine; if (!r) return;
    if (r.i >= r.steps.length) {
      const e = r.onEnd; a.routine = null; a.step = null; this.releaseSpot(a); a.sleeping = false; a.eating = false;
      if (e) e(a); else this.goHome(a);
      return;
    }
    const st = r.steps[r.i++]; a.step = st;
    const s = st.spot;
    if (!st.keepSpot) this.takeSpot(a, s);
    a.mode = 'moving';
    const arrived = () => {
      a.mode = 'spot'; a.timer = st.dur || 1; a.talk = rand(1.5, 3.5);
      if (st.act === 'eat') { a.eating = true; a.fig.state = a.seat ? 'eat' : 'eatStand'; }
      if (st.act === 'drink') { a.mug = true; a.fig.hold('mug'); a.fig.state = a.seat ? 'drink' : 'drinkStand'; }
      if (st.say) this.say(a, st.say, 2400);
      if (st.on) st.on(a);
    };
    if (s.sit) this.sitDown(a, s, st.pose || 'sit', arrived, { run: st.run });
    else this.goTo(a, s.x, s.z, { yaw: s.yaw, run: st.run, then: arrived });
  }
  endStep(a) {
    const st = a.step;
    if (st) {
      if (st.act === 'eat') { a.eating = false; }
      if (st.act === 'sleep') { a.sleeping = false; }
      if (st.after) st.after(a);
    }
    this.nextStep(a);
  }
  startEat(a) {
    const useFridge = Math.random() < .55, src = useFridge ? SHARED.fridge : SHARED.vending;
    if (!this.spotFree(src)) return false;
    this.stopActivity(a);
    const lunch = SHARED.lunch.filter((s) => this.spotFree(s));
    const foods = useFridge ? ['sandwich', 'apple', 'salad', 'pizza'] : ['chips', 'donut'];
    const steps = [{
      spot: src, dur: 2.2, say: useFridge ? pick(['*abre la nevera*', '¿Qué habrá aquí?', 'Veamos...']) : pick(['*clink clink*', '¡Se atoró!', 'Una de papas.']),
      on: (x) => { x.food = pick(foods); x.fig.hold(x.food); },
    }];
    const finish = (x) => { x.food = null; x.fig.hold(null); x.hunger = 0; x.fig.state = x.seat ? 'sit' : 'stand'; this.say(x, pick(['Estaba delicioso.', 'Ahora sí, a trabajar.', 'Qué rico estuvo.']), 2400); };
    if (lunch.length) steps.push({ spot: pick(lunch), dur: rand(8, 12), act: 'eat', chat: true, say: pick(['Mmm...', '¡Qué rico!', 'Al fin.']), after: finish });
    else steps.push({ spot: src, keepSpot: true, dur: rand(7, 10), act: 'eat', after: finish });
    this.runRoutine(a, steps);
    return true;
  }
  startNap(a) {
    this.stopActivity(a);
    const wake = (x) => { x.tired = 0; x.sleeping = false; this.say(x, pick(['¡Me quedé dormido!', '¿Cuánto dormí?', 'Qué bien se durmió.']), 2400); };
    const options = [];
    for (const n of SHARED.naps) { const seats = n.blocks.map((i) => SHARED.lounge[i]); if (seats.every((s) => this.spotFree(s)) && this.spotFree(n)) options.push({ n, seats }); }
    if (a.kind === 'boss') { const W = SPOTS[a.dept]; if (W.couch.every((s) => this.spotFree(s)) && this.spotFree(W.nap)) options.push({ n: W.nap, seats: W.couch }); }
    if (options.length) {
      const { n, seats } = pick(options);
      this.runRoutine(a, [{ spot: { ...n, sit: 1 }, pose: 'lie', dur: rand(16, 28), act: 'sleep', say: pick(['Solo cierro los ojos...', 'Cinco minutitos.']), on: (x) => { x.sleeping = true; }, after: wake }]);
      a.napHolds = seats.map((s) => s.x.toFixed(2) + ',' + s.z.toFixed(2));
      for (const k of a.napHolds) this.taken.set(k, a.id);
    } else {
      a.napDesk = true; a.sleeping = true; a.mode = 'idle_desk'; a.timer = rand(12, 20); if (a.seat) a.fig.state = 'sleepDesk';
    }
    return true;
  }
  startCoffee(a) {
    const s = SHARED.coffee.filter((q) => this.spotFree(q));
    if (!s.length) return false;
    this.stopActivity(a);
    this.runRoutine(a, [{ spot: pick(s), dur: rand(5, 8), act: 'drink', chat: true, say: pick(['Mi café...', 'Necesito cafeína.', 'Huele delicioso.']) }]);
    return true;
  }
  startCooler(a) {
    const s = SPOTS[a.dept].cooler.filter((q) => this.spotFree(q));
    if (!s.length) return false;
    this.stopActivity(a);
    this.runRoutine(a, [{ spot: pick(s), dur: rand(5, 8), act: 'drink', chat: true, say: pick(['Un traguito de agua.', '*glup glup*']), after: (x) => { x.mug = false; x.fig.hold(null); x.fig.state = 'stand'; } }]);
    return true;
  }
  startSeats(a, list) {
    const s = list.filter((q) => this.spotFree(q));
    if (!s.length) return false;
    this.stopActivity(a);
    this.runRoutine(a, [{ spot: pick(s), dur: rand(8, 14), chat: true }]);
    return true;
  }
  startCopier(a) {
    const s = SPOTS[a.dept].copier;
    if (!this.spotFree(s)) return false;
    this.stopActivity(a);
    this.runRoutine(a, [{ spot: s, dur: rand(4, 7), say: a.dept === 'askitar' ? pick(['Otro render más...', '¿Por qué tarda tanto?']) : pick(['Se volvió a atascar.', '*le da un golpe*', 'Solo son 200 copias.']) }]);
    return true;
  }
  startVisit(a) {
    const others = [...this.actors.values()].filter((o) => o !== a && o.dept === a.dept && o.active && o.kind !== 'temp' && o.mode === 'idle_desk' && !o.convo && !o.napDesk && DESKS[o.deskId]);
    if (!others.length) return false;
    const o = pick(others), d = DESKS[o.deskId];
    // se para al frente del escritorio, mirando a la persona
    const sgn = d.face === 'S' ? 1 : -1, fp = nearestFree(d.x, d.z + sgn * (d.d / 2 + .4));
    const spot = { x: fp.x, z: fp.z, yaw: d.face === 'S' ? Math.PI : 0 };
    if (!this.spotFree(spot)) return false;
    const pair = PAIRS[a.id + '>' + o.id], cv = pair && Math.random() < .75 ? pair : pick(CONVOS);
    this.stopActivity(a);
    this.runRoutine(a, [{ spot, dur: cv.l.length * 2.5 + 1.6, on: (x) => { if (o.mode === 'idle_desk') { this.startConvo(x, o, cv.l, cv.out); o.timer = Math.max(o.timer, cv.l.length * 2.5 + 2); } } }]);
    return true;
  }
  startOutcome(a, out) {
    if (!a.active || a.want === 'work' || a.want === 'wait' || a.want === 'done' || a.fall) return;
    if (!['idle_desk', 'spot'].includes(a.mode)) return;
    if (out === 'eat') this.startEat(a); else if (out === 'nap') this.startNap(a); else if (out === 'coffee') this.startCoffee(a);
  }
  chooseActivity(a) {
    const boss = a.kind === 'boss', W = SPOTS[a.dept], opts = [];
    const add = (k, w) => { if (w > 0) opts.push([k, w]); };
    const anyFree = (l) => l.some((s) => this.spotFree(s));
    add('desk', boss ? 6 : 4);
    if (anyFree(W.cooler)) add('cooler', 2);
    if (anyFree(SHARED.coffee)) add('coffee', 3);
    add('eat', 1 + Math.max(0, a.hunger - .35) * 14);
    if (a.tired > .55) add('nap', (a.tired - .4) * 10);
    if (anyFree(W.meeting)) add('meeting', 1.5);
    if (anyFree(SHARED.lounge)) add('lounge', 2);
    if (boss && anyFree(W.couch)) add('couch', 2);
    if (!boss) add('visit', 2.5);
    if (!boss) add('copier', 1);
    let tot = opts.reduce((s, o) => s + o[1], 0), x = Math.random() * tot, kind = 'desk';
    for (const o of opts) { x -= o[1]; if (x <= 0) { kind = o[0]; break; } }
    let ok = true;
    if (kind === 'desk') ok = false;
    else if (kind === 'cooler') ok = this.startCooler(a);
    else if (kind === 'coffee') ok = this.startCoffee(a);
    else if (kind === 'eat') { if (a.hunger > .55) this.say(a, pick(L.hunger), 2200); ok = this.startEat(a); }
    else if (kind === 'nap') { this.say(a, pick(L.sleepy), 2000); ok = this.startNap(a); }
    else if (kind === 'meeting') ok = this.startSeats(a, W.meeting);
    else if (kind === 'lounge') ok = this.startSeats(a, SHARED.lounge);
    else if (kind === 'couch') ok = this.startSeats(a, W.couch);
    else if (kind === 'visit') ok = this.startVisit(a);
    else if (kind === 'copier') ok = this.startCopier(a);
    if (!ok) a.timer = rand(6, 14);
  }

  // ---------- conversaciones
  startConvo(a, b, lines, out) {
    if (a.convo || b.convo) return false;
    const c = { a, b, lines, i: 0, next: now() + .4, out: out || null };
    a.convo = b.convo = c; this.convos.push(c);
    this.face(a, b); this.face(b, a);
    return true;
  }
  endConvo(c, forced) {
    const k = this.convos.indexOf(c); if (k >= 0) this.convos.splice(k, 1);
    for (const x of [c.a, c.b]) if (x.convo === c) { x.convo = null; x.chatCool = now() + rand(10, 22); if (x.fig) x.fig.lookTarget = null; }
    if (!forced && c.out) { const out = c.out; this.after(.5, () => { this.startOutcome(c.a, out); this.after(.4, () => this.startOutcome(c.b, out)); }); }
  }
  tickConvos() {
    for (const c of [...this.convos]) {
      const { a, b } = c;
      if (a.convo !== c || b.convo !== c || !a.active || !b.active || a.fall || b.fall || a.mode === 'moving' || b.mode === 'moving' || a.mode === 'crowd' || b.mode === 'crowd') { this.endConvo(c, true); continue; }
      if (now() < c.next) continue;
      if (c.i >= c.lines.length) { this.endConvo(c, false); continue; }
      this.say(c.i % 2 === 0 ? a : b, c.lines[c.i], 2400); c.i++; c.next = now() + 2.6;
    }
  }
  proximityTick(dt) {
    this.proxT -= dt; if (this.proxT > 0) return; this.proxT = 1.2;
    const tn = now();
    const sp = [...this.actors.values()].filter((a) => a.active && a.mode === 'spot' && !a.convo && !a.sleeping && a.chatCool < tn);
    for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) {
      const a = sp[i], b = sp[j];
      // la cocina y la sala son compartidas, pero solo charlan entre su mismo departamento
      if (a.dept !== b.dept || a.convo || b.convo || Math.hypot(a.x - b.x, a.z - b.z) > 2.2) continue;
      if (Math.random() < .5) {
        const pair = PAIRS[a.id + '>' + b.id], cv = pair && Math.random() < .7 ? pair : pick(CONVOS.filter((x) => !x.out || x.out === 'coffee' || Math.random() < .3));
        this.startConvo(a, b, cv.l, cv.out);
        a.timer = Math.max(a.timer, cv.l.length * 2.5 + 1); b.timer = Math.max(b.timer, cv.l.length * 2.5 + 1);
      } else { a.chatCool = b.chatCool = tn + 8; }
    }
  }
  banterTick(dt) {
    for (const d of this.depts) {
      this.banterIn[d.id] = (this.banterIn[d.id] == null ? rand(3, 8) : this.banterIn[d.id]) - dt;
      if (this.banterIn[d.id] > 0) continue;
      this.banterIn[d.id] = rand(6, 14);
      const tn = now();
      const cand = [...this.actors.values()].filter((a) => a.dept === d.id && a.active && !a.fall && !a.sleeping && !a.convo && !['crowd', 'deliverGo', 'deliverWait', 'leaving'].includes(a.mode) && (!a.bubble || tn > a.bubble.until) && (a.mode !== 'work' || Math.random() < .25));
      if (!cand.length) continue;
      const a = pick(cand), line = lineFor(a);
      this.say(a, line.text, 3400);
      if (line.reply) {
        const others = cand.filter((o) => o !== a);
        if (others.length) { const o = pick(others); this.after(2.3, () => { if (o.active && !o.sleeping && !o.fall) { this.say(o, pick(REPLIES), 2600); o.fig.lookTarget = { x: a.x, z: a.z }; this.after(3, () => { if (o.fig && !o.convo) o.fig.lookTarget = null; }); } }); }
      }
    }
  }

  // ---------- urgencia y choques
  deptAlert(dept) { for (const a of this.actors.values()) if (a.dept === dept && a.want === 'wait') return true; return false; }
  urgency(dept, srcId) {
    if (!SPOTS[dept]) return;
    let i = 0;
    for (const a of this.actors.values()) {
      if (a.dept !== dept || !a.active || a.kind === 'boss' || a.id === srcId || a.want === 'wait') continue;
      if (['deliverGo', 'deliverWait', 'leaving', 'crowd'].includes(a.mode)) continue;
      this.after((i++) * .18 + rand(0, .4), () => this.joinCrowd(a));
    }
  }
  joinCrowd(a) {
    if (!a.active || a.mode === 'crowd' || a.fall || a.want === 'wait') return;
    const free = SPOTS[a.dept].crowd.filter((s) => this.spotFree(s));
    if (!free.length) return;
    this.stopActivity(a);
    const s = pick(free); this.takeSpot(a, s);
    this.say(a, pick(['¿Qué pasó?', '¡Voy, voy!', '¡Corran!', '¿Es urgente?', '¡Oscar nos necesita!']), 2200);
    a.mode = 'moving';
    this.goTo(a, s.x, s.z, { yaw: s.yaw, run: true, then: () => { a.mode = 'crowd'; a.timer = rand(9, 15); } });
  }
  leaveCrowd(a) {
    this.releaseSpot(a);
    if (a.want === 'work' || a.want === 'wait') { a.mode = 'moving'; const d = this.deskOf(a); if (d) this.seatDesk(a, d, true); }
    else if (a.kind === 'temp' || a.kind === 'reserve') this.leave(a);
    else this.goHome(a);
  }
  trip(v, o) {
    v.fall = 1.9; v.fig.state = 'fall';
    this.say(v, pick(['¡Ay!', '¡Auch!', '¡Uf!', '¡Mi rodilla!']), 1800);
    this.say(o, pick(['¡Perdón!', '¿Estás bien?', '¡Fíjate!', '¡Uy!']), 2000);
    this.fx.papers(v.x, v.z, v.carry ? 6 : 2);
  }
  checkTrips() {
    const list = [...this.actors.values()].filter((a) => a.active && a.path.length && !a.fall);
    const tn = now();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.dept !== b.dept || Math.hypot(a.x - b.x, a.z - b.z) > .45) continue;
      if (tn - a.lastBump < 16 || tn - b.lastBump < 16) continue;
      if (!(a.run || b.run || (this.busy[a.dept] || 0) >= 3)) continue;
      a.lastBump = b.lastBump = tn;
      if (Math.random() < .5) { const v = a.run ? a : (b.run ? b : (Math.random() < .5 ? a : b)); this.trip(v, v === a ? b : a); }
    }
  }

  // ---------- cada personaje, cada cuadro
  think(a, dt) {
    if (!a.active) return;
    a.hunger = Math.min(1, a.hunger + dt / 170);
    a.tired = Math.min(1, a.tired + dt / 240);
    const f = a.fig;
    if (a.fall > 0) {
      a.fall -= dt;
      if (Math.random() < dt * 14) this.fx.star(a.x, a.z);
      if (a.fall <= 0) { a.fall = 0; f.state = a.path.length ? (a.run ? 'run' : 'walk') : 'stand'; }
      return;
    }
    a.fxT -= dt;
    if (a.sleeping && a.fxT <= 0) { a.fxT = 1.25; this.fx.z(a.x, f.state === 'lie' ? .95 : 1.55, a.z); }
    else if (a.mug && a.mode === 'spot' && a.fxT <= 0) { a.fxT = .4; this.fx.steam(a); }
    if (a.tween) {
      const w = a.tween; w.t += dt;
      const k = Math.min(1, w.t / w.dur), e = k * k * (3 - 2 * k);
      a.x = w.x0 + (w.x1 - w.x0) * e; a.z = w.z0 + (w.z1 - w.z0) * e;
      if (k >= 1) { const cb = w.cb; a.tween = null; if (cb) cb(); }
      return;
    }
    if (a.path.length) {
      const n = a.path[0], dx = n.x - a.x, dz = n.z - a.z, dist = Math.hypot(dx, dz);
      let sp = a.run ? 3.4 : ((a.kind === 'temp' || a.kind === 'reserve' || a.carry) ? 1.55 : 1.3);
      if (!a.run && (this.busy[a.dept] || 0) >= 3) sp *= 1.28;
      a.speed = sp;
      const step = sp * dt;
      if (dist > .01) a.yawT = Math.atan2(dx, dz);
      if (dist <= step) { a.x = n.x; a.z = n.z; a.path.shift(); if (!a.path.length) this.arrive(a); }
      else { a.x += dx / dist * step; a.z += dz / dist * step; }
      return;
    }
    a.speed = 0;
    switch (a.mode) {
      case 'work': {
        f.state = a.want === 'wait' ? 'wait' : 'type';
        a.pingT -= dt;
        if (a.pingT <= 0) {
          a.pingT = rand(25, 55);
          const mates = [...this.actors.values()].filter((o) => o !== a && o.dept === a.dept && o.active && (o.mode === 'work' || o.mode === 'idle_desk'));
          if (mates.length && Math.random() < .7) {
            const o = pick(mates);
            this.fx.memo(a, o);
            this.say(a, pick(['Te paso esto.', 'Mira este archivo.', '¿Me ayudas?', 'Para ti.']), 2200);
            this.after(1.4, () => { if (o.active && (!o.bubble || now() > o.bubble.until)) this.say(o, pick(['Recibido.', 'Gracias.', 'Lo reviso.']), 2000); });
          }
        }
        break;
      }
      case 'idle_desk': {
        f.state = a.napDesk ? 'sleepDesk' : 'sit';
        a.timer -= dt;
        if (a.timer <= 0) {
          if (a.napDesk) { a.napDesk = false; a.sleeping = false; a.tired = 0; f.state = 'sit'; this.say(a, '¡Me quedé dormido!', 2400); a.timer = rand(5, 10); }
          else this.chooseActivity(a);
        }
        break;
      }
      case 'spot': {
        a.timer -= dt;
        const st = a.step;
        if (st && st.chat && !a.convo && !a.sleeping) { a.talk -= dt; if (a.talk <= 0) { a.talk = rand(4, 8); if (Math.random() < .5) this.say(a, lineFor(a).text, 2600); } }
        if (a.timer <= 0) this.endStep(a);
        break;
      }
      case 'deliverWait': { a.timer -= dt; if (a.timer <= 0) this.finishDeliver(a); break; }
      case 'crowd': {
        f.state = 'stand'; a.timer -= dt;
        if (!this.deptAlert(a.dept) && a.timer > 2) a.timer = 2;
        if (a.timer <= 0) this.leaveCrowd(a);
        break;
      }
      default: break;
    }
  }
  update(dt) {
    const tn = now();
    for (let i = this.later.length - 1; i >= 0; i--) { const q = this.later[i]; if (tn >= q.at) { this.later.splice(i, 1); try { q.fn(); } catch (e) { console.warn(e); } } }
    this.tickConvos(); this.banterTick(dt); this.proximityTick(dt);
    for (const a of this.actors.values()) {
      this.think(a, dt);
      if (a.fig && a.active) {
        const k = 1 - Math.exp(-dt * 9);
        a.yaw += angDiff(a.yaw, a.yawT) * k;
        a.fig.root.position.set(a.x, 0, a.z);
        a.fig.root.rotation.y = a.yaw;
        a.fig.speed = a.speed;
        a.fig.talking = !!(a.bubble && tn < a.bubble.until && a.bubble.cls !== 'silent' && !a.sleeping);
        a.fig.update(dt);
      }
    }
    this.busy = {};
    for (const a of this.actors.values()) if (a.active && (a.want === 'work' || a.want === 'wait' || a.want === 'done' || a.mode === 'crowd')) this.busy[a.dept] = (this.busy[a.dept] || 0) + 1;
    this.checkTrips();
    this.deskActive = {};
    for (const a of this.actors.values()) if (a.active && a.mode === 'work' && a.deskId) this.deskActive[a.deskId] = a;
  }
  applyState(st) {
    for (const a of this.actors.values()) {
      const sv = st.actors[a.id] || null;
      a.sv = sv;
      let w = 'idle';
      if (sv) w = sv.status === 'working' ? 'work' : sv.status === 'waiting' ? 'wait' : sv.status === 'done' ? 'done' : 'idle';
      if (w !== a.want) { a.want = w; this.onWant(a); }
      else if (w === 'work' && a.mode === 'idle_desk') this.onWant(a);
    }
  }
  applyCue(m) {
    const a = this.actors.get(m.charId); if (!a) return;
    const boss = this.actors.get(this.bossOf[a.dept] || this.bossOf[this.defaultDept]);
    if (m.kind === 'delegate' && boss) {
      this.say(boss, '→ ' + a.name + ': ' + (m.text || 'tarea nueva'), 4200, 'memo');
      this.after(.1, () => this.fx.memo(boss, a));
    } else if (m.kind === 'prompt') {
      this.say(a, 'Oscar dice: ' + m.text, 3200, 'memo');
    } else if (m.kind === 'alert') {
      this.say(a, '⚠ ' + (m.text || 'Te necesito'), 6000, 'alert');
      if (m.text !== 'Te estoy esperando' && !m.quiet) this.urgency(a.dept, a.id);
    }
  }
}
export { LOOKS };
