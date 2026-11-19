// Interfaz: burbujas y nombres sobre los personajes, panel de equipo, actividad, chat, plano y botones de camara.
import { THREE } from './kit.js';
import { OFFICE, WALLS, ROOMS, DESKS } from './world.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;

const PERM_TEXT = {
  read: { name: 'Solo mirar', hint: 'Lee y responde, pero no cambia nada.' },
  work: { name: 'Puede trabajar', hint: 'Edita archivos en su carpeta y corre los comandos de su oficio. Para lo demás te pide permiso aquí.' },
  full: { name: 'Todo activado', hint: 'No pide permiso: un guardia automático frena solo lo peligroso. Sigue sin enviar mensajes, gastar créditos ni correr los scripts de Agencia.' },
};

export class UI {
  constructor(stage, sim, rig, office) {
    this.stage = stage; this.sim = sim; this.rig = rig; this.office = office;
    this.sel = null; this.hover = null; this.history = {}; this.chatBusy = {}; this.state = { actors: {}, sessions: [], log: [], done: 0 };
    this.doneCount = -1; this.overlay = $('#overlay'); this.dom = {}; this._v = new THREE.Vector3(); this.frame = 0;
    rig.onChange = () => this.syncButtons();
    rig.onSelect = (id) => this.select(id);
    this._wire();
    this._buildRooms();
    this._buildMiniBase();
    this.syncButtons();
    setInterval(() => { if (this.sel) { const a = sim.actors.get(this.sel); if (a) $('#chatStatus').textContent = this.statusText(a); } this.renderTeam(); }, 1500);
  }
  // ---------- nombre y burbuja de cada personaje
  el(a) {
    let e = this.dom[a.id];
    if (!e) {
      const tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = '<i class="dot"></i><span></span>'; tag.lastChild.textContent = a.name;
      const bub = document.createElement('div'); bub.className = 'bub'; bub.hidden = true;
      this.overlay.appendChild(tag); this.overlay.appendChild(bub);
      e = this.dom[a.id] = { tag, bub, text: null };
    }
    return e;
  }
  place() {
    const cam = this.stage.camera, W = this.stage.w, H = this.stage.h, tn = now(), v = this._v, sim = this.sim;
    for (const a of sim.actors.values()) {
      const e = this.el(a);
      if (!a.active || !a.fig) { e.tag.style.display = 'none'; e.bub.hidden = true; continue; }
      const st = a.fig.state, low = st === 'lie' || st === 'fall';
      const seated = !!a.seat, top = low ? .95 : (seated ? 1.42 : a.fig.headHeight + .06);
      v.set(a.x, top, a.z);
      const dist = cam.position.distanceTo(v);
      v.project(cam);
      if (v.z > 1 || v.x < -1.15 || v.x > 1.15 || v.y < -1.15 || v.y > 1.2) { e.tag.style.display = 'none'; e.bub.hidden = true; continue; }
      const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H, s = clamp(7.5 / dist, .66, 1.18);
      const selected = this.sel === a.id, hov = this.hover === a.id;
      let text = null, cls = '';
      if (a.bubble && tn < a.bubble.until) { text = a.bubble.text; cls = a.bubble.cls; }
      else if (a.want === 'wait') { text = '⚠ ' + (a.sv && a.sv.text ? a.sv.text : 'Necesito tu OK'); cls = 'alert'; }
      else if (a.want === 'work' && a.mode === 'work' && a.sv && a.sv.text && (dist < 13 || selected)) { text = a.sv.text; cls = 'work'; }
      const showTag = selected || hov || dist < 9 || text != null || a.want === 'work';
      e.tag.style.display = showTag ? '' : 'none';
      if (showTag) {
        const tw = e.tag.offsetWidth || 60;
        e.tag.style.transform = `translate(${px - tw * s / 2}px,${py - 22 * s}px) scale(${s})`;
        e.tag.style.transformOrigin = '0 0';
        e.tag.className = 'tag ' + (a.want === 'work' ? 'working' : a.want === 'wait' ? 'waiting' : '') + (selected ? ' sel' : '');
      }
      if (text) {
        if (e.text !== text) { e.bub.textContent = text; e.text = text; }
        e.bub.className = 'bub ' + cls;
        e.bub.hidden = false;
        const bw = e.bub.offsetWidth || 120, bh = e.bub.offsetHeight || 30;
        const bx = clamp(px, bw * s / 2 + 4, Math.max(bw * s / 2 + 4, W - bw * s / 2 - 4));
        e.bub.style.transformOrigin = '0 0';
        e.bub.style.transform = `translate(${bx - bw * s / 2}px,${py - (showTag ? 30 : 8) * s - bh * s}px) scale(${s})`;
      } else e.bub.hidden = true;
      // aro de estado a los pies
      if (selected) a.fig.setRing('#5a8cff', .95);
      else if (hov) a.fig.setRing('#8fb4ff', .65);
      else if (a.want === 'wait') a.fig.setRing('#ffb020', .6 + Math.sin(tn * 6) * .35);
      else if (a.want === 'work') a.fig.setRing('#3ddc84', .4);
      else a.fig.setRing('#3b6bff', 0);
    }
  }
  pick(e) {
    const r = this.rig.dom.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, cam = this.stage.camera, v = this._v;
    let best = null, bd = 1e9;
    for (const a of this.sim.actors.values()) {
      if (!a.active || !a.fig) continue;
      const low = a.fig.state === 'lie' || a.fig.state === 'fall', hTop = low ? .85 : (a.seat ? 1.36 : a.fig.headHeight), hBot = low ? .2 : (a.seat ? .4 : .05);
      v.set(a.x, hTop, a.z); const dist = cam.position.distanceTo(v); v.project(cam); if (v.z > 1) continue;
      const tx = (v.x + 1) / 2 * r.width, ty = (1 - v.y) / 2 * r.height;
      v.set(a.x, hBot, a.z).project(cam);
      const by = (1 - v.y) / 2 * r.height, half = Math.max(14, (by - ty) * (low ? .7 : .26));
      if (Math.abs(mx - tx) < half && my > ty - 4 && my < by + 4) { if (dist < bd) { bd = dist; best = a; } }
    }
    return best;
  }
  pickDetail(e) {
    const r = this.rig.dom.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, cam = this.stage.camera, v = this._v;
    let best = null, bd = 1e9;
    for (const l of this.office.labels) {
      v.set(l.x, l.y, l.z); const dist = cam.position.distanceTo(v); if (dist > 16) continue;
      v.project(cam); if (v.z > 1) continue;
      const px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height, rad = Math.max(10, l.r / dist * r.height * .9), d = Math.hypot(mx - px, my - py);
      if (d < rad && dist < bd) { bd = dist; best = l; }
    }
    return best;
  }
  showDetail(text) {
    const d = $('#detail'); d.textContent = text; d.hidden = false;
    clearTimeout(this._dt); this._dt = setTimeout(() => { d.hidden = true; }, 3800);
  }
  _wire() {
    const st = this.rig.dom;
    let down = null;
    st.addEventListener('pointerdown', (e) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; st.classList.add('drag'); });
    window.addEventListener('pointerup', (e) => {
      st.classList.remove('drag');
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5; down = null;
      if (moved || (e.target !== $('#cv') && e.target !== st)) return;
      const a = this.pick(e);
      if (a) { this.select(a.id); return; }
      const l = this.pickDetail(e);
      if (l) this.showDetail(l.name);
    });
    let hoverT = 0;
    st.addEventListener('pointermove', (e) => {
      if (down || (e.target !== $('#cv') && e.target !== st)) return;
      const t = performance.now(); if (t - hoverT < 70) return; hoverT = t;
      const a = this.pick(e); this.hover = a ? a.id : null;
      st.classList.toggle('hover', !!a || !!this.pickDetail(e));
    });
    document.querySelectorAll('#camBar [data-view]').forEach((b) => { b.onclick = () => this.rig.goView(b.dataset.view); });
    $('#btnWalk').onclick = () => this.rig.toggleWalk();
    $('#btnFollow').onclick = () => this.rig.toggleFollow(this.sel ? this.sim.actors.get(this.sel) : null);
    $('#btnTour').onclick = () => this.rig.toggleTour();
    $('#btnAuto').onclick = () => { this.auto = !this.auto; try { localStorage.setItem('oficina.auto', this.auto ? '1' : '0'); } catch (_) {} this.syncButtons(); };
    $('#btnTime').onclick = () => { const s = this.stage, ord = ['real', 'day', 'night']; s.timeMode = ord[(ord.indexOf(s.timeMode) + 1) % 3]; s.applyTime(true); this.syncButtons(); };
    $('#btnQuality').onclick = () => { const ord = ['high', 'mid', 'low'], q = ord[(ord.indexOf(this.stage.quality) + 1) % 3]; this.setQuality(q, true); };
    try { this.auto = localStorage.getItem('oficina.auto') !== '0'; } catch (_) { this.auto = true; }
    document.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
    }; });
    $('#chatForm').addEventListener('submit', (e) => this.sendChat(e));
    $('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
    document.querySelectorAll('#permBar button[data-level]').forEach((b) => { b.onclick = () => {
      if (!this.sel) return;
      fetch('/api/level', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ charId: this.sel, level: b.dataset.level }) });
      this.levels = this.levels || {}; this.levels[this.sel] = b.dataset.level; this.syncPerm();
    }; });
    $('#permAll').onclick = () => {
      if (!this.sel) return;
      const lv = (this.levels && this.levels[this.sel]) || 'work';
      fetch('/api/level', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ charId: '*', level: lv }) });
      this.showDetail('Listo: todos los agentes quedaron en "' + PERM_TEXT[lv].name + '"');
    };
    $('#chatClose').onclick = () => { this.sel = null; $('#chat').hidden = true; this.renderTeam(); };
    $('#btnDemo').onclick = () => fetch('/api/demo', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: '{}' });
    $('#chkSound').onchange = (e) => fetch('/api/sound', { method: 'POST', headers: { 'X-Office': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on: e.target.checked }) });
    for (const el of [$('#camBar'), $('#roomBar'), $('#mini')]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const mini = $('#mini');
    mini.addEventListener('click', (e) => {
      const r = mini.getBoundingClientRect(), x = (e.clientX - r.left) * (mini.width / r.width), y = (e.clientY - r.top) * (mini.height / r.height);
      const wx = (x - this.mx) / this.mk + OFFICE.x0, wz = (y - this.my) / this.mk + OFFICE.z0;
      const rig = this.rig, off = rig.cam.position.clone().sub(rig.ctl.target), look = new THREE.Vector3(wx, .7, wz);
      if (rig.mode === 'walk') { rig.walkTo(wx, wz); return; }
      rig.setMode('orbit');
      if (off.length() > 7) off.setLength(7);
      rig.flyTo(look.clone().add(off), look, 1.2); rig.view = null; rig.room = null; this.syncButtons();
    });
  }
  setQuality(q, manual) {
    this.stage.setQuality(q); this.sim.setActorShadows(q === 'high');
    if (manual) { this.manualQ = true; try { localStorage.setItem('oficina.quality', q); } catch (_) {} }
    this.syncButtons();
  }
  _buildRooms() {
    const bar = $('#roomBar');
    for (const r of ROOMS) { const b = document.createElement('button'); b.textContent = r.label; b.dataset.room = r.id; b.onclick = () => this.rig.goRoom(r.id); bar.appendChild(b); }
  }
  syncButtons() {
    const rig = this.rig;
    document.querySelectorAll('#camBar [data-view]').forEach((b) => b.classList.toggle('on', rig.view === b.dataset.view && rig.mode === 'orbit'));
    document.querySelectorAll('#roomBar button').forEach((b) => b.classList.toggle('on', rig.room === b.dataset.room));
    $('#btnWalk').classList.toggle('on', rig.mode === 'walk');
    $('#btnFollow').classList.toggle('on', rig.mode === 'follow');
    $('#btnTour').classList.toggle('on', rig.mode === 'tour');
    $('#btnAuto').classList.toggle('on', !!this.auto);
    const tm = this.stage.timeMode; $('#btnTime').textContent = tm === 'real' ? 'Hora real' : (tm === 'day' ? 'De día' : 'De noche');
    const q = this.stage.quality; $('#btnQuality').textContent = q === 'high' ? 'Calidad alta' : (q === 'mid' ? 'Calidad media' : 'Calidad baja');
    $('#helpHint').textContent = rig.mode === 'walk' ? 'Rueda para avanzar · arrastra para mirar · doble clic para ir a un punto · Esc para salir' : 'Arrastra para girar · clic derecho para mover · rueda para acercar · doble clic para ir a un punto';
  }
  // ---------- plano
  _buildMiniBase() {
    const mini = $('#mini'), w = mini.width, h = mini.height, pad = 8;
    const k = this.mk = Math.min((w - pad * 2) / (OFFICE.x1 - OFFICE.x0), (h - pad * 2) / (OFFICE.z1 - OFFICE.z0));
    this.mx = (w - (OFFICE.x1 - OFFICE.x0) * k) / 2; this.my = (h - (OFFICE.z1 - OFFICE.z0) * k) / 2;
    const X = (x) => this.mx + (x - OFFICE.x0) * k, Z = (z) => this.my + (z - OFFICE.z0) * k;
    this.mX = X; this.mZ = Z;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = 'rgba(12,14,20,.9)'; x.fillRect(0, 0, w, h);
    const zones = [[-11, -7, 7.8, 14, '#34465f'], [-3.2, -7, 6.4, 14, '#4a4238'], [3.2, -7, 7.8, 14, '#3e2f5a'], [-11, -7, 4.6, 4.4, '#46402f'], [6.4, -7, 4.6, 4.4, '#33283a'], [6.4, 2.6, 4.6, 4.4, '#2d3f33'], [-11, 2.6, 4.6, 4.4, '#2c3a50']];
    for (const [a, b, cw, ch, col] of zones) { x.fillStyle = col; x.fillRect(X(a), Z(b), cw * k, ch * k); }
    x.fillStyle = 'rgba(255,255,255,.18)';
    for (const d of Object.values(DESKS)) x.fillRect(X(d.x - d.w / 2), Z(d.z - d.d / 2), d.w * k, d.d * k);
    for (const wl of WALLS) {
      x.strokeStyle = wl.kind === 'glass' ? 'rgba(160,200,230,.8)' : (wl.kind === 'slats' ? 'rgba(200,170,120,.8)' : 'rgba(230,230,235,.85)');
      x.lineWidth = wl.kind === 'ext' ? 2 : 1;
      x.beginPath(); x.moveTo(X(wl.a[0]), Z(wl.a[1])); x.lineTo(X(wl.b[0]), Z(wl.b[1])); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.62)'; x.font = '800 9px Nunito, Arial'; x.textAlign = 'center';
    x.fillText('AGENCIA', X(-7.2), Z(.2)); x.fillText('ASKITAR', X(7.2), Z(.2)); x.fillText('COCINA', X(0), Z(-5)); x.fillText('SALA', X(0), Z(-.3)); x.fillText('RECEPCIÓN', X(0), Z(5.4));
    this.miniBase = c;
  }
  drawMini() {
    if (++this.frame % 3) return;
    const c = $('#mini').getContext('2d'), X = this.mX, Z = this.mZ;
    c.clearRect(0, 0, 264, 168);
    c.drawImage(this.miniBase, 0, 0);
    for (const a of this.sim.actors.values()) {
      if (!a.active) continue;
      c.fillStyle = a.want === 'wait' ? '#ffb020' : (a.want === 'work' ? '#3ddc84' : (this.sel === a.id ? '#7fb3ff' : '#e6e9f0'));
      c.beginPath(); c.arc(X(a.x), Z(a.z), this.sel === a.id ? 3.4 : 2.4, 0, 7); c.fill();
    }
    // la camara
    const cam = this.stage.camera, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const a0 = Math.atan2(dir.x, dir.z), cx = clamp(X(cam.position.x), 2, 262), cy = clamp(Z(cam.position.z), 2, 166), len = 22, sp = .42;
    c.fillStyle = 'rgba(90,150,255,.22)'; c.strokeStyle = 'rgba(120,170,255,.9)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a0 - sp) * len, cy + Math.cos(a0 - sp) * len); c.lineTo(cx + Math.sin(a0 + sp) * len, cy + Math.cos(a0 + sp) * len); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#9cc0ff'; c.beginPath(); c.arc(cx, cy, 2.6, 0, 7); c.fill();
  }
  // ---------- panel
  statusText(a) {
    if (!a.active && a.kind === 'reserve') return 'En reserva, listo para usar';
    if (!a.active) return 'Libre';
    if (a.want === 'wait') return '⚠ ' + ((a.sv && a.sv.text) || 'Necesita tu permiso');
    if (a.want === 'work') return (a.sv && a.sv.text) || 'Trabajando';
    if (a.want === 'done') return 'Entregando resultado';
    if (a.mode === 'crowd') return '¡Corrió a ver qué pasa!';
    if (a.sleeping) return 'Durmiendo la siesta';
    if (a.eating) return 'Comiendo';
    if (a.convo) return 'Charlando';
    if (a.mode === 'spot') return 'En un descanso';
    if (a.mode === 'moving') return 'Caminando por la oficina';
    return 'Disponible';
  }
  renderTeam() {
    const ul = $('#teamList'); const scroll = ul.parentElement.scrollTop; ul.innerHTML = '';
    const item = (a, off) => {
      const li = document.createElement('li');
      li.className = (a.want === 'work' ? 'working ' : a.want === 'wait' ? 'waiting ' : a.want === 'done' ? 'done ' : '') + (this.sel === a.id ? 'sel ' : '') + (off ? 'off' : '');
      li.innerHTML = '<span class="av"></span><div><div><span class="nm"></span> <span class="rl"></span></div><div class="st"></div></div>';
      li.querySelector('.nm').textContent = a.name; li.querySelector('.rl').textContent = a.role; li.querySelector('.st').textContent = this.statusText(a);
      li.onclick = () => { this.select(a.id); if (a.active) this.rig.focusActor(a); };
      ul.appendChild(li);
    };
    for (const d of this.sim.depts) {
      const mine = [...this.sim.actors.values()].filter((a) => a.dept === d.id);
      const h = document.createElement('li'); h.className = 'head';
      const nW = mine.filter((a) => a.want === 'work' || a.want === 'wait').length;
      h.innerHTML = '<span></span><i></i>'; h.firstChild.textContent = d.name; h.lastChild.textContent = nW ? nW + ' trabajando' : 'tranquilo';
      h.onclick = () => this.rig.goView(d.id);
      ul.appendChild(h);
      for (const a of mine) if (a.active && a.kind !== 'temp') item(a, false);
      for (const a of mine) if (a.active && a.kind === 'temp') item(a, false);
      const res = mine.filter((a) => !a.active && a.kind === 'reserve');
      if (res.length) { const s = document.createElement('li'); s.className = 'sub'; s.textContent = 'En reserva (' + res.length + ')'; ul.appendChild(s); for (const a of res) item(a, true); }
    }
    ul.parentElement.scrollTop = scroll;
  }
  renderLog() {
    const ul = $('#logList'); ul.innerHTML = '';
    for (const e of [...this.state.log].reverse()) {
      const li = document.createElement('li'); li.className = 'k-' + e.kind;
      li.innerHTML = '<span class="t"></span><span class="who"></span><span class="tx"></span>';
      li.querySelector('.t').textContent = new Date(e.t).toTimeString().slice(0, 8); li.querySelector('.who').textContent = e.who; li.querySelector('.tx').textContent = e.text;
      ul.appendChild(li);
    }
  }
  onState(st) {
    this.state = st;
    this.levels = st.levels || this.levels; this.syncPerm();
    $('#chipSessions').textContent = st.sessions.length + (st.sessions.length === 1 ? ' sesión' : ' sesiones');
    $('#chipWorking').textContent = [...this.sim.actors.values()].filter((a) => a.want === 'work' || a.want === 'wait').length + ' trabajando';
    const dn = st.done || 0; $('#chipDone').textContent = '✓ ' + dn + ' hoy';
    if (this.doneCount >= 0 && dn > this.doneCount) { const c = $('#chipDone'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    this.doneCount = dn;
    $('#chkSound').checked = !!st.sound;
    this.renderLog(); this.renderTeam();
  }
  // ---------- chat
  select(id) {
    this.sel = id; this.rig.selected = id;
    const a = this.sim.actors.get(id); if (!a) return;
    $('#chat').hidden = false;
    $('#chatName').textContent = a.name; $('#chatRole').textContent = a.role; $('#chatStatus').textContent = this.statusText(a);
    const can = a.chat;
    $('#chatInput').disabled = !can; $('#chatSend').disabled = !can;
    $('#permBar').hidden = !can;
    this.syncPerm();
    this.renderChat(); this.renderTeam();
  }
  syncPerm() {
    const a = this.sel && this.sim.actors.get(this.sel); if (!a) return;
    if (!a.chat) { $('#chatHint').textContent = 'Los pasantes son temporales: aparecen solo cuando hay un subagente trabajando.'; return; }
    const lv = (this.levels && this.levels[a.id]) || 'work';
    document.querySelectorAll('#permBar button[data-level]').forEach((b) => b.classList.toggle('on', b.dataset.level === lv));
    $('#chatHint').textContent = PERM_TEXT[lv].hint;
  }
  renderChat() {
    const box = $('#chatMsgs'); box.innerHTML = '';
    const id = this.sel; if (!id) return;
    for (const m of (this.history[id] || [])) { if (m.role === 'perm') this.addPerm(id, m); else this.addMsg(m.role, m.text); }
    if (this.chatBusy[id]) this.addMsg('typing', 'escribiendo…');
    box.scrollTop = box.scrollHeight;
  }
  addPerm(charId, m) {
    const d = document.createElement('div'); d.className = 'msg perm';
    const t = document.createElement('b'); t.textContent = m.state === 'yes' ? 'Permiso dado' : (m.state === 'no' ? 'Permiso negado' : (m.state === 'never' ? 'Bloqueado en la oficina, eso lo corres tú:' : 'Necesita tu permiso para:')); d.appendChild(t);
    for (const it of m.items) { const r = document.createElement('div'); r.className = 'pi'; r.textContent = it; d.appendChild(r); }
    if (m.state === 'open') {
      const row = document.createElement('div'); row.className = 'pb';
      const answer = async (yes) => {
        m.state = yes ? 'yes' : 'no'; if (yes) this.chatBusy[charId] = true; this.renderChat();
        try { const r = await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office': '1' }, body: JSON.stringify({ charId, id: m.id, yes }) }); const j = await r.json(); if (!j.ok) { this.chatBusy[charId] = false; (this.history[charId] = this.history[charId] || []).push({ role: 'agent', text: '⚠ ' + (j.error || 'No se pudo') }); this.renderChat(); } } catch (_) { this.chatBusy[charId] = false; this.renderChat(); }
      };
      const y = document.createElement('button'); y.className = 'yes'; y.textContent = 'Permitir y seguir'; y.onclick = () => answer(true);
      const n = document.createElement('button'); n.textContent = 'No'; n.onclick = () => answer(false);
      row.append(y, n); d.appendChild(row);
    }
    $('#chatMsgs').appendChild(d);
  }
  addMsg(role, text) { const d = document.createElement('div'); d.className = 'msg ' + (role === 'typing' ? 'agent typing' : role); d.textContent = text; $('#chatMsgs').appendChild(d); }
  onChat(m) {
    const h = this.history[m.charId] = this.history[m.charId] || [];
    if (m.kind === 'text') h.push({ role: 'agent', text: m.text });
    if (m.kind === 'user') h.push({ role: 'user', text: m.text });
    if (m.kind === 'perm') { h.push({ role: 'perm', id: m.id, items: m.items, state: m.state }); }
    if (m.kind === 'permDone') { const e = h.find((q) => q.role === 'perm' && q.id === m.id); if (e) e.state = m.state; }
    if (m.kind === 'done') this.chatBusy[m.charId] = false;
    if (this.sel === m.charId) this.renderChat();
  }
  async sendChat(e) {
    e.preventDefault();
    const id = this.sel, txt = $('#chatInput').value.trim(); if (!id || !txt) return;
    $('#chatInput').value = '';
    (this.history[id] = this.history[id] || []).push({ role: 'user', text: txt });
    this.chatBusy[id] = true; this.renderChat();
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office': '1' }, body: JSON.stringify({ charId: id, text: txt }) });
      const j = await r.json();
      if (!j.ok) { this.chatBusy[id] = false; this.history[id].push({ role: 'agent', text: '⚠ ' + (j.error || 'No se pudo enviar') }); this.renderChat(); }
    } catch (_) { this.chatBusy[id] = false; this.renderChat(); }
  }
}
