import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchResult, searchAgent, standaloneExclusion } from '../search-agent.js';

test('standalone exclusions ask a follow-up without a product search', async () => {
  assert.match(standaloneExclusion('menga iPad kerak emas'), /qaysi mahsulot/);
  assert.equal(standaloneExclusion('menga iPad kerak emas, quloqchin kerak'), null);
  assert.deepEqual(await searchAgent('menga iPad kerak emas'), {
    type: 'clarify', reply: 'Tushundim. Unda qaysi mahsulot kerak?', products: []
  });
});

test('normalization removes unsafe product links and unverified price currency', () => {
  const result = normalizeSearchResult({ type: 'results', reply: 'Found', products: [
    { title: 'Phone', store: 'Store', url: 'https://example.com/phone', price: 120 },
    { title: 'Bad link', store: 'Store', url: 'javascript:alert(1)', price: 10 }
  ] });
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].price, null);
  assert.equal(result.products[0].currency, null);
});
