#!/usr/bin/env node
// 채널별 하이라이트 릴 빌더.
// - 세그먼트(인트로/중간/끝/엔딩명함)를 채널 프로필대로 자르고(편집점 분리)
// - 장면마다 다양한 스타일의 자막을 타이밍에 맞춰 얹는다(애플풍 Pretendard + 이모지)
//
// 사용: node scripts/build-reel.mjs --channel instagram --out output/ig.mp4
//       node scripts/build-reel.mjs --channel youtube   --out output/yt.mp4

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME_ENV = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = existsSync(CHROME_ENV) ? CHROME_ENV : undefined;
const CLIPS = join(ROOT, 'assets', 'clips');
const TMP = join(ROOT, 'output', '_build');
mkdirSync(TMP, { recursive: true });

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const channel = arg('channel', 'youtube');
const outPath = arg('out', join(ROOT, 'output', `reel_${channel}.mp4`));

const W = 1080, H = 1920, FPS = 30;
const c1 = join(CLIPS, 'c1.mp4'), c2 = join(CLIPS, 'c2.mp4'), c3 = join(CLIPS, 'c3.mp4');
const cardPng = join(ROOT, 'output', 'scene_card.png');
const logosPath = join(ROOT, 'assets', 'brand', 'logos.png');
const logosB64 = existsSync(logosPath) ? readFileSync(logosPath).toString('base64') : null;

// ---- 채널 프로필 (편집점 + 자막 스케줄) -------------------------------
const PROFILES = {
  // 유튜브 숏츠: 고정 프레임(상단 제목 띠 + 가운데 영상 + 하단 명함) · 디자인 안 잘림
  youtube: {
    framed: true,
    frame: { date: '', title: '오늘도 기분좋게<br><span class="hl">인사</span>드립니다 😊' },
    segments: [
      { name: 'intro', src: c1, ss: 0, t: 16, zoom: false },
      { name: 'mid',   src: c2, ss: 56, t: 12, zoom: false },
      { name: 'end',   src: c3, ss: 0, t: 14, zoom: false },
      { name: 'card',  card: true, t: 3.5 },
    ],
    captions: [
      { seg: 'intro', at: 1,   dur: 6, style: 'sub', text: '대전·세종·충청 · 전국 출고 가능합니다' },
      { seg: 'mid',   at: 0.5, dur: 6, style: 'sub', text: '오늘도 안전운행 하겠습니다 🚗' },
      { seg: 'end',   at: 0.5, dur: 7, style: 'sub', text: '견적·시승·출고 상담 환영합니다 🙌' },
    ],
  },
  // 인스타 릴스: 고정 프레임 동일 적용(짧고 빠르게)
  instagram: {
    framed: true,
    frame: { date: '', title: '오늘도 기분좋게<br><span class="hl">인사</span>드립니다 😊' },
    segments: [
      { name: 'intro', src: c1, ss: 2, t: 7, zoom: false },
      { name: 'mid',   src: c2, ss: 58, t: 7, zoom: false },
      { name: 'end',   src: c3, ss: 1, t: 9, zoom: false },
      { name: 'card',  card: true, t: 3 },
    ],
    captions: [
      { seg: 'intro', at: 0.5, dur: 4, style: 'sub', text: '대전·세종·충청 · 전국 출고 가능' },
      { seg: 'mid',   at: 0.3, dur: 4, style: 'sub', text: '오늘도 안전운행 하겠습니다 🚗' },
      { seg: 'end',   at: 0.3, dur: 5, style: 'sub', text: '견적·시승·출고 상담 환영합니다 🙌' },
    ],
  },
};
const prof = PROFILES[channel];
if (!prof) { console.error('알 수 없는 채널:', channel); process.exit(1); }

// ---- 자막 스타일(HTML) ------------------------------------------------
const FONT = "'Pretendard','Noto Color Emoji',sans-serif";
function captionHtml(style, text, accent, pos) {
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
    .row{position:absolute;left:0;right:0;display:flex;justify-content:center;padding:0 56px}
    .badge{position:absolute;top:96px;left:84px;background:#14246B;color:#fff;font-weight:700;
      font-size:40px;border-radius:999px;padding:14px 28px;letter-spacing:-1px}
    .eyebrow{font-weight:600;font-size:44px;color:#fff;opacity:.95;margin-bottom:14px;letter-spacing:-1px;text-shadow:0 3px 14px rgba(0,0,0,.6)}
    .headline{font-weight:800;font-size:108px;color:#fff;letter-spacing:-3px;line-height:1.14;text-shadow:0 4px 22px rgba(0,0,0,.6)}
    .sub{display:inline-block;color:#fff;font-weight:800;font-size:58px;letter-spacing:-1.5px;line-height:1.3;text-align:center;
      background:rgba(8,12,22,.42);padding:14px 30px;border-radius:18px;text-shadow:0 3px 0 rgba(0,0,0,.85),0 0 20px rgba(0,0,0,.7)}`;
  let body = '';
  if (style === 'thumbHook') {
    // 썸네일과 동일한 문구(배지+소제목+제목) — 채널 썸네일 위치에 맞춤
    const block = `<div style="text-align:left"><div class="eyebrow">현대·제네시스 대전선화점 카마스터</div><div class="headline">${html}</div></div>`;
    const place = pos === 'bottom'
      ? `<div class="row" style="bottom:300px;justify-content:flex-start">${block}</div>`
      : `<div class="row" style="top:0;bottom:0;align-items:center;justify-content:flex-start">${block}</div>`;
    body = `<div class="badge">현대·제네시스 김무겸</div>${place}`;
  }
  else if (style === 'topPill') body = `<div class="row" style="top:130px"><div class="pill">${html}</div></div>`;
  else if (style === 'bottomBig') body = `<div class="row" style="bottom:360px"><div class="big">${html}</div></div>`;
  else if (style === 'centerPop') body = `<div class="row" style="top:0;bottom:0;align-items:center"><div class="big" style="font-size:96px">${html}</div></div>`;
  else if (style === 'lowerThird') body = `<div class="row" style="bottom:420px;justify-content:flex-start"><div class="pill" style="font-size:46px">${html}</div></div>`;
  else if (style === 'sideBar') body = `<div class="row" style="top:0;bottom:0;align-items:center;justify-content:flex-start"><div style="border-left:12px solid #FFD60A;padding-left:30px;color:#fff;font-weight:800;font-size:72px;letter-spacing:-2px;line-height:1.2;text-shadow:0 4px 22px rgba(0,0,0,.6)">${html}</div></div>`;
  else if (style === 'sub') body = `<div class="row" style="bottom:445px"><div class="sub">${html}</div></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${base}</style></head><body><div class="stage">${body}</div></body></html>`;
}

// ---- 고정 프레임(상단 제목 띠 + 하단 명함 띠, 가운데 투명) --------------
const TOPBAND = 430, BOTBAND = 400, MIDH = H - TOPBAND - BOTBAND; // 가운데 영상 영역
function frameHtml(dateText, titleHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
   *{margin:0;padding:0;box-sizing:border-box;font-family:${FONT}}
   html,body{width:${W}px;height:${H}px}
   .stage{position:relative;width:${W}px;height:${H}px}
   .top{position:absolute;left:0;top:0;width:${W}px;height:${TOPBAND}px;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px}
   .date{font-size:46px;font-weight:700;color:#dfe4ee;letter-spacing:-1px;margin-bottom:14px}
   .ttl{font-size:92px;font-weight:900;color:#fff;letter-spacing:-3px;line-height:1.12}
   .ttl .hl{color:#FFD60A}
   .bot{position:absolute;left:0;bottom:0;width:${W}px;height:${BOTBAND}px;background:#000;display:flex;align-items:center;justify-content:center}
   .card{display:flex;flex-direction:column;align-items:center;gap:6px;background:#0c1f63;border-radius:22px;padding:26px 64px;box-shadow:0 10px 40px rgba(0,0,0,.45)}
   .logos{height:62px;margin-bottom:10px}
   .who{font-size:40px;font-weight:800;color:#fff;letter-spacing:-1px}
   .tel{font-size:60px;font-weight:900;color:#fff;letter-spacing:2px}
  </style></head><body><div class="stage">
   <div class="top"><div class="date">${dateText}</div><div class="ttl">${titleHtml}</div></div>
   <div class="bot"><div class="card">${logosB64 ? `<img class="logos" src="data:image/png;base64,${logosB64}">` : ''}<div class="who">대전선화점 김무겸 과장</div><div class="tel">010-8033-3522</div></div></div>
  </div></body></html>`;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const now = new Date();
const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 (${WD[now.getDay()]})`;

// ---- 1) 자막 PNG 렌더 -------------------------------------------------
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
let ci = 0;
for (const cap of prof.captions) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(captionHtml(cap.style, cap.text, cap.accent, cap.pos), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(80);
  cap.png = join(TMP, `cap_${ci++}.png`);
  await page.screenshot({ path: cap.png, omitBackground: true });
  await page.close();
}
let framePng = null;
if (prof.framed) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(frameHtml(prof.frame?.date || dateStr, prof.frame?.title || '오늘도 <span class="hl">인사</span>드립니다'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
  framePng = join(TMP, 'frame.png');
  await page.screenshot({ path: framePng, omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`자막 ${prof.captions.length}개 렌더 완료${prof.framed ? ' · 프레임 1개' : ''}`);

// ---- 2) 세그먼트 빌드 + 절대 타임라인 계산 ----------------------------
const CROP = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
// 프레임 모드: 영상을 가운데 영역(1080×MIDH)에 꽉 채우고(가벼운 중앙 크롭) 위·아래 검은 띠
const MIDFILL = `scale=${W}:${MIDH}:force_original_aspect_ratio=increase,crop=${W}:${MIDH},pad=${W}:${H}:0:${TOPBAND}:color=black`;
const ZP = `zoompan=z='min(zoom+0.0006,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;
const A = ['-c:a', 'aac', '-ar', '48000', '-ac', '2'];
const segStart = {}; let clock = 0; const segFiles = []; let cardStart = null;
for (let i = 0; i < prof.segments.length; i++) {
  const s = prof.segments[i]; segStart[s.name || `card${i}`] = clock;
  if (s.card && cardStart === null) cardStart = clock;
  clock += s.t;
  const out = join(TMP, `seg${i}.mp4`);
  if (s.card) {
    execFileSync('ffmpeg', ['-y', '-loop', '1', '-t', String(s.t), '-i', cardPng,
      '-f', 'lavfi', '-t', String(s.t), '-i', 'anullsrc=r=48000:cl=stereo',
      '-filter_complex', `[0:v]scale=${W}:${H},zoompan=z='min(zoom+0.0004,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]`,
      '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', ...A, out], { stdio: 'ignore' });
  } else {
    const vf = prof.framed
      ? `[0:v]${MIDFILL},fps=${FPS},setsar=1,format=yuv420p[v]`
      : (s.zoom ? `[0:v]${CROP},${ZP},setsar=1,format=yuv420p[v]` : `[0:v]${CROP},fps=${FPS},setsar=1,format=yuv420p[v]`);
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
const framed = prof.framed && framePng;
if (framed) inputs.push('-loop', '1', '-i', framePng);
const capBase = framed ? 2 : 1;
const caps = prof.captions.map((cap) => {
  const t0 = (segStart[cap.seg] ?? 0) + cap.at; const t1 = t0 + cap.dur;
  inputs.push('-loop', '1', '-i', cap.png);
  return { t0, t1 };
});
let cur = '0:v'; const fc = [];
if (framed) {
  const en = cardStart != null ? `:enable='between(t,0,${cardStart.toFixed(2)})'` : '';
  fc.push(`[${cur}][1:v]overlay=0:0${en}[vfr]`); cur = 'vfr';
}
caps.forEach((c, i) => {
  const inIdx = capBase + i; const lbl = `v${i + 1}`;
  fc.push(`[${cur}][${inIdx}:v]overlay=0:0:enable='between(t,${c.t0.toFixed(2)},${c.t1.toFixed(2)})'[${lbl}]`);
  cur = lbl;
});
mkdirSync(dirname(outPath), { recursive: true });
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', fc.join(';'),
  '-map', `[${cur}]`, '-map', '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
  '-pix_fmt', 'yuv420p', ...A, '-movflags', '+faststart', '-shortest', outPath], { stdio: 'ignore' });

rmSync(TMP, { recursive: true, force: true });
console.log(`✅ ${channel} 완성 → ${outPath}`);
