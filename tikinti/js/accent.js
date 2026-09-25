// Saytın vurğu rəngi CSS dəyişənlərindən oxunur (css/style.css → --gold, --gold-hi),
// beləcə 3D işarələr də düymələrlə eyni rəngdə olur.
// Sınaq üçün: ?accent=copper | sage | gold
const q = new URLSearchParams(location.search).get('accent');
if (q) document.documentElement.dataset.accent = q;

export function accent(name = '--gold', fallback = '#7cc3b6') {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}
