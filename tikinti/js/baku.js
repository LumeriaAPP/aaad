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

/* ---------- Alov Qülləsi ----------
   Real forma: en kəsiyi damla (ucu kənara baxır). Xarici fasad demək olar
   şaquli qalxır, içəri tərəf isə mailli daralaraq yuxarıda ucda birləşir. */
function flameGeometry(H, R) {
  const segs = 72, rings = 90;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const k = Math.pow(Math.max(0, 1 - Math.pow(t, 2.3)), 0.62) * (1 + 0.06 * Math.sin(t * Math.PI)); // en kəsiyinin miqyası
    const apexX = R * (1 - 0.22 * t * t); // uc yuxarıda bir az içəri əyilir
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      // damla: a=0 — kəskin uc (+x), a=π — geniş yumru arxa
      const x = R * Math.cos(a);
      const z = R * 0.92 * Math.sin(a) * (0.5 - 0.5 * Math.cos(a)) * (1 + 0.15 * (1 - Math.cos(a)));
      const px = apexX + (x - R) * k;
      pos.push(px, t * H, z * k);
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
  // qüllənin ağırlıq mərkəzini mənşəyə gətir
  g.translate(-R * 0.35, 0, 0);
  return g;
}

function flameMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x5f7f99, metalness: 0.9, roughness: 0.07, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = bakuUniforms.uTime;
    sh.uniforms.uNight = bakuUniforms.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFUv; varying vec3 vFPos;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFUv = uv; vFPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFUv; varying vec3 vFPos; uniform float uTime; uniform float uNight;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // şüşə fasadın mərtəbə və panel xətləri
        float gl1 = step(0.9, fract(vFPos.y / 3.6));
        float gl2 = step(0.93, fract(vFUv.x * 90.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.18, 0.2), max(gl1, gl2) * 0.8);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // LED ekran: alov ↔ Azərbaycan bayrağı növbə ilə
          float y = vFPos.y;
          vec2 p = vec2(vFUv.x * 7.0, y * 0.035 - uTime * 1.1);
          float n = fn(p * 2.0) * 0.55 + fn(p * 4.3 + 3.1) * 0.3 + fn(p * 9.0) * 0.15;
          float body = smoothstep(0.2, 0.9, n + (1.0 - vFUv.y) * 0.6);
          vec3 fire = mix(vec3(0.85, 0.1, 0.02), vec3(1.0, 0.5, 0.06), body);
          fire = mix(fire, vec3(1.0, 0.85, 0.45), smoothstep(0.82, 1.0, body) * 0.7);
          fire *= body * 1.6;
          float band = vFUv.y * 3.0;
          vec3 flag = band < 1.0 ? vec3(0.0, 0.62, 0.85) : band < 2.0 ? vec3(0.95, 0.12, 0.2) : vec3(0.0, 0.7, 0.3);
          float cyc = smoothstep(0.45, 0.55, fract(uTime / 24.0));
          vec3 led = mix(fire, flag * 1.1, cyc);
          float px = step(0.25, fract(vFUv.x * 90.0)) * step(0.2, fract(y / 3.6)); // LED piksel şəbəkəsi
          totalEmissiveRadiance += led * px * uNight * 2.0;
        }`);
  };
  m.customProgramCacheKey = () => 'baku-flame-v2';
  return m;
}

function flameTowers() {
  const g = new THREE.Group();
  const mat = flameMaterial();
  // real hündürlüklər: 182, 161, 140 m; üçbucaq düzülüş, uclar kənara
  const specs = [
    { h: 182, r: 31, ang: Math.PI / 2 },
    { h: 161, r: 29, ang: Math.PI / 2 + (2 * Math.PI) / 3 },
    { h: 140, r: 27, ang: Math.PI / 2 - (2 * Math.PI) / 3 },
  ];
  for (const s of specs) {
    const m = new THREE.Mesh(flameGeometry(s.h, s.r), mat);
    m.position.set(Math.cos(s.ang) * 34, 0, -Math.sin(s.ang) * 34);
    m.rotation.y = s.ang;
    m.castShadow = true;
    g.add(m);
  }
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.8 });
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(105, 115, 12, 48), stone);
  pod.position.y = 1;
  g.add(pod);
  return g;
}

/* ---------- TV qülləsi (310 m) ---------- */
function tvTower() {
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.65 });
  // gövdə: dibdə genişlənən konusvari profil
  const prof = [];
  const shaftH = 222;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const r = 3.6 + 13 * Math.pow(1 - t, 6) + 1.6 * (1 - t);
    prof.push(new THREE.Vector2(r, t * shaftH));
  }
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), concrete);
  g.add(shaft);
  // üfüqi qurşaqlar
  for (let y = 30; y < 170; y += 28) {
    const r = 3.6 + 13 * Math.pow(1 - y / shaftH, 6) + 1.6 * (1 - y / shaftH);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.5, 1.4, 40), concrete);
    band.position.y = y;
    g.add(band);
  }
  // restoran və seyr meydançası: bir neçə qat
  const glass = new THREE.MeshStandardMaterial({ color: 0x24313d, metalness: 0.75, roughness: 0.12 });
  const podGlow = Object.assign(new THREE.MeshStandardMaterial({ color: 0x24313d, metalness: 0.6, roughness: 0.15, emissive: 0xffd08a, emissiveIntensity: 0.03 }), { userData: { nightGlow: 0.03 } });
  const layers = [
    [170, 10, 12, 3, concrete], [174, 14.5, 12.5, 6, podGlow], [180, 15, 15, 1.5, concrete],
    [182.5, 14, 14.5, 5, glass], [187.5, 12.5, 14, 1.5, concrete], [190, 9, 10, 4, podGlow], [194.5, 6, 9, 2, concrete],
  ];
  for (const [y, rt, rb, h, mat] of layers) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 48), mat);
    d.position.y = y + h / 2;
    g.add(d);
  }
  // antena: qırmızı-ağ zolaqlar
  const red = new THREE.MeshStandardMaterial({ color: 0xc8231c, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (let i = 0; i < 11; i++) {
    const r0 = 2.4 - i * 0.17;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.17, r0, 8, 12), i % 2 ? white : red);
    seg.position.y = 222 + i * 8 + 4;
    g.add(seg);
  }
  const lights = Object.assign(new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0.4 }), { userData: { nightGlow: 0.4 } });
  for (const y of [120, 196, 250, 308]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), lights);
    l.position.set(0, y, 0);
    g.add(l);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------- Kristal Zal ---------- */
function crystalHall() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.05));
  geo.scale(85, 22, 70);
  geo.translate(0, 1, 0);
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
  g.fillStyle = '#ece6dc';
  g.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 256, 256);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = '#6b6e72';
      g.fillRect(x * cw + 7, y * rh + 3, cw - 14, rh - 5);
      g.fillStyle = '#2f3236';
      g.fillRect(x * cw + 9, y * rh + 5, cw - 18, rh - 9);
      g.fillStyle = 'rgba(160,185,200,0.35)';
      g.fillRect(x * cw + 9, y * rh + 5, (cw - 18) / 2, rh - 9);
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

export const CITY_COLORS = [0xd9c9ad, 0xb98a6c, 0xc8c3ba, 0xa8795f, 0xe2dccf, 0x9c8f80, 0xcdb89a].map((c) => new THREE.Color(c));
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
    city.setColorAt(city.count, CITY_COLORS[Math.floor(rand() * CITY_COLORS.length)]);
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
  if (city.instanceColor) city.instanceColor.needsUpdate = true;
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
