// Vice Cover Studio — screenshot scenes (?shot=...).
//
// Each shot sets the app up from the URL query, loads the kit samples, and
// signals window.__shotReady once the cover is drawn, so a headless
// screenshot catches the finished frame, not a blank canvas.

export async function runShot(shot, query, app) {
  const { state, setState, loadImage, placePhoto, redraw } = app;
  const photo = query.get('photo') ?? 'boulevard';
  const other = photo === 'pier' ? 'boulevard' : 'pier';
  const title = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'Vice City • 2026';
  const layout = query.get('layout') ?? 'strip';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? 'wide';

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
  }
  // Check the matching radios so the editor shot shows the chosen options.
  document.querySelectorAll('input[name="layout"]').forEach((radio) => {
    radio.checked = radio.value === layout;
  });
  document.querySelectorAll('input[name="grade"]').forEach((radio) => {
    radio.checked = radio.value === grade;
  });
  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.checked = radio.value === size;
  });

  const mainPhoto = await loadImage(`samples/${photo}.jpg`);
  mainPhoto.viceName = photo;
  const otherPhoto = await loadImage(`samples/${other}.jpg`);
  otherPhoto.viceName = other;
  // Photo in panel 0, the other sample in panel 1, photo again in panel 2.
  placePhoto(0, mainPhoto);
  placePhoto(1, otherPhoto);
  placePhoto(2, mainPhoto);
  if (layout === 'strip') {
    // Wide and short panels crop faces by default; these offsets reveal
    // the top of each photo, where the faces are.
    state.panels[0].oy = 0.45;
    state.panels[1].oy = 0.42;
    state.panels[2].oy = 0.45;
  }
  setState({
    layout,
    grade,
    title,
    subtitle,
    showJudgeNote: true,
    size,
  });
  document.getElementById('status').textContent = `Shot ready: ${title} (${layout}, ${grade}).`;
  redraw();
  // Two animation frames: the cover is painted before the shot is taken.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
