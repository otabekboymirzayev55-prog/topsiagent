import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRetailUrl, directProductPage, retailerSources, searchWithGemini, temporaryReply } from '../gemini-search.js';
import { trustedRetailUrl, verifiedReply, verifyProductLinks } from '../search-agent.js';

const helpers = { trustedRetailUrl, verifiedReply, verifyProductLinks };
const json = value => ({ ok:true, json:async () => value });
const model = value => json({ candidates:[{ content:{ parts:[{ text:JSON.stringify(value) }] } }] });

test('Gemini diagnostics report status and timing without logging secrets or user content', async () => {
  const entries=[];
  const secret='private-api-key';
  const query='private shopping request';
  const request=async (_url, options) => {
    const config=JSON.parse(options.body).generationConfig;
    assert.equal(config.thinkingConfig.thinkingLevel,'MINIMAL');
    assert.equal(config.temperature,undefined);
    assert.equal(options.signal.aborted,false);
    return {ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:secret+query}})};
  };
  const result=await searchWithGemini(query,[],new Map(),null,helpers,
    {geminiKey:secret,serpKey:'private-serp',request,logger:entry=>entries.push(entry)});
  assert.equal(result.reason,'provider_unavailable');
  assert.equal(entries.length,1);
  assert.equal(entries[0].stage,'plan');
  assert.equal(entries[0].httpStatus,403);
  assert.equal(entries[0].apiStatus,'PERMISSION_DENIED');
  assert.equal(entries[0].timeoutMs,30000);
  assert.ok(entries[0].durationMs>=0);
  assert.doesNotMatch(JSON.stringify(entries),/private/);
});

test('Gemini timeout is logged once and does not trigger retailer search', async () => {
  const entries=[];
  let calls=0;
  const request=async()=>{ calls++; throw new DOMException('private network details','TimeoutError'); };
  const result=await searchWithGemini('Samsung TV kerak',[],new Map(),null,helpers,
    {geminiKey:'test',serpKey:'test',request,logger:entry=>entries.push(entry)});
  assert.equal(calls,1);
  assert.equal(result.reason,'provider_unavailable');
  assert.equal(entries[0].reason,'timeout');
  assert.doesNotMatch(JSON.stringify(entries),/private/);
});

test('Gemini can clarify without a paid retailer lookup', async () => {
  const calls=[];
  const request=async (url, options) => { calls.push({url:String(url), body:JSON.parse(options.body)}); return model({type:'clarify',reply:'Qaysi mahsulot kerak?',followUps:['Ryukzak']}); };
  const result=await searchWithGemini('menga biror narsa kerak',[],new Map(),null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(result.type,'clarify');
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.contents[0].parts.at(-1).text,'user: menga biror narsa kerak');
});

test('Gemini uses only retailer source IDs and preserves a previous image', async () => {
  const calls=[];
  const request=async (url, options={}) => {
    calls.push({url:String(url),options});
    if (String(url).includes('generativelanguage') && calls.filter(call => call.url.includes('generativelanguage')).length===1)
      return model({type:'search',searchQuery:'qizil ot egari site:uzum.uz'});
    if (String(url).includes('serpapi')) return json({organic_results:[
      {title:'Qizil ot egari',link:'https://uzum.uz/uz/product/qizil-egar',snippet:'Qizil egar'},
      {title:'Fake result',link:'https://uzum.uz.evil.example/product',snippet:'Do not trust'}
    ]});
    if (String(url).includes('generativelanguage')) return model({reply:'Mos variant topdim.',products:[
      {sourceId:1,why:'Qizil egar'}, {sourceId:99,why:'Invented'}
    ],followUps:['Boshqalarini ko‘rsat']});
    return {status:200,headers:new Headers()};
  };
  const images=new Map([['image-1',{mimeType:'image/webp',data:'YQ=='}]]);
  const result=await searchWithGemini('shu rasmdagiga o‘xshash qizilini top',
    [{role:'user',content:'Ot uchun egar',imageId:'image-1'}],images,null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(result.type,'results');
  assert.equal(result.products.length,1);
  assert.equal(result.products[0].url,'https://uzum.uz/uz/product/qizil-egar');
  assert.equal(result.products[0].price,null);
  const firstBody=JSON.parse(calls[0].options.body);
  assert.equal(firstBody.contents[0].parts[2].inlineData.data,'YQ==');
  assert.equal(calls.filter(call=>call.url.includes('serpapi')).length,1);
});

test('search sources drop untrusted URLs and uncertain snippet prices', () => {
  const sources=retailerSources({organic_results:[
    {title:'TV',link:'https://asaxiy.uz/product/tv',snippet:'12 oy 100 000 so‘m'},
    {title:'Not a shop',link:'https://example.com/product/tv'},
    {title:'Repeated',link:'https://asaxiy.uz/product/tv'}
  ]},trustedRetailUrl);
  assert.equal(sources.length,1);
  assert.equal(sources[0].price,null);
  assert.equal(canonicalRetailUrl('https://uzum.uz/uz/product/qizil-egar/reviews?srsltid=abc'),
    'https://uzum.uz/uz/product/qizil-egar');
  assert.equal(canonicalRetailUrl('https://uzum.uz/uz/category/egar'),null);
  assert.equal(directProductPage('https://www.amazon.com/new-iphone-15/s?k=new+iphone+15'),false);
  assert.equal(directProductPage('https://www.ebay.com/shop/celular-iphone-15?_nkw=celular+iphone+15'),false);
  assert.equal(directProductPage('https://www.amazon.com/dp/B0CHX1W1XY'),true);
  assert.equal(directProductPage('https://www.amazon.co.uk/dp/B0CHX1W1XY'),true);
  assert.equal(directProductPage('https://uzum.uz/uz/product/suv-otkazmaydigan-ryukzak-1286039?skuId=4103052'),true);
});

test('a specific request never repeats an unsupported stock claim', async () => {
  let modelCalls=0;
  const request=async url => {
    if (String(url).includes('serpapi')) return json({organic_results:[
      {title:'https://olcha.uz/uz/product/redmi-note-14',link:'https://olcha.uz/uz/product/redmi-note-14',snippet:'Redmi Note 14 telefon'}
    ]});
    if (String(url).includes('generativelanguage')) {
      modelCalls++;
      if (modelCalls===1) return model({type:'search',searchQuery:'Redmi Note 14 site:olcha.uz'});
      return model({reply:'Bu mahsulot sotuvda yo‘q.',products:[{sourceId:1,why:'Redmi Note 14 telefon'}]});
    }
    return {status:200,headers:new Headers()};
  };
  const result=await searchWithGemini('O‘zbekistonda Redmi Note 14 telefonini top',[],new Map(),null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(modelCalls,2);
  assert.equal(result.type,'results');
  assert.equal(result.products[0].title,'Redmi note 14');
  assert.doesNotMatch(result.reply,/sotuvda yo‘q/);
});

test('Gemini planning failure does not spend a retailer lookup or recommend products', async () => {
  let modelCalls=0;
  let searchCalls=0;
  const request=async url => {
    if (String(url).includes('generativelanguage')) { modelCalls++; return {ok:false,status:503}; }
    if (String(url).includes('serpapi')) searchCalls++;
    throw new Error('Unexpected retailer request');
  };
  const result=await searchWithGemini('Samsung 55 dyuym televizor kerak',[],new Map(),null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(modelCalls,2);
  assert.equal(searchCalls,0);
  assert.equal(result.type,'clarify');
  assert.equal(result.reason,'provider_unavailable');
  assert.deepEqual(result.products,[]);
  assert.equal(result.reply,temporaryReply('Samsung 55 dyuym televizor kerak'));
});

test('Gemini selection failure never recommends a phone or an over-budget TV', async () => {
  let modelCalls=0;
  let searchCalls=0;
  const request=async url => {
    if (String(url).includes('generativelanguage')) {
      modelCalls++;
      if (modelCalls===1) return model({type:'search',searchQuery:'Samsung 55 TV site:uzum.uz'});
      return {ok:false,status:503};
    }
    if (String(url).includes('serpapi')) {
      searchCalls++;
      return json({organic_results:[
        {title:'Samsung Galaxy A56 telefon',link:'https://uzum.uz/uz/product/samsung-galaxy-a56-123456',extracted_price:6000000,currency:'UZS'},
        {title:'Samsung 55 dyuym televizor',link:'https://uzum.uz/uz/product/samsung-55-tv-654321',extracted_price:9000000,currency:'UZS'}
      ]});
    }
    throw new Error('Unselected products must not be verified');
  };
  const result=await searchWithGemini('Samsung 55 dyuym televizor 5 million somgacha',[],new Map(),null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(modelCalls,3);
  assert.equal(searchCalls,1);
  assert.equal(result.type,'clarify');
  assert.equal(result.reason,'provider_unavailable');
  assert.deepEqual(result.products,[]);
});

test('provider outage messages follow the request language', () => {
  assert.match(temporaryReply('Samsung TV kerak'),/vaqtincha/);
  assert.match(temporaryReply('Find a Samsung TV'),/temporarily unavailable/);
  assert.match(temporaryReply('Найди телевизор'),/временно недоступен/);
});

test('SerpApi empty-results error is treated as no matches', async () => {
  let searchCalls=0;
  const request=async url => {
    if (String(url).includes('generativelanguage')) return model({type:'search',searchQuery:'rare product site:olcha.uz'});
    if (String(url).includes('serpapi')) {
      searchCalls++;
      return json({search_metadata:{status:'Success'},error:"Google hasn't returned any results for this query."});
    }
    throw new Error('Unexpected request');
  };
  const result=await searchWithGemini('rare product in Uzbekistan',[],new Map(),null,helpers,
    {geminiKey:'test-gemini',serpKey:'test-serp',request});
  assert.equal(searchCalls,2);
  assert.equal(result.type,'clarify');
});
