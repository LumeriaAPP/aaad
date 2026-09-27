"""20 saniyəlik saundtrek: yumşaq pad akkordları, 120 BPM zərbə, keçidlərdə 'whoosh', sonda final zərbə.
Hər şey kodla sintez olunur (heç bir kənar səs faylı yoxdur). İstifadə: python3 sound.py out.wav"""
import sys, wave
import numpy as np

SR = 48000
DUR = 20.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def env(start, attack, hold, release):
    e = np.zeros(N)
    a0, a1 = int(start * SR), int((start + attack) * SR)
    h1 = int((start + attack + hold) * SR)
    r1 = min(N, int((start + attack + hold + release) * SR))
    if a1 > a0: e[a0:a1] = np.linspace(0, 1, a1 - a0) ** 2
    e[a1:h1] = 1
    if r1 > h1: e[h1:r1] = np.linspace(1, 0, r1 - h1) ** 1.6
    return e


def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


def lowpass(x, cutoff):
    # sadə bir qütblü süzgəc (dəyişən kəsmə tezliyi ilə)
    cutoff = np.broadcast_to(cutoff, x.shape)
    y = np.zeros_like(x)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


L = np.zeros(N); R = np.zeros(N)

# --- pad: Dmaj9 → Bm11 → Gmaj9 → Aadd9 → Dmaj9 (hər biri ~4 s), yumşaq detune ---
chords = [
    (0.0, [50, 57, 61, 64, 69]),
    (4.5, [47, 54, 57, 61, 66]),
    (9.5, [43, 50, 54, 57, 62, 66]),
    (12.5, [45, 52, 57, 59, 64]),
    (15.0, [50, 57, 61, 64, 66, 69]),
]
for i, (st, notes) in enumerate(chords):
    en = chords[i + 1][0] if i + 1 < len(chords) else DUR
    e = env(st - 0.3 if st > 0 else 0, 0.9, max(0.1, en - st - 0.6), 1.6)
    for k, m in enumerate(notes):
        f = note(m)
        for det, pan in ((-0.12, 0.3), (0.12, 0.7)):
            ph = rng.random() * 6.28
            w = np.sin(2 * np.pi * f * (1 + det / 100) * t + ph) + 0.28 * np.sin(2 * np.pi * 2 * f * t + ph) + 0.1 * np.sin(2 * np.pi * 3 * f * t)
            amp = 0.022 * (0.8 if k == 0 else 1.0)
            L += w * e * amp * (1 - pan); R += w * e * amp * pan

# --- sub-bas (akkordun kökü, oktava aşağı) ---
for i, (st, notes) in enumerate(chords):
    en = chords[i + 1][0] if i + 1 < len(chords) else DUR
    e = env(st, 0.25, max(0.1, en - st - 0.3), 0.8)
    f = note(notes[0] - 12)
    b = np.sin(2 * np.pi * f * t) * e * 0.10
    L += b; R += b

# --- ritm: 120 BPM zərbə 2.5 s-dən, 9.5–12.5 arası yarım sıxlıq, sonda dayanır ---
def kick(at, gain=1.0):
    n = int(0.45 * SR); i0 = int(at * SR)
    if i0 >= N: return
    tt = np.arange(min(n, N - i0)) / SR
    f = 42 + 90 * np.exp(-tt * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 9) * 0.55 * gain
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    L[i0:i0 + len(s)] += s; R[i0:i0 + len(s)] += s

def hat(at, gain=1.0):
    n = int(0.08 * SR); i0 = int(at * SR)
    if i0 >= N: return
    s = rng.standard_normal(min(n, N - i0))
    s = np.diff(np.concatenate([[0], s])) * np.exp(-np.arange(len(s)) / SR * 55) * 0.05 * gain
    L[i0:i0 + len(s)] += s * 0.7; R[i0:i0 + len(s)] += s

for k in range(int((17.5 - 2.5) / 0.5) + 1):
    at = 2.5 + k * 0.5
    if at >= 17.5: break
    sparse = 9.5 <= at < 12.5
    if not sparse or k % 2 == 0: kick(at, 0.8 if sparse else 1.0)
    if at >= 5.5: hat(at + 0.25, 0.9)

# --- keçid 'whoosh'ları (süzgəcdən keçən küy, tezlik yuxarı sürüşür) ---
def whoosh(center, length=0.7, gain=1.0):
    i0 = int((center - length * 0.7) * SR); n = int(length * SR)
    i0 = max(0, i0); n = min(n, N - i0)
    tt = np.linspace(0, 1, n)
    nz = rng.standard_normal(n)
    cut = 300 + 5200 * np.sin(np.pi * tt) ** 2
    y = lowpass(nz, cut) - lowpass(nz, cut * 0.25)
    e = np.sin(np.pi * tt) ** 2.2 * 0.5 * gain
    pan = 0.5 + 0.4 * np.sin(np.pi * (tt - 0.5))
    L[i0:i0 + n] += y * e * (1 - pan) * 2; R[i0:i0 + n] += y * e * pan * 2

for c in (2.3, 5.45, 9.5, 12.5, 14.98):
    whoosh(c, 0.75)

# --- saat/sayğac "tik"ləri (S2 saat, S5 günəş) ---
def tick(at, f=2400, gain=0.12):
    n = int(0.03 * SR); i0 = int(at * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 180) * gain
    L[i0:i0 + n] += s; R[i0:i0 + n] += s
for k in range(10): tick(4.35 + k * 0.075, 2600 - k * 60, 0.05)

# --- final: yüksələn səs (riser) + zərbə + parıltı ---
i0, i1 = int(15.6 * SR), int(17.5 * SR)
tt = np.linspace(0, 1, i1 - i0)
nz = rng.standard_normal(i1 - i0)
rise = (lowpass(nz, 400 + 7000 * tt ** 2) * tt ** 2.5 * 0.35)
L[i0:i1] += rise; R[i0:i1] += rise
kick(17.5, 1.6)
# parıltı (yüksək oktavada çan kimi səs)
for m, d in ((81, 0.0), (86, 0.09), (88, 0.18), (93, 0.27)):
    e = env(18.0 + d, 0.01, 0.0, 2.2)
    b = np.sin(2 * np.pi * note(m) * t) * e * 0.035
    L += b * 0.8; R += b
# son akkordun "hit"i
e = env(17.5, 0.005, 0.1, 2.4)
for m in (38, 50, 57, 62, 66):
    b = np.sin(2 * np.pi * note(m) * t) * e * 0.05
    L += b; R += b

# --- sadə reverb (bir neçə gecikmə) ---
for d, g in ((0.043, 0.25), (0.071, 0.2), (0.113, 0.16), (0.173, 0.12)):
    k = int(d * SR)
    L[k:] += R[:-k] * g; R[k:] += L[:-k] * g

# son 0.4 s sönür, normallaşdır, yumşaq limiter
fade = np.ones(N); fade[int(19.6 * SR):] = np.linspace(1, 0, N - int(19.6 * SR)) ** 2
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L / peak * 1.3) * 0.89; R = np.tanh(R / peak * 1.3) * 0.89
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok', sys.argv[1])
