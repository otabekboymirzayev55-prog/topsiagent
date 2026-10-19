import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY ||= 'local-test-key';
const { normalizeImage, validImageId } = await import('../chat-features.js');

test('uploaded image is decoded, normalized and stripped to bounded WebP', async () => {
  const png = await sharp({create:{width:2400,height:1200,channels:4,background:'#ee3322'}}).png().toBuffer();
  const output = await normalizeImage(png,'image/png');
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format,'webp');
  assert.equal(metadata.width,1600);
  assert.equal(metadata.height,800);
  assert.ok(output.length < 5*1024*1024);
});

test('upload rejects mismatched MIME, invalid data and oversized files', async () => {
  const png = await sharp({create:{width:2,height:2,channels:4,background:'#ffffff'}}).png().toBuffer();
  await assert.rejects(normalizeImage(png,'image/jpeg'),error=>error.status===400);
  await assert.rejects(normalizeImage(Buffer.from('not an image'),'image/png'),error=>error.status===400);
  await assert.rejects(normalizeImage(Buffer.alloc(5*1024*1024+1),'image/png'),error=>error.status===413);
});

test('chat and image identifiers require complete UUIDs', () => {
  assert.equal(validImageId('11111111-1111-4111-8111-111111111111'),true);
  assert.equal(validImageId('../other-user/image'),false);
  assert.equal(validImageId('11111111-1111-4111-8111-11111111111'),false);
});
