/** Lightweight canvas telemetry renderer, no interpolation of the physics. */
const colors={blue:'#5cafff',cyan:'#8cedde',teal:'#4edbb7',amber:'#ffbf79'};
function setup(canvas){const r=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:r.width,h:r.height};}
export function drawPlot(canvas,series,tNow,options={}){
  if(!canvas)return;const {ctx,w,h}=setup(canvas);const pad={left:51,right:13,top:13,bottom:33};
  const x1=pad.left,x2=w-pad.right,y1=pad.top,y2=h-pad.bottom;
  if(!(x2>x1&&y2>y1))return;
  const all=series.flatMap(s=>s.points.map(p=>p.y).filter(Number.isFinite));
  if(options.bounds)all.push(...options.bounds);
  all.push(0);
  let ymin=Math.min(...all),ymax=Math.max(...all),span=ymax-ymin||1;
  ymin-=span*.11;ymax+=span*.11;span=ymax-ymin;
  const tmax=options.tmax??Math.max(...series.flatMap(s=>s.points.map(p=>p.t)),1);
  const mapX=t=>x1+(t/tmax)*(x2-x1),mapY=y=>y2-(y-ymin)/span*(y2-y1);
  ctx.clearRect(0,0,w,h);ctx.font='9px "DM Mono", monospace';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){
    const v=ymin+span*i/4,yy=mapY(v);
    ctx.strokeStyle='#243845';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x1,yy);ctx.lineTo(x2,yy);ctx.stroke();
    ctx.fillStyle='#718c9c';ctx.textAlign='right';ctx.fillText(Math.abs(v)>=100?Math.round(v).toString():v.toFixed(Math.abs(v)<.5?2:1),x1-9,yy);
  }
  for(let i=0;i<=4;i++){
    const t=tmax*i/4,xx=mapX(t);ctx.strokeStyle='#233542';ctx.beginPath();ctx.moveTo(xx,y1);ctx.lineTo(xx,y2);ctx.stroke();
    ctx.fillStyle='#718c9c';ctx.textAlign='center';ctx.fillText(tmax>10?t.toFixed(0):t.toFixed(1),xx,y2+13);
  }
  ctx.fillStyle='#5e8292';ctx.textAlign='right';ctx.fillText('TIME (s)',x2,y2+27);
  for(const s of series){if(!s.points.length)continue;ctx.strokeStyle=colors[s.color]||s.color||colors.blue;
    ctx.lineWidth=1.7;ctx.lineJoin='round';ctx.beginPath();let first=true;
    for(const p of s.points){const xx=mapX(p.t),yy=mapY(p.y);if(first){ctx.moveTo(xx,yy);first=false}else ctx.lineTo(xx,yy)}ctx.stroke();}
  const cursorX=mapX(Math.min(Math.max(tNow,0),tmax));ctx.setLineDash([3,4]);ctx.strokeStyle='#b8dacc99';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cursorX,y1);ctx.lineTo(cursorX,y2);ctx.stroke();ctx.setLineDash([]);
  for(const s of series){const points=s.points;if(!points.length)continue;
    let low=0,high=points.length-1;while(low<high){const mid=(low+high)>>1;if(points[mid].t<tNow)low=mid+1;else high=mid;}
    const i=Math.max(0,Math.min(points.length-1,low));const p=points[i];const xx=mapX(p.t),yy=mapY(p.y);
    ctx.fillStyle=colors[s.color]||s.color||colors.blue;ctx.beginPath();ctx.arc(xx,yy,3.3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0d1721';ctx.lineWidth=1.2;ctx.stroke();}
}
