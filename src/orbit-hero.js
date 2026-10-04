import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {gsap} from 'gsap';
import {addSlotLights} from './orbit-slot-lights.js';

// Fetch and parse the supplied model once. Each scene owns its mutable resources.
let modelPromise;
function loadModel(){return modelPromise??=new GLTFLoader().loadAsync('models/orbit.glb');}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(max-width: 749px)');
const levitationLift=.015; // The supplied GLB uses meters: raise the UFO by 1.5 cm.
// Keep the clockwise saucer clearly independent of every camera orbit.
const saucerSpeed=1.05;
document.querySelectorAll('[data-orbit-scene]').forEach(createOrbitScene);

function createOrbitScene(hero){
const mode=hero.dataset.orbitScene;
const isHero=mode==='hero',isNight=mode==='nocturne',isProduct=mode==='product',isAmbience=mode==='ambience';
const sceneName=isHero?'hero':isNight?'light study':isProduct?'product':'day and night';
const stage=hero.querySelector('.orbit-stage');
const canvas=hero.querySelector('canvas');
const status=hero.querySelector('.orbit-status');
const pauseButton=hero.querySelector('[data-orbit-pause],#orbit-pause');
const replayButton=hero.querySelector('[data-orbit-replay],#orbit-replay');
const lightButton=hero.querySelector('[data-orbit-light],#orbit-light');
const lifecycle=new AbortController();
const options={signal:lifecycle.signal};
let renderer,environment,root,saucer,scan,glow,key,fill,resizeObserver,visibilityObserver,loadObserver;
let frame=0,last=0,time=0,visible=false,disposed=false,loaded=false,started=false,paused=reduced.matches,lights=true,drag=null;
let width=1,height=1,dpr=1,performanceFrames=0,slowFrames=0;
let choreography,annotations,intro,productView='full';
const productViews={full:{azimuth:.52,elevation:.16,radius:.78,targetY:.17},detail:{azimuth:-.35,elevation:.84,radius:.33,targetY:.304},profile:{azimuth:1.57,elevation:.07,radius:.79,targetY:.171}};
const rest=isHero?{azimuth:.52,elevation:.14,radius:.84,targetY:.166}:isNight?{azimuth:-.45,elevation:.85,radius:.32,targetY:.301}:isProduct?{...productViews.full}:isAmbience?{azimuth:.7,elevation:.18,radius:.78,targetY:.17}:{azimuth:-.95,elevation:.18,radius:.86,targetY:.169};
const rig={...rest};
const pointer={x:0,y:0};
const offset={x:0,y:0};
const leds=[],glows=[],hulls=[],resources=new Set();
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.005,8);
const target=new THREE.Vector3();
const projection=new THREE.Vector3();
const spinAxis=new THREE.Vector3(0,1,0);
const annotationPositions=[new THREE.Vector3(.079,.304+levitationLift,0),new THREE.Vector3(-.077,.275,0),new THREE.Vector3(.05,.336+levitationLift,0)];
const annotationNodes=[...hero.querySelectorAll('.orbit-callout')];
const pulseLights=[],soundWaves=[];
const effectRings=[];
const slotOff=new THREE.Color(0x033c91),slotOn=new THREE.Color(0x42c8ff);
let lastTelemetry=-1;

// Two softly travelling beacons, one on each side; no full-screen strobe.
function beacon(phase){
  const angle=time*Math.PI/2.4-phase;
  const head=Math.pow(Math.max(0,Math.cos(angle)),12);
  const opposite=Math.pow(Math.max(0,Math.cos(angle-Math.PI)),12)*.65;
  return Math.max(head,opposite);
}

function announce(message){status.textContent=message;}
function setPause(value){
  paused=Boolean(value);pauseButton.setAttribute('aria-pressed',String(paused));
  pauseButton.setAttribute('aria-label',`${paused?'Play':'Pause'} ${sceneName} animation`);
  pauseButton.querySelector('span').textContent=paused?'Play motion':'Pause motion';
  hero.dataset.paused=String(paused);hero.dataset.motion=paused?'paused':'playing';sync();
}
function setLights(value){lights=Boolean(value);lightButton.setAttribute('aria-pressed',String(lights));lightButton.textContent=lights?'Blue light on':'Blue light off';renderOnce();}
function setAmbience(value){
  if(!isAmbience)return;
  const night=value==='night';hero.dataset.lighting=night?'night':'day';
  hero.querySelectorAll('[data-light]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.light===hero.dataset.lighting)));
  if(renderer&&key&&fill){renderer.toneMappingExposure=night?.7:.98;scene.environmentIntensity=night?.52:1.15;key.intensity=night?1.4:2.5;fill.intensity=night?2.1:.9;fill.color.set(night?0x348fff:0xb4d5ff);renderOnce();}
}
function setProductView(value){
  if(!isProduct||!Object.hasOwn(productViews,value))return;
  const previous={...rig,azimuth:rig.azimuth+offset.x,elevation:rig.elevation+offset.y};
  productView=value;Object.assign(rest,productViews[value]);
  previous.azimuth=rest.azimuth+Math.atan2(Math.sin(previous.azimuth-rest.azimuth),Math.cos(previous.azimuth-rest.azimuth));
  hero.dataset.view=value;hero.querySelectorAll('[data-orbit-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.orbitView===value)));
  pointer.x=pointer.y=offset.x=offset.y=0;
  animate();
  if(loaded&&!paused&&!reduced.matches)intro=gsap.timeline({paused:true,onComplete:()=>{intro=null;sync();}}).fromTo(rig,previous,{...rest,duration:1.15,ease:'power2.inOut'});
  sync();
}
function setCamera(){
  // A tighter desktop pass stays wide enough when the viewport narrows mid-orbit.
  const minRadius=(isNight||(isProduct&&productView==='detail'))?.36:.62;
  const radius=Math.max(rig.radius,mobile.matches?minRadius:0)*(mobile.matches?.96:1);
  const a=rig.azimuth+offset.x,e=rig.elevation+offset.y;
  target.set(0,rig.targetY,0);
  camera.position.set(Math.sin(a)*Math.cos(e)*radius,rig.targetY+Math.sin(e)*radius,Math.cos(a)*Math.cos(e)*radius);
  camera.lookAt(target);camera.updateMatrixWorld();
}
function renderOnce(){if(disposed||!renderer||document.hidden||!visible)return;update(0);renderer.render(scene,camera);}
function sync(){
  const active=loaded&&visible&&!document.hidden&&!paused&&!disposed;
  hero.dataset.active=String(active);
  if(annotations)active?annotations.resume():annotations.pause();
  if(intro)active&&!drag?.active?intro.resume():intro.pause();
  if(choreography)active&&!intro&&!drag?.active?choreography.resume():choreography.pause();
  cancelAnimationFrame(frame);frame=0;last=0;
  if(active)frame=requestAnimationFrame(tick);else renderOnce();
}
function update(dt){
  time+=dt;
  offset.x=THREE.MathUtils.damp(offset.x,pointer.x,4,dt||1/60);
  offset.y=THREE.MathUtils.damp(offset.y,pointer.y,4,dt||1/60);
  if(saucer&&dt){saucer.rotateOnWorldAxis(spinAxis,-dt*saucerSpeed);saucer.position.y=saucer.userData.restY+Math.sin(time*.8)*.001;}
  setCamera();
  leds.forEach(({material,phase,slot,platform})=>{
    const pulse=platform?.5+.5*Math.sin(time*.7):beacon(phase);
    material.emissiveIntensity=lights?(slot?1.25+pulse*7:platform?3.5+pulse:2+pulse*5):0;
    if(slot)material.color.copy(slotOff).lerp(slotOn,lights?.3+pulse*.7:0);
    else material.color.set(lights?0x087bff:0x80909c);
  });
  glows.forEach(({sprite,phase,platform})=>{sprite.material.opacity=lights?(platform?.68:.28+beacon(phase)*.68):0;});
  hulls.forEach(material=>{material.emissiveIntensity=lights?.28:0;});
  pulseLights.forEach((light,i)=>{light.intensity=lights?.024+Math.sin(time*.7-i)*.004:0;});
  if(glow)glow.material.opacity=lights?.62:.015;
  if(scan){scan.position.y=.025+(time%9)/9*.335;scan.material.opacity=paused?.06:Math.sin((time%9)/9*Math.PI)*.22;}
  effectRings.forEach((line,i)=>{
    const phase=(time*(isNight?.14:.11)+i/effectRings.length)%1;
    line.scale.setScalar(isNight?.82+phase*.48:.68+phase*.72);
    line.material.opacity=(isNight?.24:.2)*Math.sin(phase*Math.PI);
    if(isNight)line.rotation.y=-time*.12+i*.7;
  });
  soundWaves.forEach((wave,i)=>{
    const phase=(time*.24+i/soundWaves.length)%1;
    wave.scale.setScalar(.7+phase*1.35);
    wave.position.y=.322+levitationLift+Math.sin(time*.8)*.001;
    wave.material.opacity=(isNight?.24:.19)*Math.sin(phase*Math.PI)**2;
  });
  annotationNodes.forEach((node,i)=>{
    projection.copy(annotationPositions[i]).project(camera);
    const x=(projection.x*.5+.5)*width,y=(-projection.y*.5+.5)*height;
    node.style.transform=`translate3d(${THREE.MathUtils.clamp(x,95,width-120)}px,${THREE.MathUtils.clamp(y,55,height-90)}px,0)`;
  });
  // Expose a low-frequency diagnostic without mutating DOM on every frame.
  const telemetry=Math.floor(time*2);
  if(telemetry!==lastTelemetry){
    lastTelemetry=telemetry;hero.dataset.motion=paused?'paused':'playing';
    canvas.dataset.frame=String(Math.round(time*10));
    canvas.dataset.camera=[rig.azimuth,rig.elevation,rig.radius,rig.targetY].map(n=>n.toFixed(3)).join(',');
    canvas.dataset.saucerAngle=saucer?saucer.rotation.y.toFixed(3):'0';
  }
}
function tick(now){
  frame=0;if(disposed||paused||!visible||document.hidden)return;
  const raw=last?(now-last)/1000:0;last=now;
  update(Math.min(raw,.05));renderer.render(scene,camera);
  if(++performanceFrames<180&&raw>.035)slowFrames++;
  if(performanceFrames===180&&slowFrames>65&&dpr>1){dpr=1;renderer.setPixelRatio(1);resize();}
  frame=requestAnimationFrame(tick);
}
function resize(){
  if(!renderer)return;
  const bounds=stage.getBoundingClientRect();width=bounds.width;height=bounds.height;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderOnce();
}
function texture(colors){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,0,64,64,64);colors.forEach(([at,color])=>g.addColorStop(at,color));
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);resources.add(t);return t;
}
function ring(radius,y,opacity){
  const points=Array.from({length:129},(_,i)=>new THREE.Vector3(Math.cos(i/128*Math.PI*2)*radius,y,Math.sin(i/128*Math.PI*2)*radius));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x4388c9,transparent:true,opacity,depthWrite:false}));scene.add(line);return line;
}
function animate(){
  choreography?.kill();annotations?.kill();intro?.kill();
  choreography=annotations=intro=null;
  Object.assign(rig,rest);
  const elements=annotationNodes.map(n=>n.firstElementChild);
  if(reduced.matches){if(elements.length)gsap.set(elements,{autoAlpha:0});return;}
  choreography=gsap.timeline({repeat:-1,defaults:{ease:'sine.inOut'},paused:true});
  if(isProduct){
    if(productView==='full'){
      choreography.fromTo(rig,{azimuth:rest.azimuth},{azimuth:rest.azimuth-Math.PI*2,duration:36,ease:'none',immediateRender:false});
    }else if(productView==='detail'){
      choreography.to(rig,{azimuth:.8,elevation:1.16,radius:.35,duration:6})
        .to(rig,{azimuth:1.75,elevation:.46,radius:.36,duration:6})
        .to(rig,{...rest,duration:8});
    }else{
      choreography.to(rig,{azimuth:1.92,elevation:.13,duration:6})
        .to(rig,{azimuth:1.22,elevation:.06,duration:8})
        .to(rig,{...rest,duration:6});
    }
  }else if(isAmbience){
    choreography.fromTo(rig,{azimuth:.7},{azimuth:.7-Math.PI*2,duration:32,ease:'none',immediateRender:false},0)
      .to(rig,{elevation:.32,radius:.82,duration:12},0)
      .to(rig,{elevation:.1,radius:.79,duration:12},12)
      .to(rig,{elevation:rest.elevation,radius:rest.radius,targetY:rest.targetY,duration:8},24);
  }else if(isNight){
    // A close overhead spiral changes the view of the crown and illuminated slots.
    choreography.fromTo(rig,{azimuth:-.45},{azimuth:-.45+Math.PI*2,duration:22,ease:'none',immediateRender:false},0)
      .to(rig,{elevation:1.32,radius:.32,targetY:.307,duration:6},0)
      .to(rig,{elevation:.44,radius:.36,targetY:.306,duration:6},6)
      .to(rig,{elevation:1.04,radius:.29,targetY:.31,duration:5},12)
      .to(rig,{elevation:.85,radius:.32,targetY:.301,duration:5},17);
  }else{
  // Constant angular travel keeps the full orbit fluid; each shot changes distance and height.
  choreography.fromTo(rig,{azimuth:.52},{azimuth:.52-Math.PI*2,duration:14,ease:'none',immediateRender:false},0)
    .to(rig,{elevation:.36,radius:.78,targetY:.172,duration:2.8},0)
    .to(rig,{elevation:.15,radius:.46,targetY:.292,duration:2},2.8)
    .to(rig,{elevation:.25,radius:.73,targetY:.19,duration:1.6},4.8)
    .to(rig,{elevation:.08,radius:.81,targetY:.166,duration:3.1},6.4)
    .to(rig,{elevation:.34,radius:.8,targetY:.17,duration:2.5},9.5)
    .to(rig,{elevation:.14,radius:.84,targetY:.166,duration:2},12);
  intro=gsap.timeline({paused:true,onComplete:()=>{intro=null;sync();}})
    .fromTo(rig,{azimuth:-1.05,elevation:.28,radius:mobile.matches?.62:.48,targetY:.245},{azimuth:.52,elevation:.14,radius:.84,targetY:.166,duration:2.2,ease:'power2.inOut'});
  }
  if(elements.length)gsap.set(elements,{autoAlpha:0});
  annotations=elements.length?gsap.timeline({repeat:-1,delay:2.1,paused:true}):null;
  elements.forEach((el,i)=>{
    const start=i*5;
    annotations.fromTo(el,{autoAlpha:0,x:i===1?-32:32,y:14,rotationX:-30},{autoAlpha:1,x:0,y:0,rotationX:0,duration:1.25,ease:'power3.out'},start)
      .to(el,{autoAlpha:0,x:i===1?14:-14,y:-20,duration:1.05,ease:'power2.in'},start+3.5);
  });
}
function fail(message){loaded=false;hero.dataset.model='fallback';hero.setAttribute('aria-busy','false');const loading=hero.querySelector('.orbit-loading');if(loading)loading.textContent='3D view unavailable';announce(message);pauseButton.disabled=true;replayButton.disabled=true;lightButton.disabled=true;sync();}
function initialize(){
if(started||disposed)return;started=true;
try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile.matches,powerPreference:'low-power'});
  dpr=Math.min(devicePixelRatio,mobile.matches?1.5:1.75);renderer.setPixelRatio(dpr);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=isNight?.72:.92;
  renderer.setClearColor(0xf0f2f4,0);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=isNight?.62:1.05;
  room.dispose();pmrem.dispose();
  key=new THREE.DirectionalLight(0xffffff,isNight?1.7:2.5);key.position.set(-.4,.6,.7);scene.add(key);
  fill=new THREE.DirectionalLight(isNight?0x348fff:0xb4d5ff,isNight?2.2:.9);fill.position.set(.5,.35,-.5);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff,0x637995,.45));
  for(const x of [-.048,.048]){const light=new THREE.PointLight(0x0787ff,.006,.16,2);light.position.set(x,.286,.025);scene.add(light);pulseLights.push(light);}
  const shadowTex=texture([[0,'rgba(18,34,54,.36)'],[.38,'rgba(18,34,54,.14)'],[1,'rgba(18,34,54,0)']]);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.37,.37),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.001;scene.add(shadow);
  const blueTex=texture([[0,'rgba(70,175,255,.9)'],[.2,'rgba(36,141,255,.45)'],[1,'rgba(0,93,255,0)']]);
  glow=new THREE.Mesh(new THREE.PlaneGeometry(.27,.27),new THREE.MeshBasicMaterial({map:blueTex,transparent:true,opacity:.15,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=.281;scene.add(glow);
  if(isHero){ring(.145,.0002,.16);ring(.165,.0002,.07);scan=ring(.108,0,.15);}
  else if(isNight){
    // Fragmented optical arcs sit below the floating saucer, not on its surface.
    for(let j=0;j<3;j++){
      const points=Array.from({length:81},(_,i)=>{const a=i/80*Math.PI*1.52;return new THREE.Vector3(Math.cos(a)*(.106+j*.01),0,Math.sin(a)*(.106+j*.01));});
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x359bff,transparent:true,opacity:.2,depthWrite:false}));
      line.position.y=.284;scene.add(line);effectRings.push(line);
    }
  }else{ring(.145,.0002,.1);}
  // Shared wire geometry depicts sound expanding evenly around the speaker.
  // Presentation graphics, not an acoustic measurement or added model detail.
  if(isHero||isNight||isAmbience){
    const positions=[],segments=mobile.matches?48:72;
    for(const height of [-.016,0,.016])for(let i=0;i<segments;i++)for(const step of [i,i+1]){
      const angle=step/segments*Math.PI*2,radius=height===0?.104:.096;
      positions.push(Math.cos(angle)*radius,height,Math.sin(angle)*radius);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    for(let i=0;i<3;i++){
      const wave=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x238aff,transparent:true,opacity:0,depthWrite:false}));
      scene.add(wave);soundWaves.push(wave);
    }
  }
  const ticks=[];for(let i=0;i<64;i++){const angle=i*Math.PI/32;for(const radius of [.168,i%4===0?.176:.171])ticks.push(new THREE.Vector3(Math.cos(angle)*radius,.0003,Math.sin(angle)*radius));}
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks),new THREE.LineBasicMaterial({color:0x547899,transparent:true,opacity:.2})));
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
  loadModel().then(gltf=>{
    if(disposed)return;
    root=gltf.scene.clone(true);
    root.traverse(object=>{if(object.isMesh){object.geometry=object.geometry.clone();object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();}});
    saucer=root.getObjectByName('UFO');
    if(!saucer||!root.getObjectByName('Stand'))return fail('The 3D model is unavailable. Product details are still available below.');
    saucer.position.y+=levitationLift;
    saucer.userData.restY=saucer.position.y;
    let index=0;root.traverse(object=>{
      if(!object.isMesh)return;
      if(object.material.name==='DarkHull'){object.material.emissive.set(0x0634a0);object.material.emissiveIntensity=.14;hulls.push(object.material);}
      if(object.material.name.startsWith('LED_')){
        object.material=object.material.clone();object.material.toneMapped=false;object.material.emissive.set(0x0088ff);object.material.color.set(0x087bff);
        let parent=object,platform=true;while(parent){if(parent===saucer){platform=false;break;}parent=parent.parent;}
        const phase=index++*Math.PI/6;leds.push({material:object.material,phase,platform});
      }
    });
    const slots=addSlotLights(root);leds.push(...slots);
    for(const {position,phase} of slots){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:blueTex,color:0x61caff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
      sprite.position.copy(position);sprite.scale.set(.0045,.0045,1);saucer.add(sprite);glows.push({sprite,phase});
    }
    hero.dataset.slotCount=String(root.userData.slotCount);
    const pointGeometry=new THREE.SphereGeometry(.00075,8,6);
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6,phase=angle;
      for(const [parent,radius,y] of [[root,.072,.2806],[saucer,.0648,.309]]){
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:blueTex,color:0x2588ff,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));
        sprite.position.set(Math.cos(angle)*radius,y,Math.sin(angle)*radius);sprite.scale.set(.012,.012,1);parent.add(sprite);glows.push({sprite,phase,platform:parent===root});
        if(parent===saucer){const material=new THREE.MeshStandardMaterial({color:0x087bff,emissive:0x007aff,emissiveIntensity:1,toneMapped:false});const point=new THREE.Mesh(pointGeometry,material);point.position.copy(sprite.position);parent.add(point);leds.push({material,phase});}
      }
    }
    scene.add(root);loaded=true;hero.dataset.model='ready';hero.setAttribute('aria-busy','false');pauseButton.disabled=false;replayButton.disabled=false;lightButton.disabled=false;
    announce('Drag to explore · scroll to discover');animate();setPause(reduced.matches);if(isAmbience)setAmbience(hero.dataset.lighting||'day');renderOnce();
  }).catch(()=>fail('The 3D model could not load. Reload the page to try again.'));
}catch{fail('Live 3D requires WebGL. Try another browser to explore the model.');}
}

pauseButton.addEventListener('click',()=>setPause(!paused),options);
lightButton.addEventListener('click',()=>setLights(!lights),options);
replayButton.addEventListener('click',()=>{pointer.x=pointer.y=0;offset.x=offset.y=0;animate();setPause(reduced.matches);},options);
hero.querySelectorAll('[data-orbit-view]').forEach(button=>button.addEventListener('click',()=>setProductView(button.dataset.orbitView),options));
hero.querySelectorAll('[data-light]').forEach(button=>button.addEventListener('click',()=>setAmbience(button.dataset.light),options));
canvas.addEventListener('pointerdown',e=>{if(!loaded||!e.isPrimary)return;drag={x:e.clientX,y:e.clientY,startX:pointer.x,startY:pointer.y,active:false,touch:e.pointerType==='touch'};},options);
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.active){
    if(Math.hypot(dx,dy)<(drag.touch?8:3))return;
    if(drag.touch&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
    drag.active=true;canvas.setPointerCapture(e.pointerId);sync();
  }
  pointer.x=drag.startX-dx*(drag.touch?.009:.006);
  pointer.y=THREE.MathUtils.clamp(drag.startY+dy*.003,-.12,.35);
  if(paused){offset.x=pointer.x;offset.y=pointer.y;renderOnce();}
},options);
function endDrag(){const active=drag?.active;drag=null;if(active)sync();}
canvas.addEventListener('pointerup',endDrag,options);
canvas.addEventListener('pointercancel',endDrag,options);
canvas.addEventListener('lostpointercapture',endDrag,options);
canvas.addEventListener('pointerleave',()=>{if(!drag?.active)drag=null;},options);
canvas.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home',' '].includes(e.key))return;
  e.preventDefault();if(e.key===' '){setPause(!paused);return;}if(e.key==='Home'){replayButton.click();return;}
  pointer.x+=(e.key==='ArrowLeft'?.15:e.key==='ArrowRight'?-.15:0);
  pointer.y=THREE.MathUtils.clamp(pointer.y+(e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0),-.12,.35);renderOnce();
},options);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);fail('The 3D view paused. Reload the page to restore it.');},options);
visibilityObserver=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:0});visibilityObserver.observe(stage);
loadObserver=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){initialize();loadObserver.disconnect();}},{rootMargin:'240px'});loadObserver.observe(stage);
document.addEventListener('visibilitychange',sync,options);
reduced.addEventListener('change',()=>{animate();setPause(reduced.matches);},options);
mobile.addEventListener('change',resize,options);
window.addEventListener('pageshow',sync,options);
window.addEventListener('pagehide',event=>{
  cancelAnimationFrame(frame);frame=0;for(const t of [choreography,annotations,intro])t?.pause();
  if(event.persisted)return;
  disposed=true;lifecycle.abort();resizeObserver?.disconnect();visibilityObserver?.disconnect();loadObserver?.disconnect();
  for(const t of [choreography,annotations,intro])t?.kill();
  scene.traverse(object=>{object.geometry?.dispose();if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
  resources.forEach(resource=>resource.dispose());environment?.dispose();renderer?.dispose();
},options);
}
