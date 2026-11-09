// 生成 assets/world_bake.txt（见 js/bake.js）。任何 js 改动之后、发布之前跑一次：
//   node tools/bake.cjs <网站目录>      例：node tools/bake.cjs yuyang-3d-site
// 需要 Playwright + Chromium。网站目录里要有 index.html、js/、assets/。
// 电脑版、手机版各录一遍（石头精度、碎石数量不同），合成一个文件。
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const root = path.resolve(process.argv[2] || '.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port, b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    let merged = null;
    for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['mobile', devices['iPhone 13']]]) {
      const ctx = await b.newContext(opts), p = await ctx.newPage();
      p.on('console', (m) => { if (/\[bake\]/.test(m.text())) console.log(name, m.text()); });
      p.on('pageerror', (e) => console.error(name, 'pageerror', e.message));
      await p.goto(`http://127.0.0.1:${port}/?bake&fixedres`);
      await p.waitForFunction(() => window.__bakeText, null, { timeout: 600000 });
      const d = JSON.parse(await p.evaluate(() => window.__bakeText));
      await ctx.close();
      if (!merged) merged = d;
      else {
        if (d.hash !== merged.hash) throw new Error('hash differs between passes');
        Object.assign(merged.arrays, d.arrays); Object.assign(merged.lists, d.lists);
        for (const g in d.hits) merged.hits[g] = Object.assign(merged.hits[g] || {}, d.hits[g]);
      }
    }
    const txt = JSON.stringify(merged);
    fs.writeFileSync(path.join(root, 'assets/world_bake.txt'), txt);
    console.log(`wrote assets/world_bake.txt ${(txt.length / 1024).toFixed(0)} KB, lists ${Object.keys(merged.lists)}, hits ${Object.keys(merged.hits.S06 || {}).length}`);
  } finally { await b.close(); srv.close(); }
});
