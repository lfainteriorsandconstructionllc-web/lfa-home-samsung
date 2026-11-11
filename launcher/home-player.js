/* Reproductor persistente de Home. Una instancia, sin depender del foco. ES5/UMD.
   1.11.0: motor «frame» (experimental) para los kinds web y youtube: un
   iframe (options.frame) en el mismo recuadro; sin cargar en frameTimeout
   (15 s) pasa a error «No se pudo cargar en el recuadro». */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HomePlayer = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function safeURL(value) {
    return typeof value === "string" && value.length <= 8192 && /^https:\/\/[^\s/@:]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(value) && !/[\x00-\x20\x7f]/.test(value);
  }
  function create(options) {
    options = options || {};
    var video = options.video, object = options.object, av = options.avplay, frame = options.frame, sequence = 0, cancelResolve = null;
    var frameTimeout = options.frameTimeout || 15000, frameSrc = "", BLANK = "about:blank";
    var timer = null, ticker = null, listeners = [], destroyed = false, visible = true, wantPause = false;
    var rect = { x: 882, y: 190, width: 924, height: 518 }, original = null;
    var state = { status: "idle", id: null, title: "", kind: null, engine: null, currentTime: 0, duration: 0, error: "", live: false, frameUrl: "" };
    var timeout = options.prepareTimeout || 20000, lastRect = "", nativePrepared = false;
    function emit() { if (typeof options.onChange === "function") options.onChange(copy(state)); }
    function snapshot() { return copy(state); }
    function clock() {
      try {
        if (state.engine === "avplay") { state.currentTime = Math.max(0, Number(av.getCurrentTime()) / 1000 || 0); state.duration = Math.max(0, Number(av.getDuration()) / 1000 || 0); }
        else if (video) { state.currentTime = Math.max(0, Number(video.currentTime) || 0); state.duration = isFinite(video.duration) ? Math.max(0, Number(video.duration) || 0) : 0; }
      } catch (ignored) {}
    }
    function clearDeadline() { clearTimeout(timer); timer = null; }
    function applyRect() {
      if (object && object.style) object.style.visibility = visible && state.engine === "avplay" ? "visible" : "hidden";
      if (video && video.style) video.style.visibility = visible && state.engine === "html5" ? "visible" : "hidden";
      if (frame && frame.style) frame.style.visibility = visible && state.engine === "frame" ? "visible" : "hidden";
      if (state.engine === "avplay" && av && state.status !== "idle" && state.status !== "error") {
        var nextRect = [visible ? rect.x : 0, visible ? rect.y : 0, visible ? rect.width : 1, visible ? rect.height : 1];
        if (nextRect.join(",") !== lastRect) try { av.setDisplayRect(nextRect[0], nextRect[1], nextRect[2], nextRect[3]); lastRect = nextRect.join(","); } catch (ignored) {}
      }
    }
    /* keepFrame: la siguiente fuente también es web; se navega directamente
       a la nueva página sin pasar por la página en blanco. */
    function release(keepFrame) {
      var i;
      clearDeadline(); clearInterval(ticker); ticker = null; lastRect = ""; nativePrepared = false;
      if (cancelResolve) { try { cancelResolve(); } catch (ignoredCancel) {} cancelResolve = null; }
      if (video) {
        for (i = 0; i < listeners.length; i++) video.removeEventListener(listeners[i][0], listeners[i][1]);
        listeners = [];
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch (ignoredVideo) {}
      }
      if (av) { try { av.setListener({}); } catch (ignoredListener) {} try { av.stop(); } catch (ignoredStop) {} try { av.close(); } catch (ignoredClose) {} }
      if (object && object.style) object.style.visibility = "hidden";
      if (video && video.style) video.style.visibility = "hidden";
      if (keepFrame && frame) frame.onload = null; else blankFrame();
    }
    /* Descargar la página detiene su sonido; el oyente se quita antes. */
    function blankFrame() {
      if (!frame) return;
      frame.onload = null; if (frame.style) frame.style.visibility = "hidden";
      if (frameSrc) { frameSrc = ""; try { frame.src = BLANK; } catch (ignoredFrame) {} }
    }
    function loadFrame(url, token) {
      frame.onload = function () {
        if (token !== sequence || destroyed || state.engine !== "frame" || !frameSrc) return;
        /* El evento de la página en blanco anterior puede llegar tarde: sólo
           cuenta la página nueva (de otro origen, no legible desde Home). */
        try { if (frame.contentWindow && frame.contentWindow.location && frame.contentWindow.location.href === BLANK) return; } catch (otherOrigin) { /* página cargada */ }
        clearDeadline(); state.status = "playing"; state.error = ""; if (wantPause) pause(); else emit();
      };
      clearDeadline();
      timer = setTimeout(function () { fail(new Error("No se pudo cargar en el recuadro."), token); }, frameTimeout);
      frameSrc = url; frame.src = url;
    }
    function frameBegin(item, token) {
      var url = item.frameUrl || "";
      if (!frame || !safeURL(url)) { fail(new Error("No se pudo cargar en el recuadro."), token); return; }
      if (av) { try { av.setListener({}); } catch (ignoredListener) {} try { av.stop(); } catch (ignoredStop) {} try { av.close(); } catch (ignoredClose) {} }
      state.engine = "frame"; state.kind = item.kind; state.live = !!item.live; state.status = "loading"; state.error = ""; state.frameUrl = url;
      applyRect(); emit(); loadFrame(url, token);
    }
    /* YouTube con enablejsapi acepta órdenes por postMessage; una página web
       se descarga al pausar y se vuelve a cargar al continuar. */
    function frameCommand(name) {
      try { if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: "command", func: name, args: [] }), "*"); return true; } catch (ignored) { return false; }
    }
    function fail(error, token) {
      if (token !== sequence || destroyed) return;
      release(); state.status = "error";
      state.error = error && error.message ? String(error.message).slice(0, 220) : "No se pudo reproducir. La fuente puede haber terminado o requerir acceso.";
      emit();
    }
    function beginTicker(token) {
      clearInterval(ticker);
      ticker = setInterval(function () { if (token === sequence && !destroyed) { clock(); emit(); } }, 1000);
    }
    function html5(item, token, nativeError) {
      if (token !== sequence || destroyed) return;
      if (!video) { fail(nativeError || new Error("Reproductor no disponible"), token); return; }
      clearDeadline(); state.engine = "html5";
      if (av) { try { av.setListener({}); } catch (ignoredListener) {} try { av.stop(); } catch (ignoredStop) {} try { av.close(); } catch (ignoredClose) {} }
      state.engine = "html5"; state.status = "loading"; state.error = ""; applyRect(); emit();
      function on(name, fn) { video.addEventListener(name, fn); listeners.push([name, fn]); }
      function current() { return token === sequence && !destroyed; }
      on("playing", function () { if (!current()) return; clearDeadline(); state.status = "playing"; state.error = ""; clock(); if (wantPause) pause(); else emit(); });
      on("pause", function () { if (!current() || state.status === "loading" || state.status === "resolving" || state.status === "error" || state.status === "ended") return; state.status = "paused"; clock(); emit(); });
      on("ended", function () { if (!current()) return; clearDeadline(); state.status = "ended"; clock(); emit(); });
      on("error", function () { if (current()) fail(new Error("No se pudo reproducir esta fuente. Comprueba el enlace y su disponibilidad."), token); });
      on("loadedmetadata", function () { if (current()) { clock(); emit(); } });
      on("waiting", function () { if (current() && state.status === "playing") { state.status = "loading"; clearDeadline(); timer = setTimeout(function () { fail(new Error("Se ha interrumpido la conexión con la fuente."), token); }, timeout); emit(); } });
      try {
        video.src = item.url; video.load();
        var result = video.play();
        if (result && typeof result.catch === "function") result.catch(function (error) { if (current()) fail(error, token); });
        timer = setTimeout(function () { fail(new Error("La fuente no empieza a reproducirse. Comprueba Internet y reintenta."), token); }, timeout);
        beginTicker(token);
      } catch (error) { fail(error, token); }
    }
    function begin(item, token) {
      if (token !== sequence || destroyed) return;
      if (item && (item.kind === "web" || item.kind === "youtube")) { clearDeadline(); frameBegin(item, token); return; }
      if (!item || !safeURL(item.url) || (item.kind !== "hls" && item.kind !== "mp4")) { fail(new Error("Se necesita un vídeo MP4 o una señal HLS con enlace HTTPS compatible."), token); return; }
      clearDeadline(); state.kind = item.kind; state.live = !!item.live; state.status = "loading";
      if (!av || typeof av.prepareAsync !== "function" || typeof av.open !== "function") { html5(item, token); return; }
      state.engine = "avplay"; emit();
      function current() { return token === sequence && !destroyed; }
      function fallback(error) { if (current() && state.engine === "avplay") html5(item, token, error); }
      try {
        av.open(item.url);
        av.setListener({
          onbufferingstart: function () { if (current() && state.engine === "avplay" && state.status === "playing") { state.status = "loading"; clearDeadline(); timer = setTimeout(function () { fallback(new Error("Se ha interrumpido la conexión con la fuente.")); }, timeout); emit(); } },
          onbufferingcomplete: function () { if (current() && state.engine === "avplay" && nativePrepared && state.status === "loading") { clearDeadline(); if (wantPause) try { av.pause(); } catch (ignoredPause) {} state.status = wantPause ? "paused" : "playing"; emit(); } },
          oncurrentplaytime: function (time) { if (current() && state.engine === "avplay") state.currentTime = Math.max(0, Number(time) / 1000 || 0); },
          onstreamcompleted: function () { if (current() && state.engine === "avplay") { state.status = "ended"; clock(); emit(); } },
          onerror: function (error) { if (current() && state.engine === "avplay") { if (state.status === "loading") fallback(new Error(String(error || "Error de vídeo"))); else fail(new Error("La reproducción se ha interrumpido. Puedes reintentar la fuente."), token); } }
        });
        applyRect();
        if (typeof av.setDisplayMethod === "function") try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (ignoredMethod) {}
        timer = setTimeout(function () { fallback(new Error("La preparación del vídeo agotó el tiempo de espera.")); }, timeout);
        av.prepareAsync(function () {
          if (!current() || state.engine !== "avplay") return;
          clearDeadline();
          try { nativePrepared = true; av.play(); state.status = "playing"; if (wantPause) { av.pause(); state.status = "paused"; } clock(); applyRect(); beginTicker(token); emit(); }
          catch (error) { fallback(error); }
        }, fallback);
      } catch (error) { fallback(error); }
    }
    function play(item) {
      if (destroyed || !item) return false;
      var token = ++sequence;
      release(item.kind === "web" || item.kind === "youtube"); original = copy(item); wantPause = false;
      state = { status: "resolving", id: item.id || null, title: item.title || item.name || "Vídeo", kind: item.kind || null, engine: null, currentTime: 0, duration: 0, error: "", live: !!item.live, frameUrl: "" };
      emit();
      timer = setTimeout(function () { fail(new Error("No se pudo obtener la fuente de vídeo a tiempo. Reintenta."), token); }, timeout);
      if (typeof options.resolve === "function") {
        var returned;
        try { returned = options.resolve(item, function (error, resolved) {
          if (token !== sequence || destroyed) return;
          cancelResolve = null;
          if (error) fail(error, token); else begin(resolved, token);
        }); } catch (resolveError) { fail(resolveError, token); }
        if (token === sequence && state.status === "resolving") cancelResolve = returned || null;
      } else begin(item, token);
      return true;
    }
    function pause() {
      wantPause = true;
      if (state.status === "loading" || state.status === "resolving") return;
      if (state.status !== "playing") return;
      if (state.engine === "frame") {
        if (state.kind !== "youtube" || !frameCommand("pauseVideo")) blankFrame();
        clearDeadline(); state.status = "paused"; applyRect(); emit(); return;
      }
      try { if (state.engine === "avplay") av.pause(); else video.pause(); state.status = "paused"; clock(); emit(); }
      catch (error) { fail(error, sequence); }
    }
    function resume() {
      wantPause = false;
      if (state.status === "ended" || state.status === "error") { if (original) play(original); return; }
      if (state.status !== "paused") return;
      if (state.engine === "frame") {
        if (frameSrc && state.kind === "youtube" && frameCommand("playVideo")) { state.status = "playing"; emit(); return; }
        state.status = "loading"; applyRect(); emit(); loadFrame(state.frameUrl, sequence); return;
      }
      try {
        if (state.engine === "avplay") { av.play(); state.status = "playing"; emit(); }
        else { var token = sequence, result = video.play(); if (result && typeof result.catch === "function") result.catch(function (error) { fail(error, token); }); }
      } catch (error) { fail(error, sequence); }
    }
    function toggle() { if (state.status === "playing" || state.status === "loading" || state.status === "resolving") pause(); else resume(); }
    function stop() { ++sequence; release(); original = null; state = { status: "idle", id: null, title: "", kind: null, engine: null, currentTime: 0, duration: 0, error: "", live: false, frameUrl: "" }; emit(); }
    function setRect(value) {
      if (!value || !isFinite(value.x) || !isFinite(value.y) || !isFinite(value.width) || !isFinite(value.height)) return;
      rect = { x: Math.max(0, Math.round(value.x)), y: Math.max(0, Math.round(value.y)), width: Math.max(1, Math.round(value.width)), height: Math.max(1, Math.round(value.height)) }; applyRect();
    }
    return { play: play, pause: pause, resume: resume, toggle: toggle, stop: stop, snapshot: snapshot, setRect: setRect,
      setVisible: function (value) { visible = !!value; applyRect(); }, destroy: function () { stop(); destroyed = true; } };
  }
  return { create: create, safeURL: safeURL };
});
