// Ana səhifənin girişi: "Nova Residence" hərf-hərf yazılır (yazı makinası kimi, amma hər hərf
// yumşaq bulanıqlıqdan aydınlaşaraq), firuzəyi kursor yazının ardınca gedir və sonda sönür.
// Ardınca kiçik başlıq, mətn söz-söz, düymələr və rəqəmlər açılır.
const root = document.documentElement;
root.classList.add('js-intro');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.querySelector('.hero');
const title = hero && hero.querySelector('.hero__title');
const lead = hero && hero.querySelector('.hero__lead');
let letters = [];
let words = [];
let caret = null;
let played = false;

function prepare() {
  if (!title) return;
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  for (const w of title.querySelectorAll('.hero__word')) {
    const text = w.textContent.trim();
    w.textContent = '';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      w.appendChild(s);
      letters.push(s);
    }
  }
  caret = document.createElement('span');
  caret.className = 'caret';
  caret.setAttribute('aria-hidden', 'true');
  letters[0]?.before(caret);
  if (lead) {
    const text = lead.textContent.trim().split(/\s+/);
    lead.textContent = '';
    text.forEach((t, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = t;
      lead.appendChild(s);
      if (i < text.length - 1) lead.appendChild(document.createTextNode(' '));
      words.push(s);
    });
  }
}
prepare();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Yükləmə ekranı çəkiləndə çağırılır */
export async function playIntro() {
  if (played || !hero) return;
  played = true;
  if (reduce) {
    letters.forEach((l) => l.classList.add('on'));
    words.forEach((w) => w.classList.add('on'));
    caret?.remove();
    hero.classList.add('show-kicker', 'show-cta', 'show-stats');
    return;
  }
  hero.classList.add('show-kicker', 'typing');
  await wait(420);
  let prevWord = null;
  for (const l of letters) {
    const word = l.parentElement;
    if (prevWord && word !== prevWord) await wait(340); // sözlər arasında fasilə
    prevWord = word;
    l.after(caret);
    l.classList.add('on');
    // insan yazısı kimi — hər hərf bir az fərqli sürətlə
    await wait(word.classList.contains('hero__word--italic') ? 70 + Math.random() * 45 : 95 + Math.random() * 60);
  }
  hero.classList.remove('typing');
  hero.classList.add('typed');
  await wait(200);
  words.forEach((w, i) => setTimeout(() => w.classList.add('on'), i * 32));
  await wait(Math.min(700, words.length * 32));
  hero.classList.add('show-cta');
  await wait(260);
  hero.classList.add('show-stats');
  await wait(1400);
  caret?.classList.add('gone'); // kursor bir neçə dəfə yanıb-sönür, sonra yox olur
}

// ehtiyat: yükləmə nədənsə gecikərsə, başlıq yenə də görünsün
setTimeout(playIntro, 15000);
