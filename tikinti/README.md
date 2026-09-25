# Nova Residence — 3D tikinti saytı

Tikinti şirkəti üçün interaktiv 3D sayt (nümunə layihə: "Nova Tikinti" / "Nova Residence").

## Nə edə bilir
- **Parallax ana səhifə** — aşağı sürüşdürdükcə kamera binanın ətrafında hərəkət edir.
- **3D mənzil seçimi** — binanı fırladın, mərtəbənin üzərinə gəlin və klikləyin. Yuxarı mərtəbələr qalxır və seçilmiş mərtəbənin içi (divarlar, mebel) görünür.
- **Mənzil paneli** — status (satışda / bron / satılıb), sahə, qiymət, otaqlar və real ölçülü plan.
- **Dizayn studiyası** — mənzil panelində "Dizayn studiyası": mənzilə yuxarıdan baxılır, hər otağın təyinatı seçilir (qonaq, yataq, uşaq, iş otağı, mətbəx, yemək otağı, qarderob, loft...) və mebel qapı/pəncərələrə dəymədən avtomatik düzülür. Mebeli siçanla (telefonda barmaqla) sürüşdürmək, R ilə fırlatmaq, Delete ilə silmək, kataloqdan əlavə etmək olur. Divar rəngi (palitra + istənilən rəng), döşəmə (palıd, qoz, mərmər, keramika, mikrosement), parça rəngi və hazır stillər (Skandinav, Müasir klassik, Japandi, Loft, Tünd lüks). Dizayn brauzerdə yadda qalır və virtual turda görünür.
- **Virtual tur** — mənzilin içində gəzin: siçanla sürüşdürərək ətrafa baxın, W A S D ilə hərəkət edin, döşəməyə klikləyərək ora gedin. Otaq düymələri və mini xəritə var. Telefonda joystik işləyir.
- **Foto-render** — işıq izləmə (path tracing) ilə real render: baş planda, 3D seçimdə ("Render") və virtual turda. Şəkli yadda saxlamaq olar.
- **Kamera qoruyucusu** — kamera heç vaxt binaların içinə girmir; 3D seçimdə önü kəsən qonşu bina müvəqqəti yerə enir (yerində kontur və kölgəsi qalır).
- **Günəş simulyasiyası** — Bakı üçün astronomik hesablama, tarix/saat, gündüz/axşam/gecə, mənzillər üçün günəş saatları.
- **Planlar bölməsi**, plan modalı, müraciət forması, mobil uyğunluq.

## Məlumatları dəyişmək
Hər şey `js/data.js` faylındadır:
- `COMPANY` — şirkət adı, telefon, e-poçt, ünvan
- `BUILDING` — mərtəbə sayı, ölçülər
- `PLAN_TYPES` — mənzil planları (otaqlar, qapılar, mebel)
- `PRICE_BASE`, `PRICE_STEP` — m² qiyməti
- Mənzil statusları hazırda təsadüfi (sabit) paylanıb. Real statuslar üçün `APARTMENTS` siyahısını dəyişin.

Müraciət forması hələ heç yerə göndərmir, sadəcə təşəkkür mesajı göstərir. Real istifadə üçün Formspree və ya öz backend-inizə qoşmaq lazımdır.

## Lokal işə salmaq
Brauzer ES modullarını fayldan (`file://`) açmır, ona görə kiçik server lazımdır:
```
npx http-server -p 8080
```
Sonra `http://localhost:8080` ünvanını açın.

Zəif cihazlar üçün: `?noao` (ambient occlusion-u söndürür), `?nopp` (bütün sonrakı emal effektlərini söndürür).

## Vercel-də yayımlamaq
1. [vercel.com](https://vercel.com) → **Continue with GitHub** ilə daxil olun.
2. **Add New… → Project** → `LumeriaAPP/aaad` reposunu seçin (**Import**).
   Görünmürsə: **Adjust GitHub App Permissions** → bu repoya icazə verin.
3. Ayarlar: **Framework Preset: Other**, **Root Directory: `tikinti`** (Edit düyməsi ilə seçin), Build Command boş qalsın.
4. **Deploy** — təxminən 1 dəqiqəyə `https://<layihə-adı>.vercel.app` linki hazır olur.
   Bundan sonra `main` budağına hər `git push` saytı avtomatik yeniləyir.

## İstifadə olunan pulsuz resurslar
| Resurs | Mənbə | Lisenziya |
|---|---|---|
| 3D mühərrik | three.js r186 | MIT |
| Ağaclar | EZ-Tree (Daniel Greenheck) | MIT |
| Çəmən teksturası | EZ-Tree tətbiqi | MIT |
| Göy üzü / mühit (aristea_wreck_puresky_2k) | Poly Haven (gkjohnson/3d-demo-data vasitəsilə) | CC0 |
| İnteryer işıqlandırması (apartment) | Poly Haven (@pmndrs/assets vasitəsilə) | CC0 |
| Divan (GlamVelvetSofa), kreslo (SheenChair) | Wayfair / Khronos glTF Sample Assets | CC BY 4.0 |
| Foto-render (işıq izləmə) | three-gpu-pathtracer, three-mesh-bvh (Garrett Johnson) | MIT |
| Yumşaq scroll | Lenis | MIT |
| Su normal xəritəsi | three.js nümunələri | MIT |

Bina, mənzillər, mebel və qalan teksturalar kodla yaradılır.
