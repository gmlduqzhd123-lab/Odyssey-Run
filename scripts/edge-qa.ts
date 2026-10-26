import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const url=process.env.QA_URL||'http://localhost:4174/qa-odyssey/';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:960,height:620}});
 await page.route('**/odysseus-*.webp',r=>r.abort());await page.goto(url);await expect(page.locator('[data-action="reload"]')).toBeVisible();await page.unroute('**/odysseus-*.webp');await page.locator('[data-action="reload"]').click();await page.waitForSelector('.home');
 await page.locator('[data-action="islands"]').first().click();await page.locator('[data-action="stage:beach"]').click();await page.locator('[data-action="start"]').click();await page.waitForSelector('.countdown',{state:'detached'});await page.keyboard.press('p');
 for(let i=0;i<3;i++){await page.locator('[data-action="restart"]').evaluate(el=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));el.dispatchEvent(new MouseEvent('click',{bubbles:true}));el.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await expect(page.locator('.countdown')).toHaveCount(1);await expect(page.locator('#score')).toHaveText('0');await page.getByRole('button',{name:'잠시 멈추기'}).click();}
 await page.locator('[data-action="islands"]').click();await page.locator('[data-action="home"]').click();await page.locator('[data-action="settings"]').click();
 const unchanged=await page.evaluate(()=>Object.entries(localStorage));
 await page.locator('#import-file').setInputFiles({name:'big.json',mimeType:'application/json',buffer:Buffer.alloc(65537,32)});await expect(page.locator('#import-error')).toContainText('64KiB');expect(await page.evaluate(()=>Object.entries(localStorage))).toEqual(unchanged);
 await page.locator('#import-file').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999,"contentVersion":1}')});await expect(page.locator('#import-error')).toContainText('버전');expect(await page.evaluate(()=>Object.entries(localStorage))).toEqual(unchanged);
 await page.close();
 const denied=await browser.newContext({viewport:{width:960,height:620},acceptDownloads:true});
 await denied.addInitScript("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}}); window.AudioContext = class { constructor(){throw new Error('No audio')} };");
 const d=await denied.newPage();const errors:string[]=[];d.on('pageerror',e=>errors.push(e.message));await d.goto(url);await d.waitForSelector('.home');await d.locator('[data-action="islands"]').first().click();await d.locator('[data-action="stage:beach"]').click();await expect(d.locator('#notice')).toContainText('저장하지 못했어요');await d.locator('[data-action="start"]').click();await d.waitForSelector('.countdown',{state:'detached'});await d.waitForTimeout(500);await expect(d.locator('#score')).not.toHaveText('0');await d.keyboard.press('p');await d.locator('[data-action="islands"]').click();await d.locator('[data-action="home"]').click();await d.locator('[data-action="settings"]').click();const download=d.waitForEvent('download');await d.locator('[data-action="export"]').click();await (await download).saveAs('artifacts/storage-denied-export.json');expect(errors).toEqual([]);await denied.close();
 await writeFile('artifacts/edge-results.json',JSON.stringify({url,assetErrorRetry:true,rapidRestartClicks:9,oversizedFileRejected:true,unsupportedVersionRejected:true,storageDeniedPlayAndExport:true,audioUnavailablePlay:true,errors},null,2));console.log('Edge QA passed.');
}finally{await browser.close();}
