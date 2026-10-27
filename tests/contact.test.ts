import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {C} from '../src/config';
import {Runner} from '../src/player/runner';
import {CONTACT_MASKS} from '../src/assets/contact-masks';
import {createEnemyState,updateEnemyState,type EnemyKind} from '../src/levels/enemies';
import {heroPose,enemyPose} from '../src/rendering/poses';
import {collectibleContact,enemyContact,projectileContact,overlaps,containsInk} from '../src/systems/contact';
import type {ItemKind} from '../src/levels/courses';

test('first star is not collected by its old invisible 30px rectangle',()=>{
 const r=new Runner('beach');r.state='playing';while(r.x<816)r.tick();
 assert.equal(r.collected.has('beach-star-1'),false);assert.equal(r.stars,0);
 while(r.x<850)r.tick();assert.ok(r.collected.has('beach-star-1'));assert.equal(r.stars,1);
 assert.equal(r.hp,3);assert.equal(r.body.w,42);assert.equal(r.body.h,64);
});
test('all nine collectible silhouettes require direct visible contact, including thin lantern/trident',()=>{
 for(const kind of ['star','map','shield','wings','magnet','apple','trident','lantern','compass'] as ItemKind[]){
  const r=new Runner('beach');r.x=1000;const item={id:kind,kind,x:1000,y:405};
  assert.ok(collectibleContact(heroPose(r),r.body,item),kind+' actual contact');
  item.x=1040;assert.equal(collectibleContact(heroPose(r),r.body,item),false,kind+' visible gap');
  r.sliding=true;assert.equal(r.body.h,30);assert.equal(collectibleContact(heroPose(r),r.body,item),false,kind+' crouch gap');
 }
});
// Fixed positions from the reproduced rectangle-only errors, including airborne
// poses at the empty head/wing/weapon corners. Each has a nearby real contact.
const fixtures:Record<EnemyKind,{safe:[number,number];hit:[number,number]}>= {
 crab:{safe:[1074,399],hit:[996,399]},harpy:{safe:[993,341],hit:[1038,341]},stone:{safe:[923,381],hit:[929,381]},
 scylla:{safe:[1057,397],hit:[982,397]},cyclops:{safe:[982,353],hit:[1036,353]},shade:{safe:[937,343],hit:[943,343]},
};
test('six monster empty corners no longer damage the hero; actual contact still does',()=>{
 for(const [kind,f] of Object.entries(fixtures) as [EnemyKind,typeof fixtures[EnemyKind]][]){
  const placement={id:kind,kind,x:1000},e=createEnemyState(placement);updateEnemyState(e,placement,990,0,false,false);
  const r=new Runner('beach');r.grounded=false;
  [r.x,r.y]=f.safe;assert.ok(overlaps(r.body,e),kind+' previously hit');assert.equal(enemyContact(heroPose(r),r.body,e),false,kind+' empty corner');
  [r.x,r.y]=f.hit;assert.ok(enemyContact(heroPose(r),r.body,e),kind+' opaque contact');
  e.active=false;assert.equal(enemyContact(heroPose(r),r.body,e),false,kind+' inactive');
 }
});
test('real runner update neither spends a shield nor records damage in a harpy empty corner',()=>{
 const r=new Runner('beach');r.state='playing';r.x=5692;r.y=341;r.grounded=false;r.coyote=0;r.shield=true;r.tick(0);
 assert.ok(overlaps(r.body,r.enemyStates.find(e=>e.kind==='harpy')!));assert.equal(r.shield,true);assert.equal(r.hpLoss,0);assert.equal(r.invincible,0);
 r.x=5738;r.tick(0);assert.equal(r.shield,false);assert.equal(r.hpLoss,0);assert.equal(r.invincible,C.invincible);
 r.tick(0);assert.equal(r.hpLoss,0);
 const hit=new Runner('beach');hit.state='playing';hit.x=5738;hit.y=341;hit.grounded=false;hit.coyote=0;hit.tick(0);assert.equal(hit.hp,2);assert.equal(hit.hpLoss,1);
});
test('cropped emerging scylla and mirrored harpy use the rendered pose',()=>{
 const p={id:'scylla',kind:'scylla' as const,x:1000},e=createEnemyState(p);updateEnemyState(e,p,730,0,false,false);
 const s=enemyPose(e);assert.equal(e.reveal,.5);assert.equal(s.y+s.h*e.reveal,C.ground);
 for(let x=s.x;x<s.x+s.w;x++)assert.equal(containsInk(s,x,C.ground+1),false);
 const harpy=createEnemyState({id:'harpy',kind:'harpy',x:1000}),normal={...enemyPose(harpy),flipX:false},flipped=enemyPose(harpy);
 for(let u=.5;u<normal.w;u+=3)for(let v=.5;v<normal.h;v+=3)assert.equal(containsInk(normal,normal.x+u,normal.y+v),containsInk(flipped,flipped.x+flipped.w-u,flipped.y+v));
});
test('projectile transparent rock corners are safe and opaque rock contacts damage',()=>{
 const r=new Runner('beach');r.grounded=false;r.x=1000;r.y=400;
 const shot={x:1020,y:397,w:36,h:28,active:true};
 assert.ok(overlaps(r.body,shot));assert.equal(projectileContact(heroPose(r),r.body,shot),false);
 shot.x=990;shot.y=370;assert.ok(projectileContact(heroPose(r),r.body,shot));
 shot.active=false;assert.equal(projectileContact(heroPose(r),r.body,shot),false);
});
test('normal magnet and wings combination remain star-only remote collection',()=>{
 for(const wings of [0,6]){
  const r=new Runner('beach');r.state='playing';r.x=650;r.magnet=6;r.wings=wings;
  const star=r.course.items.find(i=>i.id==='beach-star-1')!;
  assert.equal(collectibleContact(heroPose(r),r.body,star),false);r.tick();
  assert.equal(r.collected.has(star.id),wings>0);
  r.x=2580;r.tick();assert.equal(r.maps.has('beach-map-1'),false);
 }
});
test('contact mask source hashes and interval bounds match all committed artwork',()=>{
 const manifest=JSON.parse(readFileSync('docs/contact-mask-manifest.json','utf8'));
 assert.equal(Object.keys(CONTACT_MASKS).length,31);
 for(const [file,sha] of Object.entries(manifest.sourceSha256))assert.equal(createHash('sha256').update(readFileSync('public/'+file)).digest('hex'),sha,file);
 for(const [name,m] of Object.entries(CONTACT_MASKS)){
  assert.equal(m.rows.length,m.h,name);assert.ok(m.rows.some(row=>row.length>0),name);
  for(const row of m.rows){assert.equal(row.length%2,0);for(let i=0;i<row.length;i+=2){assert.ok(row[i]>=0&&row[i]<row[i+1]&&row[i+1]<=m.w,name);if(i)assert.ok(row[i]>row[i-1]);}}
 }
});
