# Zəfəran Bistro — 3D / AR menyu

Sayt açılır → **“Kameranı aç”** → telefonu masaya tutun → yemək masada, yanında havada **3D menyu** (karta toxunub və ya **barmaqla göstərib** seçmək olur: 1 san. saxlayın və ya çimdikləyin; Android Chrome, kamera görüntüsünə giriş — WebXR camera-access), aşağıda da sürüşən siyahı.

Restoran üçün veb menyu: müştəri masadakı QR kodu skan edir, yeməyə toxunur və **“Masada gör”** ilə
telefonun kamerasında yeməyi **real ölçüdə masanın üstündə** görür (artırılmış reallıq). Tətbiq yükləmək lazım deyil.

- **Android (Chrome, ARCore):** öz kamera rejimimiz (WebXR) — yemək **yalnız masanın üstünə** qoyulur
  (döşəmədən 40–125 sm hündürlükdəki səthlər), aşağıdakı menyunu sağa-sola sürüşdürdükcə masadakı yemək dəyişir,
  barmaqla fırlanır, real işıq (light estimation) və kölgə.
- **iPhone:** Apple Quick Look (`models/*.usdz`), banner düyməsi ilə növbəti yeməyə keçid.
- **Kompüter:** 3D model fırladılır, telefonla açmaq üçün QR kod göstərilir.

## Fayllar
- `index.html`, `css/menu.css`, `js/app.js` — menyu
- `js/menu.js` — **restoranın adı, kateqoriyalar, yeməklər, qiymətlər** (buranı dəyişin)
- `models/<id>.glb` — yeməyin 3D modeli (metr ilə real ölçüdə), `img/<id>.webp` — menyu şəkli
- `qr.html` — masalar üçün çap olunan QR kartları (`?masa=N`)
- `js/ar.js` — kamera rejimi (WebXR, masa aşkarlanması)
- `tools/` — nümunə yeməklərin generatoru (`tools/build.html` → GLB + USDZ + şəkil), yalnız inkişaf üçün

## Hazır modeli əlavə etmək
`tools/src/`-ə GLB qoyun → `tools/import.html?src=src/<fayl>.glb&size=0.115` (size — real ölçü, metr) → GLB, USDZ və menyu şəkli yaranır.

## Real yeməklər
Nümunə modellər kodla qurulub. Real restoran üçün hər yeməyin 3D skanı lazımdır:
telefonla fotoqrammetriya (Polycam, RealityScan, Luma), sonra GLB kimi ixrac → `models/`-ə qoyun, `js/menu.js`-ə əlavə edin.
Ölçü: model **metr** ilə olmalıdır (pizza ≈ 0.30), fayl ölçüsü ideal halda < 5 MB.

## Yayımlamaq (Vercel)
Add New → Project → `LumeriaAPP/aaad` → **Root Directory: `ar-menu`** → Framework: Other → Deploy.
AR yalnız **https** ünvanında işləyir (Vercel avtomatik verir).

## Lisenziyalar
- MediaPipe Tasks Vision 1.0.1 + hand_landmarker modeli (barmaqla seçim) — Apache-2.0
- Pizza: “Pizza”, Rigsters (Sketchfab) — CC BY 4.0
- Tort: “Cake with Cherry”, brysew (Sketchfab) — CC BY 4.0
- Latte: “Coffee Cup Latte”, Yuliya (Sketchfab) — CC BY 4.0
- Burger 3D modeli: “Back Yard Burgers – Classic Burger”, Ehsan Abbasi (Sketchfab) — CC BY-SA 4.0; ölçü və mövqe dəyişdirilib (`tools/import.html`). Dəyişdirilmiş model də CC BY-SA 4.0-dır.
- [@google/model-viewer](https://modelviewer.dev) 4.3.1 — Apache-2.0
- qrcode-generator 2.0.4 — MIT
- three.js r186 (yalnız `tools/`) — MIT
- Şriftlər: Cormorant Garamond, Plus Jakarta Sans — SIL OFL 1.1
