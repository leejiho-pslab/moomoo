#!/usr/bin/env node
// 원본 세로 영상 → '고정 폼' 편집본(인스타용/유튜브용)으로 변환.
// 1) 상단 인사 자막(둥근 박스 + 흰 굵은 글씨)을 투명 PNG로 렌더(Chromium)
// 2) ffmpeg 로 영상을 9:16(1080×1920)로 맞추고 자막 + (옵션)명함을 합성
//
// 사용:
//   node scripts/process-video.mjs --in 원본.mp4 --caption "6월27일(토요일)|주말에 근무 후에|인사드립니다"
//   node scripts/process-video.mjs --in raw.mp4 --caption "비가 와도|인사 드립니다" --platform instagram
//
// --platform 생략 시 instagram + youtube 둘 다 출력. (현재 둘 다 9:16, 파일만 분리)

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const style = JSON.parse(readFileSync(join(ROOT, 'config', 'video-style.json'), 'utf8'));
const inPath = arg('in');
if (!inPath) { console.error('❌ --in <원본영상> 이 필요합니다.'); process.exit(1); }
const captionRaw = arg('caption', '');
const lines = captionRaw ? String(captionRaw).split('|').map((s) => s.trim()).filter(Boolean) : [];
const platforms = arg('platform') ? [arg('platform')] : Object.keys(style.outputs);

const outDir = join(ROOT, 'output');
mkdirSync(outDir, { recursive: true });
const base = basename(inPath, extname(inPath));

// ---- 1) 자막 오버레이 PNG 렌더 ----------------------------------------
const captionPng = join(outDir, `_caption_${base}.png`);
if (lines.length) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({
    viewport: { width: style.width, height: style.height },
    deviceScaleFactor: 1,
  });
  await page.addInitScript((payload) => { window.__CAP__ = payload; }, { ...style, lines });
  await page.goto(pathToFileURL(join(ROOT, 'templates', 'caption.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY__ === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  await page.screenshot({ path: captionPng, omitBackground: true });
  await browser.close();
  console.log(`✅ 자막 오버레이 렌더 → ${captionPng}`);
}

// ---- 2) ffmpeg 합성 ---------------------------------------------------
const W = style.width, H = style.height;
const card = style.contactCard;
const cardPath = card?.enabled ? resolve(ROOT, card.asset) : null;
const hasCard = cardPath && existsSync(cardPath);

for (const platform of platforms) {
  const out = join(outDir, `${base}_${platform}.mp4`);

  // 입력: [0]=영상, [1]=자막(있으면), [2]=명함(있으면)
  const inputs = ['-i', resolve(inPath)];
  if (lines.length) inputs.push('-i', captionPng);
  if (hasCard) inputs.push('-loop', '1', '-i', cardPath);

  const capIdx = lines.length ? 1 : null;
  const cardIdx = hasCard ? (lines.length ? 2 : 1) : null;

  // 9:16 채우기(중앙 크롭)
  const filters = [`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[v0]`];
  let last = 'v0';
  if (capIdx !== null) {
    filters.push(`[${last}][${capIdx}:v]overlay=0:0[v1]`);
    last = 'v1';
  }
  if (cardIdx !== null) {
    const cw = Math.round(W * card.widthPct / 100);
    const x = Math.round((W - cw) / 2);
    const y = `H-h-${Math.round(H * card.bottomPct / 100)}`;
    // 명함: 너비 맞춤 → 끝 N초 페이드인 → 하단 중앙 오버레이
    filters.push(`[${cardIdx}:v]scale=${cw}:-1[card]`);
    // shortest=1: 무한 반복되는 명함 입력이 영상 길이를 늘리지 않도록 원본 길이에 맞춤
    filters.push(`[${last}][card]overlay=${x}:${y}:shortest=1[vout]`);
    last = 'vout';
  }

  const fc = filters.join(';');

  const args = [
    '-y', ...inputs,
    '-filter_complex', fc,
    '-map', `[${last}]`,
    '-map', '0:a?',
    '-r', String(style.fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    '-shortest',
    out,
  ];
  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`✅ ${platform.padEnd(9)} → ${out}`);
  } catch (e) {
    console.error(`❌ ${platform} 합성 실패:\n`, e.stderr?.toString().split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
}
