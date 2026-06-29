import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

/**
 * public/images/ 에 직접 올린(커밋한) 이미지가 있으면 그 경로를 반환한다.
 * 예: localImage('profile') → public/images/profile.jpg 존재 시 'images/profile.jpg'.
 * 빌드(Node) 시점에만 동작하는 서버 전용 헬퍼.
 */
export function localImage(basename: string): string | null {
  for (const ext of EXTS) {
    if (existsSync(resolve('public/images', `${basename}.${ext}`))) {
      return `images/${basename}.${ext}`;
    }
  }
  return null;
}
