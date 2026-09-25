// Yaşayış kompleksi: realistik şüşə (pəncərə arxasında otaq), qonşu binalar və həyət
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityMaterial, CITY_COLORS } from './baku.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* =========================================================
   Pəncərə şüşəsi: "interior mapping" — hər panelin arxasında
   saxta 3D otaq hesablanır (divar, döşəmə, tavan, pərdə, mebel).
   Baxış bucağı dəyişdikcə otağın perspektivi də dəyişir.
   ========================================================= */
let windowMat = null;
export function windowMaterial() {
  if (windowMat) return windowMat;
  const m = new THREE.MeshStandardMaterial({ color: 0x5d6f7e, metalness: 0.55, roughness: 0.035, envMapIntensity: 1.05 });
  m.userData.uniforms = { uRoomDepth: { value: 4.2 }, uNight: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRoomPos; varying vec3 vRoomCam; flat varying float vRoomSeed; flat varying vec2 vRoomScale;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 rM = modelMatrix;
        #ifdef USE_INSTANCING
          rM = modelMatrix * instanceMatrix;
        #endif
        vRoomPos = position;
        // kameranı panelin yerli fəzasına keçir (inverse() olmadan: fırlanma + miqyas)
        vec3 wOrigin = rM[3].xyz;
        vec3 rc = cameraPosition - wOrigin;
        vRoomCam = vec3(dot(rc, rM[0].xyz) / dot(rM[0].xyz, rM[0].xyz), dot(rc, rM[1].xyz) / dot(rM[1].xyz, rM[1].xyz), dot(rc, rM[2].xyz) / dot(rM[2].xyz, rM[2].xyz));
        vRoomSeed = mod(dot(floor(wOrigin * 1.3), vec3(12.9898, 78.233, 37.719)), 997.0);
        vRoomScale = vec2(length(rM[0].xyz), length(rM[1].xyz));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRoomPos; varying vec3 vRoomCam; flat varying float vRoomSeed; flat varying vec2 vRoomScale;
        uniform float uRoomDepth; uniform float uNight;
        float rh(float x) { return fract(sin(x) * 43758.5453); }
        vec3 roomColor() {
          vec3 ro = vRoomPos;
          // qeyri-bərabər miqyaslı panel fəzasından metrə keç
          vec3 cam = vRoomCam * vec3(vRoomScale, 1.0);
          ro *= vec3(vRoomScale, 1.0);
          vec3 rd = normalize(ro - cam);
          if (rd.z > -0.001) return vec3(0.0);
          float s0 = rh(vRoomSeed), s1 = rh(vRoomSeed + 1.7), s2 = rh(vRoomSeed + 3.1), s3 = rh(vRoomSeed + 5.3);
          float W = vRoomScale.x, H = vRoomScale.y;
          // otaq bir neçə paneli əhatə edir
          float roomW = 4.2 + s1 * 2.0;
          float x0 = -W * 0.5 - s0 * (roomW - W);
          vec3 bmin = vec3(x0, -H * 0.5, -uRoomDepth);
          vec3 bmax = vec3(x0 + roomW, H * 0.5, 0.0);
          float tx = ((rd.x > 0.0 ? bmax.x : bmin.x) - ro.x) / rd.x;
          float ty = ((rd.y > 0.0 ? bmax.y : bmin.y) - ro.y) / rd.y;
          float tz = (bmin.z - ro.z) / rd.z;
          float t = min(min(tx, ty), tz);
          vec3 p = ro + rd * t;
          vec3 wallA = mix(vec3(0.78, 0.72, 0.64), vec3(0.62, 0.66, 0.68), step(0.6, s2));
          vec3 col;
          if (t == tz) {
            col = wallA * 0.85;
            // arxa divarda divan/şkaf siluetləri
            float fx = (p.x - bmin.x) / roomW;
            if (p.y < -H * 0.5 + 0.8 && abs(fx - (0.3 + s3 * 0.4)) < 0.22) col = mix(vec3(0.25, 0.23, 0.22), vec3(0.55, 0.45, 0.35), s1);
            if (s2 > 0.7 && abs(fx - 0.8) < 0.07 && p.y < H * 0.5 - 0.7) col = vec3(0.32, 0.22, 0.15); // qapı
            if (s3 > 0.5 && abs(fx - 0.35) < 0.1 && abs(p.y - 0.25) < 0.28) col = mix(vec3(0.2, 0.3, 0.4), vec3(0.6, 0.4, 0.3), s0); // şəkil
          } else if (t == ty) {
            col = rd.y < 0.0 ? mix(vec3(0.42, 0.29, 0.19), vec3(0.62, 0.58, 0.52), step(0.55, s0)) : vec3(0.92, 0.91, 0.88);
          } else {
            col = wallA * 0.7;
          }
          // tavan işığı + dərinliyə doğru qaralma
          float depthK = clamp(-p.z / uRoomDepth, 0.0, 1.0);
          float light = mix(1.0, 0.45, depthK) * (0.75 + 0.25 * (p.y / H + 0.5));
          // pərdələr (pəncərənin kənarlarında)
          float cx = ro.x / W + 0.5;
          if (s1 > 0.45) {
            float side = s2 > 0.5 ? cx : 1.0 - cx;
            float cw = 0.18 + s3 * 0.25;
            if (side < cw) {
              float fold = 0.9 + 0.1 * sin(ro.x * 14.0);
              col = mix(vec3(0.86, 0.82, 0.74), vec3(0.55, 0.5, 0.45), step(0.8, s0)) * fold;
              light = 1.0;
            }
          }
          if (s0 > 0.85) { col = vec3(0.8, 0.8, 0.78); light = 1.0; } // jalüzi bağlı
          float lit = mix(0.13, 0.32, s3);
          if (s2 < 0.12) lit = 0.035; // boş/qaranlıq otaq
          // axşam: otaqların təxminən yarısında işıq yanır, çalarlar fərqlidir
          float on = step(0.27, rh(vRoomSeed + 9.7));
          lit = mix(lit, mix(0.01, lit * (0.8 + 0.9 * s1), on), uNight);
          vec3 warm = mix(vec3(1.3, 0.92, 0.6), vec3(1.15, 1.0, 0.85), step(0.7, s0));
          vec3 lampTint = mix(vec3(1.0), warm, uNight);
          return col * light * lit * lampTint * (1.0 + uNight * 2.4);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 ro = vRoomPos * vec3(vRoomScale, 1.0);
          vec3 rd = normalize(ro - vRoomCam * vec3(vRoomScale, 1.0));
          float cosT = clamp(-rd.z, 0.0, 1.0);
          float F = 0.08 + 0.92 * pow(1.0 - cosT, 4.0);
          totalEmissiveRadiance += roomColor() * (1.0 - F);
        }`);
  };
  m.customProgramCacheKey = () => 'room-glass-v6';
  windowMat = m;
  return m;
}

/* =========================================================
   Qonşu binalar (kompleksin digər korpusları).
   Əsas binadan fərqli olaraq bütün mərtəbələr birləşdirilir.
   ========================================================= */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function inst(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.count = 0;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function put(im, x, y, z, ry, sx, sy, sz) {
  _q.setFromEuler(_e.set(0, ry, 0));
  im.setMatrixAt(im.count++, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
}

// Fasad materialları (bej daş + tunc) — arxitektura renderlərindəki üslub
let FM = null;
export function facadeMats() {
  if (FM) return FM;
  FM = {
    stone: new THREE.MeshStandardMaterial({ color: 0xdcd6cb, roughness: 0.75 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.7 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x40444a, roughness: 0.6, metalness: 0.2 }),
    green: new THREE.MeshStandardMaterial({ color: 0x46703a, roughness: 0.9, flatShading: true }),
    rail: new THREE.MeshStandardMaterial({ color: 0x9fb2bd, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6f6d69, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a5a40, roughness: 0.7 }),
    shop: Object.assign(new THREE.MeshStandardMaterial({ color: 0x2b2722, emissive: 0xffb574, emissiveIntensity: 0.06, roughness: 0.2, metalness: 0.3 }), { userData: { nightGlow: 0.06 } }),
    uplight: Object.assign(new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }), { userData: { nightOpacity: 0.55 } }),
  };
  return FM;
}

// Pilyastrlarda aşağıdan yuxarı yumşaq işıq (fasad işıqlandırması) üçün qradiyent
let upTex = null;
function uplightTexture() {
  if (upTex) return upTex;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,220,170,1)');
  gr.addColorStop(0.35, 'rgba(255,210,150,0.35)');
  gr.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 128);
  upTex = new THREE.CanvasTexture(c);
  upTex.colorSpace = THREE.SRGBColorSpace;
  return upTex;
}

export function buildNeighbor(opt) {
  const M = facadeMats();
  const { w = 26, d = 18, floors = 16, fh = 3.2, x = 0, z = 0, rot = 0, podium = 2 } = opt;
  const ground = 4.6;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const baseTop = ground + (podium - 1) * 4.2;
  const H = baseTop + floors * fh;

  const stone = [], stoneDark = [], bronze = [], rails = [], roofG = [], wood = [], shop = [];
  const box = (arr, sx, sy, sz, px, py, pz, ry = 0) => {
    const b = new THREE.BoxGeometry(sx, sy, sz);
    if (ry) b.rotateY(ry);
    b.translate(px, py, pz);
    arr.push(b);
  };
  const sides = [
    { len: w, o: [0, -d / 2], t: [1, 0], nrm: [0, -1], ry: Math.PI },
    { len: w, o: [0, d / 2], t: [-1, 0], nrm: [0, 1], ry: 0 },
    { len: d, o: [w / 2, 0], t: [0, 1], nrm: [1, 0], ry: Math.PI / 2 },
    { len: d, o: [-w / 2, 0], t: [0, -1], nrm: [-1, 0], ry: -Math.PI / 2 },
  ];
  let bays = 0;
  for (const s of sides) bays += Math.max(2, Math.round(s.len / 3));
  const glass = inst(new THREE.PlaneGeometry(1, 1), windowMaterial(), bays * floors);
  glass.receiveShadow = false;
  const greens = inst(new THREE.IcosahedronGeometry(1, 1), M.green, bays * floors);

  // podium (1–2 mərtəbə mağazalar)
  box(stoneDark, w + 0.4, 0.5, d + 0.4, 0, baseTop - 0.25, 0);
  box(shop, w - 1.2, baseTop - 0.6, d - 1.2, 0, (baseTop - 0.6) / 2, 0);
  for (const s of sides) {
    const n = Math.max(2, Math.round(s.len / 6));
    for (let i = 0; i <= n; i++) {
      const t = -s.len / 2 + (i * s.len) / n;
      const px = s.o[0] + s.t[0] * t, pz = s.o[1] + s.t[1] * t;
      box(stoneDark, 0.7, baseTop, 0.7, px, baseTop / 2, pz);
    }
  }

  // mərtəbələr
  for (let f = 0; f < floors; f++) {
    const y0 = baseTop + f * fh;
    // döşəmə qurşağı
    box(stone, w + 0.7, 0.42, d + 0.7, 0, y0 + 0.21, 0);
    for (const s of sides) {
      const n = Math.max(2, Math.round(s.len / 3)), bw = s.len / n;
      for (let i = 0; i < n; i++) {
        const t = -s.len / 2 + (i + 0.5) * bw;
        const px = s.o[0] + s.t[0] * t + s.nrm[0] * 0.02, pz = s.o[1] + s.t[1] * t + s.nrm[1] * 0.02;
        const gh = fh - 0.42;
        put(glass, px, y0 + 0.42 + gh / 2, pz, s.ry, bw - 0.9, gh, 1);
        // tünd boz qutu eyvanlar (şaquli sütunlar şəklində) + yaşıllıq
        if (i % 3 === 1 && s.n !== 'none') {
          const out = 1.35, ew = bw - 0.35;
          const cx = px + s.nrm[0] * (out / 2 + 0.1), cz = pz + s.nrm[1] * (out / 2 + 0.1);
          box(bronze, ew, 0.24, out, cx, y0 + 0.12, cz, s.ry);
          const fx = px + s.nrm[0] * (out + 0.06), fz = pz + s.nrm[1] * (out + 0.06);
          box(bronze, ew, 1.0, 0.12, fx, y0 + 0.24 + 0.5, fz, s.ry);
          for (const sd of [-1, 1]) {
            const ox = s.t[0] * sd * ew / 2, oz = s.t[1] * sd * ew / 2;
            box(bronze, 0.12, fh - 0.24, out, cx + ox, y0 + 0.24 + (fh - 0.24) / 2, cz + oz, s.ry);
          }
          if ((f + i) % 2 === 0) {
            put(greens, fx - s.t[0] * ew * 0.25, y0 + 1.35, fz - s.t[1] * ew * 0.25, f * 1.3, 0.55, 0.42, 0.55);
            put(greens, fx + s.t[0] * ew * 0.2, y0 + 1.3, fz + s.t[1] * ew * 0.2, f * 2.1, 0.45, 0.35, 0.45);
          }
        }
      }
    }
  }
  // şaquli pilyastrlar (tam hündürlük)
  const pilH = H - baseTop;
  for (const s of sides) {
    const n = Math.max(2, Math.round(s.len / 3)), bw = s.len / n;
    for (let i = 0; i <= n; i++) {
      const t = -s.len / 2 + i * bw;
      const px = s.o[0] + s.t[0] * t + s.nrm[0] * 0.18, pz = s.o[1] + s.t[1] * t + s.nrm[1] * 0.18;
      const wide = i === 0 || i === n || i % 3 === 0;
      box(stone, wide ? 0.62 : 0.4, pilH, 0.5, px, baseTop + pilH / 2, pz, s.ry);
    }
  }
  // dam: parapet, terras, pergola, texniki blok
  box(stone, w + 0.8, 1.3, d + 0.8, 0, H + 0.65, 0);
  box(roofG, w - 0.4, 0.2, d - 0.4, 0, H + 1.2, 0);
  box(stoneDark, w * 0.3, 3.2, d * 0.35, -w * 0.18, H + 2.8, -d * 0.1);
  const px0 = w * 0.08, pw = w * 0.34, pd = d * 0.55;
  for (const [cx, cz] of [[px0, -pd / 2], [px0 + pw, -pd / 2], [px0, pd / 2], [px0 + pw, pd / 2]]) box(wood, 0.25, 2.8, 0.25, cx, H + 2.6, cz);
  for (let i = 0; i <= 12; i++) box(wood, 0.12, 0.22, pd + 0.6, px0 + (i * pw) / 12, H + 4.05, 0);
  box(rails, w + 0.8, 1.0, 0.03, 0, H + 1.8, d / 2 + 0.4);

  const add = (arr, mat, cast = true) => {
    if (!arr.length) return;
    const m = new THREE.Mesh(mergeGeometries(arr), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
  };
  add(stone, M.stone);
  add(stoneDark, M.stoneDark);
  add(bronze, M.bronze);
  add(rails, M.rail, false);
  add(roofG, M.roof);
  add(wood, M.wood);
  add(shop, M.shop);
  glass.instanceMatrix.needsUpdate = true;
  greens.instanceMatrix.needsUpdate = true;
  g.add(glass, greens);

  // fasad işıqlandırması (gecə): pilyastrların dibindən yuxarı
  const up = new THREE.MeshBasicMaterial({ map: uplightTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  up.userData.nightOpacity = 0.35;
  const ups = [];
  for (const s of sides) {
    const n = Math.max(2, Math.round(s.len / 3)), bw = s.len / n;
    for (let i = 0; i <= n; i += 3) {
      const t = -s.len / 2 + i * bw;
      const p = new THREE.PlaneGeometry(1.2, 14);
      p.rotateY(s.ry);
      p.translate(s.o[0] + s.t[0] * t + s.nrm[0] * 0.45, baseTop + 7, s.o[1] + s.t[1] * t + s.nrm[1] * 0.45);
      ups.push(p);
    }
  }
  const upMesh = new THREE.Mesh(mergeGeometries(ups), up);
  upMesh.renderOrder = 3;
  g.add(upMesh);

  g.userData.height = H;
  g.userData.top = new THREE.Vector3(x, H + 5, z);
  return g;
}

/* =========================================================
   Həyət: xiyabanlar, hovuz, oyun meydançası, pergola, kollar
   ========================================================= */
export function buildCourtyard(GY = -0.4) {
  const g = new THREE.Group();
  const rand = rng(515);
  const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

  // böyük hovuz (su normal xəritəsi ilə)
  const wn = new THREE.TextureLoader().load('assets/textures/water_normal.jpg');
  wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  wn.repeat.set(3, 1.5);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 9).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x1f8fb0, roughness: 0.03, metalness: 0, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, envMapIntensity: 1.3 })
  );
  water.position.set(0, GY + 0.28, 46);
  water.userData.water = wn;
  g.add(water);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 16), std(0xd9cfbf, 0.6));
  deck.position.set(0, GY + 0.12, 46);
  deck.receiveShadow = true;
  g.add(deck);
  const poolWall = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.34, 9.6), std(0xf2eee6, 0.4));
  poolWall.position.set(0, GY + 0.13, 46);
  g.add(poolWall);
  // şezlonqlar və çətirlər
  const lounger = std(0xf6f3ec, 0.6);
  const umbrella = std(0xe9e1d2, 0.9, { side: THREE.DoubleSide });
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 1.9), lounger);
    l.position.set(i * 2.4, GY + 0.43, 52.5);
    l.castShadow = l.receiveShadow = true;
    g.add(l);
    if (i % 2 === 0) {
      const u = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 8, 1, true), umbrella);
      u.position.set(i * 2.4 + 1.2, GY + 2.6, 53);
      u.castShadow = true;
      g.add(u);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), std(0x333333, 0.4));
      pole.position.set(i * 2.4 + 1.2, GY + 1.4, 53);
      g.add(pole);
    }
  }

  // xiyabanlar (açıq daş)
  const pathMat = std(0xcac1b2, 0.75);
  const paths = [[0, 30, 6, 40], [-30, 46, 30, 4], [30, 46, 30, 4], [0, 66, 70, 4], [-44, 30, 4, 40], [44, 30, 4, 40]];
  for (const [x, z, w, d] of paths) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), pathMat);
    p.position.set(x, GY + 0.05, z);
    p.receiveShadow = true;
    g.add(p);
  }

  // kollar (yumru, bir az dəyişkən)
  const hedgeGeo = new THREE.IcosahedronGeometry(0.7, 2);
  const hp = hedgeGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const k = 1 + (Math.sin(hp.getX(i) * 9) * Math.cos(hp.getZ(i) * 7)) * 0.08;
    hp.setXYZ(i, hp.getX(i) * k, hp.getY(i) * k * 0.8, hp.getZ(i) * k);
  }
  hedgeGeo.computeVertexNormals();
  const hedges = inst(hedgeGeo, std(0x3f5f2e, 0.95), 400);
  const flowers = inst(new THREE.IcosahedronGeometry(0.3, 1), std(0xd9a441, 0.8), 200);
  for (const [x, z, w, d] of paths) {
    const along = w > d;
    const L = along ? w : d;
    for (let t = -L / 2 + 1; t < L / 2; t += 1.6) {
      for (const side of [-1, 1]) {
        const off = (along ? d : w) / 2 + 0.9;
        const hx = along ? x + t : x + side * off;
        const hz = along ? z + side * off : z + t;
        if (Math.hypot(hx, hz - 46) < 18 && Math.abs(hz - 46) < 9) continue;
        const s = 0.8 + rand() * 0.5;
        put(hedges, hx, GY + 0.35 * s, hz, rand() * 6, s, s, s);
        if (rand() < 0.3) put(flowers, hx + (rand() - 0.5), GY + 0.7 * s, hz + (rand() - 0.5), 0, 1, 1, 1);
      }
    }
  }
  hedges.instanceMatrix.needsUpdate = flowers.instanceMatrix.needsUpdate = true;
  g.add(hedges, flowers);

  // uşaq meydançası (yumşaq örtük + qurğular)
  const pg = new THREE.Group();
  pg.position.set(-30, GY, 30);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 12), std(0x8fa8b8, 0.95));
  mat.position.y = 0.06;
  mat.receiveShadow = true;
  pg.add(mat);
  const colors = [0xe0a24a, 0x4f7fa6, 0xd9d2c4];
  const frame = std(0xf1ede6, 0.5);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 2.2), std(colors[0], 0.6));
  tower.position.set(-2, 1.6, 0);
  pg.add(tower);
  for (const [px, pz] of [[-3, -1], [-1, -1], [-3, 1], [-1, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), frame);
    post.position.set(px, 1.5, pz);
    post.castShadow = true;
    pg.add(post);
  }
  const roofP = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 4), std(colors[1], 0.6));
  roofP.position.set(-2, 3.6, 0);
  roofP.rotation.y = Math.PI / 4;
  roofP.castShadow = true;
  pg.add(roofP);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 3.4), std(colors[0], 0.4));
  slide.position.set(0.4, 0.9, 0);
  slide.rotation.z = 0.55;
  slide.rotation.y = Math.PI / 2;
  pg.add(slide);
  // yelləncək
  for (const px of [3, 6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), frame);
    leg.position.set(px, 1.3, 2);
    pg.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), frame);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(4.5, 2.6, 2);
  pg.add(beam);
  for (const px of [3.9, 5.1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), std(colors[1], 0.5));
    seat.position.set(px, 0.6, 2);
    pg.add(seat);
  }
  pg.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(pg);

  // pergola ilə oturma zonası
  const pe = new THREE.Group();
  pe.position.set(30, GY, 30);
  const wood = std(0x8a6446, 0.7);
  for (const px of [-4, 4]) for (const pz of [-2.5, 2.5]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), wood);
    c.position.set(px, 1.5, pz);
    pe.add(c);
  }
  for (let i = -4; i <= 4; i += 0.6) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 5.6), wood);
    r.position.set(i, 3.05, 0);
    pe.add(r);
  }
  for (const pz of [-2.5, 2.5]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 0.25), wood);
    b.position.set(0, 2.9, pz);
    pe.add(b);
  }
  const deckP = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 6), std(0xb89a78, 0.7));
  deckP.position.y = 0.08;
  pe.add(deckP);
  const sofaMat = std(0xe8e2d6, 0.95);
  for (const px of [-2.2, 2.2]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.9), sofaMat);
    s.position.set(px, 0.38, -1.4);
    pe.add(s);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.2), sofaMat);
    bk.position.set(px, 0.75, -1.8);
    pe.add(bk);
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 24), std(0x2a2a2a, 0.3));
  table.position.set(0, 0.5, 0.2);
  pe.add(table);
  pe.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(pe);

  // yeraltı parkinqə giriş rampası
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 14), std(0x5a5b5e, 0.9));
  ramp.position.set(60, GY - 0.9, 58);
  ramp.rotation.x = 0.14;
  g.add(ramp);
  const rampWall = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 0.3), std(0xd6cdbd, 0.7));
  rampWall.position.set(60, GY + 0.2, 51);
  g.add(rampWall);

  return g;
}

// Kompleksin yerləşmə planı: əsas bina (0,0) mərkəzdədir
export const NEIGHBORS = [
  { id: 2, x: -48, z: 4, rot: Math.PI / 2, w: 26, d: 20, floors: 16 },
  { id: 3, x: 50, z: 2, rot: -Math.PI / 2, w: 26, d: 20, floors: 18 },
  { id: 4, x: -42, z: -52, rot: 0, w: 26, d: 20, floors: 20 },
  { id: 5, x: 6, z: -58, rot: 0, w: 26, d: 20, floors: 17 },
  { id: 6, x: 52, z: -54, rot: 0, w: 26, d: 20, floors: 15 },
  { id: 7, x: -64, z: 96, rot: Math.PI, w: 28, d: 18, floors: 9 },
  { id: 8, x: 64, z: 96, rot: Math.PI, w: 28, d: 18, floors: 10 },
];

/* =========================================================
   Şəhər mühiti: yollar, səkilər, maşınlar, fənərlər, ağ həcmlər
   ========================================================= */
export const ROADS = {
  xs: [-270, -96, 96, 270], // şaquli yollar (x = sabit)
  zs: [-260, -98, 140, 310], // üfüqi yollar (z = sabit)
  w: 14, walk: 5, extent: 520,
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,160,1)');
  gr.addColorStop(0.4, 'rgba(255,190,120,0.35)');
  gr.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(GY = -0.4) {
  const g = new THREE.Group();
  const rand = rng(4242);
  const { xs, zs, w, walk, extent } = ROADS;
  const E = extent;

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2f3134, roughness: 0.92 });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0xa9a49b, roughness: 0.85 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.7 });
  const roads = [], walks = [];
  const bx = (arr, sx, sy, sz, px, py, pz) => { const b = new THREE.BoxGeometry(sx, sy, sz); b.translate(px, py, pz); arr.push(b); };
  for (const x of xs) { bx(roads, w, 0.1, E * 2, x, GY + 0.03, 0); bx(walks, w + walk * 2, 0.22, E * 2, x, GY + 0.06, 0); }
  for (const z of zs) { bx(roads, E * 2, 0.1, w, 0, GY + 0.035, z); bx(walks, E * 2, 0.22, w + walk * 2, 0, GY + 0.065, z); }
  const walkMesh = new THREE.Mesh(mergeGeometries(walks), sidewalk);
  walkMesh.receiveShadow = true;
  const roadMesh = new THREE.Mesh(mergeGeometries(roads), asphalt);
  roadMesh.receiveShadow = true;
  roadMesh.position.y = 0.2;
  g.add(walkMesh, roadMesh);

  // yol nişanları: kəsik mərkəz xətti və piyada keçidləri
  const dash = inst(new THREE.BoxGeometry(0.18, 0.02, 3), paint, 2400);
  dash.castShadow = false;
  const isNear = (v, arr) => arr.some((a) => Math.abs(v - a) < w);
  for (const x of xs) for (let z = -E; z < E; z += 8) if (!isNear(z, zs)) put(dash, x, GY + 0.3, z, 0, 1, 1, 1);
  for (const z of zs) for (let x = -E; x < E; x += 8) if (!isNear(x, xs)) put(dash, x, GY + 0.3, z, Math.PI / 2, 1, 1, 1);
  const zebra = inst(new THREE.BoxGeometry(0.55, 0.02, 4.2), paint, 1200);
  zebra.castShadow = false;
  for (const x of xs) for (const z of zs) {
    for (let k = -w / 2 + 0.6; k < w / 2; k += 1.1) {
      put(zebra, x + k, GY + 0.3, z - w / 2 - 3, 0, 1, 1, 1);
      put(zebra, x + k, GY + 0.3, z + w / 2 + 3, 0, 1, 1, 1);
      put(zebra, x - w / 2 - 3, GY + 0.3, z + k, Math.PI / 2, 1, 1, 1);
      put(zebra, x + w / 2 + 3, GY + 0.3, z + k, Math.PI / 2, 1, 1, 1);
    }
  }
  dash.instanceMatrix.needsUpdate = zebra.instanceMatrix.needsUpdate = true;
  g.add(dash, zebra);

  // maşınlar
  const bodyGeo = new THREE.BoxGeometry(1.85, 0.75, 4.4).translate(0, 0.62, 0);
  const cabGeo = new THREE.BoxGeometry(1.6, 0.6, 2.3).translate(0, 1.25, -0.2);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.9, 10).rotateZ(Math.PI / 2);
  const lightGeo = new THREE.BoxGeometry(1.5, 0.14, 0.06);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.6 });
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.08, metalness: 0.6 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const headMat = Object.assign(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0.3 }), { userData: { nightGlow: 0.3 } });
  const tailMat = Object.assign(new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2a1a, emissiveIntensity: 0.25 }), { userData: { nightGlow: 0.25 } });
  const N = 260;
  const body = inst(bodyGeo, bodyMat, N), cab = inst(cabGeo, cabMat, N), wheels = inst(wheelGeo, tyreMat, N * 2);
  const heads = inst(lightGeo, headMat, N), tails = inst(lightGeo, tailMat, N);
  for (const m of [heads, tails]) m.castShadow = false;
  const palette = [0xf2f2f2, 0x1b1d20, 0x8c9096, 0x2d4a6b, 0x6e1f22, 0xc7c9cc, 0x3b3f44, 0xe0d8c8];
  const col = new THREE.Color();
  const _o = new THREE.Object3D();
  const addCar = (px, pz, ry) => {
    if (body.count >= N) return;
    const idx = body.count;
    _o.position.set(px, GY + 0.25, pz);
    _o.rotation.set(0, ry, 0);
    _o.updateMatrix();
    body.setMatrixAt(idx, _o.matrix);
    cab.setMatrixAt(idx, _o.matrix);
    col.setHex(palette[Math.floor(rand() * palette.length)]);
    body.setColorAt(idx, col);
    body.count++; cab.count++;
    for (const wz of [-1.35, 1.35]) {
      const c = new THREE.Object3D();
      c.position.set(0, 0.34, wz);
      c.updateMatrix();
      wheels.setMatrixAt(wheels.count++, new THREE.Matrix4().multiplyMatrices(_o.matrix, c.matrix));
    }
    const h = new THREE.Object3D(); h.position.set(0, 0.72, 2.21); h.updateMatrix();
    heads.setMatrixAt(heads.count++, new THREE.Matrix4().multiplyMatrices(_o.matrix, h.matrix));
    const t = new THREE.Object3D(); t.position.set(0, 0.8, -2.21); t.updateMatrix();
    tails.setMatrixAt(tails.count++, new THREE.Matrix4().multiplyMatrices(_o.matrix, t.matrix));
  };
  for (const x of xs) {
    for (let z = -E + 10; z < E - 10; z += 9 + rand() * 30) {
      if (isNear(z, zs)) continue;
      const lane = rand() < 0.5 ? -1 : 1;
      addCar(x + lane * 3.4, z, lane > 0 ? 0 : Math.PI);
    }
  }
  for (const z of zs) {
    for (let x = -E + 10; x < E - 10; x += 9 + rand() * 30) {
      if (isNear(x, xs)) continue;
      const lane = rand() < 0.5 ? -1 : 1;
      addCar(x, z + lane * 3.4, lane > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }
  for (const m of [body, cab, wheels, heads, tails]) m.instanceMatrix.needsUpdate = true;
  body.instanceColor.needsUpdate = true;
  g.add(body, cab, wheels, heads, tails);

  // küçə fənərləri + yerə düşən işıq ləkəsi
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.6, roughness: 0.4 });
  const lampMat = Object.assign(new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd49a, emissiveIntensity: 0.3 }), { userData: { nightGlow: 0.3 } });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  poolMat.userData.nightOpacity = 0.4;
  const poles = inst(new THREE.CylinderGeometry(0.08, 0.1, 7, 8).translate(0, 3.5, 0), poleMat, 900);
  const arms = inst(new THREE.BoxGeometry(0.1, 0.1, 1.6).translate(0, 7, 0.7), poleMat, 900);
  const lampHeads = inst(new THREE.BoxGeometry(0.45, 0.14, 0.7).translate(0, 6.93, 1.4), lampMat, 900);
  const pools = inst(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), poolMat, 900);
  pools.castShadow = pools.receiveShadow = false;
  pools.renderOrder = 2;
  const lampAt = (px, pz, ry) => {
    put(poles, px, GY, pz, ry, 1, 1, 1);
    put(arms, px, GY, pz, ry, 1, 1, 1);
    put(lampHeads, px, GY, pz, ry, 1, 1, 1);
    put(pools, px + Math.sin(ry) * 2.2, GY + 0.35, pz + Math.cos(ry) * 2.2, 0, 1, 1, 1);
  };
  const off = w / 2 + 1;
  for (const x of xs) for (let z = -E; z < E; z += 28) { if (isNear(z, zs)) continue; lampAt(x - off, z, Math.PI / 2); lampAt(x + off, z + 14, -Math.PI / 2); }
  for (const z of zs) for (let x = -E; x < E; x += 28) { if (isNear(x, xs)) continue; lampAt(x, z - off, 0); lampAt(x + 14, z + off, Math.PI); }
  for (const m of [poles, arms, lampHeads, pools]) m.instanceMatrix.needsUpdate = true;
  g.add(poles, arms, lampHeads, pools);

  // ətraf məhəllələr: ağ həcmlər (arxitektura maketi üslubu)
  const massMat = cityMaterial();
  const mass = inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), massMat, 700);
  const blockX = [-E, ...xs, E], blockZ = [-E, ...zs, E];
  const parkGround = new THREE.MeshStandardMaterial({ color: 0x5f7a45, roughness: 1 });
  const parks = [], pavs = [];
  for (let i = 0; i < blockX.length - 1; i++) {
    for (let j = 0; j < blockZ.length - 1; j++) {
      const x0 = blockX[i] + w / 2 + walk + 3, x1 = blockX[i + 1] - w / 2 - walk - 3;
      const z0 = blockZ[j] + w / 2 + walk + 3, z1 = blockZ[j + 1] - w / 2 - walk - 3;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (Math.abs(cx) < 90 && cz > -100 && cz < 140) continue; // kompleksin öz məhəlləsi
      if (x1 - x0 < 20 || z1 - z0 < 20) continue;
      if (rand() < 0.14) { bx(parks, x1 - x0, 0.2, z1 - z0, cx, GY + 0.1, cz); continue; }
      bx(pavs, x1 - x0 + 6, 0.16, z1 - z0 + 6, cx, GY + 0.06, cz);
      // məhəllə daxilində perimetr boyunca binalar
      for (let x = x0; x < x1 - 8; ) {
        const bw = 14 + rand() * 22, bd = 12 + rand() * 14, bh = 9 + rand() * 30 * (rand() < 0.2 ? 2 : 1);
        if (x + bw > x1) break;
        mass.setColorAt(mass.count, CITY_COLORS[Math.floor(rand() * CITY_COLORS.length)]);
        put(mass, x + bw / 2, GY, z0 + bd / 2, 0, bw, bh, bd);
        if (z1 - z0 > 50) { mass.setColorAt(mass.count, CITY_COLORS[Math.floor(rand() * CITY_COLORS.length)]); put(mass, x + bw / 2, GY, z1 - bd / 2, 0, bw, 9 + rand() * 30, bd); }
        x += bw + 4 + rand() * 8;
      }
      if (x1 - x0 > 60 && z1 - z0 > 70) {
        mass.setColorAt(mass.count, CITY_COLORS[Math.floor(rand() * CITY_COLORS.length)]);
        put(mass, x0 + 9, GY, cz, 0, 16, 12 + rand() * 20, z1 - z0 - 60);
        mass.setColorAt(mass.count, CITY_COLORS[Math.floor(rand() * CITY_COLORS.length)]);
        put(mass, x1 - 9, GY, cz, 0, 16, 12 + rand() * 20, z1 - z0 - 60);
      }
    }
  }
  mass.instanceMatrix.needsUpdate = true;
  if (mass.instanceColor) mass.instanceColor.needsUpdate = true;
  g.add(mass);
  if (pavs.length) {
    const pv = new THREE.Mesh(mergeGeometries(pavs), new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 }));
    pv.receiveShadow = true;
    g.add(pv);
  }
  if (parks.length) {
    const pm = new THREE.Mesh(mergeGeometries(parks), parkGround);
    pm.receiveShadow = true;
    g.add(pm);
  }
  return g;
}

// Küçə boyunca ağac yerləri (ağaclar building.js-də yaradılır)
export function streetTreeSpots() {
  const { xs, zs, w, extent: E } = ROADS;
  const out = [];
  const off = w / 2 + 3.2;
  const near = (v, arr) => arr.some((a) => Math.abs(v - a) < w + 4);
  const R = 240;
  for (const x of xs) for (let z = -E; z < E; z += 18) if (!near(z, zs)) out.push([x - off, z + 7], [x + off, z]);
  for (const z of zs) for (let x = -E; x < E; x += 18) if (!near(x, xs)) out.push([x + 7, z - off], [x, z + off]);
  return out.filter(([x, z]) => Math.hypot(x, z - 20) < R);
}
