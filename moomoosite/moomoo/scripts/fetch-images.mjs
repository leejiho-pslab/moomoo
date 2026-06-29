#!/usr/bin/env node
/**
 * 빌드 시 이미지 수집기.
 * src/data/image-sources.json 의 URL(현대 공식 이미지 등)을 받아 public/images/ 에
 * 자체 호스팅하고, src/data/images.json 매니페스트를 생성한다.
 *
 * 설계 원칙: URL이 비었거나 다운로드 실패 시 해당 슬롯은 null(=일러스트 폴백)로 두고
 * 항상 0 코드로 종료한다(이미지 수집이 빌드를 깨뜨리지 않도록).
 *
 * 주의: 일부 사내망/샌드박스는 외부 egress 가 막혀 다운로드가 실패할 수 있다.
 * GitHub Actions 러너는 외부 접근이 열려 있어 정상 동작한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCES = resolve(ROOT, 'src/data/image-sources.json');
const MANIFEST = resolve(ROOT, 'src/data/images.json');
// 자동 다운로드 이미지는 _fetched/ 로 분리한다(수동 업로드 이미지와 충돌 방지, gitignore 대상).
const OUT_DIR = resolve(ROOT, 'public/images/_fetched');

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

function extFor(url, contentType) {
  if (contentType && EXT_BY_TYPE[contentType.split(';')[0].trim()]) {
    return EXT_BY_TYPE[contentType.split(';')[0].trim()];
  }
  const m = url.split('?')[0].match(/\.(jpe?g|png|webp|avif|gif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

const UA = 'Mozilla/5.0 (hyundai-dealer build)';

/** 절대 URL 로 변환 */
function absolutize(u, base) {
  try {
    return new URL(u, base).href;
  } catch {
    return u;
  }
}

/** HTML 에서 대표 이미지(og:image / twitter:image) URL 추출 */
export function extractOgImage(html, pageUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return absolutize(m[1].trim(), pageUrl);
  }
  return null;
}

/** URL 에서 이미지 바이트를 가져온다. HTML 페이지면 og:image 를 따라간다. */
async function fetchImageBytes(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    const html = await res.text();
    const og = extractOgImage(html, url);
    if (!og) throw new Error('페이지에서 og:image 를 찾지 못함');
    const r2 = await fetch(og, { headers: { 'user-agent': UA, referer: url } });
    if (!r2.ok) throw new Error(`og:image HTTP ${r2.status}`);
    return { buf: Buffer.from(await r2.arrayBuffer()), url: og, contentType: r2.headers.get('content-type') };
  }
  return { buf: Buffer.from(await res.arrayBuffer()), url, contentType: ct };
}

/** 한 장 다운로드 → public/images/<name>.<ext>. 성공 시 'images/<name>.<ext>' 반환 */
async function download(name, url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  try {
    const { buf, url: finalUrl, contentType } = await fetchImageBytes(url);
    if (buf.byteLength < 1024) throw new Error('너무 작은 응답(이미지 아님?)');
    const ext = extFor(finalUrl, contentType);
    const rel = `images/_fetched/${name}.${ext}`;
    await writeFile(resolve(ROOT, 'public', rel), buf);
    console.log(`[img] ${name} ← ${finalUrl} (${(buf.byteLength / 1024).toFixed(0)}KB)`);
    return rel;
  } catch (e) {
    console.warn(`[img] ${name} 실패, 폴백 유지: ${e.message}`);
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let sources = { hero: '', profile: '', models: {} };
  try {
    sources = JSON.parse(await readFile(SOURCES, 'utf8'));
  } catch {
    console.warn('[img] image-sources.json 없음 — 빈 매니페스트 생성');
  }

  let prev = { hero: null, profile: null, models: {} };
  try {
    prev = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {}

  // 다운로드 실패 시 이전에 받아둔 파일이 있으면 보존
  const keep = (val) => (val && existsSync(resolve(ROOT, 'public', val)) ? val : null);

  const hero = (await download('hero', sources.hero)) ?? keep(prev.hero);
  const profile = (await download('profile', sources.profile)) ?? keep(prev.profile);

  const models = {};
  for (const [id, url] of Object.entries(sources.models ?? {})) {
    models[id] = (await download(`model-${id}`, url)) ?? keep(prev.models?.[id]);
  }

  const manifest = { hero, profile, models };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const count = [hero, profile, ...Object.values(models)].filter(Boolean).length;
  console.log(`[img] 매니페스트 저장 (${count}장 적용) → ${MANIFEST}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`[img] 예기치 못한 오류, 빌드는 계속: ${e.message}`);
    process.exit(0);
  });
}

export { extFor, download };
