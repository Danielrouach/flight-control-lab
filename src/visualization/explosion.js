/**
 * Presentation-only terminal-hit illustration.
 * Draws no physical blast model and never changes the guidance trajectory.
 * All particles use deterministic hashes, so pause and scrub are repeatable.
 */
export const EXPLOSION_DURATION = 2.6; // wall-clock seconds, independent of simulation playback speed

export function explosionActive(hit, terminalTime, simulationTime, age) {
  return Boolean(hit && Number.isFinite(terminalTime) && simulationTime >= terminalTime - 1e-6 &&
    Number.isFinite(age) && age >= 0 && age <= EXPLOSION_DURATION);
}

const clamp01 = value => Math.max(0, Math.min(1, value));
const hash = n => {
  const x = Math.sin(n * 127.1 + 48.13) * 43758.5453123;
  return x - Math.floor(x);
};

export function drawExplosion(ctx, x, y, age, viewport = 440) {
  if (!Number.isFinite(age) || age < 0 || age > EXPLOSION_DURATION) return;
  const k = Math.max(.76, Math.min(1.3, viewport / 410));
  const initial = clamp01(age / .34), fade = clamp01((EXPLOSION_DURATION - age) / 1.2);
  const boom = Math.sin(initial * Math.PI / 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'screen';

  // Broad, quickly fading thermal flash, followed by a soft hot corona.
  if (age < .8) {
    const flashR = (24 + age * 185) * k;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR);
    g.addColorStop(0, `rgba(255,247,198,${.89 * (1 - age / .8)})`);
    g.addColorStop(.17, `rgba(255,148,51,${.60 * (1 - age / .8)})`);
    g.addColorStop(.56, `rgba(250,69,22,${.2 * (1 - age / .8)})`);
    g.addColorStop(1, 'rgba(255,79,18,0)');
    ctx.fillStyle = g;ctx.beginPath();ctx.arc(0,0,flashR,0,Math.PI*2);ctx.fill();
  }

  // Two expanding pressure-wave rings have no physical scale in this view.
  for (let ring = 0; ring < 2; ring++) {
    const delay = ring * .15, local = age - delay;
    if (local < 0 || local > 1.35) continue;
    const progress = local / 1.35;
    ctx.beginPath();ctx.arc(0,0,(11 + progress * 112) * k,0,Math.PI*2);
    ctx.strokeStyle = `rgba(${ring?'255,131,58':'255,234,172'},${(1-progress)*.9})`;
    ctx.lineWidth=(ring?2.3:4)*(1-progress*.7)*k;
    ctx.stroke();
  }

  // Smoke forms slightly after the brightest frame and disperses away.
  const smoke = clamp01((age-.18)/.35) * clamp01((EXPLOSION_DURATION-age)/1.4);
  if (smoke > 0) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2 + .2, radius = (12 + age*(22+hash(i+5)*17))*k;
      const sx = Math.cos(a)*radius, sy = Math.sin(a)*radius - age*15*k;
      const r = (14 + age*15 + hash(i+38)*11)*k;
      const grad = ctx.createRadialGradient(sx,sy,r*.1,sx,sy,r);
      grad.addColorStop(0,`rgba(82,88,97,${smoke*.25})`);
      grad.addColorStop(.65,`rgba(38,53,64,${smoke*.2})`);
      grad.addColorStop(1,'rgba(38,53,64,0)');
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(sx,sy,r,0,2*Math.PI);ctx.fill();
    }
    ctx.globalCompositeOperation='screen';
  }

  // Sparks: reproducible radial motion with gentle gravitational droop.
  for (let i = 0; i < 66; i++) {
    const angle = i * 2.399963229728653 + hash(i+13)*.25;
    const speed = 64 + hash(i+91)*125;
    const start = hash(i+73)*.18;
    const life = .72 + hash(i+7)*1.1;
    const t = age - start;
    if (t < 0 || t > life) continue;
    const v = speed*t*k, sx = Math.cos(angle)*v, sy = Math.sin(angle)*v + t*t*37*k;
    const a = (1 - t/life)*Math.min(1,t/.08+ .2)*fade;
    const tail = (5 + hash(i+1)*14)*k*(1-t/life*.7);
    ctx.strokeStyle = `rgba(${i%3===0?'255,247,178':i%3===1?'255,161,66':'255,85,32'},${a})`;
    ctx.lineWidth=(i%5===0?2.7:1.5)*k;
    ctx.beginPath();ctx.moveTo(sx-Math.cos(angle)*tail, sy-Math.sin(angle)*tail);
    ctx.lineTo(sx,sy);ctx.stroke();
  }

  // Main fireball burns briefly, with a crisp hot-white center.
  if (age < 1.05) {
    const strength = clamp01((1.05-age)/.68);
    const radius = (12+boom*32+age*9)*k;
    const fire=ctx.createRadialGradient(0,0,0,0,0,radius);
    fire.addColorStop(0,`rgba(255,253,234,${strength})`);
    fire.addColorStop(.25,`rgba(255,222,107,${strength*.98})`);
    fire.addColorStop(.56,`rgba(255,112,32,${strength*.85})`);
    fire.addColorStop(.8,`rgba(248,47,13,${strength*.52})`);
    fire.addColorStop(1,'rgba(255,60,18,0)');
    ctx.fillStyle=fire;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
