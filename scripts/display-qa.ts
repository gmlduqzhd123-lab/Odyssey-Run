import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const phase=process.env.QA_PHASE||'after',after=phase!=='before';
const url=process.env.QA_URL||'http://localhost:4176/Odyssey-Run/';
const production=url.startsWith('https:');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],...(production?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY!}}:{})});
const devices=[{name:'desktop-1x',width:1280,height:800,dpr:1,mobile:false},{name:'desktop-2x',width:1280,height:800,dpr:2,mobile:false},{name:'mobile-2x',width:844,height:390,dpr:2,mobile:true}];
const results:any[]=[],errors:string[]=[],failures:string[]=[];
try{
 for(const device of devices){
  const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.dpr,hasTouch:device.mobile,isMobile:device.mobile});
  await ctx.addInitScript(()=>{
   Object.defineProperty(window,'__name',{value:Function('fn','return fn'),configurable:true});
   const q={backgrounds:{} as Record<string,number>,actor:null as any,poses:[] as string[],patternOffsets:{} as Record<string,number>};(window as any).__displayQA=q;
   let serial=0;const ids=new WeakMap<object,number>();const id=(o:object)=>{if(!ids.has(o))ids.set(o,++serial);return ids.get(o)!;};
   const draw=CanvasRenderingContext2D.prototype.drawImage,fill=CanvasRenderingContext2D.prototype.fillRect;
   CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...a:any[]){
    const s=a[0],m=this.getTransform(),main=this.canvas.parentElement?.id==='game',rect=this.canvas.getBoundingClientRect(),scale=Math.min(rect.width/960,rect.height/540),density=this.canvas.width/(rect.width/scale),extra=rect.height/scale-540;
    if(main&&s instanceof HTMLImageElement){
     const w=s.naturalWidth,h=s.naturalHeight;
     if(Math.abs(w/h-1600/540)<.001&&h>=540)q.backgrounds['image-'+id(s)]=m.e/density;
     if((w===768&&h===512||w===1536&&h===1024)&&a[4]>100){q.actor={frame:a.slice(1,5).join(','),anchorX:m.e/this.canvas.width*960,anchorY:m.f/density-extra,a:m.a/density,d:m.d/density,dx:a[5],dy:a[6]};if(!q.poses.includes(q.actor.frame))q.poses.push(q.actor.frame);}
    }
    return (draw as Function).apply(this,a);
   } as typeof draw;
   CanvasRenderingContext2D.prototype.fillRect=function(this:CanvasRenderingContext2D,...a:[number,number,number,number]){if(this.fillStyle instanceof CanvasPattern&&this.canvas.width===960&&this.canvas.height===540)q.patternOffsets['pattern-'+id(this.canvas)]=this.getTransform().e;return fill.apply(this,a);};
  });
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});await p.clock.install();await p.goto(url);await p.waitForSelector('.home');await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1000);
  const start=async(reduced:boolean)=>{await p.locator('[data-action="settings"]').click();await p.locator('[data-setting="reducedMotion"]').setChecked(reduced);await p.locator('[data-action="home"]').click();await p.locator('[data-action="islands"]').first().click();await p.locator('[data-action="stage:beach"]').click();await p.evaluate(()=>(window as any).__displayQA.poses=[]);await p.locator('[data-action="start"]').click();let readyTries=0;while(await p.locator('.countdown').count()&&readyTries++<20)await p.clock.runFor(500);await expect(p.locator('.countdown')).toHaveCount(0);let tries=0;while(Number(await p.locator('#progress').getAttribute('data-distance'))<640&&tries++<160)await p.clock.runFor(17);};
  const sample=()=>p.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('#game canvas')!,r=c.getBoundingClientRect(),q=(window as any).__displayQA;return {canvas:[c.width,c.height],css:[r.width,r.height],dpr:devicePixelRatio,pixelsPerDevicePixel:c.width/(r.width*devicePixelRatio),distance:Number(document.querySelector<HTMLElement>('#progress')!.dataset.distance),actor:q.actor,backgrounds:{...q.backgrounds},patternOffsets:{...q.patternOffsets},poses:[...q.poses],hudFont:getComputedStyle(document.querySelector('#score')!).fontSize};});
  await start(false);const normalA=await sample();await p.screenshot({path:`artifacts/display-${phase}-${device.name}.png`});await p.clock.runFor(250);const normalB=await sample();
  if(after){expect(normalA.canvas[0]).toBeGreaterThanOrEqual(normalA.css[0]*Math.min(device.dpr,2)-1);expect(normalA.actor.anchorX).toBeCloseTo(192,5);expect(normalA.actor.anchorY).toBeCloseTo(440,5);expect(Object.keys(normalA.backgrounds).length).toBeGreaterThanOrEqual(3);}
  await p.keyboard.press('p');await p.locator('[data-action="islands"]').click();await p.locator('[data-action="home"]').click();await start(true);const reducedA=await sample();await p.clock.runFor(250);const reducedB=await sample();await p.screenshot({path:`artifacts/display-${phase}-${device.name}-reduced.png`});
  if(after){expect(reducedB.backgrounds).toEqual(reducedA.backgrounds);expect(reducedB.distance).toBeGreaterThan(reducedA.distance);await p.clock.runFor(800);expect((await sample()).poses.length).toBe(8);}
  if(after&&device.mobile){const records=await p.evaluate(()=>JSON.stringify(Object.entries(localStorage)));await p.setViewportSize({width:390,height:844});await expect(p.locator('#rotate')).toBeVisible();await p.setViewportSize({width:844,height:390});await expect(p.locator('[data-action="resume"]')).toBeVisible();await p.locator('[data-action="resume"]').click();await p.clock.runFor(4000);await p.locator('[data-control="jump"]').tap();await p.clock.runFor(100);await expect(p.locator('#hp')).toHaveAttribute('aria-label','체력 3');expect(await p.evaluate(()=>JSON.stringify(Object.entries(localStorage)))).toBe(records);}
  results.push({device,normalA,normalB,reducedA,reducedB});await ctx.close();console.log(phase,device.name,'captured');
 }
 // Real-time measurement: no virtual clock, one browser page at a time.
 const performanceResults=[];
 for(const device of devices.filter(d=>d.name!=='desktop-1x'&&process.env.QA_PERFORMANCE!=='0')){
  const c=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.dpr,hasTouch:device.mobile,isMobile:device.mobile});const p=await c.newPage();await p.goto(url);await p.waitForSelector('.home');await p.locator('[data-action="islands"]').first().click();await p.locator('[data-action="stage:beach"]').click();await p.locator('[data-action="start"]').click();await p.waitForSelector('.countdown',{state:'detached'});
  const metrics=await p.evaluate(`new Promise(resolve=>{const times=[];const start=performance.now(),x=Number(document.querySelector('#progress').dataset.distance);function frame(t){times.push(t);if(t-start<10000){requestAnimationFrame(frame);return;}const intervals=times.slice(1).map((v,i)=>v-times[i]).sort((a,b)=>a-b);resolve({elapsedMs:t-start,fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],distance:Number(document.querySelector('#progress').dataset.distance)-x});}requestAnimationFrame(frame);})`);performanceResults.push({device,metrics});await c.close();console.log(phase,device.name,JSON.stringify(metrics));
 }
 expect(errors).toEqual([]);expect(failures).toEqual([]);await writeFile(`artifacts/display-${phase}-results.json`,JSON.stringify({url,checkedAt:new Date().toISOString(),browser:await browser.version(),environment:'Linux headless Chromium; mobile emulation; no physical phone or subjective comfort rating',results,performanceResults,errors,failures},null,2));
}finally{await browser.close();}
