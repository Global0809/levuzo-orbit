// Pointer events cover mouse, pen and touch. CSS chooses native scroll/pinch behavior.
export function bindOrbitInput({canvas,signal,enabled,onBegin,onDrag,onEnd}){
  let gesture=null;
  const options={signal};
  function finish(){
    if(!gesture)return;
    const previous=gesture;gesture=null;
    if(canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);
    onEnd(previous.moved);
  }
  canvas.addEventListener('pointerdown',event=>{
    // A second finger belongs to the browser's pinch zoom, not another orbit.
    if(!event.isPrimary){finish();return;}
    if(!enabled()||event.button>0)return;
    finish();
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,touch:event.pointerType==='touch',moved:false};
    onBegin();
    canvas.setPointerCapture(event.pointerId);
  },options);
  canvas.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.moved&&Math.hypot(dx,dy)<2)return;
    gesture.moved=true;
    onDrag(dx,dy,gesture.touch);
  },options);
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(type,event=>{if(event.pointerId===gesture?.id)finish();},options);
  }
  signal.addEventListener('abort',finish,{once:true});
  return {cancel:finish};
}
