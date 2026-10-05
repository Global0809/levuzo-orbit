import assert from 'node:assert/strict';
import {bindOrbitInput} from '../src/orbit-input.js';

class Canvas extends EventTarget{
  captures=new Set();
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.emit('lostpointercapture',{pointerId:id});}
  emit(type,fields={}){const event=new Event(type);Object.assign(event,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:100,clientY:100,...fields});this.dispatchEvent(event);}
}
const canvas=new Canvas(),lifecycle=new AbortController(),moves=[],ends=[];
let enabled=true,begins=0;
bindOrbitInput({canvas,signal:lifecycle.signal,enabled:()=>enabled,onBegin:()=>begins++,onDrag:(...args)=>moves.push(args),onEnd:moved=>ends.push(moved)});

// Regression: a vertical one-finger drag must orbit, not be discarded.
canvas.emit('pointerdown');canvas.emit('pointermove',{clientY:165});
assert.deepEqual(moves.at(-1),[0,65,true]);assert.ok(canvas.hasPointerCapture(1));
canvas.emit('pointermove',{clientX:160,clientY:140});
assert.deepEqual(moves.at(-1),[60,40,true]);
canvas.emit('pointerup');assert.deepEqual(ends,[true]);assert.equal(canvas.captures.size,0);

// Scroll mode must leave a touch gesture completely to native scrolling.
enabled=false;canvas.emit('pointerdown');canvas.emit('pointermove',{clientY:200});canvas.emit('pointerup');
assert.equal(begins,1);assert.equal(moves.length,2);

// Native pinch/cancel must not strand the camera in a held interaction.
enabled=true;canvas.emit('pointerdown');canvas.emit('pointerdown',{pointerId:2,isPrimary:false});
assert.deepEqual(ends,[true,false]);assert.equal(canvas.captures.size,0);
canvas.emit('pointerdown');canvas.emit('pointercancel');assert.equal(ends.length,3);

// Ignore movement from another pointer; abort cleans up an active gesture.
canvas.emit('pointerdown');canvas.emit('pointermove',{pointerId:2,clientY:230});
assert.equal(moves.length,2);lifecycle.abort();assert.equal(canvas.captures.size,0);
const finalBegins=begins;canvas.emit('pointerdown');assert.equal(begins,finalBegins);
console.log('Verified vertical/diagonal touch, native scroll mode, pinch cancellation and cleanup.');
