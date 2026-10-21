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

test('Top chat keeps context, follow-ups, results and guest history', async () => {
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
    await page.locator('#compareAction').click();
    assert.equal(await page.locator('#compareDialog').isVisible(), true);
    assert.match(await page.locator('#compareTable').innerText(), /Sony WH-CH720N/);
    await page.locator('#closeDialog').click();
    await page.locator('#input').fill('Arzonrog‘i bormi?');
    await page.locator('#send').click();
    await page.getByText('Qaysi rangni xohlaysiz?').waitFor();
    assert.equal(requests[1].history[0].content, '200 dollargacha quloqchin');
    assert.equal(requests[1].history.find(turn => turn.products)?.products[0].title, 'Sony WH-CH720N');
    assert.equal(await page.locator('.card').count(), 2);
    assert.match(await page.locator('#suggestions').innerText(), /Xarid variantlari/);
    await page.reload();
    assert.equal(await page.locator('.message.user').count(), 2);
    assert.equal(await page.locator('.card').count(), 2);
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
  } finally { await browser.close(); }
});

test('mobile opens with its sidebar closed and chat search finds titles and message content', async () => {
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(url);
    await page.evaluate(()=>localStorage.setItem('top_chats_guest_v1',JSON.stringify([
      {id:'11111111-1111-4111-8111-111111111111',title:'Kundalik xarid',messages:[{role:'user',content:'Ko‘k chamadon top'},{role:'assistant',content:'Qancha budjet ajratasiz?'}],updatedAt:new Date().toISOString()},
      {id:'22222222-2222-4222-8222-222222222222',title:'Telefon uchun g‘ilof',messages:[{role:'user',content:'Qizil rangdagi variant kerak'},{role:'assistant',content:'Telefon modelingiz qaysi?'}],updatedAt:new Date().toISOString()}
    ])));
    await page.reload();
    assert.equal(await page.locator('#rail').evaluate(el=>el.classList.contains('open')),false);
    assert.equal(await page.locator('#mobileMenu').isVisible(),true);
    assert.equal(await page.locator('#suggestions').isVisible(),true);
    assert.equal(await page.locator('#suggestions').evaluate(el=>el.scrollWidth>el.clientWidth),true);
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
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
    assert.equal(await page.locator('#send').isDisabled(),true);
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
    let request;
    await page.route('https://topsiagent.onrender.com/api/search', async route => {
      request = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type:'clarify', reply:'Tushundim.', products:[], followUps:[] }) });
    });
    await page.goto(url);
    const messages = [
      { role:'user', content:'Maktab uchun ryukzak qidir' },
      { role:'assistant', content:'Ikki variant topdim.', products:[{ title:'Sport ryukzak', store:'Uzum Market', url:'https://uzum.uz/uz/product/sport-ryukzak' }] }
    ];
    for (let index=0; index<5; index++) messages.push(
      { role:'user', content:`Savol ${index}` }, { role:'assistant', content:`Javob ${index}` }
    );
    await page.evaluate(value => localStorage.setItem('top_chats_guest_v1',JSON.stringify(value)), [
      { id:'11111111-1111-4111-8111-111111111111', remoteId:null, title:'Maktab uchun ryukzak', messages, updatedAt:new Date().toISOString() }
    ]);
    await page.reload();
    await showRail(page);
    await page.locator('#historyList .history-open').click();
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
