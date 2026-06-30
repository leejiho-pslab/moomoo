#!/usr/bin/env node
// 무인 공장 관리자: 드라이브 "원본" 폴더의 새 영상을 모두 찾아
// 편집(4스타일 로테이션) + (옵션)썸네일 → "완성본" 폴더에 업로드.
// 이미 처리한 영상은 state/processed.json 으로 건너뛴다.
//
// 실행: node scripts/run-automation.mjs           (실제 처리)
//       node scripts/run-automation.mjs --limit 1 (테스트로 1개만)
//
// 필요한 환경변수(GitHub Secret): GDRIVE_SA_KEY (서비스 계정 JSON)

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  getReadDrive, getWriteDrive, hasOAuth, listVideosRecursive, downloadFile, ensureFolder, uploadFile,
} from './drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'automation.json'), 'utf8'));
const LEDGER = join(ROOT, 'state', 'processed.json');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const inputFolderId = process.env.GDRIVE_INPUT_FOLDER_ID || cfg.inputFolderId;
let outputFolderId = process.env.GDRIVE_OUTPUT_FOLDER_ID || cfg.outputFolderId;
const limit = arg('limit') ? parseInt(arg('limit'), 10) : Infinity;

if (!inputFolderId || inputFolderId.startsWith('PUT_')) {
  console.error('❌ 원본 폴더 ID 가 설정되지 않았습니다.');
  console.error('   config/automation.json 의 inputFolderId 또는 환경변수 GDRIVE_INPUT_FOLDER_ID 를 설정하세요.');
  process.exit(1);
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
// trail/파일명에서 날짜 추출 → "M월 D일(요일)"
function deriveDate(trail, name) {
  const hay = [...trail, name].join(' ');
  let y, m, d;
  let mt = hay.match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/); // 26.6.27
  if (mt) { y = +mt[1] < 100 ? 2000 + +mt[1] : +mt[1]; m = +mt[2]; d = +mt[3]; }
  else {
    mt = name.match(/(?<!\d)(\d{2})(\d{2})(?!\d)/); // 0627 (MMDD)
    if (mt) { y = new Date().getFullYear(); m = +mt[1]; d = +mt[2]; }
  }
  if (!m || !d || m > 12 || d > 31) return null;
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일(${wd})`;
}

function pickGreeting(seedStr) {
  const n = [...seedStr].reduce((a, c) => a + c.charCodeAt(0), 0);
  return cfg.greetings[n % cfg.greetings.length];
}

function run(script, args) {
  execFileSync('node', [join(ROOT, 'scripts', script), ...args], { stdio: 'inherit' });
}

// --- 메인 -------------------------------------------------------------
const drive = getReadDrive();        // 읽기(원본 조회/다운로드)
const writeDrive = getWriteDrive();  // 쓰기(완성본 저장)

// 완성본 드라이브 저장 여부 (delivery=drive 이고 OAuth 위임이 있어야 가능)
let doUpload = (cfg.delivery || 'drive') !== 'local';
if (doUpload && !hasOAuth()) {
  console.warn('⚠️ 드라이브 저장은 OAuth 위임이 필요합니다(서비스 계정은 개인 드라이브 저장 불가 — 구글 제약).');
  console.warn('   GDRIVE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN 등록 후 다시 실행하세요.');
  console.warn('   → 이번 실행은 편집까지만 하고 로컬(output/)에 보관합니다.');
  doUpload = false;
}

if (doUpload && !outputFolderId) {
  // OAuth(사용자 위임): 내 드라이브 최상위에 '완성본' 폴더 생성/재사용
  outputFolderId = await ensureFolder(writeDrive, cfg.outputFolderName, null);
  console.log(`📁 완성본 폴더: ${cfg.outputFolderName} (${outputFolderId})`);
}

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : [];
const done = new Set(ledger.map((e) => e.id));

const videos = await listVideosRecursive(drive, inputFolderId);
const fresh = videos.filter((v) => !done.has(v.id)).slice(0, limit);
console.log(`🎬 전체 ${videos.length}개 / 새 영상 ${fresh.length}개 처리`);

const tmp = join(ROOT, 'output', '_work');
mkdirSync(tmp, { recursive: true });

for (const v of fresh) {
  const safe = basename(v.name, extname(v.name)).replace(/[^\w가-힣.-]+/g, '_');
  const localIn = join(tmp, `${v.id}${extname(v.name) || '.mp4'}`);
  console.log(`\n── ${v.trail.join('/')}/${v.name} ──`);
  try {
    await downloadFile(drive, v.id, localIn);

    // 자막: 날짜 + 인사 로테이션
    const date = deriveDate(v.trail, v.name);
    const g = pickGreeting(v.id);
    const caption = [date, g.line2, g.line3].filter(Boolean).join('|');

    // 1) 영상 편집 (인스타/유튜브)
    run('process-video.mjs', ['--in', localIn, '--caption', caption]);

    // 2) (옵션) 썸네일: 영상 프레임 추출 → 썸네일 생성 (best-effort)
    const produced = [];
    for (const plat of ['instagram', 'youtube']) {
      produced.push(join(ROOT, 'output', `${v.id}_${plat}.mp4`));
    }
    if (cfg.makeThumbnails) {
      try {
        const frame = join(tmp, `${v.id}_frame.jpg`);
        execFileSync('ffmpeg', ['-y', '-ss', String(cfg.thumbnailFrameSec), '-i', localIn,
          '-frames:v', '1', frame], { stdio: 'ignore' });
        run('pick-content.mjs', []);
        run('make-thumbnail.mjs', ['--bg', frame]);
        // make-thumbnail 출력 파일명: <date>_<plat>_<frame베이스>.png
      } catch (e) { console.warn('  (썸네일 생략:', e.message, ')'); }
    }

    // 3) 완성본 업로드 (날짜별 하위 폴더) — 드라이브 저장 모드일 때만
    const uploads = [];
    if (doUpload) {
      const subName = (v.trail[v.trail.length - 1] || date || 'misc').toString();
      const sub = await ensureFolder(writeDrive, subName, outputFolderId);
      for (const plat of ['instagram', 'youtube']) {
        const f = join(ROOT, 'output', `${v.id}_${plat}.mp4`);
        if (existsSync(f)) {
          const up = await uploadFile(writeDrive, f, `${safe}_${plat}.mp4`, sub, 'video/mp4');
          uploads.push(up.id);
        }
      }
    }
    if (doUpload) console.log(`  ⬆️  드라이브 완성본 업로드 (${uploads.length}개)`);
    else console.log('  💾 편집 완료 (로컬 output/ 보관)');

    ledger.push({ id: v.id, name: v.name, at: new Date().toISOString(), uploads });
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    rmSync(localIn, { force: true });
  } catch (e) {
    console.error(`  ❌ 처리 실패: ${e.message}`);
  }
}

console.log('\n✅ 자동화 완료');
