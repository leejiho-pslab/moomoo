#!/usr/bin/env node
// 서스펜션 소개 콘텐츠 2종(인스타 카드형 인포그래픽 + 유튜브 썸네일)을
// 김무겸 브랜딩으로 생성한다. 참고 이미지(경쟁사 콘텐츠)의 정보 구성만 차용하고
// 실제 도면은 자체 제작 SVG 로 그린다.
// 실행: node scripts/gen-suspension-content.mjs → output/content/*.png

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME_ENV = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = existsSync(CHROME_ENV) ? CHROME_ENV : undefined;
const OUT_DIR = join(ROOT, 'output', 'content');
mkdirSync(OUT_DIR, { recursive: true });

function dataUrl(p) {
  if (!existsSync(p)) return '';
  const ext = extname(p).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}

const profilePhoto = dataUrl(join(ROOT, '..', 'public', 'images', 'profile.jpg'));
const logos = dataUrl(join(ROOT, 'assets', 'brand', 'logos.png'));

const DEALER = {
  name: '김무겸',
  role: '카마스터',
  dealership: '현대자동차·제네시스 대전선화대리점',
  phone: '010-8033-3522',
};

// ── 공용: 인물 카드 (사진 상단부만 크롭 + 이름판) ──
const personCard = (size = 96) => `
  <div class="person">
    <div class="person__photo" style="width:${size}px;height:${size}px;background-image:url('${profilePhoto}')"></div>
    <div class="person__meta">
      <div class="person__dealership">${DEALER.dealership}</div>
      <div class="person__name">카마스터 <b>${DEALER.name}</b></div>
      <div class="person__phone">${DEALER.phone}</div>
    </div>
  </div>`;

// ── SVG: 맥퍼슨 스트럿 상세 도면 ──
const macphersonSvg = `
<svg viewBox="0 0 420 460" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a4252"/>
      <stop offset="1" stop-color="#1c212b"/>
    </linearGradient>
  </defs>
  <!-- 타이어/휠 -->
  <circle cx="190" cy="340" r="95" fill="url(#tire)"/>
  <circle cx="190" cy="340" r="62" fill="#0e1420"/>
  <circle cx="190" cy="340" r="58" fill="none" stroke="#7d8aa0" stroke-width="2"/>
  <circle cx="190" cy="340" r="14" fill="#7d8aa0"/>
  ${[0,60,120,180,240,300].map(a=>{
    const r1=20,r2=54; const rad=a*Math.PI/180;
    const x1=190+r1*Math.cos(rad), y1=340+r1*Math.sin(rad);
    const x2=190+r2*Math.cos(rad), y2=340+r2*Math.sin(rad);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#7d8aa0" stroke-width="5" stroke-linecap="round"/>`;
  }).join('')}

  <!-- 쇼크 업소버 튜브 -->
  <rect x="176" y="80" width="20" height="180" rx="8" fill="#8fa3c9"/>
  <rect x="176" y="80" width="20" height="180" rx="8" fill="none" stroke="#3a4a6b" stroke-width="2"/>

  <!-- 코일 스프링 -->
  ${Array.from({length:9}).map((_,i)=>{
    const y = 96 + i*18;
    return `<ellipse cx="186" cy="${y}" rx="34" ry="9" fill="none" stroke="#2c5fb0" stroke-width="5"/>`;
  }).join('')}

  <!-- 스트럿 마운트 (상단 플레이트) -->
  <rect x="150" y="58" width="72" height="20" rx="6" fill="#1c2a4a"/>
  <circle cx="164" cy="68" r="4" fill="#8fa3c9"/>
  <circle cx="208" cy="68" r="4" fill="#8fa3c9"/>

  <!-- 스티어링 너클(하단 브래킷) -->
  <path d="M170 250 L156 300 L190 320 L222 300 L206 250 Z" fill="#4a5670" stroke="#1c2a4a" stroke-width="3"/>

  <!-- 로어 컨트롤 암 -->
  <path d="M190 320 L330 350 L340 372 L188 336 Z" fill="#c9d3e6" stroke="#3a4a6b" stroke-width="3"/>
  <circle cx="335" cy="361" r="10" fill="#3a4a6b"/>

  <!-- 차체 마운트 포인트 -->
  <rect x="330" y="340" width="34" height="42" rx="6" fill="#1c2a4a"/>

  <!-- 콜아웃 라인 -->
  <g stroke="#0b3d91" stroke-width="1.6" fill="none">
    <path d="M186 68 L60 46"/>
    <path d="M186 150 L48 150"/>
    <path d="M186 210 L48 230"/>
    <path d="M190 285 L340 210"/>
    <path d="M335 361 L392 400"/>
  </g>
</svg>`;

const macphersonLabels = [
  { top: '4%',  left: '2%',  title: '스트럿 마운트',        desc: '차체와 스트럿을 연결하며<br>충격과 진동을 완충' },
  { top: '26%', left: '0%',  title: '코일 스프링',          desc: '충격을 흡수하며<br>차량 하중을 지지' },
  { top: '46%', left: '0%',  title: '쇼크 업소버 (댐퍼)',   desc: '노면의 충격을<br>흡수하며 감쇠' },
  { top: '58%', left: '76%', title: '스티어링 너클',        desc: '조향과 서스펜션이<br>일체화된 부품' },
  { top: '84%', left: '82%', title: '휠 허브 앤 너클',      desc: '차체를 바퀴와<br>지지하고 회전 지탱' },
];

const FEATURES = [
  { ic: '⚙️', t: '구조가 단순',   d: '부품 수가 적고 구조가 단순해 정비 및 제작 용이' },
  { ic: '🪶', t: '경량화에 유리', d: '부품 수가 적어 차량 경량화에 유리' },
  { ic: '🚗', t: '실내 공간 확보 우수', d: '구조상 세로 방향으로 배치되어 실내 공간 확보에 유리' },
  { ic: '🔧', t: '정비비 저렴',   d: '부품 수와 구조가 단순해 정비 비용이 적게 듦' },
];

const CUSTOMERS = [
  { ic: '🚙', t: '실용적인 차량을 선호하는 고객', d: '일상 주행 위주의 편안하고 실용적인 세팅을 찾는 고객' },
  { ic: '👤', t: '경제성을 중요하게 생각하는 고객', d: '구매 비용과 유지 비용을 고려하며 가성비를 중요시하는 고객' },
];

const infographicHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Pretendard','Malgun Gothic',sans-serif; word-break:keep-all; }
  body { width:1080px; min-height:1350px; background:#f4f6fb; color:#131a2c; }
  .wrap { width:100%; height:100%; padding:56px 60px; display:flex; flex-direction:column; gap:26px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; }
  .head h1 { font-size:44px; font-weight:900; letter-spacing:-0.02em; }
  .head h1 em { font-style:normal; color:#0b3d91; }
  .head p { margin-top:10px; font-size:19px; color:#5b6478; font-weight:600; }
  .person { display:flex; align-items:center; gap:14px; background:#0c1f63; border-radius:18px; padding:10px 20px 10px 10px; box-shadow:0 10px 30px -12px rgba(11,61,145,.5); }
  .person__photo { border-radius:14px; background-size:220% auto; background-position:50% 12%; flex:none; border:2px solid rgba(255,255,255,.5); }
  .person__meta { color:#fff; }
  .person__dealership { font-size:13px; opacity:.85; font-weight:600; }
  .person__name { font-size:19px; font-weight:800; margin-top:2px; }
  .person__phone { font-size:17px; font-weight:800; color:#7fd0ff; margin-top:2px; }

  .diagram { position:relative; background:#fff; border-radius:24px; padding:20px 20px 26px; border:1px solid #e4e8f2; }
  .diagram svg { width:100%; height:430px; display:block; }
  .callout { position:absolute; width:190px; }
  .callout .t { font-size:16px; font-weight:800; color:#0b3d91; }
  .callout .d { font-size:12.5px; color:#5b6478; margin-top:3px; line-height:1.45; }
  .callout.right { text-align:right; }

  .desc-box { background:#eef3ff; border-radius:20px; padding:24px 28px; }
  .desc-box .lbl { font-size:14px; font-weight:800; color:#0b3d91; letter-spacing:.04em; }
  .desc-box p { font-size:16.5px; margin-top:10px; line-height:1.7; color:#25304a; font-weight:600; }

  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#fff; border:1px solid #e4e8f2; border-radius:16px; padding:18px 20px; }
  .card .ic { font-size:26px; }
  .card .t { font-size:16px; font-weight:800; margin-top:8px; }
  .card .d { font-size:13px; color:#5b6478; margin-top:5px; line-height:1.5; }

  .sec-lbl { font-size:15px; font-weight:900; color:#0b3d91; background:#dfe9ff; display:inline-block; padding:6px 14px; border-radius:8px; }

  .apply { display:flex; gap:14px; }
  .apply .box { flex:1; background:#fff; border:1px solid #e4e8f2; border-radius:16px; padding:18px 20px; }
  .apply .box .h { font-size:14px; font-weight:800; color:#5b6478; margin-bottom:8px; }
  .apply .box .h b { color:#131a2c; }
  .apply .box ul { list-style:none; font-size:14.5px; font-weight:700; color:#25304a; }
  .apply .box li { margin-top:4px; }

  .strengths { display:flex; gap:14px; }
  .strengths .box { flex:1; text-align:center; background:#fff; border:1px solid #e4e8f2; border-radius:16px; padding:16px 10px; }
  .strengths .box .ic { font-size:24px; }
  .strengths .box .t { font-size:14.5px; font-weight:800; margin-top:6px; }
  .strengths .box .d { font-size:11.5px; color:#5b6478; margin-top:4px; line-height:1.4; }

  .bottom { margin-top:auto; background:#0c1f63; color:#fff; border-radius:20px; padding:20px 26px; display:flex; align-items:center; gap:16px; }
  .bottom .tag { font-size:13px; font-weight:900; background:#7fd0ff; color:#04305c; padding:6px 12px; border-radius:8px; flex:none; }
  .bottom p { font-size:14px; line-height:1.6; font-weight:600; }
</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>맥퍼슨 스트럿 <em>(전륜)</em></h1>
        <p>구조가 단순하고 경량화에 유리한 전륜 서스펜션</p>
      </div>
      ${personCard(96)}
    </div>

    <div class="diagram">
      ${macphersonSvg}
      ${macphersonLabels.map(l => `<div class="callout${l.left>50?' right':''}" style="top:${l.top};left:${l.left}">
        <div class="t">${l.title}</div><div class="d">${l.desc}</div>
      </div>`).join('')}
    </div>

    <div class="desc-box">
      <div class="lbl">구조 및 작동 원리</div>
      <p>쇼크 업소버(쇼크 스트럿)와 코일 스프링이 일체형으로 구성되며 노면의 충격을 흡수합니다. 하부 컨트롤 암이 앞뒤 좌우로 연결되며 바퀴의 상하 운동을 제어합니다.</p>
    </div>

    <div>
      <span class="sec-lbl">특징</span>
      <div class="grid2" style="margin-top:12px">
        ${FEATURES.map(f => `<div class="card"><div class="ic">${f.ic}</div><div class="t">${f.t}</div><div class="d">${f.d}</div></div>`).join('')}
      </div>
    </div>

    <div>
      <span class="sec-lbl">적용 차종 (전륜 기준)</span>
      <div class="apply" style="margin-top:12px">
        <div class="box"><div class="h">현대자동차</div><ul><li>전 차종 적용</li></ul></div>
        <div class="box"><div class="h">제네시스 적용 차종</div><ul><li>G70</li><li>GV60</li><li>GV70</li></ul></div>
      </div>
    </div>

    <div>
      <span class="sec-lbl">장점</span>
      <div class="strengths" style="margin-top:12px">
        <div class="box"><div class="ic">🛠️</div><div class="t">실용성</div><div class="d">일상 주행 위주의<br>편안한 세팅</div></div>
        <div class="box"><div class="ic">💰</div><div class="t">경제성</div><div class="d">구매 비용과<br>유지 비용 유리</div></div>
        <div class="box"><div class="ic">📦</div><div class="t">공간 활용도</div><div class="d">실내·트렁크<br>공간 확보 유리</div></div>
      </div>
    </div>

    <div>
      <span class="sec-lbl">추천 고객</span>
      <div class="grid2" style="margin-top:12px">
        ${CUSTOMERS.map(c => `<div class="card"><div class="ic">${c.ic}</div><div class="t">${c.t}</div><div class="d">${c.d}</div></div>`).join('')}
      </div>
    </div>

    <div class="bottom">
      <div class="tag">핵심 포인트</div>
      <p>맥퍼슨 스트럿은 구조가 단순하고 가벼워 연비와 공간 활용에 유리한 전륜 서스펜션입니다. 실용적인 차량을 원하시고 경제적인 유지비를 중시한다면 대부분의 현대차 전 차종에 적용된 이 방식이 적합합니다.</p>
    </div>
  </div>
</body></html>`;

// ── 2) 유튜브 썸네일: 서스펜션 6종 총정리 ──
const TYPES = [
  { grp:'전륜', name:'맥퍼슨 스트럿', d:'구조가 단순하고 경량화에 유리하여 대부분의 차량에 폭넓게 적용', ic:'strut' },
  { grp:'전륜', name:'더블위시본', d:'상·하 위시본으로 휠의 움직임을 정교하게 제어해 우수한 승차감과 핸들링 제공', ic:'wishbone' },
  { grp:'전륜', name:'에어서스펜션\n(더블위시본 기반)', d:'에어 스프링이 적용되어 차고 조절 및 최고 수준의 승차감과 안정성 제공', ic:'air' },
  { grp:'후륜', name:'토션빔', d:'구조가 단순하고 공간 활용성이 좋으며 경제성이 뛰어난 방식', ic:'torsion' },
  { grp:'후륜', name:'멀티링크', d:'여러 링크가 독립적으로 휠을 제어해 우수한 승차감과 주행 안정성 제공', ic:'multilink' },
  { grp:'후륜', name:'에어 멀티링크', d:'에어 스프링과 멀티링크 조합으로 최고 수준의 승차감과 차고 조절 기능 제공', ic:'airmulti' },
];

function typeIcon(kind) {
  const wheel = `<circle cx="50" cy="86" r="26" fill="none" stroke="#0b3d91" stroke-width="4"/><circle cx="50" cy="86" r="7" fill="#0b3d91"/>`;
  switch (kind) {
    case 'strut':
      return `<svg viewBox="0 0 100 110">${wheel}<rect x="44" y="14" width="10" height="52" rx="4" fill="#0b3d91"/>${Array.from({length:5}).map((_,i)=>`<ellipse cx="49" cy="${20+i*10}" rx="16" ry="5" fill="none" stroke="#2c5fb0" stroke-width="3"/>`).join('')}<line x1="50" y1="66" x2="82" y2="80" stroke="#0b3d91" stroke-width="4"/></svg>`;
    case 'wishbone':
      return `<svg viewBox="0 0 100 110">${wheel}<line x1="50" y1="60" x2="16" y2="50" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="94" x2="16" y2="98" stroke="#0b3d91" stroke-width="4"/><rect x="46" y="22" width="8" height="40" rx="4" fill="#2c5fb0"/></svg>`;
    case 'air':
      return `<svg viewBox="0 0 100 110">${wheel}<rect x="38" y="16" width="24" height="46" rx="12" fill="none" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="62" x2="50" y2="80" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="80" x2="18" y2="92" stroke="#0b3d91" stroke-width="4"/></svg>`;
    case 'torsion':
      return `<svg viewBox="0 0 100 110">${wheel}<line x1="50" y1="86" x2="10" y2="86" stroke="#0b3d91" stroke-width="6"/><rect x="0" y="80" width="14" height="12" rx="4" fill="#2c5fb0"/></svg>`;
    case 'multilink':
      return `<svg viewBox="0 0 100 110">${wheel}<line x1="50" y1="66" x2="14" y2="52" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="86" x2="10" y2="86" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="100" x2="18" y2="106" stroke="#0b3d91" stroke-width="4"/></svg>`;
    default:
      return `<svg viewBox="0 0 100 110">${wheel}<rect x="40" y="20" width="20" height="40" rx="10" fill="none" stroke="#0b3d91" stroke-width="4"/><line x1="50" y1="66" x2="14" y2="52" stroke="#0b3d91" stroke-width="3"/><line x1="50" y1="86" x2="10" y2="86" stroke="#0b3d91" stroke-width="3"/></svg>`;
  }
}

const thumbHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Pretendard','Malgun Gothic',sans-serif; word-break:keep-all; }
  body { width:1280px; height:720px; background:linear-gradient(160deg,#0a1024 0%,#101a3a 55%,#0a1024 100%); color:#fff; overflow:hidden; display:flex; flex-direction:column; }
  .topbar { background:rgba(0,0,0,.55); padding:22px 40px; display:flex; justify-content:space-between; align-items:center; }
  .topbar .t1 { font-size:26px; font-weight:900; }
  .topbar .t1 span { color:#7fd0ff; }
  ${''}
  .person { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.25); border-radius:14px; padding:8px 16px 8px 8px; }
  .person__photo { width:64px; height:64px; border-radius:10px; background-image:url('${profilePhoto}'); background-size:220% auto; background-position:50% 12%; flex:none; }
  .person__meta { font-size:13px; }
  .person__dealership { opacity:.85; font-weight:600; }
  .person__name { font-weight:800; font-size:15px; margin-top:2px; }
  .person__phone { color:#7fd0ff; font-weight:800; font-size:14px; margin-top:2px; }

  .hero { padding:30px 44px 22px; }
  .hero h1 { font-size:58px; font-weight:900; letter-spacing:-0.02em; text-shadow:0 4px 20px rgba(0,0,0,.5); }
  .hero h1 em { font-style:normal; color:#7fd0ff; }
  .hero .sub { font-size:23px; font-weight:700; color:#c7d3f5; margin-top:8px; }

  .grid { flex:1; display:grid; grid-template-columns:repeat(6,1fr); gap:16px; padding:0 40px 36px; align-items:stretch; }
  .cell { background:rgba(255,255,255,.94); color:#131a2c; border-radius:18px; padding:26px 16px 22px; text-align:center; position:relative; display:flex; flex-direction:column; }
  .cell .grp { position:absolute; top:-13px; left:50%; transform:translateX(-50%); background:#0b3d91; color:#fff; font-size:12px; font-weight:900; padding:4px 14px; border-radius:999px; white-space:nowrap; }
  .cell .ic { width:88px; height:96px; margin:6px auto 14px; }
  .cell .nm { font-size:18px; font-weight:900; white-space:pre-line; line-height:1.32; min-height:46px; word-break:keep-all; }
  .cell .d { font-size:12.5px; color:#5b6478; margin-top:14px; line-height:1.55; white-space:pre-line; font-weight:600; flex:1; word-break:keep-all; }
</style></head>
<body>
  <div class="topbar">
    <div class="t1">현대자동차·제네시스 <span>서스펜션의 이해</span></div>
    ${personCard(64)}
  </div>
  <div class="hero">
    <h1>현대자동차 서스펜션에 <em>대해!</em></h1>
    <div class="sub">(등급표까지) 전륜·후륜 6종 총정리</div>
  </div>
  <div class="grid">
    ${TYPES.map(t => `<div class="cell"><div class="grp">${t.grp} 서스펜션</div><div class="ic">${typeIcon(t.ic)}</div><div class="nm">${t.name}</div><div class="d">${t.d}</div></div>`).join('')}
  </div>
</body></html>`;

async function shoot(html, width, height, outFile, fullPage = false) {
  const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outFile, fullPage });
  await browser.close();
  console.log(`[content] 저장 → ${outFile}`);
}

const infographicPath = join(OUT_DIR, 'suspension-macpherson.png');
const thumbPath = join(OUT_DIR, 'suspension-overview-thumb.png');

await shoot(infographicHtml, 1080, 1350, infographicPath, true);
await shoot(thumbHtml, 1280, 720, thumbPath, false);
