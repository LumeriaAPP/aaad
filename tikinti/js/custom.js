// Admin panelindən əlavə olunan binalar: saxlama (IndexedDB) və 3D qurulma.
// Qeyd: server olmadığı üçün məlumat yalnız həmin brauzerdə saxlanılır (test rejimi).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildNeighbor } from './complex.js';

const DB = 'nova-admin', STORE = 'buildings';
export const STATUSES = ['Layihə', 'Tikintidə', 'Satışda', 'Təhvil verilib'];
export const FLOOR_H = 3.2;
export const BASE_H = 8.8; // podium (mağazalar) hündürlüyü — buildNeighbor ilə eyni

function open() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('IndexedDB yoxdur'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const listBuildings = () => tx('readonly', (s) => s.getAll()).then((l) => (l || []).sort((a, b) => a.created - b.created)).catch(() => []);
export const saveBuilding = (b) => tx('readwrite', (s) => s.put(b));
export const deleteBuilding = (id) => tx('readwrite', (s) => s.delete(id));

export const heightOf = (b) => BASE_H + b.floors * FLOOR_H;

/** Bina qeydindən 3D qrup qurur (mərkəz 0,0 — yerləşdirmə çağıran tərəfindən edilir) */
export async function buildCustom(b) {
  const g = new THREE.Group();
  g.userData.customId = b.id;
  let body = null;
  if (b.kind === 'model' && b.model) {
    try {
      const gltf = await new GLTFLoader().parseAsync(b.model.slice(0), '');
      body = gltf.scene;
      const extras = [];
      body.traverse((o) => { if (o.isLight || o.isCamera) extras.push(o); });
      extras.forEach((o) => o.removeFromParent());
      body.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(body);
      const size = box.getSize(new THREE.Vector3());
      // en və dərinliyə sığdır, hündürlük proporsional qalır (və ya "hündürlüyə uyğunlaşdır")
      let k = Math.min(b.w / Math.max(size.x, 1e-3), b.d / Math.max(size.z, 1e-3));
      if (b.fitHeight) k = heightOf(b) / Math.max(size.y, 1e-3);
      body.scale.multiplyScalar(k);
      body.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(body);
      body.position.sub(new THREE.Vector3((b2.min.x + b2.max.x) / 2, b2.min.y, (b2.min.z + b2.max.z) / 2));
      body.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    } catch (e) {
      console.warn('Model oxunmadı, blok göstərilir', e);
      body = null;
    }
  }
  if (!body) body = buildNeighbor({ w: b.w, d: b.d, floors: b.floors, x: 0, z: 0, rot: 0 });
  const wrap = new THREE.Group();
  wrap.add(body);
  g.add(wrap);
  // çertyoj (plan şəkli) binanın altında yerə sərilir
  if (b.plan) {
    const url = URL.createObjectURL(new Blob([b.plan], { type: b.planType || 'image/png' }));
    const tex = await new THREE.TextureLoader().loadAsync(url).catch(() => null);
    URL.revokeObjectURL(url);
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      const pad = 6;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w + pad * 2, b.d + pad * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true, opacity: 0.92 }));
      m.position.y = -0.3;
      m.receiveShadow = true;
      m.renderOrder = -0.4;
      g.add(m);
    }
  }
  g.position.set(b.x, 0, b.z);
  g.rotation.y = THREE.MathUtils.degToRad(b.rot || 0);
  return g;
}
