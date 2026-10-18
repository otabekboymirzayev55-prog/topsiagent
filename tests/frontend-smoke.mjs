import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('frontend/index.html')).href;

test('search, follow-up context, comparison, and mobile layout', async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.TOPAGENT_BROWSER_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const requests = [];
    await page.route('https://topsiagent.onrender.com/api/search', async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      const response = requests.length === 1
        ? { type: 'results', reply: 'Ikki mos variant topdim.', products: [
            { title: 'Sony WH-CH720N', price: 120, currency: 'USD', store: 'Sony', why: 'Budjetga mos.', url: 'https://example.com/sony' },
            { title: 'Anker Soundcore Q45', price: 100, currency: 'USD', store: 'Anker', why: 'Arzonroq variant.', url: 'https://example.com/anker' }
          ] }
        : { type: 'clarify', reply: 'Qaysi rangni xohlaysiz?', products: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.goto(url);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.locator('#input').fill('200 dollargacha quloqchin');
    await page.locator('#send').click();
    await page.locator('.card').first().waitFor();
    assert.equal(await page.locator('.card').count(), 2);
    assert.equal(await page.locator('#empty').isVisible(), false);
    await page.locator('.compare-pick input').nth(0).check();
    await page.locator('.compare-pick input').nth(1).check();
    await page.locator('#compareAction').click();
    assert.equal(await page.locator('#compareDialog').isVisible(), true);
    assert.match(await page.locator('#compareTable').innerText(), /Sony WH-CH720N/);
    await page.locator('#closeDialog').click();
    await page.locator('#input').fill('Arzonrog‘i bormi?');
    await page.locator('#send').click();
    await page.getByText('Qaysi rangni xohlaysiz?').waitFor();
    assert.equal(requests[1].history[0].content, '200 dollargacha quloqchin');
    assert.equal(await page.locator('.card').count(), 0);
    await page.locator('#language').selectOption('en');
    assert.equal(await page.locator('#resultsHeading').innerText(), 'Results');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
  } finally { await browser.close(); }
});
