import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),results=[];
try{
 for(const mobile of [false,true]){
  const c=await b.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile}),p=await c.newPage();
  const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.QA_URL||'http://localhost:4176/Odyssey-Run/');await p.waitForSelector('.home');await p.locator('[data-action="settings"]').click();await p.locator('[data-setting="music"]').uncheck();await p.locator('[data-setting="sfx"]').uncheck();await p.locator('[data-action="home"]').click();await p.locator('[data-action="islands"]').first().click();await p.locator('[data-action="stage:beach"]').click();await p.locator('[data-action="start"]').click();await p.waitForSelector('.countdown',{state:'detached'});
  const metrics=await p.evaluate(`new Promise(resolve=>{const times=[],start=performance.now(),distance=Number(document.querySelector('#progress').dataset.distance);function frame(t){times.push(t);if(t-start<10000){requestAnimationFrame(frame);return;}const intervals=times.slice(1).map((v,i)=>v-times[i]).sort((a,b)=>a-b);resolve({elapsedMs:t-start,fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],distance:Number(document.querySelector('#progress').dataset.distance)-distance});}requestAnimationFrame(frame);})`);
  expect(errors).toEqual([]);results.push({mobile,metrics,errors});await c.close();console.log('contact performance',mobile,metrics);
 }
 await writeFile('artifacts/contact-performance-results.json',JSON.stringify({browser:await b.version(),checkedAt:new Date().toISOString(),environment:'Linux Chromium headless; PC 1280x800 DPR2 and mobile 844x390 DPR2 emulation; first 10s of beach, real clock, audio off; not physical-device FPS',results},null,2));
}finally{await b.close();}
