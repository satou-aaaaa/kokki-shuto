// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、生成りの地球と、どこの国でもない白い旗。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#1d3557"/>
      <circle cx="50" cy="56" r="28" fill="#fbf6ea"/>
      <g fill="none" stroke="#2d3f6b" stroke-width="2" opacity=".55"><ellipse cx="50" cy="56" rx="12" ry="28"/><line x1="22" y1="56" x2="78" y2="56"/><path d="M26 42h48M26 70h48"/></g>
      <line x1="50" y1="14" x2="50" y2="40" stroke="#f3e9cc" stroke-width="3" stroke-linecap="round"/>
      <path d="M51 15h22l-5 6 5 6H51z" fill="#a8321e"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
