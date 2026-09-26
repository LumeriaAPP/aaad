// Barmaqla seçim: kameranın görüntüsündə əli tapır (MediaPipe Hand Landmarker, telefonda işləyir).
// Qaytarır: şəhadət barmağının ucu (ekran koordinatları 0..1) və "çimdik" (baş + şəhadət barmağı birləşib).
let landmarker = null, loading = null;

export function loadHandTracker() {
  if (loading) return loading;
  loading = (async () => {
    const { FilesetResolver, HandLandmarker } = await import('../vendor/mediapipe/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm', import.meta.url).href);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: new URL('../vendor/mediapipe/hand_landmarker.task', import.meta.url).href, delegate },
      runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { landmarker = await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch (e) { landmarker = await HandLandmarker.createFromOptions(files, opts('CPU')); }
    return landmarker;
  })();
  return loading;
}

let lastTs = 0;
/** image: ImageData (kamera görüntüsü, yuxarı-sol mənşəli). Nəticə: { x, y, pinch } və ya null */
export function detectHand(image) {
  if (!landmarker) return null;
  const ts = Math.max(performance.now(), lastTs + 1);
  lastTs = ts;
  const r = landmarker.detectForVideo(image, ts);
  const lm = r && r.landmarks && r.landmarks[0];
  if (!lm) return null;
  const tip = lm[8], thumb = lm[4], wrist = lm[0], mid = lm[9];
  const aspect = image.width / image.height;
  // əlin ölçüsünə nisbətən məsafə (yaxın/uzaq əl üçün eyni hiss olsun)
  const handSize = Math.hypot((mid.x - wrist.x) * aspect, mid.y - wrist.y) || 0.1;
  const pinch = Math.hypot((tip.x - thumb.x) * aspect, tip.y - thumb.y) / handSize < 0.32;
  return { x: tip.x, y: tip.y, pinch };
}
