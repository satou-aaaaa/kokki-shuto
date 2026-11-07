// tools/countries.tsv（外務省の一覧の写し）から data.js の国の表（D）を作り、使う国旗を flags/ に写す。
// 使い方：node tools/make-data.cjs <flag-icons の package フォルダ>
//   flag-icons（MIT）の版は FLAG_ICONS に書いた版を使う（npm pack flag-icons@7.6.0 で取る）。リポジトリには使う国旗の SVG だけを入れる。
// data.js の D の部分（「// ==D==」の間）だけを書きかえる。並べかえ・途中の削除をしない（番号で今日の5問を作るので、過去の日の問題が変わる）。
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), FLAG_ICONS = "7.6.0";

// 出さない国：首都が一覧に書かれていない・注の付いた国（政治のことがらで、答えが1つに決まらない）
const SKIP = { af: "一覧に注（注１）が付いている", il: "首都に注（注２）が付いている", va: "首都の欄が空" };
// 地域：外務省の分け方のまま。ただし北米は2か国だけなので中南米と合わせて「南北アメリカ」にする（選び肢を同じ地域から3つ選ぶため）
const CAT = { アジア: "as", 大洋州: "oc", 欧州: "eu", 中東: "me", アフリカ: "af", 北米: "am", 中南米: "am" };
// よく知られる（lv 0）・むずかしい（lv 2）。ほかは ふつう（lv 1）
const LV0 = "jp us gb fr de it es cn kr in br ca au ru mx eg tr th ch se nl gr pt ar nz sa za id vn ph ke ng no fi dk be at ie pl ua cu jm".split(" ");
const LV2 = "ki ck nu tv nr pw mh fm sb vu ws to ag kn vc lc dm gd bb bs st cv km sc gq gw er dj sz ls bi tg bj bf ss cf td ne mr gm gn sl lr ga cg ad li sm tl bt bn mv tm tj kg sr gy bz".split(" ");
// 見た目のよく似た国旗：同じ地域で、いっしょに選び肢に出さない
const LOOK = [["nl", "lu"], ["au", "nz"], ["ml", "gn", "sn"], ["si", "sk", "ru"], ["ve", "ec", "co"], ["hn", "ni", "sv"], ["qa", "bh"], ["kw", "ae"]];
// 正式な国名の伏せ字で、短い名前が頭に来ない国
const MASK = { gb: "◯◯（グレートブリテン及び北アイルランド連合王国）", kr: "大◯民国", cn: "◯◯人民共和国" };

const rows = fs.readFileSync(path.join(__dirname, "countries.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const D = [];
for (const [id, n, formal, cap, region, from] of rows) {
  if (SKIP[id]) continue;
  if (!CAT[region]) throw new Error("知らない地域 " + region);
  const f = formal.replace(/（注[０-９0-9]+）/g, "");
  let m = MASK[id];
  if (!m) {
    if (!f.startsWith(n)) throw new Error("伏せ字が作れない " + id + " " + n + " " + f);
    const stem = f === n ? n.replace(/(共和国|国|諸島)$/, "") : n;
    m = "◯".repeat([...stem].length) + f.slice(stem.length);
  }
  const hasCap = !!cap && cap !== "なし";
  const head = [...n].slice(0, 3).join("");
  // 首都から当てる問題：首都の名前に国の名前が入っているもの（クウェート・モナコなど）は出さない
  const okC = hasCap && !cap.includes(head) && !n.includes(cap.replace(/市$/, ""));
  const g = LOOK.map((x, i) => (x.includes(id) ? "l" + i : "")).filter(Boolean);
  D.push({ id, cat: CAT[region], lv: LV0.includes(id) ? 0 : LV2.includes(id) ? 2 : 1, n, f, m, cap: hasCap ? cap : "", c: okC ? 1 : 0, ...(g.length ? { g } : {}), ...(from ? { from } : {}) });
}
for (const x of LV0.concat(LV2)) if (!D.some((y) => y.id === x)) throw new Error("表に無い " + x);

// 国旗を写す（使う国だけ）
const src = process.argv[2];
if (src) {
  const dir = path.join(ROOT, "flags");
  fs.mkdirSync(dir, { recursive: true });
  for (const x of D) fs.copyFileSync(path.join(src, "flags", "4x3", x.id + ".svg"), path.join(dir, x.id + ".svg"));
  const lic = fs.readFileSync(path.join(src, "LICENSE"), "utf8");
  fs.writeFileSync(path.join(dir, "LICENSE"), `国旗の絵は flag-icons ${FLAG_ICONS}（https://github.com/lipis/flag-icons）の flags/4x3 から写したもの。\n\n` + lic);
}

const file = path.join(ROOT, "data.js"), js = fs.readFileSync(file, "utf8");
// 今の D の並びが、新しい D の頭とそろっているか（国は countries.tsv の最後に足すだけ。途中に足す・消すと過去の日の問題が変わる）
const old = [...(/\/\/ ==D==\n([\s\S]*?)  \/\/ ==D==/.exec(js) || ["", ""])[1].split("\n")].map((l) => /^\s*(\{.*\}),$/.exec(l)).filter(Boolean).map((m) => JSON.parse(m[1]));
// 国の並びと、出しはじめる日（from）は前のまま（変えると、その国が出る日・選び肢が変わり、過去の日の問題が変わる）
const bad = old.findIndex((o, i) => D[i]?.id !== o.id || (D[i]?.from || "") !== (o.from || ""));
if (bad >= 0) throw new Error(`国の並びか from が変わる（${old[bad].id}）：countries.tsv の最後に足すだけにし、足した国の from も変えない（過去の日の問題が変わる）`);
// 足した国の from は、あしたより後の、ほんとうにある日（YYYY-MM-DD）。今日より前だと、もう遊んだ日の問題が変わる
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const realDay = (s) => { const d = new Date(s + "T00:00:00Z"); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(d) && d.toISOString().slice(0, 10) === s; };
for (const x of D.slice(old.length)) {
  if (!old.length) break;
  if (!x.from) throw new Error(`足した国 ${x.id} に from（6列目：出しはじめる日）が無い`);
  if (!realDay(x.from)) throw new Error(`足した国 ${x.id} の from「${x.from}」が YYYY-MM-DD の日付でない`);
  if (x.from <= today) throw new Error(`足した国 ${x.id} の from ${x.from} が今日（${today}）より前：あした以降にする（遊んだ日の問題が変わる）`);
}
const body = "  const D = [\n" + D.map((x) => "    " + JSON.stringify(x) + ",").join("\n") + "\n  ];\n";
const out = js.replace(/(\/\/ ==D==\n)[\s\S]*?(  \/\/ ==D==)/, (_, a, b) => a + body + b);
if (out === js && !js.includes(body)) throw new Error("data.js に「// ==D==」の印が無い");
fs.writeFileSync(file, out);
const swf = path.join(ROOT, "sw.js"), sw = fs.readFileSync(swf, "utf8");
const sw2 = sw.replace(/(\/\/ ==FLAGS==\n)[\s\S]*?(\/\/ ==FLAGS==)/, (_, a, b) => a + "const FLAGS = " + JSON.stringify(D.map((x) => `./flags/${x.id}.svg`)) + ";\n" + b);
if (!sw.includes("// ==FLAGS==")) throw new Error("sw.js に「// ==FLAGS==」の印が無い");
fs.writeFileSync(swf, sw2);
console.log(`${D.length}か国（首都から当てる問題に出せる国 ${D.filter((x) => x.c).length}）`, ["as", "oc", "eu", "me", "af", "am"].map((c) => c + ":" + D.filter((x) => x.cat === c).length).join(" "), "lv:", [0, 1, 2].map((l) => D.filter((x) => x.lv === l).length).join("/"));
