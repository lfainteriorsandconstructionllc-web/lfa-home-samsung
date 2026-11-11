/* Home 1.27.2: Centro multimedia HD, escaparate visual, fondo dinámico y botón Home fijo del mando. ES5. */
(function () {
  "use strict";
  var M = window.HomeModel, T = window.HomeTheme, P = window.HomePreferences, HP = window.HomePlatform, CONFIG = window.CONFIG || {}, VERSION = CONFIG.version || "1.27.2";
  var APP_NAME = CONFIG.appName || "Home";
  var LFA_CONTROLS = CONFIG.compactHomeControls === true;
  var PLAYER_RECT = LFA_CONTROLS ? { x: 942, y: 190, width: 864, height: 486 } : { x: 882, y: 190, width: 924, height: 518 };
  var HOME_PLAYER_RECT = { x: 590, y: 84, width: 1280, height: 720 };
  var DOCK = Array.isArray(CONFIG.dock) ? CONFIG.dock : ["Netflix", "YouTube", "Prime Video", "Disney+", "HBO Max"];
  var HOME_PAGE_SIZE = CONFIG.pagedHome ? (LFA_CONTROLS ? 8 : 6) : 0, homePage = 0;
  var W = window.HomeWeather, TILE_WIDTH = 296, TILE_STEP = 320, TRACK_PADDING = 20;
  var $ = function (id) { return document.getElementById(id); };
  var rows = [], apps = [], sources = [], focused = null, cur = { r: 0, c: 0 }, catalogPainted = false;
  var ready = false, status = "loading", view = "home", lastRefresh = 0, refreshId = 0, refreshTimer = null;
  var loading = false, actionBusy = false, actionTimer = null, messageTimer = null, messageSerial = 0;
  var enterHeld = false, pendingEnter = null, longPressTimer = null, lastArrow = 0, lastArrowTime = 0, errors = [], loadWarning = "";
  var ambientIndex = 0, ambientKey = "", ambientLayers = [$("ambient-a"), $("ambient-b")];
  var ambientState = { appId: null, name: "Home", colors: [], contrast: null, intensity: "vivid", mode: "app" };
  var pointerPosition = { x: null, y: null };
  var nativeDigitPending = null;
  var whiteKeyState = null, whiteKeyBusy = false;
  var weatherController = null, weatherState = null, weatherDraft = null;
  var disposed = false, iconBackgrounds = Object.create(null);
  var prefs = null, prefsLoaded = false, persistenceFailed = false, lastSaveSucceeded = true, preferencesStorage = null;
  var viewMemory = {}, returnStack = [], contextAppId = null, libraryFilter = "all", reorder = null;
  var previewState = { appId: null, type: "navigation", live: false, caption: "" }, heroToken = 0;
  var lastHomeAppId = null, HM = window.HomeMedia, player = null, playerFullscreen = false;
  var playerState = { status: "idle", id: null, title: "", engine: null, currentTime: 0, duration: 0, error: "", live: false };
  var builtinMedia = HM ? HM.builtins() : [];
  if (HM && LFA_CONTROLS) builtinMedia = HM.combine(builtinMedia, (HM.curatedLive ? HM.curatedLive() : []).concat(HM.spanishLive(), HM.englishLive()));
  var mediaItems = builtinMedia, mediaLoading = false, mediaLoaded = false, mediaCancel = null, mediaError = "", mediaGeneration = 0;
  var lastPlayerError = "", mediaFormEditing = false, registeredKeys = [];
  /* 1.11.0: sección Volley (Sultanlar Ligi en YouTube), fuente fija y reanudar al volver. */
  var volleyVideos = [], volleyLoading = false, volleyLoaded = false, volleyCancel = null, volleyError = "", volleyGeneration = 0;
  var contextMediaId = null, editingMediaId = null, pinnedStarted = false, pinnedPending = null, pausedByHide = false, externalLaunches = [];
  var lastLaunch = null, returnWatch = null, statusListener = null, SELF_ID = "HkTvHome01.Home";
  var mediaChip = "all", capturingHomeKey = false, lastCapturedKey = null;
  var SHORTCUT_POLL_MS = 400, SHORTCUT_RECLAIM_MS = 15000, shortcutTimer = null, reclaimTimer = null;
  var shortcutWatch = { polling: false, prevIds: null, ignoreUntil: Object.create(null), cooldownUntil: 0, reclaimUntil: 0, reclaimLabel: "", lastReclaimCallAt: 0, confirmTimer: null, triggers: 0, lastTriggeredId: "", lastTriggeredAt: 0 };
  /* Biblioteca (1.8.0): categoría activa y consulta del buscador. Duran
     mientras la biblioteca está abierta (también al volver de sus opciones);
     no se guardan en las preferencias. */
  /* 1.14.0: perfiles. profileContextId = perfil de las opciones; profileDraft = nombre en curso. */
  var profileContextId = null, profileDraft = null;
  var libraryChip = "all", libraryQuery = "", librarySearchReturnId = null, libraryLetterIndex = 0, libraryGridCol = 0, libraryLastAppId = null;
  function playerActive() { return playerState.status !== "idle"; }
  function directMedia(item) { return item.kind === "hls" || item.kind === "mp4"; }
  function visibleMedia(list) {
    if (!LFA_CONTROLS) return list;
    var hidden = prefs ? prefs.hiddenMedia : [];
    return list.filter(function (item) { return directMedia(item) && hidden.indexOf(item.id) < 0; });
  }
  function allMedia() { return HM ? visibleMedia(HM.combine(mediaItems, prefs && prefs.mediaSources || [])) : []; }
  function savedMedia() { return HM ? visibleMedia(HM.combine([], prefs && prefs.mediaSources || [])) : []; }
  function isBuiltinMedia(id) { return builtinMedia.some(function (item) { return item.id === id; }); }
  function mediaById(id) { var list = allMedia(), i; for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function playerLabel() { return playerState.status === "paused" ? "Continuar" : playerState.status === "error" || playerState.status === "ended" ? "Reintentar" : "Pausar"; }
  function syncPlayer() {
    if (!player) return;
    var show = playerActive() && (view === "home" || view === "home-menu" || view === "reorder" || view === "media" || playerFullscreen);
    $("stage").className = $("stage").className.replace(/\s*player-fullscreen/g, "").replace(/\s*player-active/g, "") + (playerActive() ? " player-active" : "") + (playerFullscreen ? " player-fullscreen" : "");
    $("preview-window").className = playerActive() ? "has-player" : (prefs && prefs.previewMode === "off" ? "hidden" : "");
    $("home-video").className = playerActive() && playerState.engine === "html5" ? "" : "hidden";
    $("home-avplayer").className = playerActive() && playerState.engine === "avplay" ? "" : "hidden";
    if ($("home-webframe")) $("home-webframe").className = playerActive() && playerState.engine === "frame" ? "" : "hidden";
    var rect = LFA_CONTROLS && (view === "home" || view === "home-menu") ? HOME_PLAYER_RECT : PLAYER_RECT;
    player.setRect(playerFullscreen ? { x: 0, y: 0, width: 1920, height: 1080 } : rect);
    player.setVisible(show);
    if (!playerActive()) { $("player-overlay").className = "hidden"; return; }
    $("preview-art").className = "hidden";
    if ($("preview-showcase")) $("preview-showcase").className = "hidden";
    var loadingVideo = playerState.status === "resolving" || playerState.status === "loading";
    var frameItem = HM && HM.isFrameKind && HM.isFrameKind(playerState.kind), current = mediaById(playerState.id);
    $("player-overlay").textContent = playerState.status === "error" ? (frameItem ? "No se pudo cargar en el recuadro. ↑ «Abrir en Internet»" + (playerState.kind === "youtube" ? " o «Abrir en YouTube»" : "") + "." : playerState.error + (!LFA_CONTROLS && (playerState.kind === "trt" || current && (current.kind === "trt" || current.sourcePage)) ? " ↑ «Abrir en Internet»." : ""))
      : loadingVideo ? (frameItem ? "Cargando la página en el recuadro…" : "Conectando con la fuente…") : playerState.status === "ended" ? "La reproducción ha terminado." : "";
    $("player-overlay").className = loadingVideo || playerState.status === "error" || playerState.status === "ended" ? "" : "hidden";
    $("preview-kind").textContent = playerState.title + " · " + (playerState.status === "paused" ? "En pausa" : playerState.status === "error" ? "No disponible" : playerState.status === "ended" ? "Finalizado" : frameItem ? "Experimental: web" : playerState.live ? "Señal en directo" : "Reproductor integrado") + (isPinned(playerState.id) ? " · Fijada" : "") + (playerFullscreen ? " · Volver reduce · ⏯ Pausa" : "");
    if ((view === "home" && !LFA_CONTROLS) || view === "reorder") {
      var selected = focused && focused.item && focused.item.kind === "app" ? focused.item : null, selectedApp = appById(lastHomeAppId);
      if (!selected && selectedApp) selected = { id: selectedApp.id, name: selectedApp.name, kind: "app", app: selectedApp };
      if (selected) paintSelectionCopy(selected);
      else {
        $("hero-eyebrow").textContent = "AHORA EN TU PANTALLA"; $("appname").textContent = playerState.title;
        $("position").textContent = playerState.status === "paused" ? "En pausa" : loadingVideo ? "Preparando reproducción" : playerState.status === "error" ? "Fuente no disponible" : playerState.live ? "En directo" : "Vídeo";
        $("hero-description").textContent = "Explora tus aplicaciones mientras este contenido sigue en la ventana superior.";
      }
      if (view === "home") $("home-note").textContent = HOME_PAGE_SIZE && homePage ? "Reproductor arriba del primer grupo · ⏯ Pausar / continuar" : "↑ Controles del reproductor · ⏯ Pausar / continuar";
    }
    previewState = { appId: null, mediaId: playerState.id, type: "playback", live: !!playerState.live, caption: $("preview-kind").textContent, status: playerState.status };
    var buttons = $("player-controls").querySelectorAll("button"), i;
    for (i = 0; i < buttons.length; i++) if (buttons[i].item && buttons[i].item.id === "player:toggle") { buttons[i].textContent = playerLabel(); buttons[i].item.name = playerLabel(); buttons[i].setAttribute("aria-label", playerLabel()); }
  }
  function playerChanged(next) {
    var was = playerActive(), previousId = playerState.id, previousStatus = playerState.status; playerState = next; if (disposed) return;
    if (next.status === "error" && next.error !== lastPlayerError) { lastPlayerError = next.error; recordError("player", new Error(next.error)); message(next.error, true); }
    if (next.status !== "error") lastPlayerError = "";
    if (!playerActive()) playerFullscreen = false;
    if (LFA_CONTROLS && prefsLoaded && next.status === "playing" && prefs.lastMedia !== next.id) {
      var media = mediaById(next.id);
      if (media && directMedia(media)) {
        persist(P.setLastMedia(prefs, media.id));
        if (reorder) reorder.draft.lastMedia = media.id;
      }
    }
    /* 1.11.0: otra fuente en el recuadro reconstruye los controles (fijar, abrir fuera). */
    if (ready && (was !== playerActive() || (playerActive() && previousId !== next.id)) && !mediaFormEditing) {
      var focusId = focused && focused.item.id;
      renderView(LFA_CONTROLS && view === "home" && next.status === "idle" && /^player:/.test(focusId) ? "action:media" : focusId);
    }
    else syncPlayer();
    if (focused && previousStatus !== next.status) renderHelp(focused.item.kind === "app", focused.item.kind === "media");
  }
  /* 1.11.1: youtube → app YouTube; web → Internet. Nunca entran en el recuadro. */
  function opensOutside(item) { return !!(item && HM && HM.opensExternally && HM.opensExternally(item)); }
  function openOutside(item) { if (item.kind === "youtube") openYouTubeApp(item.videoId); else openInBrowser(HM.webURL(item)); }
  function startMedia(item, keepId) {
    if (item && opensOutside(item)) { openOutside(item); return; }
    if (!player || !item) { message("El reproductor no está disponible.", true); return; }
    mediaFormEditing = false; returnStack = []; view = "home"; playerFullscreen = false;
    renderView(keepId || "media:" + item.id); player.play(item);
  }
  function isPinned(id) { return !!(id && prefs && prefs.pinnedMedia === id); }
  /* 1.11.0: al arrancar Home (visible), la fuente fijada se reproduce en el
     recuadro sin pantalla completa ni cambiar el foco. Una sola vez por
     sesión; si aún no se conoce (vídeo de RUTUBE de la lista), se espera a
     la consulta de fuentes. Si ya no existe, se ignora sin error. */
  function maybeStartPinned() {
    if (pinnedStarted || !prefsLoaded || !player || document.hidden) return;
    pinnedStarted = true;
    var id = prefs.pinnedMedia, item;
    if (!id || playerActive()) return;
    item = mediaById(id);
    if (item && opensOutside(item)) return;
    if (item) { player.play(item); return; }
    if (!LFA_CONTROLS && !mediaLoaded) { pinnedPending = id; loadMedia(false); }
  }
  function pinnedLoaded() {
    var id = pinnedPending, item; pinnedPending = null;
    if (!id || playerActive() || !prefs || prefs.pinnedMedia !== id || document.hidden) return;
    item = mediaById(id); if (item && !opensOutside(item)) player.play(item);
  }
  function togglePin(item, keepId) {
    if (!item || opensOutside(item)) return;
    var was = isPinned(item.id);
    saveChange(P.setPinnedMedia(prefs, was ? null : item.id), was ? "Fijación quitada. Home ya no reproducirá esta fuente al abrirse." : "Fijada en el recuadro: se reproducirá al abrir Home.", keepId);
    if (!was && player && !playerActive()) player.play(item);
  }
  /* App YouTube nativa, como Volley (app/main.js launchYouTube). */
  function openYouTubeApp(videoId) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) { message("El enlace del vídeo no es válido.", true); return; }
    cancelShortcutReclaim();
    if (HP) { busy(true); HP.launchYouTube(videoId, function (error) { if (error) actionFailed("YouTube", error); else finishAction(); }); return; }
    externalLaunches.push({ app: "youtube", videoId: videoId, at: Date.now() }); if (externalLaunches.length > 20) externalLaunches.shift();
    try {
      var data = [new tizen.ApplicationControlData("PAYLOAD", ["v=" + videoId])];
      var control = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/default", null, null, null, data);
      message("Abriendo el vídeo en YouTube…");
      tizen.application.launchAppControl(control, "9Ur5IzDKqV.TizenYouTube", function () {}, function (error) { recordError("youtube", error && (error.message || error.name)); message("No se pudo abrir YouTube.", true); });
    } catch (error) { recordError("youtube", error); message("No se pudo abrir YouTube.", true); }
  }
  /* Navegador del proyector (org.tizen.browser), como Volley (openExternal). */
  function openInBrowser(url) {
    cancelShortcutReclaim();
    if (HP) { busy(true); HP.openBrowser(url, function (error) { if (error) actionFailed("Internet", error); else finishAction(); }); return; }
    var safe = HM && HM.webURL ? HM.webURL({ kind: "web", url: url }) : "";
    if (!safe) { message("El enlace no es válido.", true); return; }
    externalLaunches.push({ app: "browser", url: safe, at: Date.now() }); if (externalLaunches.length > 20) externalLaunches.shift();
    try {
      var control = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/view", safe);
      message("Abriendo en Internet…");
      tizen.application.launchAppControl(control, "org.tizen.browser", function () {}, function (error) { recordError("browser", error && (error.message || error.name)); message("No se pudo abrir Internet.", true); });
    } catch (error) { recordError("browser", error); message("No se pudo abrir Internet.", true); }
  }
  /* Acciones externas de una fuente: web/youtube/trt → Internet; youtube → app. */
  function externalActions(item, prefix) {
    var out = [], url = item && HM && HM.webURL ? HM.webURL(item) : "";
    if (!item) return out;
    if (url && (HM.isFrameKind(item.kind) || item.kind === "trt" || item.sourcePage)) out.push(makeAction(prefix + ":browser", "Abrir en Internet", url, function () { openInBrowser(url); }));
    if (item.kind === "youtube") out.push(makeAction(prefix + ":youtube", "Abrir en YouTube", HP ? "App YouTube de la televisión" : "App YouTube del proyector", function () { openYouTubeApp(item.videoId); }));
    return out;
  }
  function loadVolley(force) {
    if (!HM || !HM.loadVolley || volleyLoading || volleyLoaded && !force) return;
    var generation = ++volleyGeneration; volleyLoading = true; volleyError = "";
    if (volleyCancel) volleyCancel();
    volleyCancel = HM.loadVolley(function (error, value) {
      if (generation !== volleyGeneration || disposed) return;
      volleyLoading = false; volleyLoaded = true; volleyCancel = null;
      volleyVideos = value && Array.isArray(value.videos) ? value.videos : [];
      volleyError = error ? String(error.message || error) : "";
      if (error) recordError("volley", error);
      if (view === "media") renderView(focused && focused.item.id);
    }, { force: !!force });
  }
  function loadMedia(force) {
    loadVolley(force);
    if (!HM || mediaLoading || mediaLoaded && !force) return;
    var generation = ++mediaGeneration; mediaLoading = true; mediaError = "";
    if (mediaCancel) mediaCancel();
    mediaCancel = HM.load(function (error, items) {
      if (generation !== mediaGeneration || disposed) return;
      mediaLoading = false; mediaLoaded = true; mediaCancel = null;
      if (Array.isArray(items)) mediaItems = items;
      mediaError = error ? String(error.message || error) : "";
      if (pinnedPending) pinnedLoaded();
      if (view === "media" || view === "media-manage") renderView(focused && focused.item.id);
    }, { force: !!force });
  }
  function openMedia() { mediaChip = "all"; openView("media"); if (!LFA_CONTROLS) loadMedia(false); }
  function mediaAction() { return makeAction("action:media", "Vídeos y canales", "Ver señales en el recuadro", openMedia); }
  function quickPlayTarget() {
    var pinned = prefs && prefs.pinnedMedia && mediaById(prefs.pinnedMedia);
    if (pinned && !opensOutside(pinned)) return pinned;
    var last = prefs && prefs.lastMedia && mediaById(prefs.lastMedia);
    if (last && !opensOutside(last)) return last;
    var favs = prefs && Array.isArray(prefs.favoriteMedia) ? prefs.favoriteMedia : [], i, fav;
    for (i = 0; i < favs.length; i++) { fav = mediaById(favs[i]); if (fav && !opensOutside(fav)) return fav; }
    var flagship = mediaByTitlePrefix("La 1") || mediaByTitlePrefix("RTVE 24");
    if (flagship && !opensOutside(flagship)) return flagship;
    var list = allMedia();
    for (i = 0; i < list.length; i++) if (!opensOutside(list[i])) return list[i];
    return null;
  }
  function mediaByTitlePrefix(prefix) {
    var list = allMedia(), i;
    for (i = 0; i < list.length; i++) if (list[i].title.indexOf(prefix) === 0) return list[i];
    return null;
  }
  function stepChannel(delta) {
    var list = allMedia().filter(function (entry) { return !opensOutside(entry); });
    if (!list.length || !player) return false;
    var index = -1, i;
    for (i = 0; i < list.length; i++) if (list[i].id === playerState.id) { index = i; break; }
    var next = list[index < 0 ? 0 : (index + delta + list.length) % list.length];
    var keepFullscreen = playerFullscreen;
    player.play(next);
    if (keepFullscreen) { playerFullscreen = true; syncPlayer(); }
    message((delta < 0 ? (HP ? "|◀ " : "⏮ ") : (HP ? "▶| " : "⏭ ")) + next.title + (next.source ? " · " + next.source : ""));
    return true;
  }
  function buildPlayerControls() {
    var holder = $("player-controls"), show = view === "home" || view === "home-menu";
    var items = LFA_CONTROLS ? [mediaAction()] : [], elements = [], current, quick, sport, space, i, el;
    holder.textContent = ""; holder.className = show && (LFA_CONTROLS || playerActive()) ? "" : "hidden";
    if (!show || (!LFA_CONTROLS && !playerActive())) return;
    if (playerActive()) {
      if (LFA_CONTROLS) items.push(makeAction("player:prev", (HP ? "|◀" : "⏮") + " Ant.", "Cambiar al canal anterior", function () { stepChannel(-1); }));
      items.push(makeAction("player:toggle", playerLabel(), "Pausar o continuar el contenido actual", function () { player.toggle(); }));
      if (LFA_CONTROLS) items.push(makeAction("player:next", (HP ? "▶|" : "⏭") + " Sig.", "Cambiar al canal siguiente", function () { stepChannel(1); }));
      items.push(makeAction("player:fullscreen", "Pantalla completa", "Ampliar sin cambiar el contenido", function () { playerFullscreen = true; syncPlayer(); }));
      current = mediaById(playerState.id);
      if (current) items.push(makeAction("player:pin", isPinned(current.id) ? "Quitar fijación" : (LFA_CONTROLS ? "Fijar" : "Fijar en el recuadro"), "Reproducir esta fuente al abrir Home", function () { togglePin(mediaById(playerState.id), "player:pin"); }));
      if (!LFA_CONTROLS) items = items.concat(externalActions(current, "player"));
      items.push(makeAction("player:stop", "Detener", "Cerrar el reproductor integrado", function () { player.stop(); }));
    } else if (LFA_CONTROLS) {
      quick = quickPlayTarget();
      if (quick) items.push(makeAction("player:quick", "▶ Directo: " + quick.title.split(" · ")[0], "Reproducir " + quick.title + " en el recuadro", function () { var t = quickPlayTarget(); if (t) startMedia(t, "player:toggle"); }));
      sport = mediaByTitlePrefix("Teledeporte");
      if (sport && quick && sport.id === quick.id) sport = mediaByTitlePrefix("Red Bull TV");
      if (sport && (!quick || sport.id !== quick.id)) items.push(makeAction("player:sport", "⚡ " + sport.title.split(" · ")[0], "Deporte en directo HD", function () { startMedia(sport, "player:toggle"); }));
      space = mediaByTitlePrefix("NASA TV");
      if (space && (!quick || space.id !== quick.id)) items.push(makeAction("player:space", "⚡ NASA TV HD", "Espacio en directo HD", function () { startMedia(space, "player:toggle"); }));
      items.push(makeAction("action:library-bar", "Todas las apps", "Buscar y abrir cualquier aplicación", openLibrary));
    }
    for (i = 0; i < items.length; i++) {
      el = actionButton(items[i], "player-button");
      holder.appendChild(el); elements.push(el);
    }
    addNavigationRow("player-controls", "Reproductor", elements, holder);
  }
  function mediaTile(item) {
    var action = makeAction("media:" + item.id, item.title, mediaDetail(item), function () { startMedia(item); });
    action.kind = "media"; action.media = item;
    var el = makeSpecialTile(action, "play"); el.setAttribute("data-media-id", item.id);
    return el;
  }
  /* Indica dónde se abre cada fuente y si está fijada o en favoritos. */
  function isFavMedia(id) { return !!(id && prefs && P.isFavoriteMedia && P.isFavoriteMedia(prefs, id)); }
  function mediaDetail(item) {
    var fav = isFavMedia(item.id) ? "★ Favorito · " : "";
    if (opensOutside(item)) return fav + (item.kind === "youtube" ? "YouTube · OK abre YouTube" : (item.group === "news" ? item.source + " · Web oficial" : "Web · OK abre Internet"));
    if (LFA_CONTROLS || item.group === "news" || item.group === "tvplus") return fav + (item.source || (item.live ? "Directo" : "Vídeo HD")) + " · En el recuadro" + (isPinned(item.id) ? " · Fijada" : "");
    return fav + (item.source || (item.live ? "Señal en directo" : "Vídeo")) + (item.experimental ? " · Experimental: web" : "") + (isPinned(item.id) ? " · Fijada en el recuadro" : "");
  }
  function mediaSection(title, note) {
    var el = document.createElement("div"); el.className = "media-section"; el.setAttribute("role", "heading"); el.textContent = title;
    if (note) { var small = document.createElement("span"); small.className = "media-section-note"; small.textContent = note; el.appendChild(small); }
    $("panel-list").appendChild(el);
  }
  function mediaNote(text, id) { var el = document.createElement("div"); el.className = "media-note"; el.textContent = text; if (id) el.id = id; $("panel-list").appendChild(el); }
  function mediaOption(entry) {
    var item = makeAction("media:" + entry.id, entry.title, mediaDetail(entry), playMediaAction(entry)); item.kind = "media"; item.media = entry; listOption(item);
  }
  var VOLLEY_STATUS = { live: "● En directo", upcoming: "Próximo", recent: "Reciente" };
  function volleyDetail(video) {
    var when = video.start ? new Date(video.start) : null, label = VOLLEY_STATUS[video.status] || "Reciente";
    if (when && video.status === "upcoming") label += " · " + when.getDate() + " " + ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][when.getMonth()] + " " + when.getHours() + ":" + (when.getMinutes() < 10 ? "0" : "") + when.getMinutes();
    return label + " · " + video.source + " · OK abre YouTube";
  }
  function buildMedia() {
    if (LFA_CONTROLS) { buildDirectMedia(); return; }
    var add = makeAction("media:add", "Añadir enlace", "Guardar una señal HLS, un MP4, un vídeo de RUTUBE o YouTube, o una página web", function () { openView("media-add"); });
    var reload = makeAction("media:refresh", "Actualizar", "Consultar las fuentes", function () { loadMedia(true); renderView("media:refresh"); });
    panelHeader("Vídeos y canales", mediaLoading ? "Consultando vídeos adicionales…" : mediaError ? "Las fuentes fijas y tus enlaces guardados están disponibles." : "Elige una señal para el recuadro o abre la app o página oficial del canal.", [add, reload]);
    var list = allMedia(), general = [], news = [], newsWeb = [], tvPlusStreams = [], volley = [], i, item, video;
    var tvPlus = !HP && appById("HEPsqFNie0.tvplusstandalone");
    for (i = 0; i < list.length; i++) {
      item = list[i];
      if (item.group === "news") (opensOutside(item) ? newsWeb : news).push(item);
      else if (item.group === "tvplus") tvPlusStreams.push(item);
      else (item.group === "volley" ? volley : general).push(item);
    }
    if (!list.length) { $("panel-empty").textContent = mediaLoading ? "Cargando vídeos y canales…" : "Añade un enlace compatible para reproducirlo dentro de Home."; $("panel-empty").className = ""; }
    if (tvPlusStreams.length || tvPlus) {
      mediaSection("También en Samsung TV Plus", "Señales oficiales de las emisoras");
      for (i = 0; i < tvPlusStreams.length; i++) mediaOption(tvPlusStreams[i]);
      if (tvPlus) listOption(makeAction("media:tv-plus", "Abrir Samsung TV Plus", "Dentro de la app, pulsa el centro de CH para ver la guía", function () { launchApp(tvPlus); }));
    }
    if (news.length) {
      mediaSection("Noticias en el recuadro");
      for (i = 0; i < news.length; i++) mediaOption(news[i]);
    }
    if (newsWeb.length) {
      mediaSection("Páginas oficiales de noticias");
      for (i = 0; i < newsWeb.length; i++) mediaOption(newsWeb[i]);
    }
    if (general.length) {
      mediaSection("Vídeos y enlaces", "Fuentes adicionales y guardadas");
      for (i = 0; i < general.length; i++) mediaOption(general[i]);
    }
    /* 1.11.0: sección Volley. Rusia (RUTUBE) y Turquía (TRT) se ven en el
       recuadro; los partidos de Sultanlar Ligi se abren en la app YouTube. */
    mediaSection("Volley", "Rusia y Turquía");
    for (i = 0; i < volley.length; i++) mediaOption(volley[i]);
    mediaSection("Volley Turquía · Sultanlar Ligi", "Partidos y vídeos publicados en YouTube");
    if (volleyLoading && !volleyVideos.length) mediaNote("Consultando Sultanlar Ligi…", "volley-status");
    else if (volleyError && !volleyVideos.length) mediaNote("Sultanlar Ligi: sin conexión. Pulsa Actualizar para reintentar.", "volley-status");
    else if (!volleyVideos.length) mediaNote("No hay partidos ni vídeos de Sultanlar Ligi publicados ahora.", "volley-status");
    for (i = 0; i < volleyVideos.length; i++) {
      video = volleyVideos[i];
      item = makeAction(video.id, video.title, volleyDetail(video), (function (id) { return function () { openYouTubeApp(id); }; })(video.videoId));
      item.kind = "volley-video"; item.video = video; listOption(item);
    }
    if (savedMedia().length) listOption(makeAction("media:manage", "Gestionar enlaces guardados", "Eliminar los enlaces que ya no uses", function () { openView("media-manage"); }));
  }
  function openMediaManage() { openView("media-manage"); }
  function mediaMatchesChip(item, chip) {
    if (!chip || chip === "all") return true;
    if (chip === "favorites") return isFavMedia(item.id);
    if (chip === "featured") return item.group === "featured";
    if (chip === "cinema") return item.group === "cinema";
    if (chip === "english") return item.language === "en" || item.group === "english" || item.group === "news" && item.language !== "es" || item.group === "tvplus";
    if (chip === "es") return item.language === "es" || item.group === "international" || item.group === "dominicana" || item.group === "latam";
    return true;
  }
  function buildDirectMedia() {
    var list = allMedia(), groups = [
      { id: "featured", title: "Destacados HD · Deporte, Ciencia y Cultura", note: "Señales directas verificadas" },
      { id: "international", title: "Internacionales en español" },
      { id: "dominicana", title: "República Dominicana" },
      { id: "latam", title: "Latinoamérica" },
      { id: "english", title: "En inglés" },
      { id: "news", title: "Noticias" },
      { id: "tvplus", title: "También en Samsung TV Plus", note: "Señales de las emisoras" },
      { id: "cinema", title: "Cine abierto y cortos 1080p", note: "Bajo demanda en el recuadro" },
      { id: "", title: "Mis señales" }
    ], grouped = {}, chips = [
      { id: "all", label: "Todos" },
      { id: "favorites", label: "★ Favoritos" },
      { id: "featured", label: "Destacados HD" },
      { id: "es", label: "En español" },
      { id: "english", label: "En inglés" },
      { id: "cinema", label: "Cine HD" }
    ], chipHolder, chipEls = [], filtered;
    panelHeader("Vídeos y canales", "OK reproduce en el recuadro · Mantén OK para fijar o añadir a favoritos.", [
      makeAction("media:manage", "Gestionar señales", "Añadir, editar o quitar canales", openMediaManage)
    ]);
    if (list.length) {
      chipHolder = document.createElement("div"); chipHolder.className = "library-chips media-chips";
      chips.forEach(function (chip) {
        var count = list.filter(function (entry) { return mediaMatchesChip(entry, chip.id); }).length;
        if (chip.id !== "all" && chip.id !== "favorites" && !count) return;
        var btn = actionButton(makeAction("media-chip:" + chip.id, chip.label, count + " señales · OK filtra", function () {
          mediaChip = chip.id; renderView("media-chip:" + chip.id);
        }), "chip" + (mediaChip === chip.id ? " active" : ""));
        btn.item.kind = "filter"; btn.textContent = "";
        var lbl = document.createElement("span"), cnt = document.createElement("span");
        lbl.textContent = chip.label; cnt.className = "chip-count"; cnt.textContent = String(count);
        btn.appendChild(lbl); btn.appendChild(cnt); chipHolder.appendChild(btn); chipEls.push(btn);
      });
      $("panel-list").appendChild(chipHolder);
      addNavigationRow("media-chips", "Categorías de canales", chipEls, chipHolder);
    }
    var last = prefs.lastMedia && mediaById(prefs.lastMedia);
    if (mediaChip === "all" && last && playerState.id !== last.id) {
      listOption(makeAction("media:last", "Volver a " + last.title, last.source, function () {
        startMedia(last, "action:media");
      }));
    }
    filtered = list.filter(function (entry) { return mediaMatchesChip(entry, mediaChip); });
    groups.forEach(function (group) { grouped[group.id] = []; });
    filtered.forEach(function (item) {
      var id = item.group === "news" && item.language === "es" ? "international" : item.group;
      (grouped[id] || grouped[""]).push(item);
    });
    groups.forEach(function (group) {
      var items = grouped[group.id];
      if (!items.length) return;
      mediaSection(group.title, group.note);
      items.forEach(mediaOption);
    });
    if (!list.length) mediaNote("Añade una señal desde Gestionar señales.");
    else if (!filtered.length && mediaChip === "favorites") mediaNote("Aún no tienes canales favoritos. Mantén OK sobre cualquier canal para marcarlo con ★.");
  }
  /* Opciones de una fuente (mantener OK o Play/Pausa sobre su tarjeta). */
  function showMediaOptions(item, focusId) { if (!item) return; contextMediaId = item.id; openView("media-options", focusId || "media-option:play"); }
  function buildMediaOptions() {
    var item = mediaById(contextMediaId), entry, saved, extras, i;
    if (!item) { panelHeader("Fuente no disponible", "Esta fuente ya no aparece en Vídeos y canales."); return; }
    panelHeader(item.title, mediaDetail(item));
    if (opensOutside(item)) {
      /* 1.11.1: sin reproducir en el recuadro ni fijar. */
      extras = externalActions(item, "media-option");
      if (item.kind === "youtube") extras.reverse();
      for (i = 0; i < extras.length; i++) listOption(extras[i]);
    } else {
      entry = makeAction("media-option:play", playerState.id === item.id && playerActive() ? "Reproduciendo en el recuadro" : "Reproducir en el recuadro", "Cambia el contenido del recuadro ahora", function () { var selected = mediaById(contextMediaId); if (selected) startMedia(selected); }); listOption(entry);
      if (P.toggleFavoriteMedia) {
        entry = makeAction("media-option:favorite", isFavMedia(item.id) ? "Quitar de canales favoritos" : "Añadir a canales favoritos ★", isFavMedia(item.id) ? "Sale del filtro Favoritos" : "Acceso rápido desde ★ Favoritos", function () {
          var target = mediaById(contextMediaId); if (!target) return;
          var was = isFavMedia(target.id);
          saveChange(P.toggleFavoriteMedia(prefs, target.id), was ? "Canal quitado de favoritos." : "Canal añadido a ★ Favoritos.", "media-option:favorite");
        }); listOption(entry);
      }
      entry = makeAction("media-option:pin", isPinned(item.id) ? "Quitar fijación" : "Fijar en el recuadro", isPinned(item.id) ? "Home dejará de reproducirla al abrirse" : "Se reproducirá en el recuadro al abrir Home", function () { togglePin(mediaById(contextMediaId), "media-option:pin"); }); listOption(entry);
      if (!LFA_CONTROLS) {
        extras = externalActions(item, "media-option");
        for (i = 0; i < extras.length; i++) listOption(extras[i]);
      }
    }
    if (LFA_CONTROLS) {
      listOption(makeAction("media-option:edit", "Editar señal", "Cambiar el nombre o enlace", function () { openMediaForm(item); }));
      listOption(makeAction("media-option:remove", "Quitar señal", "Retirar de Vídeos y canales", function () {
        var saved = persist(P.removeMediaSource(prefs, item.id, isBuiltinMedia(item.id)));
        if (playerState.id === item.id) player.stop();
        back(); message(saved ? "Señal quitada." : "Señal quitada durante esta sesión. No se pudo guardar el cambio.", !saved);
      }));
      return;
    }
    saved = savedMedia().some(function (candidate) { return candidate.id === item.id; });
    if (saved) listOption(makeAction("media-option:remove", "Eliminar enlace guardado", "También quita su fijación", function () { var id = contextMediaId; persist(P.removeMediaSource(prefs, id)); back(); message("Enlace eliminado."); }));
  }
  function playMediaAction(item) { return function () { startMedia(item); }; }
  function buildMediaManage() {
    if (LFA_CONTROLS) {
      var signals = allMedia();
      panelHeader("Gestionar vídeos y canales", "Elige una señal para editarla o quitarla.", [
        makeAction("media:add", "Añadir señal", "Guardar un enlace directo HLS o MP4", function () { openMediaForm(null); })
      ]);
      signals.forEach(function (item) {
        listOption(makeAction("media:edit:" + item.id, item.title, item.kind.toUpperCase(), function () { showMediaOptions(item, "media-option:edit"); }));
      });
      if (!signals.length) mediaNote("Todavía no hay señales guardadas.");
      return;
    }
    panelHeader("Enlaces guardados", "OK elimina el enlace de Home. No cambia la reproducción actual.");
    var list = savedMedia(), i;
    for (i = 0; i < list.length; i++) (function (item) { listOption(makeAction("media:remove:" + item.id, item.title, "Eliminar enlace guardado", function () { saveChange(P.removeMediaSource(prefs, item.id), "Enlace eliminado."); })); })(list[i]);
    if (!list.length) { $("panel-empty").textContent = "No hay enlaces guardados."; $("panel-empty").className = ""; }
  }
  function openMediaForm(item) {
    editingMediaId = item ? item.id : null;
    openView("media-add", "field:media-title");
  }
  function buildMediaAdd() {
    var previous = LFA_CONTROLS && editingMediaId ? mediaById(editingMediaId) : null;
    panelHeader(previous ? "Editar señal" : "Añadir vídeo o canal", LFA_CONTROLS ? "Usa un enlace HTTPS directo a una señal HLS (.m3u8) o un vídeo MP4." : HM && HM.WEB_FRAME_ENABLED ? "Pega un enlace HTTPS: HLS (.m3u8), MP4, RUTUBE, YouTube o una página web (experimental: algunas no se dejan mostrar en el recuadro)." : "Pega un enlace HTTPS: HLS (.m3u8), MP4 o RUTUBE se ven en el recuadro; YouTube se abre en la app YouTube y otras páginas, en Internet.");
    var form = document.createElement("div"), title = document.createElement("input"), url = document.createElement("input"), label, fields = [["Nombre", title, "media-title", "Nombre del canal o vídeo"], ["Enlace", url, "media-url", "https://…"]], i;
    form.className = "media-form";
    if (previous) { title.value = previous.title; url.value = previous.url; }
    for (i = 0; i < fields.length; i++) {
      label = document.createElement("label"); label.htmlFor = fields[i][2]; label.textContent = fields[i][0]; form.appendChild(label);
      fields[i][1].id = fields[i][2]; fields[i][1].placeholder = fields[i][3]; fields[i][1].type = "text"; fields[i][1].maxLength = i ? 8192 : 120; fields[i][1].tabIndex = -1;
      fields[i][1].item = makeAction("field:" + fields[i][2], fields[i][0], "Pulsa OK para escribir", editMediaInput(fields[i][1])); form.appendChild(fields[i][1]);
      addNavigationRow("field:" + fields[i][2], fields[i][0], [fields[i][1]], fields[i][1], "vertical");
      fields[i][1].addEventListener("focus", function () { mediaFormEditing = true; });
      fields[i][1].addEventListener("blur", function () { mediaFormEditing = false; });
    }
    $("panel-list").appendChild(form);
    listOption(makeAction("media:save", "Guardar enlace", LFA_CONTROLS ? "Disponible en Vídeos y canales" : "Se añadirá a la barra y a Vídeos y canales", function () {
      try {
        if (!HM || !P.addMediaSource) throw new Error("No se pudo cargar el gestor de enlaces.");
        var item = HM.parseLink(url.value, title.value), saved, oldId, stored;
        if (LFA_CONTROLS) {
          if (!directMedia(item)) throw new Error("Usa un enlace directo HTTPS a un archivo .m3u8 o .mp4.");
          oldId = previous && previous.id;
          if (item.id !== oldId && mediaById(item.id)) throw new Error("Esta señal ya está en Vídeos y canales.");
          stored = prefs.mediaSources.some(function (entry) { return entry.id === oldId || entry.id === item.id; });
          if (!stored && prefs.mediaSources.length >= 25) throw new Error("Quita un enlace guardado antes de añadir otro. El límite es de 25 enlaces.");
          if (previous && item.id === oldId) {
            item = clone(previous);
            item.title = title.value.trim() || previous.title;
          }
          saved = persist(P.replaceMediaSource(prefs, item, oldId, isBuiltinMedia(oldId)));
          if (oldId) {
            contextMediaId = item.id;
            if (playerState.id === oldId && item.id !== oldId) player.stop();
          }
        } else saved = persist(P.addMediaSource(prefs, item));
        mediaFormEditing = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        back(); message(saved ? "Enlace guardado. Pulsa OK para reproducirlo." : "El enlace se añadió ahora, pero no se pudo guardar al cerrar Home.", !saved);
      } catch (error) { message(error.message || "El enlace no es compatible.", true); }
    }));
  }
  function editMediaInput(input) { return function () { input.focus(); mediaFormEditing = true; }; }

  function recordError(area, error) {
    var text = error && error.message ? error.message : String(error || "Error desconocido");
    errors.push({ area: area, message: text.slice(0, 220), at: new Date().toISOString() });
    if (errors.length > 15) errors.shift();
  }
  function message(text, isError) {
    messageSerial++; clearTimeout(messageTimer);
    $("msg").textContent = text || "";
    $("msg").className = text ? (isError ? "visible error" : "visible") : "";
    if (text) messageTimer = setTimeout(function () { $("msg").className = ""; }, isError ? 8000 : 4000);
  }
  function busy(value) {
    actionBusy = value; clearTimeout(actionTimer);
    if (value) actionTimer = setTimeout(function () { actionBusy = false; }, 3500);
  }
  function finishAction() { busy(false); }
  function actionFailed(label, error) {
    finishAction(); recordError(label, error);
    message("No se pudo abrir " + label + ". Prueba de nuevo desde Apps de " + (HP ? "LG" : "Samsung") + ".", true);
  }
  function cancelShortcutReclaim() {
    shortcutWatch.reclaimUntil = 0;
    shortcutWatch.reclaimLabel = "";
    if (reclaimTimer !== null) { clearInterval(reclaimTimer); reclaimTimer = null; }
    if (shortcutWatch.confirmTimer !== null) { clearTimeout(shortcutWatch.confirmTimer); shortcutWatch.confirmTimer = null; }
  }
  function ignoreShortcutForLaunch(appId) {
    if (!appId) return;
    var until = Date.now() + 18000;
    shortcutWatch.ignoreUntil[appId] = until;
    if (appId === "HEPsqFNie0.tvplusstandalone") {
      shortcutWatch.ignoreUntil["com.samsung.tv.tvPlusDeeplinker"] = until;
      shortcutWatch.ignoreUntil["com.samsung.tv.tvplus"] = until;
      shortcutWatch.ignoreUntil["com.samsung.tv.hotkey-service"] = until;
    }
    if (appId === "MCmYXNxgcu.DisneyPlus") {
      shortcutWatch.ignoreUntil["MCmYXNxgcu.DisneyPlusService"] = until;
      shortcutWatch.ignoreUntil["com.samsung.tv.hotkey-service"] = until;
    }
  }
  function reclaimHomeNow(force) {
    if (HP || disposed || shortcutWatch.reclaimUntil <= Date.now() || !document.hidden) return;
    var now = Date.now();
    if (!force && now - shortcutWatch.lastReclaimCallAt < 250) return;
    shortcutWatch.lastReclaimCallAt = now;
    try {
      tizen.application.launch(selfId(), function () {
        if (!document.hidden && shortcutWatch.reclaimLabel) {
          if (view !== "home") { reorder = null; returnStack = []; view = "home"; playerFullscreen = false; renderView(lastHomeAppId); }
          message("LFA Home abierto con " + shortcutWatch.reclaimLabel);
        }
      }, function () {});
    } catch (ignored) {}
  }
  function bringHomeToFront(label) {
    if (HP || disposed) return;
    shortcutWatch.reclaimUntil = Date.now() + SHORTCUT_RECLAIM_MS;
    shortcutWatch.reclaimLabel = label || "Mando";
    shortcutWatch.lastReclaimCallAt = 0;
    reclaimHomeNow(true);
    if (reclaimTimer !== null) clearInterval(reclaimTimer);
    reclaimTimer = setInterval(function () {
      if (disposed || Date.now() >= shortcutWatch.reclaimUntil) {
        clearInterval(reclaimTimer); reclaimTimer = null;
        return;
      }
      if (document.hidden) reclaimHomeNow(false);
    }, 280);
  }
  function fireShortcutDecision(decision, now) {
    shortcutWatch.cooldownUntil = now + 2200;
    shortcutWatch.triggers++; shortcutWatch.lastTriggeredId = decision.appId; shortcutWatch.lastTriggeredAt = now;
    logReturn({ id: decision.appId, name: decision.label }, { type: "shortcut", at: now });
    bringHomeToFront(decision.label);
  }
  function pollSamsungShortcut() {
    if (HP || disposed || !document.hidden || !prefsLoaded || !prefs || prefs.samsungHomeButton === "off" || !M.detectSamsungShortcut || shortcutWatch.polling) return;
    shortcutWatch.polling = true;
    runningIds(function (list) {
      shortcutWatch.polling = false;
      if (disposed || !document.hidden || !Array.isArray(list)) return;
      var now = Date.now(), prev = shortcutWatch.prevIds;
      var decision = M.detectSamsungShortcut({
        mode: prefs.samsungHomeButton, hidden: !!document.hidden, runningIds: list, prevIds: prev,
        ignoreUntil: shortcutWatch.ignoreUntil, cooldownUntil: shortcutWatch.cooldownUntil, now: now
      });
      shortcutWatch.prevIds = list;
      if (decision && decision.confirm) {
        var baseline = Array.isArray(prev) ? prev.slice() : [];
        if (shortcutWatch.confirmTimer !== null) clearTimeout(shortcutWatch.confirmTimer);
        shortcutWatch.confirmTimer = setTimeout(function () {
          shortcutWatch.confirmTimer = null;
          if (disposed || !document.hidden || !prefs || prefs.samsungHomeButton === "off") return;
          runningIds(function (after) {
            if (disposed || !document.hidden || !Array.isArray(after)) return;
            shortcutWatch.prevIds = after;
            var otherStarted = ["org.tizen.netflix-app", "org.tizen.primevideo", "HEPsqFNie0.tvplusstandalone", "com.samsung.tv.tvPlusDeeplinker"].some(function (id) {
              return after.indexOf(id) >= 0 && baseline.indexOf(id) < 0;
            });
            if (!otherStarted) fireShortcutDecision(decision, Date.now());
          }, 1200);
        }, 220);
      } else if (decision) {
        fireShortcutDecision(decision, now);
      }
    }, 1500);
  }
  function syncShortcutWatcher() {
    if (shortcutTimer !== null) { clearInterval(shortcutTimer); shortcutTimer = null; }
    if (!document.hidden && !HP) {
      runningIds(function (list) { if (Array.isArray(list)) shortcutWatch.prevIds = list; }, 1500);
      return;
    }
    if (HP || disposed || !document.hidden || !prefsLoaded || !prefs || prefs.samsungHomeButton === "off") return;
    shortcutTimer = setInterval(pollSamsungShortcut, SHORTCUT_POLL_MS);
    pollSamsungShortcut();
  }
  function launchApp(app) {
    if (actionBusy || launchPending) return;
    cancelShortcutReclaim();
    busy(true); launchPending = true; message("Abriendo " + app.name + "…");
    if (HP) {
      HP.launch(app.id, function (error) { launchPending = false; if (error) actionFailed(app.name, error); else { finishAction(); recordLaunch(app); } });
      return;
    }
    ignoreShortcutForLaunch(app.id);
    var askedAt = Date.now();
    /* Antes de abrir se anotan las apps en ejecución: al cerrarse la app se
       comparan para no robar el primer plano a otra abierta mientras tanto.
       Justo después de un retorno automático getAppsContext tarda hasta 1,4 s
       (medido en 1.7.4): se espera hasta 4 s y, si aun así falla, se vigila
       igualmente sin instantánea (ver HomeModel.returnWatchStep). */
    runningIds(function (contexts) {
      if (Array.isArray(contexts)) shortcutWatch.prevIds = contexts.slice();
      var snapshotMs = Date.now() - askedAt, launch = null;
      busy(true); launchPending = false;
      try {
        if (!window.tizen || !tizen.application || typeof tizen.application.launch !== "function") throw new Error("API de aplicaciones no disponible");
        /* La vigilancia empieza al pedir la apertura, no en el callback de
           éxito: en el proyector ese callback llega 2,5–4 s después (cuando
           la app ya cargó) y no debe ser imprescindible para volver. */
        launch = trackLaunch(app, contexts, snapshotMs);
        tizen.application.launch(app.id, function () {
          launch.launchOkAt = Date.now(); clearTimeout(actionTimer); actionTimer = setTimeout(finishAction, 800);
          recordLaunch(app);
        }, function (error) { launchFailed(launch); actionFailed(app.name, error); });
      } catch (error) { launchFailed(launch); actionFailed(app.name, error); }
    });
  }
  /* Retorno a Home (1.7.3, revisado en 1.7.4). En este firmware
     addAppStatusChangeListener no entrega eventos; con background-support=
     "enable" Home sigue ejecutándose oculta y consulta getAppsContext cada
     segundo hasta que la app lanzada desaparece (dos sondeos seguidos y al
     menos 2 s después de verla). Después se relanza a sí misma: con el
     app-control reload="disable" de config.xml vuelve sin recargar la página.
     Si en 3 s no llega a visible, lo reintenta una vez. Cada apertura,
     decisión, retorno o fallo queda en el registro de retorno. */
  var RETURN_POLL_MS = 1000, RETURN_CONFIRM_MS = 450, RETURN_VISIBLE_MS = 3000, SNAPSHOT_TIMEOUT_MS = 4000;
  var launchPending = false, returnConfirmTimer = null, returnRetryTimer = null, returnLogStore = null, runningIdsWaiters = null;
  function runningIds(done, timeoutMs) {
    if (runningIdsWaiters) { runningIdsWaiters.push(done); return; }
    var waiters = [done], finished = false, timer = null;
    runningIdsWaiters = waiters;
    function finish(list) {
      if (finished) return;
      finished = true; clearTimeout(timer); runningIdsWaiters = null;
      for (var j = 0; j < waiters.length; j++) {
        try { waiters[j](list ? list.slice() : null); } catch (ignored) {}
      }
    }
    try {
      if (!window.tizen || !tizen.application || typeof tizen.application.getAppsContext !== "function") { finish(null); return; }
      timer = setTimeout(function () { recordError("apps-context", "getAppsContext sin respuesta en " + (timeoutMs || SNAPSHOT_TIMEOUT_MS) + " ms"); finish(null); }, timeoutMs || SNAPSHOT_TIMEOUT_MS);
      tizen.application.getAppsContext(function (contexts) {
        var list = [], i;
        for (i = 0; contexts && i < contexts.length; i++) if (contexts[i] && contexts[i].appId) list.push(String(contexts[i].appId));
        finish(list);
      }, function (error) { recordError("apps-context", error); finish(null); });
    } catch (error) { recordError("apps-context", error); finish(null); }
  }
  function selfId() {
    try { return tizen.application.getCurrentApplication().appInfo.id || SELF_ID; } catch (ignored) { return SELF_ID; }
  }
  function returnLog() {
    try { if (!returnLogStore && P.createReturnLog) returnLogStore = P.createReturnLog(window); } catch (error) { recordError("return-log", error); }
    return returnLogStore;
  }
  function logReturn(launch, entry) {
    var store = returnLog();
    if (launch && entry.type !== "open" && launch.maxGapMs > 3000 && !entry.detail) entry.detail = "Home estuvo en pausa " + (launch.maxGapMs / 1000).toFixed(1).replace(".", ",") + " s";
    entry.at = entry.at || Date.now(); entry.appId = launch ? launch.id : ""; if (launch && launch.name) entry.name = launch.name;
    try { if (!store || !store.append(entry)) recordError("return-log", "No se pudo guardar el registro de retorno"); } catch (error) { recordError("return-log", error); }
  }
  function clearReturnTimers() {
    clearTimeout(returnConfirmTimer); returnConfirmTimer = null;
    clearTimeout(returnRetryTimer); returnRetryTimer = null;
  }
  function trackLaunch(app, contexts, snapshotMs) {
    stopReturnWatch(); clearReturnTimers();
    var hasSnapshot = Array.isArray(contexts);
    /* Objeto nuevo en cada apertura: nada del ciclo anterior se reutiliza. seen
       sólo se marca en un sondeo posterior con Home oculta. */
    lastLaunch = { id: app.id, name: app.name || app.id, at: Date.now(), contexts: hasSnapshot ? contexts : null, snapshot: hasSnapshot ? "ok" : "none", snapshotMs: snapshotMs,
      state: "launched", seen: false, hiddenSeen: !!document.hidden, firstSeenAt: 0, misses: 0, missingSince: 0, checkedAt: 0, polls: 0, listFailures: 0, polling: false, result: null };
    logReturn(lastLaunch, { type: "open", detail: hasSnapshot ? "" : "sin instantánea previa (" + snapshotMs + " ms)" });
    listenAppStatus();
    returnWatch = setInterval(watchReturn, RETURN_POLL_MS);
    return lastLaunch;
  }
  function launchFailed(launch) {
    if (!launch || launch !== lastLaunch) return;
    launch.result = "launch-failed"; stopReturnWatch("launch-failed"); clearReturnTimers();
    logReturn(launch, { type: "stop", reason: "launch-failed" });
  }
  function stopReturnWatch(state) {
    if (returnWatch !== null) { clearInterval(returnWatch); returnWatch = null; }
    clearTimeout(returnConfirmTimer); returnConfirmTimer = null;
    if (state && lastLaunch && lastLaunch.state !== "returned") lastLaunch.state = state;
  }
  function watchReturn() {
    var launch = lastLaunch;
    if (!launch || disposed || returnWatch === null) { stopReturnWatch(); return; }
    /* Hueco entre sondeos: en 1 de 16 ciclos del proyector los temporizadores
       de Home oculta se detuvieron 13 s; queda anotado en el registro. */
    var tickAt = Date.now(); if (launch.lastTickAt) launch.maxGapMs = Math.max(launch.maxGapMs || 0, tickAt - launch.lastTickAt); launch.lastTickAt = tickAt;
    if (!document.hidden) { applyWatchStep(launch, M.returnWatchStep(launch, { hidden: false, runningIds: null, now: Date.now() }), null); return; }
    if (launch.polling) return;
    launch.hiddenSeen = true; launch.polling = true;
    runningIds(function (list) {
      launch.polling = false;
      if (launch !== lastLaunch || returnWatch === null || disposed) return;
      launch.checkedAt = Date.now(); launch.polls++;
      if (!list) launch.listFailures++;
      applyWatchStep(launch, M.returnWatchStep(launch, { hidden: !!document.hidden, runningIds: list, now: Date.now() }), list);
    });
  }
  function applyWatchStep(launch, step, list) {
    if (step.reason === "running") launch.state = "running";
    if (step.action === "stop") {
      stopReturnWatch(step.reason);
      logReturn(launch, { type: "stop", reason: step.reason });
    } else if (step.action === "confirm") {
      clearTimeout(returnConfirmTimer); returnConfirmTimer = setTimeout(watchReturn, RETURN_CONFIRM_MS);
    } else if (step.action === "decide") decideReturn(launch.id, list);
  }
  function decideReturn(terminatedId, list) {
    var launch = lastLaunch, appIds = [], i;
    if (!launch || returnWatch === null) return;
    for (i = 0; i < apps.length; i++) appIds.push(apps[i].id);
    launch.terminatedAt = launch.missingSince || Date.now(); launch.decidedAt = Date.now();
    if (!M.shouldReturnHome({ terminatedId: terminatedId, lastLaunch: launch, runningIds: list, returnHome: !!(prefs && prefs.returnHome !== false),
      hidden: !!document.hidden, appIds: appIds, selfId: selfId() })) {
      launch.result = prefs && prefs.returnHome === false ? "disabled" : "other-app"; stopReturnWatch("closed");
      logReturn(launch, { type: "no-return", reason: launch.result });
      return;
    }
    launch.result = "returning"; launch.returnAttempts = 0; stopReturnWatch("returning");
    returnToHome(launch);
  }
  function returnToHome(launch) {
    launch.returnAttempts++;
    clearTimeout(returnRetryTimer);
    returnRetryTimer = setTimeout(function () {
      if (launch !== lastLaunch || launch.result !== "returning") return;
      if (!document.hidden) { homeVisibleAgain(); return; }
      if (launch.returnAttempts < 2) returnToHome(launch); else returnFailed(launch, "no-visible", launch.lastReturnError || "");
    }, RETURN_VISIBLE_MS);
    try {
      tizen.application.launch(selfId(), function () { if (launch.result === "returning") launch.launchConfirmedAt = Date.now(); },
        function (error) { returnAttemptFailed(launch, error); });
    } catch (error) { returnAttemptFailed(launch, error); }
  }
  function returnAttemptFailed(launch, error) {
    recordError("return-home", error);
    launch.lastReturnError = error && error.message ? String(error.message).slice(0, 120) : String(error || "error");
    if (launch !== lastLaunch || launch.result !== "returning") return;
    if (launch.returnAttempts >= 2) { returnFailed(launch, "return-failed", launch.lastReturnError); return; }
    clearTimeout(returnRetryTimer);
    returnRetryTimer = setTimeout(function () { if (launch === lastLaunch && launch.result === "returning" && document.hidden) returnToHome(launch); }, 500);
  }
  function returnFailed(launch, reason, detail) {
    clearReturnTimers();
    launch.state = "return-failed"; launch.result = "return-failed"; launch.failReason = reason;
    logReturn(launch, { type: "fail", reason: reason, detail: detail || "" });
  }
  /* Home vuelve a primer plano (por el relanzamiento propio o por otra vía):
     se cierra el ciclo y no queda nada que bloquee la siguiente apertura. */
  function homeVisibleAgain() {
    var launch = lastLaunch;
    clearReturnTimers(); launchPending = false;
    if (!launch) return;
    launch.polling = false;
    if (launch.result === "returning" || (launch.failReason === "no-visible" && Date.now() - launch.decidedAt < 10000)) {
      launch.state = "returned"; launch.result = "returned"; launch.returnedAt = Date.now();
      logReturn(launch, { type: "return", ms: launch.returnedAt - (launch.terminatedAt || launch.decidedAt || launch.returnedAt) });
    } else if (returnWatch !== null && launch.hiddenSeen) {
      stopReturnWatch("visible");
      logReturn(launch, { type: "stop", reason: "visible" });
    }
  }
  function listenAppStatus() {
    if (statusListener !== null) return;
    try {
      if (!tizen.application.addAppStatusChangeListener) return;
      /* Si otro firmware sí entrega eventos, sólo adelanta el sondeo. */
      statusListener = tizen.application.addAppStatusChangeListener(function (appId, state) {
        if (!lastLaunch || returnWatch === null || appId !== lastLaunch.id || state !== "TERMINATED") return;
        clearTimeout(returnConfirmTimer); returnConfirmTimer = setTimeout(watchReturn, 50);
      });
    } catch (error) { statusListener = -1; recordError("app-status", error); }
  }
  /* Sólo un lanzamiento confirmado cuenta como uso. Mismo guardado que el
     resto de preferencias; un fallo de guardado no interrumpe la apertura. */
  function recordLaunch(app) {
    if (!prefsLoaded || disposed || !app || !P.recordLaunch) return;
    try { persist(P.recordLaunch(prefs, app.id, Date.now())); } catch (error) { recordError("usage", error); return; }
    if (ready && !mediaFormEditing && (view === "home" || view === "library")) renderView(focused && focused.item ? focused.item.id : app.id);
  }
  function openProjectorSettings() {
    if (actionBusy) return;
    cancelShortcutReclaim();
    busy(true);
    if (HP) { HP.settings(function (error) { if (error) actionFailed("los ajustes de LG", error); else finishAction(); }); return; }
    function fallback() {
      /* Muchos firmwares no publican el app-control genérico. El menú nativo
         es la ruta de compatibilidad: sólo registrar error si también falla. */
      try {
        tizen.application.launch("org.tizen.menu", finishAction, function (failure) { actionFailed("los ajustes de Samsung", failure); });
      } catch (failure) { actionFailed("los ajustes de Samsung", failure); }
    }
    try {
      if (!window.tizen || !tizen.ApplicationControl) throw new Error("API de ajustes no disponible");
      var control = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/setting", null, null, null, []);
      tizen.application.launchAppControl(control, null, finishAction, fallback);
    } catch (error) { fallback(error); }
  }
  function exitHome() {
    cancelShortcutReclaim();
    if (HP) { HP.exit(); return; }
    try {
      if (!window.tizen || !tizen.application) throw new Error("Salida disponible en el proyector");
      tizen.application.getCurrentApplication().exit();
    } catch (error) { recordError("exit", error); message("Usa el botón Home del mando para volver a Samsung.", true); }
  }
  /* El ambiente sigue a la app enfocada, independientemente del reproductor.
     Dos capas a tamaño real: sólo se anima opacidad, nunca blur ni vídeo. */
  function updateAmbient(app) {
    if (!T || !prefsLoaded) return;
    var preferences = currentPreferences(), entry, theme, next;
    if (!app && ambientState.appId) app = appById(ambientState.appId);
    ambientState.appId = app ? app.id : null; ambientState.name = app ? app.name : "Home";
    ambientState.mode = preferences.background; ambientState.intensity = preferences.ambientIntensity;
    if (preferences.background === "dark") {
      ambientLayers[0].className = ambientLayers[1].className = "ambient"; ambientKey = ""; return;
    }
    entry = app && artCache[app.id];
    theme = T.themeFor(app, entry && entry.palette, preferences.ambientIntensity);
    ambientState = { appId: app ? app.id : null, name: app ? app.name : "Home", colors: theme.colors.slice(), contrast: theme.contrast, intensity: preferences.ambientIntensity, mode: "app" };
    if (theme.key === ambientKey) return;
    $("stage").style.setProperty("--ambient-surface", theme.surface);
    next = ambientKey ? 1 - ambientIndex : ambientIndex;
    ambientLayers[next].style.background = theme.background;
    ambientLayers[next].className = "ambient on"; ambientLayers[1 - next].className = "ambient";
    ambientIndex = next; ambientKey = theme.key;
  }
  function iconBackground(image, key, fallbackColor, sampleGrid) {
    if (sampleGrid) key += "|artwork";
    if (Object.prototype.hasOwnProperty.call(iconBackgrounds, key)) return iconBackgrounds[key];
    var result = fallbackColor;
    try {
      /* Iguala el color donde el original tiene transparencia. */
      var canvas = document.createElement("canvas"); canvas.width = canvas.height = 8;
      var context = canvas.getContext("2d"), pixels, colors = [], opaque = 0, coverage = 0, grid = 8, ys = [0, 3, 7], i, j, at, count, red, green, blue;
      context.drawImage(image, 0, 0, 8, 8); pixels = context.getImageData(0, 0, 8, 8).data;
      var hueRed = 0, hueGreen = 0, hueBlue = 0, hueCount = 0;
      for (i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 220) continue;
        coverage++;
        if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 45) {
          hueRed += pixels[i]; hueGreen += pixels[i + 1]; hueBlue += pixels[i + 2]; hueCount++;
        }
      }
      /* Las tarjetas de Samsung usan la cuadrícula reducida. El Freestyle
         devuelve píxeles transparentes al recortar un píxel de iconos nativos. */
      if (!sampleGrid) {
        var sourceXs = [0, Math.floor(image.naturalWidth / 2), image.naturalWidth - 1];
        var sourceYs = [0, Math.floor(image.naturalHeight / 2), image.naturalHeight - 1];
        grid = 3; ys = [0, 1, 2]; canvas.width = canvas.height = grid;
        for (i = 0; i < grid; i++) for (j = 0; j < grid; j++) context.drawImage(image, sourceXs[j], sourceYs[i], 1, 1, j, i, 1, 1);
        pixels = context.getImageData(0, 0, grid, grid).data;
      }
      for (i = 0; i < ys.length; i++) {
        red = green = blue = count = 0;
        for (j = 0; j < 2; j++) {
          at = (ys[i] * grid + (j ? grid - 1 : 0)) * 4;
          if (pixels[at + 3] < 220) continue;
          red += pixels[at]; green += pixels[at + 1]; blue += pixels[at + 2]; count++; opaque++;
        }
        if (!count && i !== 1) {
          at = (ys[i] * grid + Math.floor(grid / 2)) * 4;
          if (pixels[at + 3] >= 220) { red = pixels[at]; green = pixels[at + 1]; blue = pixels[at + 2]; count = 1; opaque++; }
        }
        colors.push(count ? [Math.round(red / count), Math.round(green / count), Math.round(blue / count)] : null);
      }
      if (coverage >= 32 && opaque >= 2) {
        var middle = colors[1] || colors[0] || colors[2], top = colors[0] || middle, bottom = colors[2] || middle;
        var rgb = function (value) { return "rgb(" + value.join(",") + ")"; };
        var difference = Math.abs(top[0] - bottom[0]) + Math.abs(top[1] - bottom[1]) + Math.abs(top[2] - bottom[2]);
        result = difference < 36 ? rgb(middle) : "linear-gradient(180deg," + rgb(top) + " 0%," + rgb(middle) + " 50%," + rgb(bottom) + " 100%)";
      } else if (fallbackColor === "#252936" && hueCount) {
        /* Logos transparentes: un fondo de su mismo tono, suficientemente
           oscuro para conservar el contraste con el dibujo original. */
        result = "rgb(" + [Math.round(hueRed / hueCount * .25), Math.round(hueGreen / hueCount * .25), Math.round(hueBlue / hueCount * .25)].join(",") + ")";
      }
    } catch (ignored) { /* Un icono nativo puede impedir leer píxeles; se mantiene su color de marca. */ }
    iconBackgrounds[key] = result; return result;
  }
  function fallbackInk(color) {
    var match = /^#([0-9a-f]{6})$/i.exec(color || "");
    if (!match) return "#ffffff";
    var value = parseInt(match[1], 16), luminance = ((value >> 16) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;
    return luminance > 150 ? "#141820" : "#ffffff";
  }
  /* 1.10.0: arte de tarjetas. tileArt(app) reúne la regla pura
     (HomeModel.tileArtSpec) con lo calculado aquí una sola vez por app:
     paleta de dos colores del icono y fondo desenfocado (dataURL JPEG). Los
     nodos de tarjeta se reutilizan entre renderView por app.id. */
  var tileNodes = Object.create(null), artCache = Object.create(null), iconPalettes = Object.create(null), artQueue = [], artTimer = null, tileNodesMode = null;
  /* Interior de la tarjeta (sin el borde de 4 px) y de la ventana superior. */
  var ART_BOX = { large: 288 / 158, compact: 224 / 122, hero: 924 / 518 };
  var BACKDROP_W = 192, BACKDROP_H = 108, BACKDROP_DARKEN = .35;
  var perf = { renderMs: 0, tiles: 0, artCacheHits: 0, reusedTiles: 0, createdTiles: 0, view: null, renders: 0, firstRenderMs: null, maxRenderMs: 0, history: [],
    backdrops: 0, backdropMs: 0, backdropFailures: 0, palettes: 0 }, renderCount = null;
  function artMode() { var preferences = currentPreferences(); return preferences && preferences.tileArt === "full" ? "full" : preferences && preferences.tileArt === "flat" ? "flat" : "rich"; }
  function artEntry(app) { return artCache[app.id] || (artCache[app.id] = { palette: null, paletteSrc: null, backdrop: null, backdropSrc: null, pending: null }); }
  function tileArt(app) {
    var entry = artCache[app.id], spec = M.tileArtSpec(app, entry ? entry.palette : null), icons = [], i;
    if (spec.logo) icons.push({ src: spec.logo, kind: "brand" });
    for (i = 0; i < app.icons.length; i++) if (app.icons[i].src !== spec.logo) icons.push(app.icons[i]);
    return { spec: spec, background: M.artBackground(spec), backdrop: spec.backdrop && entry && entry.backdrop ? entry.backdrop : null, icons: icons };
  }
  /* Dos colores dominantes y si el icono es opaco en las esquinas (icono
     cuadrado con fondo propio: se le redondean las esquinas y lleva sombra). */
  function iconPalette(image, key) {
    if (Object.prototype.hasOwnProperty.call(iconPalettes, key)) return iconPalettes[key];
    var result = { colors: null, opaque: false, coverage: null, pixels: null };
    try {
      var canvas = document.createElement("canvas"), context, pixels, corners = [0, 15, 240, 255], i, solid = 0, filled = 0;
      canvas.width = canvas.height = 16; context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 16, 16); pixels = context.getImageData(0, 0, 16, 16).data;
      result.colors = M.dominantColors(pixels);
      for (i = 0; i < corners.length; i++) if (pixels[corners[i] * 4 + 3] >= 230) solid++;
      for (i = 3; i < pixels.length; i += 4) if (pixels[i] >= 230) filled++;
      result.coverage = filled / (pixels.length / 4);
      result.opaque = solid === 4;
      if (!HP) result.pixels = pixels;
      perf.palettes++;
    } catch (ignored) { /* Icono sin acceso a sus píxeles: degradado por defecto. */ }
    iconPalettes[key] = result; return result;
  }
  /* Fondo «streaming»: el icono ampliado 2,2× sobre su degradado, con
     filter blur(18px) (escalado al lienzo de 320×180) y oscurecido un 35 %. */
  function makeBackdrop(image, spec) {
    var canvas = document.createElement("canvas"), context, gradient, dh, dw, ratio, small, sc;
    /* Lienzo en CPU (willReadFrequently): en el proyector, el desenfoque y el
       JPEG tardan ~25 ms frente a 45–90 ms con el lienzo acelerado (lectura de GPU). */
    canvas.width = BACKDROP_W; canvas.height = BACKDROP_H; context = canvas.getContext("2d", { willReadFrequently: true });
    gradient = context.createLinearGradient(0, 0, BACKDROP_W, BACKDROP_H); gradient.addColorStop(0, spec.gradient[0]); gradient.addColorStop(1, spec.gradient[1]);
    context.fillStyle = gradient; context.fillRect(0, 0, BACKDROP_W, BACKDROP_H);
    /* Al menos 2,2× el tamaño del icono y siempre cubriendo el ancho, para
       que no queden bandas laterales del degradado. */
    ratio = image.naturalWidth / image.naturalHeight || 1; dh = BACKDROP_H * spec.logoScale * 2.2; dw = dh * ratio;
    if (dw < BACKDROP_W * 1.12) { dw = BACKDROP_W * 1.12; dh = dw / ratio; }
    if (typeof context.filter === "string") {
      context.filter = "blur(" + Math.round(18 * BACKDROP_W / 296) + "px)";
      context.drawImage(image, (BACKDROP_W - dw) / 2, (BACKDROP_H - dh) / 2, dw, dh); context.filter = "none";
    } else {
      /* Sin filtros de lienzo: reducir a 1/16 y volver a ampliar suaviza igual. */
      small = document.createElement("canvas"); small.width = 20; small.height = 12; sc = small.getContext("2d");
      sc.drawImage(canvas, 0, 0, 20, 12); sc.drawImage(image, (20 - dw / 16) / 2, (12 - dh / 16) / 2, dw / 16, dh / 16);
      context.imageSmoothingEnabled = true; context.drawImage(small, 0, 0, BACKDROP_W, BACKDROP_H);
    }
    context.fillStyle = "rgba(0,0,0," + (spec.darken || BACKDROP_DARKEN) + ")"; context.fillRect(0, 0, BACKDROP_W, BACKDROP_H);
    return canvas.toDataURL("image/jpeg", .82);
  }
  function queueBackdrop(app, image, src) {
    var entry = artEntry(app);
    if ((entry.backdrop && entry.backdropSrc === src) || entry.pending === src) return;
    entry.pending = src; artQueue.push({ app: app, image: image, src: src });
    if (!artTimer) artTimer = setTimeout(runArtQueue, 30);
  }
  /* Se generan pocos fondos por turno (12 ms) para no bloquear el mando. */
  function runArtQueue() {
    artTimer = null;
    /* 1.10.1: sin trabajo con Home liberada u oculta; se reanuda al volver. */
    if (disposed || document.hidden) return;
    var started = Date.now(), job, entry, t0, url;
    while (artQueue.length && Date.now() - started < 12) {
      job = artQueue.shift(); entry = artEntry(job.app); entry.pending = null; t0 = Date.now();
      try { url = makeBackdrop(job.image, M.tileArtSpec(job.app, entry.palette)); entry.backdrop = url; entry.backdropSrc = job.src; perf.backdrops++; }
      catch (error) { perf.backdropFailures++; url = null; }
      perf.backdropMs += Date.now() - t0;
      if (url) paintBackdrop(job.app.id, url);
    }
    if (artQueue.length) artTimer = setTimeout(runArtQueue, 16);
  }
  /* 1.10.1: elimina de las cachés lo que ya no pertenece a ninguna app de la lista. */
  function purgeArtCaches(list) {
    var ids = Object.create(null), srcs = Object.create(null), i, j, key, icons;
    for (i = 0; i < list.length; i++) {
      ids[list[i].id] = true; icons = tileArt(list[i]).icons;
      for (j = 0; j < icons.length; j++) srcs[icons[j].src] = true;
    }
    for (key in artCache) if (Object.prototype.hasOwnProperty.call(artCache, key) && !ids[key]) delete artCache[key];
    for (key in tileNodes) if (Object.prototype.hasOwnProperty.call(tileNodes, key) && !ids[key]) delete tileNodes[key];
    for (key in iconPalettes) if (Object.prototype.hasOwnProperty.call(iconPalettes, key) && !srcs[key]) delete iconPalettes[key];
    for (i = artQueue.length - 1; i >= 0; i--) if (!ids[artQueue[i].app.id]) artQueue.splice(i, 1);
  }
  function paintBackdrop(appId, url) {
    var node = tileNodes[appId];
    if (node && node.el.backdrop) node.el.backdrop.style.backgroundImage = "url(" + url + ")";
    if (previewState.appId === appId && previewState.art === "derived") { $("preview-backdrop").style.backgroundImage = "url(" + url + ")"; $("preview-backdrop").className = ""; }
  }
  /* Caja del logo o icono en porcentajes (HomeModel.artLayout). */
  function placeArtImage(image, art, candidate, palette, options) {
    var spec = art.spec, brandLogo = candidate.kind === "brand" && candidate.src === spec.logo;
    var box = M.artLayout({ logoScale: brandLogo || !spec.logo ? spec.logoScale : .6, logoAlign: spec.logoAlign }, image.naturalWidth, image.naturalHeight, options);
    image.style.width = box.width + "%"; image.style.height = box.height + "%"; image.style.left = box.left + "%"; image.style.top = box.top + "%";
    return (brandLogo ? " brand-logo" : "") + (!brandLogo && palette && palette.opaque ? " opaque" : "");
  }
  function tintPaleArtwork(image, art, app, palette) {
    if (!CONFIG.appName || !T || !T.paleArtworkEdges(palette.pixels)) return false;
    art.className += " art-toned";
    art.style.background = T.themeFor(app, palette.colors, "vivid").background;
    image.className += " tile-toned";
    return true;
  }
  function richArtworkBackground(app, look) {
    return CONFIG.appName && T && look.spec.tone === "light" ?
      T.themeFor(app, null, "vivid").background : look.background;
  }
  function placeFullIcon(image, art, candidate, palette, app) {
    var logoOnly = candidate.kind === "brand" || palette.coverage !== null && palette.coverage < .55;
    image.className += logoOnly ? " tile-wordmark" : " tile-proportioned";
    if (LFA_CONTROLS && logoOnly && palette.coverage !== null && palette.coverage < .28) image.className += " tile-wordmark-spaced";
    var relativeRatio = (image.naturalWidth / image.naturalHeight) / (art.clientWidth / art.clientHeight);
    var tinted = tintPaleArtwork(image, art, app, palette);
    if (!logoOnly && palette.opaque && relativeRatio >= .93 && relativeRatio <= 1.07) {
      image.className += " tile-cover"; return;
    }
    if (tinted) return;
    var backdrop = !logoOnly && T && T.artworkBackdrop(palette.pixels, relativeRatio);
    if (backdrop && backdrop.color) { art.style.backgroundColor = backdrop.color; return; }
    art.style.background = iconBackground(image, candidate.src, app.color, true);
    if (!backdrop) return;
    art.style.backgroundImage = backdrop.image;
    art.style.backgroundPosition = backdrop.position;
    art.style.backgroundSize = backdrop.size;
    art.style.backgroundRepeat = "no-repeat";
  }
  /* Tras cargar un icono en modo enriquecido: paleta (una vez por app),
     degradado, caja y fondo desenfocado (en cola). */
  function richIconLoaded(app, image, candidate, art) {
    var palette = iconPalette(image, candidate.src), entry = artEntry(app);
    if (palette.colors && (!entry.palette || entry.paletteSrc !== candidate.src)) { entry.palette = palette.colors; entry.paletteSrc = candidate.src; }
    if (ambientState.appId === app.id) updateAmbient(app);
    art = tileArt(app);
    if (art.spec.backdrop && !art.backdrop) queueBackdrop(app, image, candidate.src);
    return { art: art, palette: palette };
  }
  function buildAppTile(app, mode) {
    var el = document.createElement("button"), art = document.createElement("span"), fallback = document.createElement("span");
    var label = document.createElement("span"), image = null, attempt = 0, rich = mode === "rich", look = rich ? tileArt(app) : null, icons = rich ? look.icons : app.icons, backdrop = null;
    var uniform = mode === "full" && LFA_CONTROLS;
    var samsungFullArt = mode === "full" && !HP && !uniform;
    el.type = "button"; el.tabIndex = -1; el.className = "tile app-tile";
    el.setAttribute("aria-label", app.name); el.setAttribute("data-app-id", app.id);
    art.className = "tile-art";
    if (rich) {
      art.style.background = richArtworkBackground(app, look); el.setAttribute("data-art", look.spec.kind); art.setAttribute("data-tone", look.spec.tone);
      if (look.spec.backdrop) { backdrop = document.createElement("span"); backdrop.className = "tile-backdrop"; if (look.backdrop) backdrop.style.backgroundImage = "url(" + look.backdrop + ")"; art.appendChild(backdrop); }
    } else if (uniform) {
      art.className += " uniform-art"; el.setAttribute("data-art", "uniform");
    } else { art.style.backgroundColor = app.color; el.setAttribute("data-art", mode); }
    el.backdrop = backdrop;
    fallback.className = "tile-fallback"; fallback.textContent = M.initials(app.name); art.appendChild(fallback);
    fallback.style.color = rich || uniform ? "#ffffff" : fallbackInk(app.color);
    label.className = "tile-label"; label.textContent = app.name;
    el.appendChild(art); el.appendChild(label);
    el.item = { id: app.id, name: app.name, kind: "app", glow: app.glow, app: app, open: function () { launchApp(el.item.app); } };
    el.iconState = { source: "fallback", loaded: false };
    function tryIcon() {
      if (attempt >= icons.length) {
        if (image && image.parentNode) image.parentNode.removeChild(image);
        image = null; fallback.className = "tile-fallback"; el.iconState = { source: "fallback", loaded: true }; return;
      }
      var candidate = icons[attempt++];
      if (!image) { image = document.createElement("img"); image.alt = ""; image.draggable = false; art.appendChild(image); }
      image.className = "tile-image " + (candidate.kind === "brand" ? "brand-icon" : "app-icon") +
        (uniform ? " uniform-mark" + (candidate.kind === "native" || candidate.kind === "bundled" ? " uniform-native" : "") : mode === "full" ? " tile-fill" : "");
      el.iconState = { source: candidate.kind, loaded: false };
      image.onload = function () {
        if (!image || !image.naturalWidth) { tryIcon(); return; }
        if (rich) {
          var done = richIconLoaded(app, image, candidate, look), extra;
          look = done.art; art.style.background = richArtworkBackground(app, look);
          extra = placeArtImage(image, look, candidate, done.palette, { maxWidth: candidate.kind === "brand" ? 74 : 80, ratio: (currentPreferences() || {}).tileSize === "compact" ? ART_BOX.compact : ART_BOX.large });
          image.className = "tile-image art-image " + (candidate.kind === "brand" ? "brand-icon" : "app-icon") + extra;
        } else {
          var palette = iconPalette(image, candidate.src), entry = artEntry(app);
          if (samsungFullArt) placeFullIcon(image, art, candidate, palette, app);
          else if (!uniform && !tintPaleArtwork(image, art, app, palette)) art.style.background = iconBackground(image, candidate.src, app.color);
          if (palette.colors) { entry.palette = palette.colors; entry.paletteSrc = candidate.src; }
          else if (uniform && candidate.kind === "mark" && !entry.colorSampled && app.icons && app.icons.length) {
            entry.colorSampled = true;
            (function (colorSrc) {
              var probe = new Image();
              probe.onload = function () {
                if (disposed || !probe.naturalWidth) return;
                var sampled = iconPalette(probe, colorSrc);
                if (sampled.colors) { entry.palette = sampled.colors; entry.paletteSrc = colorSrc; if (ambientState.appId === app.id) updateAmbient(app); }
              };
              probe.src = colorSrc;
            })(app.icons[0].src);
          }
          if (ambientState.appId === app.id) updateAmbient(app);
        }
        fallback.className = "tile-fallback hidden"; el.iconState = { source: candidate.kind, loaded: true, src: candidate.src };
      };
      image.onerror = tryIcon; image.src = candidate.src;
    }
    if (icons.length) tryIcon(); else el.iconState.loaded = true;
    return el;
  }
  /* Reutiliza la tarjeta de la app si existe con el mismo aspecto; sólo se
     limpian foco, distintivos y acción. Nada de recomputar arte. */
  function makeAppTile(app) {
    var mode = artMode(), signature = mode + "|" + app.name + "|" + app.color + "|" + app.icons.map(function (icon) { return icon.src; }).join(","), node = tileNodes[app.id], el, badges, i;
    /* Cambiar el arte o el tamaño de las tarjetas recrea los nodos (la caja
       del logo depende de la proporción); la paleta y los fondos se conservan. */
    var nodesKey = mode + ":" + ((currentPreferences() || {}).tileSize === "compact" ? "compact" : "large");
    if (mode === "full" && !HP && HOME_PAGE_SIZE && (view === "home" || view === "reorder")) nodesKey += ":paged";
    if (tileNodesMode !== nodesKey) { tileNodes = Object.create(null); tileNodesMode = nodesKey; node = null; }
    if (renderCount) renderCount.tiles++;
    if (node && node.signature === signature) {
      el = node.el; el.className = "tile app-tile"; el.removeAttribute("aria-selected"); el.removeAttribute("data-hidden-app"); el.removeAttribute("data-favorite");
      badges = el.querySelectorAll(".app-badge"); for (i = 0; i < badges.length; i++) badges[i].parentNode.removeChild(badges[i]);
      el.item.app = app; el.item.name = app.name; el.item.glow = app.glow; el.item.open = function () { launchApp(el.item.app); };
      if (renderCount) { renderCount.reused++; renderCount.hits++; }
      return el;
    }
    if (renderCount) { renderCount.created++; if (artCache[app.id] && (artCache[app.id].palette || artCache[app.id].backdrop)) renderCount.hits++; }
    el = buildAppTile(app, mode); tileNodes[app.id] = { el: el, signature: signature }; return el;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function currentPreferences() { return reorder && view === "reorder" ? reorder.draft : prefs; }
  function storage() { try { if (!preferencesStorage) preferencesStorage = P.createStorage(window); return preferencesStorage; } catch (error) { recordError("storage-access", error); return null; } }
  function usePagedOrder(value) {
    if (!HOME_PAGE_SIZE || !apps.length || value.homeMode === "all") return value;
    var first = P.getHomeApps(apps, value).slice(0, HOME_PAGE_SIZE).map(function (app) { return app.id; });
    value.order = first.concat(value.order.filter(function (id) { return first.indexOf(id) < 0; }));
    value.homeMode = "all";
    return value;
  }
  function defaultPreferences() {
    var initial = P.defaults(apps, DOCK), key;
    for (key in (CONFIG.initialOptions || {})) if (Object.prototype.hasOwnProperty.call(CONFIG.initialOptions, key)) initial = P.withOption(initial, key, CONFIG.initialOptions[key]);
    if (W && !initial.weather && W.city(CONFIG.city)) initial = P.withOption(initial, "weather", { mode: "city", city: CONFIG.city });
    return usePagedOrder(initial);
  }
  function initializePreferences() {
    if (prefsLoaded) return;
    prefs = P.load(storage(), defaultPreferences()); prefsLoaded = true;
    if (HP && !HP.capabilities.returnHome) prefs.returnHome = false;
    if (HP && LFA_CONTROLS) {
      try {
        if (window.localStorage && window.localStorage.getItem("lfa.home.lg.unified2") !== "1") {
          prefs.tileArt = "full";
          prefs.background = "app";
          if ((!prefs.weather || prefs.weather.mode === "off") && W && W.city(CONFIG.city)) {
            prefs = P.withOption(prefs, "weather", { mode: "city", unit: "C", city: CONFIG.city });
          }
          window.localStorage.setItem("lfa.home.lg.unified2", "1");
          P.save(storage(), prefs);
        }
      } catch (ignored) {}
    }
  }
  function persist(next) {
    prefs = directMediaPreferences(P.normalize(next, prefs || defaultPreferences())); prefsLoaded = true;
    if (!loadWarning) usePagedOrder(prefs);
    if (HP && !HP.capabilities.returnHome) prefs.returnHome = false;
    try { lastSaveSucceeded = P.save(storage(), prefs); } catch (error) { recordError("preferences-save", error); lastSaveSucceeded = false; }
    persistenceFailed = !lastSaveSucceeded;
    syncShortcutWatcher();
    weather();
    return lastSaveSucceeded;
  }
  function directMediaPreferences(value) {
    if (!LFA_CONTROLS) return value;
    value.mediaSources = value.mediaSources.filter(directMedia);
    [value].concat(Object.keys(value.inactive).map(function (id) { return value.inactive[id]; })).forEach(function (profile) {
      if (profile.pinnedMedia && !/^media:(hls|mp4):/.test(profile.pinnedMedia)) profile.pinnedMedia = null;
    });
    return value;
  }
  function saveChange(next, text, keepId) {
    var saved = persist(next); renderView(keepId);
    message(saved ? text : "El cambio funciona ahora, pero no se pudo guardar. Se perderá al cerrar Home.", !saved);
  }
  function appById(id) {
    var i; for (i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i]; return null;
  }
  /* 1.12.0: apps del sistema ocultas por defecto. Se calculan con el
     catálogo y las preferencias (no se escriben en hidden). */
  var autoHiddenMemo = { apps: null, prefs: null, list: [] };
  function autoHiddenList(preferences) {
    if (!preferences || !P.autoHidden) return [];
    if (autoHiddenMemo.apps !== apps || autoHiddenMemo.prefs !== preferences) autoHiddenMemo = { apps: apps, prefs: preferences, list: P.autoHidden(apps, preferences) };
    return autoHiddenMemo.list;
  }
  function isAutoHidden(preferences, appId) { return autoHiddenList(preferences).indexOf(appId) >= 0; }
  function isHiddenNow(preferences, appId) { return P.isHidden(preferences, appId) || isAutoHidden(preferences, appId); }
  function catalogCount() { return apps.length - (prefs ? autoHiddenList(prefs).length : 0); }
  /* Mostrar u ocultar desde opciones o el mando: una oculta (a mano o por
     defecto) se muestra y, si es del sistema, pasa a restored; si no, se
     oculta a mano (y sale de restored). */
  function toggleAppHidden(app, keepId) {
    var hiddenNow = isHiddenNow(prefs, app.id);
    if (hiddenNow) saveChange(P.showApp(prefs, app.id, !!(M.isSystemHidden && M.isSystemHidden(app))), "Aplicación restaurada.", keepId);
    else saveChange(P.toggleHidden(prefs, app.id), "Aplicación oculta. Puedes restaurarla en Todas las apps.", keepId);
  }
  function captureView() {
    var memory = { view: view, focusId: focused && focused.item ? focused.item.id : null, r: cur.r, c: cur.c,
      scroll: $("panel-content").scrollTop, offsets: {}, libraryFilter: libraryFilter }, i;
    for (i = 0; i < rows.length; i++) if (rows[i].lane) memory.offsets[rows[i].id] = rows[i].offset;
    viewMemory[view] = memory;
    return clone(memory);
  }
  function openView(next, keepId) {
    if (!prefsLoaded) { message("Espera a que termine la consulta de aplicaciones."); return; }
    capturingHomeKey = false;
    returnStack.push(captureView()); view = next; renderView(keepId || null);
    if ((next === "settings" || next === "remote-setup") && HP && HP.whiteKeyStatus) refreshWhiteKey();
  }
  function restoreFrame(frame) {
    if (!frame) { view = "home"; renderView(lastHomeAppId); return; }
    view = frame.view; libraryFilter = frame.libraryFilter || "all"; viewMemory[view] = frame; renderView(frame.focusId);
  }
  function back() {
    cancelEnter();
    if (capturingHomeKey) { capturingHomeKey = false; renderView("remote:capture"); message("Captura de tecla cancelada."); return; }
    if (playerFullscreen) { playerFullscreen = false; syncPlayer(); return; }
    if (mediaFormEditing) { mediaFormEditing = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    if (view === "reorder") { var frame = reorder && reorder.returnFrame, fromOptions = reorder && reorder.fromOptions; reorder = null; if (fromOptions && returnStack.length) returnStack.pop(); restoreFrame(frame); message("Orden sin cambios."); return; }
    if (view === "library" && clearLibraryQuery()) return;
    if (returnStack.length) { restoreFrame(returnStack.pop()); return; }
    if (view !== "home") { view = "home"; renderView(lastHomeAppId); return; }
    backAtRootHome();
  }
  /* Volver en el inicio nunca cierra Home (sólo «Salir de Home» en ajustes). */
  var lastRootHint = 0, exitArmedUntil = 0;
  function backAtRootHome() {
    var target = -1, i, plan, now = Date.now();
    if (HOME_PAGE_SIZE && homePage) {
      var list = pagedApps(prefs);
      if (list.length) { renderView(list[0].id); return; }
    }
    for (i = 0; i < rows.length; i++) if (rows[i].id === "home") { target = i; break; }
    if (target < 0) target = rows.length > 1 ? 1 : 0;
    plan = M.backAtRoot({ atStart: cur.r === target && cur.c === 0 });
    if (plan.focusStart) { cur = { r: target, c: 0 }; renderFocus(); return; }
    if (now - lastRootHint >= 3000) { lastRootHint = now; message("Pulsa el botón Home del mando para salir"); }
  }
  function requestExitHome() {
    var now = Date.now();
    if (now < exitArmedUntil) { exitArmedUntil = 0; exitHome(); return; }
    exitArmedUntil = now + 3000; message("Pulsa OK otra vez para salir");
  }
  function makeAction(id, name, description, open) { return { id: id, name: name, description: description || "", kind: "action", open: open }; }
  function actionButton(item, className) {
    var el = document.createElement("button"); el.type = "button"; el.tabIndex = -1; el.className = className || "pill";
    el.textContent = item.short || item.name; el.setAttribute("aria-label", item.name); el.item = item;
    if (item.setting) el.setAttribute("data-setting", item.setting);
    if (item.action) el.setAttribute("data-action", item.action);
    return el;
  }
  /* 1.10.0: las tarjetas se reutilizan; la posición se guarda en el nodo y
     los oyentes se añaden una sola vez. */
  function bindClick(el, rowIndex, colIndex) {
    el.navRow = rowIndex; el.navCol = colIndex;
    if (el.navBound) return; el.navBound = true;
    el.addEventListener("focus", function () { focusPointerTarget(el); });
    el.addEventListener("click", function (event) {
      if (!rows[el.navRow] || rows[el.navRow].items[el.navCol] !== el) return;
      if (event.preventDefault) event.preventDefault(); cancelEnter();
      cur.r = el.navRow; cur.c = el.navCol; renderFocus(); activate();
    });
    if (el.item && (el.item.kind === "app" || el.item.kind === "media")) el.addEventListener("contextmenu", function (event) {
      if (event.preventDefault) event.preventDefault(); cancelEnter();
      cur.r = el.navRow; cur.c = el.navCol; renderFocus(); if (el.item.kind === "media") showMediaOptions(el.item.media); else showAppOptions(el.item.app);
    });
  }
  function focusPointerTarget(el) {
    if (!ready || saver.active || playerFullscreen || mediaFormEditing || view === "reorder" || document.hidden) return;
    if (!rows[el.navRow] || rows[el.navRow].items[el.navCol] !== el || el === focused) return;
    cancelEnter(); cur = { r: el.navRow, c: el.navCol }; renderFocus();
  }
  function addNavigationRow(id, title, elements, element, layout) {
    var index = rows.length, i;
    for (i = 0; i < elements.length; i++) bindClick(elements[i], index, i);
    rows.push({ id: id, title: title, items: elements, element: element, layout: layout || "horizontal", index: 0, offset: 0, maxOffset: 0 });
    return rows[rows.length - 1];
  }
  function openRemoteSetup() { openView("remote-setup"); }
  function shortcutShortLabel() {
    if (HP) return whiteKeyState && whiteKeyState.active ? "Netflix" : "Azul";
    var mode = prefs && prefs.samsungHomeButton || "off";
    if (mode === "disney") return "Disney+";
    if (mode === "tvplus") return "TV Plus";
    if (mode === "both") return "Ambos";
    return M.remoteKeyLabel ? M.remoteKeyLabel(prefs && prefs.customHomeKey || 406).replace(/^Botón /, "") : "Azul";
  }
  function homeCommands(includeAll) {
    var items = [
      makeAction("action:refresh", "Actualizar aplicaciones", HP ? "Consultar las apps de la televisión" : "Consultar las apps del proyector", function () { refresh(true); }),
      makeAction("action:configure", "Configurar Home", "Favoritas, orden y apariencia", function () { openView("settings"); })
    ];
    items[0].short = "Actualizar";
    if (includeAll) {
      items.push(makeAction("action:remote-setup", "Botón Home: " + shortcutShortLabel(), HP ? "Configurar tecla Netflix, tecla directa y Acceso rápido" : "Asignar Disney+, Samsung TV Plus o tecla auxiliar a LFA Home", openRemoteSetup));
      if (LFA_CONTROLS || sources.length) items.push(makeAction("action:sources", "Entradas", HP ? "Seleccionar una entrada de la televisión" : "Seleccionar una entrada del proyector", function () { openView("sources"); }));
      items.push(makeAction("action:library", "Todas las apps", "Buscar, filtrar y gestionar aplicaciones", openLibrary));
      if (LFA_CONTROLS) items.push(makeAction("action:manage-signals", "Gestionar señales", "Añadir, editar o quitar canales", openMediaManage));
      items.push(makeAction("action:reorder", "Ordenar", "Colocar las aplicaciones a tu gusto", function () { startReorder(appById(lastHomeAppId), "order"); }));
    }
    return items;
  }
  function header() {
    var holder = $("pills"), items, elements = [], i, el;
    holder.textContent = "";
    if (LFA_CONTROLS) { buildHomeBrand(); return; }
    items = homeCommands(HOME_PAGE_SIZE && view === "home");
    if (HOME_PAGE_SIZE && view === "home") items.splice(2, 0, mediaAction());
    for (i = 0; i < items.length; i++) { el = actionButton(items[i]); holder.appendChild(el); elements.push(el); }
    if (view === "home") addNavigationRow("actions", "Controles de Home", elements, holder);
  }
  function buildHomeBrand() {
    var holder = $("home-brand"), icon = document.createElement("img"), mark = document.createElement("span");
    var item = makeAction("action:home-menu", "Home", "Abrir el menú de Home", function () { openView("home-menu", "action:refresh"); });
    var button = actionButton(item, "home-command-trigger");
    icon.src = "lfa-home-icon.png"; icon.alt = "";
    mark.className = "home-command-mark"; mark.setAttribute("aria-hidden", "true");
    mark.appendChild(icon); button.insertBefore(mark, button.firstChild);
    button.setAttribute("aria-label", "Home, abrir menú");
    button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-controls", "home-command-menu");
    button.setAttribute("aria-expanded", view === "home-menu" ? "true" : "false");
    button.disabled = view !== "home" && view !== "home-menu";
    holder.textContent = ""; holder.appendChild(button);
    if (view === "home") addNavigationRow("actions", "Menú de Home", [button], holder);
  }
  function buildHomeCommandMenu() {
    var menu = $("home-command-menu");
    menu.textContent = "";
    homeCommands(true).forEach(function (item) {
      var command = item.open;
      item.open = function () { back(); command(); };
      var button = actionButton(item, "home-command-item");
      menu.appendChild(button);
      addNavigationRow(item.id, item.name, [button], button, "vertical");
    });
  }
  function decorateAppTile(el, app) {
    var preferences = currentPreferences(), badge;
    if (!preferences) return el;
    if (P.isHidden(preferences, app.id)) {
      el.className += " hidden-app"; badge = document.createElement("span"); badge.className = "app-badge hidden-badge"; badge.textContent = "Oculta";
      el.setAttribute("data-hidden-app", "true");
    } else if (isAutoHidden(preferences, app.id)) {
      el.className += " hidden-app auto-hidden"; badge = document.createElement("span"); badge.className = "app-badge hidden-badge auto-badge"; badge.textContent = "Oculta por defecto";
      el.setAttribute("data-hidden-app", "auto");
    } else if (P.isFavorite(preferences, app.id)) {
      badge = document.createElement("span"); badge.className = "app-badge favorite-badge"; badge.textContent = "★";
      el.setAttribute("data-favorite", "true");
    }
    if (badge) el.querySelector(".tile-art").appendChild(badge);
    return el;
  }
  var SYMBOLS = {
    play: '<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M24 12v56l44-28z" fill="currentColor"/></svg>',
    library: '<svg viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4"><rect x="10" y="10" width="24" height="24" rx="5"/><rect x="46" y="10" width="24" height="24" rx="5"/><rect x="10" y="46" width="24" height="24" rx="5"/><rect x="46" y="46" width="24" height="24" rx="5"/></g></svg>',
    source: '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="9" y="14" width="62" height="43" rx="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M27 69h26M40 57v12M26 35h28m-9-9 9 9-9 9" fill="none" stroke="currentColor" stroke-width="4"/></svg>'
  };
  function makeSpecialTile(item, symbol) {
    var el = document.createElement("button"), art = document.createElement("span"), label = document.createElement("span");
    el.type = "button"; el.tabIndex = -1; el.className = "tile navigation-tile"; el.setAttribute("aria-label", item.name); el.setAttribute("data-action", item.id);
    art.className = "tile-art navigation-art"; art.innerHTML = SYMBOLS[symbol] || SYMBOLS.library;
    label.className = "tile-label"; label.textContent = item.name; el.appendChild(art); el.appendChild(label); el.item = item; return el;
  }
  function addCarousel(id, title, items, factory, holder, displayCount) {
    if (!items.length) return;
    var section = document.createElement("section"), heading = document.createElement("h2"), count = document.createElement("span");
    var lane = document.createElement("div"), strip = document.createElement("div"), left = document.createElement("span"), right = document.createElement("span");
    var elements = [], i, el, row;
    section.className = "app-row"; section.setAttribute("data-row-id", id); heading.className = "row-heading"; heading.textContent = title;
    count.className = "row-total"; count.textContent = String(typeof displayCount === "number" ? displayCount : items.length); heading.appendChild(count); lane.className = "lane"; strip.className = "strip";
    strip.style.width = ((items.length - 1) * TILE_STEP + TILE_WIDTH + TRACK_PADDING * 2) + "px";
    left.className = "edge-arrow previous"; left.textContent = "‹"; left.setAttribute("aria-hidden", "true");
    right.className = "edge-arrow next"; right.textContent = "›"; right.setAttribute("aria-hidden", "true");
    for (i = 0; i < items.length; i++) { el = factory(items[i]); elements.push(el); strip.appendChild(el); }
    lane.appendChild(strip); lane.appendChild(left); lane.appendChild(right); section.appendChild(heading); section.appendChild(lane); holder.appendChild(section);
    row = addNavigationRow(id, title, elements, section); row.lane = lane; row.strip = strip; row.previous = left; row.next = right;
  }
  function homeItems() {
    var list = P.getHomeApps(apps, prefs).slice(), saved = savedMedia(), i;
    if (LFA_CONTROLS) return list;
    for (i = 0; i < saved.length; i++) list.push({ kind: "media", media: saved[i] });
    list.push(makeAction("action:media", "Vídeos y canales", "Reproducir dentro de Home y añadir tus enlaces", openMedia));
    list.push(makeAction("action:library", "Todas las apps", "Abrir, buscar por letras, filtrar por categoría y organizar", openLibrary));
    if (sources.length) list.push(makeAction("action:sources", "Entradas", HP ? "Seleccionar una entrada de la televisión" : "Seleccionar una entrada del proyector", function () { openView("sources"); }));
    return list;
  }
  function homeFactory(item) {
    if (item.kind === "media") return mediaTile(item.media);
    return item.kind === "action" ? makeSpecialTile(item, item.id === "action:sources" ? "source" : item.id === "action:media" ? "play" : "library") : decorateAppTile(makeAppTile(item), item);
  }
  function pagedApps(preferences) {
    return P.getHomeApps(apps, preferences.homeMode === "all" ? preferences : P.withOption(preferences, "homeMode", "all"));
  }
  function appPageButton(label, glyph, disabled, direction) {
    var el = document.createElement("button");
    el.type = "button"; el.tabIndex = -1; el.className = "page-arrow"; el.textContent = glyph;
    el.disabled = disabled; el.setAttribute("aria-label", label);
    el.addEventListener("click", function () {
      cancelEnter();
      if (view === "reorder") moveReorder(direction, true);
      else changeAppPage(direction);
    });
    return el;
  }
  function buildAppPage(list, selectedId, title) {
    var editing = view === "reorder", page = editing ? 0 : homePage;
    var pageCount = Math.max(1, Math.ceil(list.length / HOME_PAGE_SIZE)), i;
    for (i = 0; i < list.length; i++) if (list[i].id === selectedId) { page = Math.floor(i / HOME_PAGE_SIZE); break; }
    page = Math.min(page, pageCount - 1);
    if (!editing) homePage = page;
    if (!list.length) return;
    var section = document.createElement("section"), header = document.createElement("div"), heading = document.createElement("h2");
    var strip = document.createElement("div"), controls = document.createElement("div"), elements = [];
    section.className = "app-row paged-row"; section.setAttribute("data-row-id", view);
    header.className = "page-heading"; heading.className = "row-heading"; heading.textContent = title;
    strip.className = "paged-strip"; controls.className = "page-controls";
    controls.appendChild(appPageButton(editing ? "Mover al grupo anterior" : LFA_CONTROLS ? "Apps anteriores" : "Grupo anterior", "↑", page === 0, -1));
    if (!LFA_CONTROLS || editing) {
      var number = document.createElement("span");
      number.className = "page-number"; number.textContent = "Grupo " + (page + 1) + " de " + pageCount;
      controls.appendChild(number);
    }
    controls.appendChild(appPageButton(editing ? "Mover al grupo siguiente" : LFA_CONTROLS ? "Más apps" : "Grupo siguiente", "↓", page === pageCount - 1, 1));
    header.appendChild(heading); header.appendChild(controls); section.appendChild(header);
    list.slice(page * HOME_PAGE_SIZE, (page + 1) * HOME_PAGE_SIZE).forEach(function (app) {
      var el = decorateAppTile(makeAppTile(app), app);
      strip.appendChild(el); elements.push(el);
    });
    section.appendChild(strip); $("rows").appendChild(section);
    var row = addNavigationRow(view, title, elements, section);
    row.page = page; row.totalApps = list.length;
  }
  function changeAppPage(direction) {
    var list = pagedApps(prefs), start = (homePage + direction) * HOME_PAGE_SIZE;
    if (start < 0 || start >= list.length) return;
    var column = rows[cur.r] && rows[cur.r].id === "home" ? cur.c : 0;
    renderView(list[Math.min(start + column, list.length - 1)].id);
  }
  function buildHome(keepId) {
    if (HOME_PAGE_SIZE) {
      var list = pagedApps(prefs);
      buildAppPage(list, keepId, "Aplicaciones");
      $("empty").className = list.length ? "hidden" : "";
      $("home-note").textContent = list.length ? "↑ ↓ Cambia de grupo · Mantén OK para ver las opciones." : "Puedes restaurar las apps ocultas desde Todas las apps.";
      return;
    }
    var count = P.getHomeApps(apps, prefs).length + savedMedia().length;
    var recentEmpty = prefs.homeMode === "recent" && !P.recentApps(apps, prefs).length;
    var title = prefs.homeMode === "all" ? "Tus aplicaciones" : prefs.homeMode === "recent" && !recentEmpty ? "Recientes" : "Favoritas";
    addCarousel("home", title, homeItems(), homeFactory, $("rows"), count);
    $("empty").className = "hidden";
    if (recentEmpty) $("home-note").textContent = "Aún no has abierto ninguna aplicación desde Home" + (count ? ". Mientras tanto, se muestran tus favoritas." : ".");
    else if (!count) $("home-note").textContent = prefs.homeMode !== "all" ? "Añade tus favoritas desde Todas las apps." : "No hay apps visibles. Restaura las ocultas desde Todas las apps.";
    else $("home-note").textContent = "Mantén OK para ver las opciones de una aplicación.";
  }
  function panelHeader(title, description, extras) {
    var backItem = makeAction("action:back", "Volver", "Volver a la pantalla anterior", back), el = actionButton(backItem), buttons = [el], i;
    $("panel-title").textContent = title; $("panel-description").textContent = description || ""; $("panel-buttons").textContent = "";
    $("panel-buttons").appendChild(el);
    extras = extras || [];
    for (i = 0; i < extras.length; i++) { el = actionButton(extras[i]); $("panel-buttons").appendChild(el); buttons.push(el); }
    addNavigationRow("panel-actions", "Acciones", buttons, $("panel-buttons"));
  }
  function listOption(item) {
    var button = actionButton(item, "setting-button"), name = document.createElement("span"), detail = document.createElement("span");
    button.textContent = ""; name.className = "setting-name"; name.textContent = item.name; detail.className = "setting-detail"; detail.textContent = item.value || item.description || "";
    button.appendChild(name); button.appendChild(detail); $("panel-list").appendChild(button);
    addNavigationRow(item.id, item.name, [button], button, "vertical");
  }
  function optionLabel(key) {
    if (key === "homeMode") return prefs.homeMode === "all" ? "Todas las visibles" : prefs.homeMode === "recent" ? "Recientes" : "Favoritas";
    if (key === "previewMode") return prefs.previewMode === "off" ? "Desactivada" : prefs.previewMode === "logo" ? "Sólo imagen de la app" : "Automática";
    if (key === "background") return prefs.background === "dark" ? "Oscuro" : "Según la aplicación";
    if (key === "ambientIntensity") return prefs.ambientIntensity === "soft" ? "Suave" : prefs.ambientIntensity === "normal" ? "Normal" : "Viva";
    if (key === "showClock") return prefs.showClock ? "Mostrar" : "Ocultar";
    if (key === "remoteLayout") return prefs.remoteLayout === "full" ? "Completo (colores y números)" : "Freestyle";
    if (key === "returnHome") return prefs.returnHome === false ? "No" : "Sí";
    if (key === "resumeOnReturn") return prefs.resumeOnReturn === false ? "No" : "Sí";
    if (key === "screensaver") return prefs.screensaver ? prefs.screensaver + " min" : "Desactivado";
    if (key === "samsungHomeButton") return M.samsungHomeButtonLabel ? M.samsungHomeButtonLabel(prefs.samsungHomeButton) : "Desactivado";
    if (key === "tileArt") return prefs.tileArt === "full" ? (LFA_CONTROLS ? "Fondo uniforme" : "Iconos completos") : prefs.tileArt === "flat" ? "Plano" : "Enriquecido";
    return prefs.tileSize === "compact" ? "Compactas" : "Grandes";
  }
  var OPTION_VALUES = { homeMode: ["favorites", "all", "recent"], previewMode: ["auto", "logo", "off"], background: ["app", "dark"], ambientIntensity: ["soft", "normal", "vivid"], showClock: [true, false], tileSize: ["large", "compact"], remoteLayout: ["freestyle", "full"], returnHome: [true, false], resumeOnReturn: [true, false], samsungHomeButton: M && M.SAMSUNG_HOME_BUTTONS ? M.SAMSUNG_HOME_BUTTONS : ["off", "tvplus", "disney", "both"], tileArt: M && M.TILE_ART_MODES ? M.TILE_ART_MODES : ["rich", "flat"], screensaver: M && M.SCREENSAVER_MINUTES ? M.SCREENSAVER_MINUTES : [0, 1, 2, 5, 10, 15, 30] };
  function cycleOption(key, delta) {
    if (key === "profile") { cycleProfile(delta); return; }
    if (key === "dim") { cycleDim(delta); return; }
    if (key === "hideSystemApps") { saveChange(P.withOption(prefs, key, !prefs.hideSystemApps), "Preferencia guardada.", "setting:" + key); return; }
    var values = OPTION_VALUES[key], at;
    if (!values || !values.length) return;
    at = values.indexOf(prefs[key]);
    saveChange(P.withOption(prefs, key, values[(at + delta + values.length) % values.length]), "Preferencia guardada.", "setting:" + key);
  }
  function settingChoice(key, title) {
    var item = makeAction("setting:" + key, title, "", function () { cycleOption(key, 1); }); item.setting = key; item.value = optionLabel(key); return item;
  }
  function refreshWhiteKeyView() {
    if (disposed) return;
    if (view === "settings" || view === "remote-setup") renderView(focused && focused.item.id);
    else if (view === "home-menu") { renderView(focused && focused.item.id); paintHubDigest(new Date()); }
    else if (view === "home") paintHubDigest(new Date());
  }
  function refreshWhiteKey() {
    if (whiteKeyBusy || !HP || !HP.whiteKeyStatus) return;
    whiteKeyBusy = true;
    HP.whiteKeyStatus(function (error, result) {
      whiteKeyBusy = false; whiteKeyState = error ? null : result;
      refreshWhiteKeyView();
    });
  }
  function whiteKeyChoice() {
    var state = whiteKeyState;
    var detail = whiteKeyBusy ? "Consultando el mando…" : !state ? "OK consulta el estado" :
      !state.available ? "Componente del mando no instalado" : state.active ?
      "Abre Home · OK devuelve la tecla a Netflix" : "Abre Netflix · OK la asigna a Home";
    return makeAction("setting:white-key", "Tecla blanca Netflix", detail, function () {
      if (whiteKeyBusy) return;
      if (!state || !state.available) { refreshWhiteKey(); return; }
      whiteKeyBusy = true; refreshWhiteKeyView();
      HP.setWhiteKey(!state.active, function (error, result) {
        whiteKeyBusy = false;
        if (error) { message(error.message, true); refreshWhiteKey(); return; }
        whiteKeyState = result; refreshWhiteKeyView();
        message(result.active ? "La tecla Netflix ahora abre Home." : "La tecla vuelve a abrir Netflix.");
      });
    });
  }
  function buildSettings() {
    var count = 0, autoCount = autoHiddenList(prefs).length, i; for (i = 0; i < apps.length; i++) if (P.isHidden(prefs, apps[i].id)) count++;
    panelHeader("Configurar Home", persistenceFailed ? "Los cambios actuales no se pueden guardar en este dispositivo." : "Los cambios se guardan automáticamente en este dispositivo.");
    /* 1.15.1: «Perfil: NOMBRE · OK cambia» y «Perfiles…». */
    var profileList = P.listProfiles(prefs), current = P.activeProfile(prefs);
    var profileChoice = makeAction("setting:profile", "Perfil: " + current.name, (profileList.length > 1 ? profileList.length + " perfiles · favoritas, orden e historial de cada persona" : "Sólo hay un perfil · crea otro en Perfiles…") + " · OK cambia", cycleProfile);
    profileChoice.setting = "profile"; listOption(profileChoice);
    listOption(makeAction("setting:profiles", "Perfiles…", "Activar, crear, renombrar o eliminar (máximo " + P.MAX_PROFILES + ")", function () { openView("profiles", "profile:" + P.activeProfile(prefs).id); }));
    listOption(makeAction("setting:apps", "Gestionar aplicaciones", catalogCount() + " apps · " + (count + autoCount) + " ocultas" + (autoCount ? " (" + autoCount + " por defecto)" : ""), openLibrary));
    /* 1.12.0: «Ocultar apps del sistema: Sí/No». */
    var systemChoice = makeAction("setting:hideSystemApps", "Ocultar apps del sistema: " + (prefs.hideSystemApps === false ? "No" : "Sí"),
      (prefs.hideSystemApps === false ? "SmartThings, Workspace, Technogym… se ven en Home" : autoCount + (autoCount === 1 ? " app oculta" : " apps ocultas") + " por defecto · Ver ocultas las lista") + " · OK cambia", function () {
        var next = P.withOption(prefs, "hideSystemApps", prefs.hideSystemApps === false), n = P.autoHidden(apps, next).length;
        saveChange(next, next.hideSystemApps ? n + (n === 1 ? " app del sistema oculta" : " apps del sistema ocultas") : "Apps del sistema visibles", "setting:hideSystemApps");
      });
    systemChoice.setting = "hideSystemApps"; listOption(systemChoice);
    listOption(makeAction("setting:media", "Vídeos y canales", LFA_CONTROLS ? "Añadir, editar o quitar señales" : "Reproducir y guardar tus enlaces", LFA_CONTROLS ? openMediaManage : openMedia));
    listOption(makeAction("setting:reorder", "Ordenar la barra", "Mover con las flechas y confirmar con OK", function () { startReorder(null, null); }));
    if (!HOME_PAGE_SIZE) listOption(settingChoice("homeMode", "Aplicaciones del inicio"));
    listOption(settingChoice("previewMode", "Vista previa superior"));
    listOption(settingChoice("background", "Fondo"));
    listOption(settingChoice("ambientIntensity", "Intensidad del color"));
    listOption(settingChoice("showClock", "Reloj"));
    if (W) listOption(makeAction("setting:weather", "Tiempo y ubicación", weatherSummary(), function () { openView("weather"); }));
    listOption(settingChoice("tileSize", "Tamaño de las tarjetas"));
    /* 1.10.0: «Arte de tarjetas: Enriquecido / Plano». */
    var artChoice = settingChoice("tileArt", "Arte de tarjetas: " + optionLabel("tileArt"));
    artChoice.value = prefs.tileArt === "full" ? (LFA_CONTROLS ? "Fondo común para todas las tarjetas · OK cambia" : "La imagen ocupa todo el rectángulo · OK cambia") : prefs.tileArt === "flat" ? "Icono sobre su color, como en 1.9.0 · OK cambia" : "Tarjetas 16:9 con degradado de marca o fondo del icono · OK cambia"; listOption(artChoice);
    listOption(settingChoice("remoteLayout", "Mando"));
    listOption(makeAction("setting:remote-setup", "Botón Home del mando", HP ? "Tecla blanca Netflix, tecla Azul y Acceso rápido" : optionLabel("samsungHomeButton") + " · Tecla directa: " + (M.remoteKeyLabel ? M.remoteKeyLabel(prefs.customHomeKey) : "Azul"), openRemoteSetup));
    if (!HP) listOption(settingChoice("samsungHomeButton", "Atajo físico Samsung"));
    if (HP && HP.setWhiteKey) listOption(whiteKeyChoice());
    if (!HP || HP.capabilities.returnHome) listOption(settingChoice("returnHome", "Volver a Home al cerrar una app"));
    if (HP) listOption(makeAction("setting:shortcut", "Acceso rápido a Home", "Mantén pulsado 0 en el mando y asigna Home a un número libre", function () { message("En LG, mantén 0 para editar Acceso rápido. Asigna Home a un número libre y mantenlo pulsado para abrirla."); }));
    if (HP && HP.pairCatalog) listOption(makeAction("setting:catalog", "Detectar todas las aplicaciones de LG", "Acepta la solicitud que aparecerá en la televisión", function () {
      message("Acepta la solicitud de conexión que aparece en la televisión.");
      HP.pairCatalog(function (error) { if (error) message(error.message, true); else { message("Catálogo de LG conectado."); refresh(true); } });
    }));
    /* 1.11.0: el recuadro se pausa al abrir una app y continúa al volver. */
    listOption(settingChoice("resumeOnReturn", "Reanudar el vídeo al volver a Home"));
    var pinned = prefs.pinnedMedia ? mediaById(prefs.pinnedMedia) : null;
    listOption(makeAction("setting:pinned", "Fuente fija en el recuadro", prefs.pinnedMedia ? (pinned ? pinned.title : "No disponible ahora") + " · OK quita la fijación" : "Ninguna · fíjala desde Vídeos y canales", function () {
      if (prefs.pinnedMedia) saveChange(P.setPinnedMedia(prefs, null), "Fijación quitada.", "setting:pinned"); else openMedia();
    }));
    /* 1.9.0: «Salvapantallas: 5 min»; OK cicla 0 (desactivado), 1, 2, 5, 10, 15 y 30. */
    var saver = settingChoice("screensaver", "Salvapantallas: " + optionLabel("screensaver"));
    saver.value = "Tras ese tiempo sin pulsar teclas · OK cambia"; listOption(saver);
    /* 1.13.0: «Atenuar interfaz: Desactivado / Suave / Noche / Automático (22:00–07:00)». */
    var dimChoice = makeAction("setting:dim", "Atenuar interfaz: " + DIM_LABELS[prefs.dim || "off"], "", cycleDim); dimChoice.setting = "dim"; dimChoice.value = "Para ver de noche sin deslumbrar · OK cambia"; listOption(dimChoice);
    var used = P.usageCount ? P.usageCount(prefs) : 0;
    listOption(makeAction("setting:clear-usage", "Borrar historial de uso", used ? used + (used === 1 ? " aplicación" : " aplicaciones") + " en Recientes" : "Sin historial", function () {
      saveChange(P.clearUsage(prefs), "Historial de uso borrado.", "setting:clear-usage");
    }));
    var lastLine = returnLogText(1)[0];
    listOption(makeAction("setting:return-log", "Diagnóstico: registro de retorno", lastLine || "Sin registros todavía", function () { openView("return-log", "action:back"); }));
    listOption(makeAction("setting:projector", HP ? "Ajustes de la televisión LG" : "Ajustes del proyector Samsung", "Abre los ajustes propios del dispositivo", openProjectorSettings));
    listOption(makeAction("setting:reset", "Restablecer preferencias de Home", "Requiere confirmación", function () { openView("confirm"); }));
    listOption(makeAction("setting:exit", "Salir de Home", "Cierra Home y vuelve a " + (HP ? "LG" : "Samsung") + " · pulsa OK dos veces", requestExitHome));
  }
  function openLibrary() {
    libraryFilter = "all"; libraryChip = "all"; libraryQuery = ""; librarySearchReturnId = null; libraryLetterIndex = 0; libraryGridCol = 0;
    openView("library");
  }
  /* Listas de la biblioteca: base (todas u ocultas, en el orden guardado),
     recuento por categoría y lo visible tras la categoría y la consulta. */
  function libraryLists() {
    var list = P.orderedApps(apps, prefs), base = [], i, counts, byChip;
    /* 1.12.0: las ocultas por defecto sólo aparecen en «Ver ocultas». */
    for (i = 0; i < list.length; i++) if (libraryFilter === "hidden" ? isHiddenNow(prefs, list[i].id) : !isAutoHidden(prefs, list[i].id)) base.push(list[i]);
    counts = M.categoryCounts(base, prefs.categories);
    if (libraryChip !== "all" && !counts[libraryChip]) libraryChip = "all";
    byChip = libraryChip === "all" ? base : M.filterByCategory(base, libraryChip, prefs.categories);
    return { base: base, counts: counts, visible: M.searchApps(byChip, libraryQuery) };
  }
  function firstLibraryId(fallbackId) { var visible = libraryLists().visible; return visible.length ? visible[0].id : fallbackId; }
  function chooseChip(category) { return function () { libraryChip = category; renderView(firstLibraryId("chip:" + category)); }; }
  function typeLetter(letter) {
    return function () {
      if (libraryQuery.length >= 20) return;
      if (!libraryQuery) librarySearchReturnId = libraryLastAppId;
      libraryLetterIndex = cur.c; libraryQuery += letter.toLowerCase();
      renderView(firstLibraryId("letter:" + letter));
    };
  }
  /* Borra la consulta y vuelve a la tarjeta enfocada antes de buscar si
     sigue visible; si no, a la primera. Devuelve false sin consulta. */
  function clearLibraryQuery() {
    if (!libraryQuery) return false;
    var visible, target = null, i;
    libraryQuery = ""; visible = libraryLists().visible;
    for (i = 0; i < visible.length; i++) if (visible[i].id === librarySearchReturnId) { target = visible[i].id; break; }
    librarySearchReturnId = null;
    renderView(target || (visible.length ? visible[0].id : "letter:clear"));
    return true;
  }
  function buildLibrary() {
    var lists = libraryLists(), visible = lists.visible, i, j, rowElement, elements, el, holder, item, pill, label, count;
    var filter = makeAction("action:library-filter", libraryFilter === "hidden" ? "Ver todas" : "Ver ocultas", "Filtrar la biblioteca", function () {
      captureView(); libraryFilter = libraryFilter === "hidden" ? "all" : "hidden"; renderView("action:library-filter");
    });
    panelHeader(libraryFilter === "hidden" ? "Aplicaciones ocultas" : "Todas las aplicaciones", "OK abre la aplicación y mantener OK, sus opciones. ↑ para buscar por letras o filtrar por categoría.", [filter]);
    if (libraryQuery) {
      pill = document.createElement("span"); pill.className = "search-pill"; pill.id = "library-query"; pill.textContent = "Buscar: " + libraryQuery.toUpperCase();
      $("panel-buttons").appendChild(pill);
    }
    if (lists.base.length) {
      /* Chips de categoría: sólo las que tienen alguna app. */
      holder = document.createElement("div"); holder.className = "library-chips"; elements = [];
      for (i = -1; i < M.CATEGORIES.length; i++) {
        item = i < 0 ? { id: "all", label: "Todas" } : M.CATEGORIES[i];
        if (!lists.counts[item.id]) continue;
        el = actionButton(makeAction("chip:" + item.id, item.label, lists.counts[item.id] + (lists.counts[item.id] === 1 ? " aplicación" : " aplicaciones") + " · OK filtra la biblioteca", chooseChip(item.id)), "chip" + (libraryChip === item.id ? " active" : ""));
        el.item.kind = "filter"; el.setAttribute("data-category", item.id); el.textContent = "";
        label = document.createElement("span"); label.textContent = item.label; count = document.createElement("span"); count.className = "chip-count"; count.textContent = String(lists.counts[item.id]);
        el.appendChild(label); el.appendChild(count); holder.appendChild(el); elements.push(el);
      }
      $("panel-list").appendChild(holder); addNavigationRow("library-chips", "Categorías", elements, holder);
      /* Barra de letras A–Z, 0–9 y Borrar. */
      holder = document.createElement("div"); holder.className = "library-letters"; elements = [];
      for (i = 0; i < M.SEARCH_KEYS.length; i++) {
        el = actionButton(makeAction("letter:" + M.SEARCH_KEYS[i], M.SEARCH_KEYS[i], "OK añade «" + M.SEARCH_KEYS[i] + "» a la búsqueda", typeLetter(M.SEARCH_KEYS[i])), "letter-key" + (M.SEARCH_KEYS[i] === "0" ? " first-digit" : ""));
        el.item.kind = "filter"; holder.appendChild(el); elements.push(el);
      }
      el = actionButton(makeAction("letter:clear", "✕ Borrar", libraryQuery ? "Borra la búsqueda «" + libraryQuery.toUpperCase() + "»" : "No hay búsqueda activa", clearLibraryQuery), "letter-key clear");
      el.item.kind = "filter"; holder.appendChild(el); elements.push(el);
      $("panel-list").appendChild(holder); addNavigationRow("library-letters", "Buscar por letras", elements, holder);
    }
    if (!visible.length) {
      $("panel-empty").textContent = libraryQuery ? "Ninguna aplicación empieza por «" + libraryQuery.toUpperCase() + "»" + (libraryChip !== "all" ? " en " + M.categoryLabel(libraryChip) : "") + ". Pulsa Volver para borrar la búsqueda."
        : libraryFilter === "hidden" ? "No hay aplicaciones ocultas." : "No se encontraron aplicaciones. Actualiza la lista desde Home.";
      $("panel-empty").className = "";
    }
    var columns = prefs.tileSize === "compact" ? 6 : 5;
    for (i = 0; i < visible.length; i += columns) {
      rowElement = document.createElement("div"); rowElement.className = "library-row"; elements = [];
      for (j = i; j < Math.min(i + columns, visible.length); j++) {
        el = decorateAppTile(makeAppTile(visible[j]), visible[j]); el.item.open = libraryOpen(visible[j]); rowElement.appendChild(el); elements.push(el);
      }
      $("panel-list").appendChild(rowElement); addNavigationRow("library:" + i, "Biblioteca", elements, rowElement, "grid");
    }
  }
  /* 1.8.0: OK corto abre la app, como en el inicio; mantener OK, Play/Pausa
     o Info abren sus opciones. */
  function libraryOpen(app) { return function () { launchApp(app); }; }
  /* Presentación de la biblioteca: la app enfocada con su categoría. */
  function updateLibraryHero(item) {
    var app = item && item.kind === "app" ? appById(item.id) || item.app : null, usage, lines;
    usage = app && prefs.usage && Object.prototype.hasOwnProperty.call(prefs.usage, app.id) ? prefs.usage[app.id] : null;
    lines = M.heroLines(item, app, app && P.isFavorite(prefs, app.id), usage ? M.lastUseLabel(usage.last, Date.now()) : "", app ? M.categoryLabel(M.appCategory(app, prefs.categories)) : "");
    /* 1.12.0: en «Ver ocultas», «Oculta por defecto · Sistema» u «Oculta». */
    if (app && libraryFilter === "hidden") lines.position = isAutoHidden(prefs, app.id) ? "Oculta por defecto · Sistema" : P.isHidden(prefs, app.id) ? "Oculta" : lines.position;
    $("library-hero-name").textContent = item ? item.name : "";
    $("library-hero-position").textContent = lines.position;
    $("library-hero-description").textContent = lines.description;
  }
  function showAppOptions(app) { if (!app) return; contextAppId = app.id; openView("options", "option:open"); }
  function buildOptions() {
    var app = appById(contextAppId), item;
    if (!app) { panelHeader("Aplicación no disponible", "La aplicación ya no aparece en el catálogo."); return; }
    panelHeader(app.name, (P.isFavorite(prefs, app.id) ? "★ Favorita" : "No está en favoritas") + (isAutoHidden(prefs, app.id) ? " · Oculta por defecto (sistema)" : P.isHidden(prefs, app.id) ? " · Oculta en el inicio" : " · Visible en el inicio"));
    item = makeAction("option:open", "Abrir aplicación", app.name, function () { var selected = appById(contextAppId); back(); if (selected) launchApp(selected); }); item.action = "open"; listOption(item);
    item = makeAction("option:favorite", P.isFavorite(prefs, app.id) ? "Quitar de favoritas" : "Añadir a favoritas", "Se aplica de inmediato", function () {
      var selected = appById(contextAppId), was = P.isFavorite(prefs, contextAppId);
      if (selected) saveChange(P.toggleFavorite(prefs, contextAppId), was ? "Quitada de favoritas." : "Añadida a favoritas.", "option:favorite");
    }); item.action = "favorite"; listOption(item);
    item = makeAction("option:hidden", isAutoHidden(prefs, app.id) ? "Mostrar" : P.isHidden(prefs, app.id) ? "Restaurar en el inicio" : "Ocultar del inicio",
      isAutoHidden(prefs, app.id) ? "App del sistema oculta por defecto · OK la muestra en Home" : "La aplicación sigue instalada", function () {
      var selected = appById(contextAppId); if (selected) toggleAppHidden(selected, "option:hidden");
    }); item.action = "hidden"; listOption(item);
    item = makeAction("option:reorder", "Cambiar orden", reorderScope(app.id) === "favorites" ? "Mover en la barra de favoritas" : "Mover en el orden de aplicaciones", function () {
      startReorder(appById(contextAppId), reorderScope(contextAppId));
    }); item.action = "reorder"; if (!HOME_PAGE_SIZE || !isHiddenNow(prefs, app.id)) listOption(item);
    /* 1.8.0: OK pasa a la siguiente categoría y la guarda. */
    item = makeAction("option:category", "Categoría: " + M.categoryLabel(M.appCategory(app, prefs.categories)), "OK cambia a la siguiente categoría", function () {
      var selected = appById(contextAppId);
      if (selected) saveChange(P.setCategory(prefs, selected.id, M.nextCategory(M.appCategory(selected, prefs.categories)), M.defaultCategory(selected)), "Categoría guardada.", "option:category");
    }); item.action = "category"; listOption(item);
  }
  /* «Recientes» no tiene orden manual: su respaldo es la fila de favoritas. */
  function reorderScope(appId) { return !HOME_PAGE_SIZE && P.isFavorite(prefs, appId) && prefs.homeMode !== "all" ? "favorites" : "order"; }
  /* 1.15.1: perfiles por persona. Cambiar de perfil guarda los campos
     personales del activo y carga los del elegido (HomePreferences.switchProfile);
     el catálogo actual completa su orden. */
  function profileById(id) { var list = P.listProfiles(prefs), i; for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function activateProfile(id, keepId) {
    var target = profileById(id), next;
    if (!target) return false;
    if (target.active) { message("Perfil activo: " + target.name); return false; }
    next = P.reconcile(P.switchProfile(prefs, id), apps, { keepMissing: !!loadWarning || !apps.length });
    lastHomeAppId = null;
    saveChange(next, "Perfil: " + target.name, keepId);
    /* Su fuente fija empieza si el recuadro está libre (no se corta lo que suena). */
    var pinned = prefs.pinnedMedia ? mediaById(prefs.pinnedMedia) : null;
    if (pinned && player && !playerActive() && !opensOutside(pinned) && !document.hidden) player.play(pinned);
    return true;
  }
  function cycleProfile(delta) {
    var list = P.listProfiles(prefs), i, at = 0;
    if (list.length < 2) { message("Sólo hay un perfil. Crea otro en Perfiles…"); return; }
    for (i = 0; i < list.length; i++) if (list[i].active) at = i;
    activateProfile(list[(at + (delta < 0 ? -1 : 1) + list.length) % list.length].id, "setting:profile");
  }
  function showProfileOptions(id) { if (!profileById(id)) return; profileContextId = id; openView("profile-options", "profile-option:rename"); }
  /* Vuelve a la lista de perfiles (o la abre) con el foco en focusId. */
  function backToProfiles(focusId) {
    var frame;
    while (returnStack.length && returnStack[returnStack.length - 1].view !== "profiles") returnStack.pop();
    frame = returnStack.pop();
    if (frame) { frame.focusId = focusId; restoreFrame(frame); } else { view = "profiles"; renderView(focusId); }
  }
  function buildProfiles() {
    var list = P.listProfiles(prefs), i, item;
    panelHeader("Perfiles", "Cada persona tiene sus favoritas, orden, apps ocultas, historial y fuente fija. Fondo, reloj, mando y enlaces guardados son comunes.");
    for (i = 0; i < list.length; i++) {
      item = makeAction("profile:" + list[i].id, list[i].name + (list[i].active ? " · activo" : ""), (list[i].active ? "Perfil en uso" : "OK activa este perfil") + " · mantener OK o ▶⏸: renombrar o eliminar",
        (function (id) { return function () { if (!activateProfile(id, "profile:" + id)) renderView("profile:" + id); }; })(list[i].id));
      item.kind = "profile"; item.profileId = list[i].id; item.setting = "profile-" + list[i].id; listOption(item);
    }
    listOption(makeAction("profile:new", "Nuevo perfil", list.length < P.MAX_PROFILES ? "Elige un nombre sugerido o escríbelo con letras" : "Máximo " + P.MAX_PROFILES + " perfiles · elimina uno para crear otro", function () {
      if (!P.canAddProfile(prefs)) { message("Máximo " + P.MAX_PROFILES + " perfiles. Elimina uno para crear otro.", true); return; }
      profileDraft = { mode: "new", id: null, text: "" }; openView("profile-name", "profile-name:type");
    }));
  }
  function buildProfileOptions() {
    var profile = profileById(profileContextId), count = P.listProfiles(prefs).length;
    if (!profile) { panelHeader("Perfil no disponible", "Ese perfil ya no existe."); return; }
    panelHeader("Perfil: " + profile.name, profile.active ? "Perfil en uso" : "Perfil sin usar ahora");
    if (!profile.active) listOption(makeAction("profile-option:activate", "Activar", "Usar este perfil en Home", function () { var id = profileContextId; backToProfiles("profile:" + id); activateProfile(id, "profile:" + id); }));
    listOption(makeAction("profile-option:rename", "Renombrar", "Nombre actual: " + profile.name, function () { profileDraft = { mode: "rename", id: profileContextId, text: "" }; openView("profile-name", "profile-name:type"); }));
    listOption(makeAction("profile-option:remove", "Eliminar", count < 2 ? "No se puede eliminar el único perfil" : "Borra sus favoritas, orden e historial · pide confirmación", function () {
      if (P.listProfiles(prefs).length < 2) { message("No se puede eliminar el único perfil.", true); return; }
      openView("profile-delete", "profile-delete:cancel");
    }));
  }
  function buildProfileDelete() {
    var profile = profileById(profileContextId);
    if (!profile) { panelHeader("Perfil no disponible", "Ese perfil ya no existe."); return; }
    panelHeader("Eliminar «" + profile.name + "»", "Se borran sus favoritas, orden, apps ocultas, historial y fuente fija. Las aplicaciones y los demás perfiles no cambian." + (profile.active ? " Después se activará otro perfil." : ""));
    var holder = document.createElement("div"), cancel = actionButton(makeAction("profile-delete:cancel", "Cancelar", "Conservar el perfil", back), "confirm-button");
    var remove = actionButton(makeAction("profile-delete:confirm", "Eliminar perfil", "Eliminar " + profile.name, function () {
      var id = profileContextId, gone = profileById(id), next;
      if (!gone || P.listProfiles(prefs).length < 2) { back(); return; }
      next = P.reconcile(P.removeProfile(prefs, id), apps, { keepMissing: !!loadWarning || !apps.length });
      var saved = persist(next); profileContextId = null; lastHomeAppId = null;
      backToProfiles("profile:" + P.activeProfile(prefs).id);
      message(saved ? "Perfil «" + gone.name + "» eliminado. Activo: " + P.activeProfile(prefs).name : "El cambio funciona ahora, pero no se pudo guardar. Se perderá al cerrar Home.", !saved);
    }), "confirm-button danger");
    holder.className = "confirm-actions"; holder.appendChild(cancel); holder.appendChild(remove); $("panel-list").appendChild(holder);
    addNavigationRow("profile-delete", "Confirmación", [cancel, remove], holder);
  }
  /* Crear o renombrar con el nombre elegido; vuelve a la lista. */
  function applyProfileName(name) {
    var draft = profileDraft, before = P.listProfiles(prefs), next, after, created = null, i, j, found;
    name = P.profileName(name);
    if (!draft || !name) { message("Escribe un nombre de 1 a " + P.PROFILE_NAME_MAX + " letras.", true); return; }
    next = draft.mode === "rename" ? P.renameProfile(prefs, draft.id, name) : P.addProfile(prefs, name);
    after = P.listProfiles(next);
    if (draft.mode === "new") {
      for (i = 0; i < after.length && !created; i++) { for (found = false, j = 0; j < before.length; j++) if (before[j].id === after[i].id) found = true; if (!found) created = after[i]; }
      if (!created) { message("No se pudo crear el perfil (máximo " + P.MAX_PROFILES + ").", true); return; }
    } else for (i = 0; i < after.length; i++) if (after[i].id === draft.id) created = after[i];
    if (!created) { message("Ese perfil ya no existe.", true); return; }
    if (draft.mode === "new") next = P.reconcile(next, apps, { keepMissing: !!loadWarning || !apps.length });
    var saved = persist(next); profileDraft = null;
    backToProfiles("profile:" + created.id);
    message(saved ? (draft.mode === "new" ? "Perfil «" + created.name + "» creado. OK lo activa." : "Perfil renombrado: " + created.name) : "El cambio funciona ahora, pero no se pudo guardar. Se perderá al cerrar Home.", !saved);
  }
  function buildProfileName() {
    var list = P.listProfiles(prefs), names = P.PROFILE_SUGGESTIONS, i, j, taken, item, renaming = profileDraft && profileDraft.mode === "rename" ? profileById(profileDraft.id) : null;
    if (!profileDraft) { panelHeader("Nombre del perfil", "No hay ningún perfil en edición."); return; }
    panelHeader(renaming ? "Renombrar «" + renaming.name + "»" : "Nuevo perfil", "Elige un nombre o escríbelo letra a letra. Volver cancela.");
    listOption(makeAction("profile-name:type", "Escribir nombre…", "Teclado en pantalla: A–Z, Ñ, espacio y borrar (máx. " + P.PROFILE_NAME_MAX + ")", function () { profileDraft.text = ""; openView("profile-keyboard", "profile-key:A"); }));
    for (i = 0; i < names.length; i++) {
      for (taken = false, j = 0; j < list.length; j++) if (list[j].name.toLowerCase() === names[i].toLowerCase() && !(renaming && list[j].id === renaming.id)) taken = true;
      if (taken) continue;
      item = makeAction("profile-name:" + names[i], names[i], "Nombre sugerido · OK lo usa", (function (name) { return function () { applyProfileName(name); }; })(names[i]));
      listOption(item);
    }
  }
  var PROFILE_KEYS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  function appendLetterRow(prefix, handler) {
    var holder = document.createElement("div"), elements = [];
    holder.className = "library-letters profile-letters";
    PROFILE_KEYS.forEach(function (letter) {
      var keyId = prefix + "-key:" + letter;
      var button = actionButton(makeAction(keyId, letter, "OK añade «" + letter + "»", handler(letter, keyId)), "letter-key");
      holder.appendChild(button); elements.push(button);
    });
    $("panel-list").appendChild(holder);
    addNavigationRow(prefix + "-letters", "Letras", elements, holder);
  }
  /* Mayúscula al principio de cada palabra; el resto, minúsculas. */
  function draftName(raw) { return String(raw || "").toLowerCase().replace(/(^|\s)(\S)/g, function (all, space, letter) { return space + letter.toUpperCase(); }); }
  function typeProfileKey(letter, keepId) {
    return function () {
      if (!profileDraft) return;
      if (letter === "space") { if (profileDraft.text && !/\s$/.test(profileDraft.text) && profileDraft.text.length < P.PROFILE_NAME_MAX) profileDraft.text += " "; }
      else if (letter === "delete") profileDraft.text = profileDraft.text.slice(0, -1);
      else if (profileDraft.text.length < P.PROFILE_NAME_MAX) profileDraft.text += letter;
      else message("Máximo " + P.PROFILE_NAME_MAX + " caracteres.");
      renderView(keepId);
    };
  }
  function buildProfileKeyboard() {
    var holder, elements = [], el, pill, typed = profileDraft ? draftName(profileDraft.text) : "";
    panelHeader("Escribir nombre", "Elige letras con las flechas y OK. «Listo» guarda; Volver cancela.");
    pill = document.createElement("span"); pill.className = "search-pill"; pill.id = "profile-typed"; pill.textContent = "Nombre: " + (typed || "…");
    $("panel-buttons").appendChild(pill);
    appendLetterRow("profile", typeProfileKey);
    holder = document.createElement("div"); holder.className = "library-letters profile-letters"; elements = [];
    el = actionButton(makeAction("profile-key:space", "Espacio", "Añade un espacio", typeProfileKey("space", "profile-key:space")), "letter-key clear first-key"); holder.appendChild(el); elements.push(el);
    el = actionButton(makeAction("profile-key:delete", "✕ Borrar", "Borra la última letra", typeProfileKey("delete", "profile-key:delete")), "letter-key clear"); holder.appendChild(el); elements.push(el);
    el = actionButton(makeAction("profile-key:done", "✓ Listo", typed ? "Guardar «" + typed + "»" : "Escribe al menos una letra", function () {
      var name = profileDraft ? draftName(profileDraft.text).replace(/^\s+|\s+$/g, "") : "";
      if (!name) { message("Escribe al menos una letra."); return; }
      applyProfileName(name);
    }), "letter-key clear"); holder.appendChild(el); elements.push(el);
    $("panel-list").appendChild(holder); addNavigationRow("profile-actions", "Teclado", elements, holder);
  }
  /* Rótulo del perfil activo junto al reloj (sólo con más de un perfil). */
  function paintProfileBadge() {
    var badge = $("profile-badge"), list, clockBlock = $("clock-block"), current;
    if (!badge) return;
    list = prefs && P.listProfiles ? P.listProfiles(prefs) : [];
    if (list.length < 2) { badge.className = "profile-badge hidden"; badge.textContent = ""; return; }
    current = P.activeProfile(prefs); badge.textContent = "Perfil: " + current.name; badge.className = "profile-badge";
    badge.style.right = clockBlock && clockBlock.className.indexOf("hidden") < 0 ? (clockBlock.offsetWidth + 28) + "px" : "0px";
  }
  function buildConfirm() {
    panelHeader("Restablecer Home", "Se restablecerán las favoritas, el orden, las apps ocultas y la apariencia. Tus aplicaciones siguen instaladas. También se borran los enlaces guardados, el historial de uso de Home y los perfiles (queda sólo «Principal»).");
    var holder = document.createElement("div"), cancel = actionButton(makeAction("confirm:cancel", "Cancelar", "Conservar mis preferencias", back), "confirm-button");
    var reset = actionButton(makeAction("confirm:reset", "Restablecer preferencias", "Restablecer Home", function () {
      var saved = persist(defaultPreferences()); returnStack = []; view = "home"; renderView();
      message(saved ? "Preferencias de Home restablecidas." : "Preferencias restablecidas en memoria; no se pudieron guardar.", !saved);
    }), "confirm-button danger");
    holder.className = "confirm-actions"; holder.appendChild(cancel); holder.appendChild(reset); $("panel-list").appendChild(holder);
    addNavigationRow("confirmation", "Confirmación", [cancel, reset], holder);
  }
  function buildRemoteSetup() {
    var banner = document.createElement("div"), strong = document.createElement("strong"), copy = document.createElement("span");
    var keyLabel = M.remoteKeyLabel ? M.remoteKeyLabel(prefs.customHomeKey) : "Botón Azul";
    panelHeader("Botón Home del mando", HP ? "Configura la tecla blanca Netflix, la tecla directa y Acceso rápido en tu televisor LG." : "Asigna el botón inferior Disney+ (o TV Plus) para abrir y fijar LFA Home sin que se reinicie otra app.");
    banner.className = "remote-banner";
    strong.textContent = HP ? "LG webOS · Tecla Netflix y tecla directa" : "Samsung Tizen · Botón físico Disney+ asignado como LFA Home";
    copy.textContent = HP
      ? "En LG puedes asignar la tecla blanca Netflix directamente a LFA Home, usar " + keyLabel + " desde las apps LFA o mantener pulsado 0 para fijar Home en un número del mando."
      : "Selecciona arriba «Botón físico Disney+» (el último botón de abajo del mando). Al pulsarlo, LFA Home pasa al frente y bloquea durante 12 segundos cualquier intento tardío de Disney+ o TV Plus de volver a abrirse encima. Si abres Disney+ o TV Plus desde dentro de LFA Home, funcionan con normalidad.";
    banner.appendChild(strong); banner.appendChild(copy);
    $("panel-list").appendChild(banner);
    if (!HP) {
      [
        { id: "disney", title: "Botón físico Disney+ (abajo en el mando) → LFA Home", note: "Recomendado · El último botón inferior del mando abre y mantiene fijo LFA Home" },
        { id: "both", title: "Botones Disney+ y Samsung TV Plus → LFA Home", note: "Cualquiera de los dos botones inferiores abre y fija LFA Home" },
        { id: "tvplus", title: "Botón físico Samsung TV Plus → LFA Home", note: "Convierte únicamente el botón TV Plus en tu botón Home" },
        { id: "off", title: "Desactivar botones físicos de marca", note: "Disney+ y TV Plus conservan su función original de fábrica" }
      ].forEach(function (entry) {
        var active = prefs.samsungHomeButton === entry.id;
        listOption(makeAction("remote:mode:" + entry.id, (active ? "✓ " : "") + entry.title, (active ? "Activo ahora · " : "") + entry.note, function () {
          saveChange(P.withOption(prefs, "samsungHomeButton", entry.id), entry.id === "off" ? "Atajo físico de Samsung desactivado." : "Atajo activado: " + M.samsungHomeButtonLabel(entry.id) + " abrirá y mantendrá LFA Home.", "remote:mode:" + entry.id);
        }));
      });
    } else if (HP.setWhiteKey) {
      listOption(whiteKeyChoice());
      listOption(makeAction("remote:lg-quick", "Acceso rápido numérico (teclas 1–9)", "Mantén pulsado 0 en tu mando LG para asignar LFA Home a un número libre", function () {
        message("Mantén pulsado 0 en tu mando LG para abrir Acceso rápido y asigna LFA Home a un número.");
      }));
    }
    listOption(makeAction("remote:capture", capturingHomeKey ? "● Esperando tecla estándar… Pulsa Azul, Guía, Info o Canal" : "Tecla auxiliar dentro de apps LFA: " + keyLabel,
      capturingHomeKey ? "Pulsa una tecla estándar del mando (" + (HP ? "la tecla Netflix se activa arriba" : "los botones blancos de marca se eligen arriba") + " · Volver cancela)" : (HP ? "Tecla directa adicional dentro de LFA Home y apps LFA (Azul, Guía, Info, Canal)" : "Sólo para teclas estándar (Azul, Guía, Info, Canal) · Los botones Disney+ y TV Plus se activan arriba") + (lastCapturedKey ? " · Última: " + M.remoteKeyLabel(lastCapturedKey) : ""),
      function () {
        capturingHomeKey = !capturingHomeKey;
        renderView("remote:capture");
        if (capturingHomeKey) message(HP ? "Pulsa una tecla estándar (Azul, Guía, Info, Canal). Para la tecla Netflix usa la opción de arriba." : "Pulsa una tecla estándar (Azul, Guía, Info, Canal). Para Disney+ usa la primera opción de arriba.");
      }));
    if (prefs.customHomeKey !== 406) {
      listOption(makeAction("remote:reset-key", "Restablecer tecla auxiliar a Azul (406)", "Vuelve a usar la tecla Azul estándar en LFA Home y apps LFA", function () {
        saveChange(P.withOption(prefs, "customHomeKey", 406), "Tecla auxiliar restablecida a Botón Azul.", "remote:capture");
      }));
    }
  }
  /* Diagnóstico (1.7.4): últimas aperturas y retornos, legibles sin depurador. */
  function buildReturnLog() {
    var lines = returnLogText(5), i, item;
    panelHeader("Registro de retorno", "Últimas aperturas desde Home y si Home volvió al cerrarlas (más reciente primero). Archivo privado: " + (returnLog() ? returnLog().path : "no disponible") + ".");
    if (!lines.length) { $("panel-empty").textContent = "Aún no hay registros. Abre una app desde Home y ciérrala con Volver."; $("panel-empty").className = ""; return; }
    for (i = 0; i < lines.length; i++) { item = makeAction("return-log:" + i, lines[i], "", function () {}); listOption(item); }
  }
  function buildSources() {
    panelHeader(HP ? "Entradas de la televisión" : "Entradas del proyector", "Selecciona una entrada. Esta pantalla no muestra vídeo en directo.");
    if (!sources.length) { $("panel-empty").textContent = "El dispositivo no comunica entradas disponibles."; $("panel-empty").className = ""; return; }
    addCarousel("sources", "Entradas", sources, makeSourceTile, $("panel-list"));
  }
  function makeSourceTile(source) {
    var label = source.connected === null ? "Abrir entrada" : source.connected ? "Conectada" : "Sin señal";
    var item = makeAction(source.id, source.name, label, function () { openSource(source); }); item.kind = "source";
    var el = makeSpecialTile(item, "source"), state = document.createElement("span");
    el.className += source.connected === false ? " disconnected" : ""; state.className = "source-state"; state.textContent = label;
    el.querySelector(".tile-art").appendChild(state); return el;
  }
  function reorderApps() {
    if (!reorder) return [];
    if (HOME_PAGE_SIZE) return pagedApps(reorder.draft);
    if (reorder.scope === "favorites") {
      var list = P.orderedApps(apps, reorder.draft), out = [], ids = reorder.draft.favorites, i, j;
      for (i = 0; i < ids.length; i++) for (j = 0; j < list.length; j++) if (list[j].id === ids[i] && !P.isHidden(reorder.draft, ids[i])) out.push(list[j]);
      return out;
    }
    return P.orderedApps(apps, reorder.draft).filter(function (app) { return !isAutoHidden(reorder.draft, app.id); });
  }
  function startReorder(app, scope) {
    var frame, list;
    if (view === "options") frame = returnStack.length ? clone(returnStack[returnStack.length - 1]) : { view: "home", focusId: contextAppId, r: 1, c: 0, offsets: {} };
    else frame = captureView();
    scope = HOME_PAGE_SIZE ? "order" : scope || (prefs.homeMode !== "all" ? "favorites" : "order");
    reorder = { scope: scope, appId: app && app.id, draft: clone(prefs), returnFrame: frame, fromOptions: view === "options" };
    list = reorderApps();
    if (!list.length) { reorder = null; message(HOME_PAGE_SIZE ? "Muestra alguna aplicación desde Todas las apps para poder ordenar." : "Añade una favorita desde Todas las apps para poder ordenar la barra."); return; }
    if (!reorder.appId || !list.some(function (candidate) { return candidate.id === reorder.appId; })) reorder.appId = list[0].id;
    view = "reorder"; renderView(reorder.appId);
  }
  function buildReorder() {
    if (HOME_PAGE_SIZE) { buildAppPage(reorderApps(), reorder.appId, "Ordenar aplicaciones"); $("home-note").textContent = "Las flechas mueven la aplicación seleccionada."; return; }
    addCarousel("reorder", reorder.scope === "favorites" ? "Ordenar favoritas" : "Ordenar aplicaciones", reorderApps(), function (app) { return decorateAppTile(makeAppTile(app), app); }, $("rows"));
  }
  function moveReorder(delta, acrossPage) {
    var list = reorderApps(), at = -1, i, target, rawIds = reorder.draft[reorder.scope], from, to;
    for (i = 0; i < list.length; i++) if (list[i].id === reorder.appId) { at = i; break; }
    if (at < 0) return;
    target = at + delta;
    if (acrossPage) {
      var start = (Math.floor(at / HOME_PAGE_SIZE) + delta) * HOME_PAGE_SIZE;
      if (start < 0 || start >= list.length) return;
      target = Math.min(start + at % HOME_PAGE_SIZE, list.length - 1);
    }
    if (target < 0 || target >= list.length) return;
    from = rawIds.indexOf(reorder.appId); to = rawIds.indexOf(list[target].id);
    if (from < 0 || to < 0) return;
    reorder.draft = P.move(reorder.draft, reorder.appId, to - from, reorder.scope); renderView(reorder.appId);
  }
  function confirmReorder() {
    var frame = reorder.returnFrame, saved = persist(reorder.draft), fromOptions = reorder.fromOptions;
    if (HOME_PAGE_SIZE && frame && frame.view === "home") frame.focusId = reorder.appId;
    reorder = null; if (fromOptions && returnStack.length) returnStack.pop(); restoreFrame(frame);
    message(saved ? "Orden guardado." : "El orden cambió, pero no se pudo guardar al cerrar Home.", !saved);
  }
  function applyAppearance() {
    var preferences = currentPreferences() || {}, compact = preferences.tileSize === "compact";
    TILE_WIDTH = compact ? 232 : 296; TILE_STEP = compact ? 256 : 320;
    $("stage").className = (compact ? "compact " : "") + (preferences.background === "dark" ? "dark-background " : "theme-color ") + (preferences.tileArt === "full" ? "art-full " : preferences.tileArt === "flat" ? "art-flat " : "art-rich ") + "view-" + view;
    if (HOME_PAGE_SIZE) $("stage").className += " paged-apps";
    if (CONFIG.appName) $("stage").className += " lfa-cards";
    if (LFA_CONTROLS) $("stage").className += " lfa-control-layout" + (view === "home" || view === "home-menu" ? " lfa-home-layout" : "");
    $("clock-block").className = preferences.showClock === false ? "hidden" : "";
    updateAmbient(null);
    applyDim(); paintProfileBadge();
  }
  /* 1.10.0: renderView medido con performance.now() (snapshot().perf). */
  function renderView(keepId) {
    if (!prefsLoaded) return;
    var clock0 = window.performance && performance.now ? performance.now() : Date.now(), ms;
    renderCount = { tiles: 0, reused: 0, created: 0, hits: 0 };
    try { renderViewNow(keepId); } finally {
      ms = Math.round(((window.performance && performance.now ? performance.now() : Date.now()) - clock0) * 10) / 10;
      perf.renderMs = ms; perf.tiles = renderCount.tiles; perf.artCacheHits = renderCount.hits; perf.reusedTiles = renderCount.reused; perf.createdTiles = renderCount.created;
      perf.view = view; perf.renders++; if (perf.firstRenderMs === null) perf.firstRenderMs = ms; if (ms > perf.maxRenderMs) perf.maxRenderMs = ms;
      perf.history.push({ view: view, ms: ms, tiles: renderCount.tiles, reused: renderCount.reused }); if (perf.history.length > 12) perf.history.shift();
      renderCount = null;
    }
  }
  function renderViewNow(keepId) {
    var previous = viewMemory[view] || {}, menuOpen = view === "home-menu", i, j, found = false, row;
    if (lastRenderedView === "weather-city" && view !== "weather-city") clearWeatherDraft();
    if (focused && focused.item && !keepId && view === lastRenderedView) keepId = focused.item.id;
    if (rows.length && focused && view === lastRenderedView) { previous = captureView(); if (!keepId) keepId = previous.focusId; }
    heroToken++; focused = null; rows = []; $("rows").textContent = ""; $("panel-list").textContent = ""; $("panel-empty").className = "hidden"; $("panel-content").scrollTop = 0;
    applyAppearance(); header(); buildPlayerControls(); updateAgenda(new Date());
    $("panel").className = view === "home" || menuOpen || view === "reorder" ? "hidden" : "";
    $("hero").className = view === "home" || menuOpen || view === "reorder" || view === "media" ? "" : "hidden";
    $("viewport").className = view === "home" || menuOpen || view === "reorder" ? "" : "hidden";
    if ($("dock-meta")) $("dock-meta").className = LFA_CONTROLS && (view === "home" || menuOpen) ? "" : "hidden";
    $("pills").className = view === "home" && !LFA_CONTROLS ? "" : "hidden";
    $("home-command-overlay").className = menuOpen ? "" : "hidden";
    $("library-hero").className = view === "library" ? "" : "hidden";
    if (menuOpen) { buildHome(lastHomeAppId); rows = []; buildHomeCommandMenu(); }
    else if (view === "home") buildHome(keepId || previous.focusId); else if (view === "settings") buildSettings(); else if (view === "library") buildLibrary();
    else if (view === "options") buildOptions(); else if (view === "confirm") buildConfirm(); else if (view === "sources") buildSources(); else if (view === "reorder") buildReorder(); else if (view === "media") buildMedia(); else if (view === "media-add") buildMediaAdd(); else if (view === "media-manage") buildMediaManage(); else if (view === "media-options") buildMediaOptions(); else if (view === "return-log") buildReturnLog(); else if (view === "remote-setup") buildRemoteSetup();
    else if (view === "profiles") buildProfiles(); else if (view === "profile-options") buildProfileOptions(); else if (view === "profile-delete") buildProfileDelete(); else if (view === "profile-name") buildProfileName(); else if (view === "profile-keyboard") buildProfileKeyboard();
    else if (view === "weather") buildWeather(); else if (view === "weather-city") buildWeatherCity();
    for (i = 0; i < rows.length; i++) {
      row = rows[i]; if (row.lane && previous.offsets && typeof previous.offsets[row.id] === "number") row.offset = previous.offsets[row.id];
      for (j = 0; j < row.items.length; j++) if (row.items[j].item.id === (keepId || previous.focusId)) { cur = { r: i, c: j }; found = true; break; }
      if (found) break;
    }
    if (!found) {
      cur = { r: rows.length > 1 ? Math.max(1, Math.min(previous.r || 1, rows.length - 1)) : 0, c: 0 };
      if (HOME_PAGE_SIZE && view === "home" && rows.length && rows[rows.length - 1].id === "home") cur.r = rows.length - 1;
      if (rows[cur.r]) cur.c = Math.min(previous.c || 0, rows[cur.r].items.length - 1);
      /* Biblioteca: sin foco previo, la primera tarjeta, no las letras. */
      if (view === "library") for (i = 0; i < rows.length; i++) if (/^library:/.test(rows[i].id)) { if (cur.r < i) cur = { r: i, c: 0 }; break; }
    }
    $("panel-content").scrollTop = previous.scroll || 0;
    ready = true; lastRenderedView = view; renderFocus(); syncPlayer();
  }
  var lastRenderedView = null;
  function updateRow(row, selected) {
    var plan = M.scrollFor(row.offset, selected, row.items.length, { tileWidth: TILE_WIDTH, step: TILE_STEP, padding: TRACK_PADDING, viewportWidth: row.lane.clientWidth || 1744 });
    row.offset = plan.offset; row.maxOffset = plan.max; row.strip.style.webkitTransform = row.strip.style.transform = "translateX(" + -row.offset + "px)";
    row.previous.className = "edge-arrow previous" + (row.offset > 1 ? " shown" : ""); row.next.className = "edge-arrow next" + (row.offset < row.maxOffset - 1 ? " shown" : "");
    if (HP && HP.layoutRow) HP.layoutRow(row);
  }
  function ensureVisible(row) {
    if (row.lane) updateRow(row, cur.c);
    if (view === "home" || view === "home-menu" || view === "reorder" || row.id === "panel-actions" || row.id === "player-controls") return;
    /* offsetTop se refiere a panel-list, no al área desplazable. Medir ambos
       rectángulos incluye su padding y sigue funcionando al escalar a 720p. */
    var content = $("panel-content"), bounds = content.getBoundingClientRect(), target = row.element.getBoundingClientRect();
    var scale = $("stage").getBoundingClientRect().width / 1920, margin, delta = 0;
    if (!isFinite(scale) || scale <= 0) scale = 1;
    margin = 12 * scale;
    if (target.top < bounds.top + margin) delta = target.top - bounds.top - margin;
    else if (target.bottom > bounds.bottom - margin) delta = target.bottom - bounds.bottom + margin;
    if (delta) content.scrollTop = Math.max(0, content.scrollTop + delta / scale);
  }
  function renderFocus() {
    if (!rows[cur.r] || !rows[cur.r].items.length) return;
    cur.c = Math.max(0, Math.min(cur.c, rows[cur.r].items.length - 1));
    var row = rows[cur.r], el = row.items[cur.c], heroApp, homeApps;
    if (focused && focused !== el) { focused.className = focused.className.replace(/\s+focus\b/g, ""); focused.setAttribute("aria-selected", "false"); }
    if (el.className.indexOf(" focus") < 0) el.className += " focus"; el.setAttribute("aria-selected", "true"); focused = el; row.index = cur.c; ensureVisible(row);
    if (el.item.kind === "app") updateAmbient(el.item.app || appById(el.item.id));
    if (view === "home" || view === "reorder") {
      if (el.item.kind === "app") { lastHomeAppId = el.item.id; updateHero(el.item); }
      else if (row.id !== "actions" && !(LFA_CONTROLS && row.id === "player-controls")) updateHero(el.item);
      else {
        heroApp = appById(lastHomeAppId);
        if (!heroApp || isHiddenNow(currentPreferences(), heroApp.id)) {
          homeApps = HOME_PAGE_SIZE ? pagedApps(currentPreferences()) : P.getHomeApps(apps, currentPreferences()); heroApp = homeApps.length ? homeApps[HOME_PAGE_SIZE * homePage] : null;
        }
        if (heroApp) updateHero({ id: heroApp.id, name: heroApp.name, app: heroApp, kind: "app" });
        else updateHero(makeAction("action:library", "Todas las apps", "Elige y organiza tus aplicaciones", function () {}));
      }
    }
    if (view === "library") {
      if (row.id === "library-letters") libraryLetterIndex = cur.c;
      else if (/^library:/.test(row.id)) libraryGridCol = cur.c;
      if (el.item.kind === "app") libraryLastAppId = el.item.id;
      updateLibraryHero(el.item);
    }
    if (playerActive()) syncPlayer();
    renderHelp(el.item.kind === "app", el.item.kind === "media");
    $("navigation-status").textContent = LFA_CONTROLS && view === "home" ? "" : row.totalApps ? (row.page * HOME_PAGE_SIZE + cur.c + 1) + " / " + row.totalApps : row.lane ? (cur.c + 1) + " / " + row.items.length : "";
    $("catalog-status").textContent = catalogCount() + " aplicaciones" + (loadWarning ? " · Lista local" : "");
  }
  /* Leyenda inferior: sólo las teclas que tiene el mando elegido. El del
     Freestyle (remoteLayout «freestyle», por defecto) no tiene colores, Info
     ni números; con «full» se añaden sus pastillas. Las teclas de color
     funcionan siempre, aunque no se anuncien. */
  function helpParts(isApp, isMedia) {
    if (view === "home-menu") return ["↑ ↓ Elegir", "OK Abrir", "Volver Cerrar menú"];
    var full = !!(prefs && prefs.remoteLayout === "full");
    var colors = !full ? [] : isApp ? [["red", "Favorita"], ["green", "Ordenar"], ["yellow", view === "library" ? "Ocultar / restaurar" : "Ocultar"], ["blue", "Ajustes"]] : [["blue", "Ajustes"]];
    if (view === "media") {
      var selected = focused && focused.item, openLabel = "OK Abrir";
      if (selected && selected.kind === "volley-video") openLabel = "OK Abrir en YouTube";
      else if (isMedia) {
        openLabel = opensOutside(selected.media) ?
          (selected.media.kind === "youtube" ? "OK Abrir en YouTube" : "OK Abrir en Internet") : "OK Reproducir";
      }
      return ["↑ ↓ Elegir", openLabel, isMedia ? "Mantener OK Opciones" : null,
        isMedia ? (playerActive() && selected.media.id === playerState.id ? "▶⏸ Pausar" : "▶⏸ Opciones") : playerActive() ? "▶⏸ Pausar" : null, "Volver Inicio"];
    }
    if (view === "media-add") return ["↑ ↓ Elegir campo", "OK Escribir / guardar", "Volver Atrás"];
    if (view === "profiles") return ["↑ ↓ Elegir", focused && focused.item && focused.item.kind === "profile" ? "OK Activar" : "OK Elegir", focused && focused.item && focused.item.kind === "profile" ? "Mantener OK / ▶⏸ Opciones" : null, "Volver Atrás"];
    if (view === "profile-keyboard") return ["← → ↑ ↓ Elegir", "OK Escribir", "Volver Cancelar"];
    if (view === "weather-city") return ["← → ↑ ↓ Elegir", "OK Escribir / seleccionar", "Volver Atrás"];
    if (view === "reorder") return HOME_PAGE_SIZE ? ["← → Mover un lugar", "↑ ↓ Mover de grupo", "OK Guardar", "Volver Cancelar"] : ["← → Mover", full ? "OK" : "OK Guardar", full ? ["green", "Guardar"] : null, "Volver Cancelar"];
    if (view === "library") return ["← → ↑ ↓ Elegir", "OK Abrir / Filtrar", isApp ? (full ? "Mantener OK / Info Opciones" : "Mantener OK Opciones") : null, isApp ? (playerActive() ? "▶⏸ " + playerLabel() : "▶⏸ Opciones") : null, "CH ▲▼ Página"].concat(colors,
      [libraryQuery ? "Volver Borrar búsqueda" : returnStack.length && returnStack[returnStack.length - 1].view !== "home" ? "Volver Atrás" : "Volver Inicio"]);
    if (view === "home" && HOME_PAGE_SIZE) return ["← → Elegir", LFA_CONTROLS ? "↑ ↓ Más apps y controles" : "↑ ↓ Cambiar de grupo", "OK Abrir", isApp ? "Mantén OK para ver opciones" : null, playerActive() ? "▶⏸ " + playerLabel() : !HP && isApp ? "▶⏸ Opciones" : null].concat(colors);
    if (view === "home") return ["← → Elegir", "↑ Controles", isMedia ? (opensOutside(focused.item.media) ? (focused.item.media.kind === "youtube" ? "OK Abrir en YouTube" : "OK Abrir en Internet") : "OK Ver en el recuadro") : "OK Abrir", isApp ? (full ? "Mantener OK / Info Opciones" : "Mantener OK Opciones") : isMedia ? "Mantener OK Opciones" : null, isApp ? (playerActive() ? "▶⏸ " + playerLabel() : "▶⏸ Opciones") : isMedia ? (playerActive() && focused && focused.item.media && focused.item.media.id === playerState.id ? "▶⏸ " + playerLabel() : "▶⏸ Opciones") : null, "CH ▲▼ Fila"].concat(colors, [full && favoriteApps().length ? "1–9 Favorita · 0 Todas" : null, "Home Salir"]);
    return ["↑ ↓ Elegir", "OK Cambiar / abrir", "Volver Atrás"];
  }
  function renderHelp(isApp, isMedia) {
    var holder = $("help-text"), parts = helpParts(isApp, isMedia), i, part, el, pill;
    if (HP) for (i = 0; i < parts.length; i++) if (typeof parts[i] === "string") parts[i] = parts[i].replace(/▶⏸/g, "▶/II");
    if(HP&&HP.homeKey===406){var blueHint=false;for(i=0;i<parts.length;i++)if(parts[i]&&typeof parts[i]!=="string"&&parts[i][0]==="blue")blueHint=true;if(!blueHint)parts.push(["blue","Inicio"]);}
    holder.textContent = "";
    for (i = 0; i < parts.length; i++) {
      part = parts[i]; if (!part) continue;
      if(HP&&HP.homeKey===406&&typeof part!=="string"&&part[0]==="blue")part=["blue","Inicio"];
      el = document.createElement("span"); el.className = "help-item";
      if (typeof part === "string") el.textContent = part;
      else {
        pill = document.createElement("span"); pill.className = "key-pill " + part[0]; pill.setAttribute("aria-hidden", "true");
        el.appendChild(pill); el.appendChild(document.createTextNode(part[1])); el.setAttribute("data-key", part[0]);
      }
      holder.appendChild(el);
    }
  }
  /* Favoritas visibles, en el orden de su fila: destino de las teclas 1-9. */
  function favoriteApps() { return prefs ? P.getHomeApps(apps, P.withOption(prefs, "homeMode", "favorites")) : []; }
  function remoteKey(key) {
    if (!M.remoteAction || !ready || !prefsLoaded || view === "home-menu") return false;
    var item = focused && focused.item, favorites = favoriteApps();
    var action = M.remoteAction(key, { view: view, kind: item && item.kind, favoriteCount: favorites.length, fullscreen: playerFullscreen, editing: mediaFormEditing });
    if (!action) return false;
    cancelEnter();
    var app = item && item.kind === "app" ? appById(item.id) || item.app : null, was;
    if (action.type === "playPause") { if (!player || !playerActive()) return false; player.toggle(); }
    else if (action.type === "homeMode") { if (HOME_PAGE_SIZE) changeAppPage(-action.dir); else changeHomeMode(action.dir); }
    else if (action.type === "page") pageRows(action.dir);
    else if (action.type === "settings") openView("settings");
    else if (action.type === "library") openLibrary();
    else if (action.type === "saveOrder") { if (reorder) confirmReorder(); }
    else if (action.type === "openFavorite") { if (favorites[action.index]) launchApp(favorites[action.index]); }
    else if (!app) return false;
    else if (action.type === "favorite") { was = P.isFavorite(prefs, app.id); saveChange(P.toggleFavorite(prefs, app.id), was ? "Quitada de favoritas." : "Añadida a favoritas.", app.id); }
    else if (action.type === "hide") toggleAppHidden(app, app.id);
    else if (action.type === "order") startReorder(app, reorderScope(app.id));
    else if (action.type === "options") showAppOptions(app);
    return true;
  }
  var HOME_MODE_LABELS = { favorites: "Favoritas", recent: "Recientes", all: "Todas" };
  /* Canal ▲▼ en el inicio: Favoritas → Recientes → Todas, guardado como homeMode. */
  function changeHomeMode(dir) {
    var next = M.nextHomeMode(prefs.homeMode, dir);
    saveChange(P.withOption(prefs, "homeMode", next), "Fila: " + HOME_MODE_LABELS[next], focused && focused.item ? focused.item.id : null);
  }
  /* Canal ▲▼ en la biblioteca: una fila completa de la cuadrícula, con la
     columna conservada; fuera de la cuadrícula, al principio o al final. */
  function pageRows(dir) {
    var grid = [], i, at, target;
    for (i = 0; i < rows.length; i++) if (/^library:/.test(rows[i].id) && rows[i].items.length) grid.push(i);
    if (!rows.length) return;
    if (!grid.length) {
      target = dir < 0 ? 0 : rows.length - 1;
      cur = { r: target, c: dir < 0 ? 0 : Math.max(0, rows[target].items.length - 1) }; renderFocus(); return;
    }
    at = grid.indexOf(cur.r);
    if (at < 0) target = dir < 0 ? (cur.r > grid[grid.length - 1] ? grid[grid.length - 1] : cur.r) : (cur.r < grid[0] ? grid[0] : cur.r);
    else target = grid[Math.max(0, Math.min(grid.length - 1, at + (dir < 0 ? -1 : 1)))];
    if (target === cur.r) return;
    cur = { r: target, c: Math.min(cur.c, rows[target].items.length - 1) }; renderFocus();
  }
  function registerRemoteKeys() {
    var device = window.tizen && tizen.tvinputdevice, supported = null, list, name, i, extra = M.SAMSUNG_REGISTER_KEYS || [];
    if (!device || typeof device.registerKey !== "function") return;
    try {
      list = typeof device.getSupportedKeys === "function" ? device.getSupportedKeys() : null;
      if (list && list.length) { supported = {}; for (i = 0; i < list.length; i++) if (list[i] && list[i].name) supported[list[i].name] = true; }
    } catch (error) { recordError("remote-keys", error); }
    for (name in M.REMOTE_KEYS) if (Object.prototype.hasOwnProperty.call(M.REMOTE_KEYS, name)) {
      if (supported && !supported[name]) continue;
      try { device.registerKey(name); registeredKeys.push(name); } catch (ignored) { /* Tecla no disponible en este mando. */ }
    }
    for (i = 0; i < extra.length; i++) {
      name = extra[i];
      if (registeredKeys.indexOf(name) >= 0 || (supported && !supported[name])) continue;
      try { device.registerKey(name); registeredKeys.push(name); } catch (ignoredExtra) {}
    }
  }
  function paintSelectionCopy(item) {
    var preferences = currentPreferences(), app = item.app || appById(item.id);
    $("hero-eyebrow").textContent = playerActive() ? "TU PRÓXIMA APLICACIÓN" : HP ? "TU TELEVISIÓN, A TU MANERA" : "TU PROYECTOR, A TU MANERA";
    $("appname").textContent = view === "reorder" ? "Mueve " + item.name : item.name;
    var usage = app && preferences.usage && Object.prototype.hasOwnProperty.call(preferences.usage, app.id) ? preferences.usage[app.id] : null;
    var lines = M.heroLines(item, app, app && P.isFavorite(preferences, app.id), usage && M.lastUseLabel ? M.lastUseLabel(usage.last, Date.now()) : "");
    $("position").textContent = view === "reorder" ? (HOME_PAGE_SIZE ? "OK guarda · Volver cancela" : "← → cambia el orden · OK guarda · Volver cancela") : lines.position;
    $("hero-description").textContent = lines.description;
  }
  function idleHomeViewer(mode, item) {
    var art = $("preview-art"), app = item && (item.app || appById(item.id)), showcase = $("preview-showcase"), picture = $("preview-image"), backdropEl = $("preview-backdrop"), token = ++heroToken;
    $("preview-window").className = mode === "off" ? "hidden" : "";
    art.className = "video-idle";
    $("preview-initials").className = "hidden";
    $("preview-symbol").innerHTML = SYMBOLS.play + "<span>Canales TV</span>";
    $("preview-symbol").className = "";
    $("preview-kind").textContent = "";
    if (mode === "off" || !app) {
      art.removeAttribute("style");
      picture.className = "hidden"; picture.onload = picture.onerror = null; picture.removeAttribute("src"); picture.removeAttribute("style");
      backdropEl.className = "hidden";
      if (showcase) showcase.className = "hidden";
      previewState = { appId: null, type: mode === "off" ? "off" : "navigation", live: false, caption: "" };
      return;
    }
    var look = tileArt(app), candidates = [], n;
    art.style.background = richArtworkBackground(app, look);
    backdropEl.className = look.backdrop ? "" : "hidden";
    backdropEl.style.backgroundImage = look.backdrop ? "url(" + look.backdrop + ")" : "";
    if (showcase) {
      var desc = M.appDescription(app);
      $("showcase-kicker").textContent = (P.isFavorite(prefs, app.id) ? "★ FAVORITA · " : "") + M.categoryLabel(M.appCategory(app, prefs.categories));
      $("showcase-title").textContent = app.name;
      $("showcase-hint").textContent = (desc ? desc + " · " : "") + "OK abre · Canales TV a la derecha";
      showcase.className = "";
    }
    if (mode === "auto" && app.preview) candidates.push({ src: app.preview, kind: "capture" });
    var showcaseIcons = artMode() === "full" && LFA_CONTROLS ? app.icons : look.icons;
    for (n = 0; n < showcaseIcons.length; n++) candidates.push(showcaseIcons[n]);
    picture.className = "hidden"; picture.onload = picture.onerror = null; picture.removeAttribute("src"); picture.removeAttribute("style");
    previewState = { appId: app.id, type: "presentation", live: false, caption: app.name, source: null, art: look.spec.kind };
    function loadShowcase() {
      if (token !== heroToken || playerActive()) return;
      if (!candidates.length) {
        picture.className = "hidden";
        $("preview-initials").textContent = M.initials(app.name);
        $("preview-initials").className = "";
        return;
      }
      var candidate = candidates.shift();
      picture.onload = function () {
        if (token !== heroToken || playerActive()) return;
        if (!picture.naturalWidth) { loadShowcase(); return; }
        $("preview-initials").className = "hidden";
        if (candidate.kind === "capture") {
          picture.removeAttribute("style");
          picture.className = "capture";
          backdropEl.className = "hidden";
          previewState.type = "capture"; previewState.art = "capture"; previewState.source = candidate.src;
          return;
        }
        var done = richIconLoaded(app, picture, candidate, look);
        look = done.art;
        art.style.background = richArtworkBackground(app, look);
        picture.className = "presentation art-image" + placeArtImage(picture, look, candidate, done.palette, { maxWidth: 56, boxWidth: 1284, maxUpscale: 2.2, ratio: 1284 / 724 });
        if (look.backdrop) { backdropEl.style.backgroundImage = "url(" + look.backdrop + ")"; backdropEl.className = ""; }
        previewState.type = "presentation"; previewState.art = look.spec.kind; previewState.source = candidate.src;
      };
      picture.onerror = loadShowcase;
      picture.src = candidate.src;
    }
    loadShowcase();
  }
  function updateHero(item) {
    if ($("preview-showcase") && (!LFA_CONTROLS || view !== "home")) $("preview-showcase").className = "hidden";
    if (LFA_CONTROLS && view === "home") {
      var mode = prefs.previewMode;
      paintAppInfo(item.app || appById(item.id), new Date());
      updateDockMeta();
      if (!playerActive()) idleHomeViewer(mode, item);
      return;
    }
    if (!LFA_CONTROLS || view === "reorder") paintSelectionCopy(item);
    if (playerActive()) { syncPlayer(); return; }
    $("preview-art").className = "";
    var preferences = currentPreferences(), app = item.app || appById(item.id), token = ++heroToken;
    $("preview-symbol").innerHTML = app ? "" : (item.id === "action:sources" ? SYMBOLS.source : SYMBOLS.library);
    $("preview-symbol").className = app ? "hidden" : "";
    var picture = $("preview-image"), initial = $("preview-initials"), candidates = [], mode = preferences.previewMode, isCapture = false;
    /* 1.10.0: con arte enriquecido, la ventana usa el mismo arte que la
       tarjeta, en grande, salvo que haya captura guardada (Volley). */
    var rich = !!app && artMode() === "rich", look = rich ? tileArt(app) : null, backdropEl = $("preview-backdrop");
    picture.className = "hidden"; picture.onload = picture.onerror = null; picture.removeAttribute("src"); picture.removeAttribute("style"); initial.className = app ? "" : "hidden";
    initial.textContent = app ? M.initials(app.name) : "";
    $("preview-art").style.background = rich ? richArtworkBackground(app, look) : app ? app.color : "#1c2940";
    $("preview-art").className = rich ? "art" : ""; $("preview-art").setAttribute("data-tone", rich ? look.spec.tone : "dark");
    backdropEl.className = "hidden"; backdropEl.style.backgroundImage = "";
    if (rich && look.backdrop) { backdropEl.style.backgroundImage = "url(" + look.backdrop + ")"; backdropEl.className = ""; }
    $("preview-window").className = mode === "off" ? "hidden" : "";
    previewState = { appId: app ? app.id : null, type: mode === "off" ? "off" : app ? "presentation" : "navigation", live: false, caption: app ? "Imagen de presentación" : "Home", source: null, art: rich ? look.spec.kind : "flat" };
    if (mode === "off") { $("preview-kind").textContent = "Vista previa desactivada"; return; }
    if (app && mode === "auto" && app.preview) { candidates.push({ src: app.preview, kind: "capture" }); isCapture = true; }
    if (app) { var n, list = rich ? look.icons : app.icons; for (n = 0; n < list.length; n++) candidates.push(list[n]); }
    function loadNext() {
      if (token !== heroToken) return;
      if (!candidates.length) { picture.className = "hidden"; initial.className = app ? "" : "hidden"; return; }
      var candidate = candidates.shift();
      picture.onload = function () {
        if (token !== heroToken) return;
        if (!picture.naturalWidth) { loadNext(); return; }
        picture.className = candidate.kind === "capture" ? "capture" : "presentation"; initial.className = "hidden";
        if (candidate.kind === "capture") { $("preview-art").className = ""; backdropEl.className = "hidden"; previewState.art = "capture"; }
        else if (rich) {
          var done = richIconLoaded(app, picture, candidate, look);
          look = done.art; $("preview-art").style.background = richArtworkBackground(app, look); previewState.art = look.spec.kind;
          picture.className = "presentation art-image" + placeArtImage(picture, look, candidate, done.palette, { maxWidth: 70, boxWidth: 924, maxUpscale: 2.4, ratio: ART_BOX.hero });
          if (look.backdrop) { backdropEl.style.backgroundImage = "url(" + look.backdrop + ")"; backdropEl.className = ""; }
        }
        previewState.type = candidate.kind === "capture" ? "capture" : "presentation"; previewState.source = candidate.src;
        previewState.caption = candidate.kind === "capture" ? (app.previewCaption || "Captura guardada") : "Imagen de presentación";
        $("preview-kind").textContent = previewState.caption;
        if (candidate.kind !== "capture" && !rich) {
          var art = $("preview-art"), palette = iconPalette(picture, candidate.src);
          var ratio = (picture.naturalWidth / picture.naturalHeight) / (PLAYER_RECT.width / PLAYER_RECT.height);
          if (LFA_CONTROLS && artMode() === "full" && candidate.kind !== "brand" && palette.opaque && ratio >= .91 && ratio <= 1.09) {
            picture.className += " preview-cover";
          }
          if (!CONFIG.appName || !tintPaleArtwork(picture, art, app, palette)) {
            art.style.background = iconBackground(picture, candidate.src, app.color);
          }
        }
      };
      picture.onerror = loadNext; picture.src = candidate.src;
    }
    $("preview-kind").textContent = isCapture ? "Captura guardada" : app ? "Imagen de presentación" : item.id === "action:sources" ? "Selector de entradas" : "Biblioteca de aplicaciones";
    loadNext();
  }
  function move(key) {
    if (!ready || !rows[cur.r] || playerFullscreen) return;
    if (view === "reorder") {
      if (key === 37 || key === 39) moveReorder(key === 37 ? -1 : 1);
      else if (HOME_PAGE_SIZE && (key === 38 || key === 40)) moveReorder(key === 38 ? -1 : 1, true);
      return;
    }
    if (HOME_PAGE_SIZE && view === "home" && rows[cur.r].id === "home" && (key === 40 || (key === 38 && homePage > 0))) {
      changeAppPage(key === 38 ? -1 : 1); return;
    }
    if (view === "settings" && focused && focused.item.setting && (key === 37 || key === 39)) { cycleOption(focused.item.setting, key === 37 ? -1 : 1); return; }
    var r = cur.r, c = cur.c, next;
    if (key === 37) c--; else if (key === 39) c++;
    else if (key === 38 || key === 40) {
      next = r + (key === 38 ? -1 : 1); if (next < 0 || next >= rows.length) return;
      c = Math.min(view === "library" ? libraryColumn(rows[r].id, rows[next], c) : c, rows[next].items.length - 1); r = next;
    }
    else return;
    if (c < 0 || c >= rows[r].items.length) return; cur = { r: r, c: c }; renderFocus();
  }
  /* Biblioteca: al entrar en las letras se recupera la última letra; en los
     chips, el chip activo; al bajar a la cuadrícula, su última columna. */
  function libraryColumn(fromId, target, c) {
    var i;
    if (target.id === "library-letters") return libraryLetterIndex;
    if (target.id === "library-chips") { for (i = 0; i < target.items.length; i++) if (target.items[i].item.id === "chip:" + libraryChip) return i; return 0; }
    if (/^library:/.test(target.id) && !/^library:/.test(fromId)) return libraryGridCol;
    return c;
  }
  function activate() { if (!ready || !focused || actionBusy) return; if (view === "reorder") confirmReorder(); else if (focused.item && typeof focused.item.open === "function") focused.item.open(); }
  function cancelEnter() { clearTimeout(longPressTimer); longPressTimer = null; pendingEnter = null; enterHeld = false; }
  function sourceValue(done) {
    if (HP) { HP.getSources(function (error, list) { if (error) recordError("sources", error); done(list || []); }); return; }
    var finished = false, timer = setTimeout(function () { finish(null); }, 1800);
    function finish(value) { if (finished) return; finished = true; clearTimeout(timer); done(value); }
    try {
      if (!window.tizen || !tizen.systeminfo) { finish(null); return; }
      tizen.systeminfo.getPropertyValue("VIDEOSOURCE", function (value) { finish(value); }, function (error) { recordError("sources", error); finish(null); });
    } catch (error) { recordError("sources", error); finish(null); }
  }
  function readApps(done) {
    var finished = false, timer = setTimeout(function () { finish(null, new Error("Tiempo de consulta agotado")); }, HP ? 15000 : 3500);
    function finish(list, error) {
      if (finished) return;
      finished = true; clearTimeout(timer); if (error) recordError("applications", error);
      done(Array.isArray(list) ? list : [], !!error);
    }
    try {
      if (HP) { HP.getApps(function (error, list) { finish(list, error); }); return; }
      if (!window.tizen || !tizen.application || !tizen.application.getAppsInfo) throw new Error("API de aplicaciones no disponible");
      tizen.application.getAppsInfo(function (list) {
        if (finished) return;
        list = Array.isArray(list) ? list.slice() : [];
        var known = {}, panel = typeof PANEL_APPS !== "undefined" && Array.isArray(PANEL_APPS) ? PANEL_APPS : [], i, p, id;
        for (i = 0; i < list.length; i++) known[list[i].id] = true;
        if (typeof tizen.application.getAppInfo === "function") {
          for (i = 0; i < panel.length; i++) {
            p = panel[i] || {}; id = p.id || p.app_tizen_id;
            if (!id || known[id]) continue;
            try { var found = tizen.application.getAppInfo(id); if (found && found.id === id) { list.push(found); known[id] = true; } }
            catch (ignored) { /* No resucitar una entrada local de una app ya desinstalada. */ }
          }
        }
        finish(list, null);
      }, function (error) { finish(null, error); });
    } catch (error) { finish(null, error); }
  }
  function selfId() { if (HP) return HP.id; try { return tizen.application.getAppInfo().id; } catch (ignored) { return "HkTvHome01.Home"; } }
  function openSource(source) {
    if (actionBusy) return;
    cancelShortcutReclaim();
    busy(true); message("Abriendo " + source.name + "…");
    if (HP) { HP.launch(source.raw.appId, function (error) { if (error) actionFailed(source.name, error); else finishAction(); }); return; }
    sourceValue(function (value) {
      var available = M.normalizeSources(value, { hasTuner: CONFIG.hasTuner }), current = null, i;
      for (i = 0; i < available.length; i++) if (available[i].id === source.id) { current = available[i]; break; }
      if (!current) { finishAction(); message("La entrada ya no está disponible. Actualiza la lista.", true); return; }
      if (!current.connected) { finishAction(); message("No hay señal en " + current.name + ". Comprueba el cable y el dispositivo conectado.", true); return; }
      try {
        if (!tizen.tvwindow || typeof tizen.tvwindow.setSource !== "function") throw new Error("Cambio de entrada no disponible");
        tizen.tvwindow.setSource(current.raw, function () {
          try { tizen.application.launch("org.tizen.tv-viewer", finishAction, function (error) { actionFailed(current.name, error); }); }
          catch (error) { actionFailed(current.name, error); }
        }, function (error) { actionFailed(current.name, error); });
      } catch (error) { actionFailed(current.name, error); }
    });
  }
  var DAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  var MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  var APP_AGENDAS = { "LFAVolley1.Volley": "russia", "LFAVolley2.Volley": "turkey", "com.lfa.volley.rusia": "russia", "com.lfa.volley.turquia": "turkey" };
  var agenda = { cancel: null, nextFetch: 0, key: "", country: null, russia: { status: "loading", items: [] }, turkey: { status: "loading", items: [] } };
  function timeLabel(now) { return now.getHours() + ":" + ("0" + now.getMinutes()).slice(-2); }
  function agendaDate(date) { return DAYS[date.getDay()].slice(0, 3).toLowerCase() + " " + date.getDate() + " " + MONTHS[date.getMonth()].slice(0, 3).toLowerCase(); }
  function dayStamp(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
  function updateDockMeta() {
    var box = $("dock-meta");
    if (!box) return;
    if (!LFA_CONTROLS || (view !== "home" && view !== "home-menu") || !prefs) { box.className = "hidden"; return; }
    var list = HOME_PAGE_SIZE ? pagedApps(prefs) : P.getHomeApps(apps, prefs);
    var pages = HOME_PAGE_SIZE ? Math.max(1, Math.ceil(list.length / HOME_PAGE_SIZE)) : 1;
    $("dock-meta-title").textContent = "Tus aplicaciones · " + list.length + " visibles";
    $("dock-meta-page").textContent = pages > 1 ? "Grupo " + (homePage + 1) + " de " + pages + " (↑ ↓)" : "1 grupo";
    box.className = "";
  }
  function paintHubDigest(now) {
    var box = $("hub-digest"), channelEl = $("digest-channel"), listEl = $("digest-matches"), footEl = $("digest-remote");
    if (!box || !LFA_CONTROLS || agenda.country) { if (box) box.className = "hidden"; return; }
    box.className = "";
    var quick = quickPlayTarget();
    if (playerActive()) channelEl.textContent = "● En reproducción: " + playerState.title;
    else if (prefs && prefs.pinnedMedia && quick) channelEl.textContent = "📌 Fijado: " + quick.title;
    else if (quick) channelEl.textContent = "📺 Directo listo: " + quick.title;
    else channelEl.textContent = "📺 " + allMedia().length + " canales listos en Vídeos y canales";
    var combined = [], i, item;
    for (i = 0; i < agenda.russia.items.length; i++) {
      item = agenda.russia.items[i];
      if (item.start > now.getTime()) combined.push({ start: item.start, id: "r:" + item.id, league: "RUS", title: item.title });
    }
    for (i = 0; i < agenda.turkey.items.length; i++) {
      item = agenda.turkey.items[i];
      if (item.start > now.getTime()) combined.push({ start: item.start, id: "t:" + item.id, league: "TUR", title: item.title });
    }
    combined.sort(function (a, b) { return a.start - b.start || a.id.localeCompare(b.id); });
    listEl.textContent = "";
    if (combined.length) {
      combined.slice(0, 2).forEach(function (match) {
        var li = document.createElement("li"), row = document.createElement("div"), badge = document.createElement("span"), txt = document.createElement("span"), when = document.createElement("span"), dt = new Date(match.start);
        row.className = "digest-match-row";
        badge.className = "digest-league"; badge.textContent = match.league;
        txt.textContent = match.title;
        when.className = "digest-match-when"; when.textContent = agendaDate(dt) + " · " + timeLabel(dt);
        row.appendChild(badge); row.appendChild(txt); li.appendChild(row); li.appendChild(when); listEl.appendChild(li);
      });
    } else {
      var emptyLi = document.createElement("li"), emptyRow = document.createElement("div");
      emptyRow.className = "digest-match-row";
      emptyRow.textContent = agenda.russia.status === "loading" || agenda.turkey.status === "loading" ? "Sincronizando radar de partidos Rusia / Turquía…" : "Radar deportivo listo · Enfoca Volley para calendario semanal";
      emptyLi.appendChild(emptyRow); listEl.appendChild(emptyLi);
    }
    var shb = prefs && prefs.samsungHomeButton || "off", chk = prefs && prefs.customHomeKey || 406;
    footEl.textContent = HP
      ? "🏠 Mando LG: " + (whiteKeyState && whiteKeyState.active ? "Tecla Netflix → LFA Home" : "Tecla Azul → Inicio")
      : "🏠 Mando Samsung: " + (shb !== "off" ? M.samsungHomeButtonLabel(shb) + " → Home" : M.remoteKeyLabel(chk) + " → Inicio");
  }
  function paintAppInfo(app, now) {
    agenda.country = app && Object.prototype.hasOwnProperty.call(APP_AGENDAS, app.id) ? APP_AGENDAS[app.id] : null;
    var country = agenda.country;
    $("app-info").className = app ? "" : "hidden";
    if (!app) return;
    $("app-info-title").textContent = country ? "Agenda · " + app.name : app.name;
    $("app-info-tag").textContent = country ? "Hora local" : M.categoryLabel(M.appCategory(app, prefs.categories));
    $("volley-agenda").className = country ? "" : "hidden";
    $("app-info-details").className = country ? "hidden" : "";
    if ($("hub-digest")) $("hub-digest").className = country ? "hidden" : "";
    if (country) { paintAgenda(now); return; }
    var usage = Object.prototype.hasOwnProperty.call(prefs.usage, app.id) ? prefs.usage[app.id] : null;
    $("app-info-description").textContent = M.appDescription(app);
    $("app-info-usage").className = usage ? "" : "hidden";
    $("app-info-unused").className = usage ? "hidden" : "";
    $("app-info-last").textContent = usage ? M.lastUseLabel(usage.last, now.getTime()) : "";
    $("app-info-count").textContent = usage ? String(usage.count) : "";
    paintHubDigest(now);
  }
  function paintAgenda(now) {
    var country = agenda.country;
    if (!country) return;
    var schedule = agenda[country];
    var dates = Object.create(null), today = dayStamp(now);
    var matches = schedule.items.filter(function (match) { return match.start > now.getTime(); });
    matches.sort(function (a, b) { return a.start - b.start || a.id.localeCompare(b.id); });
    matches.forEach(function (match) { dates[dayStamp(new Date(match.start))] = true; });
    var upcoming = matches.slice(0, 3), status = "";
    if (schedule.status === "loading") status = "Consultando calendario…";
    else if (schedule.status === "error") status = upcoming.length ? "Calendario sin actualizar." : "No se pudo actualizar la agenda.";
    else if (!upcoming.length) status = "Sin próximos partidos con horario publicado.";
    var key = JSON.stringify([country, today, Object.keys(dates), upcoming, status]);
    if (key === agenda.key) return;
    agenda.key = key;
    var week = $("agenda-week"), list = $("agenda-matches"), day = new Date(today), i, cell, name, number;
    week.textContent = ""; list.textContent = "";
    for (i = 0; i < 7; i++) {
      cell = document.createElement("li"); name = document.createElement("span"); number = document.createElement("strong");
      var hasMatch = !!dates[day.getTime()];
      cell.className = (i === 0 ? "agenda-today" : "") + (hasMatch ? " agenda-event" : "");
      cell.setAttribute("aria-label", (i === 0 ? "Hoy, " : "") + agendaDate(day) + (hasMatch ? ", con partidos" : ""));
      if (!i) cell.setAttribute("aria-current", "date");
      name.textContent = DAYS[day.getDay()].slice(0, 3); number.textContent = day.getDate();
      cell.appendChild(name); cell.appendChild(number); week.appendChild(cell); day.setDate(day.getDate() + 1);
    }
    upcoming.forEach(function (match) {
      var row = document.createElement("li"), title = document.createElement("div"), detail = document.createElement("time"), when = new Date(match.start);
      title.className = "agenda-match-title"; title.textContent = match.title;
      detail.className = "agenda-match-time"; detail.dateTime = when.toISOString();
      detail.textContent = agendaDate(when) + " · " + timeLabel(when);
      row.appendChild(title); row.appendChild(detail); list.appendChild(row);
    });
    $("agenda-status").textContent = status;
  }
  function updateAgenda(now) {
    if (!LFA_CONTROLS || (view !== "home" && view !== "home-menu") || document.hidden || !HM || !HM.loadAgenda) return;
    if (!agenda.cancel && now.getTime() >= agenda.nextFetch) {
      var remaining = 2;
      agenda.nextFetch = now.getTime() + 15 * 60 * 1000;
      agenda.cancel = HM.loadAgenda(function (country, error, items) {
        if (disposed) return;
        agenda[country].status = error ? "error" : "ready";
        if (!error) agenda[country].items = items;
        if (error) agenda.nextFetch = Math.min(agenda.nextFetch, Date.now() + 2 * 60 * 1000);
        if (!--remaining) agenda.cancel = null;
        if (view === "home" || view === "home-menu") { paintAgenda(new Date()); paintHubDigest(new Date()); }
      }, { now: now.getTime() });
    }
    paintAgenda(now); paintHubDigest(now);
  }
  function clock() {
    var now = new Date(), hour = now.getHours();
    $("greeting").textContent = hour < 6 ? "BUENAS NOCHES" : hour < 13 ? "BUENOS DÍAS" : hour < 21 ? "BUENAS TARDES" : "BUENAS NOCHES";
    $("time").textContent = timeLabel(now);
    $("date").textContent = DAYS[now.getDay()] + " " + now.getDate() + " DE " + MONTHS[now.getMonth()];
    if (saver.active) paintScreensaver(now);
    if (!document.hidden && !HP && prefsLoaded) runningIds(function (list) { if (Array.isArray(list)) shortcutWatch.prevIds = list; }, 1500);
    applyDim(); paintProfileBadge(); updateAgenda(now);
  }
  /* 1.13.0: «Atenuar interfaz». Clase dim-soft / dim-night en <html> (estilos al
     final de style.css). «auto» se reevalúa con el reloj (cada 10 s, también al
     volver a visible, que llama a clock()) y al cambiar las preferencias. */
  var DIM_LABELS = { off: "Desactivado", soft: "Suave", night: "Noche", auto: "Automático (22:00–07:00)" }, dimApplied = "off";
  function applyDim() {
    var level = M && M.dimLevel ? M.dimLevel(prefs && prefs.dim, new Date()) : "off", root = document.documentElement;
    var name = (" " + root.className + " ").replace(/ dim-(?:soft|night) /g, " ").replace(/^\s+|\s+$/g, "");
    root.className = name + (level === "off" ? "" : (name ? " " : "") + "dim-" + level);
    dimApplied = level; return level;
  }
  function cycleDim(delta) {
    var list = M.DIM_MODES, next = list[(list.indexOf(prefs.dim) + (delta < 0 ? -1 : 1) + list.length) % list.length];
    saveChange(P.withOption(prefs, "dim", next), "Atenuado: " + DIM_LABELS[next], "setting:dim");
  }
  /* Salvapantallas (1.9.0). Tras N minutos sin teclas (preferencia
     «screensaver», 0 = desactivado) con Home visible, sin vídeo en el
     reproductor integrado, fuera de Vídeos y canales y sin un formulario
     editándose (HomeModel.screensaverDue), se cubre la pantalla con el reloj.
     Se comprueba cada 2 s; el reloj se repinta con el intervalo de 10 s de
     clock() y el bloque cambia de celda cada 60 s. La tecla que lo cierra se
     consume (también sus repeticiones hasta soltarla) y no toca el foco: la
     interfaz no se reconstruye mientras está activo. */
  var SAVER_CHECK_MS = 2000, SAVER_MOVE_MS = 60000;
  var saver = { active: false, lastInput: Date.now(), tick: 0, moveTimer: null, swallowKey: null, activatedAt: 0, focusId: null };
  function saverPlaying() { return playerState.status === "playing" || playerState.status === "loading" || playerState.status === "resolving"; }
  function homeVisible() { return !document.hidden && (!document.visibilityState || document.visibilityState === "visible"); }
  function saverMinutes() { return prefs && typeof prefs.screensaver === "number" ? prefs.screensaver : 5; }
  function saverState(now, minutes, lastInput) {
    return { lastInput: lastInput, now: now, minutes: minutes, visible: homeVisible(), playing: saverPlaying(), view: view, editing: mediaFormEditing || (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) };
  }
  function longDate(now) { var day = DAYS[now.getDay()].toLowerCase(); return day.charAt(0).toUpperCase() + day.slice(1) + ", " + now.getDate() + " de " + MONTHS[now.getMonth()].toLowerCase() + " de " + now.getFullYear(); }
  function paintScreensaver(now) {
    var time = timeLabel(now), date = longDate(now), temp = $("w-temp").textContent;
    $("ss-time").textContent = time; $("ss-date").textContent = date; $("ss-weather").textContent = temp;
    $("screensaver").setAttribute("aria-label", "Salvapantallas: " + time + ", " + date + (temp ? ", " + temp : ""));
  }
  function placeScreensaver() { var at = M.screensaverPosition(saver.tick); $("ss-block").style.left = at.x + "%"; $("ss-block").style.top = at.y + "%"; }
  function setUnderlayHidden(hidden) {
    var children = $("stage").children, i;
      for (i = 0; i < children.length; i++) if (children[i].id !== "screensaver") { if (hidden) children[i].setAttribute("aria-hidden", "true"); else if (children[i].className.indexOf("glow") < 0 && children[i].id.indexOf("ambient-") !== 0) children[i].removeAttribute("aria-hidden"); }
  }
  function showScreensaver() {
    if (saver.active || disposed) return;
    saver.active = true; saver.tick = 0; saver.activatedAt = Date.now(); saver.focusId = focused && focused.item ? focused.item.id : null;
    cancelEnter(); paintScreensaver(new Date()); placeScreensaver(); setUnderlayHidden(true); $("screensaver").className = "";
    clearInterval(saver.moveTimer); saver.moveTimer = setInterval(function () { saver.tick++; placeScreensaver(); }, SAVER_MOVE_MS);
  }
  function hideScreensaver() {
    if (!saver.active) return;
    saver.active = false; clearInterval(saver.moveTimer); saver.moveTimer = null;
    $("screensaver").className = "hidden"; setUnderlayHidden(false); saver.lastInput = Date.now();
  }
  function checkScreensaver() {
    if (saver.active || !ready) return;
    if (M.screensaverDue(saverState(Date.now(), saverMinutes(), saver.lastInput))) showScreensaver();
  }
  function weatherOptions() { return W.settings(prefs && prefs.weather); }
  function weatherSummary() {
    var options = weatherOptions();
    if (options.mode === "city") return options.city.name + " · °" + options.unit;
    if (options.mode === "auto") return "Ubicación automática · °" + options.unit;
    return options.mode === "off" ? "Oculto" : "Elige una ciudad o usa tu ubicación";
  }
  function weatherDescription() {
    if (weatherState && weatherState.detail) return weatherState.detail;
    if (weatherState && weatherState.status === "locating") return "Buscando ubicación aproximada del dispositivo…";
    return "Elige la ciudad para el pronóstico. La ubicación automática depende de los permisos y del dispositivo.";
  }
  function paintWeather(state) {
    weatherState = state;
    var forecast = state.data, unit = state.unit, widget = $("weather");
    widget.className = state.status === "off" ? "" : "on" + (forecast ? "" : " weather-pending");
    $("w-icon").innerHTML = W.icon(forecast ? forecast.icon : "partly");
    $("w-temp").textContent = forecast ? W.temp(forecast.temp, unit) + unit : "";
    $("w-place").textContent = state.place || (state.status === "locating" ? "Buscando ubicación" : "El tiempo");
    $("w-text").textContent = forecast ? forecast.label + (state.status === "stale" ? " · última lectura" : "") :
      (state.detail || (state.status === "loading" ? "Consultando el pronóstico…" : state.status === "locating" ? "Consulta del dispositivo…" : "Elige una ciudad en Configurar Home"));
    $("w-hilo").textContent = forecast && forecast.max !== null && forecast.min !== null ?
      "↑ " + W.temp(forecast.max, unit) + "   ↓ " + W.temp(forecast.min, unit) : "";
    if (view === "weather") $("panel-description").textContent = weatherDescription();
    if (saver.active) paintScreensaver(new Date());
  }
  function weather() {
    if (!W || !prefsLoaded || document.hidden || disposed) return;
    if (!weatherController) {
      weatherController = W.create(window, paintWeather);
      paintWeather({ status: "setup" });
    }
    weatherController.configure(prefs.weather);
  }
  function saveWeather(next, text, keepId) {
    saveChange(P.withOption(prefs, "weather", next), text, keepId);
  }
  function buildWeather() {
    var options = weatherOptions();
    panelHeader("Tiempo y ubicación", weatherDescription());
    listOption(makeAction("weather:choose", "Buscar ciudad", options.city ? options.city.name + (options.city.region ? " · " + options.city.region : "") : "Escribe un nombre y elige el resultado", function () {
      clearWeatherDraft(); weatherDraft = { text: "", results: [], status: "", cancel: null };
      openView("weather-city", "weather-key:A");
    }));
    listOption(makeAction("weather:auto", "Usar ubicación automática", options.mode === "auto" ? "Activada · OK reintenta" : "Usa la ubicación aproximada del dispositivo", function () {
      if (options.mode === "auto") { weatherController.refresh(true); return; }
      options.mode = "auto";
      saveWeather(options, "Ubicación automática activada.", "weather:auto");
    }));
    listOption(makeAction("weather:unit", "Unidad de temperatura", options.unit === "F" ? "Fahrenheit (°F)" : "Celsius (°C)", function () {
      options.unit = options.unit === "F" ? "C" : "F";
      saveWeather(options, "Unidad guardada.", "weather:unit");
    }));
    if (options.mode === "city") listOption(makeAction("weather:refresh", "Actualizar el pronóstico", "Vuelve a consultar la ciudad elegida", function () { weatherController.refresh(true); }));
    if (options.mode !== "off") listOption(makeAction("weather:off", "Ocultar el tiempo", "Quita la franja del inicio", function () {
      options.mode = "off";
      saveWeather(options, "Franja del tiempo oculta.", "weather:choose");
    }));
  }
  function clearWeatherDraft() {
    if (weatherDraft && weatherDraft.cancel) weatherDraft.cancel();
    weatherDraft = null;
  }
  function typeWeatherKey(letter, keyId) {
    return function () {
      var draft = weatherDraft;
      if (!draft) return;
      if (draft.cancel) { draft.cancel(); draft.cancel = null; }
      draft.results = []; draft.status = "";
      if (letter === "delete") draft.text = draft.text.slice(0, -1);
      else if (draft.text.length < W.QUERY_LIMIT) draft.text += letter === "space" ? " " : letter;
      renderView(keyId);
    };
  }
  function searchWeatherCity() {
    var draft = weatherDraft, query = W.query(draft && draft.text);
    if (query.length < 2) { message("Escribe al menos dos letras."); return; }
    if (draft.cancel) draft.cancel();
    draft.results = []; draft.status = "Buscando ciudades…";
    renderView("weather-key:search");
    draft.cancel = W.search(window, query, function (error, results) {
      if (disposed || draft !== weatherDraft || view !== "weather-city") return;
      draft.cancel = null; draft.results = results;
      draft.status = error ? "La búsqueda no respondió. Prueba otra vez." : results.length ? "Selecciona la ciudad correcta." : "Sin resultados. Prueba con otro nombre.";
      renderView(results.length ? "weather:city:0" : "weather-key:search");
    });
  }
  function buildWeatherCity() {
    var draft = weatherDraft, holder = document.createElement("div"), elements = [], typed = document.createElement("span");
    panelHeader("Buscar ciudad", draft.status || "Escribe con las flechas y OK. Comprueba la región y el país al elegir un resultado.");
    typed.className = "search-pill weather-typed"; typed.id = "weather-typed";
    typed.textContent = "Ciudad · " + (draft.text || "…");
    $("panel-buttons").appendChild(typed);
    appendLetterRow("weather", typeWeatherKey);
    holder.className = "library-letters profile-letters";
    [["space", "Espacio"], ["delete", "Borrar"], ["search", "Buscar"]].forEach(function (key, index) {
      var id = "weather-key:" + key[0];
      var item = makeAction(id, key[1], "", key[0] === "search" ? searchWeatherCity : typeWeatherKey(key[0], id));
      var button = actionButton(item, "letter-key clear" + (index ? "" : " first-key"));
      holder.appendChild(button); elements.push(button);
    });
    $("panel-list").appendChild(holder); addNavigationRow("weather-actions", "Teclado", elements, holder);
    draft.results.forEach(function (place, index) {
      listOption(makeAction("weather:city:" + index, place.name, place.region || "OK selecciona esta ciudad", function () {
        var options = weatherOptions(); options.mode = "city"; options.city = place;
        var saved = persist(P.withOption(prefs, "weather", options));
        back(); message(saved ? "Ciudad guardada: " + place.name : "Se cambió la ciudad, pero no se pudo guardar.", !saved);
      }));
    });
  }

  function refresh(explicit) {
    if (loading || disposed) { if (explicit) message("La lista se está actualizando…"); return; }
    loading = true; status = "loading";
    var generation = ++refreshId, appDone = false, sourceDone = false, nextApps = [], nextSources = [], failed = false;
    var keepId = focused && focused.item.id, initialMessage = messageSerial;
    $("loading").className = "visible"; $("catalog-status").textContent = "Actualizando aplicaciones…";
    function finish() {
      if (!appDone || !sourceDone || generation !== refreshId || disposed) return;
      var normalized = M.normalizeApps(nextApps, HP ? nextApps : typeof PANEL_APPS !== "undefined" ? PANEL_APPS : [], { selfId: selfId(), allowPanelFallback: HP ? false : failed });
      loading = false; lastRefresh = Date.now(); loadWarning = failed ? "local" : "";
      /* No vaciar decisiones ni el último catálogo útil por un fallo temporal. */
      if (!failed || !apps.length) apps = normalized;
      if (!failed) purgeArtCaches(apps);
      sources = HP ? nextSources : M.normalizeSources(nextSources, { hasTuner: CONFIG.hasTuner });
      initializePreferences();
      var reconciled = directMediaPreferences(P.reconcile(prefs, apps, { keepMissing: failed }));
      if (!failed) usePagedOrder(reconciled);
      if (JSON.stringify(reconciled) !== JSON.stringify(prefs)) {
        prefs = reconciled;
        if (apps.length && !failed) persist(prefs);
      }
      if (reorder) reorder.draft = P.reconcile(reorder.draft, apps, { keepMissing: failed });
      status = failed ? (apps.length ? "fallback" : "empty") : (apps.length || sources.length ? "ready" : "empty");
      $("loading").className = ""; renderView(focused && focused.item ? focused.item.id : keepId); catalogPainted = true;
      weather();
      maybeStartPinned();
      if (messageSerial !== initialMessage) return;
      if (failed) message(apps.length ? "Mostrando la última lista disponible. Actualiza para reintentar." : "No se pudo leer la lista. Pulsa Actualizar para reintentar.", true);
      else if (explicit && view === "home" && focused && (focused.item.id === "action:refresh" || focused.item.id === "action:home-menu")) message("Lista actualizada · " + catalogCount() + " aplicaciones");
    }
    readApps(function (list, error) { nextApps = list; failed = error; appDone = true; finish(); });
    sourceValue(function (value) { nextSources = value; sourceDone = true; finish(); });
  }
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { refresh(false); }, 220); }
  function fit() {
    var stage = $("stage"), scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    stage.style.webkitTransform = stage.style.transform = "scale(" + scale + ")";
    stage.style.left = Math.max(0, (window.innerWidth - 1920 * scale) / 2) + "px";
    stage.style.top = Math.max(0, (window.innerHeight - 1080 * scale) / 2) + "px";
    if (ready) renderFocus();
  }
  function rect(el) {
    if (!el) return null; var box = el.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
  }
  function returnLogEntries() { var store = returnLog(); try { return store ? store.read() : []; } catch (error) { return []; } }
  function returnLogText(limit) {
    var names = {}, i; for (i = 0; i < apps.length; i++) names[apps[i].id] = apps[i].name;
    return M.returnLogLines(returnLogEntries(), names, limit || 5);
  }
  function saverSnapshot() {
    var now = Date.now(), block = $("ss-block");
    return { active: saver.active, minutes: saverMinutes(), lastInput: saver.lastInput, idleMs: now - saver.lastInput, tick: saver.tick,
      due: !!M.screensaverDue(saverState(now, saverMinutes(), saver.lastInput)), position: saver.active ? M.screensaverPosition(saver.tick) : null,
      blockRect: saver.active ? rect(block) : null, time: saver.active ? $("ss-time").textContent : "", date: saver.active ? $("ss-date").textContent : "" };
  }
  /* Sólo para pruebas por CDP: activa el salvapantallas sin esperar los
     minutos, pero respeta el resto de reglas de screensaverDue (visible, sin
     vídeo, fuera de medios y sin editar). Devuelve si quedó activo. */
  function forceScreensaver() {
    if (saver.active) return true;
    if (!ready || !M.screensaverDue(saverState(Date.now(), saverMinutes() || 1, 0))) return false;
    showScreensaver(); return true;
  }
  function perfSnapshot() {
    var result = clone(perf), key, cached = 0, backdrops = 0;
    for (key in artCache) if (Object.prototype.hasOwnProperty.call(artCache, key)) { cached++; if (artCache[key].backdrop) backdrops++; }
    result.artCacheSize = cached; result.backdropsCached = backdrops; result.artQueue = artQueue.length;
    result.tileNodesSize = 0; for (key in tileNodes) if (Object.prototype.hasOwnProperty.call(tileNodes, key)) result.tileNodesSize++;
    result.iconPalettesSize = 0; for (key in iconPalettes) if (Object.prototype.hasOwnProperty.call(iconPalettes, key)) result.iconPalettesSize++;
    return result;
  }
  window.HomeDiagnostics = { returnLog: returnLogEntries, returnLogLines: function (limit) { return returnLogText(limit); }, forceScreensaver: forceScreensaver, snapshot: function () {
    var result = { version: VERSION, ready: ready, status: status, view: view, loading: loading, actionBusy: actionBusy,
      appCount: apps.length, sourceCount: sources.length, homePageSize: HOME_PAGE_SIZE, apps: [], rows: [], focus: null,
      preferences: prefs ? clone(prefs) : null, usage: prefs ? clone(prefs.usage || {}) : {}, remoteKeys: registeredKeys.slice(),
      help: $("help-text").textContent, preferencesSaved: lastSaveSucceeded, persistenceFailed: persistenceFailed,
      storageBackend: preferencesStorage && preferencesStorage.backend || "web-storage",
      player: clone(playerState), playerFullscreen: playerFullscreen, pinnedMedia: prefs ? prefs.pinnedMedia : null, resumeOnReturn: !!(prefs && prefs.resumeOnReturn !== false),
      webFrameEnabled: !!(HM && HM.WEB_FRAME_ENABLED), volley: { available: !!(HM && HM.hasVolley), loading: volleyLoading, error: volleyError, videos: clone(volleyVideos) }, externalLaunches: clone(externalLaunches),
      agenda: LFA_CONTROLS ? { russia: agenda.russia.status, turkey: agenda.turkey.status, country: agenda.country, listed: agenda.country ? $("agenda-matches").children.length : 0 } : null,
      media: allMedia().map(function (item) { return { id: item.id, title: item.title, kind: item.kind, live: item.live, group: item.group || "", experimental: !!item.experimental, source: item.source }; }), mediaLoading: mediaLoading, mediaError: mediaError,
      preview: clone(previewState), weather: weatherState ? clone(weatherState) : null, viewport: rect(view === "home" || view === "reorder" ? $("viewport") : $("panel-content")),
      stage: rect($("stage")), verticalOffset: $("panel-content").scrollTop, message: $("msg").textContent, errors: [], lastRefresh: lastRefresh,
      reorder: reorder ? { appId: reorder.appId, scope: reorder.scope, draft: clone(reorder.draft) } : null,
      returnHome: !!(prefs && prefs.returnHome !== false), lastLaunch: lastLaunch ? clone(lastLaunch) : null, returnWatching: returnWatch !== null,
      shortcut: { mode: prefs ? prefs.samsungHomeButton : "off", customHomeKey: prefs ? prefs.customHomeKey : 406, capturing: capturingHomeKey, watching: shortcutTimer !== null, reclaiming: shortcutWatch.reclaimUntil > Date.now(), triggers: shortcutWatch.triggers, lastTriggeredId: shortcutWatch.lastTriggeredId, lastTriggeredAt: shortcutWatch.lastTriggeredAt },
      returnLogBackend: returnLog() ? returnLog().backend : null,
      library: { chip: libraryChip, query: libraryQuery, filter: libraryFilter, visibleCount: view === "library" && prefs ? libraryLists().visible.length : null },
      screensaver: saverSnapshot(), tileArt: artMode(), perf: perfSnapshot(), ambient: clone(ambientState),
      systemHidden: { enabled: !!(prefs && prefs.hideSystemApps !== false), ids: prefs ? autoHiddenList(prefs).slice() : [], restored: prefs ? clone(prefs.restored || []) : [] }, catalogCount: catalogCount() };
    var i, j, row, item, r;
    result.dim = { pref: prefs && prefs.dim || "off", level: dimApplied };
    /* 1.14.0: perfiles. */
    result.profiles = prefs ? { active: prefs.activeProfile, list: prefs.profiles.map(function (entry) { return { id: entry.id, name: entry.name }; }), inactiveCount: Object.keys(prefs.inactive || {}).length,
      typing: profileDraft ? draftName(profileDraft.text) : null, badge: $("profile-badge") && $("profile-badge").className.indexOf("hidden") < 0 ? $("profile-badge").textContent : null } : { active: null, list: [], inactiveCount: 0, typing: null, badge: null };
    for (i = 0; i < errors.length; i++) result.errors.push({ area: errors[i].area, message: errors[i].message, at: errors[i].at });
    for (i = 0; i < apps.length; i++) result.apps.push({ id: apps[i].id, name: apps[i].name, packageId: apps[i].packageId, iconSource: apps[i].iconSource, preview: apps[i].preview || null, category: prefs ? M.appCategory(apps[i], prefs.categories) : M.defaultCategory(apps[i]), systemApp: !!(M.isSystemHidden && M.isSystemHidden(apps[i])) });
    for (i = 0; i < rows.length; i++) {
      row = rows[i]; r = { id: row.id, title: row.title, count: row.items.length, offset: row.offset, maxOffset: row.maxOffset, selectedIndex: row.index, items: [] };
      for (j = 0; j < row.items.length; j++) { item = row.items[j]; r.items.push({ id: item.item.id, name: item.item.name, kind: item.item.kind, icon: item.iconState ? clone(item.iconState) : null, art: item.getAttribute("data-art") || null }); }
      result.rows.push(r);
    }
    if (focused) result.focus = { row: cur.r, index: cur.c, rowId: rows[cur.r].id, id: focused.item.id, name: focused.item.name, kind: focused.item.kind, rect: rect(focused) };
    return result;
  } };
  /* El movimiento real del ratón selecciona sin abrir. Ignorar coordenadas
     repetidas evita que una tarjeta que se desplaza bajo el cursor robe el
     foco al mando. Los nodos reutilizados conservan sus índices actuales. */
  window.addEventListener("mousemove", function (event) {
    var x = event.clientX, y = event.clientY, el = event.target;
    if (pointerPosition.x === x && pointerPosition.y === y) return;
    pointerPosition = { x: x, y: y }; saver.lastInput = Date.now();
    if (saver.active) { hideScreensaver(); return; }
    while (el && el !== document && !el.navBound) el = el.parentNode;
    if (el && el.navBound) focusPointerTarget(el);
  });
  window.addEventListener("mousedown", function (event) {
    saver.lastInput = Date.now();
    if (!saver.active) return;
    hideScreensaver(); if (event.preventDefault) event.preventDefault(); if (event.stopPropagation) event.stopPropagation();
  }, true);
  $("preview-symbol").addEventListener("click", function () {
    if (LFA_CONTROLS && ready && view === "home" && !playerActive()) openMedia();
  });
  window.addEventListener("keydown", function (event) {
    var key = HP ? HP.keyCode(event.keyCode || event.which) : event.keyCode || event.which, now = Date.now();
    saver.lastInput = now;
    /* 1.9.0: la tecla que cierra el salvapantallas no hace nada más. */
    if (saver.active || (saver.swallowKey !== null && key === saver.swallowKey)) {
      if (event.preventDefault) event.preventDefault(); if (event.stopPropagation) event.stopPropagation();
      if (saver.active) { saver.swallowKey = key; hideScreensaver(); }
      return;
    }
    if (mediaFormEditing) {
      if (key === 10009 || key === 27 || key === 13) { if (event.preventDefault) event.preventDefault(); mediaFormEditing = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); cancelEnter(); }
      return;
    }
    if (capturingHomeKey) {
      if (event.preventDefault) event.preventDefault();
      if (event.repeat) return;
      if (key === 10009 || key === 27) { back(); return; }
      if (!M.isConfigurableHomeKey || !M.isConfigurableHomeKey(key)) {
        message("Esa tecla es de navegación básica. Pulsa Azul, Guía, Canal, Info o un botón libre.", true);
        return;
      }
      capturingHomeKey = false; lastCapturedKey = key;
      saveChange(P.withOption(prefs, "customHomeKey", key), "Tecla " + M.remoteKeyLabel(key) + " asignada para volver a LFA Home.", "remote:capture");
      return;
    }
    /* LG reserves held number keys for its global Quick Access. Wait for
       release before a short numeric shortcut can launch another app. */
    if (HP && HP.nativeNumberShortcuts && key >= 48 && key <= 57 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!nativeDigitPending || nativeDigitPending.key !== key) nativeDigitPending = { key: key, at: now, view: view };
      return;
    }
    if(((HP&&HP.homeKey===key)||(prefsLoaded&&prefs&&prefs.customHomeKey===key&&(LFA_CONTROLS||prefs.customHomeKey!==406)))&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      if(event.preventDefault)event.preventDefault();if(event.repeat)return;cancelEnter();
      reorder=null;returnStack=[];view="home";playerFullscreen=false;homePage=0;renderView(lastHomeAppId);
      message("Inicio · LFA Home");return;
    }
    /* 1.14.0: Play/Pausa sobre un perfil abre sus opciones (no pausa el recuadro). */
    if (key === 10252 && !event.repeat && ready && view === "profiles" && focused && focused.item && focused.item.kind === "profile") {
      if (event.preventDefault) event.preventDefault(); cancelEnter(); showProfileOptions(focused.item.profileId); return;
    }
    /* 1.11.0: Play/Pausa sobre una fuente que no es la del recuadro abre sus
       opciones (fijar, abrir fuera…); sobre la que se reproduce, pausa. */
    if (key === 10252 && !event.repeat && ready && focused && focused.item && focused.item.kind === "media" && (view === "home" || view === "media") && !playerFullscreen
      && !(playerActive() && focused.item.media && focused.item.media.id === playerState.id)) {
      if (event.preventDefault) event.preventDefault(); cancelEnter(); showMediaOptions(focused.item.media); return;
    }
    if (player && playerActive() && (key === 10252 || key === 415 || key === 19 || key === 413)) {
      if (event.preventDefault) event.preventDefault();
      if (key === 413) player.stop(); else if (key === 415) player.resume(); else if (key === 19) player.pause(); else player.toggle(); return;
    }
    if (playerFullscreen && key !== 10009 && key !== 27) {
      if (event.preventDefault) event.preventDefault();
      if (!event.repeat && key === 13) player.toggle();
      else if (!event.repeat && (key === 427 || key === 428 || key === 38 || key === 40 || key === 10232 || key === 10233)) stepChannel(key === 427 || key === 38 || key === 10233 ? 1 : -1);
      return;
    }
    if (key === 10009 || key === 27) { if (event.preventDefault) event.preventDefault(); back(); return; }
    if ((key >= 403 && key <= 406) || key === 457 || (key >= 48 && key <= 57) || key === 427 || key === 428 || key === 10252) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (remoteKey(key) && event.preventDefault) event.preventDefault();
      return;
    }
    if (key !== 37 && key !== 38 && key !== 39 && key !== 40 && key !== 13) return;
    if (event.preventDefault) event.preventDefault();
    if (key === 13) {
      if (enterHeld || event.repeat || !focused) return;
      enterHeld = true; pendingEnter = { id: focused.item.id, view: view, longFired: false };
      if (((view === "home" || view === "library") && focused.item.kind === "app") || ((view === "home" || view === "media") && focused.item.kind === "media") || (view === "profiles" && focused.item.kind === "profile")) {
        longPressTimer = setTimeout(function () {
          if (!pendingEnter || !enterHeld || !focused || view !== pendingEnter.view || focused.item.id !== pendingEnter.id) return;
          pendingEnter.longFired = true; if (focused.item.kind === "profile") showProfileOptions(focused.item.profileId); else if (focused.item.kind === "media") showMediaOptions(focused.item.media); else showAppOptions(focused.item.app);
        }, 650);
      }
      return;
    }
    if (enterHeld) cancelEnter();
    if (key === lastArrow && now - lastArrowTime < 75) return;
    lastArrow = key; lastArrowTime = now; move(key);
  });
  window.addEventListener("keyup", function (event) {
    var key = HP ? HP.keyCode(event.keyCode || event.which) : event.keyCode || event.which, pending;
    saver.lastInput = Date.now();
    if (saver.swallowKey !== null && key === saver.swallowKey) { saver.swallowKey = null; if (event.preventDefault) event.preventDefault(); return; }
    if (HP && HP.nativeNumberShortcuts && key >= 48 && key <= 57 && nativeDigitPending) {
      var digit = nativeDigitPending; nativeDigitPending = null;
      if (digit.key === key && Date.now() - digit.at < 650 && digit.view === view && !document.hidden && remoteKey(key) && event.preventDefault) event.preventDefault();
      return;
    }
    if (key === 13) {
      clearTimeout(longPressTimer); longPressTimer = null; pending = pendingEnter; pendingEnter = null; enterHeld = false;
      if (pending && !pending.longFired && pending.view === view && focused && pending.id === focused.item.id) activate();
    }
    if (key === lastArrow) { lastArrow = 0; lastArrowTime = 0; }
  });
  window.addEventListener("blur", function () {
    nativeDigitPending = null;
    cancelEnter(); lastArrow = 0; saver.swallowKey = null;
    /* 1.11.0: el iframe nunca debe quedarse con el foco (las teclas del mando
       dejarían de llegar a Home). */
    setTimeout(function () { var active = document.activeElement; if (active && active.id === "home-webframe") { try { active.blur(); } catch (ignored) {} try { window.focus(); } catch (ignoredFocus) {} } }, 0);
  });
  window.addEventListener("resize", fit);
  document.addEventListener("visibilitychange", function () {
    nativeDigitPending = null;
    cancelEnter(); lastArrow = 0; finishAction();
    /* 1.9.0: otra app delante cierra el salvapantallas; al volver se cuenta de nuevo. */
    if (document.hidden) hideScreensaver(); else saver.lastInput = Date.now();
    saver.swallowKey = null;
    if (document.hidden) { clearTimeout(artTimer); artTimer = null; } else if (artQueue.length && !artTimer) artTimer = setTimeout(runArtQueue, 30);
    /* 1.11.0: se pausa al ocultarse y, con «Reanudar el vídeo al volver: Sí»,
       continúa al volver si se estaba reproduciendo (no si el usuario lo pausó). */
    if (document.hidden && player && playerActive()) {
      if (playerState.status === "playing" || playerState.status === "loading" || playerState.status === "resolving") pausedByHide = true;
      player.pause();
    }
    if (!document.hidden && player) {
      if (pausedByHide && prefs && prefs.resumeOnReturn !== false && playerActive()) player.resume();
      pausedByHide = false;
      maybeStartPinned();
    }
    if (document.hidden && lastLaunch && returnWatch !== null) lastLaunch.hiddenSeen = true;
    if (document.hidden && !HP && shortcutWatch.reclaimUntil > Date.now()) reclaimHomeNow(true);
    syncShortcutWatcher();
    if (!document.hidden) {
      homeVisibleAgain();
      if (shortcutWatch.reclaimUntil > Date.now() && view !== "home") {
        reorder = null; returnStack = []; view = "home"; playerFullscreen = false; renderView(lastHomeAppId);
      }
    }
    if (!document.hidden) { syncPlayer(); clock(); weather(); if (HP && HP.whiteKeyStatus) refreshWhiteKey(); if (Date.now() - lastRefresh > 1500) scheduleRefresh(); }
  });
  window.addEventListener("error", function (event) { recordError("runtime", event.message || "Error de interfaz"); message("Se produjo un error. Pulsa Actualizar para recuperar la lista.", true); });
  /* Con background-support="enable" Home sigue viva oculta: el reloj y el tiempo esperan a volver. */
  var saverTimer = setInterval(function () { if (!document.hidden) checkScreensaver(); }, SAVER_CHECK_MS);
  var clockTimer = setInterval(function () { if (!document.hidden) clock(); }, 10000), weatherTimer = setInterval(weather, 60 * 1000), listener = null;
  window.addEventListener("unload", function () {
    disposed = true; clearTimeout(artTimer); artTimer = null; artQueue.length = 0; clearInterval(saverTimer); clearInterval(saver.moveTimer); clearInterval(clockTimer); clearInterval(weatherTimer); if (shortcutTimer !== null) clearInterval(shortcutTimer); cancelShortcutReclaim(); stopReturnWatch(); clearReturnTimers();
    if (statusListener !== null && statusListener !== -1) try { tizen.application.removeAppStatusChangeListener(statusListener); } catch (ignored) {} clearTimeout(refreshTimer); clearTimeout(messageTimer); clearTimeout(actionTimer); cancelEnter();
    if (player) player.destroy(); if (mediaCancel) mediaCancel(); if (volleyCancel) volleyCancel(); if (agenda.cancel) agenda.cancel();
    if (weatherController) weatherController.destroy(); clearWeatherDraft(); if (listener !== null) try { tizen.application.removeAppInfoEventListener(listener); } catch (ignored) {}
  });
  try { if (window.tizen && tizen.application && tizen.application.addAppInfoEventListener) listener = tizen.application.addAppInfoEventListener({ oninstalled: scheduleRefresh, onupdated: scheduleRefresh, onuninstalled: scheduleRefresh }); }
  catch (error) { recordError("application-listener", error); }
  /* El iframe sólo existe con WEB_FRAME_ENABLED (además, config.xml necesitaría frame-src https:). */
  function webFrame() {
    var frame = document.createElement("iframe");
    frame.id = "home-webframe"; frame.className = "hidden"; frame.tabIndex = -1; frame.title = "Contenido web en el recuadro";
    frame.setAttribute("allow", "autoplay; encrypted-media; fullscreen"); frame.setAttribute("allowfullscreen", ""); frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    $("preview-window").insertBefore(frame, $("player-overlay")); return frame;
  }
  if (window.HomePlayer && HM) {
    player = HomePlayer.create({ video: $("home-video"), object: $("home-avplayer"), frame: HM.WEB_FRAME_ENABLED ? webFrame() : null, avplay: window.webapis && webapis.avplay, resolve: HM.resolve, onChange: playerChanged });
    try { if (window.tizen && tizen.tvinputdevice) ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop"].forEach(function (name) { try { tizen.tvinputdevice.registerKey(name); } catch (ignored) {} }); } catch (ignoredKeys) {}
  }
  if (M && M.REMOTE_KEYS) try { registerRemoteKeys(); } catch (error) { recordError("remote-keys", error); }
  document.title = APP_NAME;
  $("home-brand").textContent = APP_NAME.toUpperCase();
  if (CONFIG.appName) $("home-brand").className = "lfa-brand";
  $("home-command-overlay").addEventListener("click", function (event) {
    if (event.target === this && view === "home-menu") back();
  });
  fit(); clock();
  if (!M || !P) { $("empty").className = ""; $("empty-title").textContent = "No se pudo cargar Home"; $("empty-description").textContent = "Cierra y vuelve a abrir la aplicación."; return; }
  $("w-source").addEventListener("click", function (event) { event.preventDefault(); openInBrowser("https://open-meteo.com/"); });
  if (HP && HP.whiteKeyStatus) refreshWhiteKey();
  refresh(false);
})();
