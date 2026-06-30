// 구글 드라이브 연동 헬퍼 (서비스 계정 인증).
// 인증: 환경변수 GDRIVE_SA_KEY 에 서비스 계정 JSON 전체를 넣거나,
//       GDRIVE_SA_KEY_FILE 에 JSON 파일 경로를 넣는다. (GitHub Secret 로 주입)

import { google } from 'googleapis';
import { readFileSync, createWriteStream } from 'node:fs';

function loadCredentials() {
  const raw = process.env.GDRIVE_SA_KEY;
  const file = process.env.GDRIVE_SA_KEY_FILE;
  if (raw) return JSON.parse(raw);
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  throw new Error(
    '구글 인증 정보가 없습니다. GitHub Secret 에 GDRIVE_SA_KEY(서비스 계정 JSON) 를 등록하세요.',
  );
}

export function getDrive() {
  const creds = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

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

// 부모 폴더 아래에 이름이 name 인 폴더를 찾거나 새로 만든다
export async function ensureFolder(drive, name, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    ...COMMON,
  });
  if (res.data.files?.length) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    ...COMMON,
  });
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
