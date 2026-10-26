import {Runner} from '../src/player/runner';
import {STAGES,COURSES} from '../src/levels/courses';
import {ADVENTURE_PLANS} from '../src/levels/adventure';
import {ENEMY_TYPES} from '../src/levels/enemies';
// Compact authored input fixtures, also used for browser keyboard verification.
export function routeInputs(id:typeof STAGES[number],path:'lower'|'upper'='lower',stories=false){
 const c=COURSES[id];const jumps:number[]=[];
 c.obstacles.forEach(o=>{if((o.kind==='gate'||o.kind==='hand'))return;if(o.kind==='pillar'){jumps.push(o.x-140,o.x-45);}else jumps.push(o.x-110);});
 c.gaps.forEach(g=>jumps.push(g.x-95,g.x+10));
 const map=c.items.find(i=>i.id===`${id}-map-2`)!;jumps.push(map.x-180,map.x-90);
 const slides=c.obstacles.filter(o=>(o.kind==='gate'||o.kind==='hand')).map(o=>({start:o.x-70,end:o.x+o.w+70}));
 c.enemies.forEach(e=>{if(e.bait||(path==='upper'&&e.kind==='harpy'&&e.x>ADVENTURE_PLANS[id].branch.start&&e.x<ADVENTURE_PLANS[id].branch.end))return;const spec=ENEMY_TYPES[e.kind];if(e.kind==='harpy'||e.kind==='shade')slides.push({start:e.x-spec.lead,end:e.x+160});else{
  // Land just before the wind island's low constellation star; its transparent
  // margin no longer counts as contact. Course and movement remain unchanged.
  jumps.push(e.x-(id==='wind'&&e.x===7600?140:spec.lead));if(e.kind==='cyclops')jumps.push(e.x-80);
 }});
 if(path==='upper')jumps.push(ADVENTURE_PLANS[id].branch.start-100);
 if(stories){const story=ADVENTURE_PLANS[id].stories[1];slides.push({start:story.x-80,end:story.x+80});}
 return {jumps:jumps.sort((a,b)=>a-b),slides:slides.sort((a,b)=>a.start-b.start)};
}
if(process.argv[1]?.includes('check-routes'))for(const id of STAGES){
 const r=new Runner(id);r.state='playing';const input=routeInputs(id);let idx=0;const damage:number[]=[];
 while(r.state==='playing'&&r.time<100){
  while(idx<input.jumps.length&&r.x>=input.jumps[idx]){r.jump();idx++;}
  r.slide(input.slides.some(s=>r.x>=s.start&&r.x<s.end));
  const hp=r.hpLoss;r.tick();if(r.hpLoss>hp)damage.push(Math.round(r.x));
 }
 console.log(id,r.state,Math.round(r.time*100)/100,'sec',r.hp,'HP',r.stars,'stars',Array.from(r.maps),damage);
}
