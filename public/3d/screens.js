// Pantallas vivas: cada monitor muestra lo que ese agente esta haciendo de verdad, y los televisores muestran la actividad real.
import { roundRect, wrap } from './kit.js';

const CODE = ['#7fd0ff', '#f7c26b', '#c58cff', '#8be28b', '#ff8fa3', '#d6dae2'];
function seededLine(i, k) { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); }

export function paintMonitor(sc, a, deptName, t) {
  const c = sc.ctx, w = sc.cvs.width, h = sc.cvs.height;
  const isAsk = deptName === 'askitar';
  const status = a && a.mode === 'work' ? a.want : 'none';
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (status === 'wait') {
    const blink = Math.sin(t * 5) > 0;
    c.fillStyle = blink ? '#ffb020' : '#7a5200'; c.fillRect(0, 0, w, h);
    c.fillStyle = blink ? '#2a1a00' : '#ffe08a'; c.textAlign = 'center'; c.font = '900 34px Arial, sans-serif'; c.fillText('¡TU OK!', w / 2, h / 2 - 2);
    c.font = '700 16px Arial, sans-serif'; wrap(c, (a.sv && a.sv.text) || 'Necesito permiso', w / 2, h / 2 + 28, w - 24, 19);
    return;
  }
  if (status === 'work') {
    c.fillStyle = isAsk ? '#14111f' : '#0f1520'; c.fillRect(0, 0, w, h);
    c.fillStyle = isAsk ? '#ff3fa4' : '#2f6fd5'; c.fillRect(0, 0, w, 24);
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '800 15px Arial, sans-serif'; c.fillText(a.name + ' · trabajando', 8, 17);
    const scroll = (t * 2.2 + sc.phase) | 0;
    for (let i = 0; i < 8; i++) {
      const k = i + scroll, y = 34 + i * 15, indent = (seededLine(k, 1) * 4 | 0) * 12;
      let x = 8 + indent;
      c.fillStyle = '#3a4152'; c.fillRect(2, y, 3, 8);
      for (let q = 0; q < 4; q++) { const len = 14 + seededLine(k, q + 2) * 48; if (x + len > w - 6) break; c.fillStyle = CODE[(seededLine(k, q + 7) * 6) | 0]; c.fillRect(x, y, len, 7); x += len + 6; }
    }
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, h - 40, w, 40);
    c.fillStyle = '#9ff0c0'; c.textAlign = 'left'; c.font = '700 15px Arial, sans-serif';
    wrap(c, String((a.sv && a.sv.text) || 'Pensando…').slice(0, 58), 8, h - 24, w - 16, 16);
    return;
  }
  // protector de pantalla: logo rebotando
  c.fillStyle = '#06070b'; c.fillRect(0, 0, w, h);
  const x = 30 + Math.abs(((t * 14 + sc.phase * 40) % ((w - 90) * 2)) - (w - 90)), y = 26 + Math.abs(((t * 9 + sc.phase * 30) % ((h - 60) * 2)) - (h - 60));
  c.textAlign = 'center'; c.font = '900 22px Arial, sans-serif'; c.fillStyle = isAsk ? '#ff5aa8' : '#5a8cff'; c.fillText(isAsk ? 'ASKITAR' : 'AGENCIA', x, y);
}

export function paintTV(tv, kind, state, sim, t) {
  const c = tv.ctx, w = tv.w, h = tv.h;
  const log = (state.log || []).slice(-9).reverse();
  if (kind === 'lounge') {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#111827'); g.addColorStop(1, '#241a3a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '900 52px Arial, sans-serif'; c.fillText('Actividad de la oficina', 40, 74);
    c.font = '800 40px Arial, sans-serif'; c.fillStyle = '#3ddc84'; c.textAlign = 'right'; c.fillText('✓ ' + (state.done || 0) + ' hoy', w - 40, 72);
    c.textAlign = 'left';
    if (!log.length) { c.fillStyle = '#8a90a2'; c.font = '700 36px Arial, sans-serif'; c.fillText('Todo tranquilo por ahora…', 40, 170); }
    log.forEach((e, i) => {
      const y = 132 + i * 50;
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.09)'; c.fillRect(30, y - 34, w - 60, 46);
      c.fillStyle = e.kind === 'alert' ? '#ffb020' : (e.kind === 'done' ? '#3ddc84' : '#7fb3ff'); c.font = '800 30px Arial, sans-serif'; c.fillText(e.who, 44, y);
      const nx = 44 + c.measureText(e.who).width + 16;
      c.fillStyle = '#e2e5ec'; c.font = '600 28px Arial, sans-serif';
      let txt = String(e.text); while (c.measureText(txt).width > w - nx - 50 && txt.length > 4) txt = txt.slice(0, -2);
      c.fillText(txt, nx, y);
    });
    return;
  }
  const isAsk = kind === 'askitar', mine = [...sim.actors.values()].filter((a) => a.dept === kind && a.active);
  const working = mine.filter((a) => a.want === 'work' || a.want === 'wait');
  c.fillStyle = isAsk ? '#120e1c' : '#0f1a2c'; c.fillRect(0, 0, w, h);
  c.fillStyle = isAsk ? '#ff5aa8' : '#6ea0ff'; c.textAlign = 'left'; c.font = '900 50px Arial, sans-serif'; c.fillText(isAsk ? 'ASKITAR STUDIO' : 'AGENCIA DE CLIENTES', 36, 70);
  c.fillStyle = '#c9cfdc'; c.font = '700 32px Arial, sans-serif'; c.fillText(working.length ? working.length + ' trabajando ahora' : 'Nadie trabajando, a descansar', 36, 118);
  working.slice(0, 5).forEach((a, i) => {
    const y = 168 + i * 66;
    c.fillStyle = 'rgba(255,255,255,.07)'; roundRect(c, 30, y - 36, w - 60, 58, 12); c.fill();
    c.fillStyle = a.want === 'wait' ? '#ffb020' : '#3ddc84'; c.beginPath(); c.arc(58, y - 8, 11, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '800 32px Arial, sans-serif'; c.fillText(a.name, 80, y + 2);
    const nx = 80 + c.measureText(a.name).width + 18; c.fillStyle = '#b8bfcd'; c.font = '600 27px Arial, sans-serif';
    let tx = String((a.sv && a.sv.text) || 'Trabajando'); while (c.measureText(tx).width > w - nx - 50 && tx.length > 4) tx = tx.slice(0, -2);
    c.fillText(tx, nx, y + 1);
  });
  if (isAsk && !working.length) {
    // linea de tiempo de video de adorno
    const y0 = 220;
    for (let tr = 0; tr < 4; tr++) { c.fillStyle = '#1f1a2c'; c.fillRect(36, y0 + tr * 62, w - 72, 50); for (let i = 0; i < 7; i++) { const x = 40 + seededLine(i, tr) * (w - 260), l = 80 + seededLine(i, tr + 5) * 140; c.fillStyle = ['#ff3fa4', '#3fb4ff', '#ffb020', '#3ddc84'][tr]; c.globalAlpha = .75; c.fillRect(x, y0 + tr * 62 + 6, l, 38); c.globalAlpha = 1; } }
    const px = 36 + ((t * 40) % (w - 72)); c.fillStyle = '#fff'; c.fillRect(px, y0 - 8, 3, 262);
  }
  if (!isAsk && !working.length) {
    const steps = ['Brief', 'Guion', 'Contenido', 'Revisión', 'Publicación'];
    steps.forEach((s, i) => { const x = 44 + i * 188, on = ((t / 2) | 0) % 5 === i; c.fillStyle = on ? '#2f6fd5' : '#1b2a44'; roundRect(c, x, 230, 172, 96, 14); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 26px Arial, sans-serif'; c.fillText(s, x + 86, 286); c.textAlign = 'left'; });
  }
}
