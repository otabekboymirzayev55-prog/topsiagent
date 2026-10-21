import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../frontend/saved-products.js',import.meta.url),'utf8');
const product=(id,title)=>({id,title,store:'Uzum',url:`https://uzum.uz/uz/product/${id}`,price:null,currency:null});
function deferred() {
  let resolve,reject;
  const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});
  return {promise,resolve,reject};
}
function harness(api) {
  const nodes=new Map();
  const context=vm.createContext({
    api,user:{id:'account-a'},AbortSignal,URL,crypto:globalThis.crypto,
    document:{querySelectorAll:()=>[]},
    safeProducts:items=>items.filter(item=>item&&typeof item.url==='string'),
    $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{contains:()=>false}});return nodes.get(id);},
    alert:()=>{}
  });
  vm.runInContext(`${source}\nrenderSavedProducts = () => {};`,context);
  return {
    context,
    seed(items){context.seedItems=items;vm.runInContext('savedProducts=seedItems;',context);},
    state(){return JSON.parse(vm.runInContext('JSON.stringify({savedProducts,pendingSavedImports})',context));}
  };
}

test('an older account GET cannot overwrite a newly saved product',async()=>{
  const oldGet=deferred();
  const baseline=product('baseline','Old saved product'),added=product('new','Newly saved product');
  const ui=harness(async(path,options={})=>{
    if(path==='/api/saved-products'&&!options.method)return oldGet.promise;
    if(path==='/api/price-notifications')return {notifications:[]};
    if(path==='/api/saved-products'&&options.method==='POST')return {product:added};
    throw new Error(`Unexpected API request: ${options.method||'GET'} ${path}`);
  });
  const refresh=ui.context.refreshSavedProducts();
  await ui.context.toggleSavedProduct(added);
  oldGet.resolve({products:[baseline]});
  await refresh;
  assert.deepEqual(ui.state().savedProducts.map(item=>item.id).sort(),['baseline','new']);
});

test('an older account GET cannot resurrect a removed saved product',async()=>{
  const oldGet=deferred();
  const removed=product('removed','Removed product'),baseline=product('baseline','Keep product');
  const deleted=[];
  const ui=harness(async(path,options={})=>{
    if(path==='/api/saved-products'&&!options.method)return oldGet.promise;
    if(path==='/api/price-notifications')return {notifications:[]};
    if(path==='/api/saved-products/removed'&&options.method==='DELETE'){deleted.push(path);return {ok:true};}
    throw new Error(`Unexpected API request: ${options.method||'GET'} ${path}`);
  });
  ui.seed([removed]);
  const refresh=ui.context.refreshSavedProducts();
  await ui.context.toggleSavedProduct(removed);
  oldGet.resolve({products:[removed,baseline]});
  await refresh;
  assert.equal(deleted.length,1);
  assert.deepEqual(ui.state().savedProducts.map(item=>item.id),['baseline']);
});

test('removing a guest import while its POST is pending also deletes the eventual server save',async()=>{
  const post=deferred(),guest={...product('guest-a','Guest product'),guest:true};
  const serverProduct={...guest,id:'server-a',guest:undefined};
  const server=new Map(),deleted=[];
  const ui=harness(async(path,options={})=>{
    if(path==='/api/saved-products'&&options.method==='POST')return post.promise.then(data=>{server.set(data.product.id,data.product);return data;});
    if(path==='/api/saved-products/server-a'&&options.method==='DELETE'){deleted.push(path);server.delete('server-a');return {ok:true};}
    if(path==='/api/saved-products'&&!options.method)return {products:[...server.values()]};
    if(path==='/api/price-notifications')return {notifications:[]};
    throw new Error(`Unexpected API request: ${options.method||'GET'} ${path}`);
  });
  const sync=ui.context.syncSavedAccount([guest]);
  await ui.context.toggleSavedProduct(guest);
  post.resolve({product:serverProduct});
  await sync;
  assert.deepEqual(deleted,['/api/saved-products/server-a']);
  assert.deepEqual(ui.state(),{savedProducts:[],pendingSavedImports:[]});
  assert.equal(server.size,0);
});

test('failed guest import remains visible and pending so the user can retry it',async()=>{
  const guest={...product('guest-a','Guest product'),guest:true},serverProduct={...product('server-a','Guest product'),url:guest.url};
  let posts=0;
  const ui=harness(async(path,options={})=>{
    if(path==='/api/saved-products'&&options.method==='POST'){
      posts++;if(posts===1)throw new Error('Temporary save failure');return {product:serverProduct};
    }
    if(path==='/api/saved-products'&&!options.method)return {products:[serverProduct]};
    if(path==='/api/price-notifications')return {notifications:[]};
    throw new Error(`Unexpected API request: ${options.method||'GET'} ${path}`);
  });
  await ui.context.syncSavedAccount([guest]);
  assert.deepEqual(ui.state().pendingSavedImports.map(item=>item.url),[guest.url]);
  assert.deepEqual(ui.state().savedProducts.map(item=>item.url),[guest.url]);
  assert.equal(ui.state().savedProducts[0].guest,true);
  await ui.context.syncSavedAccount(ui.state().pendingSavedImports);
  assert.equal(posts,2);
  assert.deepEqual(ui.state().pendingSavedImports,[]);
  assert.deepEqual(ui.state().savedProducts.map(item=>item.id),['server-a']);
});
