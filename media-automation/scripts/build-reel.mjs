#!/usr/bin/env node
// 채널별 하이라이트 릴 빌더.
// - 세그먼트(인트로/중간/끝/엔딩명함)를 채널 프로필대로 자르고(편집점 분리)
// - 장면마다 다양한 스타일의 자막을 타이밍에 맞춰 얹는다(애플풍 Pretendard + 이모지)
//
// 사용: node scripts/build-reel.mjs --channel instagram --out output/ig.mp4
//       node scripts/build-reel.mjs --channel youtube   --out output/yt.mp4

import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CLIPS = join(ROOT, 'assets', 'clips');
const TMP = join(ROOT, 'output', '_build');
mkdirSync(TMP, { recursive: true });

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const channel = arg('channel', 'youtube');
const outPath = arg('out', join(ROOT, 'output', `reel_${channel}.mp4`));

const W = 1080, H = 1920, FPS = 30;
const c1 = join(CLIPS, 'c1.mp4'), c2 = join(CLIPS, 'c2.mp4'), c3 = join(CLIPS, 'c3.mp4');
const cardPng = join(ROOT, 'output', 'scene_card.png');

// ---- 채널 프로필 (편집점 + 자막 스케줄) -------------------------------
const PROFILES = {
  // 유튜브 숏츠: 풀버전, 차분한 빌드업
  youtube: {
    segments: [
      { name: 'intro', src: c1, ss: 0, t: 18, zoom: false },
      { name: 'mid',   src: c2, ss: 56, t: 12, zoom: true },
      { name: 'end',   src: c3, ss: 0, t: 14, zoom: false },
      { name: 'card',  card: true, t: 3.5 },
    ],
    captions: [
      { seg: 'intro', at: 0.3, dur: 4, style: 'topPill', text: '6월 30일 (월) 👋' },
      { seg: 'intro', at: 5,   dur: 5, style: 'bottomBig', text: '오늘도 인사드립니다', accent: '인사' },
      { seg: 'intro', at: 11,  dur: 5, style: 'sideBar', text: '대전·세종·충청\n전국 출고 가능' },
      { seg: 'mid',   at: 0.5, dur: 5, style: 'centerPop', text: '오늘도 달립니다 🚗💨' },
      { seg: 'mid',   at: 7,   dur: 4, style: 'lowerThird', text: '안전운행 최우선 🛣️' },
      { seg: 'end',   at: 0.5, dur: 5, style: 'topPill', text: '감사합니다 🙏' },
      { seg: 'end',   at: 7,   dur: 6, style: 'bottomBig', text: '안전운행 하세요', accent: '안전' },
    ],
  },
  // 인스타 릴스: 짧고 빠르게, 훅 먼저, 자막 큼직
  instagram: {
    segments: [
      { name: 'intro', src: c1, ss: 2, t: 7, zoom: false },
      { name: 'mid',   src: c2, ss: 58, t: 7, zoom: true },
      { name: 'end',   src: c3, ss: 1, t: 9, zoom: false },
      { name: 'card',  card: true, t: 3 },
    ],
    captions: [
      { seg: 'intro', at: 0.2, dur: 3.5, style: 'bottomBig', text: '오늘도 인사드립니다 👋', accent: '인사' },
      { seg: 'intro', at: 4,   dur: 3,   style: 'topPill', text: '대전 현대·제네시스' },
      { seg: 'mid',   at: 0.3, dur: 4,   style: 'centerPop', text: '오늘도 달립니다 🚗💨' },
      { seg: 'mid',   at: 5,   dur: 2,   style: 'lowerThird', text: '🔥 출고 상담 환영' },
      { seg: 'end',   at: 0.3, dur: 4,   style: 'bottomBig', text: '견적·상담 환영 🙌', accent: '환영' },
      { seg: 'end',   at: 5,   dur: 4,   style: 'topPill', text: '📞 010-8033-3522' },
    ],
  },
};
const prof = PROFILES[channel];
if (!prof) { console.error('알 수 없는 채널:', channel); process.exit(1); }

// ---- 자막 스타일(HTML) ------------------------------------------------
const FONT = "'Pretendard','Noto Color Emoji',sans-serif";
function captionHtml(style, text, accent) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  let html = esc(text);
  if (accent) html = html.replace(accent, `<span style="color:#FFD60A">${accent}</span>`);
  const base = `*{margin:0;padding:0;box-sizing:border-box;font-family:${FONT}}
    html,body{width:${W}px;height:${H}px}
    .stage{position:relative;width:${W}px;height:${H}px}
    .pill{display:inline-block;background:rgba(18,20,28,0.42);backdrop-filter:blur(10px);border-radius:28px;
      padding:22px 38px;color:#fff;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25);
      font-weight:600;font-size:58px;letter-spacing:-1.5px;line-height:1.25}
    .big{color:#fff;font-weight:800;font-size:84px;letter-spacing:-3px;line-height:1.18;
      text-shadow:0 4px 22px rgba(0,0,0,.6);text-align:center}
    .row{position:absolute;left:0;right:0;display:flex;justify-content:center;padding:0 56px}`;
  let body = '';
  if (style === 'topPill') body = `<div class="row" style="top:130px"><div class="pill">${html}</div></div>`;
  else if (style === 'bottomBig') body = `<div class="row" style="bottom:360px"><div class="big">${html}</div></div>`;
  else if (style === 'centerPop') body = `<div class="row" style="top:0;bottom:0;align-items:center"><div class="big" style="font-size:96px">${html}</div></div>`;
  else if (style === 'lowerThird') body = `<div class="row" style="bottom:420px;justify-content:flex-start"><div class="pill" style="font-size:46px">${html}</div></div>`;
  else if (style === 'sideBar') body = `<div class="row" style="top:0;bottom:0;align-items:center;justify-content:flex-start"><div style="border-left:12px solid #FFD60A;padding-left:30px;color:#fff;font-weight:800;font-size:72px;letter-spacing:-2px;line-height:1.2;text-shadow:0 4px 22px rgba(0,0,0,.6)">${html}</div></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${base}</style></head><body><div class="stage">${body}</div></body></html>`;
}

// ---- 1) 자막 PNG 렌더 -------------------------------------------------
const browser = await chromium.launch({ executablePath: CHROME });
let ci = 0;
for (const cap of prof.captions) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(captionHtml(cap.style, cap.text, cap.accent), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(80);
  cap.png = join(TMP, `cap_${ci++}.png`);
  await page.screenshot({ path: cap.png, omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`자막 ${prof.captions.length}개 렌더 완료`);

// ---- 2) 세그먼트 빌드 + 절대 타임라인 계산 ----------------------------
const CROP = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
const ZP = `zoompan=z='min(zoom+0.0006,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;
const A = ['-c:a', 'aac', '-ar', '48000', '-ac', '2'];
const segStart = {}; let clock = 0; const segFiles = [];
for (let i = 0; i < prof.segments.length; i++) {
  const s = prof.segments[i]; segStart[s.name || `card${i}`] = clock; clock += s.t;
  const out = join(TMP, `seg${i}.mp4`);
  if (s.card) {
    execFileSync('ffmpeg', ['-y', '-loop', '1', '-t', String(s.t), '-i', cardPng,
      '-f', 'lavfi', '-t', String(s.t), '-i', 'anullsrc=r=48000:cl=stereo',
      '-filter_complex', `[0:v]scale=${W}:${H},zoompan=z='min(zoom+0.0004,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]`,
      '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', ...A, out], { stdio: 'ignore' });
  } else {
    const vf = s.zoom ? `[0:v]${CROP},${ZP},setsar=1,format=yuv420p[v]` : `[0:v]${CROP},fps=${FPS},setsar=1,format=yuv420p[v]`;
    execFileSync('ffmpeg', ['-y', '-ss', String(s.ss), '-t', String(s.t), '-i', s.src,
      '-filter_complex', vf, '-map', '[v]', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', ...A, out], { stdio: 'ignore' });
  }
  segFiles.push(out);
}
// concat
const listFile = join(TMP, 'list.txt');
writeFileSync(listFile, segFiles.map((f) => `file '${f}'`).join('\n'));
const baseFile = join(TMP, 'base.mp4');
execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', baseFile], { stdio: 'ignore' });
console.log('세그먼트 결합 완료, 길이', clock.toFixed(1), '초');

// ---- 3) 자막 오버레이 (타이밍대로) ------------------------------------
const inputs = ['-i', baseFile];
const caps = prof.captions.map((cap) => {
  const t0 = (segStart[cap.seg] ?? 0) + cap.at; const t1 = t0 + cap.dur;
  inputs.push('-loop', '1', '-i', cap.png);
  return { t0, t1 };
});
let cur = '0:v'; const fc = [];
caps.forEach((c, i) => {
  const inIdx = i + 1; const lbl = `v${i + 1}`;
  fc.push(`[${cur}][${inIdx}:v]overlay=0:0:enable='between(t,${c.t0.toFixed(2)},${c.t1.toFixed(2)})'[${lbl}]`);
  cur = lbl;
});
mkdirSync(dirname(outPath), { recursive: true });
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', fc.join(';'),
  '-map', `[${cur}]`, '-map', '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
  '-pix_fmt', 'yuv420p', ...A, '-movflags', '+faststart', '-shortest', outPath], { stdio: 'ignore' });

rmSync(TMP, { recursive: true, force: true });
console.log(`✅ ${channel} 완성 → ${outPath}`);
