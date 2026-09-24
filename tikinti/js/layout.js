// Plan məlumatından divar seqmentlərini, qapı və pəncərə açılışlarını hesablayır.
// Həm 3D interyer (interior.js), həm də 2D SVG planlar (plan-svg.js) bundan istifadə edir.
import { BUILDING } from './data.js';

export const T_EXT = 0.25;
export const T_INT = 0.12;
const EPS = 1e-4;
const eq = (a, b) => Math.abs(a - b) < EPS;

// Pəncərə ölçüləri otağın növündən asılıdır
export function windowFor(kind, a, b) {
  const L = b - a;
  const mid = (a + b) / 2;
  const centered = (w, sill, head) => {
    w = Math.min(L - 1.0, w);
    if (w < 0.5) return null;
    return { a: mid - w / 2, b: mid + w / 2, sill, head };
  };
  switch (kind) {
    case 'living':
      if (L < 1.6) return null;
      return { a: a + 0.45, b: b - 0.45, sill: 0.04, head: 2.72, panoramic: true };
    case 'bedroom':
    case 'kids':
      return centered(2.4, 0.45, 2.62);
    case 'kitchen':
      return centered(1.8, 0.95, 2.5);
    case 'bath':
      return centered(0.9, 1.5, 2.3);
    default:
      return null;
  }
}

// Planın hansı tərəfləri binanın xarici fasadına düşür
export function exteriorSides(slot, plan) {
  const { width: W, depth: D } = BUILDING;
  const fx = (x) => (slot.mx ? slot.ox + plan.w - x : slot.ox + x);
  const fz = (z) => (slot.mz ? slot.oz + plan.d - z : slot.oz + z);
  const onX = (v) => eq(v, 0) || eq(v, W);
  const onZ = (v) => eq(v, 0) || eq(v, D);
  return {
    front: onZ(fz(0)),
    back: onZ(fz(plan.d)),
    left: onX(fx(0)),
    right: onX(fx(plan.w)),
  };
}

function union(list) {
  const s = [...list].sort((p, q) => p.a - q.a);
  const out = [];
  for (const it of s) {
    const last = out[out.length - 1];
    if (last && it.a <= last.b + EPS) last.b = Math.max(last.b, it.b);
    else out.push({ a: it.a, b: it.b });
  }
  return out;
}

/**
 * Nəticə:
 *  segs:     divar parçaları {axis, c, a, b, t, y0, y1, exterior, part}
 *  openings: {axis, c, a, b, t, type: 'door'|'arch'|'window', sill, head, entry, panoramic}
 *  colliders: 2D maneələr {x0, x1, z0, z1}
 */
export function computeLayout(plan, ext = { front: true }) {
  const lines = new Map();
  const add = (axis, c, a, b, room) => {
    const key = axis + ':' + c.toFixed(3);
    if (!lines.has(key)) lines.set(key, { axis, c, items: [] });
    lines.get(key).items.push({ a, b, room });
  };
  for (const r of plan.rooms_) {
    add('h', r.z, r.x, r.x + r.w, r);
    add('h', r.z + r.d, r.x, r.x + r.w, r);
    add('v', r.x, r.z, r.z + r.d, r);
    add('v', r.x + r.w, r.z, r.z + r.d, r);
  }

  const segs = [];
  const openings = [];
  const colliders = [];

  const pushSeg = (line, a, b, t, y0, y1, exterior, part) => {
    if (b - a < EPS || y1 - y0 < EPS) return;
    segs.push({ axis: line.axis, c: line.c, a, b, t, y0, y1, exterior, part });
  };
  const pushCollider = (line, a, b, t) => {
    if (b - a < EPS) return;
    if (line.axis === 'h') colliders.push({ x0: a, x1: b, z0: line.c - t / 2, z1: line.c + t / 2 });
    else colliders.push({ x0: line.c - t / 2, x1: line.c + t / 2, z0: a, z1: b });
  };

  for (const line of lines.values()) {
    const { axis, c } = line;
    const exterior =
      (axis === 'h' && eq(c, 0) && ext.front) ||
      (axis === 'h' && eq(c, plan.d) && ext.back) ||
      (axis === 'v' && eq(c, 0) && ext.left) ||
      (axis === 'v' && eq(c, plan.w) && ext.right);
    const t = exterior ? T_EXT : T_INT;

    const ops = [];
    for (const d of plan.doors) {
      const onLine = (d.along === 'x' && axis === 'h' && eq(d.z, c)) || (d.along === 'z' && axis === 'v' && eq(d.x, c));
      if (!onLine) continue;
      const p = d.along === 'x' ? d.x : d.z;
      ops.push({ a: p - d.w / 2, b: p + d.w / 2, type: d.open ? 'arch' : 'door', entry: !!d.entry });
    }
    if (exterior) {
      for (const it of line.items) {
        const w = windowFor(it.room.kind, it.a, it.b);
        if (w) ops.push({ ...w, type: 'window', room: it.room.id });
      }
    }
    ops.sort((p, q) => p.a - q.a);

    for (const m of union(line.items)) {
      let cursor = m.a - t / 2;
      const end = m.b + t / 2;
      for (const op of ops) {
        if (op.a < m.a - EPS || op.b > m.b + EPS) continue;
        pushSeg(line, cursor, op.a, t, 0, 3, exterior, 'wall');
        pushCollider(line, cursor, op.a, t);
        if (op.type === 'window') {
          pushSeg(line, op.a, op.b, t, 0, op.sill, exterior, 'sill');
          pushSeg(line, op.a, op.b, t, op.head, 3, exterior, 'header');
          pushCollider(line, op.a, op.b, t);
        } else {
          pushSeg(line, op.a, op.b, t, op.type === 'arch' ? 2.45 : 2.15, 3, exterior, 'lintel');
          if (op.entry) pushCollider(line, op.a, op.b, t);
        }
        openings.push({ axis, c, t, ...op });
        cursor = op.b;
      }
      pushSeg(line, cursor, end, t, 0, 3, exterior, 'wall');
      pushCollider(line, cursor, end, t);
    }
  }
  return { segs, openings, colliders };
}
