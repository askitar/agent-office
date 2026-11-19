// Lista el catalogo de Poly Haven (CC0) para elegir modelos, texturas y HDRI de la oficina 3D.
// Uso: node tools/ph-list.js models|textures|hdris [filtro]
const type = process.argv[2] || 'models';
const filter = (process.argv[3] || '').toLowerCase();
(async () => {
  const r = await fetch('https://api.polyhaven.com/assets?t=' + type, { headers: { 'User-Agent': 'oficina-agentes-local' } });
  const j = await r.json();
  const rows = Object.entries(j).map(([id, a]) => ({ id, name: a.name, cats: (a.categories || []).join(','), dim: a.dimensions ? a.dimensions.map((d) => Math.round(d / 10) / 100).join('x') : '', polys: a.polycount || '' }));
  const out = rows.filter((x) => !filter || (x.id + ' ' + x.name + ' ' + x.cats).toLowerCase().includes(filter));
  console.log(out.length + ' de ' + rows.length);
  for (const x of out) console.log([x.id, x.dim, x.polys, x.cats].join(' | '));
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
