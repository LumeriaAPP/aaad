// Layihənin bütün məlumatları: şirkət, bina, mənzil planları və mənzillər.
// Burada dəyişdiyiniz hər şey həm 3D səhnədə, həm də planlarda avtomatik görünür.

export const COMPANY = {
  name: 'Nova Tikinti',
  project: 'Nova Residence',
  phone: '+994 12 000 00 00',
  email: 'info@example.com',
  address: 'Bakı şəhəri, Nəsimi rayonu (nümunə ünvan)',
};

// Bina ölçüləri (metr)
export const BUILDING = {
  width: 30, // x oxu
  depth: 20, // z oxu
  groundHeight: 5.2, // 1-ci mərtəbə (lobbi, kommersiya)
  floorHeight: 3.3, // yaşayış mərtəbəsi
  slab: 0.3,
  firstFloor: 2, // ilk yaşayış mərtəbəsi
  lastFloor: 16,
  corridor: { z0: 9, z1: 11 },
  core: { x0: 12, x1: 18, z0: 11, z1: 20 },
};

export const WALL_H = 3.0; // otaqların hündürlüyü

// Plan tipləri — yerli koordinatlar: x → [0, w], z → [0, d].
// z = 0 fasad tərəfdir (pəncərələr), z = d giriş tərəfi (dəhliz).
// door.along: 'x' — qapı z = sabit divarındadır; 'z' — x = sabit divarındadır.
// door.open: true — qapısız açıq keçid (arka).
export const PLAN_TYPES = {
  A: {
    code: 'A',
    title: '2 otaqlı mənzil',
    rooms: 2,
    w: 11,
    d: 9,
    blurb: 'Mətbəxlə birləşən geniş qonaq otağı, panoramik pəncərələr və qarderob otağı.',
    rooms_: [
      { id: 'living', name: 'Qonaq otağı + mətbəx', kind: 'living', floor: 'wood', x: 0, z: 0, w: 6.5, d: 5.5 },
      { id: 'bed1', name: 'Yataq otağı', kind: 'bedroom', floor: 'wood', x: 6.5, z: 0, w: 4.5, d: 5.5 },
      { id: 'store', name: 'Qarderob', kind: 'wardrobe', floor: 'wood', x: 0, z: 5.5, w: 3.5, d: 3.5 },
      { id: 'hall', name: 'Dəhliz', kind: 'hall', floor: 'marble', x: 3.5, z: 5.5, w: 4.5, d: 3.5 },
      { id: 'bath', name: 'Hamam otağı', kind: 'bath', floor: 'tile', x: 8, z: 5.5, w: 3, d: 3.5 },
    ],
    doors: [
      { x: 5.75, z: 9, along: 'x', w: 1.0, entry: true },
      { x: 5.0, z: 5.5, along: 'x', w: 1.3, open: true },
      { x: 7.25, z: 5.5, along: 'x', w: 0.9 },
      { x: 3.5, z: 7.25, along: 'z', w: 0.85 },
      { x: 8, z: 7.25, along: 'z', w: 0.85 },
    ],
    furniture: [
      // qonaq otağı
      { k: 'kitchenRun', x: 1.75, z: 5.2, rot: 180, len: 3.3 },
      { k: 'island', x: 1.9, z: 3.6, rot: 0 },
      { k: 'dining', x: 1.6, z: 1.6, rot: 90 },
      { k: 'rug', x: 4.8, z: 2.4, w: 2.4, d: 3.0, color: '#b9ab98' },
      { k: 'sofa', x: 3.9, z: 2.4, rot: 90 },
      { k: 'coffeeTable', x: 5.0, z: 2.4, rot: 90 },
      { k: 'tv', x: 6.35, z: 2.4, rot: -90 },
      { k: 'plant', x: 6.1, z: 0.45 },
      { k: 'pendant', x: 1.6, z: 1.6 },
      { k: 'pendant', x: 4.8, z: 2.4 },
      // yataq otağı
      { k: 'bed', x: 9.9, z: 2.5, rot: -90 },
      { k: 'rug', x: 9.2, z: 2.5, w: 2.2, d: 2.8, color: '#cbbfae' },
      { k: 'wardrobe', x: 9.6, z: 5.2, rot: 180, len: 2.4 },
      { k: 'armchair', x: 7.3, z: 0.9, rot: 45 },
      { k: 'plant', x: 7.0, z: 4.6 },
      { k: 'pendant', x: 8.75, z: 2.5 },
      // qarderob
      { k: 'wardrobe', x: 0.3, z: 7.25, rot: 90, len: 3.2 },
      { k: 'wardrobe', x: 1.75, z: 8.7, rot: 180, len: 2.2 },
      // dəhliz
      { k: 'console', x: 7.15, z: 8.8, rot: 180 },
      { k: 'plant', x: 3.85, z: 8.6 },
      { k: 'pendant', x: 5.75, z: 7.25 },
      // hamam
      { k: 'bathtub', x: 9.75, z: 5.95, rot: 0 },
      { k: 'vanity', x: 10.75, z: 7.3, rot: -90 },
      { k: 'toilet', x: 9.6, z: 8.65, rot: 180 },
    ],
  },

  B: {
    code: 'B',
    title: '3 otaqlı mənzil',
    rooms: 3,
    w: 12,
    d: 9,
    blurb: 'Künc mənzil: iki yataq otağı, ayrıca mətbəx və iki tərəfə açılan mənzərə.',
    rooms_: [
      { id: 'living', name: 'Qonaq otağı', kind: 'living', floor: 'wood', x: 0, z: 0, w: 5.5, d: 5 },
      { id: 'bed1', name: 'Yataq otağı', kind: 'bedroom', floor: 'wood', x: 5.5, z: 0, w: 3.3, d: 5 },
      { id: 'bed2', name: 'Uşaq otağı', kind: 'kids', floor: 'wood', x: 8.8, z: 0, w: 3.2, d: 5 },
      { id: 'kitchen', name: 'Mətbəx', kind: 'kitchen', floor: 'tile', x: 0, z: 5, w: 3.5, d: 4 },
      { id: 'hall', name: 'Dəhliz', kind: 'hall', floor: 'marble', x: 3.5, z: 5, w: 6.7, d: 4 },
      { id: 'bath', name: 'Hamam otağı', kind: 'bath', floor: 'tile', x: 10.2, z: 5, w: 1.8, d: 4 },
    ],
    doors: [
      { x: 6.8, z: 9, along: 'x', w: 1.0, entry: true },
      { x: 4.5, z: 5, along: 'x', w: 1.4, open: true },
      { x: 1.75, z: 5, along: 'x', w: 1.2, open: true },
      { x: 7.2, z: 5, along: 'x', w: 0.9 },
      { x: 9.5, z: 5, along: 'x', w: 0.85 },
      { x: 3.5, z: 7.3, along: 'z', w: 0.9 },
      { x: 10.2, z: 7.5, along: 'z', w: 0.8 },
    ],
    furniture: [
      // qonaq otağı
      { k: 'rug', x: 2.9, z: 2.3, w: 2.6, d: 3.0, color: '#a99c8b' },
      { k: 'sofa', x: 1.9, z: 2.3, rot: 90 },
      { k: 'coffeeTable', x: 3.1, z: 2.3, rot: 90 },
      { k: 'tv', x: 5.35, z: 2.3, rot: -90 },
      { k: 'armchair', x: 0.8, z: 0.8, rot: 135 },
      { k: 'plant', x: 5.0, z: 0.45 },
      { k: 'pendant', x: 2.9, z: 2.3 },
      // mətbəx
      { k: 'kitchenRun', x: 0.3, z: 7.0, rot: 90, len: 3.8 },
      { k: 'fridge', x: 3.1, z: 8.6, rot: 180 },
      { k: 'dining', x: 2.1, z: 7.0, rot: 0, small: true },
      { k: 'pendant', x: 2.1, z: 7.0 },
      // yataq otağı
      { k: 'bed', x: 6.55, z: 2.2, rot: 90 },
      { k: 'wardrobe', x: 8.5, z: 3.7, rot: -90, len: 2.2 },
      { k: 'pendant', x: 7.1, z: 2.2 },
      // uşaq otağı
      { k: 'singleBed', x: 11.5, z: 3.9, rot: 180 },
      { k: 'desk', x: 10.3, z: 0.4, rot: 0 },
      { k: 'wardrobe', x: 9.1, z: 3.9, rot: 90, len: 1.6 },
      { k: 'rug', x: 10.4, z: 2.6, w: 1.6, d: 2.0, color: '#9fb6c9' },
      { k: 'pendant', x: 10.4, z: 2.5 },
      // dəhliz
      { k: 'console', x: 5.2, z: 8.8, rot: 180 },
      { k: 'plant', x: 9.8, z: 8.6 },
      { k: 'pendant', x: 6.8, z: 7.0 },
      // hamam
      { k: 'vanity', x: 11.1, z: 5.3, rot: 0, small: true },
      { k: 'toilet', x: 11.65, z: 6.9, rot: -90 },
      { k: 'shower', x: 11.1, z: 8.5, w: 1.8, d: 1.0 },
    ],
  },

  C: {
    code: 'C',
    title: '1 otaqlı loft',
    rooms: 1,
    w: 8,
    d: 9,
    blurb: 'Açıq planlı loft: yataq və qonaq zonası bir məkanda, ayrıca mətbəx.',
    rooms_: [
      { id: 'studio', name: 'Loft (qonaq + yataq)', kind: 'living', floor: 'wood', x: 0, z: 0, w: 8, d: 5.5 },
      { id: 'kitchen', name: 'Mətbəx', kind: 'kitchen', floor: 'tile', x: 0, z: 5.5, w: 3.5, d: 3.5 },
      { id: 'hall', name: 'Dəhliz', kind: 'hall', floor: 'marble', x: 3.5, z: 5.5, w: 2.3, d: 3.5 },
      { id: 'bath', name: 'Hamam otağı', kind: 'bath', floor: 'tile', x: 5.8, z: 5.5, w: 2.2, d: 3.5 },
    ],
    doors: [
      { x: 4.65, z: 9, along: 'x', w: 1.0, entry: true },
      { x: 1.75, z: 5.5, along: 'x', w: 1.8, open: true },
      { x: 4.65, z: 5.5, along: 'x', w: 1.1, open: true },
      { x: 5.8, z: 7.25, along: 'z', w: 0.8 },
    ],
    furniture: [
      { k: 'bed', x: 6.95, z: 2.9, rot: -90 },
      { k: 'shelf', x: 5.0, z: 2.6, rot: 90, len: 2.2 },
      { k: 'rug', x: 2.4, z: 2.6, w: 2.8, d: 2.2, color: '#b4a592' },
      { k: 'sofa', x: 2.4, z: 3.6, rot: 180 },
      { k: 'coffeeTable', x: 2.4, z: 2.5, rot: 0 },
      { k: 'armchair', x: 0.9, z: 1.2, rot: 120 },
      { k: 'plant', x: 0.45, z: 4.9 },
      { k: 'pendant', x: 2.4, z: 2.5 },
      { k: 'pendant', x: 6.6, z: 2.7 },
      { k: 'kitchenRun', x: 1.75, z: 8.7, rot: 180, len: 3.2 },
      { k: 'fridge', x: 0.35, z: 6.3, rot: 90 },
      { k: 'dining', x: 2.0, z: 6.9, rot: 0, small: true },
      { k: 'plant', x: 5.45, z: 8.65 },
      { k: 'vanity', x: 6.9, z: 5.8, rot: 0, small: true },
      { k: 'toilet', x: 7.6, z: 7.3, rot: -90 },
      { k: 'shower', x: 6.9, z: 8.5, w: 2.2, d: 1.0 },
    ],
  },
};

// Hər planın sahəsini otaqlardan hesabla
for (const t of Object.values(PLAN_TYPES)) {
  t.area = Math.round(t.rooms_.reduce((s, r) => s + r.w * r.d, 0));
}

// Mərtəbədə mənzillərin yerləşməsi (mərtəbə koordinatları: x 0..30, z 0..20)
// mx / mz — plan x və ya z oxu boyunca güzgü kimi çevrilir.
export const SLOTS = [
  { slot: 1, type: 'A', ox: 0, oz: 0, mx: false, mz: false, side: 'Şimal-qərb' },
  { slot: 2, type: 'C', ox: 11, oz: 0, mx: false, mz: false, side: 'Şimal' },
  { slot: 3, type: 'A', ox: 19, oz: 0, mx: true, mz: false, side: 'Şimal-şərq' },
  { slot: 4, type: 'B', ox: 0, oz: 11, mx: false, mz: true, side: 'Cənub-qərb' },
  { slot: 5, type: 'B', ox: 18, oz: 11, mx: true, mz: true, side: 'Cənub-şərq' },
];

export const STATUS = {
  available: { label: 'Satışda', color: '#3ecf8e' },
  reserved: { label: 'Bron edilib', color: '#f5b544' },
  sold: { label: 'Satılıb', color: '#ef5b5b' },
};

// Sabit (təkrarlanan) təsadüfi ədədlər — hər dəfə eyni status paylanması
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function ordinal(n) {
  const last = n % 10;
  const tens = Math.floor(n / 10) % 10;
  let suffix;
  if (last === 0) {
    suffix = ['', 'cu', 'ci', 'cu', 'cı', 'ci', 'cı', 'ci', 'ci', 'cı'][tens] || 'cu';
  } else {
    suffix = ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu'][last];
  }
  return `${n}-${suffix}`;
}

export const PRICE_BASE = 2100; // ₼ / m², 2-ci mərtəbə
export const PRICE_STEP = 45; // hər mərtəbə üçün artım

export const APARTMENTS = [];
{
  const rand = rng(20260924);
  for (let f = BUILDING.firstFloor; f <= BUILDING.lastFloor; f++) {
    for (const s of SLOTS) {
      const t = PLAN_TYPES[s.type];
      const r = rand();
      const status = r < 0.58 ? 'available' : r < 0.75 ? 'reserved' : 'sold';
      const pricePerM2 = PRICE_BASE + PRICE_STEP * (f - BUILDING.firstFloor);
      APARTMENTS.push({
        id: `${f}-${s.slot}`,
        number: (f - BUILDING.firstFloor) * SLOTS.length + s.slot,
        floor: f,
        slot: s,
        type: t,
        status,
        price: Math.round((t.area * pricePerM2) / 1000) * 1000,
      });
    }
  }
}

export const fmtPrice = (p) => p.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₼';

export function floorBaseY(f) {
  // f mərtəbəsinin döşəməsinin (slab üstü) hündürlüyü
  return BUILDING.groundHeight + (f - BUILDING.firstFloor) * BUILDING.floorHeight;
}
