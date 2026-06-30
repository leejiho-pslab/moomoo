#!/usr/bin/env node
/**
 * 빌드 시 SNS 콘텐츠 수집기.
 * YouTube Data API + Instagram Graph API → src/data/feed.json
 *
 * 설계 원칙: 키가 없거나 API가 실패해도 마지막 정상 feed.json 을 보존하고
 * 항상 0 코드로 종료한다(빌드가 콘텐츠 수집 때문에 깨지지 않도록).
 *
 * 순수 변환/병합 함수는 export 하여 단위 테스트한다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEED_PATH = resolve(__dirname, '../src/data/feed.json');

/** YouTube search.list 응답 → 정규화된 영상 배열 */
export function normalizeYouTube(json) {
  const items = json?.items ?? [];
  return items
    .map((it) => {
      const id = it?.id?.videoId;
      const s = it?.snippet ?? {};
      if (!id) return null;
      const thumb =
        s.thumbnails?.maxres?.url ||
        s.thumbnails?.high?.url ||
        s.thumbnails?.medium?.url ||
        s.thumbnails?.default?.url ||
        '';
      return {
        id,
        title: decodeEntities(s.title ?? ''),
        thumbnail: thumb,
        url: `https://www.youtube.com/watch?v=${id}`,
        publishedAt: s.publishedAt ?? null,
      };
    })
    .filter(Boolean);
}

/** YouTube 채널 RSS(XML) → 정규화된 영상 배열 (API 키 불필요) */
export function parseYouTubeRss(xml, max = 6) {
  const entries = String(xml).split('<entry>').slice(1);
  const out = [];
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    const thumb =
      (e.match(/<media:thumbnail[^>]*\burl="([^"]+)"/) || [])[1] ||
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    out.push({
      id,
      title,
      thumbnail: thumb,
      url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt: published,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** 채널 URL(@handle 등)에서 channelId(UC...)를 추출한다 */
export function extractChannelId(input, html = '') {
  const fromUrl = String(input || '').match(/channel\/(UC[\w-]+)/);
  if (fromUrl) return fromUrl[1];
  const m =
    html.match(/"channelId":"(UC[\w-]+)"/) ||
    html.match(/channel\/(UC[\w-]+)/) ||
    html.match(/"externalId":"(UC[\w-]+)"/);
  return m ? m[1] : null;
}

/** Instagram Graph API /media 응답 → 정규화된 게시물 배열 */
export function normalizeInstagram(json) {
  const data = json?.data ?? [];
  return data
    .map((m) => {
      if (!m?.id) return null;
      return {
        id: m.id,
        caption: (m.caption ?? '').slice(0, 220),
        mediaUrl: m.media_url ?? m.thumbnail_url ?? '',
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? '',
        permalink: m.permalink ?? '',
        mediaType: m.media_type ?? 'IMAGE',
        timestamp: m.timestamp ?? null,
      };
    })
    .filter(Boolean);
}

/**
 * 신규 결과를 기존 피드에 병합한다.
 * 신규가 비어있으면(수집 실패/키 부재) 기존 값을 보존한다.
 */
export function mergeFeed(existing, fresh, now) {
  const safe = existing && typeof existing === 'object' ? existing : {};
  const youtube = fresh.youtube && fresh.youtube.length ? fresh.youtube : safe.youtube ?? [];
  const instagram =
    fresh.instagram && fresh.instagram.length ? fresh.instagram : safe.instagram ?? [];
  const changed =
    (fresh.youtube && fresh.youtube.length) || (fresh.instagram && fresh.instagram.length);
  return {
    updatedAt: changed ? now : safe.updatedAt ?? null,
    youtube,
    instagram,
  };
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const UA = 'Mozilla/5.0 (compatible; hyundai-dealer build)';

/** @handle 등 채널 URL → channelId 해석 (RSS 용) */
async function resolveChannelId(channelUrl) {
  const fromUrl = extractChannelId(channelUrl);
  if (fromUrl) return fromUrl;
  if (!channelUrl) return null;
  const res = await fetch(channelUrl, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR' } });
  if (!res.ok) throw new Error(`채널 페이지 ${res.status}`);
  return extractChannelId(channelUrl, await res.text());
}

async function fetchYouTube() {
  const key = process.env.YT_API_KEY;
  let channelId = process.env.YT_CHANNEL_ID;
  const channelUrl = process.env.YT_CHANNEL_URL || 'https://www.youtube.com/@hyundai_moomoo';
  const max = Number(process.env.YT_MAX_RESULTS || '6');

  // 1) API 키 + 채널ID 가 있으면 YouTube Data API
  if (key && channelId) {
    const url =
      `https://www.googleapis.com/youtube/v3/search?key=${key}` +
      `&channelId=${channelId}&part=snippet&order=date&type=video&maxResults=${max}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    return normalizeYouTube(await res.json());
  }

  // 2) 키가 없으면 공개 RSS 로 수집 (채널ID 는 핸들에서 자동 해석)
  if (!channelId) channelId = await resolveChannelId(channelUrl);
  if (!channelId) {
    console.warn('[youtube] 채널ID 해석 실패 — 건너뜀');
    return [];
  }
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(rssUrl, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`YouTube RSS ${res.status}`);
  return parseYouTubeRss(await res.text(), max);
}

async function fetchInstagram() {
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  const max = process.env.IG_MAX_RESULTS || '8';
  if (!token) {
    console.warn('[instagram] IG_ACCESS_TOKEN 미설정 — 건너뜀');
    return [];
  }
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const base = userId
    ? `https://graph.facebook.com/v19.0/${userId}/media`
    : 'https://graph.instagram.com/me/media';
  const url = `${base}?fields=${fields}&limit=${max}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram API ${res.status}`);
  const json = await res.json();
  return normalizeInstagram(json);
}

async function main() {
  let existing = { updatedAt: null, youtube: [], instagram: [] };
  try {
    existing = JSON.parse(await readFile(FEED_PATH, 'utf8'));
  } catch {
    console.warn('[feed] 기존 feed.json 없음 — 새로 생성');
  }

  let youtube = [];
  let instagram = [];
  try {
    youtube = await fetchYouTube();
    console.log(`[youtube] ${youtube.length}건 수집`);
  } catch (e) {
    console.warn(`[youtube] 수집 실패, 기존 데이터 유지: ${e.message}`);
  }
  try {
    instagram = await fetchInstagram();
    console.log(`[instagram] ${instagram.length}건 수집`);
  } catch (e) {
    console.warn(`[instagram] 수집 실패, 기존 데이터 유지: ${e.message}`);
  }

  const now = new Date().toISOString();
  const merged = mergeFeed(existing, { youtube, instagram }, now);
  await writeFile(FEED_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`[feed] 저장 완료 → ${FEED_PATH}`);
}

// 직접 실행될 때만 main() 수행 (테스트 import 시에는 실행 안 함)
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    // 콘텐츠 수집 실패가 빌드를 깨뜨리지 않도록 항상 0 종료
    console.error(`[feed] 예기치 못한 오류, 빌드는 계속: ${e.message}`);
    process.exit(0);
  });
}
