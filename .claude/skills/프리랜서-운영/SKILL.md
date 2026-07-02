---
name: 프리랜서 운영
description: 프리랜서(딜러·강사·1인 사업자 등)의 홈페이지 제작부터 콘텐츠 자동화(블로그·영상), 운영 대시보드, 커스텀 도메인 연결까지 전 과정을 다루는 스킬. "홈페이지 만들어줘", "블로그/영상 자동화해줘", "대시보드 만들어줘", "도메인 연결해줘" 같은 요청에 사용. 이 저장소(moomoo, 현대차 대전선화대리점 김무겸)를 실제 구현 참고 사례로 삼는다.
---

# 프리랜서 운영 스킬

한 사람(프리랜서·개인사업자)의 온라인 영업 활동을 "홈페이지 + 콘텐츠 자동화 + 운영 대시보드 + 자기 도메인"으로 묶어 무인에 가깝게 굴러가도록 만드는 전체 파이프라인이다. 이 저장소가 실제로 그렇게 구축되어 있으니, 새 프리랜서를 위해 같은 걸 만들거나 이 사이트를 확장할 때 아래 4단계를 그대로 따라간다.

핵심 원칙: **모든 자동화는 실패해도 빌드/배포를 깨뜨리지 않는다.** 이미지 다운로드 실패, SNS 수집 실패, 콘텐츠 생성 실패 시 항상 이전 상태를 보존하고 0 코드로 종료한다. GitHub Actions 워크플로가 매일 도는 구조이므로, 사람이 안 봐도 사이트가 죽지 않아야 한다.

## 0. 사전 정보 수집 (반드시 먼저)

작업 시작 전 아래를 확인한다. 없으면 사용자에게 물어본다.
- 사업 정보: 이름, 직함, 소속, 연락처(휴대폰/대표전화/이메일), 주소, 상담 가능 시간
- SNS 채널: 유튜브 채널 URL/핸들, 인스타그램, 카카오톡 오픈채팅 링크
- 브랜드 자산: 실제 프로필 사진, 명함 이미지(있으면), 로고
- 콘텐츠 소스: 구글 드라이브에 정리된 상품/차종/포트폴리오 이미지·카탈로그가 있는지 (있으면 AI 생성 이미지보다 우선 사용 — 아래 3-3 참고)
- 도메인: 이미 구매했는지, 어느 등록기관(가비아 등)인지

## 1단계 — 홈페이지 뼈대 (Astro 정적 사이트)

이 저장소 루트가 예시. 구조:
- `src/data/site.config.ts` — 모든 텍스트 콘텐츠(브랜드/히어로/소개/경력/서비스/차종·상품/연락처)를 여기 한 곳에서 관리. **하드코딩 대신 항상 이 파일을 고친다.**
- `src/components/*.astro` — Hero, About, Models(상품/차종), YouTubeFeed, InstagramFeed, Contact, Nav, Footer, StickyCta
- `src/lib/localImage.ts` — `public/images/<이름>.<확장자>` 를 커밋해두면 자동으로 쓰이는 폴백. 사람이 직접 올린 사진(프로필, 히어로 배경 등)은 이 방식으로.
- `src/lib/img.ts` — http(s) URL은 그대로, 상대경로는 `BASE_URL` 붙여서 반환. 이미지 경로 처리는 항상 이 헬퍼를 통한다.
- `src/data/image-sources.json` + `scripts/fetch-images.mjs` — 공식 홈페이지(예: hyundai.com) 이미지 URL을 등록해두면 **빌드 시 GitHub Actions가** 자동 다운로드해 `public/images/_fetched/`에 자체 호스팅. 실패해도 이전 이미지 보존, 빌드 안 깨짐. **주의: 이 샌드박스는 외부 egress가 막혀 있어 로컬에서 다운로드 테스트가 안 된다 — 정상이다. 실제 다운로드는 GitHub Actions에서만 확인 가능.**
- `src/data/feed.json` + `scripts/fetch-content.mjs` — 유튜브/인스타그램 최신 게시물을 빌드 시 자동 수집(API 키 없어도 RSS로 동작). `YouTubeFeed.astro`는 썸네일 클릭 시 `youtube-nocookie.com` iframe으로 그 자리에서 재생(숏츠면 9:16 세로 그리드).

체크: `npm run dev`로 로컬 확인, `npm test`(순수 함수 유닛테스트), `SITE_URL=... SITE_BASE=/ npm run build`로 프로덕션 빌드 검증.

## 2단계 — 콘텐츠 자동화 (블로그 + 영상)

`media-automation/` 하위 별도 Node 프로젝트. 두 축:

**블로그 자동화** (`media-automation/blog/scripts/`)
- `plan-week.mjs` — 주간 발행 계획 수립 (일요일 실행)
- `write-post.mjs` — 그날 원고 자동 생성 (매일 실행, ANTHROPIC_API_KEY 필요)
- `gen-images.mjs` — 본문 이미지·명함·차량 사진을 구글 드라이브와 연동해 삽입
- `upload-blog.mjs` — 완성 원고를 구글 드라이브에 업로드
- `blog-dashboard.mjs` — 원고를 카드형으로 보여주는 관제실. **원고 다운로드는 반드시 진짜 RTF/DOCX로** — HTML을 `.doc` 확장자로 위장하면 한글/워드에서 "파일이 손상되었습니다" 오류 난다. 이미지도 캔버스로 그려 `\pict\pngblip` 블록으로 RTF에 직접 삽입해야 한글에서 사진까지 한 번에 복사된다.

**영상 자동화** (`media-automation/scripts/`)
- `build-reel.mjs` — 원본 영상을 고정 프레임(상단 검정 띠: 날짜+문구 / 중앙: 영상 원본 비율 유지, 잘리지 않게 / 하단 검정 띠: 명함 카드)으로 편집. 명함은 실제 브랜드 로고를 배경 제거해 합성 — AI가 새로 그린 로고를 쓰지 말고 `ffmpeg colorkey`로 실제 명함 사진에서 추출한다.
- `process-video.mjs`, `pick-content.mjs`, `make-thumbnail.mjs`, `drive.mjs` — 드라이브 "원본" 폴더 감시 → 처리 → "완성본" 폴더 저장까지의 무인 파이프라인
- `dashboard.mjs` — 운영 현황(자동화 폴더 링크, 채널 바로가기)과 블로그 관제실을 하나로 합친 통합 대시보드. `public/dashboard/index.html`로 배포.

**GitHub Actions로 스케줄링** (`.github/workflows/`)
- `blog-automation.yml` — 일요일 기획 + 매일 원고 생성 → 커밋
- `media-automation.yml` — 매일 영상 처리 (ffmpeg + 한글 폰트 + Chromium 설치 필요)
- 둘 다 실패해도 `if: always()`로 결과 저장 단계는 실행, 커밋 메시지에 `[skip ci]` 붙여서 무한루프 방지

## 3단계 — 커스텀 도메인 연결 (가장 최근에 검증된 절차)

### 3-1. 사전 확인
사용자가 이미 도메인을 구매했는지 확인 (가비아 등). 구매 확인서/캡처를 받으면 도메인명과 네임서버를 확인한다.

### 3-2. 코드 변경 (여기서 먼저 처리)
1. `public/CNAME` 파일 생성, 내용은 도메인명 한 줄 (예: `hyundaimoomoo.co.kr`)
   - Astro는 `public/*`를 빌드 산출물 루트에 그대로 복사하므로 별도 설정 불필요
2. `.github/workflows/deploy.yml`의 빌드 스텝 환경변수 변경:
   ```yaml
   env:
     SITE_URL: https://<새도메인>
     SITE_BASE: /        # 기존 프로젝트 경로(/repo명/)에서 루트로 변경
   ```
3. 대시보드 등에 하드코딩된 구 도메인(`*.github.io/...`) 링크가 있으면 새 도메인으로 교체
4. 커밋 → PR → 병합 → 이 저장소 워크플로에 따라 자동 배포

### 3-3. GitHub 저장소 설정 (사람이 브라우저로 해야 함 — 자동화 불가)
**중요한 함정**: GitHub Actions로 배포하는 방식(`actions/deploy-pages`)은 배포 산출물에 `CNAME` 파일이 있어도 **Settings의 Custom domain 칸을 자동으로 채워주지 않는다** (classic 브랜치 배포 방식과 다름). 반드시 사람이 직접:
1. `https://github.com/<owner>/<repo>/settings/pages` 접속
2. "Custom domain" 입력칸에 도메인 입력 → Save
3. DNS 확인이 끝나면 "Enforce HTTPS" 체크

이 저장이 되기 전에 이미 실행된 배포는 도메인 라우팅이 안 걸려 있으므로, **저장 후 배포를 한 번 더 트리거**해야 한다(`workflow_dispatch`로 재실행하거나 빈 커밋 push). 안 하면 방문 시 GitHub의 "Site not found" 404가 뜬다.

### 3-4. 등록기관 DNS 설정 (사람이 해야 함)
가비아 기준(다른 등록기관도 원리 동일):
1. `dns.gabia.com` (또는 My가비아 > 서비스 관리 > DNS 관리) 접속
2. 루트/apex 도메인(`example.co.kr` 형태, www 없음)에 **A 레코드 4개** 추가:
   ```
   호스트: @ (또는 비움)
   값: 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153
   ```
   (GitHub Pages 공식 IP. www 서브도메인까지 쓰려면 `CNAME www → <owner>.github.io` 별도 추가하되 필수 아님)
3. 저장 → DNS 전파 대기 (보통 수 분~1시간, 최대 24시간)

### 3-5. 검증 순서
1. DNS 전파 확인: 실행 환경에서 `python3 -c "import socket; print(socket.gethostbyname_ex('도메인'))"` 로 4개 IP가 뜨는지 확인 (curl/WebFetch는 egress 정책상 임의 도메인 접속이 막혀 있을 수 있음 — 이땐 소켓 조회나 사용자 스크린샷으로 대체)
2. 브라우저로 `https://도메인` 접속 — 이때 발생 가능한 정상적 과도기 증상들:
   - `NET::ERR_CERT_COMMON_NAME_INVALID` — HTTPS 인증서 발급 대기 중. 정상, 기다리면 해결
   - "Site not found" 404 — 3-3의 Custom domain 저장 전에 배포된 것. 저장 확인 후 재배포
   - `www.도메인이 잘못 구성되었습니다` 경고 — www 레코드 안 만들었으면 무시해도 됨 (apex만 쓸 경우)
3. 주소창 자물쇠(또는 크롬 최신 버전의 슬라이더 아이콘) 클릭 → "연결이 안전함"/"인증서가 유효함" 확인되면 완료

### 3-6. 이 과정에서 실제로 직접 할 수 없는 것 (사용자에게 위임해야 함)
- 브라우저로 실제 사이트 열어보기 (샌드박스 egress 정책상 임의 외부 사이트 접속 불가)
- GitHub Settings > Pages의 Custom domain 저장, Enforce HTTPS 체크 (해당 API가 MCP 도구셋에 없음)
- 등록기관 DNS 관리 화면 조작

이 세 가지는 매번 스크린샷을 받아가며 한 단계씩 안내하고, DNS 전파·GitHub Actions 배포 성공 여부 등 **자동으로 확인 가능한 부분은 반드시 직접 확인**하고 결과만 알려준다 (사용자에게 불필요하게 재확인시키지 않는다).

## 공통 작업 방식 (이 저장소 컨벤션)

- **브랜치**: 기능 브랜치 하나에서 계속 작업, 각 변경은 작은 PR로 쪼개 즉시 스쿼시 머지. 머지 후 다음 작업 시작 전 `git fetch origin main && git reset --hard origin/main` 으로 동기화(스쿼시 이력 특성상 이렇게 안 하면 다음 PR이 merge conflict 남).
- **검증**: 코드 변경 후 항상 `npm test` + `SITE_URL=... SITE_BASE=/ npm run build` 로컬 확인. 화면 변경은 Playwright(`playwright-core`, `media-automation/node_modules`에 있음, `CHROME_PATH` 없으면 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` 사용)로 스크린샷 찍어 직접 눈으로 확인 후 커밋한다.
- **이미지 우선순위**: (1) 사용자가 이미 갖고 있는 실제 브랜드/상품 사진(구글 드라이브 등) > (2) 공식 홈페이지에서 자동 수집 > (3) AI 생성. AI 생성 이미지는 미리보기가 불가능한 경우가 많으므로(CDN 핫링크가 egress 정책에 막힐 수 있음) 가급적 실제 사진을 우선 쓰고, 부득이하게 AI로 만들 때는 반드시 정적 파일로 다운로드해 저장소에 커밋한다(외부 CDN 핫링크 의존 지양).
- **PR/커밋 메시지**: 한국어, "무엇을 왜 바꿨는지" 위주로 짧게.
