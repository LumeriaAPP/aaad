// Günəşin mövqeyi (astronomik düsturlar, NOAA / SunCalc metodu) və
// mənzillər üçün günəş saatlarının hesablanması (qonşu binaların kölgəsi ilə).
import * as THREE from 'three';
import { BUILDING, floorBaseY } from './data.js';
import { exteriorSides } from './layout.js';
import { NEIGHBORS } from './complex.js';

export const SITE = { name: 'Bakı', lat: 40.4093, lng: 49.8671, utcOffset: 4 };

const rad = Math.PI / 180;
const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545;
const obliquity = rad * 23.4397;

function toDays(date) { return date.valueOf() / dayMs - 0.5 + J1970 - J2000; }

/** Günəşin hündürlüyü və azimutu (radian). Azimut şimaldan saat əqrəbi istiqamətində. */
export function sunPosition(date, lat = SITE.lat, lng = SITE.lng) {
  const d = toDays(date);
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(obliquity), Math.cos(L));
  const lw = rad * -lng, phi = rad * lat;
  const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  let azimuth = azSouth + Math.PI;
  if (azimuth >= 2 * Math.PI) azimuth -= 2 * Math.PI;
  // atmosfer refraksiyası (üfüqə yaxın hündürlük üçün düzəliş)
  const altDeg = altitude / rad;
  const refr = altDeg > -1 ? (1.02 / Math.tan(rad * (altDeg + 10.3 / (altDeg + 5.11)))) / 60 : 0;
  return { altitude: altitude + refr * rad, azimuth };
}

/** Yerli vaxt (UTC+4) → Date */
export function localDate(y, m, d, minutes) {
  return new Date(Date.UTC(y, m - 1, d, 0, minutes - SITE.utcOffset * 60));
}

/** Səhnə istiqaməti: şimal = -z, şərq = +x */
export function sunDirection(alt, az, out = new THREE.Vector3()) {
  return out.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));
}

/** Gün çıxma / batma (dəqiqə, yerli vaxt) */
export function sunTimes(y, m, d) {
  const h0 = -0.833 * rad;
  let rise = null, set = null, prev = null, noon = 0, best = -9;
  for (let t = 0; t <= 1440; t += 2) {
    const a = sunPosition(localDate(y, m, d, t)).altitude;
    if (a > best) { best = a; noon = t; }
    if (prev !== null) {
      if (prev < h0 && a >= h0) rise = t;
      if (prev >= h0 && a < h0) set = t;
    }
    prev = a;
  }
  return { rise, set, noon, maxAlt: best };
}

export const fmtTime = (min) => {
  if (min == null) return '—';
  const h = Math.floor(min / 60), mm = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/* ---------------- Kölgə hesablaması ----------------
   Binalar fırlanmış qutular (OBB) kimi təsvir olunur. */
const OCCLUDERS = (() => {
  const list = [];
  const top = floorBaseY(BUILDING.lastFloor + 1) + 7;
  list.push({ x: 0, z: 0, rot: 0, hw: BUILDING.width / 2 + 0.9, hd: BUILDING.depth / 2 + 0.9, h: top });
  for (const n of NEIGHBORS) list.push({ x: n.x, z: n.z, rot: n.rot, hw: n.w / 2 + 0.5, hd: n.d / 2 + 0.9, h: 5.2 + n.floors * 3.3 + 1 });
  return list;
})();

function rayHitsBox(o, dir, b) {
  // şüanı qutunun yerli fəzasına keçir
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const ox = o.x - b.x, oz = o.z - b.z;
  const lx = ox * c - oz * s, lz = ox * s + oz * c;
  const dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
  let tmin = 0, tmax = 5000;
  const slab = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let t1 = (lo - p) / d, t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    return tmin <= tmax;
  };
  return slab(lx, dx, -b.hw, b.hw) && slab(o.y, dir.y, -1, b.h) && slab(lz, dz, -b.hd, b.hd) && tmax > 0.01;
}

/** Mənzilin pəncərələri qarşısında nümunə nöqtələr və fasad normalları */
function windowSamples(apt) {
  const plan = apt.type, slot = apt.slot;
  const ext = exteriorSides(slot, plan);
  const W = BUILDING.width, D = BUILDING.depth;
  const fx = (x) => (slot.mx ? slot.ox + plan.w - x : slot.ox + x);
  const fz = (z) => (slot.mz ? slot.oz + plan.d - z : slot.oz + z);
  const y = floorBaseY(apt.floor) + 1.5;
  const out = [];
  const addEdge = (ax, az, bx, bz) => {
    // mərtəbə koordinatlarında kənar → dünya; normalı binadan kənara
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const n = new THREE.Vector3();
    if (Math.abs(mz) < 1e-3) n.set(0, 0, -1);
    else if (Math.abs(mz - D) < 1e-3) n.set(0, 0, 1);
    else if (Math.abs(mx) < 1e-3) n.set(-1, 0, 0);
    else n.set(1, 0, 0);
    for (const k of [0.2, 0.5, 0.8]) {
      const px = ax + (bx - ax) * k - W / 2, pz = az + (bz - az) * k - D / 2;
      out.push({ p: new THREE.Vector3(px + n.x * 1.2, y, pz + n.z * 1.2), n });
    }
  };
  if (ext.front) addEdge(fx(0), fz(0), fx(plan.w), fz(0));
  if (ext.back) addEdge(fx(0), fz(plan.d), fx(plan.w), fz(plan.d));
  if (ext.left) addEdge(fx(0), fz(0), fx(0), fz(plan.d));
  if (ext.right) addEdge(fx(plan.w), fz(0), fx(plan.w), fz(plan.d));
  return out;
}

const _dir = new THREE.Vector3();
/** Verilmiş gün üçün mənzilə birbaşa günəş düşən saatlar (0.1 dəqiqliklə) */
export function sunHours(apt, y, m, d, stepMin = 10) {
  const samples = windowSamples(apt);
  if (!samples.length) return 0;
  let total = 0;
  for (let t = 0; t < 1440; t += stepMin) {
    const { altitude, azimuth } = sunPosition(localDate(y, m, d, t + stepMin / 2));
    if (altitude <= 0.02) continue;
    sunDirection(altitude, azimuth, _dir);
    let lit = 0;
    for (const s of samples) {
      if (s.n.dot(_dir) < 0.06) continue;
      if (!OCCLUDERS.some((b) => rayHitsBox(s.p, _dir, b))) lit++;
    }
    total += (lit / samples.length) * stepMin;
  }
  return Math.round((total / 60) * 10) / 10;
}

export const SEASONS = [
  { key: 'mar', label: '21 Mart', m: 3, d: 21 },
  { key: 'jun', label: '21 İyun', m: 6, d: 21 },
  { key: 'sep', label: '23 Sentyabr', m: 9, d: 23 },
  { key: 'dec', label: '21 Dekabr', m: 12, d: 21 },
];

const cache = new Map();
export function seasonalSunHours(apt) {
  if (cache.has(apt.id)) return cache.get(apt.id);
  const y = new Date().getFullYear();
  const r = SEASONS.map((s) => ({ ...s, hours: sunHours(apt, y, s.m, s.d) }));
  cache.set(apt.id, r);
  return r;
}
