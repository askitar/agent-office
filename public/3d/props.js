// Muebles y aparatos hechos con codigo para lo que no existe en la biblioteca (o tiene que encajar exacto).
// Cada funcion devuelve piezas con el origen en el piso, centradas, y el frente mirando a +Z.
import { THREE, box, rbox, cyl, sph, plane, torus, lathe, mat, glow, part, mergeGeometries, picMat, roundRect, seeded } from './kit.js';

const BLACK = mat('#17181c', .45, .1), GRAPHITE = mat('#2a2d33', .5, .3), STEEL = mat('#a9aeb6', .32, .9), CHROME = mat('#d8dce2', .16, 1);
const WHITE = mat('#eceded', .42), PLASTIC_G = mat('#c9ccd0', .5), BEIGE_PL = mat('#d9d3c2', .55);

export function officeChair(fabric = '#2e333d', arms = true) {
  const f = mat(fabric, .85), p = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    p.push(part(rbox(.05, .03, .3, .012), GRAPHITE, Math.sin(a) * .15, .085, Math.cos(a) * .15, a));
    p.push(part(sph(.03, 10, 8), BLACK, Math.sin(a) * .29, .032, Math.cos(a) * .29));
  }
  p.push(part(cyl(.028, .028, .2, 12), CHROME, 0, .2, 0), part(cyl(.04, .05, .07, 12), BLACK, 0, .13, 0));
  p.push(part(rbox(.48, .08, .47, .035, 3), f, 0, .44, .01), part(rbox(.3, .03, .3, .01), BLACK, 0, .39, 0));
  p.push(part(rbox(.44, .54, .07, .03, 3), f, 0, .78, -.235, 0, 1, 1, 1, -.1));
  p.push(part(rbox(.05, .3, .03, .01), BLACK, 0, .55, -.255));
  if (arms) for (const s of [-1, 1]) {
    p.push(part(rbox(.03, .22, .04, .01), BLACK, s * .26, .54, 0), part(rbox(.07, .03, .26, .012), BLACK, s * .26, .655, .02));
  }
  return p;
}
export const screenSpot = (w = .56, h = .33) => ({ w: w - .018, h: h - .018, y: .13 + h / 2, z: .021 });
export function monitor(w = .56, h = .33) {
  return [
    part(rbox(.22, .012, .17, .005), GRAPHITE, 0, .006, 0),
    part(rbox(.04, .13, .02, .006), GRAPHITE, 0, .07, -.03),
    part(rbox(w, h, .03, .007), BLACK, 0, .13 + h / 2, 0),
    part(rbox(w * .5, h * .55, .02, .006), GRAPHITE, 0, .13 + h / 2, -.02),
  ];
}
let keysGeo = null;
export function keyboard(col = '#22242a', keyCol = '#34373f') {
  if (!keysGeo) {
    const list = [];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) {
      if (r === 4 && k > 2 && k < 9 && k !== 3) continue;
      const w = r === 4 && k === 3 ? .135 : .021;
      const g = new THREE.BoxGeometry(w, .007, .021); g.translate(-.178 + k * .0272 + (w > .1 ? .055 : 0), 0, -.052 + r * .0262); list.push(g);
    }
    keysGeo = mergeGeometries(list);
  }
  return [part(rbox(.42, .016, .145, .005), mat(col, .5), 0, .008, 0), part(keysGeo, mat(keyCol, .45), 0, .02, 0)];
}
export const mouseSet = (padCol = '#23262e') => [part(box(.24, .004, .2), mat(padCol, .9), 0, .002, 0), part(rbox(.058, .03, .1, .014, 3), BLACK, 0, .018, 0)];
export function deskPhone() {
  const p = [part(rbox(.2, .04, .19, .012), GRAPHITE, 0, .024, 0, 0, 1, 1, 1, .12), part(rbox(.05, .03, .19, .012), BLACK, -.07, .062, 0)];
  const pad = mat('#d9dbe0', .4);
  for (let i = 0; i < 12; i++) p.push(part(box(.018, .004, .014), pad, .012 + (i % 3) * .024, .05, -.04 + Math.floor(i / 3) * .021));
  return p;
}
export function mug(color = '#ffffff', labelMat = null) {
  const m = mat(color, .28);
  const p = [
    part(lathe('mug', [[0, 0], [.04, 0], [.042, .01], [.042, .095], [.037, .095], [.035, .012], [0, .012]], 18), m),
    part(torus(.022, .005, 6, 12, Math.PI), m, .042, .05, 0, 0, 1, 1, 1, 0, -Math.PI / 2),
    part(cyl(.035, .035, .004, 14), mat('#3a2315', .25), 0, .082, 0),
  ];
  if (labelMat) p.push(part(new THREE.CylinderGeometry(.0426, .0426, .06, 18, 1, true, -.9, 1.8), labelMat, 0, .052, 0));
  return p;
}
export function penCup() {
  const p = [part(cyl(.034, .03, .09, 12, true), GRAPHITE, 0, .045, 0), part(cyl(.03, .03, .003, 12), GRAPHITE, 0, .004, 0)];
  const cols = ['#1f4bb8', '#c0242f', '#111111', '#e8b923'];
  cols.forEach((c, i) => p.push(part(cyl(.004, .004, .14, 6), mat(c, .4), Math.sin(i * 2) * .015, .08, Math.cos(i * 2) * .015, 0, 1, 1, 1, .1 * (i - 1.5), .08 * (i - 1))));
  return p;
}
export function paperStack(n = 6, seed = 3) {
  const r = seeded(seed * 97 + 11), p = [], m = mat('#d6d3c8', .9);
  for (let i = 0; i < n; i++) p.push(part(box(.21, .002, .297), m, (r() - .5) * .012, .002 + i * .0025, (r() - .5) * .012, (r() - .5) * .14));
  return p;
}
export function binder(col = '#1f4bb8') { return [part(rbox(.05, .29, .23, .006), mat(col, .55), 0, .145, 0), part(box(.051, .05, .12), mat('#f4f4ee', .8), 0, .2, 0)]; }
export function filingCabinet(n = 4, col = '#8c929b') {
  const c = mat(col, .42, .55), h = n * .34, p = [part(rbox(.46, h, .6, .012), c, 0, h / 2, 0)];
  for (let i = 0; i < n; i++) {
    const y = .17 + i * .34;
    p.push(part(rbox(.42, .3, .012, .004), mat(col, .38, .6), 0, y, .3), part(rbox(.12, .016, .022, .005), STEEL, 0, y - .02, .31), part(box(.09, .035, .002), mat('#f4f1e6', .7), 0, y + .08, .307));
  }
  return p;
}
export function copier() {
  const p = [
    part(rbox(.72, .78, .62, .02), mat('#cfd2d8', .5), 0, .39, 0), part(rbox(.72, .2, .62, .02), mat('#e6e8ec', .45), 0, .88, 0),
    part(rbox(.66, .03, .52, .01), mat('#23262b', .25), 0, .995, 0), part(rbox(.3, .05, .2, .01), mat('#3a3e46', .4), -.16, 1.02, .2),
    part(box(.21, .012, .29), mat('#f4f1e6', .8), .2, .72, .32), part(box(.26, .02, .3), mat('#9aa0a8', .5), .2, .7, .32),
  ];
  for (let i = 0; i < 3; i++) p.push(part(rbox(.66, .19, .012, .004), mat('#b7bbc2', .45), 0, .13 + i * .22, .31), part(rbox(.16, .022, .02, .006), GRAPHITE, 0, .13 + i * .22, .325));
  p.push(part(box(.03, .012, .004), glow('#3ddc84', 2.5), -.28, .96, .312));
  return p;
}
export function waterCooler() {
  const water = new THREE.MeshPhysicalMaterial({ color: '#8fd0ff', roughness: .06, transparent: true, opacity: .42, metalness: 0, clearcoat: 1 });
  return [
    part(rbox(.32, 1.0, .32, .02), WHITE, 0, .5, 0),
    part(rbox(.2, .16, .02, .006), mat('#2a2d33', .4), 0, .84, .165), part(box(.03, .05, .03), mat('#3a6fd8', .3), -.05, .82, .18), part(box(.03, .05, .03), mat('#d83a3a', .3), .05, .82, .18),
    part(rbox(.22, .02, .1, .004), GRAPHITE, 0, .72, .18),
    part(lathe('wbottle', [[0, 0], [.1, 0], [.14, .05], [.14, .36], [.12, .42], [.05, .46], [0, .46]], 20), water, 0, 1.0, 0),
    part(cyl(.05, .05, .1, 12, true), mat('#f0f0f0', .5), .24, .5, .1),
  ];
}
export function fridge() {
  const body = mat('#e4e6e8', .3, .45), hd = mat('#b9bdc4', .22, .85), p = [
    part(rbox(.72, 1.86, .68, .03), body, 0, .93, 0), part(rbox(.7, .08, .66, .012), mat('#26282c', .5), 0, .04, 0),
    part(box(.71, .012, .01), GRAPHITE, 0, 1.28, .345),
    part(rbox(.022, .42, .03, .008), hd, -.28, 1.56, .36), part(rbox(.022, .72, .03, .008), hd, -.28, .86, .36),
  ];
  // imanes y notas
  const cols = ['#f2c94c', '#ff8fa3', '#7fd0ff', '#b2f2bb'];
  cols.forEach((c, i) => p.push(part(box(.1, .1, .002), mat(c, .8), .1 + (i % 2) * .15, 1.56 + (i > 1 ? -.16 : 0), .342, 0, 1, 1, 1, 0, (i - 1.5) * .06)));
  return p;
}
export function vending(productsMat) {
  const p = [part(rbox(.84, 1.9, .72, .02), mat('#b21f2d', .4, .2), 0, .95, 0), part(box(.56, 1.32, .02), mat('#111318', .3), -.08, 1.2, .36)];
  p.push(part(plane(.54, 1.3), productsMat, -.08, 1.2, .372));
  p.push(part(box(.56, .2, .02), mat('#1a1c20', .4), -.08, .32, .36), part(box(.12, .34, .012), mat('#20242c', .35), .3, 1.22, .362));
  for (let i = 0; i < 9; i++) p.push(part(box(.022, .022, .006), mat('#d8dbe0', .4), .265 + (i % 3) * .035, 1.33 - Math.floor(i / 3) * .035, .37));
  p.push(part(box(.08, .022, .006), glow('#ff5040', 2.2), .3, 1.26, .37));
  return p;
}
export function coffeeMachine() {
  return [
    part(rbox(.24, .38, .28, .02), GRAPHITE, 0, .19, 0), part(rbox(.26, .05, .3, .012), BLACK, 0, .395, 0), part(rbox(.2, .04, .2, .01), BLACK, 0, .025, .05),
    part(lathe('carafe', [[0, 0], [.065, 0], [.075, .03], [.07, .1], [.045, .14], [.05, .15], [0, .15]], 16), new THREE.MeshPhysicalMaterial({ color: '#40281a', roughness: .08, transparent: true, opacity: .72 }), 0, .05, .06),
    part(box(.02, .012, .006), glow('#ff5040', 3), .07, .33, .141), part(box(.02, .012, .006), glow('#3ddc84', 3), .03, .33, .141),
  ];
}
export function sink() {
  const p = [part(rbox(.56, .02, .4, .008), STEEL, 0, 0, 0), part(box(.48, .004, .32), mat('#6e737a', .32, .8), 0, .011, 0)];
  p.push(part(cyl(.012, .014, .2, 10), CHROME, 0, .1, -.16));
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .2, -.16), new THREE.Vector3(0, .27, -.13), new THREE.Vector3(0, .27, -.06), new THREE.Vector3(0, .2, -.04)]);
  p.push(part(new THREE.TubeGeometry(curve, 12, .009, 8), CHROME));
  return p;
}
export function drawerFront(w, h, col, handle = STEEL) { return [part(rbox(w - .012, h - .012, .018, .004), mat(col, .5), 0, 0, 0), part(rbox(Math.min(.14, w * .4), .012, .022, .004), handle, 0, h / 2 - .05, .014)]; }
export function trashCan() { return [part(cyl(.14, .11, .32, 16, true), GRAPHITE, 0, .16, 0), part(cyl(.11, .11, .005, 16), GRAPHITE, 0, .003, 0), part(cyl(.122, .122, .004, 16), mat('#e8e6dc', .9), 0, .28, 0)]; }
export function rack() {
  const p = [part(rbox(.62, 1.9, .7, .012), mat('#101114', .45, .5), 0, .95, 0)];
  const on = glow('#3ddc84', 3), blue = glow('#3fa8ff', 3);
  for (let i = 0; i < 8; i++) {
    const y = .25 + i * .21;
    p.push(part(rbox(.56, .17, .012, .003), mat('#1d1f24', .4, .5), 0, y, .35));
    for (let k = 0; k < 5; k++) p.push(part(box(.012, .012, .004), (k + i) % 3 ? on : blue, -.23 + k * .03, y + .04, .358));
    p.push(part(box(.3, .05, .004), mat('#0a0b0e', .6), .1, y, .358));
  }
  return p;
}
export function softbox(height = 1.9, color = '#fff2d8') {
  const p = tripodLegs(height - .3);
  p.push(part(cyl(.012, .012, height - .1, 8), STEEL, 0, height / 2, 0));
  p.push(part(rbox(.62, .44, .08, .012), mat('#15161a', .7), 0, height + .06, -.02, 0, 1, 1, 1, .25));
  p.push(part(box(.56, .38, .012), glow(color, 2.6), 0, height + .05, .03, 0, 1, 1, 1, .25));
  return p;
}
export function tripodLegs(h = 1.2) {
  const p = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + .5;
    p.push(part(cyl(.011, .008, h * .62, 6), BLACK, Math.sin(a) * .13, h * .3, Math.cos(a) * .13, 0, 1, 1, 1, Math.cos(a) * .42, -Math.sin(a) * .42));
  }
  p.push(part(cyl(.02, .02, .05, 10), GRAPHITE, 0, h * .6, 0));
  return p;
}
export function ringLight() {
  const p = tripodLegs(1.5);
  p.push(part(cyl(.011, .011, 1.0, 8), STEEL, 0, 1.25, 0));
  p.push(part(torus(.2, .018, 10, 40), glow('#fff6e6', 4.5), 0, 1.72, 0));
  p.push(part(rbox(.07, .13, .012, .005), BLACK, 0, 1.72, .01));
  return p;
}
export function boomMic() {
  const p = tripodLegs(1.5);
  p.push(part(cyl(.012, .012, 1.05, 8), BLACK, 0, 1.25, 0));
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.72, -.35), new THREE.Vector3(0, 1.76, 0), new THREE.Vector3(0, 1.82, .5), new THREE.Vector3(0, 1.8, .92)]);
  p.push(part(new THREE.TubeGeometry(arm, 12, .009, 7), BLACK));
  p.push(part(cyl(.006, .006, .12, 6), BLACK, 0, 1.74, .92));
  p.push(part(cyl(.024, .024, .17, 12), mat('#22242a', .5, .4), 0, 1.62, .92), part(sph(.0245, 10, 8), mat('#3a3d45', .9), 0, 1.535, .92));
  return p;
}
export function deskMic() {
  return [part(cyl(.05, .055, .012, 16), BLACK, 0, .006, 0), part(cyl(.006, .006, .16, 8), STEEL, 0, .09, 0), part(cyl(.024, .024, .085, 14), mat('#26282e', .45, .6), 0, .19, 0), part(sph(.0245, 12, 8), mat('#6a6d75', .75, .6), 0, .232, 0)];
}
// espuma acustica: pirámides repetidas en un panel
export function foamPanel(col = '#23202c') {
  const m = mat(col, .95), p = [part(box(.5, .5, .02), m, 0, 0, -.02)];
  const g = new THREE.ConeGeometry(.058, .05, 4); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 4); g.translate(0, 0, .022);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) p.push(part(g, m, -.2 + i * .08, -.2 + k * .08, 0));
  return p;
}
export function dundie() {
  const gold = mat('#d6ad3c', .28, 1);
  return [part(rbox(.09, .03, .09, .006), mat('#20150c', .35), 0, .015, 0), part(cyl(.008, .012, .1, 8), gold, 0, .08, 0), part(sph(.016, 10, 8), gold, 0, .145, 0), part(cyl(.028, .012, .04, 10), gold, 0, .118, 0), part(torus(.02, .004, 6, 12, Math.PI), gold, 0, .17, 0)];
}
export function beet() {
  const b = mat('#7a1f47', .55), g = mat('#3f8f3a', .7);
  return [part(sph(.035, 12, 10), b, 0, .03, 0, 0, 1, .9, 1), part(cyl(.004, .002, .03, 6), b, 0, 0, 0), ...[0, 1, 2].map((i) => part(box(.012, .07, .004), g, Math.sin(i * 2) * .008, .09, Math.cos(i * 2) * .008, i * 2, 1, 1, 1, .15))];
}
// la engrapadora en gelatina: el clasico de Jim contra Dwight
export function jello() {
  const j = new THREE.MeshPhysicalMaterial({ color: '#e8b800', roughness: .15, transparent: true, opacity: .55, clearcoat: 1, transmission: 0 });
  return [part(rbox(.24, .09, .14, .018, 3), j, 0, .045, 0), part(rbox(.15, .03, .05, .008), mat('#3a3d44', .4, .7), 0, .035, 0), part(rbox(.14, .02, .04, .008), mat('#b02a2a', .35, .4), 0, .06, 0, 0, 1, 1, 1, 0, .06)];
}
export function bobblehead() {
  return [part(cyl(.022, .026, .012, 12), mat('#20150c', .4), 0, .006, 0), part(rbox(.03, .05, .02, .008), mat('#c9a227', .6), 0, .037, 0), part(sph(.022, 12, 10), mat('#efc39a', .55), 0, .08, 0), part(sph(.0225, 12, 8), mat('#4a3220', .6), 0, .085, -.002), part(box(.026, .005, .002), mat('#111111', .3), 0, .082, .021)];
}
export function candyJar() {
  const p = [part(lathe('jar', [[0, 0], [.06, 0], [.075, .02], [.075, .13], [.05, .16], [.05, .18], [0, .18]], 18), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .05, transparent: true, opacity: .28, clearcoat: 1 }))];
  const r = seeded(77), cols = ['#ff3f6b', '#ffd23f', '#3fd8ff', '#3fdd8a', '#b070ff', '#ff8a3c'];
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, q = r() * .05; p.push(part(sph(.012, 8, 6), mat(cols[i % 6], .3), Math.cos(a) * q, .018 + r() * .09, Math.sin(a) * q)); }
  return p;
}
export function flowers() {
  const p = [], r = seeded(31), st = mat('#3f8f3a', .7);
  const cols = ['#ff6fa3', '#ffd23f', '#ff8a3c', '#e8e8ff'];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, h = .16 + r() * .1, ox = Math.cos(a) * .045, oz = Math.sin(a) * .045;
    p.push(part(cyl(.003, .003, h, 5), st, ox * .5, h / 2, oz * .5, 0, 1, 1, 1, oz * 2, -ox * 2));
    p.push(part(sph(.022, 8, 6), mat(cols[i % 4], .6), ox, h, oz, 0, 1, .6, 1));
  }
  return p;
}
export function bell() { const g = mat('#d6ad3c', .25, 1); return [part(cyl(.05, .055, .01, 16), mat('#20150c', .4), 0, .005, 0), part(lathe('bell', [[.04, 0], [.035, .02], [.02, .05], [.006, .06], [.006, .07], [0, .07]], 16), g, 0, .01, 0)]; }
export function pizzaBox() {
  return [part(box(.36, .03, .36), mat('#c9a06a', .85), 0, .015, 0), part(box(.36, .004, .36), mat('#b8895a', .85), 0, .17, -.17, 0, 1, 1, 1, -1.25),
    part(new THREE.CylinderGeometry(.16, .16, .01, 24, 1, false, 0, 4.2), mat('#e8b34a', .7), 0, .036, 0)];
}
export function napkins() { return [part(rbox(.14, .07, .1, .006), mat('#3a3f4a', .5), 0, .035, 0), part(box(.12, .012, .08), mat('#f7f7f2', .9), 0, .076, 0)]; }
export function fruitBowl() {
  const p = [part(lathe('bowl', [[0, 0], [.07, 0], [.13, .06], [.14, .075], [.125, .075], [.065, .012], [0, .012]], 22), mat('#d8d4c6', .4))];
  const cols = ['#d6342c', '#e8b923', '#7ac043', '#ff8a3c', '#d6342c'];
  cols.forEach((c, i) => { const a = i * 1.26; p.push(part(sph(.036, 10, 8), mat(c, .4), Math.cos(a) * .058, .055 + (i === 4 ? .035 : 0), Math.sin(a) * .058)); });
  return p;
}
export function rugPlain() { return []; }
export function ceilingPanel(w = 1.2, d = .6) { return [part(box(w, .03, d), mat('#d7d9da', .6), 0, 0, 0), part(box(w - .06, .005, d - .06), glow('#fff4e0', 2.6), 0, -.018, 0)]; }
export function trackLight(col = '#ffe7c2') { return [part(cyl(.035, .05, .13, 12), BLACK, 0, -.065, 0), part(cyl(.043, .043, .004, 12), glow(col, 4), 0, -.133, 0)]; }
export function plaqueButton(col = '#c9ccd2') { return [part(rbox(.3, .38, .03, .006), mat('#1a1b20', .35), 0, 0, 0), part(rbox(.21, .15, .012, .03), mat(col, .22, 1), 0, .03, .018), part(new THREE.CircleGeometry(.032, 3), mat('#1a1b20', .4), .003, .03, .025, 0, 1, 1, 1, 0, -Math.PI / 2)]; }

// ---------------------------------------------------------------- lo que llevan en la mano
export function heldItem(kind) {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  if (kind === 'mug') {
    const m = mat('#ffffff', .28);
    add(lathe('mug', [[0, 0], [.04, 0], [.042, .01], [.042, .095], [.037, .095], [.035, .012], [0, .012]], 18), m);
    add(torus(.022, .005, 6, 12, Math.PI), m, .042, .05, 0, 0, 0, -Math.PI / 2);
    add(cyl(.035, .035, .004, 14), mat('#3a2315', .25), 0, .082, 0);
    g.position.set(0, -.05, .03);
  } else if (kind === 'folder') {
    add(rbox(.23, .3, .012, .004), mat('#d9b76a', .8), 0, -.02, 0);
    add(box(.2, .26, .002), mat('#f6f4ec', .85), 0, -.02, .008);
    g.position.set(0, -.1, .04); g.rotation.x = -.7;
  } else if (kind === 'sandwich') {
    add(rbox(.11, .018, .09, .007), mat('#d9b070', .85), 0, -.02, 0);
    add(rbox(.105, .012, .085, .004), mat('#6fbf4a', .8), 0, -.005, 0);
    add(rbox(.1, .012, .08, .004), mat('#c0543a', .7), 0, .007, 0);
    add(rbox(.11, .018, .09, .007), mat('#d9b070', .85), 0, .022, 0);
    g.position.set(0, -.055, .03);
  } else if (kind === 'donut') {
    add(torus(.033, .018, 10, 18), mat('#d9a066', .7), 0, 0, 0, Math.PI / 2 - .4);
    add(torus(.033, .0185, 10, 18), mat('#f08ab4', .35), 0, .004, 0, Math.PI / 2 - .4, 0, 0, 1, 1, .7);
    g.position.set(0, -.055, .03);
  } else if (kind === 'apple') {
    add(sph(.04, 14, 12), mat('#d6342c', .32), 0, 0, 0, 0, 0, 0, 1, .92, 1);
    add(cyl(.003, .003, .022, 6), mat('#4a3020', .7), 0, .044, 0);
    g.position.set(0, -.06, .03);
  } else if (kind === 'pizza') {
    const s = new THREE.Shape(); s.moveTo(0, -.09); s.lineTo(.06, .06); s.quadraticCurveTo(0, .08, -.06, .06); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: .012, bevelEnabled: false });
    add(e, mat('#e8b34a', .7), 0, 0, 0, -Math.PI / 2 + .2);
    for (const [x, z] of [[-.02, .01], [.02, .03], [0, -.02]]) add(cyl(.012, .012, .004, 10), mat('#b02a20', .55), x, .012, z);
    g.position.set(0, -.05, .03);
  } else if (kind === 'chips') {
    add(rbox(.12, .16, .04, .012, 3), mat('#2f7bd5', .3, .3), 0, 0, 0);
    add(box(.07, .05, .002), mat('#f5e04a', .5), 0, .01, .021);
    g.position.set(0, -.08, .03);
  } else if (kind === 'salad') {
    add(lathe('sbowl', [[0, 0], [.05, 0], [.09, .045], [.08, .045], [.045, .008], [0, .008]], 16), mat('#f2f0ea', .35));
    for (let i = 0; i < 7; i++) add(sph(.022, 8, 6), mat(i % 3 ? '#57a84a' : '#d6342c', .7), Math.cos(i) * .04, .04, Math.sin(i) * .04, 0, 0, 0, 1, .55, 1);
    g.position.set(0, -.05, .03);
  } else if (kind === 'phone') {
    add(rbox(.075, .15, .01, .008), mat('#17181c', .25, .5));
    g.position.set(0, -.08, .02); g.rotation.x = -.5;
  }
  return g;
}

// ---------------------------------------------------------------- cuadros y letreros
export function posterPic(title, sub, bg, fg, art) {
  return picMat(512, 680, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (art) art(c, w, h);
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, h - 170, w, 170);
    c.fillStyle = fg; c.textAlign = 'center';
    c.font = '700 44px Georgia, serif'; c.fillText(title, w / 2, h - 106);
    c.fillStyle = '#e8e6df'; c.font = 'italic 22px Georgia, serif';
    const words = sub.split(' '); let line = '', y = h - 66;
    for (const t of words) { const q = line ? line + ' ' + t : t; if (c.measureText(q).width > w - 60) { c.fillText(line, w / 2, y); line = t; y += 28; } else line = q; }
    c.fillText(line, w / 2, y);
  });
}
export function framed(picM, w, h, frame = '#1c1d22') {
  return [part(rbox(w + .04, h + .04, .025, .005), mat(frame, .45), 0, 0, 0), part(plane(w, h), picM, 0, 0, .0135)];
}
