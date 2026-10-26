import Phaser from 'phaser';
import {C} from '../config';
import {COURSES,type StageId} from '../levels/courses';
import type {Runner} from '../player/runner';
import {assetUrl} from '../assets/catalog';
import {REGIONS,sheetUrl} from '../assets/terrain';
import {RUN_ART} from '../assets/runner-art';
import {DISPLAY,type DisplayViewport} from '../rendering/display';
import {CROUCH_ART,MONSTER_ART} from '../assets/expansion-art';
import {ENEMY_TYPES} from '../levels/enemies';
import {heroPose,itemPose,enemyPose} from '../rendering/poses';
export interface SceneHost {frame(delta:number):void;loaded():void;loadError():void;reduced():boolean;density():number;view():DisplayViewport;}
export class World extends Phaser.Scene {
 private bg:Phaser.GameObjects.Image[][]=[];private ground!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;
 private hero!:Phaser.GameObjects.Image;private boat!:Phaser.GameObjects.Image;private giant!:Phaser.GameObjects.Image;
 private obstacles:Phaser.GameObjects.Image[]=[];private items:Phaser.GameObjects.Image[]=[];private platforms:Phaser.GameObjects.Image[]=[];
 private label!:Phaser.GameObjects.Text;private bursts:{text:Phaser.GameObjects.Text;life:number}[]=[];
 private warning!:Phaser.GameObjects.Text;private monsters:Phaser.GameObjects.Image[]=[];private projectiles:Phaser.GameObjects.Image[]=[];
 private groundArt:Phaser.GameObjects.TileSprite[]=[];
 private stage:StageId='beach';private run:Runner|null=null;private mode:'home'|'run'='home';private failed=false;
 constructor(private host:SceneHost){super('World');}
 private get view(){return this.host.view();}
 private get bgWidth(){return 1600*Math.max(this.view.height/540,this.view.width/1600);}
 private get bgHeight(){return 540*Math.max(this.view.height/540,this.view.width/1600);}
 preload(){
  this.syncDisplay();
  const g=this.add.graphics();g.fillStyle(0x102f46).fillRect(0,-this.view.extraHeight,this.view.width,this.view.height);
  const t=this.add.text(this.view.width/2,250,'항해를 준비하고 있어요…',{fontFamily:'sans-serif',fontSize:'22px',color:'#f6e8c5',resolution:this.host.density()}).setOrigin(.5);
  const bar=this.add.graphics();this.load.on('progress',(n:number)=>{bar.clear().fillStyle(0xe9b957).fillRoundedRect(this.view.width/2-180,296,360*n,5,3);t.setText(`항해를 준비하고 있어요… ${Math.round(n*100)}%`);});
  this.load.on('loaderror',()=>{this.failed=true;});
  const names=['star','crate','pillar','gate','rock','boat','giant','hand',...['beach','cave','wind'].flatMap(id=>['sky','far','mid'].map(layer=>`${id}-${layer}`))];
  names.forEach(n=>this.load.svg(n,`${import.meta.env.BASE_URL}assets/${n}.svg`,{scale:DISPLAY.svgDensity}));
  ['odysseus','map','shield','wings','magnet','apple','trident','lantern','compass'].forEach(n=>this.load.image(n,assetUrl(n)));
  this.load.image('terrain-sheet',sheetUrl('terrain-sheet'));
  this.load.image('odysseus-run',`${import.meta.env.BASE_URL}${RUN_ART.file}`);
  this.load.image('hero-crouch',`${import.meta.env.BASE_URL}${CROUCH_ART.file}`);this.load.image('monster-atlas',`${import.meta.env.BASE_URL}${MONSTER_ART.file}`);
  this.load.once('complete',()=>{g.destroy();t.destroy();bar.destroy();});
 }
 create(){
  if(this.failed){this.host.loadError();return;}
  Object.entries(REGIONS).filter(([,r])=>r.sheet==='terrain-sheet').forEach(([id,r])=>this.textures.get(r.sheet).add(id,0,r.x,r.y,r.w,r.h));
  RUN_ART.frames.forEach((f,i)=>this.textures.get('odysseus-run').add(`run-${i}`,0,f.x,f.y,f.w,f.h));
  const crouch=CROUCH_ART.frame;this.textures.get('hero-crouch').add('crouch',0,crouch.x,crouch.y,crouch.w,crouch.h);
  Object.entries(MONSTER_ART.frames).forEach(([id,f])=>this.textures.get('monster-atlas').add(id,0,f.x,f.y,f.w,f.h));
  // Draw source images directly; a logical-size TileSprite would downsample
  // the high-resolution SVG before the final display scaling.
  this.bg=['sky','far','mid'].map(layer=>[0,1].map(i=>this.add.image(i*1600,0,`beach-${layer}`).setOrigin(0).setDisplaySize(1600,540)));
  this.giant=this.add.image(-100,440,'giant').setOrigin(.5,1).setAlpha(.8).setVisible(false);
  this.ground=this.add.graphics();this.fx=this.add.graphics();
  for(let i=0;i<5;i++)this.groundArt.push(this.add.tileSprite(0,440,1,33,'terrain-sheet','ground-beach').setOrigin(0).setVisible(false));
  this.boat=this.add.image(744,444,'boat').setDisplaySize(350,230);
  this.hero=this.add.image(744,442,'odysseus').setOrigin(.5,1).setDisplaySize(180,240);
  this.label=this.add.text(480,275,'',{fontFamily:'sans-serif',fontSize:'22px',color:'#fff2d2',stroke:'#223e4b',strokeThickness:5,align:'center',resolution:this.host.density()}).setOrigin(.5);
  this.warning=this.add.text(590,260,'',{fontFamily:'sans-serif',fontSize:'17px',color:'#f8e8bd',stroke:'#20394b',strokeThickness:4,resolution:this.host.density()}).setOrigin(.5).setDepth(20);
  this.syncDisplay();
  this.host.loaded();
 }
 showHome(){this.mode='home';this.run=null;this.clearObjects();this.setStage('beach');this.boat.setVisible(true).setPosition(744,410).setDisplaySize(350,230);this.hero.setTexture('odysseus').setOrigin(.5,1).setDisplaySize(180,240).setPosition(744,442).setRotation(0).setAlpha(1);this.giant.setVisible(false);this.label.setText('');this.warning.setText('');}
 setStage(id:StageId){this.stage=id;this.bg.forEach((pair,i)=>pair.forEach(b=>b.setTexture(`${id}-${['sky','far','mid'][i]}`).setDisplaySize(this.bgWidth,this.bgHeight)));this.groundArt.forEach(s=>s.setTexture('terrain-sheet',`ground-${id}`).setVisible(false));}
 syncDisplay(){
  const d=this.host.density(),v=this.view;if(!this.cameras?.main)return;
  // Uniform fit keeps the complete minimum 960x540 view. Wider/taller screens
  // extend the world; the fixed camera never animates or crops the course.
  const width=Math.round(v.width*d),height=Math.round(v.height*d);
  this.cameras.main.setSize(width,height).setZoom(d).setScroll(width*(1-d)/(2*d),height*(1-d)/(2*d)-v.extraHeight);
  this.bg.forEach(pair=>pair.forEach(b=>b.setDisplaySize(this.bgWidth,this.bgHeight)));
  if(this.label)this.label.setResolution(d);
  if(this.warning)this.warning.setResolution(d);
  this.bursts.forEach(b=>b.text.setResolution(d).setX(v.width/2));
  const context=this.game.canvas.getContext('2d');if(context)context.imageSmoothingQuality='high';
 }
 private backgroundScroll(layer:number,position:number){
  const width=this.bgWidth,offset=((position%width)+width)%width;
  this.bg[layer].forEach((image,i)=>{const x=i*width-offset;image.setPosition(x,-this.view.extraHeight).setVisible(x<this.view.width&&x+width>0);});
 }
 showRun(run:Runner){
  this.mode='run';this.run=run;this.clearObjects();this.setStage(run.stage);this.boat.setVisible(false);this.hero.setDisplaySize(66,88).setRotation(0);
  run.course.obstacles.forEach(o=>{this.obstacles.push(this.add.image(o.x,o.y,o.kind==='falling'?'rock':o.kind==='hand'?'hand':o.kind).setOrigin(0).setDisplaySize(o.w,o.h));});
  run.course.items.forEach(i=>{const p=itemPose(i.kind,i.x,i.y);this.items.push(this.add.image(i.x,i.y,i.kind).setDisplaySize(p.w,p.h));});
  run.course.platforms.forEach(p=>this.platforms.push(this.add.image(p.x,p.y,'terrain-sheet','wood-platform').setOrigin(0).setDisplaySize(p.w,20).setTint(p.id.includes('branch')?0xf4d99c:p.id.includes('cloud')?0xe5efdc:0xffffff)));
  run.enemyStates.forEach(e=>{const p=enemyPose(e);this.monsters.push(this.add.image(p.anchorX,p.anchorY,p.texture,p.frame).setOrigin(p.originX,p.originY).setScale(p.scale!).setFlipX(!!p.flipX).setDepth(4));this.projectiles.push(this.add.image(e.x,e.y,'rock').setOrigin(0).setDisplaySize(36,28).setDepth(5).setVisible(false));});
  this.hero.setDepth(10);this.label.setDepth(20);this.fx.setDepth(15);this.drawRun();
 }
 private clearObjects(){this.obstacles.forEach(o=>o.destroy());this.items.forEach(o=>o.destroy());this.platforms.forEach(o=>o.destroy());this.monsters.forEach(o=>o.destroy());this.projectiles.forEach(o=>o.destroy());this.obstacles=[];this.items=[];this.platforms=[];this.monsters=[];this.projectiles=[];this.bursts.forEach(b=>b.text.destroy());this.bursts=[];}
 feedback(kind:string,x:number,y:number,message?:string){
  if(kind==='jump'||kind==='star')return;
  this.bursts.forEach(b=>b.text.destroy());this.bursts=[];
  const words:Record<string,string>={map:'지도 발견! +100',shield:'아테나의 방패',wings:'6초간 활공',magnet:'별빛 자석 · 6초',apple:'황금 사과 · 회복',trident:'삼지창 · 다음 몬스터 격퇴',lantern:'등불 · 공중 위협 방어 6초',compass:'나침반 · 안전지점 갱신',strike:'삼지창으로 격퇴!',hurt:'체력 −1',fall:'안전지점으로!',block:'방패가 지켰어요!',finish:'이타카를 향해!'};
  const text=this.add.text(this.view.width/2,180,['near','discovery','constellation','combo','route','highlight','trick','strike'].includes(kind)?message||words[kind]||'새로운 발견!':words[kind]||'',{fontFamily:'sans-serif',fontStyle:'bold',fontSize:'18px',color:kind==='hurt'?'#ffb8a3':'#ffebae',stroke:'#20394b',strokeThickness:4,resolution:this.host.density()}).setOrigin(.5).setDepth(30);
  this.bursts.push({text,life:.9});
 }
 update(_time:number,delta:number){
  if(!this.hero)return;
  this.host.frame(delta/1000);
  if(this.mode==='home'){
   this.backgroundScroll(0,310);this.backgroundScroll(1,100);this.backgroundScroll(2,0);
   this.boat.setPosition(this.view.width*.775,410);this.hero.setPosition(this.view.width*.775,442);this.ground.clear();this.fx.clear();
  }else this.drawRun();
  const playing=this.run?.state==='playing';
  if(playing){for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.life-=Math.min(delta/1000,.05);b.text.setAlpha(Math.min(1,b.life*2));if(b.life<=0){b.text.destroy();this.bursts.splice(i,1);}}}
 }
 private drawRun(){
  const r=this.run;if(!r)return;const cam=r.x-this.view.heroX;const dark=this.stage==='cave';
  const reduced=this.host.reduced();this.backgroundScroll(0,310);this.backgroundScroll(1,100);this.backgroundScroll(2,0);
  const g=this.ground;g.clear();
  // Ground spans retain the complete logical view, including on small screens.
  let start=cam-20,spanIndex=0;this.groundArt.forEach(s=>s.setVisible(false));
  const groundSpan=(a:number,b:number)=>{if(b<=a)return;g.fillStyle(dark?0x505b68:this.stage==='wind'?0x9aaca5:0xcab28c).fillRect(a-cam,440,b-a,100);g.fillStyle(dark?0x465360:0x81988e,.12).fillRect(a-cam,516,b-a,24);const band=this.groundArt[spanIndex++];if(band&&b-a>=1){band.setPosition(a-cam,440).setSize(b-a,16).setAlpha(reduced?.035:.08).setVisible(true);band.tilePositionX=a-cam;}g.lineStyle(2,dark?0xb1bbc1:0xe7d5ac,.8).lineBetween(a-cam,440,b-cam,440);};
  for(const gap of r.course.gaps){if(gap.x+gap.w<start||gap.x>cam+this.view.width+40)continue;groundSpan(start,gap.x);start=gap.x+gap.w;}
  groundSpan(start,cam+this.view.width+40);
  this.obstacles.forEach((s,i)=>{const o=r.course.obstacles[i],x=o.x-cam;s.setVisible(x>-200&&x<this.view.width+60).setX(x);if(o.kind==='hand'){const d=o.x-r.x;s.y=o.y-Math.max(0,Math.min(260,(d-150)*.8));}if(o.kind==='falling'){const d=o.x-r.x;s.y=o.y-Math.max(0,Math.min(290,(d-100)*1.5));}});
  this.items.forEach((s,i)=>{const item=r.course.items[i],x=item.x-cam;s.setVisible(!r.collected.has(item.id)&&x>-40&&x<this.view.width+40).setPosition(x,item.y);});
  this.platforms.forEach((s,i)=>{const p=r.course.platforms[i];s.setPosition(p.x-cam,r.platformY(p)).setVisible(p.x-cam+p.w>0&&p.x-cam<this.view.width);});
  this.monsters.forEach((s,i)=>{const e=r.enemyStates[i],x=e.x-cam,p=enemyPose(e),f=MONSTER_ART.frames[e.kind];s.setVisible(!e.defeated&&e.reveal>0&&x>-150&&x<this.view.width+90).setPosition(p.anchorX-cam,p.anchorY).setAlpha(e.repelled?.4:e.kind==='shade'&&!e.active?.35:1);if(e.kind==='scylla')s.setCrop(0,0,f.w,Math.max(1,Math.floor(f.h*e.reveal)));const rock=this.projectiles[i];rock.setPosition(e.projectile.x-cam,e.projectile.y).setVisible(e.projectile.active&&x>-200&&x<this.view.width+90);});
  const incoming=r.enemyStates.filter(e=>e.warning&&!e.defeated&&e.x+e.w>r.x-32).sort((a,b)=>a.x-b.x)[0];this.warning.setX(this.view.width*.615).setText(incoming?(incoming.repelled?'등불이 지켜 주고 있어요':`${ENEMY_TYPES[incoming.kind].name} · ${ENEMY_TYPES[incoming.kind].hint}`):'');
  const fx=this.fx;fx.clear();
  r.course.winds.forEach(w=>{
   const x=w.x-cam;if(x+w.w<0||x>this.view.width)return;
   fx.fillStyle(0xc8f0da,.2).fillRect(x,w.y,w.w,w.h);fx.lineStyle(3,0xe1f6ce,.8);
   for(let k=0;k<(reduced?4:8);k++){const xx=x+40+k*80,yy=400-((k*41)%290);fx.lineBetween(xx,yy+12,xx,yy-16);fx.lineBetween(xx,yy-16,xx-8,yy-5);fx.lineBetween(xx,yy-16,xx+8,yy-5);}
  });
  r.course.obstacles.filter(o=>o.kind==='falling'&&o.x-r.x<650&&o.x>r.x-70).forEach(o=>{const x=o.x-cam+30;fx.fillStyle(0xe8b04d,.22).fillRect(x-42,340,84,100);fx.fillStyle(0xeab758).fillTriangle(x,310,x-12,332,x+12,332);});
  r.enemyStates.forEach(e=>{if(!e.warning||e.defeated||e.repelled)return;const x=e.x-cam+e.w/2;if(x<50||x>this.view.width-30)return;fx.fillStyle(0xe8be72,.7).fillTriangle(x,300,x-6,310,x+6,310);});
  this.drawAdventure(r,cam,reduced);
  this.drawHero(r);
  if(r.shield){fx.lineStyle(2,0xffdf85,.8).strokeEllipse(this.view.heroX,r.y-(r.sliding?18:40),r.sliding?66:86,r.sliding?44:96);}
  if(r.wings>0){fx.lineStyle(4,0xf4f3d4,.8);fx.lineBetween(this.view.heroX-32,r.y-40,this.view.heroX-60,r.y-63);fx.lineBetween(this.view.heroX+30,r.y-40,this.view.heroX+54,r.y-63);}
  this.giant.setVisible(this.stage==='cave').setPosition(this.view.heroX-192+(r.hp<=0?140:r.hp===3?-45:r.hp===2?15:63),440).setDisplaySize(170,230);
  if(r.x<3200){this.label.setPosition(this.view.width*590/960,215).setText(r.x<1000?'이타카로 가는 여정, 출발!':this.stage==='wind'?'↑ 바람길에서 가볍게 뛰어 보세요':r.x<2100?'Space / ↑ · 점프, 한 번 더 누르면 2단 점프':'↓ 꾹 누르기 · 슬라이드');}
  else if(r.x>22400){this.label.setPosition(this.view.width*650/960,215).setText(this.stage==='wind'?'이타카 항구가 보여요!':'도착 항구가 보여요!');this.boat.setVisible(true).setPosition(this.view.width*760/960-(r.x-22400)*.08,370).setDisplaySize(216,142);}
  else{this.label.setText('');this.boat.setVisible(false);}
  const highlight=r.adventure.highlight,branch=r.adventure.branch;
  if(r.x>=highlight.start&&r.x<=highlight.end)this.label.setPosition(this.view.width*580/960,215).setText(`${highlight.name}\n${highlight.hint}`);
  else if(r.x>=branch.start-700&&r.x<branch.end)this.label.setPosition(this.view.width*620/960,215).setText('↑ 높은 길: 별자리와 이야기 · 아래: 안전한 길');
 }
 private drawAdventure(r:Runner,cam:number,reduced:boolean){
  const fx=this.fx,branch=r.adventure.branch;
  if(branch.start-cam<this.view.width+40&&branch.end-cam>0){fx.lineStyle(2,0xf1cf7b,.7).lineBetween(branch.start-cam,330,branch.end-cam,330);const x=branch.start-cam-65;fx.fillStyle(0xf1cf7b,.8).fillTriangle(x,350,x-10,370,x+10,370);}
  for(const group of r.adventure.constellations){const points=group.stars.map(id=>r.course.items.find(s=>s.id===id)!);if(points.every(s=>s.x-cam<0||s.x-cam>this.view.width+40))continue;fx.lineStyle(r.constellations.has(group.id)?3:1,0xf5d88d,r.constellations.has(group.id)?.85:.35);const order=group.shape==='ship'?[0,1,3,4,0,2,3]:[0,1,2,3,4];for(let i=1;i<order.length;i++){const a=points[order[i-1]],b=points[order[i]];fx.lineBetween(a.x-cam,a.y,b.x-cam,b.y);}if(r.constellations.has(group.id)){const mid=points[2];fx.lineStyle(2,0xffe9ae,.8).strokeCircle(mid.x-cam,mid.y,22);}}
  for(const story of r.adventure.stories){if(r.stories.has(story.id)||story.x-cam< -40||story.x-cam>this.view.width+40)continue;const x=story.x-cam,y=story.y-20;fx.fillStyle(0xeee2ba,.95).fillRoundedRect(x-12,y-20,24,24,4);fx.lineStyle(2,0x8d795e,.8).lineBetween(x-7,y-13,x+7,y-13).lineBetween(x-7,y-7,x+4,y-7);if(story.pose==='duck'){fx.lineStyle(2,0xf6d694,.9).lineBetween(x,y-43,x,y-29).lineBetween(x,y-29,x-5,y-35).lineBetween(x,y-29,x+5,y-35);}}
  const h=r.adventure.highlight;if(this.stage==='beach'&&r.x>h.start&&r.x<h.end){const gap=r.course.gaps.find(g=>g.x>=h.start&&g.x<=h.end)!;for(let i=0;i<4;i++){const fall=reduced?70:Math.max(0,Math.min(110,(r.x-(gap.x-260))*0.5));fx.fillStyle(0x947354,.85).fillRoundedRect(gap.x+i*38-cam,440+fall,31,8,2);}fx.lineStyle(2,0xe2bd72,.8).lineBetween(gap.x-cam-15,433,gap.x-cam-2,420);}
  if(this.stage==='wind'&&r.x>h.start-700&&r.x<h.end){for(const p of r.course.platforms.filter(p=>p.id.startsWith('wind-cloud-')||p.id==='wind-floating-3')){const x=p.x-cam,y=r.platformY(p);fx.fillStyle(0xe8f1dc,.65).fillEllipse(x+p.w/2,y+10,p.w+18,26);}}
  if(r.wings>0&&r.magnet>0){fx.lineStyle(2,0xd8eddd,.6).strokeEllipse(this.view.heroX,r.y-35,98,110);}
  if(r.lantern>0&&r.trident){fx.lineStyle(2,0xffe3a2,.75).strokeCircle(this.view.heroX,r.y-32,54);}
 }
 private drawHero(r:Runner){
  const p=heroPose(r);
  this.hero.setTexture(p.texture,p.frame).setOrigin(p.originX,p.originY).setPosition(this.view.heroX,p.anchorY).setRotation(0).setAlpha(r.invincible>0?.72:1);
  if(p.scale!==undefined)this.hero.setScale(p.scale);else this.hero.setDisplaySize(p.w,p.h);
 }
}
