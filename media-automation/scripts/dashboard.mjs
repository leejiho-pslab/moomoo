#!/usr/bin/env node
// 미디어 자동화 대시보드 생성기 (현재 파이프라인 기준).
// config/state/실제 결과물(output/yt.mp4, ig.mp4, 썸네일)을 읽어 한 장의 HTML+PNG 대시보드를 만든다.
// 실행: node scripts/dashboard.mjs → output/dashboard.html, output/dashboard.png, public/dashboard/index.html

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { BLOG_CSS, BLOG_SHEET_HTML, BLOG_OVERLAY, BLOG_CLIENT_JS, blogStats } from '../blog/scripts/blog-dashboard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME_ENV = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = existsSync(CHROME_ENV) ? CHROME_ENV : undefined;
const out = join(ROOT, 'output');
mkdirSync(out, { recursive: true });

const readJson = (p, def) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : def);
const content = readJson(join(ROOT, 'config', 'content-rules.json'), {});
const vstyle = readJson(join(ROOT, 'config', 'video-style.json'), {});
const auto = readJson(join(ROOT, 'config', 'automation.json'), {});
const processed = readJson(join(ROOT, 'state', 'processed.json'), []);
const links = readJson(join(ROOT, 'state', 'drive-links.json'), {});

function dataUrl(p) {
  if (!p || !existsSync(p)) return '';
  const ext = extname(p).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}
// 영상에서 프레임 3장을 가로로 이어 스트립 PNG 생성
function strip(video, times, outName) {
  if (!existsSync(video)) return '';
  const fr = [];
  times.forEach((t, i) => {
    const f = join(out, `_d_${outName}_${i}.png`);
    try { execFileSync('ffmpeg', ['-y', '-ss', String(t), '-i', video, '-frames:v', '1', f], { stdio: 'ignore' }); fr.push(f); } catch {}
  });
  if (!fr.length) return '';
  const o = join(out, `_d_${outName}.png`);
  const inputs = fr.flatMap((f) => ['-i', f]);
  const fc = fr.map((_, i) => `[${i}]scale=300:533[a${i}]`).join(';') + ';' + fr.map((_, i) => `[a${i}]`).join('') + `hstack=${fr.length}`;
  try { execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, o], { stdio: 'ignore' }); return dataUrl(o); } catch { return ''; }
}

const ytDur = existsSync(join(out, 'yt.mp4')) ? Math.round(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'yt.mp4')]).toString().trim()) : null;
const igDur = existsSync(join(out, 'ig.mp4')) ? Math.round(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'ig.mp4')]).toString().trim()) : null;
const ytStrip = strip(join(out, 'yt.mp4'), [1.5, ytDur ? ytDur / 2 : 24, ytDur ? ytDur - 2 : 45], 'yt');
const igStrip = strip(join(out, 'ig.mp4'), [1, igDur ? igDur / 2 : 13, igDur ? igDur - 2 : 24], 'ig');
const thumbIG = dataUrl(join(ROOT, 'assets', 'clips', 'final', '0630_인스타_썸네일.png')) || dataUrl(join(out, '2026-06-30_instagram_thumb_bg.png'));
const thumbYT = dataUrl(join(ROOT, 'assets', 'clips', 'final', '0630_유튜브숏츠_썸네일.png')) || dataUrl(join(out, '2026-06-30_youtube_thumb_bg.png'));
const profile = dataUrl(join(ROOT, 'assets', 'brand', 'face.jpg')) || dataUrl(join(ROOT, 'assets', 'brand', 'profile.jpg'));

const autoOn = auto.inputFolderId && !String(auto.inputFolderId).startsWith('PUT_') && (auto.delivery === 'drive');
const modules = [
  { name: '썸네일 생성', sub: '유튜브·인스타 9:16 · 표지 문구 영상 연동', state: 'done' },
  { name: '영상 편집', sub: '채널별 편집점 · 다양한 자막·무빙·엔딩 명함', state: 'done' },
  { name: '무인 자동화', sub: '구글드라이브 자동저장 · 매일 06:00', state: autoOn ? 'done' : 'wait' },
  { name: '블로그', sub: '네이버+구글 · 글쓰기 AI키 등록 대기', state: 'wait' },
];
const badge = { done: ['●', '#16a34a', '작동'], wait: ['◐', '#f59e0b', '대기'], todo: ['○', '#94a3b8', '예정'] };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 영상 자동화 폴더 링크 (업로드=원본, 완성본=결과물)
const uploadFolderUrl = auto.inputFolderId && !String(auto.inputFolderId).startsWith('PUT_') ? `https://drive.google.com/drive/folders/${auto.inputFolderId}` : '';
const outputFolderUrl = links.video?.folder || (auto.outputFolderId ? `https://drive.google.com/drive/folders/${auto.outputFolderId}` : '');

// 운영 현황(시트1) 본문
const opsHtml = `
  <div class="opcards">
    ${modules.map((m) => { const b = badge[m.state]; return `<div class="opcard"><div class="nm">${esc(m.name)}</div><div class="sb">${esc(m.sub)}</div><div class="ost" style="color:${b[1]}">${b[0]} ${b[2]}</div></div>`; }).join('')}
  </div>

  <div class="sec-title">🎬 영상·썸네일 자동화 폴더 <span class="subtag">원본을 올리면 매일 06:00 자동 편집·썸네일 → 완성본 저장</span></div>
  <div class="optwo">
    <div class="panel"><h2>📤 원본 업로드 폴더</h2>
      <div class="muted" style="font-size:13px;margin-bottom:12px;line-height:1.6">촬영한 영상을 <b>여기에 올리면</b> 자동으로 편집됩니다.<br>파일명 예시: <b>0701</b> (날짜) · 여러 개면 0701-1, 0701-2</div>
      ${uploadFolderUrl ? `<a class="btn primary" href="${uploadFolderUrl}" target="_blank">📂 업로드 폴더 열기</a>` : '<div class="muted">미설정 (automation.json 의 inputFolderId 확인)</div>'}
    </div>
    <div class="panel"><h2>📥 완성본 폴더</h2>
      <div class="muted" style="font-size:13px;margin-bottom:12px;line-height:1.6">결과물이 <b>날짜 폴더</b>로 저장됩니다.<br>채널별 영상 2 + 썸네일 2 = <b>4종</b> (유튜브 숏츠·인스타 릴스)</div>
      ${outputFolderUrl ? `<a class="btn primary" href="${outputFolderUrl}" target="_blank">📂 완성본 폴더 열기</a>` : '<div class="muted">첫 자동 실행 후 생성됩니다</div>'}
    </div>
  </div>

  <div class="sec-title">📥 다운로드 (구글드라이브) <span class="subtag">받아서 각 채널에 업로드</span></div>
  <div class="optwo">
    <div class="panel"><h2>🎬 영상 완성본 ${links.video?.latestName ? `<span class="subtag">· ${esc(links.video.latestName)}</span>` : ''}</h2>
      ${links.video?.folder ? `<a class="btn primary" href="${links.video.folder}" target="_blank">📂 영상 완성본 폴더 열기</a>` : '<div class="muted">아직 없음</div>'}
      ${(links.video?.items || []).map((f) => `<div class="kv"><a href="${f.link}" target="_blank" style="color:#cfe0ff;text-decoration:none;font-size:13px">⬇️ ${esc(f.name)}</a></div>`).join('')}
    </div>
    <div class="panel"><h2>✍️ 블로그 원고 ${links.blog?.latestName ? `<span class="subtag">· ${esc(links.blog.latestName)}</span>` : ''}</h2>
      ${links.blog?.folder ? `<a class="btn primary" href="${links.blog.folder}" target="_blank">📂 블로그 원고 폴더 열기</a>` : '<div class="muted">원고는 「블로그 관제실」 시트에서 바로 다운로드</div>'}
      ${(links.blog?.items || []).map((f) => `<div class="kv"><a href="${f.link}" target="_blank" style="color:#cfe0ff;text-decoration:none;font-size:13px">⬇️ ${esc(f.name)}</a></div>`).join('')}
      <div style="margin-top:14px"><button class="btn" onclick="showSheet('blog')">🗂️ 블로그 관제실 시트 열기 →</button></div>
    </div>
  </div>

  <div class="sec-title">🎬 채널별 영상 <span class="subtag">같은 원본 → 채널에 맞게 다른 편집점·자막</span></div>
  <div class="panel">
    <div class="vid"><div class="lbl">유튜브 숏츠 <span>풀버전 · ${ytDur ?? '–'}초 · 차분한 빌드업</span></div>${ytStrip ? `<img src="${ytStrip}">` : '<div class="muted">미리보기 없음</div>'}</div>
    <div class="vid"><div class="lbl">인스타 릴스 <span>훅 먼저 · ${igDur ?? '–'}초 · 짧고 빠르게</span></div>${igStrip ? `<img src="${igStrip}">` : '<div class="muted">미리보기 없음</div>'}</div>
  </div>

  <div class="sec-title">🖼️ 썸네일 (유튜브 ≠ 인스타) <span class="subtag">시작 3초에 같은 문구가 영상에 이어짐</span></div>
  <div class="panel"><div class="opthumb">
    <div class="col"><div class="muted" style="margin-bottom:8px">인스타 (하단 배치)</div>${thumbIG ? `<img src="${thumbIG}">` : ''}</div>
    <div class="col"><div class="muted" style="margin-bottom:8px">유튜브 (중앙 배치)</div>${thumbYT ? `<img src="${thumbYT}">` : ''}</div>
  </div></div>

  <div class="sec-title">📦 자동화 현황</div>
  <div class="optwo">
    <div class="panel"><h2>영상 파이프라인</h2>
      <div class="kv"><span class="muted">입력</span><b>드라이브 「raw 업로드」 폴더</b></div>
      <div class="kv"><span class="muted">저장</span><b>드라이브 「완성본」/날짜 폴더</b></div>
      <div class="kv"><span class="muted">출력 파일</span><b>채널별 영상 2 + 썸네일 2 = 4개</b></div>
      <div class="kv"><span class="muted">실행</span><b>매일 06:00(KST) + 수동</b></div>
      <div class="kv"><span class="muted">저장 방식</span><b style="color:${autoOn ? '#46d68a' : '#f0b753'}">${autoOn ? '구글드라이브 자동저장(연결됨)' : '미설정'}</b></div>
      <div class="kv"><span class="muted">처리한 영상</span><b>${processed.length}건</b></div>
    </div>
    <div class="panel"><h2>편집 구성</h2>
      <div class="kv"><span class="muted">비율</span><b>${vstyle.width}×${vstyle.height} (9:16)</b></div>
      <div class="kv"><span class="muted">자막 스타일</span><b>표지훅·상단·하단·중앙·세로바</b></div>
      <div class="kv"><span class="muted">중간 비는 구간</span><b>줌 무빙 + 이모지</b></div>
      <div class="kv"><span class="muted">엔딩</span><b>명함 장면 (감사 인사)</b></div>
      <div class="kv"><span class="muted">폰트</span><b>Pretendard (애플풍)</b></div>
      <div style="margin-top:10px">${(auto.greetings || []).map((g) => `<span class="pill">${esc(g.line2)} ${esc(g.line3)}</span>`).join('')}</div>
    </div>
  </div>

  <div class="sec-title">🔗 연동</div>
  <div class="panel">
    <div class="kv"><span class="muted">유튜브</span><b>@hyundai_moomoo</b></div>
    <div class="kv"><span class="muted">인스타그램</span><b>@hyundai_moomoo (홈페이지 연동)</b></div>
    <div class="kv"><span class="muted">카카오 상담</span><b>오픈채팅 연결 (홈페이지 버튼)</b></div>
    <div class="kv"><span class="muted">홈페이지</span><b>leejiho-pslab.github.io/moomoo</b></div>
  </div>`;

const switchJs = `
function showSheet(s){
  document.querySelectorAll('.sheet').forEach(el=>el.classList.toggle('on', el.id==='sheet-'+s));
  document.querySelectorAll('.snav').forEach(b=>b.classList.toggle('on', b.dataset.s===s));
  window.scrollTo(0,0);
}
document.querySelectorAll('.snav').forEach(b=>b.onclick=()=>showSheet(b.dataset.s));
`;

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>김무겸 콘텐츠 관제실</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans CJK KR','Noto Sans KR',sans-serif}
 body{background:#0a0e17;color:#e8ecf6;padding:28px 20px 80px}
 .wrap{max-width:1180px;margin:0 auto}
 .hd{display:flex;align-items:center;gap:16px}
 .hd img{width:60px;height:60px;border-radius:50%;object-fit:cover;object-position:50% 30%;border:2px solid #2a3a6b}
 .hd h1{font-size:26px;font-weight:900;letter-spacing:-1px}.hd p{color:#8a98b8;font-size:14px;margin-top:5px}
 .sheetnav{display:flex;gap:8px;margin:22px 0 24px;flex-wrap:wrap}
 .snav{background:#121a2e;border:1px solid #1e2740;color:#8a98b8;font-size:15px;font-weight:800;padding:11px 20px;border-radius:12px;cursor:pointer}
 .snav.on{background:linear-gradient(135deg,#3b82f6,#a855f7);color:#fff;border-color:transparent}
 .sheet{display:none}.sheet.on{display:block}
 .subtag{font-size:12px;color:#8a98b8;font-weight:600}
 .opcards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:6px}
 .opcard{background:#121a2e;border:1px solid #1e2740;border-radius:14px;padding:18px}
 .opcard .nm{font-size:17px;font-weight:800}.opcard .sb{color:#8a98b8;font-size:13px;margin-top:6px;line-height:1.4;min-height:34px}
 .opcard .ost{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;background:#0a0e17}
 .optwo{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 .kv{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #1e2740;font-size:14px}
 .kv:last-child{border-bottom:none}.kv b{color:#fff}.muted{color:#8a98b8}
 .vid{margin-bottom:14px}.vid .lbl{font-size:15px;font-weight:800;margin-bottom:10px;display:flex;justify-content:space-between}.vid .lbl span{color:#8a98b8;font-weight:600}
 .vid img{width:100%;border-radius:12px;border:1px solid #1e2740;display:block}
 .opthumb{display:flex;gap:14px}.opthumb .col{flex:1;text-align:center}.opthumb img{height:300px;border-radius:10px;border:1px solid #1e2740}
 .pill{display:inline-block;background:#1c2747;color:#cdd9f5;border-radius:8px;padding:3px 9px;margin:3px 4px 0 0;font-size:12px}
${BLOG_CSS}
 @media(max-width:900px){.opcards{grid-template-columns:repeat(2,1fr)}.optwo{grid-template-columns:1fr}}
</style></head><body>
<div class="wrap">
 <div class="hd">${profile ? `<img src="${profile}">` : ''}
  <div><h1>🛠️ 김무겸 콘텐츠 관제실</h1>
  <p>현대·제네시스 대전선화대리점 카마스터 · @hyundai_moomoo · 영상·썸네일·블로그 한 곳에서</p></div></div>

 <div class="sheetnav">
  <button class="snav on" data-s="ops">📊 운영 현황</button>
  <button class="snav" data-s="blog">🗂️ 블로그 관제실</button>
 </div>

 <section id="sheet-ops" class="sheet on">${opsHtml}</section>
 <section id="sheet-blog" class="sheet">${BLOG_SHEET_HTML}</section>
</div>
${BLOG_OVERLAY}
<script>${switchJs}
${BLOG_CLIENT_JS}</script>
</body></html>`;

const htmlPath = join(out, 'dashboard.html');
writeFileSync(htmlPath, html);
const publishDir = join(ROOT, '..', 'public', 'dashboard');
mkdirSync(publishDir, { recursive: true });
writeFileSync(join(publishDir, 'index.html'), html);

// /blog/ 는 통합 대시보드로 리다이렉트 (이전 링크 404 방지)
const blogDir = join(ROOT, '..', 'public', 'blog');
mkdirSync(blogDir, { recursive: true });
writeFileSync(join(blogDir, 'index.html'), `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=../dashboard/"><title>블로그 관제실 이동</title></head>
<body style="background:#0a0e17;color:#e8ecf6;font-family:sans-serif;text-align:center;padding:80px">
블로그 관제실은 통합 대시보드로 합쳐졌어요. 잠시 후 이동합니다…<br><br>
<a href="../dashboard/" style="color:#6ea8ff">→ 통합 대시보드 열기</a></body></html>`);

const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: join(out, 'dashboard.png'), fullPage: true });
await browser.close();
console.log(`✅ 통합 대시보드 생성 → public/dashboard/index.html (운영 + 블로그 ${blogStats.posts}편/완성 ${blogStats.done})`);
