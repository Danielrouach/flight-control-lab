import {rad,deg,simulateAutopilot,simulateGuidance,matlabReferences,stepMetrics} from './src/simulation/core.js';
import {drawPlot} from './src/charts/plot.js';
import {drawAirframe,drawGuidance} from './src/visualization/airframe.js';

const $=(id)=>document.getElementById(id);
const state={page:'autopilot',play:false,t:0,speed:1,lastStamp:0,lastCharts:0,
  camera:{yaw:-.35,elevation:.35},ap:null,ideal:null,lagged:null,apOptions:{},gOptions:{}};
const safe=(value,digits=3)=>`${value>=0?'+':''}${value.toFixed(digits)}`;
function setText(id,text){$(id).textContent=text;}
function selectedNumber(id){return Number($(id).value);}
function currentApOptions(){return {mode:$('apMode').value,reference:selectedNumber('apReference'),
  tauDelta:selectedNumber('apTau')/1000,alpha0:selectedNumber('apAlpha'),q0:selectedNumber('apQ'),
  disturbance:selectedNumber('apDisturbance'),manualDeflection:selectedNumber('apManual'),dt:.001,tMax:1.5};}
function currentGOptions(){return {N:selectedNumber('gN'),tauA:selectedNumber('gTau')/1000,
  hM0:selectedNumber('gAltitude'),xT0:selectedNumber('gTargetX'),
  vM:selectedNumber('gVM'),vT:selectedNumber('gVT'),dt:.02,tMax:100};}
function showRanges(){
  setText('apReferenceValue',safe(selectedNumber('apReference'),2)+' m/s²');
  setText('apManualValue',safe(selectedNumber('apManual'),2)+'°');
  setText('apTauValue',selectedNumber('apTau')+' ms');
  setText('apDisturbanceValue',selectedNumber('apDisturbance').toFixed(3)+' rad');
  const mode=$('apMode').value;
  $('manualControl').classList.toggle('hidden',mode!=='open');
  $('referenceControl').classList.toggle('hidden',mode==='open');
  setText('gNValue',selectedNumber('gN').toFixed(1));
  setText('gTauValue',selectedNumber('gTau')+' ms');
  setText('gAltitudeValue',selectedNumber('gAltitude').toLocaleString('en-US')+' m');
  setText('gTargetXValue',selectedNumber('gTargetX').toLocaleString('en-US')+' m');
}
function simulateAp(){showRanges();state.apOptions=currentApOptions();state.ap=simulateAutopilot(state.apOptions);resetTime();}
function simulateG(){showRanges();state.gOptions=currentGOptions();state.ideal=simulateGuidance(state.gOptions,false);state.lagged=simulateGuidance(state.gOptions,true);resetTime();
 setText('statIdealTime',state.ideal.hit?state.ideal.final.t.toFixed(3):'NO HIT');
 setText('statLagTime',state.lagged.hit?state.lagged.final.t.toFixed(3):'NO HIT');}
function resetTime(){state.t=0;state.play=false;updatePlayLabels();refresh(true);}
function updatePlayLabels(){
 $('apPlay').innerHTML=state.play&&state.page==='autopilot'?'Ⅱ PAUSE SIMULATION':'<span>▶</span> RUN SIMULATION';
 $('gPlay').innerHTML=state.play&&state.page==='guidance'?'Ⅱ PAUSE SIMULATION':'<span>▶</span> RUN INTERCEPTION';
}
function endTime(){return state.page==='autopilot'?state.ap?.final.t||1.5:
  state.page==='guidance'?Math.max(state.ideal?.final.t||0,state.lagged?.final.t||0):0;}
function togglePlay(){const end=endTime();if(state.t>=end-1e-8)state.t=0;state.play=!state.play;updatePlayLabels();}
function interpolation(items,t){
 if(!items.length)return null;
 if(t<=items[0].t)return items[0];if(t>=items.at(-1).t)return items.at(-1);
 let low=0,hi=items.length-1;while(low<hi){const mid=(low+hi)>>1;if(items[mid].t<t)low=mid+1;else hi=mid;}
 const b=items[low],a=items[low-1],factor=(t-a.t)/(b.t-a.t);
 const out={};for(const key of Object.keys(a))out[key]=typeof a[key]==='number'?a[key]+factor*(b[key]-a[key]):a[key];
 return out;
}
function drawAp(){if(!state.ap)return;const item=interpolation(state.ap.history,state.t);
 setText('scenePitch','θ '+safe(item.theta*deg,3)+'°');
 setText('sceneAlpha','α '+safe(item.alpha*deg,3)+'° · q '+safe(item.q*deg,3)+'°/s');
 setText('statApRef',safe(item.reference));setText('statApAz',safe(item.az));
 setText('statApError',safe(item.error));setText('statApDelta',safe(item.delta*deg));
 setText('apTime','T+ '+state.t.toFixed(3)+' s');
 $('apScrub').value=1000*state.t/state.ap.final.t;
 drawAirframe($('airframeCanvas'),item,state.camera);
}
function drawG(){if(!state.ideal)return;const point=interpolation(state.lagged.history,state.t);
 setText('sceneRange',point.R.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+' m');
 setText('sceneGuidanceStatus',state.lagged.hit&&state.t>=state.lagged.final.t?'5 M THRESHOLD REACHED':
  state.t>=state.lagged.final.t?'TERMINATED / NO HIT':'TRACKING · CLOSING '+point.Vc.toFixed(1)+' m/s');
 setText('statLambda',(point.lambda*deg).toFixed(2));setText('statNormalA',safe(point.actual));
 setText('gTime','T+ '+state.t.toFixed(2)+' s');$('gScrub').value=1000*state.t/endTime();
 drawGuidance($('guidanceCanvas'),state.ideal,state.lagged,state.t);
}
function drawCharts(){
 if(state.page==='autopilot'){
   const rows=state.ap.history;
   drawPlot($('apAccelerationChart'),[
     {color:'blue',points:rows.map(v=>({t:v.t,y:v.az}))},
     {color:'cyan',points:rows.map(v=>({t:v.t,y:v.reference}))}],state.t,{tmax:state.ap.final.t});
   drawPlot($('apSurfaceChart'),[
     {color:'teal',points:rows.map(v=>({t:v.t,y:v.delta*deg}))},
     {color:'amber',points:rows.map(v=>({t:v.t,y:v.command*deg}))}],state.t,{tmax:state.ap.final.t});
 }else if(state.page==='guidance'){
   const ideal=state.ideal.history,lag=state.lagged.history, tmax=endTime();
   drawPlot($('gRangeChart'),[{color:'blue',points:ideal.map(v=>({t:v.t,y:v.R}))},
     {color:'amber',points:lag.map(v=>({t:v.t,y:v.R}))}],state.t,{tmax,bounds:[5]});
   drawPlot($('gAccelChart'),[{color:'blue',points:ideal.map(v=>({t:v.t,y:v.actual}))},
     {color:'amber',points:lag.map(v=>({t:v.t,y:v.actual}))}],state.t,{tmax,bounds:[-state.ideal.p.aLimit,state.ideal.p.aLimit]});
 }
}
function refresh(forceCharts=false){
 if(state.page==='autopilot')drawAp();else if(state.page==='guidance')drawG();
 if(forceCharts||performance.now()-state.lastCharts>70){drawCharts();state.lastCharts=performance.now();}
}
function frame(stamp){const dt=Math.min((stamp-(state.lastStamp||stamp))/1000,.08);state.lastStamp=stamp;
 if(state.play&&state.page!=='validation'){
   state.t=Math.min(endTime(),state.t+dt*state.speed);
   if(state.t>=endTime()){state.play=false;updatePlayLabels()}
   refresh();
 }
 requestAnimationFrame(frame);
}
function selectPage(page){if(!['autopilot','guidance','validation'].includes(page))return;
 state.page=page;state.t=0;state.play=false;state.speed=page==='guidance'?10:1;
 document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!==page+'Page'));
 document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
 if(page==='autopilot')$('apSpeed').value='1';if(page==='guidance')$('gSpeed').value='10';
 updatePlayLabels();if(page==='validation')runValidation();else refresh(true);
 history.replaceState(null,'','#'+page);
}
function row(label,reference,actual,pass){return `<div class="result-row"><span>${label}</span><span>${reference}</span><span>${actual}</span><b class="${pass?'':'fail'}">${pass?'PASS':'CHECK'}</b></div>`;}
function runValidation(){
 // These independent baseline runs ignore any changed experiment sliders.
 const ap=simulateAutopilot({dt:.0005}),apm=stepMetrics(ap.history);
 const ideal=simulateGuidance({dt:.01},false),lag=simulateGuidance({dt:.01},true);
 let apPass=0,gPass=0;
 const mark=(ok,kind)=>{if(ok){if(kind==='ap')apPass++;else gPass++;}return ok;};
 const f=matlabReferences.part1,g=matlabReferences.guidance;
 $('autopilotValidation').innerHTML='<div class="result-row result-heading"><span>METRIC</span><span>MATLAB</span><span>BROWSER</span><span>STATUS</span></div>'+
 row('10–90% rise time',f.riseTime.toFixed(4)+' s',apm.riseTime.toFixed(4)+' s',mark(Math.abs(apm.riseTime-f.riseTime)<.002,'ap'))+
 row('2% settling time',f.settlingTime.toFixed(4)+' s',apm.settlingTime.toFixed(4)+' s',mark(Math.abs(apm.settlingTime-f.settlingTime)<.005,'ap'))+
 row('Final acceleration',f.finalAz.toFixed(6),apm.finalAz.toFixed(6),mark(Math.abs(apm.finalAz-f.finalAz)<1e-5,'ap'))+
 row('Deflection ≤ 10°','≤ 10°',apm.peakDeflection.toFixed(5)+'°',mark(apm.peakDeflection<=10,'ap'));
 $('guidanceValidation').innerHTML='<div class="result-row result-heading"><span>METRIC</span><span>MATLAB</span><span>BROWSER</span><span>STATUS</span></div>'+
 row('Ideal stop time',g.idealTime.toFixed(3)+' s',ideal.final.t.toFixed(3)+' s',mark(ideal.hit&&Math.abs(ideal.final.t-g.idealTime)<.01,'g'))+
 row('Lagged stop time',g.laggedTime.toFixed(3)+' s',lag.final.t.toFixed(3)+' s',mark(lag.hit&&Math.abs(lag.final.t-g.laggedTime)<.01,'g'))+
 row('Ideal final range',g.hitRadius.toFixed(1)+' m',ideal.final.R.toFixed(5)+' m',mark(Math.abs(ideal.final.R-g.hitRadius)<1e-5,'g'))+
 row('Lagged final range',g.hitRadius.toFixed(1)+' m',lag.final.R.toFixed(5)+' m',mark(Math.abs(lag.final.R-g.hitRadius)<1e-5,'g'))+
 row('Maximum |acceleration|','≤ 19.62 m/s²',Math.max(ideal.peakActual,lag.peakActual).toFixed(4),mark(Math.max(ideal.peakActual,lag.peakActual)<=19.62+1e-5,'g'));
 setText('apTestStatus',apPass+'/4 CHECKS');setText('gTestStatus',gPass+'/5 CHECKS');
}

for(const name of ['apReference','apManual','apTau','apAlpha','apQ','apDisturbance','apMode'])$(name).addEventListener('input',simulateAp);
for(const name of ['gN','gTau','gAltitude','gTargetX','gVM','gVT'])$(name).addEventListener('input',simulateG);
$('apPlay').addEventListener('click',togglePlay);$('gPlay').addEventListener('click',togglePlay);
$('apReset').addEventListener('click',resetTime);$('gReset').addEventListener('click',resetTime);
$('apScrub').addEventListener('input',e=>{state.play=false;state.t=state.ap.final.t*Number(e.target.value)/1000;updatePlayLabels();refresh(true)});
$('gScrub').addEventListener('input',e=>{state.play=false;state.t=endTime()*Number(e.target.value)/1000;updatePlayLabels();refresh(true)});
$('apSpeed').addEventListener('change',e=>{state.speed=Number(e.target.value)});
$('gSpeed').addEventListener('change',e=>{state.speed=Number(e.target.value)});
$('validateBtn').addEventListener('click',runValidation);
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>selectPage(el.dataset.page)));
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{
 const view=el.dataset.view;state.camera=view==='side'?{yaw:0,elevation:0}:view==='top'?{yaw:0,elevation:1.4}:{yaw:-.35,elevation:.35};
 document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('selected',btn===el));refresh();}));
const airframe=$('airframeCanvas');let dragStart=null;
airframe.addEventListener('pointerdown',e=>{dragStart={x:e.clientX,y:e.clientY};airframe.setPointerCapture(e.pointerId)});
airframe.addEventListener('pointermove',e=>{if(!dragStart)return;
 state.camera.yaw+=-(e.clientX-dragStart.x)*.007;state.camera.elevation=Math.max(-1.3,Math.min(1.5,state.camera.elevation+(e.clientY-dragStart.y)*.006));
 dragStart={x:e.clientX,y:e.clientY};drawAp();});
airframe.addEventListener('pointerup',()=>dragStart=null);airframe.addEventListener('pointercancel',()=>dragStart=null);
$('presentationBtn').addEventListener('click',async()=>{
 const active=document.body.classList.toggle('present-mode');
 try{if(active&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
 else if(!active&&document.fullscreenElement)await document.exitFullscreen();}catch{}
 refresh(true);
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('present-mode')});
window.addEventListener('resize',()=>refresh(true));
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement?.tagName)){
 e.preventDefault();if(state.page!=='validation')togglePlay();}});

simulateAp();simulateG();selectPage(location.hash.slice(1)||'autopilot');requestAnimationFrame(frame);
