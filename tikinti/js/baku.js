// Arxa fonda Bakı mənzərəsi: Alov Qüllələri, TV qülləsi, Kristal Zal,
// Xəzər dənizi, Dənizkənarı bulvar və təpələrdə şəhər.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const bakuUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };

// Mənzərənin yerləşməsi (səhnə koordinatları, metr)
const SHORE_Z = -1050; // sahil xətti (bundan uzaqda dəniz)
const FLAME = new THREE.Vector3(-620, 0, -760);
const TV = new THREE.Vector3(-980, 0, -560);
const CRYSTAL = new THREE.Vector3(-150, 0, -1120);

// Təpə hündürlüyü (Alov Qüllələrinin yerləşdiyi yüksəklik)
export function hillHeight(x, z) {
  const d1 = Math.hypot((x - FLAME.x) / 420, (z - FLAME.z) / 300);
  const d2 = Math.hypot((x - TV.x) / 380, (z - TV.z) / 420);
  const h = 62 * Math.exp(-d1 * d1 * 1.4) + 78 * Math.exp(-d2 * d2 * 1.3);
  // sahilə yaxın alçalır
  const shore = THREE.MathUtils.smoothstep(z, SHORE_Z + 20, SHORE_Z + 260);
  return h * shore;
}

/* ---------- Alov Qülləsi (alov formalı şüşə qüllə) ---------- */
function flameGeometry(H, R, lean) {
  const segs = 56, rings = 70;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    // profil: aşağıda bir az genişlənir, yuxarıda alov ucu kimi daralır
    const prof = (0.86 + 0.28 * Math.sin(t * Math.PI * 0.75)) * Math.pow(1 - Math.pow(t, 2.4), 0.75);
    const shift = Math.pow(t, 2.2) * lean;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      // damla formalı en kəsiyi
      const r = R * prof * (1 + 0.42 * Math.cos(a)) * (0.78 + 0.22 * Math.cos(2 * a));
      pos.push(Math.cos(a) * r + shift, t * H, Math.sin(a) * r * 0.82);
      uv.push(j / segs, t);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function flameMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3d5f7c, metalness: 0.85, roughness: 0.12, envMapIntensity: 1.2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = bakuUniforms.uTime;
    sh.uniforms.uNight = bakuUniforms.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFUv; uniform float uTime; uniform float uNight;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // fasad şəbəkəsi (mərtəbə xətləri)
          float grid = step(0.92, fract(vFUv.y * 58.0)) * 0.6 + step(0.95, fract(vFUv.x * 64.0)) * 0.4;
          // gecə: LED ekranda yuxarı qalxan alov
          vec2 p = vec2(vFUv.x * 6.0, vFUv.y * 3.0 - uTime * 0.9);
          float n = fn(p * 2.0) * 0.55 + fn(p * 4.3 + 3.1) * 0.3 + fn(p * 9.0) * 0.15;
          float body = smoothstep(0.15, 0.85, n + (1.0 - vFUv.y) * 0.55);
          vec3 fire = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.55, 0.08), body);
          fire = mix(fire, vec3(1.0, 0.9, 0.5), smoothstep(0.8, 1.0, body) * 0.6);
          vec3 led = fire * body * (1.3 + 0.4 * sin(uTime * 3.0 + vFUv.y * 20.0));
          totalEmissiveRadiance += led * uNight * 2.2 + vec3(0.02, 0.03, 0.04) * grid * (1.0 - uNight);
        }`);
  };
  m.customProgramCacheKey = () => 'baku-flame-v1';
  return m;
}

function flameTowers() {
  const g = new THREE.Group();
  const mat = flameMaterial();
  const specs = [
    { h: 190, r: 31, lean: -8, x: 0, z: 0, ry: 0.4 },
    { h: 165, r: 28, lean: -7, x: -66, z: 50, ry: 2.5 },
    { h: 160, r: 28, lean: -7, x: 66, z: 46, ry: -1.8 },
  ];
  for (const s of specs) {
    const m = new THREE.Mesh(flameGeometry(s.h, s.r, s.lean), mat);
    m.position.set(s.x, 0, s.z);
    m.rotation.y = s.ry;
    m.castShadow = true;
    g.add(m);
  }
  // podium
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(95, 105, 10, 40), new THREE.MeshStandardMaterial({ color: 0xcbbfa8, roughness: 0.8 }));
  pod.position.y = 2;
  g.add(pod);
  return g;
}

/* ---------- TV qülləsi ---------- */
function tvTower() {
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3440, metalness: 0.7, roughness: 0.15 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 9, 245, 24), concrete);
  shaft.position.y = 122;
  g.add(shaft);
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(15, 12, 16, 32), glass);
  pod.position.y = 186;
  g.add(pod);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 16.5, 2.5, 32), concrete);
  ring.position.y = 195;
  g.add(ring);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, 65, 8), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.8, roughness: 0.3 }));
  ant.position.y = 277;
  g.add(ant);
  const lights = Object.assign(new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0.4 }), { userData: { nightGlow: 0.4 } });
  for (const y of [120, 200, 250, 308]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lights);
    l.position.set(0, y, 0);
    g.add(l);
  }
  const podGlow = Object.assign(new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: 0x6fb2ff, emissiveIntensity: 0.05, transparent: true, opacity: 0.9 }), { userData: { nightGlow: 0.05 } });
  const pg = new THREE.Mesh(new THREE.CylinderGeometry(15.2, 12.2, 5, 32, 1, true), podGlow);
  pg.position.y = 186;
  g.add(pg);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ---------- Kristal Zal ---------- */
function crystalHall() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.2));
  geo.scale(70, 30, 58);
  geo.translate(0, 6, 0);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xaab8c4, metalness: 0.9, roughness: 0.08, flatShading: true, envMapIntensity: 1.3 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = bakuUniforms.uTime;
    sh.uniforms.uNight = bakuUniforms.uNight;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 c = 0.5 + 0.5 * cos(uTime * 0.6 + vViewPosition.x * 0.02 + vec3(0.0, 2.0, 4.0));
          totalEmissiveRadiance += c * uNight * 0.9; }`);
  };
  mat.customProgramCacheKey = () => 'baku-crystal-v1';
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/* ---------- Şəhər fasad teksturası (qum daşı + pəncərələr) ---------- */
function cityTextures() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const e = document.createElement('canvas');
  e.width = 256; e.height = 256;
  const ge = e.getContext('2d');
  const r = rng(91);
  g.fillStyle = '#cbbd9f';
  g.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 256, 256);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = '#3b3a3a';
      g.fillRect(x * cw + 8, y * rh + 4, cw - 16, rh - 7);
      if (r() < 0.45) {
        const k = 0.5 + r() * 0.5;
        ge.fillStyle = `rgb(${255 * k},${185 * k},${110 * k})`;
        ge.fillRect(x * cw + 8, y * rh + 4, cw - 16, rh - 7);
      }
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(e);
  em.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { map, em };
}

// Bina qutusu: UV-ləri hündürlüyə görə təkrarlanır (hər 3.2 m = 1 mərtəbə)
function cityBoxGeo() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  return g;
}

let _cityMat = null;
export function cityMaterial() {
  if (_cityMat) return _cityMat;
  const { map, em } = cityTextures();
  map.repeat.set(3, 6);
  em.repeat.set(3, 6);
  _cityMat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.85 });
  _cityMat.userData.nightGlow = 0.0;
  _cityMat.userData.nightGlowAdd = 1.4;
  return _cityMat;
}

export function buildBaku(GY = -0.4) {
  const root = new THREE.Group();
  const rand = rng(1918);

  // Xəzər dənizi
  const wn = new THREE.TextureLoader().load('assets/textures/water_normal.jpg');
  wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  wn.repeat.set(60, 30);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 4200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1c3f55, metalness: 0.25, roughness: 0.08, normalMap: wn, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.4 })
  );
  sea.position.set(0, GY + 0.1, SHORE_Z - 2100);
  sea.userData.water = wn;
  root.add(sea);

  // Bulvar: sahil boyu gəzinti zolağı, fənərlər və palmalar
  const prom = new THREE.Mesh(new THREE.BoxGeometry(6000, 0.6, 40), new THREE.MeshStandardMaterial({ color: 0xc9bca3, roughness: 0.85 }));
  prom.position.set(0, GY + 0.1, SHORE_Z + 10);
  prom.receiveShadow = true;
  root.add(prom);
  const lampMat = Object.assign(new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffc070, emissiveIntensity: 0.3 }), { userData: { nightGlow: 0.3 } });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), lampMat, 400);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let x = -2400; x <= 2400; x += 14) { m4.makeTranslation(x, GY + 6, SHORE_Z - 6); bulbs.setMatrixAt(n++, m4); }
  bulbs.count = n;
  root.add(bulbs);

  // Təpələr (Alov Qüllələri və TV qülləsinin olduğu yüksəklik)
  const hillGeo = new THREE.PlaneGeometry(1800, 900, 120, 60).rotateX(-Math.PI / 2);
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i) - 700, z = hp.getZ(i) - 700;
    hp.setY(i, hillHeight(x, z));
  }
  hillGeo.computeVertexNormals();
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ color: 0x8c8a6a, roughness: 1 }));
  hill.position.set(-700, GY - 0.3, -700);
  hill.receiveShadow = true;
  root.add(hill);

  // Uzaq şəhər: qum daşı rəngli binalar, gecə pəncərələr yanır
  const cityMat = cityMaterial();
  const city = new THREE.InstancedMesh(cityBoxGeo(), cityMat, 2600);
  city.count = 0;
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const place = (x, z, w, d, h, ry) => {
    if (city.count >= 2600) return;
    const y = hillHeight(x, z);
    q.setFromEuler(e.set(0, ry, 0));
    city.setMatrixAt(city.count++, m4.compose(p.set(x, GY + y - 1, z), q, s.set(w, h, d)));
  };
  for (let i = 0; i < 6000 && city.count < 2600; i++) {
    const x = (rand() - 0.5) * 3600, z = SHORE_Z + 60 + rand() * 1750;
    const dist = Math.hypot(x, z);
    if (dist < 560) continue; // bizim məhəllə və yaxın ətraf
    if (Math.hypot(x - FLAME.x, z - FLAME.z) < 130 || Math.hypot(x - TV.x, z - TV.z) < 45 || Math.hypot(x - CRYSTAL.x, z - CRYSTAL.z) < 90) continue;
    const onHill = hillHeight(x, z) > 15;
    const w = 14 + rand() * 20, d = 12 + rand() * 18;
    const h = onHill ? 8 + rand() * 14 : 12 + rand() * (rand() < 0.15 ? 90 : 38);
    place(x, z, w, d, h, (rand() - 0.5) * 0.3);
  }
  city.instanceMatrix.needsUpdate = true;
  city.receiveShadow = true;
  root.add(city);

  // Simvollar
  const flames = flameTowers();
  flames.position.set(FLAME.x, GY + hillHeight(FLAME.x, FLAME.z) - 2, FLAME.z);
  root.add(flames);
  const tv = tvTower();
  tv.position.set(TV.x, GY + hillHeight(TV.x, TV.z) - 1, TV.z);
  root.add(tv);
  const ch = crystalHall();
  ch.position.set(CRYSTAL.x, GY, CRYSTAL.z);
  root.add(ch);

  root.userData.sea = wn;
  return root;
}
