// Prosedur mebel. Hər əşyanın arxası -z, ön tərəfi +z istiqamətindədir.
// Mərkəz (0, 0) — əşyanın döşəmədəki izinin ortası.
import * as THREE from 'three';
import { marbleTexture } from './textures.js';
import { rugMaterial } from './decor.js';

let M = null;

export function furnitureMaterials() {
  if (M) return M;
  const std = (color, roughness = 0.7, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const stone = marbleTexture([238, 236, 232], [120, 118, 116]);
  stone.repeat.set(0.6, 0.6);
  M = {
    fabric: std(0x8d8a86, 0.95),
    fabricDark: std(0x4a4f57, 0.95),
    linen: std(0xf2efe9, 0.95),
    throw: std(0xb88a64, 0.95),
    pillow: std(0xd9cbb8, 0.95),
    woodDark: std(0x4b3527, 0.6),
    woodLight: std(0xc39b72, 0.55),
    oak: std(0xa7825d, 0.6),
    white: std(0xf4f3f0, 0.35),
    gloss: std(0xf7f7f5, 0.18),
    black: std(0x1d1e21, 0.5, 0.3),
    screen: std(0x050608, 0.08, 0.6),
    metal: std(0xb7b4ae, 0.3, 0.9),
    gold: std(0xc7a567, 0.3, 1),
    steel: std(0xc9ccd0, 0.25, 0.85),
    stone: std(0xffffff, 0.22, 0, { map: stone }),
    ceramic: std(0xffffff, 0.12),
    plant: std(0x3e6b35, 0.8, 0, { flatShading: true }),
    plant2: std(0x557f3f, 0.8, 0, { flatShading: true }),
    pot: std(0xd7cfc2, 0.8),
    mirror: std(0xdfe6ea, 0.02, 1),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.6 }),
    shade: std(0xe9e2d6, 0.9, 0, { side: THREE.DoubleSide }),
    book: [std(0x7c4b3a, 0.8), std(0x2f4a5c, 0.8), std(0xc9b48a, 0.8), std(0x6b7b5a, 0.8), std(0x9a9a9a, 0.8)],
    art: [std(0xc98b5e, 0.9), std(0x33485c, 0.9), std(0xdad2c4, 0.9)],
  };
  return M;
}

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

function box(g, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function cyl(g, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function legs(g, w, d, h, mat, inset = 0.06, r = 0.022) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, r, r, h, mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 8);
}

const B = {
  sofa(g) {
    box(g, 2.2, 0.1, 0.95, M.black, 0, 0.06, 0);
    box(g, 2.2, 0.3, 0.95, M.fabric, 0, 0.14, 0);
    box(g, 2.2, 0.5, 0.22, M.fabric, 0, 0.3, -0.37);
    box(g, 0.2, 0.3, 0.95, M.fabric, -1.0, 0.44, 0);
    box(g, 0.2, 0.3, 0.95, M.fabric, 1.0, 0.44, 0);
    box(g, 0.88, 0.14, 0.7, M.fabric, -0.45, 0.44, 0.1);
    box(g, 0.88, 0.14, 0.7, M.fabric, 0.45, 0.44, 0.1);
    const p1 = box(g, 0.45, 0.4, 0.12, M.pillow, -0.62, 0.52, -0.2);
    p1.rotation.x = -0.25;
    const p2 = box(g, 0.45, 0.4, 0.12, M.throw, 0.62, 0.52, -0.2);
    p2.rotation.x = -0.25;
  },
  armchair(g) {
    box(g, 0.8, 0.4, 0.8, M.fabricDark, 0, 0.05, 0);
    box(g, 0.8, 0.45, 0.16, M.fabricDark, 0, 0.45, -0.32);
    box(g, 0.12, 0.2, 0.8, M.fabricDark, -0.34, 0.45, 0);
    box(g, 0.12, 0.2, 0.8, M.fabricDark, 0.34, 0.45, 0);
    legs(g, 0.8, 0.8, 0.05, M.woodDark);
  },
  coffeeTable(g) {
    box(g, 1.1, 0.04, 0.6, M.stone, 0, 0.36, 0);
    box(g, 1.0, 0.02, 0.5, M.woodDark, 0, 0.1, 0);
    legs(g, 1.1, 0.6, 0.36, M.gold, 0.05, 0.015);
    box(g, 0.25, 0.04, 0.18, M.book[1], 0.25, 0.4, 0.05);
    cyl(g, 0.06, 0.05, 0.16, M.ceramic, -0.3, 0.4, -0.05, 16);
  },
  tv(g) {
    box(g, 1.9, 0.42, 0.42, M.woodDark, 0, 0.12, 0.04);
    box(g, 1.9, 0.12, 0.42, M.black, 0, 0, 0.04);
    box(g, 1.45, 0.82, 0.03, M.screen, 0, 1.0, 0.035);
    box(g, 1.47, 0.84, 0.01, M.black, 0, 0.99, 0.018);
    cyl(g, 0.07, 0.07, 0.25, M.ceramic, 0.7, 0.54, 0.05, 16);
  },
  kitchenRun(g, o) {
    const L = o.len || 3;
    box(g, L, 0.1, 0.56, M.black, 0, 0, 0.02);
    box(g, L, 0.78, 0.6, M.gloss, 0, 0.1, 0);
    for (let x = -L / 2 + 0.6; x < L / 2 - 0.05; x += 0.6) box(g, 0.006, 0.7, 0.01, M.black, x, 0.14, 0.305);
    box(g, L, 0.012, 0.01, M.black, 0, 0.8, 0.305);
    box(g, L + 0.02, 0.04, 0.64, M.stone, 0, 0.88, 0.01);
    box(g, 0.55, 0.012, 0.4, M.steel, -L * 0.22, 0.915, 0.02);
    cyl(g, 0.012, 0.012, 0.3, M.steel, -L * 0.22, 0.92, -0.22, 8);
    box(g, 0.6, 0.012, 0.5, M.screen, L * 0.22, 0.92, 0.02);
    if (o.uppers !== false) {
      box(g, L, 0.72, 0.35, M.gloss, 0, 1.55, -0.125);
      box(g, L, 0.6, 0.02, M.stone, 0, 0.93, -0.29);
    } else {
      box(g, L, 0.04, 0.26, M.oak, 0, 1.6, -0.17);
      cyl(g, 0.05, 0.05, 0.14, M.ceramic, -L * 0.3, 1.64, -0.17, 12);
      cyl(g, 0.04, 0.04, 0.2, M.plant, L * 0.3, 1.64, -0.17, 8);
    }
  },
  fridge(g) {
    box(g, 0.8, 2.05, 0.66, M.steel, 0, 0, 0);
    box(g, 0.02, 0.9, 0.03, M.black, 0.3, 1.0, 0.34);
  },
  island(g) {
    box(g, 1.8, 0.88, 0.9, M.woodDark, 0, 0, 0);
    box(g, 1.9, 0.05, 1.0, M.stone, 0, 0.88, 0);
    for (const x of [-0.5, 0.2]) {
      cyl(g, 0.18, 0.18, 0.05, M.woodLight, x, 0.72, 0.65, 16);
      cyl(g, 0.02, 0.02, 0.72, M.black, x, 0, 0.65, 8);
    }
  },
  dining(g, o) {
    const small = o.small;
    const w = small ? 1.0 : 1.7, d = small ? 0.8 : 0.9;
    box(g, w, 0.04, d, M.oak, 0, 0.72, 0);
    legs(g, w, d, 0.72, M.black, 0.08, 0.02);
    const chairs = small
      ? [[-0.25, -0.6, 0], [0.25, 0.6, Math.PI]]
      : [[-0.45, -0.68, 0], [0.45, -0.68, 0], [-0.45, 0.68, Math.PI], [0.45, 0.68, Math.PI]];
    for (const [x, z, r] of chairs) {
      const c = new THREE.Group();
      box(c, 0.45, 0.05, 0.45, M.fabric, 0, 0.44, 0);
      box(c, 0.45, 0.42, 0.04, M.oak, 0, 0.48, -0.21);
      legs(c, 0.45, 0.45, 0.44, M.black, 0.04, 0.012);
      c.position.set(x, 0, z);
      c.rotation.y = r;
      g.add(c);
    }
    cyl(g, 0.07, 0.05, 0.22, M.ceramic, 0, 0.76, 0, 16);
  },
  bed(g) {
    box(g, 1.9, 0.3, 2.1, M.woodDark, 0, 0.05, 0);
    box(g, 1.8, 0.22, 2.0, M.linen, 0, 0.35, 0.02);
    box(g, 1.86, 0.08, 1.35, M.linen, 0, 0.53, 0.35);
    box(g, 1.9, 0.06, 0.55, M.throw, 0, 0.58, 0.7);
    box(g, 2.0, 1.1, 0.1, M.fabric, 0, 0.05, -1.05);
    for (const x of [-0.45, 0.45]) {
      const p = box(g, 0.7, 0.16, 0.4, M.pillow, x, 0.57, -0.72);
      p.rotation.x = -0.35;
    }
    for (const x of [-1.3, 1.3]) {
      box(g, 0.5, 0.5, 0.42, M.woodLight, x, 0, -0.84);
      cyl(g, 0.02, 0.02, 0.28, M.gold, x, 0.5, -0.84, 8);
      cyl(g, 0.12, 0.15, 0.2, M.shade, x, 0.72, -0.84, 20);
    }
  },
  singleBed(g) {
    box(g, 1.0, 0.3, 2.0, M.oak, 0, 0.05, 0);
    box(g, 0.94, 0.2, 1.94, M.linen, 0, 0.35, 0);
    box(g, 0.98, 0.07, 1.3, M.fabricDark, 0, 0.52, 0.3);
    box(g, 1.0, 0.8, 0.06, M.oak, 0, 0.05, -1.0);
    const p = box(g, 0.6, 0.14, 0.35, M.pillow, 0, 0.55, -0.72);
    p.rotation.x = -0.3;
  },
  wardrobe(g, o) {
    const L = o.len || 2;
    box(g, L, 2.45, 0.6, M.white, 0, 0, 0);
    const n = Math.max(2, Math.round(L / 0.55));
    for (let i = 1; i < n; i++) box(g, 0.006, 2.35, 0.01, M.black, -L / 2 + (i * L) / n, 0.05, 0.302);
    for (let i = 0; i < n; i++) box(g, 0.02, 0.35, 0.03, M.gold, -L / 2 + ((i + 0.5) * L) / n + (i % 2 ? -0.1 : 0.1), 1.0, 0.31);
  },
  console(g) {
    box(g, 1.2, 0.05, 0.35, M.woodDark, 0, 0.78, 0);
    legs(g, 1.2, 0.35, 0.78, M.gold, 0.04, 0.015);
    box(g, 0.8, 1.0, 0.02, M.mirror, 0, 1.15, -0.16);
    box(g, 0.84, 1.04, 0.015, M.gold, 0, 1.13, -0.17);
    cyl(g, 0.07, 0.05, 0.3, M.ceramic, 0.38, 0.83, 0, 16);
  },
  plant(g) {
    cyl(g, 0.21, 0.16, 0.44, M.pot, 0, 0, 0, 24);
    cyl(g, 0.19, 0.19, 0.02, M.soil || (M.soil = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 1 })), 0, 0.42, 0, 20);
    // yarpaqlar: əyilmiş uzunsov lövhələr (monstera/fikus kimi)
    if (!M.leafGeo) {
      const lg = new THREE.PlaneGeometry(0.16, 0.42, 2, 6);
      const p = lg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) + 0.21, x = p.getX(i);
        const w = Math.sin((y / 0.42) * Math.PI) * 1.1;
        p.setX(i, x * w);
        p.setZ(i, -Math.pow(y / 0.42, 2) * 0.14 + Math.abs(x) * 0.25);
        p.setY(i, y);
      }
      lg.computeVertexNormals();
      M.leafGeo = lg;
      M.leaf = [0x2f5a2a, 0x3b6b31, 0x4a7a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide }));
    }
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const stemH = 0.45 + r() * 0.75;
      const ang = r() * Math.PI * 2, tilt = 0.35 + r() * 0.7;
      const l = new THREE.Mesh(M.leafGeo, M.leaf[i % 3]);
      l.position.set(Math.cos(ang) * 0.05, stemH, Math.sin(ang) * 0.05);
      l.rotation.set(0, -ang + Math.PI / 2, 0);
      l.rotateX(tilt);
      const k = 0.8 + r() * 0.6;
      l.scale.setScalar(k);
      l.castShadow = true;
      g.add(l);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, stemH - 0.4, 4), M.leaf[0]);
      stem.position.set(Math.cos(ang) * 0.025, 0.4 + (stemH - 0.4) / 2, Math.sin(ang) * 0.025);
      g.add(stem);
    }
  },
  pendant(g) {
    g.userData.tourOnly = true;
    cyl(g, 0.004, 0.004, 0.75, M.black, 0, 2.25, 0, 4).castShadow = false;
    const s = cyl(g, 0.05, 0.22, 0.22, M.black, 0, 2.05, 0, 28);
    s.castShadow = false;
    const b = cyl(g, 0.16, 0.16, 0.01, M.lamp, 0, 2.05, 0, 24);
    b.castShadow = false;
  },
  bathtub(g) {
    box(g, 1.7, 0.56, 0.75, M.ceramic, 0, 0, 0);
    box(g, 1.52, 0.02, 0.58, new THREE.MeshStandardMaterial({ color: 0xd8e6ea, roughness: 0.05 }), 0, 0.55, 0);
    cyl(g, 0.015, 0.015, 0.25, M.steel, 0.7, 0.56, -0.3, 8);
  },
  vanity(g, o) {
    const w = o.small ? 0.8 : 1.0;
    box(g, w, 0.45, 0.48, M.oak, 0, 0.4, 0);
    box(g, w, 0.04, 0.5, M.stone, 0, 0.85, 0);
    box(g, 0.45, 0.12, 0.35, M.ceramic, 0, 0.89, 0.02);
    cyl(g, 0.012, 0.012, 0.2, M.steel, 0, 0.89, -0.17, 8);
    box(g, w - 0.1, 0.9, 0.02, M.mirror, 0, 1.15, -0.24);
    box(g, w - 0.2, 0.02, 0.04, M.lamp, 0, 2.08, -0.22);
  },
  toilet(g) {
    box(g, 0.38, 0.4, 0.16, M.ceramic, 0, 0.45, -0.24);
    cyl(g, 0.17, 0.14, 0.4, M.ceramic, 0, 0, 0.05, 20);
    box(g, 0.36, 0.03, 0.44, M.ceramic, 0, 0.4, 0.03);
  },
  shower(g, o) {
    const w = o.w || 1.2, d = o.d || 1;
    box(g, w, 0.04, d, M.ceramic, 0, 0, 0);
    box(g, w, 2.0, 0.012, M.glass, 0, 0.04, -d / 2 + 0.01);
    box(g, 0.025, 2.0, 0.025, M.steel, -w / 2 + 0.02, 0.04, -d / 2 + 0.01);
    cyl(g, 0.12, 0.12, 0.015, M.steel, 0, 2.1, d / 2 - 0.25, 20);
    cyl(g, 0.01, 0.01, 0.9, M.steel, 0, 1.2, d / 2 - 0.05, 8);
  },
  desk(g) {
    box(g, 1.2, 0.03, 0.6, M.oak, 0, 0.73, 0);
    legs(g, 1.2, 0.6, 0.73, M.white, 0.04, 0.02);
    box(g, 0.5, 0.02, 0.35, M.screen, -0.2, 0.76, -0.05);
    cyl(g, 0.08, 0.1, 0.02, M.black, 0.4, 0.76, -0.15, 16);
    cyl(g, 0.01, 0.01, 0.4, M.black, 0.4, 0.76, -0.15, 6);
    const c = new THREE.Group();
    box(c, 0.46, 0.06, 0.46, M.fabricDark, 0, 0.45, 0);
    box(c, 0.46, 0.45, 0.05, M.fabricDark, 0, 0.5, 0.2);
    cyl(c, 0.025, 0.025, 0.45, M.black, 0, 0, 0, 8);
    c.position.set(0, 0, 0.55);
    g.add(c);
  },
  shelf(g, o) {
    const L = o.len || 2;
    const n = Math.round(L / 0.45);
    box(g, L, 0.04, 0.35, M.oak, 0, 0, 0);
    for (const y of [0.45, 0.9, 1.35, 1.8]) box(g, L, 0.03, 0.35, M.oak, 0, y, 0);
    for (let i = 0; i <= n; i++) box(g, 0.03, 1.83, 0.35, M.oak, -L / 2 + (i * L) / n, 0, 0);
    let k = 0;
    for (const y of [0.04, 0.93]) {
      for (let i = 0; i < n; i++) {
        if ((i + k) % 2) continue;
        const x0 = -L / 2 + (i * L) / n + 0.08;
        for (let j = 0; j < 5; j++) box(g, 0.035, 0.3 + (j % 3) * 0.04, 0.25, M.book[(i + j + k) % 5], x0 + j * 0.05, y, 0);
      }
      k++;
    }
    cyl(g, 0.08, 0.06, 0.2, M.ceramic, -L / 2 + 0.3, 1.38, 0, 16);
  },
};

// Divar şəkilləri (bəzək)
export function artwork(g, w, h, i) {
  box(g, w + 0.06, h + 0.06, 0.03, M.gold, 0, 0, 0);
  box(g, w, h, 0.035, M.art[i % 3], 0, 0.03, 0.001);
}

export function buildFurniture(item) {
  furnitureMaterials();
  const g = new THREE.Group();
  if (item.k === 'rug') {
    const m = new THREE.Mesh(boxGeo(item.w, 0.012, item.d), rugMaterial(Math.round(item.x * 7 + item.z * 3)));
    m.position.y = 0.006;
    m.receiveShadow = true;
    g.add(m);
  } else if (B[item.k]) {
    B[item.k](g, item);
  }
  g.position.set(item.x, 0, item.z);
  g.rotation.y = THREE.MathUtils.degToRad(item.rot || 0);
  g.userData.kind = item.k;
  return g;
}

// Toqquşma üçün təxmini ölçülər (en, dərinlik)
export const FOOTPRINT = {
  sofa: [2.2, 0.95], armchair: [0.8, 0.8], coffeeTable: [1.1, 0.6], tv: [1.9, 0.42],
  island: [1.9, 1.0], dining: [1.7, 1.6], bed: [2.0, 2.2], singleBed: [1.0, 2.0],
  fridge: [0.8, 0.66], bathtub: [1.7, 0.75], vanity: [1.0, 0.5], toilet: [0.4, 0.6],
  desk: [1.2, 1.0], shelf: [2.0, 0.35], console: [1.2, 0.35], plant: [0.4, 0.4],
};
