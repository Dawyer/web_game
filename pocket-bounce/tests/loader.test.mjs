import test from 'node:test';
import assert from 'node:assert/strict';

const url = new URL('../src/loader.mjs', import.meta.url);

test('all seventeen original local assets load with explicit progress and no substitutions', async () => {
  const { ART_MANIFEST, loadResources } = await import(url);
  assert.equal(Object.keys(ART_MANIFEST).length, 17);
  assert.ok(Object.values(ART_MANIFEST).every(path => /^\.\/art\/.+\.(png|jpg)$/.test(path)));
  const seen = [], progress = [];
  const assets = await loadResources({ loadImage: async path => { seen.push(path); return { src: path, width: 320, height: 320 }; }, onProgress: p => progress.push(p) });
  assert.equal(Object.keys(assets).length, 17);
  assert.deepEqual(new Set(seen), new Set(Object.values(ART_MANIFEST)));
  assert.equal(progress.at(-1).loaded, 17);
  assert.equal(progress.at(-1).total, 17);
  assert.equal(assets.arrow.src, './art/arrow.png');
});

test('failed resources report exact local paths and retry preserves successfully loaded originals', async () => {
  const { loadResources } = await import(url);
  const cache = {}, calls = [];
  let fail = true;
  const options = { manifest: { felt: './art/felt.png', arrow: './art/arrow.png' }, cache, loadImage: async path => { calls.push(path); if (fail && path.includes('arrow')) throw new Error('404'); return { src: path }; } };
  await assert.rejects(loadResources(options), error => {
    assert.equal(error.name, 'ResourceLoadError'); assert.deepEqual(error.failures.map(f => f.path), ['./art/arrow.png']); return true;
  });
  fail = false;
  const assets = await loadResources(options);
  assert.equal(calls.filter(path => path.includes('felt')).length, 1);
  assert.equal(assets.arrow.src, './art/arrow.png');
});

test('stalled loads time out honestly and remote or invalid assets are rejected', async () => {
  const { loadResources } = await import(url);
  await assert.rejects(loadResources({ manifest: { felt: './art/felt.png' }, timeoutMs: 5, loadImage: () => new Promise(() => {}) }), /超时/);
  await assert.rejects(loadResources({ manifest: { invalid: 'https://example.invalid/a.png' }, loadImage: async () => ({}) }), /本地/);
  await assert.rejects(loadResources({ manifest: { felt: './art/felt.png' }, loadImage: async () => null }), /资源/);
});
