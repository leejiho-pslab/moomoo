#!/usr/bin/env node
// 사진 1장 + 문구(JSON) → 유튜브/인스타 썸네일 PNG 를 '고정 틀'로 찍어낸다.
//
// 사용:
//   node scripts/make-thumbnail.mjs --bg <사진> --content output/today-content.json
//   node scripts/make-thumbnail.mjs --bg frame.jpg --platform instagram --out out.png
//
// --platform 생략 시 youtube + instagram 둘 다 생성.

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const CHROME =
  process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const style = JSON.parse(
  readFileSync(join(ROOT, 'config', 'thumbnail-style.json'), 'utf8'),
);
const templateUrl = pathToFileURL(join(ROOT, 'templates', 'thumb.html')).href;

const bgPath = arg('bg');
if (!bgPath) {
  console.error('❌ --bg <배경 사진 경로> 가 필요합니다.');
  process.exit(1);
}
const contentPath = arg('content', join(ROOT, 'output', 'today-content.json'));
const content = JSON.parse(readFileSync(resolve(contentPath), 'utf8'));

const platforms = arg('platform')
  ? [arg('platform')]
  : ['youtube', 'instagram'];

function bgDataUrl(file) {
  const buf = readFileSync(resolve(file));
  const ext = extname(file).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const outDir = join(ROOT, 'output');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
try {
  const dataUrl = bgDataUrl(bgPath);
  const stamp = content.date || 'thumb';
  const base = basename(bgPath, extname(bgPath));

  for (const platform of platforms) {
    const spec = style.platforms[platform];
    if (!spec) { console.error(`⚠️  알 수 없는 플랫폼: ${platform}`); continue; }

    const page = await browser.newPage({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
    });
    await page.addInitScript(
      (payload) => { window.__DATA__ = payload; },
      { ...content, platform, platformSpec: spec, style, bgDataUrl: dataUrl },
    );
    await page.goto(templateUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__READY__ === true);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);

    const outPath = join(outDir, `${stamp}_${platform}_${base}.png`);
    const el = await page.$('#stage');
    await el.screenshot({ path: outPath });
    await page.close();
    console.log(`✅ ${platform.padEnd(9)} → ${outPath}  (${spec.width}×${spec.height})`);
  }
} finally {
  await browser.close();
}
