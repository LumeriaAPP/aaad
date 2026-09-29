// Bayıl Bulvarı — sahil boyu orqanik formalı binalar, çimərlik, laqun, körpü, palmalar; mərtəbə seçimi və mənzilə giriş.
// Konsept model: renderlər əsasında qurulub, real layihə ölçüləri deyil.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { buildFurniture, furnitureMaterials } from './furniture.js';
import { woodTexture, marbleTexture } from './textures.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const isTouch = matchMedia('(hover: none)').matches;
const LITE = isTouch || Q.has('lite');
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const noise = new SimplexNoise({ random: rng(7) });

/* ---------------- renderer, səhnə ---------------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc9a48e, 0.00028);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.2, 9000);
camera.position.set(-620, 260, 520);

// göy üzü: günbatımı, günəş dənizin üzərində (qərb, -x)
const sunDir = new THREE.Vector3();
const sky = new Sky();
sky.scale.setScalar(8000);
scene.add(sky);
const su = sky.material.uniforms;
su.turbidity.value = 6; su.rayleigh.value = 2.4; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.86;
const SUN_ALT = 7, SUN_AZ = 250;
sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - SUN_ALT), THREE.MathUtils.degToRad(SUN_AZ));
su.sunPosition.value.copy(sunDir);
const pmrem = new THREE.PMREMGenerator(renderer);
const skyScene = new THREE.Scene();
const skyEnv = new Sky(); skyEnv.scale.setScalar(100);
Object.assign(skyEnv.material.uniforms.turbidity, { value: 6 }); skyEnv.material.uniforms.rayleigh.value = 2.4;
skyEnv.material.uniforms.mieCoefficient.value = 0.006; skyEnv.material.uniforms.mieDirectionalG.value = 0.86;
skyEnv.material.uniforms.sunPosition.value.copy(sunDir);
skyScene.add(skyEnv);
scene.environment = pmrem.fromScene(skyScene, 0, 0.1, 1000).texture;
scene.environmentIntensity = 0.6;

const sun = new THREE.DirectionalLight(0xffb27a, 4.2);
sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 2048 : 4096, LITE ? 2048 : 4096);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
function aimSun(center, size) {
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(sunDir, 900);
  const c = sun.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 100; c.far = 2000;
  c.updateProjectionMatrix();
}
aimSun(new THREE.Vector3(80, 0, -20), 330);
const hemi = new THREE.HemisphereLight(0xffd9c2, 0x4a4238, 0.55);
scene.add(hemi);

/* ---------------- sahil xətti ---------------- */
const shoreX = (z) => -40 + 28 * Math.sin(z / 95) + 12 * Math.sin(z / 37 + 1.3);
const Z0 = -900, Z1 = 900;
const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

// dəniz
const waterNormal = new THREE.TextureLoader().load('assets/textures/water_normal.jpg');
waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
waterNormal.repeat.set(60, 60);
const seaMat = new THREE.MeshPhysicalMaterial({ color: 0x1d5470, roughness: 0.08, metalness: 0.0, normalMap: waterNormal, normalScale: new THREE.Vector2(0.45, 0.45), clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), seaMat);
sea.position.set(-2500, -0.6, 0);
sea.receiveShadow = true;
scene.add(sea);
// dayaz su (sahil yanında firuzəyi zolaq)
{
  const pos = [], col = [], idx = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const z = Z0 + (Z1 - Z0) * (i / N), sx = shoreX(z);
    for (const [dx, a] of [[2, 0.85], [-25, 0.55], [-70, 0]]) { pos.push(sx + dx, -0.45, z); col.push(0.25, 0.78, 0.82, a); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.1, depthWrite: false }));
  m.renderOrder = 1;
  scene.add(m);
}

// quru: çimərlik → promenad → yaşıllıq → təpə (bir lent, hündürlük səs-küylə)
const landHeight = (x, z) => {
  const d = x - shoreX(z);
  if (d < 0) return -1.2 + d * 0.02;
  let h = Math.min(1.6, d * 0.06);
  const hill = THREE.MathUtils.smoothstep(d, 260, 520);
  h += hill * (70 + 45 * noise.noise(x / 260, z / 260) + 12 * noise.noise(x / 60, z / 60));
  return h;
};
{
  const NZ = 220, NX = 90;
  const pos = [], col = [], idx = [];
  const cSand = new THREE.Color(0xe8cfa8), cWet = new THREE.Color(0xb99f7c), cGrass = new THREE.Color(0x6f8f48), cRock = new THREE.Color(0x8a7458), cDry = new THREE.Color(0xa9955f);
  const c = new THREE.Color();
  for (let i = 0; i <= NZ; i++) {
    const z = Z0 + (Z1 - Z0) * (i / NZ), sx = shoreX(z);
    for (let j = 0; j <= NX; j++) {
      const d = -30 + Math.pow(j / NX, 1.6) * 1100;
      const x = sx + d;
      pos.push(x, landHeight(x, z), z);
      if (d < 3) c.copy(cWet);
      else if (d < 34) c.copy(cSand);
      else if (d < 260) c.copy(cGrass).lerp(cDry, 0.3 + 0.3 * noise.noise(x / 40, z / 40));
      else c.copy(cDry).lerp(cRock, THREE.MathUtils.smoothstep(d, 300, 520) * (0.6 + 0.4 * noise.noise(x / 30, z / 30)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NX; j++) { const a = i * (NX + 1) + j, b = a + NX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  land.receiveShadow = true;
  scene.add(land);
}
// promenad (əyri, açıq daş) + velosiped yolu
function ribbon(d0, d1, y, color, z0 = Z0, z1 = Z1, n = 300) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * (i / n), sx = shoreX(z); pos.push(sx + d0, y, z, sx + d1, y, z); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, std(color, 0.8)); m.receiveShadow = true; scene.add(m); return m;
}
ribbon(34, 44, 1.75, 0xe9e2d6);
ribbon(46, 50, 1.8, 0xb87a5c);

/* ---------------- laqun hovuzu, körpü, ada ---------------- */
function blobShape(rx, rz, seed, n = 72) {
  const r = rng(seed); const a1 = r() * 6, a2 = r() * 6, a3 = r() * 6;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + 0.1 * Math.sin(2 * t + a1) + 0.05 * Math.sin(3 * t + a2) + 0.03 * Math.sin(5 * t + a3);
    let x = Math.cos(t) * rx * k, z = Math.sin(t) * rz * k;
    z += Math.cos(t) * Math.cos(t) * rz * 0.28; // lobya forması (dəniz tərəfi qabarıq)
    pts.push(new THREE.Vector2(x, z));
  }
  return pts;
}
const toShape = (pts, s = 1, ox = 0, oz = 0) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * s + ox, -(p.y * s + oz))));
{
  const lz = -150, lx = shoreX(lz) + 12;
  const pts = blobShape(55, 16, 3);
  const water = new THREE.Mesh(new THREE.ShapeGeometry(toShape(pts)).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x3fc6d8, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.3 }));
  water.rotation.y = Math.PI / 2 + 0.25; water.position.set(lx, 1.2, lz);
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(toShape(pts, 1.08)).rotateX(-Math.PI / 2), std(0xf1ebe0, 0.6));
  rim.rotation.copy(water.rotation); rim.position.set(lx, 1.1, lz);
  rim.receiveShadow = true;
  scene.add(rim, water);
}
// körpü → ada
const pierCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(shoreX(120) + 5, 1.6, 120), new THREE.Vector3(shoreX(120) - 70, 1.8, 150),
  new THREE.Vector3(shoreX(120) - 150, 1.8, 175), new THREE.Vector3(shoreX(120) - 240, 1.8, 175),
]);
{
  const pts = pierCurve.getSpacedPoints(80); const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const tg = pierCurve.getTangentAt(i / (pts.length - 1)); const nx = -tg.z, nz = tg.x; const w = 4.5;
    pos.push(pts[i].x + nx * w, 1.8, pts[i].z + nz * w, pts[i].x - nx * w, 1.8, pts[i].z - nz * w);
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const deck = new THREE.Mesh(g, std(0xefe8dc, 0.7, { side: THREE.DoubleSide })); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
  const end = pts[pts.length - 1];
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 3, 48), std(0xe7d3b0, 0.9)); isl.position.set(end.x - 30, 0.5, end.z + 6); isl.receiveShadow = true; scene.add(isl);
  const islG = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 1, 40), std(0x6f9148, 0.95)); islG.position.set(end.x - 32, 2.3, end.z + 8); islG.receiveShadow = true; scene.add(islG);
  window.__island = new THREE.Vector3(end.x - 32, 2.8, end.z + 8);
}

/* ---------------- binalar ---------------- */
const FLOOR_H = 3.5, SLAB = 0.32;
const M = {
  slab: std(0xf4efe7, 0.55),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x1b2429, roughness: 0.05, metalness: 0.5, envMapIntensity: 1.1 }),
  glassIn: new THREE.MeshPhysicalMaterial({ color: 0xcfe0e6, roughness: 0.02, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
  planter: std(0x55773a, 0.95, { flatShading: true }),
  rail: new THREE.MeshPhysicalMaterial({ color: 0xbfd4da, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }),
  roof: std(0xa65a36, 0.7),
  wood: new THREE.MeshStandardMaterial({ map: (() => { const t = woodTexture([150, 104, 70]); t.repeat.set(8, 1); return t; })(), roughness: 0.55 }),
  shop: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, emissive: 0xffc47a, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.3 }),
};
const lerpPts = (pts, s, ox = 0, oz = 0) => pts.map((p) => new THREE.Vector2(p.x * s + ox, p.y * s + oz));
function extrude(pts, h, holePts = null, bevel = 0) {
  const sh = toShape(pts);
  if (holePts) sh.holes.push(new THREE.Path(holePts.slice().reverse().map((p) => new THREE.Vector2(p.x, -p.y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}
// poliqonun verilmiş x-də z sərhədləri (mənzil divarları üçün)
function zRange(pts, x) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { const z = a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x)); lo = Math.min(lo, z); hi = Math.max(hi, z); }
  }
  return [lo, hi];
}
function inPoly(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const LETTERS = 'ABCDEFGHİJ';
const BLD = [
  // z (sahil boyu), sahildən məsafə, uzun ox, en, mərtəbə, fırlanma əlavəsi
  [-380, 105, 34, 17, 8, 0.15], [-300, 125, 30, 16, 9, -0.1], [-225, 100, 36, 18, 10, 0.2],
  [-140, 128, 32, 17, 9, -0.05], [-60, 108, 40, 20, 10, 0.1], [20, 132, 34, 18, 8, -0.2],
  [95, 110, 38, 19, 9, 0.05], [175, 150, 30, 16, 7, 0.25], [250, 118, 34, 17, 8, -0.1], [325, 160, 28, 15, 6, 0.1],
];
const buildings = [];
const shrubGeo = new THREE.IcosahedronGeometry(0.9, 1);
const shrubs = new THREE.InstancedMesh(shrubGeo, std(0x4f7434, 0.95, { flatShading: true }), 6000);
shrubs.count = 0; shrubs.castShadow = true;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
BLD.forEach(([z, dist, rx, rz, floors, rot], bi) => {
  const x = shoreX(z) + dist;
  const g = new THREE.Group();
  const ry = Math.PI / 2 + Math.atan2(shoreX(z + 5) - shoreX(z - 5), 10) + rot;
  g.position.set(x, landHeight(x, z) - 0.1, z);
  g.rotation.y = ry;
  const base = blobShape(rx, rz, 101 + bi * 13);
  const floorGroups = [];
  const r = rng(900 + bi);
  // podium: taxta üzlüklü mağazalar
  const pod = lerpPts(base, 0.8, 0, rz * 0.12);
  const podium = new THREE.Mesh(extrude(pod, 4.4), M.wood); podium.castShadow = podium.receiveShadow = true; g.add(podium);
  const shop = new THREE.Mesh(extrude(lerpPts(base, 0.805, 0, rz * 0.12), 3.2), M.shop); shop.position.y = 0.4; shop.scale.set(0.995, 1, 0.995); g.add(shop);
  for (let f = 0; f < floors; f++) {
    const fg = new THREE.Group();
    fg.position.y = 4.4 + f * FLOOR_H;
    const s = 1 - f * 0.014, oz = f * 0.55; // yuxarı mərtəbələr quruya doğru geri çəkilir (pilləli terraslar)
    const slabPts = lerpPts(base, s, 0, oz);
    const corePts = lerpPts(base, s * 0.9, 0, oz + rz * 0.04);
    const slab = new THREE.Mesh(extrude(slabPts, SLAB), M.slab); slab.castShadow = slab.receiveShadow = true;
    const core = new THREE.Mesh(extrude(corePts, FLOOR_H - SLAB), M.glass); core.position.y = SLAB; core.receiveShadow = true;
    const plant = new THREE.Mesh(extrude(slabPts, 0.5, lerpPts(base, s * 0.965, 0, oz)), M.planter); plant.position.y = SLAB; plant.castShadow = true;
    const rail = new THREE.Mesh(extrude(lerpPts(base, s * 0.998, 0, oz), 1.05, lerpPts(base, s * 0.99, 0, oz)), M.rail); rail.position.y = SLAB;
    fg.add(slab, core, plant, rail);
    fg.userData = { floor: f + 1, slabPts, corePts, core };
    // dibçəklərdə kollar
    for (let k = 0; k < slabPts.length; k += 2) {
      if (r() < 0.35) continue;
      const p = slabPts[k].clone().multiplyScalar(0.985);
      const sc = 0.55 + r() * 0.6;
      _p.set(p.x, fg.position.y + SLAB + 0.5 + sc * 0.4, p.y).applyEuler(g.rotation).add(g.position);
      _m.compose(_p, _q.identity(), _s.set(sc, sc * 0.8, sc));
      if (shrubs.count < 6000) shrubs.setMatrixAt(shrubs.count++, _m);
    }
    g.add(fg); floorGroups.push(fg);
  }
  // terrakota dam (əyri, yumşaq kənarlı) + dam bağı
  const topY = 4.4 + floors * FLOOR_H;
  const roofSlab = new THREE.Mesh(extrude(lerpPts(base, (1 - floors * 0.014) * 0.9, 0, floors * 0.55), 0.6, null, 0.8), M.roof);
  roofSlab.position.y = topY + 0.3; roofSlab.castShadow = true; g.add(roofSlab);
  if (bi % 3 === 1) { const gr = new THREE.Mesh(extrude(lerpPts(base, (1 - floors * 0.014) * 0.55, rx * 0.15, floors * 0.55), 0.8), M.planter); gr.position.y = topY + 1.4; g.add(gr); }
  scene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  buildings.push({ id: LETTERS[bi], group: g, floors, floorGroups, base, rx, rz, top: new THREE.Vector3(x, topY + 8, z), center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) });
});
shrubs.instanceMatrix.needsUpdate = true;
scene.add(shrubs);

/* ---------------- palmalar və ağaclar ---------------- */
function palmGeometries() {
  const pts = []; for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(Math.sin(i / 8 * 1.2) * 1.2, i / 8 * 11, 0));
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.28, 6);
  const top = pts[8];
  const fronds = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const leaf = new THREE.PlaneGeometry(0.9, 5.2, 1, 6);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.6; p.setXYZ(i, p.getX(i) * (1 - y / 5.4), y, -0.12 * y * y); }
    leaf.rotateX(-0.9); leaf.rotateY(a); leaf.translate(top.x, top.y, top.z);
    fronds.push(leaf);
  }
  return { trunk, fronds: mergeGeometries(fronds) };
}
const PG = palmGeometries();
const palmSpots = [];
{
  const r = rng(55);
  for (let z = Z0 + 20; z < Z1 - 20; z += 9 + r() * 6) { palmSpots.push([shoreX(z) + 31 + r() * 2, z]); palmSpots.push([shoreX(z) + 52 + r() * 3, z + 4]); }
  for (let i = 0; i < 260; i++) {
    const z = -460 + r() * 900, d = 60 + r() * 150, x = shoreX(z) + d;
    if (buildings.some((b) => b.group.position.distanceTo(new THREE.Vector3(x, b.group.position.y, z)) < Math.max(b.rx, b.rz) * 1.25)) continue;
    palmSpots.push([x, z]);
  }
  const isl = window.__island; for (let k = 0; k < 9; k++) { const a = k * 0.7; palmSpots.push([isl.x + Math.cos(a) * (6 + k), isl.z + Math.sin(a) * (6 + k)]); }
}
{
  const n = palmSpots.length, r = rng(77);
  const trunks = new THREE.InstancedMesh(PG.trunk, std(0x8a6b4a, 0.9), n);
  const fronds = new THREE.InstancedMesh(PG.fronds, std(0x4d7a2f, 0.85, { side: THREE.DoubleSide }), n);
  palmSpots.forEach(([x, z], i) => {
    const s = 0.8 + r() * 0.5;
    _m.compose(_p.set(x, landHeight(x, z) + (Math.abs(z - window.__island.z) < 40 && x < shoreX(z) ? 3 : 0), z), _q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), _s.set(s, s, s));
    trunks.setMatrixAt(i, _m); fronds.setMatrixAt(i, _m);
  });
  trunks.castShadow = fronds.castShadow = true;
  scene.add(trunks, fronds);
}

/* ---------------- çimərlik: şezlonqlar, çətirlər, yaxtalar ---------------- */
{
  const r = rng(91);
  const L = [], U = [];
  for (let z = -520; z < 420; z += 6) {
    if (Math.abs(z + 150) < 70 || Math.abs(z - 120) < 12) continue;
    const sx = shoreX(z);
    L.push([sx + 16, z, 0], [sx + 16, z + 2.2, 0]);
    if (r() < 0.6) U.push([sx + 18, z + 1.1]);
  }
  const lg = mergeGeometries([new THREE.BoxGeometry(0.75, 0.3, 2.0).translate(0, 0.3, 0), new THREE.BoxGeometry(0.75, 0.5, 0.2).rotateX(-0.6).translate(0, 0.55, 0.8)]);
  const lounger = new THREE.InstancedMesh(lg, std(0xf3eee6, 0.8), L.length);
  L.forEach(([x, z], i) => { _m.compose(_p.set(x, landHeight(x, z), z), _q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), _s.set(1, 1, 1)); lounger.setMatrixAt(i, _m); });
  const ug = mergeGeometries([new THREE.ConeGeometry(1.7, 0.6, 10, 1, true).translate(0, 2.6, 0), new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5).translate(0, 1.3, 0)]);
  const umb = new THREE.InstancedMesh(ug, std(0xefe2cc, 0.9, { side: THREE.DoubleSide }), U.length);
  U.forEach(([x, z], i) => { _m.compose(_p.set(x, landHeight(x, z), z), _q.identity(), _s.set(1, 1, 1)); umb.setMatrixAt(i, _m); });
  lounger.castShadow = umb.castShadow = true;
  scene.add(lounger, umb);
  // yaxtalar
  const hullShape = new THREE.Shape([new THREE.Vector2(-9, 0), new THREE.Vector2(7, 0), new THREE.Vector2(11, 1.6), new THREE.Vector2(-9, 1.6)]);
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 4, bevelEnabled: false }).translate(0, 0, -2);
  const yachtG = mergeGeometries([hull.toNonIndexed(), new THREE.BoxGeometry(9, 1.6, 3.2).translate(-1, 2.4, 0).toNonIndexed(), new THREE.BoxGeometry(5, 1.2, 2.6).translate(-2, 3.8, 0).toNonIndexed()]);
  const yachts = new THREE.InstancedMesh(yachtG, std(0xf6f6f4, 0.35), 8);
  [[-260, -300], [-330, -120], [-240, 60], [-420, 240], [-560, -40], [-180, 330], [-500, -380], [-300, 420]].forEach(([dx, z], i) => {
    _m.compose(_p.set(shoreX(z) + dx, -0.6, z), _q.setFromEuler(new THREE.Euler(0, rng(i)() * 6.28, 0)), _s.set(1, 1, 1)); yachts.setMatrixAt(i, _m);
  });
  yachts.castShadow = true;
  scene.add(yachts);
}

/* ---------------- şəhər (sağda, terrakota damlı ağ evlər) ---------------- */
{
  const r = rng(303);
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const z = -900 + r() * 1800, d = 250 + r() * 800, x = shoreX(z) + d;
    if (d < 330 && Math.abs(z) < 480) continue;
    pts.push([x, z, 6 + r() * (d > 500 ? 14 : 26), 8 + r() * 14, 8 + r() * 12]);
  }
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), std(0xd9cfbf, 0.9), pts.length);
  const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), std(0xb4613e, 0.8), pts.length);
  pts.forEach(([x, z, h, w, d], i) => {
    const y = landHeight(x, z) - 0.5, ry = r() * 0.4;
    _m.compose(_p.set(x, y, z), _q.setFromEuler(new THREE.Euler(0, ry, 0)), _s.set(w, h, d)); walls.setMatrixAt(i, _m);
    _m.compose(_p.set(x, y + h, z), _q.setFromEuler(new THREE.Euler(0, ry, 0)), _s.set(w * 1.35, 3.5, d * 1.35)); roofs.setMatrixAt(i, _m);
  });
  walls.castShadow = walls.receiveShadow = true; roofs.castShadow = true;
  scene.add(walls, roofs);
}

/* ---------------- post-processing ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 1.4);
if (!LITE) composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------------- idarəetmə ---------------- */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 25; controls.maxDistance = 1400;
controls.target.set(60, 20, -20);
const tweens = new Set();
function tween(ms, fn, done) { const t = { t0: performance.now(), ms, fn, done }; tweens.add(t); return t; }
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function flyTo(pos, tgt, ms = 1600, done) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  tween(ms, (e) => { camera.position.lerpVectors(p0, pos, e); camera.position.y += Math.sin(e * Math.PI) * Math.min(80, p0.distanceTo(pos) * 0.12); controls.target.lerpVectors(t0, tgt, e); }, done);
}

const state = { mode: 'overview', b: null, floor: null, apt: null };
const ui = { markers: $('#markers'), panel: $('#panel'), aptLabels: $('#aptLabels'), hint: $('#hint') };
buildings.forEach((b) => {
  const el = document.createElement('button');
  el.className = 'mk'; el.textContent = b.id; el.setAttribute('aria-label', `Blok ${b.id}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); openBuilding(b); });
  ui.markers.appendChild(el); b.el = el;
});

// sadə status paylanması (nümunə)
const STATUS = { a: ['Satışda', '#3ecf8e'], r: ['Bron', '#f5b544'], s: ['Satılıb', '#ef5b5b'] };
const aptStatus = (b, f, i) => { const r = rng(b.id.charCodeAt(0) * 7919 + f * 131 + i * 17); r(); r(); const v = r(); return v < 0.55 ? 'a' : v < 0.75 ? 'r' : 's'; };

function openBuilding(b) {
  closeInterior();
  state.mode = 'building'; state.b = b; state.floor = null;
  const dir = new THREE.Vector3(-1, 0.55, 0.5).normalize();
  const dist = Math.max(b.size.x, b.size.z) * 1.9 + 40;
  flyTo(b.center.clone().addScaledVector(dir, dist), b.center.clone(), 1700);
  aimSun(b.center, 120);
  renderPanel();
}
function renderPanel() {
  const b = state.b;
  if (!b) { ui.panel.hidden = true; return; }
  let rows = '';
  for (let f = b.floors; f >= 1; f--) {
    const st = [0, 1, 2].map((i) => aptStatus(b, f, i));
    const free = st.filter((s) => s === 'a').length;
    rows += `<button class="fl${state.floor === f ? ' on' : ''}" data-f="${f}"><b>${f}</b><span>${f}-ci mərtəbə<small>${free} mənzil satışda</small></span><i>${st.map((s) => `<em style="background:${STATUS[s][1]}"></em>`).join('')}</i></button>`;
  }
  ui.panel.innerHTML = `<div class="ph"><button class="x" data-close>✕</button><small>Bayıl Bulvarı</small><h3>Blok ${b.id}</h3><p>${b.floors} mərtəbə · ${b.floors * 3} mənzil · dəniz mənzərəsi</p></div><div class="fls">${rows}</div>`;
  ui.panel.hidden = false;
}
ui.panel.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { backToOverview(); return; }
  const f = e.target.closest('[data-f]'); if (f) selectFloor(+f.dataset.f);
});

let interior = null;
function selectFloor(f) {
  const b = state.b; state.floor = f; state.mode = 'floor';
  renderPanel();
  // yuxarı mərtəbələr və dam qalxır
  b.floorGroups.forEach((fg) => {
    const want = fg.userData.floor > f ? 26 : 0;
    const y0 = fg.userData.lift || 0;
    tween(900, (e) => { fg.userData.lift = y0 + (want - y0) * e; fg.position.y = 4.4 + (fg.userData.floor - 1) * FLOOR_H + fg.userData.lift; });
    fg.userData.core.visible = fg.userData.floor !== f;
  });
  b.group.children.filter((c) => !b.floorGroups.includes(c) && c.position.y > 4.5).forEach((c) => {
    c.userData.baseY ??= c.position.y; const y0 = c.position.y;
    tween(900, (e) => { c.position.y = y0 + (c.userData.baseY + 26 - y0) * e; });
  });
  buildInterior(b, f);
  const fy = 4.4 + (f - 1) * FLOOR_H;
  const c = b.group.localToWorld(new THREE.Vector3(0, fy, 0));
  flyTo(c.clone().add(new THREE.Vector3(-b.rx * 1.1, b.rx * 1.5, b.rz * 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.group.rotation.y - Math.PI / 2)), c, 1400);
  ui.hint.textContent = 'Mənzilə toxunun — ətraflı məlumat və içəri giriş';
}

function buildInterior(b, f) {
  if (interior) { interior.parent.remove(interior); interior = null; }
  const fg = b.floorGroups[f - 1];
  const core = fg.userData.corePts;
  const g = new THREE.Group(); g.position.y = SLAB;
  furnitureMaterials();
  const wallMat = std(0xefe9df, 0.9), floorMat = new THREE.MeshStandardMaterial({ map: (() => { const t = woodTexture([188, 150, 112]); t.repeat.set(10, 10); return t; })(), roughness: 0.5 });
  const flr = new THREE.Mesh(new THREE.ShapeGeometry(toShape(core)).rotateX(-Math.PI / 2), floorMat); flr.position.y = 0.02; flr.receiveShadow = true; g.add(flr);
  const xs = core.map((p) => p.x), minX = Math.min(...xs), maxX = Math.max(...xs);
  const cuts = [minX + (maxX - minX) / 3, minX + (2 * (maxX - minX)) / 3];
  const H = FLOOR_H - SLAB - 0.05;
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.3) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.16), wallMat);
    m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = m.receiveShadow = true; g.add(m);
  };
  for (const x of cuts) { const [lo, hi] = zRange(core, x); wall(x, lo + 0.1, x, hi - 0.1); }
  const apts = [];
  const edges = [minX, ...cuts, maxX];
  for (let i = 0; i < 3; i++) {
    const x0 = edges[i], x1 = edges[i + 1], cx = (x0 + x1) / 2;
    const [lo, hi] = zRange(core, cx);
    const mid = lo + (hi - lo) * 0.58; // dəniz tərəfi (−z) qonaq otağı, quru tərəfi yataq otağı
    // arakəsmə divarı qapı boşluğu ilə
    wall(x0 + 0.2, mid, cx - 0.6, mid); wall(cx + 0.6, mid, x1 - 0.2, mid);
    const w = x1 - x0;
    const items = [
      { k: 'rug', x: cx, z: lo + (mid - lo) * 0.5, w: Math.min(4, w * 0.5), d: 2.8 },
      { k: 'sofa', x: cx, z: lo + (mid - lo) * 0.62, rot: 180 },
      { k: 'coffeeTable', x: cx, z: lo + (mid - lo) * 0.4 },
      { k: 'armchair', x: cx - 2.2, z: lo + (mid - lo) * 0.38, rot: 90 },
      { k: 'dining', x: cx + w * 0.3, z: mid - 2.0 },
      { k: 'island', x: cx - w * 0.28, z: mid - 1.4 },
      { k: 'plant', x: x0 + 0.8, z: lo + 2.2 }, { k: 'plant', x: x1 - 0.8, z: lo + 2.2 },
      { k: 'bed', x: cx - w * 0.15, z: mid + (hi - mid) * 0.5, rot: 0 },
      { k: 'wardrobe', x: cx + w * 0.3, z: hi - 1.0, rot: 180 },
    ];
    for (const it of items) {
      if (!inPoly(core, it.x, it.z)) continue;
      const m = buildFurniture(it); m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(m);
    }
    // lampa
    const lamp = new THREE.PointLight(0xffd7a8, 6, 14, 1.6); lamp.position.set(cx, H - 0.4, (lo + mid) / 2); g.add(lamp);
    let area = 0; for (let k = 0; k < core.length; k++) { const a = core[k], c2 = core[(k + 1) % core.length]; if ((a.x + c2.x) / 2 >= x0 && (a.x + c2.x) / 2 < x1) area += 0; }
    area = Math.round(w * (hi - lo) * 0.82);
    const st = aptStatus(b, f, i);
    apts.push({ no: `${b.id}-${f}${i + 1}`, cx, cz: (lo + mid) / 2, lo, mid, hi, x0, x1, area, rooms: area > 150 ? 3 : 2, price: Math.round(area * (4200 + f * 60) / 1000) * 1000, st });
  }
  fg.add(g); interior = g;
  interior.userData = { b, f, apts, core };
  renderAptLabels();
}
function renderAptLabels() {
  ui.aptLabels.innerHTML = '';
  if (!interior || state.mode !== 'floor') return;
  interior.userData.apts.forEach((a) => {
    const el = document.createElement('button');
    el.className = 'al';
    el.innerHTML = `<i style="background:${STATUS[a.st][1]}"></i><b>№ ${a.no}</b><small>${a.rooms} otaq · ${a.area} m²</small>`;
    el.addEventListener('click', () => openApt(a));
    ui.aptLabels.appendChild(el); a.el = el;
  });
}
function openApt(a) {
  state.apt = a;
  const fmt = (n) => n.toLocaleString('az-AZ').replace(/,/g, ' ');
  $('#apt').innerHTML = `<button class="x" data-aclose>✕</button><small style="color:${STATUS[a.st][1]}">● ${STATUS[a.st][0]}</small><h3>Mənzil № ${a.no}</h3>
    <dl><div><dt>Sahə</dt><dd>${a.area} m²</dd></div><div><dt>Otaq</dt><dd>${a.rooms}</dd></div><div><dt>Mərtəbə</dt><dd>${interior.userData.f} / ${state.b.floors}</dd></div><div><dt>Mənzərə</dt><dd>Xəzər dənizi</dd></div>
    <div class="wide"><dt>Qiymət (nümunə)</dt><dd>${a.st === 's' ? '—' : fmt(a.price) + ' ₼'}</dd></div></dl>
    <button class="go" data-enter>Mənzilə daxil ol</button>`;
  $('#apt').hidden = false;
}
$('#apt').addEventListener('click', (e) => {
  if (e.target.closest('[data-aclose]')) { $('#apt').hidden = true; state.apt = null; }
  if (e.target.closest('[data-enter]')) enterApt(state.apt);
});

/* ---------------- mənzilin içində gəzinti ---------------- */
const fp = { on: false, yaw: 0, pitch: -0.05, keys: new Set(), pos: new THREE.Vector3(), fwd: 0 };
function enterApt(a) {
  const b = state.b, fg = b.floorGroups[interior.userData.f - 1];
  // tavan geri gəlir (qapalı otaq), bu mərtəbənin şüşəsi şəffaf olur
  b.floorGroups.forEach((o) => { o.userData.lift = 0; o.position.y = 4.4 + (o.userData.floor - 1) * FLOOR_H; });
  b.group.children.forEach((c) => { if (c.userData.baseY != null) c.position.y = c.userData.baseY; });
  fg.userData.core.visible = true; fg.userData.core.material = M.glassIn; fg.userData.core.castShadow = false;
  state.mode = 'inside'; fp.on = true; controls.enabled = false;
  const local = new THREE.Vector3(a.cx, fg.position.y + SLAB + 1.62, a.mid - 1.2);
  fp.pos.copy(b.group.localToWorld(local));
  // dənizə bax (lokal −z)
  const seaDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.group.rotation.y);
  fp.yaw = Math.atan2(-seaDir.x, -seaDir.z); fp.pitch = -0.05;
  aimSun(fp.pos, 40);
  renderer.toneMappingExposure = 0.75;
  $('#apt').hidden = true; ui.panel.hidden = true; ui.aptLabels.innerHTML = ''; ui.markers.hidden = true;
  $('#inside').hidden = false;
  ui.hint.textContent = isTouch ? 'Ətrafa baxmaq üçün sürüşdürün · ▲▼ ilə hərəkət' : 'Siçanla sürüşdürüb ətrafa baxın · W A S D ilə gəzin';
}
function closeInterior() {
  if (state.b) {
    const b = state.b;
    b.floorGroups.forEach((o) => { o.userData.lift = 0; o.position.y = 4.4 + (o.userData.floor - 1) * FLOOR_H; o.userData.core.visible = true; o.userData.core.material = M.glass; });
    b.group.children.forEach((c) => { if (c.userData.baseY != null) c.position.y = c.userData.baseY; });
  }
  if (interior) { interior.parent.remove(interior); interior = null; }
  fp.on = false; controls.enabled = true; renderer.toneMappingExposure = 0.5;
  $('#inside').hidden = true; $('#apt').hidden = true; ui.aptLabels.innerHTML = ''; ui.markers.hidden = false;
}
function backToOverview() {
  closeInterior(); state.mode = 'overview'; state.b = null; ui.panel.hidden = true;
  aimSun(new THREE.Vector3(80, 0, -20), 330);
  flyTo(new THREE.Vector3(-420, 190, 330), new THREE.Vector3(60, 20, -20), 1800);
  ui.hint.textContent = 'Blokun hərfinə toxunun — mərtəbə və mənzil seçimi';
}
$('#exitApt').addEventListener('click', () => { const b = state.b, f = interior?.userData.f; closeInterior(); state.mode = 'building'; if (b && f) { state.b = b; selectFloor(f); } });
$('#home').addEventListener('click', backToOverview);
addEventListener('keydown', (e) => { fp.keys.add(e.code); if (e.code === 'Escape' && fp.on) $('#exitApt').click(); });
addEventListener('keyup', (e) => fp.keys.delete(e.code));
{
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (fp.on) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => { if (!fp.on || !drag) return; const k = e.pointerType === 'touch' ? 0.006 : 0.0035; fp.yaw -= (e.clientX - drag.x) * k; fp.pitch = THREE.MathUtils.clamp(fp.pitch - (e.clientY - drag.y) * k, -1.1, 1.1); drag = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', () => (drag = null));
  for (const [id, v] of [['#fwd', 1], ['#back', -1]]) {
    const el = $(id);
    el.addEventListener('pointerdown', () => (fp.fwd = v)); el.addEventListener('pointerup', () => (fp.fwd = 0)); el.addEventListener('pointerleave', () => (fp.fwd = 0));
  }
}
function updateFP(dt) {
  const f = (fp.keys.has('KeyW') || fp.keys.has('ArrowUp') ? 1 : 0) - (fp.keys.has('KeyS') || fp.keys.has('ArrowDown') ? 1 : 0) + fp.fwd;
  const s = (fp.keys.has('KeyD') || fp.keys.has('ArrowRight') ? 1 : 0) - (fp.keys.has('KeyA') || fp.keys.has('ArrowLeft') ? 1 : 0);
  if (f || s) {
    const dir = new THREE.Vector3(-Math.sin(fp.yaw), 0, -Math.cos(fp.yaw)), right = new THREE.Vector3(-dir.z, 0, dir.x);
    const next = fp.pos.clone().addScaledVector(dir, f * 2.2 * dt).addScaledVector(right, s * 2.2 * dt);
    const b = state.b, local = b.group.worldToLocal(next.clone());
    if (inPoly(interior.userData.core, local.x, local.z) && inPoly(interior.userData.core, local.x * 1.04, local.z * 1.04)) fp.pos.copy(next);
  }
  camera.position.copy(fp.pos);
  camera.quaternion.setFromEuler(new THREE.Euler(fp.pitch, fp.yaw, 0, 'YXZ'));
}

/* ---------------- dövr ---------------- */
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const now = performance.now();
  for (const tw of [...tweens]) { const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(ease(k)); if (k >= 1) { tweens.delete(tw); tw.done && tw.done(); } }
  waterNormal.offset.set(t * 0.004, t * 0.003);
  if (fp.on) updateFP(dt); else controls.update();
  // işarələr
  if (!fp.on) buildings.forEach((b) => {
    tmp.copy(b.top); tmp.y += (state.b === b && state.floor ? 26 : 0); tmp.project(camera);
    const vis = tmp.z < 1 && (state.mode === 'overview' || state.b === b);
    b.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-tmp.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`;
    b.el.style.opacity = vis ? '1' : '0'; b.el.style.pointerEvents = vis ? 'auto' : 'none';
    b.el.classList.toggle('on', state.b === b);
  });
  if (interior && state.mode === 'floor') {
    const { b, f, apts } = interior.userData; const fg = b.floorGroups[f - 1];
    apts.forEach((a) => { tmp.set(a.cx, fg.position.y + 2.4, a.cz); b.group.localToWorld(tmp); tmp.project(camera); a.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-tmp.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%, -100%)`; });
  }
  composer.render(dt);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// giriş: dənizdən sahilə uçuş
flyTo(new THREE.Vector3(-420, 190, 330), new THREE.Vector3(60, 20, -20), 3200);
ui.hint.textContent = 'Blokun hərfinə toxunun — mərtəbə və mənzil seçimi';
requestAnimationFrame(() => $('#loader').classList.add('done'));
requestAnimationFrame(frame);
window.__bayil = { camera, controls, scene, buildings, openBuilding, selectFloor, openApt, enterApt, backToOverview, state, get interior() { return interior; }, fp };
