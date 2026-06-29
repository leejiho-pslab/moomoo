# 현대자동차 딜러 원페이지 홈페이지

Apple·현대/제네시스 감도의 깔끔한 **원페이지형** 딜러 홈페이지.
포트폴리오(고객 출고) · 차종소개 · 유튜브 · 인스타그램 콘텐츠를 한 페이지에 모으고,
SNS 콘텐츠는 **예약 빌드로 자동 업데이트**된다.

- 스택: [Astro](https://astro.build) 정적 사이트
- 폰트: Pretendard + SF/시스템 산세리프
- 설계 문서: [`../docs/superpowers/specs/2026-06-28-hyundai-dealer-homepage-design.md`](../docs/superpowers/specs/2026-06-28-hyundai-dealer-homepage-design.md)

## 빠른 시작

```bash
cd hyundai-dealer
npm install
npm run dev        # http://localhost:4321
```

빌드:

```bash
npm run fetch:content   # (선택) SNS 최신 콘텐츠 수집 → src/data/feed.json
npm run build           # 정적 사이트 → dist/
npm run preview         # 빌드 결과 미리보기
```

테스트:

```bash
npm test                # 콘텐츠 수집 정규화·폴백 단위 테스트
```

## 콘텐츠 수정 (코드 수정 없이)

딜러 정보·차종·출고 스토리·연락처는 모두 한 파일에 모여 있다:

- [`src/data/site.config.ts`](src/data/site.config.ts)

이미지 슬롯(`image`, `backgroundImage`)에 경로를 넣으면 해당 위치에 사진이 들어가고,
비워두면 프리미엄 그라디언트/일러스트 비주얼로 자동 폴백된다.
직접 가진 이미지는 `public/images/` 에 두고 `/images/파일명` 으로 참조한다.

## 실제 이미지 자동 수집 (현대 공식 이미지 등)

이미지 URL만 채우면 **빌드 시 자동 다운로드되어 사이트에 자체 호스팅**된다(핫링크 아님).

1. [`src/data/image-sources.json`](src/data/image-sources.json) 에 URL을 채운다:
   - `hero` — 히어로 배경 이미지
   - `profile` — 딜러 프로필 사진
   - `models.<id>` — 차종 카드 이미지 (`id` 는 `site.config.ts` 의 각 차종 id)
2. `npm run fetch:images` → `public/images/` 로 내려받고 `src/data/images.json` 매니페스트 생성
3. 빌드하면 해당 슬롯이 일러스트 대신 실제 사진으로 교체된다.

URL이 비었거나 다운로드가 실패하면 그 슬롯은 **일러스트로 폴백**되어 빌드는 항상 성공한다.
(사내망/샌드박스는 외부 접근이 막혀 실패할 수 있으나, GitHub Actions 러너에서는 정상 동작한다.)

## SNS 자동 업데이트

`npm run fetch:content` 가 아래 API를 호출해 `src/data/feed.json` 을 갱신한다.

| 환경변수 | 설명 |
| --- | --- |
| `YT_API_KEY` | YouTube Data API v3 키 |
| `YT_CHANNEL_ID` | 수집할 채널 ID (`UC...`) |
| `YT_MAX_RESULTS` | 영상 개수 (기본 6) |
| `IG_ACCESS_TOKEN` | Instagram Graph API 장기 토큰 |
| `IG_USER_ID` | (선택) IG 비즈니스 계정 ID |
| `IG_MAX_RESULTS` | 게시물 개수 (기본 8) |

키가 없거나 API가 실패하면 **마지막 정상 `feed.json` 을 그대로 유지**하므로
빌드는 항상 성공한다. 형식은 [`.env.example`](.env.example) 참고.

자동화는 저장소 루트의 GitHub Actions 워크플로
[`.github/workflows/hyundai-dealer.yml`](../.github/workflows/hyundai-dealer.yml) 가
매일 실행한다(키는 GitHub Secrets로 주입).

## 구조

```
src/
  data/site.config.ts   # 모든 정적 콘텐츠 (여기만 고치면 됨)
  data/feed.json         # SNS 피드 (자동 생성·커밋)
  layouts/Base.astro     # 공통 셸 + 스크롤/내비 스크립트
  components/             # 섹션별 컴포넌트
  pages/index.astro      # 섹션 조립
scripts/fetch-content.mjs # SNS 수집기
test/                     # 단위 테스트
```
