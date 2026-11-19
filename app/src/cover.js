// Vice Cover Studio — the cover drawing engine (pure canvas, no network).
//
// Everything the app draws is code: gradient sunset bands, a slatted retro
// sun, a skyline and palm silhouettes, bold stroked lettering. No Rockstar
// artwork, no external fonts — the machine's own bold sans only.
//
// A cover is: a white outer page, photo panels across the top 78%, and a
// title band across the bottom 22%.

export const GRADES = {
  sunset: {
    band: ['#ff9a3d', '#ff5e7a', '#7b2f8e'],
    sun: '#ffd166',
    wash: 'rgba(255,94,122,0.20)',
  },
  neon: {
    band: ['#00e5ff', '#7b2ff7', '#ff2fb3'],
    sun: '#00f5d4',
    wash: 'rgba(0,229,255,0.18)',
  },
  dusk: {
    band: ['#f7b733', '#fc4a1a', '#3d1a5c'],
    sun: '#ffe9a8',
    wash: 'rgba(252,74,26,0.20)',
  },
};

export const LAYOUTS = {
  strip: 'Sunset Strip',
  triptych: 'Triptych',
  duo: 'Neon Duo',
  solo: 'Solo',
};

const SILHOUETTE = '#160a24';
const JUDGE_LINE = 'MADE WITH CARE • WITH THANKS TO OUR JUDGE';

// Small deterministic RNG so the skyline is the same on every render.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Colour of the three-stop band gradient at t (0 = top, 1 = bottom).
function bandColorAt(stops, t) {
  const [a, b, c] = stops.map(hexToRgb);
  const mid = t < 0.5 ? [a, b, t / 0.5] : [b, c, (t - 0.5) / 0.5];
  const [from, to, f] = mid;
  const mix = from.map((v, i) => Math.round(v + (to[i] - v) * f));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

function gutter(w, h) {
  return Math.max(4, 0.006 * Math.min(w, h));
}

// Panel rectangles for a layout inside the photo area (0, 0, w, photoH).
export function panelRects(w, photoH, layout) {
  const g = gutter(w, photoH);
  if (layout === 'triptych') {
    const pw = (w - 2 * g) / 3;
    return [0, 1, 2].map((i) => ({ x: i * (pw + g), y: 0, w: pw, h: photoH }));
  }
  if (layout === 'duo') {
    const left = w * 0.55 - g / 2;
    return [
      { x: 0, y: 0, w: left, h: photoH },
      { x: left + g, y: 0, w: w - left - g, h: photoH },
    ];
  }
  if (layout === 'solo') {
    return [{ x: 0, y: 0, w, h: photoH }];
  }
  // strip: hero on the left (62%), two stacked panels on the right.
  const heroW = w * 0.62 - g / 2;
  const sideX = heroW + g;
  const sideW = w - sideX;
  const halfH = (photoH - g) / 2;
  return [
    { x: 0, y: 0, w: heroW, h: photoH },
    { x: sideX, y: 0, w: sideW, h: halfH },
    { x: sideX, y: halfH + g, w: sideW, h: halfH },
  ];
}

// Cover-fit a photo into a panel rect, with zoom and pan. Pan spans the
// WHOLE overflow: ox/oy of ±0.5 puts the photo flush to an edge.
export function drawPhotoPanel(ctx, rect, panel) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!panel || !panel.img) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#3a1c63');
    grad.addColorStop(1, '#1a0c33');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${Math.max(13, Math.round(Math.min(w, h) * 0.07))}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOUR PHOTO HERE', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  const img = panel.img;
  const zoom = panel.zoom ?? 1;
  const ox = panel.ox ?? 0;
  const oy = panel.oy ?? 0;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = x + (w - pw) / 2 + ox * (pw - w);
  const dy = y + (h - ph) / 2 + oy * (ph - h);
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

// The grade's translucent wash over one panel (unifies photos + grade).
export function gradeWash(ctx, rect, grade) {
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawSun(ctx, w, bandTop, bandH, grade) {
  const cx = w / 2;
  const cy = bandTop + 0.16 * bandH;
  const r = 0.22 * bandH;
  ctx.save();
  ctx.shadowColor = grade.sun;
  ctx.shadowBlur = r * 0.7;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Slats: three gaps across the sun's lower half, filled with the sky
  // colour at that height, so the sky shows through the disc.
  const slats = [0.08, 0.3, 0.55];
  for (const f of slats) {
    const sy = cy + r * f;
    const half = Math.sqrt(Math.max(0, r * r - (sy - cy) * (sy - cy)));
    const t = (sy - bandTop) / bandH;
    ctx.fillStyle = bandColorAt(grade.band, Math.min(1, Math.max(0, t)));
    ctx.fillRect(cx - half, sy, half * 2, Math.max(2, r * 0.09));
  }
}

export function drawSkyline(ctx, w, bandTop, bandH) {
  const rand = seededRandom(20261119);
  const base = bandTop + bandH;
  ctx.fillStyle = SILHOUETTE;
  let x = 0;
  while (x < w) {
    const bw = w * (0.03 + rand() * 0.05);
    const bh = bandH * (0.12 + rand() * 0.18);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rand() < 0.3) {
      const ax = x + bw / 2;
      ctx.fillRect(ax - 1, base - bh - bandH * 0.12, 2, bandH * 0.12);
      ctx.beginPath();
      ctx.arc(ax, base - bh - bandH * 0.13, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    x += bw + w * 0.004;
  }
}

export function drawPalm(ctx, x, baseY, height, lean) {
  ctx.save();
  ctx.strokeStyle = SILHOUETTE;
  ctx.fillStyle = SILHOUETTE;
  ctx.lineCap = 'round';
  // Trunk: a gentle curve leaning away from the centre.
  ctx.lineWidth = Math.max(3, height * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * height * 0.2, baseY - height * 0.6, x + lean * height * 0.3, baseY - height);
  ctx.stroke();
  const topX = x + lean * height * 0.3;
  const topY = baseY - height;
  // Seven fronds fanning out from the crown.
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = height * (0.42 + (i % 2) * 0.08);
    const fx = topX + Math.cos(angle) * len * (lean >= 0 ? 1 : -1) * -1;
    const fy = topY + Math.sin(angle) * len * 0.55;
    ctx.lineWidth = Math.max(2, height * 0.03);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (fx - topX) * 0.5, topY + (fy - topY) * 0.5 - height * 0.12, fx, fy);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTitleBand(ctx, w, bandTop, bandH, grade) {
  const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
  grad.addColorStop(0, grade.band[0]);
  grad.addColorStop(0.55, grade.band[1]);
  grad.addColorStop(1, grade.band[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, w, bandH);
  drawSun(ctx, w, bandTop, bandH, grade);
  drawSkyline(ctx, w, bandTop, bandH);
  const base = bandTop + bandH;
  drawPalm(ctx, w * 0.03, base, bandH * 0.72, -1);
  drawPalm(ctx, w * 0.11, base, bandH * 0.55, -1);
  drawPalm(ctx, w * 0.89, base, bandH * 0.55, 1);
  drawPalm(ctx, w * 0.97, base, bandH * 0.72, 1);
}

export function drawTitleText(ctx, w, bandTop, bandH, title, subtitle, showJudgeNote) {
  const cx = w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Title: bold caps, auto-shrunk to 92% of the width.
  const text = (title || 'UNTITLED').toUpperCase();
  let size = Math.min(0.44 * bandH, 0.11 * w);
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > w * 0.92) {
    size *= 0.92;
    ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  }
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size / 10;
  ctx.shadowOffsetY = size / 22;
  ctx.lineWidth = Math.max(2, size / 12);
  ctx.strokeStyle = 'rgba(22,10,36,0.9)';
  ctx.strokeText(text, cx, bandTop + 0.6 * bandH);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, bandTop + 0.6 * bandH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Subtitle: letterspaced caps in warm gold.
  if (subtitle) {
    ctx.font = `bold ${Math.max(11, 0.09 * bandH)}px Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, 0.012 * w)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(subtitle.toUpperCase(), cx, bandTop + 0.86 * bandH);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  // Judge microline, bottom of the band.
  if (showJudgeNote) {
    ctx.font = `${Math.max(9, 0.055 * bandH)}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(JUDGE_LINE, cx, bandTop + 0.96 * bandH);
  }
  ctx.restore();
}

// Paint a whole cover onto a canvas of any size.
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const bandH = h * 0.22;
  const bandTop = h - bandH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(w, bandTop, state.layout);
  rects.forEach((rect, i) => {
    drawPhotoPanel(ctx, rect, state.panels[i]);
    gradeWash(ctx, rect, grade);
  });
  drawTitleBand(ctx, w, bandTop, bandH, grade);
  drawTitleText(ctx, w, bandTop, bandH, state.title, state.subtitle, state.showJudgeNote);
}
