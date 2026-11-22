/**
 * FLIGHT CONTROL LAB — deterministic browser/Node numerical models.
 * Source of truth: uploaded MATLAB part1_autopilot.m and part2_guidance.m.
 * Radians internally; state vectors and time integration are independent of rendering.
 * All labels distinguish incremental body-down a_z from positive-up guidance a_perp.
 */
export const rad = Math.PI / 180;
export const deg = 180 / Math.PI;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const autopilotPhysics = Object.freeze({
  V0: 100, rho: 1.225, m: 42.48, Iyy: 12.87, Cref: 0.327,
  Sref: 0.9765, tauDelta: 0.015, deltaMax: 10 * rad,
  CZa: -5.88, CZd: -0.566, CMa: -0.45, CMd: -1.716, CMq: -27.51
});
export function plant(p = autopilotPhysics) {
  const qbar = .5 * p.rho * p.V0 ** 2;
  const Za = qbar * p.Sref * p.CZa;
  const Zd = qbar * p.Sref * p.CZd;
  const Ma = qbar * p.Sref * p.Cref * p.CMa;
  const Md = qbar * p.Sref * p.Cref * p.CMd;
  const Mq = qbar * p.Sref * p.Cref ** 2 * p.CMq / (2 * p.V0);
  const A = [[Za / (p.m * p.V0), 1, Zd / (p.m * p.V0)],
    [Ma / p.Iyy, Mq / p.Iyy, Md / p.Iyy], [0, 0, -1 / p.tauDelta]];
  const B = [0, 0, 1 / p.tauDelta];
  const C = [Za / p.m, 0, Zd / p.m];
  return { qbar, Za, Zd, Ma, Md, Mq, A, B, C, Co: [C, [0, 1, 0]] };
}

// Computed by pole placement / continuous-time LQE in the supplied MATLAB code.
// Keeping nominal gains fixed under tauDelta changes is an explicit robustness experiment.
export const controlDesign = Object.freeze({
  K: [-5.67842131, -0.35587421, 1.15828782],
  ki: -0.07683826,
  L: [[-0.10170966, 0.63636967],
      [-1.44366241, 182.04771800],
      [-0.00023360, -0.00322980]],
  nominalPoles: [-14, -20, -55, -70],
  sigmaAccel: .01, sigmaGyroRad: .03 * rad,
  processCovariance: [1e-6, 1e-2, 1e-7]
});

export const guidanceDefaults = Object.freeze({
  g: 9.81, vM: 50, vT: 30, N: 3, xM0: 0, hM0: 1000,
  xT0: 1000, hT0: 0, gamma0: 0, aLimit: 19.62,
  tauA: .15, hitRadius: 5, tMax: 100
});

const dot = (a,b) => a.reduce((sum,v,i) => sum + v * b[i], 0);
const addScaled = (a,b,h) => a.map((x,i) => x + h * b[i]);
function rk4(f,t,y,h) {
  const a=f(t,y), b=f(t+h/2,addScaled(y,a,h/2));
  const c=f(t+h/2,addScaled(y,b,h/2)), d=f(t+h,addScaled(y,c,h));
  return y.map((x,i) => x + (h/6)*(a[i]+2*b[i]+2*c[i]+d[i]));
}

function invert3(A) {
  const a=A.map((row,i)=>[...row,...[0,1,2].map(j=>+(i===j))]);
  for(let k=0;k<3;k++){
    let pivot=k;for(let j=k+1;j<3;j++) if(Math.abs(a[j][k])>Math.abs(a[pivot][k])) pivot=j;
    if(Math.abs(a[pivot][k])<1e-14) throw Error('Singular controller matrix');
    [a[k],a[pivot]]=[a[pivot],a[k]];
    const s=a[k][k];for(let j=0;j<6;j++) a[k][j]/=s;
    for(let i=0;i<3;i++) if(i!==k){const m=a[i][k];for(let j=0;j<6;j++) a[i][j]-=m*a[k][j]}
  }
  return a.map(row=>row.slice(3));
}
function prefilter(A,B,C,K){
  // Nr = -1/(C*(A-BK)^(-1)*B) ; only the defined state-feedback experiment.
  const closed=A.map((row,i)=>row.map((v,j)=>v-B[i]*K[j]));
  const inv=invert3(closed);
  const dc=dot(C,inv.map(row=>dot(row,B)));
  if(Math.abs(dc)<1e-12) throw Error('No valid DC prefilter');
  return -1/dc;
}

/** Modes: integral (MATLAB exact), state (theoretical full state), open (fixed input). */
export function simulateAutopilot(opts={}) {
  const {K,ki,L}=controlDesign;
  const mode=opts.mode??'integral';
  if(!['integral','state','open'].includes(mode)) throw Error('Unsupported controller mode');
  const p={...autopilotPhysics,tauDelta:opts.tauDelta??autopilotPhysics.tauDelta};
  if(!(p.tauDelta>0 && p.tauDelta<=.15)) throw Error('tauDelta must be in (0,0.15] s');
  const {A,B,C,Co}=plant(p);
  const r=opts.reference??1, d=opts.disturbance??0, dStart=opts.disturbanceStart??.5;
  const tMax=opts.tMax??1.5, dt=opts.dt??.001;
  if(!(dt>0 && dt<=.005 && tMax>0 && tMax<=12)) throw Error('Unsupported time step/horizon');
  if(!Number.isFinite(r) || !Number.isFinite(d)) throw Error('Invalid input');
  const Nr=mode==='state'?prefilter(A,B,C,K):0;
  const zero=[(opts.alpha0??0)*rad,(opts.q0??0)*rad,0,0,0,0,0,0];
  const getCommand=(s) => mode==='open'
    ?clamp((opts.manualDeflection??0)*rad,-p.deltaMax,p.deltaMax)
    :clamp(mode==='state'?-dot(K,s.slice(0,3))+Nr*r:-dot(K,s.slice(3,6))-ki*s[6],-p.deltaMax,p.deltaMax);
  const deriv=(t,s)=>{
    const known=getCommand(s);
    const applied=clamp(known+(t>=dStart?d:0),-p.deltaMax,p.deltaMax);
    const x=s.slice(0,3), xhat=s.slice(3,6);
    const y=Co.map(row=>dot(row,x));
    const yhat=Co.map(row=>dot(row,xhat));
    const xdot=A.map((row,i)=>dot(row,x)+B[i]*applied);
    // The observer sees the controller's known command, not applied disturbance.
    const estimate=A.map((row,i)=>dot(row,xhat)+B[i]*known+
      dot(L[i],y.map((v,j)=>v-yhat[j])));
    return [...xdot,...estimate,r-dot(C,x),s[1]];
  };
  const output=(t,s)=>({t,alpha:s[0],q:s[1],delta:s[2],theta:s[7],
    estimatedAlpha:s[3],estimatedQ:s[4],estimatedDelta:s[5],xi:s[6],
    az:dot(C,s.slice(0,3)),command:getCommand(s),reference:r,
    error:r-dot(C,s.slice(0,3))});
  let t=0,s=zero;
  const history=[output(t,s)];
  while(t<tMax-1e-12){
    const h=Math.min(dt,tMax-t);
    s=rk4(deriv,t,s,h);t+=h;
    if(!s.every(Number.isFinite)) throw Error('Autopilot integration diverged');
    history.push(output(t,s));
  }
  return {history,final:history.at(-1),physics:p,model:plant(p),mode,Nr};
}

/** Full MATLAB-style kinematics and guidance signals at arbitrary (t,state). */
export function guidanceSignals(t,s,p=guidanceDefaults) {
  const [xM,hM,gamma]=s;
  const rx=p.xT0+p.vT*t-xM, rh=p.hT0-hM;
  const R=Math.hypot(rx,rh);
  if(R<1e-8) return {rx,rh,R,lambda:0,lambdaDot:0,Vc:0,aPN:0,aCmd:0};
  const vrx=p.vT-p.vM*Math.cos(gamma), vrh=-p.vM*Math.sin(gamma);
  const lambda=Math.atan2(rh,rx), lambdaDot=(rx*vrh-rh*vrx)/(R*R);
  const Vc=-(rx*vrx+rh*vrh)/R;
  // The max(Vc,0) guard is exactly as coded in part2_guidance.m, line 211.
  const aPN=p.N*Math.max(Vc,0)*lambdaDot;
  const aCmd=clamp(aPN+p.g*Math.cos(gamma),-p.aLimit,p.aLimit);
  return {rx,rh,R,lambda,lambdaDot,Vc,aPN,aCmd};
}

export function simulateGuidance(input={}, lagged=false) {
  const p={...guidanceDefaults,...input};
  const dt=input.dt??.02;
  if(!(p.g>0 && p.vM>0 && p.vT>=0 && p.N>=0 && p.N<=10 &&
     p.aLimit>0 && p.tauA>0 && p.tMax>0 && p.tMax<=150 &&
     p.hitRadius>0 && dt>0 && dt<=.1)) throw Error('Guidance configuration invalid');
  let s=[p.xM0,p.hM0,p.gamma0];
  if(lagged) s.push(clamp(p.g*Math.cos(p.gamma0),-p.aLimit,p.aLimit));
  const deriv=(t,y)=>{
    const {aCmd}=guidanceSignals(t,y,p);
    const gamma=y[2],aActual=lagged?y[3]:aCmd;
    const out=[p.vM*Math.cos(gamma),p.vM*Math.sin(gamma),
      (aActual-p.g*Math.cos(gamma))/p.vM];
    if(lagged) out.push((aCmd-aActual)/p.tauA);
    return out;
  };
  const packet=(t,y)=>{
    const signals=guidanceSignals(t,y,p);
    return {t,xM:y[0],hM:y[1],gamma:y[2],xT:p.xT0+p.vT*t,hT:p.hT0,
      actual:lagged?y[3]:signals.aCmd,...signals};
  };
  let t=0;const history=[packet(t,s)];let hit=history[0].R<=p.hitRadius;
  const sampleEvery=Math.max(1,Math.round(.04/dt));let step=0;
  while(t<p.tMax-1e-12 && !hit){
    const h=Math.min(dt,p.tMax-t),next=rk4(deriv,t,s,h);
    if(!next.every(Number.isFinite)) throw Error('Guidance integration diverged');
    const range=guidanceSignals(t+h,next,p).R;
    if(range<=p.hitRadius){
      // Bisection of the terminal event, re-integrating over a partial RK4 step.
      let lo=0,hi=h;
      for(let j=0;j<38;j++){
        const mid=(lo+hi)/2;
        const yMid=rk4(deriv,t,s,mid);
        if(guidanceSignals(t+mid,yMid,p).R>p.hitRadius)lo=mid;
        else hi=mid;
      }
      s=rk4(deriv,t,s,hi);t+=hi;hit=true;
      history.push(packet(t,s));break;
    }
    s=next;t+=h;step++;
    if(step%sampleEvery===0 || t>=p.tMax-1e-12)history.push(packet(t,s));
  }
  if(!hit && history.at(-1).t<t-1e-10)history.push(packet(t,s));
  let peakCommand=0,peakActual=0;
  for(const v of history){peakCommand=Math.max(peakCommand,Math.abs(v.aCmd));
    peakActual=Math.max(peakActual,Math.abs(v.actual));}
  return {p,lagged,history,final:history.at(-1),hit,peakCommand,peakActual};
}

export const matlabReferences=Object.freeze({
  part1:{riseTime:.2050,settlingTime:.3936,finalAz:1,bandwidth:10.7412,
    gainMarginDb:11.2117,phaseMarginDeg:51.9373,delayMargin:.02651},
  guidance:{idealTime:61.899028,laggedTime:61.968170,hitRadius:5,
    idealPeak:9.385736,laggedPeak:9.81}
});

// Piecewise-linear metrics measured on actual numeric output, not animations.
export function stepMetrics(history,reference=1){
  const samples=history.map(v=>[v.t,v.az]);
  function crossing(target){for(let i=1;i<samples.length;i++){
    const [ta,ya]=samples[i-1], [tb,yb]=samples[i];
    if(ya<=target && yb>=target && yb!==ya)return ta+(target-ya)*(tb-ta)/(yb-ya);
  }return NaN;}
  const t10=crossing(.1*reference),t90=crossing(.9*reference);
  const tolerance=.02*Math.abs(reference);
  let lastOutside=0;
  for(let i=0;i<samples.length;i++)if(Math.abs(samples[i][1]-reference)>tolerance) lastOutside=i;
  const settling=lastOutside<samples.length-1?samples[lastOutside+1][0]:NaN;
  const peak=Math.max(...samples.map(([,v])=>v));
  return {riseTime:t90-t10,settlingTime:settling,
    overshoot:Math.max(0,100*(peak/reference-1)),finalAz:history.at(-1).az,
    peakDeflection:Math.max(...history.map(v=>Math.abs(v.delta)))*deg,
    peakCommand:Math.max(...history.map(v=>Math.abs(v.command)))*deg};
}
