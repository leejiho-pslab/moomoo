이 저장소는 moomoo/ 하위 폴더에 Astro 프로젝트가 잘못 들어가 있어. 다음을 해줘:
1) moomoo/ 폴더 안의 모든 파일·폴더를 저장소 루트로 이동하고 빈 moomoo/ 는 삭제
2) 루트에 .github/workflows/deploy.yml 을 아래 내용으로 생성
3) main 에 커밋·푸시

.github/workflows/deploy.yml:
name: deploy
on:
  schedule: [{ cron: '0 21 * * *' }]
  workflow_dispatch:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - name: Fetch content + images
        env: { YT_CHANNEL_URL: 'https://www.youtube.com/@hyundai_moomoo' }
        run: |
          npm run fetch:content
          npm run fetch:images
      - name: Build
        env: { SITE_BASE: '/moomoo/' }
        run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
