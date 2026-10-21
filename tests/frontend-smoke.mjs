import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('frontend/index.html')).href;
const browserPath = process.env.TOPAGENT_BROWSER_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

async function showRail(page) {
  const open = await page.locator('#rail').evaluate(el => el.classList.contains('open'));
  if (!open) await page.locator('#mobileMenu').click();
  await page.waitForFunction(() => {
    const rect=document.querySelector('#rail').getBoundingClientRect(); return rect.width>1 && rect.left>=-1;
  });
}

async function hideRail(page) {
  const open = await page.locator('#rail').evaluate(el => el.classList.contains('open'));
  if (open) await page.locator('#railClose').click();
  await page.waitForFunction(() => {
    const rect=document.querySelector('#rail').getBoundingClientRect(); return rect.width<=1 || rect.right<=1;
  });
}

async function assertBottomComposer(page, height) {
  const input=await page.locator('#input').boundingBox();
  assert.ok(input.y>height*0.78, 'composer remains at the bottom of the viewport');
  assert.ok(input.y+input.height<height, 'composer remains within the viewport');
}

test('Top chat keeps context and follow-ups during a guest visit', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const requests = [];
    await page.route('https://topsiagent.onrender.com/api/search', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      const response = requests.length === 1
        ? { type: 'results', reply: 'Ikki mos variant topdim.', followUps: ['Batareyasi uzoqroq bo‘lsin'], products: [
            { title: 'Sony WH-CH720N', price: 120, currency: 'USD', store: 'Sony', why: 'Budjetga mos.', url: 'https://example.com/sony' },
            { title: 'Anker Soundcore Q45', price: 100, currency: 'USD', store: 'Anker', why: 'Arzonroq variant.', url: 'https://example.com/anker' }
          ] }
        : { type: 'clarify', reply: 'Qaysi rangni xohlaysiz?', followUps: ['Qora', 'Oq'], products: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.goto(url);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(247, 247, 248)');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).color), 'rgb(38, 38, 38)');
    assert.match(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily), /^Arial/);
    assert.equal(await page.locator('#chatHeading').innerText(), 'Bugun nima sotib olamiz?');
    assert.equal(await page.locator('.brand').innerText(), 'Top');
    assert.equal(Math.round((await page.locator('#rail').boundingBox()).width),260);
    assert.equal(await page.locator('#railClose').isVisible(),true);
    assert.equal(await page.locator('#accountButton .avatar svg').isVisible(),true);
    assert.equal(await page.locator('#accountButton').evaluate(el => !!el.closest('#rail')),true);
    await assertBottomComposer(page,900);
    const star=page.locator('.welcome-mark .logo-mark polygon');
    assert.equal(await star.count(),1);
    assert.equal(await star.evaluate(el => getComputedStyle(el).fill),'rgb(255, 255, 255)');
    assert.equal((await star.getAttribute('points')).trim().split(/\s+/).length,10);
    const suggestionBox=await page.locator('#suggestions').boundingBox();
    assert.ok(suggestionBox.y+suggestionBox.height<(await page.locator('#input').boundingBox()).y,'welcome cards sit above the bottom composer');
    await hideRail(page);
    assert.equal(await page.locator('#mobileMenu').isVisible(),true);
    await showRail(page);
    assert.equal(await page.locator('#send').isDisabled(), true);
    assert.deepEqual(await page.locator('#suggestions .suggestion strong').allInnerTexts(), ['Ot uchun egar', 'Nike sneakers', 'Samsung TV','Maktab uchun ryukzak']);
    await page.locator('#suggestions .suggestion').first().click();
    assert.equal(await page.locator('#input').inputValue(),'Ot uchun egar');
    assert.equal(requests.length,0,'a welcome suggestion fills the draft without sending it');
    await page.locator('#input').fill('   ');
    assert.equal(await page.locator('#send').isDisabled(), true);
    await page.locator('#input').fill('200 dollargacha quloqchin');
    assert.equal(await page.locator('#send').isEnabled(), true);
    assert.ok(await page.locator('#suggestions .suggestion').count() >= 2);
    await page.locator('#send').click();
    await page.locator('.card').first().waitFor();
    assert.equal(await page.locator('#send').isDisabled(), true);
    assert.equal(await page.locator('.card').count(), 2);
    await page.locator('.card .purchase-choices button').first().click();
    assert.equal(await page.locator('#purchaseDialog').isVisible(), true);
    assert.match(await page.locator('#purchaseProduct').innerText(), /Sony WH-CH720N/);
    assert.equal(await page.locator('#purchaseAuto').isDisabled(), true);
    assert.equal(await page.locator('#purchaseStore').getAttribute('href'), 'https://example.com/sony');
    assert.match(await page.locator('#purchaseStatus').innerText(), /hali qo‘llamaydi/);
    await page.locator('#closePurchase').click();
    assert.ok((await page.locator('#suggestions').innerText()).includes('Boshqa tavsiyalarni ko‘rsat'));
    assert.ok((await page.locator('#suggestions').innerText()).includes('Batareyasi uzoqroq bo‘lsin'));
    await page.locator('.compare-pick input').nth(0).check();
    await page.locator('.compare-pick input').nth(1).check();
    await page.locator('.message-products .compare-action').click();
    assert.equal(await page.locator('#compareDialog').isVisible(), true);
    assert.match(await page.locator('#compareTable').innerText(), /Sony WH-CH720N/);
    await page.locator('#closeDialog').click();
    await page.locator('#input').fill('Arzonrog‘i bormi?');
    await page.locator('#send').click();
    await page.getByText('Qaysi rangni xohlaysiz?').waitFor();
    assert.equal(requests[1].history[0].content, '200 dollargacha quloqchin');
    assert.equal(requests[1].history.find(turn => turn.products)?.products[0].title, 'Sony WH-CH720N');
    assert.equal(await page.locator('.card').count(), 2);
    assert.doesNotMatch(await page.locator('#suggestions').innerText(), /Xarid variantlari/,'a clarification must not show a purchase action from an older result');
    assert.equal(await page.locator('#historyList .history-item').count(), 1);
    await page.locator('#openSearch').click();
    assert.equal(await page.locator('#searchDialog').isVisible(),true);
    await page.locator('#historySearch').fill('quloqchin');
    assert.equal(await page.locator('#searchResults .search-result').count(), 1);
    await page.locator('#historySearch').fill('telefon');
    assert.equal(await page.locator('#searchResults .search-result').count(), 0);
    assert.equal(await page.locator('#searchEmpty').innerText(), 'Mos chat topilmadi');
    await page.locator('#historySearch').fill('');
    assert.equal(await page.locator('#searchEmpty').innerText(), 'Chatlaringizni qidiring');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#historyList .history-item').count(), 1);
    await showRail(page);
    await page.locator('#railNew').click();
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
    await showRail(page);
    await page.locator('#historyList .history-open').click();
    assert.equal(await page.locator('.message.user').count(), 2);
    assert.equal(await page.locator('#language, #languageMobile').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
    await showRail(page);
    await page.locator('#railNew').click();
    await hideRail(page);
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
    assert.equal(await page.locator('#chatHeading').innerText(), 'Bugun nima sotib olamiz?');
    assert.equal(await page.locator('.brand').innerText(), 'Top');
    assert.equal(await page.locator('#suggestions .suggestion').count(), 4);
    assert.equal(await page.locator('#suggestions').isVisible(),true,'new v0 mobile welcome shows horizontal suggestion cards');
    assert.equal(await page.locator('#suggestions').evaluate(el=>el.scrollWidth>el.clientWidth),true);
    assert.equal(Math.round((await page.locator('.welcome-mark').boundingBox()).width),42);
    assert.equal(Math.round((await page.locator('#send').boundingBox()).width),38);
    assert.equal(await page.locator('#mobileNew').count(),0);
    await assertBottomComposer(page,844);
    await showRail(page);
    assert.equal(await page.locator('#accountButton .avatar svg').isVisible(), true);
    await page.locator('#settingsButton').click();
    assert.equal(await page.locator('#settingsDialog').isVisible(),true);
    await page.locator('#themeToggle').click();
    assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(247, 247, 248)');
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(247, 247, 248)');
    assert.equal(await page.locator('#chatHeading').evaluate(el => getComputedStyle(el).color), 'rgb(47, 47, 47)');
    await page.keyboard.press('Escape');
    await hideRail(page);
    await page.setViewportSize({width:560,height:844});
    await page.locator('#suggestions .suggestion').first().click();
    assert.equal(await page.locator('#input').inputValue(),'Ot uchun egar');
    assert.equal(requests.length,2);
    await page.locator('#send').click();
    await page.getByText('Qaysi rangni xohlaysiz?').waitFor();
    assert.equal(requests.at(-1).query, 'Ot uchun egar');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#suggestions').isVisible(),true,'follow-up chips remain visible on small mobile');
    assert.equal(await page.evaluate(()=>localStorage.getItem('top_chats_guest_v1')),null);
    await page.reload();
    assert.equal(await page.locator('#historyList .history-item').count(),0);
    assert.equal(await page.locator('.message.user').count(),0);
    assert.equal(await page.locator('#chatHeading').isVisible(),true);
    await page.evaluate(()=>localStorage.setItem('top_chats_guest_v1',JSON.stringify([{id:'legacy',title:'Old guest chat',messages:[{role:'user',content:'Old request'}],updatedAt:new Date().toISOString()}])));
    await page.reload();
    assert.equal(await page.locator('#historyList .history-item').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('top_chats_guest_v1')),null);
  } finally { await browser.close(); }
});

test('mobile opens with its sidebar closed and chat search finds titles and message content', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      const query=route.request().postDataJSON().query;
      const reply=query==='Kundalik xarid'?'Ko‘k chamadon top':'Qizil rangdagi variant kerak';
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'clarify',reply,products:[]})});
    });
    await page.goto(url);
    assert.equal(await page.locator('#rail').evaluate(el=>el.classList.contains('open')),false);
    assert.equal(await page.locator('#mobileMenu').isVisible(),true);
    assert.equal(await page.locator('#suggestions').isVisible(),true);
    assert.equal(await page.locator('#suggestions').evaluate(el=>el.scrollWidth>el.clientWidth),true);
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
    await page.locator('#input').fill('Kundalik xarid');
    await page.locator('#send').click();
    await page.locator('#messages').getByText('Ko‘k chamadon top').waitFor();
    await showRail(page);
    await page.locator('#railNew').click();
    await page.locator('#input').fill('Telefon uchun g‘ilof');
    await page.locator('#send').click();
    await page.locator('#messages').getByText('Qizil rangdagi variant kerak').waitFor();
    await page.locator('#input').focus();
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#searchDialog').isVisible(),true);
    assert.equal(await page.locator('#historySearch').evaluate(el=>el===document.activeElement),true);
    await page.locator('#historySearch').fill('chamadon');
    assert.deepEqual(await page.locator('#searchResults strong').allInnerTexts(),['Kundalik xarid']);
    assert.equal(await page.locator('#historyList .history-item').count(),2,'search keeps sidebar history intact');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#searchDialog').isVisible(),false);
    assert.equal(await page.locator('#input').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Control+k');
    await page.locator('#historySearch').fill('chamadon');
    await page.locator('#historySearch').press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.locator('#messages').getByText('Ko‘k chamadon top',{exact:true}).waitFor();
    assert.equal(await page.locator('#searchDialog').isVisible(),false);
    assert.ok((await page.getByRole('button',{name:'Nusxalash',exact:true}).boundingBox()).width>=32);
    await showRail(page);
    await page.locator('#openSearch').click();
    await page.locator('#historySearch').fill('Telefon');
    assert.deepEqual(await page.locator('#searchResults strong').allInnerTexts(),['Telefon uchun g‘ilof']);
    await page.locator('#historySearch').press('Enter');
    await page.locator('#messages').getByText('Qizil rangdagi variant kerak',{exact:true}).waitFor();
    assert.equal(await page.locator('#rail').evaluate(el=>el.classList.contains('open')),false);
  } finally {await browser.close();}
});

test('send readiness, thinking motion and IME input behave like a chat app', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  let finishResponse;
  const responseReady=new Promise(resolveResponse=>{finishResponse=resolveResponse;});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
    let searches=0;
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      searches++;
      await responseReady;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'clarify',reply:'Qanday rangdagi egar kerak?',products:[],followUps:['Qizil','Jigarrang']})});
    });
    await page.goto(url);
    assert.equal(await page.locator('#send').isDisabled(),true);
    assert.equal(await page.locator('#send').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(229, 229, 229)');
    await page.locator('#input').fill('Ot uchun egar qidir');
    assert.equal(await page.locator('#send').isEnabled(),true);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#send')).backgroundColor==='rgb(47, 47, 47)');
    await page.locator('#input').dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:229,isComposing:true,bubbles:true});
    await page.evaluate(()=>new Promise(resolveFrame=>requestAnimationFrame(()=>requestAnimationFrame(resolveFrame))));
    assert.equal(searches,0,'IME composition Enter must not submit a message');
    assert.equal(await page.locator('#input').inputValue(),'Ot uchun egar qidir');
    await page.locator('#input').press('Enter');
    await page.locator('.message.loading .thinking-dots').waitFor();
    assert.equal(searches,1);
    assert.equal(await page.locator('#send').isEnabled(),true);
    assert.equal(await page.locator('#send').getAttribute('aria-label'),'Javobni to‘xtatish');
    assert.equal(await page.locator('.thinking-dots i').count(),3);
    assert.equal(await page.locator('.thinking-dots i').first().evaluate(el=>getComputedStyle(el).animationName),'thinking');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.thinking-dots i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.ok((await page.locator('#rail').evaluate(el=>getComputedStyle(el).transitionDuration)).split(',').every(duration=>Number.parseFloat(duration)===0));
    finishResponse();
    await page.getByText('Qanday rangdagi egar kerak?').waitFor();
    assert.equal(await page.locator('.thinking-dots').count(),0);
    assert.equal(await page.getByRole('button',{name:'Nusxalash',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Qayta yaratish',exact:true}).count(),1);
    assert.equal(await page.locator('.message.assistant').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('#send').isDisabled(),true);
  } finally { finishResponse(); await browser.close(); }
});

test('an older product result remains available to later follow-ups', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage();
    let request; let searches=0;
    await page.route('https://topsiagent.onrender.com/api/search', async route => {
      request = route.request().postDataJSON();
      searches++;
      const response=searches===1
        ? {type:'results',reply:'Ikki variant topdim.',products:[{title:'Sport ryukzak',store:'Uzum Market',url:'https://uzum.uz/uz/product/sport-ryukzak'}]}
        : {type:'clarify',reply:searches===7?'Tushundim.':`Javob ${searches-2}`,products:[],followUps:[]};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.goto(url);
    await page.locator('#input').fill('Maktab uchun ryukzak qidir');
    await page.locator('#send').click();
    await page.locator('.card').first().waitFor();
    for(let index=0;index<5;index++){
      await page.locator('#input').fill(`Savol ${index}`);
      await page.locator('#send').click();
      await page.locator('#messages').getByText(`Javob ${index}`,{exact:true}).waitFor();
    }
    await page.locator('#input').fill('birinchisi, shuni sotib ol');
    await page.locator('#send').click();
    await page.getByText('Tushundim.').waitFor();
    assert.equal(request.history[0].products[0].title, 'Sport ryukzak');
    assert.equal(request.history.length, 9);
  } finally { await browser.close(); }
});

test('sign-in moves guest chats to the account and loads them on return', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const context = await browser.newContext(); const page = await context.newPage();
    const stored = [];
    await page.route('https://topsiagent.onrender.com/api/**', async route => {
      const request=route.request(); const path=new URL(request.url()).pathname;
      let data={}; let status=200;
      if(path==='/api/search') data={type:'clarify',reply:'Qancha budjet ajratasiz?',products:[]};
      else if(path==='/api/auth/login') data={user:{id:'test-user',email:'test@example.com'},session:{access_token:'token',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600}};
      else if(path==='/api/chats' && request.method()==='GET') data={chats:stored.map(({id,title,updated_at})=>({id,title,updated_at}))};
      else if(path==='/api/chats' && request.method()==='POST') { const body=request.postDataJSON(); const chat={id:'11111111-1111-4111-8111-111111111111',...body,updated_at:new Date().toISOString()}; stored.push(chat); data={chat}; status=201; }
      else if(path.startsWith('/api/chats/')) data={chat:stored.find(chat=>path.endsWith(chat.id))};
      else { status=404; data={error:'Unknown route'}; }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    assert.equal(await page.locator('#workspace').evaluate(el => el.classList.contains('signed-in')), false);
    assert.equal(await page.locator('#railClose').isVisible(), true);
    assert.equal(await page.locator('#mobileNew').count(), 0);
    assert.equal(await page.locator('#themeToggle').isVisible(), false);
    await hideRail(page);
    await assertBottomComposer(page,844);
    await page.locator('#input').fill('Menga noutbuk kerak'); await page.locator('#send').click();
    await page.getByText('Qancha budjet ajratasiz?').waitFor();
    await showRail(page);
    await page.locator('#accountButton').click();
    assert.equal(await page.locator('#resendConfirmation').isVisible(),true);
    await page.locator('#authEmail').fill('test@example.com'); await page.locator('#authPassword').fill('password123');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(()=>document.querySelector('#historyFoot').textContent.includes('hisobingizda'));
    assert.equal(stored.length,1);
    assert.equal(stored[0].messages.length,2);
    await page.reload();
    await page.getByText('Qancha budjet ajratasiz?').waitFor();
    assert.equal(await page.locator('#historyList .history-item').count(),1);
    await showRail(page);
    await page.locator('#railNew').click();
    await hideRail(page);
    assert.equal(await page.locator('#workspace').evaluate(el => el.classList.contains('signed-in')), true);
    await assertBottomComposer(page,844);
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
  } finally { await browser.close(); }
});

test('expired confirmation offers a new email and clears callback tokens', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage();
    const resent = [];
    await page.route('https://topsiagent.onrender.com/api/auth/resend-confirmation', async route => {
      resent.push(route.request().postDataJSON());
      await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    });
    await page.goto(`${url}#error=access_denied&error_code=otp_expired`);
    assert.match(await page.locator('#authError').innerText(),/eskirgan yoki ishlatilgan/);
    assert.equal(await page.locator('#resendConfirmation').isVisible(),true);
    assert.equal(new URL(page.url()).hash,'');
    await page.locator('#authEmail').fill('buyer@example.com');
    await page.locator('#resendConfirmation').click();
    await page.locator('#authStatus').waitFor({state:'visible'});
    assert.deepEqual(resent,[{email:'buyer@example.com'}]);
    assert.match(await page.locator('#authStatus').innerText(),/Yangi havola yuborildi/);
    await page.goto(`${url}#access_token=sample&refresh_token=sample`);
    await page.reload();
    assert.match(await page.locator('#authStatus').innerText(),/Email tasdiqlandi/);
    assert.equal(new URL(page.url()).hash,'');
  } finally { await browser.close(); }
});

test('signed-in chat can attach an image, rename, share, regenerate and delete safely', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const chatId = '11111111-1111-4111-8111-111111111111';
    const imageId = '22222222-2222-4222-8222-222222222222';
    const shareId = '33333333-3333-4333-8333-333333333333';
    const chats = [];
    const searches = [];
    let failDelete = true;
    let shareActive = true;
    await page.route('https://topsiagent.onrender.com/api/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      const method = request.method(); let data = {}; let status = 200;
      if (path === '/api/auth/login') data = { user: { id: 'test-user', email: 'test@example.com' }, session: { access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now()/1000)+3600 } };
      else if (path === '/api/chats' && method === 'GET') data = { chats: chats.map(({id,title,updated_at}) => ({id,title,updated_at})) };
      else if (path === '/api/chats' && method === 'POST') { const body=request.postDataJSON(); const chat={id:chatId,...body,updated_at:new Date().toISOString()}; chats.push(chat); data={chat}; status=201; }
      else if (path === `/api/chats/${chatId}` && method === 'GET') data={chat:chats[0]};
      else if (path === `/api/chats/${chatId}` && method === 'PATCH') { Object.assign(chats[0],request.postDataJSON(),{updated_at:new Date().toISOString()}); data={chat:chats[0]}; }
      else if (path === `/api/chats/${chatId}` && method === 'DELETE') { if(failDelete){status=500;data={error:'Server error'};}else{chats.length=0;data={ok:true};} }
      else if (path === `/api/chats/${chatId}/images` && method === 'POST') data={image:{id:imageId,mimeType:'image/webp'}};
      else if (path === `/api/chats/${chatId}/images/${imageId}` && method === 'GET') return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=','base64')});
      else if (path === `/api/chats/${chatId}/share` && method === 'POST') data={url:`https://topagent-frontend.vercel.app/?share=${shareId}`,expiresAt:new Date(Date.now()+86400000).toISOString()};
      else if (path === `/api/chats/${chatId}/share` && method === 'DELETE') { shareActive=false; data={ok:true}; }
      else if (path === `/api/shared/${shareId}` && method === 'GET') { if(!shareActive||!chats.length){status=404;data={error:'Not found'};}else data={chat:chats[0],expiresAt:new Date(Date.now()+86400000).toISOString()}; }
      else if (path === '/api/search') { const body=request.postDataJSON(); searches.push(body); data={type:'clarify',reply:`Javob ${searches.length}`,products:[]}; }
      else { status=404; data={error:'Unknown route'}; }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(url);
    await hideRail(page);
    await page.locator('#attach').click();
    assert.equal(await page.locator('#authDialog').isVisible(),true);
    await page.locator('#authEmail').fill('test@example.com'); await page.locator('#authPassword').fill('password123');
    await page.locator('#authSubmit').click();
    await page.locator('#authDialog').waitFor({state:'hidden'});
    await page.locator('#imageFile').setInputFiles({name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('wrong')});
    assert.equal(await page.locator('#imagePreview').isVisible(),false);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=','base64');
    await page.locator('#imageFile').setInputFiles({name:'egар.png',mimeType:'image/png',buffer:png});
    assert.equal(await page.locator('#imagePreview').isVisible(),true);
    assert.equal(await page.locator('#send').isEnabled(),true);
    await page.locator('#send').click();
    await page.getByText('Javob 1').waitFor();
    assert.equal(searches[0].query,'Shu rasmdagi mahsulotni yoki unga o‘xshash variantlarni top.');
    assert.equal(searches[0].imageId,imageId);
    assert.equal(searches[0].chatId,chatId);
    assert.equal(chats[0].messages[0].imageId,imageId);
    await page.getByRole('button',{name:'Qayta yaratish',exact:true}).click();
    await page.getByText('Javob 2').waitFor();
    assert.equal(await page.getByText('Javob 1').count(),0);
    await showRail(page);
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Nomini o‘zgartirish'}).click();
    await page.locator('#renameInput').fill('Qizil egar');
    await page.locator('#renameForm button[type=submit]').click();
    await page.getByRole('button',{name:'Qizil egar',exact:true}).waitFor();
    await showRail(page);
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Ulashish',exact:true}).click();
    assert.match(await page.locator('#shareDialog').innerText(),/keyingi xabarlari va rasmlarini/);
    await page.locator('#createShare').click();
    await page.locator('#shareUrl').waitFor({state:'visible'});
    assert.match(await page.locator('#shareUrl').inputValue(),/share=33333333/);
    await page.locator('#closeShare').click();
    await page.goto(`${url}?share=${shareId}`);
    await page.locator('#sharedTitle').getByText('Qizil egar').waitFor();
    assert.equal(await page.locator('#sharedMessages .message').count(),2);
    assert.equal(await page.locator('#input').isVisible(),false);
    await page.goto(url);
    await showRail(page);
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Ulashish',exact:true}).click();
    await page.locator('#createShare').click();
    await page.locator('#revokeShare').click();
    assert.equal(shareActive,false);
    await page.goto(`${url}?share=${shareId}`);
    await page.getByText('Havola muddati tugagan, bekor qilingan yoki chat o‘chirilgan.').waitFor();
    await page.goto(url);
    await showRail(page);
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Chatni o‘chirish'}).click();
    await page.getByRole('button',{name:'Qizil egar',exact:true}).waitFor();
    failDelete=false;
    await showRail(page);
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Chatni o‘chirish'}).click();
    await page.locator('.history-item').waitFor({state:'detached'});
    assert.equal(chats.length,0);
  } finally { await browser.close(); }
});

test('each assistant turn keeps its own products and comparison while users stay on the right', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const backpackProducts=[
      {title:'Maktab ryukzagi A',store:'Uzum',url:'https://uzum.uz/uz/product/ryukzak-a',price:99000,currency:'UZS'},
      {title:'Maktab ryukzagi B',store:'Uzum',url:'https://uzum.uz/uz/product/ryukzak-b',price:120000,currency:'UZS'}
    ];
    const phoneProducts=[
      {title:'Redmi Note 14',store:'Olcha',url:'https://olcha.uz/uz/product/redmi-note-14'},
      {title:'Samsung A56',store:'Olcha',url:'https://olcha.uz/uz/product/samsung-a56'}
    ];
    let calls=0;
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      const replies=[
        {type:'results',reply:'Ryukzak variantlari.',products:backpackProducts},
        {type:'results',reply:'Telefon variantlari.',products:phoneProducts},
        {type:'clarify',reply:'Qaysi rangni xohlaysiz?',products:[]}
      ];
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(replies[calls++])});
    });
    await page.goto(url);
    for(const [query,reply] of [['Ryukzak kerak','Ryukzak variantlari.'],['Telefon kerak','Telefon variantlari.'],['Boshqa rang kerak','Qaysi rangni xohlaysiz?']]) {
      await page.locator('#input').fill(query);
      await page.locator('#send').click();
      await page.locator('#messages').getByText(reply,{exact:true}).waitFor();
      await page.waitForFunction(()=>!document.querySelector('.message.loading'));
    }
    const turns=page.locator('#messages > .message.assistant');
    assert.equal(await turns.count(),3);
    assert.deepEqual(await turns.nth(0).locator('.card h3').allInnerTexts(),backpackProducts.map(item=>item.title));
    assert.deepEqual(await turns.nth(1).locator('.card h3').allInnerTexts(),phoneProducts.map(item=>item.title));
    assert.equal(await turns.nth(2).locator('.card').count(),0);
    assert.equal(await page.locator('#contentScroll > .results').count(),0,'products belong to their reply, not a detached result section');
    const firstGroup=turns.nth(0).locator('.message-products');
    await firstGroup.locator('.compare-pick input').nth(0).check();
    await firstGroup.locator('.compare-pick input').nth(1).check();
    await firstGroup.locator('.compare-action').click();
    const comparison=await page.locator('#compareTable').innerText();
    assert.match(comparison,/Maktab ryukzagi A/);
    assert.match(comparison,/Maktab ryukzagi B/);
    assert.doesNotMatch(comparison,/Redmi|Samsung/,'old results compare their own products');
    await page.locator('#closeDialog').click();
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await hideRail(page);
      const user=await page.locator('#messages > .message.user .message-text').first().boundingBox();
      const assistant=await turns.nth(0).locator('.message-text').boundingBox();
      const messages=await page.locator('#messages').boundingBox();
      assert.ok(user.x>assistant.x+30,'user bubble starts to the right of assistant text');
      assert.ok(Math.abs(user.x+user.width-(messages.x+messages.width))<3,'user bubble aligns with the right conversation edge');
      assert.equal(await page.locator('.message.user .message-avatar').first().isVisible(),false);
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('.card').count(),4);
      if(viewport.width===390) {
        const cards=await firstGroup.locator('.card').all();
        const a=await cards[0].boundingBox(),b=await cards[1].boundingBox();
        assert.ok(b.y>=a.y+a.height,'mobile cards stack inside their reply');
      }
    }
    await showRail(page);
    await page.locator('#railNew').click();
    await showRail(page);
    await page.locator('#historyList .history-open').click();
    assert.equal(await page.locator('#messages .message-products').count(),2,'reopening restores every product group');
    assert.deepEqual(await page.locator('#messages .card h3').allInnerTexts(),[...backpackProducts,...phoneProducts].map(item=>item.title));
  } finally {await browser.close();}
});

test('stopping generation leaves the question and prevents a late reply from entering another request', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  let releaseOld;
  const held=new Promise(resolve=>{releaseOld=resolve;});
  let oldDone;
  const oldFinished=new Promise(resolve=>{oldDone=resolve;});
  let oldStarted;
  const oldReceived=new Promise(resolve=>{oldStarted=resolve;});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      const query=route.request().postDataJSON().query;
      if(query==='Birinchi savol') {
        oldStarted();
        await held;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'clarify',reply:'Kechikkan eski javob',products:[]})}).catch(()=>{});
        oldDone();
      } else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'clarify',reply:'Yangi javob',products:[]})});
    });
    await page.goto(url);
    await page.locator('#input').fill('Birinchi savol');
    await page.locator('#send').click();
    await page.locator('.message.loading').waitFor();
    await oldReceived;
    await page.getByRole('button',{name:'Javobni to‘xtatish',exact:true}).click();
    await page.locator('.message.loading').waitFor({state:'detached'});
    assert.deepEqual(await page.locator('.message.user .message-text').allInnerTexts(),['Birinchi savol']);
    assert.equal(await page.locator('#send').isDisabled(),true);
    await page.locator('#input').fill('Ikkinchi savol');
    await page.locator('#send').click();
    await page.locator('#messages').getByText('Yangi javob',{exact:true}).waitFor();
    releaseOld();
    await oldFinished;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.getByText('Kechikkan eski javob',{exact:true}).count(),0);
    assert.equal(await page.locator('#messages .message.assistant').count(),1);
    assert.deepEqual(await page.locator('.message.user .message-text').allInnerTexts(),['Birinchi savol','Ikkinchi savol']);
    assert.equal(await page.locator('#send').getAttribute('aria-label'),'Yuborish');
  } finally {releaseOld();await browser.close();}
});

test('editing a question keeps the old branch on failure and replaces it only after success', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'});
    let editAttempts=0;
    const queries=[];
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      const body=route.request().postDataJSON();queries.push(body);
      let status=200,data;
      if(body.query==='Yangi savol') {
        editAttempts++;
        if(editAttempts===1){status=500;data={error:'Temporary failure'};}
        else data={type:'clarify',reply:'Tahrirlangan javob',products:[]};
      } else if(body.query==='Birinchi savol') data={type:'results',reply:'Eski mahsulotlar',products:[{title:'Eski ryukzak',store:'Uzum',url:'https://uzum.uz/uz/product/eski-ryukzak'}]};
      else data={type:'clarify',reply:'Keyingi javob',products:[]};
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(url);
    for(const [query,reply] of [['Birinchi savol','Eski mahsulotlar'],['Keyingi savol','Keyingi javob']]) {
      await page.locator('#input').fill(query);await page.locator('#send').click();
      await page.locator('#messages').getByText(reply,{exact:true}).waitFor();
      await page.waitForFunction(()=>!document.querySelector('.message.loading'));
    }
    await page.getByRole('button',{name:'Xabarni tahrirlash',exact:true}).first().click();
    const editor=page.locator('.message-editor');
    await editor.locator('textarea').fill('Yangi savol');
    await editor.getByRole('button',{name:'Saqlash va yuborish',exact:true}).click();
    await editor.getByText('Yangi javob olinmadi. Oldingi suhbat saqlandi. Qayta urinib ko‘ring.',{exact:true}).waitFor();
    assert.equal(await page.locator('#messages > .message').count(),4);
    assert.equal(await page.locator('#messages .card h3').innerText(),'Eski ryukzak');
    assert.equal(await page.locator('.message.user .message-text').first().textContent(),'Birinchi savol');
    assert.equal(await page.getByText('Keyingi javob',{exact:true}).count(),1);
    await editor.getByRole('button',{name:'Saqlash va yuborish',exact:true}).click();
    await page.locator('#messages').getByText('Tahrirlangan javob',{exact:true}).waitFor();
    assert.equal(await page.locator('.message-editor').count(),0);
    assert.equal(await page.locator('#messages > .message').count(),2);
    assert.deepEqual(await page.locator('.message.user .message-text').allInnerTexts(),['Yangi savol']);
    assert.equal(await page.getByText('Keyingi javob',{exact:true}).count(),0);
    assert.equal(await page.locator('#messages .card').count(),0);
    assert.deepEqual(queries.at(-1).history,[],'an edited first turn cannot inherit its discarded future');
  } finally {await browser.close();}
});

test('reading older messages is preserved when a reply arrives and the latest button returns to the bottom', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  let releaseReply;
  const held=new Promise(resolve=>{releaseReply=resolve;});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    let calls=0;
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      calls++;
      if(calls===2) await held;
      const reply=calls===1?'Batafsil sharh. '.repeat(650):'Yangi javob tayyor.';
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'clarify',reply,products:[]})});
    });
    await page.goto(url);
    await page.locator('#input').fill('Batafsil sharh kerak');await page.locator('#send').click();
    await page.waitForFunction(()=>document.querySelectorAll('#messages .message.assistant:not(.loading)').length===1);
    await page.locator('#input').fill('Yana tavsiya kerak');await page.locator('#send').click();
    await page.locator('.message.loading').waitFor();
    await page.locator('#contentScroll').evaluate(el=>{el.scrollTop=0;});
    await page.locator('#scrollLatest').waitFor({state:'visible'});
    releaseReply();
    await page.locator('#messages').getByText('Yangi javob tayyor.',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.message.loading'));
    assert.equal(await page.locator('#contentScroll').evaluate(el=>el.scrollTop),0,'answer completion must not interrupt reading old messages');
    assert.equal(await page.locator('#scrollLatest').isVisible(),true);
    await page.locator('#scrollLatest').click();
    await page.waitForFunction(()=>{const el=document.querySelector('#contentScroll');return el.scrollHeight-el.clientHeight-el.scrollTop<3;});
    assert.equal(await page.locator('#scrollLatest').isVisible(),false);
  } finally {releaseReply();await browser.close();}
});

test('guest saved products can compare across reply groups and removal does not erase chat cards', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const products=[
      {title:'Saqlangan ryukzak',store:'Uzum',url:'https://uzum.uz/uz/product/saved-backpack',price:99000,currency:'UZS'},
      {title:'Saqlangan telefon',store:'Olcha',url:'https://olcha.uz/uz/product/saved-phone',price:2000000,currency:'UZS'}
    ];
    let calls=0;
    await page.route('https://topsiagent.onrender.com/api/search',async route=>{
      const index=calls++;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'results',reply:`Natija ${index+1}`,products:[products[index]]})});
    });
    await page.goto(url);
    for(let index=0;index<2;index++) {
      await page.locator('#input').fill(index?'Telefon top':'Ryukzak top');
      await page.locator('#send').click();
      await page.locator('#messages').getByText(`Natija ${index+1}`,{exact:true}).waitFor();
      await page.locator('.message-products .save-product').nth(index).click();
      assert.equal(await page.locator('.message-products .save-product').nth(index).getAttribute('aria-pressed'),'true');
    }
    await showRail(page);
    await page.locator('#savedButton').click();
    await page.locator('#savedDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#shell').evaluate(el=>el.inert),true,'background chat is inert while saved products is open');
    assert.deepEqual(await page.locator('#savedList .saved-item h3').allInnerTexts(),products.map(product=>product.title));
    assert.match(await page.locator('#savedStatus').innerText(),/Mehmon/);
    assert.equal(await page.locator('#savedList .watching-badge').count(),0);
    assert.equal(await page.getByRole('button',{name:'Narxni kuzatish uchun kirish',exact:true}).count(),2,'guest saves do not pretend automatic tracking is active');
    await page.locator('#savedList input[type=checkbox]').nth(0).check();
    await page.locator('#savedList input[type=checkbox]').nth(1).check();
    await page.locator('#compareSaved').click();
    assert.equal(await page.locator('#savedDialog').evaluate(el=>el.inert),true,'only the upper comparison dialog remains interactive');
    assert.equal(await page.locator('#compareDialog').evaluate(el=>el.inert),false);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#compareDialog')),true,'keyboard focus stays inside the upper dialog');
    assert.match(await page.locator('#compareTable').innerText(),/Saqlangan ryukzak/);
    assert.match(await page.locator('#compareTable').innerText(),/Saqlangan telefon/);
    await page.locator('#closeDialog').click();
    assert.equal(await page.locator('#savedDialog').evaluate(el=>el.inert),false);
    await page.locator('#savedList .saved-item').first().getByRole('button',{name:'Olib tashlash',exact:true}).click();
    assert.equal(await page.locator('#savedList .saved-item').count(),1);
    await page.locator('#closeSaved').click();
    assert.equal(await page.locator('#shell').evaluate(el=>el.inert),false);
    await hideRail(page);
    assert.equal(await page.locator('#messages .card').count(),2,'removing a save never removes the original recommendation');
    assert.equal(await page.locator('#messages .save-product').first().getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('#messages .save-product').nth(1).getAttribute('aria-pressed'),'true');
  } finally {await browser.close();}
});

test('an unavailable verified price cannot activate account price tracking', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.addInitScript(()=>localStorage.setItem('top_session_v1',JSON.stringify({
      access_token:'token',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,
      user:{id:'watch-user',email:'watch@example.com'}
    })));
    let watchAttempts=0;
    const product={id:'saved-1',title:'Narxi noma’lum ryukzak',store:'Uzum',url:'https://uzum.uz/uz/product/no-price',price:null,currency:null,trackingEnabled:false};
    await page.route('https://topsiagent.onrender.com/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      let status=200,data;
      if(path==='/api/chats') data={chats:[]};
      else if(path==='/api/saved-products'&&request.method()==='GET')data={products:[product],priceTracking:{automaticEnabled:true,manualCheck:true}};
      else if(path==='/api/price-notifications')data={notifications:[]};
      else if(path==='/api/saved-products/saved-1'&&request.method()==='PATCH'){
        watchAttempts++;assert.equal(request.postDataJSON().trackingEnabled,true);
        status=422;data={error:'No verified price available',code:'PRICE_UNAVAILABLE'};
      }else{status=404;data={error:'Unexpected API route'};}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(url);
    await showRail(page);await page.locator('#savedButton').click();
    await page.locator('#savedList .saved-item').waitFor();
    await page.getByRole('button',{name:'Narxni kuzatish',exact:true}).click();
    await page.locator('#savedStatus').getByText(/aniq narx olinmadi/).waitFor();
    assert.equal(watchAttempts,1);
    assert.equal(await page.locator('#savedList .watching-badge').count(),0);
    assert.equal(await page.getByRole('button',{name:'Kuzatuvni o‘chirish',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Narxni kuzatish',exact:true}).isEnabled(),true);
  } finally {await browser.close();}
});

test('signing out during session refresh cannot restore the old account or send authenticated reads',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  let releaseRefresh;
  const held=new Promise(resolve=>{releaseRefresh=resolve;});
  let refreshStarted;
  const started=new Promise(resolve=>{refreshStarted=resolve;});
  let refreshDone;
  const handled=new Promise(resolve=>{refreshDone=resolve;});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.addInitScript(()=>localStorage.setItem('top_session_v1',JSON.stringify({
      access_token:'expired-token-a',refresh_token:'refresh-a',expires_at:Math.floor(Date.now()/1000)-60,
      user:{id:'account-a',email:'account-a@example.com'}
    })));
    const authenticatedReads=[];
    let refreshCalls=0;
    await page.route('https://topsiagent.onrender.com/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/auth/refresh') {
        refreshCalls++;refreshStarted();await held;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          user:{id:'account-a',email:'account-a@example.com'},
          session:{access_token:'new-token-a',refresh_token:'refresh-a',expires_at:Math.floor(Date.now()/1000)+3600}
        })});
        refreshDone();return;
      }
      if(request.headers().authorization)authenticatedReads.push(path);
      const data=path==='/api/chats'?{chats:[]}:path==='/api/saved-products'?{products:[]}:path==='/api/price-notifications'?{notifications:[]}:{error:'Unexpected route'};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(url);await started;
    await showRail(page);await page.locator('#accountButton').click();
    await page.locator('#signOut').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('top_session_v1')),null);
    assert.equal(await page.locator('#accountLabel').innerText(),'Kirish');
    releaseRefresh();await handled;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(refreshCalls,1,'startup account requests share a single session refresh');
    assert.equal(await page.evaluate(()=>localStorage.getItem('top_session_v1')),null,'late refresh must not restore a signed-out session');
    assert.equal(await page.locator('#accountLabel').innerText(),'Kirish');
    assert.deepEqual(authenticatedReads,[],'no saved-products or chat read may use the old account after sign-out');
  } finally {releaseRefresh();await browser.close();}
});
