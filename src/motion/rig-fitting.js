import { buildRig } from './rig.js';
import { assessRig } from './rig-analysis.js';
import { prepareJointPieces } from './puppet-motion.js';

// Reuses the prototype's bounded cut/split search. No AI/provider requests.
export async function fitQuadruped({ source, config }, isCurrent = () => true) {
  let selected = { ...config, groundOnly: true, splitX: [...(config.splitX ?? [])] };
  let rig = await buildRig(source, selected);
  let report = assessRig(rig);
  const start = selected.kneeHind ?? selected.knee ?? .7;
  for (const delta of [.03, .06, .09, .12, .15]) {
    if (!isCurrent()) return null;
    if (!report.warnings.length) break;
    const cut = Math.min(.92, start + delta);
    const trial = { ...selected, kneeHind: cut, kneeFore: cut };
    const next = await buildRig(source, trial);
    const check = assessRig(next);
    if (!check.warnings.length) { selected = trial; rig = next; report = check; }
  }
  const merged = [true, false].flatMap(hind => {
    const pieces = rig.legs.filter(leg => leg.hind === hind);
    return pieces.length === 1 ? pieces : [];
  });
  for (const offset of [0, -.02, .02]) {
    if (!isCurrent()) return null;
    if (!report.warnings.length || !merged.length) break;
    const trial = { ...selected, splitX: [...selected.splitX, ...merged.map(leg => Math.max(.01, Math.min(.99, leg.x + offset)))] };
    const next = await buildRig(source, trial);
    const check = assessRig(next);
    if (!check.warnings.length) { selected = trial; rig = next; report = check; }
  }
  if (!isCurrent()) return null;
  return { valid: !report.warnings.length, warnings: report.warnings, config: selected,
    rig: report.warnings.length ? rig : prepareJointPieces(rig) };
}
