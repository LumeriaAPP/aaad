// Admin panel: giriş, binaların siyahısı, yeni bina əlavə etmə (blok və ya GLB model + çertyoj),
// 3D baş planda yerləşdirmə (klik / sürüşdürmə), toqquşma yoxlaması.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTower, buildSurroundings } from './building.js';
import { NEIGHBORS } from './complex.js';
import { BUILDING } from './data.js';
import { listBuildings, saveBuilding, deleteBuilding, buildCustom, STATUSES } from './custom.js';

const $ = (s, r = document) => r.querySelector(s);

/* ---------------- Giriş ----------------
   Diqqət: bu, sadə (brauzer tərəfli) qorumadır — test üçündür. Real istifadə üçün server tərəfli
   giriş lazımdır (məs. Vercel funksiyası + verilənlər bazası). */
const AUTH_HASH = 'fc95a563629af91ca53944db7a788024019c88c34cc1f286cb62d39be7563502';
const SESSION = 'nova-admin-session';
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const ok = (await sha256(`nova-admin|${f.user.value.trim()}|${f.pass.value}`)) === AUTH_HASH;
  $('#loginErr').hidden = ok;
  if (!ok) return;
  try { sessionStorage.setItem(SESSION, AUTH_HASH); } catch (err) { /* yox */ }
  start();
});
$('#logout').addEventListener('click', () => {
  try { sessionStorage.removeItem(SESSION); } catch (err) { /* yox */ }
  location.reload();
});
let authed = false;
try { authed = sessionStorage.getItem(SESSION) === AUTH_HASH; } catch (err) { /* yox */ }
if (authed) start();

/* ---------------- Panel ---------------- */
let started = false;
function start() {
  if (started) return;
  started = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  requestAnimationFrame(initStage);
}

const FIXED = [
  { id: 1, name: 'Nova Residence (əsas bina)', x: 0, z: 0, rot: 0, w: BUILDING.width + 4, d: BUILDING.depth + 4, floors: BUILDING.lastFloor, main: true },
  ...NEIGHBORS.map((n) => ({ id: n.id, name: `Korpus ${n.id}`, x: n.x, z: n.z, rot: THREE.MathUtils.radToDeg(n.rot), w: n.w, d: n.d, floors: n.floors })),
];
let customs = [];
let editing = null; // redaktə olunan qeyd (yaddaşda)
let preview = null;
const customGroups = new Map();

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2600);
}

/* ---------------- 3D səhnə ---------------- */
let renderer, scene, camera, controls, footprints, ground;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function initStage() {
  const canvas = $('#view');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd3e3);
  scene.fog = new THREE.FogExp2(0xbfd3e3, 0.0011);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x6b6250, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(120, 220, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 600 });
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 40;
  controls.maxDistance = 900;
  setView('top');

  scene.add(buildTower().root);
  scene.add(buildSurroundings());
  footprints = new THREE.Group();
  scene.add(footprints);
  ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
  scene.add(ground);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  bindPointer(canvas);
  $('#stageLoading').hidden = true;
  refresh();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}

function setView(v) {
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('is-on', b.dataset.view === v));
  if (v === 'top') { camera.position.set(0, 430, 40); controls.target.set(0, 0, 10); }
  else { camera.position.set(190, 150, 260); controls.target.set(0, 20, 0); }
  controls.update();
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

// Hər binanın yer izi — yerdə rəngli kontur (əsas: qızılı, mövcud: boz, sizin: firuzəyi)
function outline(b, color, y = 0.6) {
  const hw = b.w / 2, hd = b.d / 2;
  const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]].map(([x, z]) => new THREE.Vector3(x, y, z));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
  l.renderOrder = 10;
  l.position.set(b.x, 0, b.z);
  l.rotation.y = THREE.MathUtils.degToRad(b.rot || 0);
  return l;
}
function drawFootprints() {
  if (!footprints) return;
  footprints.children.forEach((c) => c.geometry.dispose());
  footprints.clear();
  for (const b of FIXED) footprints.add(outline(b, b.main ? 0xd6a55a : 0x9aa0a8));
  for (const b of customs) if (!editing || b.id !== editing.id) footprints.add(outline(b, 0x7cc3b6));
  if (editing) footprints.add(outline(editing, clashes(editing) ? 0xef5b5b : 0xffffff, 0.8));
}

/* ---------------- Toqquşma (fırlanmış düzbucaqlılar, SAT) ---------------- */
function corners(b) {
  const r = THREE.MathUtils.degToRad(b.rot || 0), c = Math.cos(r), s = Math.sin(r);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const x = (i * b.w) / 2, z = (j * b.d) / 2;
    return [b.x + x * c + z * s, b.z - x * s + z * c];
  });
}
function overlap(a, b) {
  const A = corners(a), B = corners(b);
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4];
      const nx = z2 - z1, nz = x1 - x2;
      const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}
function clashes(b) {
  return FIXED.some((f) => overlap(b, f)) || customs.some((c) => c.id !== b.id && overlap(b, c));
}

/* ---------------- Siyahı ---------------- */
async function refresh() {
  customs = await listBuildings();
  for (const [id, g] of customGroups) { scene.remove(g); customGroups.delete(id); }
  for (const b of customs) {
    const g = await buildCustom(b);
    customGroups.set(b.id, g);
    if (!editing || editing.id !== b.id) scene.add(g);
  }
  renderList();
  drawFootprints();
}
function renderList() {
  const ul = $('#blist');
  const fixed = FIXED.map((b) => `<li class="is-fixed"><span class="num ${b.main ? 'main' : ''}">${b.id}</span><span><b>${b.name}</b><small>${b.floors} mərtəbə</small></span><span class="tag">mövcud</span></li>`);
  const mine = customs.map((b, i) => `<li data-id="${b.id}" class="${editing && editing.id === b.id ? 'is-on' : ''}"><span class="num new">${FIXED.length + i + 1}</span><span><b>${esc(b.name)}</b><small>${b.floors} mərtəbə · ${esc(b.status)}${b.kind === 'model' ? ' · 3D model' : ''}</small></span><span class="tag">redaktə</span></li>`);
  ul.innerHTML = [...fixed, ...(mine.length ? mine : ['<li class="empty">Hələ yeni bina əlavə etməmisiniz. "+ Yeni bina" düyməsini basın.</li>'])].join('');
}
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('#blist').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const b = customs.find((x) => x.id === li.dataset.id);
  if (b) openEditor({ ...b });
});

/* ---------------- Redaktor ---------------- */
const form = $('#editor');
form.status.innerHTML = STATUSES.map((s) => `<option>${s}</option>`).join('');
$('#addBtn').addEventListener('click', () => {
  // boş yer tap: kompleksin şərqində, toqquşmayan ilk nöqtə
  const b = { id: `b${Date.now().toString(36)}`, name: '', status: 'Layihə', apts: 60, kind: 'block', floors: 12, w: 26, d: 20, rot: 0, x: 120, z: 40, note: '', created: Date.now(), isNew: true };
  for (let k = 0; k < 40 && clashes(b); k++) { b.x = 120 + (k % 5) * 34; b.z = 40 - Math.floor(k / 5) * 34; }
  openEditor(b);
});
$('#cancelBtn').addEventListener('click', closeEditor);
$('#delBtn').addEventListener('click', async () => {
  if (!editing || editing.isNew) return;
  if (!confirm(`"${editing.name}" silinsin?`)) return;
  await deleteBuilding(editing.id);
  closeEditor();
  await refresh();
  toast('Bina silindi');
});

function openEditor(b) {
  editing = b;
  form.hidden = false;
  $('#edTitle').textContent = b.isNew ? 'Yeni bina' : `Redaktə: ${b.name}`;
  $('#delBtn').hidden = !!b.isNew;
  for (const k of ['name', 'status', 'apts', 'floors', 'w', 'd', 'rot', 'x', 'z', 'note']) form[k].value = b[k] ?? '';
  form.fitHeight.checked = !!b.fitHeight;
  form.querySelectorAll('input[name="kind"]').forEach((r) => (r.checked = r.value === (b.kind || 'block')));
  form.modelFile.value = '';
  form.planFile.value = '';
  $('#modelInfo').textContent = b.modelName ? `Yüklənib: ${b.modelName}` : 'Blender, 3ds Max, SketchUp-dan GLB kimi eksport edin';
  $('#planInfo').textContent = b.planName ? `Yüklənib: ${b.planName}` : 'Binanın altında yerə sərilir';
  showPlanPreview();
  syncKind();
  const g = customGroups.get(b.id);
  if (g) scene.remove(g);
  renderList();
  updatePreview();
  form.name.focus();
}
function closeEditor() {
  if (editing) { const g = customGroups.get(editing.id); if (g && !g.parent) scene.add(g); }
  editing = null;
  form.hidden = true;
  if (preview) { scene.remove(preview); preview = null; }
  renderList();
  drawFootprints();
}
function syncKind() {
  const model = form.querySelector('input[name="kind"]:checked').value === 'model';
  form.querySelectorAll('[data-for="model"]').forEach((el) => (el.hidden = !model));
}
function showPlanPreview() {
  const img = $('#planPreview');
  if (img.src) URL.revokeObjectURL(img.src);
  if (editing && editing.plan) { img.src = URL.createObjectURL(new Blob([editing.plan], { type: editing.planType })); img.hidden = false; }
  else { img.removeAttribute('src'); img.hidden = true; }
}

// Formdakı dəyərləri qeydə köçür
function readForm() {
  const b = editing;
  b.name = form.name.value.trim();
  b.status = form.status.value;
  b.apts = +form.apts.value || 0;
  b.kind = form.querySelector('input[name="kind"]:checked').value;
  b.floors = THREE.MathUtils.clamp(+form.floors.value || 1, 1, 60);
  b.w = THREE.MathUtils.clamp(+form.w.value || 20, 8, 120);
  b.d = THREE.MathUtils.clamp(+form.d.value || 20, 8, 120);
  b.rot = +form.rot.value || 0;
  b.x = +form.x.value || 0;
  b.z = +form.z.value || 0;
  b.note = form.note.value.trim();
  b.fitHeight = form.fitHeight.checked;
  $('#rotVal').textContent = `${b.rot}°`;
}
let pvTimer = 0, pvSeq = 0;
function updatePreview(fast) {
  if (!editing) return;
  readForm();
  $('#clashWarn').hidden = !clashes(editing);
  drawFootprints();
  if (preview && fast) {
    // yalnız yerdəyişmə/fırlanma — yenidən qurmağa ehtiyac yoxdur
    preview.position.set(editing.x, 0, editing.z);
    preview.rotation.y = THREE.MathUtils.degToRad(editing.rot);
    return;
  }
  clearTimeout(pvTimer);
  pvTimer = setTimeout(async () => {
    const seq = ++pvSeq;
    const g = await buildCustom(editing);
    if (seq !== pvSeq || !editing) return;
    if (preview) scene.remove(preview);
    preview = g;
    scene.add(g);
  }, 180);
}
form.addEventListener('input', (e) => {
  if (e.target.type === 'file') return;
  if (e.target.name === 'kind') syncKind();
  updatePreview(['x', 'z', 'rot'].includes(e.target.name));
});
form.addEventListener('change', async (e) => {
  if (e.target.name === 'modelFile' && e.target.files[0]) {
    const f = e.target.files[0];
    if (f.size > 40 * 1024 * 1024) { toast('Model çox böyükdür (40 MB-dan çox)'); e.target.value = ''; return; }
    editing.model = await f.arrayBuffer();
    editing.modelName = f.name;
    editing.kind = 'model';
    form.querySelector('input[value="model"]').checked = true;
    syncKind();
    $('#modelInfo').textContent = `Yüklənib: ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
    updatePreview();
  }
  if (e.target.name === 'planFile' && e.target.files[0]) {
    const f = e.target.files[0];
    editing.plan = await f.arrayBuffer();
    editing.planType = f.type;
    editing.planName = f.name;
    $('#planInfo').textContent = `Yüklənib: ${f.name}`;
    showPlanPreview();
    updatePreview();
  }
});
// brauzerin öz yoxlaması səssizcə dayandırmasın — səhvi göstər
form.addEventListener('invalid', (e) => { toast(`Sahəni yoxlayın: ${e.target.closest('label')?.firstChild?.textContent?.trim() || e.target.name}`); }, true);
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  readForm();
  if (!editing.name) { form.name.focus(); return; }
  if (editing.kind === 'model' && !editing.model) { toast('3D model faylını seçin və ya "Avtomatik fasad" seçin'); return; }
  if (clashes(editing) && !confirm('Bina başqa binanın üstünə düşür. Yenə də saxlanılsın?')) return;
  const rec = { ...editing };
  delete rec.isNew;
  await saveBuilding(rec);
  const wasNew = editing.isNew;
  if (preview) { scene.remove(preview); preview = null; }
  editing = null;
  form.hidden = true;
  await refresh();
  toast(wasNew ? 'Bina əlavə olundu — saytda baş planda görünəcək' : 'Dəyişikliklər saxlanıldı');
});

/* ---------------- Xəritədə yerləşdirmə ---------------- */
function groundAt(e) {
  const r = e.target.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, p) ? p : null;
}
function insideEditing(p) {
  if (!editing || !p) return false;
  const r = -THREE.MathUtils.degToRad(editing.rot || 0), c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - editing.x, dz = p.z - editing.z;
  const lx = dx * c + dz * s, lz = -dx * s + dz * c;
  return Math.abs(lx) < editing.w / 2 + 2 && Math.abs(lz) < editing.d / 2 + 2;
}
function bindPointer(canvas) {
  let down = null, drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    const p = groundAt(e);
    if (editing && insideEditing(p)) {
      drag = { dx: editing.x - p.x, dz: editing.z - p.z };
      controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = groundAt(e);
    if (drag && p) {
      form.x.value = (Math.round((p.x + drag.dx) * 2) / 2).toFixed(1);
      form.z.value = (Math.round((p.z + drag.dz) * 2) / 2).toFixed(1);
      updatePreview(true);
      return;
    }
    canvas.style.cursor = editing ? (insideEditing(p) ? 'grab' : 'crosshair') : 'default';
  });
  const up = (e) => {
    const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 99;
    if (drag) { drag = null; controls.enabled = true; }
    else if (editing && moved < 5) {
      const p = groundAt(e);
      if (p) { form.x.value = p.x.toFixed(1); form.z.value = p.z.toFixed(1); updatePreview(true); }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { drag = null; down = null; controls.enabled = true; });
  // klaviatura: oxlar — 1 m, Q/E — fırlatma
  addEventListener('keydown', (e) => {
    if (!editing || e.target.closest('input, textarea, select')) return;
    const step = e.shiftKey ? 5 : 1;
    const k = { ArrowLeft: ['x', -step], ArrowRight: ['x', step], ArrowUp: ['z', -step], ArrowDown: ['z', step] }[e.key];
    if (k) { form[k[0]].value = (+form[k[0]].value + k[1]).toFixed(1); updatePreview(true); e.preventDefault(); }
    if (e.key === 'q' || e.key === 'e') { form.rot.value = +form.rot.value + (e.key === 'q' ? -5 : 5); updatePreview(true); }
  });
}
