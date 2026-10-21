import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSavedProductsService, fetchVerifiedPrice, priceWatchCapabilities, registerSavedProductRoutes, savedProductUrl, structuredProductPrice } from '../saved-products.js';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
const url='https://uzum.uz/uz/product/ryukzak-123456';
const page=offers=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Ryukzak',url,offers})}</script>`;
const offer=(price=100000,currency='UZS')=>({'@type':'Offer',price,priceCurrency:currency});
const response=html=>new Response(html,{status:200,headers:{'content-type':'text/html'}});

class MemoryDB {
  constructor(rows=[]) { this.tables={saved_products:rows,price_notifications:[]}; this.rpcCalls=[]; }
  from(table) {
    const db=this;
    let action='select',values,filters=[],head=false,limit=Infinity;
    const query={
      select(_columns,options={}){head=!!options.head;return query;},
      eq(key,value){filters.push(row=>row[key]===value);return query;},
      is(key,value){filters.push(row=>(row[key]??null)===value);return query;},
      order(){return query;}, limit(value){limit=value;return query;},
      or(){return query;},
      update(value){action='update';values=value;return query;},
      insert(value){action='insert';values=value;return query;},
      delete(){action='delete';return query;},
      async maybeSingle(){const result=execute();return {...result,data:result.data?.[0]||null};},
      async single(){return query.maybeSingle();},
      then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
    };
    function execute(){
      const tableRows=db.tables[table];
      let found=tableRows.filter(row=>filters.every(filter=>filter(row))).slice(0,limit);
      if(action==='insert'){
        if(table==='saved_products'&&tableRows.some(row=>row.user_id===values.user_id&&row.url===values.url))return {data:null,error:{code:'23505'}};
        const row={last_price:null,baseline_price:null,currency:null,tracking_enabled:false,status:'not_checked',last_error:null,last_checked_at:null,checking_until:null,created_at:'2026-10-22T00:00:00.000Z',updated_at:'2026-10-22T00:00:00.000Z',...values};
        tableRows.push(row); found=[row];
      }
      if(action==='update')found.forEach(row=>Object.assign(row,values));
      if(action==='delete')db.tables[table]=tableRows.filter(row=>!found.includes(row));
      return {data:head?null:structuredClone(found),error:null,count:found.length};
    }
    return query;
  }
  async rpc(name,args){
    this.rpcCalls.push({name,args});
    const row=this.tables.saved_products.find(row=>row.id===args.p_id&&row.user_id===args.p_user_id&&row.checking_until===args.p_lease);
    if(!row)return {data:null,error:null};
    const dropped=row.tracking_enabled&&row.currency===args.p_currency&&row.last_price!==null&&args.p_price<row.last_price;
    if(dropped)this.tables.price_notifications.push({user_id:row.user_id,saved_product_id:row.id,price:args.p_price,previous_price:row.last_price});
    if(row.currency!==args.p_currency||row.baseline_price===null)row.baseline_price=args.p_price;
    Object.assign(row,{last_price:args.p_price,currency:args.p_currency,checking_until:null,last_checked_at:args.p_checked_at,last_error:null,status:row.tracking_enabled?'active':'paused'});
    return {data:{row:structuredClone(row),price_drop:dropped},error:null};
  }
}
function row(values={}) { return {id,user_id:owner,title:'Ryukzak',store:'uzum.uz',url,last_price:120000,baseline_price:120000,currency:'UZS',tracking_enabled:true,status:'active',last_error:null,last_checked_at:null,checking_until:null,created_at:'2026-10-22T00:00:00.000Z',...values}; }

test('price parser accepts only unambiguous structured product amounts',()=>{
  assert.deepEqual(structuredProductPrice(page(offer('99000.00')),url),{price:99000,currency:'UZS',source:'jsonld'});
  assert.equal(structuredProductPrice(page([offer(90000),offer(140000)]),url),null);
  assert.equal(structuredProductPrice(page({'@type':'AggregateOffer',lowPrice:90000,highPrice:140000,priceCurrency:'UZS'}),url),null);
  assert.equal(structuredProductPrice(page(offer('99,000')),url),null);
  assert.equal(structuredProductPrice(page(offer(99000,'not-currency')),url),null);
  assert.equal(structuredProductPrice('<p>12 oy 99000 so‘m. Eski narx 120000.</p>',url),null);
  assert.equal(structuredProductPrice(page({...offer(),availability:'https://schema.org/OutOfStock'}),url),null);
  assert.equal(structuredProductPrice(page({...offer(),priceValidUntil:'2000-01-01'}),url),null);
  assert.deepEqual(structuredProductPrice('<meta property="product:price:amount" content="100000"><meta property="product:price:currency" content="UZS">',url),{price:100000,currency:'UZS',source:'meta'});
});

test('price parser does not confuse recommendation products with the page product',()=>{
  const html=`<script type="application/ld+json">${JSON.stringify({'@graph':[
    {'@type':'Product',url,offers:offer(120000)},
    {'@type':'Product',url:'https://uzum.uz/uz/product/other-999999',offers:offer(10000)}
  ]})}</script>`;
  assert.equal(structuredProductPrice(html,url).price,120000);
  const ambiguous=html.replaceAll('"url":', '"unrelated":');
  assert.equal(structuredProductPrice(ambiguous,url),null);
  assert.equal(structuredProductPrice(page(offer()).replace(url,'https://uzum.uz/uz/product/other-999999'),url),null,'a single explicitly different product is not the main product');
});

test('variant pages require matching product or offer URL before using a price',()=>{
  const variant=`${url}?skuId=42`;
  assert.equal(structuredProductPrice(page(offer()),variant),null,'generic page price cannot establish a SKU price');
  assert.equal(structuredProductPrice(page({...offer(),url:`${url}?skuId=43`}),variant),null);
  assert.equal(structuredProductPrice(page({...offer(),url:variant}),variant).price,100000);
  const productVariant=page(offer()).replace(`"url":"${url}"`,`"url":"${variant}"`);
  assert.equal(structuredProductPrice(productVariant,variant).price,100000);
  assert.equal(structuredProductPrice('<meta property="product:price:amount" content="100000"><meta property="product:price:currency" content="UZS">',variant),null);
});

test('only retailer product URLs are fetched and unsafe redirects are refused',async()=>{
  assert.equal(savedProductUrl('http://127.0.0.1/admin'),null);
  assert.equal(savedProductUrl('https://uzum.uz.evil.example/product/a'),null);
  assert.equal(savedProductUrl('https://www.amazon.com/s?k=ryukzak'),null);
  assert.equal(savedProductUrl('https://uzum.uz:8443/uz/product/ryukzak-123456'),null);
  let calls=0;
  await assert.rejects(fetchVerifiedPrice(url,async()=>{
    calls++; return new Response('',{status:302,headers:{location:'http://127.0.0.1/admin'}});
  }),error=>error.code==='PRICE_UNAVAILABLE');
  assert.equal(calls,1);
  await assert.rejects(fetchVerifiedPrice(url,async()=>new Response('',{status:302,headers:{location:'https://uzum.uz/uz/product/replacement-999999'}})),error=>error.code==='PRICE_UNAVAILABLE');
  await assert.rejects(fetchVerifiedPrice(`${url}?skuId=42`,async()=>new Response('',{status:302,headers:{location:`${url}?skuId=43`}})),error=>error.code==='PRICE_UNAVAILABLE');
  assert.equal((await fetchVerifiedPrice(url,async()=>response(page(offer())))).price,100000);
});

test('saved product reads and mutations reject another owner before store requests',async()=>{
  const db=new MemoryDB([row()]); let storeCalls=0;
  const service=createSavedProductsService({db,request:async()=>{storeCalls++;return response(page(offer()));}});
  assert.deepEqual((await service.list(other)).products,[]);
  for(const action of [()=>service.checkPrice(other,id),()=>service.setTracking(other,id,true),()=>service.remove(other,id)])
    await assert.rejects(action(),error=>error.status===404);
  assert.equal(storeCalls,0);
  assert.equal(db.tables.saved_products.length,1);
});

test('saving a repeated canonical URL reuses the record and ignores a supplied price',async()=>{
  const db=new MemoryDB(); const service=createSavedProductsService({db});
  const first=await service.save(owner,{title:'Ryukzak',url:`${url}/reviews?srsltid=abc`,price:1,currency:'UZS'});
  const second=await service.save(owner,{title:'Same product',url});
  assert.equal(first.product.id,second.product.id);
  assert.equal(second.existing,true);
  assert.equal(db.tables.saved_products.length,1);
  assert.equal(first.product.price,null);
});

test('checks persist cooldowns and atomically apply lower same-currency verified prices',async()=>{
  const db=new MemoryDB([row()]); const now=()=>Date.parse('2026-10-22T12:00:00Z');
  const service=createSavedProductsService({db,now,request:async()=>response(page(offer(100000)))});
  const result=await service.checkPrice(owner,id);
  assert.equal(result.priceDrop,true);
  assert.equal(result.product.price,100000);
  assert.equal(db.tables.price_notifications.length,1);
  assert.equal(db.rpcCalls[0].args.p_user_id,owner);
  const afterRestart=createSavedProductsService({db,now,request:async()=>{throw new Error('must not fetch');}});
  await assert.rejects(afterRestart.checkPrice(owner,id),error=>error.status===429&&error.retryAfterSeconds===300);
});

test('unreadable prices keep the old amount and never newly enable tracking',async()=>{
  const db=new MemoryDB([row({tracking_enabled:false})]);
  const service=createSavedProductsService({db,env:{PRICE_WATCH_ENABLED:'true'},request:async()=>response('<p>Price hidden in JavaScript</p>')});
  await assert.rejects(service.setTracking(owner,id,true),error=>error.code==='PRICE_UNAVAILABLE'&&error.product.trackingEnabled===false);
  assert.equal(db.tables.saved_products[0].last_price,120000);
  assert.equal(db.tables.saved_products[0].checking_until,null);
  assert.equal(db.tables.price_notifications.length,0);
  assert.equal(db.rpcCalls.length,0);
});

test('automatic worker can be disabled and all account routes use authentication',async()=>{
  assert.equal(priceWatchCapabilities({}).automaticEnabled,true);
  assert.equal(priceWatchCapabilities({PRICE_WATCH_ENABLED:'true'}).automaticEnabled,true);
  assert.equal(priceWatchCapabilities({PRICE_WATCH_ENABLED:'false'}).automaticEnabled,false);
  assert.equal(priceWatchCapabilities({PRICE_WATCH_INTERVAL_MS:'1'}).intervalHours,6);
  const service=createSavedProductsService({db:new MemoryDB([row({tracking_enabled:false})]),env:{PRICE_WATCH_ENABLED:'false'}});
  await assert.rejects(service.setTracking(owner,id,true),error=>error.status===503&&error.code==='AUTOMATIC_TRACKING_NOT_CONFIGURED');
  const routes=[]; const app=Object.fromEntries(['get','post','patch','delete'].map(method=>[method,(path,...handlers)=>routes.push({path,handlers})]));
  const auth=()=>{};
  registerSavedProductRoutes(app,{db:new MemoryDB(),requireAuth:auth});
  assert.ok(routes.length>=8);
  for(const route of routes.filter(route=>!route.path.endsWith('/capabilities')))assert.equal(route.handlers[0],auth);
});
