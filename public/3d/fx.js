// Efectos: memos que vuelan, confeti, chispas, Zzz, vapor del cafe y estrellitas.
import { THREE, canvasTex } from './kit.js';

const MAX = 700;
export class FX {
  constructor(scene) {
    this.parts = []; this.memos = []; this.sprites = [];
    this.scene = scene;
    const g = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false }), MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noAO = true;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this.zTex = canvasTex(64, 64, (c, w) => { c.font = '900 56px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#1a2340'; c.strokeText('Z', w / 2, 52); c.fillStyle = '#dfe9ff'; c.fillText('Z', w / 2, 52); });
    this.memoGeo = new THREE.BoxGeometry(.2, .004, .27);
    this.memoMat = new THREE.MeshStandardMaterial({ color: '#fffdf2', roughness: .8, map: canvasTex(128, 170, (c, w, h) => { c.fillStyle = '#fffdf2'; c.fillRect(0, 0, w, h); c.fillStyle = '#8899aa'; for (let y = 20; y < h - 16; y += 16) c.fillRect(14, y, w - 28 - (y % 5) * 3, 4); c.fillStyle = '#c0242f'; c.fillRect(14, 8, 44, 5); }) });
  }
  add(o) { if (this.parts.length < MAX) this.parts.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, t: 0, life: 1.4, size: .03, col: '#ffffff', spin: 0, drag: 0 }, o)); }
  confetti(x, y, z, n = 40) {
    const cols = ['#ff3fa4', '#ffd23f', '#3fd8ff', '#3fff9a', '#a43fff', '#ff6a3f', '#ffffff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = .6 + Math.random() * 1.6; this.add({ x: x + (Math.random() - .5) * .12, y, z: z + (Math.random() - .5) * .12, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 1.6 + Math.random() * 2.2, g: -5.5, life: 1.4 + Math.random() * 1.1, size: .028 + Math.random() * .02, col: cols[i % cols.length], spin: 6 + Math.random() * 10, drag: 1.1 }); }
  }
  sparkle(x, y, z, n = 10) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.6 - .4, s = .4 + Math.random() * .9; this.add({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + .3, vz: Math.sin(a) * Math.cos(e) * s, life: .5 + Math.random() * .5, size: .024, col: ['#ffd23f', '#ffffff', '#7fd0ff'][i % 3], spin: 8, drag: 2.4 }); }
  }
  star(x, z) { const a = Math.random() * 6.28; this.add({ x: x + Math.cos(a) * .3, y: .35 + Math.random() * .2, z: z + Math.sin(a) * .3, vx: -Math.sin(a) * .5, vz: Math.cos(a) * .5, vy: .3, life: .55, size: .04, col: '#ffd23f', spin: 5 }); }
  papers(x, z, n = 4) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; this.add({ x, y: .8, z, vx: Math.cos(a) * .9, vz: Math.sin(a) * .9, vy: 1.4 + Math.random(), g: -3.2, life: 1.3 + Math.random() * .6, size: .13, col: '#f7f5ea', spin: 6, drag: 1.4 }); } }
  steam(a) { const off = a.fig.root.localToWorld(this._p.set(-.08, 1.15, .22)); this.add({ x: off.x + (Math.random() - .5) * .02, y: off.y, z: off.z, vy: .24, vx: (Math.random() - .5) * .05, vz: (Math.random() - .5) * .05, life: .9, size: .02, col: '#e9e9e4', spin: 1 }); }
  z(x, y, z) {
    const m = new THREE.SpriteMaterial({ map: this.zTex, transparent: true, depthWrite: false, opacity: 1 });
    const s = new THREE.Sprite(m); s.position.set(x + .08, y, z); s.scale.setScalar(.09); s.userData.noAO = true;
    this.scene.add(s); this.sprites.push({ s, t: 0, life: 2.2, ox: x + .08 });
  }
  memo(from, to) {
    const m = new THREE.Mesh(this.memoGeo, this.memoMat); m.castShadow = true; m.userData.noAO = true;
    this.scene.add(m);
    this.memos.push({ m, from, to, t: 0, dur: 1.15, x0: from.x, z0: from.z, x1: to.x, z1: to.z, y0: 1.2, y1: 1.15 });
  }
  update(dt) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life || p.y < .01) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vz *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of this.parts) {
      const k = p.t / p.life, sz = p.size * (k > .7 ? (1 - k) / .3 : 1);
      this._e.set(p.t * p.spin, p.t * p.spin * .7, p.t * p.spin * .4);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(p.x, p.y, p.z), this._q, this._s.set(sz, sz, sz));
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, this._c.set(p.col));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = n > 0;
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const q = this.sprites[i]; q.t += dt; const k = q.t / q.life;
      q.s.position.y += dt * .22; q.s.position.x = q.ox + Math.sin(q.t * 2.4) * .05;
      q.s.scale.setScalar(.07 + k * .13); q.s.material.opacity = k > .65 ? (1 - k) / .35 : 1;
      if (k >= 1) { this.scene.remove(q.s); q.s.material.dispose(); this.sprites.splice(i, 1); }
    }
    for (let i = this.memos.length - 1; i >= 0; i--) {
      const q = this.memos[i]; q.t += dt;
      const k = Math.min(1, q.t / q.dur), e = k * k * (3 - 2 * k);
      const tx = q.to.x != null ? q.to.x : q.x1, tz = q.to.z != null ? q.to.z : q.z1;
      q.m.position.set(q.x0 + (tx - q.x0) * e, q.y0 + (q.y1 - q.y0) * e + Math.sin(k * Math.PI) * .9, q.z0 + (tz - q.z0) * e);
      q.m.rotation.set(Math.sin(k * 9) * .5, k * 8, Math.cos(k * 7) * .35);
      if (k >= 1) { this.scene.remove(q.m); this.memos.splice(i, 1); }
    }
  }
}
