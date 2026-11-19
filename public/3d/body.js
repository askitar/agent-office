// Cuerpo continuo con esqueleto. Todo va en una sola malla con color por vertice: torso, piernas, brazos, manos, zapatos,
// corbata, solapas y falda. En reposo el personaje mide 1.58 m hasta la base de la cabeza, con los brazos colgando.
import { THREE, rbox } from './kit.js';
import { PI, smoothstep, paint, mergeAll, tf, loft, strand } from './geom.js';

const BONES = ['hips', 'spine1', 'spine2', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'thL', 'knL', 'ftL', 'thR', 'knR', 'ftR'];
const IX = Object.fromEntries(BONES.map((n, i) => [n, i]));

// asigna huesos a cada vertice: fn(x, y, z) devuelve [[hueso, peso], ...]
function skin(g, fn) {
  const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const list = typeof fn === 'string' ? [[fn, 1]] : fn(p.getX(i), p.getY(i), p.getZ(i));
    let tot = 0; for (const q of list) tot += q[1];
    list.slice(0, 4).forEach((q, k) => { si[i * 4 + k] = IX[q[0]]; sw[i * 4 + k] = q[1] / (tot || 1); });
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}
const blend = (a, b, t) => (t <= 0 ? [[a, 1]] : (t >= 1 ? [[b, 1]] : [[a, 1 - t], [b, t]]));

function torsoRings(L) {
  const w = L.wide || 0, sl = L.slim ? .94 : 1;
  if (L.female) return [
    { y: .78, rx: .06, rz: .05 }, { y: .84, rx: .13, rz: .08 }, { y: .875, rx: .156 + w * .02, rz: .1 + w * .02 }, { y: .93, rx: .162 + w * .03, rz: .11 + w * .03, cz: -.004 }, { y: .99, rx: .14 + w * .04, rz: .094 + w * .05 }, { y: 1.07, rx: .122 + w * .05, rz: .085 + w * .06, cz: w * .015 },
    { y: 1.15, rx: .124 + w * .04, rz: .088 + w * .05, cz: w * .012 }, { y: 1.24, rx: .138 + w * .02, rz: .106 + w * .02, cz: .012 }, { y: 1.31, rx: .146, rz: .108, cz: .012 }, { y: 1.37, rx: .15, rz: .09, cz: .002 },
    { y: 1.415, rx: .13, rz: .068 }, { y: 1.45, rx: .07, rz: .054 }, { y: 1.485, rx: .05, rz: .047 }, { y: 1.53, rx: .044, rz: .043 }, { y: 1.6, rx: .043, rz: .043 },
  ];
  return [
    { y: .78, rx: .06, rz: .05 }, { y: .84, rx: .125, rz: .08 }, { y: .875, rx: .153 * sl + w * .02, rz: .098 + w * .025 }, { y: .93, rx: .156 * sl + w * .035, rz: .106 + w * .04, cz: w * .01 }, { y: 1.0, rx: .147 * sl + w * .05, rz: .1 + w * .07, cz: w * .03 }, { y: 1.08, rx: .15 * sl + w * .055, rz: .103 + w * .08, cz: w * .035 },
    { y: 1.17, rx: .162 * sl + w * .04, rz: .11 + w * .055, cz: w * .02 }, { y: 1.26, rx: .176 * sl + w * .02, rz: .116 + w * .025, cz: .004 }, { y: 1.34, rx: .182 * sl + w * .008, rz: .112 }, { y: 1.395, rx: .176 * sl, rz: .092 },
    { y: 1.43, rx: .135, rz: .072 }, { y: 1.46, rx: .078, rz: .06 }, { y: 1.49, rx: .058, rz: .052 }, { y: 1.53, rx: .05, rz: .048 }, { y: 1.6, rx: .049, rz: .048 },
  ];
}
// misma interpolacion del loft: da el anillo exacto a cualquier altura
function ringAt(rings, y) {
  const cat = (p0, p1, p2, p3, t) => .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < rings.length - 1; i++) {
    const b = rings[i], c = rings[i + 1];
    if (y >= b.y && y <= c.y) {
      const a = rings[Math.max(0, i - 1)], d = rings[Math.min(rings.length - 1, i + 2)];
      let t = (y - b.y) / (c.y - b.y);
      const f = (n) => cat(a[n] || 0, b[n] || 0, c[n] || 0, d[n] || 0, t);
      return { rx: f('rx'), rz: f('rz'), cz: f('cz') };
    }
  }
  return { rx: .1, rz: .1, cz: 0 };
}
function surfZ(rings, x, y) { const r = ringAt(rings, y), q = Math.min(.98, Math.abs(x) / r.rx); return r.cz + r.rz * Math.sqrt(1 - q * q); }
function frontAt(rings, y) { return surfZ(rings, 0, y); }
const torsoWeight = (x, y) => {
  if (y < 1.0) return blend('hips', 'spine1', smoothstep(.95, 1.03, y));
  if (y < 1.25) return blend('spine1', 'spine2', smoothstep(1.13, 1.25, y));
  if (y < 1.5) return blend('spine2', 'neck', smoothstep(1.46, 1.5, y));
  return blend('neck', 'head', smoothstep(1.56, 1.6, y));
};

function buildTorso(L) {
  const rings = torsoRings(L), fem = !!L.female;
  const out = new THREE.Color(L.jacket || L.shirt), inn = new THREE.Color(L.shirt), sk = new THREE.Color(L.skin);
  const low = new THREE.Color(fem ? (L.skirt || '#333') : (L.pants || '#333')), belt = new THREE.Color('#19140f');
  const hasV = !!L.jacket, beltY = fem ? 1.02 : 1.0;
  const colorAt = (x, y, z) => {
    if (y < beltY - .018) return low;
    if (!fem && y < beltY + .016) return belt;
    if (y > 1.455) { const collar = 1.48 - Math.abs(x) * .55 + (z < 0 ? .012 : 0); return y > collar ? sk : inn; }
    return out;
  };
  const g = loft(rings, 30, 4, colorAt);
  skin(g, (x, y) => torsoWeight(x, y));
  const parts = [g];
  const sp = (geo, col) => { paint(geo, col); skin(geo, (x, y) => torsoWeight(x, y)); parts.push(geo); };
  const z = (y) => frontAt(rings, y);
  if (hasV) {
    const top = L.vest ? 1.17 : (L.cardigan ? 1.1 : 1.2), yT = 1.475, rowsN = 16, colsN = 8, pos = [], idx = [];
    for (let j = 0; j <= rowsN; j++) {
      const y = top + (yT - top) * j / rowsN, vw = .001 + ((y - top) / (yT - top)) * (L.vest ? .092 : .08);
      for (let i = 0; i <= colsN; i++) { const x = -vw + 2 * vw * i / colsN; pos.push(x, y, surfZ(rings, x, y) + .0022); }
    }
    for (let j = 0; j < rowsN; j++) for (let i = 0; i < colsN; i++) { const a = j * (colsN + 1) + i, b = a + 1, c = a + colsN + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals();
    sp(vg, L.shirt);
  }
  // cuello de la camisa
  for (const s of [-1, 1]) {
    const c = new THREE.Shape(); c.moveTo(0, 0); c.lineTo(s * .052, .01); c.lineTo(s * .032, -.05); c.closePath();
    sp(tf(new THREE.ExtrudeGeometry(c, { depth: .007, bevelEnabled: false }), 0, 1.482, z(1.46) - .006, -.34), L.shirt);
  }
  // corbata
  if (L.tie) {
    const f = (y) => z(y) + .0065;
    const tie = loft([{ y: 1.055, rx: .002, rz: .003, cz: f(1.055) }, { y: 1.08, rx: .027, rz: .0042, cz: f(1.08) }, { y: 1.2, rx: .024, rz: .0042, cz: f(1.2) }, { y: 1.38, rx: .014, rz: .0042, cz: f(1.38) }, { y: 1.45, rx: .012, rz: .0042, cz: f(1.45) }], 10, 2);
    sp(tie, L.tie);
    sp(tf(new THREE.SphereGeometry(.0165, 10, 8), 0, 1.46, f(1.46) + .002, 0, 0, 0, 1.1, .88, .72), L.tie);
  }
  if (L.jacket && !L.vest && !L.cardigan) {
    // solapas y botones del saco
    const dk = '#' + new THREE.Color(L.jacket).multiplyScalar(.74).getHexString();
    for (const s of [-1, 1]) {
      const p = new THREE.Shape();
      p.moveTo(s * .004, 1.2); p.lineTo(s * .066, 1.285); p.lineTo(s * .09, 1.345); p.lineTo(s * .058, 1.355); p.lineTo(s * .074, 1.45); p.lineTo(s * .038, 1.46); p.closePath();
      const lg = new THREE.ExtrudeGeometry(p, { depth: .005, bevelEnabled: false, steps: 1 });
      const pos = lg.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + surfZ(rings, pos.getX(i), Math.max(1.2, Math.min(1.46, pos.getY(i)))) + .0026);
      lg.computeVertexNormals();
      sp(lg, dk);
    }
    for (let i = 0; i < 2; i++) sp(tf(new THREE.SphereGeometry(.0072, 8, 6), .004, 1.09 + i * .075, z(1.09 + i * .075) + .002), '#101010');
  } else if (!L.tie) {
    for (let i = 0; i < 5; i++) sp(tf(new THREE.SphereGeometry(.0052, 6, 5), 0, 1.05 + i * .085, z(1.05 + i * .085) + .001), '#e8e6df');
  }
  if (L.vest || L.cardigan) for (let i = 0; i < 4; i++) sp(tf(new THREE.SphereGeometry(.006, 6, 5), L.cardigan ? .012 : 0, 1.03 + i * .05, z(1.03 + i * .05) + .001), '#2a2420');
  if (L.pens) {
    const y = 1.31, q = z(y) + .002;
    sp(tf(new THREE.BoxGeometry(.078, .09, .004), .082, y, q - Math.abs(.082) * .12), '#' + new THREE.Color(L.shirt).multiplyScalar(.88).getHexString());
    for (const [x, c] of [[.066, '#1f4bb8'], [.082, '#c0242f'], [.098, '#111111']]) sp(tf(new THREE.CylinderGeometry(.0036, .0036, .05, 6), x, y + .052, q - .006), c);
  }
  if (L.lanyard) {
    const tL = [new THREE.Vector3(-.055, 1.462, .05), new THREE.Vector3(-.038, 1.34, z(1.34) + .006), new THREE.Vector3(0, 1.21, z(1.21) + .01)];
    const tR = [new THREE.Vector3(.055, 1.462, .05), new THREE.Vector3(.038, 1.34, z(1.34) + .006), new THREE.Vector3(0, 1.21, z(1.21) + .01)];
    for (const t of [tL, tR]) { const g2 = strand(t, .0034, .0034, '#1f3a6b', 4, 8); skin(g2, (x, y) => torsoWeight(x, y)); parts.push(g2); }
    sp(tf(new THREE.BoxGeometry(.056, .072, .004), 0, 1.17, z(1.17) + .012), '#f4f4ee');
    sp(tf(new THREE.BoxGeometry(.024, .024, .001), 0, 1.178, z(1.17) + .015), L.skin);
  }
  // falda: los vertices siguen a cada muslo segun el lado, asi no atraviesa al sentarse
  if (fem) {
    const c = L.skirt || '#333', w = L.wide || 0;
    const sk2 = loft([{ y: 1.035, rx: .128 + w * .04, rz: .09 + w * .05 }, { y: .98, rx: .155 + w * .03, rz: .104 + w * .04 }, { y: .9, rx: .17 + w * .03, rz: .118 + w * .03 }, { y: .75, rx: .175 + w * .02, rz: .128 + w * .02 }, { y: .6, rx: .172, rz: .13 }, { y: .515, rx: .168, rz: .13 }, { y: .51, rx: .15, rz: .11 }].map((r) => ({ ...r })).sort((a, b) => a.y - b.y), 26, 3);
    paint(sk2, c);
    skin(sk2, (x, y) => {
      const k = smoothstep(.98, .72, y) * .98;
      if (k <= 0) return [['hips', 1]];
      const sL = smoothstep(-.045, .045, x);
      return [['hips', 1 - k], ['thL', k * sL], ['thR', k * (1 - sL)]];
    });
    parts.push(sk2);
  }
  return parts;
}

function buildArm(L, s) {
  const fem = !!L.female, x0 = (fem ? .15 : .176) * (L.slim ? .95 : 1) + (L.wide ? .014 : 0), yS = fem ? 1.365 : 1.37, up = .285, fr = .245;
  const yE = yS - up, yW = yE - fr, sleeve = L.vest ? L.shirt : (L.jacket || L.shirt), skinC = new THREE.Color(L.skin), cS = new THREE.Color(sleeve), cuff = new THREE.Color(L.shirt);
  const r = fem ? .86 : 1;
  const colorAt = (x, y) => {
    if (L.short && y < yS - .15) return skinC;
    if (y < yW + .005) return skinC;
    if (L.jacket && !L.vest && !L.cardigan && y < yW + .018) return cuff;
    return cS;
  };
  const rings = [
    { y: yW - .012, rx: .024 * r, rz: .022 * r }, { y: yW + .006, rx: .027 * r, rz: .025 * r },
    { y: yW + .02, rx: (L.short ? .029 : .033) * r, rz: (L.short ? .027 : .031) * r }, { y: yW + .09, rx: .036 * r, rz: .034 * r }, { y: yE - .05, rx: .041 * r, rz: .04 * r }, { y: yE, rx: .04 * r, rz: .04 * r }, { y: yE + .05, rx: .043 * r, rz: .043 * r },
    { y: yS - .15, rx: (L.short ? .051 : .046) * r, rz: (L.short ? .051 : .046) * r }, { y: yS - .05, rx: .049 * r, rz: .05 * r }, { y: yS + .005, rx: .047 * r, rz: .046 * r }, { y: yS + .03, rx: .032 * r, rz: .032 * r }, { y: yS + .042, rx: .012, rz: .012 },
  ];
  const g = loft(rings, 14, 3, colorAt);
  g.translate(s * x0, 0, 0);
  const sh = s > 0 ? 'shL' : 'shR', el = s > 0 ? 'elL' : 'elR', wr = s > 0 ? 'wrL' : 'wrR';
  const armW = (x, y) => {
    if (y > yS - .02) return blend('spine2', sh, smoothstep(yS + .05, yS - .02, y));
    if (y > yE + .05) return [[sh, 1]];
    if (y > yE - .05) return blend(sh, el, smoothstep(yE + .05, yE - .05, y));
    if (y > yW + .03) return [[el, 1]];
    return blend(el, wr, smoothstep(yW + .03, yW - .005, y));
  };
  skin(g, armW);
  // mano: palma y dedos juntos, sin huecos
  const h = [];
  const palm = loft([{ y: -.088, rx: .036 * r, rz: .0135 * r }, { y: -.062, rx: .041 * r, rz: .0165 * r }, { y: -.03, rx: .039 * r, rz: .0175 * r }, { y: -.006, rx: .03 * r, rz: .0185 * r }, { y: .012, rx: .023 * r, rz: .019 * r }], 14, 2);
  h.push(palm);
  [0, 1, 2, 3].forEach((i) => {
    const fx = (-.0255 + i * .0172) * r, len = [.05, .059, .055, .042][i] * r;
    const f = new THREE.CapsuleGeometry(.0088 * r, len, 3, 8); f.translate(0, -len / 2 - .002, 0);
    h.push(tf(f, fx, -.084, .002, -.26, 0, (i - 1.5) * -.035));
  });
  const th = new THREE.CapsuleGeometry(.0098 * r, .036, 3, 8); th.translate(0, -.02, 0);
  h.push(tf(th, -s * .036 * r, -.024, .012, .24, 0, -s * .62));
  const hand = mergeAll(h.map((q) => paint(q, L.skin)));
  hand.scale(.9, .9, .9);
  hand.translate(s * x0, yW, 0);
  skin(hand, wr);
  return [g, hand];
}

function buildLeg(L, s) {
  const fem = !!L.female, w = L.wide || 0, x0 = fem ? .08 : .084, yH = .87, yK = .47, yA = .075;
  const r = fem ? .9 : 1, cLeg = new THREE.Color(fem ? (L.skirt || '#333') : (L.pants || '#333')), cSkin = new THREE.Color(L.skin);
  const colorAt = (x, y) => (fem ? (y > yK + .05 ? cLeg : cSkin) : cLeg);
  const rings = fem ? [
    { y: yA + .012, rx: .031, rz: .031 }, { y: yA + .05, rx: .032, rz: .034 }, { y: yA + .19, rx: .046, rz: .05, cz: -.006 }, { y: yK - .06, rx: .042, rz: .044 }, { y: yK, rx: .045, rz: .047 }, { y: yK + .08, rx: .056, rz: .058 }, { y: yH - .14, rx: .073, rz: .078 }, { y: yH - .02, rx: .082, rz: .088 }, { y: yH + .06, rx: .07, rz: .075 }, { y: yH + .09, rx: .03, rz: .03 },
  ] : [
    { y: yA - .012, rx: .05, rz: .056 }, { y: yA + .02, rx: .048, rz: .054 }, { y: yA + .17, rx: .051, rz: .057, cz: -.004 }, { y: yK - .07, rx: .054, rz: .058 }, { y: yK, rx: .055 + w * .006, rz: .059 + w * .006 }, { y: yK + .09, rx: .062 + w * .012, rz: .068 + w * .012 }, { y: yH - .14, rx: .076 + w * .02, rz: .084 + w * .02 }, { y: yH - .02, rx: .08 + w * .022, rz: .088 + w * .022 }, { y: yH + .05, rx: .058, rz: .062 }, { y: yH + .08, rx: .02, rz: .02 },
  ];
  const g = loft(rings, 16, 3, colorAt);
  g.translate(s * x0, 0, 0);
  const th = s > 0 ? 'thL' : 'thR', kn = s > 0 ? 'knL' : 'knR', ft = s > 0 ? 'ftL' : 'ftR';
  skin(g, (x, y) => {
    if (y > yH - .05) return blend('hips', th, smoothstep(yH + .07, yH - .05, y));
    if (y > yK + .06) return [[th, 1]];
    if (y > yK - .06) return blend(th, kn, smoothstep(yK + .06, yK - .06, y));
    if (y > yA + .05) return [[kn, 1]];
    return blend(kn, ft, smoothstep(yA + .05, yA - .01, y));
  });
  // zapato con suela
  const shoeC = fem ? (L.shoe || '#3a2a2a') : (L.pants && /^#[c-f]/.test(L.pants) ? '#5a3a22' : '#17120f');
  const sh = fem
    ? loft([{ y: 0, rx: .037, rz: .112, cz: .042 }, { y: .022, rx: .037, rz: .11, cz: .042 }, { y: .042, rx: .031, rz: .066, cz: .014 }, { y: .062, rx: .029, rz: .04, cz: -.008 }, { y: .075, rx: .03, rz: .036, cz: -.01 }], 16, 2)
    : loft([{ y: 0, rx: .045, rz: .132, cz: .052 }, { y: .026, rx: .047, rz: .13, cz: .052 }, { y: .055, rx: .042, rz: .094, cz: .026 }, { y: .08, rx: .04, rz: .06, cz: -.004 }, { y: .1, rx: .04, rz: .05, cz: -.006 }], 16, 2);
  paint(sh, shoeC);
  const sole = paint(tf(rbox(fem ? .076 : .092, .012, fem ? .226 : .266, .005), 0, -.004, fem ? .042 : .052), '#1a1512');
  const shoe = mergeAll([sh, sole]);
  shoe.translate(s * x0, .012, 0);
  skin(shoe, ft);
  return [g, shoe];
}

export function buildBody(L, material) {
  const fem = !!L.female, x0 = (fem ? .15 : .176) * (L.slim ? .95 : 1) + (L.wide ? .014 : 0), xL = fem ? .08 : .084;
  const b = {}; for (const n of BONES) b[n] = new THREE.Bone();
  const put = (n, parent, x, y, z) => { b[n].position.set(x, y, z); if (parent) b[parent].add(b[n]); };
  put('hips', null, 0, .93, 0);
  put('spine1', 'hips', 0, .07, 0); put('spine2', 'spine1', 0, .2, 0); put('neck', 'spine2', 0, .29, -.002); put('head', 'neck', 0, .09, .004);
  const yS = fem ? 1.365 : 1.37;
  put('shL', 'spine2', x0, yS - 1.2, 0); put('elL', 'shL', 0, -.285, 0); put('wrL', 'elL', 0, -.245, 0);
  put('shR', 'spine2', -x0, yS - 1.2, 0); put('elR', 'shR', 0, -.285, 0); put('wrR', 'elR', 0, -.245, 0);
  put('thL', 'hips', xL, -.06, 0); put('knL', 'thL', 0, -.4, 0); put('ftL', 'knL', 0, -.395, 0);
  put('thR', 'hips', -xL, -.06, 0); put('knR', 'thR', 0, -.4, 0); put('ftR', 'knR', 0, -.395, 0);
  const parts = [...buildTorso(L), ...buildArm(L, 1), ...buildArm(L, -1), ...buildLeg(L, 1), ...buildLeg(L, -1)];
  const geo = mergeAll(parts);
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  b.hips.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => b[n]));
  const sock = (wr) => { const g = new THREE.Group(); g.position.set(0, -.1, .012); wr.add(g); return g; };
  return {
    mesh, skeleton, hips: b.hips, spine1: b.spine1, spine2: b.spine2, neck: b.neck, head: b.head,
    arms: [{ s: 1, sh: b.shL, elbow: b.elL, wr: b.wrL, sock: sock(b.wrL) }, { s: -1, sh: b.shR, elbow: b.elR, wr: b.wrR, sock: sock(b.wrR) }],
    legs: [{ th: b.thL, kn: b.knL, ft: b.ftL }, { th: b.thR, kn: b.knR, ft: b.ftR }],
  };
}
