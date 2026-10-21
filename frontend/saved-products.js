// Guest saves last for this visit. Account saves and price checks use the server.
let savedProducts=[];
let priceNotifications=[];
let priceTracking={automaticEnabled:false,manualCheck:true};
let savedLoad=null;
let pendingSavedImports=[];
let savedRevision=0;
let savedEpoch=0;
let savedAccountOwner=null;
let savedImportRun=null;
const savedChanges=new Map();
const savedImportTasks=new Map();
const withdrawnSavedImports=new Set();
const savedSelection=new Set();
const savedBusy=new Set();

function savedState() { return {owner:user?.id||null,epoch:savedEpoch}; }
function currentSavedState(state) { return state.epoch===savedEpoch && state.owner===(user?.id||null); }
function markSavedChange(...urls) { const revision=++savedRevision;for(const url of urls)if(url)savedChanges.set(url,revision); }
function isProductSaved(url) { return savedProducts.some(product=>product.url===url); }
function putSavedProduct(product,sourceUrl=product.url) {
  savedProducts=savedProducts.filter(item=>item.url!==sourceUrl&&item.url!==product.url);
  savedProducts.push(product);markSavedChange(sourceUrl,product.url);
}
function updateSaveButtons() {
  document.querySelectorAll('.save-product').forEach(button=>{
    const saved=isProductSaved(button.dataset.productUrl);
    button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',saved?'Saqlanganlardan olib tashlash':'Mahsulotni saqlash');
    button.title=button.getAttribute('aria-label');
  });
}
function resetSavedProducts() {
  savedEpoch++;savedRevision=0;savedAccountOwner=null;savedImportRun=null;
  savedProducts=[];pendingSavedImports=[];priceNotifications=[];priceTracking={automaticEnabled:false,manualCheck:true};
  savedChanges.clear();savedImportTasks.clear();withdrawnSavedImports.clear();savedSelection.clear();savedBusy.clear();savedLoad=null;updateSaveButtons();
}
function savedErrorMessage(error) {
  if(error.code==='PRICE_UNAVAILABLE')return 'Do‘kon sahifasidan aniq narx olinmadi. Kuzatuv yangi yoqilmadi; oldingi narx saqlandi.';
  if(error.code==='PRICE_CHECK_COOLDOWN')return 'Keyingi tekshiruv uchun '+Math.ceil((error.retryAfterSeconds||300)/60)+' daqiqa kuting.';
  if(error.code==='AUTOMATIC_TRACKING_NOT_CONFIGURED')return 'Avtomatik kuzatuv hozir yoqilmagan. Narxni qo‘lda tekshirishingiz mumkin.';
  return 'Xizmat hozir javob bermayapti. Birozdan so‘ng qayta urinib ko‘ring.';
}
async function refreshSavedProducts() {
  if(!user)return;
  const state=savedState(),revision=savedRevision;
  if(savedLoad&&currentSavedState(savedLoad.state))return savedLoad.promise;
  const promise=(async()=>{
    const [data,notices]=await Promise.all([
      api('/api/saved-products',{signal:AbortSignal.timeout(12000)},true),
      api('/api/price-notifications',{signal:AbortSignal.timeout(12000)},true)
    ]);
    if(!currentSavedState(state))return;
    const incoming=Array.isArray(data.products)?data.products.filter(p=>safeProducts([p]).length):[];
    // Keep writes committed after this GET began, including deletion tombstones.
    const changed=url=>(savedChanges.get(url)||0)>revision;
    const retained=savedProducts.filter(p=>changed(p.url)&&!withdrawnSavedImports.has(p.url));
    savedProducts=incoming.filter(p=>!changed(p.url)&&!withdrawnSavedImports.has(p.url));
    savedProducts.push(...retained.filter(p=>!isProductSaved(p.url)));
    savedProducts.push(...pendingSavedImports.filter(p=>!withdrawnSavedImports.has(p.url)&&!isProductSaved(p.url)));
    priceNotifications=Array.isArray(notices.notifications)?notices.notifications:[];
    priceTracking=data.priceTracking||{automaticEnabled:false,manualCheck:true};
    for(const url of savedSelection)if(!isProductSaved(url))savedSelection.delete(url);
    updateSaveButtons();renderSavedProducts();
  })();
  const operation={state,promise};savedLoad=operation;
  try {await promise;} finally {if(savedLoad===operation)savedLoad=null;}
}
async function importSavedProduct(product,state) {
  const existing=savedImportTasks.get(product.url);
  if(existing&&currentSavedState(existing.state))return existing.promise;
  const promise=(async()=>{
    if(!currentSavedState(state))return;
    const data=await api('/api/saved-products',{method:'POST',body:JSON.stringify({title:product.title,store:product.store,url:product.url}),signal:AbortSignal.timeout(12000)},true);
    if(!currentSavedState(state))return;
    if(withdrawnSavedImports.has(product.url)) {
      // A guest may remove an item while its account-save POST is still running.
      // Remove the eventual server record before completing that import.
      try {await api('/api/saved-products/'+data.product.id,{method:'DELETE',signal:AbortSignal.timeout(12000)},true);}
      catch(error) {if(error.status!==404)throw error;}
      if(!currentSavedState(state))return;
      savedProducts=savedProducts.filter(p=>p.url!==product.url&&p.url!==data.product.url);
      markSavedChange(product.url,data.product.url);withdrawnSavedImports.delete(product.url);
    } else putSavedProduct(data.product,product.url);
    pendingSavedImports=pendingSavedImports.filter(p=>p.url!==product.url);
    updateSaveButtons();renderSavedProducts();
  })();
  const operation={state,promise};savedImportTasks.set(product.url,operation);
  try {return await promise;} finally {if(savedImportTasks.get(product.url)===operation)savedImportTasks.delete(product.url);}
}
async function syncSavedAccount(guestItems=[]) {
  const owner=user?.id;if(!owner)return;
  if(savedAccountOwner!==owner){resetSavedProducts();savedAccountOwner=owner;}
  const state=savedState();
  for(const product of guestItems) {
    if(savedProducts.some(p=>p.url===product.url&&!p.guest))continue;
    if(!pendingSavedImports.some(p=>p.url===product.url))pendingSavedImports.push({...product,guest:true});
    if(!withdrawnSavedImports.has(product.url)&&!isProductSaved(product.url))savedProducts.push({...product,guest:true});
  }
  updateSaveButtons();
  if(savedImportRun&&currentSavedState(savedImportRun.state))return savedImportRun.promise;
  const promise=(async()=>{
    try {
      while(currentSavedState(state)&&pendingSavedImports.length)await importSavedProduct(pendingSavedImports[0],state);
      if(currentSavedState(state))await refreshSavedProducts();
    } catch {
      // Leave pending entries intact so another visit/retry can finish the import.
      if(currentSavedState(state)&&$('savedDialog').classList.contains('open'))$('savedStatus').textContent='Saqlanganlarni yuklab bo‘lmadi. Qayta ochib ko‘ring.';
    }
  })();
  const operation={state,promise};savedImportRun=operation;
  try {await promise;} finally {if(savedImportRun===operation)savedImportRun=null;}
}
async function toggleSavedProduct(product) {
  if(savedBusy.has(product.url))return;
  const state=savedState();savedBusy.add(product.url);
  try {
    const previous=savedProducts.find(p=>p.url===product.url);
    if(previous) {
      const importing=pendingSavedImports.some(p=>p.url===product.url)||savedImportTasks.has(product.url);
      if(user&&importing)withdrawnSavedImports.add(product.url);
      else if(user&&!previous.guest)await api('/api/saved-products/'+previous.id,{method:'DELETE'},true);
      if(!currentSavedState(state))return;
      savedProducts=savedProducts.filter(p=>p.url!==product.url);savedSelection.delete(product.url);markSavedChange(product.url);
      if(!importing)pendingSavedImports=pendingSavedImports.filter(p=>p.url!==product.url);
      // An import runner owns cleanup for a withdrawn in-flight item.
      if(user&&importing&&!savedImportRun)void syncSavedAccount();
    } else if(user) {
      if(withdrawnSavedImports.has(product.url)) {
        const pending=savedImportTasks.get(product.url)||savedImportRun;
        if(pending)try{await pending.promise;}catch{}
        if(!currentSavedState(state))return;
        withdrawnSavedImports.delete(product.url);
      }
      const data=await api('/api/saved-products',{method:'POST',body:JSON.stringify({title:product.title,store:product.store,url:product.url})},true);
      if(!currentSavedState(state))return;
      if(data.product){pendingSavedImports=pendingSavedImports.filter(p=>p.url!==product.url);putSavedProduct(data.product,product.url);}
    } else {savedProducts.push({...product,id:crypto.randomUUID(),guest:true});markSavedChange(product.url);}
    updateSaveButtons();renderSavedProducts();
  } catch(error) {if(currentSavedState(state))alert(savedErrorMessage(error));}
  finally {if(currentSavedState(state))savedBusy.delete(product.url);}
}
async function openSavedProducts() {
  closeTopMenu();showDialog('savedDialog','closeSaved');renderSavedProducts();
  if(user){
    const state=savedState();$('savedStatus').textContent='Yuklanmoqda…';
    try {if(pendingSavedImports.length)await syncSavedAccount();else await refreshSavedProducts();}
    catch {if(currentSavedState(state))$('savedStatus').textContent='Saqlash xizmati hozir tayyor emas. Birozdan so‘ng qayta oching.';}
  }
}
function savedAction(label,action,primary=false) {
  const button=document.createElement('button');button.type='button';button.textContent=label;if(primary)button.className='primary';
  button.addEventListener('click',async()=>{
    const state=savedState();button.disabled=true;
    try{await action();}
    catch(error){if(currentSavedState(state)){if(error.product){savedProducts=savedProducts.map(p=>p.id===error.product.id?error.product:p);markSavedChange(error.product.url);renderSavedProducts();}$('savedStatus').textContent=savedErrorMessage(error);}}
    finally{if(currentSavedState(state)&&button.isConnected)button.disabled=false;}
  });
  return button;
}
async function changePriceWatch(product,enabled) {
  const state=savedState();if(!state.owner)return;
  const data=await api('/api/saved-products/'+product.id,{method:'PATCH',body:JSON.stringify({trackingEnabled:enabled})},true);
  if(!currentSavedState(state))return;
  savedProducts=savedProducts.map(p=>p.id===product.id?data.product:p);markSavedChange(product.url,data.product.url);renderSavedProducts();
}
async function checkSavedPrice(product) {
  const state=savedState();if(!state.owner)return;
  const data=await api('/api/saved-products/'+product.id+'/check',{method:'POST'},true);
  if(!currentSavedState(state))return;
  savedProducts=savedProducts.map(p=>p.id===product.id?data.product:p);markSavedChange(product.url,data.product.url);renderSavedProducts();
  $('savedStatus').textContent=data.priceDrop?'Narx pasaygani tasdiqlandi.':data.product.price!=null?'Do‘kondagi narx tekshirildi.':'Bu sahifadan aniq narx olinmadi.';
  if(data.priceDrop)await refreshSavedProducts();
}

function renderSavedProducts() {
  $('savedCount').textContent=`${savedProducts.length} ta mahsulot`;
  $('compareSaved').disabled=savedSelection.size<2;
  $('savedStatus').textContent=!user?'Mehmon saqlagan mahsulotlar shu tashrif davomida turadi. Hisobga kirsangiz, hisobingizga saqlanadi.':priceTracking.automaticEnabled?'Narx pasayishi haqidagi xabarlar shu oynada ko‘rinadi.':'Avtomatik kuzatuv hali yoqilmagan. Narxni qo‘lda tekshirishingiz mumkin.';
  $('savedList').replaceChildren();$('priceNotifications').replaceChildren();
  for(const notice of priceNotifications.filter(n=>!n.readAt)) {
    let url;try{url=new URL(notice.url);if(url.protocol!=='https:')continue;}catch{continue;}
    const item=document.createElement('div');item.className='price-notification';
    const title=document.createElement('strong');title.textContent='Narx pasaydi';
    const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=notice.title;
    item.append(title,document.createTextNode(' · '),link,document.createTextNode(`: ${priceText({price:notice.previousPrice,currency:notice.currency})} → ${priceText(notice)}`));
    const read=savedAction('O‘qildi',async()=>{await api(`/api/price-notifications/${notice.id}`,{method:'PATCH',body:JSON.stringify({read:true})},true);priceNotifications=priceNotifications.filter(n=>n.id!==notice.id);renderSavedProducts();});item.append(read);$('priceNotifications').append(item);
  }
  if(!savedProducts.length){const empty=document.createElement('p');empty.className='action-status';empty.textContent='Hali mahsulot saqlanmagan. Mahsulot kartasidagi saqlash belgisini bosing.';$('savedList').append(empty);}
  for(const product of savedProducts) {
    const item=document.createElement('article');item.className='saved-item';
    const title=document.createElement('h3');title.textContent=product.title;
    const meta=document.createElement('div');meta.className='saved-meta';meta.append(span('store',product.store),span(product.price==null?'price-unknown':'price',priceText(product)));
    if(product.trackingEnabled)meta.append(span('watching-badge',product.status==='price_unavailable'?'Joriy narx tasdiqlanmadi':priceTracking.automaticEnabled?'Narx kuzatilmoqda':'Avtomatik tekshiruv to‘xtagan'));
    if(user&&product.guest)meta.append(span('watching-badge','Hisobga hali saqlanmadi'));
    if(product.lastCheckedAt)meta.append(span('last-checked',`Tekshirildi: ${new Date(product.lastCheckedAt).toLocaleString('uz-UZ')}`));
    const actions=document.createElement('div');actions.className='saved-actions';
    const label=document.createElement('label');const box=document.createElement('input');box.type='checkbox';box.checked=savedSelection.has(product.url);box.setAttribute('aria-label',`Solishtirish: ${product.title}`);
    box.addEventListener('change',()=>{if(box.checked&&savedSelection.size>=3){box.checked=false;return;}box.checked?savedSelection.add(product.url):savedSelection.delete(product.url);$('compareSaved').disabled=savedSelection.size<2;});label.append(box,document.createTextNode(' Solishtirish'));actions.append(label);
    const link=document.createElement('a');link.href=product.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Do‘konda ko‘rish';actions.append(link);
    if(user&&product.guest)actions.append(savedAction('Hisobga saqlash',()=>syncSavedAccount(pendingSavedImports.slice())));
    else if(user){
      actions.append(savedAction('Narxni tekshirish',()=>checkSavedPrice(product)));
      if(priceTracking.automaticEnabled||product.trackingEnabled)actions.append(savedAction(product.trackingEnabled?'Kuzatuvni o‘chirish':'Narxni kuzatish',()=>changePriceWatch(product,!product.trackingEnabled)));
    }else actions.append(savedAction('Narxni kuzatish uchun kirish',()=>{hideDialog('savedDialog');openAuth();}));
    actions.append(savedAction('Olib tashlash',()=>toggleSavedProduct(product)));
    item.append(title,meta,actions);$('savedList').append(item);
  }
}
function initSavedProducts() {
  $('savedButton').addEventListener('click',openSavedProducts);$('savedTop').addEventListener('click',openSavedProducts);
  $('closeSaved').addEventListener('click',()=>hideDialog('savedDialog'));
  $('compareSaved').addEventListener('click',()=>showCompare(savedProducts.filter(p=>savedSelection.has(p.url))));
  if(user)syncSavedAccount();
}
