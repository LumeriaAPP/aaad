import { RESTAURANT, CATEGORIES, DISHES } from './menu.js';
import qrcode from '../vendor/qrcode/qrcode.mjs';

const $ = (s, r = document) => r.querySelector(s);
const money = (v) => `${Number.isInteger(v) ? v : v.toFixed(2)} ${RESTAURANT.currency}`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const table = new URLSearchParams(location.search).get('masa');
if (table) { $('#tableBadge').textContent = `Masa ${table}`; $('#tableBadge').hidden = false; }
$('#rName').textContent = RESTAURANT.name;
$('#rSub').textContent = RESTAURANT.sub;

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2400);
}

/* ---------- AR imkanları ---------- */
const isIOSQuickLook = (() => { const a = document.createElement('a'); return !!(a.relList && a.relList.supports && a.relList.supports('ar')); })();
let webxr = false;
const arCheck = import('./ar.js').then((m) => m.arSupported()).then((ok) => (webxr = ok)).catch(() => false);
const canAR = () => webxr || isIOSQuickLook;

/* ---------- sağa-sola sürüşən menyu ---------- */
let cat = 'all';
let list = DISHES;
let cur = 0;
const rail = $('#rail');
$('#cats').innerHTML = CATEGORIES.map((c) => `<button data-cat="${c.id}" class="${c.id === cat ? 'is-on' : ''}">${c.name}</button>`).join('');
$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  $('#cats').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
  render();
});
function render() {
  list = DISHES.filter((d) => cat === 'all' || d.cat === cat);
  cur = 0;
  rail.innerHTML = list.map((d, i) => `
    <article class="slide" data-i="${i}">
      <button class="slide__media" data-view="${i}" aria-label="${esc(d.name)} — 3D bax">
        <img src="img/${d.id}.webp" alt="${esc(d.name)}" loading="${i < 2 ? 'eager' : 'lazy'}" width="800" height="800" draggable="false">
        <span class="badge3d">3D · AR</span>
      </button>
      <div class="slide__body">
        <div class="slide__head"><h3>${esc(d.name)}</h3><b>${money(d.price)}</b></div>
        <p>${esc(d.desc)}</p>
        <span class="muted small">${esc(d.info)}</span>
        <div class="slide__actions">
          <button class="btn-ar" data-ar="${i}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m12 7 5 3v5l-5 3-5-3v-5z"/></svg>
            Masada gör
          </button>
          <button class="btn-ghost" data-view="${i}">3D bax</button>
          <button class="btn-ghost btn-plus" data-add="${i}" aria-label="Sifarişə əlavə et">+</button>
        </div>
      </div>
    </article>`).join('');
  $('#dots').innerHTML = list.map((_, i) => `<i class="${i === 0 ? 'is-on' : ''}"></i>`).join('');
  rail.scrollTo({ left: 0 });
}
render();
const slideW = () => (rail.firstElementChild ? rail.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 0) : 1);
rail.addEventListener('scroll', () => {
  const i = Math.round(rail.scrollLeft / slideW());
  if (i !== cur && i >= 0 && i < list.length) {
    cur = i;
    [...$('#dots').children].forEach((d, k) => d.classList.toggle('is-on', k === i));
  }
}, { passive: true });
const goSlide = (i) => rail.scrollTo({ left: Math.max(0, Math.min(list.length - 1, i)) * slideW(), behavior: 'smooth' });
$('#railPrev').addEventListener('click', () => goSlide(cur - 1));
$('#railNext').addEventListener('click', () => goSlide(cur + 1));
// kompüterdə siçanla da sürüşdürmək olsun
let mdrag = null;
rail.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') mdrag = { x: e.clientX, s: rail.scrollLeft, moved: false }; });
addEventListener('pointermove', (e) => { if (mdrag) { const dx = e.clientX - mdrag.x; if (Math.abs(dx) > 4) { mdrag.moved = true; rail.classList.add('dragging'); } rail.scrollLeft = mdrag.s - dx; } });
addEventListener('pointerup', () => { if (mdrag) { rail.classList.remove('dragging'); if (mdrag.moved) goSlide(Math.round(rail.scrollLeft / slideW())); setTimeout(() => (mdrag = null), 0); } });
addEventListener('keydown', (e) => { if (!$('#sheet').hidden || !$('#arOverlay').hidden) return; if (e.key === 'ArrowRight') goSlide(cur + 1); if (e.key === 'ArrowLeft') goSlide(cur - 1); });

rail.addEventListener('click', (e) => {
  if (mdrag && mdrag.moved) return;
  const v = e.target.closest('[data-view]'), a = e.target.closest('[data-ar]'), p = e.target.closest('[data-add]');
  if (a) openAR(+a.dataset.ar);
  else if (p) addToOrder(list[+p.dataset.add]);
  else if (v) openSheet(+v.dataset.view);
});

/* ---------- kamera (AR) ---------- */
let arApi = null;
async function openAR(i) {
  await arCheck;
  if (webxr) return startWebXR(i);
  if (isIOSQuickLook) return quickLook(i);
  openSheet(i); // AR yoxdur — 3D baxış + QR kod
  toast('Bu cihazda kamera rejimi yoxdur — telefonla açın');
}

// Android: öz kamera rejimimiz — menyu aşağıda sürüşür, yemək yalnız masada görünür
async function startWebXR(i) {
  const ov = $('#arOverlay');
  const arRail = $('#arRail');
  arRail.innerHTML = list.map((d, k) => `<button class="ar-card" data-k="${k}"><img src="img/${d.id}.webp" alt=""><span>${esc(d.name)}</span></button>`).join('');
  ov.hidden = false;
  const HINT = {
    searching: 'Telefonu masaya tutub yavaşca hərəkət etdirin',
    floor: 'Bu masa deyil — telefonu masanın üstünə tutun',
    'need-table': 'Yemək yalnız masanın üstünə qoyulur — telefonu masaya tutun',
    table: 'Masa tapıldı ✓ — yeməyi qoymaq üçün ekrana toxunun',
    placed: 'Barmaqla fırladın · başqa yerə toxunub köçürün · aşağıda sürüşdürüb dəyişin',
    loading: 'Yüklənir…',
  };
  let lastState = '', arIndex = i, syncing = false;
  try {
    const { startAR } = await import('./ar.js');
    arApi = await startAR(list, i, {
      overlay: ov,
      brand: { title: RESTAURANT.name, sub: RESTAURANT.sub, currency: RESTAURANT.currency },
      cursor: $('#fingerCursor'),
      onFinger(state) {
        const h = $('#fingerHint');
        h.hidden = false;
        h.textContent = state === 'ready' ? '☝ Barmağınızla menyudakı yeməyi göstərin — 1 saniyə saxlayın və ya çimdikləyin' : 'Barmaqla seçim bu telefonda yoxdur — menyuya toxunun';
        clearTimeout(h.t);
        h.t = setTimeout(() => (h.hidden = true), 6000);
      },
      onChange(k, state) {
        if (state !== lastState) { $('#arHint').textContent = HINT[state] || ''; lastState = state; }
        if (k !== arIndex || state === 'ready') {
          arIndex = k;
          const d = list[k];
          $('#arName').textContent = d.name;
          $('#arPrice').textContent = money(d.price);
          [...arRail.children].forEach((c, n) => c.classList.toggle('is-on', n === k));
          const card = arRail.children[k];
          if (card) { syncing = true; arRail.scrollTo({ left: card.offsetLeft - (arRail.clientWidth - card.clientWidth) / 2, behavior: 'smooth' }); setTimeout(() => (syncing = false), 450); }
        }
      },
      onExit(k) { ov.hidden = true; arApi = null; hideStart(); goSlide(k); },
    });
  } catch (err) {
    ov.hidden = true;
    console.warn(err);
    toast('Kamera açılmadı — icazə verin və yenidən cəhd edin');
    return;
  }
  // aşağıdakı menyu: sürüşdürəndə ortadakı yemək masada göstərilir
  let t = 0;
  arRail.onscroll = () => {
    if (syncing) return;
    clearTimeout(t);
    t = setTimeout(() => {
      const mid = arRail.scrollLeft + arRail.clientWidth / 2;
      let best = 0, bd = Infinity;
      [...arRail.children].forEach((c, n) => { const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < bd) { bd = d; best = n; } });
      if (best !== arIndex && arApi) arApi.go(best);
    }, 140);
  };
  arRail.onclick = (e) => { const c = e.target.closest('[data-k]'); if (c && arApi) arApi.go(+c.dataset.k); };
}
$('#arClose').addEventListener('click', () => arApi && arApi.end());
$('#arAdd').addEventListener('click', () => { const d = list.find((x) => x.name === $('#arName').textContent); if (d) addToOrder(d); });

// iPhone: Apple Quick Look — real AR, masaya qoyulur. Banner düyməsi ilə növbəti yeməyə keçid.
const ql = $('#ql');
let qlIndex = 0;
function quickLook(i) {
  qlIndex = (i + list.length) % list.length;
  const d = list[qlIndex], next = list[(qlIndex + 1) % list.length];
  const params = new URLSearchParams({ callToAction: `Növbəti: ${next.name} →`, checkoutTitle: d.name, checkoutSubtitle: `${money(d.price)} · ${d.info}`, allowsContentScaling: '0' });
  ql.href = `models/${d.id}.usdz#${params.toString().replace(/\+/g, '%20')}`;
  ql.querySelector('img').src = `img/${d.id}.webp`;
  ql.click();
}
ql.addEventListener('message', (e) => { if (e.data === '_apple_ar_quicklook_button_tapped') quickLook(qlIndex + 1); });

/* ---------- 3D baxış pəncərəsi ---------- */
const sheet = $('#sheet');
const mv = $('#mv');
let current = null;
function openSheet(i) {
  const d = list[i];
  current = i;
  $('#dName').textContent = d.name;
  $('#dPrice').textContent = money(d.price);
  $('#dInfo').textContent = d.info;
  $('#dDesc').textContent = d.desc;
  $('#dTags').innerHTML = d.tags.map((t) => `<span>${esc(t)}</span>`).join('');
  $('#dCredit').textContent = d.credit || '';
  $('#dCredit').hidden = !d.credit;
  mv.poster = `img/${d.id}.webp`;
  mv.src = `models/${d.id}.glb`;
  mv.alt = `${d.name} — 3D model`;
  sheet.hidden = false;
  document.body.classList.add('lock');
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  arCheck.then(() => {
    $('#sheetAr').hidden = !canAR();
    $('#noAr').hidden = canAR();
    if (!canAR()) {
      const url = new URL(location.href); url.hash = d.id;
      const q = qrcode(0, 'M'); q.addData(url.toString()); q.make();
      $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    }
  });
}
$('#sheetAr').addEventListener('click', () => { const i = current; close(sheet); openAR(i); });
function close(el) {
  el.classList.remove('is-open');
  setTimeout(() => { el.hidden = true; }, 280);
  document.body.classList.remove('lock');
}
document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(s); }));
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.sheet:not([hidden])').forEach(close); });
mv.addEventListener('progress', (e) => {
  const bar = $('.mv-progress span');
  if (bar) bar.style.width = `${Math.round(e.detail.totalProgress * 100)}%`;
  $('.mv-progress').classList.toggle('is-done', e.detail.totalProgress >= 1);
});
if (location.hash) {
  const i = list.findIndex((x) => x.id === location.hash.slice(1));
  if (i >= 0) setTimeout(() => goSlide(i), 200);
}

/* ---------- sifariş ---------- */
const order = new Map();
function addToOrder(d) {
  order.set(d.id, (order.get(d.id) || 0) + 1);
  toast(`${d.name} sifarişə əlavə olundu`);
  updateBasket();
}
$('#addBtn').addEventListener('click', () => { if (current != null) addToOrder(list[current]); });
function updateBasket() {
  let n = 0, sum = 0;
  for (const [id, q] of order) { const d = DISHES.find((x) => x.id === id); n += q; sum += q * d.price; }
  $('#basketBtn').hidden = n === 0;
  $('#basketCount').textContent = n;
  $('#basketSum').textContent = money(sum);
  $('#olist').innerHTML = [...order].map(([id, q]) => {
    const d = DISHES.find((x) => x.id === id);
    return `<li><img src="img/${id}.webp" alt=""><span><b>${esc(d.name)}</b><small>${money(d.price)}</small></span>
      <span class="qty"><button data-q="${id}" data-d="-1" aria-label="Azalt">−</button>${q}<button data-q="${id}" data-d="1" aria-label="Artır">+</button></span></li>`;
  }).join('');
  $('#oSum').textContent = money(sum);
  $('#orderTable').textContent = table ? `Masa ${table}` : '';
  if (n === 0 && !$('#order').hidden) close($('#order'));
}
$('#basketBtn').addEventListener('click', () => {
  const o = $('#order');
  o.hidden = false;
  document.body.classList.add('lock');
  requestAnimationFrame(() => o.classList.add('is-open'));
});
$('#olist').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const q = (order.get(b.dataset.q) || 0) + +b.dataset.d;
  if (q <= 0) order.delete(b.dataset.q); else order.set(b.dataset.q, q);
  updateBasket();
});

/* ---------- açılış ekranı: birbaşa kamera ---------- */
const start = $('#start');
function hideStart() { start.classList.add('is-gone'); setTimeout(() => (start.hidden = true), 500); $('#camFab').hidden = false; }
$('#startBtn').addEventListener('click', async () => {
  await arCheck;
  if (webxr) { cat = 'all'; render(); return startWebXR(0); }
  if (isIOSQuickLook) { hideStart(); return quickLook(0); }
  hideStart();
  toast('Bu cihazda kamera (AR) yoxdur — telefonla açın. Menyuya burada baxa bilərsiniz.');
});
$('#startSkip').addEventListener('click', hideStart);
$('#camFab').addEventListener('click', () => openAR(cur));
if (location.hash) hideStart();
arCheck.then(() => {
  if (!canAR()) $('#startNote').hidden = false, $('#startNote').textContent = 'Bu cihaz kamerada 3D-ni dəstəkləmir. Telefonda (Android Chrome və ya iPhone Safari) açın.';
});
