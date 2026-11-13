export const ART_MANIFEST = Object.freeze(Object.fromEntries([
  'felt', 'wood', 'ball_red', 'ball_yellow', 'ball_blue', 'ball_green', 'ball_purple', 'ball_orange',
  'arrow', 'pocket', 'ring', 'mirror', 'block', 'panel', 'button', 'star', 'bg_levelselect'
].map(name => [name, `./art/${name}.${name === 'bg_levelselect' ? 'jpg' : 'png'}`])));

export function browserImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法读取资源：${path}`));
    image.src = path;
  });
}

export async function loadResources({ manifest = ART_MANIFEST, loadImage = browserImage, onProgress = () => {}, cache = {}, timeoutMs = 12000 } = {}) {
  const entries = Object.entries(manifest), assets = {}, failures = [];
  if (entries.some(([, path]) => !/^\.\/art\/[\w-]+\.(png|jpg)$/.test(path))) throw new Error('只允许项目本地 art 资源。');
  let loaded = 0;
  onProgress({ loaded, total: entries.length });
  await Promise.all(entries.map(async ([name, path]) => {
    let timer;
    try {
      const image = cache[path] ?? await Promise.race([
        Promise.resolve().then(() => loadImage(path)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`资源加载超时：${path}`)), timeoutMs); })
      ]);
      if (!image) throw new Error(`资源无效：${path}`);
      assets[name] = image; cache[path] = image; loaded++;
    } catch (error) { failures.push({ name, path, reason: error.message }); }
    finally { clearTimeout(timer); onProgress({ loaded, total: entries.length, name, failed: failures.length }); }
  }));
  if (failures.length) {
    const error = new Error(`资源加载失败，请重试：${failures.map(f => `${f.path}（${f.reason}）`).join('；')}`);
    error.name = 'ResourceLoadError'; error.failures = failures; throw error;
  }
  return assets;
}
