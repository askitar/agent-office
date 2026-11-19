// Personajes hechos con codigo: cabeza esculpida, ojos con parpados, pelo por estilos, ropa con textura y esqueleto articulado.
import { THREE, mergeGeometries, rbox, cyl, sph, seeded, ASSETS, canvasTex } from './kit.js';
import { heldItem } from './props.js';

import { PI, smoothstep, noise3, paint, mergeAll, tf, loft, strand } from './geom.js';
import { buildBody } from './body.js';

// ---------------------------------------------------------------- cabeza
const HR = .118;
const bump = (x, y, z, cx, cy, cz, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (2 * s * s));
function headGeo(f, skin) {
  const g = new THREE.SphereGeometry(HR, 56, 40), p = g.attributes.position, n = new THREE.Vector3();
  const base = new THREE.Color(skin), blush = base.clone().lerp(new THREE.Color('#d9583f'), .5), shade = base.clone().multiplyScalar(.82);
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    y *= f.long; z *= .97;
    if (y < .02) { const k = 1 + (y - .02) * f.jaw; x *= k; z *= 1 + (y - .02) * .5; }
    let d = 0;
    d += .043 * f.nose * bump(x, y, z, 0, -.014, .118, .0155);
    d += .021 * f.nose * bump(x, y, z, 0, .014, .113, .0105);
    d += .0095 * bump(x, y, z, .019, -.022, .108, .0088) + .0095 * bump(x, y, z, -.019, -.022, .108, .0088);
    d += .0125 * bump(x, y, z, .042, .045, .095, .019) + .0125 * bump(x, y, z, -.042, .045, .095, .019);
    d -= .017 * bump(x, y, z, .041, .022, .102, .0135) + .017 * bump(x, y, z, -.041, .022, .102, .0135);
    d += f.cheek * bump(x, y, z, .06, -.018, .085, .024) + f.cheek * bump(x, y, z, -.06, -.018, .085, .024);
    d += f.chin * bump(x, y, z, 0, -.104, .068, .023);
    d += .006 * bump(x, y, z, 0, -.044, .112, .015);
    d -= .004 * bump(x, y, z, 0, -.07, .106, .012);
    d += .0012 * (noise3(x * 90, y * 90, z * 90) - .5);
    n.set(x, y, z).normalize();
    p.setXYZ(i, x + n.x * d, y + n.y * d, z + n.z * d);
    const rosy = Math.min(1, .75 * bump(x, y, z, .062, -.02, .085, .028) + .75 * bump(x, y, z, -.062, -.02, .085, .028) + .55 * bump(x, y, z, 0, -.018, .125, .018));
    c.copy(base).lerp(blush, rosy * .55);
    c.lerp(shade, smoothstep(.015, -.11, y) * .3 * smoothstep(.05, .12, -z + .08));
    c.lerp(shade, Math.min(.5, .55 * bump(x, y, z, .041, .03, .1, .017) + .55 * bump(x, y, z, -.041, .03, .1, .017) + .28 * bump(x, y, z, 0, -.036, .112, .009)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
// casco de pelo: thick(dir) = grosor del pelo en esa direccion (0 = queda escondido bajo la piel)
function hairShell(f, thick, col, seed = 1) {
  const g = new THREE.SphereGeometry(HR * 1.005, 72, 54), p = g.attributes.position, d = new THREE.Vector3();
  const colors = new Float32Array(p.count * 3), c0 = new THREE.Color(col), c1 = c0.clone().multiplyScalar(.72), c2 = c0.clone().lerp(new THREE.Color('#ffffff'), .14), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const t = thick(d);
    const r = HR * (.9 + .1 * smoothstep(0, .0035, t)) + Math.max(0, t);
    let x = d.x * r, y = d.y * r * f.long, z = d.z * r * .97;
    if (y < .02) x *= 1 + (y - .02) * f.jaw * .4;
    p.setXYZ(i, x, y, z);
    const nn = noise3(d.x * 9 + seed, d.y * 20, d.z * 9);
    c.copy(c1).lerp(c0, smoothstep(.2, .55, nn)).lerp(c2, smoothstep(.6, .85, nn));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
function hairGeo(L, f, id) {
  const col = L.hair, c0 = new THREE.Color(col), R = seeded((id.charCodeAt(0) * 131 + id.length * 37) | 1), parts = [];
  const tint = () => '#' + c0.clone().multiplyScalar(.7 + R() * .5).getHexString();
  const line = (d, front, side, back) => {
    // altura del borde del pelo segun la direccion: adelante, a los lados y atras
    const fr = Math.max(0, d.z), bk = Math.max(0, -d.z), sd = Math.abs(d.x);
    return (front * fr + side * sd + back * bk) / Math.max(.001, fr + sd + bk);
  };
  const edge = (d, y0, soft = .1) => smoothstep(y0 - soft * .2, y0 + soft, d.y);
  const tufts = (n, len, spread, y0, thick = .0062) => {
    for (let i = 0; i < n; i++) {
      const a = R() * PI * 2, e = y0 + R() * (1 - y0), rad = Math.sqrt(Math.max(0, 1 - e * e));
      const dir = new THREE.Vector3(Math.sin(a) * rad, e, Math.cos(a) * rad);
      const o = dir.clone().multiplyScalar(HR * 1.02); o.y *= f.long;
      // caen hacia atras y a los lados siguiendo la curva de la cabeza
      const flow = new THREE.Vector3(dir.x * .8 + (R() - .5) * spread, -.25, dir.z - .55 + (R() - .5) * spread);
      flow.addScaledVector(dir, -flow.dot(dir)).normalize();
      const l = len * (.6 + R() * .8), lift = .006 + R() * .012 * spread;
      const p1 = o.clone().addScaledVector(flow, l * .5).addScaledVector(dir, lift);
      const p2 = o.clone().addScaledVector(flow, l).addScaledVector(dir, lift * .4 - .002);
      parts.push(strand([o, p1, p2], thick, .0012, tint(), 4, 3));
    }
  };
  switch (L.hs) {
    case 'slick':
      parts.push(hairShell(f, (d) => { const t = edge(d, line(d, .62, .0, -.5), .08); return t * (.0105 + .0022 * Math.sin(d.x * 26 + d.z * 8)); }, col));
      break;
    case 'short':
      parts.push(hairShell(f, (d) => edge(d, line(d, .55, -.02, -.55), .08) * (.012 + .004 * noise3(d.x * 8, d.y * 8, d.z * 8)), col));
      tufts(46, .03, .5, .5, .006);
      break;
    case 'bowl':
      parts.push(hairShell(f, (d) => edge(d, line(d, .34, -.2, -.58), .05) * (.0165 + .004 * Math.sin(d.x * 18 + d.y * 4)), col, 2));
      for (let i = 0; i < 24; i++) { const x = -.062 + i * .0054, s = Math.sign(x) || 1, o = new THREE.Vector3(x * .9, HR * .86, HR * .55); parts.push(strand([o, new THREE.Vector3(x * 1.2, HR * .66, HR * .9), new THREE.Vector3(x * 1.45 + s * .004, HR * .46, HR * 1.0)], .0052, .0012, tint(), 4, 3)); }
      break;
    case 'messy':
      parts.push(hairShell(f, (d) => edge(d, line(d, .5, -.05, -.55), .08) * (.015 + .012 * noise3(d.x * 7, d.y * 7, d.z * 7)), col, 3));
      tufts(130, .05, 1.1, .35, .0085);
      break;
    case 'long': case 'bob': {
      const bob = L.hs === 'bob';
      parts.push(hairShell(f, (d) => { const part = smoothstep(0, .07, Math.abs(d.x + (bob ? .18 : 0))); return edge(d, line(d, .6, -.42, -.95), .12) * (.013 + .004 * part + .003 * noise3(d.x * 8, d.y * 8, d.z * 8)); }, col, 4));
      const n = bob ? 150 : 190, end = bob ? -.1 : -.27;
      for (let i = 0; i < n; i++) {
        const a = -PI * .72 + R() * PI * 1.44, sa = Math.sin(a), ca = Math.cos(a);
        const o = new THREE.Vector3(sa * HR * .99, HR * (.3 + R() * .55), -ca * HR * .96);
        const y1 = end - R() * .05 - Math.abs(ca) * (bob ? 0 : .02), w = 1.08 + R() * .1;
        parts.push(strand([o, new THREE.Vector3(sa * HR * 1.12, HR * .1, -ca * HR * 1.1), new THREE.Vector3(sa * HR * 1.15 * w, y1 * .55, -ca * HR * 1.14 * w), new THREE.Vector3(sa * HR * 1.05 * w, y1, -ca * HR * 1.08 * w)], .0072, .0022, tint(), 4, 5));
      }
      break;
    }
    case 'bun': {
      parts.push(hairShell(f, (d) => edge(d, line(d, .62, -.1, -.6), .05) * (.0078 + .0014 * Math.sin(d.y * 42)), col, 5));
      const bun = new THREE.IcosahedronGeometry(.044, 2), p = bun.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 + .08 * Math.sin(p.getX(i) * 120 + p.getY(i) * 90); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      bun.computeVertexNormals(); parts.push(paint(tf(bun, 0, HR * .92 * f.long, -HR * .62), col));
      break;
    }
    case 'quiff':
      parts.push(hairShell(f, (d) => { const fr = bump(d.x, d.y, d.z, 0, .62, .72, .34); return edge(d, line(d, .58, -.02, -.5), .07) * (.0105 + .027 * fr + .002 * Math.sin(d.x * 22)); }, col, 6));
      tufts(34, .03, .4, .62, .006);
      break;
    case 'thin':
      parts.push(hairShell(f, (d) => { const top = smoothstep(.58, .4, d.y); return edge(d, line(d, .75, -.1, -.55), .06) * (.0052 + .0018 * top * 3) * (.35 + .65 * top); }, col, 7));
      tufts(22, .03, .8, .7, .0032);
      break;
    case 'curly': {
      parts.push(hairShell(f, (d) => edge(d, line(d, .46, -.32, -.7), .08) * .016, col, 8));
      const ball = new THREE.IcosahedronGeometry(.017, 1);
      for (let i = 0; i < 210; i++) {
        const a = R() * PI * 2, e = -.45 + R() * 1.42, rad = Math.sqrt(Math.max(0, 1 - e * e));
        const d = new THREE.Vector3(Math.sin(a) * rad, e, Math.cos(a) * rad);
        if (d.z > .55 && d.y < .5) continue;
        const r = HR * (1.1 + R() * .14);
        parts.push(paint(tf(ball, d.x * r, d.y * r * f.long, d.z * r * .97, R() * 3, R() * 3, 0, .8 + R() * .55), tint()));
      }
      break;
    }
    case 'wild':
      parts.push(hairShell(f, (d) => { const top = smoothstep(.62, .4, d.y); return edge(d, line(d, .75, -.32, -.72), .07) * (.004 + .012 * top + .007 * noise3(d.x * 9, d.y * 9, d.z * 9)); }, col, 9));
      for (let i = 0; i < 90; i++) { const a = R() * PI * 2, e = -.4 + R() * .85, rad = Math.sqrt(1 - e * e), d = new THREE.Vector3(Math.sin(a) * rad, e, Math.cos(a) * rad); if (d.z > .3) continue; const o = d.clone().multiplyScalar(HR * .98); const q = d.clone().add(new THREE.Vector3((R() - .5) * .9, R() * .7 - .1, (R() - .5) * .9)); parts.push(strand([o, o.clone().addScaledVector(q, .022), o.clone().addScaledVector(q, .04 + R() * .025).add(new THREE.Vector3(0, -.012, 0))], .0062, .0014, tint(), 4, 3)); }
      break;
    case 'bald':
      parts.push(hairShell(f, (d) => { const band = smoothstep(.2, .1, d.y) * smoothstep(-.45, -.3, d.y) * smoothstep(.5, .1, d.z); return band * .0022; }, col, 10));
      break;
    default: break;
  }
  return parts.length ? mergeAll(parts) : null;
}

// ---------------------------------------------------------------- ropa y piel
const clothCache = new Map();
const texLoader = new THREE.TextureLoader();
function clothMat(kind, skinTone) {
  const key = kind; if (clothCache.has(key)) return clothCache.get(key);
  const id = kind === 'suit' ? 'caban' : (kind === 'denim' ? 'denim_fabric_03' : 'cotton_jersey');
  const nor = texLoader.load(`${ASSETS}/tex/${id}/nor.jpg`), rough = texLoader.load(`${ASSETS}/tex/${id}/rough.jpg`);
  nor.wrapS = nor.wrapT = rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, normalMap: nor, roughnessMap: rough, roughness: kind === 'suit' ? 1 : .95, normalScale: new THREE.Vector2(.6, .6), envMapIntensity: .55 });
  clothCache.set(key, m); return m;
}
const skinNoise = (() => { let t = null; return () => {
  if (t) return t;
  t = canvasTex(256, 256, (c, w) => { const r = seeded(13); c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { const v = 228 + r() * 27; c.fillStyle = `rgba(${v},${v - 5},${v - 9},${.1 + r() * .12})`; c.beginPath(); c.arc(r() * w, r() * w, .6 + r() * 1.6, 0, 7); c.fill(); } }, { repeat: true });
  return t;
}; })();
const skinMat = () => { let m = skinMat._m; if (!m) { m = skinMat._m = new THREE.MeshStandardMaterial({ vertexColors: true, map: skinNoise(), roughness: .52, envMapIntensity: .75 }); } return m; };
const hairMat = (() => { let m = null; return () => (m = m || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .48, metalness: .05, envMapIntensity: .9 })); })();
const plainV = (() => { const c = new Map(); return (rough, metal = 0) => { const k = rough + '|' + metal; if (!c.has(k)) c.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal })); return c.get(k); }; })();

// ---------------------------------------------------------------- reparto
export const LOOKS = {
  michael:  { skin: '#eebd98', hair: '#5f4128', hs: 'slick', jacket: '#272e43', shirt: '#f2f2ee', tie: '#b3202b', pants: '#272e43', suit: 1, face: { long: 1.13, jaw: .95, nose: 1.15, chin: .012, cheek: .006, smile: .8 }, h: 1.02 },
  jan:      { skin: '#efc6a4', hair: '#2d1b12', hs: 'bob', jacket: '#232330', shirt: '#b98ad8', skirt: '#232330', female: 1, suit: 1, face: { long: 1.08, jaw: 1.25, nose: .8, chin: .006, cheek: .008, smile: .1 }, h: .98 },
  dwight:   { skin: '#ecc096', hair: '#46301e', hs: 'bowl', shirt: '#c7a02b', tie: '#5b3a1e', pants: '#685838', glasses: 1, short: 1, pens: 1, face: { long: 1.12, jaw: .7, nose: 1.1, chin: .012, cheek: .005, smile: -.2 }, h: 1.03 },
  jim:      { skin: '#ecc29c', hair: '#6d4a2b', hs: 'messy', shirt: '#6587ae', tie: '#2a3852', pants: '#383e47', lanyard: 1, face: { long: 1.15, jaw: 1.1, nose: 1, chin: .008, cheek: .006, smile: .75 }, h: 1.07 },
  pam:      { skin: '#f2cdb0', hair: '#a95c2a', hs: 'long', shirt: '#e8a6bb', jacket: '#d98ba6', skirt: '#5f6580', female: 1, cardigan: 1, face: { long: 1.04, jaw: 1.2, nose: .8, chin: .005, cheek: .012, smile: .7 }, h: .95 },
  ryan:     { skin: '#d6a57a', hair: '#1f1917', hs: 'quiff', jacket: '#1d2230', shirt: '#ececec', tie: '#101010', pants: '#1d2230', suit: 1, slim: 1, face: { long: 1.1, jaw: 1.25, nose: .9, chin: .007, cheek: .008, smile: .1 }, h: 1.0 },
  angela:   { skin: '#f4d1b4', hair: '#e2c873', hs: 'bun', shirt: '#f1e7d6', jacket: '#a892c4', skirt: '#6f638a', female: 1, cardigan: 1, face: { long: 1.02, jaw: 1.35, nose: .75, chin: .005, cheek: .006, smile: -.3 }, h: .88 },
  kelly:    { skin: '#c28a5c', hair: '#1b1310', hs: 'long', shirt: '#e4577a', skirt: '#2b2b38', female: 1, face: { long: 1.05, jaw: 1.2, nose: .85, chin: .005, cheek: .012, smile: .9 }, h: .93 },
  andy:     { skin: '#f0c7a4', hair: '#b4502a', hs: 'short', shirt: '#f1f0ea', jacket: '#2d6e4f', tie: '#c9a227', pants: '#c7b184', vest: 1, face: { long: 1.08, jaw: 1, nose: 1, chin: .012, cheek: .01, smile: .9 }, h: 1.01 },
  erin:     { skin: '#f3cfae', hair: '#b4562c', hs: 'long', shirt: '#f2d04a', skirt: '#47577a', female: 1, face: { long: 1.03, jaw: 1.25, nose: .75, chin: .004, cheek: .012, smile: 1 }, h: .94 },
  kevin:    { skin: '#e7bd96', hair: '#3a291b', hs: 'thin', shirt: '#8a8f99', tie: '#4a4e59', pants: '#41454f', wide: 1, face: { long: 1.02, jaw: .45, nose: 1.05, chin: .014, cheek: .018, smile: .3 }, h: 1.02 },
  toby:     { skin: '#efc6a0', hair: '#7d6a4a', hs: 'thin', shirt: '#b39a74', tie: '#6a5a40', pants: '#4b4638', glasses: 0, face: { long: 1.1, jaw: .85, nose: 1.05, chin: .007, cheek: .004, smile: -.1 }, h: .98 },
  phyllis:  { skin: '#f0ceb0', hair: '#9b9ba6', hs: 'curly', shirt: '#ece4f2', jacket: '#8c5cae', skirt: '#463c58', female: 1, cardigan: 1, wide: .6, face: { long: 1, jaw: .8, nose: .9, chin: .008, cheek: .016, smile: .8 }, h: .9 },
  stanley:  { skin: '#7f5236', hair: '#16130f', hs: 'bald', shirt: '#dedcd4', jacket: '#6f4d3a', tie: '#7f2a2a', pants: '#44474f', stache: 1, wide: 1, vest: 1, face: { long: 1.05, jaw: .55, nose: 1.15, chin: .012, cheek: .016, smile: -.4 }, h: 1.0 },
  creed:    { skin: '#e4c09e', hair: '#ccd0d4', hs: 'wild', jacket: '#58663a', shirt: '#d8d3c4', pants: '#48483a', face: { long: 1.14, jaw: 1, nose: 1.2, chin: .01, cheek: .003, smile: .3 }, h: .98 },
  meredith: { skin: '#efc6a0', hair: '#bb4628', hs: 'curly', shirt: '#2e2a36', skirt: '#3a3446', female: 1, face: { long: 1.06, jaw: 1, nose: 1, chin: .007, cheek: .008, smile: .5 }, h: .93 },
  darryl:   { skin: '#774a30', hair: '#120f0e', hs: 'short', shirt: '#3a6fb0', pants: '#37373f', face: { long: 1.1, jaw: .8, nose: 1.05, chin: .01, cheek: .008, smile: .3 }, h: 1.07 },
  gabe:     { skin: '#f1d1b4', hair: '#262636', hs: 'quiff', shirt: '#5b5fc7', tie: '#e0e0e0', pants: '#2c2f44', slim: 1, face: { long: 1.14, jaw: 1.3, nose: .9, chin: .006, cheek: .004, smile: .2 }, h: 1.03 },
  holly:    { skin: '#efc6a0', hair: '#d4a447', hs: 'long', shirt: '#d46a6a', skirt: '#57486a', female: 1, face: { long: 1.05, jaw: 1.2, nose: .85, chin: .005, cheek: .012, smile: 1 }, h: .94 },
  pete:     { skin: '#deb189', hair: '#39281a', hs: 'short', shirt: '#4a6a5a', pants: '#39393b', glasses: 1, face: { long: 1.08, jaw: 1, nose: 1, chin: .008, cheek: .007, smile: .3 }, h: 1.0 },
  clark:    { skin: '#cf9e6e', hair: '#222222', hs: 'short', shirt: '#7a7a8a', pants: '#3a3d4a', face: { long: 1.08, jaw: 1.15, nose: .95, chin: .007, cheek: .007, smile: .4 }, h: 1.0 },
  nellie:   { skin: '#f4d1b4', hair: '#85462a', hs: 'bun', shirt: '#2a8a8a', skirt: '#2a3a4a', female: 1, face: { long: 1.06, jaw: 1.2, nose: .95, chin: .007, cheek: .007, smile: .1 }, h: .95 },
  roy:      { skin: '#e7bd96', hair: '#573e2e', hs: 'short', shirt: '#6a6a6a', pants: '#34363e', wide: .7, face: { long: 1.05, jaw: .7, nose: 1, chin: .012, cheek: .01, smile: .2 }, h: 1.05 },
  hide:     { skin: '#e6c6a0', hair: '#111111', hs: 'bowl', shirt: '#c85a5a', pants: '#2a2a34', glasses: 1, face: { long: 1.06, jaw: 1.1, nose: .9, chin: .006, cheek: .006, smile: .4 }, h: .96 },
  jo:       { skin: '#a6714a', hair: '#222222', hs: 'curly', shirt: '#e8e0b0', skirt: '#3a5a4a', female: 1, face: { long: 1.05, jaw: 1, nose: 1, chin: .007, cheek: .01, smile: .5 }, h: .95 },
  wally:    { skin: '#efc6a0', hair: '#9a9a9a', hs: 'thin', jacket: '#555566', shirt: '#eeeeee', tie: '#333366', pants: '#555566', suit: 1, face: { long: 1.08, jaw: .9, nose: 1.05, chin: .008, cheek: .005, smile: .1 }, h: .97 },
};

// ---------------------------------------------------------------- figura
const POSES = {
  stand: { hip: .93, lean: .01, th: [0, 0], kn: [0, 0], sh: [[.04, .075], [.04, .075]], el: [-.2, -.2], head: 0, tilt: 0, roll: 0 },
  sit: { hip: .55, lean: -.03, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-.32, .05], [-.32, .05]], el: [-1.05, -1.05], head: .03, tilt: 0, roll: 0 },
  type: { hip: .55, lean: .07, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-.56, -.03], [-.56, -.03]], el: [-.98, -.98], head: .1, tilt: 0, roll: 0 },
  wait: { hip: .55, lean: -.02, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-.3, .05], [-.2, .24]], el: [-1.05, -2.2], head: .02, tilt: 0, roll: 0 },
  sleepSit: { hip: .55, lean: -.14, th: [-1.45, -1.45], kn: [1.45, 1.45], sh: [[-.2, .1], [-.2, .1]], el: [-.9, -.9], head: .55, tilt: 0, roll: .25 },
  sleepDesk: { hip: .55, lean: .78, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-1.5, -.1], [-1.5, -.1]], el: [-1.25, -1.25], head: .36, tilt: 0, roll: .55 },
  lie: { hip: .62, lean: 0, th: [-.1, -.32], kn: [.15, .6], sh: [[-.45, -.14], [-.45, -.14]], el: [-1.75, -1.75], head: .16, tilt: -PI / 2, roll: .25 },
  fall: { hip: .13, lean: .05, th: [.12, -.2], kn: [.3, .5], sh: [[-2.75, .4], [-2.5, .5]], el: [-.3, -.5], head: -.4, tilt: PI / 2, roll: .3 },
  eat: { hip: .55, lean: .03, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-.42, .02], [-.42, .02]], el: [-1.2, -1.2], head: .06, tilt: 0, roll: 0 },
  drink: { hip: .55, lean: -.02, th: [-1.5, -1.5], kn: [1.5, 1.5], sh: [[-.32, .05], [-.42, .02]], el: [-1.05, -1.2], head: 0, tilt: 0, roll: 0 },
  eatStand: { hip: .93, lean: .02, th: [0, 0], kn: [0, 0], sh: [[.04, .075], [-.42, .02]], el: [-.2, -1.2], head: .05, tilt: 0, roll: 0 },
  drinkStand: { hip: .93, lean: 0, th: [0, 0], kn: [0, 0], sh: [[.04, .075], [-.42, .02]], el: [-.2, -1.2], head: 0, tilt: 0, roll: 0 },
  deliver: { hip: .93, lean: .03, th: [0, 0], kn: [0, 0], sh: [[.04, .075], [-.75, .05]], el: [-.2, -1.1], head: .04, tilt: 0, roll: 0 },
  cheer: { hip: .93, lean: 0, th: [0, 0], kn: [0, 0], sh: [[-2.9, .24], [-2.9, .24]], el: [-.35, -.35], head: -.14, tilt: 0, roll: 0 },
  wave: { hip: .93, lean: 0, th: [0, 0], kn: [0, 0], sh: [[.04, .075], [-2.6, .3]], el: [-.2, -.5], head: -.05, tilt: 0, roll: 0 },
};
const SKIP_SHADOW = new Set(['eye', 'lid', 'brow', 'mouth']);

export class Figure {
  constructor(id) {
    this.id = id;
    const L = this.L = LOOKS[id] || LOOKS.kevin;
    const F = Object.assign({ long: 1.08, jaw: 1, nose: 1, chin: .008, cheek: .008, smile: .3 }, L.face);
    const fem = !!L.female, skinC = L.skin;
    const skin = skinMat(), hairM = hairMat();
    const root = this.root = new THREE.Group();
    const scale = this.scale = (L.h || 1) * .97;
    const tilt = this.tilt = new THREE.Group(); root.add(tilt); tilt.scale.setScalar(scale);
    const addMesh = (parent, geo, m, name) => { const o = new THREE.Mesh(geo, m); o.castShadow = !SKIP_SHADOW.has(name); o.receiveShadow = true; parent.add(o); return o; };
    // cuerpo continuo con esqueleto: se dobla suave en codos, rodillas, cintura y hombros
    const body = buildBody(L, clothMat(L.suit ? 'suit' : 'cotton'));
    tilt.add(body.hips); tilt.add(body.mesh);
    tilt.updateMatrixWorld(true);
    body.mesh.bind(body.skeleton);
    this.body = body.mesh;
    this.hips = body.hips; this.spine = body.spine1; this.spine2 = body.spine2; this.neck = body.neck; this.head = body.head;
    const hc = this.hc = new THREE.Group(); hc.position.y = .062 * F.long; this.head.add(hc);
    hc.scale.setScalar(1.13);
    addMesh(hc, headGeo(F, skinC), skin);
    // orejas
    const ear = paint(new THREE.SphereGeometry(.024, 10, 8), skinC);
    const earG = mergeAll([tf(ear, HR * .985, -.006, -.006, 0, 0, 0, .34, .85, .6), tf(ear, -HR * .985, -.006, -.006, 0, 0, 0, .34, .85, .6)]);
    addMesh(hc, earG, skin);
    // ojos
    const eyeCol = L.eye || (/^#[0-9a-f]{2}/.test(L.skin) && L.hs === 'long' ? '#5a7a4a' : '#5b3b22');
    const eyeG = mergeAll([paint(new THREE.SphereGeometry(.0186, 18, 14), '#f6f4ef'), paint(tf(new THREE.SphereGeometry(.0112, 16, 10), 0, 0, .0112, 0, 0, 0, 1, 1, .52), eyeCol), paint(tf(new THREE.SphereGeometry(.006, 12, 8), 0, 0, .0168, 0, 0, 0, 1, 1, .4), '#0b0b0e')]);
    const eyeM = plainV(.1); const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * .041, .021, .0965); hc.add(e);
      addMesh(e, eyeG, eyeM, 'eye');
      const gl = new THREE.Mesh(new THREE.SphereGeometry(.0028, 6, 5), glint); gl.position.set(.0048, .0056, .0167); e.add(gl);
      this.eyes.push(e);
    }
    const lidCol = new THREE.Color(skinC).multiplyScalar(.93).getHexString();
    const lidG = paint(new THREE.SphereGeometry(.0202, 16, 8, 0, PI * 2, 0, PI / 2), '#' + lidCol);
    this.lids = [];
    for (const s of [-1, 1]) {
      const up = new THREE.Group(); up.position.set(s * .041, .021, .0965); hc.add(up);
      addMesh(up, lidG, skin, 'lid');
      const lo = new THREE.Group(); lo.position.copy(up.position); lo.rotation.x = PI + .62; hc.add(lo);
      addMesh(lo, lidG, skin, 'lid');
      this.lids.push(up);
    }
    // cejas
    this.brows = [];
    const browG = (s) => strand([new THREE.Vector3(-s * .021, -.003, -.004), new THREE.Vector3(-s * .004, .005, .0015), new THREE.Vector3(s * .022, .001, -.006)], .0058, .0032, L.hair, 5, 6);
    for (const s of [-1, 1]) {
      const b = new THREE.Group(); b.position.set(s * .043, .0555, .1045); hc.add(b);
      addMesh(b, browG(s), hairM, 'brow');
      this.brows.push(b);
    }
    // boca
    const mouth = this.mouth = new THREE.Group(); mouth.position.set(0, -.056, .1088); mouth.scale.setScalar(1.18); hc.add(mouth);
    const lipCol = '#' + new THREE.Color(skinC).lerp(new THREE.Color(fem ? '#b5403e' : '#a8553f'), fem ? .78 : .55).getHexString();
    const sm = F.smile;
    const inner = this.mouthInner = addMesh(mouth, paint(new THREE.SphereGeometry(.024, 14, 10), '#3a0f12'), plainV(.7), 'mouth');
    inner.scale.set(.82, .1, .32);
    const teeth = this.teeth = addMesh(mouth, paint(new THREE.BoxGeometry(.03, .008, .004), '#f4f2ea'), plainV(.35), 'mouth'); teeth.position.set(0, .003, .0065); teeth.visible = false;
    const uLip = strand([new THREE.Vector3(-.023, .003 + sm * .006, -.006), new THREE.Vector3(-.011, .0025, .0035), new THREE.Vector3(0, .0035, .0055), new THREE.Vector3(.011, .0025, .0035), new THREE.Vector3(.023, .003 + sm * .006, -.006)], .0032, .0032, lipCol, 5, 10);
    addMesh(mouth, uLip, plainV(.4), 'mouth');
    const loG = strand([new THREE.Vector3(-.021, .003 + sm * .006, -.006), new THREE.Vector3(-.009, -.0035, .0035), new THREE.Vector3(.009, -.0035, .0035), new THREE.Vector3(.021, .003 + sm * .006, -.006)], .0034, .0034, lipCol, 5, 8);
    const loLip = this.lowerLip = addMesh(mouth, loG, plainV(.4), 'mouth');
    // pelo, gafas y bigote
    const hg = hairGeo(L, F, id);
    if (hg) addMesh(hc, hg, hairM);
    if (L.glasses) {
      const fr = new THREE.MeshStandardMaterial({ color: '#17171b', roughness: .25, metalness: .35 });
      const lens = new THREE.MeshStandardMaterial({ color: '#dfeeff', roughness: .05, transparent: true, opacity: .16 });
      const parts = [];
      for (const s of [-1, 1]) {
        parts.push(tf(new THREE.TorusGeometry(.024, .0022, 6, 20), s * .043, .022, .116, 0, 0, 0, 1, .86, 1));
        const t = new THREE.CylinderGeometry(.0018, .0018, .105, 5); t.rotateX(PI / 2); parts.push(tf(t, s * .083, .024, .062, 0, s * .1));
      }
      const br = new THREE.CylinderGeometry(.0018, .0018, .022, 5); br.rotateZ(PI / 2); parts.push(tf(br, 0, .024, .118));
      addMesh(hc, mergeAll(parts), fr, 'lid');
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(.023, 18), lens); l.position.set(s * .043, .022, .1165); l.scale.y = .86; l.userData.noAO = true; hc.add(l); }
    }
    if (L.stache) {
      const pr = [];
      for (let i = 0; i < 60; i++) { const x = -.034 + i * .00115, top = -.03, dir = Math.sign(x) || 1; pr.push(strand([new THREE.Vector3(x * .7, top, .1135 - Math.abs(x) * .4), new THREE.Vector3(x, top - .012, .1145 - Math.abs(x) * .55), new THREE.Vector3(x * 1.16 + dir * .002, top - .022, .1085 - Math.abs(x) * .7)], .0022, .001, '#' + new THREE.Color(L.hair).multiplyScalar(.9 + (i % 5) * .2).getHexString(), 4, 3)); }
      addMesh(hc, mergeAll(pr), hairM, 'brow');
    }

    this.arm = body.arms; this.leg = body.legs;
    // sombra de contacto y aro de estado
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(.36, 20), blobMat()); this.blob.rotation.x = -PI / 2; this.blob.position.y = .012; this.blob.renderOrder = 2; root.add(this.blob);
    const ringM = new THREE.MeshBasicMaterial({ color: '#3b6bff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.3, .38, 40), ringM); this.ring.rotation.x = -PI / 2; this.ring.position.y = .016; this.ring.renderOrder = 3; this.ring.userData.noAO = true; root.add(this.ring);

    // estado de animacion
    const P0 = POSES.sit;
    this.cur = { hip: P0.hip, lean: P0.lean, th0: P0.th[0], th1: P0.th[1], kn0: P0.kn[0], kn1: P0.kn[1], sx0: P0.sh[0][0], sz0: P0.sh[0][1], sx1: P0.sh[1][0], sz1: P0.sh[1][1], el0: P0.el[0], el1: P0.el[1], head: P0.head, tilt: 0, roll: 0, walk: 0, run: 0, type: 0 };
    this.state = 'sit'; this.seatY = .55; this.phase = Math.random() * 6; this.t = Math.random() * 10;
    this.blinkIn = 1 + Math.random() * 4; this.blink = 0; this.glanceIn = 1; this.glance = [0, 0]; this.gaze = [0, 0];
    this.lookTarget = null; this.talking = false; this.mouthOpen = 0; this.gest = 0;
    this.heldKind = null; this.heldObj = null; this.speed = 0; this.bite = 0;
    this.expr = 0; this.ringTarget = 0; this.ringColor = new THREE.Color('#3b6bff');
    this.headHeight = (1.58 + .062 * F.long + HR * 1.13 * F.long) * scale;
    this.update(0);
  }
  hold(kind) {
    if (this.heldKind === kind) return;
    if (this.heldObj) this.arm[1].sock.remove(this.heldObj);
    this.heldObj = null; this.heldKind = kind;
    if (kind) { this.heldObj = heldItem(kind); this.arm[1].sock.add(this.heldObj); }
  }
  setRing(color, op) { this.ring.material.color.set(color); this.ringTarget = op; }
  update(dt) {
    this.t += dt;
    const t = this.t, c = this.cur, st = this.state;
    const P = POSES[st] || POSES.stand;
    const k = dt ? 1 - Math.exp(-dt * (st === 'fall' ? 16 : 7)) : 1;
    const seated = ['sit', 'type', 'wait', 'sleepSit', 'sleepDesk', 'eat', 'drink', 'talkSit'].includes(st);
    const hipT = (st === 'lie' ? (this.seatY + .06) / this.scale : (seated ? this.seatY / this.scale : P.hip));
    const lerp = (a, b) => a + (b - a) * k;
    c.hip = lerp(c.hip, st === 'walk' || st === 'run' ? .925 : hipT);
    c.lean = lerp(c.lean, st === 'run' ? .24 : (st === 'walk' ? .035 : (P.lean ?? 0)));
    for (let i = 0; i < 2; i++) {
      const moving = st === 'walk' || st === 'run';
      c['th' + i] = lerp(c['th' + i], moving ? 0 : (P.th ? P.th[i] : -1.5));
      c['kn' + i] = lerp(c['kn' + i], moving ? 0 : (P.kn ? P.kn[i] : 1.5));
      c['sx' + i] = lerp(c['sx' + i], moving ? .02 : (P.sh ? P.sh[i][0] : -.32));
      c['sz' + i] = lerp(c['sz' + i], moving ? .08 : (P.sh ? P.sh[i][1] : .05));
      c['el' + i] = lerp(c['el' + i], st === 'run' ? -1.45 : (st === 'walk' ? -.42 : (P.el ? P.el[i] : -1.05)));
    }
    c.head = lerp(c.head, P.head ?? 0);
    c.tilt = lerp(c.tilt, P.tilt ?? 0);
    c.roll = lerp(c.roll, P.roll ?? 0);
    c.walk = lerp(c.walk, st === 'walk' ? 1 : 0); c.run = lerp(c.run, st === 'run' ? 1 : 0); c.type = lerp(c.type, st === 'type' ? 1 : 0);
    // ciclo de caminar y correr
    const stride = c.run > .5 ? 1.75 : 1.2;
    this.phase += (this.speed / stride) * PI * 2 * dt;
    const ph = this.phase, sW = Math.sin(ph), cW = Math.cos(ph);
    const aTh = c.walk * .46 + c.run * .82, aKn = c.walk * .85 + c.run * 1.55, aArm = c.walk * .42 + c.run * .72;
    const th = [c.th0 + sW * aTh, c.th1 - sW * aTh];
    const kn = [c.kn0 + Math.max(0, Math.sin(ph - 1.15)) * aKn + c.walk * .06, c.kn1 + Math.max(0, Math.sin(ph + PI - 1.15)) * aKn + c.walk * .06];
    const bob = Math.abs(cW) * (c.walk * .022 + c.run * .05);
    // respiracion y balanceo de pie
    const standW = st === 'stand' || st === 'deliver' || st === 'wave' || st === 'eatStand' || st === 'drinkStand' ? 1 : 0;
    const breath = Math.sin(t * 1.5) * .006, sway = Math.sin(t * .55) * .012 * standW;
    // se gira alrededor de la cadera: asi al acostarse o caer el cuerpo queda donde debe
    this.tilt.position.y = (c.hip + bob - (standW ? .002 : 0) + breath * .3) * this.scale;
    this.hips.position.set(sway, 0, 0);
    this.tilt.rotation.x = c.tilt;
    this.hips.rotation.y = sW * (c.walk * .07 + c.run * .1);
    this.spine.rotation.x = (c.lean + breath * .5) * .55;
    this.spine2.rotation.x = (c.lean + breath * .5) * .45;
    this.spine.rotation.y = -sW * (c.walk * .06 + c.run * .1) + (c.type ? Math.sin(t * .7) * .008 : 0);
    this.spine2.rotation.y = -sW * (c.walk * .06 + c.run * .1);
    this.spine.rotation.z = sway * .5;
    this.spine2.scale.set(1 + breath * .22, 1, 1 + breath * .55);
    // brazos
    let sx = [c.sx0 - sW * aArm, c.sx1 + sW * aArm], el = [c.el0, c.el1], sz = [c.sz0, c.sz1];
    // tecleo: las manos se mueven distinto cada una
    const ty = c.type;
    if (ty > .01) { sx[0] += Math.sin(t * 13.1) * .022 * ty; sx[1] += Math.sin(t * 11.3 + 1) * .022 * ty; el[0] += Math.sin(t * 17) * .018 * ty; el[1] += Math.sin(t * 15 + 2) * .018 * ty; sz[0] += Math.sin(t * 2.3) * .02 * ty; sz[1] += Math.sin(t * 1.9) * .02 * ty; }
    // comer y tomar: la mano derecha sube a la boca
    if (st === 'eat' || st === 'drink' || st === 'eatStand' || st === 'drinkStand') {
      const period = st.startsWith('eat') ? 2.6 : 3.8, q = (t % period) / period, up = smoothstep(.1, .3, q) * smoothstep(.62, .42, q);
      this.bite = up;
      sx[1] = -.42 - up * .72; sz[1] = -.04 - up * .14 + .05; el[1] = -1.2 - up * 1.14;
    } else this.bite = 0;
    if (st === 'wave') { el[1] = -.5 + Math.sin(t * 8) * .35; sz[1] += Math.sin(t * 8) * .1; }
    if (st === 'cheer') { const j = Math.sin(t * 9); el[0] += j * .25; el[1] -= j * .25; }
    // gestos al hablar
    if (this.talking && (standW || seated) && !this.bite && st !== 'wave' && st !== 'deliver') {
      this.gest = lerp(this.gest, 1);
      const g = this.gest, g1 = noise3(t * 1.7, 3, 1), g2 = noise3(t * 1.3, 9, 7);
      sx[1] += -(.22 + g1 * .62) * g; el[1] += -(.3 + g2 * .95) * g; sz[1] += (g2 - .3) * .12 * g;
    } else this.gest = lerp(this.gest, 0);
    for (let i = 0; i < 2; i++) {
      const a = this.arm[i];
      a.sh.rotation.set(sx[i], 0, a.s * sz[i]);
      a.elbow.rotation.x = el[i];
      a.wr.rotation.x = st === 'type' ? .38 : -.05;
      const l = this.leg[i];
      l.th.rotation.x = th[i];
      l.th.rotation.z = (i ? -1 : 1) * ((c.tilt < -.5 ? .02 : .018) + (seated ? .05 : 0));
      l.kn.rotation.x = Math.max(0, kn[i]);
      l.ft.rotation.x = -(th[i] + Math.max(0, kn[i])) * (c.run > .5 ? .6 : .92) + (c.tilt > .6 ? .9 : 0);
    }
    // cabeza: mira a quien le habla, si no pasea la vista
    this.glanceIn -= dt;
    if (this.glanceIn <= 0) { this.glanceIn = 1.2 + Math.random() * 4.5; const big = Math.random() < .35; this.glance = [(Math.random() - .5) * (big ? 1.3 : .35), (Math.random() - .5) * (big ? .25 : .1)]; }
    let wy = this.glance[0] * (st === 'type' ? .22 : 1), wx = this.glance[1] * (st === 'type' ? .4 : 1);
    if (this.lookTarget) {
      this.root.updateWorldMatrix(true, false);
      const dx = this.lookTarget.x - this.root.position.x, dz = this.lookTarget.z - this.root.position.z;
      let a = Math.atan2(dx, dz) - this.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      wy = Math.max(-1.15, Math.min(1.15, a)); wx = 0;
    }
    const sleeping = st === 'lie' || st === 'sleepSit' || st === 'sleepDesk';
    if (sleeping) { wy = 0; wx = 0; }
    this.gaze[0] = lerp(this.gaze[0], wy); this.gaze[1] = lerp(this.gaze[1], wx);
    const nod = this.talking ? Math.sin(t * 7.5) * .03 : 0;
    this.neck.rotation.set((c.head + this.gaze[1] + nod) * .45, this.gaze[0] * .35, c.roll * .3);
    this.head.rotation.set((c.head + this.gaze[1] + nod) * .55, this.gaze[0] * .65, c.roll * .7);
    // ojos, parpados y boca
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blinkIn = 1.6 + Math.random() * 4.6; this.blink = .14; }
    let closed = 0;
    if (this.blink > 0) { this.blink -= dt; closed = Math.sin((1 - Math.max(0, this.blink) / .14) * PI); }
    if (sleeping || st === 'fall') closed = 1;
    const lid = -.27 + closed * 1.45;
    for (const u of this.lids) u.rotation.x = lid;
    const ey = Math.max(-.42, Math.min(.42, (wy - this.gaze[0]) * 1.4 + this.gaze[0] * .25)), ex = Math.max(-.24, Math.min(.24, wx * 1.2));
    for (const e of this.eyes) e.rotation.set(-ex, ey, 0);
    for (let i = 0; i < 2; i++) { const b = this.brows[i], s = i ? 1 : -1; b.position.y = .0555 + (this.talking ? Math.max(0, Math.sin(t * 3.1)) * .0035 : 0); b.rotation.z = s * (this.L.face && this.L.face.smile < 0 ? -.13 : .05); }
    let mo = 0;
    if (this.talking) mo = .22 + noise3(t * 9, 1, 1) * .78;
    if (this.bite > .6) mo = Math.max(mo, .75);
    if (st.startsWith('eat') && this.bite < .3) mo = Math.max(mo, Math.max(0, Math.sin(t * 13)) * .35);
    if (st === 'run') mo = Math.max(mo, .42);
    if (st === 'fall') mo = .85;
    this.mouthOpen = lerp(this.mouthOpen, mo);
    this.mouthInner.scale.y = .1 + this.mouthOpen * .55;
    this.mouthInner.position.y = -this.mouthOpen * .008;
    this.lowerLip.position.y = -this.mouthOpen * .0155;
    this.teeth.visible = this.mouthOpen > .25;
    // aro
    const rm = this.ring.material; rm.opacity += (this.ringTarget - rm.opacity) * (dt ? 1 - Math.exp(-dt * 7) : 1);
    this.ring.visible = rm.opacity > .01;
    this.blob.visible = c.tilt < .5 && c.tilt > -.5;
  }
}
const blobMat = (() => { let m = null; return () => {
  if (m) return m;
  const map = canvasTex(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(.55, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: '#ffffff' });
  return m;
}; })();
export const ALL_IDS = Object.keys(LOOKS);
