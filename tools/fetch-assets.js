// Descarga los modelos, texturas y HDRI (CC0, Poly Haven) de la oficina 3D a public/3d/assets.
// Uso: node tools/fetch-assets.js   (ya descargados se saltan). Deja assets/credits.json con el detalle.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', '3d', 'assets');
const UA = { headers: { 'User-Agent': 'oficina-agentes-local' } };

const MODELS = [
  // muebles
  'metal_office_desk', 'Sofa_01', 'sofa_02', 'sofa_03', 'modern_arm_chair_01', 'mid_century_lounge_chair',
  'modern_coffee_table_01', 'coffee_table_round_01', 'modern_wooden_cabinet', 'drawer_cabinet', 'wooden_bookshelf_worn',
  'steel_frame_shelves_01', 'steel_frame_shelves_02', 'Shelf_01', 'bar_chair_round_01', 'plastic_monobloc_chair_01',
  'metal_stool_02', 'metal_stool_03', 'CoffeeCart_01', 'projector_screen',
  // plantas
  'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'planter_box_01',
  // detalles
  'wall_clock', 'hanging_picture_frame_01', 'hanging_picture_frame_02', 'standing_picture_frame_01', 'standing_picture_frame_02',
  'rubber_duck_toy', 'ceramic_vase_01', 'book_encyclopedia_set_01', 'decorative_book_set_01', 'fire_alarm', 'WetFloorSign_01',
  'Ukulele_01', 'Megaphone_01', 'boombox', 'Camera_01', 'vintage_stapler', 'stationery_supplies', 'office_notepads', 'clipboard',
  'binder_notebook', 'classic_laptop', 'desk_lamp_arm_01', 'vintage_microwave', 'vintage_electric_kettle', 'cardboard_box_01',
  'hanging_industrial_lamp', 'modern_ceiling_lamp_01', 'alarm_clock_01', 'trashbag', 'industrial_pastic_container', 'medical_box',
];
const TEXTURES = [
  ['dirty_carpet', '1k'], ['plastered_wall', '1k'], ['beige_wall_001', '1k'], ['painted_brick', '1k'], ['brick_wall_04', '1k'],
  ['laminate_floor_02', '2k'], ['dark_wooden_planks', '2k'], ['painted_concrete', '2k'], ['concrete_floor_02', '1k'],
  ['oak_veneer_01', '1k'], ['black_walnut_veneer_01', '1k'], ['marble_01', '1k'],
  ['cotton_jersey', '1k'], ['caban', '1k'], ['denim_fabric_03', '1k'], ['fabric_leather_01', '1k'],
];
const HDRIS = [['unfinished_office', '1k'], ['unfinished_office_night', '1k'], ['modern_buildings_2', '2k'], ['modern_buildings_night', '2k']];

const credits = [];
let bytes = 0;

async function save(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, UA);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(file, b); bytes += b.length;
      return;
    } catch (e) { if (i === 2) throw e; await new Promise((s) => setTimeout(s, 1500)); }
  }
}
const info = async (id) => (await fetch('https://api.polyhaven.com/files/' + id, UA)).json();

async function getModel(id) {
  const f = await info(id);
  const g = f.gltf && (f.gltf['1k'] || f.gltf['2k']);
  if (!g) throw new Error('sin gltf');
  const dir = path.join(OUT, 'models', id);
  await save(g.gltf.url, path.join(dir, id + '.gltf'));
  for (const [rel, x] of Object.entries(g.gltf.include || {})) await save(x.url, path.join(dir, rel));
  credits.push({ id, type: 'model', licence: 'CC0', source: 'https://polyhaven.com/a/' + id });
}
async function getTexture([id, res]) {
  const f = await info(id);
  const dir = path.join(OUT, 'tex', id);
  const pickMap = (k) => f[k] && f[k][res] && f[k][res].jpg && f[k][res].jpg.url;
  const maps = { diff: pickMap('Diffuse'), nor: pickMap('nor_gl'), rough: pickMap('Rough') };
  for (const [k, u] of Object.entries(maps)) if (u) await save(u, path.join(dir, k + '.jpg'));
  credits.push({ id, type: 'texture', licence: 'CC0', source: 'https://polyhaven.com/a/' + id });
}
async function getHdri([id, res]) {
  const f = await info(id);
  await save(f.hdri[res].hdr.url, path.join(OUT, 'hdri', id + '.hdr'));
  credits.push({ id, type: 'hdri', licence: 'CC0', source: 'https://polyhaven.com/a/' + id });
}
async function pool(items, fn, n) {
  const q = items.slice(); const errs = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (q.length) {
      const it = q.shift(); const name = Array.isArray(it) ? it[0] : it;
      try { await fn(it); console.log('ok', name); } catch (e) { errs.push(name + ': ' + e.message); console.log('FALLO', name, e.message); }
    }
  }));
  return errs;
}
(async () => {
  const errs = [...await pool(HDRIS, getHdri, 2), ...await pool(TEXTURES, getTexture, 4), ...await pool(MODELS, getModel, 5)];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 1));
  console.log('LISTO', (bytes / 1048576).toFixed(0) + ' MB nuevos, fallos: ' + (errs.length ? errs.join('; ') : 'ninguno'));
})();
