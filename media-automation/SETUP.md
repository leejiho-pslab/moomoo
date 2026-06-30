# 자동화 켜기 — 단계별 안내 (한 번만 하면 됩니다)

자동화 로봇이 구글 드라이브 문을 열 수 있게 **"로봇 전용 출입증"(서비스 계정)**을 만들고,
GitHub에 등록하는 과정이에요. 클릭 위주라 10~15분이면 됩니다.

---

## 1단계 · 구글 클라우드에서 출입증 만들기

1. https://console.cloud.google.com 접속 → 상단에서 **새 프로젝트** 만들기 (이름: `moomoo-automation` 등)
2. 검색창에 **"Google Drive API"** → 들어가서 **사용 설정(Enable)** 클릭
3. 왼쪽 메뉴 **API 및 서비스 → 사용자 인증 정보** → **+ 사용자 인증 정보 만들기 → 서비스 계정**
   - 이름: `moomoo-bot` → 만들고 완료
4. 만들어진 서비스 계정 클릭 → **키(KEYS)** 탭 → **키 추가 → 새 키 만들기 → JSON** → 다운로드
   - 📄 `xxxxx.json` 파일이 받아져요. **이게 출입증**입니다. (남에게 공유 금지)
5. 그 서비스 계정의 **이메일 주소**를 복사해 둡니다.
   (`moomoo-bot@...iam.gserviceaccount.com` 형태)

---

## 2단계 · 드라이브 폴더를 출입증에 공유

1. 구글 드라이브에서 **원본 영상 폴더**(예: `묵내미`) 우클릭 → **공유**
2. 1단계에서 복사한 **서비스 계정 이메일**을 붙여넣고 → **편집자** 권한으로 공유
   - (완성본 폴더를 따로 쓰면 그 폴더도 같은 방식으로 공유)
3. 폴더 주소창의 ID를 복사해 둡니다.
   `https://drive.google.com/drive/folders/`**`이부분이_폴더ID`**

---

## 3단계 · GitHub에 등록

저장소 페이지 → **Settings** 탭에서:

**A) 출입증(JSON) 등록**
- **Secrets and variables → Actions → Secrets** 탭 → **New repository secret**
- Name: `GDRIVE_SA_KEY`
- Secret: 받은 **JSON 파일 내용 전체**를 복사해 붙여넣기 → 저장

**B) 원본 폴더 ID 등록**
- 같은 화면 **Variables** 탭 → **New repository variable**
- Name: `GDRIVE_INPUT_FOLDER_ID` / Value: 2단계의 폴더 ID
- (완성본 폴더를 지정하려면 `GDRIVE_OUTPUT_FOLDER_ID` 도 추가. 안 하면 자동 생성)

---

## 4단계 · 작동 확인

- 저장소 **Actions** 탭 → **media-automation** → **Run workflow** (수동 실행)
- 초록불이 뜨면 성공 🎉 → 드라이브 **완성본** 폴더에 편집된 영상이 생깁니다.
- 이후엔 **매일 아침 6시 자동 실행** + 원본 올릴 때마다 처리돼요.

> 막히면 어느 단계에서 멈췄는지 알려주세요. 화면 보면서 같이 풀어드릴게요.
