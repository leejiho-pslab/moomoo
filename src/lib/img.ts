/**
 * 이미지 경로를 base 경로 기준으로 해석한다.
 * - http(s) URL 은 그대로 반환
 * - 'images/foo.jpg' / '/images/foo.jpg' → BASE_URL 접두 적용 (하위 경로 배포 대응)
 * - null/빈 값 → null (컴포넌트에서 일러스트 폴백 처리)
 */
export function img(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, '')}`;
}
