#!/usr/bin/env node
// 주간 블로그 기획 생성기 (매주 일요일 → 차주 7일 계획).
// 시장조사(키워드)+기획을 자동으로 만들어 사람이 검토/수정할 수 있는 기획서를 출력한다.
//
// 실행: node blog/scripts/plan-week.mjs            (다음 주 월요일부터 7일)
//       node blog/scripts/plan-week.mjs --date 2026-07-06
//
// 결과: blog/output/plan-<주시작일>.json , plan-<주시작일>.md

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'blog-config.json'), 'utf8'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

// 다음 주 월요일 계산
function nextMonday(from) {
  const d = from ? new Date(from) : new Date();
  const day = d.getDay(); // 0=일
  const add = day === 0 ? 1 : 8 - day; // 다음 월요일까지
  const m = new Date(d); m.setDate(d.getDate() + add);
  return m;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const kdate = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`;

const start = nextMonday(arg('date'));
const rot = cfg.queryTypes.rotation;
const defs = cfg.queryTypes.defs;
const models = cfg.hyundai.models;
const intents = cfg.keywordSeeds.intents;
const audiences = cfg.keywordSeeds.audience;
const regions = cfg.keywordSeeds.region;

const pick = (arr, i) => arr[i % arr.length];

// 채널·쿼리타입별 제목/키워드/개요 생성
function buildPost(channel, qt, idx) {
  const model = pick(models, idx);
  const model2 = pick(models, idx + 3);
  const intent = pick(intents, idx);
  const aud = pick(audiences, idx);
  const region = channel === 'naver' ? pick(regions, idx) : '전국';
  const kw = `${region !== '전국' ? region + ' ' : ''}${model} ${intent}`.trim();

  let title, keyword = kw, outline;
  switch (qt) {
    case 'definition':
      title = `${model} ${intent}, 무엇부터 봐야 할까 — 조건·종류 총정리 (2026)`;
      outline = [`${intent} 정의와 기본 개념`, `종류·조건 한눈에`, `장단점 비교`, `자주 묻는 질문(FAQ)`, `정리 + 상담 안내`];
      break;
    case 'howto':
      title = `${kw} 똑똑하게 받는 법 — 카마스터가 알려주는 5단계`;
      outline = ['시작 전 준비물', '단계별 방법 (1~5)', '놓치면 손해 보는 주의점', '체크리스트', '정리 + 상담 안내'];
      break;
    case 'compare':
      title = `${model} vs ${model2} 비교 — 견적·옵션·유지비 총정리`;
      keyword = `${model} ${model2} 비교`;
      outline = ['비교 기준 안내', '항목별 비교표(가격·옵션·유지비)', '상황별 추천 결론', 'FAQ', '정리 + 상담 안내'];
      break;
    case 'review':
      title = `[${region} ${model} 출고후기] ${aud} ${intent}부터 인도까지 솔직 후기`;
      outline = ['고객 상황 배경', `${intent} 진행 과정(실제 경험)`, '출고·인도 경험', '느낀 점·팁', '정리 + 상담 안내'];
      break;
    case 'guide':
      title = `${kw} 구매 가이드 — 후회 없는 체크리스트`;
      outline = ['핵심 요약(300자)', '구매 전 체크포인트', '옵션·색상 선택', '비용·유지비', '정리 + 상담 안내'];
      break;
    case 'news':
      title = `${model} 신차·프로모션 소식 — ${intent}에 미치는 영향`;
      outline = ['이번 변화 개요', '핵심 포인트', '견적·구매에 미치는 영향', '대상별 추천', '정리 + 상담 안내'];
      break;
    default: // faq
      title = `${kw} 자주 묻는 질문 BEST 6 — 카마스터 답변`;
      outline = ['Q1~Q6 (고객 언어 질문)', '핵심 요약', '정리 + 상담 안내'];
  }
  return {
    channel,
    queryType: qt,
    queryTypeLabel: defs[qt].label,
    title,
    targetKeyword: keyword,
    model, intent, audience: aud, region,
    outline,
  };
}

const days = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(start); d.setDate(start.getDate() + i);
  // 채널마다 쿼리타입을 다르게(오프셋) 돌려 같은 날 두 채널이 안 겹치게
  const naver = buildPost('naver', pick(rot, i), i);
  const google = buildPost('google', pick(rot, i + 3), i + 1);
  days.push({ date: fmt(d), kdate: kdate(d), posts: { naver, google } });
}

const weekStart = fmt(start);
const plan = { weekStart, generatedFor: '차주', persona: cfg.persona.name, days };

const outDir = join(ROOT, 'output');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `plan-${weekStart}.json`), JSON.stringify(plan, null, 2));

// 사람이 읽는 기획서(md)
let md = `# 📅 블로그 주간 기획서 — ${weekStart} 시작 주\n\n`;
md += `> 채널: 네이버 블로그 + 구글 블로그 · 각 채널 하루 1회 · 목표: 키워드 상위노출(SEO/GEO)\n> 담당: ${cfg.persona.name} ${cfg.persona.title} (${cfg.persona.store})\n\n`;
md += `매일 아래 기획으로 **원고 자동 생성 → 검토 → 채널에 직접 업로드**하면 됩니다.\n\n---\n\n`;
for (const day of days) {
  md += `## ${day.kdate}\n\n`;
  for (const ch of ['naver', 'google']) {
    const p = day.posts[ch];
    md += `### ${cfg.channels[ch].label} · ${p.queryTypeLabel}\n`;
    md += `- **제목**: ${p.title}\n`;
    md += `- **타겟 키워드**: \`${p.targetKeyword}\`\n`;
    md += `- **구성(H2)**: ${p.outline.join(' → ')}\n\n`;
  }
  md += `---\n\n`;
}
writeFileSync(join(outDir, `plan-${weekStart}.md`), md);

console.log(`✅ 주간 기획 생성 → blog/output/plan-${weekStart}.md (.json)`);
console.log(`   ${days.length}일 × 2채널 = ${days.length * 2}개 포스팅 기획`);
