import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRigReview } from '../src/motion/rig-review.js';

test('geometry readiness requires explicit acceptance before articulated use', async () => {
  const review=createRigReview({fit:async()=>({valid:true,rig:{}})});
  assert.throws(()=>review.accept(),/reviewed first/);
  await review.prepare({profile:'dog'});
  assert.equal(review.getState().status,'review');
  assert.equal(review.getState().approved,false);
  assert.equal(review.accept().approved,true);
  review.requestReview();assert.equal(review.getState().approved,false);
  assert.equal(review.getState().status,'review');
  review.reset();assert.equal(review.getState().candidate,null);
  assert.throws(()=>review.accept(),/reviewed first/);
});

test('editing to a new candidate clears previous approval immediately', async () => {
  let finish;
  const review=createRigReview({fit:async input=>input.delay?new Promise(r=>{finish=r;}):({valid:true})});
  await review.prepare({profile:'cat'});review.accept();
  const pending=review.prepare({profile:'cat',delay:true});
  assert.equal(review.getState().approved,false);
  assert.equal(review.getState().candidate,null);
  finish({valid:true});await pending;
  assert.equal(review.getState().status,'review');
});

test('a stale async fit cannot replace a newer reviewed candidate', async () => {
  let finish;
  const review=createRigReview({fit:input=>input.id===1?new Promise(r=>{finish=r;}):Promise.resolve({valid:true,id:2})});
  const old=review.prepare({profile:'dog',id:1});
  await review.prepare({profile:'dog',id:2});
  finish({valid:true,id:1});await old;
  assert.equal(review.getState().candidate.id,2);
});

test('fallback invalidates in-flight fitting and never claims articulated motion', async () => {
  let finish;
  const review=createRigReview({fit:()=>new Promise(r=>{finish=r;})});
  const pending=review.prepare({profile:'dog'});
  review.useFallback();finish({valid:true});await pending;
  assert.equal(review.getState().status,'fallback');
  assert.equal(review.getState().approved,true);
  assert.equal(review.getState().candidate,null);
});

test('unsupported rig families use fallback without invoking a quadruped fitter', async () => {
  let calls=0;const review=createRigReview({fit:async()=>{calls++;return {valid:true};}});
  await review.prepare({profile:'penguin'});
  assert.equal(calls,0);assert.equal(review.getState().status,'fallback');
  assert.equal(review.getState().approved,false);
});

test('fitting failures remain recoverable without accidental approval', async () => {
  const review=createRigReview({fit:async()=>{throw new Error('Opaque source');}});
  await review.prepare({profile:'cat'});
  assert.equal(review.getState().status,'fallback');
  assert.match(review.getState().reason,/Opaque/);
  assert.equal(review.getState().approved,false);
  assert.equal(review.useFallback().approved,true);
});
