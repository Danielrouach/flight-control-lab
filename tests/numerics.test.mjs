import test from 'node:test';
import assert from 'node:assert/strict';
import {plant,autopilotPhysics,controlDesign,simulateAutopilot,simulateGuidance,
  guidanceSignals,matlabReferences,stepMetrics,rad,deg} from '../src/simulation/core.js';
const close=(got,expected,err,label='number')=>assert.ok(Math.abs(got-expected)<err,`${label}: ${got} != ${expected} (tol ${err})`);

test('aerodynamic derivatives match MATLAB source',()=>{
 const p=plant();close(p.qbar,6125,1e-10,'qbar');close(p.Za,-35168.6475,1e-8,'Za');
 close(p.Zd,-3385.281375,1e-8,'Zd');close(p.Ma,-880.113346875,1e-8,'Ma');
 close(p.Md,-3356.16556275,1e-8,'Md');close(p.Mq,-87.9699693602,1e-7,'Mq');
});
test('augmented plant is strictly proper; A, B, C agree with report',()=>{
 const p=plant();close(p.A[0][0],-8.2789,1e-4);close(p.A[0][1],1,1e-12);
 close(p.A[1][2],-260.7743,1e-4);close(p.B[2],1/.015,1e-10);
 close(p.C[0],-827.8872,1e-3);close(p.C[2],-79.6912,1e-3);
 assert.deepEqual(p.Co[1],[0,1,0]);assert.equal(p.B[0],0);
});
test('controller gains are the corrected +q gain set',()=>{
 close(controlDesign.K[0],-5.67842131,1e-10);close(controlDesign.ki,-.07683826,1e-10);
 close(controlDesign.L[1][1],182.047718,1e-8);
 close(controlDesign.sigmaGyroRad,.03*Math.PI/180,1e-14);
});
test('zero initial perturbation is equilibrium at zero reference',()=>{
 const v=simulateAutopilot({reference:0,tMax:.5});
 close(v.final.az,0,1e-12);close(v.final.delta,0,1e-12);
 close(v.final.q,0,1e-12);close(v.final.xi,0,1e-12);
});
test('MATLAB integral observer + step response matches numerics',()=>{
 const run=simulateAutopilot({dt:.0005});const m=stepMetrics(run.history);const ref=matlabReferences.part1;
 close(m.riseTime,ref.riseTime,.002,'rise');close(m.settlingTime,ref.settlingTime,.004,'settling');
 close(run.final.az,1,1e-5,'steady tracking');
 assert.ok(m.peakDeflection<10 && m.peakCommand<10);assert.ok(m.overshoot<.01);
});
test('saturation applies to both controller command and actual plant input',()=>{
 const v=simulateAutopilot({reference:2,disturbance:.005});
 assert.ok(v.history.every(p=>Math.abs(p.command)<=10*rad+1e-12));
});
test('disturbance is asymptotically rejected and independent of observer known input',()=>{
 const v=simulateAutopilot({reference:0,disturbance:.005,tMax:2.2});
 const peak=Math.max(...v.history.map(p=>Math.abs(p.az)));
 assert.ok(peak>.1,'disturbance must excite system');
 assert.ok(Math.abs(v.final.az)<.001,'integral feedback should reject steady disturbance');
});
test('plant open-loop and ideal full-state experiments are deterministic',()=>{
 const a=simulateAutopilot({mode:'open',manualDeflection:.1}),b=simulateAutopilot({mode:'open',manualDeflection:.1});
 assert.deepEqual(a.history,b.history);assert.ok(Math.abs(a.final.az)>0.1);
 const s=simulateAutopilot({mode:'state'});assert.ok(Number.isFinite(s.Nr)&&s.Nr>0);
});
test('guidance initial geometry and gravity compensation are correct',()=>{
 const s=[0,1000,0],sig=guidanceSignals(0,s);
 close(sig.R,Math.sqrt(2)*1000,1e-9);close(sig.lambda,-Math.PI/4,1e-12);
 close(sig.Vc,20/Math.sqrt(2),1e-12);assert.ok(sig.aCmd<9.81);
});
test('ideal PN intercept stops at 5m with MATLAB event time',()=>{
 const result=simulateGuidance({dt:.01},false),ref=matlabReferences.guidance;
 assert.equal(result.hit,true);close(result.final.t,ref.idealTime,.0005);
 close(result.final.R,ref.hitRadius,1e-7);close(result.peakActual,ref.idealPeak,.002);
});
test('lagged PN intercept starts at trim and stops at 5m',()=>{
 const result=simulateGuidance({dt:.01},true),ref=matlabReferences.guidance;
 assert.equal(result.hit,true);close(result.history[0].actual,9.81,1e-12);
 close(result.final.t,ref.laggedTime,.0005);close(result.final.R,ref.hitRadius,1e-7);
 close(result.peakActual,9.81,1e-9);
});
test('acceleration command and actual values stay within ±2g bounds',()=>{
 for(const lag of [false,true]){
  const r=simulateGuidance({N:4.4,vM:60,vT:20,dt:.02},lag);
  assert.ok(r.history.every(p=>Math.abs(p.aCmd)<=19.62+1e-10));
  assert.ok(r.history.every(p=>Math.abs(p.actual)<=19.62+1e-7));
 }
});
test('unreachable target reports NO HIT rather than fabricating interception',()=>{
 const r=simulateGuidance({vM:40,vT:50,tMax:8},true);
 assert.equal(r.hit,false);close(r.final.t,8,1e-8);assert.ok(r.final.R>5);
});
test('invalid parameters are rejected',()=>{
 assert.throws(()=>simulateAutopilot({tauDelta:0}));
 assert.throws(()=>simulateAutopilot({dt:1}));
 assert.throws(()=>simulateGuidance({tauA:0},true));
 assert.throws(()=>simulateGuidance({N:-1},false));
});
