# Microverse Puppets

Browser-local cutout fitting and continuous textured limb deformation, with explicit movement review. Supply a transparent, right-facing dog/cat-style quadruped. The toolkit does not generate missing anatomy or measure real animal locomotion.

## Run the examples

Node.js 24 or newer:

```sh
git clone https://github.com/S2800-0/microverse-puppets.git
cd microverse-puppets
npm test
npm run demo
npm run demo:browser
```

Open the local URL printed by the final command. The browser demo creates a synthetic cutout, or lets you choose a transparent PNG locally. It offers movement review and whole-image fallback. Nothing is uploaded and no model key is used. The repository has no runtime package dependencies.

## Browser API

After `npm run build`:

```js
import {fitQuadruped, createRigReview} from './dist/index.js';
const review = createRigReview({fit: fitQuadruped, onChange: console.log});
await review.prepare({
  source: pngDataUrl, profile: 'dog',
  config: {knee: .7, hindMaxX: .55}
});
// Render and inspect the candidate before calling review.accept().
// Choose review.useFallback() if articulation is poor.
```

`buildRig`, fitting and drawing require browser Canvas/Image APIs. Numerical helpers and review-state tests run in Node. A four-piece result is only geometry readiness: sample the actual gait, check seams/accessories and reject it when necessary. Hopper/biped families use whole-image fallback in this fitting workflow. Gait values are artistic design presets, not measured species speeds. Upstream quadruped/IK ideas are linked in motion-library.js; no external motion-capture data or images are bundled.

No npm registry package has been published; use this repository’s source/build. The browser demo is local only.

## Source and licence

MIT for this project code. See LICENSE, NOTICE.md and SOURCE_MANIFEST.json. Extracted from the Microverse project, including previously disclosed pre-event prototype work and later refinements. No generated art, photos, model weights, credentials or third-party provider adapters are included. This is a reusable prototype, not a claim of external adoption.

Use feature branches and pull requests for subsequent changes. Run npm test before proposing a change.
