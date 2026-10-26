import {writeFile} from 'node:fs/promises';
import {Runner} from '../src/player/runner';
import {STAGES} from '../src/levels/courses';
import {VARIANTS,COURSE_ORDERS,getCourse,VARIANT_LABELS,SECTION_WIDTH,SECTION_START} from '../src/levels/variants';
import {routeInputs} from './check-routes';
import {ADVENTURE_PLANS} from '../src/levels/adventure';
const results=[];
for(const id of STAGES)for(const variant of VARIANTS){
 const c=getCourse(id,variant),paths=[];
 for(const path of ['lower','upper'] as const){
  const r=new Runner(id,'story',variant);r.state='playing';const collect=r.collect.bind(r);r.collect=i=>{if(i.kind==='star'||i.kind==='map')collect(i);};
  const plan=routeInputs(id,path,true,variant);let i=0;
  while(r.state==='playing'&&r.time<95){while(i<plan.jumps.length&&r.x>=plan.jumps[i]){r.jump();i++;}r.slide(plan.slides.some(s=>r.x>=s.start&&r.x<s.end));r.tick();}
  if((r.state as string)!=='success'||r.hpLoss||r.maps.size!==3)throw Error(`${id}/${variant}/${path}: incomplete or damaged route`);
  paths.push({path,seconds:r.time,hpLoss:r.hpLoss,maps:[...r.maps],stars:r.stars,stories:[...r.stories],input:plan});
 }
 results.push({stage:id,variant,...VARIANT_LABELS[id][variant],sectionOrder:variant==='classic'?[0,1,2,3,4,5]:COURSE_ORDERS[id][variant],counts:{stars:c.items.filter(i=>i.kind==='star').length,maps:3,monsters:c.enemies.length,obstacles:c.obstacles.length},gaps:c.gaps,obstacles:c.obstacles,enemies:c.enemies,platforms:c.platforms,winds:c.winds,safe:c.safe,items:c.items,adventure:c.adventure??ADVENTURE_PLANS[id],paths});
 console.log(id,variant,'two no-power, zero-loss routes and all maps passed');
}
await writeFile('docs/course-variants-manifest.json',JSON.stringify({contentVersion:1,sectionStart:SECTION_START,sectionWidth:SECTION_WIDTH,introPreservedTo:3200,harborPreservedFrom:22400,stageLength:24000,maxScore:4200,results},null,2)+'\n');
