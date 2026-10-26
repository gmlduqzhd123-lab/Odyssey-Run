import {chromium,webkit,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
const url=process.env.QA_URL||'http://localhost:4176/Odyssey-Run/',phase=process.env.QA_PHASE||'after',production=url.startsWith('https:'),engine=process.env.QA_ENGINE||'chromium',smoke=process.env.QA_SMOKE==='1',prefix=`contact-${production?'deployed-':''}${phase}${engine==='webkit'?'-webkit':''}`;
const b=await (engine==='webkit'?webkit:chromium).launch({...(engine==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{}),...(production?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY!}}:{})});
const errors:string[]=[],failures:string[]=[],results:any[]=[];
try{
 for(const mobile of [false,true]){
  const c=await b.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile,acceptDownloads:true});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});await p.clock.install();const response=await p.goto(url);await p.waitForSelector('.home');await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1000);
  const bundle=await p.locator('script[type="module"]').getAttribute('src');
  if(phase==='after')expect(bundle).toBe((await readFile('dist/index.html','utf8')).match(/<script(?=[^>]*type="module")[^>]*src="([^"]+)"/)![1]);
  const click=async(s:string)=>mobile?p.locator(s).first().tap():p.locator(s).first().click();
  await click('[data-action="settings"]');await p.locator('[data-setting="music"]').uncheck();await p.locator('[data-setting="sfx"]').uncheck();await click('[data-action="home"]');await click('[data-action="islands"]');await click('[data-action="stage:beach"]');await click('[data-action="start"]');
  while(await p.locator('.countdown').count())await p.clock.runFor(17);
  const distance=async()=>Number(await p.locator('#progress').getAttribute('data-distance'));
  const advance=async(x:number)=>{while(await distance()<x){await expect(p.locator('.result')).toHaveCount(0);await p.clock.runFor(Math.max(17,Math.ceil((x-await distance())/320*1000)));}};
  await advance(800);await p.screenshot({path:`artifacts/${prefix}-${mobile?'mobile':'desktop'}-before-pickup.png`});
  while((await p.locator('#stars').innerText()).startsWith('✦ 0 '))await p.clock.runFor(17);
  const firstStarX=await distance();await p.screenshot({path:`artifacts/${prefix}-${mobile?'mobile':'desktop'}-pickup.png`});
  if(phase==='after')expect(firstStarX).toBeGreaterThan(830);
  const runs:any[]=[];
  if(phase==='after'&&!smoke){
   const session=mobile?await c.newCDPSession(p):null;let held:any=null;
   const point=async(type:string,id:number)=>{const box=(await p.locator(`[data-control="${type}"]`).boundingBox())!;return {id,x:box.x+box.width/2,y:box.y+box.height/2};};
   const input=async(type:string)=>{if(!mobile){if(type==='jump')await p.keyboard.press('Space');else if(type==='down')await p.keyboard.down('ArrowDown');else await p.keyboard.up('ArrowDown');return;}if(type==='jump'){const j=await point('jump',22);await session!.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:held?[held,j]:[j]});await session!.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:held?[held]:[]});}else if(type==='down'){held=await point('slide',11);await session!.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held]});}else{held=null;await session!.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}};
   for(const id of ['beach','cave','wind'] as const){
    if(id!=='beach'){await click(`[data-action="stage:${id}"]`);await click('[data-action="start"]');while(await p.locator('.countdown').count())await p.clock.runFor(17);}
    const plan=routeInputs(id,'upper',true),events=[...plan.jumps.map(x=>({x,type:'jump'})),...plan.slides.flatMap(s=>[{x:s.start,type:'down'},{x:s.end,type:'up'}])].sort((a,b)=>a.x-b.x);
    for(const e of events){await advance(e.x);await input(e.type);}
    await advance(23400);await p.clock.runFor(2500);await expect(p.locator('.result')).toBeVisible();await expect(p.locator('.result')).toContainText('HP 손실 0회');
    const record=await p.evaluate(id=>{const k=Object.keys(localStorage).find(k=>k.startsWith('odyssey-run:')&&k.endsWith(':save'))!;return JSON.parse(localStorage.getItem(k)!).stages[id];},id);expect(record.complete).toBe(true);expect(record.maps).toHaveLength(3);runs.push({id,record});await p.screenshot({path:`artifacts/${prefix}-${mobile?'mobile':'desktop'}-${id}-result.png`});await click('[data-action="islands"]');
   }
   await click('[data-action="home"]');await click('[data-action="settings"]');const download=p.waitForEvent('download');await click('[data-action="export"]');const path=`artifacts/${prefix}-${mobile?'mobile':'desktop'}-save.json`;await (await download).saveAs(path);const original=JSON.parse(await readFile(path,'utf8'));await p.locator('#import-file').setInputFiles(path);await click('[data-action="import-confirm"]');await p.reload();await p.waitForSelector('.home');const restored=await p.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('odyssey-run:')&&k.endsWith(':save'))!;return JSON.parse(localStorage.getItem(k)!);});expect(restored).toEqual(original);
  }
  results.push({mobile,status:response?.status(),bundle,firstStarX,runs});await c.close();console.log(prefix,mobile?'mobile':'desktop',firstStarX,'passed');
 }
 expect(errors).toEqual([]);expect(failures).toEqual([]);await writeFile(`artifacts/${prefix}-results.json`,JSON.stringify({url,phase,browser:await b.version(),checkedAt:new Date().toISOString(),environment:`Linux ${engine}: PC 1280x800 DPR2 / mobile 844x390 DPR2 emulation; virtual game clock; no physical device`,scope:phase==='after'&&!smoke?'Three complete routes per profile with keyboard/multi-pointer touch, then save export/restore':'First star boundary: menu input and automatic running only',results,errors,failures},null,2));
}finally{await b.close();}
