// Nümunə yeməklərin 3D modelləri (real ölçü, metr). Brauzerdə qurulur, GLB/USDZ kimi ixrac olunur.
// Realizm üçün: səs-küy (noise) əsaslı rəng + relyef (normal map) + kələ-kötürlük xəritələri,
// həndəsənin özü də yerdəyişmə (displacement) ilə qeyri-bərabərdir.
// Hər yeməyin altı (0,0,0) masanın səthindədir.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================= səs-küy ================= */
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * rnd();
const PERM = new Uint8Array(512);
function reseed(s) {
  seed = s;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (i, j) => PERM[(PERM[(xi + i) & 255] + yi + j) & 255] / 255;
  const u = fade(xf), v = fade(yf);
  return lerp(lerp(h(0, 0), h(1, 0), u), lerp(h(0, 1), h(1, 1), u), v);
}
function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, oct)); }
const noise3 = (x, y, z) => (vnoise(x + z * 1.7, y - z * 1.3) + vnoise(y * 0.9 + 11.3, z * 1.1 - 7.1) + vnoise(z + 3.3, x - 5.9)) / 3;

/* ================= teksturalar =================
   surface(size, fn): fn(u, v) → [r, g, b, height(0..1), roughness(0..1)]
   Qaytarır: { map, normalMap, roughnessMap } */
function surface(size, fn, { normal = 3, repeat = 1 } = {}) {
  const col = new Uint8ClampedArray(size * size * 4), H = new Float32Array(size * size), rough = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b, h = 0.5, ro = 0.7] = fn(x / size, y / size);
    const i = y * size + x;
    col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = 255;
    H[i] = h;
    const q = ro * 255; rough[i * 4] = q; rough[i * 4 + 1] = q; rough[i * 4 + 2] = q; rough[i * 4 + 3] = 255;
  }
  const nrm = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const hx = H[y * size + ((x + 1) % size)] - H[y * size + ((x - 1 + size) % size)];
    const hy = H[((y + 1) % size) * size + x] - H[((y - 1 + size) % size) * size + x];
    let nx = -hx * normal * size / 64, ny = hy * normal * size / 64, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm[i * 4] = (nx * 0.5 + 0.5) * 255; nrm[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nrm[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; nrm[i * 4 + 3] = 255;
  }
  const mk = (data, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    t.userData.mimeType = 'image/jpeg';
    return t;
  };
  return { map: mk(col, true), normalMap: mk(nrm, false), roughnessMap: mk(rough, false) };
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function mat(tex, o = {}) {
  return new THREE.MeshPhysicalMaterial({ map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, roughness: 1, ...o });
}

/* ================= həndəsə köməkçiləri ================= */
const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; }
function merge(list) { return mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; })); }
function scatter(base, n, place) {
  const geos = [];
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    if (place(o, i) === false) continue;
    o.updateMatrix();
    geos.push(base.clone().applyMatrix4(o.matrix));
  }
  return merge(geos);
}
// təpələri normal boyunca yerdəyişdir
function displace(geo, fn) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = fn(v.x, v.y, v.z);
    p.setXYZ(i, v.x + n.getX(i) * d, v.y + n.getY(i) * d, v.z + n.getZ(i) * d);
  }
  geo.computeVertexNormals();
  return geo;
}
// dairəvi şəbəkə (içində təpələr var — relyef verilə bilir)
function polarGrid(r, rings, segs, heightFn) {
  const pos = [], uv = [], idx = [];
  pos.push(0, heightFn(0, 0), 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) {
    const rr = (i / rings) * r;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, heightFn(x, z), z); uv.push(0.5 + x / (2 * r), 0.5 - z / (2 * r));
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + ((j + 1) % segs), c = 1 + i * segs + j, d = 1 + i * segs + ((j + 1) % segs);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ================= qablar ================= */
const porcelain = () => new THREE.MeshPhysicalMaterial({ color: 0xf8f6f1, roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.08 });
function plate(r) {
  return mesh(lathe([[0.0001, 0], [r * 0.6, 0], [r * 0.63, 0.004], [r * 0.68, 0.0085], [r * 0.86, 0.013], [r, 0.021], [r - 0.004, 0.0235], [r * 0.85, 0.0165], [r * 0.68, 0.0115], [r * 0.63, 0.009], [0.0001, 0.009]], 128), porcelain());
}
function woodTex() {
  reseed(5);
  return surface(1024, (u, v) => {
    const x = u * 6, y = v * 40;
    const ring = fbm(x * 0.6, y * 0.05 + fbm(x, y * 0.1) * 2, 4);
    const grain = Math.sin((y * 0.35 + ring * 10) * 2.2) * 0.5 + 0.5;
    const pores = fbm(u * 400, v * 12, 2);
    const c = mix(hex(0x7a4a2a), hex(0xb07b4c), grain * 0.35 + ring * 0.65);
    const k = 0.9 + pores * 0.14;
    return [c[0] * k, c[1] * k, c[2] * k, pores * 0.6 + grain * 0.1, 0.5 + pores * 0.25];
  }, { normal: 0.35 });
}
function board(w, d, rad = 0) {
  const t = woodTex();
  let geo;
  if (rad) geo = new THREE.CylinderGeometry(rad, rad, 0.02, 96).translate(0, 0.01, 0);
  else {
    const s = new THREE.Shape(); const hw = w / 2, hd = d / 2, c = 0.02;
    s.moveTo(-hw + c, -hd); s.lineTo(hw - c, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + c); s.lineTo(hw, hd - c); s.quadraticCurveTo(hw, hd, hw - c, hd); s.lineTo(-hw + c, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - c); s.lineTo(-hw, -hd + c); s.quadraticCurveTo(-hw, -hd, -hw + c, -hd);
    geo = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, 0.002, 0);
    const p = geo.attributes.position, uvA = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uvA.setXY(i, (p.getX(i) + hw) / w, (p.getZ(i) + hd) / d);
  }
  return mesh(geo, mat(t));
}

/* ================= yeməklər ================= */
export const DISHES = {
  pizza() {
    reseed(11);
    const g = new THREE.Group();
    g.add(board(0.4, 0.4, 0.19));
    reseed(12);
    const r = 0.15, y0 = 0.02;
    const blobs = [];
    for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.68; blobs.push([Math.cos(a) * d, Math.sin(a) * d, R(0.013, 0.024)]); }
    const cheese = (x, z) => {
      let c = 0;
      const w = (fbm(x * 60 + 3, z * 60, 3) - 0.5) * 0.012;
      for (const [bx, bz, br] of blobs) { const d = Math.hypot(x - bx, z - bz) + w; c = Math.max(c, smooth(br, br * 0.55, d)); }
      return c;
    };
    const topH = (x, z) => y0 + 0.0045 + cheese(x, z) * 0.0035 + (fbm(x * 90, z * 90, 3) - 0.5) * 0.0012;
    const topTex = surface(1024, (u, v) => {
      const x = (u - 0.5) * 2 * r * 0.87, z = -(v - 0.5) * 2 * r * 0.87;
      const c = cheese(x, z);
      const n = fbm(u * 40, v * 40, 4), n2 = fbm(u * 140 + 9, v * 140, 3);
      let col = mix(hex(0x8a150b), hex(0xc0321c), n * 0.8 + n2 * 0.2);
      if (fbm(u * 26 + 5, v * 26, 3) > 0.62) col = mix(col, hex(0x7e140b), 0.5);
      const brown = smooth(0.35, 0.6, c) * (1 - smooth(0.7, 0.95, c)) * smooth(0.55, 0.75, fbm(u * 70, v * 70, 3));
      col = mix(col, mix(hex(0xfaf1d8), hex(0xe8c98a), n2 * 0.5), smooth(0.15, 0.5, c));
      col = mix(col, hex(0xb07a3a), brown * 0.8);
      const oil = (1 - c) * smooth(0.55, 0.8, fbm(u * 50 + 20, v * 50, 3));
      return [col[0], col[1], col[2], c * 0.6 + n2 * 0.25, lerp(0.42, 0.18, oil) + c * 0.12];
    }, { normal: 2.5 });
    g.add(mesh(polarGrid(r * 0.87, 70, 180, topH), mat(topTex, { clearcoat: 0.15, clearcoatRoughness: 0.4 })));
    // qabarıq kənar: torus + noise, üstündə yanıq "bəbir" ləkələri
    const crustTex = surface(1024, (u, v) => {
      const n = fbm(u * 18, v * 5, 5), n2 = fbm(u * 90, v * 25, 3);
      let col = mix(hex(0xe9c48e), hex(0xc98b4c), smooth(0.35, 0.8, n));
      const top = Math.sin(v * Math.PI * 2 - 0.4) * 0.5 + 0.5;
      col = mix(col, hex(0xa9642a), top * 0.45 * n);
      const spot = smooth(0.72, 0.8, fbm(u * 60 + 7, v * 16, 3)) * top;
      col = mix(col, hex(0x2a160c), spot * 0.9);
      col = mix(col, hex(0xf6eee0), smooth(0.8, 0.9, n2) * 0.35);
      return [col[0], col[1], col[2], n * 0.7 + spot * 0.3, 0.72 + spot * 0.2];
    }, { normal: 3 });
    const crustGeo = new THREE.TorusGeometry(r * 0.905, 0.017, 36, 220).rotateX(Math.PI / 2).scale(1, 0.72, 1).translate(0, y0 + 0.011, 0);
    displace(crustGeo, (x, y, z) => { const a = Math.atan2(z, x); return (noise3(Math.cos(a) * 6, y * 80, Math.sin(a) * 6) - 0.5) * 0.013 + (fbm(a * 9 + 20, y * 40, 3) - 0.5) * 0.004; });
    g.add(mesh(crustGeo, mat(crustTex)));
    g.add(mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.88, 0.003, 128).translate(0, y0 + 0.0015, 0), mat(crustTex)));
    // reyhan
    const leafTex = surface(256, (u, v) => {
      const mid = Math.abs(u - 0.5);
      const vein = smooth(0.012, 0, mid) + smooth(0.01, 0, Math.abs(Math.sin((v * 7 + mid * 9) * Math.PI)) * 0.04 + mid * 0.02) * 0.4;
      const col = mix(mix(hex(0x1f5418), hex(0x3f8a2c), fbm(u * 20, v * 20, 3)), hex(0x6fb04e), vein * 0.6);
      return [col[0], col[1], col[2], vein, 0.28];
    }, { normal: 2 });
    const leafMat = mat(leafTex, { side: THREE.DoubleSide, clearcoat: 0.4 });
    for (let i = 0; i < 6; i++) {
      const L = new THREE.PlaneGeometry(0.026, 0.044, 8, 12);
      const p = L.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), t = p.getY(k) / 0.022;
        p.setX(k, x * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - Math.max(0, t) * 0.35));
        p.setZ(k, Math.pow(x / 0.013, 2) * 0.004 + Math.sin(t * 2) * 0.002);
      }
      L.computeVertexNormals();
      L.rotateX(-Math.PI / 2 + R(-0.25, 0.1));
      L.rotateY(rnd() * 6.28);
      const a = rnd() * 6.28, d = R(0.02, 0.1);
      L.translate(Math.cos(a) * d, topH(Math.cos(a) * d, Math.sin(a) * d) + 0.003, Math.sin(a) * d);
      g.add(mesh(L, leafMat));
    }
    return g;
  },

  burger() {
    reseed(23);
    const g = new THREE.Group();
    g.add(board(0.34, 0.25));
    reseed(24);
    const y = 0.02;
    const B = new THREE.Group();
    B.position.set(-0.04, 0, 0.005);
    const bunTex = surface(1024, (u, v) => {
      const n = fbm(u * 10, v * 10, 5), n2 = fbm(u * 80, v * 80, 3);
      const topness = smooth(0.15, 0.85, 1 - v);
      let col = mix(hex(0xe7b36a), hex(0x9a4d15), topness * (0.7 + n * 0.3));
      col = mix(col, hex(0x6b300a), smooth(0.7, 0.9, n) * topness * 0.4);
      return [col[0], col[1], col[2], n * 0.4 + n2 * 0.2, 0.35 + n2 * 0.15];
    }, { normal: 1.2 });
    const bunMat = mat(bunTex, { clearcoat: 0.55, clearcoatRoughness: 0.3 });
    const crumbMat = mat(surface(512, (u, v) => {
      const n = fbm(u * 60, v * 60, 4), pore = smooth(0.62, 0.7, fbm(u * 90 + 3, v * 90, 3));
      const col = mix(hex(0xf6e2b8), hex(0xd9b67c), pore * 0.7 + n * 0.2);
      return [col[0], col[1], col[2], 1 - pore, 0.85];
    }, { normal: 3 }));
    const bot = lathe([[0.0001, y], [0.05, y], [0.058, y + 0.004], [0.061, y + 0.012], [0.06, y + 0.02], [0.0001, y + 0.02]]);
    displace(bot, (x, yy, z) => (noise3(x * 60, yy * 60, z * 60) - 0.5) * 0.003);
    B.add(mesh(bot, bunMat));
    B.add(mesh(new THREE.CircleGeometry(0.06, 64).rotateX(-Math.PI / 2).translate(0, y + 0.0201, 0), crumbMat));
    const beefTex = surface(1024, (u, v) => {
      const n = fbm(u * 30, v * 12, 5), n2 = fbm(u * 150, v * 60, 3), char = smooth(0.6, 0.75, fbm(u * 20 + 4, v * 8, 4));
      let col = mix(hex(0x5a2c17), hex(0x2a140a), n);
      col = mix(col, hex(0x120805), char * 0.8);
      col = mix(col, hex(0x8a4a28), smooth(0.7, 0.85, n2) * 0.4);
      return [col[0], col[1], col[2], n * 0.5 + n2 * 0.5, 0.45 + n2 * 0.3];
    }, { normal: 4 });
    const patty = lathe([[0.0001, y + 0.02], [0.058, y + 0.02], [0.064, y + 0.025], [0.065, y + 0.033], [0.062, y + 0.039], [0.0001, y + 0.041]], 128);
    displace(patty, (x, yy, z) => (noise3(x * 90, yy * 90, z * 90) - 0.5) * 0.006 + (noise3(x * 25, yy * 25, z * 25) - 0.5) * 0.004);
    B.add(mesh(patty, mat(beefTex, { clearcoat: 0.3, clearcoatRoughness: 0.4 })));
    // ərimiş çedar
    const ch = new THREE.PlaneGeometry(0.11, 0.11, 40, 40).rotateX(-Math.PI / 2).rotateY(Math.PI / 4 + 0.2);
    const cp = ch.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i), d = Math.hypot(x, z);
      const over = Math.max(0, d - 0.057);
      const drip = over > 0 ? -(over * 1.1 + over * over * 60) * (0.7 + fbm(Math.atan2(z, x) * 3 + 5, 1, 2) * 0.8) : 0;
      const k = over > 0 ? 0.057 / d + (1 - 0.057 / d) * 0.25 : 1;
      cp.setXYZ(i, x * k, drip, z * k);
    }
    ch.computeVertexNormals();
    B.add(mesh(ch.translate(0, y + 0.042, 0), new THREE.MeshPhysicalMaterial({ color: 0xf2a91e, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.2, side: THREE.DoubleSide })));
    // pomidor dilimi
    const tomTex = surface(512, (u, v) => {
      const x = (u - 0.5) * 2, z = (v - 0.5) * 2, d = Math.hypot(x, z), a = Math.atan2(z, x);
      const rim = smooth(0.82, 0.9, d);
      const chamber = smooth(0.35, 0.2, Math.abs(Math.sin(a * 2.5))) * smooth(0.25, 0.4, d) * smooth(0.78, 0.65, d);
      let col = mix(hex(0xe0412c), hex(0xc0261a), rim);
      col = mix(col, hex(0xf07a4a), chamber * 0.7);
      const seedDot = chamber * smooth(0.75, 0.8, fbm(u * 60, v * 60, 2));
      col = mix(col, hex(0xf3d9a0), seedDot);
      return [col[0], col[1], col[2], chamber * 0.5 + seedDot, 0.12];
    }, { normal: 2 });
    const tm = mat(tomTex, { clearcoat: 1, clearcoatRoughness: 0.05 });
    B.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.006, 64).translate(0.006, y + 0.046, 0), [new THREE.MeshPhysicalMaterial({ color: 0xb8200f, roughness: 0.2, clearcoat: 1 }), tm, tm]));
    // kahı: qıvrım kənarlı
    const lettTex = surface(512, (u, v) => {
      const x = u - 0.5, z = v - 0.5, a = Math.atan2(z, x), d = Math.hypot(x, z);
      const vein = smooth(0.02, 0, Math.abs(Math.sin(a * 9)) * d);
      const col = mix(mix(hex(0x9fd05a), hex(0x4f9a2a), smooth(0.1, 0.5, d)), hex(0xdff5a8), vein * 0.5);
      return [col[0], col[1], col[2], vein, 0.35];
    }, { normal: 2 });
    const lg = polarGrid(0.072, 14, 200, (x, z) => { const d = Math.hypot(x, z), a = Math.atan2(z, x); return Math.pow(d / 0.072, 3) * (Math.sin(a * 23) * 0.006 + Math.sin(a * 7 + 1) * 0.004) - Math.pow(d / 0.072, 2) * 0.004; });
    B.add(mesh(lg.translate(0, y + 0.051, 0), mat(lettTex, { side: THREE.DoubleSide, clearcoat: 0.3 })));
    // üst çörək + küncüt
    const top = lathe([[0.061, y + 0.052], [0.063, y + 0.06], [0.061, y + 0.074], [0.052, y + 0.088], [0.036, y + 0.098], [0.016, y + 0.103], [0.0001, y + 0.104]], 128);
    displace(top, (x, yy, z) => (noise3(x * 40, yy * 40, z * 40) - 0.5) * 0.005);
    B.add(mesh(top, bunMat));
    B.add(mesh(new THREE.CircleGeometry(0.061, 64).rotateX(Math.PI / 2).translate(0, y + 0.052, 0), crumbMat));
    B.add(mesh(scatter(new THREE.SphereGeometry(1, 10, 6).scale(0.0024, 0.0011, 0.0014), 90, (o) => {
      const a = rnd() * Math.PI * 2, t = Math.sqrt(rnd()) * 0.92;
      const rr = 0.06 * t, hy = y + 0.104 - 0.045 * Math.pow(t, 2.3);
      o.position.set(Math.cos(a) * rr, hy + 0.0012, Math.sin(a) * rr);
      o.rotation.set(R(-0.4, 0.4), rnd() * 6, R(-0.4, 0.4));
    }), new THREE.MeshPhysicalMaterial({ color: 0xf4e6c4, roughness: 0.45, clearcoat: 0.3 })));
    g.add(B);
    // kartof fri
    const fryMat = mat(surface(256, (u, v) => {
      const n = fbm(u * 8, v * 40, 4), tip = smooth(0.8, 1, Math.abs(v - 0.5) * 2);
      const col = mix(mix(hex(0xf6d06a), hex(0xe0a33a), n), hex(0xa86420), tip * 0.7);
      return [col[0], col[1], col[2], n, 0.45];
    }, { normal: 2 }), { clearcoat: 0.25 });
    const fries = [];
    for (let i = 0; i < 20; i++) {
      const t = R(0.0075, 0.0105), L = R(0.055, 0.09);
      const f = new THREE.BoxGeometry(t, t, L, 1, 1, 6);
      const p = f.attributes.position, bend = R(-0.004, 0.004);
      for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + Math.pow(p.getZ(k) / (L / 2), 2) * bend);
      f.rotateY(R(-0.8, 0.8)).rotateX(R(-0.12, 0.12)).rotateZ(R(-0.3, 0.3));
      f.translate(0.09 + R(-0.03, 0.03), y + t / 2 + (i % 5) * 0.0065, R(-0.05, 0.05));
      fries.push(f);
    }
    const fg = merge(fries); fg.computeVertexNormals();
    g.add(mesh(fg, fryMat));
    return g;
  },

  salad() {
    reseed(37);
    const g = new THREE.Group();
    const R0 = 0.11;
    g.add(mesh(lathe([[0.0001, 0], [0.05, 0], [0.052, 0.006], [0.085, 0.03], [R0, 0.058], [R0 + 0.004, 0.062], [R0 - 0.002, 0.063], [0.082, 0.036], [0.05, 0.014], [0.0001, 0.012]], 128), porcelain()));
    const lm = mat(surface(512, (u, v) => {
      const mid = Math.abs(u - 0.5);
      const vein = smooth(0.03, 0, mid) + smooth(0.012, 0, Math.abs(Math.sin((v * 9 + mid * 6) * Math.PI)) * 0.03) * 0.3;
      const col = mix(mix(hex(0x3d7f22), hex(0x86c24c), fbm(u * 14, v * 14, 4) * 0.6 + v * 0.4), hex(0xe4f4b4), vein * 0.7);
      return [col[0], col[1], col[2], vein * 0.8, 0.32];
    }, { normal: 2.5 }), { side: THREE.DoubleSide, clearcoat: 0.3 });
    const leaf = new THREE.PlaneGeometry(0.05, 0.085, 10, 14);
    const lp = leaf.attributes.position;
    for (let k = 0; k < lp.count; k++) {
      const x = lp.getX(k), yv = lp.getY(k), t = yv / 0.0425;
      lp.setX(k, x * ((1 - Math.pow(Math.abs(t), 3)) * 0.9 + 0.1));
      lp.setZ(k, Math.pow(x / 0.025, 2) * 0.012 + Math.sin(x * 400 + yv * 200) * 0.0018 * Math.abs(x / 0.025));
    }
    leaf.computeVertexNormals();
    g.add(mesh(scatter(leaf, 30, (o) => {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.06;
      o.position.set(Math.cos(a) * d, 0.05 + R(0, 0.014) - d * 0.1, Math.sin(a) * d);
      o.rotation.set(-Math.PI / 2 + R(-0.4, 0.4), rnd() * 6, R(-0.3, 0.3));
    }), lm));
    const grill = mat(surface(256, (u, v) => {
      const n = fbm(u * 10, v * 10, 4), line = smooth(0.06, 0, Math.abs(((u + v * 0.6) * 4) % 1 - 0.5) - 0.42);
      const col = mix(mix(hex(0xecd2a6), hex(0xc99a5e), n), hex(0x6a3a18), line * 0.55);
      return [col[0], col[1], col[2], n * 0.5 + line * 0.3, 0.55];
    }, { normal: 2 }));
    g.add(mesh(scatter(new THREE.BoxGeometry(0.045, 0.011, 0.018, 4, 1, 2), 7, (o, i) => { const a = (i / 7) * Math.PI * 1.4 - 0.4; o.position.set(Math.cos(a) * 0.035, 0.074 + R(0, 0.006), Math.sin(a) * 0.035); o.rotation.set(R(-0.3, 0.3), a + Math.PI / 2, R(-0.2, 0.2)); }), grill));
    const crou = mat(surface(128, (u, v) => { const n = fbm(u * 10, v * 10, 4); const c = mix(hex(0xe8b56a), hex(0xa8692a), n); return [c[0], c[1], c[2], n, 0.8]; }, { normal: 4 }));
    g.add(mesh(scatter(displace(new THREE.BoxGeometry(0.012, 0.012, 0.012, 3, 3, 3), (x, y, z) => (noise3(x * 300, y * 300, z * 300) - 0.5) * 0.002), 12, (o) => { const a = rnd() * 6.28, d = R(0.02, 0.075); o.position.set(Math.cos(a) * d, 0.07 + R(0, 0.01), Math.sin(a) * d); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }), crou));
    g.add(mesh(scatter(new THREE.BoxGeometry(0.02, 0.0012, 0.008), 18, (o) => { const a = rnd() * 6.28, d = R(0, 0.07); o.position.set(Math.cos(a) * d, 0.08 + R(0, 0.005), Math.sin(a) * d); o.rotation.set(R(-0.5, 0.5), rnd() * 6, R(-0.5, 0.5)); }), new THREE.MeshPhysicalMaterial({ color: 0xf5eed8, roughness: 0.6 })));
    g.add(mesh(scatter(new THREE.SphereGeometry(0.012, 24, 16), 5, (o) => { const a = rnd() * 6.28, d = R(0.04, 0.075); o.position.set(Math.cos(a) * d, 0.073, Math.sin(a) * d); }), new THREE.MeshPhysicalMaterial({ color: 0xd22a18, roughness: 0.15, clearcoat: 1 })));
    return g;
  },

  plov() {
    reseed(41);
    const g = new THREE.Group();
    g.add(plate(0.17));
    const crust = mat(surface(1024, (u, v) => {
      const n = fbm(u * 14, v * 14, 5), n2 = fbm(u * 120, v * 120, 3);
      const layer = Math.sin(v * 70 + n * 6) * 0.5 + 0.5;
      let col = mix(hex(0xecc27a), hex(0xb0692a), n * 0.7 + layer * 0.3);
      col = mix(col, hex(0x6e3812), smooth(0.72, 0.85, fbm(u * 30 + 3, v * 30, 3)) * 0.6);
      return [col[0], col[1], col[2], layer * 0.4 + n2 * 0.4, 0.4 + n2 * 0.2];
    }, { normal: 2.5 }), { clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const pts = [[0.1, 0.009]];
    for (let i = 0; i <= 32; i++) { const t = i / 32; pts.push([Math.max(0.0001, 0.1 * Math.cos((t * Math.PI) / 2)), 0.02 + 0.075 * Math.sin((t * Math.PI) / 2)]); }
    g.add(mesh(displace(lathe(pts, 128), (x, y, z) => (noise3(x * 50, y * 50, z * 50) - 0.5) * 0.004), crust));
    const ring = (n, rad, m, geo, yy) => g.add(mesh(scatter(geo, n, (o, i) => { const a = (i / n) * Math.PI * 2 + R(-0.1, 0.1); o.position.set(Math.cos(a) * rad, yy, Math.sin(a) * rad); o.rotation.set(R(-0.3, 0.3), rnd() * 6, R(-0.3, 0.3)); }), m));
    ring(10, 0.125, new THREE.MeshPhysicalMaterial({ color: 0xe5801c, roughness: 0.35, clearcoat: 0.6 }), displace(new THREE.SphereGeometry(1, 20, 12).scale(0.012, 0.006, 0.014), (x, y, z) => (noise3(x * 300, y * 300, z * 300) - 0.5) * 0.002), 0.016);
    ring(7, 0.14, new THREE.MeshPhysicalMaterial({ color: 0x5e3217, roughness: 0.45, clearcoat: 0.3 }), new THREE.SphereGeometry(1, 16, 12).scale(0.011, 0.009, 0.011), 0.018);
    ring(22, 0.113, new THREE.MeshPhysicalMaterial({ color: 0x2a1410, roughness: 0.4, clearcoat: 0.4 }), new THREE.SphereGeometry(1, 8, 6).scale(0.004, 0.003, 0.006), 0.014);
    g.add(mesh(scatter(new THREE.CylinderGeometry(0.0008, 0.0008, 0.03, 4), 30, (o) => { const a = rnd() * 6.28, d = R(0.03, 0.06); o.position.set(Math.cos(a) * d, 0.095 - d * 0.35, Math.sin(a) * d); o.rotation.set(R(1, 2), rnd() * 6, 0); }), new THREE.MeshPhysicalMaterial({ color: 0x3f7a2a })));
    return g;
  },

  cheesecake() {
    reseed(53);
    const g = new THREE.Group();
    g.add(plate(0.12));
    const wedge = (r, h, y, m) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(r, -r * 0.42); s.quadraticCurveTo(r * 1.04, 0, r, r * 0.42); s.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 24 });
      geo.rotateX(Math.PI / 2).translate(-r * 0.5, y + h, 0);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 8, p.getY(i) * 8 + p.getZ(i) * 8);
      return mesh(geo, m);
    };
    g.add(wedge(0.1, 0.012, 0.01, mat(surface(256, (u, v) => { const n = fbm(u * 30, v * 30, 4); const c = mix(hex(0xb57b42), hex(0x6e4220), n); return [c[0], c[1], c[2], n, 0.9]; }, { normal: 4 }))));
    g.add(wedge(0.1, 0.04, 0.022, mat(surface(256, (u, v) => { const n = fbm(u * 20, v * 20, 4), n2 = fbm(u * 80, v * 80, 2); const c = mix(hex(0xfbf1dc), hex(0xefdcb6), n * 0.5); return [c[0], c[1], c[2], n2 * 0.4, 0.55]; }, { normal: 1 }))));
    const sauce = new THREE.MeshPhysicalMaterial({ color: 0x8c0a22, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
    g.add(wedge(0.098, 0.003, 0.0625, sauce));
    g.add(mesh(scatter(new THREE.SphereGeometry(0.007, 20, 14), 9, (o) => { o.position.set(R(-0.04, 0.035), 0.071, R(-0.018, 0.018)); }), new THREE.MeshPhysicalMaterial({ color: 0x6a0a1e, roughness: 0.2, clearcoat: 1 })));
    g.add(mesh(new THREE.SphereGeometry(0.012, 24, 16, 0, Math.PI).scale(1, 1.3, 1).rotateZ(Math.PI / 2).translate(0.02, 0.072, 0.005), new THREE.MeshPhysicalMaterial({ color: 0xd8222f, roughness: 0.25, clearcoat: 1 })));
    g.add(mesh(new THREE.CircleGeometry(1, 16).scale(0.008, 0.014, 1).rotateX(-1.2).translate(0.005, 0.078, -0.004), new THREE.MeshPhysicalMaterial({ color: 0x3e8a35, roughness: 0.3, side: THREE.DoubleSide })));
    g.add(mesh(scatter(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), 6, (o, i) => { const s = 0.004 + i * 0.0015; o.scale.set(s, 1, s); o.position.set(0.07 - i * 0.016, 0.0105, 0.045 + Math.sin(i) * 0.008); }), sauce));
    return g;
  },

  lemonade() {
    reseed(67);
    const g = new THREE.Group();
    const H = 0.15, r0 = 0.032, r1 = 0.04;
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transmission: 1, thickness: 0.004, ior: 1.5, transparent: true, opacity: 0.35 });
    g.add(mesh(lathe([[0.0001, 0], [r0, 0], [r0 + 0.002, 0.006], [r1, H], [r1 - 0.002, H], [r0 - 0.001, 0.012], [0.0001, 0.012]]), glass));
    const lh = H * 0.82;
    g.add(mesh(lathe([[0.0001, 0.012], [r0 - 0.001, 0.012], [r0 - 0.002 + (r1 - r0) * (lh / H), lh], [0.0001, lh]]), new THREE.MeshPhysicalMaterial({ color: 0xf1dc6a, roughness: 0.08, transmission: 0.6, thickness: 0.05, transparent: true, opacity: 0.85 })));
    g.add(mesh(scatter(displace(new THREE.BoxGeometry(0.018, 0.018, 0.018, 3, 3, 3), (x, y, z) => (noise3(x * 200, y * 200, z * 200) - 0.5) * 0.002), 5, (o, i) => { o.position.set(R(-0.012, 0.012), lh - 0.012 - i * 0.02, R(-0.012, 0.012)); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, transmission: 0.9, thickness: 0.02, transparent: true, opacity: 0.6 })));
    const lm = mat(surface(256, (u, v) => {
      const x = (u - 0.5) * 2, z = (v - 0.5) * 2, d = Math.hypot(x, z), a = Math.atan2(z, x);
      const seg = smooth(0.06, 0.02, Math.abs(Math.sin(a * 5)) * d);
      let c = mix(hex(0xfbe98a), hex(0xf2cf2a), fbm(u * 30, v * 30, 3));
      c = mix(c, hex(0xfff6c8), seg);
      c = mix(c, hex(0xf8f0d0), smooth(0.78, 0.84, d));
      c = mix(c, hex(0xe8c21e), smooth(0.88, 0.92, d));
      return [c[0], c[1], c[2], seg, 0.3];
    }, { normal: 2 }), { clearcoat: 0.8 });
    const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 48), [new THREE.MeshPhysicalMaterial({ color: 0xe8c21e, roughness: 0.4 }), lm, lm]);
    ls.rotation.set(Math.PI / 2, 0, 0.3);
    ls.position.set(r1 - 0.004, H - 0.006, 0);
    g.add(ls);
    g.add(mesh(scatter(new THREE.CircleGeometry(1, 12).scale(0.009, 0.015, 1), 4, (o, i) => { o.position.set(-0.012 + i * 0.006, lh + 0.004, R(-0.01, 0.01)); o.rotation.set(-1.2 + R(-0.3, 0.3), i, 0); }), new THREE.MeshPhysicalMaterial({ color: 0x2f7d2e, side: THREE.DoubleSide })));
    g.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.2, 12).translate(0, 0.1, 0).rotateZ(0.22).translate(-0.012, 0.02, 0.008), new THREE.MeshPhysicalMaterial({ color: 0x1f5c56, roughness: 0.3 })));
    return g;
  },
};
