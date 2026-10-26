import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const url=process.env.QA_URL||'http://localhost:4176/Odyssey-Run/';
const production=url.startsWith('https:'),prefix=production?'runner-deployed':'runner';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],...(production?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY!}}:{})});
const errors:string[]=[],failures:string[]=[];
try{
 const context=await browser.newContext({viewport:{width:960,height:620}});
 await context.addInitScript(()=>{
  const qa={last:'',seen:[] as string[]};(window as any).__runnerArt=qa;
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:any[]){
   const source=args[0];if(source instanceof HTMLImageElement&&(source.naturalHeight===512&&source.naturalWidth===768||source.naturalHeight===768&&source.naturalWidth===576||source.naturalHeight===1024&&source.naturalWidth===1536&&args[4]>100)){
    qa.last=source.naturalWidth===1536?args.slice(1,5).join(','):source.naturalHeight===512?'crouch':'original';
    if(qa.last!=='original'&&qa.last!=='crouch'&&!qa.seen.includes(qa.last))qa.seen.push(qa.last);
   }
   return (draw as Function).apply(this,args);
  } as typeof draw;
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.clock.install();const response=await page.goto(url);await page.waitForSelector('.home');await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1000);
 const last=()=>page.evaluate(()=>(window as any).__runnerArt.last as string);
 const advance=(ms:number)=>page.clock.runFor(ms);
 await page.locator('[data-action="islands"]').first().click();await page.locator('[data-action="stage:beach"]').click();await page.locator('[data-action="start"]').click();await advance(1100);
 const ready=await last();expect(ready).toMatch(/^\d+,\d+,\d+,\d+$/);await advance(500);expect(await last()).toBe(ready);
 await advance(2000);const box=(await page.locator('#game canvas').boundingBox())!,scale=box.width/960;
 const pictures:string[]=[],frames=new Set<string>();
 for(let i=0;i<100&&frames.size<8;i++){
  const frame=await last();if(!frames.has(frame)){
   frames.add(frame);const picture=await page.screenshot({clip:{x:box.x+125*scale,y:box.y+330*scale,width:145*scale,height:125*scale}});pictures.push(picture.toString('base64'));
  }
  await advance(22);
 }
 expect(frames.size).toBe(8);await page.keyboard.press('p');const frozen=await last();await advance(2000);expect(await last()).toBe(frozen);
 await page.locator('[data-action="resume"]').click();await advance(1000);expect(await last()).toBe(frozen);await advance(3000);
 await page.keyboard.press('Space');await advance(100);expect(await last()).toBe('original');await page.screenshot({path:`artifacts/${prefix}-jump.png`});await advance(1000);expect(await last()).not.toBe('original');
 await page.keyboard.down('ArrowDown');await advance(100);expect(await last()).toBe('crouch');await page.screenshot({path:`artifacts/${prefix}-slide.png`});await page.keyboard.up('ArrowDown');await advance(100);expect(await last()).not.toBe('original');
 await page.keyboard.press('p');await page.locator('[data-action="restart"]').click();await advance(1100);expect(await last()).toBe(ready);await page.locator('.countdown [data-action="pause"]').click();await page.locator('[data-action="islands"]').click();await page.locator('[data-action="home"]').click();await advance(1100);expect(await last()).toBe('original');
 const preview=await context.newPage();await preview.setContent(`<body style="margin:0;padding:20px;background:#f3ecd8;font:14px sans-serif;color:#24414d"><h2>오디세우스 · 게임 화면에서 캡처한 달리기 8프레임</h2><div style="display:grid;grid-template-columns:repeat(4,170px);gap:12px">${pictures.map((p,i)=>`<figure style="margin:0"><img style="width:170px" src="data:image/png;base64,${p}"><figcaption>자세 ${i+1}</figcaption></figure>`).join('')}</div></body>`);await preview.screenshot({path:`artifacts/${prefix}-poses.png`});await preview.close();
 const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await m.goto(url);await m.waitForSelector('.home');await m.locator('[data-action="islands"]').first().tap();await m.locator('[data-action="stage:beach"]').tap();await m.locator('[data-action="start"]').tap();await m.waitForSelector('.countdown',{state:'detached'});await m.waitForTimeout(600);await m.screenshot({path:`artifacts/${prefix}-mobile.png`});await m.locator('[data-control="jump"]').tap();await m.waitForTimeout(200);await m.locator('[data-action="pause"]').tap();await expect(m.locator('[data-action="resume"]')).toBeVisible();await mobile.close();
 if(!production){const c=await browser.newContext();const p=await c.newPage();await p.route('**/odysseus-run-*.webp',r=>r.abort());await p.goto(url);await expect(p.getByRole('button',{name:'다시 준비하기'})).toBeVisible();await p.unroute('**/odysseus-run-*.webp');await p.getByRole('button',{name:'다시 준비하기'}).click();await p.waitForSelector('.home');await c.close();}
 expect(errors).toEqual([]);expect(failures).toEqual([]);
 const manifest=JSON.parse(await readFile('docs/runner-animation-manifest.json','utf8'));
 await writeFile(`artifacts/${prefix}-results.json`,JSON.stringify({url,checkedAt:new Date().toISOString(),status:response?.status(),browser:await browser.version(),distinctRenderedPoses:[...frames],fps:manifest.fps,countdownFrozen:true,pauseFrozen:true,resumeCountdownFrozen:true,jumpSlideReturn:true,restartHomeTextureReset:true,mobileEmulation:true,assetFailureRetry:production?'not run':'passed',errors,failures},null,2));
 console.log(`${prefix}: eight actual rendered poses, frozen pause/countdowns, jump/slide/landing, restart/home, mobile verified.`);
}finally{await browser.close();}
