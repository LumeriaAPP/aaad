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
  { id: 'salad', name: 'Salatlar' },
  { id: 'dessert', name: 'Desertlər' },
  { id: 'drink', name: 'İçkilər' },
];

export const DISHES = [
  {
    id: 'plov', cat: 'main', name: 'Şah plov', price: 24,
    desc: 'Lavaş qabığında zəfəranlı düyü, quzu əti, şabalıd, qaysı və kişmiş.',
    info: '2 nəfərlik · 650 q', tags: ['Milli mətbəx', 'Aşpazın seçimi'],
  },
  {
    id: 'pizza', cat: 'main', name: 'Marqarita pizza', price: 16,
    desc: 'Odun sobasında, San Marzano pomidor sousu, təzə motsarella və reyhan.',
    info: '30 sm · 480 q', tags: ['Vegetarian'],
  },
  {
    id: 'burger', cat: 'main', name: 'Klassik burger', price: 14,
    desc: 'Mərmərli mal əti kotleti, pendir, pomidor, kahı, yumşaq bulka.',
    info: '11 sm · 280 q', tags: ['Real 3D model'],
    credit: '3D model: “Back Yard Burgers – Classic Burger”, Ehsan Abbasi (Sketchfab), CC BY-SA 4.0',
  },
  {
    id: 'salad', cat: 'salad', name: 'Sezar salatı', price: 11,
    desc: 'Romen kahısı, qrildə toyuq, parmezan, kruton, çeri pomidor və Sezar sousu.',
    info: '320 q', tags: [],
  },
  {
    id: 'cheesecake', cat: 'dessert', name: 'Çizkeyk', price: 8,
    desc: 'Nyu-York çizkeyki, giləmeyvə sousu, təzə çiyələk və nanə.',
    info: '160 q', tags: ['Ev istehsalı'],
  },
  {
    id: 'lemonade', cat: 'drink', name: 'Ev limonadı', price: 5,
    desc: 'Təzə limon, nanə, buz — şəkərsiz də hazırlanır.',
    info: '400 ml', tags: ['Soyuq'],
  },
];
