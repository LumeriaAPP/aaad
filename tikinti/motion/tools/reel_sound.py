"""15 saniyəlik showreel saundtreki — 120 BPM, F minor.
Quruluş (vuruş = 0.5 s, takt = 2 s):
  0–2    intro: filtrli hi-hat, HUD siqnalları, riser + snare roll, reverse crash
  2      DROP: impact + tam ritm (kick, clap, hat, offbeat bas, supersaw akkordlar, pluck arpecio)
  6–8    'sonsuz zoom' üçün sürüşən riser, 8-də vurğu
  10–11.5 stutter (beat-repeat 1/8 → 1/16 → 1/32)
  11.5–12 tape-stop
  12–13  fasilə: reverse crash + riser
  13     FINAL: böyük impact + akkord + parıltılı quyruq
Hər şey kodla sintez olunur. İstifadə: python3 reel_sound.py out.wav"""
import sys, wave
import numpy as np
from scipy import signal

SR = 48000
DUR = 15.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(11)
nt = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def buf():
    return np.zeros((N, 2))


def place(bus, x, at, gain=1.0, pan=0.0):
    """mono və ya stereo səsi bus-a yerləşdir (pan: -1 sol .. +1 sağ)"""
    i0 = int(round(at * SR))
    if i0 >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    if i0 < 0: x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    bus[i0:i0 + n] += x[:n] * gain


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)
def hp(x, f, order=2):
    sos = signal.butter(order, f, btype='high', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)
def lp(x, f, order=2):
    sos = signal.butter(order, f, btype='low', fs=SR, output='sos'); return signal.sosfilt(sos, x, axis=0)


def sweep_lp(x, f0, f1, curve=1.0):
    """zamanla dəyişən aşağı keçid süzgəci (blok-blok); stereo da olar"""
    if x.ndim == 2: return np.stack([sweep_lp(x[:, c], f0, f1, curve) for c in range(x.shape[1])], 1)
    y = np.zeros_like(x); B = 256; zi = None
    nb = (len(x) + B - 1) // B
    for k in range(nb):
        f = f0 * (f1 / f0) ** ((k / max(1, nb - 1)) ** curve)
        b, a = signal.butter(2, min(f, SR * 0.45), fs=SR)
        seg = x[k * B:(k + 1) * B]
        if zi is None: zi = signal.lfilter_zi(b, a) * 0
        y[k * B:(k + 1) * B], zi = signal.lfilter(b, a, seg, zi=zi)
    return y


def saw(f, n, phase=0.0):
    """bant-məhdud mişar dalğası (aliasing yoxdur)"""
    t = np.arange(n) / SR
    f = np.broadcast_to(f, (n,)) if np.ndim(f) else np.full(n, f)
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    y = np.zeros(n)
    kmax = int(SR * 0.45 / max(20, f.max()))
    for k in range(1, min(kmax, 60) + 1):
        y += np.sin(k * ph) / k * (1 if k * f.max() < SR * 0.45 else 0)
    return y * (2 / np.pi)


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    t = np.arange(n) / SR
    hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / a, np.where(t < a + d, 1 - (1 - s) * (t - a) / d, s))
    rel = np.clip((t - hold) / r, 0, 1)
    return e * (1 - rel)


# ---------------- nağara ----------------
def kick():
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 44 + 150 * np.exp(-t * 34)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.5
    return np.tanh((body + click) * 2.2) * 0.8


def clap():
    n = int(0.45 * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n); e = np.zeros(n)
    for o in (0.0, 0.009, 0.018, 0.029):
        e += np.where(t >= o, np.exp(-(t - o) * (180 if o < 0.029 else 16)), 0)
    y = bp(nz, 900, 6500) * e
    y += np.sin(2 * np.pi * 210 * t) * np.exp(-t * 40) * 0.25
    return y * 0.55


def hat(open_=False):
    n = int((0.28 if open_ else 0.06) * SR); t = np.arange(n) / SR
    y = hp(rng.standard_normal(n), 7500, 4) * np.exp(-t * (11 if open_ else 70))
    # metallik rəng: bir neçə kvadrat dalğa
    m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (5200, 7300, 8900, 11100)) * 0.08
    return (y + hp(m, 6000) * np.exp(-t * (14 if open_ else 80))) * (0.35 if open_ else 0.28)


def snare():
    n = int(0.2 * SR); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1200, 8000) * np.exp(-t * 28) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4) * 0.45


def crash(length=2.2):
    n = int(length * SR); t = np.arange(n) / SR
    y = hp(rng.standard_normal((n, 2)), 4200, 2) * np.exp(-t * 2.2)[:, None]
    return y * 0.3


def impact(big=1.0):
    n = int(2.6 * SR); t = np.arange(n) / SR
    f = 26 + 70 * np.exp(-t * 3.2)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    body = lp(rng.standard_normal(n), 3000) * np.exp(-t * 9) * 0.6
    y = np.tanh((sub * 1.2 + body) * 1.6) * 0.9 * big
    return np.stack([y, y], 1) + crash(2.6)[:n] * 1.1


def whoosh(length=0.6, up=True):
    n = int(length * SR); tt = np.linspace(0, 1, n)
    nz = rng.standard_normal((n, 2))
    center = (500 + 6000 * tt ** 2) if up else (6500 - 6000 * tt ** 0.5)
    y = np.zeros((n, 2)); B = 512
    for k in range(0, n, B):
        c = center[k]
        sos = signal.butter(2, [max(80, c * 0.5), min(c * 1.6, SR * 0.45)], btype='band', fs=SR, output='sos')
        y[k:k + B] = signal.sosfilt(sos, nz[k:k + B], axis=0)
    e = np.sin(np.pi * tt) ** 1.5
    pan = np.stack([1 - tt, tt], 1) * 1.2 + 0.2
    return y * e[:, None] * pan * 0.9


def blip(f=2200, length=0.04, g=0.12):
    n = int(length * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * g


# ---------------- akkordlar ----------------
# Fm – Db – Ab – Eb (hər biri 1 takt), 2–10 s
PROG = [(65, [53, 56, 60, 65]), (61, [49, 53, 56, 61]), (68, [56, 60, 63, 68]), (63, [51, 55, 58, 63]), (65, [53, 56, 60, 65])]
ARP_OFFS = [0, 7, 12, 3, 12, 7, 15, 12]  # kök üzərində pluck notları (yarım ton)


def supersaw(notes, length):
    n = int(length * SR); y = np.zeros((n, 2))
    for m in notes:
        for d, pan in ((-0.14, -0.8), (-0.06, -0.3), (0.0, 0.0), (0.06, 0.3), (0.14, 0.8)):
            s = saw(nt(m) * (1 + d / 100 * 3), n, rng.random() * 6.28)
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            y[:, 0] += s * l; y[:, 1] += s * r
    y = lp(y, 2600)
    return y / (len(notes) * 5) * env_adsr(n, 0.02, 0.3, 0.8, 0.25)[:, None]


def pluck(m, length=0.22):
    n = int(length * SR); t = np.arange(n) / SR
    s = saw(nt(m), n) * 0.7 + np.sign(np.sin(2 * np.pi * nt(m) * t)) * 0.2
    y = sweep_lp(s, 7000, 500, 0.5)
    return y * np.exp(-t * 14) * 0.5


def bass_note(m, length=0.2):
    n = int(length * SR); t = np.arange(n) / SR
    s = saw(nt(m), n) * 0.6 + np.sin(2 * np.pi * nt(m - 12) * t) * 0.9
    y = sweep_lp(s, 1600, 220, 0.6)
    return np.tanh(y * 1.8) * env_adsr(n, 0.004, 0.08, 0.7, 0.05) * 0.6


# ---------------- ardıcıllıq ----------------
drums, bass, music, fx = buf(), buf(), buf(), buf()
send = buf()  # reverb göndərişi
kicks = []

# INTRO (0–2): 16-lıq hat (açılan filtr), HUD blip-ləri, riser, snare roll
for k in range(16):
    at = k * 0.125
    h = hat(); h = sweep_lp(h, 1500 + at * 4000, 1500 + at * 4000 + 100) if at < 1.2 else h
    place(drums, h, at, 1.0 + 1.2 * (at / 2), pan=(-0.3 if k % 2 else 0.3))
for k, at in enumerate([0.12, 0.3, 0.42, 0.55, 0.61, 0.78, 0.9, 1.02, 1.1, 1.24, 1.33, 1.45]):
    place(fx, blip(1800 + (k % 4) * 350, 0.05, 0.22), at, 1.0, pan=(k % 3 - 1) * 0.6)
# snare roll 1.0–2.0: 8-lik → 16-lıq → 32-lik, artan səs
roll = [1.0, 1.25, 1.5, 1.625, 1.75, 1.8125, 1.875, 1.9375]
for k, at in enumerate(roll):
    place(drums, snare(), at, 0.7 + 0.22 * k); place(send, snare(), at, 0.3)
# riser 0.4–2.0
n = int(1.6 * SR); tt = np.linspace(0, 1, n)
rz = sweep_lp(rng.standard_normal(n), 400, 9000, 1.4) * tt ** 2 * 0.5
rs = saw(110 * 2 ** (tt * 2), n) * tt ** 3 * 0.12
place(fx, rz + lp(rs, 5000), 0.4, 2.6)
# intro nəbzi: filtrli kick hər vuruşda (0.5, 1.0, 1.5)
for at in (0.5, 1.0, 1.5): place(drums, lp(kick(), 400), at, 0.55 + 0.25 * at)
# reverse crash → 2.0
rc = crash(1.2)[::-1] * np.linspace(0, 1, int(1.2 * SR))[:, None] ** 2
place(fx, rc, 0.8, 1.6)

# DROP 2.0
place(fx, impact(1.0), 2.0, 0.9)
place(send, impact(0.6), 2.0, 0.4)

# GROOVE 2–10 (4 takt) — 6-8 arası hat-lar 32-lik
for bar in range(5):
    t0 = 2.0 + bar * 2.0
    root, chord = PROG[bar]
    # akkord (supersaw) + ona reverb
    ch = supersaw(chord + [chord[0] + 12], 2.0)
    place(music, ch, t0, 0.55); place(send, ch, t0, 0.25)
    for b in range(4):
        at = t0 + b * BEAT
        place(drums, kick(), at, 1.0); kicks.append(at)
        if b % 2 == 1: place(drums, clap(), at, 0.9); place(send, clap(), at, 0.35)
        place(drums, hat(True), at + 0.25, 0.8, pan=0.2)
        # offbeat bas
        place(bass, bass_note(root - 24), at + 0.25, 1.0)
        if b == 3 and bar % 2 == 1: place(bass, bass_note(root - 24 + 7, 0.12), at + 0.375, 0.8)
    for s in range(16):
        at = t0 + s * 0.125
        acc = [1, 0.45, 0.7, 0.45][s % 4]
        place(drums, hat(), at, acc * 0.8, pan=(-0.35 if s % 2 else 0.35))
        if bar == 2:  # 6–8: 32-lik hat, gərginlik
            place(drums, hat(), at + 0.0625, 0.35, pan=0.5)
        # pluck arpecio
        m = root + ARP_OFFS[s % 8] + (12 if (s // 8) % 2 else 0)
        p = pluck(m)
        place(music, p, at, 0.5, pan=np.sin(s * 0.9) * 0.5)
        place(send, p, at, 0.25)
        # ping-pong gecikmə (nöqtəli 8-lik)
        place(music, p * 0.35, at + 0.375, 1.0, pan=0.7 if s % 2 else -0.7)
    # takt keçidlərində whoosh
place(fx, whoosh(0.6, True), 3.7, 0.7)
place(fx, whoosh(0.5, False), 5.75, 0.6)
# 6–8: 'sonsuz zoom' riser, 8-də vurğu
n = int(2.0 * SR); tt = np.linspace(0, 1, n)
zr = sweep_lp(rng.standard_normal(n), 300, 12000, 1.2) * (0.1 + tt ** 2) * 0.35
zs = saw(220 * 2 ** (tt * 1.5), n) * tt ** 2 * 0.06
place(fx, lp(zr + zs, 12000), 6.0, 1.0)
place(fx, impact(0.55), 8.0, 0.55)
for k in range(8): place(fx, blip(2600 + k * 90, 0.03, 0.08), 8.1 + k * 0.1, 1.0, pan=0.5 - k * 0.12)  # sayğac tıqqıltısı

# kick sidechain zərfi
sc = np.ones(N); tt = np.arange(int(0.35 * SR)) / SR
duck = 1 - 0.75 * np.exp(-tt * 11)
for at in kicks:
    i0 = int(at * SR); n2 = min(len(duck), N - i0); sc[i0:i0 + n2] = np.minimum(sc[i0:i0 + n2], duck[:n2])
music *= sc[:, None]; bass *= sc[:, None]

# ---------------- reverb (sintetik impuls cavabı, konvolyusiya) ----------------
irn = int(2.2 * SR); ti = np.arange(irn) / SR
ir = rng.standard_normal((irn, 2)) * np.exp(-ti * 3.1)[:, None]
ir = lp(ir, 6000); ir[: int(0.012 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1)

mix = drums * 0.9 + bass * 0.85 + music * 0.8 + fx * 0.9 + wet * 0.55

# ---------------- stutter 10–11.5, tape-stop 11.5–12 ----------------
out = mix.copy()
src = mix[int(10.0 * SR): int(10.25 * SR)].copy()  # 10.0-da kick + bas + pluck var
def repeat_fill(a, b, sl):
    i0, i1 = int(a * SR), int(b * SR); L = int(sl * SR)
    seg = src[:L].copy(); fade = min(64, L // 4)
    seg[:fade] *= np.linspace(0, 1, fade)[:, None]; seg[-fade:] *= np.linspace(1, 0, fade)[:, None]
    k = i0
    while k < i1:
        n2 = min(L, i1 - k); out[k:k + n2] = seg[:n2]; k += L
repeat_fill(10.5, 10.75, 0.125)
repeat_fill(10.75, 11.0, 0.0625)
repeat_fill(11.0, 11.25, 0.03125)
# stutter zamanı yüksələn filtr + həmin ərazidə kick-lər qalsın (ritm itməsin)
seg = out[int(10.5 * SR): int(11.25 * SR)]
out[int(10.5 * SR): int(11.25 * SR)] = sweep_lp(hp(seg, 60), 1500, 16000, 0.7) * 1.05
# tape-stop: oxuma sürəti 1 → 0
a, b = int(11.25 * SR), int(12.0 * SR); L = b - a
rate = (1 - np.linspace(0, 1, L)) ** 1.4
pos = a + np.cumsum(rate)
for c in range(2):
    out[a:b, c] = np.interp(pos, np.arange(N), mix[:, c]) * (1 - np.linspace(0, 1, L) ** 3)
# 12–13 fasilə: yalnız reverse crash + riser
out[int(12.0 * SR): int(13.0 * SR)] = 0
brk = buf()
rc = crash(1.0)[::-1] * np.linspace(0, 1, int(1.0 * SR))[:, None] ** 2.5
place(brk, rc, 12.0, 2.6)
n = int(0.95 * SR); tt = np.linspace(0, 1, n)
place(brk, sweep_lp(rng.standard_normal(n), 500, 10000, 1.5) * tt ** 2 * 0.9, 12.03, 1.0)
place(brk, lp(saw(90 * 2 ** (tt * 2.5), n), 4000) * tt ** 2 * 0.25, 12.03, 1.0)
for at in (12.0, 12.5, 12.75, 12.875): place(brk, lp(kick(), 300), at, 0.8)
for k in range(6): place(brk, blip(1500 + k * 250, 0.04, 0.2), 12.2 + k * 0.12, 1.0, pan=-0.6 + k * 0.24)

# FINAL 13.0
fin = buf()
place(fin, impact(1.0), 13.0, 0.8)
chord = hp(supersaw([53, 60, 65, 68, 72, 77], 2.0), 150) * 1.8
place(fin, chord, 13.0, 0.9)
send2 = buf(); place(send2, chord, 13.0, 0.6)
for k, m in enumerate([77, 80, 84, 89, 92]):
    n = int(1.6 * SR); t = np.arange(n) / SR
    bell = (np.sin(2 * np.pi * nt(m) * t) + 0.3 * np.sin(2 * np.pi * nt(m) * 2.01 * t)) * np.exp(-t * 2.4) * 0.05
    place(fin, bell, 13.25 + k * 0.125, 1.0, pan=-0.6 + k * 0.3); place(send2, bell, 13.25 + k * 0.125, 0.6)
wet2 = np.stack([signal.fftconvolve(send2[:, c], ir[:, c])[:N] for c in range(2)], 1)
out += brk + fin + wet2 * 0.7

# ---------------- master ----------------
out = hp(out, 32, 2)
out = out - lp(out, 90) * 0.25  # alt bas bir az azaldılır (bulanıqlıq olmasın)
fade = np.ones(N); f0 = int(14.3 * SR); fade[f0:] = np.linspace(1, 0, N - f0) ** 1.5
out *= fade[:, None]
out /= np.abs(out).max()
out = np.tanh(out * 1.6) / np.tanh(1.6)
out *= 10 ** (-1.0 / 20)
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', sys.argv[1], 'rms dB', round(20 * np.log10(np.sqrt((out ** 2).mean())), 1))
