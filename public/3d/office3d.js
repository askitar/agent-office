// Construye toda la oficina: piso, paredes, ventanas, techo, muebles, detalles y pantallas.
import { THREE, Batch, M, part, box, rbox, cyl, sph, plane, uvBox, floorRect, mat, glow, pbr, canvasTex, picMat, screenMat, model, fitScale, mergeGeometries, roundRect, wrap, seeded } from './kit.js';
import { OFFICE, WALLS, DESKS, FOOT, YAW, SPOTS, SHARED } from './world.js';
import * as P from './props.js';

const H = OFFICE.h, T_ = OFFICE.wall;
const PI = Math.PI;

export const MODEL_IDS = [
  'metal_office_desk', 'Sofa_01', 'sofa_02', 'sofa_03', 'modern_arm_chair_01', 'mid_century_lounge_chair', 'modern_coffee_table_01', 'modern_wooden_cabinet',
  'wooden_bookshelf_worn', 'steel_frame_shelves_01', 'bar_chair_round_01', 'plastic_monobloc_chair_01', 'metal_stool_03', 'CoffeeCart_01', 'projector_screen',
  'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'planter_box_01', 'wall_clock', 'standing_picture_frame_01', 'standing_picture_frame_02',
  'rubber_duck_toy', 'ceramic_vase_01', 'book_encyclopedia_set_01', 'fire_alarm', 'WetFloorSign_01', 'Ukulele_01', 'Megaphone_01', 'boombox', 'Camera_01',
  'stationery_supplies', 'office_notepads', 'clipboard', 'binder_notebook', 'classic_laptop', 'desk_lamp_arm_01', 'vintage_microwave', 'vintage_electric_kettle',
  'cardboard_box_01', 'hanging_industrial_lamp', 'modern_ceiling_lamp_01', 'alarm_clock_01', 'industrial_pastic_container', 'medical_box',
];

export function buildOffice(scene) {
  const root = new THREE.Group(); scene.add(root);
  const sides = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
  for (const k in sides) root.add(sides[k]);
  const ceiling = new THREE.Group(); root.add(ceiling);
  const B = new Batch(), Bc = new Batch(); // Bc = techo: no proyecta sombra
  const SB = { N: new Batch(), S: new Batch(), E: new Batch(), W: new Batch() };
  const labels = [], screens = {}, doors = [], tvs = {}, blinkers = [];
  const label = (name, x, y, z, r = .3) => labels.push({ name, x, y, z, r });

  // ---------------------------------------------------------------- materiales grandes
  const wallFan = pbr('plastered_wall', { color: '#ece6d4', nScale: .5 });
  const wallAsk = pbr('painted_brick', { color: '#3b3a58', nScale: .9 });
  const wallCenter = pbr('plastered_wall', { color: '#f1efe8', nScale: .4 });
  const floorCarpet = pbr('dirty_carpet', { noDiff: true, color: '#7f8b9c', nScale: .55 });
  const floorConcrete = pbr('painted_concrete', { noDiff: true, color: '#3c3b46', nScale: .35, rough: .6 });
  const floorWood = pbr('laminate_floor_02', { color: '#e0cdb2', nScale: .5 });
  const floorDark = pbr('dark_wooden_planks', { color: '#7c6a5c', nScale: .6 });
  const marble = pbr('marble_01', { nScale: .3, rough: .55 });
  const oak = pbr('oak_veneer_01', { nScale: .3 });
  const walnut = pbr('black_walnut_veneer_01', { nScale: .3 });
  const leather = pbr('fabric_leather_01', { color: '#2b2b30', nScale: .6 });
  const vct = new THREE.MeshStandardMaterial({
    roughness: .42, map: canvasTex(1024, 1024, (c, w) => {
      const r = seeded(9), n = 4, s = w / n, cols = ['#d9d2bf', '#cbc4b0', '#8f3a32', '#d2cbb7'];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        c.fillStyle = (i + j) % 2 ? cols[0] : (i % 2 ? cols[1] : cols[3]); c.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 60; k++) { c.fillStyle = `rgba(${r() > .5 ? '70,60,50' : '255,250,235'},${.05 + r() * .08})`; c.fillRect(i * s + r() * s, j * s + r() * s, 3 + r() * 16, 2 + r() * 5); }
        c.strokeStyle = 'rgba(40,35,30,.25)'; c.lineWidth = 2; c.strokeRect(i * s, j * s, s, s);
      }
    }, { repeat: true }),
  });

  // ---------------------------------------------------------------- pisos
  const addFloor = (m, list, scale) => {
    const g = mergeGeometries(list.map(([a, b, c, d]) => floorRect(a, b, c, d, scale)));
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; root.add(mesh);
  };
  addFloor(floorCarpet, [[-11, -2.6, -6.4, 2.6], [-6.4, -7, -3.2, 7]], .9);
  addFloor(floorCarpet.clone(), [[-11, 2.6, -6.4, 7]], .9); root.children[root.children.length - 1].material.color.set('#5e6f8c');
  addFloor(floorConcrete, [[3.2, -7, 6.4, 7], [6.4, -2.6, 11, 2.6]], 3.2);
  addFloor(floorWood, [[-11, -7, -6.4, -2.6], [-3.2, -3, 3.2, 2.4]], 1.7);
  addFloor(floorDark, [[6.4, -7, 11, -2.6], [6.4, 2.6, 11, 7]], 2);
  addFloor(vct, [[-3.2, -7, 3.2, -3]], 1.2);
  addFloor(marble, [[-3.2, 2.4, 3.2, 7.2]], 1.5);
  // calle afuera y marquito de la puerta, para que las ventanas no den al vacio
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), mat('#3a3c40', .95)); ground.rotation.x = -PI / 2; ground.position.y = -.06; ground.receiveShadow = true; root.add(ground);

  // ---------------------------------------------------------------- paredes
  const wallPieces = new Map();
  const pushWall = (group, m, geo) => { const k = group.uuid + m.uuid; if (!wallPieces.has(k)) wallPieces.set(k, { group, m, list: [] }); wallPieces.get(k).list.push(geo); };
  const paintAt = (w, x, z) => {
    if (w.paint === 'agency') return wallFan;
    if (w.paint === 'askitar') return wallAsk;
    if (x < -3.2) return wallFan; if (x > 3.2) return wallAsk;
    return wallCenter;
  };
  const metalFrame = mat('#6c7078', .4, .75), darkFrame = mat('#16171c', .42, .6);
  const glassM = new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: .06, metalness: .1, transparent: true, opacity: .13, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  const slat = mat('#d9d4c5', .6);

  for (const w of WALLS) {
    const horiz = w.a[1] === w.b[1];
    const u0 = horiz ? w.a[0] : w.a[1], u1 = horiz ? w.b[0] : w.b[1], c = horiz ? w.a[1] : w.a[0];
    const group = w.side ? sides[w.side] : root;
    const Bx = w.side ? SB[w.side] : B;
    const at = (u, v, t, y0, y1) => (horiz ? [(u + v) / 2, (y0 + y1) / 2, c, v - u, y1 - y0, t] : [c, (y0 + y1) / 2, (u + v) / 2, t, y1 - y0, v - u]);
    const solid = (a, b, y0, y1, m, t = T_) => {
      if (b - a < .005 || y1 - y0 < .005) return;
      const [x, y, z, sx, sy, sz] = at(a, b, t, y0, y1);
      const g = uvBox(sx, sy, sz, 2); g.translate(x, y, z); pushWall(group, m || paintAt(w, x, z), g);
    };
    const opens = (w.open || []).slice().sort((a, b) => a.x0 - b.x0);

    if (w.kind === 'ext' || w.kind === 'solid') {
      // se parte en las fronteras de pintura para que cada departamento tenga su color
      const cuts = horiz ? [-3.2, 3.2] : [];
      const paintSolid = (a, b, y0, y1) => {
        let p = a; for (const q of [...cuts.filter((v) => v > a && v < b), b]) { solid(p, q, y0, y1); p = q; }
      };
      let p = u0;
      for (const o of opens) {
        paintSolid(p, o.x0, 0, H);
        const head = o.type === 'window' ? 2.35 : 2.3, sill = o.type === 'window' ? .85 : 0;
        if (sill) paintSolid(o.x0, o.x1, 0, sill);
        paintSolid(o.x0, o.x1, head, H);
        const cx = (o.x0 + o.x1) / 2, len = o.x1 - o.x0, inward = w.side === 'N' || w.side === 'W' ? 1 : -1;
        const pos = horiz ? [cx, 0, c] : [c, 0, cx], yaw = horiz ? 0 : PI / 2;
        if (o.type === 'window') {
          const T = M(pos[0], 0, pos[2], yaw);
          const dark = pos[0] > 3.2;
          const fr = dark ? darkFrame : metalFrame;
          const parts = [part(box(len, .05, T_ + .02), fr, 0, sill + .025, 0), part(box(len, .05, T_ + .02), fr, 0, head - .025, 0), part(box(.05, head - sill, T_ + .02), fr, -len / 2 + .025, (sill + head) / 2, 0), part(box(.05, head - sill, T_ + .02), fr, len / 2 - .025, (sill + head) / 2, 0)];
          const nMull = Math.max(1, Math.round(len / 1.2));
          for (let i = 1; i < nMull; i++) parts.push(part(box(.035, head - sill, .05), fr, -len / 2 + i * len / nMull, (sill + head) / 2, 0));
          parts.push(part(box(len + .1, .03, .22), mat(dark ? '#25252e' : '#d9d3c2', .55), 0, sill - .015, inward * (horiz ? .07 : .07) * (horiz ? 1 : 1)));
          parts.push(part(box(len - .06, head - sill - .06, .01), glassM, 0, (sill + head) / 2, 0));
          Bx.place(parts, T);
          // persianas a medio bajar
          if (!dark) {
            const slats = [], n = 14, top = head - .08;
            for (let i = 0; i < n; i++) slats.push(part(box(len - .1, .004, .05), slat, 0, top - i * .045, inward * (.09), 0, 1, 1, 1, .35));
            slats.push(part(box(len - .06, .03, .05), slat, 0, top + .02, inward * .09));
            Bx.place(slats, T, { noCast: true });
          }
        } else if (o.type === 'entrance') {
          // puerta corrediza de vidrio de la entrada principal
          const fr = [part(box(len + .12, .1, T_ + .03), metalFrame, 0, head, 0), part(box(.06, head, T_ + .03), metalFrame, -len / 2, head / 2, 0), part(box(.06, head, T_ + .03), metalFrame, len / 2, head / 2, 0)];
          Bx.place(fr, M(pos[0], 0, pos[2], yaw));
          for (const s of [-1, 1]) {
            const g = new THREE.Group(); g.position.set(pos[0] + s * len / 4, 0, pos[2]);
            const pane = new THREE.Mesh(box(len / 2 - .03, head - .06, .018), glassM); pane.position.y = (head - .06) / 2 + .01; pane.userData.noAO = true; g.add(pane);
            for (const [yy, hh] of [[.03, .06], [head - .1, .06]]) { const r = new THREE.Mesh(box(len / 2 - .02, hh, .03), metalFrame); r.position.y = yy; r.castShadow = true; g.add(r); }
            for (const q of [-1, 1]) { const r = new THREE.Mesh(box(.04, head - .1, .03), metalFrame); r.position.set(q * (len / 4 - .02), (head - .06) / 2, 0); r.castShadow = true; g.add(r); }
            const hd = new THREE.Mesh(box(.02, .5, .04), mat('#d8dce2', .2, 1)); hd.position.set(-s * (len / 4 - .08), 1.05, -.03); g.add(hd);
            group.add(g);
            doors.push({ kind: 'slide', g, x: pos[0], z: pos[2], base: pos[0] + s * len / 4, dir: s, amount: len / 2 - .06, open: 0 });
          }
        }
        p = o.x1;
      }
      paintSolid(p, u1, 0, H);
      // zocalo y moldura
      const skirt = mat(w.paint === 'askitar' || (!w.paint && false) ? '#1b1b22' : '#4c3f33', .55);
      if (w.kind === 'solid') { solid(u0, u1, 0, .1, skirt, T_ + .025); }
    } else if (w.kind === 'half') {
      solid(u0, u1, 0, 1.05, wallCenter, .12);
      const [x, , z, sx, , sz] = at(u0, u1, .28, 1.05, 1.09);
      B.place([part(box(sx + .06, .04, sz), walnut, x, 1.07, z)]);
    } else if (w.kind === 'slats') {
      const parts = [];
      for (let u = u0; u <= u1 + .001; u += .13) parts.push(part(rbox(.05, 2.72, .07, .008), walnut, u, 1.36, c));
      parts.push(part(box(u1 - u0 + .1, .06, .12), mat('#17181c', .4, .5), (u0 + u1) / 2, .03, c), part(box(u1 - u0 + .1, .06, .12), mat('#17181c', .4, .5), (u0 + u1) / 2, 2.72, c));
      B.place(parts);
    } else if (w.kind === 'glass') {
      const dark = (horiz ? (u0 + u1) / 2 : c) > 0;
      const fr = dark ? darkFrame : metalFrame;
      let p = u0;
      const panes = (a, b) => {
        if (b - a < .02) return;
        const n = Math.max(1, Math.round((b - a) / 1.15));
        for (let i = 0; i < n; i++) {
          const q0 = a + (b - a) * i / n, q1 = a + (b - a) * (i + 1) / n;
          const [x, y, z, sx, sy, sz] = at(q0 + .01, q1 - .01, .012, .12, 2.55);
          B.add(box(sx, sy, sz), glassM, M(x, y, z), { noCast: true });
          const [px, , pz, psx, , psz] = at(q1 - .018, q1 + .018, .06, 0, 2.6);
          if (i < n - 1) B.place([part(box(psx, 2.6, psz), fr, px, 1.3, pz)]);
        }
        const [bx, , bz, bsx, , bsz] = at(a, b, .1, 0, .12);
        B.place([part(box(bsx, .12, bsz), fr, bx, .06, bz)]);
      };
      for (const o of opens) {
        panes(p, o.x0);
        const cx = (o.x0 + o.x1) / 2, len = o.x1 - o.x0, x = horiz ? cx : c, z = horiz ? c : cx;
        // marco y puerta que se abre sola cuando alguien se acerca
        B.place([part(box(.05, 2.2, .1), fr, -len / 2, 1.1, 0), part(box(.05, 2.2, .1), fr, len / 2, 1.1, 0), part(box(len + .05, .4, .1), fr, 0, 2.4, 0)], M(x, 0, z, horiz ? 0 : PI / 2));
        const piv = new THREE.Group(); piv.position.set(x - (horiz ? len / 2 - .03 : 0), 0, z - (horiz ? 0 : len / 2 - .03));
        const dg = new THREE.Group(); piv.add(dg);
        const pane = new THREE.Mesh(box(len - .08, 2.1, .018), glassM); pane.position.set((len - .08) / 2, 1.08, 0); pane.userData.noAO = true; dg.add(pane);
        const fs = [[(len - .08) / 2, .05, len - .06, .1], [(len - .08) / 2, 2.12, len - .06, .07], [.02, 1.08, .05, 2.1], [len - .1, 1.08, .05, 2.1]];
        for (const [fx, fy, fw, fh] of fs) { const f = new THREE.Mesh(box(fw, fh, .035), fr); f.position.set(fx, fy, 0); f.castShadow = true; dg.add(f); }
        const hd = new THREE.Mesh(rbox(.025, .22, .04, .008), mat('#d8dce2', .2, 1)); hd.position.set(len - .15, 1.05, .03); dg.add(hd);
        if (o.sign) {
          const sm = picMat(512, 170, (cc, W2, H2) => {
            cc.fillStyle = dark ? '#191821' : '#22344f'; cc.fillRect(0, 0, W2, H2);
            cc.fillStyle = dark ? '#ff7fc8' : '#ffffff'; cc.textAlign = 'center'; cc.font = '700 54px Arial, sans-serif';
            const ls = o.sign.split('\n'); cc.fillText(ls[0], W2 / 2, ls[1] ? 72 : 100);
            if (ls[1]) { cc.fillStyle = '#d7d9df'; cc.font = '34px Arial, sans-serif'; cc.fillText(ls[1], W2 / 2, 128); }
          });
          for (const zs of [-1, 1]) { const pl = new THREE.Mesh(plane(.48, .16), sm); pl.position.set((len - .08) / 2, 1.58, zs * .011); if (zs < 0) pl.rotation.y = PI; dg.add(pl); }
        }
        if (!horiz) piv.rotation.y = -PI / 2;
        root.add(piv);
        doors.push({ kind: 'swing', g: piv, x, z, base: piv.rotation.y, dir: horiz ? -1 : 1, amount: 1.45, open: 0 });
        p = o.x1;
      }
      panes(p, u1);
      const [tx, , tz, tsx, , tsz] = at(u0, u1, .1, 2.55, 2.9);
      B.place([part(box(tsx, H - 2.55, tsz), mat(dark ? '#25252e' : '#e4e0d4', .7), tx, (2.55 + H) / 2, tz)]);
    }
  }
  for (const it of wallPieces.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(it.list), it.m);
    mesh.castShadow = true; mesh.receiveShadow = true; it.group.add(mesh);
  }
  // zocalo de las exteriores
  const skFan = mat('#4c3f33', .55), skAsk = mat('#15151b', .5), skMid = mat('#57504a', .55);
  for (const [side, x, z, sx, sz, m] of [
    ['N', -7.1, -6.92, 7.8, .02, skFan], ['N', 7.1, -6.92, 7.8, .02, skAsk], ['S', -7.1, 6.92, 7.8, .02, skFan], ['S', 7.1, 6.92, 7.8, .02, skAsk],
    ['S', -2.1, 6.92, 2.2, .02, skMid], ['S', 2.1, 6.92, 2.2, .02, skMid], ['N', 0, -6.92, 6.4, .02, skMid],
    ['W', -10.92, 0, .02, 14, skFan], ['E', 10.92, 0, .02, 14, skAsk]]) SB[side].place([part(box(sx, .1, sz), m, x, .05, z)]);

  // ---------------------------------------------------------------- techo
  const tileTex = canvasTex(256, 256, (c, w) => {
    const r = seeded(5); c.fillStyle = '#e4e3dd'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(90,88,80,${.04 + r() * .12})`; c.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2); }
    c.strokeStyle = '#9b9a93'; c.lineWidth = 5; c.strokeRect(0, 0, w, w);
  }, { repeat: true });
  const tiles = new THREE.Mesh(floorRect(-11, -7, -3.2, 7, .6, 0), new THREE.MeshStandardMaterial({ map: tileTex, roughness: .9, side: THREE.DoubleSide })); tiles.position.y = H; ceiling.add(tiles);
  const white = new THREE.Mesh(floorRect(-3.2, -7, 3.2, 7, 1, 0), new THREE.MeshStandardMaterial({ color: '#efeeea', roughness: .9, side: THREE.DoubleSide })); white.position.y = H; ceiling.add(white);
  const dark = new THREE.Mesh(floorRect(3.2, -7, 11, 7, 1, 0), new THREE.MeshStandardMaterial({ color: '#17161e', roughness: .85, side: THREE.DoubleSide })); dark.position.y = H; ceiling.add(dark);
  for (const [x, z] of [[-9.3, -5], [-9.3, -1.5], [-7, -1.5], [-9.3, 1.5], [-7, 1.5], [-4.9, -5.5], [-4.9, -2.5], [-4.9, 0], [-4.9, 2.5], [-4.9, 5], [-9.3, 5], [-7.6, 5]]) Bc.place(P.ceilingPanel(1.2, .6), M(x, H - .02, z), { noCast: true });
  for (const [x, z] of [[-1.5, -5], [1.5, -5], [0, -.5], [-1.9, 4.8], [1.9, 4.8]]) Bc.place(model('modern_ceiling_lamp_01'), M(x, H - .66, z, 0, .7), { noCast: true });
  const emis = glow('#fff1d8', 3.5);
  for (const [x, z] of [[-1.5, -5], [1.5, -5], [0, -.5], [-1.9, 4.8], [1.9, 4.8]]) Bc.add(sph(.075, 12, 8), emis, M(x, H - .55, z), { noCast: true });
  for (const [x, z] of [[4.9, -5], [4.9, -3], [4.9, 0], [4.9, 3.4], [4.9, 5.6], [7.5, 0], [9.5, 0]]) {
    Bc.place(model('hanging_industrial_lamp'), M(x, H - .95, z, 0, .68), { noCast: true });
    Bc.add(sph(.065, 12, 8), glow('#ffe3b5', 4.5), M(x, H - .9, z), { noCast: true });
  }
  for (const [x, z] of [[8.7, -5.5], [8.0, -3.9], [9.8, -3.9], [8.2, 4.3], [9.2, 4.3], [10.2, 4.3]]) Bc.place(P.trackLight(), M(x, H, z), { noCast: true });
  // tiras LED del lado Askitar
  const ledA = glow('#ff3fa4', 2.4), ledB = glow('#3fb4ff', 2.4);
  const strips = [[3.25, -5, .03, 3.9, ledA, 'E'], [3.25, 5, .03, 4, ledB], [7.1, -6.9, 7.7, .03, ledB, 'N'], [7.1, 6.9, 7.7, .03, ledA, 'S'], [10.92, 0, .03, 14, ledB, 'E']];
  for (const [x, z, sx, sz, m, s] of strips) (s && s !== 'E' ? Bc : Bc).add(box(sx, .025, sz), m, M(x, H - .03, z), { noCast: true });

  // ---------------------------------------------------------------- utilidades de colocacion
  const place = (parts, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx) => B.place(parts, M(x, y, z, yaw, sx, sy, sz));
  const fp = (id, x, y, z, yaw = 0, w = null, h = null, d = null) => { const s = fitScale(id, w, h, d); B.place(model(id), M(x, y, z, yaw, s[0], s[1], s[2])); };
  const onWallPic = (pic, w, h, x, y, z, yaw, frame) => place(P.framed(pic, w, h, frame), x, y, z, yaw);
  const plant = (x, z, big = true, y = 0) => { if (big) fp('potted_plant_01', x, y, z, x * 3 + z, null, 1.35); else fp('potted_plant_02', x, y, z, x + z * 2, null, .84); };

  // ---------------------------------------------------------------- escritorios
  const chairFan = P.officeChair('#2e333d'), chairAsk = P.officeChair('#3a2a4a'), chairBoss = P.officeChair('#1b1b1f');
  const blackMetal = mat('#17181c', .42, .5);
  function modernDesk(w, d, led) {
    const p = [part(rbox(w, .04, d, .012), walnut, 0, .735, 0)];
    for (const s of [-1, 1]) p.push(part(rbox(.05, .7, d - .1, .012), blackMetal, s * (w / 2 - .08), .36, 0));
    p.push(part(box(w - .2, .08, .02), blackMetal, 0, .65, 0));
    if (led) p.push(part(box(w - .12, .008, .012), glow(led, 3), 0, .71, d / 2 - .04));
    return p;
  }
  function makeScreen(key, w, h, T, lx, ly, lz) {
    const cvs = document.createElement('canvas'); cvs.width = 320; cvs.height = Math.round(320 * h / w);
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ color: '#000000', roughness: .22, metalness: 0, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.35 });
    const mesh = new THREE.Mesh(plane(w, h), m);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(new THREE.Matrix4().multiplyMatrices(T, M(lx, ly, lz, PI)));
    root.add(mesh);
    (screens[key] = screens[key] || []).push({ cvs, ctx: cvs.getContext('2d'), tex, m, phase: Math.random() * 10 });
  }
  const r = seeded(21);
  for (const d of Object.values(DESKS)) {
    const T = M(d.x, 0, d.z, d.yaw);
    const isAsk = d.dept === 'askitar';
    // la persona queda en -z local, el monitor mira hacia ella
    if (d.boss) {
      if (isAsk) B.place(modernDesk(d.w, d.d, '#ff3fa4'), T);
      else { const s = fitScale('metal_office_desk', d.w, .75, d.d); B.place(model('metal_office_desk', { tint: '#7d5a3c' }), new THREE.Matrix4().multiplyMatrices(T, M(0, 0, 0, 0, s[0], s[1], s[2]))); }
    } else if (isAsk) B.place(modernDesk(d.w, d.d, r() > .5 ? '#3fb4ff' : '#a04fff'), T);
    else { const s = fitScale('metal_office_desk', d.w, .75, d.d); B.place(model('metal_office_desk'), new THREE.Matrix4().multiplyMatrices(T, M(0, 0, 0, 0, s[0], s[1], s[2]))); }
    B.place(d.boss ? chairBoss : (isAsk ? chairAsk : chairFan), M(d.seat.x, 0, d.seat.z, d.yaw));
    const top = .75;
    const at = (parts, lx, lz, ly = 0, ry = 0, s = 1) => B.place(parts, new THREE.Matrix4().multiplyMatrices(T, M(lx, top + ly, lz, ry, s)));
    // monitores
    const two = isAsk && !d.boss;
    if (two) {
      at(P.monitor(.5, .3), -.3, .12, 0, PI - .22); at(P.monitor(.5, .3), .3, .12, 0, PI + .22);
      const a = M(-.3, top, .12, -.22), b = M(.3, top, .12, .22);
      makeScreen(d.key, .482, .282, new THREE.Matrix4().multiplyMatrices(T, a), 0, .13 + .15, -.021);
      makeScreen(d.key, .482, .282, new THREE.Matrix4().multiplyMatrices(T, b), 0, .13 + .15, -.021);
    } else {
      at(P.monitor(.6, .36), 0, .14, 0, PI);
      makeScreen(d.key, .582, .342, T, 0, top + .13 + .18, .14 - .021);
    }
    at(P.keyboard(isAsk ? '#17181c' : '#d9d5c9', isAsk ? '#26272e' : '#efeadd'), 0, -.2);
    at(P.mouseSet(isAsk ? '#2a2333' : '#23262e'), .34, -.2);
    if (!isAsk) at(P.deskPhone(), -.58, .02, 0, PI + .3);
    at(P.paperStack(3 + Math.floor(r() * 5), Math.floor(r() * 30)), isAsk ? -.62 : .55, .12, 0, r() * .5);
    if (r() > .35) at(P.penCup(), .62, -.02);
    if (r() > .5) at(P.mug(['#ffffff', '#c0242f', '#2f6fd5', '#f2c94c'][Math.floor(r() * 4)]), -.42, -.22, 0, r() * 6);
    // notas pegadas al borde del monitor
    if (r() > .4 && !two) for (let i = 0; i < 2; i++) at([part(box(.05, .05, .001), mat(['#f2e36b', '#ff9fb2', '#9fe8ff'][i], .8), 0, 0, 0)], -.33 + i * .66, .12, .22 + i * .03, PI);
    B.place(P.trashCan(), M(d.x + (d.yaw === 0 ? 1 : -1) * (d.w / 2 + .15), 0, d.z, 0));
  }

  // ---------------------------------------------------------------- objetos personales (clic para ver que es)
  const personal = (key, list) => {
    const d = DESKS[key], T = M(d.x, 0, d.z, d.yaw);
    for (const it of list) {
      B.place(it.parts, new THREE.Matrix4().multiplyMatrices(T, M(it.x, .75 + (it.y || 0), it.z, it.ry || 0, it.s || 1)));
      if (it.name) { const wp = new THREE.Vector3(it.x, .75 + (it.y || 0) + .05, it.z).applyMatrix4(T); label(it.name, wp.x, wp.y, wp.z, it.r || .14); }
    }
  };
  const photoCat = picMat(128, 160, (c, w, h) => {
    c.fillStyle = '#cfc4a6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6b5a3a'; c.beginPath(); c.ellipse(64, 104, 36, 44, 0, 0, 7); c.fill(); c.beginPath(); c.arc(64, 58, 28, 0, 7); c.fill();
    c.beginPath(); c.moveTo(40, 44); c.lineTo(46, 18); c.lineTo(60, 36); c.fill(); c.beginPath(); c.moveTo(88, 44); c.lineTo(82, 18); c.lineTo(68, 36); c.fill();
    c.fillStyle = '#f2e36b'; c.beginPath(); c.arc(54, 56, 5, 0, 7); c.arc(74, 56, 5, 0, 7); c.fill();
  });
  const frame = (pic) => [...model('standing_picture_frame_01')];
  const bossMug = picMat(256, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.textAlign = 'center'; c.font = '700 30px Georgia, serif'; c.fillText("WORLD'S BEST", w / 2, 52); c.fillText('BOSS', w / 2, 92); });

  personal('agency.M', [
    { parts: P.mug('#ffffff', bossMug), x: -.62, z: -.18, ry: PI, name: 'Taza "World\'s Best Boss"', r: .12 },
    { parts: model('desk_lamp_arm_01'), x: .78, z: .2, ry: PI + .5, s: .55, name: 'Lámpara de Michael', r: .22 },
    { parts: model('standing_picture_frame_02'), x: -.78, z: .22, ry: PI + .4, s: .85 },
  ]);
  personal('askitar.A1', [
    { parts: P.jello(), x: .6, z: -.1, name: 'La engrapadora de Dwight, otra vez en gelatina', r: .16 },
    { parts: P.bobblehead(), x: -.68, z: .22, ry: PI, s: 1.1, name: 'Bobblehead de Dwight', r: .1 },
    { parts: P.beet(), x: -.72, z: -.05, name: 'Remolacha de la granja de Dwight', r: .1 },
  ]);
  personal('askitar.A2', [
    { parts: model('rubber_duck_toy'), x: -.66, z: .24, ry: PI, s: .35, name: 'Pato de hule de Jim', r: .1 },
    { parts: [part(box(.06, .004, .05), mat('#f2f0e8', .85), 0, 0, 0)], x: .62, z: -.2, ry: .7, name: 'Fútbol de papel', r: .08 },
  ]);
  personal('askitar.B1', [
    { parts: P.candyJar(), x: -.66, z: .18, name: 'Dulces de Pam', r: .12 },
    { parts: model('binder_notebook'), x: .6, z: .05, ry: .3, s: .5, name: 'Cuaderno de bocetos de Pam', r: .15 },
  ]);
  personal('askitar.B2', [
    { parts: model('classic_laptop'), x: -.6, z: .05, ry: PI + .3, s: .5, name: 'Laptop de la startup de Ryan', r: .18 },
    { parts: [part(rbox(.075, .012, .15, .008), mat('#17181c', .2, .5))], x: .6, z: -.2, ry: .2, name: 'El otro celular de Ryan', r: .09 },
  ]);
  personal('agency.A1', [
    { parts: model('standing_picture_frame_01'), x: -.68, z: .22, ry: PI + .3, s: .8, name: 'Foto del gato de Angela', r: .12 },
    { parts: model('clipboard'), x: .58, z: -.2, ry: .1, s: .8, name: 'Auditoría de Angela', r: .15 },
  ]);
  personal('agency.A2', [{ parts: [part(box(.07, .001, .07), mat('#ff8fb0', .8), 0, 0, 0)], x: .58, z: -.2, ry: .5, name: 'Notita con corazón de Erin', r: .08 }]);
  personal('agency.A3', [{ parts: [...model('ceramic_vase_01').map((q) => ({ ...q })), ...P.flowers().map((q) => ({ ...q, m: new THREE.Matrix4().multiplyMatrices(M(0, .38), q.m) }))], x: -.66, z: .2, s: .55, name: 'Flores de Phyllis', r: .15 }]);
  personal('agency.B1', [{ parts: model('stationery_supplies'), x: .58, z: .06, ry: PI, s: .9, name: 'Formularios de Toby', r: .15 }]);
  personal('agency.B2', [{ parts: model('potted_plant_04'), x: -.66, z: .2, s: .8, name: 'Suculenta de Meredith', r: .12 }]);
  personal('askitar.A3', [{ parts: [part(rbox(.075, .012, .15, .008), mat('#ff5a9c', .25, .3))], x: .58, z: -.2, ry: -.3, name: 'El celular de Kelly', r: .09 }, { parts: P.flowers(), x: -.68, z: .22, s: .7 }]);
  personal('askitar.A4', [{ parts: P.deskMic(), x: -.62, z: .05, name: 'Micrófono de Andy', r: .14 }]);
  personal('askitar.B3', [{ parts: paperCrossword(), x: .55, z: -.14, ry: .2, name: 'Crucigrama de Stanley', r: .15 }, { parts: P.mug('#b02a2a'), x: -.5, z: -.2 }]);
  personal('askitar.M', [
    { parts: model('desk_lamp_arm_01'), x: .8, z: .2, ry: PI + .5, s: .55 },
    { parts: P.deskMic(), x: -.72, z: .05, name: 'Micrófono de Jan', r: .15 },
    { parts: model('alarm_clock_01'), x: -.8, z: -.24, ry: PI, s: .5 },
  ]);
  function paperCrossword() { return [part(box(.24, .002, .3), picMat(256, 320, (c, w, h) => { c.fillStyle = '#f2efe4'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; const s = 20; for (let j = 0; j < 11; j++) for (let i = 0; i < 10; i++) { c.strokeRect(24 + i * s, 40 + j * s, s, s); if ((i * 7 + j * 3) % 5 === 0) c.fillRect(24 + i * s, 40 + j * s, s, s); } c.font = '700 22px Georgia, serif'; c.fillText('CRUCIGRAMA', 40, 28); }), 0, 0, 0)]; }

  // ---------------------------------------------------------------- COCINA
  const cab = '#efece3', cabDark = '#2d3a4a';
  B.place([part(box(4.84, .86, .6), mat(cabDark, .55), 0, .43, -6.65), part(rbox(4.9, .04, .64, .008), marble, 0, .9, -6.65)]);
  for (let x = -2.1; x <= 2.1; x += .6) {
    B.place(P.drawerFront(.58, .78, cabDark), M(x, .44, -6.34));
  }
  B.place([part(box(4.84, .55, .02), marble, 0, 1.2, -6.92)]);
  for (const [a, b] of [[-2.4, -.45], [.45, 2.4]]) {
    const n = Math.round((b - a) / .49), w = (b - a) / n;
    B.place([part(box(b - a, .72, .34), mat(cab, .5), (a + b) / 2, 1.85, -6.76)]);
    for (let i = 0; i < n; i++) B.place(P.drawerFront(w, .7, cab, mat('#55595f', .3, .9)), M(a + w * (i + .5), 1.85, -6.585));
  }
  B.place(P.sink(), M(0, .925, -6.6));
  B.place(P.coffeeMachine(), M(-1.15, .92, -6.68)); label('Cafetera. Nunca limpia.', -1.15, 1.1, -6.6, .25);
  fp('vintage_microwave', 1.5, .92, -6.68, 0, .56); label('Microondas con olor a pescado', 1.5, 1.1, -6.6, .28);
  fp('vintage_electric_kettle', -.42, .92, -6.75, .4, null, .24);
  B.place(P.mug('#c0242f'), M(-.78, .92, -6.45, .5)); B.place(P.mug('#ffffff'), M(-.7, .92, -6.58, 2));
  // nevera con notas y maquina de snacks
  B.place(P.fridge(), M(-2.78, 0, -6.6)); label('Nevera. Nota: "No tocar el yogur de Angela"', -2.78, 1.3, -6.25, .5);
  const snacks = screenMat(256, 620, (c, w, h) => {
    c.fillStyle = '#0b0e14'; c.fillRect(0, 0, w, h);
    const q = seeded(3), cols = ['#f2c94c', '#e84a5f', '#3fa8ff', '#57d68d', '#ff8a3c', '#c58cff', '#f7f7f2'];
    for (let j = 0; j < 6; j++) { c.fillStyle = '#272c36'; c.fillRect(0, 96 + j * 100, w, 6); for (let i = 0; i < 5; i++) { const cl = cols[Math.floor(q() * 7)]; c.fillStyle = cl; roundRect(c, 10 + i * 48, 22 + j * 100, 38, 72, 5); c.fill(); c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(16 + i * 48, 32 + j * 100, 26, 8); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(16 + i * 48, 62 + j * 100, 26, 22); } }
  }, 1.15);
  B.place(P.vending(snacks), M(2.72, 0, -6.58)); label('Máquina de snacks', 2.72, 1.2, -6.2, .5);
  // mesa de almuerzo
  B.place([part(rbox(1.84, .04, .9, .012), oak, 0, .73, -4.6), ...[[-.8, -.36], [.8, -.36], [-.8, .36], [.8, .36]].map(([x, z]) => part(cyl(.022, .022, .71, 10), mat('#c8ccd2', .3, .9), x, .355, -4.6 + z))]);
  B.place(P.fruitBowl(), M(-.4, .75, -4.62)); B.place(P.napkins(), M(.05, .75, -4.72, .3)); B.place(P.pizzaBox(), M(.46, .75, -4.58, .4)); label('Pizza de la reunión de ayer', .46, .85, -4.58, .25);
  for (const s of SHARED.lunch) { const sc = fitScale('plastic_monobloc_chair_01', null, .86); B.place(model('plastic_monobloc_chair_01', { tint: '#e9e6dc' }), M(s.x, 0, s.z, s.yaw, sc[0])); }
  fp('WetFloorSign_01', 2.2, 0, -3.5, .6, null, .6); label('Piso mojado desde 2019', 2.2, .4, -3.5, .3);
  B.place(P.trashCan(), M(-2.75, 0, -5.2)); B.place(P.trashCan(), M(2.8, 0, -5.2));
  // cartelera del comite de fiestas
  const cork = picMat(512, 340, (c, w, h) => {
    c.fillStyle = '#b48a58'; c.fillRect(0, 0, w, h); const q = seeded(4);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(70,45,20,${q() * .3})`; c.fillRect(q() * w, q() * h, 2, 2); }
    const note = (x, y, wd, ht, bg, t, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = bg; c.fillRect(0, 0, wd, ht); c.fillStyle = '#20202a'; c.font = '700 19px Arial'; wrap(c, t, 8, 26, wd - 14, 22); c.fillStyle = '#d83a3a'; c.beginPath(); c.arc(wd / 2, 6, 6, 0, 7); c.fill(); c.restore(); };
    note(22, 24, 150, 110, '#f2e36b', 'COMITÉ DE FIESTAS: viernes', -.04); note(190, 18, 130, 120, '#fff', 'Empleado del mes: Kevin (?)', .05);
    note(340, 30, 150, 100, '#9fe8ff', 'Se busca grapadora', -.03); note(40, 170, 170, 130, '#ffb3c7', 'No dejar comida en la nevera más de 1 semana', .03);
    note(250, 175, 220, 125, '#fff', 'Clase de karate con Dwight, jueves', -.02);
  });
  onWallPic(cork, 1.1, .73, -2.2, 1.68, -6.915 + .02, 0, '#5a4630');
  fp('wall_clock', .0, 2.2, -6.92, 0, null, .32);

  // ---------------------------------------------------------------- SALA
  const rug = new THREE.Mesh(plane(4.6, 3.1), new THREE.MeshStandardMaterial({
    roughness: 1, map: canvasTex(1024, 690, (c, w, h) => {
      c.fillStyle = '#3f4a5a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9c9a8'; c.lineWidth = 14; c.strokeRect(34, 34, w - 68, h - 68); c.lineWidth = 4; c.strokeRect(62, 62, w - 124, h - 124);
      const q = seeded(8); for (let i = 0; i < 26000; i++) { c.fillStyle = `rgba(${q() > .5 ? '255,255,255' : '0,0,0'},.05)`; c.fillRect(q() * w, q() * h, 2, 3); }
    }),
  }));
  rug.rotation.x = -PI / 2; rug.position.set(0, .006, -.3); rug.receiveShadow = true; root.add(rug);
  fp('sofa_03', 0, 0, .92, PI, 2.76, null, .93); label('Sofá para siestas', 0, .7, .92, .7);
  fp('sofa_02', 2.5, 0, -.5, -PI / 2, 1.81, null, .9);
  fp('modern_arm_chair_01', -2.4, 0, -.5, PI / 2, null, .9);
  fp('modern_coffee_table_01', 0, 0, -.35, PI / 2, null, .39);
  const mag = (c1) => picMat(128, 170, (c, w, h) => { c.fillStyle = c1; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '700 22px Georgia'; c.fillText('OFICINA', 14, 34); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(16, 56, 96, 72); c.fillRect(16, 138, 70, 8); });
  B.place([part(box(.21, .006, .28), mag('#b02a4a'), -.3, .395, -.4, .3)]); B.place([part(box(.21, .006, .28), mag('#2a60b0'), -.22, .402, -.33, -.2)]);
  B.place(P.mug('#ffffff'), M(.35, .385, -.32, 1));
  // consola y televisor con la actividad en vivo
  B.place([part(rbox(2.0, .5, .4, .012), walnut, 0, .25, -2.75)]);
  for (const x of [-.5, .5]) B.place([part(box(.96, .42, .01), mat('#3a2b20', .5), x, .25, -2.545), part(rbox(.14, .012, .02, .005), mat('#c8ccd2', .25, 1), x, .4, -2.535)]);
  tvs.lounge = makeTV(1.5, .86, 0, 1.0, -2.78, 0, 1024, 590);
  fp('boombox', .78, .5, -2.82, 0, null, .2);
  fp('potted_plant_04', -.8, .5, -2.8, 0, null, .26);
  // ---------------------------------------------------------------- RECEPCION
  B.place([part(rbox(2.7, 1.0, .68, .03), walnut, 0, .5, 3.95), part(rbox(2.8, .05, .76, .014), marble, 0, 1.03, 3.95)]);
  const logoPlate = screenMat(1024, 256, (c, w, h) => {
    c.fillStyle = '#0d0e14'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.fillStyle = '#f7f3e6'; c.font = '700 110px Georgia, serif'; c.fillText('OFICINA DE AGENTES', w / 2, 118);
    c.font = '46px Arial, sans-serif'; c.fillStyle = '#7fb3ff'; c.textAlign = 'right'; c.fillText('Agencia', w / 2 - 34, 192); c.fillStyle = '#888'; c.textAlign = 'center'; c.fillText('+', w / 2, 192); c.fillStyle = '#ff7fc8'; c.textAlign = 'left'; c.fillText('Askitar', w / 2 + 34, 192);
  }, 1.6);
  B.add(plane(1.9, .475), logoPlate, M(0, 1.75, 2.45), { noCast: true }); B.add(box(1.96, .53, .03), mat('#15161b', .4), M(0, 1.75, 2.43));
  B.add(plane(1.9, .475), logoPlate, M(0, 1.75, 2.35, PI), { noCast: true }); B.add(box(1.96, .53, .03), mat('#15161b', .4), M(0, 1.75, 2.37));
  label('Oficina de Agentes: Agencia + Estudio', 0, 1.75, 2.45, .8);
  B.add(box(1.8, .03, .004), glow('#ffe7c2', 3), M(0, .72, 4.292), { noCast: true });
  B.place(chairFan, M(0, 0, 3.1, 0));
  B.place(P.monitor(.5, .3), M(-.5, 1.055, 3.82, PI));
  B.place(P.bell(), M(.75, 1.055, 4.08)); label('Timbre de recepción', .75, 1.1, 4.08, .1);
  B.place(P.candyJar(), M(-.1, 1.055, 4.1)); label('Dulces para las visitas', -.1, 1.15, 4.1, .12);
  B.place(P.deskPhone(), M(.45, 1.055, 3.85, PI + .2));
  B.place(P.paperStack(5, 7), M(1.0, 1.055, 3.8, .2));
  for (const s of SHARED.lounge.slice(5)) fp('mid_century_lounge_chair', s.x, 0, s.z, s.yaw, null, .85);
  B.place([part(rbox(.5, .03, .28, .01), walnut, -2.6, .46, 5.6), part(cyl(.015, .015, .45, 8), mat('#17181c', .4, .5), -2.6, .225, 5.6)]);
  fp('CoffeeCart_01', 2.62, 0, 5.38, -PI / 2, null, 1.72); label('Carrito de café, cortesía de la casa', 2.62, 1.2, 5.38, .9);
  const mat_ = new THREE.Mesh(plane(1.9, .95), mat('#2c2c30', 1)); mat_.rotation.x = -PI / 2; mat_.position.set(0, .007, 6.35); mat_.receiveShadow = true; root.add(mat_);
  plant(-2.95, 3.0); plant(2.95, 3.0); plant(-3.0, 6.75, false);
  fp('fire_alarm', 1.4, 1.5, 6.91, PI, null, .14);

  // ---------------------------------------------------------------- BULLPEN AGENCIA
  for (let z = -1.65; z <= 1.7; z += .475) { place(P.filingCabinet(2), -10.73, 0, z, PI / 2); }
  fp('planter_box_01', -10.72, .68, -1.1, PI / 2, null, null, .34);
  fp('cardboard_box_01', -10.72, .68, .2, PI / 2 + .1, null, .26);
  fp('binder_notebook', -10.72, .68, 1.2, .4, null, null, .24);
  place(P.copier(), -3.62, 0, -2.52, -PI / 2); label('Copiadora. Atascada desde el lunes.', -3.62, 1.05, -2.52, .45);
  B.place(P.paperStack(9, 2), M(-3.6, 1.0, -2.52));
  place(P.waterCooler(), -3.52, 0, 2.12); label('Enfriador: donde pasan los chismes', -3.52, 1.2, 2.12, .35);
  plant(-3.5, -1.5, false); plant(-6.1, -6.7); plant(-6.1, 6.7); plant(-10.6, -2.3, false);
  // cartel Agencia, tablero y pantalla sobre el muro de la cocina
  const fanSign = picMat(1024, 200, (c, w, h) => {
    c.fillStyle = '#1f3a6b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = '700 92px Arial, sans-serif'; c.fillText('AGENCIA', w / 2 - 170, 128); c.font = '300 72px Arial, sans-serif'; c.fillStyle = '#b8d0ff'; c.fillText('MANAGEMENT', w / 2 + 200, 126);
  });
  B.place([part(rbox(2.3, .45, .04, .01), mat('#16233f', .45), 0, 0, 0), part(plane(2.26, .44), fanSign, 0, 0, .022)], M(-3.24, 2.42, -5, -PI / 2));
  const board = (title, steps, ink, deptName) => picMat(1024, 560, (c, w, h) => {
    c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(120,130,140,.08)'; for (let i = 0; i < 24; i++) c.fillRect(Math.random() * w, Math.random() * h, 180, 6);
    c.fillStyle = ink; c.font = '700 54px "Comic Sans MS", cursive'; c.fillText(title, 40, 70);
    steps.forEach((s, i) => {
      const x = 48 + (i % 4) * 240, y = 150 + Math.floor(i / 4) * 170;
      c.strokeStyle = ink; c.lineWidth = 5; roundRect(c, x, y, 190, 100, 14); c.stroke();
      c.fillStyle = '#222'; c.font = '700 26px "Comic Sans MS", cursive'; wrap(c, s, x + 14, y + 42, 165, 30);
      if (i < steps.length - 1 && i % 4 !== 3) { c.strokeStyle = '#c0242f'; c.beginPath(); c.moveTo(x + 192, y + 50); c.lineTo(x + 236, y + 50); c.lineTo(x + 224, y + 40); c.moveTo(x + 236, y + 50); c.lineTo(x + 224, y + 60); c.stroke(); }
    });
    c.fillStyle = '#777'; c.font = 'italic 26px "Comic Sans MS", cursive'; c.fillText('Nunca pedir Linktree. ' + deptName, 44, 526);
  });
  const whiteboard = (pic, x, y, z, yaw, w = 1.5, h = .82) => B.place([part(rbox(w + .05, h + .05, .03, .006), mat('#b7bbc2', .35, .8), 0, 0, 0), part(plane(w, h), pic, 0, 0, .017), part(box(w * .6, .02, .05), mat('#b7bbc2', .35, .8), 0, -h / 2 - .02, .03)], M(x, y, z, yaw));
  whiteboard(board('Cliente nuevo', ['Brief', 'Investigación', 'Guion', 'Producción', 'Edición', 'Revisión', 'Programación', 'Publicación'], '#1f4bb8', '- Agencia'), -3.25, 1.45, -5.95, -PI / 2);
  tvs.agency = makeTV(1.5, .86, -3.27, 1.48, -3.98, -PI / 2, 1024, 590);
  const poster = (t, s, bg, art) => P.posterPic(t, s, bg, '#ffffff', art);
  onWallPic(poster('LIDERAZGO', 'Un buen jefe delega. Uno mejor pide café.', '#2c3e50', (c, w, h) => { c.fillStyle = '#e8b923'; c.beginPath(); c.moveTo(w / 2, 90); c.lineTo(w - 90, h - 230); c.lineTo(90, h - 230); c.fill(); }), .62, .82, -10.915 + .02, 1.5, -2.65, PI / 2);
  onWallPic(poster('TRABAJO EN EQUIPO', 'Nadie sabe quién se comió el yogur.', '#5e3a6b', (c, w, h) => { c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(90 + i * 84, 280 - (i % 2) * 60, 36, 0, 7); c.fill(); } }), .62, .82, -10.915 + .02, 1.5, 2.65, PI / 2);
  onWallPic(poster('PERSISTENCIA', 'La copiadora volverá a atascarse.', '#1f6f5c', (c, w, h) => { c.fillStyle = '#d9d3c2'; c.fillRect(120, 150, w - 240, 240); }), .62, .82, -6.7, 1.5, 6.915 - .02, PI);
  // ---------------------------------------------------------------- GERENCIA MICHAEL
  const cabinet = (x, z, yaw, w = 2.5, d = .36) => { const s = fitScale('modern_wooden_cabinet', w, null, d); B.place(model('modern_wooden_cabinet'), M(x, 0, z, yaw, s[0], .9, s[2])); return .9 * model('modern_wooden_cabinet').length; };
  cabinet(-9.3, -6.75, 0);
  const cabTop = modelTop('modern_wooden_cabinet') * .9;
  for (let i = 0; i < 6; i++) { place(P.dundie(), -10.3 + i * .22, cabTop, -6.76); }
  label('Los Dundies: cada año, los premios de Michael', -9.75, cabTop + .1, -6.76, .55);
  fp('Megaphone_01', -8.9, cabTop, -6.74, .8, null, .22); label('Megáfono: "¡Reunión en la sala!"', -8.9, cabTop + .1, -6.7, .22);
  fp('book_encyclopedia_set_01', -8.3, cabTop, -6.78, 0, .5);
  fp('wooden_bookshelf_worn', -7.2, 0, -6.72, 0, 1.0, null, .36); label('Libros que Michael nunca abrió', -7.2, 1.2, -6.65, .55);
  fp('sofa_02', -10.46, 0, -4.03, PI / 2, 1.82, null, .85); label('Sofá de Michael', -10.46, .6, -4.03, .6);
  fp('modern_arm_chair_01', -9.75, 0, -4.45, PI, null, .85); fp('modern_arm_chair_01', -7.65, 0, -4.45, PI, null, .85);
  onWallPic(picMat(420, 300, (c, w, h) => { c.fillStyle = '#f4efe0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b08d3a'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); c.textAlign = 'center'; c.fillStyle = '#222'; c.font = '700 34px Georgia, serif'; c.fillText('DIPLOMA', w / 2, 84); c.font = 'italic 22px Georgia, serif'; c.fillText('Al mejor jefe del mundo', w / 2, 140); c.fillText('otorgado por Michael', w / 2, 176); c.fillStyle = '#c0242f'; c.beginPath(); c.arc(w / 2, 232, 26, 0, 7); c.fill(); }), .5, .36, -10.4, 1.65, -6.915 + .02, 0, '#4a2f1a');
  plant(-10.7, -6.65, false);
  fp('wall_clock', -10.91, 2.45, -2.95, PI / 2, null, .28);

  // ---------------------------------------------------------------- SALA DE JUNTAS
  B.place([part(rbox(3.4, .05, 1.2, .025, 3), walnut, -8.7, .74, 4.9), ...[[-1.3], [0], [1.3]].map(([x]) => part(rbox(.16, .71, .6, .02), mat('#17181c', .4, .5), -8.7 + x, .36, 4.9))]);
  const chairConf = P.officeChair('#39445a');
  for (const s of SPOTS.agency.meeting) place(chairConf, s.x, 0, s.z, s.yaw);
  B.place([part(cyl(.1, .12, .03, 14), mat('#17181c', .4, .3), -8.7, .78, 4.9), part(cyl(.022, .022, .02, 8), glow('#3ddc84', 3), -8.7, .8, 4.9)]); label('Teléfono de conferencias', -8.7, .8, 4.9, .14);
  for (const [x, z, ry] of [[-9.6, 4.5, .1], [-8.4, 4.46, -.2], [-7.5, 4.52, .3], [-9.5, 5.3, 3.1], [-8.5, 5.32, 3.2]]) { B.place(P.paperStack(2, Math.round(x * z)), M(x, .765, z, ry, .8)); }
  fp('projector_screen', -6.62, 0, 4.9, -PI / 2, 1.1, null, null); label('Pantalla para las presentaciones de Michael', -6.62, 1.3, 4.9, .55);
  fp('steel_frame_shelves_01', -10.5, 0, 6.72, 0, 0.9, 1.9, .3); fp('cardboard_box_01', -10.65, .75, 6.7, .1, null, .24);
  plant(-7.0, 6.7, false);

  // ---------------------------------------------------------------- BULLPEN ASKITAR
  const askSign = screenMat(1024, 220, (c, w, h) => {
    c.fillStyle = '#0a0a10'; c.fillRect(0, 0, w, h); c.textAlign = 'center'; c.font = '700 140px Arial, sans-serif';
    c.shadowColor = '#ff3fa4'; c.shadowBlur = 40; c.fillStyle = '#ff7fc8'; c.fillText('ASKITAR', w / 2 - 20, 150); c.shadowBlur = 0;
  }, 2.6);
  B.place([part(rbox(2.3, .5, .03, .01), mat('#0a0a10', .4), 0, 0, 0), part(plane(2.26, .485), askSign, 0, 0, .017)], M(3.24, 2.42, -5, PI / 2), { noCast: true });
  label('Askitar Studio', 3.3, 2.4, -5, .7);
  whiteboard(board('Video nuevo', ['Tema', 'Guion', 'Grabar', 'Corte en Premiere', 'Remotion y 3D', 'Voz y música', 'Revisión', 'Publicar'], '#b0247a', '- Askitar'), 3.25, 1.45, -5.95, PI / 2);
  tvs.askitar = makeTV(1.5, .86, 3.27, 1.48, -3.98, PI / 2, 1024, 590);
  place(P.rack(), 3.62, 0, -2.52, PI / 2); label('Servidor de renders. Corre Remotion todo el día.', 3.62, 1.2, -2.52, .5);
  place(P.waterCooler(), 3.52, 0, 2.12);
  const lowCab = fitScale('modern_wooden_cabinet', 3.8, null, .38);
  B.place(model('modern_wooden_cabinet', { tint: '#6a5a78' }), M(10.74, 0, 0, -PI / 2, lowCab[0], .9, lowCab[2]));
  fp('Camera_01', 10.74, cabTop, -1.3, -PI / 2, null, .2); label('Cámara de repuesto', 10.74, cabTop + .1, -1.3, .15);
  fp('boombox', 10.74, cabTop, -.3, -PI / 2, null, .26); label('Radio con el hook de "Feedback"', 10.74, cabTop + .1, -.3, .25);
  fp('Ukulele_01', 10.82, cabTop, .7, -PI / 2, null, .5); label('El ukelele de Andy', 10.82, cabTop + .25, .7, .2);
  fp('cardboard_box_01', 10.7, cabTop, 1.4, -PI / 2 + .1, null, .22);
  plant(3.5, -1.5, false); plant(6.1, -6.7); plant(6.1, 6.7); plant(10.6, -2.3, false);
  const nposter = (t, s, c1, c2) => picMat(512, 680, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 64px Arial Black, Arial, sans-serif'; wrap(c, t, w / 2, h / 2 - 40, w - 60, 76); c.font = '24px Arial, sans-serif'; c.fillText(s, w / 2, h - 60);
  });
  onWallPic(nposter('HOOK EN 3 SEGUNDOS', 'o no hay video', '#ff3fa4', '#5a2bd8'), .62, .82, 7.0, 1.55, 6.915 - .02, PI);
  onWallPic(nposter('NO TOQUES MIS CORTES', 'regla número uno', '#0fb5ae', '#22346e'), .62, .82, 3.6, 1.55, -6.915 + .02, 0);
  onWallPic(nposter('MENOS PALITOS Y BOLITAS', 'más sazón', '#ff8a3c', '#b0247a'), .62, .82, 6.7, 1.55, -6.915 + .02, 0);

  // ---------------------------------------------------------------- GERENCIA JAN
  { const s = fitScale('modern_wooden_cabinet', 2.5, null, .36); B.place(model('modern_wooden_cabinet', { tint: '#4a3f58' }), M(9.3, 0, -6.75, 0, s[0], .9, s[2])); }
  fp('sofa_02', 10.46, 0, -4.03, -PI / 2, 1.82, null, .85); label('Sofá de Jan', 10.46, .6, -4.03, .6);
  fp('modern_arm_chair_01', 9.75, 0, -4.45, PI, null, .85); fp('modern_arm_chair_01', 7.65, 0, -4.45, PI, null, .85);
  place(P.plaqueButton('#c9ccd2'), 7.0, 1.75, -6.9 + .03); place(P.plaqueButton('#e0b94a'), 7.45, 1.75, -6.9 + .03); label('Placas: 100 mil y 1 millón (algún día)', 7.2, 1.75, -6.85, .5);
  place(P.ringLight(), 9.9, 0, -6.1, -.5); label('Aro de luz de Jan', 9.9, 1.6, -6.1, .28);
  fp('book_encyclopedia_set_01', 8.3, cabTop, -6.78, 0, .5); plant(10.7, -6.65, false);
  B.place(P.dundie(), M(9.3, cabTop, -6.76)); B.place(P.dundie(), M(9.6, cabTop, -6.74));
  const neonCrea = screenMat(512, 160, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.textAlign = 'center'; c.font = 'italic 700 100px Georgia, serif'; c.shadowColor = '#3fd8ff'; c.shadowBlur = 30; c.fillStyle = '#b8f2ff'; c.fillText('crea.', w / 2, 112); }, 2.6);
  B.add(plane(1.0, .31), neonCrea, M(10.3, 1.9, -6.91), { noCast: true });

  // ---------------------------------------------------------------- ESTUDIO
  const greenM = mat('#20b34d', .85);
  B.place([part(box(3.45, 2.75, .03), greenM, 9.22, 1.375, 6.86), part(box(3.45, .012, 1.1), greenM, 9.22, .007, 6.3)]); label('Pantalla verde', 9.22, 1.4, 6.8, 1.1);
  place(model('metal_stool_03'), 9.2, 0, 5.35, 0, fitScale('metal_stool_03', null, .78)[0]); place(model('metal_stool_03'), 8.2, 0, 5.35, 0, fitScale('metal_stool_03', null, .78)[0]);
  place(P.tripodLegs(1.3), 9.2, 0, 4.02); fp('Camera_01', 9.2, 1.32, 4.02, 0, null, .26); B.place([part(cyl(.012, .012, .55, 8), mat('#17181c', .4, .5), 9.2, 1.05, 4.02)]); label('Cámara principal de Askitar', 9.2, 1.4, 4.02, .22);
  place(P.softbox(1.95), 7.45, 0, 4.45, .55); place(P.softbox(1.95), 10.7, 0, 4.45, -.55); label('Softbox', 7.45, 2, 4.45, .35);
  place(P.boomMic(), 10.4, 0, 5.5, -2.3); label('Micrófono boom', 9.6, 1.6, 4.9, .25);
  fp('sofa_02', 8.97, 0, 3.1, 0, 1.85, null, .7);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) B.place(P.foamPanel(i % 2 === j % 2 ? '#2a2632' : '#1f1c28'), M(10.91, .85 + j * .5, 3.05 + i * .5, -PI / 2));
  label('Espuma acústica', 10.9, 1.6, 4.5, .9);
  for (const [x, z, s, ry] of [[9.2, 5.75, 1, .78], [8.2, 5.75, 1, -.78]]) { for (const q of [1, -1]) B.place([part(box(.26, .002, .035), mat('#f2e36b', .7), 0, 0, 0)], M(x, .009, z, q * .78)); }
  const onAir = screenMat(256, 96, (c, w, h) => { c.fillStyle = '#2a0606'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5040'; c.textAlign = 'center'; c.font = '700 54px Arial, sans-serif'; c.fillText('ON AIR', w / 2, 66); }, 2.8);
  const onAirMesh = new THREE.Mesh(plane(.42, .16), onAir); onAirMesh.position.set(10.9, 2.6, 4.5); onAirMesh.rotation.y = -PI / 2; root.add(onAirMesh);
  B.add(box(.46, .2, .02), mat('#101014', .4), M(10.915, 2.6, 4.5, -PI / 2)); label('Luz de "ON AIR"', 10.9, 2.6, 4.5, .25);
  const curve = new THREE.CatmullRomCurve3([[7.5, .01, 4.5], [8.2, .01, 4.7], [8.9, .01, 4.2], [9.2, .01, 4.1]].map((q) => new THREE.Vector3(...q)));
  B.add(new THREE.TubeGeometry(curve, 24, .008, 6), mat('#101014', .6), new THREE.Matrix4());

  // ---------------------------------------------------------------- pantallas de TV
  function makeTV(w, h, x, y, z, yaw, cw, ch) {
    const cvs = document.createElement('canvas'); cvs.width = cw; cvs.height = ch;
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ color: '#000000', roughness: .2, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.25 });
    const T = M(x, y, z, yaw);
    B.place([part(rbox(w + .05, h + .05, .05, .008), mat('#0c0c10', .35, .4), 0, 0, 0)], T);
    const mesh = new THREE.Mesh(plane(w, h), m); mesh.matrixAutoUpdate = false; mesh.matrix.copy(new THREE.Matrix4().multiplyMatrices(T, M(0, 0, .027))); root.add(mesh);
    return { cvs, ctx: cvs.getContext('2d'), tex, m, w: cw, h: ch };
  }
  function modelTop(id) { const parts = model(id); const b = new THREE.Box3(); for (const q of parts) { q.geo.computeBoundingBox(); b.union(q.geo.boundingBox.clone().applyMatrix4(q.m)); } return b.max.y; }

  B.build(root); Bc.build(ceiling); for (const k in SB) SB[k].build(sides[k]);
  return { root, sides, ceiling, doors, screens, tvs, labels, onAirMesh };
}
