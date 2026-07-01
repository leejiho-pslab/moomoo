#!/usr/bin/env node
// 블로그 이미지 생성 + 삽입기.
// - 원고(output/posts/*.md, *.html)에 본문과 연결되는 이미지 3장 이상을 자동 삽입한다.
//   1) 차량 이미지(현대 공식): blog/assets/cars/<파일> 있으면 실제 사진, 없으면 '공식 이미지 자리' 카드
//   2) 핵심 요약 카드(제목·키워드·요점 3)  3) 체크리스트 카드(이 글에서 확인할 내용)
// - 모든 원고 끝에 명함 + 카카오 상담 링크를 항상 붙인다.
// 실행: node blog/scripts/gen-images.mjs            (output/posts 의 모든 원고 처리)
//       node blog/scripts/gen-images.mjs --date 2026-07-06

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { getWriteDrive, getReadDrive, hasOAuth, downloadFile } from '../../scripts/drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME_ENV = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = existsSync(CHROME_ENV) ? CHROME_ENV : undefined; // 없으면 playwright 기본 브라우저 사용(CI)
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);

const cfg = readJson(join(ROOT, 'config', 'blog-config.json'), {});
const carCfg = readJson(join(ROOT, 'config', 'car-images.json'), { models: {} });
const KAKAO = 'https://open.kakao.com/o/scFQTHBi';
const PHONE = cfg.persona?.phone || '010-8033-3522';
const STORE = cfg.persona?.store || '현대자동차 대전선화대리점';
const NAME = cfg.persona?.name || '김무겸';

const outPosts = join(ROOT, 'output', 'posts');
const outImgs = join(ROOT, 'output', 'images');
mkdirSync(outImgs, { recursive: true });

// 최신 plan 로드 (구조화된 제목/키워드/구성/모델)
const outDir = join(ROOT, 'output');
const plans = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.startsWith('plan-') && f.endsWith('.json')).sort() : [];
const plan = plans.length ? readJson(join(outDir, plans.at(-1)), { days: [] }) : { days: [] };
const planByDate = {};
for (const d of plan.days || []) planByDate[d.date] = d;

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const onlyDate = arg('date');

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dataUrl(p) {
  if (!existsSync(p)) return '';
  const ext = p.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}

const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans CJK KR',sans-serif";
const frame = (inner, bg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
 *{margin:0;padding:0;box-sizing:border-box;font-family:${FONT};-webkit-font-smoothing:antialiased}
 body{width:1200px;height:675px;overflow:hidden;background:${bg};color:#0b1020}
 .pad{padding:64px 68px;height:100%;display:flex;flex-direction:column}
</style></head><body>${inner}</body></html>`;

// 차량 이미지가 로컬에 없으면 사장님 드라이브 폴더(차종별)에서 가져와 캐시한다.
async function ensureCarImage(model) {
  const m = carCfg.models?.[model];
  if (!m) return;
  const dest = join(ROOT, 'assets', 'cars', m.file);
  if (existsSync(dest)) return;          // 이미 있음
  if (!m.driveFolderId) return;          // 소스 폴더 지정 없음
  let drive;
  try { drive = hasOAuth() ? getWriteDrive() : getReadDrive(); } catch { return; } // 인증정보 없으면 자리카드로
  try {
    const res = await drive.files.list({
      q: `'${m.driveFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, mimeType)', pageSize: 10,
      supportsAllDrives: true, includeItemsFromAllDrives: true,
    });
    const f = (res.data.files || [])[0];
    if (!f) return;
    await downloadFile(drive, f.id, dest);
    console.log(`  ↳ ${model}: 드라이브에서 차량 이미지 가져옴 (${f.name})`);
  } catch (e) { console.log(`  ↳ ${model}: 드라이브 이미지 가져오기 실패 — ${e.message}`); }
}

// 1) 차량(현대 공식) 이미지 카드
function carHtml(model) {
  const m = carCfg.models?.[model];
  const file = m ? join(ROOT, 'assets', 'cars', m.file) : null;
  if (m && file && existsSync(file)) {
    return frame(`<div style="position:relative;width:100%;height:100%;background:#fff;display:flex;align-items:center;justify-content:center">
      <img src="${dataUrl(file)}" style="max-width:88%;max-height:74%;object-fit:contain">
      <div style="position:absolute;left:0;right:0;bottom:0;padding:22px 40px;background:linear-gradient(0deg,rgba(8,16,40,.9),rgba(8,16,40,0));color:#fff">
        <div style="font-size:32px;font-weight:900;letter-spacing:-1px">${esc(model)}</div>
        <div style="font-size:16px;color:#cfe0ff;margin-top:4px">${esc(carCfg.brandCaption || STORE)}</div>
      </div></div>`, '#ffffff');
  }
  // 파일 없을 때: '공식 이미지 자리' 안내 카드
  const url = m?.url || cfg.hyundai?.homepage || 'hyundai.com';
  return frame(`<div class="pad" style="background:linear-gradient(135deg,#0e1d52,#14246B);color:#fff;justify-content:center;align-items:center;text-align:center;height:100%">
      <div style="font-size:22px;font-weight:800;color:#9fc0ff;letter-spacing:2px">HYUNDAI · GENESIS 공식 이미지 자리</div>
      <div style="font-size:64px;font-weight:900;letter-spacing:-2px;margin:18px 0 10px">🚗 ${esc(model)}</div>
      <div style="font-size:19px;color:#cdd9f5;line-height:1.6">이 자리에 현대 공식 <b>${esc(model)}</b> 이미지를 넣어주세요<br>
      <span style="font-size:16px;color:#8fb0ff">${esc(url)}</span></div>
    </div>`, '#14246B');
}

// 2) 핵심 요약 카드
function summaryHtml(post) {
  const points = (post.outline || []).filter((o) => !/자주|FAQ|정리|상담/i.test(o)).slice(0, 3);
  return frame(`<div class="pad" style="background:#f5f7fc">
    <div style="font-size:19px;font-weight:800;color:#14246B;letter-spacing:1px">✔ 핵심 요약</div>
    <div style="font-size:40px;font-weight:900;letter-spacing:-1.5px;line-height:1.25;margin:14px 0 6px;color:#0b1020">${esc(post.title)}</div>
    <div style="display:inline-block;align-self:flex-start;background:#14246B;color:#fff;font-size:17px;font-weight:700;padding:7px 15px;border-radius:9px;margin-bottom:22px">#${esc(post.targetKeyword)}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      ${points.map((p, i) => `<div style="display:flex;gap:14px;align-items:flex-start">
        <div style="flex:none;width:38px;height:38px;border-radius:50%;background:#14246B;color:#fff;font-size:19px;font-weight:900;display:flex;align-items:center;justify-content:center">${i + 1}</div>
        <div style="font-size:24px;font-weight:700;color:#1a2440;line-height:1.4;padding-top:3px">${esc(p)}</div></div>`).join('')}
    </div>
    <div style="margin-top:auto;font-size:16px;color:#5b6b90">${esc(STORE)} · ${esc(NAME)} 카마스터</div>
  </div>`, '#f5f7fc');
}

// 3) 체크리스트 카드
function checklistHtml(post) {
  const items = (post.outline || []).slice(0, 5);
  return frame(`<div class="pad" style="background:#fff">
    <div style="font-size:19px;font-weight:800;color:#14246B;letter-spacing:1px">📋 이 글에서 확인할 내용</div>
    <div style="font-size:34px;font-weight:900;letter-spacing:-1px;margin:12px 0 22px;color:#0b1020">${esc(post.model || post.targetKeyword)} 구매 전 체크</div>
    <div style="display:flex;flex-direction:column;gap:15px">
      ${items.map((it) => `<div style="display:flex;gap:14px;align-items:center">
        <div style="flex:none;width:34px;height:34px;border-radius:9px;background:#eaf0ff;color:#14246B;font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center">✓</div>
        <div style="font-size:23px;font-weight:600;color:#1a2440">${esc(it)}</div></div>`).join('')}
    </div>
    <div style="margin-top:auto;font-size:16px;color:#5b6b90">견적·시승·출고 상담 · ${esc(PHONE)} · 카카오톡 1:1 상담</div>
  </div>`, '#ffffff');
}

async function render(browser, html, outFile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  await page.screenshot({ path: outFile });
  await page.close();
}

// ---- 원고 삽입 ----
function footerMd(id) {
  return `\n\n---\n\n![${esc(NAME)} 카마스터 명함 · ${esc(STORE)}](images/${id}_card.jpg)\n\n`
    + `**💬 카카오톡으로 1:1 상담하기 →** [${KAKAO.replace(/^https?:\/\//, '')}](${KAKAO})\n\n`
    + `📞 ${PHONE} · ${STORE} **${NAME} 카마스터**\n`;
}
function footerHtml(id) {
  return `\n<figure class="bcard"><img src="images/${id}_card.jpg" alt="${esc(NAME)} 카마스터 명함 · ${esc(STORE)}"></figure>\n`
    + `<p class="kakao"><a href="${KAKAO}" target="_blank" rel="noopener">💬 카카오톡으로 1:1 상담하기</a></p>\n`
    + `<p>📞 ${PHONE} · ${STORE} <strong>${NAME} 카마스터</strong></p>\n`;
}

function embedMd(raw, id, imgs) {
  let lines = raw.split('\n').filter((l) => !/^\s*\[이미지\s*:/.test(l.trim()));
  const h2 = []; lines.forEach((l, i) => { if (/^##\s/.test(l)) h2.push(i); });
  const mk = (im) => `![${esc(im.alt)}](images/${id}_${im.key}.png)`;
  const inserts = [];
  inserts.push([h2[0] ?? Math.min(6, lines.length), mk(imgs.car)]);
  if (h2[1] != null) inserts.push([h2[1], mk(imgs.summary)]);
  let faq = lines.findIndex((l) => /^##\s.*(질문|FAQ)/i.test(l));
  if (faq === -1) faq = h2.length > 2 ? h2[h2.length - 1] : lines.length;
  inserts.push([faq, mk(imgs.checklist)]);
  inserts.sort((a, b) => b[0] - a[0]).forEach(([idx, c]) => lines.splice(idx, 0, '', c, ''));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + footerMd(id);
}

function insertAt(html, re, snippet, before = true) {
  const m = html.match(re);
  if (!m) return null;
  const at = before ? m.index : m.index + m[0].length;
  return html.slice(0, at) + snippet + html.slice(at);
}
function embedHtml(raw, id, imgs) {
  const fig = (im) => `\n<figure class="bimg"><img src="images/${id}_${im.key}.png" alt="${esc(im.alt)}"><figcaption>${esc(im.cap)}</figcaption></figure>\n`;
  let html = raw;
  // 차량 이미지: 첫 </p> 뒤
  html = insertAt(html, /<\/p>/i, fig(imgs.car), false) || (fig(imgs.car) + html);
  // 요약: 첫 </section> 뒤 (없으면 두 번째 </p> 뒤)
  html = insertAt(html, /<\/section>/i, fig(imgs.summary), false)
      || insertAt(html, /<\/p>[\s\S]*?<\/p>/i, fig(imgs.summary), false) || html;
  // 체크리스트: FAQ 제목 앞 → </main> 앞 → </article> 앞
  html = insertAt(html, /<h2[^>]*>(?=[^<]*(?:자주|FAQ))/i, fig(imgs.checklist), true)
      || insertAt(html, /<\/main>/i, fig(imgs.checklist), true)
      || insertAt(html, /<\/article>/i, fig(imgs.checklist), true) || (html + fig(imgs.checklist));
  // 스타일 + 푸터
  const style = `\n<style>.bimg{margin:18px 0}.bimg img{width:100%;border-radius:12px}.bimg figcaption{color:#667;font-size:13px;margin-top:6px}.bcard{margin:20px 0}.bcard img{max-width:420px;width:100%;border-radius:12px}.kakao a{display:inline-block;background:#FEE500;color:#191600;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:16px}</style>\n`;
  const foot = footerHtml(id);
  html = insertAt(html, /<\/footer>/i, foot, true)
      || insertAt(html, /<\/article>/i, foot, true) || (html + foot);
  return style + html;
}

const files = existsSync(outPosts) ? readdirSync(outPosts).filter((f) => /\.(md|html)$/.test(f)) : [];
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
let done = 0;
// 공용 명함 이미지 1장 준비
const cardSrc = join(ROOT, '..', 'assets', 'brand', 'business-card.jpg');

for (const f of files) {
  const mDate = f.match(/^(\d{4}-\d{2}-\d{2})_(naver|google)\.(md|html)$/);
  if (!mDate) continue;
  const [, date, channel] = mDate;
  if (onlyDate && date !== onlyDate) continue;
  const post = planByDate[date]?.posts?.[channel];
  if (!post) { console.log(`↷ ${f}: 기획 데이터 없음, 건너뜀`); continue; }
  const id = `${date}_${channel}`;

  const imgs = {
    car: { key: 'car', alt: (carCfg.models?.[post.model]?.alt) || `현대 ${post.model}`, cap: `${post.model} · ${post.targetKeyword}` },
    summary: { key: 'summary', alt: `${post.title} 핵심 요약`, cap: '핵심 요약' },
    checklist: { key: 'checklist', alt: `${post.model || post.targetKeyword} 구매 체크리스트`, cap: '구매 전 체크리스트' },
  };
  await ensureCarImage(post.model);
  await render(browser, carHtml(post.model), join(outImgs, `${id}_car.png`));
  await render(browser, summaryHtml(post), join(outImgs, `${id}_summary.png`));
  await render(browser, checklistHtml(post), join(outImgs, `${id}_checklist.png`));
  if (existsSync(cardSrc)) copyFileSync(cardSrc, join(outImgs, `${id}_card.jpg`));

  const raw = readFileSync(join(outPosts, f), 'utf8');
  if (raw.includes(`images/${id}_car.png`)) { console.log(`= ${id}: 이미 삽입됨(이미지만 갱신)`); done++; continue; }
  const out = channel === 'naver' ? embedMd(raw, id, imgs) : embedHtml(raw, id, imgs);
  writeFileSync(join(outPosts, f), out);
  done++;
  const real = existsSync(join(ROOT, 'assets', 'cars', carCfg.models?.[post.model]?.file || '_')) ? '실제사진' : '자리카드';
  console.log(`✅ ${id}: 이미지 3+명함 삽입 · 차량=${real}`);
}
await browser.close();
console.log(`\n완료. ${done}개 원고에 이미지·명함·카카오 상담을 넣었습니다 → output/posts, output/images`);
