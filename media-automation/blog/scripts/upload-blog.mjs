#!/usr/bin/env node
// 생성된 블로그 기획서·원고를 구글드라이브 "블로그 원고" 폴더에 업로드한다.
// (영상과 동일하게 OAuth 사용자 위임으로 사장님 드라이브에 저장)
// 실행: node blog/scripts/upload-blog.mjs [--date YYYY-MM-DD]

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWriteDrive, hasOAuth, ensureFolder, uploadFile } from '../../scripts/drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');                 // blog/
const OUT = join(ROOT, 'output');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const date = arg('date', new Date().toISOString().slice(0, 10));

if (!hasOAuth()) {
  console.error('⚠️ 드라이브 업로드는 OAuth 위임이 필요합니다(GDRIVE_OAUTH_* 시크릿). 건너뜁니다.');
  process.exit(0);
}

const d = await getWriteDrive();
const root = await ensureFolder(d, '블로그 원고 (자동생성)', null);
const sub = await ensureFolder(d, date, root);

const targets = [];
// 최신 주간 기획서
const plans = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.startsWith('plan-') && f.endsWith('.md')).sort() : [];
if (plans.length) targets.push([join(OUT, plans[plans.length - 1]), `주간기획서_${plans.at(-1).replace('plan-', '').replace('.md', '')}.md`, 'text/markdown']);
// 오늘 원고
const naver = join(OUT, 'posts', `${date}_naver.md`);
const google = join(OUT, 'posts', `${date}_google.html`);
if (existsSync(naver)) targets.push([naver, `${date}_네이버.md`, 'text/markdown']);
if (existsSync(google)) targets.push([google, `${date}_구글.html`, 'text/html']);

if (!targets.length) { console.log('업로드할 파일이 없습니다.'); process.exit(0); }
for (const [p, n, m] of targets) { await uploadFile(d, p, n, sub, m); console.log('⬆️', n); }
console.log(`✅ 드라이브 "블로그 원고 (자동생성)/${date}" 에 ${targets.length}개 업로드`);
