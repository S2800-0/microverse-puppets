// Geometry suggestions only: transparency cannot establish animal anatomy.
// Keep this module independent of the DOM so the analysis can be checked headlessly.
export function suggestRig({ width: w, height: h, data }) {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0 || !data || data.length !== w * h * 4) throw new Error('Invalid image pixels.');
  let x0 = w, x1 = -1, y0 = h, y1 = -1, opaque = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] <= 40) continue;
    opaque++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (!opaque) throw new Error('This image is empty.');
  if (opaque / (w * h) > .9) throw new Error('A transparent cutout is required. Remove the background first.');
  const config = { knee: (y0 + (y1 - y0) * .7) / h, hindMaxX: (x0 + (x1 - x0) * .52) / w, minX: 0, splitX: [], gait: 'walk' };
  return { config, bounds: { x0, x1, y0, y1 }, warnings: [
    'Suggestion assumes a right-facing quadruped. Check the cut and fore/hind division.',
    ...(x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1 ? ['The subject touches an image edge; check for clipped feet or tail.'] : []),
  ] };
}

export function assessRig(rig) {
  const warnings = [];
  if (!Array.isArray(rig?.legs)) return { status: 'Needs correction', warnings: ['Missing leg geometry.'] };
  if (rig.legs.some(l => !l || typeof l.hind !== 'boolean')) return { status: 'Needs correction', warnings: ['Invalid leg geometry.'] };
  const hind = rig.legs.filter(l => l.hind).length, fore = rig.legs.length - hind;
  if (hind !== 2 || fore !== 2) warnings.push(`Found ${hind} hind and ${fore} fore pieces. Check for merged legs, tail pieces, or hidden limbs.`);
  if (rig.legs.some(l => !Number.isFinite(l.length) || l.length <= 0 || l.length > .35)) warnings.push('Invalid or unusually long leg piece; check the body or tail cut.');
  if (rig.legs.some(l => !Array.isArray(l.pivot) || l.pivot.length !== 2 || !l.pivot.every(v => Number.isFinite(v) && v >= 0 && v <= 1))) warnings.push('Invalid pivot detected.');
  return { status: warnings.length ? 'Needs correction' : 'Ready for visual review', warnings };
}
