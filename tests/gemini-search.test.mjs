import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRetailUrl, retailerSources, searchWithGemini } from '../gemini-search.js';
import { trustedRetailUrl, verifiedReply, verifyProductLinks } from '../search-agent.js';

const helpers = { trustedRetailUrl, verifiedReply, verifyProductLinks };
const json = value => ({ ok:true, json:async () => value });
const model = value => json({ candidates:[{ content:{ parts:[{ text:JSON.stringify(value) }] } }] });

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
