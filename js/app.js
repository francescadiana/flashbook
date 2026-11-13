/* diana.inkkk flashbook — reads a Google Sheet and renders a flippable book. */
(function () {
  "use strict";

  var CFG = Object.assign({ sheetId: "", tabs: { intro: "Intro", chapters: "Chapters", sketches: "Sketches" }, perPage: 4, perPageMobile: 2, mobileTextSize: 0.72, currency: "€" }, window.FLASHBOOK_CONFIG || {});
  var BOOK_W = 1080, BOOK_H = 760, PAGE_W = 540, TAB_OUT = 80;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    stage: $("stage"), book: $("book"), left: $("leftPage"), right: $("rightPage"), leafHost: $("leafHost"),
    tabs: $("tabs"), prev: $("prevBtn"), next: $("nextBtn"), label: $("pageLabel"),
    lb: $("lightbox"), lbFigure: $("lbFigure"), lbChapter: $("lbChapter"), lbTitle: $("lbTitle"), lbMeta: $("lbMeta"),
    lbNotes: $("lbNotes"), lbCta: $("lbCta"), lbAr: $("lbAr"), lbLink: $("lbLink"), lbLinkText: $("lbLinkText"), lbPos: $("lbPos"), lbPrev: $("lbPrev"), lbNext: $("lbNext"), lbClose: $("lbClose"),
    toast: $("toast"), handle: $("brandHandle")
  };

  var state = { data: null, spreads: [], cur: 0, busy: false, scale: 1, compact: false, lb: null, single: false, builtSingle: null, pw: 0, ph: 0 };

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function clean(s) { return String(s == null ? "" : s).trim(); }
  function isNum(s) { return /^\d+([.,]\d+)?$/.test(clean(s)); }
  function slugify(s) {
    s = clean(s).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg>';

  // Google Drive share links -> embeddable image URLs. Other URLs / repo paths pass through.
  function driveId(u) {
    if (!/google\.com/.test(u)) return null;
    var m = u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/);
    return m ? m[1] : null;
  }
  function imgSrc(u) {
    u = clean(u);
    if (!u) return "";
    var id = driveId(u);
    return id ? "https://lh3.googleusercontent.com/d/" + id + "=w1600" : u;
  }
  function imgFallback(u) {
    var id = driveId(clean(u));
    return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600" : "";
  }
  function imgTag(url, alt, cls) {
    var src = imgSrc(url);
    if (!src) return "";
    var fb = imgFallback(url);
    return '<img src="' + esc(src) + '" alt="' + esc(alt || "") + '"' + (cls ? ' class="' + cls + '"' : "") +
      (fb ? ' data-fallback="' + esc(fb) + '"' : "") + ' loading="eager" decoding="async">';
  }
  // swap to the fallback thumbnail URL once if a Drive image fails
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.dataset.fallback && !t.dataset.triedFallback) {
      t.dataset.triedFallback = "1";
      t.src = t.dataset.fallback;
    }
  }, true);

  /* ---------------- CSV ---------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = "", q = false, i = 0, c;
    text = text.replace(/^﻿/, "");
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return clean(h).toLowerCase().replace(/\s+/g, "_"); });
    return rows.slice(1).filter(function (r) { return r.some(function (v) { return clean(v) !== ""; }); })
      .map(function (r) { var o = {}; head.forEach(function (h, k) { if (h) o[h] = clean(r[k]); }); return o; });
  }

  function fetchCSV(url, mustHave, tabName) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for tab \"" + tabName + "\"");
      return r.text();
    }).then(function (t) {
      if (/^\s*</.test(t)) throw new Error("the Sheet is not shared publicly");
      var rows = parseCSV(t);
      if (rows.length && !(mustHave in rows[0])) throw new Error("tab \"" + tabName + "\" is missing the \"" + mustHave + "\" column (check the tab name)");
      return rows;
    });
  }

  function sheetURL(tab) {
    return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheetId) +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab);
  }

  function loadAll() {
    var useSheet = !!clean(CFG.sheetId);
    var src = useSheet
      ? [sheetURL(CFG.tabs.intro), sheetURL(CFG.tabs.chapters), sheetURL(CFG.tabs.sketches)]
      : ["data/intro.csv", "data/chapters.csv", "data/sketches.csv"];
    var names = [CFG.tabs.intro, CFG.tabs.chapters, CFG.tabs.sketches];
    function get(urls) {
      return Promise.all([
        fetchCSV(urls[0], "field", names[0]),
        fetchCSV(urls[1], "chapter", names[1]),
        fetchCSV(urls[2], "chapter", names[2])
      ]);
    }
    return get(src).catch(function (err) {
      if (!useSheet) throw err;
      toast("Couldn't read the Google Sheet (" + err.message + "). Showing the demo pages instead.");
      return get(["data/intro.csv", "data/chapters.csv", "data/sketches.csv"]);
    });
  }

  /* ---------------- data model ---------------- */
  var TAB_COLORS = {
    green: { bg: "#72D23C", ink: "#111111", border: "none" },
    mint: { bg: "#D6F7CF", ink: "#1C5A0A", border: "none" },
    black: { bg: "#111111", ink: "#72D23C", border: "2px solid #72D23C" },
    white: { bg: "#F3F0E7", ink: "#111111", border: "none" },
    paper: { bg: "#F3F0E7", ink: "#111111", border: "none" }
  };
  var TAB_CYCLE = ["green", "mint", "black"];
  function tabColor(v, i) {
    v = clean(v).toLowerCase();
    if (TAB_COLORS[v]) return TAB_COLORS[v];
    if (/^#?[0-9a-f]{6}$/.test(v)) {
      var hex = v[0] === "#" ? v : "#" + v;
      var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
      var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return { bg: hex, ink: lum > 0.55 ? "#111111" : "#FFFFFF", border: "none" };
    }
    return TAB_COLORS[TAB_CYCLE[i % TAB_CYCLE.length]];
  }
  function statusOf(v) {
    v = clean(v).toLowerCase();
    if (/^(hidden|hide|no|draft)$/.test(v)) return "hidden";
    if (/^(tattooed|taken|sold|done|fatto)$/.test(v)) return "taken";
    return "available";
  }
  function byOrder(a, b) {
    var x = parseFloat(a.order), y = parseFloat(b.order);
    if (isNaN(x)) x = 1e9; if (isNaN(y)) y = 1e9;
    return x - y || a._i - b._i;
  }

  function buildModel(intro, chapters, sketches) {
    var I = {};
    intro.forEach(function (r) { if (r.field) I[r.field.toLowerCase().replace(/\s+/g, "_")] = r.value || ""; });
    var handle = clean(I.instagram || "diana.inkkk").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
    var model = {
      greeting: I.greeting || "Hey you!",
      introText: I.intro_text || "",
      photo: I.photo_link || "",
      handle: handle,
      bookingNote: I.booking_note || "",
      coverTitle: I.cover_title || "FLASHBOOK",
      coverTags: (I.cover_tags || "Vol. 01, Napoli").split(",").map(clean).filter(Boolean),
      signoff: I.signoff || "see you soon!",
      chapters: []
    };
    var list = chapters.map(function (c, i) { c._i = i; return c; }).filter(function (c) { return clean(c.chapter); });
    list.sort(byOrder);
    var idx = {};
    list.forEach(function (c, i) {
      var ch = { n: pad2(i + 1), name: clean(c.chapter), blurb: clean(c.blurb), color: tabColor(c.tab_color, i), flashes: [] };
      idx[ch.name.toLowerCase()] = ch;
      model.chapters.push(ch);
    });
    // permanent link name of every flash: the optional "id" column, otherwise chapter + title.
    // Computed in sheet-row order before hidden rows are dropped, so hiding a flash never changes other links.
    var used = {};
    sketches.forEach(function (s, i) {
      s._i = i;
      var base = slugify(s.id) || slugify(clean(s.chapter) + " " + (clean(s.title) || "flash")) || "flash", slug = base, n = 2;
      while (used[slug]) slug = base + "-" + n++;
      used[slug] = 1; s._slug = slug;
    });
    sketches.slice().sort(byOrder).forEach(function (s) {
      var ch = idx[clean(s.chapter).toLowerCase()];
      if (!ch) return;
      var st = statusOf(s.status);
      if (st === "hidden") return;
      var size = clean(s.size_cm || s.size), price = clean(s.price);
      ch.flashes.push({
        slug: s._slug,
        title: clean(s.title) || "Untitled",
        image: clean(s.image_link || s.image),
        size: size ? (isNum(size) ? size + " cm" : size) : "",
        price: price ? (isNum(price) ? CFG.currency + price : price) : "",
        status: st,
        notes: clean(s.notes)
      });
    });
    return model;
  }

  /* ---------------- pagination ---------------- */
  // "single" = phone layout: one page at a time, nearly full screen. Otherwise a two-page spread.
  function pagesOf(sp) { return sp.single ? [sp.single] : [sp.left, sp.right]; }
  function perNow() { return Math.max(1, parseInt(state.single || state.compact ? CFG.perPageMobile : CFG.perPage, 10) || 4); }
  function coverSpread() {
    return state.single ? { single: { t: "cover" }, name: "Cover" } : { left: { t: "empty" }, right: { t: "cover" }, name: "Cover" };
  }

  function buildSpreads(m) {
    var per = perNow(), single = state.single;
    state.per = per; state.builtSingle = single;
    var pages = [{ t: "intro" }, { t: "contents" }];
    var chapterStart = [];
    m.chapters.forEach(function (ch, ci) {
      if (!single && pages.length % 2 === 1) pages.push({ t: "filler" });      // spread mode: openers always on a left page
      chapterStart[ci] = pages.length;
      pages.push({ t: "opener", ci: ci });
      var total = Math.max(1, Math.ceil(ch.flashes.length / per));
      for (var p = 0; p < total; p++) {
        pages.push({ t: "flashes", ci: ci, start: p * per, items: ch.flashes.slice(p * per, p * per + per), part: p + 1, parts: total });
      }
    });
    if (!single && pages.length % 2 === 1) pages.push({ t: "filler" });
    pages.push({ t: "back" }, { t: "thanks" });
    pages.forEach(function (p, i) { p.num = i + 1; });
    m.chapterNum = chapterStart.map(function (pi) { return pi + 1; });   // printed page number of each chapter opener

    if (single) {
      var one = [coverSpread()];
      pages.forEach(function (p) {
        var nm = p.ci != null ? m.chapters[p.ci].name : p.t === "intro" ? "About me" : p.t === "contents" ? "Contents" : p.t === "back" ? "Get in touch" : "";
        if (p.t === "flashes" && p.parts > 1) nm += " " + p.part + "/" + p.parts;
        one.push({ single: p, ci: p.ci, name: nm });
      });
      m.chapterSpread = chapterStart.map(function (pi) { return pi + 1; });
      return one;
    }

    var spreads = [coverSpread()];
    for (var i = 0; i < pages.length; i += 2) {
      var L = pages[i], R = pages[i + 1] || { t: "filler", num: i + 2 };
      var ci = R.ci != null ? R.ci : L.ci;
      var name = ci != null ? m.chapters[ci].name : (L.t === "intro" ? "About me" : L.t === "back" ? "Get in touch" : "");
      var FP = R.t === "flashes" ? R : L.t === "flashes" ? L : null;
      if (FP && FP.parts > 1) name += " " + FP.part + "/" + FP.parts;
      spreads.push({ left: L, right: R, ci: ci, name: name });
    }
    m.chapterSpread = chapterStart.map(function (pi) { return pi / 2 + 1; });
    return spreads;
  }

  /* ---------------- page templates ---------------- */
  function pnum(p) { return p.num ? '<div class="pnum">' + p.num + "</div>" : ""; }
  function captions(text) {
    return clean(text).split(/\n+/).filter(Boolean).map(function (line) {
      return '<p class="caption" style="margin:0"><span>' + esc(line) + "</span></p>";
    }).join("");
  }

  function renderPage(p, side) {
    var m = state.data, cls = "page " + side, html = "";
    switch (p.t) {
      case "empty":
        return { cls: cls + " empty", html: "" };

      case "cover":
        cls += " cover";
        html = '<div class="cover-spine"></div><div class="cover-inner">' +
          '<div class="cover-sticker"><img src="assets/logo.png" alt="' + esc(m ? m.handle : "diana.inkkk") + ' logo"></div>' +
          '<div class="cover-title">' + esc(m ? m.coverTitle : "FLASHBOOK") + "</div>" +
          '<div class="cover-chips">' + (m ? m.coverTags : ["Vol. 01", "Napoli"]).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" +
          '</div><div class="cover-hint hand">open me →</div>';
        break;

      case "intro":
        cls += " intro";
        html = '<div class="pad"><div class="label-black">' + esc(m.greeting) + "</div>" +
          '<div style="display:flex;flex-direction:column;gap:4px">' + captions(m.introText) + "</div>" +
          (m.photo
            ? '<div class="polaroid"><div class="tape"></div>' + imgTag(m.photo, "Photo of the artist") + '<div class="hand">that\'s me!</div></div>'
            : '<img class="logo-sticker" src="assets/logo.png" alt="">') +
          '<a class="dm-tag" href="https://ig.me/m/' + esc(m.handle) + '" target="_blank" rel="noopener">DM @' + esc(m.handle) + "</a>" +
          "</div>" + pnum(p);
        break;

      case "contents":
        cls += " contents";
        html = '<div class="pad"><h2>What\'s inside</h2><div class="toc">' +
          m.chapters.map(function (ch, ci) {
            var sp = m.chapterSpread[ci];
            return '<button type="button" data-goto="' + sp + '"><span class="toc-n">' + ch.n + '</span><span class="toc-name">' + esc(ch.name) +
              '</span><span class="toc-p">p. ' + m.chapterNum[ci] + "</span></button>";
          }).join("") + "</div>" +
          "<p>Every flash is drawn by me. Tap one to see it bigger.</p>" +
          '<div class="hand">tap a post-it to jump ↗</div></div>' + pnum(p);
        break;

      case "opener":
        var ch = m.chapters[p.ci], n = ch.flashes.length;
        cls += " opener";
        html = '<div class="pad"><div class="top"><div class="hand kicker">chapter</div>' +
          '<div class="big-n">' + ch.n + '</div><div class="ch-name">' + esc(ch.name) + "</div>" +
          (ch.blurb ? '<div class="caption"><span>' + esc(ch.blurb) + "</span></div>" : "") + "</div>" +
          '<div class="bottom"><div class="hand">' + (n ? n + (n === 1 ? " flash" : " flashes") + ", pick one →" : "new flashes coming soon") +
          '</div><img src="assets/logo.png" alt=""></div></div>' + pnum(p);
        break;

      case "flashes":
        var c = m.chapters[p.ci], tilts = [-4, 3, 2, -3, -2, 4, 1, -1];
        cls += " flashes";
        html = '<div class="pad"><div class="flash-head"><span class="chip">' + c.n + " · " + esc(c.name) + "</span>" +
          (p.parts > 1 ? '<span class="of">page ' + p.part + " of " + p.parts + "</span>" : "") + "</div>" +
          '<div class="grid' + (state.per <= 2 ? " two" : "") + '">' +
          (p.items.length ? p.items.map(function (f, k) {
            var fi = p.start + k;
            var img = imgTag(f.image, f.title);
            var meta = [f.size, f.price].filter(Boolean).join(" · ");
            return '<button type="button" class="card" data-ci="' + p.ci + '" data-fi="' + fi + '" aria-label="See ' + esc(f.title) + ' bigger">' +
              '<div class="tape" style="transform:rotate(' + tilts[k % tilts.length] + 'deg)"></div>' +
              '<div class="img">' + (img || '<div class="placeholder">' + PENCIL + "<span>drawing coming soon</span></div>") +
              (f.status === "taken" ? '<div class="taken-stamp">TAKEN</div>' : "") + "</div>" +
              '<div class="row"><span class="title">' + esc(f.title) + "</span>" +
              "</div>" +
              (meta ? '<div class="meta">' + esc(meta) + "</div>" : "") + "</button>";
          }).join("") : '<div class="placeholder" style="grid-column:1/-1;grid-row:1/-1">' + PENCIL + "<span>new flashes coming soon</span></div>") +
          "</div></div>" + pnum(p);
        break;

      case "filler":
        cls += " filler";
        html = '<div class="pad"><img src="assets/logo.png" alt=""><div class="hand">notes &amp; doodles</div></div>' + pnum(p);
        break;

      case "back":
        cls += " back";
        html = '<div class="pad"><div class="label-black">Liked something?</div>' +
          '<div class="caption"><span>Here\'s how we make it yours</span></div>' +
          '<ol class="steps"><li><b>1</b><span>Screenshot the flash you like.</span></li>' +
          '<li><b>2</b><span>DM it to <a href="https://ig.me/m/' + esc(m.handle) + '" target="_blank" rel="noopener"><strong>@' + esc(m.handle) + "</strong></a> with size and placement.</span></li>" +
          "<li><b>3</b><span>We pick a date together.</span></li></ol>" +
          (m.bookingNote ? '<div class="hand">' + esc(m.bookingNote) + "</div>" : "") + "</div>" + pnum(p);
        break;

      case "thanks":
        cls += " thanks";
        html = '<div class="pad"><img src="assets/logo.png" alt="' + esc(m.handle) + ' logo"><div class="big">Grazie!</div>' +
          '<a href="https://instagram.com/' + esc(m.handle) + '" target="_blank" rel="noopener">@' + esc(m.handle) + "</a>" +
          '<div class="hand">' + esc(m.signoff) + "</div></div>" + pnum(p);
        break;
    }
    return { cls: cls, html: html };
  }

  function paint(el, page, side) {
    var r = renderPage(page, side);
    el.className = r.cls;
    el.innerHTML = r.html;
  }

  /* ---------------- tabs & label ---------------- */
  function renderTabs() {
    var m = state.data;
    if (!m) { els.tabs.innerHTML = ""; return; }
    var n = m.chapters.length, gap = state.single ? 10 : 14;
    var room = state.single ? Math.max(120, state.ph - (state.pw > state.ph ? 36 : 80)) : 620;
    var h = Math.min(state.single ? 150 : state.scale < 0.7 ? 200 : 132, Math.floor((room - gap * (n - 1)) / Math.max(1, n)));
    els.tabs.innerHTML = m.chapters.map(function (ch, ci) {
      var rot = [-2, 1.5, -1, 2, -1.5][ci % 5];
      return '<button type="button" class="tab" data-goto="' + m.chapterSpread[ci] + '" data-ci="' + ci + '" aria-label="Go to chapter ' + esc(ch.name) + '"' +
        ' style="height:' + h + "px;background:" + ch.color.bg + ";color:" + ch.color.ink + ";border:" + ch.color.border + ";--rot:" + rot + 'deg">' +
        "<span>" + esc(ch.name) + "</span></button>";
    }).join("");
    updateTabs();
  }
  function updateTabs() {
    var ci = state.spreads[state.cur] ? state.spreads[state.cur].ci : null;
    Array.prototype.forEach.call(els.tabs.children, function (t) {
      var on = String(ci) === t.dataset.ci;
      t.style.transform = "translateX(" + (on ? (state.single ? -10 : 18) : 0) + "px) rotate(" + t.style.getPropertyValue("--rot") + ")";
      t.setAttribute("aria-current", on ? "true" : "false");
    });
  }
  function updateNav() {
    var N = state.spreads.length, sp = state.spreads[state.cur];
    els.prev.disabled = state.cur === 0;
    els.next.disabled = state.cur >= N - 1;
    els.label.innerHTML = "<span>" + esc(sp ? sp.name : "") + '</span><span class="sep"> · </span><span>' + (state.cur + 1) + " / " + N + "</span>";
    syncHash();
  }
  // address bar: "#<spread>" while reading, "#f/<flash>" while a flash is open (that one is the shareable link)
  function syncHash() {
    if (state.lb || !history.replaceState) return;
    history.replaceState(null, "", state.cur ? "#" + state.cur : location.pathname + location.search);
  }

  /* ---------------- layout / scaling ---------------- */
  // phones: no scaling at all. The page IS the screen (minus a small margin and the nav bar), text stays at real size.
  var probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  function insets() {
    var c = getComputedStyle(probe);
    return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  }

  function layout() {
    var W = window.innerWidth, H = window.innerHeight, root = document.documentElement.style;
    var single = W < 700 || H <= 520 || (W < 900 && H > W);   // phones, and tablets held upright
    var modeChanged = single !== state.single;
    state.single = single;
    document.body.classList.toggle("single", single);

    if (single) {
      var iv = insets(), navH = H <= 520 ? 52 : 68;
      var m = H <= 520 ? { t: 12, l: 16, r: 18, b: 14 } : { t: 22, l: 24, r: 28, b: 24 };   // room around the book: hard cover + a bit of desk
      var pw = Math.round(W - m.l - m.r - iv.l - iv.r), ph = Math.round(H - m.t - iv.t - navH - iv.b - m.b);
      var changed = modeChanged || Math.abs(pw - state.pw) > 1 || Math.abs(ph - state.ph) > 1;
      state.pw = pw; state.ph = ph; state.scale = 1; state.compact = true;
      root.setProperty("--s", "1"); root.setProperty("--k", "1");
      root.setProperty("--u", (W <= H ? clamp(pw / 540, 0.62, 1) : 0.7).toFixed(3));
      root.setProperty("--nav-h", navH + "px");
      root.setProperty("--pw", pw + "px"); root.setProperty("--ph", ph + "px");
      els.book.style.width = pw + "px"; els.book.style.height = ph + "px";
      els.book.style.transform = "translate(" + (m.l + iv.l) + "px," + (m.t + iv.t) + "px)";
      return changed;
    }

    els.book.style.width = ""; els.book.style.height = "";
    root.setProperty("--u", "1");
    var availW = W - 48, availH = H - 84 - 90, offX = 24, offY = 84;
    var s = Math.max(0.2, Math.min(availW / (BOOK_W + 2 * TAB_OUT), availH / BOOK_H, 1.3));
    var changedS = modeChanged || Math.abs(s - state.scale) > 0.001;
    state.scale = s;
    root.setProperty("--s", s.toFixed(4));
    state.compact = s < 0.7;
    root.setProperty("--k", state.compact ? String(CFG.mobileTextSize) : "1");
    var x = offX + (availW - BOOK_W * s) / 2 + (state.cur === 0 ? -(PAGE_W / 2) * s : 0);
    var y = offY + (availH - BOOK_H * s) / 2;
    els.book.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
    return changedS;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------- rendering & flipping ---------------- */
  function showSpread(i, dir) {
    var sp = state.spreads[i];
    document.body.classList.toggle("on-cover", !!(sp.single && sp.single.t === "cover"));
    if (sp.single) {
      els.left.className = "page left"; els.left.innerHTML = "";
      paint(els.right, sp.single, "right");
    } else {
      paint(els.left, sp.left, "left");
      paint(els.right, sp.right, "right");
    }
    updateTabs(); updateNav(); preload(i + 1);
  }
  function preload(i) {
    var sp = state.spreads[i];
    if (!sp || !state.data) return;
    pagesOf(sp).forEach(function (p) {
      (p.items || []).forEach(function (f) { var u = imgSrc(f.image); if (u) { var im = new Image(); im.src = u; } });
    });
  }

  function goTo(to) {
    var N = state.spreads.length;
    if (state.busy || to === state.cur || to < 0 || to >= N) return;
    var from = state.spreads[state.cur], target = state.spreads[to], fwd = to > state.cur;
    state.cur = to;
    layout();
    if (state.single) { turnSingle(from.single, target.single, to, fwd); return; }
    if (reduceMotion) { showSpread(to); return; }
    state.busy = true;

    var leaf = document.createElement("div");
    leaf.className = "leaf " + (fwd ? "fwd" : "back");
    var front = renderPage(fwd ? from.right : from.left, fwd ? "right" : "left");
    var rear = renderPage(fwd ? target.left : target.right, fwd ? "left" : "right");
    leaf.innerHTML = '<div class="face ' + front.cls + '">' + front.html + '<div class="shade"></div></div>' +
      '<div class="face rear ' + rear.cls + '">' + rear.html + "</div>";
    if (front.cls.indexOf("empty") > -1) leaf.firstChild.style.visibility = "hidden";
    if (fwd) paint(els.right, target.right, "right"); else paint(els.left, target.left, "left");
    els.leafHost.appendChild(leaf);
    leaf.getBoundingClientRect(); // commit start state
    leaf.classList.add("turning");
    leaf.style.transform = "rotateY(" + (fwd ? -180 : 180) + "deg)";

    var done = false;
    function finish() {
      if (done) return; done = true;
      if (fwd) paint(els.left, target.left, "left"); else paint(els.right, target.right, "right");
      leaf.remove();
      state.busy = false;
      updateTabs(); updateNav(); preload(to + 1);
    }
    leaf.addEventListener("transitionend", function (e) { if (e.target === leaf) finish(); });
    setTimeout(finish, 900);
    updateTabs(); updateNav();
  }

  // phone page turn: forward, the old page lifts off the spine and fades away; back, the earlier page falls back into place
  function turnSingle(oldPage, newPage, to, fwd) {
    if (reduceMotion) { showSpread(to); return; }
    state.busy = true;
    var r = renderPage(fwd ? oldPage : newPage, "right");
    var leaf = document.createElement("div");
    leaf.className = "flip " + r.cls;
    leaf.innerHTML = r.html;
    var done = false;
    function finish() {
      if (done) return; done = true;
      leaf.remove();
      if (!fwd) showSpread(to);
      state.busy = false;
    }
    if (fwd) showSpread(to);                       // new page is already underneath
    else { updateTabs(); updateNav(); leaf.style.transform = "rotateY(-100deg)"; leaf.style.opacity = "0"; }
    els.leafHost.appendChild(leaf);
    leaf.getBoundingClientRect();                  // commit start state
    leaf.classList.add("go");
    leaf.style.transform = fwd ? "rotateY(-100deg)" : "none";
    leaf.style.opacity = fwd ? "0" : "1";
    leaf.addEventListener("transitionend", function (e) { if (e.target === leaf && e.propertyName === "transform") finish(); });
    setTimeout(finish, 700);
  }

  /* ---------------- lightbox ---------------- */
  var lastFocus = null;
  function openLB(ci, fi) {
    var ch = state.data.chapters[ci], f = ch && ch.flashes[fi];
    if (!f) return;
    if (els.lb.hidden) lastFocus = document.activeElement;
    state.lb = { ci: ci, fi: fi };
    var img = imgTag(f.image, f.title);
    els.lbFigure.innerHTML = (img || '<div class="placeholder">' + PENCIL + "<span>drawing coming soon</span></div>") +
      (f.status === "taken" ? '<div class="taken-stamp">TAKEN</div>' : "");
    els.lbChapter.textContent = ch.n + " · " + ch.name;
    els.lbTitle.textContent = f.title;
    var meta = [];
    if (f.size) meta.push("<span>Size: " + esc(f.size) + "</span>");
    if (f.price) meta.push("<span>Price: " + esc(f.price) + "</span>");
    meta.push(f.status === "taken"
      ? '<span class="pill" style="background:#111;color:#fff">ALREADY TATTOOED</span>'
      : '<span class="pill">AVAILABLE</span>');
    els.lbMeta.innerHTML = meta.join("");
    els.lbNotes.textContent = f.notes || "";
    els.lbAr.hidden = !clean(f.image);
    els.lbLinkText.textContent = "Copia link per le storie";
    els.lbCta.href = "https://ig.me/m/" + state.data.handle;
    els.lbCta.textContent = f.status === "taken" ? "Ask for something similar" : "Ask me about this flash";
    var n = ch.flashes.length;
    els.lbPos.textContent = (fi + 1) + " / " + n;
    els.lbPrev.disabled = els.lbNext.disabled = n < 2;
    els.lb.hidden = false;
    els.lbClose.focus();
    if (history.replaceState) history.replaceState(null, "", "#f/" + encodeURIComponent(f.slug));
    document.title = f.title + " · @" + state.data.handle + " · Flashbook";
  }
  function currentFlash() {
    return state.lb ? state.data.chapters[state.lb.ci].flashes[state.lb.fi] : null;
  }
  function flashURL(f) { return location.href.split("#")[0] + "#f/" + encodeURIComponent(f.slug); }

  /* direct links: find a flash by its link name, jump the book to its page and open it */
  function findFlash(slug) {
    var chs = state.data.chapters;
    for (var ci = 0; ci < chs.length; ci++)
      for (var fi = 0; fi < chs[ci].flashes.length; fi++)
        if (chs[ci].flashes[fi].slug === slug) return { ci: ci, fi: fi };
    return null;
  }
  function spreadOf(ci, fi) {
    for (var i = 0; i < state.spreads.length; i++) {
      var sp = state.spreads[i], ps = pagesOf(sp);
      for (var k = 0; k < ps.length; k++)
        if (ps[k].t === "flashes" && ps[k].ci === ci && fi >= ps[k].start && fi < ps[k].start + state.per) return i;
    }
    return state.data.chapterSpread[ci] || 0;
  }
  function linkSlug() {
    var m = /^#f\/(.+)$/.exec(location.hash || "");
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  function openFromLink(slug) {
    var hit = findFlash(slug);
    if (!hit) { toast("Questo flash non c'è più."); syncHash(); return; }
    state.cur = spreadOf(hit.ci, hit.fi);
    renderTabs(); layout(); showSpread(state.cur);
    openLB(hit.ci, hit.fi);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) {}
      t.remove();
      done ? ok() : no(new Error("copy"));
    });
  }
  function stepLB(d) {
    if (!state.lb) return;
    var n = state.data.chapters[state.lb.ci].flashes.length;
    openLB(state.lb.ci, (state.lb.fi + d + n) % n);
  }
  function closeLB() {
    els.lb.hidden = true; state.lb = null;
    if (state.data) document.title = "@" + state.data.handle + " · Flashbook";
    syncHash();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- events ---------------- */
  els.prev.addEventListener("click", function () { goTo(state.cur - 1); });
  els.next.addEventListener("click", function () { goTo(state.cur + 1); });
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-goto]");
    if (g && !g.closest(".leaf")) { goTo(parseInt(g.dataset.goto, 10)); return; }
    var c = e.target.closest(".card");
    if (c && !c.closest(".leaf")) openLB(parseInt(c.dataset.ci, 10), parseInt(c.dataset.fi, 10));
  });
  els.lbClose.addEventListener("click", closeLB);
  els.lbAr.addEventListener("click", function () {
    var f = currentFlash();
    if (!f || !window.FlashbookAR) return;
    window.FlashbookAR.open({ src: imgSrc(f.image), fallback: imgFallback(f.image), title: f.title, slug: f.slug, toast: toast });
  });
  els.lbLink.addEventListener("click", function () {
    var f = currentFlash();
    if (!f) return;
    var url = flashURL(f);
    copyText(url).then(function () {
      toast("Link copiato! Incollalo nello sticker «Link» della storia.");
      els.lbLinkText.textContent = "Link copiato ✓";
    }).catch(function () { window.prompt("Copia questo link:", url); });
  });
  window.addEventListener("hashchange", function () {
    var slug = linkSlug();
    if (slug && state.data && !(window.FlashbookAR && window.FlashbookAR.isOpen())) openFromLink(slug);
  });
  els.lbPrev.addEventListener("click", function () { stepLB(-1); });
  els.lbNext.addEventListener("click", function () { stepLB(1); });
  els.lb.addEventListener("click", function (e) { if (e.target === els.lb) closeLB(); });

  document.addEventListener("keydown", function (e) {
    if (window.FlashbookAR && window.FlashbookAR.isOpen()) return;
    if (!els.lb.hidden) {
      if (e.key === "Escape") closeLB();
      else if (e.key === "ArrowLeft") stepLB(-1);
      else if (e.key === "ArrowRight") stepLB(1);
      else if (e.key === "Tab") { // keep focus inside the dialog
        var f = els.lb.querySelectorAll("button:not([disabled]), a[href]");
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (e.key === "ArrowLeft") goTo(state.cur - 1);
    else if (e.key === "ArrowRight") goTo(state.cur + 1);
  });

  // swipe to turn pages (and to browse inside the lightbox)
  function swipe(el, onLeft, onRight) {
    var x0 = null, y0 = 0;
    el.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? onLeft : onRight)();
    }, { passive: true });
  }
  swipe(els.stage, function () { goTo(state.cur + 1); }, function () { goTo(state.cur - 1); });
  swipe(els.lb, function () { stepLB(1); }, function () { stepLB(-1); });

  var rt = null;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var scaleChanged = layout();
      if (!state.data || state.busy) return;
      if (state.per !== perNow() || state.builtSingle !== state.single) {
        rebuildKeepingPlace();
      } else if (scaleChanged) { renderTabs(); showSpread(state.cur); }
    }, 60);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // re-paginate (e.g. phone rotated) and stay on the same chapter / flash / page
  function rebuildKeepingPlace() {
    var old = state.spreads[state.cur] || {}, ref = null, first = pagesOf(old)[0] || {};
    pagesOf(old).forEach(function (p) { if (!ref && p && p.ci != null) ref = { ci: p.ci, start: p.start || 0, t: p.t }; });
    state.spreads = buildSpreads(state.data);
    var to = 0;
    if (ref) {
      to = state.data.chapterSpread[ref.ci];
      if (ref.t === "flashes") {
        state.spreads.forEach(function (sp, i) {
          pagesOf(sp).forEach(function (p) {
            if (p.t === "flashes" && p.ci === ref.ci && ref.start >= p.start && ref.start < p.start + state.per) to = i;
          });
        });
      }
    } else if (first.t && first.t !== "cover") {
      state.spreads.forEach(function (sp, i) { if (!to && pagesOf(sp).some(function (p) { return p.t === first.t; })) to = i; });
    }
    state.cur = to;
    renderTabs(); layout(); showSpread(to);
  }

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 7000);
  }

  /* ---------------- boot ---------------- */
  var startHash = parseInt((location.hash || "").slice(1), 10);
  var startSlug = linkSlug();   // read before the first paint rewrites the address bar
  layout();
  state.spreads = [coverSpread()];
  showSpread(0);

  loadAll().then(function (res) {
    state.data = buildModel(res[0], res[1], res[2]);
    state.spreads = buildSpreads(state.data);
    els.handle.textContent = "@" + state.data.handle;
    document.title = "@" + state.data.handle + " · Flashbook";
    state.cur = startHash > 0 && startHash < state.spreads.length ? startHash : 0;
    renderTabs();
    layout();
    showSpread(state.cur);
    if (startSlug) openFromLink(startSlug);
  }).catch(function (err) {
    console.error(err);
    toast("Couldn't load the flashbook data: " + err.message);
  });
})();
