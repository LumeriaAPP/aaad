# 3D Satış Sistemi — 20 saniyəlik motion video

- `3d-satis-sistemi.mp4` — hazır video (1920×1080, 60 FPS, səsli, 20 s)
- `index.html` — videonun canlı HTML versiyası (brauzerdə dövrə ilə oynayır, səssiz); kadrlar `window.seek(t)` ilə idarə olunur
- `shots/` — saytdan çəkilmiş kadrlar (1920×1080)
- `tools/sound.py` — saundtrekin sintezi (numpy): `python3 tools/sound.py sound.wav`
- `tools/render.js` — kadr-kadr render (Playwright): `node tools/render.js OUT 60 0 20 [worker workers]`

Yenidən yığmaq:
```
python3 -m http.server 8766            # bu qovluqda
node tools/render.js fr 60 0 20 0 3 &  node tools/render.js fr 60 0 20 1 3 &  node tools/render.js fr 60 0 20 2 3
python3 tools/sound.py sound.wav
ffmpeg -framerate 60 -i fr/f%05d.jpg -i sound.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest 3d-satis-sistemi.mp4
```
Şrift: Inter Tight (SIL Open Font License).
