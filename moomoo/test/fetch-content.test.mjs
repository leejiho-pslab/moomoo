import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeYouTube,
  normalizeInstagram,
  mergeFeed,
  parseYouTubeRss,
  extractChannelId,
} from '../scripts/fetch-content.mjs';

test('normalizeYouTube: 영상 항목을 평탄한 스키마로 변환', () => {
  const json = {
    items: [
      {
        id: { videoId: 'abc123' },
        snippet: {
          title: 'R&amp;D 신차 리뷰',
          publishedAt: '2026-06-01T00:00:00Z',
          thumbnails: { high: { url: 'https://img/high.jpg' } },
        },
      },
    ],
  };
  const out = normalizeYouTube(json);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    id: 'abc123',
    title: 'R&D 신차 리뷰',
    thumbnail: 'https://img/high.jpg',
    url: 'https://www.youtube.com/watch?v=abc123',
    publishedAt: '2026-06-01T00:00:00Z',
  });
});

test('normalizeYouTube: videoId 없는 항목(채널/재생목록) 제외', () => {
  const json = { items: [{ id: { channelId: 'x' }, snippet: { title: 'no' } }] };
  assert.deepEqual(normalizeYouTube(json), []);
});

test('normalizeYouTube: 빈/누락 응답은 빈 배열', () => {
  assert.deepEqual(normalizeYouTube({}), []);
  assert.deepEqual(normalizeYouTube(null), []);
});

test('normalizeInstagram: 미디어를 평탄한 스키마로 변환', () => {
  const json = {
    data: [
      {
        id: '1',
        caption: '출고 현장',
        media_type: 'IMAGE',
        media_url: 'https://ig/1.jpg',
        permalink: 'https://instagram.com/p/1',
        timestamp: '2026-06-02T00:00:00Z',
      },
    ],
  };
  const out = normalizeInstagram(json);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '1');
  assert.equal(out[0].mediaUrl, 'https://ig/1.jpg');
  assert.equal(out[0].thumbnailUrl, 'https://ig/1.jpg');
  assert.equal(out[0].mediaType, 'IMAGE');
});

test('normalizeInstagram: 동영상은 thumbnail_url 을 썸네일로 사용', () => {
  const json = {
    data: [
      {
        id: '2',
        media_type: 'VIDEO',
        media_url: 'https://ig/2.mp4',
        thumbnail_url: 'https://ig/2-thumb.jpg',
        permalink: 'https://instagram.com/p/2',
      },
    ],
  };
  const out = normalizeInstagram(json);
  assert.equal(out[0].thumbnailUrl, 'https://ig/2-thumb.jpg');
  assert.equal(out[0].mediaUrl, 'https://ig/2.mp4');
});

test('mergeFeed: 신규 결과가 있으면 교체하고 updatedAt 갱신', () => {
  const existing = { updatedAt: 'old', youtube: [{ id: 'old' }], instagram: [] };
  const fresh = { youtube: [{ id: 'new' }], instagram: [{ id: 'ig' }] };
  const out = mergeFeed(existing, fresh, '2026-06-28T00:00:00Z');
  assert.equal(out.youtube[0].id, 'new');
  assert.equal(out.instagram[0].id, 'ig');
  assert.equal(out.updatedAt, '2026-06-28T00:00:00Z');
});

test('mergeFeed: 신규가 비면 기존 데이터·updatedAt 보존(폴백)', () => {
  const existing = { updatedAt: 'keep', youtube: [{ id: 'keep' }], instagram: [{ id: 'k2' }] };
  const fresh = { youtube: [], instagram: [] };
  const out = mergeFeed(existing, fresh, '2026-06-28T00:00:00Z');
  assert.equal(out.youtube[0].id, 'keep');
  assert.equal(out.instagram[0].id, 'k2');
  assert.equal(out.updatedAt, 'keep');
});

test('mergeFeed: 한쪽만 신규일 때 다른쪽은 기존 보존', () => {
  const existing = { updatedAt: 'old', youtube: [{ id: 'yold' }], instagram: [{ id: 'iold' }] };
  const fresh = { youtube: [{ id: 'ynew' }], instagram: [] };
  const out = mergeFeed(existing, fresh, 'now');
  assert.equal(out.youtube[0].id, 'ynew');
  assert.equal(out.instagram[0].id, 'iold');
  assert.equal(out.updatedAt, 'now');
});

test('mergeFeed: 기존이 비정상이어도 안전하게 동작', () => {
  const out = mergeFeed(null, { youtube: [], instagram: [] }, 'now');
  assert.deepEqual(out, { updatedAt: null, youtube: [], instagram: [] });
});

test('parseYouTubeRss: entry 를 정규화하고 썸네일/링크 구성', () => {
  const xml = `<feed>
    <entry>
      <yt:videoId>abc123</yt:videoId>
      <title>신차 출고 브이로그 &amp; 리뷰</title>
      <published>2026-06-01T00:00:00+00:00</published>
      <media:group><media:thumbnail url="https://i.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/></media:group>
    </entry>
    <entry>
      <yt:videoId>def456</yt:videoId>
      <title>아이오닉5 시승기</title>
      <published>2026-05-20T00:00:00+00:00</published>
    </entry>
  </feed>`;
  const out = parseYouTubeRss(xml, 6);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    id: 'abc123',
    title: '신차 출고 브이로그 & 리뷰',
    thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=abc123',
    publishedAt: '2026-06-01T00:00:00+00:00',
  });
  // 썸네일 없는 항목은 videoId 기반으로 구성
  assert.equal(out[1].thumbnail, 'https://i.ytimg.com/vi/def456/hqdefault.jpg');
});

test('parseYouTubeRss: max 개수 제한', () => {
  const xml = Array.from({ length: 10 }, (_, i) =>
    `<entry><yt:videoId>v${i}</yt:videoId><title>t${i}</title></entry>`,
  ).join('');
  assert.equal(parseYouTubeRss(xml, 3).length, 3);
});

test('parseYouTubeRss: 빈 입력은 빈 배열', () => {
  assert.deepEqual(parseYouTubeRss('', 6), []);
  assert.deepEqual(parseYouTubeRss('<feed></feed>', 6), []);
});

test('extractChannelId: channel URL 에서 직접 추출', () => {
  assert.equal(
    extractChannelId('https://www.youtube.com/channel/UCabc-123_x'),
    'UCabc-123_x',
  );
});

test('extractChannelId: HTML 본문에서 추출 (@handle 페이지)', () => {
  const html = 'var ytcfg={};...{"channelId":"UCxyz789ABC"}...';
  assert.equal(extractChannelId('https://www.youtube.com/@hyundai_moomoo', html), 'UCxyz789ABC');
});

test('extractChannelId: 없으면 null', () => {
  assert.equal(extractChannelId('https://www.youtube.com/@x', '<html></html>'), null);
});
