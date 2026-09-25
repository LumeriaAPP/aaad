// Kamera qoruyucusu: kameranın binaların içinə girməsinin qarşısını alır,
// 3D seçimdə isə görünüşü kəsən qonşu binaları müvəqqəti yerə endirir.
import * as THREE from 'three';
import { BUILDING, floorBaseY } from './data.js';
import { NEIGHBORS } from './complex.js';

// Binalar fırlanmış qutular kimi: mərkəz (x, z), bucaq, yarım en/dərinlik, hündürlük
const TOWER = { x: 0, z: 0, rot: 0, hw: BUILDING.width / 2 + 2.2, hd: BUILDING.depth / 2 + 2.2, h: floorBaseY(BUILDING.lastFloor + 1) + 7, kind: 'tower' };
const PODIUM = { x: 0, z: 0, rot: 0, hw: 25.5, hd: 20.5, h: BUILDING.groundHeight + 1.8, kind: 'tower' };
const nbBox = (n) => ({ x: n.x, z: n.z, rot: n.rot, hw: n.w / 2 + 1.6, hd: n.d / 2 + 1.6, h: 8.8 + n.floors * 3.2 + 4.4, kind: 'neighbor', id: n.id });

export const STATIC_BOXES = [TOWER, PODIUM, ...NEIGHBORS.map(nbBox)];

function toLocal(b, x, z) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const dx = x - b.x, dz = z - b.z;
  // three.js-in Y fırlanmasının tərsi
  return [dx * c - dz * s, dx * s + dz * c];
}
function toWorld(b, lx, lz) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
}

/** Nöqtə qutunun (m qədər genişləndirilmiş) içindədirmi */
export function inside(b, p, m = 0) {
  const [lx, lz] = toLocal(b, p.x, p.z);
  return Math.abs(lx) < b.hw + m && Math.abs(lz) < b.hd + m && p.y < b.h + m;
}

/** a→b parçası qutunu kəsirmi (qutu m qədər genişləndirilir) */
export function segmentHits(box, a, b, m = 0) {
  const [ax, az] = toLocal(box, a.x, a.z);
  const [bx, bz] = toLocal(box, b.x, b.z);
  let t0 = 0, t1 = 1;
  const slab = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let u = (lo - p) / d, v = (hi - p) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    return t0 <= t1;
  };
  return slab(ax, bx - ax, -box.hw - m, box.hw + m) && slab(az, bz - az, -box.hd - m, box.hd + m) && slab(a.y, b.y - a.y, -5, box.h + m);
}

/** Nöqtəni ən yaxın üzdən qutudan çıxar (aşağıya doğru yox). Dəyişibsə true qaytarır. */
function pushOutOf(b, p, m) {
  const [lx, lz] = toLocal(b, p.x, p.z);
  const hw = b.hw + m, hd = b.hd + m, h = b.h + m;
  if (!(Math.abs(lx) < hw && Math.abs(lz) < hd && p.y < h)) return false;
  const px = hw - Math.abs(lx), pz = hd - Math.abs(lz), py = h - p.y;
  let nx = lx, nz = lz;
  if (py <= px && py <= pz) p.y = h;
  else if (px <= pz) nx = Math.sign(lx || 1) * hw;
  else nz = Math.sign(lz || 1) * hd;
  if (nx !== lx || nz !== lz) [p.x, p.z] = toWorld(b, nx, nz);
  return true;
}

export class CamGuard {
  constructor() {
    this.city = []; // şəhər həcmləri (səhnədən oxunur)
    this.nb = new Map(); // qonşu id → { box, group, ghost, sink, want, since }
  }

  /** Səhnə qurulandan sonra: şəhər həcmlərini və qonşu binaların qruplarını tap */
  collect(scene) {
    const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.userData.cityMass) {
        o.updateMatrixWorld(true);
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          m4.premultiply(o.matrixWorld).decompose(pos, q, sc);
          this.city.push({ x: pos.x, z: pos.z, rot: 0, hw: sc.x / 2 + 0.5, hd: sc.z / 2 + 0.5, h: pos.y + sc.y + 0.5, kind: 'city' });
        }
      }
      if (o.userData.neighbor != null) {
        const box = STATIC_BOXES.find((b) => b.id === o.userData.neighbor);
        if (box) this.nb.set(box.id, { box, group: o, ghost: this._ghost(box, scene), sink: 0, want: 0, since: 0 });
      }
    });
  }

  // Yerə enən binanın yerində qalan şüşəvari kontur (kölgəni də saxlayır)
  _ghost(b, scene) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.rot;
    const geo = new THREE.BoxGeometry(b.hw * 2 - 2.4, b.h - 4, b.hd * 2 - 2.4).translate(0, (b.h - 4) / 2 - 0.4, 0);
    const box = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe8eef5, transparent: true, opacity: 0, depthWrite: false }));
    box.castShadow = true; // günəş simulyasiyasında kölgə itməsin
    box.userData.noAO = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    g.add(box, edges);
    g.visible = false;
    g.userData.box = box;
    g.userData.edges = edges;
    scene.add(g);
    return g;
  }

  /**
   * Kameranı binalardan kənarda saxla.
   * opts.neighbors — qonşu binalar da nəzərə alınsın; opts.tower — əsas bina və podium
   */
  pushOut(p, m = 2.5, opts = {}) {
    const { neighbors = true, tower = true, city = true, ground = 1.2 } = opts;
    let moved = false;
    for (let it = 0; it < 2; it++) {
      for (const b of STATIC_BOXES) {
        if (b.kind === 'tower' ? !tower : !neighbors) continue;
        if (pushOutOf(b, p, m)) moved = true;
      }
      if (city) for (const b of this.city) if (pushOutOf(b, p, m)) moved = true;
    }
    if (p.y < ground) { p.y = ground; moved = true; }
    return moved;
  }

  /**
   * 3D seçim rejimi: kamera ilə baxılan nöqtələr arasındakı qonşu binaları yerə endir.
   * points — bir neçə hədəf nöqtə (null → hamısını qaldır)
   */
  update(camera, points, dt, now) {
    for (const n of this.nb.values()) {
      let want = 0;
      if (points) {
        const near = inside(n.box, camera.position, 9);
        // histerezis: enmiş bina yalnız görünüş aydın açılanda qalxır
        const m = n.want ? 5 : 1;
        want = near || points.some((p) => segmentHits(n.box, camera.position, p, m)) ? 1 : 0;
      }
      if (want !== n.want && (want || now - n.since > 450)) { n.want = want; n.since = now; }
      const rate = n.want && inside(n.box, camera.position, 2) ? 16 : 5;
      n.sink += (n.want - n.sink) * (1 - Math.exp(-dt * rate));
      if (Math.abs(n.sink - n.want) < 0.002) n.sink = n.want;
      const s = Math.max(0.015, 1 - n.sink);
      n.group.scale.y = s;
      n.group.visible = s > 0.02;
      n.ghost.visible = n.sink > 0.01;
      n.ghost.userData.box.material.opacity = 0.07 * n.sink;
      n.ghost.userData.edges.material.opacity = 0.42 * n.sink;
    }
  }

  /** Hamısı dərhal yerinə (məs. saytın əsas hissəsinə qayıdanda) */
  reset() {
    for (const n of this.nb.values()) {
      n.want = n.sink = 0;
      n.group.scale.y = 1;
      n.group.visible = true;
      n.ghost.visible = false;
    }
  }

  get anySunk() {
    for (const n of this.nb.values()) if (n.sink > 0) return true;
    return false;
  }
}
