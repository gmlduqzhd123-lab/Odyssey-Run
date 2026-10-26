export interface Actions {jump():void;slide(held:boolean):void;pause():void;active():boolean;pauseActive?():boolean;}
export class Controls {
 private keys=new Set<string>();private pointers=new Map<number,'jump'|'slide'>();private buttonKeys=new Map<string,'jump'|'slide'>();private abort=new AbortController();private buttonAbort=new AbortController();
 constructor(private actions:Actions){
  const options={signal:this.abort.signal};
  window.addEventListener('keydown',e=>{
   if(e.code==='Escape'||e.code==='KeyP'){
    if(!(actions.pauseActive?.()??actions.active())||e.repeat||this.keys.has(e.code))return;
    e.preventDefault();this.keys.add(e.code);actions.pause();return;
   }
   if(!actions.active())return;
   // Let focused semantic buttons handle Space exactly once, including Pause.
   if(e.code==='Space'&&(e.target as Element|null)?.closest?.('button,input,select,textarea,[contenteditable="true"]'))return;
   if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
   if(e.repeat||this.keys.has(e.code))return;
   this.keys.add(e.code);
   if(e.code==='Space'||e.code==='ArrowUp')actions.jump();
   if(e.code==='ArrowDown')actions.slide(true);
  },options);
  window.addEventListener('keyup',e=>{this.keys.delete(e.code);const button=this.buttonKeys.delete(e.code);if(e.code==='ArrowDown'||button)this.syncSlide();},options);
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
   button.addEventListener('keydown',e=>{
    if(e.code!=='Enter'&&e.code!=='Space')return;
    e.preventDefault();if(!this.actions.active()||e.repeat||this.buttonKeys.has(e.code))return;
    const type=button.dataset.control as 'jump'|'slide';this.buttonKeys.set(e.code,type);
    if(type==='jump')this.actions.jump();else this.syncSlide();
   },{signal:this.buttonAbort.signal});
  });
 }
 private syncSlide(){this.actions.slide(this.keys.has('ArrowDown')||[...this.pointers.values()].includes('slide')||[...this.buttonKeys.values()].includes('slide'));}
 clear(){this.buttonAbort.abort();this.keys.clear();this.pointers.clear();this.buttonKeys.clear();this.actions.slide(false);}
 destroy(){this.clear();this.abort.abort();}
}
