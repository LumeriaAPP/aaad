// Restoranın məlumatları və menyu. Yeni yemək: models/<ad>.glb (real ölçüdə, metr) + img/<ad>.webp əlavə edin.
export const RESTAURANT = {
  name: 'Zəfəran',
  sub: 'Bistro',
  tagline: 'Yeməyi sifarişdən əvvəl masanızda görün',
  currency: '₼',
};

export const CATEGORIES = [
  { id: 'all', name: 'Hamısı' },
  { id: 'main', name: 'Əsas yeməklər' },
  { id: 'dessert', name: 'Desertlər' },
  { id: 'drink', name: 'İçkilər' },
];

// Hamısı real 3D modellərdir (Sketchfab, CC BY / CC BY-SA) — real ölçüyə gətirilib (tools/import.html).
// Kodla qurulmuş nümunələr (plov, salat, çizkeyk, limonad) models/ qovluğunda qalır, menyudan çıxarılıb.
export const DISHES = [
  {
    id: 'pizza', cat: 'main', name: 'Prosciutto pizza', price: 18,
    desc: 'İncə xəmir, pomidor sousu, motsarella, prosciutto və təzə rukola.',
    info: '32 sm · 520 q', tags: ['Odun sobası'],
    credit: '3D model: “Pizza”, Rigsters (Sketchfab), CC BY 4.0',
  },
  {
    id: 'burger', cat: 'main', name: 'Klassik burger', price: 14,
    desc: 'Mərmərli mal əti kotleti, pendir, pomidor, kahı, yumşaq bulka.',
    info: '11 sm · 280 q', tags: [],
    credit: '3D model: “Back Yard Burgers – Classic Burger”, Ehsan Abbasi (Sketchfab), CC BY-SA 4.0',
  },
  {
    id: 'cake', cat: 'dessert', name: 'Albalılı tort', price: 7,
    desc: 'Yumşaq biskvit, qaymaqlı krem, ağ şirə və təzə albalı.',
    info: '1 dilim · 150 q', tags: ['Ev istehsalı'],
    credit: '3D model: “Cake with Cherry”, brysew (Sketchfab), CC BY 4.0',
  },
  {
    id: 'latte', cat: 'drink', name: 'Latte', price: 5,
    desc: 'Espresso, buxarda qızdırılmış süd, latte art.',
    info: '300 ml', tags: ['İsti'],
    credit: '3D model: “Coffee Cup Latte”, Yuliya (Sketchfab), CC BY 4.0',
  },
];
