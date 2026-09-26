// Kamerada havada asılı 3D menyu: başlıq + yemək kartları (şəkil, ad, qiymət).
// Karta toxunanda həmin yemək masaya qoyulur. Yeməyin üstündə də adı və qiyməti 3D yazı ilə görünür.
import * as THREE from 'three';

const PX = 3200; // 1 metr = 3200 piksel (kətanda)
const W = 0.2, ITEM_H = 0.05, GAP = 0.008, TITLE_H = 0.052;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function panelTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * PX); c.height = Math.round(h * PX);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height, ...a); t.needsUpdate = true; };
  return t;
}
const plane = (w, h, tex) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function createMenu3D(dishes, { title = 'Menyu', sub = '', currency = '₼' } = {}) {
  try { await Promise.all([document.fonts.load('600 60px "Cormorant Garamond"'), document.fonts.load('700 40px "Plus Jakarta Sans"')]); } catch (e) { /* standart şrift */ }
  const imgs = await Promise.all(dishes.map((d) => loadImg(`img/${d.id}.webp`)));
  const money = (v) => `${v} ${currency}`;

  const group = new THREE.Group();
  group.visible = false;
  // başlıq
  const tTex = panelTex(W, TITLE_H, (g, w, h) => {
    roundRect(g, 4, 4, w - 8, h - 8, 44);
    g.fillStyle = 'rgba(20,17,14,0.86)'; g.fill();
    g.strokeStyle = 'rgba(232,163,61,0.8)'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#f6efe4'; g.font = '600 64px "Cormorant Garamond", Georgia, serif'; g.textBaseline = 'middle';
    g.fillText(title, 40, h * 0.4);
    const tw = g.measureText(title).width;
    g.fillStyle = '#e8a33d'; g.font = 'italic 600 52px "Cormorant Garamond", Georgia, serif';
    g.fillText(sub, 40 + tw + 16, h * 0.42);
    g.fillStyle = 'rgba(246,239,228,0.7)'; g.font = '600 26px "Plus Jakarta Sans", sans-serif';
    g.fillText('Yeməyə toxunun — masada görün', 40, h * 0.76);
  });
  tTex.redraw();
  const titleMesh = plane(W, TITLE_H, tTex);
  group.add(titleMesh);
  // kartlar
  const items = dishes.map((d, i) => {
    const tex = panelTex(W, ITEM_H, (g, w, h, on) => {
      roundRect(g, 4, 4, w - 8, h - 8, 40);
      if (on) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(240,178,80,0.97)'); gr.addColorStop(1, 'rgba(201,120,42,0.97)'); g.fillStyle = gr; }
      else g.fillStyle = 'rgba(20,17,14,0.78)';
      g.fill();
      g.strokeStyle = on ? 'rgba(255,255,255,0.7)' : 'rgba(255,240,220,0.18)'; g.lineWidth = 4; g.stroke();
      const s = h - 36;
      if (imgs[i]) {
        g.save(); g.beginPath(); g.arc(18 + s / 2, h / 2, s / 2, 0, Math.PI * 2); g.clip();
        g.fillStyle = '#2a231b'; g.fillRect(18, 18, s, s);
        const k = 1.25, iw = s * k; g.drawImage(imgs[i], 18 + (s - iw) / 2, h / 2 - iw / 2, iw, iw); g.restore();
      }
      g.textBaseline = 'middle';
      g.fillStyle = on ? '#1d1206' : '#f6efe4'; g.font = '600 56px "Cormorant Garamond", Georgia, serif';
      g.fillText(d.name, s + 46, h * 0.4, w - s - 250);
      g.fillStyle = on ? 'rgba(29,18,6,0.75)' : 'rgba(246,239,228,0.6)'; g.font = '500 24px "Plus Jakarta Sans", sans-serif';
      g.fillText(d.info || '', s + 48, h * 0.74, w - s - 250);
      g.textAlign = 'right'; g.fillStyle = on ? '#1d1206' : '#e8a33d'; g.font = '700 40px "Plus Jakarta Sans", sans-serif';
      g.fillText(money(d.price), w - 36, h / 2);
      g.textAlign = 'left';
    });
    tex.redraw(false);
    const m = plane(W, ITEM_H, tex);
    m.userData.index = i;
    m.userData.tex = tex;
    group.add(m);
    return m;
  });
  // şaquli düzülüş (yuxarıdan aşağı), aşağı kənarı y=0
  const total = TITLE_H + dishes.length * (ITEM_H + GAP);
  let y = total;
  titleMesh.position.y = y - TITLE_H / 2; y -= TITLE_H + GAP;
  for (const m of items) { m.position.y = y - ITEM_H / 2; y -= ITEM_H + GAP; }

  // yeməyin üstündəki yazı
  const lTex = panelTex(0.22, 0.05, (g, w, h, d) => {
    if (!d) return;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 18;
    g.fillStyle = '#ffffff'; g.font = '600 72px "Cormorant Garamond", Georgia, serif';
    g.fillText(d.name, w / 2, h * 0.36, w - 20);
    g.fillStyle = '#f0b250'; g.font = '700 36px "Plus Jakarta Sans", sans-serif';
    g.fillText(`${money(d.price)}  ·  ${d.info || ''}`, w / 2, h * 0.78, w - 20);
  });
  const label = plane(0.22, 0.05, lTex);
  label.visible = false;
  label.renderOrder = 5;

  let active = -1;
  const camPos = new THREE.Vector3(), tmp = new THREE.Vector3(), right = new THREE.Vector3();
  return {
    group, label,
    setActive(i) {
      if (active >= 0 && items[active]) items[active].userData.tex.redraw(false);
      active = i;
      items[i].userData.tex.redraw(true);
      lTex.redraw(dishes[i]);
    },
    // toxunuş şüası menyu kartına dəyirsə — onun indeksi
    pick(raycaster) {
      if (!group.visible) return null;
      const h = raycaster.intersectObjects(items, false)[0];
      return h ? h.object.userData.index : null;
    },
    // hər kadr: menyu yeməyin sağında, kameraya baxır; yazı yeməyin üstündə
    update(camera, holder, dishSize, t) {
      if (!holder.visible) { group.visible = false; label.visible = false; return; }
      camPos.setFromMatrixPosition(camera.matrixWorld);
      const yaw = Math.atan2(camPos.x - holder.position.x, camPos.z - holder.position.z);
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const r = Math.max(dishSize.x, dishSize.z) / 2;
      group.visible = true;
      group.position.copy(holder.position).addScaledVector(right, r + 0.15);
      group.position.y += 0.015 + Math.sin(t * 1.4) * 0.003;
      group.rotation.set(0, yaw - 0.35, 0); // bir az yeməyə tərəf dönük
      group.rotateX(-0.12);
      label.visible = true;
      label.position.copy(holder.position);
      label.position.y += dishSize.y + 0.045;
      tmp.copy(camPos); tmp.y = label.position.y;
      label.lookAt(tmp);
    },
  };
}
