#!/usr/bin/env node
// 블로그 콘텐츠 관제실 (인터랙티브 HTML 대시보드).
// 주간 기획 + 일일 원고 + 키워드 지수 → self-contained HTML. 카드 클릭 시 모달(본문+복사+다운로드+수정요청).
// 실행: node blog/scripts/blog-dashboard.mjs  → public/blog/index.html

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'output');
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);

const cfg = readJson(join(ROOT, 'config', 'blog-config.json'), {});
const kw = readJson(join(ROOT, 'config', 'keyword-index.json'), { items: [] });
const links = readJson(join(ROOT, '..', 'state', 'drive-links.json'), {});
const plans = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.startsWith('plan-') && f.endsWith('.json')).sort() : [];
const plan = plans.length ? readJson(join(OUT, plans.at(-1)), { days: [] }) : { days: [] };

const CAT = {
  정의형: ['정의', '#3b82f6'], 방법형: ['방법', '#22c55e'], 비교형: ['비교', '#a855f7'],
  후기형: ['후기', '#f59e0b'], 가이드: ['가이드', '#14b8a6'], 소식형: ['소식', '#ef4444'], FAQ형: ['FAQ', '#94a3b8'],
};

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = md.split('\n'); let html = ''; let inTable = false; let inUl = false;
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[이미지: (.+?)\]/g, '<div class="imgph">🖼️ $1</div>')
    .replace(/(#[가-힣A-Za-z0-9_]+)/g, '<span class="tag2">$1</span>');
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\|.*\|$/.test(l)) {
      if (/^[-\s|:]+$/.test(l.replace(/\|/g, ''))) continue;
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (!inTable) { html += '<table>'; inTable = true; }
      html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'; continue;
    } else if (inTable) { html += '</table>'; inTable = false; }
    if (/^### /.test(l)) html += `<h4>${inline(l.slice(4))}</h4>`;
    else if (/^## /.test(l)) html += `<h3>${inline(l.slice(3))}</h3>`;
    else if (/^# /.test(l)) html += `<h2>${inline(l.slice(2))}</h2>`;
    else if (/^> /.test(l)) html += `<blockquote>${inline(l.slice(2))}</blockquote>`;
    else if (/^[-*] /.test(l)) { if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${inline(l.slice(2))}</li>`; }
    else { if (inUl) { html += '</ul>'; inUl = false; } if (l.trim()) html += `<p>${inline(l)}</p>`; }
  }
  if (inUl) html += '</ul>'; if (inTable) html += '</table>';
  return html;
}

const posts = [];
for (const day of plan.days || []) {
  for (const ch of ['naver', 'google']) {
    const p = day.posts[ch]; if (!p) continue;
    const nf = join(OUT, 'posts', `${day.date}_naver.md`);
    const gf = join(OUT, 'posts', `${day.date}_google.html`);
    let bodyHtml = '', plain = '', has = false, raw = '';
    if (ch === 'naver' && existsSync(nf)) { raw = readFileSync(nf, 'utf8'); bodyHtml = mdToHtml(raw); plain = raw; has = true; }
    if (ch === 'google' && existsSync(gf)) { raw = readFileSync(gf, 'utf8'); bodyHtml = raw; plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); has = true; }
    posts.push({ id: `${day.date}_${ch}`, date: day.date, kdate: day.kdate,
      channel: ch === 'naver' ? '네이버 블로그' : '구글 블로그', channelKey: ch,
      cat: p.queryTypeLabel, title: p.title, keyword: p.targetKeyword, outline: p.outline,
      bodyHtml, plain, raw, has });
  }
}

const data = { brand: cfg.persona?.name || '김무겸', email: cfg.persona?.email || '', keywords: kw.items, posts, links: links.blog || null };

// ---- 클라이언트 스크립트 (client-side ${}는 모두 \${} 로 이스케이프) -------
const clientJs = `
const DATA = ${JSON.stringify(data).replace(/</g, "\\u003c")};
const CAT = ${JSON.stringify(CAT).replace(/</g, "\\u003c")};
const driveFolder = DATA.links && DATA.links.folder ? DATA.links.folder : '';
let curCh='all';
const channels=[['all','🏠 전체'],['naver','📘 네이버 블로그'],['google','🅱 구글 블로그']];
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),1500);}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function renderTabs(){
  document.getElementById('tabs').innerHTML=channels.map(c=>'<button class="tab '+(c[0]===curCh?'on':'')+'" data-k="'+c[0]+'">'+c[1]+'</button>').join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{curCh=b.dataset.k;renderTabs();renderGrid();renderStats();});
}
function filtered(){return DATA.posts.filter(p=>curCh==='all'||p.channelKey===curCh);}
function renderStats(){
  const f=filtered();
  const cards=[['발행 대기',f.length],['원고 완성',f.filter(p=>p.has).length],['발행됨',0],['채널',curCh==='all'?'2':'1'],['주간 편수',DATA.posts.length]];
  document.getElementById('stats').innerHTML=cards.map(c=>'<div class="stat"><div class="v">'+c[1]+'</div><div class="l">'+c[0]+'</div></div>').join('');
}
function coverGrad(cat){const c=(CAT[cat]||['','#1a2a63'])[1];return 'linear-gradient(150deg,'+c+'33,#0e1838)';}
function renderGrid(){
  const f=filtered();document.getElementById('cnt').textContent=f.length;
  document.getElementById('grid').innerHTML=f.map(p=>{
    const cat=CAT[p.cat]||['글','#3b82f6'];const idx=DATA.posts.indexOf(p);
    return '<div class="card" data-i="'+idx+'"><div class="cover" style="background:'+coverGrad(p.cat)+'">'
      +'<span class="cat" style="background:'+cat[1]+'">'+cat[0]+'</span><div class="t">'+esc(p.title)+'</div></div>'
      +'<div class="cbody"><div class="meta">'+p.kdate+' · '+p.channel+'</div>'
      +'<div class="ex">키워드 #'+esc(p.keyword)+'</div>'
      +'<div class="foot"><span class="badge '+(p.has?'ok':'wait')+'">'+(p.has?'원고 완성':'원고 대기')+'</span><span style="color:#6ea8ff;font-size:12px">클릭 →</span></div></div></div>';
  }).join('');
  document.querySelectorAll('.card').forEach(c=>c.onclick=()=>openModal(+c.dataset.i));
}
function openModal(i){
  const p=DATA.posts[i];
  const body=p.has?'<div class="doc">'+p.bodyHtml+'</div>'
    :'<div class="doc"><p style="color:#8a98b8">아직 원고가 생성되지 않았어요. (매일 자동 생성 예정) 아래는 기획 구성입니다.</p><ul class="outline">'+p.outline.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ul></div>';
  const acts=[];
  if(p.has)acts.push('<button class="btn primary" id="copyBtn">📋 본문 복사</button>');
  if(p.has)acts.push('<button class="btn" id="dlBtn">⬇️ 원고 다운로드</button>');
  if(driveFolder)acts.push('<a class="btn" href="'+driveFolder+'" target="_blank">📂 드라이브 폴더</a>');
  acts.push('<a class="btn" id="fbBtn">✏️ 수정요청</a>');
  document.getElementById('modal').innerHTML='<div class="mh"><div><div class="mt">'+esc(p.title)+'</div>'
    +'<div class="mm">'+p.kdate+' · '+p.channel+' · '+(CAT[p.cat]||['글'])[0]+' · 키워드 #'+esc(p.keyword)+'</div></div>'
    +'<button class="x" onclick="closeModal()">×</button></div>'+body+'<div class="actions">'+acts.join('')+'</div>';
  const fb=document.getElementById('fbBtn');
  fb.href='mailto:'+DATA.email+'?subject='+encodeURIComponent('[수정요청] '+p.title)+'&body='+encodeURIComponent('수정 요청 사항:\\n\\n(여기에 적어주세요)\\n\\n— '+p.kdate+' '+p.channel);
  if(p.has){
    document.getElementById('copyBtn').onclick=()=>{navigator.clipboard.writeText(p.plain);toast('본문을 복사했어요');};
    document.getElementById('dlBtn').onclick=()=>{const ext=p.channelKey==='naver'?'md':'html';const blob=new Blob([p.raw],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=p.id+'.'+ext;a.click();toast('원고를 다운로드했어요');};
  }
  document.getElementById('mask').classList.add('on');
}
function closeModal(){document.getElementById('mask').classList.remove('on');}
document.getElementById('mask').onclick=e=>{if(e.target.id==='mask')closeModal();};
renderTabs();renderStats();renderGrid();
`;

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.brand} 콘텐츠 관제실 · 블로그</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif}
 body{background:#0a0e17;color:#e8ecf6;padding:28px 20px 80px}
 .wrap{max-width:1180px;margin:0 auto}
 .hd h1{font-size:26px;font-weight:900;letter-spacing:-1px}.hd p{color:#8a98b8;font-size:14px;margin-top:6px}
 .tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #1e2740;margin:22px 0 24px}
 .tab{background:none;border:none;color:#8a98b8;font-size:15px;font-weight:700;padding:12px 16px;cursor:pointer;border-bottom:2px solid transparent}
 .tab.on{color:#fff;border-bottom-color:#3b82f6}
 .panel{background:#121a2e;border:1px solid #1e2740;border-radius:16px;padding:22px;margin-bottom:18px}
 .panel h2{font-size:17px;font-weight:800;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px}
 .btn{background:#1c2747;color:#cdd9f5;border:1px solid #2b3a63;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
 .btn.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}
 .chips span{display:inline-block;background:#1c2747;color:#aebfe6;border-radius:8px;padding:5px 11px;margin:4px 6px 0 0;font-size:13px}
 .note{color:#8a98b8;font-size:13px;line-height:1.7;margin-top:12px}
 .cards5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
 .stat{background:#121a2e;border:1px solid #1e2740;border-radius:14px;padding:18px}
 .stat .v{font-size:30px;font-weight:900}.stat .l{color:#8a98b8;font-size:13px;margin-top:4px}
 table.kt{width:100%;border-collapse:collapse;font-size:14px}
 table.kt th{text-align:left;color:#8a98b8;font-weight:600;padding:10px 8px;border-bottom:1px solid #1e2740}
 table.kt td{padding:11px 8px;border-bottom:1px solid #161f33}
 .comp{font-weight:700}.comp.보통{color:#f59e0b}.comp.높음{color:#ef4444}.comp.낮음{color:#22c55e}
 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
 .card{background:#121a2e;border:1px solid #1e2740;border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s}
 .card:hover{transform:translateY(-3px);border-color:#3b82f6}
 .cover{height:150px;padding:16px;display:flex;flex-direction:column;justify-content:space-between}
 .cover .cat{align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:1px;color:#fff;padding:3px 9px;border-radius:6px}
 .cover .t{font-size:19px;font-weight:800;line-height:1.25;letter-spacing:-1px;color:#fff}
 .cbody{padding:14px}.cbody .meta{font-size:12px;color:#8a98b8;margin-bottom:6px}
 .cbody .ex{font-size:13px;color:#c3cde6;line-height:1.5;height:20px;overflow:hidden}
 .cbody .foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
 .badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px}
 .badge.ok{background:#163a2a;color:#46d68a}.badge.wait{background:#3a2e16;color:#f0b753}
 .sec-title{font-size:18px;font-weight:800;margin:26px 0 14px}
 .empty{color:#8a98b8;text-align:center;padding:30px}
 .mask{position:fixed;inset:0;background:rgba(4,7,14,.8);display:none;align-items:flex-start;justify-content:center;padding:30px 16px;overflow:auto;z-index:10}
 .mask.on{display:flex}
 .modal{background:#0e1626;border:1px solid #243056;border-radius:18px;max-width:780px;width:100%;padding:26px}
 .modal .mh{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:6px}
 .modal .mt{font-size:22px;font-weight:900;letter-spacing:-1px;line-height:1.3}.modal .mm{color:#8a98b8;font-size:13px;margin:6px 0 18px}
 .x{background:none;border:none;color:#8a98b8;font-size:24px;cursor:pointer;line-height:1}
 .doc{background:#0a1120;border:1px solid #1c2740;border-radius:12px;padding:22px;line-height:1.75;font-size:15px}
 .doc h1{font-size:23px;margin:6px 0 12px}.doc h2{font-size:21px;margin:8px 0 12px}.doc h3{font-size:18px;margin:20px 0 8px;color:#cfe0ff}.doc h4{font-size:16px;margin:14px 0 6px}
 .doc p{margin:9px 0;color:#dbe4f7}.doc strong{color:#fff}.doc ul{margin:8px 0 8px 20px}.doc li{margin:4px 0}
 .doc table{width:100%;border-collapse:collapse;margin:12px 0}.doc td,.doc th{border:1px solid #25304d;padding:8px 10px;font-size:14px}
 .doc blockquote{border-left:4px solid #3b82f6;background:#10182b;padding:10px 14px;margin:12px 0;border-radius:6px;color:#cfe0ff}
 .doc .imgph{background:#11203a;border:1px dashed #2b3a63;color:#9fb6e6;padding:14px;border-radius:8px;margin:10px 0;font-size:13px}
 .doc .tag2{color:#6ea8ff}.doc a{color:#6ea8ff}
 .outline li{margin:6px 0;color:#c3cde6}
 .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
 .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:#04210f;font-weight:800;padding:10px 18px;border-radius:10px;opacity:0;transition:opacity .2s;z-index:20}
 .toast.on{opacity:1}
 @media(max-width:900px){.cards5{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(2,1fr)}}
 @media(max-width:560px){.grid{grid-template-columns:1fr}}
</style></head><body>
<div class="wrap">
 <div class="hd"><h1>🛠️ ${data.brand} 콘텐츠 관제실 · 블로그</h1>
 <p>채널별 현황 · 발행/대기 · 기획안 · 키워드 지수 · 포스팅 클릭 시 본문·다운로드·수정요청</p></div>
 <div class="tabs" id="tabs"></div>
 <div class="panel"><h2>📋 기획안 <a class="btn" href="mailto:${data.email}?subject=${encodeURIComponent('[기획안 피드백] 블로그 주간 기획')}">✏️ 기획안 피드백</a></h2>
   <div class="chips">${data.keywords.map((k) => `<span>#${k.kw.replace(/\s/g, '')}</span>`).join('')}</div>
   <div class="note">말투: 11년차 카마스터 1인칭 · 경험 기반(E-E-A-T), 과장 없이 신뢰감 있게 · AI 느낌 최소화.<br>
   디자인: 네이비+화이트 · 포인트 옐로 · Pretendard(애플풍) · GEO 체크리스트 26항목 반영.</div>
 </div>
 <div class="cards5" id="stats"></div>
 <div class="panel"><h2>📊 블로그 지수 (키워드) <span style="font-size:12px;color:#8a98b8;font-weight:600">내부 추정 · 네이버 연동 시 실측 교체</span></h2>
   <table class="kt"><thead><tr><th>키워드</th><th>월 검색지수</th><th>경쟁도</th></tr></thead><tbody>
   ${data.keywords.map((k) => `<tr><td>#${k.kw}</td><td>${k.vol.toLocaleString()}</td><td class="comp ${k.comp}">${k.comp}</td></tr>`).join('')}
   </tbody></table></div>
 <div class="sec-title">🕐 발행 대기 콘텐츠 (<span id="cnt">0</span>)</div>
 <div class="grid" id="grid"></div>
 <div class="sec-title">✅ 발행된 콘텐츠 (0)</div>
 <div class="panel"><div class="empty">아직 발행된 콘텐츠가 없습니다. (게시 후 채널 연동 시 자동 표시)</div></div>
</div>
<div class="mask" id="mask"><div class="modal" id="modal"></div></div>
<div class="toast" id="toast"></div>
<script>${clientJs}</script></body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'blog-dashboard.html'), html);
const pub = join(ROOT, '..', '..', 'public', 'blog');
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'index.html'), html);
console.log(`✅ 블로그 관제실 → public/blog/index.html (포스트 ${posts.length}개, 원고완성 ${posts.filter((p) => p.has).length}개)`);
