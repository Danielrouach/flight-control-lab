import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLOSION_DURATION, explosionActive, drawExplosion} from '../src/visualization/explosion.js';
import {simulateGuidance} from '../src/simulation/core.js';

test('visual impact activates only at a confirmed simulated hit', () => {
  const hit = simulateGuidance({dt: .02}, true);
  assert.equal(hit.hit, true);
  assert.equal(explosionActive(hit.hit, hit.final.t, hit.final.t-.1, 0), false);
  assert.equal(explosionActive(hit.hit, hit.final.t, hit.final.t, 0), true);
  assert.equal(explosionActive(hit.hit, hit.final.t, hit.final.t, EXPLOSION_DURATION), true);
  assert.equal(explosionActive(hit.hit, hit.final.t, hit.final.t, EXPLOSION_DURATION+.1), false);
  assert.equal(explosionActive(false, hit.final.t, hit.final.t, .4), false);
  assert.equal(explosionActive(hit.hit, hit.final.t, hit.final.t, null), false);
});

test('visual draw has no effect when age is outside its playback interval', () => {
  let calls=0;
  const context={save(){calls++}};
  drawExplosion(context, 100, 50, -1);
  drawExplosion(context, 100, 50, EXPLOSION_DURATION+.01);
  assert.equal(calls, 0);
});

test('guidance results remain unchanged by importing visual effects', () => {
  const ideal=simulateGuidance({dt:.02},false);
  const lag=simulateGuidance({dt:.02},true);
  assert.ok(Math.abs(ideal.final.R-5)<1e-6);
  assert.ok(Math.abs(lag.final.R-5)<1e-6);
});

test('deterministic particle renderer accepts frames across impact lifespan', () => {
  const noOp=()=>{};
  const gradient={addColorStop:noOp};
  const ctx={
    save:noOp,restore:noOp,translate:noOp,
    createRadialGradient:()=>gradient,beginPath:noOp,arc:noOp,fill:noOp,stroke:noOp,
    moveTo:noOp,lineTo:noOp
  };
  for(const age of [0, .1, .3, .75, 1.3, 2.2, EXPLOSION_DURATION]) {
    assert.doesNotThrow(()=>drawExplosion(ctx, 400, 120, age, 420));
  }
});
