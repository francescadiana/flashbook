/* diana.inkkk flashbook — "Provatelo addosso": camera + flash overlay + photo capture.
 * Public API: FlashbookAR.open({ src, fallback, title, slug, toast }), FlashbookAR.isOpen().
 * Everything runs in the browser; no photo ever leaves the device. */
(function () {
  "use strict";

  /* ---- texts (edit here to change wording) ---- */
  var T = {
    hint: "Trascina per spostare · pizzica per ingrandire e ruotare",
    camDenied: "Non riesco ad accedere alla fotocamera. Consenti l'accesso nelle impostazioni del browser e riprova.",
    camUnsupported: "Questo browser non permette di usare la fotocamera dal sito.",
    inApp: "Sei dentro il browser di Instagram, che spesso blocca la fotocamera. Tocca ⋯ e scegli «Apri nel browser» (Safari/Chrome), oppure scatta una foto qui sotto.",
    artFail: "Non riesco a caricare il disegno di questo flash.",
    saveFail: "Non riesco a salvare la foto da qui (immagine protetta). Fai uno screenshot oppure riprova più tardi.",
    saved: "Foto salvata!",
    iosHint: "Nel menu che si apre scegli «Salva immagine»."
  };

  var $ = function (id) { return document.getElementById(id); };
  var root = $("ar");
  if (!root) { window.FlashbookAR = { open: function () {}, isOpen: function () { return false; } }; return; }

  var el = {
    stage: $("arStage"), video: $("arVideo"), photo: $("arPhoto"), art: $("arArt"),
    title: $("arTitle"), hint: $("arHint"), close: $("arClose"),
    msg: $("arMsg"), msgText: $("arMsgText"), file: $("arFile"), retry: $("arRetry"),
    size: $("arSize"), rot: $("arRot"), shutter: $("arShutter"), flip: $("arFlip"),
    result: $("arResult"), resultImg: $("arResultImg"), again: $("arAgain"), save: $("arSave"), saveNote: $("arSaveNote")
  };

  var st = {
    opts: null, open: false, token: 0, mode: "video", facing: "user", mirrored: true,
    stream: null, artImg: null, tainted: false, ink: true,
    x: 0, y: 0, w: 200, rot: 0, blob: null, blobUrl: "", lastFocus: null
  };

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var inApp = /Instagram|FBAN|FBAV/i.test(navigator.userAgent);

  /* ---------------- art overlay ---------------- */
  function box() { var r = el.stage.getBoundingClientRect(); return { W: r.width, H: r.height }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function applyArt() {
    var b = box();
    st.w = clamp(st.w, 30, Math.max(b.W, b.H) * 1.6);
    st.x = clamp(st.x, 0, b.W);
    st.y = clamp(st.y, 0, b.H);
    el.art.style.width = st.w + "px";
    el.art.style.transform = "translate(" + st.x.toFixed(1) + "px," + st.y.toFixed(1) + "px) translate(-50%,-50%) rotate(" + st.rot.toFixed(4) + "rad)";
    el.size.value = String(Math.round(st.w / Math.min(b.W, b.H) * 100));
    var deg = Math.round(((st.rot * 180 / Math.PI) % 360 + 540) % 360 - 180);
    el.rot.value = String(deg);
  }
  function resetArt() {
    var b = box();
    st.x = b.W / 2; st.y = b.H / 2; st.rot = 0; st.w = Math.min(b.W, b.H) * 0.45;
    applyArt();
  }

  el.size.addEventListener("input", function () { var b = box(); st.w = (parseFloat(el.size.value) / 100) * Math.min(b.W, b.H); applyArt(); });
  el.rot.addEventListener("input", function () { st.rot = parseFloat(el.rot.value) * Math.PI / 180; applyArt(); });

  /* gestures: one finger drags, two fingers pinch (size) + twist (rotation) */
  var ptrs = {};
  function ptrList() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  function pinchInfo() {
    var p = ptrList();
    var dx = p[1].x - p[0].x, dy = p[1].y - p[0].y;
    return { d: Math.hypot(dx, dy) || 1, a: Math.atan2(dy, dx), cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 };
  }
  var pinch = null;
  el.stage.addEventListener("pointerdown", function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { el.stage.setPointerCapture(e.pointerId); } catch (err) {}
    pinch = ptrList().length === 2 ? pinchInfo() : null;
    hideHint();
  });
  el.stage.addEventListener("pointermove", function (e) {
    var p = ptrs[e.pointerId];
    if (!p) return;
    var n = ptrList().length;
    if (n === 1) {
      st.x += e.clientX - p.x; st.y += e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
    } else if (n === 2) {
      p.x = e.clientX; p.y = e.clientY;
      var now = pinchInfo();
      if (pinch) {
        st.w *= now.d / pinch.d;
        st.rot += now.a - pinch.a;
        st.x += now.cx - pinch.cx; st.y += now.cy - pinch.cy;
      }
      pinch = now;
    } else return;
    applyArt();
  });
  function endPtr(e) {
    delete ptrs[e.pointerId];
    pinch = ptrList().length === 2 ? pinchInfo() : null;
  }
  el.stage.addEventListener("pointerup", endPtr);
  el.stage.addEventListener("pointercancel", endPtr);
  // mouse wheel: size; shift + wheel: rotate
  el.stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (e.shiftKey) st.rot += e.deltaY * 0.002;
    else st.w *= Math.exp(-e.deltaY * 0.0015);
    applyArt(); hideHint();
  }, { passive: false });

  var hintTimer = null;
  function showHint() { el.hint.textContent = T.hint; el.hint.classList.remove("off"); clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 5000); }
  function hideHint() { el.hint.classList.add("off"); }

  /* ---------------- loading the drawing ---------------- */
  function loadArt(src, fb) {
    return new Promise(function (resolve, reject) {
      var tries = [{ u: src, cors: true }];
      if (fb) tries.push({ u: fb, cors: true });
      tries.push({ u: src, cors: false });   // last resort: shows fine, but the browser won't let us save the photo
      (function next(i) {
        if (i >= tries.length) return reject(new Error("art"));
        var im = new Image();
        if (tries[i].cors) im.crossOrigin = "anonymous";
        im.onload = function () { resolve({ img: im, tainted: !tries[i].cors }); };
        im.onerror = function () { next(i + 1); };
        im.src = tries[i].u;
      })(0);
    });
  }

  /* ---------------- camera ---------------- */
  function stopCamera() {
    if (st.stream) { st.stream.getTracks().forEach(function (t) { t.stop(); }); st.stream = null; }
    el.video.srcObject = null;
  }

  function setMode(mode) {
    st.mode = mode;
    el.video.hidden = mode !== "video";
    el.photo.hidden = mode !== "photo";
    el.flip.hidden = mode !== "video" || !st.canFlip;
    el.shutter.disabled = false;
  }

  function startCamera() {
    stopCamera();
    var tok = st.token;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) {
      return Promise.reject({ name: "unsupported" });
    }
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: st.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    }).then(function (stream) {
      if (tok !== st.token || !st.open) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      st.stream = stream;
      var s = stream.getVideoTracks()[0].getSettings ? stream.getVideoTracks()[0].getSettings() : {};
      var face = s.facingMode || st.facing;
      st.mirrored = face === "user";
      el.video.classList.toggle("mirror", st.mirrored);
      el.video.srcObject = stream;
      setMode("video");
      hideMsg();
      var p = el.video.play();
      if (p && p.catch) p.catch(function () {});
      if (navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(function (list) {
          st.canFlip = list.filter(function (d) { return d.kind === "videoinput"; }).length > 1;
          el.flip.hidden = st.mode !== "video" || !st.canFlip;
        }).catch(function () {});
      }
    });
  }

  function showMsg(text) { el.msgText.textContent = text; el.msg.hidden = false; }
  function hideMsg() { el.msg.hidden = true; }

  function cameraFailed(err) {
    if (tokStale()) return;
    var name = err && err.name;
    var text = inApp ? T.inApp : (name === "unsupported" ? T.camUnsupported : T.camDenied);
    setMode("video");
    el.video.hidden = true;
    el.shutter.disabled = true;
    el.flip.hidden = true;
    showMsg(text);
  }
  function tokStale() { return !st.open; }

  el.retry.addEventListener("click", function () {
    var tok = st.token;
    startCamera().catch(function (e) { if (tok === st.token) cameraFailed(e); });
  });

  el.flip.addEventListener("click", function () {
    st.facing = st.facing === "user" ? "environment" : "user";
    var tok = st.token;
    startCamera().catch(function (e) { if (tok === st.token) cameraFailed(e); });
  });

  // fallback: take / pick a photo with the phone's own camera app
  el.file.addEventListener("change", function () {
    var f = el.file.files && el.file.files[0];
    if (!f) return;
    stopCamera();
    var url = URL.createObjectURL(f);
    el.photo.onload = function () { setMode("photo"); hideMsg(); el.shutter.disabled = false; showHint(); };
    el.photo.src = url;
    el.file.value = "";
  });

  /* ---------------- capture ---------------- */
  function compose() {
    var src = st.mode === "video" ? el.video : el.photo;
    var vw = st.mode === "video" ? el.video.videoWidth : el.photo.naturalWidth;
    var vh = st.mode === "video" ? el.video.videoHeight : el.photo.naturalHeight;
    if (!vw || !vh) throw new Error("nosource");
    var b = box();
    var sc = Math.max(b.W / vw, b.H / vh);              // object-fit: cover, same as on screen
    var sw = b.W / sc, sh = b.H / sc, sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    var down = Math.min(1, 2160 / Math.max(sw, sh));
    var cw = Math.round(sw * down), ch = Math.round(sh * down), f = cw / b.W;
    var cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    if (st.mode === "video" && st.mirrored) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
    ctx.restore();
    var im = st.artImg, aw = st.w, ah = st.w * im.naturalHeight / im.naturalWidth;
    ctx.save();
    ctx.translate(st.x * f, st.y * f);
    ctx.rotate(st.rot);
    if (st.ink) ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(im, -aw / 2 * f, -ah / 2 * f, aw * f, ah * f);
    ctx.restore();
    return cv;
  }

  el.shutter.addEventListener("click", function () {
    var cv;
    try { cv = compose(); } catch (e) { toast(T.saveFail); return; }
    try {
      cv.toBlob(function (blob) {
        if (!blob) { toast(T.saveFail); return; }
        if (st.blobUrl) URL.revokeObjectURL(st.blobUrl);
        st.blob = blob; st.blobUrl = URL.createObjectURL(blob);
        el.resultImg.src = st.blobUrl;
        el.saveNote.textContent = isIOS ? T.iosHint : "";
        el.result.hidden = false;
        el.save.focus();
      }, "image/jpeg", 0.92);
    } catch (e) {               // tainted canvas: the image host doesn't allow saving
      toast(T.saveFail);
    }
  });

  el.again.addEventListener("click", function () { el.result.hidden = true; el.shutter.focus(); });

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = st.blobUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  el.save.addEventListener("click", function () {
    if (!st.blob) return;
    var name = "flash-" + (st.opts && st.opts.slug ? st.opts.slug : "ar") + ".jpg";
    var file = null;
    try { file = new File([st.blob], name, { type: "image/jpeg" }); } catch (e) {}
    // iPhone/iPad: the share sheet is the way to reach "Save Image" (Photos)
    if (isIOS && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: (st.opts && st.opts.title) || "Flash" })
        .then(function () { toast(T.saved); })
        .catch(function (e) { if (!e || e.name !== "AbortError") download(st.blob, name); });
    } else {
      download(st.blob, name);
      toast(T.saved);
    }
  });

  function toast(m) { if (st.opts && st.opts.toast) st.opts.toast(m); }

  /* ---------------- open / close ---------------- */
  function open(opts) {
    st.opts = opts; st.open = true; st.token++;
    var tok = st.token;
    st.lastFocus = document.activeElement;
    st.canFlip = false; st.ink = true; st.facing = "user"; st.mirrored = true;
    el.art.classList.add("ink");      // ink effect is always on: the white of the drawing is see-through
    el.title.textContent = opts.title || "";
    el.result.hidden = true; hideMsg();
    el.art.removeAttribute("src");
    el.shutter.disabled = true;
    el.video.hidden = false; el.photo.hidden = true; el.flip.hidden = true;
    root.hidden = false;
    document.body.classList.add("ar-open");
    el.close.focus();

    loadArt(opts.src, opts.fallback).then(function (r) {
      if (tok !== st.token) return;
      st.artImg = r.img; st.tainted = r.tainted;
      el.art.src = r.img.src;
      resetArt(); showHint();
      return startCamera();
    }).catch(function (e) {
      if (tok !== st.token) return;
      if (e && e.message === "art") { showMsg(T.artFail); return; }
      cameraFailed(e);
    });
  }

  function close() {
    if (!st.open) return;
    st.open = false; st.token++;
    stopCamera();
    root.hidden = true;
    document.body.classList.remove("ar-open");
    el.photo.removeAttribute("src");
    if (st.blobUrl) { URL.revokeObjectURL(st.blobUrl); st.blobUrl = ""; }
    st.blob = null; ptrs = {}; pinch = null;
    if (st.lastFocus && st.lastFocus.focus) st.lastFocus.focus();
  }
  el.close.addEventListener("click", close);

  document.addEventListener("keydown", function (e) {
    if (!st.open) return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); if (!el.result.hidden) el.result.hidden = true; else close(); return; }
    if (e.key === "Tab") {     // keep focus inside the dialog
      var f = Array.prototype.filter.call(root.querySelectorAll("button:not([disabled]), input:not([disabled]), label.ar-btn"), function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);

  window.addEventListener("resize", function () { if (st.open && st.artImg) applyArt(); });

  window.FlashbookAR = { open: open, close: close, isOpen: function () { return st.open; } };
})();
