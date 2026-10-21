const BACKEND = 'https://topsiagent.onrender.com';
const $ = id => document.getElementById(id);

// Remove a legacy copy that could contain payment details.
localStorage.removeItem('topagent_profile');
localStorage.removeItem('top_chats_guest_v1');
localStorage.removeItem('top_active_guest_v1');

const copy = {
  uz: {
    heading:'Bugun nima sotib olamiz?', new:'Yangi chat', history:'Chat tarixi', guest:'Mehmon chatlari sahifadan chiqqanda o‘chadi.', synced:'Chatlar hisobingizda saqlanadi.', syncError:'Sinxronlashmadi. Chat shu brauzerda saqlangan.',
    signIn:'Kirish', signOut:'Chiqish', signUp:'Hisob ochish', haveAccount:'Hisobingiz bormi? Kirish', createAccount:'Hisob ochish', authIntro:'Hisobga kirsangiz, chatlaringiz keyingi safar ham saqlanadi.', confirmEmail:'Emailingizga kelgan tasdiqlash havolasini oching, so‘ng kiring.', expiredEmail:'Tasdiqlash havolasi eskirgan yoki ishlatilgan. Yangi havola yuboring.', confirmedEmail:'Email tasdiqlandi. Endi hisobga kiring.', resendEmail:'Havolani qayta yuborish', resendSent:'Yangi havola yuborildi. Eng so‘nggi xatni oching.',
    placeholder:'Top’ga yozing', examples:['Ot uchun egar','Nike sneakers','Samsung TV','Maktab uchun ryukzak'], searching:'Qidiryapman', error:'Qidiruvda xatolik yuz berdi. Qayta urinib ko‘ring.',
    results:'Tavsiyalar', count:n=>`${n} ta variant`, note:'Narx va mavjudlikni do‘kon sahifasida tekshiring.', open:'Do‘konda xarid qilish ↗', buy:'Xarid variantlari', autoBuy:'Top orqali xarid', autoUnavailable:'Top orqali avtomatik xarid hozircha mavjud emas. Uzum Market bilan buyurtma integratsiyasi tayyor bo‘lgach ishlaydi.', autoOther:'Top bu do‘kon orqali avtomatik xaridni hali qo‘llamaydi. Do‘konda o‘zingiz xarid qilishingiz mumkin.', more:'Boshqa tavsiyalarni ko‘rsat', cheaper:'Arzonrog‘i bormi?',
    compare:'Solishtirish', selected:n=>`${n} ta tanlandi`, compareTitle:'Mahsulotlarni solishtirish', priceUnknown:'Narx ko‘rsatilmagan', store:'Do‘kon', price:'Narx', fit:'Nima uchun mos', product:'Mahsulot', link:'Havola',
    delete:'Chatni o‘chirish', deleteConfirm:'Bu chatni o‘chirasizmi?', authFail:'Kirish amalga oshmadi.', historyFail:'Tarixni yuklab bo‘lmadi.', mode:'Faqat xarid uchun', darkTheme:'Qora rejim', whiteTheme:'Oq rejim',
    rename:'Nomini o‘zgartirish', share:'Ulashish', copyAnswer:'Nusxalash', regenerate:'Qayta yaratish', imageError:'Faqat JPEG, PNG yoki WebP rasm (5 MB gacha) tanlang.', imageOnly:'Shu rasmdagi mahsulotni yoki unga o‘xshash variantlarni top.', signInForImage:'Rasm bilan qidirish uchun hisobga kiring.'
  },
  en: {
    heading:'What are we buying today?', new:'New chat', history:'Chat history', guest:'Guest chats disappear when you leave the page.', synced:'Chats are saved to your account.', syncError:'Could not sync. This chat is saved in this browser.',
    signIn:'Sign in', signOut:'Sign out', signUp:'Create account', haveAccount:'Already have an account? Sign in', createAccount:'Create account', authIntro:'Sign in to keep your chats for your next visit.', confirmEmail:'Open the confirmation link in your email, then sign in.',
    placeholder:'What would you like to buy?', examples:['Headphones under $200','Laptop for coding','Redmi Note 14 in the US'], searching:'Searching…', error:'Search failed. Please try again.',
    results:'Recommendations', count:n=>`${n} options`, note:'Check price and availability at the store.', open:'Buy at store ↗', buy:'Purchase options', autoBuy:'Buy through Top', autoUnavailable:'Automatic purchase through Top is not available yet. It needs a retailer order integration.', autoOther:'Top cannot automatically purchase from this store yet. You can buy on the store page.', more:'Show other options', cheaper:'Anything cheaper?',
    compare:'Compare', selected:n=>`${n} selected`, compareTitle:'Compare products', priceUnknown:'Price unavailable', store:'Store', price:'Price', fit:'Why it fits', product:'Product', link:'Link',
    delete:'Delete chat', deleteConfirm:'Delete this chat?', authFail:'Sign in failed.', historyFail:'Could not load history.', mode:'Shopping only', dark:'Dark mode', light:'Light mode'
  },
  ru: {
    heading:'Что купим сегодня?', new:'Новый чат', history:'История чатов', guest:'Гостевые чаты исчезнут после ухода со страницы.', synced:'Чаты сохранены в аккаунте.', syncError:'Не удалось синхронизировать. Чат сохранён в браузере.',
    signIn:'Войти', signOut:'Выйти', signUp:'Создать аккаунт', haveAccount:'Уже есть аккаунт? Войти', createAccount:'Создать аккаунт', authIntro:'Войдите, чтобы сохранить чаты для следующего визита.', confirmEmail:'Откройте ссылку подтверждения в письме, затем войдите.',
    placeholder:'Что хотите купить?', examples:['Наушники до $200','Ноутбук для программирования','Redmi Note 14 в России'], searching:'Ищу…', error:'Ошибка поиска. Попробуйте ещё раз.',
    results:'Рекомендации', count:n=>`${n} варианта`, note:'Проверьте цену и наличие в магазине.', open:'Купить в магазине ↗', buy:'Варианты покупки', autoBuy:'Купить через Top', autoUnavailable:'Автоматическая покупка через Top пока недоступна. Нужна интеграция с магазином.', autoOther:'Top пока не может автоматически купить товар в этом магазине. Вы можете купить его на сайте магазина.', more:'Показать другие варианты', cheaper:'Есть дешевле?',
    compare:'Сравнить', selected:n=>`${n} выбрано`, compareTitle:'Сравнение товаров', priceUnknown:'Цена неизвестна', store:'Магазин', price:'Цена', fit:'Почему подходит', product:'Товар', link:'Ссылка',
    delete:'Удалить чат', deleteConfirm:'Удалить этот чат?', authFail:'Не удалось войти.', historyFail:'Не удалось загрузить историю.', mode:'Только покупки', dark:'Тёмная тема', light:'Светлая тема'
  }
};

let lang = 'uz';
let darkTheme = localStorage.getItem('top_v0_theme_v1') === 'dark';
let session = readJson('top_session_v1', null);
let user = session?.user || null;
let authGeneration = 0;
let refreshTask = null;
let chats = user ? readChats() : [];
let activeId = user ? localStorage.getItem(activeKey()) || null : null;
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
const renderedMessageCounts = new Map();
const dialogFocus = new Map();
const openDialogs = [];

function t(key) { return copy[lang][key]; }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function storageKey() { return `top_chats_user_${user.id}`; }
function activeKey() { return `top_active_user_${user.id}`; }
function readChats() { if (!user) return []; const value = readJson(storageKey(), []); return Array.isArray(value) ? value.filter(chat => chat && typeof chat.id === 'string' && Array.isArray(chat.messages)) : []; }
function persist() {
  chats.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (user) {
    try { localStorage.setItem(storageKey(), JSON.stringify(chats)); } catch { syncFailed = true; updateAccountUI(); }
    if (activeId) localStorage.setItem(activeKey(), activeId); else localStorage.removeItem(activeKey());
  }
  renderHistory();
}
function activeChat() { return chats.find(chat => chat.id === activeId) || null; }
function touch(chat) { chat.updatedAt = new Date().toISOString(); persist(); }
function titleFrom(text) { return text.trim().replace(/\s+/g,' ').slice(0, 55); }
function nearBottom() { const scroller=$('contentScroll'); return scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<100; }
function updateScrollLatest() { $('scrollLatest').hidden=!activeChat()?.messages.length || nearBottom(); }
function scrollBottom(smooth=false) { $('contentScroll').scrollTo({top:$('contentScroll').scrollHeight,behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'}); updateScrollLatest(); }
function updateSendState() {
  const button=$('send'); button.disabled=!loading && (!$('input').value.trim() && !pendingImage);
  button.classList.toggle('ready',!button.disabled); button.classList.toggle('stopping',loading);
  button.setAttribute('aria-label',loading?'Javobni to‘xtatish':'Yuborish'); button.title=loading?'Javobni to‘xtatish':'Yuborish';
  button.querySelector('use').setAttribute('href',loading?'#icon-stop':'#icon-send');
}
function stopGeneration() {
  const controller=requestController; requestController=null; controller?.abort(); loading=false; updateSendState();
  renderConversation({preserveScroll:true});
}
function closeRail() { $('rail').classList.remove('open'); $('shell').classList.add('sidebar-closed'); $('backdrop').classList.remove('open'); $('mobileMenu').setAttribute('aria-expanded','false'); if($('rail').contains(document.activeElement)) $('mobileMenu').focus(); $('rail').inert=true; }
function openRail() { $('rail').inert=false; $('rail').classList.add('open'); $('shell').classList.remove('sidebar-closed'); $('backdrop').classList.add('open'); $('mobileMenu').setAttribute('aria-expanded','true'); }
function closeRailOnMobile() { if(matchMedia('(max-width:720px)').matches) closeRail(); }
function closeTopMenu() { $('topMenu').hidden=true; $('topMore').setAttribute('aria-expanded','false'); $('brandButton').setAttribute('aria-expanded','false'); }
function toggleTopMenu() { const opening=$('topMenu').hidden; $('topMenu').hidden=!opening; for(const id of ['topMore','brandButton']) $(id).setAttribute('aria-expanded',String(opening)); if(opening) $('newSearch').focus(); }
function updateDialogStack() { $('shell').inert=openDialogs.length>0;openDialogs.forEach((id,index)=>{const dialog=$(id);dialog.style.zIndex=String(50+index*2);dialog.inert=index!==openDialogs.length-1;dialog.setAttribute('aria-modal',String(index===openDialogs.length-1));}); }
function showDialog(id,focusId) { if(!$(id).classList.contains('open')){dialogFocus.set(id,document.activeElement);openDialogs.push(id);} $(id).classList.add('open');updateDialogStack();if(focusId)$(focusId).focus(); }
function hideDialog(id) { if(!$(id).classList.contains('open'))return;$(id).classList.remove('open');$(id).inert=false;openDialogs.splice(openDialogs.indexOf(id),1);updateDialogStack();const target=dialogFocus.get(id);dialogFocus.delete(id);if(target?.isConnected&&!target.closest('[inert]'))target.focus(); }
function openSettings() { closeTopMenu(); showDialog('settingsDialog','themeToggle'); }
function openChatSearch() { closeTopMenu(); $('historySearch').value=''; renderSearchResults(); showDialog('searchDialog','historySearch'); }
function searchText(value) { return String(value||'').toLocaleLowerCase('uz').replace(/[’‘`]/g,"'"); }
function renderSearchResults() {
  const query=searchText($('historySearch').value.trim());
  const matches=query?chats.filter(chat=>chat.messages.length && (searchText(chat.title).includes(query)||chat.messages.some(message=>searchText(message.content).includes(query))))
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)):[];
  $('searchResults').replaceChildren();
  $('searchEmpty').hidden=matches.length>0;
  $('searchEmpty').textContent=query?'Mos chat topilmadi':'Chatlaringizni qidiring';
  for(const chat of matches) {
    const button=document.createElement('button'); button.type='button'; button.className='search-result';
    const title=document.createElement('strong'); title.textContent=chat.title;
    const message=chat.messages.find(turn=>searchText(turn.content).includes(query))||chat.messages.at(-1);
    const snippet=document.createElement('span'); snippet.textContent=String(message?.content||'').replace(/\s+/g,' ').slice(0,160);
    button.append(title,snippet); button.addEventListener('click',()=>{hideDialog('searchDialog');selectChat(chat.id);$('input').focus();});
    $('searchResults').append(button);
  }
}
function icon(name) { const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.8'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round'); svg.setAttribute('aria-hidden','true'); const use=document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href',`#icon-${name}`); svg.append(use); return svg; }
function actionButton(label,iconName,action) { const button=document.createElement('button'); button.type='button'; button.setAttribute('aria-label',label); button.title=label; button.append(icon(iconName)); button.addEventListener('click',action); return button; }

function setLanguage() {
  lang = 'uz';
  document.documentElement.lang = lang;
  $('chatHeading').textContent = t('heading');
  $('newSearch').textContent = t('new');
  $('railNewText').textContent = t('new');
  $('historyLabel').textContent = t('history');
  $('historySearch').placeholder = 'Chatlarni qidirish';
  $('historySearch').setAttribute('aria-label', 'Chatlarni qidirish');
  $('mobileMenu').setAttribute('aria-label', 'Panelni ochish');
  $('input').placeholder = t('placeholder');
  $('compareTitle').textContent = t('compareTitle');
  $('authDescription').textContent = t('authIntro');
  $('signOut').textContent = t('signOut');
  $('authTitle').textContent = authMode === 'login' ? t('signIn') : t('signUp');
  $('authSubmit').textContent = $('authTitle').textContent;
  $('authSwitch').textContent = authMode === 'login' ? t('createAccount') : t('haveAccount');
  $('resendConfirmation').textContent = t('resendEmail');
  updateTheme(); updateAccountUI(); renderHistory(); renderConversation();
}
function updateTheme() {
  document.documentElement.classList.toggle('dark',darkTheme);
  document.querySelector('meta[name="theme-color"]').content = darkTheme ? '#212121' : '#f7f7f8';
  const label = darkTheme ? t('whiteTheme') : t('darkTheme');
  $('themeLabel').textContent=label;
  $('themeToggle').setAttribute('aria-label',label);
  $('themeToggle').setAttribute('aria-pressed',String(darkTheme));
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
  const visible=chats.filter(chat => chat.messages.length)
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  visible.forEach(chat => {
    const item=document.createElement('div'); item.className='history-item' + (chat.id===activeId ? ' active' : '');
    const open=document.createElement('button'); open.type='button'; open.className='history-open'; open.textContent=chat.title; open.title=chat.title;
    open.addEventListener('click',()=>selectChat(chat.id));
    const wrap=document.createElement('div'); wrap.className='history-menu-wrap';
    const more=document.createElement('button'); more.type='button'; more.className='history-more'; more.textContent='⋯'; more.title='Chat amallari'; more.setAttribute('aria-label',`${chat.title}: amallar`); more.setAttribute('aria-expanded','false');
    const menu=document.createElement('div'); menu.className='history-menu'; menu.hidden=true;
    for (const [label,action] of [[t('rename'),()=>openRename(chat)],[t('share'),()=>openShare(chat)],[t('delete'),()=>deleteChat(chat)]]) {
      const button=document.createElement('button'); button.type='button'; button.textContent=label;
      button.addEventListener('click',()=>{menu.hidden=true;more.setAttribute('aria-expanded','false');action();closeRailOnMobile();}); menu.append(button);
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
  if($('searchDialog').classList.contains('open')) renderSearchResults();
}
function selectChat(id) {
  if (loading) stopGeneration();
  clearPendingImage();
  activeId=id; persist(); $('input').value=''; $('input').style.height='auto'; updateSendState(); renderConversation({forceBottom:true}); closeRailOnMobile();
}
function newChat() {
  if (loading) stopGeneration();
  clearPendingImage();
  $('historySearch').value='';
  activeId=null; persist(); $('input').value=''; $('input').style.height='auto'; updateSendState(); renderConversation({forceBottom:true}); closeTopMenu(); closeRailOnMobile(); $('input').focus();
}
async function deleteChat(chat) {
  if (!confirm(t('deleteConfirm'))) return;
  try {
    if (activeId===chat.id && loading) stopGeneration();
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
  showDialog('renameDialog','renameInput'); $('renameInput').select();
}
function closeRename() { hideDialog('renameDialog'); }
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
  $('createShare').disabled=!user; showDialog('shareDialog',user?'createShare':'textShare');
}
function closeShare() { hideDialog('shareDialog'); }
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
  previewUrl=null; pendingImage=null; $('imageFile').value=''; $('imagePreview').hidden=true; updateSendState(); renderSuggestions();
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
function addMessage(role,content,animate=false) {
  const node=document.createElement('div'); node.className=`message ${role}${animate?' enter':''}`;
  const avatar=document.createElement('div'); avatar.className=`message-avatar ${role.startsWith('user')?'user-avatar':'assistant-avatar'}`; avatar.setAttribute('aria-hidden','true');
  avatar.append(role.startsWith('user')?icon('user'):$('starTemplate').content.firstElementChild.cloneNode(true));
  const body=document.createElement('div'); body.className='message-body'; const text=document.createElement('p'); text.className='message-text'; text.textContent=content;
  if(role.includes('loading')) { const dots=document.createElement('span'); dots.className='thinking-dots'; dots.setAttribute('aria-hidden','true'); for(let i=0;i<3;i++) dots.append(document.createElement('i')); text.append(dots); }
  body.append(text); node.append(avatar,body); $('messages').append(node); return node;
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
  showDialog('purchaseDialog','purchaseStore');
}
function closePurchaseOptions() { hideDialog('purchaseDialog'); }
function searchHistory(messages) {
  const recent=messages.slice(-8);
  const lastResult=[...messages].reverse().find(message=>message.role==='assistant' && safeProducts(message.products).length);
  const turns=lastResult && !recent.includes(lastResult) ? [lastResult,...recent] : recent;
  return turns.map(({role,content,imageId,products})=>({role,content,
    ...(imageId?{imageId}:{}),
    ...(role==='assistant' && safeProducts(products).length?{products:safeProducts(products)}:{})}));
}
function renderProducts(items) {
  const section=document.createElement('section'); section.className='message-products results'; section.setAttribute('aria-label',t('results'));
  const heading=document.createElement('div'); heading.className='results-top'; const title=document.createElement('h2'); title.textContent=t('results'); heading.append(title,span('results-count',t('count')(items.length)));
  const note=document.createElement('p'); note.className='result-note'; note.textContent=t('note');
  const grid=document.createElement('div'); grid.className='grid';
  const selected=new Set(); const bar=document.createElement('div'); bar.className='compare-bar';
  const count=span('compare-count',''); const compare=document.createElement('button'); compare.type='button'; compare.className='compare-action'; compare.textContent=t('compare');
  const update=()=>{bar.classList.toggle('visible',selected.size>0);count.textContent=t('selected')(selected.size);compare.disabled=selected.size<2;};
  compare.addEventListener('click',()=>showCompare([...selected].map(index=>items[index]))); bar.append(count,compare);
  items.forEach((p,i)=>{
    const card=document.createElement('article'); card.className='card';
    const top=document.createElement('div'); top.className='card-top'; top.append(span('store',p.store),span('rank',String(i+1).padStart(2,'0')));
    const save=actionButton('Mahsulotni saqlash','bookmark',()=>toggleSavedProduct(p)); save.classList.add('save-product'); save.dataset.productUrl=p.url; save.setAttribute('aria-pressed',String(isProductSaved(p.url))); top.append(save);
    const title=document.createElement('h3'); title.textContent=p.title;
    const price=document.createElement('div'); price.append(span(p.price==null?'price-unknown':'price',priceText(p)));
    const reason=document.createElement('p'); reason.className='reason'; reason.textContent=p.why||'';
    const bottom=document.createElement('div'); bottom.className='card-bottom';
    const choices=document.createElement('div'); choices.className='purchase-choices';
    const buy=document.createElement('button'); buy.type='button'; buy.className='store-link'; buy.textContent=t('buy'); buy.addEventListener('click',()=>openPurchaseOptions(p));
    const link=document.createElement('a'); link.className='store-link secondary'; link.textContent=t('open'); link.href=p.url; link.target='_blank'; link.rel='noopener noreferrer';
    choices.append(buy,link);
    const label=document.createElement('label'); label.className='compare-pick'; const box=document.createElement('input'); box.type='checkbox'; box.checked=selected.has(i); box.setAttribute('aria-label',`${t('compare')}: ${p.title}`);
    box.addEventListener('change',()=>{ if(box.checked && selected.size>=3){box.checked=false;return;} box.checked?selected.add(i):selected.delete(i); update(); }); label.append(box,document.createTextNode(t('compare')));
    bottom.append(choices,label); card.append(top,title,price,reason,bottom); grid.append(card);
  });
  update(); section.append(heading,note,grid,bar); return section;
}
function showCompare(items) {
  if (items.length<2) return;
  const table=document.createElement('table'); table.className='compare-table';
  const rows=[['product',p=>p.title],['store',p=>p.store],['price',p=>priceText(p)],['fit',p=>p.why||'—'],['link',p=>p.url]];
  for(const [key,get] of rows){ const tr=document.createElement('tr'); const th=document.createElement('th'); th.scope='row'; th.textContent=t(key); tr.append(th);
    for(const p of items){ const td=document.createElement('td'); if(key==='link'){const a=document.createElement('a'); a.href=p.url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=t('open'); td.append(a);} else td.textContent=get(p); tr.append(td); } table.append(tr);
  }
  $('compareTable').replaceChildren(table); showDialog('compareDialog','closeDialog');
}
function suggestion(label,action,primary=false,details=null) {
  const button=document.createElement('button'); button.type='button'; button.className='suggestion'+(primary?' primary':'');
  if(details) { const text=document.createElement('span'); const title=document.createElement('strong'); title.textContent=label; const subtitle=document.createElement('small'); subtitle.textContent=details.subtitle; text.append(title,subtitle); button.append(icon(details.icon),text); } else button.textContent=label;
  button.addEventListener('click',action); $('suggestions').append(button);
}
function renderSuggestions() {
  $('suggestions').replaceChildren();
  const chat=activeChat(); const answers=[...(chat?.messages||[])].reverse().filter(m=>m.role==='assistant');
  const last=answers[0];
  (chat?.messages.length?$('followUps'):$('welcomeSuggestions')).append($('suggestions'));
  if (loading || pendingImage) return;
  if (!chat?.messages.length) {
    const details=[{icon:'bag',subtitle:'Rang va narxni tanlang'},{icon:'shoe',subtitle:'O‘zingizga mos juftlik'},{icon:'tv',subtitle:'Eng mosini solishtiring'},{icon:'backpack',subtitle:'Budjetingizga mos'}];
    t('examples').forEach((text,index)=>suggestion(text,()=>{ $('input').value=text; $('input').style.height='auto'; updateSendState(); $('input').focus(); },false,details[index]));
    return;
  }
  if (!last) return;
  const resultProducts=safeProducts(last.products);
  if (resultProducts.length) {
    suggestion(t('buy'),()=>openPurchaseOptions(resultProducts[0]),true);
    suggestion(t('more'),()=>send(t('more')));
    suggestion(t('cheaper'),()=>send(t('cheaper')));
  }
  (Array.isArray(last.followUps)?last.followUps:[]).slice(0,3).forEach(text=>suggestion(text,()=>send(text)));
}
function renderConversation({forceBottom=false,preserveScroll=false}={}) {
  const chat=activeChat();
  const scroller=$('contentScroll'),oldTop=scroller.scrollTop,wasNearBottom=nearBottom();
  const previousCount=renderedMessageCounts.get(chat?.id)??chat?.messages.length??0;
  $('messages').replaceChildren();
  $('workspace').classList.toggle('has-chat',!!chat?.messages.length);
  (chat?.messages||[]).forEach((message,index)=>{
    const node=addMessage(message.role,message.content,index>=previousCount);
    const body=node.querySelector('.message-body');
    if(message.imageId && message.role==='user') {
      const img=document.createElement('img'); img.className='message-image'; img.alt='Yuborilgan rasm';
      body.prepend(img); fetchOwnImage(chat,message.imageId,img);
    }
    if(message.role==='assistant') {
      const actions=document.createElement('div'); actions.className='message-actions';
      for(const [value,label,name] of [['up','Yaxshi javob','thumbs-up'],['down','Yomon javob','thumbs-down']]) { const feedback=actionButton(label,name,()=>{message.feedback=message.feedback===value?null:value; touch(chat); actions.querySelectorAll('[aria-pressed]').forEach(button=>button.setAttribute('aria-pressed',String(button===feedback&&message.feedback===value)));}); feedback.setAttribute('aria-pressed',String(message.feedback===value)); actions.append(feedback); }
      const copyButton=actionButton(t('copyAnswer'),'copy',async()=>{try{await copyText(message.content);copyButton.replaceChildren(icon('check'));copyButton.setAttribute('aria-label','Nusxalandi');setTimeout(()=>{if(copyButton.isConnected){copyButton.replaceChildren(icon('copy'));copyButton.setAttribute('aria-label',t('copyAnswer'));}},1800);}catch(error){alert(error.message);}});
      actions.append(copyButton);
      if(index===chat.messages.length-1 && chat.messages[index-1]?.role==='user') {
        const retry=actionButton(t('regenerate'),'refresh',()=>regenerate(chat,index)); retry.disabled=loading; actions.append(retry);
      }
      body.append(actions);
      const items=safeProducts(message.products); if(items.length) body.append(renderProducts(items));
    } else if(message.role==='user') {
      const actions=document.createElement('div'); actions.className='message-actions';
      const edit=actionButton('Xabarni tahrirlash','edit',()=>editMessage(chat,index,node)); edit.disabled=loading; actions.append(edit);
      const copyButton=actionButton('Xabarni nusxalash','copy',async()=>{try{await copyText(message.content);}catch(error){alert(error.message);}}); actions.append(copyButton);
      if(index===chat.messages.length-1) { const retry=actionButton('Qayta urinib ko‘rish','refresh',()=>requestReply(chat,index)); retry.disabled=loading; actions.append(retry); }
      body.append(actions);
    }
  });
  if(chat) renderedMessageCounts.set(chat.id,chat.messages.length);
  $('shareCurrent').disabled=!chat?.messages.length;
  renderSuggestions();
  if(forceBottom || (!preserveScroll && wasNearBottom)) scrollBottom((chat?.messages.length||0)>previousCount);
  else { scroller.scrollTop=oldTop; updateScrollLatest(); }
}

async function api(path, options={}, authenticated=false) {
  const generation=authGeneration,owner=user?.id;
  const checkOwner=()=>{if(authenticated&&(generation!==authGeneration||owner!==user?.id))throw new DOMException('Account changed','AbortError');};
  if (authenticated) await ensureSession();
  checkOwner();
  const headers={...options.headers};
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  if (authenticated) headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(`${BACKEND}${path}`,{...options,headers});
  if (authenticated && response.status===401) {
    checkOwner();await refreshSession();checkOwner();headers.Authorization=`Bearer ${session.access_token}`;
    response=await fetch(`${BACKEND}${path}`,{...options,headers});
  }
  const data=await response.json().catch(()=>({}));
  checkOwner();
  if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`),{status:response.status,code:data.code,product:data.product,retryAfterSeconds:data.retryAfterSeconds});
  return data;
}
async function refreshSession() {
  if (!session?.refresh_token) throw new Error('Session expired');
  const generation=authGeneration,owner=user?.id,token=session.refresh_token;
  if(refreshTask?.generation===generation)return refreshTask.promise;
  const promise=(async()=>{
    const data=await api('/api/auth/refresh',{method:'POST',body:JSON.stringify({refresh_token:token})});
    if(generation!==authGeneration||owner!==user?.id||token!==session?.refresh_token)throw new DOMException('Account changed','AbortError');
    if(data.user?.id!==owner||!data.session?.access_token)throw new Error('Invalid session refresh');
    session=data.session;user=data.user;localStorage.setItem('top_session_v1',JSON.stringify({...session,user}));
  })();
  const task={generation,promise};refreshTask=task;
  try{return await promise;}finally{if(refreshTask===task)refreshTask=null;}
}
async function ensureSession() { if (!session) throw new Error('Sign in required'); if ((session.expires_at||0)*1000<Date.now()+60000) await refreshSession(); }
function syncChat(chat) {
  if (!user) return Promise.resolve();
  const generation=authGeneration,owner=user.id;
  const previous=syncQueues.get(chat.id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    if(generation!==authGeneration||owner!==user?.id)return;
    const body=JSON.stringify({title:chat.title,messages:chat.messages});
    const data=chat.remoteId
      ? await api(`/api/chats/${chat.remoteId}`,{method:'PATCH',body},true)
      : await api('/api/chats',{method:'POST',body},true);
    if (!chat.remoteId) chat.remoteId=data.chat.id;
    syncFailed=false; persist(); updateAccountUI();
  }).catch(error=>{ if(generation!==authGeneration||owner!==user?.id||error.name==='AbortError')return;syncFailed=true;updateAccountUI();console.error('[chat sync]',error); });
  syncQueues.set(chat.id,next); return next;
}
async function loadRemoteChats() {
  if (!user) return;
  const generation=authGeneration;
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
  } catch(error) { if(generation!==authGeneration||error.name==='AbortError')return;syncFailed=true;updateAccountUI();console.error('[history]',error); }
}
async function enterAccount(data) {
  if(loading)stopGeneration();
  const generation=++authGeneration;
  const guestSaved=user?[]:savedProducts.slice();
  const guestChats=chats.filter(chat=>chat && Array.isArray(chat.messages) && chat.messages.length);
  session=data.session; user=data.user;
  localStorage.setItem('top_session_v1',JSON.stringify({...session,user}));
  syncSavedAccount(guestSaved);
  chats=readChats(); activeId=localStorage.getItem(activeKey())||null;
  await loadRemoteChats();
  if(generation!==authGeneration)return;
  const existing=new Set(chats.map(chat=>chat.id));
  const imported=guestChats.filter(chat=>!existing.has(chat.id)).map(chat=>({...chat,remoteId:null}));
  chats.push(...imported);
  if (imported.length) { persist(); await Promise.all(imported.map(syncChat)); }
  if(generation!==authGeneration)return;
  if (!activeId && imported.length) activeId=imported[0].id;
  persist(); updateAccountUI(); renderConversation();
}
function leaveAccount() {
  if(loading)stopGeneration();
  authGeneration++;
  session=null; user=null; localStorage.removeItem('top_session_v1');
  resetSavedProducts();hideDialog('savedDialog');
  clearPendingImage(); for(const url of imageUrls.values()) URL.revokeObjectURL(url); imageUrls.clear();
  chats=[]; activeId=null; syncFailed=false;
  closeAuth(); updateAccountUI(); persist(); renderConversation();
}
function openAuth() {
  authMode='login'; $('authError').hidden=true; $('authStatus').hidden=true; $('resendConfirmation').hidden=!!user; $('authEmail').value=''; $('authPassword').value='';
  setLanguage(lang); showDialog('authDialog',user?'signOut':'authEmail');
}
function closeAuth() { hideDialog('authDialog'); }
function handleAuthCallback() {
  if (!location.hash) return;
  const params=new URLSearchParams(location.hash.slice(1));
  const expired=params.get('error_code')==='otp_expired';
  const confirmed=params.has('access_token') && params.has('refresh_token');
  if (!expired && !confirmed) return;
  history.replaceState(null,'',location.pathname+location.search);
  if (user) return;
  openAuth();
  $('authEmail').value=sessionStorage.getItem('top_pending_confirmation_email')||'';
  if (expired) {
    $('authError').textContent=t('expiredEmail'); $('authError').hidden=false;
    $('resendConfirmation').hidden=false;
  } else {
    $('authStatus').textContent=t('confirmedEmail'); $('authStatus').hidden=false;
    sessionStorage.removeItem('top_pending_confirmation_email');
  }
}
async function resendConfirmation() {
  const email=$('authEmail');
  if (!email.reportValidity()) return;
  const button=$('resendConfirmation'); button.disabled=true;
  $('authError').hidden=true; $('authStatus').hidden=true;
  try {
    await api('/api/auth/resend-confirmation',{method:'POST',body:JSON.stringify({email:email.value.trim()})});
    sessionStorage.setItem('top_pending_confirmation_email',email.value.trim());
    $('authStatus').textContent=t('resendSent'); $('authStatus').hidden=false;
  } catch(error) { $('authError').textContent=error.message||t('authFail'); $('authError').hidden=false; }
  finally { button.disabled=false; }
}
async function submitAuth(event) {
  event.preventDefault(); $('authError').hidden=true; $('authStatus').hidden=true; $('authSubmit').disabled=true;
  const generation=authGeneration;
  try {
    const path=authMode==='login'?'/api/auth/login':'/api/auth/signup';
    const data=await api(path,{method:'POST',body:JSON.stringify({email:$('authEmail').value.trim(),password:$('authPassword').value})});
    if(generation!==authGeneration)return;
    if (!data.session) { sessionStorage.setItem('top_pending_confirmation_email',$('authEmail').value.trim()); $('authStatus').textContent=t('confirmEmail'); $('authStatus').hidden=false; $('resendConfirmation').hidden=false; return; }
    sessionStorage.removeItem('top_pending_confirmation_email');
    await enterAccount(data); closeAuth();
  } catch(error) { $('authError').textContent=error.message||t('authFail'); $('authError').hidden=false; }
  finally { $('authSubmit').disabled=false; }
}

async function send(preset) {
  const query=(preset||$('input').value).trim(); if ((!query && !pendingImage) || loading) return;
  const queryText=query || t('imageOnly');
  const file=pendingImage;
  let chat=activeChat();
  if (!chat) { chat={id:crypto.randomUUID(),remoteId:null,title:titleFrom(queryText),messages:[],updatedAt:new Date().toISOString()}; chats.unshift(chat); activeId=chat.id; renderedMessageCounts.set(chat.id,0); }
  const context=searchHistory(chat.messages);
  loading=true; updateSendState(); renderSuggestions();
  const controller=new AbortController(); requestController=controller; const sentTo=chat.id;
  let indicator=null;
  try {
    let imageId=null;
    if (file) {
      if (!user) throw new Error(t('signInForImage'));
      await syncQueues.get(chat.id);
      if (!chat.remoteId) await syncChat(chat);
      if (!chat.remoteId) throw new Error('Chatni hisobga saqlab bo‘lmadi.');
      const body=new FormData(); body.append('image',file);
      const upload=await api(`/api/chats/${chat.remoteId}/images`,{method:'POST',body,signal:controller.signal},true);
      imageId=upload.image.id; clearPendingImage();
    }
    if(controller.signal.aborted || requestController!==controller) return;
    chat.messages.push({role:'user',content:queryText,...(imageId?{imageId}:{})}); touch(chat);
    if (user) syncChat(chat);
    $('input').value=''; $('input').style.height='auto'; updateSendState();
    if (activeId===sentTo) { renderConversation({forceBottom:true}); indicator=addMessage('assistant loading',t('searching'),true); scrollBottom(true); }
    const authSearch=!!(imageId || context.some(turn=>turn.imageId));
    const data=await api('/api/search',{method:'POST',body:JSON.stringify({query:queryText,history:context,...(authSearch?{chatId:chat.remoteId,imageId}:{})}),signal:controller.signal},authSearch);
    if(controller.signal.aborted || requestController!==controller) return;
    if (Array.isArray(data.products) && typeof data.reply!=='string') data.reply=t('count')(data.products.length);
    if (typeof data.reply!=='string' || !Array.isArray(data.products)) throw new Error('Invalid response');
    chat.messages.push({role:'assistant',content:data.reply,products:safeProducts(data.products),followUps:Array.isArray(data.followUps)?data.followUps:[]});
    touch(chat); if (user) syncChat(chat);
  } catch(error) {
    if (!controller.signal.aborted && requestController===controller && error.name!=='AbortError') {
      if (chat.messages.at(-1)?.role==='user' && chat.messages.at(-1).content===queryText) {
        chat.messages.push({role:'assistant',content:t('error')}); touch(chat); if (user) syncChat(chat);
      } else { alert(error.message || t('error')); }
      console.error('[search]',error);
    }
  } finally {
    indicator?.remove();
    if(requestController===controller) {
      loading=false; updateSendState(); requestController=null;
      if (activeId===sentTo) { renderConversation(); $('input').focus(); }
    }
  }
}

function editMessage(chat,index,node) {
  if(loading || node.querySelector('.message-editor')) return;
  const body=node.querySelector('.message-body'); const text=body.querySelector('.message-text'); const actions=body.querySelector('.message-actions');
  const form=document.createElement('form'); form.className='message-editor';
  const input=document.createElement('textarea'); input.value=chat.messages[index].content; input.maxLength=1000; input.rows=3; input.setAttribute('aria-label','Xabarni tahrirlash');
  const buttons=document.createElement('div'); buttons.className='editor-actions';
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Bekor qilish';
  const save=document.createElement('button'); save.type='submit'; save.className='primary'; save.textContent='Saqlash va yuborish';
  const status=document.createElement('p'); status.className='action-status'; status.setAttribute('role','status');
  cancel.addEventListener('click',()=>{form.remove();text.hidden=false;actions.hidden=false;});
  input.addEventListener('input',()=>{save.disabled=!input.value.trim();});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(!input.value.trim() || loading)return;
    save.disabled=true;cancel.disabled=true;status.textContent='Yuborilmoqda…';
    const success=await requestReply(chat,index,input.value.trim());
    if(!success && form.isConnected){save.disabled=false;cancel.disabled=false;status.textContent='Yangi javob olinmadi. Oldingi suhbat saqlandi. Qayta urinib ko‘ring.';}
  });
  buttons.append(cancel,save);form.append(input,buttons,status);text.hidden=true;actions.hidden=true;body.append(form);input.focus();input.setSelectionRange(input.value.length,input.value.length);
}
async function requestReply(chat,questionIndex,editedText=null) {
  if(loading || activeId!==chat.id || chat.messages[questionIndex]?.role!=='user') return false;
  const question=chat.messages[questionIndex],isEdit=typeof editedText==='string';
  const query=isEdit?editedText:question.content;
  const context=searchHistory(chat.messages.slice(0,questionIndex));
  const authSearch=!!(question.imageId || context.some(turn=>turn.imageId));
  loading=true; updateSendState(); renderSuggestions();
  const follow=nearBottom(); const indicator=addMessage('assistant loading',t('searching'),true); if(follow&&!isEdit)scrollBottom(true);
  const controller=new AbortController();requestController=controller;let success=false;
  try {
    const data=await api('/api/search',{method:'POST',body:JSON.stringify({query,history:context,...(authSearch?{chatId:chat.remoteId,imageId:question.imageId}:{})}),signal:controller.signal},authSearch);
    if(controller.signal.aborted || requestController!==controller)return false;
    if(typeof data.reply!=='string' || !Array.isArray(data.products)) throw new Error('Invalid response');
    if(data.reason==='provider_unavailable') throw new Error(data.reply);
    const answer={role:'assistant',content:data.reply,products:safeProducts(data.products),followUps:Array.isArray(data.followUps)?data.followUps:[]};
    if(isEdit){chat.messages=[...chat.messages.slice(0,questionIndex),{...question,content:query},answer];if(questionIndex===0)chat.title=titleFrom(query);}
    else if(chat.messages[questionIndex+1]?.role==='assistant')chat.messages[questionIndex+1]=answer;
    else chat.messages.push(answer);
    touch(chat); if(user) syncChat(chat);
    renderedMessageCounts.set(chat.id,questionIndex+1);success=true;
  } catch(error) { if(!isEdit && !controller.signal.aborted && error.name!=='AbortError') alert(error.message || t('error')); }
  finally {
    indicator.remove();
    if(requestController===controller){loading=false;requestController=null;updateSendState();if(activeId===chat.id && (success||!isEdit))renderConversation({preserveScroll:isEdit});else renderSuggestions();}
  }
  return success;
}
async function regenerate(chat,index) { if(chat.messages[index]?.role==='assistant')return requestReply(chat,index-1); }

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

$('send').addEventListener('click',()=>loading?stopGeneration():send());
$('scrollLatest').addEventListener('click',()=>scrollBottom(true));
$('contentScroll').addEventListener('scroll',updateScrollLatest,{passive:true});
$('input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();send();}});
$('input').addEventListener('input',()=>{ $('input').style.height='auto'; $('input').style.height=Math.min($('input').scrollHeight,120)+'px'; updateSendState(); });
$('openSearch').addEventListener('click',openChatSearch);
$('closeSearch').addEventListener('click',()=>hideDialog('searchDialog'));
$('historySearch').addEventListener('input',renderSearchResults);
$('historySearch').addEventListener('keydown',event=>{const first=$('searchResults').querySelector('button');if(first&&event.key==='ArrowDown'){event.preventDefault();first.focus();}else if(first&&event.key==='Enter'&&!event.isComposing){event.preventDefault();first.click();}});
$('searchResults').addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp'].includes(event.key))return;const buttons=[...$('searchResults').querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const next=buttons[index+(event.key==='ArrowDown'?1:-1)];(next||$('historySearch')).focus();});
$('newSearch').addEventListener('click',newChat); $('railNew').addEventListener('click',newChat);
$('mobileMenu').addEventListener('click',openRail); $('railClose').addEventListener('click',closeRail); $('backdrop').addEventListener('click',closeRail);
$('themeToggle').addEventListener('click',()=>{darkTheme=!darkTheme;localStorage.setItem('top_v0_theme_v1',darkTheme?'dark':'light');updateTheme();});
$('settingsButton').addEventListener('click',openSettings); $('settingsTop').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',()=>hideDialog('settingsDialog'));
$('topMore').addEventListener('click',toggleTopMenu); $('brandButton').addEventListener('click',toggleTopMenu);
$('shareCurrent').addEventListener('click',()=>{closeTopMenu();const chat=activeChat();if(chat?.messages.length)openShare(chat);});
$('closeDialog').addEventListener('click',()=>hideDialog('compareDialog'));
$('closePurchase').addEventListener('click',closePurchaseOptions);
$('accountButton').addEventListener('click',openAuth); $('closeAuth').addEventListener('click',closeAuth);
$('authForm').addEventListener('submit',submitAuth);
$('authSwitch').addEventListener('click',()=>{authMode=authMode==='login'?'signup':'login';$('authError').hidden=true;$('authStatus').hidden=true;$('resendConfirmation').hidden=authMode!=='login';setLanguage(lang);});
$('resendConfirmation').addEventListener('click',resendConfirmation);
$('signOut').addEventListener('click',leaveAccount);
function attachImage() { if(user) $('imageFile').click(); else openAuth(); }
$('attach').addEventListener('click',attachImage); $('imageShortcut').addEventListener('click',attachImage);
$('imageFile').addEventListener('change',event=>chooseImage(event.target.files?.[0]));
$('removeImage').addEventListener('click',clearPendingImage);
$('renameForm').addEventListener('submit',saveRename);
$('closeRename').addEventListener('click',closeRename);
$('closeShare').addEventListener('click',closeShare);
$('createShare').addEventListener('click',createShare);
$('copyShare').addEventListener('click',async()=>{try{await copyText($('shareUrl').value);$('shareStatus').textContent='Havola nusxalandi.';}catch(error){$('shareStatus').textContent=error.message;}});
$('textShare').addEventListener('click',shareText);
$('revokeShare').addEventListener('click',revokeShare);
document.querySelectorAll('.dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)hideDialog(dialog.id);}));
document.addEventListener('click',event=>{if(!event.target.closest('.history-menu-wrap'))document.querySelectorAll('.history-menu').forEach(node=>node.hidden=true);if(!event.target.closest('#topMenu,#topMore,#brandButton'))closeTopMenu();});
document.addEventListener('keydown',event=>{
  const dialog=openDialogs.length?$(openDialogs.at(-1)):null;
  if(event.key==='Escape') { if(dialog)hideDialog(dialog.id);else{closeTopMenu();document.querySelectorAll('.history-menu').forEach(node=>node.hidden=true);closeRailOnMobile();} }
  if(event.key==='Tab'&&dialog) { const focusable=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not([hidden]),textarea')].filter(node=>node.getClientRects().length); const first=focusable[0],last=focusable.at(-1); if(!dialog.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();} }
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!dialog){event.preventDefault();openChatSearch();}
});
window.addEventListener('pagehide',()=>{ if(!user){ chats=[]; activeId=null; } });
window.addEventListener('pageshow',event=>{ if(event.persisted&&!user) newChat(); });

setLanguage(lang);
handleAuthCallback();
updateSendState();
initSavedProducts();
if(matchMedia('(min-width:721px)').matches) openRail(); else closeRail();
requestAnimationFrame(()=>$('shell').classList.remove('booting'));
new ResizeObserver(entries=>{ $('workspace').style.setProperty('--composer-space',`${Math.ceil(entries[0].target.getBoundingClientRect().height+42)}px`); }).observe(document.querySelector('.composer'));
if (shareToken) { renderSharedChat(); setInterval(()=>{if(!document.hidden)renderSharedChat();},15000); }
else if (user) loadRemoteChats();
