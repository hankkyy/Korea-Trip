#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const sw = await readFile(new URL('sw.js', root), 'utf8');
const baseUrls = [
  'https://korea-vercel.vercel.app/',
  'https://korea-hanoi-d4gj8vd2q1e7a3dc0.webapps.tcloudbase.com/',
  'https://jinlu.cloud/'
];
const apiBase = 'https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api';
const requiredHtml = ['在璐上', 'Korea Trip', 'imageViewer', 'docViewer', 'journalToggle'];
const requiredHtmlMissing = requiredHtml.filter((item) => !html.includes(item));
const assetPaths = [...sw.matchAll(/'([^']+)'/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith('/assets/'));
const localMissing = assetPaths.filter((path) => !existsSync(new URL(`.${path}`, root)));
const failures = [];

async function check(label, url, predicate = (res) => res.ok) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!predicate(res)) failures.push(`${label}: HTTP ${res.status}`);
    return res;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    return null;
  }
}

for (const url of baseUrls) await check(`入口 ${url}`, url);
await check('manifest', `${baseUrls[0]}manifest.json`);
await check('service worker', `${baseUrls[0]}sw.js`);

for (const path of assetPaths) {
  await check(`资源 ${path}`, `${baseUrls[0]}${path}`);
}

for (const path of ['/itinerary', '/todos', '/checklist', '/docs']) {
  const res = await check(`API ${path}`, `${apiBase}${path}?tripId=korea-2026`);
  if (res?.ok) {
    try {
      const body = await res.json();
      if (!body.success || !Array.isArray(body.data)) failures.push(`API ${path}: 返回结构异常`);
    } catch (error) {
      failures.push(`API ${path}: JSON 无法解析 (${error.message})`);
    }
  }
}

await check('天气 API', 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m&timezone=Asia%2FSeoul');

if (requiredHtmlMissing.length) failures.push(`页面缺少关键标记: ${requiredHtmlMissing.join(', ')}`);
if (localMissing.length) failures.push(`本地缓存资源不存在: ${localMissing.join(', ')}`);

console.log(`入口: ${baseUrls.length}，缓存资源: ${assetPaths.length}，API: 4，天气: 1`);
if (failures.length) {
  console.error(`失败 ${failures.length} 项`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('全部通过');
}
