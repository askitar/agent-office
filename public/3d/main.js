// Arranque de la oficina 3D: carga todo, conecta los eventos reales de Claude Code y corre el bucle.
import { THREE, loadModels } from './kit.js';
import { Stage } from './stage.js';
import { buildOffice, MODEL_IDS } from './office3d.js';
import { FX } from './fx.js';
import { Sim } from './sim.js';
import { CamRig, VIEWS } from './camera.js';
import { UI } from './ui.js';
import { paintMonitor, paintTV } from './screens.js';

const $ = (s) => document.querySelector(s);
const host = $('#stage');
const stage = new Stage($('#cv'), host);
let onResizeView = null;
new ResizeObserver(() => { stage.resize(); if (onResizeView) onResizeView(); }).observe(host);
const prog = (p, t) => { $('#lprog').style.width = Math.round(p * 100) + '%'; if (t) $('#lsub').textContent = t; };
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  prog(.02, 'Trayendo los muebles…');
  await loadModels(MODEL_IDS, (n, tot) => prog(.05 + .6 * n / tot));
  prog(.68, 'Prendiendo las luces…');
  await stage.loadSky();
  prog(.74, 'Armando las oficinas…'); await nextFrame();
  const office = buildOffice(stage.scene);
  const fx = new FX(stage.scene);
  const sim = new Sim(stage.scene, fx);
  const rig = new CamRig(stage, host, office, sim);
  const ui = new UI(stage, sim, rig, office);

  onResizeView = () => { if (rig.view === 'all' && rig.mode === 'orbit') { clearTimeout(onResizeView.t); onResizeView.t = setTimeout(() => { const v = VIEWS.all, look = new THREE.Vector3(...v.look), off = new THREE.Vector3(...v.pos).sub(look).multiplyScalar(rig.fitFactor()); rig.flyTo(look.clone().add(off), look, .5); }, 150); } };

  // calidad inicial segun la tarjeta grafica
  const gpu = stage.gpuName();
  let saved = null; try { saved = localStorage.getItem('oficina.quality'); } catch (_) {}
  const integrated = /intel|uhd|iris|swiftshader|software|llvmpipe/i.test(gpu);
  const startQ = saved || (integrated ? 'mid' : 'high');
  if (saved) ui.manualQ = true;

  // red
  let started = false;
  const start = (m) => {
    sim.init(m.roster);
    ui.history = m.history || {};
    $('#subtitle').textContent = m.roster.office.subtitle || '';
    $('.brand').textContent = m.roster.office.name || 'OFICINA';
    ui.setQuality(startQ);
    ui.renderTeam();
    prog(.95, 'Llegando el equipo…');
    started = true;
    for (let i = 0; i < 4; i++) { fx.update(.016); sim.update(.016); }
    rig.goView('all');
    rig.lastUser = -999; rig.fly = null; const v = VIEWS.all, off = new THREE.Vector3(...v.pos).sub(new THREE.Vector3(...v.look)).multiplyScalar(rig.fitFactor());
    rig.ctl.target.set(...v.look); rig.cam.position.copy(rig.ctl.target).add(off); rig.ctl.update();
    stage.renderer.compile(stage.scene, stage.camera);
    prog(1); setTimeout(() => $('#loading').classList.add('gone'), 150);
  };
  const es = new EventSource('/events');
  es.onopen = () => { $('#offline').hidden = true; };
  es.onerror = () => { $('#offline').hidden = false; };
  es.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.type === 'hello') { if (!started) start(m); }
    else if (!started) return;
    else if (m.type === 'state') { sim.applyState(m); ui.onState(m); }
    else if (m.type === 'cue') sim.applyCue(m);
    else if (m.type === 'chat') ui.onChat(m);
  };

  // puertas que se abren solas
  function updateDoors(dt) {
    const camPos = stage.camera.position;
    for (const d of office.doors) {
      let near = rig.mode === 'walk' && Math.hypot(camPos.x - d.x, camPos.z - d.z) < 1.6;
      if (!near) for (const a of sim.actors.values()) if (a.active && Math.hypot(a.x - d.x, a.z - d.z) < 1.5) { near = true; break; }
      d.open += ((near ? 1 : 0) - d.open) * (1 - Math.exp(-dt * (near ? 7 : 3.2)));
      if (d.kind === 'swing') d.g.rotation.y = d.base + d.dir * d.amount * d.open;
      else d.g.position.x = d.base + d.dir * d.amount * d.open;
    }
  }
  // pantallas: las activas se repintan seguido, las demas casi nunca
  const allScreens = [];
  for (const key of Object.keys(office.screens)) for (const sc of office.screens[key]) allScreens.push({ key, dept: key.split('.')[0], sc, last: -9 });
  let scI = 0, tvT = 0, tvI = 0, t = 0;
  function updateScreens(dt) {
    t += dt;
    let budget = 3;
    for (let n = 0; n < allScreens.length && budget > 0; n++) {
      scI = (scI + 1) % allScreens.length;
      const s = allScreens[scI], a = sim.deskActive[s.key] || null, every = a ? .22 : 1.1;
      if (t - s.last < every) continue;
      paintMonitor(s.sc, a, s.dept, t);
      s.sc.tex.needsUpdate = true; s.last = t; budget--;
    }
    tvT -= dt;
    if (tvT <= 0) {
      tvT = .45; const kinds = ['lounge', 'agency', 'askitar'], k = kinds[tvI++ % 3], tv = office.tvs[k];
      if (tv) { paintTV(tv, k, ui.state, sim, t); tv.tex.needsUpdate = true; }
    }
    if (office.onAirMesh) office.onAirMesh.visible = [...sim.actors.values()].some((a) => a.active && a.x > 6.4 && a.z > 2.6) || Math.sin(t * .5) > .3;
  }
  // camara automatica: se va a la gerencia cuando Oscar hace falta
  const shown = {}; let backTo = null;
  setInterval(() => {
    if (!ui.auto || rig.mode !== 'orbit') return;
    const quiet = performance.now() / 1000 - rig.lastUser > 25;
    for (const d of sim.depts) {
      const on = sim.deptAlert(d.id);
      if (on && !shown[d.id] && quiet) { shown[d.id] = true; backTo = rig.view || 'all'; rig.goRoom(d.id === 'askitar' ? 'ak_boss' : 'fp_boss', true); rig.autoRoom = true; }
      if (!on && shown[d.id]) { shown[d.id] = false; if (rig.autoRoom && quiet) { rig.autoRoom = false; rig.goView(backTo || 'all'); rig.lastUser = -999; } }
    }
  }, 1200);
  setInterval(() => stage.applyTime(), 30000);

  // bucle
  let last = performance.now(), fpsN = 0, fpsT = 0, lowFor = 0;
  const fpsEl = $('#fps');
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!started) return;
    sim.update(dt); fx.update(dt); rig.update(dt); updateDoors(dt); updateScreens(dt);
    ui.place(); ui.drawMini();
    stage.render();
    fpsN++; fpsT += dt;
    if (fpsT >= 1) {
      const fps = fpsN / fpsT; fpsEl.textContent = Math.round(fps) + ' fps'; fpsN = 0; fpsT = 0;
      // baja la calidad sola si la tarjeta no da, solo si la pestana esta a la vista
      if (!ui.manualQ && !document.hidden) {
        lowFor = fps < 24 ? lowFor + 1 : 0;
        if (lowFor >= 6) { lowFor = 0; if (stage.quality === 'high') ui.setQuality('mid'); else if (stage.quality === 'mid' && fps < 16) ui.setQuality('low'); }
      }
    }
  }
  requestAnimationFrame(loop);
  window.OFICINA = { stage, office, sim, rig, ui, fx, THREE };
  console.log('Tarjeta grafica:', gpu, '| calidad inicial', startQ);
})().catch((e) => { console.error(e); $('#lsub').textContent = 'No pudo abrir la oficina: ' + e.message; });
