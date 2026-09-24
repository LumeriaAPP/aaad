# Nova Residence — 3D tikinti saytı

Tikinti şirkəti üçün interaktiv 3D sayt (nümunə layihə: "Nova Tikinti" / "Nova Residence").

## Nə edə bilir
- **Parallax ana səhifə** — aşağı sürüşdürdükcə kamera binanın ətrafında hərəkət edir.
- **3D mənzil seçimi** — binanı fırladın, mərtəbənin üzərinə gəlin və klikləyin. Yuxarı mərtəbələr qalxır və seçilmiş mərtəbənin içi (divarlar, mebel) görünür.
- **Mənzil paneli** — status (satışda / bron / satılıb), sahə, qiymət, otaqlar və real ölçülü plan.
- **Virtual tur** — mənzilin içində gəzin: siçanla sürüşdürərək ətrafa baxın, W A S D ilə hərəkət edin, döşəməyə klikləyərək ora gedin. Otaq düymələri və mini xəritə var. Telefonda joystik işləyir.
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

## İstifadə olunan pulsuz resurslar
| Resurs | Mənbə | Lisenziya |
|---|---|---|
| 3D mühərrik | three.js r186 | MIT |
| Ağaclar | EZ-Tree (Daniel Greenheck) | MIT |
| Çəmən teksturası | EZ-Tree tətbiqi | MIT |
| Göy üzü / mühit (flower_road_2k) | Poly Haven (Google Filament vasitəsilə) | CC0 |
| İnteryer işıqlandırması (apartment) | Poly Haven (@pmndrs/assets vasitəsilə) | CC0 |
| Divan (GlamVelvetSofa), kreslo (SheenChair) | Wayfair / Khronos glTF Sample Assets | CC BY 4.0 |

Bina, mənzillər, mebel və qalan teksturalar kodla yaradılır.
