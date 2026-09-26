// Kamera rejimi (WebXR, Android Chrome): yemək yalnız MASANIN üstündə görünür, aşağıdakı menyunu
// sağa-sola sürüşdürdükcə masadakı yemək dəyişir. Real ölçü, real işıq (light estimation), kölgə.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';

const TABLE_MIN = 0.4, TABLE_MAX = 1.25; // masanın döşəmədən hündürlüyü (m)

export async function arSupported() {
  try { return !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))); } catch (e) { return false; }
}

/**
 * dishes: [{id, name, price}], startIndex, ui: { overlay, onChange(i), onExit() }
 */
export async function startAR(dishes, startIndex, ui) {
  const overlay = ui.overlay;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.domElement.className = 'ar-canvas';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 20);
  // işıq: kameradan gələn real işıq təxmini; olmasa — yumşaq standart işıq
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.4, 1.2, 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -0.35, right: 0.35, top: 0.35, bottom: -0.35, near: 0.05, far: 3 });
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const xrLight = new XREstimatedLight(renderer);
  xrLight.addEventListener('estimationstart', () => {
    scene.add(xrLight);
    scene.remove(hemi);
    if (xrLight.environment) scene.environment = xrLight.environment;
    sun.intensity = 0.8; // kölgə üçün saxlanılır, əsas işıq real işıqdır
  });
  xrLight.addEventListener('estimationend', () => { scene.remove(xrLight); scene.add(hemi); scene.environment = null; sun.intensity = 1.6; });

  // yeməyin altında yumşaq kölgə (masaya "oturur")
  const holder = new THREE.Group();
  holder.visible = false;
  scene.add(holder);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadowPlane.receiveShadow = true;
  shadowPlane.position.y = 0.001;
  holder.add(shadowPlane);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
  blob.position.y = 0.0005;
  holder.add(blob);
  const dishSlot = new THREE.Group();
  holder.add(dishSlot);

  // hədəf halqası (masa tapılanda yaşıl, döşəmədə qırmızı)
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // modellər (yaddaşda saxlanılır)
  const loader = new GLTFLoader();
  const cache = new Map();
  const load = (id) => {
    if (!cache.has(id)) cache.set(id, loader.loadAsync(`models/${id}.glb`).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g.scene;
    }));
    return cache.get(id);
  };
  let index = startIndex, loadSeq = 0;
  async function show(i) {
    index = (i + dishes.length) % dishes.length;
    const seq = ++loadSeq;
    ui.onChange(index, 'loading');
    const obj = await load(dishes[index].id);
    if (seq !== loadSeq) return;
    dishSlot.clear();
    dishSlot.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const s = box.getSize(new THREE.Vector3());
    blob.scale.set(s.x * 1.25, 1, s.z * 1.25);
    popT = 0;
    ui.onChange(index, 'ready');
    // qonşu yeməkləri əvvəlcədən yüklə (sürüşdürəndə gözləmə olmasın)
    load(dishes[(index + 1) % dishes.length].id);
    load(dishes[(index - 1 + dishes.length) % dishes.length].id);
  }
  let popT = 1;

  // sessiya
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'light-estimation', 'local-floor'],
    domOverlay: { root: overlay },
  });
  let refType = 'local-floor';
  try { await session.requestReferenceSpace('local-floor'); } catch (e) { refType = 'local'; }
  renderer.xr.setReferenceSpaceType(refType);
  await renderer.xr.setSession(session);
  const viewerSpace = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });
  let lowest = Infinity; // döşəmə təxmini (local-floor olmayanda)

  let placed = false, onTable = false, lastHit = null;
  const hitMat = new THREE.Matrix4(), hitPos = new THREE.Vector3(), hitQ = new THREE.Quaternion(), hitS = new THREE.Vector3();

  session.addEventListener('select', () => {
    if (drag.moved) { drag.moved = false; return; }
    if (!lastHit || !onTable) { ui.onChange(index, 'need-table'); return; }
    holder.position.copy(hitPos);
    // yemək kameraya baxsın
    const cam = renderer.xr.getCamera();
    const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    holder.rotation.set(0, Math.atan2(cp.x - hitPos.x, cp.z - hitPos.z), 0);
    holder.visible = true;
    sun.target.position.copy(hitPos);
    sun.position.copy(hitPos).add(new THREE.Vector3(0.4, 1.2, 0.3));
    if (!placed) { placed = true; popT = 0; }
    ui.onChange(index, 'placed');
  });
  session.addEventListener('end', cleanup);

  // barmaqla fırlatma (boş sahədə üfüqi sürüşdürmə)
  const drag = { x: 0, active: false, moved: false };
  const onDown = (e) => { if (e.target.closest('.ar-ui')) return; drag.active = true; drag.x = e.touches ? e.touches[0].clientX : e.clientX; drag.moved = false; };
  const onMove = (e) => {
    if (!drag.active || !holder.visible) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    holder.rotation.y += dx * 0.012;
    drag.x = x;
  };
  const onUp = () => { drag.active = false; };
  overlay.addEventListener('touchstart', onDown, { passive: true });
  overlay.addEventListener('touchmove', onMove, { passive: true });
  overlay.addEventListener('touchend', onUp);
  // UI düymələrinə toxunuş yeməyin yerini dəyişməsin
  const stopSelect = (e) => { if (e.target.closest('.ar-ui')) e.preventDefault(); };
  overlay.addEventListener('beforexrselect', stopSelect);

  renderer.setAnimationLoop((t, frame) => {
    if (!frame) return;
    const ref = renderer.xr.getReferenceSpace();
    const results = frame.getHitTestResults(hitSource);
    lastHit = null;
    if (results.length) {
      const pose = results[0].getPose(ref);
      if (pose) {
        hitMat.fromArray(pose.transform.matrix);
        hitMat.decompose(hitPos, hitQ, hitS);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hitQ);
        if (up.y > 0.9) { // yalnız üfüqi səthlər
          lastHit = pose;
          let h = null;
          if (refType === 'local-floor') h = hitPos.y;
          else {
            // döşəmə bilinmir: ən aşağı görülən səth bu səthdən 35 sm-dən çox aşağıdadırsa, o döşəmədir
            lowest = Math.min(lowest, hitPos.y);
            if (hitPos.y - lowest > 0.35) h = hitPos.y - lowest;
          }
          // döşəmə hələ görünməyibsə: telefonun başlanğıc hündürlüyündən 15–95 sm aşağıdakı səth masadır
          onTable = h != null ? h > TABLE_MIN && h < TABLE_MAX : hitPos.y < -0.15 && hitPos.y > -0.95;
          reticle.matrix.copy(hitMat);
          reticle.material.color.set(onTable ? 0x7ee0a1 : 0xff6b5b);
        }
      }
    }
    reticle.visible = !!lastHit && (!holder.visible || drag.active === false);
    ui.onChange(index, holder.visible ? 'placed' : lastHit ? (onTable ? 'table' : 'floor') : 'searching');
    // yeni yemək yumşaq "peyda olur"
    if (popT < 1) { popT = Math.min(1, popT + 1 / 18); const k = 1 - Math.pow(1 - popT, 3); dishSlot.scale.setScalar(0.6 + 0.4 * k); dishSlot.position.y = (1 - k) * 0.04; }
    renderer.render(scene, camera);
  });

  function cleanup() {
    renderer.setAnimationLoop(null);
    overlay.removeEventListener('touchstart', onDown);
    overlay.removeEventListener('touchmove', onMove);
    overlay.removeEventListener('touchend', onUp);
    overlay.removeEventListener('beforexrselect', stopSelect);
    renderer.domElement.remove();
    renderer.dispose();
    ui.onExit(index);
  }

  await show(startIndex);
  return {
    next: () => show(index + 1),
    prev: () => show(index - 1),
    go: (i) => show(i),
    end: () => session.end(),
  };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
