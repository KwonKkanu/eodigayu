const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});let creates=0;const errors=[];
 p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/sessions'))creates++;});p.on('pageerror',e=>errors.push(e.message));
 for(const lang of ['ko','en']){
  await p.goto('http://localhost:3080');await p.locator('#'+lang).click();await p.locator('#example').click();await p.locator('#confirm').click();
  assert.equal(await p.locator('[data-route]').count(),0);assert.match(await p.locator('#recommended-route').innerText(),/825/);
  if(lang==='ko')await p.screenshot({path:'artifacts/recommended-route.png',fullPage:true});
  const before=creates;await p.locator('#route-understood').click();assert.equal(await p.locator('#route-link').count(),0);
  if(lang==='ko')await p.screenshot({path:'artifacts/phone-offer.png',fullPage:true});
  await p.locator('#decline-phone').click();assert.equal(creates,before);assert.equal(await p.locator('#recommended-route').count(),0);assert.equal(await p.locator('.arrived-card').count(),1);await p.locator('#done').click();await p.locator('#example').click();await p.locator('#confirm').click();await p.locator('#route-understood').click();await p.locator('#accept-phone').click();await p.locator('#mobile-open').waitFor();assert.equal(creates,before+1);
  const phone=await b.newPage();await phone.goto(await p.locator('#mobile-open').getAttribute('href'));await phone.locator('#board').waitFor();assert.match(await phone.locator('.bus-id').innerText(),/825/);assert.equal(await phone.locator('html').getAttribute('lang'),lang);await phone.close();
 }
 assert.deepEqual(errors,[]);await b.close();console.log('PASS: recommended route first, separate consent, decline without session creation, accepted route/language handoff (KO/EN).');
})().catch(e=>{console.error(e);process.exit(1)});
