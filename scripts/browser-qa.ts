import {chromium,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
import {STAGES,COURSES} from '../src/levels/courses';
import {MONSTER_ART} from '../src/assets/expansion-art';
const base=process.env.QA_URL||'http://localhost:5173/';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:960,height:620},deviceScaleFactor:Number(process.env.QA_DPR||1),acceptDownloads:true});
await ctx.addInitScript(({frames})=>{
 const observations={messages:[] as string[],monsterFrames:[] as string[],actor:null as any};(window as any).__expansionQA=observations;
 const fill=CanvasRenderingContext2D.prototype.fillText,draw=CanvasRenderingContext2D.prototype.drawImage;
 CanvasRenderingContext2D.prototype.fillText=function(this:CanvasRenderingContext2D,...args:Parameters<typeof fill>){if(!observations.messages.includes(args[0]))observations.messages.push(args[0]);return fill.apply(this,args);};
 CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...a:any[]){if(this.canvas.parentElement?.id==='game'&&a[0] instanceof HTMLImageElement&&a[0].naturalWidth===1536&&a[0].naturalHeight===1024&&Object.values(frames).some(f=>f.x===a[1]&&f.y===a[2])){const frame=a.slice(1,5).join(',');if(!observations.monsterFrames.includes(frame))observations.monsterFrames.push(frame);}if(this.canvas.parentElement?.id==='game'&&a[0] instanceof HTMLImageElement&&a[0].naturalWidth===768&&a[0].naturalHeight===512){const m=this.getTransform(),rect=this.canvas.getBoundingClientRect(),scale=Math.min(rect.width/960,rect.height/540),d=this.canvas.width/(rect.width/scale);observations.actor={crouched:true,x:m.e/this.canvas.width*960,y:m.f/d-(rect.height/scale-540),rotation:Math.atan2(m.b,m.a)};}else if(this.canvas.parentElement?.id==='game'&&a[0] instanceof HTMLImageElement&&a[0].naturalWidth===1536&&a[0].naturalHeight===1024&&!Object.values(frames).some(f=>f.x===a[1]&&f.y===a[2]))observations.actor={crouched:false};return (draw as Function).apply(this,a);} as typeof draw;
 },{frames:MONSTER_ART.frames});
const page=await ctx.newPage();const errors:string[]=[];const failures:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
await page.clock.install();await page.goto(base);await page.waitForSelector('.home');await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1000);
await page.screenshot({path:'artifacts/home-desktop.png'});
await page.locator('[data-action="settings"]').click();await page.locator('[data-setting="music"]').uncheck();await page.locator('[data-setting="sfx"]').uncheck();await page.locator('[data-action="home"]').click();
await page.locator('[data-action="islands"]').first().click();await expect(page.locator('[data-action="stage:cave"]')).toBeDisabled();await expect(page.locator('[data-action="stage:wind"]')).toBeDisabled();await page.screenshot({path:'artifacts/islands-desktop.png'});
const distance=async()=>Number(await page.locator('#progress').getAttribute('data-distance'));
const advanceTo=async(target:number)=>{let tries=0;while((await distance())<target&&tries++<5){const x=await distance();await page.clock.runFor(Math.max(17,Math.ceil((target-x)/320*1000)));}};
const details:unknown[]=[];
for(const id of STAGES){
 console.log('Browser route begins:',id);
 await page.locator(`[data-action="stage:${id}"]`).click();await page.locator('[data-action="start"]').click();await page.clock.runFor(4000);await expect(page.locator('.countdown')).toHaveCount(0);
 if(id==='beach'){
  // A18: hiding the document freezes both game time and countdown, with explicit resume.
  await page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));");
  const x=await distance();await page.clock.runFor(11000);expect(await distance()).toBe(x);await expect(page.locator('[data-action="resume"]')).toBeVisible();
  await page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));");
  expect(await distance()).toBe(x);await page.locator('[data-action="resume"]').click();await page.clock.runFor(4000);
 }
 const plan=routeInputs(id);
 const events=[{x:22410,type:'harbor'},...(id==='beach'?[{x:6450,type:'ceiling-release'},{x:6600,type:'ceiling-exit'},{x:COURSES.beach.items.find(i=>i.kind==='lantern')!.x+100,type:'power-pause'}]:[]),...COURSES[id].enemies.map(e=>({x:e.x-280,type:'enemy:'+e.kind})),...plan.jumps.map(x=>({x,type:'jump'})),...plan.slides.flatMap(s=>[{x:s.start,type:'down'},{x:s.end,type:'up'}])].sort((a,b)=>a.x-b.x);
 for(const event of events){await advanceTo(event.x);if(event.x>5000&&event.x<5500||event.x>10000&&event.x<10500||event.x>15000&&event.x<15500||event.x>20000&&event.x<20500)console.log(id,'input checkpoint',Math.round(await distance()));if(event.type==='ceiling-release'){await page.keyboard.up('ArrowDown');await page.keyboard.press('Space');await page.clock.runFor(34);const actor=await page.evaluate(()=>(window as any).__expansionQA.actor);expect(actor.crouched).toBe(true);expect(actor.x).toBeCloseTo(192,5);expect(actor.y).toBeCloseTo(440,5);expect(actor.rotation).toBeCloseTo(0,5);await page.screenshot({path:'artifacts/crouch-under-ceiling.png'});}else if(event.type==='ceiling-exit'){await page.clock.runFor(34);expect((await page.evaluate(()=>(window as any).__expansionQA.actor)).crouched).toBe(false);}else if(event.type==='power-pause'){const effects=await page.locator('#effects').innerText(),x=await distance();expect(effects).toContain('등불');await page.keyboard.press('p');await page.clock.runFor(11000);expect(await distance()).toBe(x);expect(await page.locator('#effects').innerText()).toBe(effects);await page.locator('[data-action="resume"]').click();await page.clock.runFor(1000);expect(await distance()).toBe(x);expect(await page.locator('#effects').innerText()).toBe(effects);let guard=0;while(await page.locator('.countdown').count()&&guard++<150)await page.clock.runFor(17);}else if(event.type.startsWith('enemy:')){await page.screenshot({path:`artifacts/encounter-${id}-${event.type.slice(6)}.png`});}else if(event.type==='jump'){await page.keyboard.down('Space');await page.keyboard.up('Space');}else if(event.type==='down'){await page.keyboard.down('ArrowDown');}else if(event.type==='harbor')await page.screenshot({path:`artifacts/${id}-harbor.png`});else await page.keyboard.up('ArrowDown');}
 await advanceTo(23400);await page.screenshot({path:`artifacts/${id}-play.png`});await page.clock.runFor(2200);
 await expect(page.locator('.result')).toBeVisible();const text=await page.locator('.result').innerText();console.log(id,text.replaceAll('\n',' | '));expect(text).toContain(id==='wind'?'마침내, 이타카!':'멋진 항해였어요!');
 const data=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith(':save')&&k.startsWith('odyssey-run:'))!;return JSON.parse(localStorage.getItem(key)!);});
 expect(data.stages[id].complete).toBe(true);expect(data.stages[id].maps.length).toBe(3);details.push({stage:id,record:data.stages[id]});
 await page.screenshot({path:`artifacts/${id}-result.png`});
 if(id==='wind')await expect(page.getByRole('button',{name:'다음 섬으로'})).toHaveCount(0);
 if(id!=='wind')await page.locator('[data-action="islands"]').click();
}
const expansion=await page.evaluate(()=>(window as any).__expansionQA);for(const text of ['삼지창 ·','등불 ·','나침반 ·','삼지창으로 격퇴!'])expect(expansion.messages.some((m:string)=>m.includes(text))).toBe(true);
for(const [kind,f] of Object.entries(MONSTER_ART.frames))expect(expansion.monsterFrames.some((v:string)=>v.startsWith(`${f.x},${f.y},`)),kind).toBe(true);
await writeFile('artifacts/expansion-browser-results.json',JSON.stringify({checkedAt:new Date().toISOString(),realKeyboardInput:true,virtualClock:true,observations:expansion,monsterCounts:Object.fromEntries(STAGES.map(id=>[id,COURSES[id].enemies])),newItemCounts:Object.fromEntries(STAGES.map(id=>[id,COURSES[id].items.filter(i=>['trident','lantern','compass'].includes(i.kind))]))},null,2));
await page.locator('[data-action="islands"]').click();await page.reload();await page.waitForSelector('.home');await page.locator('[data-action="islands"]').first().click();await expect(page.locator('[data-action="stage:wind"]')).toBeEnabled();
await page.locator('[data-action="codex"]').click();await expect(page.locator('.fragment.found')).toHaveCount(9);await page.screenshot({path:'artifacts/codex.png'});
await page.locator('[data-action="home"]').click();await page.locator('[data-action="settings"]').click();
// Export, reject malformed data, preview a valid file, then atomically replace with backup.
const dlEvent=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const dl=await dlEvent;await dl.saveAs('artifacts/exported-save.json');
const before=await page.evaluate(()=>Object.entries(localStorage));
await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.locator('#import-error')).toContainText('JSON');expect(await page.evaluate(()=>Object.entries(localStorage))).toEqual(before);
await page.locator('#import-file').setInputFiles('artifacts/exported-save.json');await expect(page.locator('[data-action="import-confirm"]')).toBeVisible();expect(await page.evaluate(()=>Object.entries(localStorage))).toEqual(before);await page.locator('[data-action="import-confirm"]').click();
expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.endsWith(':backup')))).toBe(true);
await page.evaluate(()=>localStorage.setItem('other-app-qa','keep'));
await page.locator('[data-action="reset-confirm"]').click();await page.locator('[data-action="reset"]').click();expect(await page.evaluate(()=>localStorage.getItem('other-app-qa'))).toBe('keep');expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('odyssey-run:')))).toBe(false);
// Preserve corrupt original across a played run; never overwrite it silently.
await page.evaluate(()=>{localStorage.setItem('odyssey-run:'+new URL('.',location.href).pathname+':save','{broken');});await page.reload();await page.waitForSelector('.home');await expect(page.locator('#notice')).toContainText('원본');await page.locator('[data-action="settings"]').click();await expect(page.locator('[data-action="original"]')).toBeVisible();
expect(errors).toEqual([]);expect(failures).toEqual([]);
await writeFile('artifacts/browser-results.json',JSON.stringify({base,browser:await browser.version(),viewport:`960x620 desktop Chromium, DPR ${process.env.QA_DPR||1}`,renderer:'Canvas (game default)',details,errors,failures},null,2));
await ctx.close();
// Mobile emulation: independent pointer IDs, outside release, cancel, rotation and minimum CSS targets.
const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});const m=await mobile.newPage();await m.clock.install();await m.goto(base);await m.waitForSelector('.home');await m.clock.pauseAt((await m.evaluate(()=>Date.now()))+1000);
await m.locator('[data-action="islands"]').first().click();await m.locator('[data-action="stage:beach"]').click();await m.locator('[data-action="start"]').click();await m.clock.runFor(4000);
const controls=m.locator('[data-control]');for(const b of await controls.all()){const box=await b.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(64);expect(box!.height).toBeGreaterThanOrEqual(64);}
const session=await mobile.newCDPSession(m);const jb=(await m.locator('[data-control="jump"]').boundingBox())!,sb=(await m.locator('[data-control="slide"]').boundingBox())!;
const touch=(id:number,b:typeof jb)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});
await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(11,sb)]});await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(11,sb),touch(22,jb)]});await m.clock.runFor(150);await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:11,x:420,y:180},{id:22,x:440,y:180}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.clock.runFor(900);
await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(33,sb)]});await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
await m.screenshot({path:'artifacts/mobile-play.png'});const x=Number(await m.locator('#progress').getAttribute('data-distance'));await m.setViewportSize({width:390,height:844});await expect(m.locator('#rotate')).toBeVisible();await m.clock.runFor(10000);expect(Number(await m.locator('#progress').getAttribute('data-distance'))).toBe(x);await m.screenshot({path:'artifacts/mobile-portrait.png'});await m.setViewportSize({width:844,height:390});await expect(m.locator('[data-action="resume"]')).toBeVisible();
await m.locator('[data-action="islands"]').click();await m.setViewportSize({width:1024,height:768});await m.screenshot({path:'artifacts/tablet-islands.png'});
await mobile.close();await browser.close();console.log('Browser QA passed. Artifacts written.');
