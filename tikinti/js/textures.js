// Prosedur teksturlar (canvas ilə yaradılır, heç bir şəkil faylı lazım deyil)
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(size, draw, { srgb = true, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Sadə value-noise
function makeNoise(seed) {
  const r = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const lerp = (a, b, t) => a + (b - a) * t;
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const v00 = vals[perm[xi + perm[yi]]], v10 = vals[perm[xi + 1 + perm[yi]]];
    const v01 = vals[perm[xi + perm[yi + 1]]], v11 = vals[perm[xi + 1 + perm[yi + 1]]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
  };
}

function fbm(noise, x, y, oct = 5) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); a *= 0.5; f *= 2; }
  return s;
}

// Parket — 1 tekstur = 2m x 2m
export function woodTexture(tone = [176, 132, 92]) {
  return canvasTexture(1024, (g, S) => {
    const r = rng(7);
    const noise = makeNoise(3);
    const plankW = S / 10; // 20 sm
    for (let col = 0; col < 10; col++) {
      let y = -r() * S * 0.6;
      while (y < S) {
        const len = S * (0.5 + r() * 0.3);
        const k = 0.82 + r() * 0.3;
        const base = tone.map((c) => Math.min(255, c * k));
        const x0 = col * plankW;
        const img = g.createImageData(Math.ceil(plankW), Math.ceil(Math.min(len, S - Math.max(y, 0))) || 1);
        const off = r() * 100;
        for (let py = 0; py < img.height; py++) {
          for (let px = 0; px < img.width; px++) {
            const gy = (Math.max(y, 0) + py) / S;
            const n = fbm(noise, (px / plankW) * 2 + off, gy * 40 + off, 3);
            const grain = Math.sin((px / plankW) * 18 + n * 9 + off) * 0.5 + 0.5;
            const m = 0.86 + grain * 0.1 + n * 0.12;
            const i = (py * img.width + px) * 4;
            img.data[i] = base[0] * m;
            img.data[i + 1] = base[1] * m;
            img.data[i + 2] = base[2] * m;
            img.data[i + 3] = 255;
          }
        }
        g.putImageData(img, x0, Math.max(y, 0));
        g.fillStyle = 'rgba(40,25,15,0.55)';
        g.fillRect(x0, Math.max(y, 0), plankW, 2);
        y += len;
      }
      g.fillStyle = 'rgba(40,25,15,0.45)';
      g.fillRect(col * plankW, 0, 2, S);
    }
  });
}

// Mərmər — 1 tekstur = 2m x 2m
export function marbleTexture(base = [236, 232, 225], vein = [150, 140, 130]) {
  return canvasTexture(512, (g, S) => {
    const noise = makeNoise(11);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        // tikişsiz olsun deyə kənarlarda qarışdır
        const n = fbm(noise, u * 6, v * 6, 5);
        const t = Math.abs(Math.sin((u * 3 + v * 2) * Math.PI + n * 8));
        const veinAmt = Math.pow(1 - t, 12) * 0.85 + (1 - fbm(noise, u * 20 + 40, v * 20, 3)) * 0.05;
        const i = (y * S + x) * 4;
        for (let c = 0; c < 3; c++) img.data[i + c] = base[c] * (1 - veinAmt) + vein[c] * veinAmt - n * 10;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // plitə aralıqları (60 sm)
    g.strokeStyle = 'rgba(120,110,100,0.35)';
    g.lineWidth = 2;
    for (let k = 0; k <= S; k += S / (2 / 0.6)) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke();
      g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke();
    }
  });
}

// Keramik plitə — 1 tekstur = 1.2m x 1.2m (4 plitə)
export function tileTexture(color = [214, 210, 204], grout = '#9d978f') {
  return canvasTexture(512, (g, S) => {
    const noise = makeNoise(5);
    g.fillStyle = grout;
    g.fillRect(0, 0, S, S);
    const n = 2, gap = 4, ts = S / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = 0.95 + ((i * 7 + j * 3) % 5) * 0.015;
        const img = g.createImageData(ts - gap, ts - gap);
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const v = fbm(noise, (i * ts + x) / 90, (j * ts + y) / 90, 3) * 0.08;
            const p = (y * img.width + x) * 4;
            img.data[p] = color[0] * (k - v);
            img.data[p + 1] = color[1] * (k - v);
            img.data[p + 2] = color[2] * (k - v);
            img.data[p + 3] = 255;
          }
        }
        g.putImageData(img, i * ts + gap / 2, j * ts + gap / 2);
      }
    }
  });
}

// Səki daşı — 1 tekstur = 4m x 4m
export function paverTexture() {
  return canvasTexture(512, (g, S) => {
    const r = rng(9);
    g.fillStyle = '#6f6a63';
    g.fillRect(0, 0, S, S);
    const cell = S / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const v = 150 + r() * 40;
        g.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
        g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
  });
}

// Ot — 1 tekstur = 8m x 8m
export function grassTexture() {
  return canvasTexture(256, (g, S) => {
    const noise = makeNoise(21);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = fbm(noise, x / 24, y / 24, 4);
        const i = (y * S + x) * 4;
        img.data[i] = 58 + n * 40;
        img.data[i + 1] = 92 + n * 55;
        img.data[i + 2] = 40 + n * 20;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Asfalt — 1 tekstur = 10m x 10m
export function asphaltTexture() {
  return canvasTexture(256, (g, S) => {
    const r = rng(4);
    g.fillStyle = '#34363a';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) {
      const v = 40 + r() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.6)`;
      g.fillRect(r() * S, r() * S, 1.5, 1.5);
    }
  });
}

// Şəhər binaları üçün pəncərə teksturu (emissive)
export function cityWindowsTexture() {
  return canvasTexture(256, (g, S) => {
    const r = rng(33);
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    const cols = 16, rows = 32;
    const cw = S / cols, rh = S / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (r() < 0.28) {
          const w = 0.55 + r() * 0.45;
          g.fillStyle = `rgb(${255 * w},${190 * w},${120 * w})`;
          g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 3);
        }
      }
    }
  });
}

export function cityFacadeTexture() {
  return canvasTexture(256, (g, S) => {
    g.fillStyle = '#3a3d44';
    g.fillRect(0, 0, S, S);
    const cols = 16, rows = 32;
    const cw = S / cols, rh = S / rows;
    g.fillStyle = '#1d2129';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 3);
  });
}

// Abstrakt divar şəkli (hər seed üçün fərqli kompozisiya)
export function artTexture(seed = 1) {
  const r = rng(seed * 97 + 13);
  const pal = [
    ['#e9e1d3', '#c9a27a', '#2f3b45', '#9a5b3c', '#d8c3a5'],
    ['#efe9df', '#6b7f6a', '#c7b08a', '#2c2c2c', '#b8603c'],
    ['#f1ece4', '#34506b', '#d6b98c', '#8aa0ad', '#1d1d1d'],
  ][seed % 3];
  return canvasTexture(512, (g, S) => {
    g.fillStyle = pal[0];
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = pal[1 + Math.floor(r() * 4)];
      g.globalAlpha = 0.75 + r() * 0.25;
      const t = r();
      if (t < 0.4) { g.beginPath(); g.arc(r() * S, r() * S, 40 + r() * 150, 0, Math.PI * (1 + r())); g.fill(); }
      else if (t < 0.7) g.fillRect(r() * S * 0.8, r() * S * 0.8, 40 + r() * 200, 20 + r() * 220);
      else { g.lineWidth = 6 + r() * 14; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(r() * S, r() * S); g.bezierCurveTo(r() * S, r() * S, r() * S, r() * S, r() * S, r() * S); g.stroke(); }
    }
    g.globalAlpha = 1;
    const n = makeNoise(seed);
    const img = g.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) {
      const k = (n(x / 3, y / 3) - 0.5) * 18;
      const i = (y * S + x) * 4;
      img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k;
    }
    g.putImageData(img, 0, 0);
  });
}

// Naxışlı xalça
export function rugTexture(seed = 1, base = [176, 160, 140]) {
  const r = rng(seed * 31 + 5);
  return canvasTexture(512, (g, S) => {
    const n = makeNoise(seed + 7);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = fbm(n, x / 6, y / 6, 3) * 0.25 + 0.85;
      const i = (y * S + x) * 4;
      img.data[i] = base[0] * v; img.data[i + 1] = base[1] * v; img.data[i + 2] = base[2] * v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const dark = `rgba(${base[0] * 0.55},${base[1] * 0.55},${base[2] * 0.55},0.8)`;
    g.strokeStyle = dark;
    g.lineWidth = 10;
    g.strokeRect(26, 26, S - 52, S - 52);
    g.lineWidth = 3;
    g.strokeRect(46, 46, S - 92, S - 92);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(80 + r() * (S - 160), 80 + r() * (S - 160));
      g.lineTo(80 + r() * (S - 160), 80 + r() * (S - 160));
      g.lineWidth = 2 + r() * 5;
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

// Divar plitəsi (hamam) — 1 tekstur = 0.6 m x 0.6 m, uzunsov plitələr
export function wallTileTexture() {
  return canvasTexture(512, (g, S) => {
    const n = makeNoise(77);
    g.fillStyle = '#b9b2a8';
    g.fillRect(0, 0, S, S);
    const rows = 4, cols = 2, th = S / rows, tw = S / cols;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const off = (y % 2) * tw / 2;
      for (const dx of [0, -tw]) {
        const x0 = x * tw + off + dx;
        const img = g.createImageData(tw - 4, th - 4);
        for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) {
          const v = 0.93 + fbm(n, (x0 + xx) / 40, (y * th + yy) / 40, 2) * 0.1;
          const i = (yy * img.width + xx) * 4;
          img.data[i] = 236 * v; img.data[i + 1] = 233 * v; img.data[i + 2] = 226 * v; img.data[i + 3] = 255;
        }
        g.putImageData(img, x0 + 2, y * th + 2);
      }
    }
  });
}
