export interface Actions {jump():void;slide(held:boolean):void;pause():void;active():boolean;}
export class Controls {
 private keys=new Set<string>();private pointers=new Map<number,'jump'|'slide'>();private abort=new AbortController();private buttonAbort=new AbortController();
 constructor(private actions:Actions){
  const options={signal:this.abort.signal};
  window.addEventListener('keydown',e=>{
   if(!actions.active())return;
   if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
   if(e.repeat||this.keys.has(e.code))return;
   this.keys.add(e.code);
   if(e.code==='Space'||e.code==='ArrowUp')actions.jump();
   if(e.code==='ArrowDown')actions.slide(true);
   if(e.code==='Escape'||e.code==='KeyP')actions.pause();
  },options);
  window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(e.code==='ArrowDown')this.syncSlide();},options);
  const up=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);this.syncSlide();};
  window.addEventListener('pointerup',up,options);window.addEventListener('pointercancel',up,options);
 }
 bind(root:HTMLElement){
  this.buttonAbort.abort();this.buttonAbort=new AbortController();
  root.querySelectorAll<HTMLElement>('[data-control]').forEach(button=>{
   button.addEventListener('pointerdown',e=>{
    e.preventDefault();if(!this.actions.active()||this.pointers.has(e.pointerId))return;
    const type=button.dataset.control as 'jump'|'slide';this.pointers.set(e.pointerId,type);button.setPointerCapture?.(e.pointerId);
    if(type==='jump')this.actions.jump();else this.syncSlide();
   },{signal:this.buttonAbort.signal});
   button.addEventListener('lostpointercapture',e=>{this.pointers.delete(e.pointerId);this.syncSlide();},{signal:this.buttonAbort.signal});
   // Keyboard activation of the semantic buttons. Touch never generates another action via click.
   button.addEventListener('keydown',e=>{if((e.code==='Enter'||e.code==='Space')&&!e.repeat){e.preventDefault();if(!this.actions.active())return;if(button.dataset.control==='jump')this.actions.jump();else this.actions.slide(true);}},{signal:this.buttonAbort.signal});
   button.addEventListener('keyup',e=>{if(e.code==='Enter'||e.code==='Space')this.syncSlide();},{signal:this.buttonAbort.signal});
  });
 }
 private syncSlide(){this.actions.slide(this.keys.has('ArrowDown')||[...this.pointers.values()].includes('slide'));}
 clear(){this.buttonAbort.abort();this.keys.clear();this.pointers.clear();this.actions.slide(false);}
 destroy(){this.clear();this.abort.abort();}
}
