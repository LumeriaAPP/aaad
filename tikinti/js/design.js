// Mənzil dizayn studiyası: otaq təyinatları, mebelin avtomatik düzülüşü,
// divar/döşəmə rəngləri, hazır stillər. Bütün koordinatlar planın yerli koordinatlarıdır.
import { computeLayout, exteriorSides, T_EXT, T_INT } from './layout.js';

/* ---------------- Kataloqlar ---------------- */
export const USES = {
  living: { name: 'Qonaq otağı', minArea: 9 },
  livingKitchen: { name: 'Qonaq otağı + mətbəx', minArea: 24 },
  studio: { name: 'Loft (qonaq + yataq)', minArea: 22 },
  bedroom: { name: 'Yataq otağı', minArea: 9 },
  kids: { name: 'Uşaq otağı', minArea: 7 },
  office: { name: 'İş otağı', minArea: 5 },
  kitchen: { name: 'Mətbəx', minArea: 6 },
  dining: { name: 'Yemək otağı', minArea: 8 },
  wardrobe: { name: 'Qarderob', minArea: 2 },
  empty: { name: 'Boş otaq', minArea: 0 },
  hall: { name: 'Dəhliz', fixed: true },
  bath: { name: 'Hamam otağı', fixed: true },
};
const USE_ORDER = ['living', 'livingKitchen', 'studio', 'bedroom', 'kids', 'office', 'kitchen', 'dining', 'wardrobe', 'empty'];

export const WALL_COLORS = [
  ['Ağ', '#f2efe9'], ['Süd', '#e4ddd2'], ['Bej', '#d9ccb9'], ['Qum', '#c9b597'],
  ['Adaçayı', '#b5bfa3'], ['Zeytun', '#8c936c'], ['Göy-boz', '#a8b5bf'], ['Dəniz', '#566f80'],
  ['Pudra', '#dcbfb4'], ['Terrakota', '#b9765f'], ['Qrafit', '#4b4c4f'], ['Meşə', '#3f5245'],
];
export const FLOORS = {
  wood: { name: 'Açıq palıd', sw: '#c49b72' },
  walnut: { name: 'Qoz', sw: '#6e4a32' },
  marble: { name: 'Mərmər', sw: '#ece8e1' },
  tile: { name: 'Keramika', sw: '#d4d0ca' },
  concrete: { name: 'Mikrosement', sw: '#a9a6a1' },
};
export const FABRICS = [
  ['Boz', '#8d8a86'], ['Qum', '#c2b39e'], ['Krem', '#e3dccf'], ['Zeytun', '#7d8360'],
  ['Göy', '#4f6478'], ['Konyak', '#9a6340'], ['Qrafit', '#3e4146'], ['Bordo', '#6e2f35'],
];
export const DEFAULT_WALL = '#e4ddd2';
export const DEFAULT_FABRIC = '#8d8a86';

export const STYLES = {
  scandi: { name: 'Skandinav', wall: '#f2efe9', floor: 'wood', fabric: '#c2b39e', accent: '#b5bfa3' },
  classic: { name: 'Müasir klassik', wall: '#e4ddd2', floor: 'walnut', fabric: '#8d8a86', accent: '#d9ccb9' },
  japandi: { name: 'Japandi', wall: '#d9ccb9', floor: 'wood', fabric: '#e3dccf', accent: '#8c936c' },
  loft: { name: 'Loft', wall: '#a9a6a1', floor: 'concrete', fabric: '#9a6340', accent: '#4b4c4f' },
  dark: { name: 'Tünd lüks', wall: '#4b4c4f', floor: 'walnut', fabric: '#4f6478', accent: '#3f5245' },
};

// Mebel əlavə etmə menyusu
export const CATALOG = [
  ['sofa', 'Divan'], ['armchair', 'Kreslo'], ['coffeeTable', 'Jurnal masası'], ['tv', 'TV konsol'],
  ['dining', 'Yemək masası'], ['bed', 'İkinəfərlik çarpayı'], ['singleBed', 'Tək çarpayı'], ['wardrobe', 'Dolab'],
  ['desk', 'İş masası'], ['shelf', 'Kitab rəfi'], ['console', 'Konsol + güzgü'], ['plant', 'Bitki'], ['rug', 'Xalça'],
];

/* ---------------- Əşyaların ölçüləri ----------------
   w — divar boyunca en, back — mərkəzdən arxaya, front — mərkəzdən önə (stullar daxil) */
const SPEC = {
  sofa: { w: 2.2, back: 0.48, front: 0.5, low: true },
  armchair: { w: 0.82, back: 0.42, front: 0.42, low: true },
  coffeeTable: { w: 1.1, back: 0.3, front: 0.3, low: true },
  tv: { w: 1.9, back: 0.1, front: 0.26 },
  kitchenRun: { w: (o) => o.len || 3, back: 0.31, front: 0.34 },
  fridge: { w: 0.8, back: 0.33, front: 0.36 },
  island: { w: 1.9, back: 0.5, front: 0.88 },
  dining: { w: (o) => (o.small ? 1.0 : 1.7), back: (o) => (o.small ? 0.85 : 0.93), front: (o) => (o.small ? 0.85 : 0.93) },
  bed: { w: 3.1, back: 1.05, front: 1.1 },
  singleBed: { w: 1.0, back: 1.04, front: 1.0 },
  wardrobe: { w: (o) => o.len || 2, back: 0.3, front: 0.3 },
  console: { w: 1.2, back: 0.18, front: 0.18, low: true },
  plant: { w: 0.44, back: 0.22, front: 0.22, low: true },
  desk: { w: 1.2, back: 0.3, front: 0.8, low: true },
  shelf: { w: (o) => o.len || 2, back: 0.18, front: 0.18 },
  rug: { w: (o) => o.w, back: (o) => o.d / 2, front: (o) => o.d / 2, flat: true },
  bathtub: { w: 1.7, back: 0.38, front: 0.38 },
  vanity: { w: (o) => (o.small ? 0.8 : 1.0), back: 0.25, front: 0.25 },
  toilet: { w: 0.4, back: 0.32, front: 0.3 },
  shower: { w: (o) => o.w, back: (o) => o.d, front: 0.05 },
  pendant: { w: 0.4, back: 0.2, front: 0.2, flat: true },
};
const val = (v, o) => (typeof v === 'function' ? v(o) : v);
export function specOf(it) {
  const s = SPEC[it.k] || { w: 0.5, back: 0.25, front: 0.25 };
  return { w: val(s.w, it), back: val(s.back, it), front: val(s.front, it), low: !!s.low, flat: !!s.flat };
}

/** Əşyanın döşəmədəki izi (oxlara paralel düzbucaqlı) */
export function itemRect(it) {
  const s = specOf(it);
  const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const lx of [-s.w / 2, s.w / 2]) for (const lz of [-s.back, s.front]) {
    const x = it.x + lx * c + lz * sn, z = it.z - lx * sn + lz * c;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, x1, z0, z1 };
}
const overlap = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
const gapBetween = (a, b) => Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1), Math.max(a.z0 - b.z1, b.z0 - a.z1));

export const roomAt = (plan, x, z) => plan.rooms_.find((r) => x >= r.x - 1e-3 && x <= r.x + r.w + 1e-3 && z >= r.z - 1e-3 && z <= r.z + r.d + 1e-3);

/* ---------------- Dizayn obyekti ---------------- */
export function allowedUses(room) {
  if (room.kind === 'bath' || room.kind === 'hall') return [room.kind];
  const area = room.w * room.d;
  return USE_ORDER.filter((u) => area >= USES[u].minArea && Math.min(room.w, room.d) >= (u === 'bedroom' || u === 'studio' ? 2.9 : 1.4));
}

function defaultUse(plan, r) {
  if (r.kind !== 'living') return r.kind;
  const inRoom = plan.furniture.filter((f) => roomAt(plan, f.x, f.z) === r).map((f) => f.k);
  if (inRoom.includes('kitchenRun')) return 'livingKitchen';
  if (inRoom.includes('bed')) return 'studio';
  return 'living';
}

export function defaultDesign(plan) {
  const rooms = {};
  for (const r of plan.rooms_) rooms[r.id] = { use: defaultUse(plan, r), wall: DEFAULT_WALL, floor: r.floor };
  const furniture = plan.furniture.map((f) => ({ ...f, room: (roomAt(plan, f.x, f.z) || plan.rooms_[0]).id }));
  return { v: 1, rooms, fabric: DEFAULT_FABRIC, furniture, style: null };
}

const KEY = (apt) => `nova-design-v1-${apt.id}`;
export function loadDesign(apt) {
  try {
    const raw = localStorage.getItem(KEY(apt));
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1 && d.rooms && Array.isArray(d.furniture)) return d;
    }
  } catch (e) { /* brauzer yaddaşı əlçatan deyil */ }
  return defaultDesign(apt.type);
}
export function saveDesign(apt, d) {
  try { localStorage.setItem(KEY(apt), JSON.stringify(d)); } catch (e) { /* yox */ }
}
export function clearDesign(apt) {
  try { localStorage.removeItem(KEY(apt)); } catch (e) { /* yox */ }
}
export function isCustom(apt) {
  try { return !!localStorage.getItem(KEY(apt)); } catch (e) { return false; }
}

/** Plan + dizayn → qurucular üçün "virtual" plan (pəncərələr orijinal kind-a görə qalır) */
export function designedPlan(plan, d) {
  return {
    ...plan,
    rooms_: plan.rooms_.map((r) => {
      const dr = d.rooms[r.id] || {};
      const use = dr.use || r.kind;
      return { ...r, use, name: use === r.kind && use !== 'living' ? r.name : USES[use]?.name || r.name, floor: dr.floor || r.floor, wall: dr.wall || DEFAULT_WALL };
    }),
    furniture: d.furniture,
  };
}

/* ---------------- Avtomatik düzülüş ---------------- */
function roomCtx(plan, slot, r, items) {
  const ext = exteriorSides(slot, plan);
  const { openings } = computeLayout(plan, ext);
  const isExt = (axis, c) =>
    (axis === 'h' && Math.abs(c) < 1e-3 && ext.front) || (axis === 'h' && Math.abs(c - plan.d) < 1e-3 && ext.back) ||
    (axis === 'v' && Math.abs(c) < 1e-3 && ext.left) || (axis === 'v' && Math.abs(c - plan.w) < 1e-3 && ext.right);
  const edges = [
    { id: 'N', axis: 'h', c: r.z, a: r.x, b: r.x + r.w, rot: 0, n: [0, 1] },
    { id: 'S', axis: 'h', c: r.z + r.d, a: r.x, b: r.x + r.w, rot: 180, n: [0, -1] },
    { id: 'W', axis: 'v', c: r.x, a: r.z, b: r.z + r.d, rot: 90, n: [1, 0] },
    { id: 'E', axis: 'v', c: r.x + r.w, a: r.z, b: r.z + r.d, rot: -90, n: [-1, 0] },
  ];
  for (const e of edges) {
    e.inset = (isExt(e.axis, e.c) ? T_EXT : T_INT) / 2 + 0.02;
    e.ops = openings.filter((o) => o.axis === e.axis && Math.abs(o.c - e.c) < 1e-3 && o.b > e.a + 1e-3 && o.a < e.b - 1e-3);
    e.hasWindow = e.ops.some((o) => o.type === 'window');
    e.hasDoor = e.ops.some((o) => o.type !== 'window');
  }
  const E = Object.fromEntries(edges.map((e) => [e.id, e]));
  const inner = { x0: r.x + E.W.inset, x1: r.x + r.w - E.E.inset, z0: r.z + E.N.inset, z1: r.z + r.d - E.S.inset };
  // qapıların önündəki boş sahə
  const zones = [];
  for (const e of edges) for (const o of e.ops) {
    if (o.type === 'window') continue;
    const a = Math.max(o.a - 0.12, e.a), b = Math.min(o.b + 0.12, e.b);
    const f0 = e.c + (e.n[0] + e.n[1]) * e.inset, f1 = e.c + (e.n[0] + e.n[1]) * (e.inset + 1.0);
    const lo = Math.min(f0, f1), hi = Math.max(f0, f1);
    zones.push(e.axis === 'h' ? { x0: a, x1: b, z0: lo, z1: hi } : { x0: lo, x1: hi, z0: a, z1: b });
  }
  const windows = edges.flatMap((e) => e.ops.filter((o) => o.type === 'window').map((o) => ({ e, mid: (o.a + o.b) / 2 })));
  const placed = items.filter((it) => !SPEC[it.k]?.flat).map(itemRect);
  return { r, edges, E, inner, zones, windows, placed, out: [] };
}

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
  return parts;
}

const inside = (ctx, rc) => rc.x0 >= ctx.inner.x0 - 1e-3 && rc.x1 <= ctx.inner.x1 + 1e-3 && rc.z0 >= ctx.inner.z0 - 1e-3 && rc.z1 <= ctx.inner.z1 + 1e-3;
function valid(ctx, rc, clear = 0.08, zones = true) {
  if (!inside(ctx, rc)) return false;
  for (const p of ctx.placed) if (overlap(rc, p, clear)) return false;
  if (zones) for (const z of ctx.zones) if (overlap(rc, z)) return false;
  return true;
}
// Əşyanın önündə gediş üçün boş zolaq
function frontStrip(it, depth) {
  const s = specOf(it);
  const a = ((it.rot || 0) * Math.PI) / 180;
  const fx = Math.sin(a), fz = Math.cos(a);
  const cx = it.x + fx * (s.front + depth / 2), cz = it.z + fz * (s.front + depth / 2);
  const hw = Math.abs(fx) > 0.5 ? depth / 2 : s.w / 2 - 0.1, hd = Math.abs(fx) > 0.5 ? s.w / 2 - 0.1 : depth / 2;
  return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd };
}

// Divara söykənən əşya üçün namizəd yerlər
function wallCands(ctx, k, o, opt) {
  const out = [];
  const base = { k, ...o };
  const s = specOf(base);
  const variable = opt.len; // [min, max] — dolab/mətbəx kimi uzunluğu dəyişən əşyalar
  for (const e of ctx.edges) {
    if (opt.edges && !opt.edges.includes(e.id)) continue;
    const blocks = e.ops.filter((op) => op.type !== 'window' || !(s.low || opt.underWindow)).map((op) => [op.a - 0.08, op.b + 0.08]);
    const lo0 = e.axis === 'h' ? ctx.inner.x0 : ctx.inner.z0, hi0 = e.axis === 'h' ? ctx.inner.x1 : ctx.inner.z1;
    for (const [lo, hi] of subtract(lo0, hi0, blocks)) {
      const L = hi - lo;
      const lens = variable ? [Math.min(variable[1], Math.floor(L * 20) / 20 - 0.02)] : [s.w];
      for (const len of lens) {
        if (len < (variable ? variable[0] : s.w) - 1e-6 || len > L + 1e-6) continue;
        const it = { ...base, ...(variable ? { len: +len.toFixed(2) } : {}), rot: e.rot };
        const sp = specOf(it);
        const dep = e.c + (e.n[0] + e.n[1]) * (e.inset + sp.back);
        const ps = new Set([+(lo + len / 2).toFixed(3), +(hi - len / 2).toFixed(3), +((lo + hi) / 2).toFixed(3)]);
        for (let p = lo + len / 2; p <= hi - len / 2 + 1e-6; p += 0.1) ps.add(+p.toFixed(3));
        for (const p of ps) {
          const c = { ...it, x: e.axis === 'h' ? p : dep, z: e.axis === 'h' ? dep : p };
          out.push({ it: c, e, p, lo, hi, corner: Math.abs(p - len / 2 - lo0) < 0.02 || Math.abs(p + len / 2 - hi0) < 0.02 });
        }
      }
    }
  }
  return out;
}

function commit(ctx, it, clear = true) {
  ctx.out.push(it);
  if (clear) ctx.placed.push(itemRect(it));
  return it;
}

function placeWall(ctx, k, o = {}, opt = {}) {
  let best = null, bestS = -Infinity;
  for (const c of wallCands(ctx, k, o, opt)) {
    const rc = itemRect(c.it);
    if (!valid(ctx, rc, opt.clear ?? 0.08)) continue;
    if (opt.front && !valid(ctx, frontStrip(c.it, opt.front), 0, true)) continue;
    const sc = (opt.score ? opt.score(c, rc) : 0) - Math.abs(c.p - (c.lo + c.hi) / 2) * 0.2;
    if (sc > bestS) { bestS = sc; best = c.it; }
  }
  return best ? commit(ctx, best) : null;
}

function placeFree(ctx, k, o = {}, opt = {}) {
  const rots = opt.rots || [0, 90];
  const clear = opt.clear ?? 0.3;
  const { x0, x1, z0, z1 } = ctx.inner;
  let best = null, bestS = -Infinity;
  for (const rot of rots) {
    for (let x = x0; x <= x1; x += 0.1) for (let z = z0; z <= z1; z += 0.1) {
      const it = { k, ...o, rot, x: +x.toFixed(2), z: +z.toFixed(2) };
      const rc = itemRect(it);
      if (!valid(ctx, rc, clear)) continue;
      // boş sahənin mərkəzinə yaxın olsun: ən yaxın maneəyə məsafə
      let g = Math.min(rc.x0 - x0, x1 - rc.x1, rc.z0 - z0, z1 - rc.z1);
      for (const p of ctx.placed) g = Math.min(g, gapBetween(rc, p));
      const sc = Math.min(g, 1.2) * 2 + (opt.score ? opt.score(it, rc) : 0);
      if (sc > bestS) { bestS = sc; best = it; }
    }
  }
  return best ? commit(ctx, best) : null;
}

function placeCorner(ctx, k, o = {}) {
  const s = specOf({ k, ...o });
  const { x0, x1, z0, z1 } = ctx.inner;
  const m = s.w / 2 + 0.06;
  const corners = [[x0 + m, z0 + m], [x1 - m, z0 + m], [x0 + m, z1 - m], [x1 - m, z1 - m]];
  const nearWin = ([x, z]) => Math.min(9, ...ctx.windows.map((w) => (w.e.axis === 'h' ? Math.hypot(x - w.mid, z - w.e.c) : Math.hypot(x - w.e.c, z - w.mid))));
  corners.sort((a, b) => nearWin(a) - nearWin(b));
  for (const [x, z] of corners) {
    const it = { k, ...o, x: +x.toFixed(2), z: +z.toFixed(2), rot: 0 };
    if (valid(ctx, itemRect(it), 0.05)) return commit(ctx, it);
  }
  return null;
}

const rc2 = (c) => ({ x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 });
const perpToWindow = (ctx, e) => ctx.windows.some((w) => w.e.axis !== e.axis);
const oppositeWindow = (ctx, e) => ctx.windows.some((w) => w.e.axis === e.axis && w.e.id !== e.id);
const depthFrom = (ctx, e) => (e.axis === 'h' ? ctx.inner.z1 - ctx.inner.z0 : ctx.inner.x1 - ctx.inner.x0);

function pendant(ctx, x, z) { ctx.out.push({ k: 'pendant', x: +x.toFixed(2), z: +z.toFixed(2) }); }

// TV + divan + jurnal masası + xalça + kreslo
function tvGroup(ctx) {
  const tv = placeWall(ctx, 'tv', {}, {
    score: (c) => (c.e.hasDoor ? -1.2 : 0) + Math.min(depthFrom(ctx, c.e), 4.6) * 0.6 + (perpToWindow(ctx, c.e) ? 0.8 : 0) - (c.e.hasWindow ? 3 : 0),
  });
  if (!tv) {
    const s = placeWall(ctx, 'sofa', {}, { front: 0.8 });
    if (s) pendant(ctx, s.x, s.z);
    return s;
  }
  const a = (tv.rot * Math.PI) / 180, nx = Math.sin(a), nz = Math.cos(a);
  const ts = specOf(tv), ss = SPEC.sofa;
  const room = depthFrom(ctx, ctx.edges.find((e) => e.rot === tv.rot));
  // divanın arxası qarşı divara söykənsin (məsafə uyğundursa), yoxsa ortada dayansın
  const wallD = room - ts.back - ss.back - 0.02;
  const ds = [];
  if (wallD - ts.front - ss.front <= 3.4) ds.push(wallD);
  for (let d = ts.front + 2.6 + ss.front; d >= ts.front + 1.7 + ss.front; d -= 0.1) ds.push(d);
  let sofa = null;
  for (const d of ds) {
    for (const side of [0, 0.25, -0.25, 0.5, -0.5]) {
      const it = { k: 'sofa', rot: tv.rot + 180, x: +(tv.x + nx * d + nz * side).toFixed(2), z: +(tv.z + nz * d - nx * side).toFixed(2) };
      if (valid(ctx, itemRect(it), 0.08)) { sofa = commit(ctx, it); break; }
    }
    if (sofa) break;
  }
  if (!sofa) return tv;
  // jurnal masası divanla TV arasında
  const ct = { k: 'coffeeTable', rot: sofa.rot, x: +(sofa.x - nx * (ss.front + 0.42 + 0.3)).toFixed(2), z: +(sofa.z - nz * (ss.front + 0.42 + 0.3)).toFixed(2) };
  if (valid(ctx, itemRect(ct), 0.05)) commit(ctx, ct);
  const mid = { x: (sofa.x + tv.x) / 2 + nx * 0.25, z: (sofa.z + tv.z) / 2 + nz * 0.25 };
  const along = Math.min(2.8, (Math.abs(nx) > 0.5 ? ctx.inner.z1 - ctx.inner.z0 : ctx.inner.x1 - ctx.inner.x0) - 0.4);
  const across = Math.max(1.6, Math.min(3.0, Math.hypot(sofa.x - tv.x, sofa.z - tv.z) - 0.3));
  ctx.out.push({ k: 'rug', x: +mid.x.toFixed(2), z: +mid.z.toFixed(2), w: +(Math.abs(nx) > 0.5 ? across : along).toFixed(2), d: +(Math.abs(nx) > 0.5 ? along : across).toFixed(2) });
  pendant(ctx, ct.x, ct.z);
  // kreslo divanın yanında, masaya baxır
  for (const side of [1, -1]) {
    const px = sofa.x + nz * side * 1.6 - nx * 0.9, pz = sofa.z - nx * side * 1.6 - nz * 0.9;
    const rot = (Math.atan2(ct.x - px, ct.z - pz) * 180) / Math.PI;
    const it = { k: 'armchair', rot: Math.round(rot / 15) * 15, x: +px.toFixed(2), z: +pz.toFixed(2) };
    if (valid(ctx, itemRect(it), 0.1)) { commit(ctx, it); break; }
  }
  return sofa;
}

const GEN = {
  living(ctx) {
    tvGroup(ctx);
    if (ctx.r.w * ctx.r.d >= 24) { const d = placeFree(ctx, 'dining', {}, { clear: 0.35 }); if (d) pendant(ctx, d.x, d.z); }
    placeCorner(ctx, 'plant');
  },
  livingKitchen(ctx) {
    const kr = placeWall(ctx, 'kitchenRun', {}, { len: [2.0, 3.4], front: 0.9, score: (c) => (c.it.len || 0) * 1.5 - (c.e.hasDoor ? 0.5 : 0) + (c.corner ? 0.6 : 0) });
    tvGroup(ctx);
    const small = ctx.r.w * ctx.r.d < 30;
    const d = placeFree(ctx, 'dining', { small }, { clear: 0.3, score: (it) => (kr ? -Math.hypot(it.x - kr.x, it.z - kr.z) * 0.25 : 0) });
    if (d) pendant(ctx, d.x, d.z);
    placeCorner(ctx, 'plant');
  },
  studio(ctx) {
    const b = placeWall(ctx, 'bed', {}, { front: 0.6, score: (c) => (perpToWindow(ctx, c.e) ? 1.5 : 0) + (c.corner ? 0.5 : 0) - (c.e.hasDoor ? 1 : 0) });
    if (b) pendant(ctx, b.x, b.z);
    tvGroup(ctx);
    placeCorner(ctx, 'plant');
  },
  bedroom(ctx) {
    let b = placeWall(ctx, 'bed', {}, { front: 0.6, score: (c) => (perpToWindow(ctx, c.e) ? 2 : 0) + (oppositeWindow(ctx, c.e) ? 1 : 0) - (c.e.hasDoor ? 0.6 : 0) - Math.abs(c.p - (c.lo + c.hi) / 2) * 1.5 });
    if (!b) b = placeWall(ctx, 'singleBed', {}, { front: 0.5, score: (c) => (c.corner ? 2 : 0) });
    if (b) {
      const a = (b.rot * Math.PI) / 180;
      ctx.out.push({ k: 'rug', rot: b.rot, x: +(b.x + Math.sin(a) * 0.45).toFixed(2), z: +(b.z + Math.cos(a) * 0.45).toFixed(2), w: 2.3, d: 2.4 });
      pendant(ctx, b.x + Math.sin(a) * 0.3, b.z + Math.cos(a) * 0.3);
    }
    placeWall(ctx, 'wardrobe', {}, { len: [1.0, 2.4], front: 0.6, score: (c) => (c.it.len || 0) + (c.corner ? 0.6 : 0) - (c.e.hasDoor ? 0.3 : 0) });
    placeWall(ctx, 'armchair', {}, { score: (c) => (c.e.hasWindow ? 1 : 0) + (c.corner ? 1 : 0) });
    placeCorner(ctx, 'plant');
  },
  kids(ctx) {
    const b = placeWall(ctx, 'singleBed', {}, { front: 0.5, score: (c) => (c.corner ? 2 : 0) - (c.e.hasDoor ? 0.5 : 0) + (perpToWindow(ctx, c.e) ? 0.5 : 0) });
    placeWall(ctx, 'desk', {}, { underWindow: true, score: (c) => (c.e.hasWindow ? 2 : 0) + (c.corner ? 0.3 : 0) });
    placeWall(ctx, 'wardrobe', {}, { len: [0.9, 1.8], front: 0.6, score: (c) => (c.it.len || 0) + (c.corner ? 0.5 : 0) });
    const c = { x: (ctx.inner.x0 + ctx.inner.x1) / 2, z: (ctx.inner.z0 + ctx.inner.z1) / 2 };
    const rw = Math.min(1.8, ctx.inner.x1 - ctx.inner.x0 - 1.2), rd = Math.min(2.2, ctx.inner.z1 - ctx.inner.z0 - 1.2);
    if (rw > 0.8 && rd > 0.8) ctx.out.push({ k: 'rug', x: +c.x.toFixed(2), z: +c.z.toFixed(2), w: +rw.toFixed(2), d: +rd.toFixed(2), color: '#9fb6c9' });
    pendant(ctx, c.x, c.z);
    if (!b) placeCorner(ctx, 'plant');
  },
  office(ctx) {
    const d = placeWall(ctx, 'desk', {}, { underWindow: true, score: (c) => (c.e.hasWindow ? 2.5 : 0) });
    placeWall(ctx, 'shelf', {}, { len: [1.0, 2.2], score: (c) => (c.it.len || 0) + (d && c.it.rot === d.rot + 180 ? 0.5 : 0) });
    placeWall(ctx, 'armchair', {}, { score: (c) => (c.corner ? 1 : 0) });
    placeCorner(ctx, 'plant');
    const c = { x: (ctx.inner.x0 + ctx.inner.x1) / 2, z: (ctx.inner.z0 + ctx.inner.z1) / 2 };
    pendant(ctx, d ? d.x : c.x, d ? d.z : c.z);
  },
  kitchen(ctx) {
    const kr = placeWall(ctx, 'kitchenRun', {}, { len: [1.6, 3.8], front: 0.9, score: (c) => (c.it.len || 0) * 1.5 + (c.corner ? 0.8 : 0) - (c.e.hasDoor ? 0.5 : 0) });
    if (kr) {
      const kRect = itemRect(kr);
      placeWall(ctx, 'fridge', {}, { front: 0.7, score: (c, rc) => -gapBetween(rc, kRect) * 3 });
    }
    const small = ctx.r.w * ctx.r.d < 13;
    const d = placeFree(ctx, 'dining', { small }, { clear: 0.3 });
    if (d) pendant(ctx, d.x, d.z);
    else placeCorner(ctx, 'plant');
  },
  dining(ctx) {
    const d = placeFree(ctx, 'dining', { small: ctx.r.w * ctx.r.d < 11 }, { clear: 0.4 });
    if (d) pendant(ctx, d.x, d.z);
    placeWall(ctx, 'console', {}, { score: (c) => (c.e.hasWindow ? -1 : 0) });
    placeCorner(ctx, 'plant');
  },
  wardrobe(ctx) {
    for (let i = 0; i < 4; i++) {
      if (!placeWall(ctx, 'wardrobe', {}, { len: [0.8, 3.2], front: 0.5, score: (c) => (c.it.len || 0) })) break;
    }
    const c = { x: (ctx.inner.x0 + ctx.inner.x1) / 2, z: (ctx.inner.z0 + ctx.inner.z1) / 2 };
    pendant(ctx, c.x, c.z);
  },
  empty(ctx) {
    pendant(ctx, (ctx.inner.x0 + ctx.inner.x1) / 2, (ctx.inner.z0 + ctx.inner.z1) / 2);
  },
};

/**
 * Otağı seçilmiş təyinata görə yenidən əşyalarla doldur.
 * d.furniture dəyişir (həmin otağın köhnə əşyaları silinir).
 */
export function furnishRoom(plan, slot, d, roomId, use) {
  const r = plan.rooms_.find((x) => x.id === roomId);
  if (!r) return;
  d.rooms[roomId] = { ...d.rooms[roomId], use };
  if (use === r.kind && use !== 'living' && (use === 'bath' || use === 'hall')) return;
  const others = d.furniture.filter((f) => f.room !== roomId);
  const ctx = roomCtx(plan, slot, r, others.filter((f) => roomAt(plan, f.x, f.z) === r));
  (GEN[use] || GEN.empty)(ctx);
  d.furniture = [...others, ...ctx.out.map((it) => ({ ...it, room: roomId }))];
}

/** Hamısını avtomatik düz */
export function furnishAll(plan, slot, d) {
  for (const r of plan.rooms_) {
    const use = d.rooms[r.id]?.use || r.kind;
    if (USES[use]?.fixed) continue;
    furnishRoom(plan, slot, d, r.id, use);
  }
}

/** Seçilmiş otağa yeni əşya əlavə et (uyğun boş yer tapılır) */
export function addItem(plan, slot, d, roomId, k) {
  const r = plan.rooms_.find((x) => x.id === roomId);
  if (!r) return null;
  const ctx = roomCtx(plan, slot, r, d.furniture.filter((f) => f.k !== 'pendant' && roomAt(plan, f.x, f.z) === r));
  let it = null;
  if (k === 'rug') {
    const w = Math.min(2.4, r.w - 1), dd = Math.min(1.8, r.d - 1);
    it = { k, x: r.x + r.w / 2, z: r.z + r.d / 2, w: +Math.max(1, w).toFixed(2), d: +Math.max(1, dd).toFixed(2) };
  } else if (k === 'dining' || k === 'coffeeTable') it = placeFree(ctx, k, k === 'dining' ? { small: r.w * r.d < 12 } : {}, { clear: 0.2 });
  else if (k === 'plant') it = placeCorner(ctx, k) || placeFree(ctx, k, {}, { clear: 0.05 });
  else if (k === 'wardrobe' || k === 'shelf') it = placeWall(ctx, k, {}, { len: [0.8, k === 'shelf' ? 2.0 : 2.4], score: (c) => c.it.len || 0 });
  else it = placeWall(ctx, k, {}, { underWindow: k === 'desk' }) || placeFree(ctx, k, {}, { clear: 0.1 });
  if (!it) {
    // yer tapılmadı — otağın ortasına qoy (istifadəçi özü sürüşdürəcək)
    it = { k, x: +(r.x + r.w / 2).toFixed(2), z: +(r.z + r.d / 2).toFixed(2), rot: 0 };
    if (k === 'wardrobe' || k === 'shelf') it.len = 1.4;
  }
  const out = { ...it, room: roomId };
  d.furniture.push(out);
  return out;
}

/** Əşya bu yerə sığırmı: divarın o tayına keçmir və başqa əşyaya girmir */
export function placementOk(plan, furniture, idx, it) {
  const r = roomAt(plan, it.x, it.z);
  if (!r) return false;
  const s = SPEC[it.k];
  if (s && s.flat) return true;
  const rc = itemRect(it), t = 0.01;
  if (rc.x0 < r.x - t || rc.x1 > r.x + r.w + t || rc.z0 < r.z - t || rc.z1 > r.z + r.d + t) return false;
  return furniture.every((f, i) => i === idx || SPEC[f.k]?.flat || !overlap(rc, itemRect(f), -0.06));
}

/** Stil: bütün yaşayış otaqlarına rəng + döşəmə + parça */
export function applyStyle(plan, d, key) {
  const s = STYLES[key];
  if (!s) return;
  d.style = key;
  d.fabric = s.fabric;
  for (const r of plan.rooms_) {
    const dr = d.rooms[r.id];
    const use = dr.use;
    if (use === 'bath') { dr.wall = s.wall === '#4b4c4f' ? '#d9d6d0' : s.wall; continue; }
    dr.wall = use === 'bedroom' || use === 'kids' ? s.accent === '#4b4c4f' ? s.wall : s.accent : s.wall;
    if (use === 'kitchen' || use === 'hall') dr.floor = s.floor === 'concrete' ? 'concrete' : 'marble';
    else dr.floor = s.floor;
  }
}
