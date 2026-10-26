import Phaser from 'phaser';
import {C} from '../config';
import {COURSES,type StageId} from '../levels/courses';
import type {Runner} from '../player/runner';
import {assetUrl} from '../assets/catalog';
export interface SceneHost {frame(delta:number):void;loaded():void;loadError():void;reduced():boolean;}
export class World extends Phaser.Scene {
 private bg:Phaser.GameObjects.TileSprite[]=[];private ground!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;
 private hero!:Phaser.GameObjects.Image;private boat!:Phaser.GameObjects.Image;private giant!:Phaser.GameObjects.Image;
 private obstacles:Phaser.GameObjects.Image[]=[];private items:Phaser.GameObjects.Image[]=[];private platforms:Phaser.GameObjects.Image[]=[];
 private label!:Phaser.GameObjects.Text;private bursts:{text:Phaser.GameObjects.Text;life:number}[]=[];
 private stage:StageId='beach';private run:Runner|null=null;private mode:'home'|'run'='home';private failed=false;
 constructor(private host:SceneHost){super('World');}
 preload(){
  const g=this.add.graphics();g.fillStyle(0x102f46).fillRect(0,0,960,540);
  const t=this.add.text(480,250,'항해를 준비하고 있어요…',{fontFamily:'sans-serif',fontSize:'22px',color:'#f6e8c5'}).setOrigin(.5);
  const bar=this.add.graphics();this.load.on('progress',(n:number)=>{bar.clear().fillStyle(0xe9b957).fillRoundedRect(300,296,360*n,5,3);t.setText(`항해를 준비하고 있어요… ${Math.round(n*100)}%`);});
  this.load.on('loaderror',()=>{this.failed=true;});
  const names=['star','crate','pillar','gate','rock','boat','giant',...['beach','cave','wind'].flatMap(id=>['sky','far','mid'].map(layer=>`${id}-${layer}`))];
  names.forEach(n=>this.load.svg(n,`${import.meta.env.BASE_URL}assets/${n}.svg`));
  ['odysseus','map','shield','wings','magnet','apple'].forEach(n=>this.load.image(n,assetUrl(n)));
  this.load.once('complete',()=>{g.destroy();t.destroy();bar.destroy();});
 }
 create(){
  if(this.failed){this.host.loadError();return;}
  this.bg=['sky','far','mid'].map(layer=>this.add.tileSprite(0,0,960,540,`beach-${layer}`).setOrigin(0));
  this.giant=this.add.image(-100,440,'giant').setOrigin(.5,1).setAlpha(.8).setVisible(false);
  this.ground=this.add.graphics();this.fx=this.add.graphics();
  this.boat=this.add.image(744,444,'boat').setDisplaySize(350,230);
  this.hero=this.add.image(744,442,'odysseus').setOrigin(.5,1).setDisplaySize(180,240);
  this.label=this.add.text(480,275,'',{fontFamily:'sans-serif',fontSize:'22px',color:'#fff2d2',stroke:'#223e4b',strokeThickness:5,align:'center'}).setOrigin(.5);
  this.host.loaded();
 }
 showHome(){this.mode='home';this.run=null;this.clearObjects();this.setStage('beach');this.boat.setVisible(true).setPosition(744,410).setDisplaySize(350,230);this.hero.setDisplaySize(180,240).setPosition(744,442).setRotation(0).setAlpha(1);this.giant.setVisible(false);this.label.setText('');}
 setStage(id:StageId){this.stage=id;this.bg.forEach((b,i)=>b.setTexture(`${id}-${['sky','far','mid'][i]}`));}
 showRun(run:Runner){
  this.mode='run';this.run=run;this.clearObjects();this.setStage(run.stage);this.boat.setVisible(false);this.hero.setDisplaySize(66,88).setRotation(0);
  run.course.obstacles.forEach(o=>{this.obstacles.push(this.add.image(o.x,o.y,o.kind==='falling'?'rock':o.kind).setOrigin(0).setDisplaySize(o.w,o.h));});
  run.course.items.forEach(i=>this.items.push(this.add.image(i.x,i.y,i.kind).setDisplaySize(i.kind==='star'?24:36,i.kind==='star'?24:36)));
  run.course.platforms.forEach(p=>this.platforms.push(this.add.image(p.x,p.y,'pillar').setOrigin(0).setDisplaySize(p.w,20)));
  this.hero.setDepth(10);this.label.setDepth(20);this.fx.setDepth(15);this.drawRun();
 }
 private clearObjects(){this.obstacles.forEach(o=>o.destroy());this.items.forEach(o=>o.destroy());this.platforms.forEach(o=>o.destroy());this.obstacles=[];this.items=[];this.platforms=[];this.bursts.forEach(b=>b.text.destroy());this.bursts=[];}
 feedback(kind:string,x:number,y:number){
  if(kind==='jump'||kind==='star'&&this.host.reduced())return;
  const words:Record<string,string>={star:'+10 ✦',map:'지도 발견! +100',shield:'아테나의 방패',wings:'6초간 활공',magnet:'별빛 자석 · 6초',apple:'황금 사과 · 회복',hurt:'체력 −1',fall:'안전지점으로!',block:'방패가 지켰어요!',finish:'이타카를 향해!'};
  const text=this.add.text(x-(this.run?.x||0)+192,y-35,words[kind]||'',{fontFamily:'sans-serif',fontStyle:'bold',fontSize:kind==='star'?'15px':'20px',color:kind==='hurt'?'#ffb8a3':'#ffebae',stroke:'#20394b',strokeThickness:4}).setOrigin(.5).setDepth(30);
  this.bursts.push({text,life:.9});
 }
 update(_time:number,delta:number){
  if(!this.hero)return;
  this.host.frame(delta/1000);
  if(this.mode==='home'){
   const t=this.host.reduced()?0:this.time.now/1000;this.bg[0].tilePositionX=310;this.bg[1].tilePositionX=100+Math.sin(t*.1)*5;this.bg[2].tilePositionX=0;
   this.boat.y=410+Math.sin(t*1.3)*3;this.hero.y=442+Math.sin(t*1.3)*3;this.ground.clear();this.fx.clear();
  }else this.drawRun();
  const playing=this.run?.state==='playing';
  if(playing){for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.life-=Math.min(delta/1000,.05);if(!this.host.reduced())b.text.y-=delta*.025;b.text.setAlpha(Math.min(1,b.life*2));if(b.life<=0){b.text.destroy();this.bursts.splice(i,1);}}}
 }
 private drawRun(){
  const r=this.run;if(!r)return;const cam=r.x-192;const dark=this.stage==='cave';
  this.bg[0].tilePositionX=310;this.bg[1].tilePositionX=r.x*.09;this.bg[2].tilePositionX=r.x*.23;
  const g=this.ground;g.clear();
  // Ground spans retain the complete logical view, including on small screens.
  let start=cam-20;
  const groundSpan=(a:number,b:number)=>{if(b<a)return;g.fillStyle(dark?0x5d6571:this.stage==='wind'?0x9bafa3:0xd0ac77).fillRect(a-cam,440,b-a,100);g.fillStyle(dark?0xaaa797:0xf0dfb4).fillRect(a-cam,440,b-a,12);g.lineStyle(2,dark?0x747b7d:0xbc9764,.6);for(let x=Math.floor(a/100)*100;x<b;x+=100){g.strokeRect(x-cam,463,82,40);g.lineBetween(x-cam,483,x+28-cam,483);}};
  for(const gap of r.course.gaps){if(gap.x+gap.w<start||gap.x>cam+1000)continue;groundSpan(start,gap.x);start=gap.x+gap.w;}
  groundSpan(start,cam+1000);
  this.obstacles.forEach((s,i)=>{const o=r.course.obstacles[i],x=o.x-cam;s.setVisible(x>-200&&x<1020).setX(x);if(o.kind==='falling'){const d=o.x-r.x;s.y=o.y-Math.max(0,Math.min(290,(d-100)*1.5));}});
  this.items.forEach((s,i)=>{const item=r.course.items[i],x=item.x-cam;s.setVisible(!r.collected.has(item.id)&&x>-40&&x<1000).setPosition(x,item.y+(this.host.reduced()?0:Math.sin(r.time*3+i)*3));});
  this.platforms.forEach((s,i)=>{const p=r.course.platforms[i];s.setPosition(p.x-cam,r.platformY(p)).setVisible(Math.abs(p.x-r.x)<1100);});
  const fx=this.fx;fx.clear();
  r.course.winds.forEach(w=>{
   const x=w.x-cam;if(x+w.w<0||x>960)return;
   fx.fillStyle(0xc8f0da,.2).fillRect(x,w.y,w.w,w.h);fx.lineStyle(3,0xe1f6ce,.8);
   for(let k=0;k<8;k++){const xx=x+40+k*80,yy=400-(((this.host.reduced()?0:r.time*65)+k*41)%290);fx.lineBetween(xx,yy+12,xx,yy-16);fx.lineBetween(xx,yy-16,xx-8,yy-5);fx.lineBetween(xx,yy-16,xx+8,yy-5);}
  });
  r.course.obstacles.filter(o=>o.kind==='falling'&&o.x-r.x<650&&o.x>r.x-70).forEach(o=>{const x=o.x-cam+30;fx.fillStyle(0xe8b04d,.22).fillRect(x-42,340,84,100);fx.fillStyle(0xeab758).fillTriangle(x,310,x-12,332,x+12,332);});
  this.drawHero(r);
  if(r.shield){fx.lineStyle(3,0xffdf85,.85).strokeEllipse(192,r.y-35,86,96);}
  if(r.wings>0){fx.lineStyle(4,0xf4f3d4,.8);fx.lineBetween(160,r.y-40,132,r.y-63);fx.lineBetween(222,r.y-40,246,r.y-63);}
  this.giant.setVisible(this.stage==='cave').setPosition(r.hp<=0?140:r.hp===3?-45:r.hp===2?15:63,440).setDisplaySize(170,230);
  if(r.x<3200){this.label.setPosition(590,160).setText(r.x<1000?'이타카로 가는 여정, 출발!':this.stage==='wind'?'↑ 바람길에서 가볍게 뛰어 보세요':r.x<2100?'Space / ↑ · 점프, 한 번 더 누르면 2단 점프':'↓ 꾹 누르기 · 슬라이드');}
  else if(r.x>22400){this.label.setPosition(650,180).setText(this.stage==='wind'?'이타카 항구가 보여요!':'도착 항구가 보여요!');this.boat.setVisible(true).setPosition(760-(r.x-22400)*.08,370).setDisplaySize(216,142);}
  else{this.label.setText('');this.boat.setVisible(false);}
 }
 private drawHero(r:Runner){
  // One supplied illustration, four running phases. Only rendering changes;
  // collision boxes and the fixed game clock remain owned by Runner.
  let width=66,height=88,x=192,y=r.y+2,rotation=0;
  if(r.state==='success'){width=69;height=92;rotation=-.045;}
  else if(r.sliding){width=32;height=88;rotation=Math.PI/2;x-=44;y-=17;}
  else if(r.grounded){const phase=Math.floor(r.time*12)%4;height=[88,90,87,89][phase];width=height*.75;rotation=[-.025,.015,.025,-.01][phase];}
  else rotation=r.vy<0?-.1:.075;
  if(r.invincible>1)rotation-=.12;
  this.hero.setDisplaySize(width,height).setRotation(rotation).setPosition(x,y).setAlpha(r.invincible>0?.55+.35*Math.abs(Math.sin(r.time*18)):1);
 }
}
