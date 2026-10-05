// An authored sound-field illustration, not an acoustic model or live analyser.
const section = document.querySelector('#sound-field');
if (section) mountAudioField(section);

function mountAudioField(root) {
  const field = root.querySelector('#audio-field-canvas');
  const trace = root.querySelector('#audio-trace-canvas');
  const ctx = field?.getContext('2d');
  const signalCtx = trace?.getContext('2d');
  if (!ctx || !signalCtx) return;
  const life = new AbortController();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pause = root.querySelector('[data-audio-pause]');
  const buttons = [...root.querySelectorAll('[data-audio-mode]')];
  const description = root.querySelector('[data-audio-description]');
  const modes = {
    full: {waves:7, amplitude:.075, height:.65, speed:.7, copy:'Layered waves. One continuous, full-circle field.'},
    low: {waves:3, amplitude:.12, height:.48, speed:.46, copy:'Slower, broader pulses give the low-end concept its shape.'},
    high: {waves:13, amplitude:.05, height:.76, speed:.92, copy:'Fine, closely spaced ripples trace the high-detail concept.'}
  };
  let mode = 'full', current = {...modes.full};
  let visible = false, paused = reduced.matches, frame = 0, last = 0, time = 0;
  let fieldSize = {w:1,h:1,dpr:1}, traceSize = {...fieldSize};
  let disposed = false;
  const tau = Math.PI * 2;
  const angles = Array.from({length:97}, (_,i) => i / 96 * tau);
  const latitudes = Array.from({length:57}, (_,i) => -Math.PI / 2 + i / 56 * Math.PI);

  function size(canvas) {
    const {width:w,height:h} = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, w < 500 ? 1.5 : 1.75);
    canvas.width = Math.max(1,Math.round(w*dpr));
    canvas.height = Math.max(1,Math.round(h*dpr));
    return {w,h,dpr};
  }
  function resize() {
    fieldSize = size(field); traceSize = size(trace);
    draw();
  }
  function path(context, points, color, width=1, close=false) {
    context.beginPath();
    points.forEach(([x,y],i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
    if (close) context.closePath();
    context.strokeStyle = color; context.lineWidth = width; context.stroke();
  }
  function drawField() {
    const {w,h,dpr} = fieldSize;
    if (w < 2 || h < 2) return;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const scale = Math.min((w*.5-24)/1.68,h*.43), cx=w*.5, cy=h*.44;
    const yaw = .32 + time*.065, tilt=.39;
    const sinY=Math.sin(yaw), cosY=Math.cos(yaw), sinT=Math.sin(tilt), cosT=Math.cos(tilt);
    function project(x,y,z) {
      const rx=x*cosY-z*sinY, rz=x*sinY+z*cosY;
      return [cx+rx*scale,cy+(-y*cosT+rz*sinT)*scale];
    }
    const polar = (r,y,a) => project(Math.cos(a)*r,y,Math.sin(a)*r);
    // Angular grid has directional meaning; no fabricated measurement scale.
    for(let r=.3;r<=1.51;r+=.3) path(ctx,angles.map(a=>polar(r,-.78,a)),'rgba(92,158,215,.14)');
    for(let i=0;i<24;i++) {
      const a=i*tau/24;
      path(ctx,[polar(.16,-.78,a),polar(1.5,-.78,a)],i%6===0?'rgba(108,177,233,.32)':'rgba(92,158,215,.11)');
    }
    for(let i=0;i<72;i++) {
      const a=i*tau/72;
      path(ctx,[polar(i%6===0?1.43:1.47,-.78,a),polar(1.5,-.78,a)],'rgba(124,190,244,.5)');
    }
    ctx.font=`${w<430?10:11}px Outfit, sans-serif`;
    ctx.fillStyle='#97b9d9';ctx.textAlign='center';ctx.textBaseline='middle';
    [0,90,180,270].forEach(deg=>{const p=polar(1.68,-.78,deg/360*tau);ctx.fillText(`${deg}°`,p[0],p[1]);});
    // Expanding horizontal fronts and a slowly sweeping directional guide.
    for(let i=0;i<4;i++) {
      const t=(time*.13+i/4)%1, radius=.22+t*1.24;
      path(ctx,angles.map(a=>polar(radius,-.72,a)),`rgba(69,158,255,${(1-t)*.38})`,1.15);
    }
    const sweep=time*.26;
    path(ctx,[polar(.14,-.77,sweep),polar(1.5,-.77,sweep)],'rgba(111,203,255,.68)');
    path(ctx,Array.from({length:25},(_,i)=>polar(1.5,-.77,sweep-i*.018)),'rgba(105,203,255,.72)',1.6);
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,scale*1.12);
    glow.addColorStop(0,'rgba(40,139,255,.10)');glow.addColorStop(.6,'rgba(36,114,255,.025)');glow.addColorStop(1,'rgba(36,114,255,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    function point(a,p) {
      const envelope=Math.cos(p);
      const ripple=current.amplitude*Math.sin(p*current.waves+time*current.speed)*envelope;
      const r=(1+ripple)*envelope;
      return project(Math.cos(a)*r,Math.sin(p)*current.height,Math.sin(a)*r);
    }
    // Two intersecting families of curves produce a continuous wire field.
    for(let i=1;i<27;i++) {
      const p=-Math.PI/2+i/27*Math.PI;
      path(ctx,angles.map(a=>point(a,p)),i%3===0?'rgba(93,192,255,.61)':'rgba(64,143,235,.31)',i%3===0?1:.7);
    }
    for(let i=0;i<32;i++) {
      const a=i*tau/32;
      const facing=(Math.sin(a+yaw)+1)/2;
      path(ctx,latitudes.map(p=>point(a,p)),`rgba(100,195,255,${.14+facing*.37})`,.8);
    }
    path(ctx,angles.map(a=>point(a,0)),'#8bd8ff',1.4);
    path(ctx,[project(0,-.9,0),project(0,.9,0)],'rgba(123,182,231,.26)',.8);
    // Small markers follow the wire; there is no random flashing.
    for(let i=0;i<6;i++) {
      const p=point(i*tau/6-time*.18,Math.sin(time*.22+i)*.55);
      ctx.beginPath();ctx.arc(p[0],p[1],i%2?1.8:2.6,0,tau);
      ctx.fillStyle='#c0edff';ctx.fill();
    }
    const center=project(0,0,0);
    ctx.beginPath();ctx.arc(center[0],center[1],4,0,tau);ctx.fillStyle='#c0eaff';ctx.fill();
    ctx.strokeStyle='rgba(133,204,255,.45)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(center[0],center[1],10,0,tau);ctx.stroke();
    // Precise leader lines retain breathing room around the field.
    const lead=point(-.4,.55);
    path(ctx,[lead,[w*.79,h*.19],[w*.93,h*.19]],'rgba(112,174,221,.4)',.8);
    ctx.textAlign='right';ctx.fillStyle='#9dbfdf';ctx.fillText('OMNI FIELD',w*.93,h*.19-12);
    const base=polar(1.4,-.78,2.7);
    path(ctx,[base,[w*.16,h*.79],[w*.05,h*.79]],'rgba(112,174,221,.4)',.8);
    ctx.textAlign='left';ctx.fillText('HORIZONTAL PLANE',w*.05,h*.79+17);
  }
  function drawTrace() {
    const {w,h,dpr}=traceSize;
    if(w<2||h<2)return;
    signalCtx.setTransform(dpr,0,0,dpr,0,0);signalCtx.clearRect(0,0,w,h);
    for(let i=0;i<9;i++) path(signalCtx,[[i*w/8,8],[i*w/8,h-8]],'rgba(112,169,218,.11)');
    for(let i=1;i<4;i++)path(signalCtx,[[0,i*h/4],[w,i*h/4]],'rgba(112,169,218,.15)');
    for(let layer=3;layer>=0;layer--) {
      const points=[];
      for(let i=0;i<=160;i++) {
        const x=i/160, envelope=Math.pow(Math.sin(x*Math.PI),.65);
        const wave=Math.sin(x*tau*current.waves-time*current.speed*2+layer*.44)*.7+
          Math.sin(x*tau*(current.waves*1.7)+time*.63+layer)*.3;
        points.push([x*w,h/2+wave*envelope*h*.32*(1-layer*.15)]);
      }
      path(signalCtx,points,layer===0?'#9cdeff':`rgba(63,143,255,${.45-layer*.07})`,layer===0?1.4:1);
    }
  }
  function draw(){ drawField();drawTrace(); }
  function tick(now) {
    frame=0;
    if(disposed||!visible||paused||document.hidden)return;
    // Capped at 30fps: the existing product renderers keep their budget.
    const elapsed=now-last;
    if(elapsed>=32) {
      const delta=Math.min(elapsed/1000,.07);last=now;time+=delta;
      const target=modes[mode], lerp=1-Math.exp(-delta*5);
      ['waves','amplitude','height','speed'].forEach(k=>current[k]+=(target[k]-current[k])*lerp);
      draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=performance.now();
    const active=visible&&!paused&&!document.hidden;
    root.dataset.audioActive=String(active);root.dataset.audioPaused=String(paused);
    if(active)frame=requestAnimationFrame(tick);
  }
  function updatePause() {
    pause.setAttribute('aria-pressed',String(paused));
    pause.textContent=paused?'Play graphic':'Pause graphic';
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.audioMode;
    if(!modes[next])return;
    mode=next;root.dataset.audioMode=mode;
    field.dataset.mode=mode;trace.dataset.mode=mode;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    description.textContent=modes[mode].copy;
    field.setAttribute('aria-label',`${button.textContent.trim()}: an illustrative radial sound field spreading in every direction, not measured acoustic data.`);
    if(paused)current={...modes[mode]};
    draw();
  },{signal:life.signal}));
  pause.addEventListener('click',()=>{paused=!paused;updatePause();sync();},{signal:life.signal});
  reduced.addEventListener('change',()=>{paused=reduced.matches;updatePause();sync();},{signal:life.signal});
  document.addEventListener('visibilitychange',sync,{signal:life.signal});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0});
  observer.observe(root);
  const sizing=new ResizeObserver(resize);sizing.observe(field);sizing.observe(trace);
  root.dataset.audioMode=mode;field.dataset.mode=mode;trace.dataset.mode=mode;updatePause();resize();
  // A BFCache return restores the same illustration; actual unload disposes it.
  addEventListener('pagehide',event=>{
    cancelAnimationFrame(frame);frame=0;
    if(!event.persisted){disposed=true;observer.disconnect();sizing.disconnect();life.abort();}
  },{signal:life.signal});
  addEventListener('pageshow',sync,{signal:life.signal});
}
