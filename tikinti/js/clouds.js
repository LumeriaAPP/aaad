// Buludlar: yumşaq, yavaş üzən bulud topaları və onların yerə düşən kölgələri.
// Hər bulud bir neçə yumşaq "pambıq" spraytdan yığılır; rəngi günəşin rənginə görə dəyişir (günbatımında isti-çəhrayı).
import * as THREE from 'three';

function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// yumşaq bulud parçası (kənarları əriyən, içində bir az faktura)
function puffTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rand(7);
  // çoxlu kiçik, sıx "pambıq" topası — kənarları qıvrım, ortası dolu
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * S * 0.3;
    const x = S / 2 + Math.cos(a) * d, y = S * 0.55 + Math.sin(a) * d * 0.55 - (1 - d / (S * 0.3)) * S * 0.06;
    const rad = S * (0.07 + r() * 0.1) * (1.15 - d / (S * 0.3) * 0.5);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  // işıq yuxarıdan: alt tərəf bir az kölgəli (boz-mavi), üst tərəf ağ
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, S * 0.3, 0, S * 0.8);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(140,146,172,0.6)');
  g.fillStyle = sh;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // şəffaf piksellərin rəngi qaradır — premultiplied olmasa, süzgəcdə tünd haşiyə/pərdə yaranır
  t.premultiplyAlpha = true;
  return t;
}

// yerə düşən kölgələr üçün təkrarlanan ləkələr
function shadowTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rand(21);
  for (let i = 0; i < 14; i++) {
    const cx = r() * S, cy = r() * S, rad = S * (0.06 + r() * 0.1);
    // kənardan keçənləri qarşı tərəfdə də çək — toxuma tikişsiz təkrarlansın
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const x = cx + ox, y = cy + oy;
      if (x < -rad || x > S + rad || y < -rad || y > S + rad) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0.45)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ count?: number, area?: number, lite?: boolean }} opts
 */
export function createClouds(scene, { count = 26, area = 1400, lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'clouds';
  group.userData.noAO = true; // AO keçidi spraytları qalın kvadrat kimi görüb göyü tündləşdirməsin
  const tex = puffTexture();
  const r = rand(3);
  const mats = [];
  const clouds = [];
  const n = lite ? Math.round(count * 0.6) : count;
  for (let i = 0; i < n; i++) {
    const cloud = new THREE.Group();
    const size = 60 + r() * 90;
    const parts = lite ? 4 : 5 + Math.floor(r() * 4);
    for (let k = 0; k < parts; k++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false, opacity: 0.5 + r() * 0.3, color: 0xffffff });
      m.userData.base = m.opacity;
      mats.push(m);
      const s = new THREE.Sprite(m);
      const w = size * (0.5 + r() * 0.6);
      s.scale.set(w, w * (0.55 + r() * 0.2), 1);
      s.position.set((r() - 0.5) * size * 1.3, (r() - 0.3) * size * 0.16, (r() - 0.5) * size * 0.8);
      s.material.rotation = (r() - 0.5) * 0.6;
      cloud.add(s);
    }
    // bəziləri kameranın keçdiyi hündürlükdə (öndən keçib dərinlik verir), çoxu yuxarıda
    const low = i % 4 === 0;
    cloud.position.set((r() - 0.5) * area, low ? 150 + r() * 30 : 185 + r() * 90, (r() - 0.5) * area);
    cloud.userData.speed = 0.6 + r() * 0.6;
    group.add(cloud);
    clouds.push(cloud);
  }
  scene.add(group);

  // kölgələr: yerin bir az üstündə, küləklə birgə sürüşür
  const shTex = shadowTexture();
  const REP = 3;
  shTex.repeat.set(REP, REP);
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, color: 0x1a2130, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true });
  // multiply qarışığı üçün: ağ = təsirsiz, qara ləkə = kölgə
  shMat.blending = THREE.CustomBlending;
  shMat.blendEquation = THREE.AddEquation;
  shMat.blendSrc = THREE.ZeroFactor;
  shMat.blendDst = THREE.OneMinusSrcAlphaFactor;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(area, area).rotateX(-Math.PI / 2), shMat);
  shadow.position.y = 0.08;
  shadow.renderOrder = 1;
  shadow.userData.noAO = true;
  scene.add(shadow);

  const wind = new THREE.Vector3(1, 0, 0.35).normalize();
  const tint = new THREE.Color();
  const WARM = new THREE.Color(1.5, 1.08, 0.9), NIGHT = new THREE.Color(0.3, 0.34, 0.46), DAY = new THREE.Color(1.35, 1.35, 1.38);
  const half = area / 2;
  let shift = 0;

  return {
    group, shadow,
    /** dt — saniyə; sunAlt — günəşin hündürlüyü (dərəcə); night — 0..1 */
    update(dt, sunAlt = 40, night = 0, camera = null) {
      for (const c of clouds) {
        c.position.addScaledVector(wind, c.userData.speed * 4 * dt);
        if (c.position.x > half) c.position.x -= area;
        if (c.position.z > half) c.position.z -= area;
        // kameraya yaxın bulud ekranı örtməsin — yaxınlaşdıqca əriyib yox olur
        const d = camera ? c.position.distanceTo(camera.position) : 1e9;
        c.userData.fade = Math.min(1, Math.max(0, (d - 90) / 160));
      }
      shift += 4 * 0.9 * dt;
      shTex.offset.set((-shift * wind.x) / area * REP, (shift * wind.z) / area * REP);
      // rəng: gündüz ağ, günbatımında isti, gecə tünd-mavi
      const warm = Math.exp(-Math.pow((sunAlt - 6) / 9, 2));
      tint.copy(DAY).lerp(WARM, Math.min(1, warm * 1.1)).lerp(NIGHT, night);
      for (const c of clouds) for (const s of c.children) { s.material.color.copy(tint); s.material.opacity = s.material.userData.base * (1 - night * 0.45) * c.userData.fade; }
      // kölgə yalnız günəş varkən; alçaq günəşdə zəifləyir
      shMat.opacity = 0.2 * Math.max(0, Math.min(1, (sunAlt + 1) / 12)) * (1 - night);
      shadow.visible = shMat.opacity > 0.005;
    },
    setVisible(v) { group.visible = v; shadow.visible = v && shMat.opacity > 0.005; },
  };
}
