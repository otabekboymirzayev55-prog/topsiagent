import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandNoPreference, normalizeSearchResult, resolveProductFollowUp, searchAgent, standaloneExclusion, trustedRetailUrl, verifiedReply, verifyProductLinks } from '../search-agent.js';

test('verified-link fallback uses Uzbek by default and follows clear language cues', () => {
  assert.match(verifiedReply('manga uzbekiston bozoridan sumka qidir', true), /Do‘kon havolalari/);
  assert.match(verifiedReply('Nike sneakers', false), /Hozir mahsulot/);
  assert.match(verifiedReply('Find a backpack under 50 dollars', true), /I found matching/);
  assert.match(verifiedReply('Найди рюкзак', true), /Нашёл/);
});

test('no preference continues the original shopping request', () => {
  const history = [{ role:'user', content:'menga O‘zbekiston bozoridan sumka qidir' }, { role:'assistant', content:'Qaysi turdagi sumka kerak?' }];
  assert.match(expandNoPreference("farqi yo'q", history), /sumka qidir/);
  assert.match(expandNoPreference("farqi yo'q", history), /Qo‘shimcha savol bermang/);
  assert.equal(expandNoPreference("farqi yo'q", []), "farqi yo'q");
  assert.equal(expandNoPreference('maktab uchun', history), 'maktab uchun');
});

test('a follow-up keeps the shown products and opens the selected store option', async () => {
  const history = [
    { role: 'user', content: 'Maktab uchun ryukzak qidir' },
    { role: 'assistant', content: 'Ikki variant topdim.', products: [
      { title: 'Sport ryukzak', store: 'Uzum Market', price: 99000, currency: 'UZS', url: 'https://uzum.uz/uz/product/sport-ryukzak' },
      { title: 'Kundalik ryukzak', store: 'Uzum Market', price: 250000, currency: 'UZS', url: 'https://uzum.uz/uz/product/kundalik-ryukzak' }
    ] },
    { role: 'user', content: 'shu yoqdi' },
    { role: 'assistant', content: 'Qaysi variant?' }
  ];
  assert.equal(resolveProductFollowUp('shu yoqdi', history).type, 'clarify');
  const result = await searchAgent('birinchisi, shuni sotib ol', history);
  assert.equal(result.type, 'results');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].title, 'Sport ryukzak');
  assert.match(result.reply, /Xarid variantlari/);
  assert.match(result.reply, /avtomatik xarid hozircha tayyor emas/);
  const detail=resolveProductFollowUp('birinchi variant haqida ko‘proq ayt, havolasini ko‘rsat',history);
  assert.equal(detail.products[0].title,'Sport ryukzak');
  assert.match(detail.reply,/Sport ryukzak/);
  assert.match(detail.reply,/havolasi quyidagi kartada/);
  assert.doesNotMatch(detail.reply,/avtomatik xarid/);
});

test('unverified prices never claim to meet a stated budget',()=>{
  const reply=verifiedReply('maktab ryukzagi 300 000 so‘mgacha',true,[{price:null}]);
  assert.match(reply,/narxlar tasdiqlanmadi/i);
  assert.match(reply,/Budjetingizga mosligini/);
});

test('standalone exclusions ask a follow-up without a product search', async () => {
  assert.match(standaloneExclusion('menga iPad kerak emas'), /qaysi mahsulot/);
  assert.equal(standaloneExclusion('menga iPad kerak emas, quloqchin kerak'), null);
  assert.deepEqual(await searchAgent('menga iPad kerak emas'), {
    type: 'clarify', reply: 'Tushundim. Unda qaysi mahsulot kerak?', products: []
  });
});

test('drops broken product pages and rejects untrusted hosts', async () => {
  assert.equal(trustedRetailUrl('https://olcha.uz/oz/product/view/phone'), true);
  assert.equal(trustedRetailUrl('https://olcha.uz.evil.example/phone'), false);
  const products = [
    { url: 'https://olcha.uz/oz/product/view/phone' },
    { url: 'https://market.beeline.uz/missing' }
  ];
  const fetchStub = async url => ({ status: url.includes('missing') ? 404 : 200, headers: new Headers() });
  assert.deepEqual(await verifyProductLinks(products, fetchStub), [products[0]]);
});

test('normalization removes unsafe product links and unverified price currency', () => {
  const result = normalizeSearchResult({ type: 'results', reply: 'Found', products: [
    { title: 'Phone', store: 'Store', url: 'https://example.com/phone', price: 120 },
    { title: 'Bad link', store: 'Store', url: 'javascript:alert(1)', price: 10 }
  ] });
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].price, null);
  assert.equal(result.products[0].currency, null);
  assert.equal(normalizeSearchResult('Here are options: {"type":"clarify","reply":"Tell me more","products":[]}').reply, 'Tell me more');
});
