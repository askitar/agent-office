// Render: luz, cielo de dia y de noche, sombras, oclusion ambiental, bloom y calidad automatica.
import { THREE, ASSETS, setAniso } from './kit.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OFFICE } from './world.js';

export class Stage {
  constructor(canvas, host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    setAniso(Math.min(8, r.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, .05, 200);
    this.quality = 'high'; this.timeMode = 'real';
    this.hdr = {}; this.daylight = -1;
    this._lights();
    this._post();
    this.resize();
  }
  gpuName() {
    const gl = this.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'desconocida';
  }
  _lights() {
    const s = this.scene;
    // luz cenital del techo, la que da las sombras de muebles y personajes
    const top = this.top = new THREE.DirectionalLight('#fff4e6', 2.1);
    top.position.set(-2.5, 16, 5); top.target.position.set(0, 0, 0); s.add(top, top.target);
    top.castShadow = true; top.shadow.mapSize.set(4096, 4096);
    const c = top.shadow.camera; c.left = -15; c.right = 15; c.top = 12; c.bottom = -12; c.near = 4; c.far = 30;
    top.shadow.bias = -.00025; top.shadow.normalBias = .018; top.shadow.radius = 2.4;
    // relleno frio desde el otro lado, sin sombra
    this.fill = new THREE.DirectionalLight('#cfe0ff', .45); this.fill.position.set(6, 9, -7); s.add(this.fill);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6a5f55', .35); s.add(this.hemi);
    // color del lado Askitar: rosado y azul de las tiras LED
    this.neon = [];
    for (const [x, z, col, i] of [[3.6, -5, '#ff3fa4', 1.6], [10.2, 0, '#3fb4ff', 2.0], [7.2, -6.2, '#3fb4ff', 1.4], [7.2, 6, '#ff3fa4', 1.6], [8.8, 4.8, '#fff0d8', 3], [9, -3.8, '#ffb0dc', 1.5]]) {
      const p = new THREE.PointLight(col, i, 8, 1.6); p.position.set(x, 2.45, z); s.add(p); this.neon.push(p);
    }
  }
  _post() {
    const r = this.renderer;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const gtao = this.gtao = new GTAOPass(this.scene, this.camera, 4, 4);
    gtao.updateGtaoMaterial({ radius: .32, distanceExponent: 1.5, thickness: 1, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    gtao.blendIntensity = .95;
    // el vidrio no debe oscurecer lo que hay detras
    const ov = gtao._overrideVisibility.bind(gtao), scene = this.scene;
    gtao._overrideVisibility = function () {
      ov();
      const cache = this._visibilityCache;
      scene.traverse((o) => { if (o.userData.noAO && o.visible) { o.visible = false; cache.push(o); } });
    };
    this.composer.addPass(gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), .28, .5, 1.35);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  setQuality(q) {
    this.quality = q;
    this.gtao.enabled = q === 'high';
    this.bloom.enabled = q !== 'low';
    const size = q === 'high' ? 4096 : (q === 'mid' ? 2048 : 1536);
    const sh = this.top.shadow;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    // en alta las sombras se recalculan cada cuadro; en media y baja se calculan una vez (muebles) y los personajes usan sombra de contacto
    sh.autoUpdate = q === 'high'; sh.needsUpdate = true;
    this.neon.forEach((p, i) => { p.visible = q === 'high' || (q === 'mid' && i < 3); });
    const samples = q === 'high' ? 4 : (q === 'mid' ? 2 : 0);
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) { if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); } }
    this.resize();
  }
  resize() {
    const w = Math.max(2, this.host.clientWidth), h = Math.max(2, this.host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }
  loadSky() {
    const load = (id) => new Promise((res) => new HDRLoader().load(`${ASSETS}/hdri/${id}.hdr`, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; res(t); }, undefined, () => res(null)));
    return Promise.all([load('unfinished_office'), load('unfinished_office_night'), load('modern_buildings_2'), load('modern_buildings_night')]).then(([a, b, c, d]) => {
      this.hdr = { envDay: a, envNight: b, skyDay: c, skyNight: d };
      this.scene.backgroundBlurriness = .012;
      this.applyTime(true);
    });
  }
  // 0 de noche, 1 de dia, con amanecer y atardecer de una hora
  daylightNow() {
    if (this.timeMode === 'day') return 1;
    if (this.timeMode === 'night') return 0;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (h < 5.5 || h >= 18.7) return 0;
    if (h < 6.5) return h - 5.5;
    if (h > 17.7) return 18.7 - h;
    return 1;
  }
  applyTime(force) {
    const d = this.daylightNow();
    if (!force && Math.abs(d - this.daylight) < .004) return;
    this.daylight = d;
    const s = this.scene, night = d < .5;
    s.environment = night ? (this.hdr.envNight || this.hdr.envDay) : this.hdr.envDay;
    s.background = night ? this.hdr.skyNight : this.hdr.skyDay;
    s.environmentIntensity = night ? .28 + d * .3 : .32 + d * .12;
    s.backgroundIntensity = night ? .22 + d : .5 + d * .35;
    this.top.intensity = night ? 1.7 : 1.75 + d * .2;
    this.top.color.set(night ? '#ffe9cf' : '#fff5e8');
    this.hemi.intensity = night ? .32 : .3 + d * .12;
    this.fill.intensity = night ? .12 : .2 + d * .3;
        if (this.onTime) this.onTime(d);
  }
  render() { this.composer.render(); }
}
