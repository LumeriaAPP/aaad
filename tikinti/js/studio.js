// Dizayn studiyası: mənzilə yuxarıdan baxıb otaqların təyinatını, rəngləri,
// döşəməni və mebelin yerini dəyişmək üçün interfeys.
import * as THREE from 'three';
import {
  USES, WALL_COLORS, FLOORS, FABRICS, STYLES, CATALOG, DEFAULT_WALL,
  allowedUses, furnishRoom, furnishAll, addItem, applyStyle, saveDesign, clearDesign, defaultDesign, itemRect, roomAt, placementOk,
} from './design.js';

const ICON = {
  rotL: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  rotR: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  del: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  magic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 4 1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7z"/><path d="M4 20 13 11"/></svg>',
};
const ITEM_NAME = Object.fromEntries(CATALOG);
Object.assign(ITEM_NAME, { kitchenRun: 'Mətbəx mebeli', fridge: 'Soyuducu', island: 'Ada masa', bathtub: 'Vanna', vanity: 'Lavabo', toilet: 'Unitaz', shower: 'Duş' });

export function initStudio(env) {
  const { camera, canvas, controls } = env;
  const panel = document.getElementById('designPanel');
  const bar = document.getElementById('dzItemBar');
  const labelsEl = document.getElementById('labels');
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let ad = null; // redaktə olunan mənzil (buildApartment nəticəsi)
  let selRoom = null;
  let selItem = -1;
  let allRooms = false;
  let drag = null;
  let down = null;
  let labels = [];
  let pendingColor = null;
  const hl = new THREE.Group(); // seçim işarələri (mənzilin yerli koordinatlarında)
  hl.renderOrder = 20;

  const gold = new THREE.LineBasicMaterial({ color: 0xd6b47a, transparent: true, depthTest: false });
  const red = new THREE.LineBasicMaterial({ color: 0xef5b5b, transparent: true, depthTest: false });
  const roomFillMat = new THREE.MeshBasicMaterial({ color: 0xd6b47a, transparent: true, opacity: 0.12, depthWrite: false, depthTest: false });

  const plan = () => ad.plan;
  const design = () => ad.design;
  const T = () => ad.slotT;
  const toWorld = (x, z, y = 0) => tmp.set(T().tx + T().sx * x, ad.baseY + y, T().tz + T().sz * z);
  const toLocal = (p) => ({ x: (p.x - T().tx) * T().sx, z: (p.z - T().tz) * T().sz });

  /* ---------- Seçim işarələri ---------- */
  function rectLine(r, y, mat = gold) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(r.x0, y, r.z0), new THREE.Vector3(r.x1, y, r.z0), new THREE.Vector3(r.x1, y, r.z1), new THREE.Vector3(r.x0, y, r.z1), new THREE.Vector3(r.x0, y, r.z0),
    ]);
    const l = new THREE.Line(g, mat);
    l.renderOrder = 20;
    return l;
  }
  function refreshHighlights() {
    hl.children.forEach((c) => c.geometry.dispose());
    hl.clear();
    if (!ad) return;
    ad.group.add(hl);
    const r = plan().rooms_.find((x) => x.id === selRoom);
    if (r && selItem < 0) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.14, r.d - 0.14).rotateX(-Math.PI / 2).translate(r.x + r.w / 2, 0.03, r.z + r.d / 2), roomFillMat);
      m.renderOrder = 19;
      hl.add(m, rectLine({ x0: r.x + 0.07, x1: r.x + r.w - 0.07, z0: r.z + 0.07, z1: r.z + r.d - 0.07 }, 0.04));
    }
    const it = design().furniture[selItem];
    if (it) {
      const rc = itemRect(it);
      hl.add(rectLine({ x0: rc.x0 - 0.04, x1: rc.x1 + 0.04, z0: rc.z0 - 0.04, z1: rc.z1 + 0.04 }, 0.05));
    }
  }

  /* ---------- Otaq adları ---------- */
  function makeLabels() {
    labels.forEach((l) => l.el.remove());
    labels = plan().rooms_.map((r) => {
      const el = document.createElement('button');
      el.className = 'dz-room-label';
      el.dataset.room = r.id;
      el.innerHTML = `<b>${r.name}</b><small>${(r.w * r.d).toFixed(1)} m²</small>`;
      el.addEventListener('click', () => selectRoom(r.id));
      labelsEl.appendChild(el);
      return { el, r };
    });
    labels.forEach((l) => l.el.classList.toggle('is-on', l.r.id === selRoom));
  }

  /* ---------- Yenidən qurma ---------- */
  function commit(rebuildPanel = true) {
    saveDesign(ad.apt, design());
    ad = env.rebuild(ad, true);
    refreshHighlights();
    makeLabels();
    if (rebuildPanel) renderPanel();
    else updateBar();
  }

  function selectRoom(id) {
    selRoom = id;
    selItem = -1;
    refreshHighlights();
    labels.forEach((l) => l.el.classList.toggle('is-on', l.r.id === selRoom));
    renderPanel();
  }
  function selectItem(i) {
    selItem = i;
    const it = design().furniture[i];
    if (it) selRoom = (roomAt(plan(), it.x, it.z) || {}).id || selRoom;
    refreshHighlights();
    labels.forEach((l) => l.el.classList.toggle('is-on', l.r.id === selRoom));
    renderPanel();
  }

  /* ---------- Panel ---------- */
  const swatch = (attr, hex, name, on) => `<button class="dz-sw${on ? ' is-on' : ''}" ${attr}="${hex}" title="${name}" style="--c:${hex}"><i></i><span>${name}</span></button>`;
  function renderPanel() {
    if (!ad) return;
    const d = design();
    const pl = plan();
    const base = ad.apt.type.rooms_.find((r) => r.id === selRoom);
    const room = pl.rooms_.find((r) => r.id === selRoom);
    const dr = d.rooms[selRoom] || {};
    const uses = base ? allowedUses(base) : [];
    const fixed = base && (base.kind === 'bath' || base.kind === 'hall');
    const it = d.furniture[selItem];
    const scroll = panel.querySelector('.dz-scroll')?.scrollTop || 0;
    panel.innerHTML = `
      <div class="dz-scroll">
        <div class="dz-head">
          <button class="apt-close" data-dz-close aria-label="Bağla">${ICON.close}</button>
          <span class="eyebrow">Dizayn studiyası</span>
          <h3>Mənzil № ${ad.apt.number}</h3>
          <p>Otağa klikləyin, təyinatını seçin — əşyalar avtomatik düzülür. Mebeli sürüşdürün, fırladın, rəngləri dəyişin.</p>
        </div>
        <section class="dz-sec">
          <h4>Otaqlar</h4>
          <div class="dz-rooms">${pl.rooms_.map((r) => `<button data-room="${r.id}" class="${r.id === selRoom ? 'is-on' : ''}"><i style="background:${r.wall}"></i>${r.name}<small>${(r.w * r.d).toFixed(1)} m²</small></button>`).join('')}</div>
        </section>
        ${it ? `
        <section class="dz-sec dz-sel">
          <h4>Seçilmiş əşya</h4>
          <div class="dz-selrow"><b>${ITEM_NAME[it.k] || it.k}</b>
            <span><button class="dz-icon" data-rot="-45" title="Sola fırlat (Shift+R)">${ICON.rotL}</button><button class="dz-icon" data-rot="45" title="Sağa fırlat (R)">${ICON.rotR}</button><button class="dz-icon dz-icon--bad" data-del title="Sil (Delete)">${ICON.del}</button></span>
          </div>
          <p class="dz-note">Siçanla sürüşdürüb yerini dəyişin. Esc — seçimi ləğv et.</p>
        </section>` : ''}
        <section class="dz-sec">
          <h4>Təyinat${room ? ` · <span>${room.name}</span>` : ''}</h4>
          ${fixed ? '<p class="dz-note">Hamam və dəhlizin yeri kommunikasiyalara görə sabitdir — rəngini və döşəməsini dəyişə bilərsiniz.</p>'
            : `<div class="dz-chips">${uses.map((u) => `<button data-use="${u}" class="${dr.use === u ? 'is-on' : ''}">${USES[u].name}</button>`).join('')}</div>
               <button class="dz-link" data-dz-auto>${ICON.magic} Bu otağı yenidən düz</button>`}
        </section>
        <section class="dz-sec">
          <h4>Divar rəngi</h4>
          <div class="dz-swatches">${WALL_COLORS.map(([n, h]) => swatch('data-wall', h, n, (dr.wall || DEFAULT_WALL).toLowerCase() === h)).join('')}
            <label class="dz-sw dz-sw--custom" title="İstənilən rəng"><input type="color" data-wall-custom value="${dr.wall || DEFAULT_WALL}"><i></i><span>Öz rəngin</span></label>
          </div>
          <label class="dz-check"><input type="checkbox" data-all ${allRooms ? 'checked' : ''}> Bütün otaqlara tətbiq et</label>
        </section>
        <section class="dz-sec">
          <h4>Döşəmə</h4>
          <div class="dz-swatches dz-swatches--floor">${Object.entries(FLOORS).map(([k, f]) => swatch('data-floor', k, f.name, dr.floor === k).replace(`style="--c:${k}"`, `style="--c:${f.sw}"`)).join('')}</div>
        </section>
        <section class="dz-sec">
          <h4>Mebel əlavə et <span>→ ${room ? room.name : ''}</span></h4>
          <div class="dz-chips dz-chips--small">${CATALOG.map(([k, n]) => `<button data-add="${k}">+ ${n}</button>`).join('')}</div>
          <h5>Parça rəngi (divan, kreslo, stullar)</h5>
          <div class="dz-swatches dz-swatches--round">${FABRICS.map(([n, h]) => swatch('data-fabric', h, n, d.fabric === h)).join('')}</div>
        </section>
        <section class="dz-sec">
          <h4>Hazır stillər</h4>
          <div class="dz-styles">${Object.entries(STYLES).map(([k, s]) => `<button data-style="${k}" class="${d.style === k ? 'is-on' : ''}"><span class="dz-pal"><i style="background:${s.wall}"></i><i style="background:${FLOORS[s.floor].sw}"></i><i style="background:${s.fabric}"></i><i style="background:${s.accent}"></i></span>${s.name}</button>`).join('')}</div>
        </section>
      </div>
      <div class="dz-actions">
        <button class="btn btn--gold btn--block" data-dz-tour>Virtual turda bax</button>
        <div class="dz-actions__row">
          <button class="btn btn--ghost" data-dz-auto-all>${ICON.magic} Hamısını düz</button>
          <button class="btn btn--ghost" data-dz-reset>Sıfırla</button>
        </div>
      </div>`;
    panel.querySelector('.dz-scroll').scrollTop = scroll;
    updateBar();
  }

  panel.addEventListener('click', (e) => {
    if (!ad) return;
    const t = (s) => e.target.closest(s);
    const d = design();
    let b;
    if (t('[data-dz-close]')) return env.onClose(exit());
    if (t('[data-dz-tour]')) return env.onTour(exit());
    if ((b = t('[data-room]'))) return selectRoom(b.dataset.room);
    if ((b = t('[data-use]'))) { furnishRoom(ad.apt.type, ad.apt.slot, d, selRoom, b.dataset.use); selItem = -1; return commit(); }
    if (t('[data-dz-auto]')) { furnishRoom(ad.apt.type, ad.apt.slot, d, selRoom, d.rooms[selRoom].use); selItem = -1; return commit(); }
    if (t('[data-dz-auto-all]')) { furnishAll(ad.apt.type, ad.apt.slot, d); selItem = -1; return commit(); }
    if (t('[data-dz-reset]')) {
      clearDesign(ad.apt);
      ad.design = defaultDesign(ad.apt.type);
      selItem = -1;
      ad = env.rebuild(ad, true);
      refreshHighlights(); makeLabels(); renderPanel();
      return;
    }
    if ((b = t('[data-wall]'))) return setWall(b.dataset.wall);
    if ((b = t('[data-floor]'))) {
      for (const id of allRooms ? Object.keys(d.rooms) : [selRoom]) d.rooms[id].floor = b.dataset.floor;
      d.style = null;
      return commit();
    }
    if ((b = t('[data-fabric]'))) { d.fabric = b.dataset.fabric; return commit(); }
    if ((b = t('[data-style]'))) { applyStyle(ad.apt.type, d, b.dataset.style); return commit(); }
    if ((b = t('[data-add]'))) {
      const it = addItem(ad.apt.type, ad.apt.slot, d, selRoom, b.dataset.add);
      commit(false);
      return selectItem(d.furniture.indexOf(it));
    }
    if ((b = t('[data-rot]'))) return rotate(+b.dataset.rot);
    if (t('[data-del]')) return removeItem();
  });
  panel.addEventListener('change', (e) => {
    if (e.target.matches('[data-all]')) allRooms = e.target.checked;
  });
  panel.addEventListener('input', (e) => {
    if (!e.target.matches('[data-wall-custom]')) return;
    // rəng seçərkən tez-tez gəlir — hər kadrda bir dəfə yenilə
    const first = pendingColor == null;
    pendingColor = e.target.value;
    if (first) requestAnimationFrame(() => { const c = pendingColor; pendingColor = null; setWall(c, false); });
  });
  function setWall(hex, rebuildPanel = true) {
    const d = design();
    for (const id of allRooms ? Object.keys(d.rooms) : [selRoom]) d.rooms[id].wall = hex;
    d.style = null;
    commit(rebuildPanel);
    if (!rebuildPanel) {
      panel.querySelectorAll('[data-wall]').forEach((x) => x.classList.toggle('is-on', x.dataset.wall === hex));
      panel.querySelectorAll('.dz-rooms [data-room] i').forEach((i, k) => { i.style.background = plan().rooms_[k].wall; });
    }
  }

  /* ---------- Əşya əməliyyatları ---------- */
  function rotate(deg) {
    const it = design().furniture[selItem];
    if (!it) return;
    it.rot = (((it.rot || 0) + deg + 540) % 360) - 180;
    commit(false);
    refreshHighlights();
  }
  function removeItem() {
    const d = design();
    if (selItem < 0) return;
    d.furniture.splice(selItem, 1);
    selItem = -1;
    commit();
  }

  // Seçilmiş əşyanın yanında kiçik alətlər paneli
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.rot) rotate(+b.dataset.rot);
    if (b.hasAttribute('data-del')) removeItem();
  });
  bar.innerHTML = `<button data-rot="-45" title="Sola fırlat">${ICON.rotL}</button><button data-rot="45" title="Sağa fırlat">${ICON.rotR}</button><button data-del title="Sil">${ICON.del}</button>`;
  function updateBar() {
    const it = ad && design().furniture[selItem];
    bar.hidden = !it;
  }

  /* ---------- Siçan / toxunma ---------- */
  function setNdc(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pickItem(e) {
    setNdc(e);
    const hits = ray.intersectObjects(ad.items, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.itemIndex == null) o = o.parent;
      if (o && design().furniture[o.userData.itemIndex]?.k !== 'rug') return o;
    }
    // xalçalar ən sonda (üstündəki əşyalar seçilsin)
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.itemIndex == null) o = o.parent;
      if (o) return o;
    }
    return null;
  }
  function floorPoint(e) {
    setNdc(e);
    plane.constant = -ad.baseY;
    return ray.ray.intersectPlane(plane, hit) ? toLocal(hit) : null;
  }

  addEventListener('pointerdown', (e) => {
    if (!ad || e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
    down = { x: e.clientX, y: e.clientY };
    const obj = pickItem(e);
    if (!obj) return; // boş yer — kamera fırlansın
    const idx = obj.userData.itemIndex;
    const p = floorPoint(e);
    const it = design().furniture[idx];
    if (!p || !it) return;
    e.stopImmediatePropagation();
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    drag = { idx, obj, dx: it.x - p.x, dz: it.z - p.z, x0: it.x, z0: it.z, moved: false, id: e.pointerId };
    if (selItem !== idx) selectItem(idx);
    canvas.style.cursor = 'grabbing';
  }, true);

  addEventListener('pointermove', (e) => {
    if (!ad) return;
    if (drag && e.pointerId === drag.id) {
      const p = floorPoint(e);
      if (!p) return;
      const pl = plan();
      let x = Math.round((p.x + drag.dx) * 20) / 20, z = Math.round((p.z + drag.dz) * 20) / 20;
      x = THREE.MathUtils.clamp(x, 0.2, pl.w - 0.2);
      z = THREE.MathUtils.clamp(z, 0.2, pl.d - 0.2);
      if (Math.abs(x - drag.x0) + Math.abs(z - drag.z0) > 0.04) drag.moved = true;
      drag.obj.position.set(x, 0, z);
      drag.x = x; drag.z = z;
      const it = design().furniture[drag.idx];
      const rc = itemRect({ ...it, x, z });
      // qırmızı çərçivə — bu yerə sığmır (divara və ya başqa əşyaya girir)
      drag.ok = placementOk(pl, design().furniture, drag.idx, { ...it, x, z });
      hl.children.forEach((c) => c.geometry.dispose());
      hl.clear();
      hl.add(rectLine({ x0: rc.x0 - 0.04, x1: rc.x1 + 0.04, z0: rc.z0 - 0.04, z1: rc.z1 + 0.04 }, 0.05, drag.ok ? gold : red));
      return;
    }
    if (e.target !== canvas || e.pointerType === 'touch' || e.buttons) return;
    canvas.style.cursor = pickItem(e) ? 'grab' : 'pointer';
  }, true);

  addEventListener('pointerup', (e) => {
    if (!ad) return;
    if (drag && e.pointerId === drag.id) {
      const d = drag;
      drag = null;
      controls.enabled = true;
      canvas.style.cursor = 'grab';
      if (d.moved && d.ok === false) {
        // sığmayan yerə qoyulmur — əvvəlki yerinə qaytar
        d.obj.position.set(d.x0, 0, d.z0);
        refreshHighlights();
        env.toast && env.toast('Bu yerə sığmır — divara və ya başqa əşyaya dəyir');
      } else if (d.moved) {
        const it = design().furniture[d.idx];
        const ddx = d.x - it.x, ddz = d.z - it.z;
        // əşyanın üstündəki asma lampa da onunla birlikdə getsin
        for (const f of design().furniture) if (f.k === 'pendant' && Math.hypot(f.x - it.x, f.z - it.z) < 0.35) { f.x = +(f.x + ddx).toFixed(2); f.z = +(f.z + ddz).toFixed(2); }
        it.x = d.x; it.z = d.z;
        it.room = (roomAt(plan(), it.x, it.z) || {}).id || it.room;
        commit();
      } else refreshHighlights();
      down = null;
      return;
    }
    if (!down || e.target !== canvas) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const p = floorPoint(e);
    const r = p && roomAt(plan(), p.x, p.z);
    if (r) selectRoom(r.id);
    else if (selItem >= 0) { selItem = -1; refreshHighlights(); renderPanel(); }
  }, true);

  addEventListener('keydown', (e) => {
    if (!ad || e.target.closest('input, textarea, select')) return;
    if ((e.key === 'r' || e.key === 'R' || e.code === 'KeyR') && selItem >= 0) { rotate(e.shiftKey ? -45 : 45); e.preventDefault(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selItem >= 0) { removeItem(); e.preventDefault(); }
  });

  /* ---------- Giriş / çıxış ---------- */
  function enter(ad0) {
    ad = env.rebuild(ad0, true);
    const firstFree = ad.apt.type.rooms_.find((r) => r.kind !== 'hall' && r.kind !== 'bath');
    selRoom = (firstFree || ad.apt.type.rooms_[0]).id;
    selItem = -1;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    document.body.classList.add('designing');
    makeLabels();
    refreshHighlights();
    renderPanel();
    const pl = plan();
    const c = toWorld(pl.w / 2, pl.d / 2).clone();
    const small = innerWidth < 760;
    // kamera fasad tərəfdən baxır; ekranın sağı dünya x-də side işarəsi ilə üst-üstə düşür
    const side = c.z > 0 ? 1 : -1;
    // panel ekranın bir hissəsini tutur — mənzili görünən hissənin ortasına sürüşdür
    const tgt = c.clone().add(small ? new THREE.Vector3(0, 0, side * 3.4) : new THREE.Vector3(side * 3.0, 0, 0));
    const h = Math.max(pl.w, pl.d) * (small ? 2.15 : 1.62) + 1;
    controls.minDistance = 5;
    controls.maxDistance = 40;
    env.flyTo(tgt.clone().add(new THREE.Vector3(0, h, side * h * 0.3)), tgt, 1200);
  }

  function exit() {
    if (!ad) return null;
    const out = env.rebuild(ad, false);
    hl.children.forEach((c) => c.geometry.dispose());
    hl.clear();
    hl.removeFromParent();
    labels.forEach((l) => l.el.remove());
    labels = [];
    panel.classList.remove('is-open');
    panel.hidden = true;
    bar.hidden = true;
    document.body.classList.remove('designing');
    controls.enabled = true;
    controls.minDistance = 8;
    controls.maxDistance = 90;
    drag = null;
    ad = null;
    return out;
  }

  // Esc: əvvəl seçimi ləğv et, sonra studiyadan çıx
  function escape() {
    if (selItem >= 0) { selItem = -1; refreshHighlights(); renderPanel(); return true; }
    env.onClose(exit());
    return true;
  }

  // Hər kadrda: etiketlərin və alətlər panelinin yeri
  function update() {
    if (!ad) return;
    for (const l of labels) {
      const p = toWorld(l.r.x + l.r.w / 2, l.r.z + l.r.d / 2, 3.25).project(camera);
      const vis = p.z < 1;
      l.el.style.transform = `translate(${((p.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-p.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%, -50%)`;
      l.el.style.visibility = vis ? 'visible' : 'hidden';
    }
    const it = design().furniture[selItem];
    if (it && !bar.hidden) {
      const x = drag ? drag.obj.position.x : it.x, z = drag ? drag.obj.position.z : it.z;
      const p = toWorld(x, z, 3.1).project(camera);
      bar.style.transform = `translate(${((p.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-p.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%, -130%)`;
    }
  }

  return { enter, exit, escape, update, get active() { return !!ad; }, get ad() { return ad; } };
}
