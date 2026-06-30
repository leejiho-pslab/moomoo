#!/usr/bin/env node
// 미디어 자동화 대시보드 생성기 (현재 파이프라인 기준).
// config/state/실제 결과물(output/yt.mp4, ig.mp4, 썸네일)을 읽어 한 장의 HTML+PNG 대시보드를 만든다.
// 실행: node scripts/dashboard.mjs → output/dashboard.html, output/dashboard.png, public/dashboard/index.html

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
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

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Pretendard','Noto Sans CJK KR',sans-serif}
  body{background:#0b1020;color:#e8ecf6;width:1240px;padding:40px}
  .head{display:flex;align-items:center;gap:18px;margin-bottom:10px}
  .head img{width:64px;height:64px;border-radius:50%;object-fit:cover;object-position:50% 30%;border:2px solid #2a3a6b}
  .head h1{font-size:30px;font-weight:900;letter-spacing:-1px}.head p{color:#9fb0d6;margin-top:4px;font-size:15px}
  .upd{color:#6b7aa3;font-size:13px;margin-bottom:24px}
  .grid{display:grid;gap:18px}.cards{grid-template-columns:repeat(4,1fr)}
  .card{background:#141b33;border:1px solid #243056;border-radius:16px;padding:20px}
  .card .nm{font-size:18px;font-weight:800}.card .sb{color:#9fb0d6;font-size:13px;margin-top:6px;line-height:1.4;min-height:36px}
  .st{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;background:#0b1020}
  h2{font-size:20px;font-weight:800;margin:34px 0 14px;display:flex;align-items:center;gap:10px}
  h2 .tag{font-size:12px;color:#9fb0d6;font-weight:600}
  .panel{background:#141b33;border:1px solid #243056;border-radius:16px;padding:22px}
  .vid{margin-bottom:16px}.vid .lbl{font-size:15px;font-weight:800;margin-bottom:10px;display:flex;justify-content:space-between}
  .vid .lbl span{color:#9fb0d6;font-weight:600}
  .vid img{width:100%;border-radius:12px;border:1px solid #243056;display:block}
  .two{grid-template-columns:1fr 1fr}
  .thumbrow{display:flex;gap:14px}.thumbrow .col{flex:1;text-align:center}
  .thumbrow img{height:300px;border-radius:10px;border:1px solid #243056}
  .kv{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #243056;font-size:14px}
  .kv:last-child{border-bottom:none}.kv b{color:#fff}.muted{color:#9fb0d6}
  .pill{display:inline-block;background:#1c2747;color:#cdd9f5;border-radius:8px;padding:3px 9px;margin:3px 4px 0 0;font-size:12px}
  .foot{margin-top:30px;color:#6b7aa3;font-size:12px;text-align:center}
</style></head><body>
  <div class="head">
    ${profile ? `<img src="${profile}">` : ''}
    <div><h1>김무겸 미디어 자동화 대시보드</h1>
    <p>현대·제네시스 대전선화대리점 카마스터 · @hyundai_moomoo</p></div>
  </div>
  <div class="upd">상태: 영상 자동화 가동 중 (유튜브·인스타 채널별 편집 → 구글드라이브 자동저장)</div>

  <div class="grid cards">
    ${modules.map((m) => { const b = badge[m.state]; return `<div class="card"><div class="nm">${esc(m.name)}</div><div class="sb">${esc(m.sub)}</div><div class="st" style="color:${b[1]}">${b[0]} ${b[2]}</div></div>`; }).join('')}
  </div>

  <h2>📥 다운로드 (구글드라이브) <span class="tag">받아서 각 채널에 업로드</span></h2>
  <div class="grid two">
    <div class="panel"><h3 style="font-size:16px;font-weight:800;margin-bottom:12px">🎬 영상 완성본 ${links.video?.latestName ? `· ${esc(links.video.latestName)}` : ''}</h3>
      ${links.video?.folder ? `<a href="${links.video.folder}" target="_blank" style="display:inline-block;background:#14246B;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:10px;margin-bottom:12px">📂 영상 완성본 폴더 열기</a>` : '<div class="muted">아직 없음</div>'}
      ${(links.video?.items || []).map((f) => `<div class="kv"><a href="${f.link}" target="_blank" style="color:#cfe0ff;text-decoration:none;font-size:13px">⬇️ ${esc(f.name)}</a></div>`).join('')}
    </div>
    <div class="panel"><h3 style="font-size:16px;font-weight:800;margin-bottom:12px">✍️ 블로그 원고 ${links.blog?.latestName ? `· ${esc(links.blog.latestName)}` : ''}</h3>
      ${links.blog?.folder ? `<a href="${links.blog.folder}" target="_blank" style="display:inline-block;background:#14246B;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:10px;margin-bottom:12px">📂 블로그 원고 폴더 열기</a>` : '<div class="muted">아직 없음</div>'}
      ${(links.blog?.items || []).map((f) => `<div class="kv"><a href="${f.link}" target="_blank" style="color:#cfe0ff;text-decoration:none;font-size:13px">⬇️ ${esc(f.name)}</a></div>`).join('')}
      <a href="../blog/" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#3b82f6,#a855f7);color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 18px;border-radius:10px">🗂️ 블로그 콘텐츠 관제실 열기 →</a>
    </div>
  </div>

  <h2>🎬 채널별 영상 <span class="tag">같은 원본 → 채널에 맞게 다른 편집점·자막</span></h2>
  <div class="panel">
    <div class="vid"><div class="lbl">유튜브 숏츠 <span>풀버전 · ${ytDur ?? '–'}초 · 차분한 빌드업</span></div>${ytStrip ? `<img src="${ytStrip}">` : '<div class="muted">미리보기 없음</div>'}</div>
    <div class="vid"><div class="lbl">인스타 릴스 <span>훅 먼저 · ${igDur ?? '–'}초 · 짧고 빠르게</span></div>${igStrip ? `<img src="${igStrip}">` : '<div class="muted">미리보기 없음</div>'}</div>
  </div>

  <h2>🖼️ 썸네일 (유튜브 ≠ 인스타) <span class="tag">시작 3초에 같은 문구가 영상에 이어짐</span></h2>
  <div class="panel"><div class="thumbrow">
    <div class="col"><div class="muted" style="margin-bottom:8px">인스타 (하단 배치)</div>${thumbIG ? `<img src="${thumbIG}">` : ''}</div>
    <div class="col"><div class="muted" style="margin-bottom:8px">유튜브 (중앙 배치)</div>${thumbYT ? `<img src="${thumbYT}">` : ''}</div>
  </div></div>

  <h2>📦 자동화 현황</h2>
  <div class="grid two">
    <div class="panel"><h3 style="font-size:16px;font-weight:800;margin-bottom:12px">영상 파이프라인</h3>
      <div class="kv"><span class="muted">입력</span><b>드라이브 「raw 업로드」 폴더</b></div>
      <div class="kv"><span class="muted">저장</span><b>드라이브 「완성본」/날짜 폴더</b></div>
      <div class="kv"><span class="muted">출력 파일</span><b>채널별 영상 2 + 썸네일 2 = 4개</b></div>
      <div class="kv"><span class="muted">실행</span><b>매일 06:00(KST) + 수동</b></div>
      <div class="kv"><span class="muted">저장 방식</span><b style="color:${autoOn ? '#16a34a' : '#f59e0b'}">${autoOn ? '구글드라이브 자동저장(연결됨)' : '미설정'}</b></div>
      <div class="kv"><span class="muted">처리한 영상</span><b>${processed.length}건</b></div>
    </div>
    <div class="panel"><h3 style="font-size:16px;font-weight:800;margin-bottom:12px">편집 구성</h3>
      <div class="kv"><span class="muted">비율</span><b>${vstyle.width}×${vstyle.height} (9:16)</b></div>
      <div class="kv"><span class="muted">자막 스타일</span><b>표지훅·상단·하단·중앙·세로바</b></div>
      <div class="kv"><span class="muted">중간 비는 구간</span><b>줌 무빙 + 이모지</b></div>
      <div class="kv"><span class="muted">엔딩</span><b>명함 장면 (감사 인사)</b></div>
      <div class="kv"><span class="muted">폰트</span><b>Pretendard (애플풍)</b></div>
      <div style="margin-top:10px">${(auto.greetings || []).map((g) => `<span class="pill">${esc(g.line2)} ${esc(g.line3)}</span>`).join('')}</div>
    </div>
  </div>

  <h2>🔗 연동</h2>
  <div class="panel">
    <div class="kv"><span class="muted">유튜브</span><b>@hyundai_moomoo</b></div>
    <div class="kv"><span class="muted">인스타그램</span><b>@hyundai_moomoo (홈페이지 연동)</b></div>
    <div class="kv"><span class="muted">카카오 상담</span><b>오픈채팅 연결 (홈페이지 버튼)</b></div>
    <div class="kv"><span class="muted">홈페이지</span><b>leejiho-pslab.github.io/moomoo</b></div>
  </div>

  <div class="foot">미리보기는 최근 생성 결과 기준 · 매 실행 시 자동 갱신됩니다</div>
</body></html>`;

const htmlPath = join(out, 'dashboard.html');
writeFileSync(htmlPath, html);
const publishDir = join(ROOT, '..', 'public', 'dashboard');
mkdirSync(publishDir, { recursive: true });
writeFileSync(join(publishDir, 'index.html'), html);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);
await page.screenshot({ path: join(out, 'dashboard.png'), fullPage: true });
await browser.close();
console.log('✅ 대시보드 생성 → output/dashboard.png + public/dashboard/index.html');
