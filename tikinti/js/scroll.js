// Scroll sistemi: yumşaq scroll (Lenis), mətnlərin söz-söz açılması,
// açar kadrlı parallax, yapışan (pinned) bölmələr, üfüqi scroll və
// bölməyə görə rəngini dəyişən menyu.
import Lenis from '../vendor/lenis/lenis.mjs';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const lenis = reduced
  ? null
  : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4, smoothWheel: true, autoRaf: false });

/* ---------------- Mətnin sözlərə bölünməsi ---------------- */
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'wi';
          inner.style.setProperty('--i', i++);
          inner.textContent = part;
          w.appendChild(inner);
          frag.appendChild(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
  el.style.setProperty('--words', i);
}

/* ---------------- Parallax açar kadrları ----------------
   data-p='{"y":[0,-120],"scale":[1,1.2],"opacity":[1,0],"blur":[0,6]}'
   data-p-range="enter" — element ekrana girəndən çıxana qədər (standart)
   data-p-range="exit"  — yalnız bölmə ekrandan çıxarkən (hero üçün)
   data-p-range="pin"   — ən yaxın .pin bölməsinin daxili irəliləyişi */
const P_UNITS = { y: 'px', x: 'px', blur: 'px', rotate: 'deg' };
function readP(el) {
  try { return JSON.parse(el.dataset.p); } catch { return {}; }
}

function applyKeys(el, keys, t) {
  let tr = '';
  let filter = '';
  for (const [k, v] of Object.entries(keys)) {
    // [başlanğıc, son] və ya [[t0, v0], [t1, v1], ...]
    let val;
    if (Array.isArray(v[0])) {
      let a = v[0], b = v[v.length - 1];
      for (let i = 0; i < v.length - 1; i++) if (t >= v[i][0] && t <= v[i + 1][0]) { a = v[i]; b = v[i + 1]; break; }
      const lt = b[0] === a[0] ? 1 : clamp((t - a[0]) / (b[0] - a[0]));
      val = lerp(a[1], b[1], lt);
    } else {
      val = lerp(v[0], v[1], t);
    }
    if (k === 'opacity') el.style.opacity = val.toFixed(3);
    else if (k === 'blur') filter = `blur(${val.toFixed(2)}px)`;
    else if (k === 'y') tr += ` translate3d(0, ${val.toFixed(1)}${v.unit || (el.dataset.pUnit || 'px')}, 0)`;
    else if (k === 'x') tr += ` translate3d(${val.toFixed(1)}px, 0, 0)`;
    else if (k === 'scale') tr += ` scale(${val.toFixed(4)})`;
    else if (k === 'rotate') tr += ` rotate(${val.toFixed(2)}deg)`;
    else if (k === 'inset') el.style.setProperty('--inset', val.toFixed(2));
    else if (k === 'radius') el.style.setProperty('--radius', `${val.toFixed(1)}px`);
    else el.style.setProperty('--' + k, val.toFixed(4));
  }
  if (tr) el.style.transform = tr.trim();
  if (filter !== undefined && 'blur' in keys) el.style.filter = filter;
}
void P_UNITS;

/* ---------------- Əsas ---------------- */
export function initScroll({ onFrame } = {}) {
  const html = document.documentElement;
  html.classList.add('js-scroll');
  if (lenis) html.classList.add('lenis', 'lenis-smooth');

  // mətnlər
  const splitEls = $$('[data-split]');
  splitEls.forEach(splitWords);

  // görünmə (reveal) — söz-söz, sətir-sətir, bloklar
  const revealEls = $$('[data-split], [data-reveal]');
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach((el) => io.observe(el));

  // sayğaclar
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      cio.unobserve(e.target);
      const el = e.target;
      const to = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const t0 = performance.now();
      const dur = 1800;
      const tick = (now) => {
        const k = easeOut(clamp((now - t0) / dur));
        el.textContent = (to * k).toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/,/g, dec ? ',' : ' ');
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.5 });
  counters.forEach((el) => cio.observe(el));

  const pEls = $$('[data-p]').map((el) => ({ el, keys: readP(el), range: el.dataset.pRange || 'enter', pin: el.closest('.pin') }));
  const pins = $$('.pin').map((el) => ({ el, inner: el.querySelector('.pin__sticky') }));
  const hTracks = $$('[data-htrack]').map((el) => ({ el, pin: el.closest('.pin'), track: el }));
  const themed = $$('[data-ui]');
  const nav = document.getElementById('nav');
  const progressBar = document.getElementById('scrollProgress');
  const marquees = $$('[data-marquee]').map((el) => ({ el, x: 0 }));

  // üfüqi bölmənin hündürlüyünü trekin enindən hesabla
  function sizeHorizontal() {
    for (const h of hTracks) {
      const extra = Math.max(0, h.track.scrollWidth - innerWidth + 32);
      h.pin.style.height = `${innerHeight + extra}px`;
      h.extra = extra;
    }
  }
  sizeHorizontal();
  addEventListener('resize', sizeHorizontal);
  addEventListener('load', sizeHorizontal);

  let lastY = scrollY;
  let velocity = 0;

  function update() {
    const y = lenis ? lenis.scroll : scrollY;
    const vh = innerHeight;
    velocity = lerp(velocity, y - lastY, 0.2);
    lastY = y;

    // pin irəliləyişi
    for (const p of pins) {
      const r = p.el.getBoundingClientRect();
      const len = r.height - vh;
      p.t = len > 0 ? clamp(-r.top / len) : 0;
      p.el.style.setProperty('--pin', p.t.toFixed(4));
    }

    for (const it of pEls) {
      let t;
      if (it.range === 'pin' && it.pin) {
        t = pins.find((p) => p.el === it.pin)?.t ?? 0;
      } else {
        const r = (it.pin || it.el).getBoundingClientRect();
        if (it.range === 'exit') t = clamp(-r.top / Math.max(1, r.height));
        else {
          if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
          t = clamp((vh - r.top) / (vh + r.height));
        }
      }
      applyKeys(it.el, it.keys, t);
    }

    for (const h of hTracks) {
      const t = pins.find((p) => p.el === h.pin)?.t ?? 0;
      h.track.style.transform = `translate3d(${(-h.extra * t).toFixed(1)}px, 0, 0)`;
    }

    // menyunun rəngi: menyunun altındakı bölmənin mövzusu
    let ui = 'dark';
    for (const s of themed) {
      const r = s.getBoundingClientRect();
      if (r.top <= 40 && r.bottom > 40) ui = s.dataset.ui;
    }
    if (nav) {
      nav.dataset.ui = ui;
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', velocity > 2 && y > vh);
      if (velocity < -1) nav.classList.remove('is-hidden');
    }
    if (progressBar) {
      const max = document.documentElement.scrollHeight - vh;
      progressBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    }
    // qaçan sətir — scroll sürətinə reaksiya verir
    for (const m of marquees) {
      m.x -= 0.6 + Math.min(12, Math.abs(velocity) * 0.6);
      const w = m.el.scrollWidth / 2;
      if (-m.x > w) m.x += w;
      m.el.style.transform = `translate3d(${m.x.toFixed(1)}px, 0, 0)`;
    }
    onFrame && onFrame(y);
  }

  function raf(time) {
    if (lenis) lenis.raf(time);
    update();
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // lövbər linkləri Lenis ilə
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });

  return {
    stop() { lenis && lenis.stop(); },
    start() { lenis && lenis.start(); },
    to(y, immediate = true) { lenis ? lenis.scrollTo(y, { immediate }) : scrollTo(0, y); },
    toEl(el) { lenis ? lenis.scrollTo(el, { duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' }); },
    resize: sizeHorizontal,
    observe(el) { io.observe(el); },
  };
}
