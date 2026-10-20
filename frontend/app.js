const BACKEND = 'https://topsiagent.onrender.com';
const $ = id => document.getElementById(id);

// Remove a legacy copy that could contain payment details.
localStorage.removeItem('topagent_profile');

const copy = {
  uz: {
    heading:'Bugun nima sotib olamiz?', new:'Yangi chat', history:'Chat tarixi', guest:'Mehmon tarixi shu brauzerda saqlanadi.', synced:'Chatlar hisobingizda saqlanadi.', syncError:'Sinxronlashmadi. Chat shu brauzerda saqlangan.',
    signIn:'Kirish', signOut:'Chiqish', signUp:'Hisob ochish', haveAccount:'Hisobingiz bormi? Kirish', createAccount:'Hisob ochish', authIntro:'Hisobga kirsangiz, chatlaringiz keyingi safar ham saqlanadi.', confirmEmail:'Emailingizga kelgan tasdiqlash havolasini oching, so‘ng kiring.',
    placeholder:'Qidiring...', examples:['Ot uchun egar','Nike sneakers','Samsung TV'], searching:'Qidiryapman…', error:'Qidiruvda xatolik yuz berdi. Qayta urinib ko‘ring.',
    results:'Tavsiyalar', count:n=>`${n} ta variant`, note:'Narx va mavjudlikni do‘kon sahifasida tekshiring.', open:'Do‘konda xarid qilish ↗', buy:'Xarid variantlari', autoBuy:'Top orqali xarid', autoUnavailable:'Top orqali avtomatik xarid hozircha mavjud emas. Uzum Market bilan buyurtma integratsiyasi tayyor bo‘lgach ishlaydi.', autoOther:'Top bu do‘kon orqali avtomatik xaridni hali qo‘llamaydi. Do‘konda o‘zingiz xarid qilishingiz mumkin.', more:'Boshqa tavsiyalarni ko‘rsat', cheaper:'Arzonrog‘i bormi?',
    compare:'Solishtirish', selected:n=>`${n} ta tanlandi`, compareTitle:'Mahsulotlarni solishtirish', priceUnknown:'Narx ko‘rsatilmagan', store:'Do‘kon', price:'Narx', fit:'Nima uchun mos', product:'Mahsulot', link:'Havola',
    delete:'Chatni o‘chirish', deleteConfirm:'Bu chatni o‘chirasizmi?', authFail:'Kirish amalga oshmadi.', historyFail:'Tarixni yuklab bo‘lmadi.', mode:'Faqat xarid uchun', darkTheme:'Qora rejim', whiteTheme:'Oq rejim',
    rename:'Nomini o‘zgartirish', share:'Ulashish', copyAnswer:'Nusxalash', regenerate:'Qayta yaratish', imageError:'Faqat JPEG, PNG yoki WebP rasm (5 MB gacha) tanlang.', imageOnly:'Shu rasmdagi mahsulotni yoki unga o‘xshash variantlarni top.', signInForImage:'Rasm bilan qidirish uchun hisobga kiring.'
  },
  en: {
    heading:'What are we buying today?', new:'New chat', history:'Chat history', guest:'Guest history is saved in this browser.', synced:'Chats are saved to your account.', syncError:'Could not sync. This chat is saved in this browser.',
    signIn:'Sign in', signOut:'Sign out', signUp:'Create account', haveAccount:'Already have an account? Sign in', createAccount:'Create account', authIntro:'Sign in to keep your chats for your next visit.', confirmEmail:'Open the confirmation link in your email, then sign in.',
    placeholder:'What would you like to buy?', examples:['Headphones under $200','Laptop for coding','Redmi Note 14 in the US'], searching:'Searching…', error:'Search failed. Please try again.',
    results:'Recommendations', count:n=>`${n} options`, note:'Check price and availability at the store.', open:'Buy at store ↗', buy:'Purchase options', autoBuy:'Buy through Top', autoUnavailable:'Automatic purchase through Top is not available yet. It needs a retailer order integration.', autoOther:'Top cannot automatically purchase from this store yet. You can buy on the store page.', more:'Show other options', cheaper:'Anything cheaper?',
    compare:'Compare', selected:n=>`${n} selected`, compareTitle:'Compare products', priceUnknown:'Price unavailable', store:'Store', price:'Price', fit:'Why it fits', product:'Product', link:'Link',
    delete:'Delete chat', deleteConfirm:'Delete this chat?', authFail:'Sign in failed.', historyFail:'Could not load history.', mode:'Shopping only', dark:'Dark mode', light:'Light mode'
  },
  ru: {
    heading:'Что купим сегодня?', new:'Новый чат', history:'История чатов', guest:'История гостя хранится в этом браузере.', synced:'Чаты сохранены в аккаунте.', syncError:'Не удалось синхронизировать. Чат сохранён в браузере.',
    signIn:'Войти', signOut:'Выйти', signUp:'Создать аккаунт', haveAccount:'Уже есть аккаунт? Войти', createAccount:'Создать аккаунт', authIntro:'Войдите, чтобы сохранить чаты для следующего визита.', confirmEmail:'Откройте ссылку подтверждения в письме, затем войдите.',
    placeholder:'Что хотите купить?', examples:['Наушники до $200','Ноутбук для программирования','Redmi Note 14 в России'], searching:'Ищу…', error:'Ошибка поиска. Попробуйте ещё раз.',
    results:'Рекомендации', count:n=>`${n} варианта`, note:'Проверьте цену и наличие в магазине.', open:'Купить в магазине ↗', buy:'Варианты покупки', autoBuy:'Купить через Top', autoUnavailable:'Автоматическая покупка через Top пока недоступна. Нужна интеграция с магазином.', autoOther:'Top пока не может автоматически купить товар в этом магазине. Вы можете купить его на сайте магазина.', more:'Показать другие варианты', cheaper:'Есть дешевле?',
    compare:'Сравнить', selected:n=>`${n} выбрано`, compareTitle:'Сравнение товаров', priceUnknown:'Цена неизвестна', store:'Магазин', price:'Цена', fit:'Почему подходит', product:'Товар', link:'Ссылка',
    delete:'Удалить чат', deleteConfirm:'Удалить этот чат?', authFail:'Не удалось войти.', historyFail:'Не удалось загрузить историю.', mode:'Только покупки', dark:'Тёмная тема', light:'Светлая тема'
  }
};

let lang = 'uz';
let darkTheme = localStorage.getItem('topagent_theme') !== 'light';
let session = readJson('top_session_v1', null);
let user = session?.user || null;
let chats = readChats();
let activeId = localStorage.getItem(activeKey()) || null;
let products = [];
let selected = new Set();
let loading = false;
let requestController = null;
let authMode = 'login';
let syncFailed = false;
const syncQueues = new Map();
const shareToken = new URLSearchParams(location.search).get('share');
const imageUrls = new Map();
let pendingImage = null;
let previewUrl = null;
let actionChat = null;

function t(key) { return copy[lang][key]; }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function storageKey() { return user ? `top_chats_user_${user.id}` : 'top_chats_guest_v1'; }
function activeKey() { return user ? `top_active_user_${user.id}` : 'top_active_guest_v1'; }
function readChats() { const value = readJson(storageKey(), []); return Array.isArray(value) ? value.filter(chat => chat && typeof chat.id === 'string' && Array.isArray(chat.messages)) : []; }
function persist() {
  chats.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  try { localStorage.setItem(storageKey(), JSON.stringify(chats)); } catch { syncFailed = true; updateAccountUI(); }
  if (activeId) localStorage.setItem(activeKey(), activeId); else localStorage.removeItem(activeKey());
  renderHistory();
}
function activeChat() { return chats.find(chat => chat.id === activeId) || null; }
function touch(chat) { chat.updatedAt = new Date().toISOString(); persist(); }
function titleFrom(text) { return text.trim().replace(/\s+/g,' ').slice(0, 55); }
function scrollBottom() { $('contentScroll').scrollTop = $('contentScroll').scrollHeight; }
function updateSendState() { $('send').disabled = loading || (!$('input').value.trim() && !pendingImage); }
function closeRail() { $('rail').classList.remove('open'); $('backdrop').classList.remove('open'); }
function openRail() { $('rail').classList.add('open'); $('backdrop').classList.add('open'); }

function setLanguage() {
  lang = 'uz';
  document.documentElement.lang = lang;
  $('chatHeading').textContent = t('heading');
  $('newSearch').textContent = t('new');
  $('railNewText').textContent = t('new');
  $('historyLabel').textContent = t('history');
  $('historySearch').placeholder = 'Chatlarni qidirish';
  $('historySearch').setAttribute('aria-label', 'Chatlarni qidirish');
  $('mobileMenu').setAttribute('aria-label', t('history'));
  $('mobileNew').setAttribute('aria-label', t('new'));
  $('mobileNew').title = t('new');
  $('input').placeholder = t('placeholder');
  $('composerMode').textContent = t('mode');
  $('resultsHeading').textContent = t('results');
  $('compareAction').textContent = t('compare');
  $('compareTitle').textContent = t('compareTitle');
  $('authDescription').textContent = t('authIntro');
  $('signOut').textContent = t('signOut');
  $('authTitle').textContent = authMode === 'login' ? t('signIn') : t('signUp');
  $('authSubmit').textContent = $('authTitle').textContent;
  $('authSwitch').textContent = authMode === 'login' ? t('createAccount') : t('haveAccount');
  updateTheme(); updateAccountUI(); renderHistory(); renderConversation();
}
function updateTheme() {
  document.documentElement.classList.toggle('dark',darkTheme);
  document.querySelector('meta[name="theme-color"]').content = darkTheme ? '#0a0a0a' : '#ffffff';
  const label = darkTheme ? t('whiteTheme') : t('darkTheme');
  for (const id of ['themeToggle','themeMobile']) {
    const button=$(id); button.setAttribute('aria-label',label); button.title=label;
  }
}
function updateAccountUI() {
  const accountName = user ? (user.email?.split('@')[0] || t('signOut')) : t('signIn');
  $('workspace').classList.toggle('signed-in', !!user);
  $('accountLabel').textContent = accountName;
  $('accountButton').setAttribute('aria-label', accountName);
  $('historyFoot').textContent = syncFailed ? t('syncError') : user ? t('synced') : t('guest');
  $('signOut').hidden = !user;
  $('authForm').hidden = !!user;
  $('authSwitch').hidden = !!user;
}
function renderHistory() {
  document.querySelectorAll('body > .history-menu').forEach(node=>node.remove());
  $('historyList').replaceChildren();
  const query=$('historySearch').value.trim().toLocaleLowerCase('uz');
  const visible=chats.filter(chat => chat.messages.length && (!query || chat.title.toLocaleLowerCase('uz').includes(query)))
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if(query && !visible.length) {
    const empty=document.createElement('p'); empty.className='history-empty'; empty.textContent='Mos chat topilmadi'; $('historyList').append(empty);
  }
  visible.forEach(chat => {
    const item=document.createElement('div'); item.className='history-item' + (chat.id===activeId ? ' active' : '');
    const open=document.createElement('button'); open.type='button'; open.className='history-open'; open.textContent=chat.title; open.title=chat.title;
    open.addEventListener('click',()=>selectChat(chat.id));
    const wrap=document.createElement('div'); wrap.className='history-menu-wrap';
    const more=document.createElement('button'); more.type='button'; more.className='history-more'; more.textContent='⋯'; more.title='Chat amallari'; more.setAttribute('aria-label',`${chat.title}: amallar`); more.setAttribute('aria-expanded','false');
    const menu=document.createElement('div'); menu.className='history-menu'; menu.hidden=true;
    for (const [label,action] of [[t('rename'),()=>openRename(chat)],[t('share'),()=>openShare(chat)],[t('delete'),()=>deleteChat(chat)]]) {
      const button=document.createElement('button'); button.type='button'; button.textContent=label;
      button.addEventListener('click',()=>{menu.hidden=true;more.setAttribute('aria-expanded','false');action();closeRail();}); menu.append(button);
    }
    more.addEventListener('click',event=>{
      event.stopPropagation();
      document.querySelectorAll('.history-menu').forEach(node=>{if(node!==menu)node.hidden=true;});
      const opening=menu.hidden; menu.hidden=!opening; more.setAttribute('aria-expanded',String(opening));
      if(opening){
        document.body.append(menu);
        const rect=more.getBoundingClientRect();
        menu.style.left=`${Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,rect.right-menu.offsetWidth))}px`;
        menu.style.top=`${rect.bottom+menu.offsetHeight+8>innerHeight?Math.max(8,rect.top-menu.offsetHeight-4):rect.bottom+4}px`;
      }
    });
    wrap.append(more); item.append(open,wrap); $('historyList').append(item);
  });
}
function selectChat(id) {
  if (loading) { requestController?.abort(); loading=false; }
  clearPendingImage();
  activeId=id; persist(); $('input').value=''; $('input').style.height='auto'; updateSendState(); renderConversation(); closeRail();
}
function newChat() {
  if (loading) { requestController?.abort(); loading=false; }
  clearPendingImage();
  $('historySearch').value='';
  activeId=null; products=[]; selected.clear(); persist(); $('input').value=''; $('input').style.height='auto'; updateSendState(); renderConversation(); closeRail(); $('input').focus();
}
async function deleteChat(chat) {
  if (!confirm(t('deleteConfirm'))) return;
  try {
    if (activeId===chat.id && loading) { requestController?.abort(); loading=false; updateSendState(); }
    if (user) {
      await syncQueues.get(chat.id);
      if (!chat.remoteId) throw new Error('Chat hali hisobga saqlanmadi. Qayta urinib ko‘ring.');
      await api(`/api/chats/${chat.remoteId}`,{method:'DELETE'},true);
    }
    chats=chats.filter(item => item.id!==chat.id);
    if (activeId===chat.id) { activeId=null; clearPendingImage(); }
    for(const key of imageUrls.keys()) if(key.startsWith(`${chat.remoteId}:`)){URL.revokeObjectURL(imageUrls.get(key));imageUrls.delete(key);}
    persist(); renderConversation();
  } catch(error) { alert(error.message || 'Chatni o‘chirib bo‘lmadi.'); }
}
function openRename(chat) {
  actionChat=chat; $('renameInput').value=chat.title; $('renameStatus').textContent='';
  $('renameDialog').classList.add('open'); $('renameInput').focus(); $('renameInput').select();
}
function closeRename() { $('renameDialog').classList.remove('open'); }
async function saveRename(event) {
  event.preventDefault();
  const chat=actionChat; const title=$('renameInput').value.trim();
  if (!chat || !title || title.length>120) return;
  try {
    if (user) {
      await syncQueues.get(chat.id);
      if (!chat.remoteId) await syncChat(chat);
      if (!chat.remoteId) throw new Error('Chat hali hisobga saqlanmadi.');
      await api(`/api/chats/${chat.remoteId}`,{method:'PATCH',body:JSON.stringify({title})},true);
    }
    chat.title=title; touch(chat); closeRename();
  } catch(error) { $('renameStatus').textContent=error.message; }
}
function openShare(chat) {
  actionChat=chat; $('shareUrl').hidden=true; $('shareUrl').value=''; $('copyShare').hidden=true;
  $('revokeShare').hidden=true; $('shareStatus').textContent=user?'':'Havola uchun hisobga kiring. Matnni ulashishingiz mumkin.';
  $('createShare').disabled=!user; $('shareDialog').classList.add('open');
}
function closeShare() { $('shareDialog').classList.remove('open'); }
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const field=document.createElement('textarea'); field.value=value; field.style.position='fixed'; field.style.opacity='0';
    document.body.append(field); field.select(); const copied=document.execCommand('copy'); field.remove();
    if (!copied) throw new Error('Nusxalab bo‘lmadi.');
  }
}
function transcript(chat) {
  return `${chat.title}\n\n`+chat.messages.map(message=>{
    const who=message.role==='user'?'Siz':'Top';
    const links=safeProducts(message.products).map(p=>`${p.title}: ${p.url}`).join('\n');
    return `${who}: ${message.imageId?'[Rasm] ':''}${message.content}${links?'\n'+links:''}`;
  }).join('\n\n');
}
async function shareText() {
  if (!actionChat) return;
  const value=transcript(actionChat);
  try {
    if (navigator.share) await navigator.share({title:actionChat.title,text:value});
    else { await copyText(value); $('shareStatus').textContent='Chat matni nusxalandi.'; }
  } catch(error) { if(error.name!=='AbortError') $('shareStatus').textContent=error.message; }
}
async function createShare() {
  const chat=actionChat; if (!chat || !user) return;
  $('createShare').disabled=true; $('shareStatus').textContent='Havola yaratilmoqda…';
  try {
    await syncQueues.get(chat.id);
    if (!chat.remoteId) await syncChat(chat);
    if (!chat.remoteId) throw new Error('Chat hali hisobga saqlanmadi.');
    const data=await api(`/api/chats/${chat.remoteId}/share`,{method:'POST'},true);
    $('shareUrl').value=data.url; $('shareUrl').hidden=false; $('copyShare').hidden=false;
    $('revokeShare').hidden=false; $('shareStatus').textContent='Havola 24 soat ishlaydi.';
  } catch(error) { $('shareStatus').textContent=error.message; }
  finally { $('createShare').disabled=false; }
}
async function revokeShare() {
  const chat=actionChat; if(!chat?.remoteId) return;
  try {
    await api(`/api/chats/${chat.remoteId}/share`,{method:'DELETE'},true);
    $('shareUrl').value=''; $('shareUrl').hidden=true; $('copyShare').hidden=true; $('revokeShare').hidden=true;
    $('shareStatus').textContent='Havola bekor qilindi.';
  } catch(error) { $('shareStatus').textContent=error.message; }
}
function clearPendingImage() {
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl=null; pendingImage=null; $('imageFile').value=''; $('imagePreview').hidden=true; updateSendState();
}
function chooseImage(file) {
  if (!file) return;
  if (!user) { openAuth(); return; }
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024 || !file.size) {
    alert(t('imageError')); $('imageFile').value=''; return;
  }
  clearPendingImage(); pendingImage=file; previewUrl=URL.createObjectURL(file);
  $('previewImage').src=previewUrl; $('previewName').textContent=file.name;
  $('imagePreview').hidden=false; updateSendState(); renderSuggestions();
}
async function fetchOwnImage(chat,imageId,img) {
  if(!chat.remoteId) return;
  const key=`${chat.remoteId}:${imageId}`;
  if(imageUrls.has(key)){img.src=imageUrls.get(key);return;}
  try {
    await ensureSession();
    const load=()=>fetch(`${BACKEND}/api/chats/${chat.remoteId}/images/${imageId}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
    let response=await load();
    if(response.status===401){await refreshSession();response=await load();}
    if(!response.ok) throw new Error('Rasmni yuklab bo‘lmadi.');
    const url=URL.createObjectURL(await response.blob()); imageUrls.set(key,url);
    if(img.isConnected) img.src=url;
  } catch(error) { img.alt=error.message; }
}
function addMessage(role,content) {
  const node=document.createElement('div'); node.className=`message ${role}`; node.textContent=content; $('messages').append(node); scrollBottom(); return node;
}
function priceText(product) {
  if (product.price == null) return t('priceUnknown');
  try { return new Intl.NumberFormat(lang==='uz'?'uz-UZ':lang==='ru'?'ru-RU':'en-US',{style:'currency',currency:product.currency||'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(product.price); }
  catch { return `${product.price} ${product.currency||'USD'}`; }
}
function span(cls,text) { const node=document.createElement('span'); node.className=cls; node.textContent=text; return node; }
function safeProducts(value) { return Array.isArray(value) ? value.filter(p=>{
  if (!p || typeof p.title!=='string' || typeof p.store!=='string' || typeof p.url!=='string') return false;
  try { return new URL(p.url).protocol==='https:'; } catch { return false; }
}).slice(0,4) : []; }
function openPurchaseOptions(product) {
  $('purchaseProduct').textContent=`${product.title} · ${priceText(product)} · ${product.store}`;
  $('purchaseStore').href=product.url;
  $('purchaseStore').textContent=t('open');
  $('purchaseAuto').textContent=t('autoBuy');
  $('purchaseAuto').disabled=true;
  const host=new URL(product.url).hostname;
  $('purchaseStatus').textContent=host==='uzum.uz'||host.endsWith('.uzum.uz')?t('autoUnavailable'):t('autoOther');
  $('purchaseDialog').classList.add('open');
  $('purchaseStore').focus();
}
function closePurchaseOptions() { $('purchaseDialog').classList.remove('open'); }
function searchHistory(messages) {
  const recent=messages.slice(-8);
  const lastResult=[...messages].reverse().find(message=>message.role==='assistant' && safeProducts(message.products).length);
  const turns=lastResult && !recent.includes(lastResult) ? [lastResult,...recent] : recent;
  return turns.map(({role,content,imageId,products})=>({role,content,
    ...(imageId?{imageId}:{}),
    ...(role==='assistant' && safeProducts(products).length?{products:safeProducts(products)}:{})}));
}
function renderProducts() {
  $('grid').replaceChildren(); $('count').textContent=products.length?t('count')(products.length):'';
  $('resultsSection').hidden=!products.length; $('resultNote').hidden=!products.length; $('resultNote').textContent=t('note');
  products.forEach((p,i)=>{
    const card=document.createElement('article'); card.className='card';
    const top=document.createElement('div'); top.className='card-top'; top.append(span('store',p.store),span('rank',String(i+1).padStart(2,'0')));
    const title=document.createElement('h3'); title.textContent=p.title;
    const price=document.createElement('div'); price.append(span(p.price==null?'price-unknown':'price',priceText(p)));
    const reason=document.createElement('p'); reason.className='reason'; reason.textContent=p.why||'';
    const bottom=document.createElement('div'); bottom.className='card-bottom';
    const choices=document.createElement('div'); choices.className='purchase-choices';
    const buy=document.createElement('button'); buy.type='button'; buy.className='store-link'; buy.textContent=t('buy'); buy.addEventListener('click',()=>openPurchaseOptions(p));
    const link=document.createElement('a'); link.className='store-link secondary'; link.textContent=t('open'); link.href=p.url; link.target='_blank'; link.rel='noopener noreferrer';
    choices.append(buy,link);
    const label=document.createElement('label'); label.className='compare-pick'; const box=document.createElement('input'); box.type='checkbox'; box.checked=selected.has(i); box.setAttribute('aria-label',`${t('compare')}: ${p.title}`);
    box.addEventListener('change',()=>{ if(box.checked && selected.size>=3){box.checked=false;return;} box.checked?selected.add(i):selected.delete(i); updateCompare(); }); label.append(box,document.createTextNode(t('compare')));
    bottom.append(choices,label); card.append(top,title,price,reason,bottom); $('grid').append(card);
  });
  updateCompare();
}
function updateCompare() { $('compareBar').classList.toggle('visible',selected.size>0); $('compareCount').textContent=t('selected')(selected.size); $('compareAction').disabled=selected.size<2; }
function showCompare() {
  if (selected.size<2) return;
  const table=document.createElement('table'); table.className='compare-table';
  const rows=[['product',p=>p.title],['store',p=>p.store],['price',p=>priceText(p)],['fit',p=>p.why||'—'],['link',p=>p.url]];
  for(const [key,get] of rows){ const tr=document.createElement('tr'); const th=document.createElement('th'); th.scope='row'; th.textContent=t(key); tr.append(th);
    for(const index of selected){ const td=document.createElement('td'); const p=products[index]; if(key==='link'){const a=document.createElement('a'); a.href=p.url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=t('open'); td.append(a);} else td.textContent=get(p); tr.append(td); } table.append(tr);
  }
  $('compareTable').replaceChildren(table); $('compareDialog').classList.add('open'); $('closeDialog').focus();
}
function suggestion(label,action,primary=false) {
  const button=document.createElement('button'); button.type='button'; button.className='suggestion'+(primary?' primary':''); button.textContent=label; button.addEventListener('click',action); $('suggestions').append(button);
}
function renderSuggestions() {
  $('suggestions').replaceChildren();
  if (loading || pendingImage) return;
  const draft=$('input').value.trim();
  if (draft.length>3 && !loading) {
    const parts=lang==='uz'?[`${draft} — eng yaxshi variantlar`,`${draft} — arzonroq variantlar`]:lang==='ru'?[`${draft} — лучшие варианты`,`${draft} — дешевле`]:[`${draft} — best options`,`${draft} — cheaper options`];
    parts.forEach(text=>suggestion(text,()=>send(text)));
    return;
  }
  const chat=activeChat(); const answers=[...(chat?.messages||[])].reverse().filter(m=>m.role==='assistant');
  const last=answers[0];
  if (!last) {
    if (!loading && !draft) t('examples').forEach(text=>suggestion(text,()=>send(text)));
    return;
  }
  const resultProducts=safeProducts(answers.find(answer=>safeProducts(answer.products).length)?.products);
  if (resultProducts.length) {
    suggestion(t('buy'),()=>openPurchaseOptions(resultProducts[0]),true);
    suggestion(t('more'),()=>send(t('more')));
    suggestion(t('cheaper'),()=>send(t('cheaper')));
  }
  (Array.isArray(last.followUps)?last.followUps:[]).slice(0,3).forEach(text=>suggestion(text,()=>send(text)));
}
function renderConversation() {
  const chat=activeChat();
  document.body.classList.toggle('fresh-guest', !user && !chats.some(item=>item.messages.length));
  $('messages').replaceChildren();
  $('workspace').classList.toggle('has-chat',!!chat?.messages.length);
  (chat?.messages||[]).forEach((message,index)=>{
    const node=addMessage(message.role,message.content);
    if(message.imageId && message.role==='user') {
      const img=document.createElement('img'); img.className='message-image'; img.alt='Yuborilgan rasm';
      node.prepend(img); fetchOwnImage(chat,message.imageId,img);
    }
    if(message.role==='assistant') {
      const actions=document.createElement('div'); actions.className='message-actions';
      const copyButton=document.createElement('button'); copyButton.type='button'; copyButton.textContent=t('copyAnswer');
      copyButton.addEventListener('click',async()=>{try{await copyText(message.content);copyButton.textContent='Nusxalandi';}catch(error){alert(error.message);}});
      actions.append(copyButton);
      if(index===chat.messages.length-1 && chat.messages[index-1]?.role==='user') {
        const retry=document.createElement('button'); retry.type='button'; retry.textContent=t('regenerate'); retry.disabled=loading;
        retry.addEventListener('click',()=>regenerate(chat,index)); actions.append(retry);
      }
      node.append(actions);
    }
  });
  const latest=[...(chat?.messages||[])].reverse().find(m=>m.role==='assistant' && safeProducts(m.products).length);
  products=safeProducts(latest?.products); selected.clear(); renderProducts(); renderSuggestions(); scrollBottom();
}

async function api(path, options={}, authenticated=false) {
  if (authenticated) await ensureSession();
  const headers={...options.headers};
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  if (authenticated) headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(`${BACKEND}${path}`,{...options,headers});
  if (authenticated && response.status===401) {
    await refreshSession(); headers.Authorization=`Bearer ${session.access_token}`;
    response=await fetch(`${BACKEND}${path}`,{...options,headers});
  }
  const data=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function refreshSession() {
  if (!session?.refresh_token) throw new Error('Session expired');
  const data=await api('/api/auth/refresh',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
  session=data.session; user=data.user; localStorage.setItem('top_session_v1',JSON.stringify({...session,user}));
}
async function ensureSession() { if (!session) throw new Error('Sign in required'); if ((session.expires_at||0)*1000<Date.now()+60000) await refreshSession(); }
function syncChat(chat) {
  if (!user) return Promise.resolve();
  const previous=syncQueues.get(chat.id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    const body=JSON.stringify({title:chat.title,messages:chat.messages});
    const data=chat.remoteId
      ? await api(`/api/chats/${chat.remoteId}`,{method:'PATCH',body},true)
      : await api('/api/chats',{method:'POST',body},true);
    if (!chat.remoteId) chat.remoteId=data.chat.id;
    syncFailed=false; persist(); updateAccountUI();
  }).catch(error=>{ syncFailed=true; updateAccountUI(); console.error('[chat sync]',error); });
  syncQueues.set(chat.id,next); return next;
}
async function loadRemoteChats() {
  if (!user) return;
  try {
    const list=await api('/api/chats',{},true);
    for (const item of list.chats||[]) {
      const data=await api(`/api/chats/${item.id}`,{},true);
      const cached=chats.find(chat=>chat.remoteId===item.id);
      if (cached) {
        if (new Date(data.chat.updated_at) > new Date(cached.updatedAt)) {
          cached.title=data.chat.title; cached.messages=data.chat.messages||[]; cached.updatedAt=data.chat.updated_at;
        } else if (new Date(cached.updatedAt) > new Date(data.chat.updated_at)) syncChat(cached);
      } else chats.push({id:crypto.randomUUID(),remoteId:item.id,title:data.chat.title,messages:data.chat.messages||[],updatedAt:data.chat.updated_at});
    }
    syncFailed=false; persist(); renderConversation(); updateAccountUI();
  } catch(error) { syncFailed=true; updateAccountUI(); console.error('[history]',error); }
}
async function enterAccount(data) {
  const guestChats=readJson('top_chats_guest_v1',[]).filter(chat=>chat && Array.isArray(chat.messages) && chat.messages.length);
  session=data.session; user=data.user;
  localStorage.setItem('top_session_v1',JSON.stringify({...session,user}));
  chats=readChats(); activeId=localStorage.getItem(activeKey())||null;
  await loadRemoteChats();
  const existing=new Set(chats.map(chat=>chat.id));
  const imported=guestChats.filter(chat=>!existing.has(chat.id)).map(chat=>({...chat,remoteId:null}));
  chats.push(...imported);
  if (imported.length) { persist(); await Promise.all(imported.map(syncChat)); if (!syncFailed) localStorage.removeItem('top_chats_guest_v1'); }
  if (!activeId && imported.length) activeId=imported[0].id;
  persist(); updateAccountUI(); renderConversation();
}
function leaveAccount() {
  session=null; user=null; localStorage.removeItem('top_session_v1');
  clearPendingImage(); for(const url of imageUrls.values()) URL.revokeObjectURL(url); imageUrls.clear();
  chats=readChats(); activeId=localStorage.getItem(activeKey())||null; syncFailed=false;
  closeAuth(); updateAccountUI(); persist(); renderConversation();
}
function openAuth() {
  authMode='login'; $('authError').hidden=true; $('authStatus').hidden=true; $('authEmail').value=''; $('authPassword').value='';
  setLanguage(lang); $('authDialog').classList.add('open'); if (!user) $('authEmail').focus();
}
function closeAuth() { $('authDialog').classList.remove('open'); }
async function submitAuth(event) {
  event.preventDefault(); $('authError').hidden=true; $('authStatus').hidden=true; $('authSubmit').disabled=true;
  try {
    const path=authMode==='login'?'/api/auth/login':'/api/auth/signup';
    const data=await api(path,{method:'POST',body:JSON.stringify({email:$('authEmail').value.trim(),password:$('authPassword').value})});
    if (!data.session) { $('authStatus').textContent=t('confirmEmail'); $('authStatus').hidden=false; return; }
    await enterAccount(data); closeAuth();
  } catch(error) { $('authError').textContent=error.message||t('authFail'); $('authError').hidden=false; }
  finally { $('authSubmit').disabled=false; }
}

async function send(preset) {
  const query=(preset||$('input').value).trim(); if ((!query && !pendingImage) || loading) return;
  const queryText=query || t('imageOnly');
  const file=pendingImage;
  let chat=activeChat();
  if (!chat) { chat={id:crypto.randomUUID(),remoteId:null,title:titleFrom(queryText),messages:[],updatedAt:new Date().toISOString()}; chats.unshift(chat); activeId=chat.id; }
  const context=searchHistory(chat.messages);
  loading=true; updateSendState(); renderSuggestions();
  requestController=new AbortController(); const sentTo=chat.id;
  let indicator=null;
  try {
    let imageId=null;
    if (file) {
      if (!user) throw new Error(t('signInForImage'));
      await syncQueues.get(chat.id);
      if (!chat.remoteId) await syncChat(chat);
      if (!chat.remoteId) throw new Error('Chatni hisobga saqlab bo‘lmadi.');
      const body=new FormData(); body.append('image',file);
      const upload=await api(`/api/chats/${chat.remoteId}/images`,{method:'POST',body,signal:requestController.signal},true);
      imageId=upload.image.id; clearPendingImage();
    }
    chat.messages.push({role:'user',content:queryText,...(imageId?{imageId}:{})}); touch(chat);
    if (user) syncChat(chat);
    $('input').value=''; $('input').style.height='auto'; updateSendState();
    if (activeId===sentTo) { renderConversation(); indicator=addMessage('assistant loading',t('searching')); }
    const authSearch=!!(imageId || context.some(turn=>turn.imageId));
    const data=await api('/api/search',{method:'POST',body:JSON.stringify({query:queryText,history:context,...(authSearch?{chatId:chat.remoteId,imageId}:{})}),signal:requestController.signal},authSearch);
    if (Array.isArray(data.products) && typeof data.reply!=='string') data.reply=t('count')(data.products.length);
    if (typeof data.reply!=='string' || !Array.isArray(data.products)) throw new Error('Invalid response');
    chat.messages.push({role:'assistant',content:data.reply,products:safeProducts(data.products),followUps:Array.isArray(data.followUps)?data.followUps:[]});
    touch(chat); if (user) syncChat(chat);
    if (activeId===sentTo) renderConversation();
  } catch(error) {
    if (error.name!=='AbortError') {
      if (chat.messages.at(-1)?.role==='user' && chat.messages.at(-1).content===queryText) {
        chat.messages.push({role:'assistant',content:t('error')}); touch(chat); if (user) syncChat(chat);
      } else { alert(error.message || t('error')); }
      if (activeId===sentTo) renderConversation(); console.error('[search]',error);
    }
  } finally {
    indicator?.remove(); loading=false; updateSendState(); requestController=null;
    if (activeId===sentTo) { renderConversation(); $('input').focus(); }
  }
}

async function regenerate(chat,index) {
  if (loading || chat.messages[index]?.role!=='assistant' || chat.messages[index-1]?.role!=='user') return;
  const question=chat.messages[index-1];
  const context=searchHistory(chat.messages.slice(0,index-1));
  const authSearch=!!(question.imageId || context.some(turn=>turn.imageId));
  loading=true; updateSendState(); renderSuggestions();
  const indicator=addMessage('assistant loading',t('searching'));
  requestController=new AbortController();
  try {
    const data=await api('/api/search',{method:'POST',body:JSON.stringify({query:question.content,history:context,...(authSearch?{chatId:chat.remoteId,imageId:question.imageId}:{})}),signal:requestController.signal},authSearch);
    if(typeof data.reply!=='string' || !Array.isArray(data.products)) throw new Error('Invalid response');
    chat.messages[index]={role:'assistant',content:data.reply,products:safeProducts(data.products),followUps:Array.isArray(data.followUps)?data.followUps:[]};
    touch(chat); if(user) syncChat(chat);
    if(activeId===chat.id) renderConversation();
  } catch(error) { if(error.name!=='AbortError') alert(error.message || t('error')); }
  finally { indicator.remove(); loading=false; requestController=null; updateSendState(); if(activeId===chat.id)renderConversation(); }
}

let sharedRevision=null;
async function renderSharedChat() {
  document.body.classList.add('shared-mode'); $('sharedView').hidden=false;
  if (!sharedRevision) { $('sharedTitle').textContent='Ulashilgan chat'; $('sharedStatus').textContent='Chat yuklanmoqda…'; }
  try {
    const data=await api(`/api/shared/${encodeURIComponent(shareToken)}`);
    if (sharedRevision===data.chat.updated_at) return;
    sharedRevision=data.chat.updated_at;
    $('sharedTitle').textContent=data.chat.title;
    $('sharedMessages').replaceChildren();
    for(const message of data.chat.messages||[]) {
      if(!['user','assistant'].includes(message.role) || typeof message.content!=='string') continue;
      const node=document.createElement('div'); node.className=`message ${message.role}`; node.textContent=message.content;
      if(message.role==='user' && message.imageId) {
        const img=document.createElement('img'); img.className='message-image'; img.alt='Ulashilgan rasm';
        img.src=`${BACKEND}/api/shared/${encodeURIComponent(shareToken)}/images/${encodeURIComponent(message.imageId)}`;
        node.prepend(img);
      }
      if(message.role==='assistant' && safeProducts(message.products).length) {
        const links=document.createElement('div'); links.className='shared-products';
        for(const product of safeProducts(message.products)) {
          const link=document.createElement('a'); link.href=product.url; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=product.title;
          links.append(link);
        }
        node.append(links);
      }
      $('sharedMessages').append(node);
    }
    $('sharedStatus').textContent=`Havola ${new Date(data.expiresAt).toLocaleString('uz-UZ')} gacha ishlaydi.`;
  } catch {
    sharedRevision=null; $('sharedMessages').replaceChildren();
    $('sharedTitle').textContent='Chat mavjud emas';
    $('sharedStatus').textContent='Havola muddati tugagan, bekor qilingan yoki chat o‘chirilgan.';
  }
}

$('send').addEventListener('click',()=>send());
$('input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}});
$('input').addEventListener('input',()=>{ $('input').style.height='auto'; $('input').style.height=Math.min($('input').scrollHeight,130)+'px'; updateSendState(); renderSuggestions(); });
$('historySearch').addEventListener('input',renderHistory);
$('newSearch').addEventListener('click',newChat); $('railNew').addEventListener('click',newChat); $('mobileNew').addEventListener('click',newChat);
$('mobileMenu').addEventListener('click',openRail); $('railClose').addEventListener('click',closeRail); $('backdrop').addEventListener('click',closeRail);
$('themeToggle').addEventListener('click',()=>{darkTheme=!darkTheme;localStorage.setItem('topagent_theme',darkTheme?'dark':'light');updateTheme();});
$('themeMobile').addEventListener('click',()=>{darkTheme=!darkTheme;localStorage.setItem('topagent_theme',darkTheme?'dark':'light');updateTheme();});
$('compareAction').addEventListener('click',showCompare); $('closeDialog').addEventListener('click',()=>$('compareDialog').classList.remove('open'));
$('compareDialog').addEventListener('click',event=>{if(event.target===$('compareDialog'))$('compareDialog').classList.remove('open');});
$('closePurchase').addEventListener('click',closePurchaseOptions);
$('purchaseDialog').addEventListener('click',event=>{if(event.target===$('purchaseDialog'))closePurchaseOptions();});
$('accountButton').addEventListener('click',openAuth); $('closeAuth').addEventListener('click',closeAuth);
$('authDialog').addEventListener('click',event=>{if(event.target===$('authDialog'))closeAuth();});
$('authForm').addEventListener('submit',submitAuth);
$('authSwitch').addEventListener('click',()=>{authMode=authMode==='login'?'signup':'login';$('authError').hidden=true;$('authStatus').hidden=true;setLanguage(lang);});
$('signOut').addEventListener('click',leaveAccount);
$('attach').addEventListener('click',()=>user?$('imageFile').click():openAuth());
$('imageFile').addEventListener('change',event=>chooseImage(event.target.files?.[0]));
$('removeImage').addEventListener('click',clearPendingImage);
$('renameForm').addEventListener('submit',saveRename);
$('closeRename').addEventListener('click',closeRename);
$('closeShare').addEventListener('click',closeShare);
$('createShare').addEventListener('click',createShare);
$('copyShare').addEventListener('click',async()=>{try{await copyText($('shareUrl').value);$('shareStatus').textContent='Havola nusxalandi.';}catch(error){$('shareStatus').textContent=error.message;}});
$('textShare').addEventListener('click',shareText);
$('revokeShare').addEventListener('click',revokeShare);
for(const id of ['renameDialog','shareDialog']) $(id).addEventListener('click',event=>{if(event.target===$(id))$(id).classList.remove('open');});
document.addEventListener('click',event=>{if(!event.target.closest('.history-menu-wrap'))document.querySelectorAll('.history-menu').forEach(node=>node.hidden=true);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('compareDialog').classList.remove('open');closePurchaseOptions();closeAuth();closeRename();closeShare();closeRail();document.querySelectorAll('.history-menu').forEach(node=>node.hidden=true);}});

setLanguage(lang);
updateSendState();
if (shareToken) { renderSharedChat(); setInterval(()=>{if(!document.hidden)renderSharedChat();},15000); }
else if (user) loadRemoteChats();
