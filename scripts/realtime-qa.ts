import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
const url=process.env.QA_URL||'http://localhost:4176/Odyssey-Run/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const errors:string[]=[],failures:string[]=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await p.goto(url);await p.waitForSelector('.home');await p.locator('[data-action="settings"]').click();await p.locator('[data-setting="music"]').uncheck();await p.locator('[data-setting="sfx"]').uncheck();await p.locator('[data-action="home"]').click();await p.locator('[data-action="islands"]').first().click();await p.locator('[data-action="stage:beach"]').click();await p.locator('[data-action="start"]').click();await p.waitForSelector('.countdown',{state:'detached'});
 const start=Date.now(),plan=routeInputs('beach');const distance=async()=>Number(await p.locator('#progress').getAttribute('data-distance'));
 const advance=async(target:number)=>{while(await distance()<target){if(await p.locator('.result').count())throw Error('Run finished before the next input.');if(Date.now()-start>100000)throw Error('Real-time run exceeded 100 seconds.');await p.waitForTimeout(Math.max(8,Math.min(200,(target-await distance())/320*1000-6)));}};
 const inputs=[...plan.jumps.map(x=>({x,type:'jump'})),...plan.slides.flatMap(s=>[{x:s.start,type:'down'},{x:s.end,type:'up'}])].sort((a,b)=>a.x-b.x);
 for(const input of inputs){await advance(input.x);if(input.type==='jump')await p.keyboard.press('Space');else if(input.type==='down')await p.keyboard.down('ArrowDown');else await p.keyboard.up('ArrowDown');}
 await advance(23500);await p.screenshot({path:'artifacts/realtime-play.png'});await p.waitForSelector('.result');const elapsedMs=Date.now()-start;await expect(p.locator('.result')).toContainText('멋진 항해였어요!');await expect(p.locator('.result')).toContainText('HP 손실 0회');await expect(p.locator('.result')).toContainText('영구 지도 3/3');await p.screenshot({path:'artifacts/realtime-result.png'});
 const record=await p.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('odyssey-run:')&&k.endsWith(':save'))!;return JSON.parse(localStorage.getItem(key)!).stages.beach;});expect(record.complete).toBe(true);expect(record.bestRating).toBe(3);expect(errors).toEqual([]);expect(failures).toEqual([]);
 await writeFile('artifacts/realtime-results.json',JSON.stringify({url,checkedAt:new Date().toISOString(),browser:await browser.version(),environment:'Linux Chromium desktop 1280x800 DPR2; real elapsed time; no virtual clock; route uses actual keyboard events and HUD distance only',elapsedMs,record,errors,failures},null,2));console.log('Real-time beach complete:',JSON.stringify({elapsedMs,record}));
}finally{await browser.close();}
