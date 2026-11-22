/** Canvas 3D projection of generic vehicle geometry, independent of flight solver. */
import {deg} from '../simulation/core.js';
import {drawExplosion, explosionActive} from './explosion.js';
const c={cyan:'#82e8d5',blue:'#75bdff',amber:'#ffc187',grid:'#173147',faint:'#446a7d'};
function canvas2d(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:rect.width,h:rect.height};}

export function drawAirframe(canvas,s,camera={yaw:-.35,elevation:.35}){
 const {ctx,w,h}=canvas2d(canvas);const scale=Math.min(w/7.8,h/4.5);const cx=w*.52,cy=h*.56;
 const pitch=(s.theta||0)*40,delta=(s.delta||0)*180,alpha=(s.alpha||0)*40;
 const project=(body)=>{
  let [x,y,z]=body;
  const xw=x*Math.cos(pitch)+z*Math.sin(pitch),yw=y,zw=x*Math.sin(pitch)-z*Math.cos(pitch);
  const yaw=camera.yaw??-.35,ele=camera.elevation??.35;
  const xr=xw*Math.cos(yaw)-yw*Math.sin(yaw),yr=xw*Math.sin(yaw)+yw*Math.cos(yaw);
  return [cx+scale*xr,cy-scale*(zw*Math.cos(ele)-yr*Math.sin(ele))];
 };
 const face=(points)=>points.map(project);
 const fillFace=(points,fill,stroke='#415669',lineWidth=1)=>{
  if(!points.length)return;
  ctx.beginPath();ctx.moveTo(...points[0]);for(const xy of points.slice(1))ctx.lineTo(...xy);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();
 };
 const flatPoly=(points,fill,stroke='#415669',lineWidth=1)=>fillFace(face(points),fill,stroke,lineWidth);
 const shadedPoly=(bodyPoints,top,bottom,stroke='#415669',lineWidth=1)=>{
  const points=face(bodyPoints);const xs=points.map(([x])=>x),ys=points.map(([,y])=>y);
  const g=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
  g.addColorStop(0,top);g.addColorStop(.55,bottom);g.addColorStop(1,top);
  fillFace(points,g,stroke,lineWidth);
 };
 function line(a,b,color,width=1,dash=[]){const aa=project(a),bb=project(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(...aa);ctx.lineTo(...bb);ctx.stroke();ctx.setLineDash([])}
 function arrow(from,to,color,text){line(from,to,color,2);const a=project(from),b=project(to),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.beginPath();ctx.moveTo(...b);
 ctx.lineTo(b[0]-11*Math.cos(ang-.32),b[1]-11*Math.sin(ang-.32));ctx.lineTo(b[0]-11*Math.cos(ang+.32),b[1]-11*Math.sin(ang+.32));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.font='10px "DM Mono", monospace';ctx.fillText(text,b[0]+10,b[1]-7)}

 // Atmosphere + subtle spotlight behind the vehicle.
 ctx.clearRect(0,0,w,h);
 const bg=ctx.createLinearGradient(0,0,0,h);
 bg.addColorStop(0,'#0e1f2c');bg.addColorStop(.45,'#0a1520');bg.addColorStop(1,'#071019');
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.47,h*.32,10,w*.47,h*.35,Math.max(w,h)*.55);
 glow.addColorStop(0,'rgba(104,182,235,.18)');glow.addColorStop(.45,'rgba(47,94,140,.08)');glow.addColorStop(1,'rgba(4,10,16,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);

 // Ground reference drawn behind the body.
 ctx.strokeStyle='#1e3648';ctx.lineWidth=.8;
 for(let j=-7;j<=7;j++)line([-4,j*.35,.85],[4,j*.35,.85],'#163145',.6);
 for(let j=-9;j<=9;j++)line([j*.5,-3,.85],[j*.5,3,.85],'#173144',.6);
 line([-3.5,0,0],[3.5,0,0],'#49738a',1,[8,8]);

 // Soft aircraft shadow, projected onto the reference plane.
 const shadowCenter=project([-.18,0,.84]);
 ctx.save();ctx.translate(...shadowCenter);ctx.rotate(-.12+(camera.yaw??-.35)*.35);
 const shadow=ctx.createRadialGradient(0,0,10,0,0,Math.min(w,h)*.18);
 shadow.addColorStop(0,'rgba(0,0,0,.30)');shadow.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(0,0,90,34,0,0,Math.PI*2);ctx.fill();ctx.restore();

 // Exhaust plume.
 const exhaust=Math.min(1,.35+Math.abs(delta)*.9);
 shadedPoly([[-2.24,0,-.02],[-2.9,-.16,-.07],[-3.35,0,-.01],[-2.9,.16,.06]],`rgba(255,247,210,${.28*exhaust})`,`rgba(255,133,72,${.04+.2*exhaust})`,'rgba(255,170,120,.14)',.8);
 shadedPoly([[-2.16,0,-.01],[-2.72,-.09,-.04],[-3.02,0,-.01],[-2.72,.09,.04]],`rgba(255,246,195,${.38*exhaust})`,`rgba(255,150,84,${.14+.28*exhaust})`,'rgba(255,205,138,.12)',.7);

 // Main body and nose: faceted, missile-like shading.
 shadedPoly([[-1.95,-.18,-.11],[1.56,-.18,-.16],[2.42,0,0],[1.56,.18,.14],[-1.95,.18,.11]],'#8da2b1','#576d7d','#a6bac6');
 shadedPoly([[-1.95,-.18,-.11],[1.56,-.18,-.16],[1.84,0,-.02],[-1.95,0,.14]],'#cfd8de','#92a8b4','#d3dde2');
 shadedPoly([[-1.95,0,.14],[1.84,0,-.02],[1.56,.18,.14],[-1.95,.18,.11]],'#688091','#445869','#90a8b5');
 shadedPoly([[1.56,-.18,-.16],[2.42,0,0],[1.56,0,.02]],'#dce6eb','#a8bdc9','#cad6dd');
 shadedPoly([[1.56,0,.02],[2.42,0,0],[1.56,.18,.14]],'#8198a5','#586d7a','#98adb9');

 // Canopy / seeker window.
 shadedPoly([[.42,-.02,.1],[1.05,-.02,.08],[1.2,0,.02],[.58,.02,.11]],'rgba(110,196,255,.76)','rgba(54,103,152,.92)','rgba(165,226,255,.55)',.8);

 // Engine nozzle.
 shadedPoly([[-2.01,-.11,-.08],[-2.12,-.11,-.08],[-2.12,.11,.08],[-2.01,.11,.08]],'#1d2b36','#0a1319','#3d5968',.9);

 // Main wings.
 shadedPoly([[.44,-.1,0],[-.4,-1.6,.02],[-1.14,-1.46,.03],[-.7,-.1,0]],'#5f7788','#3f5564','#7f9aaa');
 shadedPoly([[.44,.1,0],[-.4,1.6,.02],[-1.14,1.46,.03],[-.7,.1,0]],'#7b92a1','#546a79','#93aab8');
 // Leading-edge gloves.
 shadedPoly([[.1,-.1,0],[-.05,-.48,.02],[-.58,-.4,.03],[-.48,-.06,.01]],'#aec1cb','#6c8492','#a0b5bf',.8);
 shadedPoly([[.1,.1,0],[-.05,.48,.02],[-.58,.4,.03],[-.48,.06,.01]],'#8098a7','#5d7585','#99afbb',.8);

 // Tail planes and movable surfaces.
 shadedPoly([[-1.54,-.1,-.03],[-2.14,-1.18,-.01],[-1.38,-1.03,0],[-1.14,-.1,-.02]],'#5f7483','#405463','#7d94a3');
 shadedPoly([[-1.54,.1,-.03],[-2.14,1.18,-.01],[-1.38,1.03,0],[-1.14,.1,-.02]],'#728897','#4e6271','#8ca2b0');
 shadedPoly([[-1.34,-1.03,-.01],[-1.64,-.94,.11*Math.sin(delta)],[-1.41,-.14,.11*Math.sin(delta)],[-1.14,-.1,-.02]],'#54c8bb','#298a88','#8fe8de');
 shadedPoly([[-1.34,1.03,-.01],[-1.64,.94,.11*Math.sin(delta)],[-1.41,.14,.11*Math.sin(delta)],[-1.14,.1,-.02]],'#54c8bb','#298a88','#8fe8de');

 // Dorsal and ventral fins.
 shadedPoly([[-1.22,0,.02],[-1.72,0,.62],[-.9,0,.18]],'#668597','#476173','#8ba4b3');
 shadedPoly([[-1.3,0,-.04],[-1.84,0,-.54],[-1.02,0,-.18]],'#3f5563','#243542','#677f8e');

 // Fine panel lines for realism.
 line([-1.2,0,.02],[1.3,0,.02],'rgba(224,239,246,.28)',.8);
 line([-.52,-1.1,.01],[-.28,1.1,.01],'rgba(165,191,208,.12)',.6);
 line([-1.84,0,.12],[-1.84,0,-.06],'rgba(201,214,224,.18)',.8);

 // True labels and 3D vectors shown in the magnified visualization frame.
 arrow([0,0,0],[1.75,0,0],c.cyan,'+Xb');
 arrow([0,0,0],[0,0,.85],c.amber,'+Zb');
 const a=project([-2.55,0,0]),b=project([2.2*Math.cos(alpha),0,-2.2*Math.sin(alpha)]);
 ctx.setLineDash([6,5]);ctx.strokeStyle=c.blue;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#90c5e7';ctx.font='10px "DM Mono", monospace';ctx.fillText('V',b[0]+5,b[1]-6);
 ctx.font='9px "DM Mono", monospace';ctx.fillStyle='#5b91a8';ctx.fillText('ATTITUDE ×40 / DEFLECTION ×180 VISUAL MAGNIFICATION',16,h-10);
}

function drawMissileMarker(ctx,p,angle,scheme={body:'#74b6ff',dark:'#2f4a60',light:'#e7eef5',fin:'#5fdad1'},size=1,showFlame=true){
 const body=12*size,half=3.8*size,tail=7.6*size;
 ctx.save();ctx.translate(...p);ctx.rotate(-angle);
 if(showFlame){
  const plume=ctx.createLinearGradient(-tail-10*size,0,-tail+1*size,0);
  plume.addColorStop(0,'rgba(255,119,58,0)');plume.addColorStop(.4,'rgba(255,157,78,.35)');plume.addColorStop(1,'rgba(255,245,202,.7)');
  ctx.fillStyle=plume;ctx.beginPath();ctx.moveTo(-tail-11*size,0);ctx.lineTo(-tail+1*size,-2.8*size);ctx.lineTo(-tail+1*size,2.8*size);ctx.closePath();ctx.fill();
 }
 ctx.fillStyle=scheme.fin;
 ctx.beginPath();ctx.moveTo(-3*size,-half*.9);ctx.lineTo(-tail,-half-3.4*size);ctx.lineTo(-1*size,-half*.2);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(-3*size,half*.9);ctx.lineTo(-tail,half+3.4*size);ctx.lineTo(-1*size,half*.2);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(1.8*size,-half*.55);ctx.lineTo(-1.2*size,-half-2.7*size);ctx.lineTo(3.2*size,-half*.12);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(1.8*size,half*.55);ctx.lineTo(-1.2*size,half+2.7*size);ctx.lineTo(3.2*size,half*.12);ctx.closePath();ctx.fill();
 const shell=ctx.createLinearGradient(-tail,0,body,0);
 shell.addColorStop(0,scheme.dark);shell.addColorStop(.28,scheme.body);shell.addColorStop(.65,scheme.light);shell.addColorStop(1,scheme.body);
 ctx.fillStyle=shell;ctx.strokeStyle='rgba(8,17,24,.85)';ctx.lineWidth=1.2;
 ctx.beginPath();ctx.moveTo(body,0);ctx.lineTo(body-5.2*size,-half);ctx.lineTo(-tail,-half);ctx.lineTo(-tail,half);ctx.lineTo(body-5.2*size,half);ctx.closePath();ctx.fill();ctx.stroke();
 const canopy=ctx.createLinearGradient(-1*size,-1*size,5*size,1*size);canopy.addColorStop(0,'rgba(205,243,255,.75)');canopy.addColorStop(1,'rgba(65,129,190,.88)');
 ctx.fillStyle=canopy;ctx.beginPath();ctx.moveTo(2.4*size,-1.6*size);ctx.lineTo(6.6*size,-.85*size);ctx.lineTo(6.2*size,.55*size);ctx.lineTo(2*size,.95*size);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(219,239,250,.45)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-1*size,0);ctx.lineTo(5.8*size,0);ctx.stroke();
 ctx.restore();
}

function drawTargetVehicle(ctx,p,highlight=true){
 ctx.save();ctx.translate(...p);
 if(highlight){
  ctx.strokeStyle='#f6bf7c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,8,0,2*Math.PI);ctx.stroke();ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(12,0);ctx.moveTo(0,-12);ctx.lineTo(0,12);ctx.stroke();
 }
 ctx.translate(0,2);ctx.fillStyle='#f1b26f';ctx.strokeStyle='#402819';ctx.lineWidth=1.1;
 ctx.beginPath();ctx.moveTo(-8,3);ctx.lineTo(7,3);ctx.lineTo(8,-2);ctx.lineTo(1,-6);ctx.lineTo(-5,-6);ctx.lineTo(-8,-2);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#ffd7a8';ctx.fillRect(-3.2,-4.7,3.7,2.2);
 for(const x of [-4.8,4.8]){ctx.fillStyle='#0b1117';ctx.beginPath();ctx.arc(x,4.2,2.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7f8f9b';ctx.beginPath();ctx.arc(x,4.2,1,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}

export function drawGuidance(canvas,ideal,lagged,time,impactAge=null){
 const {ctx,w,h}=canvas2d(canvas);const pad={l:48,r:35,t:28,b:32};
 const lastX=Math.max(ideal.final.xM,lagged.final.xM,ideal.final.xT,lagged.final.xT);
 const xmin=-Math.max(150,lastX*.06),xmax=lastX+Math.max(430,lastX*.23);
 const high=Math.max(ideal.p.hM0,lagged.p.hM0,1300),ymin=-high*.18,ymax=high*1.22;
 const scaleX=(w-pad.l-pad.r)/(xmax-xmin),scaleY=(h-pad.t-pad.b)/(ymax-ymin);
 const proj=(x,y)=>[pad.l+(x-xmin)*scaleX,h-pad.b-(y-ymin)*scaleY];

 // Atmosphere banding for a more presentable range plot.
 const sky=ctx.createLinearGradient(0,pad.t,0,h-pad.b);
 sky.addColorStop(0,'rgba(18,37,52,.78)');sky.addColorStop(.65,'rgba(7,15,22,.12)');sky.addColorStop(1,'rgba(8,15,22,0)');
 ctx.fillStyle=sky;ctx.fillRect(0,pad.t,w,h-pad.t-pad.b);

 ctx.fillStyle='#7490a0';ctx.font='9px "DM Mono", monospace';ctx.textAlign='center';
 for(let j=0;j<=5;j++){
  const x=xmin+(xmax-xmin)*j/5,xx=proj(x,0)[0];ctx.strokeStyle='#1b3345';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,h-pad.b);ctx.stroke();
  ctx.fillText(`${Math.round(x)}`,xx,h-14);
 }
 ctx.textAlign='right';for(let j=0;j<=5;j++){
  const y=ymin+(ymax-ymin)*j/5,yy=proj(0,y)[1];ctx.strokeStyle='#1b3345';ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(`${Math.round(y)}`,pad.l-8,yy+3);}
 ctx.font='9px "DM Mono", monospace';ctx.fillText('ALTITUDE (m)',100,20);

 // Ground and target ground track.
 const ground=proj(0,0)[1];
 const groundFill=ctx.createLinearGradient(0,ground,w,h-pad.b);
 groundFill.addColorStop(0,'rgba(62,72,52,.30)');groundFill.addColorStop(1,'rgba(26,33,28,.55)');
 ctx.fillStyle=groundFill;ctx.fillRect(pad.l,ground,w-pad.l-pad.r,h-pad.b-ground);
 ctx.strokeStyle='#476071';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(pad.l,ground);ctx.lineTo(w-pad.r,ground);ctx.stroke();
 function trace(data,color,dashed=false){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[7,5]:[]);ctx.beginPath();data.forEach((p,i)=>{const a=proj(p.xM,p.hM);i?ctx.lineTo(...a):ctx.moveTo(...a)});ctx.stroke();ctx.setLineDash([])}
 trace(ideal.history,'#6aafff');trace(lagged.history,'#ffb471',true);
 ctx.setLineDash([4,4]);ctx.strokeStyle='#a57c5f';ctx.beginPath();ctx.moveTo(...proj(ideal.p.xT0,0));ctx.lineTo(...proj(ideal.final.xT,0));ctx.stroke();ctx.setLineDash([]);
 function pointAt(result,t){const items=result.history;if(t>=result.final.t)return result.final;
  let lo=0,hi=items.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].t<t)lo=mid+1;else hi=mid}return items[Math.min(lo,items.length-1)];}
 const m=pointAt(lagged,time),im=pointAt(ideal,time);
 const impacted=explosionActive(lagged.hit,lagged.final.t,time,impactAge);
 const mp=proj(m.xM,m.hM),ip=proj(im.xM,im.hM),tp=proj(m.xT,lagged.p.hT0);

 // Line of sight.
 ctx.strokeStyle='#7ee9d6';ctx.lineWidth=1.2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(...mp);ctx.lineTo(...tp);ctx.stroke();ctx.setLineDash([]);

 // Guidance actors.
 drawMissileMarker(ctx,ip,im.gamma,{body:'#80c2ff',dark:'#375677',light:'#eef7ff',fin:'#6be4dc'},1,false);
 if(!impacted||impactAge<.08)drawMissileMarker(ctx,mp,m.gamma,{body:'#ffd79f',dark:'#7f5633',light:'#fff6e6',fin:'#ffbf79'},1.02,true);
 if(!impacted||impactAge<.08)drawTargetVehicle(ctx,tp,true);

 ctx.textAlign='left';ctx.fillStyle='#add8ef';ctx.font='10px "DM Mono", monospace';
 if(!impacted||impactAge<.08){ctx.fillText('M',mp[0]+16,mp[1]-10);ctx.fillStyle='#9bcfff';ctx.fillText('IDEAL',ip[0]+15,ip[1]-10);ctx.fillStyle='#ffca95';ctx.fillText('T',tp[0]+16,tp[1]-13);}
 if(impacted){
   drawExplosion(ctx,tp[0],tp[1],impactAge,Math.min(w,h));
   const alpha=Math.min(1,Math.max(0,(impactAge-.1)/.3));
   ctx.save();ctx.textAlign='center';ctx.fillStyle=`rgba(255,228,175,${alpha})`;
   ctx.font='bold 13px "Space Grotesk", sans-serif';
   ctx.fillText('INTERCEPTION CONFIRMED',Math.min(Math.max(tp[0],185),w-175),Math.max(pad.t+25,tp[1]-125));
   ctx.font='9px "DM Mono", monospace';ctx.fillStyle=`rgba(238,176,122,${alpha*.85})`;
   ctx.fillText('VISUAL FX  /  R ≤ 5 m',Math.min(Math.max(tp[0],185),w-175),Math.max(pad.t+41,tp[1]-109));
   ctx.restore();
 }
 ctx.fillStyle='#5e8495';ctx.textAlign='right';ctx.fillText('x / m',w-20,h-13);
}