// Optional offline regeneration; the game uses committed data, not Canvas reads.
import {chromium} from '@playwright/test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'odyssey-masks-'));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const p=await b.newPage();
 for(const name of ['star','rock']){
  const svg=await readFile(`public/assets/${name}.svg`,'utf8');
  const data=await p.evaluate(async svg=>{const im=new Image();im.src='data:image/svg+xml;base64,'+btoa(svg);await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d')!.drawImage(im,0,0);return c.toDataURL().split(',')[1];},svg);
  await writeFile(join(dir,name+'.png'),Buffer.from(data,'base64'));
 }
 execFileSync('python',['scripts/prepare-contact-masks.py',dir],{stdio:'inherit'});
}finally{await b.close();await rm(dir,{recursive:true,force:true});}
