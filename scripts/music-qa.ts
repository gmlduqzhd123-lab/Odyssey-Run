import {chromium,webkit,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const url=process.env.QA_URL||'http://localhost:4176/Odyssey-Run/',engine=process.env.QA_ENGINE||'chromium',production=url.startsWith('https:'),prefix=production?`music-deployed-${engine}`:`music-${engine}`;
const b=await (engine==='webkit'?webkit:chromium).launch({...(engine==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{}),...(production?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY!}}:{})});
const errors:string[]=[],failures:string[]=[],results:any[]=[];
const wait=async(condition:()=>Promise<boolean>,label:string)=>{const start=Date.now();while(!await condition()){if(Date.now()-start>20000)throw Error(label+' timed out');await delay(100);}};
try{
 for(const mobile of (engine==='webkit'?[true]:[false,true])){
  const c=await b.newContext({viewport:mobile?{width:844,height:390}:{width:960,height:620},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  await c.addInitScript(()=>{
   const q={entries:[] as any[],decoded:[] as number[],oscillators:0,analysers:[] as AnalyserNode[]};(window as any).__musicQA=q;
   const decode=AudioContext.prototype.decodeAudioData,create=AudioContext.prototype.createBufferSource,osc=AudioContext.prototype.createOscillator;
   AudioContext.prototype.decodeAudioData=function(...a:any[]){return (decode as any).apply(this,a).then((buffer:AudioBuffer)=>{q.decoded.push(buffer.duration);return buffer;});};
   AudioContext.prototype.createOscillator=function(){q.oscillators++;return osc.call(this);};
   const gains=new WeakMap<AudioNode,AnalyserNode>();
   AudioContext.prototype.createBufferSource=function(){const ctx=this,node=create.call(this),start=node.start.bind(node),stop=node.stop.bind(node),connect=node.connect.bind(node);let entry:any=null;node.connect=((target:AudioNode,...rest:any[])=>{if(!gains.has(target)){const analyser=ctx.createAnalyser();analyser.fftSize=2048;target.connect(analyser);gains.set(target,analyser);q.analysers.push(analyser);}return (connect as any)(target,...rest);}) as typeof node.connect;
    node.start=((...a:any[])=>{const samples=node.buffer?.getChannelData(0);let peak=0;if(samples){const from=Math.min(samples.length-1,Math.floor(node.buffer!.sampleRate*5));for(let i=from;i<Math.min(samples.length,from+4096);i++)peak=Math.max(peak,Math.abs(samples[i]));}entry={duration:node.buffer?.duration,offset:a[1]||0,startTime:ctx.currentTime,loop:node.loop,stopped:false,peak};q.entries.push(entry);return (start as any)(...a);}) as typeof node.start;
    node.stop=((...a:any[])=>{if(entry){entry.stopped=true;entry.stopTime=ctx.currentTime;}return (stop as any)(...a);}) as typeof node.stop;return node;
   };
  });
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});await p.clock.install();const response=await p.goto(url);await p.waitForSelector('.home');await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1000);
  const state=()=>p.evaluate(()=>{const q=(window as any).__musicQA;let rms=0;for(const a of q.analysers){const v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);rms=Math.max(rms,Math.sqrt(v.reduce((sum,n)=>sum+n*n,0)/v.length));}return {entries:q.entries,active:q.entries.filter((e:any)=>!e.stopped).length,decoded:q.decoded,oscillators:q.oscillators,rms};});
  const ready=async()=>{let i=0;while(await p.locator('.countdown').count()&&i++<250)await p.clock.runFor(17);await expect(p.locator('.countdown')).toHaveCount(0);};
  await p.locator('[data-action="settings"]').click();await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');await p.locator('[data-action="import-confirm"]').click();await p.locator('[data-setting="music"]').check();await p.locator('[data-setting="sfx"]').check();await p.locator('[data-action="home"]').click();await p.locator('[data-action="islands"]').first().click();
  const stages=[];
  for(const [id,duration] of [['beach',162.144],['cave',108],['wind',96.912]] as const){
   const n=(await state()).entries.length;await p.locator(`[data-action="stage:${id}"]`).click();await wait(async()=>(await state()).decoded.length>=stages.length+1,'MP3 decode '+id);expect((await state()).active).toBe(0);await p.locator('[data-action="start"]').click();await p.clock.runFor(1000);expect((await state()).active).toBe(0);await ready();await wait(async()=>(await state()).entries.length>n,'start '+id);const playing=await state();expect(playing.active).toBe(1);expect(playing.entries.at(-1).duration).toBeCloseTo(duration,0);expect(playing.entries.at(-1).loop).toBe(true);expect(playing.entries.at(-1).peak).toBeGreaterThan(.001);await wait(async()=>(await state()).rms>0.00001,'music signal '+id);const signal=(await state()).rms;await delay(250);
   await p.locator('[data-action="pause"]').click();const paused=await state(),prior=paused.entries.at(-1);expect(paused.active).toBe(0);await delay(300);await p.locator('[data-action="resume"]').click();await p.clock.runFor(1000);expect((await state()).active).toBe(0);await ready();await wait(async()=>(await state()).active===1,'resume');const resumed=await state();expect(resumed.entries.at(-1).offset).toBeCloseTo((prior.offset+prior.stopTime-prior.startTime)%prior.duration,1);
   if(id==='beach'){
    await p.locator('[data-action="pause"]').click();await p.locator('[data-setting="music"]').uncheck();const before=(await state()).entries.length;await p.locator('[data-action="resume"]').click();await ready();await delay(200);expect((await state()).active).toBe(0);const fx=(await state()).oscillators;if(mobile)await p.locator('[data-control="jump"]').tap();else await p.keyboard.press('Space');await p.clock.runFor(34);expect((await state()).oscillators).toBeGreaterThan(fx);expect((await state()).entries.length).toBe(before);
    await p.locator('[data-action="pause"]').click();await p.locator('[data-setting="music"]').check();await p.locator('[data-action="restart"]').click();expect((await state()).active).toBe(0);await ready();await wait(async()=>(await state()).active===1,'restart');expect((await state()).entries.at(-1).offset).toBe(0);
   }
   await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await p.clock.runFor(11000);expect((await state()).active).toBe(0);await p.locator('[data-action="islands"]').click();stages.push({id,decodedDuration:playing.entries.at(-1).duration,peak:playing.entries.at(-1).peak,measuredRms:signal});
  }
  await p.locator('[data-action="home"]').click();await p.locator('[data-action="quit"]').click();expect((await state()).active).toBe(0);await p.screenshot({path:`artifacts/${prefix}-${mobile?'mobile':'desktop'}-quit.png`});results.push({mobile,status:response?.status(),stages,audio:await state()});await c.close();console.log(prefix,mobile?'mobile':'desktop','all three MP3, signal, pause/resume, mute/SFX, retry and exit passed');
 }
 expect(errors).toEqual([]);expect(failures).toEqual([]);await writeFile(`artifacts/${prefix}-results.json`,JSON.stringify({url,browser:await b.version(),checkedAt:new Date().toISOString(),environment:'Linux headless browser; mobile emulation; real AudioContext decoding/render graph, virtual gameplay clock; no physical speaker listening',results,errors,failures},null,2));
}finally{await b.close();}
