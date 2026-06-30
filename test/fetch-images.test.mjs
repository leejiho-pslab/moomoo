import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extFor, extractOgImage } from '../scripts/fetch-images.mjs';

test('extFor: content-type 우선', () => {
  assert.equal(extFor('https://x/a', 'image/png'), 'png');
  assert.equal(extFor('https://x/a', 'image/jpeg'), 'jpg');
  assert.equal(extFor('https://x/a', 'image/webp; charset=binary'), 'webp');
});

test('extFor: content-type 없으면 URL 확장자', () => {
  assert.equal(extFor('https://x/car.PNG'), 'png');
  assert.equal(extFor('https://x/car.jpeg?v=2'), 'jpg');
  assert.equal(extFor('https://x/car.webp'), 'webp');
});

test('extFor: 알 수 없으면 jpg 기본값', () => {
  assert.equal(extFor('https://x/image'), 'jpg');
  assert.equal(extFor('https://x/a', 'application/octet-stream'), 'jpg');
});

test('extractOgImage: og:image content 추출 + 절대경로화', () => {
  const html = '<head><meta property="og:image" content="/img/car.jpg"></head>';
  assert.equal(
    extractOgImage(html, 'https://www.hyundai.com/kr/ko/e/vehicles/avante/intro'),
    'https://www.hyundai.com/img/car.jpg',
  );
});

test('extractOgImage: 속성 순서 반대 + 절대 URL 유지', () => {
  const html = '<meta content="https://cdn.x/a.png" property="og:image" />';
  assert.equal(extractOgImage(html, 'https://www.hyundai.com/'), 'https://cdn.x/a.png');
});

test('extractOgImage: twitter:image 폴백', () => {
  const html = '<meta name="twitter:image" content="https://cdn.x/t.webp">';
  assert.equal(extractOgImage(html, 'https://www.hyundai.com/'), 'https://cdn.x/t.webp');
});

test('extractOgImage: 없으면 null', () => {
  assert.equal(extractOgImage('<html><body>no meta</body></html>', 'https://x/'), null);
});
