import * as THREE from 'three';
import './accent.js';
import { playIntro } from './intro.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { COMPANY, BUILDING, PLAN_TYPES, APARTMENTS, STATUS, ordinal, fmtPrice, floorBaseY } from './data.js';
import { buildTower, buildSurroundings, buildTrees } from './building.js';
import { buildApartment, buildCommonAreas } from './interior.js';
import { planSVG } from './plan-svg.js';
import { Tour } from './tour.js';
import { initScroll } from './scroll.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunPosition, sunDirection, localDate, sunTimes, fmtTime, seasonalSunHours, SEASONS } from './sun.js';
import { windowMaterial, NEIGHBORS } from './complex.js';
import { bakuUniforms } from './baku.js';
import { buildPTScene, skyEquirect } from './ptscene.js';
import { CamGuard } from './camguard.js';
import { loadDesign, isCustom, DEFAULT_FABRIC } from './design.js';
import { initStudio } from './studio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isTouch = matchMedia('(hover: none)').matches;
const Q = new URLSearchParams(location.search);
const isSmall = () => innerWidth < 760;

/* =========================================================
   Renderer, səhnə, işıq
   ========================================================= */
const canvas = $('#scene');
// Telefon/planşet üçün yüngül rejim: MSAA, parıltı yoxdur, kölgə xəritəsi kiçik, piksel sıxlığı aşağı
const LITE = isTouch || Q.has('lite');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
// piksel sıxlığı kadr sürətinə görə avtomatik tənzimlənir (aşağıda adaptiveQuality)
const PR_MAX = Math.min(devicePixelRatio, LITE ? 1.25 : 1.75);
const PR_MIN = LITE ? 0.7 : 1;
let pixelRatio = PR_MAX;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.00045);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 4000);
camera.position.set(90, 10, 110);

// Günəş (istiqaməti HDRI panoramadan hesablanır)
const sunLight = new THREE.DirectionalLight(0xfff1dc, 3.4);
const lightDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const hdrLightDir = lightDir.clone();
let hdrTex = null;
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(LITE ? 1024 : 4096, LITE ? 1024 : 4096);
sunLight.shadow.bias = -0.0003;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
let lastAim = { center: new THREE.Vector3(0, 20, 20), size: 105 };
function aimSun(center, size) {
  lastAim = { center: center.clone(), size };
  sunLight.target.position.copy(center);
  sunLight.position.copy(center).addScaledVector(lightDir, 160);
  const c = sunLight.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size;
  c.near = 10; c.far = 400;
  c.updateProjectionMatrix();
}
aimSun(new THREE.Vector3(0, 20, 20), 105);

// HDRI-da ən parlaq nöqtəni (günəşi) tap
function findSun(tex) {
  const { data, width, height } = tex.image;
  let best = -1, bi = 0;
  for (let i = 0; i < width * height; i++) {
    const l = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722;
    if (l > best) { best = l; bi = i; }
  }
  const u = ((bi % width) + 0.5) / width, v = (Math.floor(bi / width) + 0.5) / height;
  const phi = (u - 0.5) * 2 * Math.PI;
  // kölgələr daha gözəl görünsün deyə günəşi bir az alçaldırıq
  const theta = Math.min((0.5 - v) * Math.PI, THREE.MathUtils.degToRad(52));
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)).normalize();
}

const hemi = new THREE.HemisphereLight(0xcfe0f5, 0x4a5a3a, 0.25);
scene.add(hemi);

// İnteryer lampaları (turda yanır)
const lampPool = [];
for (let i = 0; i < 4; i++) {
  const l = new THREE.PointLight(0xffd6a0, 0, 7, 1.6);
  scene.add(l);
  lampPool.push(l);
}

/* =========================================================
   Yükləmə
   ========================================================= */
// Yükləmə ekranı hər şey hazır olana qədər qalır: göy üzü, interyer işığı, ağaclar, 3D mebel,
// video, şriftlər, şəkillər və şeyderlərin hazırlanması. Hər mərhələnin öz payı var.
const manager = new THREE.LoadingManager();
const loaderBar = $('#loaderBar');
const loaderText = $('#loaderText');
const loaderPct = $('#loaderPct');
const LOAD = { tasks: [], shown: 0, done: false };
function loadTask(label, weight) {
  const t = { label, weight, p: 0, ok: false };
  LOAD.tasks.push(t);
  return {
    progress(v) { t.p = Math.max(t.p, Math.min(1, v)); },
    done() { t.p = 1; t.ok = true; },
  };
}
function loadProgress() {
  const tot = LOAD.tasks.reduce((a, t) => a + t.weight, 0) || 1;
  return LOAD.tasks.reduce((a, t) => a + t.weight * t.p, 0) / tot;
}
(function loaderTick() {
  if (LOAD.done) return;
  const target = loadProgress();
  LOAD.shown += (target - LOAD.shown) * 0.12;
  if (target - LOAD.shown < 0.002) LOAD.shown = target;
  loaderBar.style.width = `${(LOAD.shown * 100).toFixed(1)}%`;
  if (loaderPct) loaderPct.textContent = `${Math.floor(LOAD.shown * 100)}%`;
  const next = LOAD.tasks.find((t) => !t.ok);
  if (next && loaderText) loaderText.textContent = next.label;
  requestAnimationFrame(loaderTick);
})();
const T_SKY = loadTask('Göy üzü və işıq yüklənir…', 5);
const T_INT = loadTask('İnteryer işığı hazırlanır…', 1);
const T_TREES = loadTask('Ağaclar və həyət qurulur…', 2);
const T_MODELS = loadTask('Mebel modelləri yüklənir…', 3);
const T_MEDIA = loadTask('Video və şəkillər yüklənir…', 3);
const T_FONTS = loadTask('Şriftlər yüklənir…', 0.5);
const T_WARM = loadTask('3D səhnə hazırlanır…', 2);
const bytes = (task) => (e) => { if (e && e.lengthComputable) task.progress(0.95 * e.loaded / e.total); };
const pmrem = new THREE.PMREMGenerator(renderer);
let envExterior = null, envInterior = null;

new HDRLoader(manager).setDataType(THREE.FloatType).load('assets/hdri/aristea_wreck_puresky_2k.hdr', (tex) => {
  T_SKY.done();
  tex.mapping = THREE.EquirectangularReflectionMapping;
  lightDir.copy(findSun(tex));
  hdrLightDir.copy(lightDir);
  hdrTex = tex;
  // günəş diskinin həddən artıq parlaq dəyərlərini məhdudlaşdır (effektlərdə "sonsuzluq" yaranmasın)
  const d = tex.image.data;
  for (let i = 0; i < d.length; i++) if (d[i] > 60) d[i] = 60;
  tex.needsUpdate = true;
  aimSun(new THREE.Vector3(0, 20, 20), 105);
  envExterior = pmrem.fromEquirectangular(tex).texture;
  scene.environment = envExterior;
  scene.environmentIntensity = 1.0;
  // foto-panorama fonda: real göy üzü və üfüqdə ağaclar
  scene.background = tex;
  scene.backgroundIntensity = 1.0;
  // duman rəngini üfüqün rənginə uyğunlaşdır
  scene.fog.color.copy(horizonColor(tex));
}, bytes(T_SKY), () => T_SKY.done());
function horizonColor(tex) {
  const { data, width, height } = tex.image;
  const row = Math.floor(height * 0.495);
  const c = new THREE.Color(0, 0, 0);
  for (let x = 0; x < width; x += 4) {
    const i = (row * width + x) * 4;
    c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
  }
  c.multiplyScalar(4 / width);
  const m = Math.max(c.r, c.g, c.b);
  return c.multiplyScalar(0.8 / m).convertLinearToSRGB().convertSRGBToLinear();
}
new EXRLoader(manager).load('assets/hdri/apartment.exr', (tex) => {
  envInterior = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  T_INT.done();
}, bytes(T_INT), (err) => T_INT.done() || console.warn('İnteryer işıq xəritəsi (apartment.exr) yüklənmədi — neytral otaq işığı istifadə olunacaq', err));
// İnteryer işığı: EXR yoxdursa neytral otaq mühiti (heç vaxt parlaq çöl göy üzü yox —
// o, yuxarıya baxan səthləri, döşəmə və çarpayını ağardırdı)
let envRoomFallback = null;
function interiorEnv() {
  if (envInterior) return envInterior;
  if (!envRoomFallback) envRoomFallback = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return envRoomFallback;
}
const TOUR_ENV = 0.42; // turda ətraf işığın gücü
// Ekspozisiya (divan modelinin artıq işıqları silindikdən sonra yenidən tənzimlənib)
const TOUR_EXP = 0.95;
const FLOOR_EXP = 0.78;
let envReady;
const envPromise = new Promise((r) => (envReady = r));
manager.onLoad = () => envReady();
function finishLoading() {
  if (LOAD.done) return;
  LOAD.tasks.forEach((t) => (t.p = 1));
  loaderBar.style.width = '100%';
  if (loaderPct) loaderPct.textContent = '100%';
  if (loaderText) loaderText.textContent = 'Hazırdır';
  LOAD.done = true;
  warmUntil = performance.now() + 2500;
  setTimeout(() => { $('#loader').classList.add('is-done'); setTimeout(playIntro, 450); }, 350);
}
// ehtiyat: nəsə ilişib qalsa, 40 saniyədən sonra sayt yenə açılsın
setTimeout(() => { if (!LOAD.done) { console.warn('Yükləmə gecikdi — sayt açılır', LOAD.tasks.filter((t) => !t.ok).map((t) => t.label)); finishLoading(); } }, 40000);

// Modellər (divan, kreslo) — arxa planda yüklənir
const models = {};
const gltf = new GLTFLoader();
function loadModel(name, url, width, turn = 0, onProgress) {
  return new Promise((resolve) => gltf.load(url, (g) => {
    const root = g.scene;
    // GLB faylında studiya işığı ("Key_Light") var — hər divan nüsxəsi səhnəyə əlavə bir günəş
    // qoşurdu (kölgəsiz, tavandan keçir) və döşəmələr ağarırdı. Modeldən bütün işıq və kameraları sil.
    const extras = [];
    root.traverse((o) => { if (o.isLight || o.isCamera) extras.push(o); });
    extras.forEach((o) => o.removeFromParent());
    root.rotation.y = turn;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = width / size.x;
    const wrap = new THREE.Group();
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.sub(new THREE.Vector3((b2.min.x + b2.max.x) / 2, b2.min.y, (b2.min.z + b2.max.z) / 2));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.geometry.userData.shared = true; } });
    wrap.add(root);
    models[name] = wrap;
    if (floorState) floorState.apts.forEach(applyModels);
    resolve();
  }, onProgress, (e) => { console.warn('Model yüklənmədi', url, e); resolve(); }));
}
// Dizayn studiyasında seçilmiş parça rəngi — yalnız məxmər (sheen) materiallar boyanır
const tintCache = new Map();
function tinted(mat, hex) {
  if (!hex || hex === DEFAULT_FABRIC || !(mat.sheen > 0)) return mat;
  const key = mat.uuid + hex;
  if (!tintCache.has(key)) {
    const m = mat.clone();
    m.map = null;
    m.color.set(hex);
    if (m.sheenColor) m.sheenColor.set(hex).lerp(new THREE.Color(0xffffff), 0.12);
    tintCache.set(key, m);
  }
  return tintCache.get(key);
}
function applyModels(ad) {
  const hex = ad.design && ad.design.fabric;
  for (const slot of ad.modelSlots) {
    const m = models[slot.userData.modelKind];
    if (!m || slot.userData.filled) continue;
    slot.clear();
    const c = m.clone();
    if (hex && hex !== DEFAULT_FABRIC) c.traverse((o) => { if (o.isMesh) o.material = tinted(o.material, hex); });
    slot.add(c);
    slot.userData.filled = true;
  }
}

/* =========================================================
   Bina və ətraf
   ========================================================= */
const tower = buildTower();
scene.add(tower.root);
scene.add(buildSurroundings());
// kamera binaların içinə girməsin; 3D seçimdə önü kəsən qonşu binalar enir
const guard = new CamGuard();
guard.collect(scene);
let streetTrees = null;
const treesReady = buildTrees((trees) => { scene.add(trees); trees.traverse((o) => { if (o.userData.streetTrees) streetTrees = o; }); }, [[40, 150], [30, 120], [-62, 74], [-78, -40], [96, -30], [34, 58], [22, 44], [34, 110], [30, 82]]).catch((e) => console.warn('Ağaclar yüklənmədi', e));

/* =========================================================
   Sonrakı emal: AO (künc kölgələri), yumşaq parıltı
   ========================================================= */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q.has('nomsaa') || LITE ? 0 : 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (!isTouch && !Q.has('noao')) {
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  // yarımşəffaf konturlar (enmiş qonşu binalar) AO-ya təsir etməsin
  gtao._overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => { if ((o.isPoints || o.isLine || o.isLine2 || o.userData.noAO) && o.visible) { o.visible = false; cache.push(o); } });
  };
  gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
}
// Parıltı (bloom) yalnız axşam/gecə işıqları və lampalar üçündür. Gündüz tam sönür:
// aşağı hədd ağ divarları və döşəmələri də parladıb bütün kadrı ağ dumanla örtürdü.
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.1, 0.4, 99);
const BLOOM_OK = !Q.has('nobloom') && !LITE;
if (BLOOM_OK) composer.addPass(bloom);
function setBloom(threshold, strength) {
  bloom.threshold = threshold;
  bloom.strength = strength;
  bloom.enabled = BLOOM_OK && threshold < 5;
}
setBloom(99, 0);
composer.addPass(new OutputPass());

/* =========================================================
   Vəziyyət
   ========================================================= */
const state = {
  mode: 'landing', // landing | building | floor | tour
  floor: null,
  apt: null,
  rooms: 0,
  hoverFloor: null,
  hoverApt: null,
};
let floorState = null; // { f, group, apts: [...] }
let tourData = null;

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 24;
controls.maxDistance = 260;

const tour = new Tour(camera, canvas);
scene.add(tour.ring);
tour.bindJoystick($('#joystick'));

/* =========================================================
   Kiçik animasiya (tween) sistemi
   ========================================================= */
const tweens = new Set();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(dur, onUpdate, onDone) {
  const t = { t0: performance.now(), dur, onUpdate, onDone };
  tweens.add(t);
  return t;
}
function runTweens(now) {
  for (const t of tweens) {
    const k = Math.min(1, (now - t.t0) / t.dur);
    t.onUpdate(ease(k), k);
    if (k >= 1) { tweens.delete(t); t.onDone && t.onDone(); }
  }
}
let camTween = null;
function flyTo(pos, target, dur = 1400, done) {
  if (camTween) tweens.delete(camTween);
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  const p1 = pos.clone(), t1 = target.clone();
  // yüksəklikdə qövs üzrə uç
  const lift = Math.min(30, p0.distanceTo(p1) * 0.15);
  camTween = tween(dur, (e) => {
    camera.position.lerpVectors(p0, p1, e);
    camera.position.y += Math.sin(e * Math.PI) * lift;
    controls.target.lerpVectors(t0, t1, e);
    camera.lookAt(controls.target);
  }, () => { camTween = null; done && done(); });
}

/* =========================================================
   Hero videosu: ekrandan çıxanda və 3D rejimdə dayanır;
   "azaldılmış hərəkət" seçilibsə yalnız ilk kadr göstərilir
   ========================================================= */
const heroVideo = document.querySelector('.hero__video');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let heroVisible = true;
function syncHeroVideo() {
  if (!heroVideo) return;
  if (reduceMotion || !heroVisible || document.body.classList.contains('exploring')) heroVideo.pause();
  else heroVideo.play().catch(() => {});
}
if (heroVideo) {
  if (reduceMotion) heroVideo.removeAttribute('autoplay');
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; syncHeroVideo(); }).observe(heroVideo);
}

/* =========================================================
   Landing: scroll ilə hərəkət edən kamera (parallax)
   ========================================================= */
// Kamera açar kadrları bölmələrə bağlıdır: at = 0 bölmənin əvvəli, 1 — sonu
const PATH = [
  { sel: '#top', at: 0, pos: [40, 6, 150], tgt: [-8, 32, 0] },
  { sel: '#manifest', at: 0.5, pos: [-40, 18, 90], tgt: [0, 28, 0] },
  { sel: '#masterplan', at: 0, pos: [175, 95, 250], tgt: [-45, 12, -55] },
  { sel: '#masterplan', at: 1, pos: [70, 88, 285], tgt: [-70, 12, -60] },
  { sel: '#about', at: 0, pos: [-30, 24, 78], tgt: [0, 28, 0] },
  { sel: '#about', at: 1, pos: [26, 46, 34], tgt: [0, 44, 0] },
  { sel: '#numbers', at: 0.5, pos: [-60, 80, 90], tgt: [0, 26, 0] },
  { sel: '#tour3d', at: 0, pos: [105, 44, 62], tgt: [0, 30, 0] },
  { sel: '#tour3d', at: 1, pos: [26, 7, 76], tgt: [0, 36, 0] },
  { sel: '#location', at: 0.5, pos: [34, 4, 58], tgt: [0, 34, 0] },
  { sel: '.footer', at: 1, pos: [150, 80, 90], tgt: [0, 22, 0] },
];
const posCurve = new THREE.CatmullRomCurve3(PATH.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
const tgtCurve = new THREE.CatmullRomCurve3(PATH.map((k) => new THREE.Vector3(...k.tgt)), false, 'centripetal');
function measurePath() {
  for (const k of PATH) {
    const el = document.querySelector(k.sel);
    if (!el) { k.y = 0; continue; }
    const top = el.getBoundingClientRect().top + (scrollYNow || scrollY);
    k.y = top + k.at * Math.max(0, el.offsetHeight - innerHeight);
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  PATH[PATH.length - 1].y = Math.max(PATH[PATH.length - 1].y, max);
  for (let i = 1; i < PATH.length; i++) PATH[i].y = Math.max(PATH[i].y, PATH[i - 1].y + 1);
}
function pathParam(y) {
  if (y <= PATH[0].y) return 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return (i + t * t * (3 - 2 * t)) / (PATH.length - 1);
    }
  }
  return 1;
}
let scrollYNow = 0;
const baseFov = () => { const a = innerWidth / innerHeight; return a < 1 ? 42 + (1 - a) * 22 : 42; };
const mouse = new THREE.Vector2();
let scrollP = 0;
const landingTarget = new THREE.Vector3(0, 30, 0);
function updateLandingCamera(dt, t) {
  const u = pathParam(scrollYNow);
  const want = posCurve.getPoint(u);
  const tgt = tgtCurve.getPoint(u);
  // dar ekranda (telefon) baxış bucağını genişləndir və kameranı bir az uzaqlaşdır ki, bina tam görünsün
  // (çox uzaqlaşdırsaq kamera qonşu binaların arxasına keçir)
  const aspect = innerWidth / innerHeight;
  if (Math.abs(camera.fov - baseFov()) > 0.01) { camera.fov = baseFov(); camera.updateProjectionMatrix(); }
  if (aspect < 1) want.sub(tgt).multiplyScalar(1 + (1 - aspect) * 0.37).add(tgt);
  // yavaş fırlanma + siçan parallaksı
  want.x += Math.sin(t * 0.05) * 3 + mouse.x * 4;
  want.y += mouse.y * 2;
  // kamera heç vaxt binanın içinə və ya yerin altına düşməsin
  guard.pushOut(want, 4, { ground: 2.5 });
  const k = Q.has('snapcam') ? 1 : 1 - Math.pow(0.02, dt);
  camera.position.lerp(want, k);
  guard.pushOut(camera.position, 1.5, { ground: 2 });
  landingTarget.lerp(tgt, k);
  camera.lookAt(landingTarget);
  // geniş ekranda binanı mətndən sağa çək
  const shift = innerWidth > 900 ? -innerWidth * 0.2 * (1 - Math.min(1, scrollYNow / innerHeight)) : 0;
  if (Math.abs(shift - viewShift) > 0.5) {
    viewShift += (shift - viewShift) * k;
    camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight);
  }
}
let viewShift = 0;
function clearViewShift() { viewShift = 0; camera.clearViewOffset(); }

function onScroll() { measurePath(); }
const scrollCtl = initScroll({ onFrame: (y) => { scrollYNow = y; } });
addEventListener('load', measurePath);
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});

/* =========================================================
   Səhifə: planlar, formalar, animasiyalar
   ========================================================= */
$('#year').textContent = new Date().getFullYear();
$('#cPhone').textContent = COMPANY.phone;
$('#cEmail').textContent = COMPANY.email;
$('#cEmail').href = 'mailto:' + COMPANY.email;
$('#cAddress').textContent = COMPANY.address;

const minPrice = (t) => Math.min(...APARTMENTS.filter((a) => a.type === t && a.status !== 'sold').map((a) => a.price));
const availableOf = (t) => APARTMENTS.filter((a) => a.type === t && a.status === 'available').length;

function roomList(plan) {
  return `<ul class="room-table">${plan.rooms_.map((r) => `<li><span>${r.name}</span><span>${(r.w * r.d).toFixed(1)} m²</span></li>`).join('')}
  <li><span><b>Ümumi sahə</b></span><span><b>${plan.area} m²</b></span></li></ul>`;
}

const plansGrid = $('#plansGrid');
const leadType = $('#leadType');
for (const t of Object.values(PLAN_TYPES)) {
  const card = document.createElement('article');
  card.className = 'plan-card';
  card.dataset.reveal = '';
  card.style.setProperty('--d', plansGrid.children.length);
  card.innerHTML = `
    <div class="plan-card__img" data-plan="${t.code}" title="Planı böyüt">${planSVG(t)}</div>
    <div class="plan-card__body">
      <div class="plan-card__top"><h3>${t.title}</h3><span class="plan-card__type">TİP ${t.code}</span></div>
      <p>${t.blurb}</p>
      <div class="plan-card__facts"><span><b>${t.area} m²</b> sahə</span><span><b>${t.rooms}</b> otaq</span><span><b>${availableOf(t)}</b> satışda</span></div>
      <div class="plan-card__price">Qiymət: <b>${fmtPrice(minPrice(t))}</b>-dan</div>
      <div class="plan-card__actions">
        <button class="btn btn--ghost" data-plan="${t.code}">Planı aç</button>
        <button class="btn btn--gold" data-tour-type="${t.code}">3D tur</button>
      </div>
    </div>`;
  plansGrid.appendChild(card);
  scrollCtl.observe(card);
  leadType.insertAdjacentHTML('beforeend', `<option value="${t.code}">${t.title} (${t.area} m²)</option>`);
}

// Aktiv menyu linki
const secObs = new IntersectionObserver((ents) => {
  for (const e of ents) {
    if (!e.isIntersecting) continue;
    $$('#navLinks a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach((s) => secObs.observe(s));

scrollCtl.resize();
$('#burger').addEventListener('click', () => $('#nav').classList.toggle('is-open'));
$$('#navLinks a').forEach((a) => a.addEventListener('click', () => $('#nav').classList.remove('is-open')));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-on'), 3800);
}

$('#leadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  let ok = true;
  for (const el of [f.name, f.phone]) {
    const bad = !el.value.trim() || (el === f.phone && el.value.replace(/\D/g, '').length < 7);
    el.classList.toggle('is-invalid', bad);
    if (bad) ok = false;
  }
  if (!ok) { toast('Zəhmət olmasa adınızı və telefon nömrənizi yazın.'); return; }
  f.reset();
  toast('Təşəkkür edirik! Menecerimiz tezliklə sizinlə əlaqə saxlayacaq.');
});

// Plan modalı
const modal = $('#planModal');
function openPlanModal(plan, apt) {
  const title = apt ? `Mənzil № ${apt.number}` : plan.title;
  const sub = apt ? `${ordinal(apt.floor)} mərtəbə · ${plan.title} · ${apt.slot.side}` : `Tip ${plan.code} · ${plan.area} m²`;
  $('#modalContent').innerHTML = `
    <div class="modal-plan">
      <div class="modal-plan__img">${planSVG(plan, apt ? { slot: apt.slot } : {})}</div>
      <div class="modal-plan__info">
        <p class="eyebrow">${sub}</p>
        <h3 id="modalTitle">${title}</h3>
        <p class="text" style="margin-top:0">${plan.blurb}</p>
        ${roomList(plan)}
        ${apt ? '' : `<p>Qiymət: <b style="color:var(--gold)">${fmtPrice(minPrice(plan))}</b>-dan</p>`}
        <button class="btn btn--gold" data-modal-tour="${apt ? apt.id : plan.code}">3D virtual tura başla</button>
      </div>
    </div>`;
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal();
  const b = e.target.closest('[data-modal-tour]');
  if (b) {
    closeModal();
    const v = b.dataset.modalTour;
    const apt = APARTMENTS.find((a) => a.id === v);
    if (apt) startTour(apt);
    else enterExplore({ type: v });
  }
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.hidden) return closeModal();
  if (state.mode === 'tour') return exitTour();
  if (state.mode === 'design') return studio.escape();
  if (state.mode === 'floor') return state.apt ? closeApt() : backToBuilding();
  if (state.mode === 'building') return exitExplore();
});

document.addEventListener('click', (e) => {
  const ex = e.target.closest('[data-action="explore"]');
  if (ex) { e.preventDefault(); enterExplore(); return; }
  const pl = e.target.closest('[data-plan]');
  if (pl) { openPlanModal(PLAN_TYPES[pl.dataset.plan]); return; }
  const tt = e.target.closest('[data-tour-type]');
  if (tt) enterExplore({ type: tt.dataset.tourType });
});

/* =========================================================
   3D seçim rejimi
   ========================================================= */
const explorer = $('#explorer');
const floorList = $('#floorList');
const hint = $('#hint');
const tip = $('#tip');
const labelsEl = $('#labels');
const aptPanel = $('#aptPanel');
let savedScroll = 0;

$('#legend').innerHTML = Object.values(STATUS).map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('');

const matchesFilter = (a) => !state.rooms || a.type.rooms === state.rooms;

function renderFloorList() {
  const items = [];
  for (let f = BUILDING.lastFloor; f >= BUILDING.firstFloor; f--) {
    const apts = APARTMENTS.filter((a) => a.floor === f);
    const free = apts.filter((a) => a.status === 'available' && matchesFilter(a)).length;
    items.push(`<li><button data-floor="${f}" class="${state.floor === f ? 'is-active' : ''}">
      <span class="fnum">${f}</span>
      <span class="finfo">${ordinal(f)} mərtəbə<small>${free ? free + ' mənzil satışda' : 'Satışda yoxdur'}</small></span>
      <span class="fdots">${apts.map((a) => `<i class="${a.status} ${matchesFilter(a) ? '' : 'dim'}"></i>`).join('')}</span>
    </button></li>`);
  }
  floorList.innerHTML = items.join('');
}
floorList.addEventListener('click', (e) => {
  const b = e.target.closest('[data-floor]');
  if (b) selectFloor(+b.dataset.floor);
});
floorList.addEventListener('pointerover', (e) => {
  const b = e.target.closest('[data-floor]');
  if (b && state.mode === 'building') { state.hoverFloor = +b.dataset.floor; tower.showHighlight(state.hoverFloor); }
});
floorList.addEventListener('pointerleave', () => { if (state.mode === 'building') { state.hoverFloor = null; tower.showHighlight(null); } });

$('#filters').addEventListener('click', (e) => {
  const c = e.target.closest('[data-rooms]');
  if (!c) return;
  state.rooms = +c.dataset.rooms;
  $$('#filters .chip').forEach((x) => x.classList.toggle('is-on', x === c));
  renderFloorList();
  refreshAptVisuals();
});

function setCrumbs() {
  const parts = [`<button data-crumb="building">${COMPANY.project}</button>`];
  if (state.floor) parts.push('<i>/</i>', state.apt ? `<button data-crumb="floor">${ordinal(state.floor)} mərtəbə</button>` : `<b>${ordinal(state.floor)} mərtəbə</b>`);
  if (state.apt) parts.push('<i>/</i>', `<b>Mənzil № ${state.apt.number}</b>`);
  $('#crumbs').innerHTML = parts.join(' ');
  $('#exBack').disabled = state.mode === 'building';
}
$('#crumbs').addEventListener('click', (e) => {
  const c = e.target.closest('[data-crumb]');
  if (!c) return;
  if (state.mode === 'tour') exitTour(true);
  if (state.mode === 'design') { const ad = studio.exit(); state.mode = 'floor'; floorState.labels.forEach((l) => (l.style.display = '')); ad.overlay.visible = ad.border.visible = true; }
  if (c.dataset.crumb === 'building') backToBuilding();
  else if (c.dataset.crumb === 'floor') closeApt();
});
$('#exBack').addEventListener('click', () => {
  if (state.mode === 'design') { studio.escape(); return; }
  if (state.mode === 'tour') exitTour();
  else if (state.mode === 'floor') (state.apt ? closeApt() : backToBuilding());
});
$('#exClose').addEventListener('click', exitExplore);

function setHint(text) { hint.textContent = text || ''; }

const BUILDING_VIEW = { pos: new THREE.Vector3(34, 40, 110), tgt: new THREE.Vector3(0, 28, 0) };

function enterExplore(opts = {}) {
  if (state.mode !== 'landing') return;
  savedScroll = scrollYNow;
  scrollCtl.stop();
  state.mode = 'building';
  clearViewShift();
  document.body.classList.add('exploring');
  syncHeroVideo();
  explorer.hidden = false;
  $('#exFloors').classList.remove('is-hidden');
  renderFloorList();
  controls.target.copy(landingTarget);
  controls.enabled = true;
  setCrumbs();
  setHint(isTouch ? 'Mərtəbəyə toxunun və ya siyahıdan seçin' : 'Mərtəbənin üzərinə gəlin və klikləyin · Fırlatmaq üçün sürüşdürün');
  if (opts.type) {
    // uyğun, satışda olan mənzili tap və birbaşa tura keç
    const plan = PLAN_TYPES[opts.type];
    const mid = Math.round((BUILDING.firstFloor + BUILDING.lastFloor) / 2);
    const cands = APARTMENTS.filter((a) => a.type === plan && a.status === 'available').sort((a, b) => Math.abs(a.floor - mid) - Math.abs(b.floor - mid));
    const apt = cands[0] || APARTMENTS.find((a) => a.type === plan);
    selectFloor(apt.floor, () => openApt(apt, true));
    return;
  }
  flyTo(BUILDING_VIEW.pos, BUILDING_VIEW.tgt, 1600);
}

function exitExplore() {
  if (state.mode === 'landing') return;
  if (state.mode === 'tour') exitTour(true);
  if (state.mode === 'design') { studio.exit(); state.mode = 'floor'; }
  stopRender();
  setSunMode(false);
  $$('[data-daytime]').forEach((x) => x.classList.toggle('is-on', x.dataset.daytime === 'day'));
  closeApt(true);
  restoreFloors();
  disposeFloor();
  state.mode = 'landing';
  state.floor = null;
  tower.showHighlight(null);
  controls.enabled = false;
  document.body.classList.remove('exploring');
  explorer.hidden = true;
  tip.classList.remove('is-on');
  aimSun(new THREE.Vector3(0, 20, 20), 105);
  renderer.toneMappingExposure = 0.9;
  scrollCtl.start();
  scrollCtl.to(savedScroll, true);
  syncHeroVideo();
}

function startTour(apt) {
  if (state.mode === 'landing') {
    savedScroll = scrollYNow;
    scrollCtl.stop();
    state.mode = 'building';
    clearViewShift();
    document.body.classList.add('exploring');
    syncHeroVideo();
    explorer.hidden = false;
    renderFloorList();
    controls.enabled = true;
  }
  selectFloor(apt.floor, () => openApt(apt, true));
}

/* ---------- Mərtəbələr ---------- */
function liftUpperFloors(f) {
  const upper = [...tower.floors.values()].filter((fl) => fl.f > f).map((fl) => fl.group);
  upper.push(tower.roof);
  upper.forEach((g, i) => {
    const y0 = g.userData.y0 ?? (g.userData.y0 = g.position.y);
    const from = g.position.y;
    if (!g.visible) return;
    tween(900 + i * 25, (e) => { g.position.y = from + (y0 + 60 - from) * e; }, () => { g.visible = false; });
  });
  for (const fl of tower.floors.values()) {
    if (fl.f <= f && !fl.group.visible) {
      fl.group.visible = true;
      fl.group.position.y = fl.group.userData.y0 ?? fl.group.position.y;
    }
    if (fl.f <= f) fl.group.position.y = fl.group.userData.y0 ?? fl.group.position.y;
    fl.facade.visible = fl.f !== f;
  }
}

function restoreFloors() {
  const all = [...tower.floors.values()].map((fl) => fl.group);
  all.push(tower.roof);
  for (const g of all) {
    const y0 = g.userData.y0 ?? g.position.y;
    if (!g.visible) {
      g.visible = true;
      g.position.y = y0 + 60;
    }
    const from = g.position.y;
    if (Math.abs(from - y0) > 0.01) tween(1000, (e) => { g.position.y = from + (y0 - from) * e; });
  }
  for (const fl of tower.floors.values()) fl.facade.visible = true;
}

function disposeFloor() {
  if (!floorState) return;
  scene.remove(floorState.group);
  floorState.group.traverse((o) => { if (o.isMesh || o.isLineSegments) o.geometry?.dispose(); });
  floorState.labels.forEach((l) => l.remove());
  floorState = null;
}

function buildFloorInterior(f) {
  disposeFloor();
  const baseY = floorBaseY(f);
  const group = new THREE.Group();
  const apts = APARTMENTS.filter((a) => a.floor === f).map((a) => buildApartment(a, baseY, loadDesign(a)));
  apts.forEach((ad) => { group.add(ad.group); applyModels(ad); });
  group.add(buildCommonAreas(baseY));
  scene.add(group);
  const labels = apts.map((ad) => {
    const el = document.createElement('div');
    el.className = 'apt-label';
    const a = ad.apt;
    el.innerHTML = `<i style="background:${STATUS[a.status].color}"></i><span><b>№ ${a.number}</b> · ${a.type.rooms} otaq<small>${a.type.area} m² · ${STATUS[a.status].label}</small></span>`;
    labelsEl.appendChild(el);
    ad.label = el;
    ad.anchor = new THREE.Vector3((ad.bounds.x0 + ad.bounds.x1) / 2, baseY + 3.4, (ad.bounds.z0 + ad.bounds.z1) / 2);
    return el;
  });
  floorState = { f, group, apts, labels, baseY };
  refreshAptVisuals();
}

// Bir mənzili dizayna görə yenidən qur (dizayn studiyası)
function disposeGroup(g) {
  g.traverse((o) => { if ((o.isMesh || o.isLine) && !o.geometry.userData.shared) o.geometry.dispose(); });
}
function rebuildApt(ad, editable) {
  if (!floorState) return ad;
  const i = floorState.apts.indexOf(ad);
  const nad = buildApartment(ad.apt, floorState.baseY, ad.design, { editable });
  nad.label = ad.label;
  nad.anchor = ad.anchor;
  floorState.group.remove(ad.group);
  disposeGroup(ad.group);
  floorState.group.add(nad.group);
  applyModels(nad);
  nad.overlay.visible = ad.overlay.visible;
  nad.border.visible = ad.border.visible;
  if (i >= 0) floorState.apts[i] = nad;
  if (state.hoverApt === ad) state.hoverApt = null;
  return nad;
}

function selectFloor(f, done) {
  if (state.mode === 'tour') exitTour(true);
  closeApt(true);
  state.mode = 'floor';
  state.floor = f;
  state.hoverFloor = null;
  tip.classList.remove('is-on');
  canvas.style.cursor = '';
  tower.showHighlight(null);
  liftUpperFloors(f);
  buildFloorInterior(f);
  renderFloorList();
  setCrumbs();
  const baseY = floorBaseY(f);
  aimSun(new THREE.Vector3(0, baseY, 0), 26);
  renderer.toneMappingExposure = FLOOR_EXP;
  const small = isSmall();
  controls.minDistance = 8;
  controls.maxDistance = 90;
  setHint(isTouch ? 'Mənzilə toxunun — ətraflı məlumat və virtual tur' : 'Mənzilin üzərinə gəlin və klikləyin');
  flyTo(new THREE.Vector3(small ? 0 : -4, baseY + (small ? 44 : 30), small ? 26 : 25), new THREE.Vector3(small ? 0 : -3, baseY, small ? 3 : 1), 1500, done);
}

function backToBuilding() {
  closeApt(true);
  restoreFloors();
  disposeFloor();
  state.mode = 'building';
  state.floor = null;
  renderFloorList();
  setCrumbs();
  aimSun(new THREE.Vector3(0, 20, 20), 105);
  renderer.toneMappingExposure = 0.9;
  controls.minDistance = 24;
  controls.maxDistance = 260;
  $('#exFloors').classList.remove('is-hidden');
  setHint(isTouch ? 'Mərtəbəyə toxunun və ya siyahıdan seçin' : 'Mərtəbənin üzərinə gəlin və klikləyin');
  flyTo(BUILDING_VIEW.pos, BUILDING_VIEW.tgt, 1400);
}

/* ---------- Mənzillər ---------- */
function refreshAptVisuals() {
  if (!floorState) return;
  for (const ad of floorState.apts) {
    const a = ad.apt;
    const on = matchesFilter(a);
    const hover = state.hoverApt === ad || (state.apt && state.apt.id === a.id);
    ad.overlay.material.opacity = hover ? 0.32 : on ? 0.1 : 0.0;
    ad.border.material.opacity = on ? (hover ? 1 : 0.75) : 0.15;
    ad.label.classList.toggle('is-dim', !on);
    ad.label.classList.toggle('is-hover', hover);
  }
}

function openApt(apt, andTour = false) {
  state.apt = apt;
  const ad = floorState.apts.find((x) => x.apt.id === apt.id);
  const plan = apt.type;
  const dplan = (ad && ad.plan) || plan; // dizayn studiyasında dəyişdirilmiş otaq adları
  const st = STATUS[apt.status];
  const perM2 = Math.round(apt.price / plan.area);
  aptPanel.innerHTML = `
    <div class="apt-panel__scroll">
      <div class="apt-head">
        <button class="apt-close" data-apt-close aria-label="Bağla"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        <span class="status-badge"><i style="background:${st.color}"></i>${st.label}</span>
        <h3>Mənzil № ${apt.number}</h3>
        <p>${ordinal(apt.floor)} mərtəbə · ${plan.title} · Tip ${plan.code}</p>
      </div>
      <div class="apt-plan" data-apt-plan title="Planı böyüt">${planSVG(dplan, { slot: apt.slot })}</div>
      <dl class="facts">
        <div><dt>Sahə</dt><dd>${plan.area} m²</dd></div>
        <div><dt>Otaq</dt><dd>${plan.rooms}</dd></div>
        <div><dt>Mərtəbə</dt><dd>${apt.floor} / ${BUILDING.lastFloor}</dd></div>
        <div><dt>Mənzərə</dt><dd>${apt.slot.side}</dd></div>
        <div class="price"><dt>Qiymət</dt><dd>${apt.status === 'sold' ? '—' : fmtPrice(apt.price)}</dd></div>
        <div><dt>1 m²</dt><dd>${apt.status === 'sold' ? '—' : fmtPrice(perM2)}</dd></div>
      </dl>
      ${sunHoursBlock(apt)}
      ${roomList(dplan)}
    </div>
    <div class="apt-actions">
      <button class="btn btn--gold btn--block" data-apt-tour>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M2 12h20"/></svg>
        Virtual tura başla
      </button>
      <button class="btn btn--ghost btn--block btn--design" data-apt-design>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="11" cy="6.8" r="1.2"/><circle cx="16" cy="8" r="1.2"/></svg>
        Dizayn studiyası${isCustom(apt) ? ' <small>· fərdi dizayn</small>' : ''}
      </button>
      ${apt.status === 'sold' ? '' : '<button class="btn btn--ghost btn--block" data-apt-lead>Bu mənzilə müraciət et</button>'}
    </div>`;
  aptPanel.classList.add('is-open');
  if (isSmall()) $('#exFloors').classList.add('is-hidden');
  setCrumbs();
  refreshAptVisuals();
  setHint('');
  if (andTour) { startTourFor(ad); return; }
  // kameranı mənzilə yaxınlaşdır
  const c = ad.anchor.clone().setY(floorState.baseY);
  const side = (ad.bounds.z0 + ad.bounds.z1) / 2 > 0 ? 1 : -1;
  const offX = isSmall() ? 0 : 5;
  flyTo(new THREE.Vector3(c.x + offX, c.y + 17, c.z + side * 12), new THREE.Vector3(c.x + offX * 0.6, c.y, c.z), 1100);
}

function closeApt(silent) {
  if (!state.apt && silent) { aptPanel.classList.remove('is-open'); return; }
  state.apt = null;
  aptPanel.classList.remove('is-open');
  $('#exFloors').classList.remove('is-hidden');
  refreshAptVisuals();
  setCrumbs();
  if (!silent && state.mode === 'floor') {
    const baseY = floorState.baseY;
    setHint(isTouch ? 'Mənzilə toxunun — ətraflı məlumat və virtual tur' : 'Mənzilin üzərinə gəlin və klikləyin');
    flyTo(new THREE.Vector3(-4, baseY + 30, 25), new THREE.Vector3(-3, baseY, 1), 1100);
  }
}

aptPanel.addEventListener('click', (e) => {
  if (e.target.closest('[data-apt-sun]')) setSunMode(true);
  if (e.target.closest('[data-apt-close]')) closeApt();
  if (e.target.closest('[data-apt-plan]')) openPlanModal(state.apt.type, state.apt);
  if (e.target.closest('[data-apt-tour]')) {
    const ad = floorState.apts.find((x) => x.apt.id === state.apt.id);
    startTourFor(ad);
  }
  if (e.target.closest('[data-apt-design]')) enterDesign(floorState.apts.find((x) => x.apt.id === state.apt.id));
  if (e.target.closest('[data-apt-lead]')) {
    const apt = state.apt;
    exitExplore();
    $('#leadType').value = apt.type.code;
    $('#leadForm').note.value = `Mənzil № ${apt.number}, ${ordinal(apt.floor)} mərtəbə`;
    setTimeout(() => scrollCtl.toEl(document.getElementById('contact')), 50);
  }
});

/* ---------- Dizayn studiyası ---------- */
const studio = initStudio({
  camera, canvas, controls, flyTo, toast,
  rebuild: rebuildApt,
  onClose: (ad) => {
    state.mode = 'floor';
    floorState.labels.forEach((l) => (l.style.display = ''));
    ad.overlay.visible = true;
    ad.border.visible = true;
    openApt(ad.apt);
  },
  onTour: (ad) => {
    state.mode = 'floor';
    floorState.labels.forEach((l) => (l.style.display = ''));
    ad.overlay.visible = true;
    ad.border.visible = true;
    state.apt = ad.apt;
    startTourFor(ad);
  },
});
function enterDesign(ad) {
  if (!ad) return;
  state.mode = 'design';
  aptPanel.classList.remove('is-open');
  $('#exFloors').classList.add('is-hidden');
  tip.classList.remove('is-on');
  setHint('');
  floorState.labels.forEach((l) => (l.style.display = 'none'));
  ad.overlay.visible = false;
  ad.border.visible = false;
  studio.enter(ad);
}

/* ---------- Virtual tur ---------- */
const tourHud = $('#tourHud');
const roomsBar = $('#roomsBar');
const minimap = $('#minimap');
let mapMarker = null;

function startTourFor(ad) {
  state.mode = 'tour';
  tourData = ad;
  controls.enabled = false;
  aptPanel.classList.remove('is-open');
  $('#exFloors').classList.add('is-hidden');
  tip.classList.remove('is-on');
  setHint('');
  // bu mənzilin tavanı və lampaları
  ad.tourOnly.visible = true;
  ad.overlay.visible = false;
  ad.border.visible = false;
  floorState.labels.forEach((l) => (l.style.display = 'none'));
  // yuxarı mərtəbələri qaytar (pəncərədən görünsün) — amma bu mərtəbənin fasadı gizli qalır
  const lookFrom = ad.start.clone().setY(ad.baseY + 1.62);
  const dir = ad.startLook.clone().sub(ad.start).setY(0).normalize();
  flyTo(lookFrom, lookFrom.clone().add(dir), 1600, () => {
    tour.start(ad);
    lampPool.forEach((l, i) => {
      const p = ad.lamps[i];
      l.intensity = p ? 5 : 0;
      if (p) l.position.copy(p);
    });
    scene.environment = interiorEnv();
    scene.environmentIntensity = TOUR_ENV;
    renderer.toneMappingExposure = TOUR_EXP;
    setBloom(99, 0); // gündüz turda parıltı yoxdur — pəncərə kənarlarını ağ dumanla örtürdü
    aimSun(new THREE.Vector3((ad.bounds.x0 + ad.bounds.x1) / 2, ad.baseY, (ad.bounds.z0 + ad.bounds.z1) / 2), 14);
    tourHud.hidden = false;
    setupTourHud(ad);
    if (sunSim.on) applySun();
  });
  setCrumbs();
}

function setupTourHud(ad) {
  roomsBar.innerHTML = ad.rooms.map((r, i) => `<button data-room="${i}">${r.name}</button>`).join('');
  minimap.innerHTML = planSVG(ad.plan || ad.apt.type, { slot: ad.apt.slot, compact: true });
  const svg = minimap.querySelector('svg');
  svg.insertAdjacentHTML('beforeend', `<g id="mapMarker"><path d="M0 0 L2.4 -1.1 A2.6 2.6 0 0 1 2.4 1.1 Z" style="fill:rgba(var(--gold-rgb),0.35)"/><circle r="0.32" style="fill:var(--gold)" stroke="#fff" stroke-width="0.1"/></g>`);
  mapMarker = svg.querySelector('#mapMarker');
}

roomsBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-room]');
  if (!b || !tourData) return;
  tour.goToRoom(tourData.rooms[+b.dataset.room]);
});

tour.onMove = (pos, yaw) => {
  if (!tourData || !mapMarker) return;
  const p = Tour.toPlan(pos, tourData.apt.slot);
  const ang = (Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) * 180) / Math.PI;
  mapMarker.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${ang.toFixed(1)})`);
  // hazırkı otağı işarələ
  const room = tourData.rooms.findIndex((r) => pos.x >= r.rect.x0 && pos.x <= r.rect.x1 && pos.z >= r.rect.z0 && pos.z <= r.rect.z1);
  if (room !== tourData._room) {
    tourData._room = room;
    $$('button', roomsBar).forEach((b, i) => b.classList.toggle('is-on', i === room));
  }
};

function exitTour(silent) {
  if (state.mode !== 'tour') return;
  stopRender();
  tour.stop();
  tourHud.hidden = true;
  const ad = tourData;
  ad.tourOnly.visible = false;
  ad.overlay.visible = true;
  ad.border.visible = true;
  floorState.labels.forEach((l) => (l.style.display = ''));
  lampPool.forEach((l) => (l.intensity = 0));
  scene.environment = sunSim.on && skyEnvRT ? skyEnvRT.texture : envExterior;
  scene.environmentIntensity = 1.0;
  renderer.toneMappingExposure = FLOOR_EXP;
  setBloom(99, 0);
  if (sunSim.on) applySun();
  camera.fov = baseFov();
  camera.updateProjectionMatrix();
  aimSun(new THREE.Vector3(0, floorState.baseY, 0), 26);
  state.mode = 'floor';
  tourData = null;
  controls.enabled = true;
  if (silent) return;
  // kameranı mənzilin üstünə qaldır (yuxarıdan görünüş)
  controls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
  openApt(ad.apt);
}
$('#tourExit').addEventListener('click', () => exitTour());

/* =========================================================
   Siçan / toxunma ilə seçim
   ========================================================= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e, objects) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(objects, false)[0] || null;
}
const floorHits = () => [...tower.floors.values()].filter((fl) => fl.group.visible).map((fl) => fl.hit);

function showTip(e, html) {
  tip.innerHTML = html;
  tip.classList.add('is-on');
  const x = Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 10);
  const y = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 10);
  tip.style.transform = `translate(${x}px, ${y}px)`;
}

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  if (state.mode === 'building') {
    const h = pick(e, floorHits());
    const f = h ? h.object.userData.floor : null;
    if (f !== state.hoverFloor) {
      state.hoverFloor = f;
      tower.showHighlight(f);
      $$('#floorList button').forEach((b) => b.classList.toggle('is-hover', +b.dataset.floor === f));
    }
    if (f) {
      const free = APARTMENTS.filter((a) => a.floor === f && a.status === 'available' && matchesFilter(a)).length;
      showTip(e, `<b>${ordinal(f)} mərtəbə</b><small>${free} mənzil satışda · klikləyin</small>`);
      canvas.style.cursor = 'pointer';
    } else { tip.classList.remove('is-on'); canvas.style.cursor = ''; }
  } else if (state.mode === 'floor' && floorState) {
    const h = pick(e, floorState.apts.map((a) => a.hit));
    const ad = h ? floorState.apts.find((a) => a.hit === h.object) : null;
    if (ad !== state.hoverApt) { state.hoverApt = ad; refreshAptVisuals(); }
    if (ad && !state.apt) {
      const a = ad.apt;
      showTip(e, `<b>Mənzil № ${a.number}</b><small>${a.type.title} · ${a.type.area} m² · ${a.status === 'sold' ? STATUS.sold.label : fmtPrice(a.price)}</small>`);
      canvas.style.cursor = 'pointer';
    } else { tip.classList.remove('is-on'); canvas.style.cursor = ''; }
  } else if (state.mode !== 'design') {
    tip.classList.remove('is-on');
    canvas.style.cursor = state.mode === 'tour' ? 'grab' : '';
  }
});

let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 8) return;
  if (state.mode === 'building') {
    const h = pick(e, floorHits());
    if (h) selectFloor(h.object.userData.floor);
  } else if (state.mode === 'floor' && floorState) {
    const h = pick(e, floorState.apts.map((a) => a.hit));
    if (h) {
      tip.classList.remove('is-on');
      openApt(h.object.userData.apt);
    }
  }
});

/* =========================================================
   Günəş simulyasiyası (tarix + saat → günəşin real mövqeyi)
   ========================================================= */
const sunSim = { on: false, playing: false, y: new Date().getFullYear(), m: 6, d: 21, min: 12 * 60 };
const skyMesh = new Sky();
skyMesh.scale.setScalar(3600);
skyMesh.visible = false;
scene.add(skyMesh);
const skyNight = { value: 0 };
const skyDusk = { value: 0 };
const skyEnvScene = new THREE.Scene();
const skyEnv = new Sky();
skyEnv.scale.setScalar(50);
skyEnvScene.add(skyEnv);
for (const sk of [skyMesh, skyEnv]) {
  // Sky şeyderi çox parlaqdır — səhnənin ekspozisiyasına uyğunlaşdır
  sk.material.uniforms.uNightSky = skyNight;
  sk.material.uniforms.uDusk = skyDusk;
  sk.material.onBeforeCompile = (sh) => {
    sh.uniforms.uNightSky = skyNight;
    sh.uniforms.uDusk = skyDusk;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uNightSky; uniform float uDusk;
        float starHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {`)
      .replace('gl_FragColor = vec4( texColor, 1.0 );', `vec3 dirN = normalize(vWorldPosition - cameraPosition);
        float up = clamp(dirN.y, 0.0, 1.0);
        vec3 nightCol = mix(vec3(0.07, 0.09, 0.16), vec3(0.012, 0.02, 0.05), pow(up, 0.45));
        vec3 q = floor(dirN * 420.0);
        float star = step(0.9965, starHash(q)) * smoothstep(0.03, 0.25, up) * (0.4 + 0.6 * starHash(q + 3.1));
        vec3 duskCol = mix(vec3(1.0, 0.62, 0.45), vec3(0.34, 0.4, 0.66), pow(up, 0.33));
        gl_FragColor = vec4(texColor * 0.2 + (nightCol + vec3(star) * 0.9 * (1.0 - uDusk)) * uNightSky + duskCol * uDusk * 0.55, 1.0);`);
  };
  const u = sk.material.uniforms;
  u.turbidity.value = 2.0; u.rayleigh.value = 2.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
}
let skyEnvRT = null, envTimer = 0;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SUN_WARM = new THREE.Color(0xff9a52), SUN_DAY = new THREE.Color(0xfff3e2);
const FOG_DAY = new THREE.Color(0xc4d2de), FOG_DUSK = new THREE.Color(0xd9a383), FOG_NIGHT = new THREE.Color(0x1a2438);

let _glow = null;
function glowMats() {
  if (_glow) return _glow;
  const set = new Set();
  scene.traverse((o) => { if (o.material && o.material.userData && (o.material.userData.nightGlow != null || o.material.userData.nightOpacity != null)) set.add(o.material); });
  return (_glow = [...set]);
}
function rebuildSkyEnv() {
  const rt = pmrem.fromScene(skyEnvScene, 0, 0.1, 100);
  if (skyEnvRT) skyEnvRT.dispose();
  skyEnvRT = rt;
  if (sunSim.on && state.mode !== 'tour') scene.environment = rt.texture;
}

function applySun() {
  const date = localDate(sunSim.y, sunSim.m, sunSim.d, sunSim.min);
  const { altitude, azimuth } = sunPosition(date);
  sunDirection(altitude, azimuth, lightDir);
  const altDeg = THREE.MathUtils.radToDeg(altitude);
  for (const sk of [skyMesh, skyEnv]) sk.material.uniforms.sunPosition.value.copy(lightDir);
  const day = smooth(-1, 6, altDeg);
  const night = 1 - smooth(-7, 3, altDeg);
  if (altDeg > -1.5) {
    sunLight.intensity = 3.6 * day * (0.55 + 0.45 * smooth(0, 30, altDeg));
    sunLight.color.lerpColors(SUN_WARM, SUN_DAY, smooth(2, 28, altDeg));
  } else {
    // günəş batıb: ay işığı (soyuq, zəif) formaları göstərir
    lightDir.set(0.35, 0.82, -0.45).normalize();
    sunLight.intensity = 0.55 * night;
    sunLight.color.set(0x9fb2e0);
  }
  const duskK = Math.exp(-Math.pow((altDeg + 2.5) / 3.2, 2));
  hemi.intensity = 0.25 + 0.12 * smooth(-10, 20, altDeg) + night * 0.35 + duskK * 0.35;
  setBloom(THREE.MathUtils.lerp(6, 0.95, night), 0.08 + night * 0.2);
  hemi.color.set(duskK > 0.4 ? 0x9a93c0 : night > 0.5 ? 0x5d7098 : 0xcfe0f5);
  windowMaterial().userData.uniforms.uNight.value = night;
  skyNight.value = night;
  skyDusk.value = Math.exp(-Math.pow((altDeg + 2.5) / 3.2, 2));
  bakuUniforms.uNight.value = night;
  const envK = 0.4 + 0.6 * smooth(-6, 15, altDeg);
  scene.environmentIntensity = state.mode === 'tour' ? TOUR_ENV * envK : envK;
  scene.fog.density = 0.00035 + night * 0.0003;
  // axşam: fənərlər, lobbi, lövhə yanır
  for (const m of glowMats()) {
    if (m.userData.nightGlow != null) m.emissiveIntensity = m.userData.nightGlow * (1 + night * 9) + (m.userData.nightGlowAdd || 0) * night;
    if (m.userData.nightOpacity != null) m.opacity = m.userData.nightOpacity * night;
  }
  // turda: otaq lampaları qaranlıqlaşdıqca yanır
  if (state.mode === 'tour' && tourData) lampPool.forEach((l, i) => (l.intensity = tourData.lamps[i] ? 0.3 + 3.2 * night : 0));
  renderer.toneMappingExposure = (state.mode === 'tour' ? TOUR_EXP : state.mode === 'floor' ? FLOOR_EXP : 0.8) * (1 + night * 0.9);
  const dusk = 1 - smooth(4, 20, Math.abs(altDeg));
  scene.fog.color.copy(FOG_DAY).lerp(FOG_DUSK, dusk * day).lerp(FOG_NIGHT, night);
  aimSun(lastAim.center, lastAim.size);
  // mühit işığını tez-tez yox, 150 ms-dən bir yenilə
  clearTimeout(envTimer);
  envTimer = setTimeout(rebuildSkyEnv, sunSim.playing ? 0 : 120);
  updateSunUI(altDeg, THREE.MathUtils.radToDeg(azimuth));
}

const sunPanel = $('#sunPanel');
const sunTimeInput = $('#sunTime');
const COMPASS = ['Şm', 'ŞmŞ', 'Ş', 'CŞ', 'C', 'CQ', 'Q', 'ŞmQ'];
function updateSunUI(altDeg, azDeg) {
  $('#sunClock').textContent = fmtTime(sunSim.min);
  sunTimeInput.value = Math.round(sunSim.min);
  const t = sunSim.times;
  $('#sunMeta').innerHTML = `
    <span>Gün çıxır <b>${fmtTime(t.rise)}</b></span>
    <span>Batır <b>${fmtTime(t.set)}</b></span>
    <span>Hündürlük <b>${altDeg.toFixed(1)}°</b></span>
    <span>Azimut <b>${azDeg.toFixed(0)}° ${COMPASS[Math.round(azDeg / 45) % 8]}</b></span>
    <span>Gün uzunluğu <b>${t.rise != null && t.set != null ? fmtTime(t.set - t.rise) : '—'}</b></span>`;
}
function setSunDay(m, d) {
  sunSim.m = m; sunSim.d = d;
  sunSim.times = sunTimes(sunSim.y, m, d);
  const { rise, set } = sunSim.times;
  const a = ((rise ?? 0) / 1440) * 100, b = ((set ?? 1440) / 1440) * 100;
  sunTimeInput.style.setProperty('--sun-track', `linear-gradient(90deg, #1b2336 0%, #1b2336 ${a - 2}%, #e98a4a ${a}%, #ffe2a0 ${(a + b) / 2}%, #e98a4a ${b}%, #1b2336 ${b + 2}%, #1b2336 100%)`);
  sunTimeInput.style.background = sunTimeInput.style.getPropertyValue('--sun-track');
  $$('#sunDays .chip').forEach((c) => c.classList.toggle('is-on', +c.dataset.m === m && +c.dataset.d === d));
  $('#sunDate').value = `${sunSim.y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  applySun();
}
$('#sunDays').innerHTML = SEASONS.map((s) => `<button class="chip" data-m="${s.m}" data-d="${s.d}">${s.label}</button>`).join('') +
  `<input type="date" id="sunDate" aria-label="Tarix">`;
$('#sunDays').addEventListener('click', (e) => { const c = e.target.closest('[data-m]'); if (c) setSunDay(+c.dataset.m, +c.dataset.d); });
$('#sunDate').addEventListener('change', (e) => { const [, mm, dd] = e.target.value.split('-').map(Number); if (mm && dd) setSunDay(mm, dd); });
sunTimeInput.addEventListener('input', () => { sunSim.min = +sunTimeInput.value; sunSim.playing = false; $('#sunPlay').classList.remove('is-on'); applySun(); });
$('#sunPlay').addEventListener('click', () => {
  sunSim.playing = !sunSim.playing;
  $('#sunPlay').classList.toggle('is-on', sunSim.playing);
  if (sunSim.playing && (sunSim.min > (sunSim.times.set ?? 1440) || sunSim.min < (sunSim.times.rise ?? 0) - 60)) sunSim.min = (sunSim.times.rise ?? 360) - 30;
});
$('#sunClose').addEventListener('click', () => setSunMode(false));
$('#sunBtn').addEventListener('click', () => setSunMode(!sunSim.on));

function setSunMode(on) {
  if (on === sunSim.on) return;
  sunSim.on = on;
  sunPanel.hidden = !on;
  document.body.classList.toggle('sun-on', on);
  $('#sunBtn').setAttribute('aria-pressed', String(on));
  if (on) {
    scene.background = null;
    skyMesh.visible = true;
    if (!sunSim.times) setSunDay(sunSim.m, sunSim.d); else applySun();
  } else {
    sunSim.playing = false;
    $('#sunPlay').classList.remove('is-on');
    skyMesh.visible = false;
    if (hdrTex) scene.background = hdrTex;
    // turda ətraf işığı 0.3 qalmalıdır — əvvəl 1.0 olurdu və otaq 3 dəfə parlaqlaşıb ağarırdı
    if (state.mode !== 'tour') scene.environment = envExterior;
    else scene.environment = interiorEnv();
    scene.environmentIntensity = state.mode === 'tour' ? TOUR_ENV : 1.0;
    lightDir.copy(hdrLightDir);
    sunLight.intensity = 3.4;
    sunLight.color.set(0xfff1dc);
    hemi.intensity = 0.25;
    hemi.color.set(0xcfe0f5);
    setBloom(99, 0);
    windowMaterial().userData.uniforms.uNight.value = 0;
    skyNight.value = 0;
    skyDusk.value = 0;
    bakuUniforms.uNight.value = 0;
    scene.fog.density = 0.00045;
    for (const m of glowMats()) {
      if (m.userData.nightGlow != null) m.emissiveIntensity = m.userData.nightGlow;
      if (m.userData.nightOpacity != null) m.opacity = 0;
    }
    renderer.toneMappingExposure = state.mode === 'tour' ? TOUR_EXP : state.mode === 'floor' ? FLOOR_EXP : 0.9;
    if (state.mode === 'tour' && tourData) lampPool.forEach((l, i) => (l.intensity = tourData.lamps[i] ? 5 : 0));
    if (hdrTex) scene.fog.color.copy(horizonColor(hdrTex));
    aimSun(lastAim.center, lastAim.size);
  }
}

function sunHoursBlock(apt) {
  const data = seasonalSunHours(apt);
  const max = 14;
  return `<div class="sun-hours">
    <div class="sun-hours__head"><b>☀ Birbaşa günəş işığı</b><small>saat / gün · kölgələr nəzərə alınıb</small></div>
    <div class="sun-bars">${data.map((s) => `<div class="sun-bar"><b>${s.hours.toFixed(1)}</b><i style="--h:${Math.max(3, (s.hours / max) * 100)}%"></i><span>${s.label.split(' ')[0]} ${s.label.split(' ')[1].slice(0, 3)}</span></div>`).join('')}</div>
    <button class="btn btn--ghost" data-apt-sun>Günəşi saatlara görə göstər</button>
  </div>`;
}

/* =========================================================
   Baş plan: nömrəli korpuslar + gündüz/gecə
   ========================================================= */
const MP = [
  { id: 1, pos: new THREE.Vector3(0, floorBaseY(BUILDING.lastFloor + 1) + 9, 0), floors: BUILDING.lastFloor, apts: APARTMENTS.length, status: 'Satışda', main: true },
  ...NEIGHBORS.map((n) => ({ id: n.id, pos: new THREE.Vector3(n.x, 4.6 + 4.2 + n.floors * 3.2 + 6, n.z), floors: n.floors + 2, apts: n.floors * 6, status: n.id <= 3 ? 'Satışda' : n.id <= 6 ? 'Tikintidə' : 'Təhvil verilib' })),
];
const mpSection = $('#masterplan');
const mpMarkers = $('#mpMarkers');
const mpCard = $('#mpCard');
MP.forEach((b) => {
  const el = document.createElement('button');
  el.className = 'mp-marker' + (b.main ? ' mp-marker--main' : '');
  el.textContent = b.id;
  el.setAttribute('aria-label', `Korpus ${b.id}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); openMpCard(b); });
  mpMarkers.appendChild(el);
  b.el = el;
});
let mpOpen = null;
function openMpCard(b) {
  mpOpen = b;
  MP.forEach((x) => x.el.classList.toggle('is-on', x === b));
  mpCard.innerHTML = `<h4>Korpus ${b.id}${b.main ? ' · Nova Residence' : ''}</h4>
    <dl><dt>Mərtəbə</dt><dd>${b.floors}</dd><dt>Mənzil</dt><dd>${b.apts}</dd><dt>Vəziyyət</dt><dd>${b.status}</dd></dl>
    ${b.main ? '<button class="btn btn--gold" data-action="explore">3D-də mənzil seç</button>' : '<button class="btn btn--ghost" data-mp-close>Bağla</button>'}`;
  mpCard.hidden = false;
}
mpCard.addEventListener('click', (e) => { if (e.target.closest('[data-mp-close]')) { mpCard.hidden = true; mpOpen = null; MP.forEach((x) => x.el.classList.remove('is-on')); } });
const _mp = new THREE.Vector3();
function updateMasterplan() {
  camera.updateMatrixWorld();
  const r = mpSection.getBoundingClientRect();
  const visible = state.mode === 'landing' && r.top < innerHeight && r.bottom > 0;
  mpMarkers.style.display = visible ? '' : 'none';
  if (!visible) { mpCard.hidden = true; return; }
  const sticky = mpSection.querySelector('.pin__sticky').getBoundingClientRect();
  for (const b of MP) {
    _mp.copy(b.pos).project(camera);
    const x = (_mp.x * 0.5 + 0.5) * innerWidth, y = (-_mp.y * 0.5 + 0.5) * innerHeight - sticky.top;
    b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    b.el.style.opacity = _mp.z < 1 ? '1' : '0';
    b.sx = x; b.sy = y;
  }
  if (mpOpen && !mpCard.hidden) {
    const x = Math.min(innerWidth - 276, Math.max(16, mpOpen.sx + 28)), y = Math.min(innerHeight - 220, Math.max(80, mpOpen.sy - 40));
    mpCard.style.transform = `translate(${x}px, ${y}px)`;
  }
}
$$('[data-daytime]').forEach((b) => b.addEventListener('click', () => {
  const mode = b.dataset.daytime;
  $$('[data-daytime]').forEach((x) => x.classList.toggle('is-on', x === b));
  if (mode !== 'day') {
    sunSim.m = 6; sunSim.d = 21; sunSim.min = mode === 'dusk' ? 20 * 60 + 31 : 20 * 60 + 58;
    setSunMode(true);
    setSunDay(6, 21);
  } else {
    setSunMode(false);
  }
}));

/* =========================================================
   Foto-render: işıq izləmə (path tracing) ilə real render
   ========================================================= */
const RENDER_TARGET_SAMPLES = isTouch ? 120 : 400;
let pt = null, ptScene = null, rendering = false, renderT0 = 0, savedExposure = null;
let renderKind = null;
async function startRender(kind = 'tour') {
  if (rendering) return;
  if (kind === 'tour' && !tourData) return;
  rendering = true;
  renderKind = kind;
  document.body.classList.add('rendering');
  $('#renderHud').hidden = false;
  $('#renderText').textContent = 'Səhnə hazırlanır…';
  if (kind === 'tour') tour.active = false;
  if (state.mode === 'landing') scrollCtl.stop();
  controls.enabled = false;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const { WebGLPathTracer } = await import('../vendor/pathtracer/index.module.js');
    const night = windowMaterial().userData.uniforms.uNight.value;
    const altDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(lightDir.y, -1, 1)));
    if (kind === 'tour') {
      ptScene = new THREE.Scene();
      const apt = tourData.group.clone(true);
      const drop = [];
      apt.traverse((o) => {
        if (o.userData.tourOnly) o.visible = true;
        if (o.isLineSegments || (o.material && (o.material.visible === false || (o.material.isMeshBasicMaterial && o.material.opacity < 0.5)))) drop.push(o);
      });
      drop.forEach((o) => o.parent && o.parent.remove(o));
      ptScene.add(apt);
      const b = tourData.bounds;
      const slabGeo = new THREE.BoxGeometry(b.x1 - b.x0 + 2, 0.3, b.z1 - b.z0 + 2);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
      for (const y of [tourData.baseY - 0.15, tourData.baseY + 3.15]) {
        const m = new THREE.Mesh(slabGeo, slabMat);
        m.position.set((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2);
        ptScene.add(m);
      }
      lampPool.forEach((l) => { if (l.intensity > 0) { const c = new THREE.PointLight(l.color, l.intensity, l.distance, l.decay); c.position.copy(l.position); ptScene.add(c); } });
    } else {
      // xarici görünüş: kamera fokusu ətrafında səhnənin fiziki nüsxəsi
      const focus = (state.mode === 'landing' ? landingTarget : controls.target).clone();
      const dist = camera.position.distanceTo(focus);
      ptScene = buildPTScene(scene, { focus, radius: Math.min(900, 380 + dist * 1.2), night, skip: (o) => o === skyMesh || o === tour.ring });
    }
    // günəş
    if (sunLight.intensity > 0.01) {
      const sun = new THREE.DirectionalLight(sunLight.color, sunLight.intensity);
      sun.position.copy(sunLight.position);
      sun.target.position.copy(sunLight.target.position);
      ptScene.add(sun, sun.target);
    }
    // mühit: gündüz foto-səma, günəş rejimində isə vaxta uyğun səma
    const env = sunSim.on ? skyEquirect(lightDir.clone(), altDeg) : hdrTex;
    if (env) { ptScene.environment = env; ptScene.background = env; }
    ptScene.environmentIntensity = kind === 'tour' ? (sunSim.on ? Math.max(0.03, 1 - night) : 1.0) : 1.0;
    ptScene.backgroundIntensity = ptScene.environmentIntensity;

    pt = new WebGLPathTracer(renderer);
    pt.bounces = kind === 'tour' ? 6 : 4;
    pt.transmissiveBounces = 4;
    pt.filterGlossyFactor = 0.5;
    pt.tiles.set(isTouch ? 3 : 2, isTouch ? 3 : 2);
    pt.renderScale = isTouch ? 0.6 : 1;
    pt.minSamples = 1;
    pt.fadeDuration = 400;
    pt.renderDelay = 0;
    pt.setScene(ptScene, camera);
    savedExposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = savedExposure * (kind === 'tour' ? 1.35 : 1.1);
    renderT0 = performance.now();
  } catch (e) {
    console.error('Render xətası', e);
    $('#renderText').textContent = 'Bu cihaz foto-render-i dəstəkləmir';
    setTimeout(stopRender, 2500);
  }
}
function stopRender() {
  if (!rendering) return;
  rendering = false;
  if (pt) { pt.dispose?.(); pt = null; }
  if (savedExposure != null) { renderer.toneMappingExposure = savedExposure; savedExposure = null; }
  ptScene = null;
  document.body.classList.remove('rendering');
  $('#renderHud').hidden = true;
  if (state.mode === 'tour') tour.active = true;
  if (state.mode === 'landing') scrollCtl.start();
  if (state.mode === 'building' || state.mode === 'floor') controls.enabled = true;
  renderKind = null;
}
function renderTick() {
  if (!pt) return false;
  if (pt.samples < RENDER_TARGET_SAMPLES) pt.renderSample();
  const k = Math.min(1, pt.samples / RENDER_TARGET_SAMPLES);
  $('#renderBar').style.width = `${(k * 100).toFixed(1)}%`;
  const sec = ((performance.now() - renderT0) / 1000).toFixed(0);
  $('#renderText').textContent = pt.isCompiling ? 'Şeyderlər hazırlanır…' : k < 1 ? `İşıq hesablanır · ${Math.floor(pt.samples)}/${RENDER_TARGET_SAMPLES} · ${sec} san` : `Hazırdır · ${sec} san`;
  return true;
}
$('#renderBtn').addEventListener('click', () => startRender('tour'));
$$('[data-render="ext"]').forEach((b) => b.addEventListener('click', () => startRender('ext')));
$('#renderClose').addEventListener('click', stopRender);
$('#renderSave').addEventListener('click', () => {
  if (!pt) return;
  pt.renderSample();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/jpeg', 0.93);
  a.download = `nova-residence-render-${Date.now()}.jpg`;
  a.click();
});

/* =========================================================
   Kamera qoruyucusu (3D seçim rejimi)
   ========================================================= */
const TOWER_PTS = [[0, 14, 0], [0, 32, 0], [0, 52, 0], [15, 30, 10], [-15, 30, 10], [15, 30, -10], [-15, 30, -10]].map((p) => new THREE.Vector3(...p));
const floorPts = [0, 0, 0, 0, 0].map(() => new THREE.Vector3());
function updateGuard(dt, now) {
  const m = state.mode;
  if (rendering) return;
  if (m !== 'building' && m !== 'floor' && m !== 'design') { guard.update(camera, null, dt, now); return; }
  // baxış nöqtəsi kompleksdən çox uzaqlaşmasın
  const tg = controls.target;
  if (!camTween) {
    tg.x = THREE.MathUtils.clamp(tg.x, -45, 45);
    tg.z = THREE.MathUtils.clamp(tg.z, -40, 45);
    tg.y = THREE.MathUtils.clamp(tg.y, 2, 70);
    guard.pushOut(camera.position, 2, { neighbors: false, tower: m === 'building', ground: 2 });
  }
  let pts = TOWER_PTS;
  if (m !== 'building' && floorState) {
    const y = floorState.baseY + 1.2;
    [[0, 0], [14, 9], [-14, 9], [14, -9], [-14, -9]].forEach(([x, z], i) => floorPts[i].set(x, y, z));
    pts = floorPts;
  }
  guard.update(camera, pts, dt, now);
}

/* =========================================================
   Performans: görünməyəndə render etmə, zəif cihazda piksel sıxlığını azalt
   ========================================================= */
// Arxası dolu (şəffaf olmayan) bölmələr: hero (video), krem və tünd bölmələr, footer
const COVERS = $$('.hero, .manifest, .section--light, .section--solid, .pin--h, .footer');
// yükləmədən sonra ilk ~2.5 saniyə həmişə render et (şeyderlər əvvəlcədən hazırlansın)
let warmUntil = Infinity;
function sceneHidden() {
  if (performance.now() < warmUntil) return false;
  if (state.mode !== 'landing' || document.body.classList.contains('exploring')) return false;
  const H = innerHeight;
  const spans = [];
  for (const el of COVERS) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= H) continue;
    spans.push([Math.max(0, r.top), Math.min(H, r.bottom)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let y = 0;
  for (const [a, b] of spans) {
    if (a > y + 1) return false;
    y = Math.max(y, b);
    if (y >= H - 1) return true;
  }
  return false;
}
const perf = { t: 0, n: 0, fast: 0 };
function applyPixelRatio() {
  renderer.setPixelRatio(pixelRatio);
  composer.setPixelRatio(pixelRatio);
}
function adaptiveQuality(dt, drawn) {
  if (!drawn || rendering || dt > 0.5 || Q.has('fixedpr')) { perf.t = perf.n = 0; return; }
  perf.t += dt;
  perf.n++;
  if (perf.t < 1.5) return;
  const fps = perf.n / perf.t;
  perf.t = perf.n = 0;
  if (fps < 40 && pixelRatio > PR_MIN + 0.01) {
    pixelRatio = Math.max(PR_MIN, pixelRatio - 0.15);
    perf.fast = 0;
    applyPixelRatio();
  } else if (fps > 56 && pixelRatio < PR_MAX - 0.01) {
    if (++perf.fast >= 3) { pixelRatio = Math.min(PR_MAX, pixelRatio + 0.1); perf.fast = 0; applyPixelRatio(); }
  } else perf.fast = 0;
}

/* =========================================================
   Əsas dövr
   ========================================================= */
const timer = new THREE.Timer();
let waterTex = null;
const tmp = new THREE.Vector3();
function frame(now) {
  timer.update(now);
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = timer.getElapsed();
  runTweens(performance.now());
  if (sunSim.on && sunSim.playing) { sunSim.min = (sunSim.min + dt * 50) % 1440; applySun(); }
  if (!waterTex) { waterTex = []; scene.traverse((o) => { if (o.userData.water) waterTex.push(o.userData.water); }); if (!waterTex.length) waterTex = null; }
  if (waterTex) for (const w of waterTex) { w.offset.x = t * 0.012; w.offset.y = t * 0.008; }
  bakuUniforms.uTime.value = t;

  if (streetTrees) streetTrees.visible = state.mode === 'landing' || state.mode === 'building';
  if (rendering) { /* kamera render zamanı sabit qalır */ }
  else if (state.mode === 'landing') { updateLandingCamera(dt, t); updateMasterplan(); }
  else if (state.mode === 'tour') { if (!camTween) tour.update(Math.min(rawDt, 0.25)); }
  else if (!camTween) controls.update();
  updateGuard(Math.min(rawDt, 0.25), now);

  studio.update();
  // mənzil etiketləri
  if (floorState && state.mode === 'floor') {
    for (const ad of floorState.apts) {
      tmp.copy(ad.anchor).project(camera);
      const vis = tmp.z < 1;
      const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight;
      ad.label.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
      ad.label.style.visibility = vis ? 'visible' : 'hidden';
    }
  }
  if (state.mode === 'floor' && state.apt && floorState) {
    const ad = floorState.apts.find((x) => x.apt.id === state.apt.id);
    if (ad) ad.overlay.material.opacity = 0.22 + Math.sin(t * 3) * 0.1;
  }

  let drawn = true;
  if (rendering) { if (!renderTick()) renderer.render(scene, camera); }
  else if (sceneHidden()) drawn = false; // 3D ekranda görünmür (video və ya dolu bölmə üstündədir) — GPU-nu yorma
  else if (Q.has('nopp')) renderer.render(scene, camera);
  else composer.render(dt);
  adaptiveQuality(rawDt, drawn);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  scrollCtl.resize();
  onScroll();
});

onScroll();
requestAnimationFrame(frame);

// "Yaşamaq / İstirahət / İnvestisiya" kartları üçün real 3D kadrlar
const SNAPS = [
  { el: '.purpose__img--1', pos: [27, 3, 31], tgt: [6, 30, 4], fov: 52 },
  { el: '.purpose__img--2', pos: [10, 1.6, 41], tgt: [-3, 9, 12], fov: 58 },
  { el: '.purpose__img--3', pos: [-95, 85, 80], tgt: [0, 20, 0], fov: 32 },
];
// Hazır şəkillər: index.html-də kartın data-photo atributu (məs. assets/img/yasamaq.jpg).
// Şəkil varsa o göstərilir, yoxdursa 3D səhnədən kadr çəkilir.
function loadPhoto(s) {
  const el = document.querySelector(s.el);
  const url = el && el.dataset.photo;
  if (!url) return Promise.resolve(false);
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      el.style.backgroundImage = `url(${url})`;
      el.classList.add('has-img', 'is-photo');
      s.done = true;
      res(true);
    };
    im.onerror = () => res(false);
    im.src = url;
  });
}
const photosReady = Promise.all(SNAPS.map(loadPhoto));
function takeSnapshots() {
  // Ekrandan kənar render hədəfi: əsas səhnənin vəziyyətinə toxunmur
  const W = 480, H = 600;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, samples: 4 });
  const snapCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 4000);
  const px = new Float32Array(W * H * 4);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(W, H);
  const exp = 0.9 / 0.6;
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const srgb = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const prev = renderer.getRenderTarget();
  for (const s of SNAPS) {
    if (s.done) continue; // hazır şəkil var
    snapCam.fov = s.fov;
    snapCam.updateProjectionMatrix();
    snapCam.position.set(...s.pos);
    snapCam.lookAt(new THREE.Vector3(...s.tgt));
    renderer.setRenderTarget(rt);
    renderer.render(scene, snapCam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    // ACES Filmic tonlama + sRGB (ekrana çıxışdakı kimi)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4;
        const r = px[i] * exp, g = px[i + 1] * exp, b = px[i + 2] * exp;
        const ar = fit(0.59719 * r + 0.35458 * g + 0.04823 * b);
        const ag = fit(0.076 * r + 0.90834 * g + 0.01566 * b);
        const ab = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
        img.data[o] = 255 * srgb(1.60475 * ar - 0.53108 * ag - 0.07367 * ab);
        img.data[o + 1] = 255 * srgb(-0.10208 * ar + 1.10813 * ag - 0.00605 * ab);
        img.data[o + 2] = 255 * srgb(-0.00327 * ar - 0.07276 * ag + 1.07602 * ab);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const el = document.querySelector(s.el);
    if (el) { el.style.backgroundImage = `url(${out.toDataURL('image/jpeg', 0.86)})`; el.classList.add('has-img'); }
  }
  renderer.setRenderTarget(prev);
  rt.dispose();
}
if (!Q.has('nosnap')) {
  Promise.all([envPromise, treesReady, photosReady]).then(() => {
    if (SNAPS.some((s) => !s.done)) setTimeout(() => requestAnimationFrame(takeSnapshots), 600);
  });
}

// Mebel modelləri, video, şriftlər — hamısı yükləmə ekranı arxasında
const mp = [0, 0];
const modelsReady = Promise.all([
  loadModel('sofa', 'assets/models/GlamVelvetSofa.glb', 2.2, 0, (e) => { if (e.lengthComputable) { mp[0] = e.loaded / e.total; T_MODELS.progress(0.95 * (mp[0] * 0.8 + mp[1] * 0.2)); } }),
  loadModel('armchair', 'assets/models/SheenChair.glb', 0.8, 0, (e) => { if (e.lengthComputable) { mp[1] = e.loaded / e.total; T_MODELS.progress(0.95 * (mp[0] * 0.8 + mp[1] * 0.2)); } }),
]).then(() => T_MODELS.done());
treesReady.then(() => T_TREES.done());
const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => T_FONTS.done());
const videoReady = new Promise((res) => {
  const v = heroVideo;
  if (!v || v.readyState >= 3) return res();
  const ok = () => res();
  v.addEventListener('canplaythrough', ok, { once: true });
  v.addEventListener('loadeddata', () => setTimeout(ok, 1500), { once: true });
  v.addEventListener('error', ok, { once: true });
  setTimeout(ok, 15000); // yavaş internetdə videonu gözləmə
  const tick = () => { if (v.buffered.length && v.duration) T_MEDIA.progress(0.6 * v.buffered.end(0) / v.duration); if (v.readyState < 3) setTimeout(tick, 250); };
  tick();
});
const mediaReady = Promise.all([videoReady, photosReady]).then(() => T_MEDIA.done());
// Hamısı gəldikdən sonra şeyderləri əvvəlcədən hazırla (ilk kadrda donma olmasın)
Promise.all([envPromise, treesReady, modelsReady, mediaReady, fontsReady]).then(async () => {
  T_WARM.progress(0.3);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch (e) { /* köhnə brauzer */ }
  T_WARM.progress(0.8);
  requestAnimationFrame(() => requestAnimationFrame(() => { T_WARM.done(); finishLoading(); }));
});

// Test və sazlama üçün
window.__nova = { get pixelRatio() { return pixelRatio; }, sceneHidden, studio, guard, PATH, posCurve, tgtCurve, BUILDING_VIEW, get camTween() { return camTween; }, get rendering() { return rendering; }, startRender, stopRender, setSunMode, setSunDay, sunSim, applySun, controls, scene, renderer, scrollCtl, state, enterExplore, selectFloor, openApt, startTour, exitTour, backToBuilding, exitExplore, tour, camera, APARTMENTS };
