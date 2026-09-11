const { createHash } = require('crypto');
const ROOT = 'cloud://hanoi-d4gj8vd2q1e7a3dc0.6861-hanoi-d4gj8vd2q1e7a3dc0-1448781892/';
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const TYPES = new Map([
  ['application/pdf', 'pdf'], ['image/jpeg', 'jpg'], ['image/png', 'png'],
  ['image/webp', 'webp'], ['image/gif', 'gif'], ['text/plain', 'txt'],
  ['text/markdown', 'md'], ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']
]);
function owner(caller) {
  if (caller.role !== 'owner') throw Object.assign(new Error('文件仅旅行成员可用'), { status: 403 });
}
function assertFileScope(fileID, tripId, caller) {
  owner(caller);
  const legacy = tripId === 'korea-2026' ? 'korea' : tripId;
  const allowed = [`${ROOT}private/shared/${tripId}/`, `${ROOT}private/${legacy}/`];
  if (typeof fileID !== 'string' || /(?:\.\.|\\|%2e|%2f|%5c)/i.test(fileID) || !allowed.some(prefix => fileID.startsWith(prefix))) {
    throw Object.assign(new Error('文件不属于此旅程'), { status: 403 });
  }
}
function createFileService(app) {
  async function upload(body, tripId, caller) {
    owner(caller);
    const mime = String(body.mime || '').toLowerCase();
    if (!TYPES.has(mime)) throw Object.assign(new Error('不支持此文件格式，请使用图片、PDF、Word 或文本'), { status: 400 });
    if (typeof body.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw Object.assign(new Error('文件编码无效'), { status: 400 });
    const bytes = Buffer.from(body.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw Object.assign(new Error('文件需介于 1 字节与 4MB 之间'), { status: 413 });
    const digest = createHash('sha256').update(bytes).digest('hex');
    const result = await app.uploadFile({ cloudPath: `private/shared/${tripId}/${digest}.${TYPES.get(mime)}`, fileContent: bytes });
    if (!result.fileID) throw new Error('文件上传未确认，请重试');
    assertFileScope(result.fileID, tripId, caller);
    return { success: true, fileID: result.fileID, mime, size: bytes.length };
  }
  async function resolve(fileID, tripId, caller) {
    assertFileScope(fileID, tripId, caller);
    const result = await app.getTempFileURL({ fileList: [{ fileID, maxAge: 900 }] });
    const entry = result.fileList?.[0];
    if (!entry?.tempFileURL || entry.code && entry.code !== 'SUCCESS') throw new Error('文件链接生成失败，请稍后重试');
    return { success: true, url: entry.tempFileURL, expiresAt: Date.now() + 840000 };
  }
  return { upload, resolve };
}
module.exports = { createFileService, assertFileScope, ROOT };
