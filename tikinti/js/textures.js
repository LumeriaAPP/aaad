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
