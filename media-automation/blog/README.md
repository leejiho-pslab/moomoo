# 블로그 반자동화 (네이버 + 구글)

시장조사·기획은 **100% 자동**, 원고는 자동 생성 → **다운로드 후 채널에 직접 업로드**(반자동).

```
매주 일요일  → 차주 기획 자동 생성 (시장조사 + 7일×2채널 계획)
매일 아침    → 그날 원고 자동 생성 (네이버 .md / 구글 .html)
              → blog/output 에 저장 (저장소에서 다운로드)
사람        → 받아서 네이버·구글 블로그에 직접 업로드
```

- **채널**: 네이버 블로그(경험·후기·지역 롱테일) · 구글 블로그(정의/방법/비교 + FAQ 스키마)
- **빈도**: 채널당 1일 1회 (주 14편)
- **목표**: 네이버·구글 키워드 상위노출 (SEO/GEO)
- **검수 기준**: 첨부 GEO 체크리스트 26항목 → `config/geo-checklist.json` (원고 생성·자가점검에 반영)

## 폴더

```
blog/
  config/
    blog-config.json     # 채널·키워드·현대정보·CTA  ← 주로 여기 수정
    geo-checklist.json   # GEO/SEO 검수 기준 26항목
  scripts/
    plan-week.mjs        # 주간 기획 생성 (npm run blog:plan)
    write-post.mjs       # 일일 원고 생성 (npm run blog:write, Claude API)
  samples/               # 사람이 검토용으로 보는 예시 원고 (네이버/구글)
  output/                # 자동 생성된 기획서·원고 (다운로드용)
```

## 쓰는 법

```bash
# 1) 주간 기획 (다음 주 월~일)
npm run blog:plan
#  → blog/output/plan-<주시작일>.md (.json)  ← 검토/수정 가능

# 2) 일일 원고 (오늘 날짜 기준, 네이버+구글)
ANTHROPIC_API_KEY=... npm run blog:write
#  → blog/output/posts/<날짜>_naver.md , <날짜>_google.html

# 그 주 전체 미리 생성
ANTHROPIC_API_KEY=... node blog/scripts/write-post.mjs --all
```

## 자동화 (GitHub Actions)

워크플로: [`.github/workflows/blog-automation.yml`](../../.github/workflows/blog-automation.yml)
- 일요일 05:00(KST): 차주 기획
- 매일 06:30(KST): 그날 원고 → 저장소에 커밋(다운로드)

### 켜려면 (한 번만)
- GitHub Secret **`ANTHROPIC_API_KEY`** 등록 (원고 작성 AI)
- (선택) **`ANTHROPIC_MODEL`** 변수로 모델 지정 (기본 `claude-sonnet-4-6`)
- (선택) 실제 네이버 키워드 시장조사 연동 시 네이버 검색 API 키 — 현재는 키워드 시드 기반, 추후 연결

## 작성 원칙 (AI 느낌 최소화)

- 11년차 카마스터 1인칭, 현장 경험·사례 (E-E-A-T)
- 상투적 AI 표현 금지(“오늘은 ~알아보겠습니다”, 과한 “여러분”, 번역체)
- 첫 문단 롱테일 키워드, 굵은 강조, 표/FAQ, 출처·연도, 외부·내부 링크, 상담 CTA
- 구글용은 시맨틱 HTML5 + FAQPage 스키마, 네이버용은 이미지 ALT + 해시태그
