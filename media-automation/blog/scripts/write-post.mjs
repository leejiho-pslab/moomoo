#!/usr/bin/env node
// 일일 블로그 원고 생성 엔진.
// 주간 기획(plan-*.json)의 그날 항목을 받아 GEO 체크리스트를 반영한 원고를 생성한다.
// - 네이버: 마크다운(복붙용) · 구글: 시맨틱 HTML5 + FAQ 스키마
// - 사람이 쓴 듯 자연스러운 톤(AI 느낌 최소화)
//
// 실행: node blog/scripts/write-post.mjs --plan blog/output/plan-2026-07-06.json --date 2026-07-06
//       node blog/scripts/write-post.mjs --plan <plan> --all        (그 주 전체 미리 생성)
//
// 필요: 환경변수 ANTHROPIC_API_KEY (GitHub Secret). 모델: ANTHROPIC_MODEL (기본 claude-sonnet-4-6)

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'blog-config.json'), 'utf8'));
const geo = JSON.parse(readFileSync(join(ROOT, 'config', 'geo-checklist.json'), 'utf8'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// 최신 plan 자동 선택
let planPath = arg('plan');
if (!planPath) {
  const outDir = join(ROOT, 'output');
  try {
    const plans = readdirSync(outDir).filter((f) => f.startsWith('plan-') && f.endsWith('.json')).sort();
    if (plans.length) planPath = join(outDir, plans[plans.length - 1]);
  } catch {}
}
if (!planPath) { console.error('❌ 기획 파일이 없습니다. 먼저 plan-week.mjs 를 실행하세요.'); process.exit(1); }
const plan = JSON.parse(readFileSync(planPath, 'utf8'));

// 처리할 날짜 선택
const all = !!arg('all');
const date = arg('date');
let targets = [];
if (all) targets = plan.days;
else {
  const today = date || new Date().toISOString().slice(0, 10);
  const day = plan.days.find((d) => d.date === today);
  if (!day) { console.error(`ℹ️ ${today} 는 이 기획서에 없습니다 (기획: ${plan.days[0].date}~${plan.days.at(-1).date}).`); process.exit(0); }
  targets = [day];
}

const checklist = geo.items.map((i) => `- ${i.rule} (${i.why})`).join('\n');

function systemPrompt(channel) {
  const ch = cfg.channels[channel];
  const fmt = channel === 'naver'
    ? `출력 형식: 마크다운. 본문 곳곳에 \`[이미지: 설명 — ALT(롱테일 키워드 포함 1~5문장)]\` 형태의 이미지 자리표시를 4~6개 넣어라(현대 공식 홈페이지 이미지 활용 권장: ${cfg.hyundai.homepage}). 맨 끝에 해시태그 10개. 맨 위에 한 줄 '메타 설명:' 포함.`
    : `출력 형식: 완결형 HTML 한 개. <article> 안에 <h1><h2><h3> 계층, 시맨틱 태그(header/main/section), 비교/정리는 <table>, 그리고 페이지 하단에 FAQPage JSON-LD <script type="application/ld+json"> 스키마(질문 3~5개)를 포함. <head> 없이 <article>부터. 첫 부분에 <!-- meta description: ... --> 주석으로 메타설명.`;
  return `너는 ${cfg.persona.store}의 ${cfg.persona.name} ${cfg.persona.title}다. ${cfg.persona.experience}. 지역: ${cfg.persona.region}.
${ch.label}에 올릴 자동차 구매 정보 글을 쓴다. 목표: ${ch.goal}.

[톤 — 매우 중요]
- 실제 11년차 카마스터가 직접 쓴 것처럼 자연스러운 한국어. AI 티 나는 상투어 금지
  (예: "오늘은 ~에 대해 알아보겠습니다", 과한 "여러분", 기계적인 "결론적으로/정리하자면" 남발, 번역체 금지).
- 1인칭 경험·현장 사례 섞기(E-E-A-T의 경험). 단정적 과장·허위 금지, 수치엔 출처/연도 표기.
- 전문적이되 비전문가도 이해되게.

[채널 스타일] ${ch.style}

[GEO/SEO 체크리스트 — 가능한 항목을 본문에 실제 반영]
${checklist}

[필수]
- 첫 문단에 타겟 롱테일 키워드를 자연스럽게 포함.
- 중요한 정보는 굵게.
- 신뢰도 높은 외부 링크 2개 이상(현대/제네시스 공식 등), 내부 링크 CTA.
- 글 끝에 상담 CTA: "${cfg.cta.text}" + 연락처(${cfg.persona.phone}).
- 게시일/최종검토일 표기.
- 주의: 명함 이미지 + 카카오 상담 링크 블록은 발행 직전에 자동으로 하단에 붙으니, 본문에 명함/카카오 블록을 따로 만들지 마라(문구 CTA만).

${fmt}

분량: 1,500~2,500자. 제목/키워드/구성은 사용자 메시지의 기획을 따르되 자연스럽게 살려라.`;
}

function userPrompt(post, kdate) {
  return `[오늘 기획 — ${kdate}]
- 제목(참고): ${post.title}
- 타겟 키워드: ${post.targetKeyword}
- 쿼리 유형: ${post.queryTypeLabel}
- 구성(H2): ${post.outline.join(' → ')}
- 모델/인텐트/대상/지역: ${post.model} / ${post.intent} / ${post.audience} / ${post.region}

위 기획으로 ${cfg.channels[post.channel].label} 원고를 완성해줘.`;
}

async function callClaude(sys, usr) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: sys,
      messages: [{ role: 'user', content: usr }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j.content.map((c) => c.text || '').join('');
}

// 생성 후 GEO 자가 점검(휴리스틱)
function selfCheck(text, channel) {
  const t = text.toLowerCase();
  const hits = [];
  if (/\*\*|<strong|<b>/.test(text)) hits.push('bold');
  if (/faq|자주\s*묻는|질문/i.test(text)) hits.push('faq');
  if (channel === 'google' && /ld\+json|faqpage/i.test(text)) hits.push('faq_schema');
  if (channel === 'google' && /<h1|<h2|<section|<article/i.test(text)) hits.push('semantic');
  if (/hyundai\.com|genesis\.com|https?:\/\//.test(t)) hits.push('links');
  if (channel === 'naver' && /\[이미지/.test(text)) hits.push('img_alt');
  if (/2026|출처|기준/.test(text)) hits.push('cited/date');
  return hits;
}

const outDir = join(ROOT, 'output', 'posts');
mkdirSync(outDir, { recursive: true });

if (!API_KEY) {
  console.error('⚠️ ANTHROPIC_API_KEY 가 없어 실제 원고 생성은 건너뜁니다.');
  console.error('   GitHub Secret 에 ANTHROPIC_API_KEY 를 등록하면 매일 자동으로 원고가 생성됩니다.');
  console.error(`   처리 예정: ${targets.length}일 × 2채널 = ${targets.length * 2}개`);
  process.exit(0);
}

for (const day of targets) {
  for (const channel of ['naver', 'google']) {
    const post = day.posts[channel];
    try {
      const text = await callClaude(systemPrompt(channel), userPrompt(post, day.kdate));
      const ext = channel === 'naver' ? 'md' : 'html';
      const file = join(outDir, `${day.date}_${channel}.${ext}`);
      writeFileSync(file, text);
      console.log(`✅ ${day.date} ${cfg.channels[channel].label} → ${file}  [GEO: ${selfCheck(text, channel).join(', ')}]`);
    } catch (e) {
      console.error(`❌ ${day.date} ${channel} 생성 실패: ${e.message}`);
    }
  }
}
console.log('\n완료. blog/output/posts/ 의 파일을 받아 각 채널에 직접 업로드하세요.');
