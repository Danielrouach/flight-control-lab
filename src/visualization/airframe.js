/** Canvas 3D projection of generic vehicle geometry, independent of flight solver. */
import {deg} from '../simulation/core.js';
const c={cyan:'#82e8d5',blue:'#75bdff',amber:'#ffc187',grid:'#173147',faint:'#446a7d'};
function canvas2d(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:rect.width,h:rect.height};}
export function drawAirframe(canvas,s,camera={yaw:-.35,elevation:.35}){
 const {ctx,w,h}=canvas2d(canvas);const scale=Math.min(w/7.8,h/4.5);const cx=w*.52,cy=h*.55;
 // Visualization-only magnification: physical values always reported separately.
 const pitch=(s.theta||0)*40,delta=(s.delta||0)*180,alpha=(s.alpha||0)*40;
 const project=(body)=>{
  let [x,y,z]=body;
  const xw=x*Math.cos(pitch)+z*Math.sin(pitch),yw=y,zw=x*Math.sin(pitch)-z*Math.cos(pitch);
  const yaw=camera.yaw??-.35,ele=camera.elevation??.35;
  const xr=xw*Math.cos(yaw)-yw*Math.sin(yaw),yr=xw*Math.sin(yaw)+yw*Math.cos(yaw);
  return [cx+scale*xr,cy-scale*(zw*Math.cos(ele)-yr*Math.sin(ele))];
 };
 function line(a,b,color,width=1,dash=[]){const aa=project(a),bb=project(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(...aa);ctx.lineTo(...bb);ctx.stroke();ctx.setLineDash([])}
 function poly(points,fill,stroke='#415669'){const p=points.map(project);ctx.beginPath();ctx.moveTo(...p[0]);for(const xy of p.slice(1))ctx.lineTo(...xy);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}
 function arrow(from,to,color,text){line(from,to,color,2);const a=project(from),b=project(to),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.beginPath();ctx.moveTo(...b);
 ctx.lineTo(b[0]-11*Math.cos(ang-.32),b[1]-11*Math.sin(ang-.32));ctx.lineTo(b[0]-11*Math.cos(ang+.32),b[1]-11*Math.sin(ang+.32));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.font='10px "DM Mono", monospace';ctx.fillText(text,b[0]+10,b[1]-7)}
 // Ground reference drawn behind the body.
 ctx.strokeStyle='#1e3648';ctx.lineWidth=.8;
 for(let j=-7;j<=7;j++)line([-4,j*.35,.85],[4,j*.35,.85],'#163145',.6);
 for(let j=-9;j<=9;j++)line([j*.5,-3,.85],[j*.5,3,.85],'#173144',.6);
 line([-3.5,0,0],[3.5,0,0],'#49738a',1,[8,8]);
 // Rear horizontal stabilizers and hinged movable trailing elements.
 poly([[-1.55,-.12,-.02],[-2.1,-1.16,-.02],[-1.35,-1.07,-.02],[-1.14,-.12,-.02]],'#40586b');
 poly([[-1.55,.12,-.02],[-2.1,1.16,-.02],[-1.35,1.07,-.02],[-1.14,.12,-.02]],'#576b78');
 poly([[-1.35,-1.07,-.02],[-1.61,-.96,.11*Math.sin(delta)],[-1.38,-.17,.11*Math.sin(delta)],[-1.14,-.12,-.02]],'#3bbaac','#76d9c4');
 poly([[-1.35,1.07,-.02],[-1.61,.96,.11*Math.sin(delta)],[-1.38,.17,.11*Math.sin(delta)],[-1.14,.12,-.02]],'#3bbaac','#76d9c4');
 // Main wings, oriented through transverse body y-axis.
 poly([[.38,-.12,0],[-.42,-1.54,.01],[-1.02,-1.43,.01],[-.7,-.12,0]],'#4b6675','#63849b');
 poly([[.38,.12,0],[-.42,1.54,.01],[-1.02,1.43,.01],[-.7,.12,0]],'#688091','#8fa2ac');
 // Fuselage + distinctive nose. No 6DOF assumptions are encoded in the mesh.
 poly([[-1.88,-.17,-.10],[1.55,-.17,-.13],[2.30,0,0],[1.55,.17,.13],[-1.88,.17,.10]],'#8299a9','#a0b6c1');
 poly([[-1.88,-.17,-.10],[1.55,-.17,-.13],[2.30,0,0],[1.65,0,.05],[-1.88,0,.11]],'#b6c5cb','#b6d1d7');
 poly([[-1.88,0,.11],[1.65,0,.05],[1.55,.17,.13],[-1.88,.17,.10]],'#526c7f');
 poly([[-1.75,0,.02],[-1.8,.03,-.6],[-.95,.03,-.17]],'#54768e','#83afc0');
 // True labels and 3D vectors shown in the magnified visualization frame.
 arrow([0,0,0],[1.65,0,0],c.cyan,'+Xb');
 arrow([0,0,0],[0,0,.8],c.amber,'+Zb');
 const a=project([-2.5,0,0]),b=project([2.1*Math.cos(alpha),0,-2.1*Math.sin(alpha)]);
 ctx.setLineDash([6,5]);ctx.strokeStyle=c.blue;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#90c5e7';ctx.font='10px "DM Mono", monospace';ctx.fillText('V',b[0]+5,b[1]-6);
 ctx.font='9px "DM Mono", monospace';ctx.fillStyle='#5b91a8';ctx.fillText('ATTITUDE ×40 / DEFLECTION ×180 VISUAL MAGNIFICATION',16,h-10);
}

export function drawGuidance(canvas,ideal,lagged,time){
 const {ctx,w,h}=canvas2d(canvas);const pad={l:48,r:35,t:28,b:32};
 const paths=[ideal.history,lagged.history],tmax=Math.max(ideal.final.t,lagged.final.t);
 const lastX=Math.max(ideal.final.xM,lagged.final.xM,ideal.final.xT,lagged.final.xT);
 const xmin=-Math.max(150,lastX*.06),xmax=lastX+180;
 const high=Math.max(ideal.p.hM0,lagged.p.hM0,1300),ymin=-high*.18,ymax=high*1.22;
 const scaleX=(w-pad.l-pad.r)/(xmax-xmin),scaleY=(h-pad.t-pad.b)/(ymax-ymin);
 const proj=(x,y)=>[pad.l+(x-xmin)*scaleX,h-pad.b-(y-ymin)*scaleY];
 ctx.fillStyle='#7490a0';ctx.font='9px "DM Mono", monospace';ctx.textAlign='center';
 for(let j=0;j<=5;j++){
  const x=xmin+(xmax-xmin)*j/5,xx=proj(x,0)[0];ctx.strokeStyle='#1b3345';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,h-pad.b);ctx.stroke();
  ctx.fillText(`${Math.round(x)}`,xx,h-14);
 }
 ctx.textAlign='right';for(let j=0;j<=5;j++){
  const y=ymin+(ymax-ymin)*j/5,yy=proj(0,y)[1];ctx.strokeStyle='#1b3345';ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(`${Math.round(y)}`,pad.l-8,yy+3);}
 ctx.font='9px "DM Mono", monospace';ctx.fillText('ALTITUDE (m)',100,20);
 // Target ground track and initial target mark.
 const ground=proj(0,0)[1];ctx.strokeStyle='#476071';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(pad.l,ground);ctx.lineTo(w-pad.r,ground);ctx.stroke();
 function trace(data,color,dashed=false){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[7,5]:[]);ctx.beginPath();data.forEach((p,i)=>{const a=proj(p.xM,p.hM);i?ctx.lineTo(...a):ctx.moveTo(...a)});ctx.stroke();ctx.setLineDash([])}
 trace(ideal.history,'#6aafff');trace(lagged.history,'#ffb471',true);
 ctx.setLineDash([4,4]);ctx.strokeStyle='#a57c5f';ctx.beginPath();ctx.moveTo(...proj(ideal.p.xT0,0));ctx.lineTo(...proj(ideal.final.xT,0));ctx.stroke();ctx.setLineDash([]);
 function pointAt(result,t){const items=result.history;if(t>=result.final.t)return result.final;
  let lo=0,hi=items.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].t<t)lo=mid+1;else hi=mid}return items[Math.min(lo,items.length-1)];}
 const m=pointAt(lagged,time),im=pointAt(ideal,time);
 const mp=proj(m.xM,m.hM),ip=proj(im.xM,im.hM),tp=proj(m.xT,lagged.p.hT0);
 ctx.strokeStyle='#7ee9d6';ctx.lineWidth=1.2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(...mp);ctx.lineTo(...tp);ctx.stroke();ctx.setLineDash([]);
 function craft(p,angle,color){ctx.save();ctx.translate(...p);ctx.rotate(-angle);ctx.fillStyle=color;ctx.strokeStyle='#071525';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-10,-6);ctx.lineTo(-6,0);ctx.lineTo(-10,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
 craft(ip,im.gamma,'#74b6ff');craft(mp,m.gamma,'#ffe0ac');
 ctx.strokeStyle='#f6bf7c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(...tp,8,0,2*Math.PI);ctx.stroke();ctx.beginPath();ctx.moveTo(tp[0]-12,tp[1]);ctx.lineTo(tp[0]+12,tp[1]);ctx.moveTo(tp[0],tp[1]-12);ctx.lineTo(tp[0],tp[1]+12);ctx.stroke();
 ctx.textAlign='left';ctx.fillStyle='#add8ef';ctx.font='10px "DM Mono", monospace';ctx.fillText('M',mp[0]+14,mp[1]-8);ctx.fillStyle='#ffca95';ctx.fillText('T',tp[0]+13,tp[1]-12);
 ctx.fillStyle='#5e8495';ctx.textAlign='right';ctx.fillText('x / m',w-20,h-13);
}
