import {gsap} from 'gsap';

const TURN=Math.PI*2;
const framing=({elevation,radius,targetY,targetX=0,roll=0})=>({elevation,radius,targetY,targetX,roll});

// A camera lap always returns to the same composition. Azimuth advances by one
// complete revolution independently, so every repeat has the same position and
// angular velocity. Only the framing track eases between individual shots.
export function createOrbitCameraPath({rig,rest,mode,productView='full',compact=false,onIntroComplete}){
  const macro=mode==='nocturne'||(mode==='product'&&productView==='detail');
  const start={...rest,targetX:0,roll:0,radius:Math.max(rest.radius,macro?(compact?.4:.3):.7)};
  const close=(desktop,phone)=>compact?phone:desktop;
  let duration,direction=-1,shots;

  if(mode==='hero'){
    duration=14;
    shots=[
      [2.2,{elevation:.07,radius:.77,targetY:.171,targetX:-.008,roll:-.018}],
      [2.8,{elevation:1.05,radius:.72,targetY:.184,targetX:.006,roll:.014}],
      [2.6,{elevation:.4,radius:close(.34,.48),targetY:.323,targetX:.009,roll:.027}],
      [2.4,{elevation:.23,radius:.78,targetY:.18,targetX:-.008,roll:-.021}],
      [2,{elevation:.025,radius:.82,targetY:.169,targetX:-.004,roll:-.009}],
      [2,framing(start)]
    ];
  }else if(mode==='product'&&productView==='detail'){
    duration=13;direction=1;
    shots=[
      [2.7,{elevation:1.19,radius:close(.38,.48),targetY:.324,targetX:-.005,roll:.011}],
      [2.6,{elevation:.61,radius:close(.31,.43),targetY:.326,targetX:.006,roll:-.014}],
      [2.7,{elevation:.25,radius:close(.37,.49),targetY:.32,targetX:.005,roll:.009}],
      [2.5,{elevation:1.02,radius:close(.41,.52),targetY:.315,targetX:-.006,roll:-.009}],
      [2.5,framing(start)]
    ];
  }else if(mode==='product'){
    duration=18;
    const profile=productView==='profile';
    shots=[
      [3.6,{elevation:profile?.12:.35,radius:.74,targetY:.176,targetX:-.008,roll:-.01}],
      [3.8,{elevation:profile?.4:.91,radius:.76,targetY:.18,targetX:.008,roll:.013}],
      [3.7,{elevation:.035,radius:.8,targetY:.167,targetX:.007,roll:.008}],
      [3.4,{elevation:profile?.2:.46,radius:.73,targetY:.175,targetX:-.006,roll:-.012}],
      [3.5,framing(start)]
    ];
  }else if(mode==='nocturne'){
    duration=16;direction=1;
    shots=[
      [3.2,{elevation:.21,radius:close(.36,.47),targetY:.321,targetX:.009,roll:.028}],
      [3.4,{elevation:1.24,radius:close(.43,.54),targetY:.322,targetX:-.006,roll:-.018}],
      [3.1,{elevation:.57,radius:close(.31,.43),targetY:.327,targetX:-.009,roll:-.028}],
      [3.2,{elevation:.1,radius:close(.42,.54),targetY:.319,targetX:.007,roll:.019}],
      [3.1,framing(start)]
    ];
  }else{
    // Day/night has an architectural, full-object sweep rather than a macro.
    duration=20;
    shots=[
      [4,{elevation:.08,radius:.75,targetY:.17,targetX:-.01,roll:-.012}],
      [4.5,{elevation:.73,radius:.81,targetY:.183,targetX:.006,roll:.016}],
      [4,{elevation:.34,radius:.72,targetY:.179,targetX:.01,roll:.008}],
      [3.5,{elevation:.025,radius:.82,targetY:.169,targetX:-.007,roll:-.014}],
      [4,framing(start)]
    ];
  }

  // Phone compositions retain more breathing room during the higher passes.
  if(compact)for(const [,shot] of shots){
    shot.radius=Math.max(shot.radius,shot.targetY>.27?.4:.7);
    shot.targetX*=.65;shot.roll*=.7;
  }
  const choreography=gsap.timeline({paused:true,repeat:-1,defaults:{ease:'sine.inOut'}});
  choreography.fromTo(rig,{azimuth:start.azimuth},{azimuth:start.azimuth+direction*TURN,duration,ease:'none',immediateRender:false},0);
  let position=0;
  shots.forEach(([seconds,shot],index)=>{
    const to={...framing(shot),duration:seconds};
    if(index===0)choreography.fromTo(rig,framing(start),{...to,immediateRender:false},position);
    else choreography.to(rig,to,position);
    position+=seconds;
  });

  let intro=null;
  if(mode==='hero'){
    intro=gsap.timeline({paused:true,onComplete:onIntroComplete});
    intro.fromTo(rig,{azimuth:start.azimuth+.95,elevation:.61,radius:close(.34,.48),targetY:.323,targetX:-.008,roll:-.025},
      {...start,duration:2.1,ease:'power2.inOut'});
  }
  return {choreography,intro};
}
