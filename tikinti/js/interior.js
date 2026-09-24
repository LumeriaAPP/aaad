// Mənzilin 3D interyerini plandan qurur: döşəmə, divarlar, pəncərələr, qapılar və mebel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING, WALL_H, STATUS } from './data.js';
import { computeLayout, exteriorSides } from './layout.js';
import { buildFurniture, furnitureMaterials, FOOTPRINT } from './furniture.js';
import { woodTexture, marbleTexture, tileTexture } from './textures.js';

let MATS = null;
export function interiorMaterials() {
  if (MATS) return MATS;
  MATS = {
    floor: {
      wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.5 }),
      marble: new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.15 }),
      tile: new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.3 }),
    },
    floorScale: { wood: 2, marble: 2, tile: 1.2 },
    wall: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xb8cdd8, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.16,
      envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
    }),
    frame: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.6 }),
    door: new THREE.MeshStandardMaterial({ color: 0xece8e1, roughness: 0.5 }),
    entry: new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.45 }),
  };
  furnitureMaterials();
  return MATS;
}

const WALL_COLOR = new THREE.Color(0xf3efe8);
const WALL_EXT_COLOR = new THREE.Color(0xe9e4dc);
const CUT_COLOR = new THREE.Color(0x2b2724);

function boxAt(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  if (color) {
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // BoxGeometry üzləri: +x, -x, +y, -y, +z, -z (hər biri 4 təpə); +y — kəsik (üst) üz
      const c = i >= 8 && i < 12 ? CUT_COLOR : color;
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  return g;
}

// Seqmenti (xətt boyu a..b, qalınlıq t, hündürlük y0..y1) qutuya çevir
function segBox(s, color) {
  const L = s.b - s.a, h = s.y1 - s.y0, mid = (s.a + s.b) / 2, y = (s.y0 + s.y1) / 2;
  return s.axis === 'h' ? boxAt(L, h, s.t, mid, y, s.c, color) : boxAt(s.t, h, L, s.c, y, mid, color);
}

function mergeMesh(geos, mat, { cast = true, receive = true } = {}) {
  if (!geos.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Mebel qrupunu materiallara görə birləşdir (az draw call)
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const gi = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(gi.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gi.deleteAttribute(k);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(gi);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = !mat.transparent;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

export function slotTransform(slot, plan) {
  const sx = slot.mx ? -1 : 1, sz = slot.mz ? -1 : 1;
  const tx = (slot.mx ? slot.ox + plan.w : slot.ox) - BUILDING.width / 2;
  const tz = (slot.mz ? slot.oz + plan.d : slot.oz) - BUILDING.depth / 2;
  return { sx, sz, tx, tz };
}

/**
 * apt: APARTMENTS elementi, baseY: mərtəbə döşəməsinin dünya hündürlüyü
 */
export function buildApartment(apt, baseY) {
  const mats = interiorMaterials();
  const plan = apt.type;
  const ext = exteriorSides(apt.slot, plan);
  const { segs, openings, colliders } = computeLayout(plan, ext);
  const { sx, sz, tx, tz } = slotTransform(apt.slot, plan);

  const group = new THREE.Group();
  group.position.set(tx, baseY, tz);
  group.scale.set(sx, 1, sz);
  group.userData.apt = apt;

  // Döşəmələr
  const floorGeos = { wood: [], marble: [], tile: [] };
  for (const r of plan.rooms_) {
    const g = new THREE.PlaneGeometry(r.w, r.d);
    g.rotateX(-Math.PI / 2);
    g.translate(r.x + r.w / 2, 0.004, r.z + r.d / 2);
    const s = mats.floorScale[r.floor];
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / s, pos.getZ(i) / s);
    floorGeos[r.floor].push(g);
  }
  for (const [k, geos] of Object.entries(floorGeos)) {
    const m = mergeMesh(geos, mats.floor[k], { cast: false });
    if (m) group.add(m);
  }

  // Divarlar
  const wallGeos = segs.map((s) => segBox(s, s.exterior ? WALL_EXT_COLOR : WALL_COLOR));
  group.add(mergeMesh(wallGeos, mats.wall));

  // Pəncərələr, qapılar
  const glass = [], frames = [], doors = [], entry = [];
  for (const o of openings) {
    const L = o.b - o.a, mid = (o.a + o.b) / 2;
    const along = (len, h, thick, p, y) => (o.axis === 'h' ? boxAt(len, h, thick, p, y, o.c) : boxAt(thick, h, len, o.c, y, p));
    if (o.type === 'window') {
      const h = o.head - o.sill, y = (o.head + o.sill) / 2;
      glass.push(along(L, h, 0.02, mid, y));
      const f = 0.05;
      frames.push(along(L, f, 0.1, mid, o.sill + f / 2), along(L, f, 0.1, mid, o.head - f / 2));
      const panes = Math.max(1, Math.round(L / 1.4));
      for (let i = 0; i <= panes; i++) frames.push(along(f, h, 0.1, o.a + (i * L) / panes, y));
      if (!o.panoramic) frames.push(along(L + 0.1, 0.03, 0.3, mid, o.sill - 0.015));
    } else if (o.type === 'door') {
      const f = 0.05;
      const fr = [along(f, 2.15, o.t + 0.03, o.a + f / 2, 1.075), along(f, 2.15, o.t + 0.03, o.b - f / 2, 1.075), along(L, f, o.t + 0.03, mid, 2.15 - f / 2)];
      frames.push(...fr);
      if (o.entry) {
        entry.push(along(L - 0.1, 2.08, 0.06, mid, 1.06));
        frames.push(along(0.03, 0.3, 0.14, o.b - 0.18, 1.05));
      } else {
        // açıq qapı taxtası (divara söykənmiş)
        const lw = L - 0.1;
        const leaf =
          o.axis === 'h'
            ? boxAt(0.04, 2.08, lw, o.a + 0.07, 1.06, o.c + o.t / 2 + lw / 2)
            : boxAt(lw, 2.08, 0.04, o.c + o.t / 2 + lw / 2, 1.06, o.a + 0.07);
        doors.push(leaf);
      }
    }
  }
  const gm = mergeMesh(glass, mats.glass, { cast: false, receive: false });
  if (gm) { gm.renderOrder = 2; group.add(gm); }
  for (const [geos, mat] of [[frames, mats.frame], [doors, mats.door], [entry, mats.entry]]) {
    const m = mergeMesh(geos, mat);
    if (m) group.add(m);
  }

  // Mebel
  const furn = new THREE.Group();
  const tourOnly = new THREE.Group();
  tourOnly.userData.tourOnly = true;
  const modelSlots = [];
  const lamps = [];
  const furnColliders = [];
  for (const item of plan.furniture) {
    const obj = buildFurniture(item);
    if (item.k === 'pendant') {
      tourOnly.add(obj);
      lamps.push(new THREE.Vector3(item.x, 1.95, item.z));
      continue;
    }
    if (item.k === 'sofa' || item.k === 'armchair') {
      obj.userData.modelKind = item.k;
      modelSlots.push(obj);
      group.add(obj);
    } else {
      furn.add(obj);
    }
    let fp = FOOTPRINT[item.k];
    if (item.k === 'dining' && item.small) fp = [1.0, 1.3];
    if (item.k === 'kitchenRun' || item.k === 'wardrobe') fp = [item.len, 0.62];
    if (item.k === 'shower') fp = [item.w, 0.05];
    if (fp) {
      const a = THREE.MathUtils.degToRad(item.rot || 0);
      const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const w = fp[0] * c + fp[1] * s, d = fp[0] * s + fp[1] * c;
      let cx = item.x, cz = item.z;
      if (item.k === 'shower') { cz = item.z - item.d / 2; }
      furnColliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    }
  }
  group.add(mergeByMaterial(furn));

  // Tavan (yalnız virtual turda görünür)
  const ceil = new THREE.PlaneGeometry(plan.w, plan.d);
  ceil.rotateX(Math.PI / 2);
  ceil.translate(plan.w / 2, WALL_H, plan.d / 2);
  const ceilMesh = new THREE.Mesh(ceil, mats.ceiling);
  ceilMesh.receiveShadow = true;
  tourOnly.add(ceilMesh);
  tourOnly.visible = false;
  group.add(tourOnly);

  // Status örtüyü və seçmə üçün görünməz qutu
  const color = new THREE.Color(STATUS[apt.status].color);
  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.w - 0.1, plan.d - 0.1).rotateX(-Math.PI / 2).translate(plan.w / 2, 0.03, plan.d / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false })
  );
  overlay.renderOrder = 3;
  group.add(overlay);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(plan.w - 0.1, 0.01, plan.d - 0.1).translate(plan.w / 2, WALL_H + 0.05, plan.d / 2)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  group.add(border);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(plan.w, WALL_H, plan.d).translate(plan.w / 2, WALL_H / 2, plan.d / 2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.userData.apt = apt;
  group.add(hit);

  // Dünya koordinatlarına çevir
  const toWorldRect = (r) => {
    const xa = tx + sx * r.x0, xb = tx + sx * r.x1, za = tz + sz * r.z0, zb = tz + sz * r.z1;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) };
  };
  const toWorld = (x, z) => new THREE.Vector3(tx + sx * x, baseY, tz + sz * z);

  const rooms = plan.rooms_.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    area: +(r.w * r.d).toFixed(1),
    center: toWorld(r.x + r.w / 2, r.z + r.d / 2),
    rect: toWorldRect({ x0: r.x, x1: r.x + r.w, z0: r.z, z1: r.z + r.d }),
  }));
  const entryDoor = plan.doors.find((d) => d.entry);

  return {
    apt,
    group,
    hit,
    overlay,
    border,
    tourOnly,
    modelSlots,
    lamps: lamps.map((p) => toWorld(p.x, p.z).setY(baseY + p.y)),
    colliders: [...colliders, ...furnColliders].map(toWorldRect),
    rooms,
    start: toWorld(entryDoor.x, entryDoor.z - 0.9),
    startLook: toWorld(entryDoor.x, entryDoor.z - 4),
    bounds: toWorldRect({ x0: 0, x1: plan.w, z0: 0, z1: plan.d }),
    baseY,
    toWorld,
  };
}

// Dəhliz və lift/pilləkən bloku
export function buildCommonAreas(baseY) {
  const mats = interiorMaterials();
  const g = new THREE.Group();
  const { width: W, depth: D, corridor, core } = BUILDING;
  const cx = -W / 2, cz = -D / 2;
  const f = new THREE.PlaneGeometry(W, corridor.z1 - corridor.z0);
  f.rotateX(-Math.PI / 2);
  f.translate(cx + W / 2, baseY + 0.004, cz + (corridor.z0 + corridor.z1) / 2);
  const pos = f.attributes.position, uv = f.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
  g.add(new THREE.Mesh(f, mats.floor.marble));

  const coreMat = new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.8 });
  const cw = core.x1 - core.x0, cd = core.z1 - core.z0;
  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(cw, WALL_H, cd), coreMat);
  coreMesh.position.set(cx + core.x0 + cw / 2, baseY + WALL_H / 2, cz + core.z0 + cd / 2);
  coreMesh.castShadow = coreMesh.receiveShadow = true;
  g.add(coreMesh);
  // lift qapıları
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9c6c0, metalness: 0.9, roughness: 0.25 });
  for (const x of [core.x0 + 1.4, core.x0 + 3.0]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.05), steel);
    d.position.set(cx + x, baseY + 1.1, cz + core.z0 - 0.02);
    g.add(d);
  }
  // dəhliz sonlarında pəncərə şüşəsi
  const glassG = new THREE.PlaneGeometry(corridor.z1 - corridor.z0, WALL_H);
  for (const x of [cx, cx + W]) {
    const m = new THREE.Mesh(glassG, mats.glass);
    m.rotation.y = Math.PI / 2;
    m.position.set(x, baseY + WALL_H / 2, cz + (corridor.z0 + corridor.z1) / 2);
    g.add(m);
  }
  return g;
}
