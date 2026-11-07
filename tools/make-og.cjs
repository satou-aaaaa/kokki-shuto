// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例（伏せ字の札）だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const clue = (n, t) => `<div style="display:flex;gap:18px;align-items:center;background:#fff;border:3px solid #2a211826;border-radius:16px;padding:16px 22px;font-size:34px;color:#2a2118"><span style="width:52px;height:52px;border-radius:50%;background:#a8321e;color:#fff;display:grid;place-items:center;font-weight:900">${n}</span>${t}</div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Serif CJK JP','Noto Sans CJK JP',serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:56px 72px;background:linear-gradient(180deg,#13243d,#1d3557);color:#f3e9cc;position:relative">
    <div style="font-size:32px;letter-spacing:.1em;color:#e6dcc0">この国旗・この首都は、どこの国？</div>
    <div style="font-size:120px;font-weight:900;letter-spacing:.14em;margin-top:4px">国旗と首都</div>
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:30px;width:820px">${clue("一", "正式な国名は「◯◯◯◯共和国」")}${clue("二", "？ まだ見ていない")}</div>
    <div style="position:absolute;right:80px;bottom:70px;width:220px;height:165px;border-radius:8px;border:4px dashed #f3e9cc88;display:grid;place-items:center;font-size:110px;font-weight:900;color:#f3e9cc88">？</div>
    <div style="position:absolute;right:80px;top:64px;font-size:30px;color:#e6dcc0">世界193か国</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
