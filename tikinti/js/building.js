// Binanın xarici görünüşü, ətraf ərazi və şəhər konteksti
import * as THREE from 'three';
import { BUILDING, floorBaseY, COMPANY } from './data.js';
import { paverTexture } from './textures.js';

const { width: W, depth: D, floorHeight: FH, firstFloor, lastFloor, groundHeight } = BUILDING;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createTowerMaterials() {
  return {
    slab: new THREE.MeshStandardMaterial({ color: 0xebe6de, roughness: 0.65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa9bccb, metalness: 0.92, roughness: 0.035, envMapIntensity: 1.0 }),
    lit: new THREE.MeshStandardMaterial({ color: 0x8699a8, metalness: 0.9, roughness: 0.05, envMapIntensity: 0.9 }),
    mullion: new THREE.MeshStandardMaterial({ color: 0x6d6a66, metalness: 0.8, roughness: 0.35 }),
    fin: new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.55 }),
    led: new THREE.MeshStandardMaterial({ color: 0x9a968f, metalness: 0.8, roughness: 0.3 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x9ec3d6, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a466, metalness: 1, roughness: 0.3 }),
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
function facadeSides() {
  const off = 0.16;
  return [
    { n: 20, len: W, pos: (t) => [-W / 2 + t, -D / 2 - off], ry: Math.PI, side: 'N' },
    { n: 20, len: W, pos: (t) => [W / 2 - t, D / 2 + off], ry: 0, side: 'S' },
    { n: 13, len: D, pos: (t) => [W / 2 + off, -D / 2 + t], ry: Math.PI / 2, side: 'E' },
    { n: 13, len: D, pos: (t) => [-W / 2 - off, D / 2 - t], ry: -Math.PI / 2, side: 'W' },
  ];
}

function buildFloor(f, mats, rand) {
  const g = new THREE.Group();
  g.position.y = floorBaseY(f);
  g.userData.floor = f;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.3, D + 0.7), mats.slab);
  slab.position.y = -0.15;
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);

  const led = new THREE.Mesh(new THREE.BoxGeometry(W + 0.74, 0.035, D + 0.74), mats.led);
  led.position.y = -0.27;
  g.add(led);

  const facade = new THREE.Group();
  facade.userData.facade = true;
  const plane = new THREE.PlaneGeometry(1, 1);
  const glass = inst(plane, mats.glass, 70);
  const lit = inst(plane, mats.lit, 70);
  const mull = inst(new THREE.BoxGeometry(0.07, 1, 0.1), mats.mullion, 80);
  const fins = inst(new THREE.BoxGeometry(0.16, 1, 0.75), mats.fin, 40);
  const h = FH - 0.3;
  for (const s of facadeSides()) {
    const pw = s.len / s.n;
    for (let i = 0; i < s.n; i++) {
      const [x, z] = s.pos((i + 0.5) * pw);
      put(rand() < 0.35 ? lit : glass, x, h / 2, z, s.ry, pw, h, 1);
      const [mx, mz] = s.pos(i * pw);
      put(mull, mx, h / 2, mz, s.ry, 1, h, 1);
      if (i % 2 === 0 && (s.side === 'N' || s.side === 'S')) {
        const out = 0.36;
        const [fx, fz] = s.pos(i * pw);
        const dz = s.side === 'N' ? -out : out;
        put(fins, fx, h / 2 - 0.15, fz + dz, 0, 1, FH, 1);
      }
    }
  }
  for (const m of [glass, lit, mull, fins]) {
    m.instanceMatrix.needsUpdate = true;
    facade.add(m);
  }
  g.add(facade);

  // Eyvanlar (qonaq otaqlarının qarşısında)
  const balc = new THREE.Group();
  const spans = [
    [0.4, 6.4, -1], [23.6, 29.6, -1], [0.4, 5.4, 1], [24.6, 29.6, 1],
  ];
  for (const [x0, x1, dir] of spans) {
    const L = x1 - x0, cx = -W / 2 + (x0 + x1) / 2;
    const zEdge = dir < 0 ? -D / 2 : D / 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(L, 0.22, 1.7), mats.slab);
    s.position.set(cx, -0.11, zEdge + dir * 0.85);
    s.castShadow = s.receiveShadow = true;
    balc.add(s);
    const r = new THREE.Mesh(new THREE.BoxGeometry(L, 1.05, 0.03), mats.rail);
    r.position.set(cx, 0.52, zEdge + dir * 1.68);
    r.renderOrder = 2;
    balc.add(r);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.08), mats.gold);
    hr.position.set(cx, 1.06, zEdge + dir * 1.68);
    balc.add(hr);
  }
  g.add(balc);

  // Seçmə üçün görünməz həcm
  const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 1, FH, D + 1), new THREE.MeshBasicMaterial({ visible: false }));
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

function buildLobby(mats) {
  const g = new THREE.Group();
  const h = groundHeight - 0.3;
  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(W - 2.4, h, D - 2.4),
    new THREE.MeshStandardMaterial({ color: 0x6b5a48, emissive: 0xffcf96, emissiveIntensity: 0.22, roughness: 0.8 })
  );
  inner.position.y = h / 2;
  g.add(inner);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(W - 2.2, h, D - 2.2),
    new THREE.MeshStandardMaterial({ color: 0x223040, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.55 })
  );
  glass.position.y = h / 2;
  g.add(glass);
  const colGeo = new THREE.BoxGeometry(0.6, h, 0.6);
  for (let i = 0; i <= 5; i++) {
    for (const z of [-D / 2 + 0.2, D / 2 - 0.2]) {
      const c = new THREE.Mesh(colGeo, mats.fin);
      c.position.set(-W / 2 + 0.2 + (i * (W - 0.4)) / 5, h / 2, z);
      c.castShadow = true;
      g.add(c);
    }
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.4, D + 0.7), mats.slab);
  slab.position.y = 0.2 - 0.4;
  g.add(slab);
  // giriş kozırkı
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 5), mats.slab);
  canopy.position.set(0, 4.3, D / 2 + 2.3);
  canopy.castShadow = true;
  g.add(canopy);
  const underside = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 4.6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9c7ab, emissive: 0xffe0b0, emissiveIntensity: 0.25 }));
  underside.position.set(0, 4.12, D / 2 + 2.3);
  g.add(underside);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshBasicMaterial({ map: signTexture(COMPANY.project.toUpperCase()), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
  sign.position.set(0, 4.95, D / 2 + 4.82);
  g.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5 }));
  signBack.position.set(0, 4.95, D / 2 + 4.76);
  g.add(signBack);
  return g;
}

function buildRoof(mats) {
  const g = new THREE.Group();
  g.position.y = floorBaseY(lastFloor + 1);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.4, D + 0.7), mats.slab);
  slab.position.y = -0.2;
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  const led = new THREE.Mesh(new THREE.BoxGeometry(W + 0.74, 0.035, D + 0.74), mats.led);
  led.position.y = -0.37;
  g.add(led);
  // şüşə parapet
  const para = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, D), mats.rail);
  para.position.y = 0.6;
  g.add(para);
  // tac: fasad lamelləri yuxarı davam edir
  const crownH = 7;
  const fins = inst(new THREE.BoxGeometry(0.16, crownH, 0.75), mats.fin, 60);
  for (let i = 0; i <= 20; i += 2) {
    put(fins, -W / 2 + i * 1.5, crownH / 2, -D / 2 - 0.52, 0, 1, 1, 1);
    put(fins, -W / 2 + i * 1.5, crownH / 2, D / 2 + 0.52, 0, 1, 1, 1);
  }
  fins.instanceMatrix.needsUpdate = true;
  g.add(fins);
  const ringGeo = new THREE.BoxGeometry(W + 1.4, 0.5, 0.9);
  for (const z of [-D / 2 - 0.52, D / 2 + 0.52]) {
    const r = new THREE.Mesh(ringGeo, mats.fin);
    r.position.set(0, crownH - 0.25, z);
    g.add(r);
    const l = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.06, 0.92), mats.led);
    l.position.set(0, crownH - 0.52, z);
    g.add(l);
  }
  const mech = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 7), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.3 }));
  mech.position.set(0, 2, -2);
  mech.castShadow = true;
  g.add(mech);
  // dam bağı
  const grass = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x4d6b3a, roughness: 1 }));
  grass.position.set(-9, 0.15, 5);
  g.add(grass);
  const grass2 = grass.clone();
  grass2.position.x = 9;
  g.add(grass2);
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
  const hlGeo = new THREE.BoxGeometry(W + 1.2, FH, D + 1.2);
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
  pav.repeat.set(96 / 4, 76 / 4);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 76).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: pav, alphaMap: edgeFade(256, 0.72), transparent: true, roughness: 0.85, depthWrite: false })
  );
  plaza.position.set(0, GY + 0.02, 6);
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

  // Hovuz
  const poolEdge = new THREE.Mesh(new THREE.BoxGeometry(19, 0.3, 6.4), new THREE.MeshStandardMaterial({ color: 0xece6db, roughness: 0.55 }));
  poolEdge.position.set(0, GY + 0.15, 25);
  poolEdge.receiveShadow = true;
  g.add(poolEdge);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 5.4).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x3aa6c4, roughness: 0.02, metalness: 0, transmission: 0, clearcoat: 1, envMapIntensity: 1.4 })
  );
  water.position.set(0, GY + 0.31, 25);
  g.add(water);
  // şezlonqlar
  const lounger = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 1.9), lounger);
    l.position.set(i * 2.6, GY + 0.27, 30.2);
    l.rotation.x = -0.08;
    l.castShadow = l.receiveShadow = true;
    g.add(l);
  }

  // Fənərlər
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.7, roughness: 0.35 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, emissive: 0xfff0d0, emissiveIntensity: 0.4 });
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

  return g;
}

// Realistik ağaclar (EZ-Tree kitabxanası ilə yaradılır)
export async function buildTrees(onDone, keepClear = []) {
  const { Tree } = await import('../vendor/ez-tree/ez-tree.es.js');
  const GY = -0.4;
  const variants = [];
  const presets = [['Ash Medium', 12], ['Oak Medium', 10], ['Aspen Medium', 13], ['Ash Small', 8]];
  presets.forEach(([name, height], i) => {
    const t = new Tree();
    t.loadPreset(name);
    t.options.seed = 1000 + i * 77;
    t.generate();
    t.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(t);
    const s = height / (box.max.y - box.min.y);
    t.scale.setScalar(s);
    t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    variants.push(t);
  });
  const rand = rng(77);
  const group = new THREE.Group();
  const spots = [];
  // meydanın kənarları boyunca xiyaban
  for (let x = -42; x <= 42; x += 12) spots.push([x, 44], [x + 6, -34]);
  for (let z = -22; z <= 36; z += 14) spots.push([-50, z], [50, z]);
  // ətraf çəmənlikdə təsadüfi ağaclar
  const avoid = (x, z) => keepClear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 28);
  for (let i = 0; i < 60 && spots.length < 70; i++) {
    const a = rand() * Math.PI * 2, r = 70 + rand() * 110;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 6;
    if (!avoid(x, z)) spots.push([x, z]);
  }
  spots.forEach(([x, z], i) => {
    const v = variants[i % variants.length];
    const t = new THREE.Group();
    for (const ch of v.children) t.add(ch.clone());
    t.scale.copy(v.scale);
    t.position.set(x + (rand() - 0.5) * 2, GY, z + (rand() - 0.5) * 2);
    t.rotation.y = rand() * Math.PI * 2;
    t.scale.multiplyScalar(0.85 + rand() * 0.3);
    group.add(t);
  });
  onDone(group);
}
