import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchResult, searchAgent, standaloneExclusion, trustedRetailUrl, verifyProductLinks } from '../search-agent.js';

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
