// Vice Cover Studio — wiring: state, controls, drag-to-pan, export, selftest.
//
// The preview canvas is redrawn from `state` on every change. Photos are
// read on the user's own machine and never uploaded anywhere.

import { drawCover, panelRects } from './cover.js';

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

export const state = {
  layout: 'strip',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Vice City • 2026',
  showJudgeNote: true,
  size: 'square',
  selected: 0,
  panels: [
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
  ],
};

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const panelBoxesEl = document.getElementById('panel-boxes');

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

export function placePhoto(index, img) {
  state.panels[index] = { img, zoom: 1, ox: 0, oy: 0 };
}

function setStatus(text) {
  statusEl.textContent = text;
}

// Preview backing size: the chosen export ratio, at most 880px wide —
// except in cover-shot mode, where the canvas fills the screenshot window.
function previewSize() {
  if (document.body.classList.contains('shot-cover')) {
    return [window.innerWidth, window.innerHeight];
  }
  const [w, h] = SIZES[state.size];
  const ratio = w / h;
  return ratio >= 1 ? [880, Math.round(880 / ratio)] : [Math.round(880 * ratio), 880];
}

export function redraw() {
  const [w, h] = previewSize();
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  drawCover(canvas, state);
}

export function setState(patch) {
  Object.assign(state, patch);
  syncControls();
  redraw();
}

// One box per panel: load a photo, zoom, pan. Built once; values synced
// on every state change so a slider drag never loses focus mid-drag.
function buildPanelBoxes() {
  state.panels.forEach((panel, i) => {
    const box = document.createElement('div');
    box.className = 'panel-box';
    box.dataset.panel = String(i);
    box.innerHTML = `
      <h3>Panel ${i + 1} <span class="photo-name">empty</span></h3>
      <button type="button" class="load-one">Load photo…</button>
      <input type="file" accept="image/*" hidden>
      <label>Zoom <input type="range" class="zoom" min="1" max="2.5" step="0.05" value="1"></label>
      <label>Pan left–right <input type="range" class="pan-x" min="-0.5" max="0.5" step="0.01" value="0"></label>
      <label>Pan up–down <input type="range" class="pan-y" min="-0.5" max="0.5" step="0.01" value="0"></label>`;
    box.addEventListener('click', () => {
      state.selected = i;
      syncControls();
      redraw();
    });
    const fileInput = box.querySelector('input[type="file"]');
    box.querySelector('.load-one').addEventListener('click', (event) => {
      event.stopPropagation();
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const img = await loadImage(URL.createObjectURL(file));
        placePhoto(i, img);
        setStatus(`Panel ${i + 1}: ${file.name}`);
        redraw();
        syncControls();
      } catch {
        setStatus(`Could not read ${file.name}.`);
      }
      fileInput.value = '';
    });
    box.querySelector('.zoom').addEventListener('input', (event) => {
      state.panels[i].zoom = Number(event.target.value);
      redraw();
    });
    box.querySelector('.pan-x').addEventListener('input', (event) => {
      state.panels[i].ox = Number(event.target.value);
      redraw();
    });
    box.querySelector('.pan-y').addEventListener('input', (event) => {
      state.panels[i].oy = Number(event.target.value);
      redraw();
    });
    panelBoxesEl.appendChild(box);
  });
}

function syncControls() {
  document.querySelectorAll('input[name="layout"]').forEach((radio) => {
    radio.checked = radio.value === state.layout;
  });
  document.querySelectorAll('input[name="grade"]').forEach((radio) => {
    radio.checked = radio.value === state.grade;
  });
  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.checked = radio.value === state.size;
  });
  document.getElementById('title-input').value = state.title;
  document.getElementById('subtitle-input').value = state.subtitle;
  document.getElementById('judge-note').checked = state.showJudgeNote;
  panelBoxesEl.querySelectorAll('.panel-box').forEach((box, i) => {
    const panel = state.panels[i];
    box.classList.toggle('selected', i === state.selected);
    box.querySelector('.photo-name').textContent = panel.img
      ? (panel.img.viceName ?? 'photo')
      : 'empty';
    box.querySelector('.zoom').value = String(panel.zoom);
    box.querySelector('.pan-x').value = String(panel.ox);
    box.querySelector('.pan-y').value = String(panel.oy);
  });
}

async function loadSample(name, target) {
  const img = await loadImage(`samples/${name}.jpg`);
  img.viceName = name;
  if (target === 'all') {
    state.panels.forEach((_, i) => placePhoto(i, img));
  } else {
    placePhoto(state.selected, img);
  }
  setStatus(`Sample "${name}" loaded.`);
  redraw();
  syncControls();
}

// Drag on the canvas pans the photo inside the panel under the pointer.
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  const bandTop = canvas.height * 0.78;
  const rects = panelRects(canvas.width, bandTop, state.layout);
  const index = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return { index, x, y };
}

function drawnSize(rect, panel) {
  const scale = Math.max(rect.w / panel.img.naturalWidth, rect.h / panel.img.naturalHeight) * panel.zoom;
  return { pw: panel.img.naturalWidth * scale, ph: panel.img.naturalHeight * scale };
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const { index } = panelAt(event.clientX, event.clientY);
  if (index < 0 || !state.panels[index].img) return;
  state.selected = index;
  syncControls();
  drag = { index, lastX: event.clientX, lastY: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const panel = state.panels[drag.index];
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const dx = (event.clientX - drag.lastX) * scale;
  const dy = (event.clientY - drag.lastY) * scale;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  const bandTop = canvas.height * 0.78;
  const rects = panelRects(canvas.width, bandTop, state.layout);
  const { pw, ph } = drawnSize(rects[drag.index], panel);
  if (pw > rects[drag.index].w) {
    panel.ox = Math.max(-0.5, Math.min(0.5, panel.ox + dx / (pw - rects[drag.index].w)));
  }
  if (ph > rects[drag.index].h) {
    panel.oy = Math.max(-0.5, Math.min(0.5, panel.oy + dy / (ph - rects[drag.index].h)));
  }
  redraw();
  syncControls();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

export function exportCover(sizeKey) {
  const key = sizeKey ?? state.size;
  const [w, h] = SIZES[key];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the browser could not make the PNG.');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vice-cover-${w}x${h}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    setStatus(`Exported vice-cover-${w}x${h}.png — share it!`);
  }, 'image/png');
}

function wireControls() {
  document.querySelectorAll('input[name="layout"]').forEach((radio) => {
    radio.addEventListener('change', () => setState({ layout: radio.value }));
  });
  document.querySelectorAll('input[name="grade"]').forEach((radio) => {
    radio.addEventListener('change', () => setState({ grade: radio.value }));
  });
  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.addEventListener('change', () => setState({ size: radio.value }));
  });
  document.getElementById('title-input').addEventListener('input', (event) => {
    state.title = event.target.value;
    redraw();
  });
  document.getElementById('subtitle-input').addEventListener('input', (event) => {
    state.subtitle = event.target.value;
    redraw();
  });
  document.getElementById('judge-note').addEventListener('change', (event) => {
    setState({ showJudgeNote: event.target.checked });
  });
  document.getElementById('sample-pier').addEventListener('click', () => {
    loadSample('pier', document.getElementById('fill-all').checked ? 'all' : 'one').catch(() => {
      setStatus('Could not load the pier sample.');
    });
  });
  document.getElementById('sample-boulevard').addEventListener('click', () => {
    loadSample('boulevard', document.getElementById('fill-all').checked ? 'all' : 'one').catch(() => {
      setStatus('Could not load the boulevard sample.');
    });
  });
  document.getElementById('photo-input').addEventListener('change', async (event) => {
    const files = [...(event.target.files ?? [])].slice(0, 3);
    let slot = state.panels.findIndex((p) => !p.img);
    if (slot < 0) slot = 0;
    for (const file of files) {
      try {
        const img = await loadImage(URL.createObjectURL(file));
        img.viceName = file.name;
        placePhoto(slot, img);
        slot = (slot + 1) % 3;
      } catch {
        setStatus(`Could not read ${file.name}.`);
      }
    }
    setStatus(`${files.length} photo${files.length === 1 ? '' : 's'} loaded — drag any panel to position it.`);
    redraw();
    syncControls();
    event.target.value = '';
  });
  document.getElementById('export-square').addEventListener('click', () => exportCover('square'));
  document.getElementById('export-portrait').addEventListener('click', () => exportCover('portrait'));
  document.getElementById('export-wide').addEventListener('click', () => exportCover('wide'));
}

// Self-test (?selftest=1): render all three export sizes offscreen and count
// the distinct colours in each, proving the covers are real art, not blank.
async function runSelftest() {
  const pier = await loadImage('samples/pier.jpg');
  const boulevard = await loadImage('samples/boulevard.jpg');
  placePhoto(0, pier);
  placePhoto(1, boulevard);
  placePhoto(2, pier);
  const parts = [];
  for (const [key, [w, h]] of Object.entries(SIZES)) {
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    drawCover(off, state);
    const ctx = off.getContext('2d');
    const data = ctx.getImageData(0, 0, w, h).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 53) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    parts.push(`${key} ${w}x${h} colors=${seen.size}`);
  }
  const line = `SELFTEST ${parts.join(' | ')}`;
  setStatus(line);
  document.title = line;
  window.__selftestDone = true;
}

buildPanelBoxes();
wireControls();
syncControls();
redraw();

const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  import('./shots.js').then((module) => {
    module.runShot(params.get('shot'), params, {
      state, setState, loadImage, placePhoto, redraw, canvas, SIZES,
    }).catch((error) => setStatus(`Shot failed: ${error.message}`));
  }).catch((error) => setStatus(`Shot failed: ${error.message}`));
} else if (params.has('selftest')) {
  runSelftest().catch((error) => setStatus(`Self-test failed: ${error.message}`));
}
