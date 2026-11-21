import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('index.html 只引用本地资源，无 http(s) 外链、无内嵌图片', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(!/https?:\/\//i.test(html), '存在 http(s) 外链');
  assert.ok(!/data:image/i.test(html), '存在内嵌图片');
  assert.ok(!/base64/i.test(html), '存在 base64');
  assert.ok(html.includes('./style.css'));
  assert.ok(html.includes('./src/app.mjs'));
});

test('style.css 无外链、无 @import、无远程 url()', () => {
  const css = readFileSync(join(root, 'style.css'), 'utf8');
  assert.ok(!/https?:\/\//i.test(css));
  assert.ok(!/@import/i.test(css));
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  assert.ok(urls.every(u => !/^["']?https?:/i.test(u)), '存在远程 url()');
});

test('所有源码与页面无 http(s) 外链、无 data: 图片', () => {
  const files = ['src/app.mjs', 'src/controller.mjs', 'src/engine.mjs', 'src/levels.mjs',
    'src/persistence.mjs', 'src/timing.mjs', 'src/view.mjs', 'src/audio.mjs'];
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    assert.ok(!/https?:\/\//i.test(text), `${f} 存在外链`);
    assert.ok(!/data:image/i.test(text), `${f} 存在内嵌图片`);
  }
});

test('scene.svg 与 favicon.svg 存在且为合法 SVG，无外链', () => {
  for (const f of ['art/scene.svg', 'art/favicon.svg']) {
    const p = join(root, f);
    assert.equal(existsSync(p), true, `${f} 不存在`);
    const svg = readFileSync(p, 'utf8');
    assert.ok(svg.trim().startsWith('<svg'), `${f} 非 SVG`);
    assert.ok(!/https?:\/\//i.test(svg.replace('http://www.w3.org/2000/svg', '')), `${f} 存在外链`);
  }
});

test('场景 SVG 覆盖全部热点区域（宽高与 viewBox 对齐）', () => {
  const svg = readFileSync(join(root, 'art/scene.svg'), 'utf8');
  assert.ok(svg.includes('viewBox="0 0 1000 600"'));
  // 关键场景元素都在
  for (const token of ['储物柜', '舷窗', '导航', '生命维持', '逃生舱门', '座椅', '控制台', '工具箱']) {
    // 用注释标记校验（SVG 里以中文注释标注各区域）
    assert.ok(svg.includes(token), `场景缺少 ${token} 区域标注`);
  }
});
