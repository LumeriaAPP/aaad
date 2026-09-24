// Mənzil planını memarlıq çertyoju üslubunda SVG kimi çəkir
import { computeLayout, exteriorSides } from './layout.js';

const ROOM_FILL = {
  living: '#efe6d8',
  bedroom: '#e8e1f0',
  kids: '#e2edf3',
  kitchen: '#f3e7d6',
  bath: '#dcebea',
  hall: '#ece9e4',
  wardrobe: '#ebe4dc',
};

/**
 * plan: PLAN_TYPES elementi
 * opts.slot: (istəyə görə) mərtəbədəki yerləşmə — güzgü və fasadlar üçün
 * opts.compact: kiçik kartlar üçün (ölçü yazıları olmadan)
 */
export function planSVG(plan, opts = {}) {
  const slot = opts.slot || { mx: false, mz: false };
  const ext = opts.slot ? exteriorSides(slot, plan) : { front: true };
  const { segs, openings } = computeLayout(plan, ext);
  const W = plan.w, D = plan.d;
  // güzgü: mz olduqda fasad aşağıda görünür (şimal həmişə yuxarıda)
  const X = (x) => (slot.mx ? W - x : x);
  const Z = (z) => (slot.mz ? D - z : z);
  const pad = opts.compact ? 0.5 : 1.3;
  const vb = `${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}`;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="plan-svg" role="img" aria-label="${plan.title} planı">`);

  // otaqlar
  for (const r of plan.rooms_) {
    const x = Math.min(X(r.x), X(r.x + r.w)), z = Math.min(Z(r.z), Z(r.z + r.d));
    out.push(`<rect x="${x}" y="${z}" width="${r.w}" height="${r.d}" fill="${ROOM_FILL[r.kind] || '#eee'}" data-room="${r.id}"/>`);
  }

  // divarlar
  for (const s of segs) {
    if (s.part === 'header' || s.part === 'lintel') continue;
    if (s.part === 'sill') continue;
    const a = s.a, b = s.b;
    let x, y, w, h;
    if (s.axis === 'h') { x = Math.min(X(a), X(b)); w = b - a; y = Z(s.c) - s.t / 2; h = s.t; }
    else { y = Math.min(Z(a), Z(b)); h = b - a; x = X(s.c) - s.t / 2; w = s.t; }
    out.push(`<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" fill="#26221f"/>`);
  }

  // pəncərələr və qapılar
  for (const o of openings) {
    const L = o.b - o.a;
    if (o.type === 'window') {
      const t = o.t;
      if (o.axis === 'h') {
        const x = Math.min(X(o.a), X(o.b)), y = Z(o.c) - t / 2;
        out.push(`<rect x="${x}" y="${y}" width="${L}" height="${t}" fill="#fff" stroke="#26221f" stroke-width="0.03"/>`);
        out.push(`<line x1="${x}" y1="${Z(o.c)}" x2="${x + L}" y2="${Z(o.c)}" stroke="#4a90b8" stroke-width="0.05"/>`);
      } else {
        const y = Math.min(Z(o.a), Z(o.b)), x = X(o.c) - t / 2;
        out.push(`<rect x="${x}" y="${y}" width="${t}" height="${L}" fill="#fff" stroke="#26221f" stroke-width="0.03"/>`);
        out.push(`<line x1="${X(o.c)}" y1="${y}" x2="${X(o.c)}" y2="${y + L}" stroke="#4a90b8" stroke-width="0.05"/>`);
      }
    } else if (o.type === 'door') {
      // qapının açılma qövsü (hinge o.a tərəfdə, +normal istiqamətində)
      const r = L - 0.1;
      if (o.axis === 'h') {
        const hx = X(o.a + 0.05), hz = Z(o.c + o.t / 2);
        const dirZ = slot.mz ? -1 : 1, dirX = slot.mx ? -1 : 1;
        const leafEnd = [hx, hz + dirZ * r];
        const arcEnd = [hx + dirX * r, hz];
        const sweep = dirX * dirZ > 0 ? 0 : 1;
        out.push(`<line x1="${hx}" y1="${hz}" x2="${leafEnd[0]}" y2="${leafEnd[1]}" stroke="#26221f" stroke-width="0.04"/>`);
        out.push(`<path d="M ${leafEnd[0]} ${leafEnd[1]} A ${r} ${r} 0 0 ${sweep} ${arcEnd[0]} ${arcEnd[1]}" fill="none" stroke="#8a827a" stroke-width="0.025" stroke-dasharray="0.08 0.06"/>`);
      } else {
        const hx = X(o.c + o.t / 2), hz = Z(o.a + 0.05);
        const dirZ = slot.mz ? -1 : 1, dirX = slot.mx ? -1 : 1;
        const leafEnd = [hx + dirX * r, hz];
        const arcEnd = [hx, hz + dirZ * r];
        const sweep = dirX * dirZ > 0 ? 1 : 0;
        out.push(`<line x1="${hx}" y1="${hz}" x2="${leafEnd[0]}" y2="${leafEnd[1]}" stroke="#26221f" stroke-width="0.04"/>`);
        out.push(`<path d="M ${leafEnd[0]} ${leafEnd[1]} A ${r} ${r} 0 0 ${sweep} ${arcEnd[0]} ${arcEnd[1]}" fill="none" stroke="#8a827a" stroke-width="0.025" stroke-dasharray="0.08 0.06"/>`);
      }
      if (o.entry) {
        const cx = o.axis === 'h' ? X((o.a + o.b) / 2) : X(o.c);
        const cz = o.axis === 'h' ? Z(o.c) : Z((o.a + o.b) / 2);
        const dz = slot.mz ? -0.55 : 0.55;
        out.push(`<path d="M ${cx - 0.22} ${cz + dz} L ${cx} ${cz + dz * 0.45} L ${cx + 0.22} ${cz + dz}" fill="none" stroke="#c9a15c" stroke-width="0.07" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
  }

  // otaq adları və sahələr
  const fs = opts.compact ? 0.42 : 0.34;
  for (const r of plan.rooms_) {
    const cx = X(r.x + r.w / 2), cz = Z(r.z + r.d / 2);
    const area = (r.w * r.d).toFixed(1);
    const name = r.name.length > 16 && r.w < 5 ? r.name.split(' ')[0] : r.name;
    if (!opts.compact) {
      out.push(`<text x="${cx}" y="${cz - 0.08}" font-size="${fs}" text-anchor="middle" fill="#3a332c" font-family="Inter, sans-serif" font-weight="600">${name}</text>`);
      out.push(`<text x="${cx}" y="${cz + 0.42}" font-size="${fs * 0.95}" text-anchor="middle" fill="#8a7f72" font-family="Inter, sans-serif">${area} m²</text>`);
    } else {
      out.push(`<text x="${cx}" y="${cz + 0.15}" font-size="${fs}" text-anchor="middle" fill="#6b6259" font-family="Inter, sans-serif">${area}</text>`);
    }
  }

  // ölçü xətləri
  if (!opts.compact) {
    const dim = (x1, y1, x2, y2, label, vertical) => {
      out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9c9187" stroke-width="0.025"/>`);
      const tick = (x, y) => out.push(`<line x1="${x - 0.12}" y1="${y + 0.12}" x2="${x + 0.12}" y2="${y - 0.12}" stroke="#9c9187" stroke-width="0.04"/>`);
      tick(x1, y1); tick(x2, y2);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      out.push(vertical
        ? `<text x="${mx - 0.25}" y="${my}" font-size="0.3" fill="#8a7f72" text-anchor="middle" font-family="Inter, sans-serif" transform="rotate(-90 ${mx - 0.25} ${my})">${label}</text>`
        : `<text x="${mx}" y="${my - 0.18}" font-size="0.3" fill="#8a7f72" text-anchor="middle" font-family="Inter, sans-serif">${label}</text>`);
    };
    dim(0, -0.75, W, -0.75, `${W.toFixed(1)} m`, false);
    dim(-0.75, 0, -0.75, D, `${D.toFixed(1)} m`, true);
    // şimal oxu
    out.push(`<g transform="translate(${W + 0.75} ${-0.6})"><circle r="0.35" fill="none" stroke="#9c9187" stroke-width="0.03"/><path d="M0 -0.28 L0.12 0.12 L0 0.04 L-0.12 0.12Z" fill="#c9a15c"/><text y="0.62" font-size="0.26" text-anchor="middle" fill="#8a7f72" font-family="Inter, sans-serif">Şm</text></g>`);
  }

  out.push('</svg>');
  return out.join('');
}
