import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results:any[]=[];
try{for(const mode of ['missing','corrupt','blocked-resume']){
 const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await c.newPage(),errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
 if(mode==='missing')await p.route('**/assets/audio/*.mp3',r=>r.fulfill({status:404,body:'not found'}));
 if(mode==='corrupt')await p.route('**/assets/audio/*.mp3',r=>r.fulfill({status:200,contentType:'audio/mpeg',body:'not a valid MP3'}));
 if(mode==='blocked-resume')await c.addInitScript(()=>{AudioContext.prototype.resume=()=>Promise.reject(new DOMException('Blocked','NotAllowedError'));});
 await p.goto('http://localhost:4176/Odyssey-Run/');await p.waitForSelector('.home');await p.locator('[data-action="islands"]').first().tap();await p.locator('[data-action="stage:beach"]').tap();await p.locator('[data-action="start"]').tap();await p.waitForSelector('.countdown',{state:'detached'});await p.waitForTimeout(700);await expect(p.locator('#score')).not.toHaveText('0');await p.locator('[data-control="jump"]').tap();await p.locator('[data-action="pause"]').tap();await expect(p.locator('[data-action="resume"]')).toBeVisible();await p.locator('[data-action="quit"]').tap();await expect(p.locator('.quit-panel')).toBeVisible();expect(errors).toEqual([]);results.push({mode,playAndPauseAndQuit:true,errors});await c.close();console.log('music failure mode passed:',mode);
}await writeFile('artifacts/music-failure-results.json',JSON.stringify({checkedAt:new Date().toISOString(),browser:await b.version(),environment:'Linux Chromium mobile emulation; real clock; deliberate audio failures',results},null,2));}finally{await b.close();}
