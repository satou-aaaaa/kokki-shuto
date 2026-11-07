// 国旗と首都の検査。データ（外務省の一覧の写しと同じ・国旗の絵・伏せ字）・選び肢の作り方（全部の国×300の種）・
// 今日の5問と上級の組み方（3年分・過去の日が変わらない）・とことんの並び（500回）・練習の順・
// 通しで遊ぶ・まちがい・手がかりを聞く・続きから・上級・練習・とことん・国旗帳・実績・カレンダー・あとから・古いタブ・
// スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { checkSwStall } from "./sw-check.mjs";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const G = createRequire(import.meta.url)(path.join(root, "data.js"));
// 覚えた結果（MEMO）の無い data.js を読み直す（その日だけを作っても同じ問題になるか見る）
const freshData = () => { const m = { exports: {} }; new Function("module", "self", readFileSync(path.join(root, "data.js"), "utf8"))(m, undefined); return m.exports; };
const EPOCH = "2026-11-07";
const addDay = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10);

// ---- 1. データ（ブラウザを使わない）----
{
  const bad = [], ids = new Set(), CATS = G.CATS.map((c) => c.id);
  const tsv = readFileSync(path.join(root, "tools/countries.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
  const row = Object.fromEntries(tsv.map((r) => [r[0], r]));
  for (const x of G.D) {
    if (ids.has(x.id)) bad.push(`${x.id}:id が重なる`); ids.add(x.id);
    if (!/^[a-z]{2}$/.test(x.id) || !existsSync(path.join(root, "flags", x.id + ".svg"))) bad.push(`${x.id}:国旗の絵が無い`);
    if (!CATS.includes(x.cat) || ![0, 1, 2].includes(x.lv)) bad.push(`${x.id}:地域・難しさ`);
    const r = row[x.id];
    // 外務省の一覧の写し（tools/countries.tsv）と、正式な国名・首都が1字もちがわない
    if (!r || r[2].replace(/（注[０-９0-9]+）/g, "") !== x.f || (r[3] === "なし" ? "" : r[3]) !== x.cap || r[1] !== x.n) bad.push(`${x.id}:一覧の写しとちがう`);
    // 伏せ字：短い名前の文字が残らない・◯がある
    { const st = [...x.n.replace(/(共和国|国|諸島)$/, "")]; if (!x.m || !x.m.includes("◯") || st.some((ch, i) => i + 1 < st.length && x.m.includes(ch + st[i + 1]))) bad.push(`${x.id}:伏せ字に国名の2字が続けて残る ${x.m}`); }
    // 首都から当てる問題に出す国は、首都の名前に国の名前が入っていない
    if (x.c && (!x.cap || x.cap.includes([...x.n].slice(0, 3).join("")) || x.n.includes(x.cap.replace(/市$/, "")))) bad.push(`${x.id}:首都に国の名前`);
  }
  check(`データ：${G.D.length}か国（${G.CATS.map((c) => c.name + G.ofCat(c.id).length).join("・")}）。国旗の絵がある・正式な国名と首都が外務省の一覧の写しと同じ・伏せ字に国名の文字が残らない・首都に国の名前が入る国は首都から出さない`, bad.length === 0, bad.join(" / "));
  check("データ：一覧の196か国から、首都が空・注の付いた3か国（バチカン・アフガニスタン・イスラエル）だけを外す", tsv.length === 196 && G.D.length === 193 && ["va", "af", "il"].every((id) => !G.BY[id]) && tsv.every((r) => ["va", "af", "il"].includes(r[0]) || G.BY[r[0]]));
  check("データ：どの地域も13か国以上・むずかしいが3つ以上の地域が4つ以上（上級を作れる）", G.CATS.every((c) => G.ofCat(c.id).length >= 13) && G.CATS.filter((c) => G.D.filter((x) => x.cat === c.id && x.lv === 2).length >= 3).length >= 4);
  check("データ：国の短い名前は全部ちがう・国旗の SVG は外へ何も読まない", new Set(G.D.map((x) => x.n)).size === G.D.length && G.D.every((x) => !/(href|src)="https?:/.test(readFileSync(path.join(root, "flags", x.id + ".svg"), "utf8"))));
  check("国旗の絵の出どころ（flag-icons・MIT）を flags/LICENSE に書く", /flag-icons 7\.6\.0/.test(readFileSync(path.join(root, "flags/LICENSE"), "utf8")) && /MIT License/.test(readFileSync(path.join(root, "flags/LICENSE"), "utf8")));
  // 選び肢：全部の国×300の種で、4つ・答えを含む・同じ地域・見た目のよく似た国旗を並べない・同じ種で同じ問題・手がかりの順
  const ng = [], seen = {};
  for (const x of G.D) {
    seen[x.id] = new Set();
    for (let s = 0; s < 300; s++) {
      const P = G.make(`${x.id}|qa${s}`), o = P.opts.map((id) => G.BY[id]);
      if (P.opts.length !== 4 || new Set(P.opts).size !== 4 || !P.opts.includes(x.id)) { ng.push(`${x.id}:4つ`); break; }
      if (o.some((y) => y.cat !== x.cat)) { ng.push(`${x.id}:地域がまざる`); break; }
      if (o.some((a, i) => o.some((b, j) => i < j && G.share(a, b)))) { ng.push(`${x.id}:似た国旗が並ぶ ${P.opts}`); break; }
      if (JSON.stringify(G.make(`${x.id}|qa${s}`)) !== JSON.stringify(P)) { ng.push(`${x.id}:同じ種で同じにならない`); break; }
      if (P.c.length !== 3 || P.c[1].t !== `正式な国名は「${x.m}」` || (P.t === "f" ? P.c[0].k !== "flag" || P.c[2].t !== G.capText(x) : P.c[2].k !== "flag" || P.c[0].t !== G.capText(x))) { ng.push(`${x.id}:手がかりの順`); break; }
      if (P.t === "c" && !x.c) { ng.push(`${x.id}:首都に国の名前があるのに首都から出す`); break; }
      // 手がかり一・二の文字に、答えの国の名前を書かない
      if (P.c.slice(0, 2).some((c) => c.k === "text" && c.t.includes(x.n))) { ng.push(`${x.id}:手がかりに答えの名前`); break; }
      seen[x.id].add(P.opts.slice().sort().join());
    }
  }
  check("選び肢：全部の国×300の種で、4つ・答えを含む・同じ地域から・似た国旗を並べない・同じ種で同じ・手がかりは 国旗/首都→伏せ字→首都/国旗 の順・答えの名前を手がかり一・二に書かない", ng.length === 0, ng.slice(0, 5).join(" / "));
  const few = G.D.filter((x) => seen[x.id].size < 20).map((x) => `${x.id}:${seen[x.id].size}`);
  check("選び肢：どの国も20通り以上の組み合わせで出る（同じ4つばかりにならない）", few.length === 0, few.join(","));
  const both = G.D.filter((x) => x.c).every((x) => { const t = new Set(); for (let s = 0; s < 60; s++) t.add(G.make(`${x.id}|qb${s}`).t); return t.size === 2; });
  check("とことん・練習：首都から出せる国は、国旗からと首都からの両方の問題が出る", both);
  check("種の終わりの「:f」「:c」で問題の種類を決める（首都に国の名前が入る国は「:c」でも国旗から）", G.make("jp|x:c").t === "c" && G.make("jp|x:f").t === "f" && G.make("kw|x:c").t === "f");
}
{
  // 今日の5問・上級（3年分）
  const bad = [];
  for (let i = 0; i < 365 * 3; i++) {
    const k = addDay(EPOCH, i), dt = G.dailyTags(k), d = dt.map((t) => G.BY[t.split("|")[0]]), ht = G.hardTags(k), h = ht.map((t) => G.BY[t.split("|")[0]]);
    const T = (t) => G.make(t).t;
    if (d.length !== 5 || new Set(d.map((x) => x.id)).size !== 5) bad.push(`${k}:5つちがう`);
    if (new Set(d.map((x) => x.cat)).size !== 5) bad.push(`${k}:地域が重なる`);
    if (d.map((x) => x.lv).join() !== "0,0,1,1,2" || dt.map(T).join() !== "f,c,f,c,f") bad.push(`${k}:並び ${dt.map(T)}`);
    if (h.length !== 3 || new Set(h.map((x) => x.id)).size !== 3 || h.some((x) => x.lv !== 2 || d.includes(x)) || new Set(h.map((x) => x.cat)).size !== 3 || ht.map(T).join() !== "f,c,f") bad.push(`${k}:上級 ${ht}`);
    if (i % 30 === 0) { const F = freshData(); if (JSON.stringify(F.dailyTags(k)) !== JSON.stringify(G.dailyTags(k)) || JSON.stringify(F.hardTags(k)) !== JSON.stringify(G.hardTags(k))) bad.push(`${k}:前の日を作らずにその日だけ作ると、ちがう問題になる`); }
    if (bad.length) break;
  }
  check("今日の5問：3年分、ちがう地域の5か国（やさしい 国旗・首都、ふつう 国旗・首都、むずかしい 国旗）。上級はむずかしいの3か国（国旗・首都・国旗、地域がちがう、今日の5問と重ねない）", bad.length === 0, bad.join(" / "));
  let rep = 0; for (let i = 1; i < 365 * 3; i++) { const a = G.dailyTags(addDay(EPOCH, i - 1)).map((t) => t.split("|")[0]), b = G.dailyTags(addDay(EPOCH, i)).map((t) => t.split("|")[0]); if (b.some((x) => a.includes(x))) rep++; }
  check("今日の5問：きのうの5問と1つも重ならない（3年分）", rep === 0, rep);
  let hrep = 0; for (let i = 1; i < 365 * 3; i++) { const a = G.hardTags(addDay(EPOCH, i - 1)).map((t) => t.split("|")[0]), b = G.hardTags(addDay(EPOCH, i)).map((t) => t.split("|")[0]); if (b.some((x) => a.includes(x))) hrep++; }
  check("上級：きのうの3か国と重なる日が3年で30日以下", hrep <= 30, hrep);
  // 過去の日・先の日の問題が変わらない（データを足すときは最後に足す。shared-workflows game-dev.md F7）
  const snap = JSON.parse(readFileSync(path.join(root, "qa/daily-snapshot.json"), "utf8")), diff = Object.keys(snap).filter((k) => [...G.dailyTags(k), ...G.hardTags(k)].join() !== snap[k]);
  check(`今日の5問・上級：qa/daily-snapshot.json の${Object.keys(snap).length}日分と同じ（データ・作り方を変えても過去の日が変わらない）`, diff.length === 0, diff.slice(0, 5).join(","));
  let back = 0; for (let i = 1; i < 400; i++) { const a = G.dailyTags(addDay("2026-11-01", -i)).map((t) => t.split("|")[0]), b = G.dailyTags(addDay("2026-11-01", -i + 1)).map((t) => t.split("|")[0]); if (b.some((x) => a.includes(x))) back++; }
  check("今日の5問：始まりの日より前の400日も、となりの日と1つも重ならない", back === 0, back);
  check("知らない id（constructor など）の問題は作らない", G.make("constructor|2026-11-07:d0") === null && G.make("toString|x") === null);
  // 国を足しても（from を付ける）、その日より前の問題・選び肢は変わらない
  {
    const FROM = "2027-02-01", src = readFileSync(path.join(root, "data.js"), "utf8");
    const extra = G.CATS.flatMap((c) => [0, 1, 2].map((lv) => `{ id: "q${c.id}${lv}", cat: "${c.id}", lv: ${lv}, from: "${FROM}", n: "QA${c.id}${lv}", f: "QA${c.id}${lv}共和国", m: "◯◯◯◯共和国", cap: "キューエー", c: 1 },`)).join("\n");
    const at = src.indexOf("\n  ];\n  // ==D=="); const mod = { exports: {} };
    new Function("module", "self", src.slice(0, at) + "\n" + extra + src.slice(at))(mod, undefined);
    const H = mod.exports; let changed = [], used = 0, badNew = 0;
    for (let i = 0; i < 365 * 3; i++) {
      const k = addDay(EPOCH, i), a = [...G.dailyTags(k), ...G.hardTags(k)], b = [...H.dailyTags(k), ...H.hardTags(k)];
      if (k < FROM) { if (a.join() !== b.join()) changed.push(k); for (const t of [...a, `jp|${k}~qa:0`, `fr|${k}~qa:1`]) if (JSON.stringify(G.make(t)) !== JSON.stringify(H.make(t))) changed.push(t); }
      else { if (b.some((t) => /^q[a-z]{2}\d\|/.test(t))) used++; const d = H.dailyTags(k).map((t) => H.BY[t.split("|")[0]]); if (new Set(d.map((x) => x.id)).size !== 5 || d[4].lv !== 2) badNew++; }
    }
    check(`国を足しても（from ${FROM}）、その日より前の今日の5問・上級・選び肢は変わらない（3年分）`, changed.length === 0 && at > 0, changed.slice(0, 5).join(","));
    check("足した国は from の日から出てくる・5問の形は保つ", used > 0 && badNew === 0, JSON.stringify({ used, badNew }));
  }
  // 生成（tools/make-data.cjs）が、過去の日の問題を変える表を受けつけない（一時フォルダに写して動かす）
  {
    const { spawnSync } = await import("node:child_process");
    const { mkdtempSync, copyFileSync, rmSync } = await import("node:fs");
    const os = await import("node:os");
    const base = readFileSync(path.join(root, "tools/countries.tsv"), "utf8").replace(/\n*$/, "\n");
    const line = (from) => ["zz", "キューエー", "キューエー共和国", "キューエー市", "欧州", ...(from === undefined ? [] : [from])].join("\t");
    const next = (n) => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const run = (...tsvs) => {
      const d = mkdtempSync(path.join(os.tmpdir(), "kokki-gen-"));
      try {
        mkdirSync(path.join(d, "tools"));
        copyFileSync(path.join(root, "tools/make-data.cjs"), path.join(d, "tools/make-data.cjs"));
        for (const f of ["data.js", "sw.js"]) copyFileSync(path.join(root, f), path.join(d, f));
        // いくつか渡したときは順に生成し、前のものが通ったうえで最後が通るか
        let ok = true;
        for (const tsv of tsvs) { writeFileSync(path.join(d, "tools/countries.tsv"), tsv); ok = spawnSync(process.execPath, [path.join(d, "tools/make-data.cjs")], { encoding: "utf8" }).status === 0; if (!ok) break; }
        return ok;
      } finally { rmSync(d, { recursive: true, force: true }); }
    };
    const rows = base.split("\n"), mid = rows.findIndex((l) => l && !l.startsWith("#")) + 3;
    const cases = {
      "そのまま": [run(base), true],
      "最後に足す（from あしたより後）": [run(base + line(next(30)) + "\n"), true],
      "途中に足す": [run([...rows.slice(0, mid), line(next(30)), ...rows.slice(mid)].join("\n")), false],
      "最後に足す（from なし）": [run(base + line() + "\n"), false],
      "最後に足す（from が日付でない 2027-2-01）": [run(base + line("2027-2-01") + "\n"), false],
      "最後に足す（from が無い日 2027-02-30）": [run(base + line("2027-02-30") + "\n"), false],
      "最後に足す（from が今日）": [run(base + line(next(0)) + "\n"), false],
      "足した国の from をあとで変える": [run(base + line(next(30)) + "\n", base + line(next(31)) + "\n"), false],
      "足した国の from をあとで消す": [run(base + line(next(30)) + "\n", base + line() + "\n"), false],
      "足した国のあとにもう1つ足す": [run(base + line(next(30)) + "\n", base + line(next(30)) + "\n" + line(next(40)).replace(/^zz/, "zy") + "\n"), true],
    };
    const wrong = Object.entries(cases).filter(([, [got, want]]) => got !== want).map(([k]) => k);
    check("国の表の生成：最後に from（あしたより後の日）付きで足すときだけ通り、途中に足す・from なし・日付でない・今日より前・足した国の from を変える／消すは止まる", wrong.length === 0, wrong.join(","));
  }
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), data = readFileSync(path.join(root, "data.js"), "utf8");
const script = html.slice(html.indexOf('<script src="data.js"></script>'));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/www\.mofa\.go\.jp\/mofaj\/kids\/ichiran\/basic\.html$|^https:\/\/github\.com\/lipis\/flag-icons$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの並びと回の名札だけ（今日の5問・上級は日付の乱数。data.js には無い）", (script.match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(data));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(script + data));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(data.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + data));
check("好きなだけ遊べる：チケット・残りの命・「○○すると開く」を入れない", !/🎫|チケット|ライフ|🌸|すると開く|で開く|🔒/.test(script));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキーだけで読む", /<script src="transfer\.js" data-game="kokki-shuto" data-keys="kokki-v1"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/kokki-shuto/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js も）、取り直して保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  { const fl = JSON.parse(sw.match(/const FLAGS = (\[[^\]]*\])/)[1]); check("PWA：国旗は全部の国の分を保存し、1枚取れなくても・止まっても（15秒で打ち切る）入れる（画面のファイルだけ addAll）", fl.length === G.D.length && G.D.every((x) => fl.includes(`./flags/${x.id}.svg`)) && /c\.addAll\(SHELL\.map/.test(sw) && /FLAGS\.map\(\(u\) => addFlag\(c, u\)\)/.test(sw) && /setTimeout\(\(\) => ac\.abort\(\), 15000\)/.test(sw) && /signal: ac\.signal/.test(sw) && /\.catch\(\(\) => \{\}\)/.test(sw)); }
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても、4秒で保存した画面を返す（qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "国旗と首都" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. とことん・練習の並び（ブラウザの中の関数を何百回）----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (n) => addDay(TODAY, -n);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const ansIdx = (p) => p.evaluate(() => { const c = __kk.cur(); return c.P.opts.indexOf(c.P.id); });
const wrongIdx = (p) => p.evaluate(() => { const c = __kk.cur(); return c.P.opts.findIndex((o) => o !== c.P.id && !c.wrong.includes(o)); });
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("kokki-v1") || "{}"));
async function solve(p, { wrong = 0, hints = 0 } = {}) {
  for (let i = 0; i < hints; i++) await p.click("#hint");
  for (let i = 0; i < wrong; i++) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  await p.waitForSelector(".verdict");
}

try {
  {
    const p = await newPage();
    const r = await p.evaluate(() => {
      const G = __kk.G, all = G.D.length, out = { dup: 0, miss: 0, ramp: 0, join: 0 };
      for (let n = 0; n < 500; n++) {
        const a = __kk.endlessList(), ids = a.map((t) => t.split("|")[0]);
        if (new Set(ids).size !== ids.length) out.dup++;
        if (ids.length !== all) out.miss++;
        const lv = ids.map((id) => G.BY[id].lv); if (lv.some((v, i) => i && v < lv[i - 1])) out.ramp++;
        const b = __kk.endlessList(ids[ids.length - 1]); if (b[0].split("|")[0] === ids[ids.length - 1]) out.join++;
      }
      return out;
    });
    check("とことん：500回作って、1つの並びに全部の国が1回ずつ・やさしい→ふつう→むずかしいの順・つなぎ目で同じ国を続けない", r.dup + r.miss + r.ramp + r.join === 0, JSON.stringify(r));
    const pr = await p.evaluate(() => {
      const G = __kk.G, s = { dex: {} }; let bad = 0;
      // 半分を当てたことにして、練習はまだのものから出す
      G.D.forEach((x, i) => { if (i % 2 === 0) s.dex[x.id] = 3; });
      for (let n = 0; n < 300; n++) { const cat = n % 7 === 6 ? "" : "as,eu,af,am,me,oc".split(",")[n % 7], l = __kk.practiceList(s, cat), left = G.D.filter((x) => (!cat || x.cat === cat) && !s.dex[x.id]).length; if (l.length !== 5 || l.filter((t) => !s.dex[t.split("|")[0]]).length !== Math.min(5, left) || l.some((t) => cat && G.BY[t.split("|")[0]].cat !== cat)) bad++; }
      return bad;
    });
    check("練習：300回作って、選んだ地域の、まだ当てていない国を先に5つ出す", pr === 0, pr);
    await p.context().close();
  }

  // ---- 遊び方を Esc で閉じても、次から出ない（2026-11-07 okane-kihon で見つけた。shared-workflows #186・game-dev.md「遊び方」）----
  // close は遅れて届くので、Esc を押したその場で届く cancel で印を残す。すぐ読み直しても出ないかを10回見る
  {
    const res = [];
    for (let i = 0; i < 10; i++) {
      const p = await newPage();
      const first = await p.locator("#howto[open]").count() === 1;
      await p.keyboard.press("Escape");
      const saved = await p.evaluate(() => __kk.load().tut === true);
      await p.reload(); await p.waitForTimeout(150);
      const again = await p.locator("#howto[open]").count();
      res.push({ first, saved, again });
      await p.context().close();
    }
    check("遊び方を Esc で閉じてすぐ読み直しても、遊び方が出ない（10回）", res.every(r => r.first && r.saved && r.again === 0), JSON.stringify(res.filter(r => !(r.first && r.saved && r.again === 0))));
  }

  // ---- 4. ブラウザで遊ぶ ----
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  await p.click("#howto-ok");
  check("「わかった」を押した直後に、遊び方を見た印が残っている（close を待たない）", await p.evaluate(() => __kk.load().tut === true));
  check("上級・とことん・練習は、はじめての日から押せる（鍵なし）", await p.locator("#go-h:not([disabled])").count() === 1 && await p.locator("#go-e:not([disabled])").count() === 1 && await p.locator("#go-p:not([disabled])").count() === 1);
  await p.click("#go-d");
  const tags = await p.evaluate(() => __kk.load().runs.d.list);
  check("今日の5問は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：はじめは手がかり1つ（残り2つは「まだ聞いていない」）と、選び肢4つ（高さ44px以上）", await p.locator(".clue:not(.wait)").count() === 1 && await p.locator(".clue.wait").count() === 2 && await p.locator(".ch").count() === 4 && (await p.$$eval(".ch", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 44));
  check("1問目（やさしい・国旗から）のはじめの手がかりは国旗の絵（名前の無い alt）", await p.locator(".clue:not(.wait) img.flag").count() === 1 && (await p.getAttribute(".clue:not(.wait) img.flag", "src")) === `flags/${tags[0].split("|")[0]}.svg` && (await p.getAttribute(".clue:not(.wait) img.flag", "alt")) === "この国の国旗" && await p.evaluate(() => { const i = document.querySelector(".clue img.flag"); return i.complete && i.naturalWidth > 0; }));
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と「ちがう」の文字（色だけで分けない）・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("ちがう") && (await p.textContent("#msg")).includes("ではありません") && await p.getAttribute("#msg", "role") === "status");
  await p.click("#hint");
  check("「もう1つ見る」で手がかり二が出る", await p.locator(".clue:not(.wait)").count() === 2);
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた印と聞いた手がかりのまま）", await p.locator(".ch.ng").count() === 1 && await p.locator(".clue:not(.wait)").count() === 2 && await p.evaluate(() => __kk.cur().i) === 0);
  await solve(p);
  check("当てると ✓ の印・国旗の印・首都と正式な国名・出典（外務省）・★1（まちがい1＋手がかり1）、手がかりは3つとも見える", await p.locator(".ch.ok").count() === 1 && await p.locator(".verdict .seal img.flag").count() === 1 && (await p.textContent(".verdict .why")).includes("首都") && (await p.textContent(".verdict .src")).includes("外務省") && (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ" && await p.locator(".clue.wait").count() === 0);
  check("はじめて当てた国は「国旗帳に書きとめました」", (await p.textContent(".verdict")).includes("国旗帳に書きとめました"));
  await p.click("#next");
  { const P = await p.evaluate(() => __kk.cur().P); check("2問目（やさしい・首都から）は、はじめの手がかりが首都", P.t === "c" && (await p.textContent(".clue:nth-child(1)")).includes("首都") && G.BY[P.id].lv === 0); }
  await p.click("#hint"); await p.click("#hint");
  check("手がかりは3つまで（3つ聞くとボタンが止まる）", await p.locator("#hint:disabled").count() === 1 && await p.locator(".clue:not(.wait)").count() === 3);
  await solve(p);
  check("手がかりを2つ足したら★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい＋手がかり（2・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[2,2,0,0,0]");
  const share = await p.textContent(".share");
  const leaked = G.D.filter((x) => [...x.n].length >= 2 && share.includes(x.n));
  check("シェアの文に国の名前（答え）を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && leaked.length === 0, share);
  check("結果に今日書きとめた5か国（国旗と首都）が並ぶ", await p.locator(".rlist > div").count() === 5 && await p.locator(".rlist img.flag").count() === 5);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  check("国旗帳に5つ載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」", (await p.textContent("#go-d")).includes("結果"));
  // 上級：手がかり2つ・聞き足しなし・3問
  await p.click("#go-h");
  check("上級は手がかり2つから・聞き足しのボタンが無い・3問", await p.locator("#hint").count() === 0 && await p.locator(".clue:not(.wait)").count() === 2 && (await p.evaluate(() => __kk.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る（まちがいなしは★3）", JSON.stringify((await mem(p)).hdays[TODAY]?.m) === "[0,0,0]");
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-c="af"]');
  const before = await mem(p);
  check("練習は選んだ地域だけ・まだ当てていない国から", (await p.evaluate(() => __kk.load().runs.p.list)).every((t) => { const x = G.BY[t.split("|")[0]]; return x.cat === "af" && !before.dex[x.id]; }));
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（国旗帳の数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 5);
  // 国旗帳：当てたものは国旗と名前、まだのものは「？？？」
  await p.click("#back"); await p.click("#go-dex");
  const got = await p.locator(".book button").count(), no = await p.locator(".book .no").count(), bc = await p.getAttribute('.tabs button[aria-pressed="true"]', "data-c");
  check("国旗帳：当てた国は国旗と名前、まだの国は「？？？」で国旗も名前も出さない", got >= 1 && no >= 1 && await p.locator(".book button img.flag").count() === got && await p.locator(".book .no img").count() === 0 && (await p.locator(".book .no b").allTextContents()).every((t) => t === "？？？") && !(await p.textContent(".book")).includes(G.D.find((x) => x.cat === bc && !after.dex[x.id]).n));
  await p.click(".book button");
  check("国旗帳の国を押すと、国旗・首都・正式な国名・出典を読み返せる", await p.locator(".detail img.flag").count() === 1 && (await p.textContent(".detail .why")).includes("正式な国名") && (await p.textContent(".detail .src")).includes("外務省"));
  await p.click("#back"); await p.click('.tabs button[data-c="oc"]');
  check("国旗帳の地域を切り替えられる", await p.locator('.tabs button[data-c="oc"][aria-pressed="true"]').count() === 1 && (await p.locator(".book > *").count()) === G.ofCat("oc").length);
  // とことん：まちがえても終わらず、「ここで降りる」で終わる
  await p.click("#back"); await p.click("#go-e");
  check("とことんは全部の国を1回ずつ並べて始める", (await p.evaluate(() => __kk.load().runs.e.list.length)) === G.D.length);
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 3, hints: 2 }); await p.click("#next");
  check("とことんはまちがえても手がかりを聞いても続く", await p.locator(".ch").count() === 4 && await p.evaluate(() => __kk.load().runs.e.res.length) === 3);
  await p.reload(); await p.waitForTimeout(200);
  check("とことんは開き直しても続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e");
  // 並びの終わり近くまで進めたことにして、新しい並びが足されるか
  await p.evaluate(() => __kk.save((s) => { const r = s.runs.e; r.res = r.list.slice(0, r.list.length - 1).map(() => ({ m: 0, w: 0 })); r.cur = null; }));
  await p.click("#back"); await p.click("#go-e");
  check("とことん：並びを使い切る前に、新しい並びを足して続ける", (await p.evaluate(() => __kk.load().runs.e.list.length)) === G.D.length * 2 && await p.locator(".ch").count() === 4);
  await p.evaluate(() => __kk.save((s) => { const r = s.runs.e; r.res = [{ m: 0, w: 0 }, { m: 1, w: 0 }, { m: 3, w: 2 }]; r.cur = null; }));
  await p.click("#back"); await p.click("#go-e");
  await solve(p); await p.click("#quit");
  check("「ここで降りる」は当てた直後でも押せ、まちがえずに当てた数を自己ベストに残す（3問）", (await mem(p)).ebest === 3 && (await p.textContent("#eres")).includes("4問") && !(await mem(p)).runs.e);
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("kokki-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.dex = { jp: '"><b id="xss2">', nothing: 3 }; s.runs = { h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-07", list: ["constructor|1"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["jp|1"], res: [] }, "a:2026-11-07": { mode: "a", id: "a3", date: "2026-11-07", list: ["jp|1", "fr|2"], res: [{ m: 0 }], cur: { i: 1, tag: "fr|2", wrong: "x", hints: 0 } }, e: { mode: "x", id: "q", date: "2026-11-07", list: [], res: [] }, a9: { mode: "a", id: "a9", date: "2026-11-06", list: ["jp|1"], res: [] } }; s.days = { "2026-11-08": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("kokki-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __kk.load());
    check("記録の形を直す：数の所の文字は0に・知らない国と形のちがう途中経過・日ごとの記録は捨てる", st.ebest === 0 && st.dex.jp === 0 && !("nothing" in st.dex) && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("e" in st.runs) && !("a9" in st.runs) && st.runs["a:2026-11-07"] && st.runs["a:2026-11-07"].cur === null && Object.keys(st.days).length === 0);
    check("知らない mode の途中経過（引き継ぎコードなど）があっても、ホームが出る", await q.locator("#go-d").count() === 1);
    await q.click("#go-dex").catch(() => {}); await q.waitForTimeout(150);
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は18個で、腕前・集める・続けるの3つの組・まだのものは「いま/目標」", await p.locator(".ach").count() === 18 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 2 && /\d+\/\d+/.test(await p.textContent(".ach:not(.got) .pg")));
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  { const ab = await p.textContent("#about"); check("このゲームについて：出典（外務省の一覧・flag-icons）と、外した国とわけを書く", ["外務省", "国名・首都名一覧", "flag-icons", "バチカン", "アフガニスタン", "イスラエル"].every((w) => ab.includes(w))); }
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部ひと目で初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("ひと目"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから
  {
    const q = await newPage();
    await q.evaluate(([d2, d3]) => { localStorage.setItem("kokki-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0], k: [] }, [d3]: { m: [1, 0, 0, 2, 0], k: [] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __kk.lateDays(__kk.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= EPOCH);
    check("カレンダー：取りこぼした過去7日（第1回より後）だけを押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    // あとからの流れは、第1回より前に日付をずらして見る（公開したばかりで取りこぼした日がまだ無いときも確かめる）
    const d = dayBefore(1);
    const okLate = await q.evaluate((d) => { if (!__kk.lateDays(__kk.load()).includes(d)) return "skip"; return "ok"; }, d);
    if (okLate === "ok") {
      if (!(await q.locator(`.cal .miss[data-k="${d}"]`).count())) await q.click(".calnav #prev");
      await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __kk.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・シェア・Ko-fi には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：第1回の日（" + EPOCH + "）より前は遊べない", lateList.every((x) => x >= EPOCH));
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで聞いた手がかりの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    // 別のタブで手がかりを聞き足したあと、古いタブで当てても、聞き足した分を★に数える（2026-11-07 CodeRabbit）
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`); await b.waitForTimeout(150);
    await b.click("#next"); await a.goto(url); await a.waitForTimeout(150); await a.click("#go-d");
    await a.click("#hint"); // a で聞き足したあと、b（まだ何もしていない画面）で当てる
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`); await b.waitForTimeout(150);
    check("別のタブで聞き足した手がかりを、当てたときの★に数える", (await mem(a)).runs.d.res[2].m === 1, (await mem(a)).runs.d.res);
    await ctx.close();
  }

  // スマホ幅でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const w of [320, 390]) {
      const q = await newPage(w); await closeHow(q);
      for (const go of [null, "#go-d", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e", "#go-p"]) {
        if (go === "solve") { await solve(q); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${go}:${x}`));
        const tx = await q.evaluate(() => document.body.innerText);
        if (tx.includes("${") || tx.includes("undefined") || tx.includes("NaN")) bad.push(`${w}px ${go}: 画面に式・undefined`);
      }
      await q.context().close();
    }
    check("幅320px・390px で横にはみ出さない・画面に ${ や undefined が出ない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }

  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    await q.focus("#hint"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    const j = await ansIdx(q);
    await q.focus(`.ch[data-j="${j}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    check("キーボードだけで手がかりを聞いて、選んで答えられる", await q.locator(".verdict").count() === 1);
    check("手がかりは読み上げ用に「手がかり一：」から始まり、知らせの場所（aria-live）にある", await q.getAttribute("#clues", "aria-live") === "polite" && (await q.textContent("#clues")).includes("手がかり一："));
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "kokki-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-07": { m: [0, 1, 0, 0, 2], k: ["jp", "fr", "ke", "pe", "tv"] } }, hdays: {}, adays: {}, dex: { jp: 1, fr: 1, ke: 1, pe: 1, tv: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }) };
  await checkTransfer({ browser, url, game: "kokki-shuto", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 国旗と首都 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
