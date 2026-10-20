import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('frontend/index.html')).href;
const browserPath = process.env.TOPAGENT_BROWSER_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

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
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(10, 10, 10)');
    assert.equal(await page.locator('#chatHeading').innerText(), 'Bugun nima sotib olamiz?');
    assert.equal(await page.locator('.brand').innerText(), 'Top');
    assert.equal(await page.locator('#send').isDisabled(), true);
    assert.deepEqual(await page.locator('#suggestions .suggestion').allInnerTexts(), ['Ot uchun egar', 'Nike sneakers', 'Samsung TV']);
    await page.locator('#input').fill('   ');
    assert.equal(await page.locator('#send').isDisabled(), true);
    await page.locator('#input').fill('200 dollargacha quloqchin');
    assert.equal(await page.locator('#send').isEnabled(), true);
    assert.ok(await page.locator('#suggestions .suggestion').count() >= 2);
    await page.locator('#send').click();
    await page.locator('.card').first().waitFor();
    assert.equal(await page.locator('#send').isDisabled(), true);
    assert.equal(await page.locator('.card').count(), 2);
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
    assert.equal(await page.locator('.card').count(), 2);
    await page.reload();
    assert.equal(await page.locator('.message.user').count(), 2);
    assert.equal(await page.locator('.card').count(), 2);
    assert.equal(await page.locator('#historyList .history-item').count(), 1);
    await page.locator('#historySearch').fill('quloqchin');
    assert.equal(await page.locator('#historyList .history-item').count(), 1);
    await page.locator('#historySearch').fill('telefon');
    assert.equal(await page.locator('#historyList .history-item').count(), 0);
    assert.equal(await page.locator('.history-empty').innerText(), 'Mos chat topilmadi');
    await page.locator('#historySearch').fill('');
    assert.equal(await page.locator('#historyList .history-item').count(), 1);
    await page.locator('#newSearch').click();
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
    await page.locator('#historyList .history-open').click();
    assert.equal(await page.locator('.message.user').count(), 2);
    assert.equal(await page.locator('#language, #languageMobile').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
    await page.locator('#mobileNew').click();
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
    assert.equal(await page.locator('#chatHeading').innerText(), 'Bugun nima sotib olamiz?');
    assert.equal(await page.locator('.brand').innerText(), 'Top');
    assert.equal(await page.locator('#suggestions .suggestion').count(), 3);
    assert.equal(await page.locator('#mobileNew').isVisible(), true);
    assert.equal(await page.locator('#accountButton svg').isVisible(), true);
    await page.locator('#mobileMenu').click();
    await page.locator('#themeMobile').click();
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('#chatHeading').evaluate(el => getComputedStyle(el).color), 'rgb(29, 79, 131)');
    await page.locator('#railClose').click();
    await page.getByRole('button', { name: 'Ot uchun egar' }).click();
    assert.equal(requests.at(-1).query, 'Ot uchun egar');
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
    assert.equal(await page.locator('#mobileMenu').isVisible(), false);
    assert.equal(await page.locator('#mobileNew').isVisible(), false);
    assert.equal(await page.locator('#themeToggle').isVisible(), true);
    assert.ok((await page.locator('.composer').boundingBox()).y < 0.72 * 844);
    await page.locator('#input').fill('Menga noutbuk kerak'); await page.locator('#send').click();
    await page.getByText('Qancha budjet ajratasiz?').waitFor();
    await page.locator('#accountButton').click();
    await page.locator('#authEmail').fill('test@example.com'); await page.locator('#authPassword').fill('password123');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(()=>document.querySelector('#historyFoot').textContent.includes('hisobingizda'));
    assert.equal(stored.length,1);
    assert.equal(stored[0].messages.length,2);
    await page.reload();
    await page.getByText('Qancha budjet ajratasiz?').waitFor();
    assert.equal(await page.locator('#historyList .history-item').count(),1);
    await page.locator('#mobileNew').click();
    assert.equal(await page.locator('#workspace').evaluate(el => el.classList.contains('signed-in')), true);
    assert.ok((await page.locator('.composer').boundingBox()).y > 0.75 * 844);
    assert.equal(await page.locator('#chatHeading').isVisible(), true);
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
    await page.locator('.message-actions button').filter({hasText:'Qayta yaratish'}).click();
    await page.getByText('Javob 2').waitFor();
    assert.equal(await page.getByText('Javob 1').count(),0);
    await page.locator('#mobileMenu').click();
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Nomini o‘zgartirish'}).click();
    await page.locator('#renameInput').fill('Qizil egar');
    await page.locator('#renameForm button[type=submit]').click();
    await page.getByRole('button',{name:'Qizil egar',exact:true}).waitFor();
    await page.locator('#mobileMenu').click();
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
    await page.locator('#mobileMenu').click();
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Ulashish',exact:true}).click();
    await page.locator('#createShare').click();
    await page.locator('#revokeShare').click();
    assert.equal(shareActive,false);
    await page.goto(`${url}?share=${shareId}`);
    await page.getByText('Havola muddati tugagan, bekor qilingan yoki chat o‘chirilgan.').waitFor();
    await page.goto(url);
    await page.locator('#mobileMenu').click();
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Chatni o‘chirish'}).click();
    await page.getByRole('button',{name:'Qizil egar',exact:true}).waitFor();
    failDelete=false;
    await page.locator('#mobileMenu').click();
    await page.locator('.history-more').click();
    await page.getByRole('button',{name:'Chatni o‘chirish'}).click();
    await page.locator('.history-item').waitFor({state:'detached'});
    assert.equal(chats.length,0);
  } finally { await browser.close(); }
});
