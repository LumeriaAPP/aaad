// İnteryer dekorasiyası: plintuslar, pərdələr, aksent divarlar, divar şəkilləri,
// tavan işıqları, hamam plitələri. Plan və divar açılışlarından avtomatik qurulur.
import * as THREE from 'three';
import { WALL_H } from './data.js';
import { T_EXT, T_INT } from './layout.js';
import { artTexture, rugTexture, wallTileTexture, woodTexture } from './textures.js';

let D = null;
function mats() {
  if (D) return D;
  const tile = wallTileTexture();
  const slat = woodTexture([122, 86, 58]);
  D = {
    base: new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.5 }),
    drape: new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.95, side: THREE.DoubleSide }),
    drapeDark: new THREE.MeshStandardMaterial({ color: 0x8c7b6a, roughness: 0.95, side: THREE.DoubleSide }),
    sheer: new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    rail: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 }),
    slat: new THREE.MeshStandardMaterial({ map: slat, roughness: 0.55 }),
    slatBack: new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: 0.8 }),
    head: new THREE.MeshStandardMaterial({ color: 0xb9ab97, roughness: 0.95 }),
    tile,
    tileMat: new THREE.MeshStandardMaterial({ map: tile, roughness: 0.18 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.5 }),
    art: [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ map: artTexture(i + 1), roughness: 0.85 })),
    rugs: [[176, 160, 140], [150, 160, 168], [190, 176, 150]].map((c, i) => new THREE.MeshStandardMaterial({ map: rugTexture(i + 1, c), roughness: 1 })),
    downlight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1dc, emissiveIntensity: 2.5 }),
    cove: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 1.6 }),
    gypsum: new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 1 }),
  };
  return D;
}
export function decorMaterials() { return mats(); }

function add(g, geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// Xətt üzərindəki [a,b] aralığından açılışları çıxar
function subtract(a, b, holes) {
  let parts = [[a, b]];
  for (const [h0, h1] of holes) {
    const next = [];
    for (const [p0, p1] of parts) {
      if (h1 <= p0 || h0 >= p1) { next.push([p0, p1]); continue; }
      if (h0 > p0) next.push([p0, h0]);
      if (h1 < p1) next.push([h1, p1]);
    }
    parts = next;
  }
  return parts.filter(([p0, p1]) => p1 - p0 > 0.05);
}

function drapeGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 18, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * Math.PI * 7) * 0.045);
  g.computeVertexNormals();
  return g;
}

/**
 * plan: plan tipi; ext: xarici tərəflər; openings: layout açılışları (yerli koordinatlar)
 * stat: birləşdiriləcək statik qrup; tourOnly: yalnız turda görünən qrup
 */
export function decorate(plan, ext, openings, stat, tourOnly) {
  const M = mats();
  const W = plan.w, Dd = plan.d;
  const isExt = (axis, c) =>
    (axis === 'h' && Math.abs(c) < 1e-3 && ext.front) || (axis === 'h' && Math.abs(c - Dd) < 1e-3 && ext.back) ||
    (axis === 'v' && Math.abs(c) < 1e-3 && ext.left) || (axis === 'v' && Math.abs(c - W) < 1e-3 && ext.right);
  const holesOn = (axis, c, floorLevel) => openings
    .filter((o) => o.axis === axis && Math.abs(o.c - c) < 1e-3 && (o.type !== 'window' || !floorLevel || o.sill < 0.12))
    .map((o) => [o.a, o.b]);

  let artI = 0;
  for (const r of plan.rooms_) {
    const edges = [
      { axis: 'h', c: r.z, a: r.x, b: r.x + r.w, inward: 1 },
      { axis: 'h', c: r.z + r.d, a: r.x, b: r.x + r.w, inward: -1 },
      { axis: 'v', c: r.x, a: r.z, b: r.z + r.d, inward: 1 },
      { axis: 'v', c: r.x + r.w, a: r.z, b: r.z + r.d, inward: -1 },
    ];
    for (const e of edges) {
      const t = (isExt(e.axis, e.c) ? T_EXT : T_INT) / 2;
      const off = e.c + e.inward * (t + 0.008);
      const place = (len, h, depth, along, y, mat) => {
        const geo = new THREE.BoxGeometry(e.axis === 'h' ? len : depth, h, e.axis === 'h' ? depth : len);
        return e.axis === 'h' ? add(stat, geo, mat, along, y, off + e.inward * depth / 2) : add(stat, geo, mat, off + e.inward * depth / 2, y, along);
      };
      // plintus
      if (r.kind !== 'bath') {
        for (const [p0, p1] of subtract(e.a, e.b, holesOn(e.axis, e.c, true))) place(p1 - p0, 0.09, 0.015, (p0 + p1) / 2, 0.045, M.base);
      }
      // hamam: divar plitələri (2.4 m)
      if (r.kind === 'bath') {
        for (const [p0, p1] of subtract(e.a, e.b, holesOn(e.axis, e.c, false))) {
          const len = p1 - p0;
          const m = place(len, 2.4, 0.012, (p0 + p1) / 2, 1.2, M.tileMat);
          const uv = m.geometry.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.6, uv.getY(i) * 2.4 / 0.6);
        }
      }
      // pərdələr (yaşayış otaqlarının pəncərələrində)
      if (['living', 'bedroom', 'kids'].includes(r.kind)) {
        for (const o of openings) {
          if (o.type !== 'window' || o.axis !== e.axis || Math.abs(o.c - e.c) > 1e-3) continue;
          if (o.a < e.a - 1e-3 || o.b > e.b + 1e-3) continue;
          const wide = o.b - o.a;
          const inset = e.c + e.inward * (t + 0.16);
          const railLen = Math.min(wide + 0.6, e.b - e.a - 0.1);
          const mid = (o.a + o.b) / 2;
          const ry = e.axis === 'h' ? 0 : Math.PI / 2;
          const dh = WALL_H - 0.08;
          const mat = r.kind === 'bedroom' ? M.drapeDark : M.drape;
          const at = (along, dd) => (e.axis === 'h' ? [along, inset + e.inward * dd] : [inset + e.inward * dd, along]);
          const [rx, rz] = at(mid, 0);
          add(stat, new THREE.BoxGeometry(e.axis === 'h' ? railLen : 0.03, 0.03, e.axis === 'h' ? 0.03 : railLen), M.rail, rx, WALL_H - 0.06, rz);
          for (const side of [-1, 1]) {
            const along = mid + side * (railLen / 2 - 0.3);
            const [x, z] = at(along, 0);
            add(stat, drapeGeo(0.62, dh), mat, x, dh / 2, z, ry).castShadow = false;
          }
          // yarı şəffaf tül
          const [sx, sz] = at(mid, -0.06);
          const sheer = add(stat, drapeGeo(Math.max(0.5, wide - 0.9), dh), M.sheer, sx, dh / 2, sz, ry);
          sheer.castShadow = false;
          sheer.renderOrder = 2;
        }
      }
    }

    // tavan: nöqtəvi işıqlar; qonaq otağında gizli (kornis) işıq
    const nx = Math.max(1, Math.round(r.w / 1.8)), nz = Math.max(1, Math.round(r.d / 1.8));
    const dl = new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = r.x + ((i + 0.5) * r.w) / nx, z = r.z + ((j + 0.5) * r.d) / nz;
      add(tourOnly, dl, M.downlight, x, WALL_H - 0.006, z).castShadow = false;
    }
    if (r.kind === 'living') {
      const inset = 0.45, y = WALL_H - 0.12;
      const band = [
        [r.w - inset * 2 + 0.3, r.x + r.w / 2, r.z + inset, 'h'], [r.w - inset * 2 + 0.3, r.x + r.w / 2, r.z + r.d - inset, 'h'],
        [r.d - inset * 2 + 0.3, r.x + inset, r.z + r.d / 2, 'v'], [r.d - inset * 2 + 0.3, r.x + r.w - inset, r.z + r.d / 2, 'v'],
      ];
      for (const [len, x, z, ax] of band) {
        // gipskarton kənar + LED zolaq
        add(tourOnly, new THREE.BoxGeometry(ax === 'h' ? len : 0.9, 0.12, ax === 'h' ? 0.9 : len), M.gypsum, x, y + 0.06, z).castShadow = false;
        add(tourOnly, new THREE.BoxGeometry(ax === 'h' ? len : 0.03, 0.02, ax === 'h' ? 0.03 : len), M.cove, x, y - 0.01, z).castShadow = false;
      }
    }
  }

  // mebelə görə aksent elementlər
  const backOf = (it, dist) => {
    const a = THREE.MathUtils.degToRad(it.rot || 0);
    return [it.x - Math.sin(a) * dist, it.z - Math.cos(a) * dist, a];
  };
  for (const it of plan.furniture) {
    if (it.k === 'tv') {
      // taxta lamelli TV divarı
      const [x, z, a] = backOf(it, 0.085);
      const panel = new THREE.Group();
      panel.position.set(x, 0, z);
      panel.rotation.y = a;
      add(panel, new THREE.BoxGeometry(2.9, WALL_H - 0.02, 0.02), M.slatBack, 0, (WALL_H - 0.02) / 2, -0.01);
      for (let i = 0; i < 29; i++) add(panel, new THREE.BoxGeometry(0.045, WALL_H - 0.02, 0.03), M.slat, -1.4 + i * 0.1, (WALL_H - 0.02) / 2, 0.015);
      stat.add(panel);
    }
    if (it.k === 'bed') {
      // yumşaq baş panel divarı + iki tərəfdə şəkil
      const [x, z, a] = backOf(it, 0.99);
      const panel = new THREE.Group();
      panel.position.set(x, 0, z);
      panel.rotation.y = a;
      for (let i = -3; i <= 3; i++) add(panel, new THREE.BoxGeometry(0.38, 1.4, 0.06), M.head, i * 0.4, 0.75 + 0.7, 0.03);
      add(panel, new THREE.BoxGeometry(0.9, 0.6, 0.03), M.frame, 0, 2.45, 0.02);
      add(panel, new THREE.PlaneGeometry(0.84, 0.54), M.art[artI++ % M.art.length], 0, 2.45, 0.04);
      stat.add(panel);
    }
    if (it.k === 'sofa' || it.k === 'console') {
      const dist = it.k === 'sofa' ? 0.6 : 0.2;
      const [x, z, a] = backOf(it, dist);
      // arxada divar varmı? (sadə yoxlama: plan sərhədinə və ya otaq kənarına yaxınlıq)
      const nearWall = plan.rooms_.some((r) => {
        const inX = x > r.x - 0.05 && x < r.x + r.w + 0.05, inZ = z > r.z - 0.05 && z < r.z + r.d + 0.05;
        const dx = Math.min(Math.abs(x - r.x), Math.abs(x - r.x - r.w)), dz = Math.min(Math.abs(z - r.z), Math.abs(z - r.z - r.d));
        return inX && inZ && Math.min(dx, dz) < 0.35;
      });
      if (!nearWall || it.k === 'console') continue;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = a;
      add(g, new THREE.BoxGeometry(1.26, 0.86, 0.03), M.frame, 0, 1.65, 0.02);
      add(g, new THREE.PlaneGeometry(1.2, 0.8), M.art[artI++ % M.art.length], 0, 1.65, 0.04);
      stat.add(g);
    }
  }
}

export function rugMaterial(i) { return mats().rugs[Math.abs(i) % 3]; }
