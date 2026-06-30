// 구글 드라이브 연동 헬퍼.
// 인증 방식 2가지 (OAuth 우선):
//  1) OAuth 사용자 위임 (드라이브 '저장'까지 가능 — 개인 Gmail 권장)
//     GDRIVE_OAUTH_CLIENT_ID / GDRIVE_OAUTH_CLIENT_SECRET / GDRIVE_OAUTH_REFRESH_TOKEN
//  2) 서비스 계정 (읽기 위주 — 개인 Gmail 은 새 파일 저장 불가)
//     GDRIVE_SA_KEY (JSON 문자열) 또는 GDRIVE_SA_KEY_FILE (경로)

import { google } from 'googleapis';
import { readFileSync, createWriteStream } from 'node:fs';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function oauthAuth() {
  const cid = process.env.GDRIVE_OAUTH_CLIENT_ID;
  const csecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;
  const rtoken = process.env.GDRIVE_OAUTH_REFRESH_TOKEN;
  if (!(cid && csecret && rtoken)) return null;
  const o = new google.auth.OAuth2(cid, csecret);
  o.setCredentials({ refresh_token: rtoken });
  return o;
}
function saAuth() {
  const raw = process.env.GDRIVE_SA_KEY;
  const file = process.env.GDRIVE_SA_KEY_FILE;
  if (!(raw || file)) return null;
  const creds = JSON.parse(raw || readFileSync(file, 'utf8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
}

export function hasOAuth() { return !!oauthAuth(); }

// 읽기(원본 폴더 조회/다운로드): 서비스 계정 우선(폴더 공유받음), 없으면 OAuth
export function getReadDrive() {
  const auth = saAuth() || oauthAuth();
  if (!auth) throw new Error('구글 인증 정보 없음 (GDRIVE_SA_KEY 또는 GDRIVE_OAUTH_* 필요).');
  return google.drive({ version: 'v3', auth });
}
// 쓰기(완성본 저장): OAuth(사용자 위임) 필수 — 개인 드라이브 저장 가능
export function getWriteDrive() {
  const auth = oauthAuth() || saAuth();
  if (!auth) throw new Error('구글 인증 정보 없음.');
  return google.drive({ version: 'v3', auth });
}

export function getDrive() { return getReadDrive(); }

const COMMON = { supportsAllDrives: true, includeItemsFromAllDrives: true };

// 폴더 하위의 모든 영상 파일을 (하위 폴더까지) 재귀적으로 수집
export async function listVideosRecursive(drive, folderId, trail = []) {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
      pageSize: 200,
      pageToken,
      ...COMMON,
    });
    for (const f of res.data.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        out.push(...(await listVideosRecursive(drive, f.id, [...trail, f.name])));
      } else if ((f.mimeType || '').startsWith('video/')) {
        out.push({ ...f, trail });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

export async function downloadFile(drive, fileId, destPath) {
  const res = await drive.files.get(
    { fileId, alt: 'media', ...COMMON },
    { responseType: 'stream' },
  );
  await new Promise((resolve, reject) => {
    const w = createWriteStream(destPath);
    res.data.on('error', reject).pipe(w);
    w.on('finish', resolve).on('error', reject);
  });
  return destPath;
}

// 폴더를 찾거나 새로 만든다. parentId 가 없으면 내 드라이브 최상위(root)에 생성.
export async function ensureFolder(drive, name, parentId) {
  const safe = name.replace(/'/g, "\\'");
  const q = parentId
    ? `'${parentId}' in parents and name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive.files.list({ q, fields: 'files(id, name)', ...COMMON });
  if (res.data.files?.length) return res.data.files[0].id;
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const created = await drive.files.create({ requestBody: body, fields: 'id', ...COMMON });
  return created.data.id;
}

export async function uploadFile(drive, localPath, name, folderId, mimeType) {
  const created = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: (await import('node:fs')).createReadStream(localPath) },
    fields: 'id, webViewLink',
    ...COMMON,
  });
  return created.data;
}

export async function getFileParent(drive, fileId) {
  const res = await drive.files.get({ fileId, fields: 'parents', ...COMMON });
  return res.data.parents?.[0];
}
