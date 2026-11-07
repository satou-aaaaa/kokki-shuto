# AGENTS.md

国旗と首都：国旗か首都を手がかりに、どこの国かを4つから選ぶ1日5問の学習ゲーム。`index.html` と `data.js`（外務省の一覧から作った193か国と問題の作り方）・`flags/`（国旗の絵）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # データ（外務省の一覧の写しと同じ・国旗の絵・伏せ字）・選び肢（全部×300）・今日の5問と上級（3年分・過去の日が変わらない）・とことんと練習の並び・通しで遊ぶ・続きから・上級・練習・とことん・国旗帳・実績・カレンダー・あとから・古いタブ・スマホ幅・PWA・引き継ぎ・見やすさ
```

## このリポジトリの決まり

- 国名・首都・地域は外務省 キッズ外務省「国名・首都名一覧」（https://www.mofa.go.jp/mofaj/kids/ichiran/basic.html と files/info.csv）の写し `tools/countries.tsv` だけから作る。`data.js` の `D` と `sw.js` の `FLAGS` は `node tools/make-data.cjs <flag-icons の package フォルダ>` で作る（手で直さない）。一覧が変わったら、一覧を読み直して `countries.tsv` を直し、PR に一言書く。
- 一覧の196か国のうち、首都の欄が空のバチカンと、一覧で国名・首都に注の付いたアフガニスタン・イスラエルは出さない（`SKIP`。政治のことがらで答えが1つに決まらない）。シンガポールの首都は一覧のとおり「なし」。地域は一覧のまま（中央アジア・コーカサスは欧州）で、北米（2か国）は中南米と合わせて「南北アメリカ」。
- 国旗の絵は flag-icons 7.6.0（MIT。`flags/LICENSE`）の `flags/4x3` を写したもの。版を上げるときは、変わった国旗（2025年のシリアなど）を確かめて PR に書く。
- 1問の手がかりは3つ：国旗から当てる問題は 国旗→正式な国名の伏せ字（短い名前の文字を◯に）→首都、首都から当てる問題は 首都→伏せ字→国旗。首都の名前に国の名前が入る国（クウェート・モナコなど、`c:0`）は首都からは出さない。選び肢は同じ地域の4か国で、見た目のよく似た国旗（`LOOK`、例：オランダとルクセンブルク）は並べない（QA が見る）。
- 国は最後に足すだけにし、並べかえ・途中の削除をしない。足す国には `from`（出しはじめる日。マージする日より後、ふつうは `qa/daily-snapshot.json` の最後の日の次の日）を付ける。`from` より前の日の今日の5問・上級・選び肢は変わらない（QA が見る）。
- 今日の5問は日本時間の日付の種で、だれでも同じ：ちがう地域の5か国（やさしい 国旗・首都、ふつう 国旗・首都、むずかしい 国旗）。きのうの5問と重ねない（`dailyIds` が始まりの日から順に作る）。上級はむずかしいの3か国（国旗・首都・国旗、地域がちがう、今日の5問と重ねない、`HORDER` を日ごとに7つずつ進める）・手がかり2つから・聞き足しなし。`Math.random` は練習・とことんの並びと回の名札だけ（QA が数を見る）。
- ★はまちがい＋聞き足した手がかりの数（0で★3・1で★2・2以上で★1）。時間制限は付けない。今日の5問・上級は1日1回で、途中で閉じても続きから。途中経過はモードごとに `runs.d`・`runs.h`・`runs.p`・`runs.e`・`runs["a:日付"]`。答える前に、保存した進み具合が画面と同じ問題か確かめる（古いタブで二重に数えない）。
- 好きなだけ遊べる：チケット・残りの命・回数制限・🔒で開くモードを入れない（QA が見る）。上級・とことん・練習は、はじめての日から押せる。とことん（`runs.e`）は全部の国をやさしい→ふつう→むずかしいの順に毎回ちがう並びで出し、使い切ったら新しい並びを足す。練習は地域を選び、まだ当てていない国から。
- 国旗帳（`dex`）：まだ当てていない国は「？？？」で、国旗も名前も出さない。押すと国旗・首都・正式な国名・出典を読み返せる。地域ごとに並べる。
- 実績（`ACH`、18個）はいまの記録から毎回数える。続けるは合計の日数（`playedDays`）、連続は1日以上のときだけ出す。取りこぼした日（過去7日・`EPOCH` から）はカレンダーからあとから遊べ、`adays` に入れて連続・今日の記録・シェア・Ko-fi には数えない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に国の名前（答え）を出さない（QA が見る）。
- ほかの作品の名前・キャラ・見た目・設定を使わない。お笑いの言葉は入れない。国どうしを比べて良し悪しを言わない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`）を開くだけ。名前・メールは聞かない。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の5問・上級を初めて、全部ひと目（★3）で終えたときだけ、結果の画面の下に1行。遊ぶのは無料のまま。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。国旗の SVG も外を読まない（QA が見る）。記録は遊ぶ人のブラウザ（localStorage `kokki-v1`）だけ。
- 見やすさ：`</head>` の前の見やすさの設定（`<!-- a11y:begin -->`〜`end`）は shared-workflows `template/a11y/a11y.html` の写し、`qa/a11y.mjs` も `template/qa/a11y.mjs` の写しで、ここでは直さない。色だけで分けない（まちがいは ✕ と破線、正解は ✓、まだの手がかりは点線、★は ☆ と並べる）。手がかりは `#clues`（aria-live）に「手がかり一：」から読ませ、国旗の絵の alt は「この国の国旗」（答えを言わない）。国旗の色そのものは変えない。
- 引き継ぎ：`transfer.js` と `qa/transfer-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。`data-keys` は `kokki-v1`。記録の形を変えたら QA の `sample` も合わせる。
- 一行に書いた処理の途中にコメント `//` を足さない。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回・何年分も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。国旗は `FLAGS`（`make-data.cjs` が書く）。`qa/sw-check.mjs`（shared-workflows `template/` の写し）で、本文の途中で通信が止まっても4秒で保存した画面を返すか見る。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の国を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js`・`tools/countries.tsv`・`flags/` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
