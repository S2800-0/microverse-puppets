import {cleanCanvasEdges} from "./sprite-edges.js";
// Puppet rig built from a sprite's transparency.
// Below a "knee line", each leg is a separate opaque region; we label those regions,
// lift each one out into its own canvas, and give it a pivot at the top of the leg.
// The body keeps everything above the knee line, so thighs never detach.

const ALPHA = 40; // pixels more opaque than this count as the animal

export async function buildRig(src, { knee = .7, kneeHind = knee, kneeFore = knee, hindMaxX = 0.6, minX = 0, splitX = [], groundOnly = false, minArea = 0.0008, band = 0.035 } = {}) {
  if (![kneeHind,kneeFore,hindMaxX,minX,minArea,band].every(Number.isFinite) || kneeHind<=0 || kneeHind>=1 || kneeFore<=0 || kneeFore>=1 || hindMaxX<=0 || hindMaxX>=1 || minX<0 || minX>=1 || minArea<=0 || minArea>=1 || band<0 || band>.2 || !Array.isArray(splitX) || splitX.some(v=>!Number.isFinite(v)||v<=0||v>=1)) throw new Error('Invalid rig cuts.');
  const img = await loadImage(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (W*H > 4_194_304) throw new Error('Resize the cutout to at most four megapixels before rigging.');
  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  const ctx = base.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  cleanCanvasEdges(base);
  const data = ctx.getImageData(0, 0, W, H);
  const a = (x, y) => data.data[(y * W + x) * 4 + 3];
  // thin vertical cuts separate legs that touch below the knee line (e.g. crossing hind legs)
  const cuts = new Set(splitX.map(f => Math.round(f * W)));

  // 1. connected-component labelling of opaque pixels below the knee line (hind and fore can differ)
  const kneeAt = (x) => Math.round((x / W < hindMaxX ? kneeHind : kneeFore) * H);
  const y0 = Math.min(kneeAt(0), kneeAt(W - 1));
  const below = (x, y) => y >= kneeAt(x);
  const label = new Int32Array(W * H);
  const comps = [];
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
    if (label[y * W + x] || a(x, y) <= ALPHA || !below(x, y)) continue;
    const id = comps.length + 1, stack = [[x, y]];
    const c = { id, pixels: [], x0: x, x1: x, y0: y, y1: y };
    label[y * W + x] = id;
    while (stack.length) {
      const [px, py] = stack.pop();
      c.pixels.push(py * W + px);
      c.x0 = Math.min(c.x0, px); c.x1 = Math.max(c.x1, px); c.y1 = Math.max(c.y1, py);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= W || ny < y0 || ny >= H || !below(nx, ny)) continue;
        const k = ny * W + nx;
        if (cuts.has(nx) && dx !== 0) continue;
        if (!label[k] && a(nx, ny) > ALPHA) { label[k] = id; stack.push([nx, ny]); }
      }
    }
    comps.push(c);
  }

  // 2. keep leg-sized regions (stray fur tufts are dropped and stay in the body)
  // imports: a leg must reach the ground line, so a tail hanging below the knee cut is not a leg
  const ground = comps.reduce((bottom,c)=>Math.max(bottom,c.y1),0);
  const legs = comps
    .filter(c => c.pixels.length > minArea * W * H && c.y1 - c.y0 > 0.05 * H && (c.x0 + c.x1) / 2 / W > minX && (!groundOnly || c.y1 > ground - 0.06 * H))
    .sort((p, q) => p.x0 - q.x0);

  // 3. body = original minus the leg pixels
  const bodyData = ctx.createImageData(W, H);
  bodyData.data.set(data.data);
  const legPieces = legs.map((c, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const lc = canvas.getContext("2d");
    const ld = lc.createImageData(W, H);
    for (const k of c.pixels) {
      for (let j = 0; j < 4; j++) ld.data[k * 4 + j] = data.data[k * 4 + j];
      bodyData.data[k * 4 + 3] = 0;
    }
    // a strip of the thigh above the knee line, under the body, so no gap opens when the leg swings
    const ky = kneeAt(c.x0), by0 = Math.max(0, ky - Math.round(band * H));
    for (let y = by0; y < ky; y++) for (let x = c.x0; x <= c.x1; x++) {
      const k = y * W + x;
      if (a(x, y) <= ALPHA) continue;
      for (let j = 0; j < 4; j++) ld.data[k * 4 + j] = data.data[k * 4 + j];
    }
    lc.putImageData(ld, 0, 0);
    // pivot: middle of the leg where it meets the knee line
    let sx = 0, n = 0;
    for (let x = c.x0; x <= c.x1; x++) if (a(x, ky) > ALPHA) { sx += x; n++; }
    const pivot = [(n ? sx / n : (c.x0 + c.x1) / 2) / W, ky / H];
    const cx = (c.x0 + c.x1) / 2 / W;
    return { canvas, pivot, hind: cx < hindMaxX, length: (c.y1 - ky) / H, x: cx };
  });
  // near/far: within each pair, the leg further from the body's centre reads as the near one
  for (const hind of [true, false]) {
    const pair = legPieces.filter(l => l.hind === hind);
    pair.forEach((l, i) => { l.side = i === 0 ? (hind ? "near" : "far") : (hind ? "far" : "near"); });
  }
  const body = document.createElement("canvas");
  body.width = W; body.height = H;
  body.getContext("2d").putImageData(bodyData, 0, 0);
  return { W, H, body, legs: legPieces };
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// ---------- gaits (footfall phases from quadruped gait studies) ----------
// walk: lateral sequence, duty factor ~0.65 (LH, LF, RH, RF a quarter-cycle apart)
// trot: diagonal pairs move together, duty ~0.5
// gallop: hind pair then fore pair, short contact and an airborne phase
export const GAITS = {
  walk:   { duty: 0.65, swing: 16, lift: 0.012, phase: { hindNear: 0, foreNear: 0.25, hindFar: 0.5, foreFar: 0.75 } },
  trot:   { duty: 0.5,  swing: 20, lift: 0.018, phase: { foreNear: 0, hindFar: 0, foreFar: 0.5, hindNear: 0.5 } },
  gallop: { duty: 0.32, swing: 26, lift: 0.02,  phase: { hindNear: 0, hindFar: 0.1, foreNear: 0.5, foreFar: 0.6 } },
};

// one leg through one cycle: stance sweeps the foot back slowly, swing lifts and brings it forward quickly
export function legPose(p, gait) {
  const { duty, swing, lift } = gait;
  p = ((p % 1) + 1) % 1;
  if (p < duty) return { angle: swing / 2 - swing * (p / duty), lift: 0 };
  const t = (p - duty) / (1 - duty), e = t * t * (3 - 2 * t);
  return { angle: -swing / 2 + swing * e, lift: Math.sin(Math.PI * t) * lift };
}
