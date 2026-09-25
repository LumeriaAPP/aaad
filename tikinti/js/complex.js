// Yaşayış kompleksi: realistik şüşə (pəncərə arxasında otaq), qonşu binalar və həyət
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
          float on = step(0.58, rh(vRoomSeed + 9.7));
          lit = mix(lit, mix(0.008, lit * (0.45 + 0.5 * s1), on), uNight);
          vec3 warm = mix(vec3(1.3, 0.92, 0.6), vec3(1.15, 1.0, 0.85), step(0.7, s0));
          vec3 lampTint = mix(vec3(1.0), warm, uNight);
          return col * light * lit * lampTint * (1.0 + uNight * 1.6);
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
  m.customProgramCacheKey = () => 'room-glass-v5';
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

export function buildNeighbor(opt, mats) {
  const { w = 26, d = 18, floors = 12, fh = 3.3, ground = 5.2, x = 0, z = 0, rot = 0, style = 0 } = opt;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const H = ground + floors * fh;

  const slabs = [];
  const bal = [];
  const rail = [];
  const sides = [
    { len: w, pos: (t) => [-w / 2 + t, -d / 2 - 0.16], ry: Math.PI, n: 'N' },
    { len: w, pos: (t) => [w / 2 - t, d / 2 + 0.16], ry: 0, n: 'S' },
    { len: d, pos: (t) => [w / 2 + 0.16, -d / 2 + t], ry: Math.PI / 2, n: 'E' },
    { len: d, pos: (t) => [-w / 2 - 0.16, d / 2 - t], ry: -Math.PI / 2, n: 'W' },
  ];
  let panels = 0;
  for (const s of sides) panels += Math.round(s.len / 1.5);
  const glass = inst(new THREE.PlaneGeometry(1, 1), windowMaterial(), panels * floors);
  glass.receiveShadow = false;
  const mull = inst(new THREE.BoxGeometry(0.07, 1, 0.1), mats.mullion, panels * floors);
  const fins = inst(new THREE.BoxGeometry(0.18, 1, 0.8), mats.fin, 200);
  const cladW = style === 1 ? 3 : 0; // 1-ci üslub: künclərdə daş panellər

  for (let f = 0; f < floors; f++) {
    const y0 = ground + f * fh;
    const s = new THREE.BoxGeometry(w + 0.6, 0.32, d + 0.6);
    s.translate(0, y0 - 0.16, 0);
    slabs.push(s);
    const h = fh - 0.32;
    for (const sd of sides) {
      const n = Math.round(sd.len / 1.5), pw = sd.len / n;
      for (let i = 0; i < n; i++) {
        const [px, pz] = sd.pos((i + 0.5) * pw);
        const edge = Math.min(i, n - 1 - i) * pw;
        if (edge < cladW) {
          // daş üzlük paneli
          const c = new THREE.BoxGeometry(pw, h, 0.3);
          c.rotateY(sd.ry);
          c.translate(px, y0 + h / 2, pz);
          slabs.push(c);
        } else {
          put(glass, px, y0 + h / 2, pz, sd.ry, pw, h, 1);
        }
        const [mx, mz] = sd.pos(i * pw);
        put(mull, mx, y0 + h / 2, mz, sd.ry, 1, h, 1);
      }
    }
    // eyvanlar (cənub tərəfdə, növbəli)
    const bw = w * 0.36;
    for (const bx of [-w / 2 + bw / 2 + 0.6, w / 2 - bw / 2 - 0.6]) {
      if ((f + (bx > 0 ? 1 : 0)) % 2 && style === 0) continue;
      const b = new THREE.BoxGeometry(bw, 0.22, 1.8);
      b.translate(bx, y0 - 0.11, d / 2 + 0.9);
      bal.push(b);
      const r = new THREE.BoxGeometry(bw, 1.05, 0.03);
      r.translate(bx, y0 + 0.52, d / 2 + 1.78);
      rail.push(r);
    }
  }
  // şaquli lamellər (cənub və şimal)
  for (let i = 0; i <= Math.round(w / 3); i++) {
    const fx = -w / 2 + i * (w / Math.round(w / 3));
    put(fins, fx, ground + (H - ground) / 2, d / 2 + 0.52, 0, 1, H - ground, 1);
    put(fins, fx, ground + (H - ground) / 2, -d / 2 - 0.52, 0, 1, H - ground, 1);
  }
  // lobbi (1-ci mərtəbə)
  const lobbyGeo = new THREE.BoxGeometry(w - 2, ground - 0.3, d - 2);
  lobbyGeo.translate(0, (ground - 0.3) / 2, 0);
  const lobby = new THREE.Mesh(lobbyGeo, mats.lobby);
  lobby.castShadow = true;
  // dam
  const roof = new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6);
  roof.translate(0, H + 0.6 - 0.3, 0);
  slabs.push(roof);
  const mech = new THREE.BoxGeometry(w * 0.35, 3, d * 0.4);
  mech.translate(0, H + 1.5 + 0.9, 0);
  slabs.push(mech);

  const slabMesh = new THREE.Mesh(mergeGeometries(slabs), mats.stone);
  slabMesh.castShadow = slabMesh.receiveShadow = true;
  const balMesh = new THREE.Mesh(mergeGeometries(bal), mats.slab);
  balMesh.castShadow = balMesh.receiveShadow = true;
  const railMesh = new THREE.Mesh(mergeGeometries(rail), mats.rail);
  railMesh.renderOrder = 2;
  for (const im of [glass, mull, fins]) im.instanceMatrix.needsUpdate = true;
  g.add(slabMesh, balMesh, railMesh, glass, mull, fins, lobby);
  g.userData.height = H;
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
  { x: -62, z: 12, rot: Math.PI / 2, w: 30, d: 18, floors: 12, style: 1 },
  { x: 62, z: 12, rot: -Math.PI / 2, w: 30, d: 18, floors: 14, style: 1 },
  { x: -46, z: -58, rot: 0.25, w: 28, d: 18, floors: 18, style: 0 },
  { x: 48, z: -60, rot: -0.25, w: 28, d: 18, floors: 10, style: 0 },
  { x: -40, z: 118, rot: Math.PI, w: 32, d: 14, floors: 6, style: 1 },
  { x: 40, z: 118, rot: Math.PI, w: 32, d: 14, floors: 7, style: 1 },
];
