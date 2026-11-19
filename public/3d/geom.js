// Utilidades de geometria para los personajes.
import { THREE, mergeGeometries } from './kit.js';

export const PI = Math.PI;
export const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = x - xi, v = y - yi, w = z - zi;
  const f = (t) => t * t * (3 - 2 * t), a = f(u), b = f(v), c = f(w);
  const L = (p, q, t) => p + (q - p) * t;
  return L(L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), a), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), a), b),
    L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), a), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), a), b), c);
}

// ---------------------------------------------------------------- geometria auxiliar
export function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export function mergeAll(list) {
  const out = list.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) paint(g, '#ffffff');
    return g;
  });
  return mergeGeometries(out);
}
export const tf = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  const c = g.clone();
  c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  return c;
};
// superficie por anillos elipticos, suavizada a lo largo del eje Y
export function loft(rings, seg = 18, sub = 3, colorAt = null) {
  const R = [];
  const cat = (p0, p1, p2, p3, t) => .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[Math.max(0, i - 1)], b = rings[i], c = rings[i + 1], d = rings[Math.min(rings.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, f = (n, dv = 0) => cat(a[n] ?? dv, b[n] ?? dv, c[n] ?? dv, d[n] ?? dv, t);
      R.push({ y: f('y'), rx: Math.max(.0005, f('rx')), rz: Math.max(.0005, f('rz')), cx: f('cx'), cz: f('cz') });
    }
  }
  const l = rings[rings.length - 1]; R.push({ y: l.y, rx: l.rx, rz: l.rz, cx: l.cx || 0, cz: l.cz || 0 });
  const pos = [], uv = [], col = [], idx = [];
  let vTot = 0;
  for (let i = 0; i < R.length; i++) {
    const r = R[i];
    if (i) vTot += Math.abs(r.y - R[i - 1].y);
    const circ = 2 * PI * Math.sqrt((r.rx * r.rx + r.rz * r.rz) / 2);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * PI * 2, x = r.cx + Math.sin(a) * r.rx, z = r.cz + Math.cos(a) * r.rz;
      pos.push(x, r.y, z); uv.push(j / seg * circ / .22, vTot / .22);
      if (colorAt) { const c = colorAt(x, r.y, z); col.push(c.r, c.g, c.b); }
    }
  }
  const row = seg + 1;
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // tapas
  const cap = (ri, flip) => {
    const r = R[ri], ci = pos.length / 3; pos.push(r.cx, r.y, r.cz); uv.push(0, 0);
    if (colorAt) { const c = colorAt(r.cx, r.y, r.cz); col.push(c.r, c.g, c.b); }
    for (let j = 0; j < seg; j++) { const a = ri * row + j, b = a + 1; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  cap(0, false); cap(R.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function limb(len, r0, r1, bulge = 0, pos = .4, flat = 1) {
  return loft([
    { y: .012, rx: r0 * .92, rz: r0 * .92 * flat }, { y: -len * .12, rx: r0, rz: r0 * flat }, { y: -len * pos, rx: (r0 + r1) / 2 + bulge, rz: ((r0 + r1) / 2 + bulge) * flat },
    { y: -len * .85, rx: r1 * 1.02, rz: r1 * 1.02 * flat }, { y: -len, rx: r1, rz: r1 * flat }, { y: -len - .01, rx: r1 * .8, rz: r1 * .8 * flat },
  ], 12, 2);
}
export function strand(pts, r0, r1, color, radial = 5, seg = 6) {
  const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const per = radial + 1;
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c); const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j < per; j++) { const k = i * per + j; v.fromBufferAttribute(p, k).sub(c).normalize().multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return paint(g, color);
}

