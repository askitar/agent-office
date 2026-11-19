// Camara: orbitar con el mouse, caminar por dentro, seguir a un personaje, recorrido automatico y vuelos suaves entre cuartos.
import { THREE } from './kit.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OFFICE, ROOMS, freeAt, nearestFree, findPath } from './world.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const VIEWS = {
  all: { pos: [0, 15.5, 14.2], look: [0, 0, .5] },
  agency: { pos: [-7.1, 8.2, 8.9], look: [-7.1, .2, .1] },
  center: { pos: [0, 7.6, 8.4], look: [0, .2, -.6] },
  askitar: { pos: [7.1, 8.2, 8.9], look: [7.1, .2, .1] },
};

export class CamRig {
  constructor(stage, dom, office, sim) {
    this.stage = stage; this.dom = dom; this.office = office; this.sim = sim;
    const cam = this.cam = stage.camera;
    cam.position.set(...VIEWS.all.pos);
    const c = this.ctl = new OrbitControls(cam, dom);
    c.target.set(...VIEWS.all.look);
    c.enableDamping = true; c.dampingFactor = .09; c.zoomToCursor = true; c.screenSpacePanning = false;
    c.minDistance = .55; c.maxDistance = 42; c.maxPolarAngle = Math.PI * .495; c.rotateSpeed = .75; c.zoomSpeed = 1.15; c.panSpeed = 1.0;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.update();
    this.mode = 'orbit'; this.fly = null; this.view = 'all'; this.room = null; this.followId = null; this.tourI = 0; this.tourT = 0;
    this.keys = new Set(); this.walk = { yaw: 0, pitch: -.05, vel: 0, drag: null, path: null };
    this.lastFollow = null; this.lastUser = -999;
    this.onChange = null;
    this._ray = new THREE.Raycaster(); this._v = new THREE.Vector2(); this._floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._wire();
  }
  notify() { if (this.onChange) this.onChange(); }
  touched() { this.lastUser = performance.now() / 1000; }
  _wire() {
    const d = this.dom;
    this.ctl.addEventListener('start', () => { this.touched(); this.fly = null; if (this.mode === 'tour') this.setMode('orbit'); if (this.view) { this.view = null; this.room = null; this.notify(); } });
    d.addEventListener('dblclick', (e) => this._dbl(e));
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    // caminar: arrastrar mira, rueda avanza
    d.addEventListener('pointerdown', (e) => { if (this.mode === 'walk' && e.button === 0) { this.walk.drag = { x: e.clientX, y: e.clientY, yaw: this.walk.yaw, pitch: this.walk.pitch }; this.touched(); } });
    window.addEventListener('pointermove', (e) => { const w = this.walk; if (this.mode === 'walk' && w.drag) { w.yaw = w.drag.yaw - (e.clientX - w.drag.x) * .0042; w.pitch = Math.max(-1.25, Math.min(1.1, w.drag.pitch - (e.clientY - w.drag.y) * .0036)); } });
    window.addEventListener('pointerup', () => { this.walk.drag = null; });
    d.addEventListener('wheel', (e) => { if (this.mode === 'walk') { e.preventDefault(); this.walk.vel += (e.deltaY < 0 ? 1 : -1) * 1.5; this.walk.path = null; this.touched(); } }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (['TEXTAREA', 'INPUT'].includes(document.activeElement && document.activeElement.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'q', 'e'].includes(k)) { this.keys.add(k); this.touched(); if (k.startsWith('Arrow')) e.preventDefault(); return; }
      if (k === '0') this.goView('all'); else if (k === '1') this.goView('agency'); else if (k === '2') this.goView('center'); else if (k === '3') this.goView('askitar');
      else if (k === 'c') this.toggleWalk(); else if (k === 'f') this.toggleFollow(); else if (k === 't') this.toggleTour();
      else if (k === 'Escape' && this.mode !== 'orbit') this.setMode('orbit');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    window.addEventListener('blur', () => this.keys.clear());
  }
  floorPoint(e) {
    const r = this.dom.getBoundingClientRect();
    this._v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._v, this.cam);
    const p = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._floor, p) ? p : null;
  }
  _dbl(e) {
    const p = this.floorPoint(e); if (!p) return;
    this.touched();
    if (this.mode === 'walk') { this.walkTo(p.x, p.z); return; }
    if (this.mode !== 'orbit') this.setMode('orbit');
    const dir = this.cam.position.clone().sub(this.ctl.target), dist = Math.max(2.6, dir.length() * .5);
    const tgt = V3(p.x, .7, p.z), pos = tgt.clone().add(dir.normalize().multiplyScalar(dist));
    pos.y = Math.max(.9, pos.y);
    this.flyTo(pos, tgt, 1.1);
    this.view = null; this.room = null; this.notify();
  }
  flyTo(pos, look, dur = 1.5, then) {
    this.fly = { p0: this.cam.position.clone(), t0: this.ctl.target.clone(), p1: pos.clone(), t1: look.clone(), t: 0, dur, then };
  }
  fitFactor() { const a = this.stage.w / this.stage.h; return Math.max(1, Math.min(2.3, 1.55 / a)); }
  goView(id) {
    const v = VIEWS[id]; if (!v) return;
    this.setMode('orbit');
    this.touched();
    const look = V3(...v.look), off = V3(...v.pos).sub(look).multiplyScalar(this.fitFactor() * (id === 'all' ? 1 : .98));
    this.flyTo(look.clone().add(off), look, 1.6);
    this.view = id; this.room = null; this.notify();
  }
  goRoom(id, auto) {
    const r = ROOMS.find((q) => q.id === id); if (!r) return;
    this.setMode('orbit');
    if (!auto) this.touched();
    const look = V3(...r.look), a = this.stage.w / this.stage.h, f = Math.max(1, Math.min(1.75, 1.35 / a)), off = V3(...r.cam).sub(look).multiplyScalar(f); off.y *= 1 + (f - 1) * 1.1;
    this.flyTo(look.clone().add(off), look, 1.7);
    this.room = id; this.view = null; this.autoRoom = !!auto; this.notify();
  }
  focusActor(a, instant) {
    if (!a || !a.active) return;
    this.setMode('orbit');
    const t = V3(a.x, 1.0, a.z), dir = this.cam.position.clone().sub(this.ctl.target).normalize();
    const dist = 3.1, pos = t.clone().add(dir.multiplyScalar(dist)); pos.y = Math.max(1.5, Math.min(3.2, pos.y));
    this.flyTo(pos, t, instant ? .01 : 1.1); this.view = null; this.room = null; this.notify();
  }
  setMode(m) {
    if (this.mode === m) return;
    const was = this.mode;
    this.mode = m;
    this.ctl.enabled = m === 'orbit' || m === 'follow';
    this.dom.classList.toggle('walking', m === 'walk');
    if (was === 'walk') { const dir = new THREE.Vector3(); this.cam.getWorldDirection(dir); this.ctl.target.copy(this.cam.position).addScaledVector(dir, 3).setY(Math.max(.3, this.cam.position.y + dir.y * 3)); }
    if (m !== 'follow') this.followId = null;
    this.fly = null;
    this.notify();
  }
  toggleWalk() {
    if (this.mode === 'walk') { this.setMode('orbit'); return; }
    this.setMode('walk');
    this.touched();
    const t = this.ctl.target, p = nearestFree(Math.max(-10.5, Math.min(10.5, t.x)), Math.max(-6.6, Math.min(6.6, t.z)));
    const dir = t.clone().sub(this.cam.position);
    this.walk.yaw = Math.atan2(-dir.x, -dir.z); this.walk.pitch = -.05; this.walk.vel = 0; this.walk.path = null;
    this.walkEntry = { p0: this.cam.position.clone(), p1: V3(p.x, 1.62, p.z), t: 0, dur: 1.2, r0: this.cam.quaternion.clone() };
    this.view = null; this.room = null; this.notify();
  }
  walkTo(x, z) {
    const p = findPath(this.cam.position.x, this.cam.position.z, x, z);
    if (p && p.length) this.walk.path = p;
  }
  toggleFollow(actor) {
    if (this.mode === 'follow' && !actor) { this.setMode('orbit'); return; }
    const a = actor || this.sim.actors.get(this.selected) || [...this.sim.actors.values()].find((q) => q.active && q.want === 'work') || [...this.sim.actors.values()].find((q) => q.active);
    if (!a) return;
    if (this.onSelect) this.onSelect(a.id);
    this.setMode('orbit');
    this.focusActor(a);
    this.mode = 'follow'; this.ctl.enabled = true; this.followId = a.id; this.lastFollow = V3(a.x, 0, a.z);
    this.view = null; this.room = null; this.notify();
  }
  toggleTour() {
    if (this.mode === 'tour') { this.setMode('orbit'); return; }
    this.setMode('tour'); this.ctl.enabled = false; this.tourI = -1; this.tourT = 0; this.tourNext();
    this.view = null; this.room = null; this.notify();
  }
  tourNext() {
    this.tourI = (this.tourI + 1) % ROOMS.length;
    const r = ROOMS[this.tourI];
    this.tourRoom = r; this.tourT = 0;
    this.flyTo(V3(...r.cam), V3(...r.look), 2.4);
  }
  update(dt) {
    const c = this.ctl, cam = this.cam;
    if (this.walkEntry) {
      const w = this.walkEntry; w.t += dt; const k = ease(Math.min(1, w.t / w.dur));
      cam.position.lerpVectors(w.p0, w.p1, k);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.walk.pitch, this.walk.yaw, 0, 'YXZ'));
      cam.quaternion.slerpQuaternions(w.r0, q, k);
      if (k >= 1) this.walkEntry = null;
    } else if (this.fly) {
      const f = this.fly; f.t += dt; const k = ease(Math.min(1, f.t / f.dur));
      cam.position.lerpVectors(f.p0, f.p1, k);
      c.target.lerpVectors(f.t0, f.t1, k);
      cam.lookAt(c.target);
      if (k >= 1) { this.fly = null; if (f.then) f.then(); }
    } else if (this.mode === 'orbit' || this.mode === 'follow') {
      if (this.keys.size) {
        const sp = Math.max(1.6, cam.position.distanceTo(c.target) * .85) * dt;
        const fw = V3(0, 0, 0); cam.getWorldDirection(fw); fw.y = 0; fw.normalize();
        const rt = V3(-fw.z, 0, fw.x);
        let mv = V3(0, 0, 0);
        if (this.keys.has('w') || this.keys.has('ArrowUp')) mv.add(fw);
        if (this.keys.has('s') || this.keys.has('ArrowDown')) mv.sub(fw);
        if (this.keys.has('d') || this.keys.has('ArrowRight')) mv.add(rt);
        if (this.keys.has('a') || this.keys.has('ArrowLeft')) mv.sub(rt);
        mv.multiplyScalar(sp); cam.position.add(mv); c.target.add(mv);
        if (this.view) { this.view = null; this.notify(); }
      }
      if (this.mode === 'follow') {
        const a = this.sim.actors.get(this.followId);
        if (a && a.active) {
          const p = V3(a.x, 0, a.z), d = p.clone().sub(this.lastFollow); this.lastFollow.copy(p);
          cam.position.add(d); c.target.add(d);
        } else this.setMode('orbit');
      }
      c.target.x = Math.max(-13, Math.min(13, c.target.x)); c.target.z = Math.max(-9, Math.min(9, c.target.z)); c.target.y = Math.max(0, Math.min(3, c.target.y));
      c.update(dt);
      if (cam.position.y < .25) cam.position.y = .25;
    } else if (this.mode === 'walk') {
      const w = this.walk;
      let fwd = 0, side = 0;
      if (this.keys.has('w') || this.keys.has('ArrowUp')) fwd += 1;
      if (this.keys.has('s') || this.keys.has('ArrowDown')) fwd -= 1;
      if (this.keys.has('d') || this.keys.has('ArrowRight')) side += 1;
      if (this.keys.has('a') || this.keys.has('ArrowLeft')) side -= 1;
      if (fwd || side) w.path = null;
      const sf = Math.sin(w.yaw), cf = Math.cos(w.yaw), sp = 2.1;
      let dx = (-sf * fwd + cf * side) * sp * dt, dz = (-cf * fwd - sf * side) * sp * dt;
      if (Math.abs(w.vel) > .01) { dx += -sf * w.vel * dt; dz += -cf * w.vel * dt; w.vel *= Math.exp(-dt * 3.2); }
      if (w.path && w.path.length) {
        const n = w.path[0], ax = n.x - cam.position.x, az = n.z - cam.position.z, dist = Math.hypot(ax, az), st = 2.3 * dt;
        const want = Math.atan2(-ax, -az), diff = Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw));
        w.yaw += diff * Math.min(1, dt * 4.5);
        if (dist < st + .03) w.path.shift(); else { dx = ax / dist * st; dz = az / dist * st; }
      }
      const px = cam.position.x, pz = cam.position.z;
      const can = (x, z) => freeAt(x, z) || !freeAt(px, pz);
      if (can(px + dx, pz)) cam.position.x = px + dx;
      if (can(cam.position.x, pz + dz)) cam.position.z = pz + dz;
      const moving = Math.hypot(dx, dz) > .0005; w.bob = (w.bob || 0) + (moving ? dt * 8 : 0);
      cam.position.y = 1.62 + (moving ? Math.sin(w.bob) * .012 : 0);
      cam.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
    } else if (this.mode === 'tour') {
      this.tourT += dt;
      // deriva lenta de camara, como una toma de documental
      cam.position.addScaledVector(V3(Math.sin(this.tourT * .4) * .05, 0, Math.cos(this.tourT * .3) * .05), dt * 2.2);
      c.target.y += Math.sin(this.tourT * .5) * dt * .01;
      cam.lookAt(c.target);
      if (this.tourT > 6.5) this.tourNext();
    }
    this._cutaway();
  }
  // esconde las paredes que estan entre la camara y el interior, y el techo cuando se mira desde arriba
  _cutaway() {
    const p = this.cam.position, o = this.office, M = .02;
    o.sides.S.visible = p.z < OFFICE.z1 - M;
    o.sides.N.visible = p.z > OFFICE.z0 + M;
    o.sides.E.visible = p.x < OFFICE.x1 - M;
    o.sides.W.visible = p.x > OFFICE.x0 + M;
    o.ceiling.visible = p.y < OFFICE.h - .05;
  }
}
