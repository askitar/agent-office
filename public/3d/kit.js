// Herramientas comunes: geometria con cache, materiales PBR, lotes instanciados y carga de modelos Poly Haven.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, mergeGeometries };
export const ASSETS = '/3d/assets';

// ---------------------------------------------------------------- geometria
const geoCache = new Map();
const cached = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; };
export const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const rbox = (w, h, d, r = .01, s = 2) => cached(`r${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2.01, h / 2.01, d / 2.01)));
export const cyl = (r0, r1, h, seg = 16, open = false) => cached(`c${r0},${r1},${h},${seg},${open}`, () => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open));
export const sph = (r, a = 16, b = 12) => cached(`s${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));
export const plane = (w, h) => cached(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
export const torus = (r, t, a = 10, b = 24, arc = Math.PI * 2) => cached(`t${r},${t},${a},${b},${arc}`, () => new THREE.TorusGeometry(r, t, a, b, arc));
export const lathe = (key, pts, seg = 24) => cached('l' + key, () => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg));
// caja con UV en metros para que las texturas de pared y piso no se estiren
export function uvBox(w, h, d, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / scale, uv.getY(i) * dims[f][1] / scale); }
  return g;
}
export function floorRect(x0, z0, x1, z1, scale = 1, y = 0) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / scale, p.getZ(i) / scale);
  return g;
}

// ---------------------------------------------------------------- materiales
const matCache = new Map();
export const mat = (color, rough = .6, metal = 0, extra = {}) => {
  const key = JSON.stringify([color, rough, metal, extra]);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); matCache.set(key, m); }
  return m;
};
export const glow = (color, intensity = 2) => mat('#000000', .6, 0, { emissive: color, emissiveIntensity: intensity });
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 8;
export const setAniso = (n) => { maxAniso = n; };
function loadTex(url, srgb) {
  let t = texCache.get(url);
  if (!t) {
    t = texLoader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(url, t);
  }
  return t;
}
export function pbr(id, o = {}) {
  const base = `${ASSETS}/tex/${id}`;
  const m = new THREE.MeshStandardMaterial({
    map: o.noDiff ? null : loadTex(`${base}/diff.jpg`, true), normalMap: loadTex(`${base}/nor.jpg`, false), roughnessMap: loadTex(`${base}/rough.jpg`, false),
    color: o.color || '#ffffff', roughness: o.rough != null ? o.rough : 1, metalness: o.metal || 0,
  });
  m.normalScale.set(o.nScale != null ? o.nScale : 1, o.nScale != null ? o.nScale : 1);
  return m;
}
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
export const picMat = (w, h, draw, o = {}) => new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw, o), roughness: o.rough != null ? o.rough : .55 });
export const screenMat = (w, h, draw, intensity = 1.4) => {
  const map = canvasTex(w, h, draw);
  return new THREE.MeshStandardMaterial({ color: '#000000', roughness: .25, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: intensity });
};

// ---------------------------------------------------------------- matrices
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export const M = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => {
  _e.set(rx, ry, rz, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
};
// una pieza: geometria + material + transformacion local
export const part = (geo, m, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => ({ geo, mat: m, m: M(x, y, z, ry, sx, sy, sz, rx, rz) });

// junta todo lo repetido en InstancedMesh para que la tarjeta grafica no sufra
export class Batch {
  constructor() { this.items = new Map(); }
  add(geo, m, matrix, o) {
    const key = geo.uuid + '|' + m.uuid + '|' + (o && o.noCast ? 'n' : 'c');
    let it = this.items.get(key);
    if (!it) { it = { geo, mat: m, list: [], noCast: !!(o && o.noCast) }; this.items.set(key, it); }
    it.list.push(matrix);
  }
  place(parts, T, o) { const tmp = T || new THREE.Matrix4(); for (const p of parts) this.add(p.geo, p.mat, new THREE.Matrix4().multiplyMatrices(tmp, p.m), o); }
  // lo pequeno se funde en una sola malla por material (menos llamadas de dibujo); lo pesado queda instanciado
  build(parent) {
    const finish = (mesh, it) => {
      const clear = it.mat.transparent;
      mesh.castShadow = !it.noCast && !clear; mesh.receiveShadow = !clear;
      if (clear) mesh.userData.noAO = true;
      parent.add(mesh);
    };
    const merged = new Map();
    for (const it of this.items.values()) {
      const tris = (it.geo.index ? it.geo.index.count : it.geo.attributes.position.count) / 3;
      if (tris <= 3000) { const k = it.mat.uuid + (it.noCast ? 'n' : 'c'); if (!merged.has(k)) merged.set(k, { mat: it.mat, noCast: it.noCast, list: [] }); merged.get(k).list.push(it); continue; }
      let mesh;
      if (it.list.length === 1) { mesh = new THREE.Mesh(it.geo, it.mat); mesh.matrixAutoUpdate = false; mesh.matrix.copy(it.list[0]); }
      else { mesh = new THREE.InstancedMesh(it.geo, it.mat, it.list.length); it.list.forEach((mm, i) => mesh.setMatrixAt(i, mm)); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
      finish(mesh, it);
    }
    for (const group of merged.values()) {
      const geos = [];
      for (const it of group.list) {
        const base = it.geo.index ? it.geo.toNonIndexed() : it.geo;
        for (const mm of it.list) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', base.attributes.position.clone());
          if (base.attributes.normal) g.setAttribute('normal', base.attributes.normal.clone());
          g.setAttribute('uv', base.attributes.uv ? base.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 2), 2));
          g.applyMatrix4(mm);
          geos.push(g);
        }
      }
      if (!geos.length) continue;
      const g = geos.length > 1 ? mergeGeometries(geos) : geos[0];
      if (!g) continue;
      finish(new THREE.Mesh(g, group.mat), group);
    }
    this.items.clear();
  }
}

// ---------------------------------------------------------------- modelos de Poly Haven
const models = new Map();
const gltf = new GLTFLoader();
export function loadModels(ids, onProgress) {
  let done = 0;
  return Promise.all(ids.map((id) => new Promise((resolve) => {
    gltf.load(`${ASSETS}/models/${id}/${id}.gltf`, (g) => {
      g.scene.updateMatrixWorld(true);
      const parts = [], bb = new THREE.Box3();
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.map) m.map.anisotropy = maxAniso;
        // algunas hojas y papeles traen alfa recortado
        if (m.transparent || m.alphaTest > 0) { m.transparent = false; m.alphaTest = Math.max(m.alphaTest, .4); }
        parts.push({ geo: o.geometry, mat: m, m: o.matrixWorld.clone() });
        o.geometry.computeBoundingBox();
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      models.set(id, { parts, bb });
      onProgress && onProgress(++done, ids.length, id);
      resolve();
    }, undefined, (e) => { console.warn('modelo no cargo', id, e); onProgress && onProgress(++done, ids.length, id); resolve(); });
  })));
}
// piezas del modelo con el origen en el centro de su base; opcional recolorear
export function model(id, o = {}) {
  const md = models.get(id); if (!md) return [];
  const c = md.bb.getCenter(new THREE.Vector3());
  const off = M(-c.x, -md.bb.min.y, -c.z);
  return md.parts.map((p) => {
    let m2 = p.mat;
    if (o.tint) { m2 = p.mat.clone(); m2.color.set(o.tint); }
    return { geo: p.geo, mat: m2, m: new THREE.Matrix4().multiplyMatrices(off, p.m) };
  });
}
export const modelSize = (id) => { const md = models.get(id); return md ? md.bb.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1); };
// escala para que el modelo mida esas dimensiones (null = conserva proporcion)
export function fitScale(id, w, h, d) {
  const s = modelSize(id);
  const u = w ? w / s.x : (h ? h / s.y : d / s.z);
  return [w ? w / s.x : u, h ? h / s.y : u, d ? d / s.z : u];
}

// ---------------------------------------------------------------- utilidades de canvas
export function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function wrap(c, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  if (line) c.fillText(line, x, yy);
  return yy + lh;
}
export const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
