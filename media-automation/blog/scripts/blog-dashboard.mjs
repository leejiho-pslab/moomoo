#!/usr/bin/env node
// 블로그 콘텐츠 관제실 (인터랙티브 HTML 대시보드).
// 주간 기획 + 일일 원고 + 키워드 지수 → self-contained HTML. 카드 클릭 시 모달(본문+복사+다운로드+수정요청).
// 실행: node blog/scripts/blog-dashboard.mjs  → public/blog/index.html

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { argv } from 'node:process';

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
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
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

// 원고 속 images/<파일> 참조를 data URL 로 바꿔 모달에서 바로 보이게 한다.
const IMGDIR = join(OUT, 'images');
function imgDataUrl(file) {
  const p = join(IMGDIR, file);
  if (!existsSync(p)) return '';
  const ext = file.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
}
function embedImgs(html) {
  return html.replace(/src=(["'])images\/([^"']+)\1/g, (m, q, file) => {
    const d = imgDataUrl(file); return d ? `src=${q}${d}${q}` : m;
  });
}

const posts = [];
for (const day of plan.days || []) {
  for (const ch of ['naver', 'google']) {
    const p = day.posts[ch]; if (!p) continue;
    const nf = join(OUT, 'posts', `${day.date}_naver.md`);
    const gf = join(OUT, 'posts', `${day.date}_google.html`);
    let bodyHtml = '', plain = '', has = false, raw = '';
    if (ch === 'naver' && existsSync(nf)) { raw = readFileSync(nf, 'utf8'); bodyHtml = embedImgs(mdToHtml(raw)); plain = raw; has = true; }
    if (ch === 'google' && existsSync(gf)) { raw = readFileSync(gf, 'utf8'); bodyHtml = embedImgs(raw); plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); has = true; }
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
  if(p.has)acts.push('<button class="btn primary" id="wordBtn">📄 워드·한글 저장</button>');
  if(p.has)acts.push('<button class="btn" id="copyBtn">📋 서식 복사</button>');
  if(p.has)acts.push('<button class="btn" id="dlBtn">⬇️ 원문 파일</button>');
  if(driveFolder)acts.push('<a class="btn" href="'+driveFolder+'" target="_blank">📂 드라이브 폴더</a>');
  acts.push('<a class="btn" id="fbBtn">✏️ 수정요청</a>');
  document.getElementById('modal').innerHTML='<div class="mh"><div><div class="mt">'+esc(p.title)+'</div>'
    +'<div class="mm">'+p.kdate+' · '+p.channel+' · '+(CAT[p.cat]||['글'])[0]+' · 키워드 #'+esc(p.keyword)+'</div></div>'
    +'<button class="x" onclick="closeModal()">×</button></div>'+body+'<div class="actions">'+acts.join('')+'</div>';
  const fb=document.getElementById('fbBtn');
  fb.href='mailto:'+DATA.email+'?subject='+encodeURIComponent('[수정요청] '+p.title)+'&body='+encodeURIComponent('수정 요청 사항:\\n\\n(여기에 적어주세요)\\n\\n— '+p.kdate+' '+p.channel);
  if(p.has){
    var BS=String.fromCharCode(92);
    var cleanHtml=function(){var c=document.getElementById('modal').querySelector('.doc').cloneNode(true);var s=c.querySelectorAll('script,style');for(var i=0;i<s.length;i++)s[i].remove();return c.innerHTML;};
    var rtfEsc=function(t){var r='';for(var i=0;i<t.length;i++){var ch=t[i];var c=t.charCodeAt(i);if(ch===BS||ch==='{'||ch==='}')r+=BS+ch;else if(c<128)r+=ch;else{var v=c;if(v>32767)v=v-65536;r+=BS+'u'+v+'?';}}return r;};
    var imgNote=function(el){var alt=(el.getAttribute('alt')||'사진').replace(/\\s+/g,' ').trim();return BS+'par{'+BS+'i '+rtfEsc('🖼 ['+alt+'] — 이미지를 불러오지 못했어요. 드라이브 「이미지」 폴더를 확인해주세요')+'}'+BS+'par ';};
    var imgMap=new Map();
    var waitImg=function(img){return new Promise(function(res){if(img.complete&&img.naturalWidth){res();}else{img.onload=function(){res();};img.onerror=function(){res();};}});};
    var buildImgMap=async function(el){
      var imgs=el.querySelectorAll('img');var map=new Map();
      for(var i=0;i<imgs.length;i++){var im=imgs[i];await waitImg(im);
        try{
          if(im.naturalWidth){
            var nw=im.naturalWidth,nh=im.naturalHeight;
            var cv=document.createElement('canvas');cv.width=nw;cv.height=nh;
            var ctx=cv.getContext('2d');ctx.drawImage(im,0,0,nw,nh);
            var b64=cv.toDataURL('image/png').split(',')[1];
            var bin=atob(b64);var hex='';
            for(var j=0;j<bin.length;j++){var h=bin.charCodeAt(j).toString(16);if(h.length<2)h='0'+h;hex+=h;}
            map.set(im,{hex:hex,w:nw,h:nh});
          }
        }catch(e){}
      }
      return map;
    };
    var rtfImg=function(el){
      var r=imgMap.get(el);if(!r)return imgNote(el);
      var goalW=Math.min(8500,Math.round(r.w/96*1440));var goalH=Math.round(goalW*r.h/r.w);
      return '{'+BS+'pict'+BS+'pngblip'+BS+'picw'+r.w+BS+'pich'+r.h+BS+'picwgoal'+goalW+BS+'pichgoal'+goalH+' '+r.hex+'}'+BS+'par ';
    };
    var rtfWalk=function(node){var s='';for(var i=0;i<node.childNodes.length;i++){var n=node.childNodes[i];if(n.nodeType===3){s+=rtfEsc(n.nodeValue);}else if(n.nodeType===1){var tag=n.tagName.toLowerCase();if(tag==='style'||tag==='script'){}else if(tag==='img'){s+=rtfImg(n);}else if(tag==='br'){s+=BS+'line ';}else if(tag==='strong'||tag==='b'){s+='{'+BS+'b '+rtfWalk(n)+'}';}else if(tag==='h1'||tag==='h2'){s+=BS+'par{'+BS+'b'+BS+'fs40 '+rtfWalk(n)+'}'+BS+'par ';}else if(tag==='h3'||tag==='h4'){s+=BS+'par{'+BS+'b'+BS+'fs30 '+rtfWalk(n)+'}'+BS+'par ';}else if(tag==='li'){s+=BS+'bullet '+rtfWalk(n)+BS+'par ';}else if(tag==='p'||tag==='div'||tag==='figure'||tag==='blockquote'||tag==='tr'){s+=rtfWalk(n)+BS+'par ';}else{s+=rtfWalk(n);}}}return s;};
    var toRtf=function(){var el=document.getElementById('modal').querySelector('.doc');return '{'+BS+'rtf1'+BS+'ansi'+BS+'ansicpg949'+BS+'deff0{'+BS+'fonttbl{'+BS+'f0'+BS+'fnil Malgun Gothic;}}'+BS+'viewkind4'+BS+'uc1'+BS+'f0'+BS+'fs22 '+rtfWalk(el)+'}';};
    document.getElementById('wordBtn').onclick=async function(){
      var btn=this;var orig=btn.textContent;btn.textContent='⏳ 이미지 준비 중…';btn.style.pointerEvents='none';
      try{
        var docEl=document.getElementById('modal').querySelector('.doc');
        imgMap=await buildImgMap(docEl);
        var blob=new Blob([toRtf()],{type:'application/rtf'});
        var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=p.id+'.rtf';a.click();
        toast('워드·한글 파일로 저장했어요 (이미지 포함)');
      }finally{btn.textContent=orig;btn.style.pointerEvents='';}
    };
    document.getElementById('copyBtn').onclick=function(){try{var hb=new Blob([cleanHtml()],{type:'text/html'});var tb=new Blob([p.plain],{type:'text/plain'});navigator.clipboard.write([new ClipboardItem({'text/html':hb,'text/plain':tb})]);toast('서식 그대로 복사했어요 · 워드/네이버에 붙여넣기');}catch(e){navigator.clipboard.writeText(p.plain);toast('본문을 복사했어요');}};
    document.getElementById('dlBtn').onclick=function(){var ext=p.channelKey==='naver'?'md':'html';var blob=new Blob([p.raw],{type:'text/plain;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=p.id+'.'+ext;a.click();toast('원문 파일을 다운로드했어요');};
  }
  document.getElementById('mask').classList.add('on');
}
function closeModal(){document.getElementById('mask').classList.remove('on');}
document.getElementById('mask').onclick=e=>{if(e.target.id==='mask')closeModal();};
renderTabs();renderStats();renderGrid();
`;

// ===== 메인 대시보드에 '블로그' 시트로 합치기 위한 내보내기 =====
// (전역 *, body, .wrap, .hd 는 통합 대시보드가 정의하므로 제외)
export const BLOG_CSS = `
 .tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #1e2740;margin:4px 0 24px}
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
 .doc img{max-width:100%;border-radius:10px;margin:12px 0;display:block}
 .doc figure{margin:14px 0}.doc figcaption{color:#8a98b8;font-size:12px;margin-top:5px}
 .doc .bcard img{max-width:420px}
 .doc .kakao a{display:inline-block;background:#FEE500;color:#191600;font-weight:800;text-decoration:none;padding:11px 18px;border-radius:10px}
 .doc .tag2{color:#6ea8ff}.doc a{color:#6ea8ff}
 .outline li{margin:6px 0;color:#c3cde6}
 .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
 .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:#04210f;font-weight:800;padding:10px 18px;border-radius:10px;opacity:0;transition:opacity .2s;z-index:20}
 .toast.on{opacity:1}
 @media(max-width:900px){.cards5{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(2,1fr)}}
 @media(max-width:560px){.grid{grid-template-columns:1fr}}`;

// 블로그 시트 본문 (#sheet-blog 내부). 모달/토스트는 본문 레벨(BLOG_OVERLAY)로 분리.
export const BLOG_SHEET_HTML = `
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
 <div class="panel"><div class="empty">아직 발행된 콘텐츠가 없습니다. (게시 후 채널 연동 시 자동 표시)</div></div>`;

export const BLOG_OVERLAY = `<div class="mask" id="mask"><div class="modal" id="modal"></div></div><div class="toast" id="toast"></div>`;
export const BLOG_CLIENT_JS = clientJs;
export const blogStats = { posts: posts.length, done: posts.filter((p) => p.has).length };

// ===== 단독 실행 시: 통합 대시보드로 보내는 리다이렉트만 생성 (콘텐츠는 /dashboard/ 로 일원화) =====
if (import.meta.url === pathToFileURL(argv[1] || '').href) {
  const redirect = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=../dashboard/">
<title>블로그 관제실 이동</title></head>
<body style="background:#0a0e17;color:#e8ecf6;font-family:sans-serif;text-align:center;padding:80px">
블로그 관제실은 통합 대시보드로 합쳐졌어요. 잠시 후 이동합니다…<br><br>
<a href="../dashboard/" style="color:#6ea8ff">→ 통합 대시보드 열기</a></body></html>`;
  const pub = join(ROOT, '..', '..', 'public', 'blog');
  mkdirSync(pub, { recursive: true });
  writeFileSync(join(pub, 'index.html'), redirect);
  console.log(`✅ /blog/ → /dashboard/ 리다이렉트 생성 (블로그는 통합 대시보드 시트로 이동, 포스트 ${posts.length}개)`);
}
