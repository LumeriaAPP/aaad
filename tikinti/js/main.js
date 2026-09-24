import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
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

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isTouch = matchMedia('(hover: none)').matches;
const Q = new URLSearchParams(location.search);
const isSmall = () => innerWidth < 760;

/* =========================================================
   Renderer, səhnə, işıq
   ========================================================= */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0011);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(90, 10, 110);

// Günəş (istiqaməti HDRI panoramadan hesablanır)
const sunLight = new THREE.DirectionalLight(0xfff1dc, 3.4);
const lightDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(isTouch ? 2048 : 4096, isTouch ? 2048 : 4096);
sunLight.shadow.bias = -0.0003;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
function aimSun(center, size) {
  sunLight.target.position.copy(center);
  sunLight.position.copy(center).addScaledVector(lightDir, 160);
  const c = sunLight.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size;
  c.near = 10; c.far = 400;
  c.updateProjectionMatrix();
}
aimSun(new THREE.Vector3(0, 20, 0), 60);

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
const manager = new THREE.LoadingManager();
const loaderBar = $('#loaderBar');
manager.onProgress = (_u, done, total) => { loaderBar.style.width = `${Math.round((done / total) * 100)}%`; };
const pmrem = new THREE.PMREMGenerator(renderer);
let envExterior = null, envInterior = null;

new HDRLoader(manager).setDataType(THREE.FloatType).load('assets/hdri/flower_road_2k.hdr', (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  lightDir.copy(findSun(tex));
  // günəş diskinin həddən artıq parlaq dəyərlərini məhdudlaşdır (effektlərdə "sonsuzluq" yaranmasın)
  const d = tex.image.data;
  for (let i = 0; i < d.length; i++) if (d[i] > 60) d[i] = 60;
  tex.needsUpdate = true;
  aimSun(new THREE.Vector3(0, 20, 0), 60);
  envExterior = pmrem.fromEquirectangular(tex).texture;
  scene.environment = envExterior;
  scene.environmentIntensity = 1.0;
  // foto-panorama fonda: real göy üzü və üfüqdə ağaclar
  scene.background = tex;
  scene.backgroundIntensity = 1.0;
  // duman rəngini üfüqün rənginə uyğunlaşdır
  scene.fog.color.copy(horizonColor(tex));
});
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
});
manager.onLoad = () => {
  $('#loaderText').textContent = 'Hazırdır';
  setTimeout(() => $('#loader').classList.add('is-done'), 350);
};

// Modellər (divan, kreslo) — arxa planda yüklənir
const models = {};
const gltf = new GLTFLoader();
function loadModel(name, url, width, turn = 0) {
  gltf.load(url, (g) => {
    const root = g.scene;
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
    root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    wrap.add(root);
    models[name] = wrap;
    if (floorState) floorState.apts.forEach(applyModels);
  });
}
function applyModels(ad) {
  for (const slot of ad.modelSlots) {
    const m = models[slot.userData.modelKind];
    if (!m || slot.userData.filled) continue;
    slot.clear();
    slot.add(m.clone());
    slot.userData.filled = true;
  }
}

/* =========================================================
   Bina və ətraf
   ========================================================= */
const tower = buildTower();
scene.add(tower.root);
scene.add(buildSurroundings());
buildTrees((trees) => scene.add(trees), [[78, 96], [-62, 74], [-78, -40], [96, -30], [34, 58], [22, 44], [72, 92]]).catch((e) => console.warn('Ağaclar yüklənmədi', e));

/* =========================================================
   Sonrakı emal: AO (künc kölgələri), yumşaq parıltı
   ========================================================= */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q.has('nomsaa') ? 0 : 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (!isTouch && !Q.has('noao')) {
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.12, 0.4, 1.6);
if (!Q.has('nobloom')) composer.addPass(bloom);
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
controls.minDistance = 12;
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
   Landing: scroll ilə hərəkət edən kamera (parallax)
   ========================================================= */
const PATH = [
  { p: 0.0, pos: [78, 6, 96], tgt: [-6, 30, 0] },
  { p: 0.14, pos: [-62, 22, 74], tgt: [0, 30, 0] },
  { p: 0.3, pos: [-78, 70, -40], tgt: [0, 26, 0] },
  { p: 0.44, pos: [22, 48, 44], tgt: [0, 44, 0] },
  { p: 0.6, pos: [96, 24, -30], tgt: [0, 30, 0] },
  { p: 0.78, pos: [34, 3, 58], tgt: [0, 34, 0] },
  { p: 1.0, pos: [140, 70, 160], tgt: [0, 22, 0] },
];
const posCurve = new THREE.CatmullRomCurve3(PATH.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
const tgtCurve = new THREE.CatmullRomCurve3(PATH.map((k) => new THREE.Vector3(...k.tgt)), false, 'centripetal');
// scroll payını əyri parametrinə çevir (açar nöqtələr bərabər paylanmayıb)
function pathParam(p) {
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    if (p <= b.p) return (i + (p - a.p) / (b.p - a.p)) / (PATH.length - 1);
  }
  return 1;
}
const mouse = new THREE.Vector2();
let scrollP = 0;
const landingTarget = new THREE.Vector3(0, 30, 0);
function updateLandingCamera(dt, t) {
  const u = pathParam(scrollP);
  const want = posCurve.getPoint(u);
  const tgt = tgtCurve.getPoint(u);
  // yavaş fırlanma + siçan parallaksı
  want.x += Math.sin(t * 0.05) * 3 + mouse.x * 4;
  want.y += mouse.y * 2;
  const k = 1 - Math.pow(0.02, dt);
  camera.position.lerp(want, k);
  landingTarget.lerp(tgt, k);
  camera.lookAt(landingTarget);
  // geniş ekranda binanı mətndən sağa çək
  const shift = innerWidth > 900 ? -innerWidth * 0.2 * (1 - Math.min(1, scrollP * 6)) : 0;
  if (Math.abs(shift - viewShift) > 0.5) {
    viewShift += (shift - viewShift) * k;
    camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight);
  }
}
let viewShift = 0;
function clearViewShift() { viewShift = 0; camera.clearViewOffset(); }

function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollP = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  $('#nav').classList.toggle('is-scrolled', scrollY > 40);
  // DOM parallaksı
  for (const el of parallaxEls) {
    const sec = el.closest('section');
    const off = sec.offsetTop - scrollY;
    el.style.transform = `translate3d(0, ${(-off * parseFloat(el.dataset.speed)).toFixed(1)}px, 0)`;
  }
}
const parallaxEls = $$('[data-speed]');
addEventListener('scroll', onScroll, { passive: true });
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
  card.className = 'plan-card reveal';
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
  leadType.insertAdjacentHTML('beforeend', `<option value="${t.code}">${t.title} (${t.area} m²)</option>`);
}

// Görünmə animasiyası
const io = new IntersectionObserver((ents) => {
  for (const e of ents) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-visible');
    io.unobserve(e.target);
  }
}, { threshold: 0.15 });
$$('.reveal, .progress').forEach((el) => io.observe(el));

// Aktiv menyu linki
const secObs = new IntersectionObserver((ents) => {
  for (const e of ents) {
    if (!e.isIntersecting) continue;
    $$('#navLinks a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach((s) => secObs.observe(s));

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
  if (c.dataset.crumb === 'building') backToBuilding();
  else if (c.dataset.crumb === 'floor') closeApt();
});
$('#exBack').addEventListener('click', () => {
  if (state.mode === 'tour') exitTour();
  else if (state.mode === 'floor') (state.apt ? closeApt() : backToBuilding());
});
$('#exClose').addEventListener('click', exitExplore);

function setHint(text) { hint.textContent = text || ''; }

const BUILDING_VIEW = { pos: new THREE.Vector3(72, 38, 92), tgt: new THREE.Vector3(0, 28, 0) };

function enterExplore(opts = {}) {
  if (state.mode !== 'landing') return;
  savedScroll = scrollY;
  state.mode = 'building';
  clearViewShift();
  document.body.classList.add('exploring');
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
  aimSun(new THREE.Vector3(0, 20, 0), 60);
  renderer.toneMappingExposure = 0.9;
  window.scrollTo({ top: savedScroll, behavior: 'instant' });
}

function startTour(apt) {
  if (state.mode === 'landing') {
    savedScroll = scrollY;
    state.mode = 'building';
    clearViewShift();
    document.body.classList.add('exploring');
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
  const apts = APARTMENTS.filter((a) => a.floor === f).map((a) => buildApartment(a, baseY));
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
  renderer.toneMappingExposure = 0.62;
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
  aimSun(new THREE.Vector3(0, 20, 0), 60);
  renderer.toneMappingExposure = 0.9;
  controls.minDistance = 12;
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
      <div class="apt-plan" data-apt-plan title="Planı böyüt">${planSVG(plan, { slot: apt.slot })}</div>
      <dl class="facts">
        <div><dt>Sahə</dt><dd>${plan.area} m²</dd></div>
        <div><dt>Otaq</dt><dd>${plan.rooms}</dd></div>
        <div><dt>Mərtəbə</dt><dd>${apt.floor} / ${BUILDING.lastFloor}</dd></div>
        <div><dt>Mənzərə</dt><dd>${apt.slot.side}</dd></div>
        <div class="price"><dt>Qiymət</dt><dd>${apt.status === 'sold' ? '—' : fmtPrice(apt.price)}</dd></div>
        <div><dt>1 m²</dt><dd>${apt.status === 'sold' ? '—' : fmtPrice(perM2)}</dd></div>
      </dl>
      ${roomList(plan)}
    </div>
    <div class="apt-actions">
      <button class="btn btn--gold btn--block" data-apt-tour>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M2 12h20"/></svg>
        Virtual tura başla
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
  if (e.target.closest('[data-apt-close]')) closeApt();
  if (e.target.closest('[data-apt-plan]')) openPlanModal(state.apt.type, state.apt);
  if (e.target.closest('[data-apt-tour]')) {
    const ad = floorState.apts.find((x) => x.apt.id === state.apt.id);
    startTourFor(ad);
  }
  if (e.target.closest('[data-apt-lead]')) {
    const apt = state.apt;
    exitExplore();
    $('#leadType').value = apt.type.code;
    $('#leadForm').note.value = `Mənzil № ${apt.number}, ${ordinal(apt.floor)} mərtəbə`;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }
});

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
    if (envInterior) { scene.environment = envInterior; scene.environmentIntensity = 0.55; }
    renderer.toneMappingExposure = 1.0;
    aimSun(new THREE.Vector3((ad.bounds.x0 + ad.bounds.x1) / 2, ad.baseY, (ad.bounds.z0 + ad.bounds.z1) / 2), 14);
    tourHud.hidden = false;
    setupTourHud(ad);
  });
  setCrumbs();
}

function setupTourHud(ad) {
  roomsBar.innerHTML = ad.rooms.map((r, i) => `<button data-room="${i}">${r.name}</button>`).join('');
  minimap.innerHTML = planSVG(ad.apt.type, { slot: ad.apt.slot, compact: true });
  const svg = minimap.querySelector('svg');
  svg.insertAdjacentHTML('beforeend', `<g id="mapMarker"><path d="M0 0 L2.4 -1.1 A2.6 2.6 0 0 1 2.4 1.1 Z" fill="rgba(201,161,92,0.35)"/><circle r="0.32" fill="#c9a15c" stroke="#fff" stroke-width="0.1"/></g>`);
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
  tour.stop();
  tourHud.hidden = true;
  const ad = tourData;
  ad.tourOnly.visible = false;
  ad.overlay.visible = true;
  ad.border.visible = true;
  floorState.labels.forEach((l) => (l.style.display = ''));
  lampPool.forEach((l) => (l.intensity = 0));
  scene.environment = envExterior;
  scene.environmentIntensity = 1.0;
  renderer.toneMappingExposure = 0.62;
  camera.fov = 42;
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
  } else {
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
   Əsas dövr
   ========================================================= */
const timer = new THREE.Timer();
const tmp = new THREE.Vector3();
function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  runTweens(performance.now());

  if (state.mode === 'landing') updateLandingCamera(dt, t);
  else if (state.mode === 'tour') { if (!camTween) tour.update(dt); }
  else if (!camTween) controls.update();

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

  if (Q.has('nopp')) renderer.render(scene, camera);
  else composer.render(dt);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  onScroll();
});

onScroll();
requestAnimationFrame(frame);

// Modelləri səhnə açıldıqdan sonra yüklə
setTimeout(() => {
  loadModel('sofa', 'assets/models/GlamVelvetSofa.glb', 2.2);
  loadModel('armchair', 'assets/models/SheenChair.glb', 0.8);
}, 1200);

// Test və sazlama üçün
window.__nova = { state, enterExplore, selectFloor, openApt, startTour, exitTour, backToBuilding, exitExplore, tour, camera, APARTMENTS };
