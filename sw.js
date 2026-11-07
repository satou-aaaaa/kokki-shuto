// 国旗と首都を端末に保存して、電波が無くても遊べるようにする（PWA）。
// 画面は先にネットを見て、つながらないときだけ保存したものを使う（直した版がすぐ届く）。
// 記録（localStorage）には触らない。外へ何も送らない（よそのサイト＝文字の取り寄せは扱わない）。
const CACHE = "kokki-v1";
const SHELL = ["./", "./index.html", "./data.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
// 国旗の絵（tools/make-data.cjs が data.js の国から書く。手で直さない）
// ==FLAGS==
const FLAGS = ["./flags/is.svg","./flags/ie.svg","./flags/az.svg","./flags/us.svg","./flags/ae.svg","./flags/dz.svg","./flags/ar.svg","./flags/al.svg","./flags/am.svg","./flags/ao.svg","./flags/ag.svg","./flags/ad.svg","./flags/ye.svg","./flags/it.svg","./flags/iq.svg","./flags/ir.svg","./flags/in.svg","./flags/id.svg","./flags/ug.svg","./flags/ua.svg","./flags/uz.svg","./flags/uy.svg","./flags/gb.svg","./flags/ec.svg","./flags/eg.svg","./flags/ee.svg","./flags/sz.svg","./flags/et.svg","./flags/er.svg","./flags/sv.svg","./flags/au.svg","./flags/at.svg","./flags/om.svg","./flags/nl.svg","./flags/gh.svg","./flags/cv.svg","./flags/gy.svg","./flags/kz.svg","./flags/qa.svg","./flags/ca.svg","./flags/ga.svg","./flags/cm.svg","./flags/gm.svg","./flags/kh.svg","./flags/mk.svg","./flags/gn.svg","./flags/gw.svg","./flags/cy.svg","./flags/cu.svg","./flags/gr.svg","./flags/ki.svg","./flags/kg.svg","./flags/gt.svg","./flags/kw.svg","./flags/ck.svg","./flags/gd.svg","./flags/hr.svg","./flags/ke.svg","./flags/ci.svg","./flags/cr.svg","./flags/xk.svg","./flags/km.svg","./flags/co.svg","./flags/cg.svg","./flags/cd.svg","./flags/sa.svg","./flags/ws.svg","./flags/st.svg","./flags/zm.svg","./flags/sm.svg","./flags/sl.svg","./flags/dj.svg","./flags/jm.svg","./flags/ge.svg","./flags/sy.svg","./flags/sg.svg","./flags/zw.svg","./flags/ch.svg","./flags/se.svg","./flags/sd.svg","./flags/es.svg","./flags/sr.svg","./flags/lk.svg","./flags/sk.svg","./flags/si.svg","./flags/sc.svg","./flags/gq.svg","./flags/sn.svg","./flags/rs.svg","./flags/kn.svg","./flags/vc.svg","./flags/lc.svg","./flags/so.svg","./flags/sb.svg","./flags/th.svg","./flags/kr.svg","./flags/tj.svg","./flags/tz.svg","./flags/cz.svg","./flags/td.svg","./flags/cf.svg","./flags/cn.svg","./flags/tn.svg","./flags/cl.svg","./flags/tv.svg","./flags/dk.svg","./flags/de.svg","./flags/tg.svg","./flags/dm.svg","./flags/do.svg","./flags/tt.svg","./flags/tm.svg","./flags/tr.svg","./flags/to.svg","./flags/ng.svg","./flags/nr.svg","./flags/na.svg","./flags/nu.svg","./flags/ni.svg","./flags/ne.svg","./flags/jp.svg","./flags/nz.svg","./flags/np.svg","./flags/no.svg","./flags/bh.svg","./flags/ht.svg","./flags/pk.svg","./flags/pa.svg","./flags/vu.svg","./flags/bs.svg","./flags/pg.svg","./flags/pw.svg","./flags/py.svg","./flags/bb.svg","./flags/hu.svg","./flags/bd.svg","./flags/tl.svg","./flags/fj.svg","./flags/ph.svg","./flags/fi.svg","./flags/bt.svg","./flags/br.svg","./flags/fr.svg","./flags/bg.svg","./flags/bf.svg","./flags/bn.svg","./flags/bi.svg","./flags/vn.svg","./flags/bj.svg","./flags/ve.svg","./flags/by.svg","./flags/bz.svg","./flags/pe.svg","./flags/be.svg","./flags/pl.svg","./flags/ba.svg","./flags/bw.svg","./flags/bo.svg","./flags/pt.svg","./flags/hn.svg","./flags/mh.svg","./flags/mg.svg","./flags/mw.svg","./flags/ml.svg","./flags/mt.svg","./flags/my.svg","./flags/fm.svg","./flags/za.svg","./flags/ss.svg","./flags/mm.svg","./flags/mx.svg","./flags/mu.svg","./flags/mr.svg","./flags/mz.svg","./flags/mc.svg","./flags/mv.svg","./flags/md.svg","./flags/ma.svg","./flags/mn.svg","./flags/me.svg","./flags/jo.svg","./flags/la.svg","./flags/lv.svg","./flags/lt.svg","./flags/ly.svg","./flags/li.svg","./flags/lr.svg","./flags/ro.svg","./flags/lu.svg","./flags/rw.svg","./flags/ls.svg","./flags/lb.svg","./flags/ru.svg"];
// ==FLAGS==

self.addEventListener("install", (e) => {
  // GitHub Pages が保存させる古い画面を入れないよう、取り直してから保存する
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.concat(FLAGS).map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kokki-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
    .catch(() => undefined); // 保存したものを読めなくても、必ず返事を返す（ネットの返事か Response.error()）
  // ネットの返事と保存し直しは、イベントの中で waitUntil に預ける（4秒で保存したものを返したあとに届いても、新しい版を保存できる）
  const net = fetch(req);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let deadline;
  e.waitUntil(Promise.race([
    net.then((res) => { if (!res.ok) return; const copy = res.clone(); return Promise.race([caches.open(CACHE).then((c) => c.put(req, copy)), wait(15000)]); }, () => {}).catch(() => {})
      .finally(() => clearTimeout(deadline)),
    new Promise((r) => { deadline = setTimeout(r, 60000); }),
  ])); // 保存の失敗は無視する。保存は始めてから15秒、全体は60秒で待つのをやめる。60秒の見張りはネットの待ちと保存が終わったときに止める（返事を返しただけでは止めない。ネットが止まったままでも waitUntil を60秒で終える）
  e.respondWith(new Promise((resolve) => {
    let sent = false;
    const send = (r) => { if (!sent) { sent = true; clearTimeout(slow); resolve(r); } };
    // 4秒で返らなければ保存したものを返す。ok の返事は本文を読み終えるまでこの切り替えを残す（本文の途中で止まる通信）
    const slow = setTimeout(() => fromCache().then((hit) => hit && send(hit)), 4000);
    net.then((res) => {
      if (res.ok) {
        return res.clone().arrayBuffer().then(
          (body) => send(new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })),
          () => fromCache().then((hit) => send(hit || Response.error())),
        );
      }
      if (res.status >= 500) return fromCache().then((hit) => send(hit || res));
      send(res);
    }, () => fromCache().then((hit) => send(hit || Response.error())));
  }));
});
