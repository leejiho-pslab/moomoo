# 완성본을 구글 드라이브에 자동 저장 — OAuth 설정 (한 번만)

개인 Gmail은 로봇(서비스 계정)이 파일을 **저장**할 수 없어요(구글 정책).
그래서 "사장님 계정으로 저장하도록 위임"하는 **OAuth 열쇠**를 한 번 발급합니다. 전부 브라우저로 가능해요.

> 읽기(원본 폴더)는 이미 만든 **서비스 계정**이 담당하고, 저장만 이 OAuth가 담당합니다.

---

## A. OAuth 동의 화면 만들기  (구글 클라우드, `moomoo-automation` 프로젝트)

1. https://console.cloud.google.com → 좌측 ☰ → **API 및 서비스 → OAuth 동의 화면**
2. User Type **외부(External)** → 만들기
3. 앱 이름 `moomoo-automation`, 지원 이메일·개발자 이메일 = 본인(`ljhnimwithit@gmail.com`) → 저장하고 계속
4. 범위(Scopes)는 그냥 **저장하고 계속**, 테스트 사용자에 본인 이메일 추가 → 저장
5. ⭐ **중요**: 동의 화면 요약에서 **「앱 게시」(PUBLISH APP) → 프로덕션으로 전환**
   - 안 하면 인증이 **7일마다 만료**돼요. "미인증 앱" 경고가 떠도 그대로 진행하면 됩니다.

## B. OAuth 클라이언트 ID 만들기

1. **사용자 인증 정보 → + 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
2. 애플리케이션 유형 **웹 애플리케이션**
3. **승인된 리디렉션 URI**에 추가:
   ```
   https://developers.google.com/oauthplayground
   ```
4. 만들기 → **클라이언트 ID**와 **클라이언트 보안 비밀** 복사(보관)

## C. 리프레시 토큰 발급  (OAuth Playground — 브라우저만)

1. https://developers.google.com/oauthplayground 접속
2. 오른쪽 위 **⚙(설정)** → **Use your own OAuth credentials** 체크 → B의 Client ID/Secret 입력
3. 왼쪽 **Step 1** 맨 아래 빈칸에 스코프 직접 입력 후 **Authorize APIs**:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
4. 본인 구글 계정 로그인·동의 (미인증 경고는 **계속**)
5. **Step 2 → Exchange authorization code for tokens** 클릭 → **Refresh token** 복사

## D. GitHub에 비밀 등록  (저장소 → Settings → Secrets and variables → Actions → New repository secret)

| 이름 | 값 |
| --- | --- |
| `GDRIVE_OAUTH_CLIENT_ID` | B의 클라이언트 ID |
| `GDRIVE_OAUTH_CLIENT_SECRET` | B의 보안 비밀 |
| `GDRIVE_OAUTH_REFRESH_TOKEN` | C의 refresh token |
| `GDRIVE_SA_KEY` | 서비스 계정 JSON 파일 내용 전체 (읽기용) |

## E. 작동 확인

- 저장소 **Actions → media-automation → Run workflow**
- 내 드라이브에 **「완성본 (자동생성)」** 폴더가 생기고 편집본이 들어오면 성공 🎉

---

### 참고
- 저장은 `drive.file` 권한이라 **이 자동화가 만든 파일/폴더만** 접근해요(사장님 다른 파일은 못 봄 — 안전).
- 원본 읽기는 서비스 계정이 공유받은 `raw 업로드` 폴더만 봅니다.
