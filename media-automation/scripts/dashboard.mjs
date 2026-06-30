#!/usr/bin/env node
// 미디어 자동화 대시보드 생성기.
// config/state/output 을 읽어 한 장의 HTML 대시보드를 만들고 PNG 로도 렌더한다.
// 실행: node scripts/dashboard.mjs   → output/dashboard.html , output/dashboard.png

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = join(ROOT, 'output');
mkdirSync(out, { recursive: true });

const readJson = (p, def) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : def);
const content = readJson(join(ROOT, 'config', 'content-rules.json'), {});
const vstyle = readJson(join(ROOT, 'config', 'video-style.json'), {});
const auto = readJson(join(ROOT, 'config', 'automation.json'), {});
const processed = readJson(join(ROOT, 'state', 'processed.json'), []);
const usedThumb = readJson(join(ROOT, 'state', 'used-content.json'), []);

function dataUrl(p) {
  if (!p || !existsSync(p)) return '';
  const ext = extname(p).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}

const styleImgs = ['bar', 'box', 'lower', 'side'].map((k) => ({
  key: k,
  label: vstyle.styles?.[k]?.label || k,
  img: dataUrl(join(out, `_style_${k}.png`)),
}));
const thumbIG = dataUrl(join(out, '2026-06-30_instagram_demo-bg.png'));
const thumbYT = dataUrl(join(out, '2026-06-30_youtube_demo-bg.png'));
const profile = dataUrl(join(ROOT, 'assets', 'brand', 'profile.jpg'));

const autoOn = auto.inputFolderId && !String(auto.inputFolderId).startsWith('PUT_');
const modules = [
  { name: '썸네일 생성', sub: '유튜브·인스타 / 매일 문구 변경·중복방지', state: 'done' },
  { name: '영상 편집', sub: '세로 9:16 · 4스타일 로테이션 · 명함', state: 'done' },
  { name: '무인 자동화', sub: 'GitHub Actions · 매일 06:00', state: autoOn ? 'done' : 'wait' },
  { name: '블로그', sub: '하루 2회 · 네이버 SEO (예정)', state: 'todo' },
];
const badge = { done: ['●', '#16a34a', '작동'], wait: ['◐', '#f59e0b', '켜기 대기'], todo: ['○', '#94a3b8', '예정'] };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Noto Sans CJK KR','NanumSquare',sans-serif}
  body{background:#0b1020;color:#e8ecf6;width:1240px;padding:40px}
  .head{display:flex;align-items:center;gap:18px;margin-bottom:28px}
  .head img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #2a3a6b}
  .head h1{font-size:30px;font-weight:900}.head p{color:#9fb0d6;margin-top:4px;font-size:15px}
  .grid{display:grid;gap:18px}
  .cards{grid-template-columns:repeat(4,1fr)}
  .card{background:#141b33;border:1px solid #243056;border-radius:16px;padding:20px}
  .card .nm{font-size:18px;font-weight:800}.card .sb{color:#9fb0d6;font-size:13px;margin-top:6px;line-height:1.4;min-height:36px}
  .st{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;background:#0b1020}
  h2{font-size:20px;font-weight:800;margin:34px 0 14px;display:flex;align-items:center;gap:10px}
  h2 .tag{font-size:12px;color:#9fb0d6;font-weight:600}
  .styles{grid-template-columns:repeat(4,1fr)}
  .sty{background:#141b33;border:1px solid #243056;border-radius:14px;overflow:hidden}
  .sty img{width:100%;display:block;aspect-ratio:9/16;object-fit:cover;background:#000}
  .sty .cap{padding:10px 12px;font-size:13px;font-weight:700;text-align:center}
  .two{grid-template-columns:1fr 1fr}
  .panel{background:#141b33;border:1px solid #243056;border-radius:16px;padding:22px}
  .panel h3{font-size:16px;font-weight:800;margin-bottom:14px}
  .kv{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #243056;font-size:14px}
  .kv:last-child{border-bottom:none}.kv b{color:#fff}.muted{color:#9fb0d6}
  .pill{display:inline-block;background:#1c2747;color:#cdd9f5;border-radius:8px;padding:3px 9px;margin:3px 4px 0 0;font-size:12px}
  .thumbrow{display:flex;gap:14px}.thumbrow .col{flex:1;text-align:center}
  .thumbrow .ig img{height:300px;border-radius:10px;border:1px solid #243056}
  .thumbrow .yt img{width:100%;border-radius:10px;border:1px solid #243056;margin-top:18px}
  .empty{color:#9fb0d6;font-size:14px;padding:10px 0}
  .foot{margin-top:30px;color:#6b7aa3;font-size:12px;text-align:center}
</style></head><body>
  <div class="head">
    ${profile ? `<img src="${profile}">` : ''}
    <div><h1>김무겸 미디어 자동화 대시보드</h1>
    <p>현대·제네시스 대전선화대리점 카마스터 · @${esc(content.brand?.handle?.replace('@','') || 'hyundai_moomoo')}</p></div>
  </div>

  <div class="grid cards">
    ${modules.map((m) => { const b = badge[m.state]; return `<div class="card">
      <div class="nm">${esc(m.name)}</div><div class="sb">${esc(m.sub)}</div>
      <div class="st" style="color:${b[1]}">${b[0]} ${b[2]}</div></div>`; }).join('')}
  </div>

  <h2>🎬 영상 편집 스타일 <span class="tag">매일 자동 로테이션 — 같은 형식도 다른 느낌</span></h2>
  <div class="grid styles">
    ${styleImgs.map((s) => `<div class="sty">${s.img ? `<img src="${s.img}">` : '<div style="aspect-ratio:9/16;background:#000"></div>'}<div class="cap">${esc(s.label)}</div></div>`).join('')}
  </div>

  <h2>🖼️ 썸네일 (유튜브 ≠ 인스타)</h2>
  <div class="panel">
    <div class="thumbrow">
      <div class="col ig"><div class="muted" style="margin-bottom:8px">인스타 9:16</div>${thumbIG ? `<img src="${thumbIG}">` : '<div class="empty">미리보기 없음</div>'}</div>
      <div class="col yt"><div class="muted" style="margin-bottom:8px">유튜브 16:9</div>${thumbYT ? `<img src="${thumbYT}">` : '<div class="empty">미리보기 없음</div>'}</div>
    </div>
  </div>

  <h2>⚙️ 콘텐츠 · 중복방지 규칙</h2>
  <div class="grid two">
    <div class="panel"><h3>썸네일 문구 엔진</h3>
      <div class="kv"><span class="muted">주제 풀</span><b>${content.topics?.length || 0}종</b></div>
      <div class="kv"><span class="muted">후킹 공식(패턴)</span><b>${content.patterns?.length || 0}종</b></div>
      <div class="kv"><span class="muted">같은 제목 재사용 금지</span><b>${content.rules?.noRepeatHeadlineDays || '-'}일</b></div>
      <div class="kv"><span class="muted">어제와 같은 주제 금지</span><b>${content.rules?.noSameTopicConsecutiveDays ? 'ON' : 'OFF'}</b></div>
      <div class="kv"><span class="muted">최근 패턴 반복 금지</span><b>${content.rules?.avoidLastNPatterns || 0}회</b></div>
      <div style="margin-top:10px">${(content.topics || []).map((t) => `<span class="pill">${esc(t.label)}</span>`).join('')}</div>
    </div>
    <div class="panel"><h3>영상 자막 인사 로테이션</h3>
      <div class="kv"><span class="muted">출력 비율</span><b>${vstyle.width}×${vstyle.height} (9:16)</b></div>
      <div class="kv"><span class="muted">편집 스타일</span><b>${Object.keys(vstyle.styles||{}).length}종</b></div>
      <div class="kv"><span class="muted">인사 문구 풀</span><b>${auto.greetings?.length || 0}종</b></div>
      <div class="kv"><span class="muted">하단 명함</span><b>${vstyle.contactCard?.enabled ? 'ON' : 'OFF'}</b></div>
      <div style="margin-top:10px">${(auto.greetings || []).map((g) => `<span class="pill">${esc(g.line2)} ${esc(g.line3)}</span>`).join('')}</div>
    </div>
  </div>

  <h2>📦 자동화 처리 현황</h2>
  <div class="panel">
    <div class="kv"><span class="muted">실행 환경</span><b>GitHub Actions · 매일 06:00(KST) + 수동</b></div>
    <div class="kv"><span class="muted">원본 폴더 연결</span><b style="color:${autoOn ? '#16a34a' : '#f59e0b'}">${autoOn ? '연결됨' : '미설정 (SETUP.md 참고)'}</b></div>
    <div class="kv"><span class="muted">처리한 영상</span><b>${processed.length}개</b></div>
    <div class="kv"><span class="muted">생성한 썸네일 기록</span><b>${usedThumb.length}건</b></div>
    ${processed.length ? '' : '<div class="empty">아직 처리된 영상이 없어요. 출입증(서비스 계정)을 등록하면 이 표가 채워집니다.</div>'}
  </div>

  <div class="foot">생성: 데모 데이터 기준 · 실제 운영 시 처리 현황·썸네일이 자동 반영됩니다</div>
</body></html>`;

const htmlPath = join(out, 'dashboard.html');
writeFileSync(htmlPath, html);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);
await page.screenshot({ path: join(out, 'dashboard.png'), fullPage: true });
await browser.close();
console.log('✅ 대시보드 생성 → output/dashboard.html , output/dashboard.png');
