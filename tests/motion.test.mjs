import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footTarget, solveLimb, deformLimbPoint } from '../src/motion/puppet-motion.js';
import { getMotion, callMotionTool, buildSpritePrompt } from '../src/motion/motion-library.js';
import { suggestRig, assessRig } from '../src/motion/rig-analysis.js';
import { buildRig } from '../src/motion/rig.js';
import { cleanEdgePixels } from '../src/motion/sprite-edges.js';

test('stance feet counter travel and swing lifts without a cycle jump', () => {
  const preset = getMotion('dog');
  const a = footTarget(.1,preset), b = footTarget(.2,preset);
  assert(a.contact && b.contact); assert.equal(a.y,0);
  assert(Math.abs(b.x-a.x+preset.stride*.1/preset.duty)<1e-9);
  assert(footTarget(.85,preset).y<0);
  assert.deepEqual(footTarget(0,preset),footTarget(1,preset));
});

test('invalid gait geometry fails explicitly instead of producing NaN', () => {
  const preset=getMotion('dog');
  for (const change of [{duty:0},{duty:1},{stride:-1},{lift:NaN}])
    assert.throws(()=>footTarget(.5,{...preset,...change}),/Invalid gait/);
});

test('joint solver preserves both segment lengths at tiny and ordinary scales', () => {
  for(const scale of [1e-6,1,100]) for(const f of [{x:0,y:0},{x:3,y:12},{x:100,y:100}]) {
    const upper=9*scale, lower=7*scale;
    const s=solveLimb({x:0,y:0},{x:f.x*scale,y:f.y*scale},upper,lower);
    assert(Math.abs(Math.hypot(s.joint.x,s.joint.y)-upper)<scale*1e-5);
    assert(Math.abs(Math.hypot(s.foot.x-s.joint.x,s.foot.y-s.joint.y)-lower)<scale*1e-5);
  }
  assert.throws(()=>solveLimb({x:0,y:0},{x:1,y:1},0,2),/Invalid limb/);
});

test('mesh joins continuously at the inferred joint and follows the torso above the root', () => {
  const source={root:{x:10,y:20},joint:{x:12,y:40},foot:{x:14,y:60}};
  const target={root:{x:10,y:22},joint:{x:20,y:38},foot:{x:25,y:55}};
  const a=deformLimbPoint({x:12,y:40-1e-7},source,target);
  const b=deformLimbPoint({x:12,y:40+1e-7},source,target);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-5);
  assert.deepEqual(deformLimbPoint({x:9,y:15},source,target),{x:9,y:17});
  assert.deepEqual(deformLimbPoint(source.foot,source,target),target.foot);
});

test('motion tools only select known presets and reject extra commands', () => {
  assert.throws(()=>getMotion('__proto__'),/Unsupported/);
  assert.throws(()=>getMotion('dog','teleport'),/Unsupported/);
  assert.throws(()=>callMotionTool('run_code',{code:'x'}),/Unsupported/);
  assert.throws(()=>callMotionTool('select_motion',{profile:'dog',gait:'walk',code:'x'}),/Unsupported/);
  assert.equal(callMotionTool('select_motion',{profile:'dog',gait:'walk'}).profile,'dog');
  assert(getMotion('dog','trot').speed>getMotion('dog','walk').speed);
  assert.deepEqual(getMotion('penguin').sourceIds,[]);
});

test('sprite prompt preserves wearable details without requesting extra poses', () => {
  const prompt=buildSpritePrompt({profile:'cat',appearance:'orange tabby in sunglasses'});
  assert.match(prompt,/EXACTLY ONE/);assert.match(prompt,/sunglasses/);
  assert.match(prompt,/Preserve visible worn accessories/);
});

test('rig analysis rejects opaque, empty and malformed pixel buffers', () => {
  assert.throws(()=>suggestRig({width:4,height:4,data:new Uint8ClampedArray(64).fill(255)}),/transparent/);
  assert.throws(()=>suggestRig({width:4,height:4,data:new Uint8ClampedArray(64)}),/empty/);
  assert.throws(()=>suggestRig({width:4.5,height:4,data:[]}),/Invalid/);
});

test('review geometry refuses missing, merged, malformed and out-of-range limbs', () => {
  const leg=hind=>({hind,length:.15,pivot:[.5,.7]});
  const four=[leg(true),leg(true),leg(false),leg(false)];
  assert.equal(assessRig({legs:four}).warnings.length,0);
  for(const legs of [four.slice(1),[...four,leg(false)],[null],
    [{...four[0],pivot:[NaN,.7]},...four.slice(1)],
    [{...four[0],pivot:[2,.7]},...four.slice(1)],
    [{...four[0],length:-.1},...four.slice(1)]]) assert(assessRig({legs}).warnings.length>0);
  assert(assessRig({}).warnings.length>0);
});

test('invalid rig cuts reject before any browser image work', async () => {
  for(const config of [{knee:NaN},{knee:-.1},{knee:1},{splitX:[Infinity]}])
    await assert.rejects(()=>buildRig('unused',config),/Invalid rig/);
});

test('edge cleanup preserves alpha and opaque interior pigment', () => {
  const d=new Uint8ClampedArray([255,0,0,90,150,110,65,255,0,0,0,0]);
  cleanEdgePixels(d,3,1);
  assert.deepEqual([...d],[150,110,65,90,150,110,65,255,0,0,0,0]);
});
