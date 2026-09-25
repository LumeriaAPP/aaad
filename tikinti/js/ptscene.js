// Foto-render üçün səhnə: əsas səhnədən path tracer-in başa düşdüyü
// sadə, fiziki materiallı nüsxə yaradır (xüsusi şeyderlər əvəz olunur,
// InstancedMesh-lər birləşdirilir, uzaq obyektlər atılır).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hash = (x, y, z) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

// Səma üçün ekvirektanqulyar panorama (axşam/gecə üçün, günəşin mövqeyinə görə)
export function skyEquirect(sunDir, altDeg) {
  const W = 512, H = 256;
  const data = new Float32Array(W * H * 4);
  const day = THREE.MathUtils.smoothstep(altDeg, -4, 10);
  const dusk = Math.exp(-Math.pow((altDeg + 2.5) / 3.5, 2));
  const night = 1 - THREE.MathUtils.smoothstep(altDeg, -8, 2);
  const zen = new THREE.Color(0x2a5ea8).lerp(new THREE.Color(0x0a1224), night);
  const hor = new THREE.Color(0xbcd3e8).lerp(new THREE.Color(0xf0a078), dusk).lerp(new THREE.Color(0x1c2438), night * (1 - dusk));
  const d = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const elev = (0.5 - v) * Math.PI; // yuxarı sətir = zenit
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const phi = (u - 0.5) * 2 * Math.PI;
      d.set(Math.cos(elev) * Math.cos(phi), Math.sin(elev), Math.cos(elev) * Math.sin(phi));
      const up = Math.max(0, d.y);
      const c = hor.clone().lerp(zen, Math.pow(up, 0.45));
      if (d.y < 0) c.lerp(new THREE.Color(0x303236), Math.min(1, -d.y * 4));
      const sd = Math.max(0, d.dot(sunDir));
      const glow = Math.pow(sd, 8) * (0.6 * dusk + 0.4 * day) + Math.pow(sd, 400) * 30 * day;
      const k = 0.06 + 0.94 * Math.max(day, dusk * 0.4);
      const i = (y * W + x) * 4;
      data[i] = (c.r + glow * 1.0) * k * 0.9;
      data[i + 1] = (c.g + glow * 0.75) * k * 0.9;
      data[i + 2] = (c.b + glow * 0.5) * k * 0.9;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * opts.focus — mərkəz nöqtə; opts.radius — bu məsafədən uzaq obyektlər atılır
 * opts.night — 0..1 (pəncərələrin yanması); opts.skip(obj) — əlavə filtr
 */
export function buildPTScene(src, opts) {
  const { focus, radius = 450, night = 0, skip } = opts;
  const out = new THREE.Scene();
  const R2 = radius * radius;
  const glass = new THREE.MeshStandardMaterial({ color: 0x223040, metalness: 0.15, roughness: 0.04, envMapIntensity: 1 });
  const litGlass = new THREE.MeshStandardMaterial({ color: 0x1a140c, emissive: 0xffc587, emissiveIntensity: 1.5 * night, roughness: 0.2 });
  const flameDay = new THREE.MeshStandardMaterial({ color: 0x5f7f99, metalness: 0.9, roughness: 0.08 });
  const flameNight = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff6a1a, emissiveIntensity: 2.2 * night });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xaab8c4, metalness: 0.9, roughness: 0.1, flatShading: true });
  const matCache = new Map();

  const kindOf = (m) => {
    const key = m.customProgramCacheKey && m.customProgramCacheKey();
    if (!key || key === m.uuid || typeof key !== 'string') return null;
    if (key.startsWith('room-glass')) return 'window';
    if (key.startsWith('city-facade')) return 'city';
    if (key.startsWith('baku-flame')) return 'flame';
    if (key.startsWith('baku-crystal')) return 'crystal';
    return null;
  };
  const cleanMat = (m) => {
    if (matCache.has(m)) return matCache.get(m);
    let r = m;
    const kind = kindOf(m);
    if (kind === 'city') r = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.85 });
    else if (kind === 'flame') r = night > 0.3 ? flameNight : flameDay;
    else if (kind === 'crystal') r = crystal;
    else if (m.onBeforeCompile && m.onBeforeCompile.toString().length > 40 && !kind) {
      r = new THREE.MeshStandardMaterial({ color: m.color, map: m.map, roughness: m.roughness ?? 0.8, metalness: m.metalness ?? 0 });
    }
    matCache.set(m, r);
    return r;
  };

  const tmp = new THREE.Matrix4(), pos = new THREE.Vector3(), col = new THREE.Color();
  const near = (p) => p.distanceToSquared(focus) < R2;
  const visibleChain = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

  src.updateMatrixWorld(true);
  src.traverse((o) => {
    if (!o.isMesh || !visibleChain(o)) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.visible === false || m.isShaderMaterial || m.isRawShaderMaterial) return;
    if (m.blending === THREE.AdditiveBlending || (m.transparent && m.opacity < 0.05) || m.isMeshBasicMaterial && m.transparent) return;
    if (m.isShadowMaterial || o.isSky || (skip && skip(o))) return;
    const kind = kindOf(m);

    if (o.isInstancedMesh) {
      // nüsxələri rəngə görə qruplaşdır (path tracer vertex rənglərini dəstəkləmir)
      const buckets = new Map();
      const lit = [];
      const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const hasCol = !!o.instanceColor;
      let total = 0;
      for (let i = 0; i < o.count && total < 6000; i++) {
        o.getMatrixAt(i, tmp);
        tmp.premultiply(o.matrixWorld);
        pos.setFromMatrixPosition(tmp);
        if (!near(pos)) continue;
        const g = base.clone().applyMatrix4(tmp);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        total++;
        if (kind === 'window' && night > 0.05 && hash(pos.x, pos.y, pos.z) < 0.72) { lit.push(g); continue; }
        let key = 'base';
        if (hasCol) { o.getColorAt(i, col); key = col.getHexString(); }
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(g);
      }
      const add = (list, mat) => { if (list.length) out.add(new THREE.Mesh(mergeGeometries(list), mat)); };
      for (const [key, list] of buckets) {
        let mat;
        if (kind === 'window') mat = glass;
        else if (kind === 'city' || key !== 'base') {
          const ck = (kind || 'm') + key + (m.roughness ?? '');
          if (!matCache.has(ck)) matCache.set(ck, new THREE.MeshStandardMaterial({ color: key === 'base' ? 0xd8cfc0 : new THREE.Color('#' + key), roughness: kind === 'city' ? 0.85 : (m.roughness ?? 0.6), metalness: kind === 'city' ? 0 : (m.metalness ?? 0) }));
          mat = matCache.get(ck);
        } else mat = cleanMat(m);
        add(list, mat);
      }
      add(lit, litGlass);
      return;
    }

    // adi mesh: dünya matrisi ilə nüsxə (həndəsə paylaşılır)
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    pos.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const rad = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (pos.distanceTo(focus) - rad > radius) return;
    const c = new THREE.Mesh(o.geometry, kind === 'window' ? (night > 0.3 ? litGlass : glass) : cleanMat(m));
    c.matrixAutoUpdate = false;
    c.matrix.copy(o.matrixWorld);
    c.matrixWorld.copy(o.matrixWorld);
    out.add(c);
  });
  return out;
}
