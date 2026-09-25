// Binanın xarici görünüşü, ətraf ərazi və şəhər konteksti
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING, floorBaseY, COMPANY } from './data.js';
import { paverTexture } from './textures.js';
import { buildBaku } from './baku.js';
import { windowMaterial, buildNeighbor, buildCourtyard, buildCity, streetTreeSpots, facadeMats, NEIGHBORS } from './complex.js';

const { width: W, depth: D, floorHeight: FH, firstFloor, lastFloor, groundHeight } = BUILDING;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createTowerMaterials() {
  const white = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.45 });
  return {
    slab: white,
    white,
    glass: windowMaterial(),
    lit: windowMaterial(),
    mullion: new THREE.MeshStandardMaterial({ color: 0x3a3d41, metalness: 0.6, roughness: 0.35 }),
    fin: white,
    led: white,
    rail: new THREE.MeshStandardMaterial({ color: 0xa9c0cc, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.3, depthWrite: false }),
    railTop: new THREE.MeshStandardMaterial({ color: 0x2f3236, metalness: 0.6, roughness: 0.4 }),
    gold: new THREE.MeshStandardMaterial({ color: 0x4a3526, metalness: 0.55, roughness: 0.45 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd9ccb4, roughness: 0.7 }),
    lobby: Object.assign(new THREE.MeshStandardMaterial({ color: 0x3c3a36, emissive: 0xffd6a0, emissiveIntensity: 0.12, roughness: 0.3, metalness: 0.4 }), { userData: { nightGlow: 0.12 } }),
    shop: Object.assign(new THREE.MeshStandardMaterial({ color: 0x2c2823, emissive: 0xffc07e, emissiveIntensity: 0.1, roughness: 0.35 }), { userData: { nightGlow: 0.1 } }),
    shopGlass: new THREE.MeshStandardMaterial({ color: 0x9fb3bf, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.25, depthWrite: false }),
    ledStrip: Object.assign(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0b0, emissiveIntensity: 0.2 }), { userData: { nightGlow: 0.2 } }),
    planter: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8 }),
    green: new THREE.MeshStandardMaterial({ color: 0x3f6a33, roughness: 0.9, flatShading: true }),
  };
}

function inst(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = true;
  m.receiveShadow = true;
  m.count = 0;
  return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function put(im, x, y, z, ry, sx, sy, sz) {
  _q.setFromEuler(_e.set(0, ry, 0));
  im.setMatrixAt(im.count++, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
}

// Fasadın bir tərəfi üzrə panelləri gəz
const BAL = 1.9; // eyvan zolağının eni
function facadeSides() {
  const off = 0.14;
  return [
    { n: 20, len: W, pos: (t) => [-W / 2 + t, -D / 2 - off], ry: Math.PI, side: 'N' },
    { n: 20, len: W, pos: (t) => [W / 2 - t, D / 2 + off], ry: 0, side: 'S' },
    { n: 13, len: D, pos: (t) => [W / 2 + off, -D / 2 + t], ry: Math.PI / 2, side: 'E' },
    { n: 13, len: D, pos: (t) => [-W / 2 - off, D / 2 - t], ry: -Math.PI / 2, side: 'W' },
  ];
}

// Ümumi həndəsələr (bütün mərtəbələr paylaşır)
let TG = null;
function towerGeos() {
  if (TG) return TG;
  const bw = W + BAL * 2, bd = D + BAL * 2;
  const slab = new RoundedBoxGeometry(bw, 0.32, bd, 3, 0.9);
  slab.translate(0, -0.16, 0);
  // şüşə məhəccər: yumru küncləri olan zolaq (4 düz hissə)
  const railParts = [], topParts = [];
  const rh = 1.08, inset = 0.08;
  const sides = [
    [bw - 1.8, 0, -bd / 2 + inset, 0], [bw - 1.8, 0, bd / 2 - inset, 0],
    [bd - 1.8, -bw / 2 + inset, 0, Math.PI / 2], [bd - 1.8, bw / 2 - inset, 0, Math.PI / 2],
  ];
  for (const [len, x, z, ry] of sides) {
    const g = new THREE.BoxGeometry(len, rh, 0.025);
    g.rotateY(ry);
    g.translate(x, rh / 2, z);
    railParts.push(g);
    const t = new THREE.BoxGeometry(len, 0.05, 0.06);
    t.rotateY(ry);
    t.translate(x, rh, z);
    topParts.push(t);
  }
  // küncdə əyri məhəccər
  for (const [cx, cz, a0] of [[bw / 2 - 0.9, bd / 2 - 0.9, 0], [-bw / 2 + 0.9, bd / 2 - 0.9, Math.PI / 2], [-bw / 2 + 0.9, -bd / 2 + 0.9, Math.PI], [bw / 2 - 0.9, -bd / 2 + 0.9, -Math.PI / 2]]) {
    const c = new THREE.CylinderGeometry(0.9 - inset, 0.9 - inset, rh, 10, 1, true, a0 + Math.PI / 2, Math.PI / 2);
    c.translate(cx, rh / 2, cz);
    railParts.push(c);
  }
  // mənzillər arasında eyvan arakəsmələri
  const divs = [];
  for (const x of [-4, 4]) { const g = new THREE.BoxGeometry(0.12, FH - 0.32, BAL); g.translate(x, (FH - 0.32) / 2, -D / 2 - BAL / 2); divs.push(g); }
  for (const x of [-3, 3]) { const g = new THREE.BoxGeometry(0.12, FH - 0.32, BAL); g.translate(x, (FH - 0.32) / 2, D / 2 + BAL / 2); divs.push(g); }
  TG = {
    slab,
    rail: mergeGeometries(railParts.map((g) => g.index ? g.toNonIndexed() : g)),
    railTop: mergeGeometries(topParts),
    divs: mergeGeometries(divs),
    ceiling: (() => { const g = new THREE.PlaneGeometry(bw - 0.4, bd - 0.4).rotateX(Math.PI / 2); g.translate(0, FH - 0.33, 0); return g; })(),
  };
  return TG;
}

function buildFloor(f, mats, rand) {
  const g = new THREE.Group();
  g.position.y = floorBaseY(f);
  g.userData.floor = f;
  const G = towerGeos();

  const slab = new THREE.Mesh(G.slab, mats.white);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  const rail = new THREE.Mesh(G.rail, mats.rail);
  rail.renderOrder = 2;
  g.add(rail);
  const railTop = new THREE.Mesh(G.railTop, mats.railTop);
  g.add(railTop);
  const divs = new THREE.Mesh(G.divs, mats.white);
  divs.castShadow = divs.receiveShadow = true;
  g.add(divs);

  const facade = new THREE.Group();
  facade.userData.facade = true;
  const plane = new THREE.PlaneGeometry(1, 1);
  const glass = inst(plane, mats.glass, 70);
  const mull = inst(new THREE.BoxGeometry(0.06, 1, 0.1), mats.mullion, 80);
  glass.receiveShadow = false;
  const h = FH - 0.32;
  for (const s of facadeSides()) {
    const pw = s.len / s.n;
    for (let i = 0; i < s.n; i++) {
      const [x, z] = s.pos((i + 0.5) * pw);
      put(glass, x, h / 2, z, s.ry, pw, h, 1);
      const [mx, mz] = s.pos(i * pw);
      put(mull, mx, h / 2, mz, s.ry, 1, h, 1);
    }
  }
  for (const m of [glass, mull]) {
    m.instanceMatrix.needsUpdate = true;
    facade.add(m);
  }
  g.add(facade);
  void rand;

  // Seçmə üçün görünməz həcm
  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + BAL * 2 + 0.4, FH, D + BAL * 2 + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = FH / 2 - 0.3;
  hit.userData.floor = f;
  g.add(hit);

  return { group: g, facade, hit, f, baseY: floorBaseY(f) };
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffe3b5';
  x.font = '600 78px "Playfair Display", Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.letterSpacing = '18px';
  x.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Podium: 2 mərtəbəli mağazalar + kənara çıxan ağ dam + terras
const PW = 50, PD = 40;
function buildLobby(mats) {
  const g = new THREE.Group();
  const H = groundHeight - 0.3; // podiumun daxili hündürlüyü
  // mağazaların işıqlı interyeri
  const inner = new THREE.Mesh(new THREE.BoxGeometry(PW - 5, H, PD - 5), mats.shop);
  inner.position.y = H / 2;
  g.add(inner);
  // şüşə vitrinlər + şaquli profillər
  const glass = new THREE.Mesh(new THREE.BoxGeometry(PW - 4.6, H, PD - 4.6), mats.shopGlass);
  glass.position.y = H / 2;
  glass.renderOrder = 2;
  g.add(glass);
  const mull = inst(new THREE.BoxGeometry(0.12, H, 0.18), mats.mullion, 120);
  for (let x = -(PW - 4.6) / 2; x <= (PW - 4.6) / 2 + 0.01; x += (PW - 4.6) / 15) { put(mull, x, H / 2, (PD - 4.6) / 2, 0, 1, 1, 1); put(mull, x, H / 2, -(PD - 4.6) / 2, 0, 1, 1, 1); }
  for (let z = -(PD - 4.6) / 2; z <= (PD - 4.6) / 2 + 0.01; z += (PD - 4.6) / 12) { put(mull, (PW - 4.6) / 2, H / 2, z, 0, 1, 1, 1); put(mull, -(PW - 4.6) / 2, H / 2, z, 0, 1, 1, 1); }
  mull.instanceMatrix.needsUpdate = true;
  g.add(mull);
  // ara mərtəbə zolağı
  const mid = new THREE.Mesh(new RoundedBoxGeometry(PW - 3.6, 0.45, PD - 3.6, 2, 0.4), mats.white);
  mid.position.y = H * 0.5;
  mid.castShadow = true;
  g.add(mid);
  // kənara çıxan ağ dam
  const roof = new THREE.Mesh(new RoundedBoxGeometry(PW, 1.1, PD, 3, 0.5), mats.white);
  roof.position.y = H + 0.55;
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);
  const under = new THREE.Mesh(new THREE.BoxGeometry(PW - 1.2, 0.04, PD - 1.2), mats.ledStrip);
  under.position.y = H - 0.01;
  g.add(under);
  // terras: şüşə məhəccər, planterlər, kollar
  const railG = [];
  for (const [len, x, z, ry] of [[PW - 1, 0, PD / 2 - 0.3, 0], [PW - 1, 0, -PD / 2 + 0.3, 0], [PD - 1, PW / 2 - 0.3, 0, Math.PI / 2], [PD - 1, -PW / 2 + 0.3, 0, Math.PI / 2]]) {
    const b = new THREE.BoxGeometry(len, 1.1, 0.03);
    b.rotateY(ry);
    b.translate(x, H + 1.1 + 0.55, z);
    railG.push(b);
  }
  const rail = new THREE.Mesh(mergeGeometries(railG), mats.rail);
  rail.renderOrder = 2;
  g.add(rail);
  const planters = inst(new THREE.BoxGeometry(3, 0.7, 1), mats.planter, 40);
  const bushes = inst(new THREE.IcosahedronGeometry(0.6, 1), mats.green, 200);
  const spots = [];
  for (let x = -PW / 2 + 3; x <= PW / 2 - 3; x += 5) spots.push([x, PD / 2 - 1.3, 0], [x, -PD / 2 + 1.3, 0]);
  for (let z = -PD / 2 + 5; z <= PD / 2 - 5; z += 5) spots.push([PW / 2 - 1.3, z, Math.PI / 2], [-PW / 2 + 1.3, z, Math.PI / 2]);
  let k = 0;
  for (const [x, z, ry] of spots) {
    if (Math.abs(x) < W / 2 + BAL + 1 && Math.abs(z) < D / 2 + BAL + 1) continue;
    put(planters, x, H + 1.1 + 0.35, z, ry, 1, 1, 1);
    for (let j = -1; j <= 1; j++) {
      const dx = ry ? 0 : j * 0.9, dz = ry ? j * 0.9 : 0;
      put(bushes, x + dx, H + 1.1 + 0.9, z + dz, k++, 0.8 + (k % 3) * 0.15, 0.7, 0.8 + (k % 2) * 0.2);
    }
  }
  planters.instanceMatrix.needsUpdate = bushes.instanceMatrix.needsUpdate = true;
  g.add(planters, bushes);
  // giriş lövhəsi
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshBasicMaterial({ map: signTexture(COMPANY.project.toUpperCase()), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
  sign.position.set(0, H + 0.55, PD / 2 + 0.02);
  g.add(sign);
  // plintus
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.4, 0.4, PD + 0.4), new THREE.MeshStandardMaterial({ color: 0x9c9a95, roughness: 0.8 }));
  plinth.position.y = -0.2;
  plinth.receiveShadow = true;
  g.add(plinth);
  return g;
}

function buildRoof(mats) {
  const g = new THREE.Group();
  g.position.y = floorBaseY(lastFloor + 1);
  const G = towerGeos();
  const slab = new THREE.Mesh(G.slab, mats.white);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  const rail = new THREE.Mesh(G.rail, mats.rail);
  rail.renderOrder = 2;
  g.add(rail);
  g.add(new THREE.Mesh(G.railTop, mats.railTop));
  // dam: texniki blok (ağ lamellərlə örtülü) + nazik tac
  const mech = new THREE.Mesh(new RoundedBoxGeometry(W * 0.55, 4.2, D * 0.6, 2, 0.3), mats.white);
  mech.position.set(0, 2.1, 0);
  mech.castShadow = true;
  g.add(mech);
  const louv = inst(new THREE.BoxGeometry(0.08, 3.6, 0.3), mats.mullion, 120);
  for (let x = -W * 0.26; x <= W * 0.26; x += 0.5) { put(louv, x, 2.1, D * 0.3 + 0.05, 0, 1, 1, 1); put(louv, x, 2.1, -D * 0.3 - 0.05, 0, 1, 1, 1); }
  louv.instanceMatrix.needsUpdate = true;
  g.add(louv);
  const cap = new THREE.Mesh(new RoundedBoxGeometry(W + BAL * 2 + 0.4, 0.6, D + BAL * 2 + 0.4, 3, 0.95), mats.white);
  cap.position.y = FH + 0.2;
  cap.castShadow = true;
  // nazik sütunlar tacı daşıyır
  const cols = inst(new THREE.CylinderGeometry(0.12, 0.12, FH, 8), mats.white, 20);
  for (const [x, z] of [[-W / 2 - BAL + 0.6, -D / 2 - BAL + 0.6], [W / 2 + BAL - 0.6, -D / 2 - BAL + 0.6], [-W / 2 - BAL + 0.6, D / 2 + BAL - 0.6], [W / 2 + BAL - 0.6, D / 2 + BAL - 0.6], [0, D / 2 + BAL - 0.4], [0, -D / 2 - BAL + 0.4]]) put(cols, x, FH / 2, z, 0, 1, 1, 1);
  cols.instanceMatrix.needsUpdate = true;
  g.add(cap, cols);
  return g;
}

export function buildTower() {
  const mats = createTowerMaterials();
  const rand = rng(99);
  const root = new THREE.Group();
  const floors = new Map();
  for (let f = firstFloor; f <= lastFloor; f++) {
    const fl = buildFloor(f, mats, rand);
    floors.set(f, fl);
    root.add(fl.group);
  }
  const lobby = buildLobby(mats);
  root.add(lobby);
  const roof = buildRoof(mats);
  root.add(roof);

  // Seçilmiş mərtəbənin işıqlanması
  const hlGeo = new THREE.BoxGeometry(W + BAL * 2 + 0.8, FH, D + BAL * 2 + 0.8);
  const highlight = new THREE.Group();
  const hlMesh = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({ color: 0xd8b26e, transparent: true, opacity: 0.22, depthWrite: false }));
  const hlEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hlGeo), new THREE.LineBasicMaterial({ color: 0xffe2a8 }));
  highlight.add(hlMesh, hlEdges);
  highlight.visible = false;
  root.add(highlight);

  return {
    root,
    floors,
    roof,
    lobby,
    mats,
    highlight,
    showHighlight(f) {
      if (!f) { highlight.visible = false; return; }
      highlight.visible = true;
      highlight.position.y = floorBaseY(f) + FH / 2 - 0.3;
    },
  };
}

// Meydanın kənarlarını foto-torpaqla yumşaq birləşdirmək üçün alfa xəritə
function edgeFade(size = 256, inner = 0.78) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x / (size - 1) - 0.5) * 2, dy = Math.abs(y / (size - 1) - 0.5) * 2;
      const d = Math.pow(Math.pow(dx, 6) + Math.pow(dy, 6), 1 / 6);
      const a = d < inner ? 1 : Math.max(0, 1 - (d - inner) / (1 - inner));
      const v = Math.round(255 * a * a * (3 - 2 * a));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

export function buildSurroundings() {
  const g = new THREE.Group();
  const GY = -0.4; // yer səviyyəsi

  // Çəmənlik (real foto-tekstura) + iri miqyaslı rəng dəyişkənliyi
  const grassTex = new THREE.TextureLoader().load('assets/textures/grass.jpg');
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = 8;
  const R = 2600;
  const groundGeo = new THREE.PlaneGeometry(R * 2, R * 2, 160, 160).rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position, guv = groundGeo.attributes.uv;
  const cols = new Float32Array(gp.count * 3);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    guv.setXY(i, x / 7, z / 7);
    const n = 0.5 + 0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) + 0.25 * Math.sin(z * 0.017 + Math.cos(x * 0.011) * 3);
    const k = 0.78 + n * 0.32;
    cols[i * 3] = k * 1.02; cols[i * 3 + 1] = k; cols[i * 3 + 2] = k * 0.9;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 1, color: 0xd8e0c8 }));
  ground.position.y = GY;
  ground.receiveShadow = true;
  g.add(ground);

  // Səki daşı meydan (kənarları yumşaq)
  const pav = paverTexture();
  pav.repeat.set(190 / 4, 190 / 4);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: pav, alphaMap: edgeFade(256, 0.72), transparent: true, roughness: 0.85, depthWrite: false })
  );
  plaza.position.set(0, GY + 0.02, 28);
  plaza.receiveShadow = true;
  plaza.renderOrder = -0.5;
  g.add(plaza);

  // Bina ətrafında daha açıq rəngli daş zolaq
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(W + 10, 0.12, D + 10),
    new THREE.MeshStandardMaterial({ color: 0xcfc8bc, roughness: 0.7 })
  );
  stone.position.set(0, GY + 0.06, 0);
  stone.receiveShadow = true;
  g.add(stone);

  // Fənərlər
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.7, roughness: 0.35 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, emissive: 0xffd9a0, emissiveIntensity: 0.4 });
  lampMat.userData.nightGlow = 0.4;
  const poles = inst(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 10), poleMat, 30);
  const heads = inst(new THREE.BoxGeometry(0.22, 0.5, 0.22), lampMat, 30);
  const lampSpots = [];
  for (let x = -40; x <= 40; x += 10) lampSpots.push([x, 38], [x, -28]);
  for (let z = -18; z <= 30; z += 12) lampSpots.push([-44, z], [44, z]);
  for (const [x, z] of lampSpots) {
    put(poles, x, GY + 2.1, z, 0, 1, 1, 1);
    put(heads, x, GY + 4.4, z, 0, 1, 1, 1);
  }
  poles.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  g.add(poles, heads);

  // Skamyalar
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 });
  const benches = inst(new THREE.BoxGeometry(2.0, 0.45, 0.55), benchMat, 20);
  for (const [x, z] of [[-30, 36], [-15, 36], [15, 36], [30, 36], [-30, -26], [30, -26]]) put(benches, x, GY + 0.22, z, 0, 1, 1, 1);
  benches.instanceMatrix.needsUpdate = true;
  g.add(benches);

  // Kompleksin digər binaları və həyəti
  const tmats = createTowerMaterials();
  for (const n of NEIGHBORS) g.add(buildNeighbor(n));
  void tmats;
  g.add(buildCourtyard(GY));
  g.add(buildCity(GY));
  g.add(buildBaku(GY));

  return g;
}

// Realistik ağaclar (EZ-Tree kitabxanası ilə yaradılır)
export async function buildTrees(onDone, keepClear = []) {
  const { Tree } = await import('../vendor/ez-tree/ez-tree.es.js');
  const GY = -0.4;
  const variants = [];
  const presets = [['Ash Medium', 10], ['Oak Medium', 9], ['Aspen Medium', 11], ['Ash Small', 7]];
  presets.forEach(([name, height], i) => {
    const t = new Tree();
    t.loadPreset(name);
    t.options.seed = 1000 + i * 77;
    // performans: yarpaq sayını azalt (uzaqdan fərq görünmür)
    t.options.leaves.count = Math.max(4, Math.round(t.options.leaves.count * 0.55));
    t.generate();
    t.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(t);
    // hündürlük və tac eni ilə məhdudlaşdır (bəzi variantlar çox enli olur)
    const s = Math.min(height / (box.max.y - box.min.y), (height * 0.8) / Math.max(box.max.x - box.min.x, box.max.z - box.min.z));
    t.scale.setScalar(s);
    t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    variants.push(t);
  });
  const rand = rng(77);
  const group = new THREE.Group();
  const spots = [];
  // həyət xiyabanları
  for (let x = -54; x <= 54; x += 12) spots.push([x, 72], [x + 6, -30]);
  for (let z = -10; z <= 60; z += 12) spots.push([-22, z], [22, z]);
  for (const [x, z] of [[-14, 36], [14, 36], [-14, 56], [14, 56], [-38, 60], [38, 60]]) spots.push([x, z]);
  const avoid = (x, z) =>
    keepClear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 22) ||
    NEIGHBORS.some((n) => Math.hypot(x - n.x, z - n.z) < Math.max(n.w, n.d) * 0.72) ||
    (Math.abs(x) < 20 && Math.abs(z - 46) < 12) || (Math.abs(x) < 28 && Math.abs(z) < 23);
  for (const sp of spots.splice(0)) if (!avoid(sp[0], sp[1])) spots.push(sp);
  // kompleksin kənarlarında təsadüfi ağaclar
  for (let i = 0; i < 400 && spots.length < 110; i++) {
    const x = (rand() - 0.5) * 170, z = -88 + rand() * 220;
    if (!avoid(x, z)) spots.push([x, z]);
  }
  const nearCount = spots.length;
  // küçə ağacları
  const lowEnd = matchMedia('(hover: none)').matches;
  streetTreeSpots().forEach((sp, i) => { if ((!lowEnd || i % 3 === 0) && !keepClear.some(([cx, cz]) => Math.hypot(sp[0] - cx, sp[1] - cz) < 26)) spots.push(sp); });

  let triCount = 0;
  // hər variant üçün InstancedMesh (az draw call)
  const buckets = variants.map(() => []);
  const farBuckets = variants.map(() => []);
  spots.forEach(([x, z], i) => (i < nearCount ? buckets : farBuckets)[i % variants.length].push([x + (rand() - 0.5) * 2, z + (rand() - 0.5) * 2, rand() * Math.PI * 2, 0.8 + rand() * 0.35]));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const farGroup = new THREE.Group();
  farGroup.userData.streetTrees = true;
  group.add(farGroup);
  const matCache = new Map();
  for (const [bk, target] of [[buckets, group], [farBuckets, farGroup]]) {
    variants.forEach((v, vi) => {
      const list = bk[vi];
      if (!list.length) return;
      for (const ch of v.children) {
        if (!ch.isMesh || !ch.geometry.attributes.position || ch.geometry.attributes.position.count === 0) continue;
        // EZ-Tree yarpaq materialının külək şeyderi instancing-i dəstəkləmir — standart materialla əvəz et
        const src = ch.material;
        if (!matCache.has(src)) {
          matCache.set(src, src.onBeforeCompile && src.onBeforeCompile.toString().length > 30
            ? new THREE.MeshStandardMaterial({ map: src.map, color: src.color, alphaTest: src.alphaTest || 0.5, side: src.side, transparent: false, roughness: 0.85 })
            : src);
        }
        const im = new THREE.InstancedMesh(ch.geometry, matCache.get(src), list.length);
        im.castShadow = true;
        im.receiveShadow = true;
        list.forEach(([x, z, r, k], i) => {
          q.setFromAxisAngle(up, r);
          im.setMatrixAt(i, m4.compose(ps.set(x, GY, z), q, sc.setScalar(v.scale.x * k)).multiply(ch.matrix));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        target.add(im);
        triCount += (ch.geometry.index ? ch.geometry.index.count : ch.geometry.attributes.position.count) / 3 * list.length;
      }
    });
  }
  console.info('Ağaclar:', spots.length, 'üçbucaq:', Math.round(triCount));
  onDone(group);
}
