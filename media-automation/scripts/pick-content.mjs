#!/usr/bin/env node
// 오늘의 썸네일 문구를 생성한다.
// - config/content-rules.json 의 패턴·슬롯·기준을 사용
// - state/used-content.json 원장에 기록된 과거 문구와 겹치지 않게 고른다
//
// 사용:
//   node scripts/pick-content.mjs                  # 오늘 날짜로 자동 생성
//   node scripts/pick-content.mjs --topic newcar   # 주제 고정(영상 주제에 맞출 때)
//   node scripts/pick-content.mjs --date 2026-07-01 --dry   # 원장 기록 없이 미리보기

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RULES_PATH = join(ROOT, 'config', 'content-rules.json');
const LEDGER_PATH = join(ROOT, 'state', 'used-content.json');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const rules = JSON.parse(readFileSync(RULES_PATH, 'utf8'));
const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : [];

const today = arg('date', new Date().toISOString().slice(0, 10));
const forcedTopic = arg('topic', null);
const dry = !!arg('dry', false);

// --- 유틸 ---------------------------------------------------------------
let seed = [...today].reduce((a, c) => a + c.charCodeAt(0), 0) + ledger.length * 7;
function rng() {
  // 날짜 기반 가벼운 결정적 난수 (같은 날 같은 결과, 날짜 바뀌면 달라짐)
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const fill = (tpl, slot) => tpl.replace(/\{(\w+)\}/g, (_, k) => slot[k] ?? `{${k}}`);
const norm = (s) => s.replace(/\s+/g, '').replace(/[^가-힣a-z0-9]/gi, '').toLowerCase();
const tokens = (s) => norm(s).match(/[가-힣]{2}|[a-z0-9]+/g) || [];

function overlap(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

function daysBetween(d1, d2) {
  return Math.abs((new Date(d1) - new Date(d2)) / 86400000);
}

// --- 후보 한 건 만들기 --------------------------------------------------
function buildSlot(topic) {
  const s = {};
  for (const [k, arr] of Object.entries(rules.slots)) s[k] = pick(arr);
  s.topicLabel = topic.label;
  s.keyword = pick(topic.keywords);
  return s;
}

function makeCandidate() {
  const topic = forcedTopic
    ? rules.topics.find((t) => t.id === forcedTopic) || pick(rules.topics)
    : pick(rules.topics);
  const pattern = pick(rules.patterns);
  const slot = buildSlot(topic);
  const headline = pattern.headline.map((l) => fill(l, slot));
  const subline = (pattern.subline || []).map((l) => fill(l, slot));
  return {
    date: today,
    topic: topic.id,
    pattern: pattern.id,
    badge: rules.brand.badge,
    handle: rules.brand.handle,
    eyebrow: fill(pattern.eyebrow.text, slot),
    eyebrowAccent: !!pattern.eyebrow.accent,
    headline,
    subline,
    _key: norm(headline.join('')),
  };
}

// --- 중복 방지 검사 -----------------------------------------------------
function recent(days) {
  return ledger.filter((e) => daysBetween(e.date, today) <= days);
}
function violates(c) {
  const r = rules.rules;
  // 1) 줄당 글자수 제한
  for (const line of c.headline) {
    if ([...line].length > r.maxCharsPerHeadlineLine) return 'too-long';
  }
  // 2) 같은 제목 N일 내 재사용 금지
  for (const e of recent(r.noRepeatHeadlineDays)) {
    if (e._key === c._key) return 'dup-headline';
  }
  // 3) 직전 같은 주제 금지
  for (const e of recent(r.noSameTopicConsecutiveDays)) {
    if (e.topic === c.topic) return 'same-topic';
  }
  // 4) 최근 N개 패턴 반복 금지
  const lastPatterns = ledger.slice(-r.avoidLastNPatterns).map((e) => e.pattern);
  if (lastPatterns.includes(c.pattern)) return 'same-pattern';
  // 5) 최근 제목과 키워드 과다 겹침 금지
  for (const e of recent(r.noRepeatHeadlineDays)) {
    if (overlap(c.headline.join(' '), (e.headline || []).join(' ')) > r.keywordOverlapReject)
      return 'too-similar';
  }
  return null;
}

// --- 메인 ---------------------------------------------------------------
let chosen = null;
const reasons = {};
for (let i = 0; i < rules.rules.maxTries; i++) {
  const c = makeCandidate();
  const why = violates(c);
  if (!why) { chosen = c; break; }
  reasons[why] = (reasons[why] || 0) + 1;
}

if (!chosen) {
  console.error('⚠️  기준을 모두 만족하는 문구를 찾지 못했습니다. 거절 사유:', reasons);
  console.error('   → content-rules.json 의 슬롯/패턴을 늘리거나 기준을 완화하세요.');
  process.exit(1);
}

const { _key, ...out } = chosen;
if (!dry) {
  ledger.push({ date: chosen.date, topic: chosen.topic, pattern: chosen.pattern,
                headline: chosen.headline, _key });
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}
const outPath = join(ROOT, 'output', 'today-content.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(JSON.stringify(out, null, 2));
console.error(`\n✅ 생성 완료 (주제=${out.topic}, 패턴=${out.pattern}) → output/today-content.json`);
if (dry) console.error('   (--dry: 원장에 기록 안 함)');
