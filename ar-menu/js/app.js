import { RESTAURANT, CATEGORIES, DISHES } from './menu.js';
import qrcode from '../vendor/qrcode/qrcode.mjs';

const $ = (s, r = document) => r.querySelector(s);
const cur = RESTAURANT.currency;
const money = (v) => `${Number.isInteger(v) ? v : v.toFixed(2)} ${cur}`;

// masa nömrəsi QR koddan gəlir: ?masa=5
const table = new URLSearchParams(location.search).get('masa');
if (table) { $('#tableBadge').textContent = `Masa ${table}`; $('#tableBadge').hidden = false; }
$('#rName').textContent = RESTAURANT.name;
$('#rSub').textContent = RESTAURANT.sub;

/* ---------- kateqoriyalar və kartlar ---------- */
let cat = 'all';
$('#cats').innerHTML = CATEGORIES.map((c) => `<button data-cat="${c.id}" class="${c.id === cat ? 'is-on' : ''}">${c.name}</button>`).join('');
$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  $('#cats').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
  render();
});
function render() {
  const list = DISHES.filter((d) => cat === 'all' || d.cat === cat);
  $('#grid').innerHTML = list.map((d, i) => `
    <article class="card" data-id="${d.id}" style="--i:${i}">
      <button class="card__media" data-open="${d.id}" aria-label="${d.name} — 3D bax">
        <img src="img/${d.id}.webp" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" width="640" height="640">
        <span class="badge3d">3D · AR</span>
      </button>
      <div class="card__body">
        <div class="card__head"><h3>${d.name}</h3><b>${money(d.price)}</b></div>
        <p>${d.desc}</p>
        <div class="card__foot">
          <span class="muted">${d.info}</span>
          <button class="btn-ar" data-open="${d.id}" data-ar="1">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 7 5 3v5l-5 3-5-3v-5z"/><path d="M12 12v6M12 12l5-2M12 12l-5-2"/></svg>
            Masada gör
          </button>
        </div>
      </div>
    </article>`).join('');
}
render();

/* ---------- 3D pəncərə ---------- */
const sheet = $('#sheet');
const mv = $('#mv');
let current = null;
let lastFocus = null;

$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  open(DISHES.find((d) => d.id === b.dataset.open), !!b.dataset.ar);
});

function open(d, wantAR) {
  current = d;
  lastFocus = document.activeElement;
  $('#dName').textContent = d.name;
  $('#dPrice').textContent = money(d.price);
  $('#dInfo').textContent = d.info;
  $('#dDesc').textContent = d.desc;
  $('#dTags').innerHTML = d.tags.map((t) => `<span>${t}</span>`).join('');
  mv.poster = `img/${d.id}.webp`;
  mv.src = `models/${d.id}.glb`;
  mv.alt = `${d.name} — 3D model`;
  sheet.hidden = false;
  document.body.classList.add('lock');
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  $('.sheet__close', sheet).focus({ preventScroll: true });
  updateArSupport();
  // "Masada gör" kartdan basılıbsa — AR düyməsini vurğula. (AR-ı avtomatik açmırıq: telefonlar
  // kameranı yalnız birbaşa toxunuşla açmağa icazə verir, model yüklənənə qədər o an keçir.)
  $('.ar-btn').classList.toggle('pulse', !!wantAR);
}
function close(el) {
  el.classList.remove('is-open');
  setTimeout(() => { el.hidden = true; }, 280);
  document.body.classList.remove('lock');
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}
document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(s); }));
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.sheet:not([hidden])').forEach(close); });

// AR dəstəklənmirsə (kompüter) — telefonla açmaq üçün QR kod göstər
function updateArSupport() {
  const show = () => {
    const can = mv.canActivateAR;
    $('#noAr').hidden = can;
    if (!can) {
      const url = new URL(location.href);
      url.hash = current ? current.id : '';
      const q = qrcode(0, 'M');
      q.addData(url.toString());
      q.make();
      $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    }
  };
  // canActivateAR model yükləndikdən sonra dəqiq bilinir
  if (mv.loaded) show(); else { show(); mv.addEventListener('load', show, { once: true }); }
}
mv.addEventListener('ar-status', (e) => {
  $('#arHint').hidden = e.detail.status !== 'session-started';
  if (e.detail.status === 'object-placed') $('#arHint').hidden = true;
});
mv.addEventListener('progress', (e) => {
  const bar = $('.mv-progress span');
  if (bar) bar.style.width = `${Math.round(e.detail.totalProgress * 100)}%`;
  $('.mv-progress').classList.toggle('is-done', e.detail.totalProgress >= 1);
});

// linkdə #pizza varsa — həmin yeməyi aç (QR koddan kompüterdən telefona keçəndə)
if (location.hash) {
  const d = DISHES.find((x) => x.id === location.hash.slice(1));
  if (d) setTimeout(() => open(d, false), 300);
}

/* ---------- sifariş ---------- */
const order = new Map();
$('#addBtn').addEventListener('click', () => {
  if (!current) return;
  order.set(current.id, (order.get(current.id) || 0) + 1);
  const btn = $('#addBtn');
  btn.textContent = 'Əlavə olundu ✓';
  setTimeout(() => (btn.textContent = 'Sifarişə əlavə et'), 1200);
  updateBasket();
});
function updateBasket() {
  let n = 0, sum = 0;
  for (const [id, q] of order) { const d = DISHES.find((x) => x.id === id); n += q; sum += q * d.price; }
  $('#basketBtn').hidden = n === 0;
  $('#basketCount').textContent = n;
  $('#basketSum').textContent = money(sum);
  $('#olist').innerHTML = [...order].map(([id, q]) => {
    const d = DISHES.find((x) => x.id === id);
    return `<li><img src="img/${id}.webp" alt=""><span><b>${d.name}</b><small>${money(d.price)}</small></span>
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
