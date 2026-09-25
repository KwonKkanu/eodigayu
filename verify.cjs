const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const base='http://127.0.0.1:3080';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,body,key){return fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:body?JSON.stringify(body):undefined});}
(async()=>{
 await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.screenshot({path:path.join(__dirname,'artifacts/kiosk.png'),fullPage:true});
 await page.locator('#destination').fill('<script>alert(1)</script>');await page.locator('#search-form button').click();assert.match(await page.locator('#input-error').innerText(),/대전역/);
 for(const lang of ['ko','en']){
  const route='A';
  await page.goto(base);await page.locator(`#${lang}`).click();await page.locator('#example').click();await page.locator('#confirm').click();await page.locator('#route-understood').click();await page.locator('#accept-phone').click();await page.locator('#mobile-open').waitFor();
  const mobileURL=await page.locator('#mobile-open').getAttribute('href'),controlURL=await page.locator('#control-open').getAttribute('href');
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));
  const control=await context.newPage();await phone.goto(mobileURL);await control.goto(base+controlURL);await phone.locator('#board').waitFor();
  assert.equal(await phone.locator('.bus-id').innerText(),`▣ ${route==='A'?'825':'826'}`);
  assert.equal(await phone.locator('html').getAttribute('lang'),lang);
  assert.ok(await control.locator('#next').isDisabled());
  if(lang==='ko'&&route==='A')await phone.screenshot({path:path.join(__dirname,'artifacts/mobile-received.png'),fullPage:true});
  await phone.locator('#board').click();await control.locator('#next:not([disabled])').waitFor();
  let count=0;
  while(await control.locator('#next').isEnabled()){
    await control.locator('#next').click();await sleep(1200);count++;
    if(lang==='ko'&&route==='A'&&count===2)await phone.screenshot({path:path.join(__dirname,'artifacts/mobile-moving.png'),fullPage:true});
    if(lang==='ko'&&route==='A'&&count===3){assert.equal(await phone.locator('.alert-card').count(),1);await phone.screenshot({path:path.join(__dirname,'artifacts/mobile-alert.png'),fullPage:true});}
    assert.ok(count<=5);
  }
  await phone.locator('#finish').waitFor();await phone.locator('#finish').click();await phone.locator('.empty-state').waitFor();
  await control.locator('#reset-trip').click();await phone.locator('#board').waitFor();await phone.locator('#board').click();await control.locator('#next:not([disabled])').waitFor();
  await control.locator('#auto').click();await sleep(1300);assert.match(await control.locator('.auto-indicator').innerText(),/자동 진행 중/);await control.locator('#auto').click();
  await phone.close();await control.close();
 }
 const a=await(await request(base+'/api/sessions',{route:'A',lang:'ko'})).json();const b=await(await request(base+'/api/sessions',{route:'B',lang:'en'})).json();
 assert.equal((await request(base+`/api/sessions/${a.session.id}`,{action:'next'},b.controlKey)).status,403);
 assert.equal((await request(base+`/api/sessions/${a.session.id}`,{action:'finish'})).status,409);
 assert.equal((await request(base+`/api/sessions/${a.session.id}`,{action:'next'},a.controlKey)).status,409);
 await request(base+`/api/sessions/${a.session.id}`,{action:'board'});await request(base+`/api/sessions/${a.session.id}`,{action:'auto'},a.controlKey);await sleep(8200);
 const auto=await(await request(base+`/api/sessions/${a.session.id}`)).json();assert.equal(auto.stop,1);
 assert.equal((await(await request(base+`/api/sessions/${b.session.id}`)).json()).phase,'waiting');
 assert.equal((await request(base+'/api/sessions',{route:'INVALID',lang:'ko'})).status,400);
 assert.equal((await request(base+`/api/sessions/${a.session.id}/qr`)).status,409);
 await page.goto(base+'/mobile.html#bad');assert.match(await page.locator('h1').innerText(),/링크/);
 for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:900});await page.goto(base);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);}
 const qrServer=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...process.env,PORT:'3081',PUBLIC_BASE_URL:'https://demo.example'},stdio:'ignore'});
 try{
  await sleep(700);const qrSession=await(await request('http://127.0.0.1:3081/api/sessions',{route:'A',lang:'ko'})).json();const qr=await request(`http://127.0.0.1:3081/api/sessions/${qrSession.session.id}/qr`);assert.equal(qr.status,200);assert.match(await qr.text(),/<svg/);
 }finally{qrServer.kill();}
 assert.deepEqual(errors,[]);console.log('PASS: 2 bilingual recommended-route journeys across independent browser contexts; boarding, remote movement, arrival, reset, auto-progress, isolation, authorization, validation, QR output, invalid link, responsive widths. No JS errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
