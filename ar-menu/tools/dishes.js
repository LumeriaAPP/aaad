// Nümunə yeməklərin 3D modelləri (real ölçü, metr). Brauzerdə işləyir və GLB kimi ixrac olunur.
// Hər yeməyin mərkəzi (0,0,0) — boşqabın altı masanın səthindədir.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------- köməkçilər ---------------- */
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * rnd();

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
// ləkəli səth (qızarmış xəmir, ət, sous)
function blotchy(base, spots, n, rMin, rMax, size = 512) {
  return canvasTex(size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      const [col, a] = spots[Math.floor(rnd() * spots.length)];
      g.globalAlpha = a * R(0.4, 1);
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(R(0, s), R(0, s), R(rMin, rMax), R(rMin, rMax), R(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  });
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
// bir çox kiçik parçanı bir həndəsəyə birləşdir (az fayl ölçüsü)
function scatter(base, n, place) {
  const geos = [];
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    if (place(o, i) === false) continue;
    o.updateMatrix();
    geos.push(base.clone().applyMatrix4(o.matrix));
  }
  return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
}
// kənarı dalğalı yarpaq/diskin həndəsəsi
function wavyDisc(r, waves, amp, seg = 96) {
  const g = new THREE.CircleGeometry(r, seg, 0, Math.PI * 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), d = Math.hypot(x, y) / r;
    const a = Math.atan2(y, x);
    p.setZ(i, Math.sin(a * waves) * amp * d * d + (rnd() - 0.5) * amp * 0.2 * d);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------------- boşqablar ---------------- */
const porcelain = std({ color: 0xf7f5f0, roughness: 0.18 });
function plate(r, rim = 0.035) {
  return mesh(lathe([[0.0001, 0], [r * 0.62, 0], [r * 0.64, 0.004], [r * 0.7, 0.008], [r - rim, 0.012], [r, 0.02], [r - 0.004, 0.022], [r - rim * 1.1, 0.015], [r * 0.7, 0.011], [r * 0.64, 0.009], [0.0001, 0.009]]), porcelain);
}
function board(w, d) {
  const wood = canvasTex(512, (g, s) => {
    g.fillStyle = '#9a6a42'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(${R(60, 110) | 0},${R(35, 60) | 0},20,${R(0.1, 0.35)})`; g.lineWidth = R(1, 4); g.beginPath(); const y = R(0, s); g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + R(-8, 8), s * 0.6, y + R(-8, 8), s, y + R(-6, 6)); g.stroke(); }
  });
  const geo = new THREE.BoxGeometry(w, 0.018, d, 1, 1, 1).translate(0, 0.009, 0);
  return mesh(geo, std({ map: wood, roughness: 0.6 }));
}

/* ---------------- yeməklər ---------------- */
export const DISHES = {
  pizza() {
    seed = 11;
    const g = new THREE.Group();
    g.add(board(0.36, 0.36));
    const r = 0.15, y0 = 0.018;
    const dough = blotchy('#e2b476', [['#b9763a', 0.7], ['#8a4d20', 0.5], ['#f0cf98', 0.6]], 260, 4, 18);
    // qabarıq kənar (qızarmış)
    g.add(mesh(lathe([[r * 0.86, y0 + 0.004], [r * 0.9, y0 + 0.016], [r * 0.96, y0 + 0.02], [r, y0 + 0.012], [r * 0.99, y0 + 0.002], [r * 0.9, y0]], 96), std({ map: dough, roughness: 0.85 })));
    g.add(mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.006, 96).translate(0, y0 + 0.003, 0), std({ map: dough })));
    // pomidor sousu
    const sauce = blotchy('#b3261a', [['#8c1a10', 0.6], ['#d0472a', 0.5], ['#e06a3a', 0.3]], 300, 3, 14);
    g.add(mesh(new THREE.CircleGeometry(r * 0.87, 96).rotateX(-Math.PI / 2).translate(0, y0 + 0.0065, 0), std({ map: sauce, roughness: 0.45 })));
    // motsarella — ərimiş yastı ləkələr
    const mozz = std({ color: 0xf6ecd2, roughness: 0.4 });
    g.add(mesh(scatter(new THREE.SphereGeometry(1, 20, 10), 26, (o) => {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.74, s = R(0.016, 0.03);
      o.position.set(Math.cos(a) * d, y0 + 0.007, Math.sin(a) * d); o.scale.set(s, 0.0035, s * R(0.7, 1.2)); o.rotation.y = rnd() * 3;
    }), mozz));
    // reyhan yarpaqları
    const basil = std({ color: 0x2f6b25, roughness: 0.5, side: THREE.DoubleSide });
    const leaf = new THREE.CircleGeometry(1, 16).scale(0.012, 0.022, 1).rotateX(-Math.PI / 2);
    g.add(mesh(scatter(leaf, 7, (o) => { const a = rnd() * Math.PI * 2, d = R(0.02, 0.1); o.position.set(Math.cos(a) * d, y0 + 0.0115, Math.sin(a) * d); o.rotation.set(R(-0.2, 0.2), rnd() * 6, R(-0.2, 0.2)); }), basil));
    // dilim kəsikləri
    const cut = std({ color: 0x5a2410, roughness: 0.9 });
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(r * 2 * 0.98, 0.002, 0.0015).translate(0, y0 + 0.0072, 0).rotateY((i * Math.PI) / 4), cut));
    return g;
  },

  burger() {
    seed = 23;
    const g = new THREE.Group();
    g.add(board(0.34, 0.24));
    const y = 0.018;
    const bun = blotchy('#c9853e', [['#a8621f', 0.6], ['#e0a560', 0.5], ['#7f4413', 0.3]], 200, 6, 26);
    const bunIn = blotchy('#f1d7a8', [['#e2c28a', 0.5]], 120, 2, 6);
    const B = new THREE.Group();
    B.position.set(-0.035, 0, 0);
    // alt çörək
    B.add(mesh(lathe([[0.0001, y], [0.052, y], [0.058, y + 0.006], [0.058, y + 0.02], [0.0001, y + 0.02]]), std({ map: bun, roughness: 0.75 })));
    // kotlet
    const beef = blotchy('#4a2616', [['#2a130a', 0.7], ['#6b3a22', 0.5], ['#83502e', 0.3]], 400, 2, 8);
    B.add(mesh(lathe([[0.0001, y + 0.02], [0.056, y + 0.02], [0.061, y + 0.026], [0.06, y + 0.036], [0.054, y + 0.04], [0.0001, y + 0.04]]), std({ map: beef, roughness: 0.9 })));
    // pendir (künclərdən sallanan kvadrat)
    const ch = new THREE.PlaneGeometry(0.105, 0.105, 12, 12).rotateX(-Math.PI / 2).rotateY(Math.PI / 4);
    const cp = ch.attributes.position;
    for (let i = 0; i < cp.count; i++) { const d = Math.hypot(cp.getX(i), cp.getZ(i)); cp.setY(i, d > 0.055 ? -(d - 0.055) * 0.9 : 0); }
    ch.computeVertexNormals();
    B.add(mesh(ch.translate(0, y + 0.041, 0), std({ color: 0xf2b32a, roughness: 0.35, side: THREE.DoubleSide })));
    // pomidor, kahı
    B.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 40).translate(0, y + 0.045, 0), std({ color: 0xd43a2a, roughness: 0.35 })));
    const lettuce = wavyDisc(0.066, 11, 0.008).rotateX(-Math.PI / 2).translate(0, y + 0.05, 0);
    B.add(mesh(lettuce, std({ color: 0x6fae3c, roughness: 0.5, side: THREE.DoubleSide })));
    // üst çörək + küncüt
    const top = lathe([[0.058, y + 0.051], [0.06, y + 0.058], [0.057, y + 0.075], [0.046, y + 0.089], [0.028, y + 0.097], [0.0001, y + 0.1]]);
    B.add(mesh(top, std({ map: bun, roughness: 0.55 })));
    B.add(mesh(new THREE.CircleGeometry(0.058, 40).rotateX(Math.PI / 2).translate(0, y + 0.051, 0), std({ map: bunIn })));
    const seedGeo = new THREE.SphereGeometry(1, 8, 6).scale(0.0022, 0.0012, 0.0014);
    B.add(mesh(scatter(seedGeo, 70, (o) => {
      const a = rnd() * Math.PI * 2, t = Math.sqrt(rnd()) * 0.9;
      const rr = 0.058 * t; const hy = y + 0.1 - 0.042 * Math.pow(t, 2.2);
      o.position.set(Math.cos(a) * rr, hy + 0.001, Math.sin(a) * rr); o.rotation.set(R(-0.4, 0.4), rnd() * 6, R(-0.4, 0.4));
    }), std({ color: 0xf6ead0, roughness: 0.5 })));
    g.add(B);
    // kartof fri
    const fry = blotchy('#f0c050', [['#d89a2a', 0.5], ['#fbe08a', 0.4]], 60, 2, 6, 128);
    g.add(mesh(scatter(new THREE.BoxGeometry(0.009, 0.009, 1), 22, (o, i) => {
      const L = R(0.06, 0.09); o.scale.z = L;
      o.position.set(0.085 + R(-0.025, 0.025), y + 0.006 + (i % 4) * 0.007, R(-0.04, 0.04)); o.rotation.set(R(-0.15, 0.15), R(-0.6, 0.6), R(-0.2, 0.2));
    }), std({ map: fry, roughness: 0.6 })));
    return g;
  },

  salad() {
    seed = 37;
    const g = new THREE.Group();
    const R0 = 0.11;
    // dərin kasa
    g.add(mesh(lathe([[0.0001, 0], [0.05, 0], [0.052, 0.006], [0.085, 0.03], [R0, 0.058], [R0 + 0.004, 0.062], [R0 - 0.002, 0.063], [0.082, 0.036], [0.05, 0.014], [0.0001, 0.012]]), porcelain));
    // kahı yarpaqları (romaine)
    const lg = std({ color: 0x5f9e36, roughness: 0.55, side: THREE.DoubleSide });
    const lg2 = std({ color: 0xa8cf6a, roughness: 0.55, side: THREE.DoubleSide });
    // yarpaq: uzunsov, kənarı dalğalı, ortası qayıq kimi əyilmiş (qıvrım ölçüyə uyğun kiçildilir)
    const leafGeo = () => { const l = wavyDisc(1, 9, 0.18, 48).scale(0.026, 0.045, 0.02); const p = l.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.pow(p.getX(i) / 0.026, 2) * 0.01); l.computeVertexNormals(); return l; };
    for (const [mat, n] of [[lg, 22], [lg2, 14]]) {
      g.add(mesh(scatter(leafGeo(), n, (o) => {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.068;
        o.position.set(Math.cos(a) * d, 0.05 + R(0, 0.016) - d * 0.12, Math.sin(a) * d);
        o.rotation.set(-Math.PI / 2 + R(-0.35, 0.35), rnd() * 6, R(-0.3, 0.3));
      }), mat));
    }
    // toyuq dilimləri (qril izləri)
    const grill = canvasTex(256, (c, s) => { c.fillStyle = '#e6c79a'; c.fillRect(0, 0, s, s); c.strokeStyle = 'rgba(90,50,20,0.8)'; c.lineWidth = 14; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 50, 0); c.lineTo(i * 50 + 60, s); c.stroke(); } });
    g.add(mesh(scatter(new THREE.BoxGeometry(0.045, 0.01, 0.018), 7, (o, i) => { const a = (i / 7) * Math.PI * 1.4 - 0.4; o.position.set(Math.cos(a) * 0.035, 0.074 + R(0, 0.006), Math.sin(a) * 0.035); o.rotation.set(R(-0.3, 0.3), a + Math.PI / 2, R(-0.2, 0.2)); }), std({ map: grill, roughness: 0.7 })));
    // kruton, parmezan, pomidor
    const crou = blotchy('#d9a35a', [['#b57a33', 0.6], ['#f0cd8c', 0.5]], 80, 2, 6, 128);
    g.add(mesh(scatter(new THREE.BoxGeometry(0.012, 0.012, 0.012), 12, (o) => { const a = rnd() * 6.28, d = R(0.02, 0.075); o.position.set(Math.cos(a) * d, 0.07 + R(0, 0.01), Math.sin(a) * d); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }), std({ map: crou, roughness: 0.8 })));
    g.add(mesh(scatter(new THREE.BoxGeometry(0.02, 0.0012, 0.008), 18, (o) => { const a = rnd() * 6.28, d = R(0, 0.07); o.position.set(Math.cos(a) * d, 0.08 + R(0, 0.005), Math.sin(a) * d); o.rotation.set(R(-0.5, 0.5), rnd() * 6, R(-0.5, 0.5)); }), std({ color: 0xf5eed8, roughness: 0.6 })));
    g.add(mesh(scatter(new THREE.SphereGeometry(0.012, 20, 14), 5, (o) => { const a = rnd() * 6.28, d = R(0.04, 0.075); o.position.set(Math.cos(a) * d, 0.073, Math.sin(a) * d); }), std({ color: 0xd8321f, roughness: 0.25 })));
    return g;
  },

  plov() {
    seed = 41;
    const g = new THREE.Group();
    g.add(plate(0.17));
    // şah plov: qızarmış lavaş qabığından günbəz
    const crust = canvasTex(512, (c, s) => {
      c.fillStyle = '#c98a3e'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) { c.globalAlpha = R(0.2, 0.6); c.fillStyle = rnd() < 0.5 ? '#9a5a1e' : '#e6b36a'; c.beginPath(); c.ellipse(R(0, s), R(0, s), R(3, 16), R(2, 9), R(0, 3), 0, 7); c.fill(); }
      c.globalAlpha = 0.35; c.strokeStyle = '#7a4315'; c.lineWidth = 2;
      for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, (i * s) / 12 + R(-4, 4)); c.lineTo(s, (i * s) / 12 + R(-4, 4)); c.stroke(); }
      c.globalAlpha = 1;
    });
    // günbəz profili: aşağıda bir az şaquli, yuxarıda yumru
    const pts = [[0.1, 0.009]];
    for (let i = 0; i <= 28; i++) { const t = i / 28; pts.push([Math.max(0.0001, 0.1 * Math.cos((t * Math.PI) / 2)), 0.02 + 0.075 * Math.sin((t * Math.PI) / 2)]); }
    g.add(mesh(lathe(pts), std({ map: crust, roughness: 0.65 })));
    // ətrafında quru meyvə, şabalıd, ət
    const apricot = std({ color: 0xe0801f, roughness: 0.45 });
    const chestnut = std({ color: 0x6a3a1c, roughness: 0.55 });
    const raisin = std({ color: 0x2a1410, roughness: 0.6 });
    const ring = (n, rad, mat, geo, yy) => g.add(mesh(scatter(geo, n, (o, i) => { const a = (i / n) * Math.PI * 2 + R(-0.1, 0.1); o.position.set(Math.cos(a) * rad, yy, Math.sin(a) * rad); o.rotation.set(R(-0.3, 0.3), rnd() * 6, R(-0.3, 0.3)); }), mat));
    ring(10, 0.125, apricot, new THREE.SphereGeometry(1, 16, 10).scale(0.012, 0.006, 0.014), 0.016);
    ring(7, 0.14, chestnut, new THREE.SphereGeometry(1, 14, 10).scale(0.011, 0.009, 0.011), 0.018);
    ring(22, 0.113, raisin, new THREE.SphereGeometry(1, 8, 6).scale(0.004, 0.003, 0.006), 0.014);
    // göyərti (şüyüd)
    g.add(mesh(scatter(new THREE.CylinderGeometry(0.0008, 0.0008, 0.03, 4), 30, (o) => { const a = rnd() * 6.28, d = R(0.03, 0.06); o.position.set(Math.cos(a) * d, 0.095 - d * 0.35, Math.sin(a) * d); o.rotation.set(R(1, 2), rnd() * 6, 0); }), std({ color: 0x3f7a2a })));
    return g;
  },

  cheesecake() {
    seed = 53;
    const g = new THREE.Group();
    g.add(plate(0.12));
    // dilim: üçbucaq prizma (qat-qat)
    const wedge = (r, h, y, mat) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(r, -r * 0.42); s.quadraticCurveTo(r * 1.04, 0, r, r * 0.42); s.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 16 });
      geo.rotateX(Math.PI / 2).translate(-r * 0.5, y + h, 0);
      return mesh(geo, mat);
    };
    const base = blotchy('#a36a36', [['#7a4a22', 0.6], ['#c48a50', 0.5]], 200, 2, 6, 256);
    g.add(wedge(0.1, 0.012, 0.01, std({ map: base, roughness: 0.9 })));
    g.add(wedge(0.1, 0.04, 0.022, std({ color: 0xf6ead2, roughness: 0.55 })));
    // üstündə giləmeyvə sousu və meyvələr
    const sauce = std({ color: 0x9e0f2a, roughness: 0.15 });
    g.add(wedge(0.098, 0.003, 0.0625, sauce));
    const berry = std({ color: 0x7a0c22, roughness: 0.3 });
    g.add(mesh(scatter(new THREE.SphereGeometry(0.007, 16, 12), 9, (o) => { o.position.set(R(-0.04, 0.035), 0.071, R(-0.018, 0.018)); }), berry));
    // çiyələk yarısı + nanə
    g.add(mesh(new THREE.SphereGeometry(0.012, 20, 14, 0, Math.PI).scale(1, 1.3, 1).rotateZ(Math.PI / 2).translate(0.02, 0.072, 0.005), std({ color: 0xd8222f, roughness: 0.35 })));
    g.add(mesh(new THREE.CircleGeometry(1, 12).scale(0.008, 0.014, 1).rotateX(-1.2).translate(0.005, 0.078, -0.004), std({ color: 0x3e8a35, side: THREE.DoubleSide })));
    // boşqabda sous izləri
    g.add(mesh(scatter(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), 6, (o, i) => { const s = 0.004 + i * 0.0015; o.scale.set(s, 1, s); o.position.set(0.07 - i * 0.016, 0.0105, 0.045 + Math.sin(i) * 0.008); }), sauce));
    return g;
  },

  lemonade() {
    seed = 67;
    const g = new THREE.Group();
    const H = 0.15, r0 = 0.032, r1 = 0.04;
    // şüşə stəkan
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.004, ior: 1.5, transparent: true, opacity: 1 });
    g.add(mesh(lathe([[0.0001, 0], [r0, 0], [r0 + 0.002, 0.006], [r1, H], [r1 - 0.002, H], [r0 - 0.001, 0.012], [0.0001, 0.012]]), glass));
    // limonad
    const liq = new THREE.MeshPhysicalMaterial({ color: 0xf3e27a, roughness: 0.1, transmission: 0.65, thickness: 0.05, transparent: true, opacity: 0.92 });
    const lh = H * 0.82;
    g.add(mesh(lathe([[0.0001, 0.012], [r0 - 0.001, 0.012], [r0 - 0.002 + (r1 - r0) * (lh / H), lh], [0.0001, lh]]), liq));
    // buz kubları
    const ice = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transmission: 0.9, thickness: 0.02, transparent: true });
    g.add(mesh(scatter(new THREE.BoxGeometry(0.018, 0.018, 0.018), 5, (o, i) => { o.position.set(R(-0.012, 0.012), lh - 0.012 - i * 0.02, R(-0.012, 0.012)); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }), ice));
    // limon dilimi (kənarda)
    const lemon = canvasTex(256, (c, s) => {
      c.fillStyle = '#f5d53a'; c.fillRect(0, 0, s, s);
      c.translate(s / 2, s / 2);
      c.fillStyle = '#fbe98a'; c.beginPath(); c.arc(0, 0, s * 0.44, 0, 7); c.fill();
      for (let i = 0; i < 10; i++) { c.save(); c.rotate((i * Math.PI * 2) / 10); c.fillStyle = '#f2cf2a'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.4, -0.26, 0.26); c.closePath(); c.fill(); c.restore(); }
      c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(0, 0, s * 0.04, 0, 7); c.fill();
    });
    const slice = new THREE.CylinderGeometry(0.028, 0.028, 0.005, 40);
    const sm = [std({ color: 0xe8c21e, roughness: 0.4 }), std({ map: lemon, roughness: 0.35 }), std({ map: lemon, roughness: 0.35 })];
    const ls = new THREE.Mesh(slice, sm);
    ls.rotation.set(Math.PI / 2, 0, 0.3);
    ls.position.set(r1 - 0.004, H - 0.006, 0);
    g.add(ls);
    // nanə və çubuq (trubka)
    g.add(mesh(scatter(new THREE.CircleGeometry(1, 12).scale(0.009, 0.015, 1), 4, (o, i) => { o.position.set(-0.012 + i * 0.006, lh + 0.004, R(-0.01, 0.01)); o.rotation.set(-1.2 + R(-0.3, 0.3), i, 0); }), std({ color: 0x2f7d2e, side: THREE.DoubleSide })));
    g.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.2, 12).translate(0, 0.1, 0).rotateZ(0.22).translate(-0.012, 0.02, 0.008), std({ color: 0x1f5c56, roughness: 0.3 })));
    return g;
  },
};
