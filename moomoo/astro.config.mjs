// @ts-check
import { defineConfig } from 'astro/config';

// 배포 호스트가 정해지면 site(및 필요 시 base)를 환경변수로 주입한다.
// 예: GitHub Pages → site: 'https://<user>.github.io', base: '/<repo>'
export default defineConfig({
  site: process.env.SITE_URL || 'https://hyundai-dealer.example.com',
  base: process.env.SITE_BASE || '/',
  build: {
    inlineStylesheets: 'auto',
  },
});
