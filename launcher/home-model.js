/* Reglas de catálogo y geometría, sin DOM ni APIs del televisor. ES5 / UMD. */
(function (root, factory) {
  var model = factory(root && root.HomePlatform);
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.HomeModel = model;
})(typeof window !== "undefined" ? window : this, function (platform) {
  "use strict";
  var own = Object.prototype.hasOwnProperty;
  var SYSTEM = /^(?:com\.samsung\.|org\.tizen\.|com\.tizen\.|tizen\.|org\.volt\.|samsung\.|com\.samsung\.tv\.coba\.)/i;
  var TECH = /(?:^|[. _-])(?:service|svc|daemon|agent|plugin|provider|widget|dummy|engine|tcp|wizard|installer|updater)(?:$|[. _-])/i;
  var HIDDEN_NAME = /^(?:e-manual|user guide|guia del usuario|setting|settings|ajustes|samsung promotion)$/;
  var HIDDEN_ID = /(?:^|[. _-])(?:csfs|edencore|edenlauncher|tv-viewer|safcommonplugin|bixby-promotion|promotionapp)(?:$|[. _-])/i;
  var PUBLIC_SYSTEM = /^(?:org\.tizen\.(?:netflix-app|primevideo|browser)|com\.samsung\.tv\.(?:aria-video|store))$/i;
  var BRANDS = [
    { re: /^netflix$/, color: "#15171f", logo: "netflix", glow: "netflix" },
    { re: /^youtube$/, color: "#ff0000", logo: "youtube", glow: "youtube" },
    { re: /^youtube tv$/, color: "#ffffff", logo: null, glow: "youtube" },
    { re: /^smartthings$/, color: "#ffffff", logo: null, glow: "default" },
    { re: /^(?:amazon )?prime video$/, color: "#1560f5", logo: "primevideo", glow: "prime" },
    { re: /^disney\+?$/, color: "#142342", logo: "disneyplus", glow: "disney" },
    { re: /^(?:hbo max|max)$/, color: "#30245d", logo: "hbomax", glow: "hbo" },
    { re: /^apple tv(?:\+)?$/, color: "#15171f", logo: "appletv", glow: "apple" },
    { re: /^movistar(?:\+)?$/, color: "#123b4d", logo: "movistar", glow: "movistar" },
    { re: /^plex$/, color: "#24252d", logo: "plex", glow: "plex" },
    { re: /^atresplayer$/, color: "#24252d", logo: "atresplayer", glow: "atres" },
    { re: /^(?:3cat|tv3)$/, color: "#24252d", logo: "3cat", glow: "3cat" },
    { re: /^rakuten(?: tv)?$/, color: "#24252d", logo: "rakuten", glow: "rakuten" },
    { re: /^skyshowtime$/, color: "#30245d", glow: "sky" },
    { re: /^(?:internet|browser|samsung internet)$/, color: "#162b47", glow: "internet" },
    { re: /^(?:gallery|galeria)$/, color: "#30303d", glow: "gallery" }
  ];
  function text(value) { return typeof value === "string" ? value.replace(/^\s+|\s+$/g, "") : ""; }
  function fold(value) {
    return text(value).toLowerCase().replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/\s+/g, " ");
  }
  function brandFor(name) {
    var nameKey = fold(name), i;
    for (i = 0; i < BRANDS.length; i++) if (BRANDS[i].re.test(nameKey)) return BRANDS[i];
    return { color: "#252936", glow: "default", logo: null };
  }
  function packageFor(id, supplied) {
    if (text(supplied)) return text(supplied);
    return /^[A-Za-z0-9]{10}\./.test(id) ? id.split(".")[0] : id;
  }
  function normalizePanel(item) {
    if (!item || typeof item !== "object") return null;
    var id = text(item.id || item.app_tizen_id);
    if (!id) return null;
    return { id: id, name: text(item.name || item.app_title) || id,
      packageId: packageFor(id, item.packageId || item.app_package_name), icon: text(item.icon), nativeIcon: text(item.nativeIcon),
      preview: safeIcon(item.preview), previewCaption: text(item.previewCaption) || "Captura guardada" };
  }
  function realApp(id, name, explicit, show) {
    if (!id || HIDDEN_NAME.test(fold(name)) || HIDDEN_ID.test(id)) return false;
    if (TECH.test(id) || TECH.test(name) || /^setting$/i.test(text(name))) return false;
    if (explicit) return true;
    if (show !== true) return false;
    if (PUBLIC_SYSTEM.test(id)) return true;
    if (SYSTEM.test(id)) return false;
    return /^[A-Za-z0-9]{10}\.[A-Za-z0-9_.-]+$/.test(id) || /^\d{9,14}$/.test(id);
  }
  function safeIcon(path) {
    path = text(path);
    if (!path || /[\x00-\x1f]/.test(path) || /(?:^|\/)\.\.(?:\/|$)/.test(path)) return "";
    if (/^(?:device-icons|logos)\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|svg)$/i.test(path)) return path;
    if (platform && typeof platform.isNativeIcon === "function" && platform.isNativeIcon(path)) return path;
    if (/^file:\/\//i.test(path)) return path;
    if (/^\/opt\//.test(path)) return "file://" + path;
    return "";
  }
  function addIcon(icons, value, kind) {
    var safe = safeIcon(value), j;
    if (!safe) return;
    for (j = 0; j < icons.length; j++) if (icons[j].src === safe) return;
    icons.push({ src: safe, kind: kind });
  }
  function normalizeApps(runtime, panel, options) {
    options = options || {};
    runtime = Array.isArray(runtime) ? runtime : [];
    panel = Array.isArray(panel) ? panel : [];
    var byId = Object.create(null), byPackage = Object.create(null), panelList = [], best = Object.create(null);
    var i, item, p, list, raw, id, pkg, canonical, key, score, candidate, icons, self = text(options.selfId);
    for (i = 0; i < panel.length; i++) {
      p = normalizePanel(panel[i]);
      if (!p || own.call(byId, p.id)) continue;
      byId[p.id] = p;
      if (!byPackage[p.packageId]) byPackage[p.packageId] = [];
      byPackage[p.packageId].push(p);
      panelList.push(p);
    }
    list = runtime.slice();
    if (options.allowPanelFallback) {
      for (i = 0; i < panelList.length; i++) {
        p = panelList[i];
        list.push({ id: p.id, name: p.name, packageId: p.packageId, show: true, panelFallback: true });
      }
    }
    for (i = 0; i < list.length; i++) {
      raw = list[i] || {}; id = text(raw.id);
      if (!id || id === self || /^HkTvHome01(?:\.|$)/.test(id)) continue;
      pkg = packageFor(id, raw.packageId);
      p = byId[id] || null;
      if (!p && byPackage[pkg] && byPackage[pkg].length === 1) p = byPackage[pkg][0];
      /* A service in a known package never becomes another visible application. */
      if (!realApp(id, text(raw.name), !!p, raw.show)) continue;
      canonical = p ? p.id : id;
      if (canonical === self || /^HkTvHome01(?:\.|$)/.test(canonical)) continue;
      if (p && !realApp(p.id, p.name, true, true)) continue;
      pkg = p ? p.packageId : pkg;
      key = byPackage[pkg] && byPackage[pkg].length > 1 ? "id:" + canonical : "package:" + pkg;
      score = (id === canonical ? 20 : 0) + (raw.show === true ? 5 : 0) + (p ? 5 : 0) + (raw.panelFallback ? -10 : 0);
      icons = [];
      if (p) addIcon(icons, p.icon, "bundled");
      addIcon(icons, raw.iconPath, "native");
      if (p) addIcon(icons, p.nativeIcon, "native");
      var name = p ? p.name : (text(raw.name) || canonical), brand = brandFor(name);
      candidate = { id: canonical, packageId: pkg, name: name, icons: icons, color: brand.color,
        glow: brand.glow, iconSource: icons.length ? icons[0].kind : "fallback", score: score,
        preview: p ? p.preview : "", previewCaption: p ? p.previewCaption : "" };
      if (!own.call(best, key) || candidate.score > best[key].score) best[key] = candidate;
      else if (best[key] && !best[key].icons.length && candidate.icons.length) {
        best[key].icons = candidate.icons; best[key].iconSource = candidate.iconSource;
      }
    }
    var apps = [];
    for (key in best) if (own.call(best, key)) { item = best[key]; delete item.score; apps.push(item); }
    apps.sort(function (a, b) { return fold(a.name).localeCompare(fold(b.name)) || a.id.localeCompare(b.id); });
    return apps;
  }
  function splitFavorites(apps, preferred) {
    var favorites = [], rest = [], used = Object.create(null), i, j, want, app;
    preferred = Array.isArray(preferred) ? preferred : [];
    for (i = 0; i < preferred.length; i++) {
      want = fold(preferred[i]);
      for (j = 0; j < apps.length; j++) {
        app = apps[j];
        if (!used[app.id] && (fold(app.id) === want || fold(app.packageId) === want || fold(app.name) === want)) {
          favorites.push(app); used[app.id] = true;
        }
      }
    }
    for (i = 0; i < apps.length; i++) if (!used[apps[i].id]) rest.push(apps[i]);
    return { favorites: favorites, rest: rest };
  }
  function normalizeSources(value, options) {
    value = value || {};
    var connected = Array.isArray(value.connected) ? value.connected : [], disconnected = Array.isArray(value.disconnected) ? value.disconnected : [];
    var all = disconnected.concat(connected), map = Object.create(null), out = [], i, raw, type, number, key;
    var labels = { TV: "Televisión", HDMI: "HDMI", AV: "Vídeo AV", COMP: "Componentes", PC: "PC", DVI: "DVI", SCART: "SCART", SVIDEO: "S-Vídeo", MEDIA: "Multimedia" };
    for (i = 0; i < all.length; i++) {
      raw = all[i] || {}; type = text(raw.type).toUpperCase(); number = Number(raw.number);
      if (raw.number === null || raw.number === "" || !own.call(labels, type) || !isFinite(number) || number < 0 || Math.floor(number) !== number) continue;
      if (type === "TV" && options && options.hasTuner === false) continue;
      key = type + ":" + number;
      map[key] = { id: "source:" + key, type: type, number: number, connected: i >= disconnected.length,
        name: labels[type] + (type === "HDMI" ? " " + number : ""), raw: raw };
    }
    for (key in map) if (own.call(map, key)) out.push(map[key]);
    out.sort(function (a, b) { return (a.type === "HDMI" ? 0 : 1) - (b.type === "HDMI" ? 0 : 1) || a.type.localeCompare(b.type) || a.number - b.number; });
    return out;
  }
  function scrollFor(offset, index, count, geometry) {
    geometry = geometry || {};
    var width = geometry.tileWidth || 296, step = geometry.step || 320, padding = geometry.padding || 20;
    var viewport = geometry.viewportWidth || 1728;
    var max = Math.max(0, (Math.max(0, count - 1) * step) + (count ? width : 0) + padding * 2 - viewport);
    offset = Math.max(0, Math.min(max, Number(offset) || 0));
    var left = padding + index * step, right = left + width;
    if (left - offset < padding) offset = left - padding;
    if (right - offset > viewport - padding) offset = right - viewport + padding;
    return { offset: Math.max(0, Math.min(max, offset)), max: max };
  }
  function initials(name) {
    var words = text(name).replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]/g, " ").split(/\s+/), out = "", i;
    for (i = 0; i < words.length && out.length < 2; i++) if (words[i]) out += words[i].charAt(0).toUpperCase();
    return out || "TV";
  }
  /* lastUse: etiqueta de lastUseLabel; sólo se añade a las apps. Las dos
     líneas nunca coinciden, aunque la descripción venga de un dato externo. */
  /* category (1.8.0, opcional): etiqueta de la categoría de la app; se usa
     en la biblioteca («Deportes · ★ Favorita»). */
  function heroLines(item, app, favorite, lastUse, category) {
    var kinds = { "action:media": "Reproductor integrado", "action:library": "Biblioteca", "action:sources": "Entradas del proyector",
      "action:refresh": "Catálogo", "action:configure": "Ajustes" };
    var description = app ? "Pulsa OK para abrir. Mantén OK para organizar esta aplicación." : text(item && item.description);
    var position = app ? (favorite ? "★ Favorita" : "Aplicación") : (kinds[item && item.id] || (item && item.kind === "filter" ? "Buscar y filtrar" : "Home"));
    if (app && text(category)) position = text(category) + (favorite ? " · ★ Favorita" : "");
    if (app && text(lastUse)) position += " · Último uso: " + text(lastUse);
    if (position === description) position = "Home";
    if (position === description) position = "";
    return { position: position, description: description };
  }
  var SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  function validTime(value) { return typeof value === "number" && isFinite(value) && value > 0 && value < 8.64e15; }
  function dayStart(time) { var date = new Date(time); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
  /* Hora local, formato es-ES: «hoy 10:12», «ayer», «3 nov» o «3 nov 2025». */
  function lastUseLabel(ts, now) {
    if (!validTime(ts)) return "";
    if (!validTime(now)) now = new Date().getTime();
    var date = new Date(ts), days = Math.round((dayStart(now) - dayStart(ts)) / 86400000);
    if (days === 0) return "hoy " + date.getHours() + ":" + ("0" + date.getMinutes()).slice(-2);
    if (days === 1) return "ayer";
    return date.getDate() + " " + SHORT_MONTHS[date.getMonth()] + (date.getFullYear() !== new Date(now).getFullYear() ? " " + date.getFullYear() : "");
  }
  /* Apps con historial, por último uso; empate por número de usos y luego
     por el orden guardado. Excluye ocultas y entradas sin app instalada. */
  function recentApps(apps, usage, options) {
    options = options || {};
    apps = Array.isArray(apps) ? apps : [];
    usage = usage && typeof usage === "object" ? usage : {};
    var hidden = Array.isArray(options.hidden) ? options.hidden : [], order = Array.isArray(options.order) ? options.order : [];
    var limit = typeof options.limit === "number" && options.limit >= 0 ? Math.floor(options.limit) : 12, list = [], seen = Object.create(null), i, app, entry;
    for (i = 0; i < apps.length; i++) {
      app = apps[i];
      if (!app || typeof app.id !== "string" || seen[app.id] || hidden.indexOf(app.id) >= 0 || !own.call(usage, app.id)) continue;
      entry = usage[app.id];
      if (!entry || !validTime(entry.last)) continue;
      seen[app.id] = true;
      list.push({ app: app, last: entry.last, count: typeof entry.count === "number" && isFinite(entry.count) ? entry.count : 0, at: order.indexOf(app.id) });
    }
    list.sort(function (a, b) {
      return b.last - a.last || b.count - a.count || (a.at < 0 ? 1e9 : a.at) - (b.at < 0 ? 1e9 : b.at) || (a.app.id < b.app.id ? -1 : a.app.id > b.app.id ? 1 : 0);
    });
    return list.slice(0, limit).map(function (value) { return value.app; });
  }
  /* Teclas del mando (keyCode de Samsung) y su acción en cada vista.
     El mando del Freestyle sólo tiene Play/Pausa y Canal ▲▼ de estas; los
     colores, Info y los dígitos se conservan para otros mandos. */
  var REMOTE_KEYS = { ColorF0Red: 403, ColorF1Green: 404, ColorF2Yellow: 405, ColorF3Blue: 406, Info: 457,
    "0": 48, "1": 49, "2": 50, "3": 51, "4": 52, "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
    ChannelUp: 427, ChannelDown: 428, MediaPlayPause: 10252 };
  /* Ciclo de la fila del inicio con Canal ▲ (dir > 0) y Canal ▼ (dir < 0). */
  var HOME_MODES = ["favorites", "recent", "all"];
  function nextHomeMode(mode, dir) {
    var at = HOME_MODES.indexOf(mode), step = Number(dir) < 0 ? -1 : 1;
    if (at < 0) return step > 0 ? HOME_MODES[1] : HOME_MODES[HOME_MODES.length - 1];
    return HOME_MODES[(at + step + HOME_MODES.length) % HOME_MODES.length];
  }
  /* context: { view, kind (de la tarjeta enfocada), favoriteCount, fullscreen, editing }.
     Devuelve null cuando la tecla no aplica: nunca hay acciones implícitas. */
  function remoteAction(keyCode, context) {
    context = context || {};
    var view = context.view, isApp = context.kind === "app", count = Number(context.favoriteCount) || 0, browse = view === "home" || view === "library";
    if (context.editing) return null;
    if (keyCode === 10252 && (context.fullscreen || view === "media")) return { type: "playPause" };
    if (context.fullscreen) return null;
    if (view === "reorder") return keyCode === 404 ? { type: "saveOrder" } : null;
    if (!browse) return null;
    if (keyCode === 10252) return isApp ? { type: "options" } : null;
    if (keyCode === 427 || keyCode === 428) return view === "home" ? { type: "homeMode", dir: keyCode === 427 ? 1 : -1 } : { type: "page", dir: keyCode === 427 ? -1 : 1 };
    if (keyCode === 406) return { type: "settings" };
    if (keyCode === 403) return isApp ? { type: "favorite" } : null;
    if (keyCode === 404) return isApp ? { type: "order" } : null;
    if (keyCode === 405) return isApp ? { type: "hide" } : null;
    if (keyCode === 457) return isApp ? { type: "options" } : null;
    if (keyCode === 48) return view === "home" ? { type: "library" } : null;
    if (keyCode >= 49 && keyCode <= 57) return keyCode - 49 < count ? { type: "openFavorite", index: keyCode - 49 } : null;
    return null;
  }
  /* Volver en la raíz de inicio nunca sale de Home: lleva el foco al principio
     de la fila o, si ya está ahí, sólo avisa (state.atStart). */
  function backAtRoot(state) { return state && state.atStart ? { hint: true } : { focusStart: true }; }
  /* Volver a Home al cerrar una app lanzada desde Home (1.7.3, revisado en
     1.7.4). Sólo si: está activado, Home sigue oculta, la app cerrada es la
     última lanzada, se vio en ejecución en un sondeo con Home oculta
     (lastLaunch.seen), ya no figura entre las apps en ejecución y no ha
     aparecido otra app nueva respecto a lastLaunch.contexts. Si no hubo
     instantánea previa (contexts null, p. ej. getAppsContext lento), no se
     comparan otras apps: basta con que la app vista desaparezca. state.appIds
     (opcional) limita las «apps nuevas» al catálogo, para que un servicio del
     sistema que arranca solo no bloquee el retorno. */
  function shouldReturnHome(state) {
    state = state || {};
    var last = state.lastLaunch, running = state.runningIds, before, candidates = Array.isArray(state.appIds) ? state.appIds : null, i, appId;
    if (state.returnHome !== true || state.hidden !== true) return false;
    if (!last || typeof last.id !== "string" || !last.id || state.terminatedId !== last.id || last.seen !== true) return false;
    if (!Array.isArray(running) || running.indexOf(last.id) >= 0) return false;
    if (!Array.isArray(last.contexts)) return true;
    before = last.contexts;
    for (i = 0; i < running.length; i++) {
      appId = running[i];
      if (typeof appId !== "string" || appId === last.id || appId === state.selfId || before.indexOf(appId) >= 0) continue;
      if (candidates && candidates.indexOf(appId) < 0) continue;
      return false;
    }
    return true;
  }
  /* Un sondeo de la vigilancia de retorno (1.7.4). Actualiza launch (objeto
     propio de la vigilancia) y devuelve { action, reason }:
     - "wait": seguir vigilando; "confirm": la app falta, repetir pronto;
     - "decide": la app vista falta en RETURN_RULES.misses sondeos seguidos y
       pasaron RETURN_RULES.minSeenMs desde que se vio: decidir el retorno;
     - "stop": dejar de vigilar (reason: visible, not-hidden, not-seen).
     obs = { hidden, runningIds (array o null si la consulta falló), now }.
     seen sólo se marca en un sondeo posterior al lanzamiento con Home oculta:
     nunca desde la instantánea previa (una instancia anterior que aún se
     cierra no cuenta). Si falta la instantánea previa, el primer sondeo
     válido antes de ver la app la sustituye (launch.snapshot = "retry"). */
  var RETURN_RULES = { misses: 2, minSeenMs: 2000, notSeenMs: 30000, notHiddenMs: 15000 };
  function returnWatchStep(launch, obs) {
    obs = obs || {};
    if (!launch || typeof launch.id !== "string" || !launch.id) return { action: "stop", reason: "none" };
    var now = Number(obs.now) || 0, running = Array.isArray(obs.runningIds) ? obs.runningIds : null, at = Number(launch.at) || 0;
    if (obs.hidden !== true) {
      if (launch.hiddenSeen) return { action: "stop", reason: "visible" };
      return now - at > RETURN_RULES.notHiddenMs ? { action: "stop", reason: "not-hidden" } : { action: "wait", reason: "not-hidden-yet" };
    }
    launch.hiddenSeen = true;
    if (!running) return !launch.seen && now - at > RETURN_RULES.notSeenMs ? { action: "stop", reason: "not-seen" } : { action: "wait", reason: "no-list" };
    if (!Array.isArray(launch.contexts) && !launch.seen) { launch.contexts = running.slice(); launch.snapshot = "retry"; }
    if (running.indexOf(launch.id) >= 0) {
      launch.seen = true; launch.misses = 0; launch.missingSince = 0;
      if (!launch.firstSeenAt) launch.firstSeenAt = now;
      return { action: "wait", reason: "running" };
    }
    if (!launch.seen) return now - at > RETURN_RULES.notSeenMs ? { action: "stop", reason: "not-seen" } : { action: "wait", reason: "not-seen-yet" };
    launch.misses = (Number(launch.misses) || 0) + 1;
    if (launch.misses === 1) launch.missingSince = now;
    if (launch.misses >= RETURN_RULES.misses && now - (Number(launch.firstSeenAt) || now) >= RETURN_RULES.minSeenMs) return { action: "decide", reason: "closed" };
    return { action: "confirm", reason: "missing" };
  }
  /* Registro de retorno (1.7.4): lista de entradas { at, type, appId, name?,
     ms?, reason? }; type = open, return, no-return, fail o stop. */
  var RETURN_LOG_TYPES = ["open", "return", "no-return", "fail", "stop", "shortcut"];
  function cleanLogEntry(entry) {
    if (!entry || typeof entry !== "object" || RETURN_LOG_TYPES.indexOf(entry.type) < 0) return null;
    var at = Number(entry.at), result;
    if (!isFinite(at) || at <= 0) return null;
    result = { at: Math.floor(at), type: entry.type, appId: typeof entry.appId === "string" ? entry.appId.slice(0, 200) : "" };
    if (typeof entry.name === "string" && entry.name) result.name = entry.name.slice(0, 80);
    if (typeof entry.ms === "number" && isFinite(entry.ms) && entry.ms >= 0) result.ms = Math.round(entry.ms);
    if (typeof entry.reason === "string" && entry.reason) result.reason = entry.reason.slice(0, 160);
    if (typeof entry.detail === "string" && entry.detail) result.detail = entry.detail.slice(0, 200);
    return result;
  }
  function appendReturnLog(list, entry, max) {
    var result = [], i, clean;
    max = Math.max(1, Math.floor(Number(max) || 50));
    list = Array.isArray(list) ? list : [];
    for (i = 0; i < list.length; i++) { clean = cleanLogEntry(list[i]); if (clean) result.push(clean); }
    clean = cleanLogEntry(entry); if (clean) result.push(clean);
    return result.length > max ? result.slice(result.length - max) : result;
  }
  var RETURN_REASONS = { "other-app": "se abrió otra app mientras tanto", disabled: "la opción está desactivada", "not-seen": "la app no llegó a verse en ejecución",
    "not-hidden": "Home no llegó a ocultarse", visible: "Home se mostró antes por otra vía", "return-failed": "falló el relanzamiento de Home",
    "no-visible": "Home no llegó a mostrarse tras dos intentos", "launch-failed": "no se pudo abrir", "not-hidden-after": "Home seguía oculta" };
  function pad2(value) { return (value < 10 ? "0" : "") + value; }
  function returnLogLine(entry, names) {
    var date = new Date(entry.at), time = pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    var name = entry.name || (names && entry.appId && names[entry.appId]) || entry.appId || "App", reason = RETURN_REASONS[entry.reason] || entry.reason || "motivo desconocido";
    var extra = entry.detail ? " (" + entry.detail + ")" : "";
    if (entry.type === "shortcut") return time + " " + name + " → LFA Home abierto con mando" + extra;
    if (entry.type === "open") return time + " " + name + " abierta" + extra;
    if (entry.type === "return") return time + " " + name + " cerrada → Home volvió" + (typeof entry.ms === "number" ? " en " + (entry.ms / 1000).toFixed(1).replace(".", ",") + " s" : "") + extra;
    if (entry.type === "no-return" || entry.type === "fail") return time + " " + name + " cerrada → no volvió: " + reason + extra;
    return time + " " + name + ": sin retorno automático, " + reason + extra;
  }
  /* Últimas `limit` líneas legibles, de la más reciente a la más antigua. */
  function returnLogLines(entries, names, limit) {
    var list = appendReturnLog(entries, null, 1000), result = [], i;
    limit = Math.max(1, Math.floor(Number(limit) || 5));
    for (i = list.length - 1; i >= 0 && result.length < limit; i--) result.push(returnLogLine(list[i], names));
    return result;
  }
  /* Buscador por letras (1.8.0). La consulta se normaliza como los nombres
     (sin acentos, minúsculas) y sólo conserva letras y dígitos. */
  var SEARCH_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
  function normalizeQuery(value) {
    return fold(typeof value === "string" ? value : "").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");
  }
  /* Sólo el título: «FOX One: Live News…» o «Spotify - Music…» no deben
     aparecer al buscar «ne» o «mu» por su subtítulo. */
  function nameWords(name) {
    var folded = fold(name).replace(/ç/g, "c").split(/\s*[:\uff1a]\s*|\s+[-\u2013\u2014]\s+/)[0], words = folded.split(/[^a-z0-9]+/), result = [], i;
    for (i = 0; i < words.length; i++) if (words[i]) result.push(words[i]);
    /* «Disney+», «HBO Max»: el nombre completo sin separadores también cuenta. */
    result.push(folded.replace(/[^a-z0-9]/g, ""));
    return result;
  }
  /* Coincidencia por prefijo de palabra: «ne» → Netflix, «tv» → Samsung TV
     Plus. Conserva el orden recibido; una consulta vacía devuelve todo. */
  function searchApps(apps, query) {
    var wanted = normalizeQuery(query), result = [], i, j, words;
    apps = Array.isArray(apps) ? apps : [];
    for (i = 0; i < apps.length; i++) {
      if (!apps[i] || typeof apps[i] !== "object") continue;
      if (!wanted) { result.push(apps[i]); continue; }
      words = nameWords(apps[i].name || apps[i].id);
      for (j = 0; j < words.length; j++) if (words[j].indexOf(wanted) === 0) { result.push(apps[i]); break; }
    }
    return result;
  }
  /* Categorías fijas (1.8.0). defaultCategory asigna por patrones sobre el
     nombre normalizado y el id; el primer patrón que coincide decide. El
     usuario puede cambiarla (preferencia categories = { appId: categoryId }). */
  var CATEGORIES = [{ id: "video", label: "Vídeo" }, { id: "sport", label: "Deportes" }, { id: "music", label: "Música" },
    { id: "games", label: "Juegos" }, { id: "tools", label: "Utilidades" }, { id: "system", label: "Sistema" }, { id: "other", label: "Otras" }];
  var CATEGORY_IDS = ["video", "sport", "music", "games", "tools", "system", "other"];
  var CATEGORY_RULES = [
    { category: "sport", re: /volley|\bnba\b|vbtv|dazn|espn|nbc ?sports|eurosport|\bnfl\b|\bnhl\b|\bmlb\b|laliga|motogp|\bf1 ?tv\b/ },
    { category: "music", re: /spotify|\bmusic|\bmusica|qobuz|deezer|tidal|soundcloud|tunein|\bradio\b/ },
    { category: "games", re: /gaming ?hub|gaminghub|\bgam(?:e|es|ing)|xbox|\bjuegos?\b|\bluna\b|lunawebapp|geforce|blacknut|antstream|playstation/ },
    { category: "video", re: /netflix|disney|\bhbo\b|\bmax\b|prime ?video|primevideo|\bplex\b|jellyfin|youtube|rakuten|movistar|atresplayer|3cat|\btv3\b|apple ?tv|aria-video|samsung tv plus|tvplus|vidio|televen|hulu|paramount|peacock|pluto|tubi|roku|sling|\bamc\b|amcplus|angel studios|sony ?one|twitch|fox ?one|skyshowtime|filmin|crunchyroll|mubi|rtve|mitele|\blatina\b|\bqvc\b|\bhsn\b/ },
    { category: "tools", re: /browser|\binternet\b|workspace|whiteboard|remote ?desk|\bdocs?\b|diagnostic|cleanframe|framehome|alexa|instagram|gallery|galeria|tizenbrew/ },
    { category: "system", re: /smartthings|\bsettings?\b|\bajustes\b|tv\.store|\bapps\b|tienda|samsung promotion|promotion|windows 365|technogym|samsung health|samsung-health|security ?center|bixby/ }
  ];
  function isCategory(value) { return typeof value === "string" && CATEGORY_IDS.indexOf(value) >= 0; }
  function categoryLabel(value) {
    var i; for (i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === value) return CATEGORIES[i].label;
    return "";
  }
  function defaultCategory(app) {
    var key = app && typeof app === "object" ? fold(app.name) + " | " + text(app.id).toLowerCase() : "", i;
    for (i = 0; key && i < CATEGORY_RULES.length; i++) if (CATEGORY_RULES[i].re.test(key)) return CATEGORY_RULES[i].category;
    return "other";
  }
  function appCategory(app, overrides) {
    var id = app && typeof app.id === "string" ? app.id : "";
    if (id && overrides && typeof overrides === "object" && own.call(overrides, id) && isCategory(overrides[id])) return overrides[id];
    return defaultCategory(app);
  }
  var APP_DESCRIPTIONS = {
    "netflix": "Películas, series y documentales.",
    "prime video": "Series y películas de Prime Video.",
    "disney+": "Explora Disney, Pixar, Marvel, Star Wars y National Geographic.",
    "apple tv": "Explora Apple Originals y consulta tu biblioteca.",
    "youtube": "Vídeos, canales, suscripciones y directos.",
    "hbo max": "Películas, series y documentales de HBO Max.",
    "spotify": "Música y pódcast.",
    "jellyfin": "Películas, series y música de un servidor Jellyfin.",
    "samsung tv plus": "Canales de televisión y programación en directo.",
    "volley rusia": "Calendario y vídeos de las competiciones de voleibol de Rusia.",
    "volley turquia": "Calendario y vídeos de las competiciones de voleibol de Turquía."
  };
  function appDescription(app) {
    var name = fold(app && app.name);
    return own.call(APP_DESCRIPTIONS, name) ? APP_DESCRIPTIONS[name] : "";
  }
  /* { all, video, sport, … }: número de apps de cada categoría. */
  function categoryCounts(apps, overrides) {
    var counts = { all: 0 }, i;
    apps = Array.isArray(apps) ? apps : [];
    for (i = 0; i < CATEGORY_IDS.length; i++) counts[CATEGORY_IDS[i]] = 0;
    for (i = 0; i < apps.length; i++) if (apps[i]) { counts.all++; counts[appCategory(apps[i], overrides)]++; }
    return counts;
  }
  function filterByCategory(apps, category, overrides) {
    apps = Array.isArray(apps) ? apps : [];
    if (!isCategory(category)) return apps.slice();
    return apps.filter(function (app) { return !!app && appCategory(app, overrides) === category; });
  }
  function nextCategory(category) { var at = CATEGORY_IDS.indexOf(category); return CATEGORY_IDS[(at + 1) % CATEGORY_IDS.length]; }
  /* Apps del sistema ocultas por defecto (1.12.0). Patrones sobre el nombre
     normalizado y el id (en minúsculas), como CATEGORY_RULES. KEEP manda
     sobre las reglas: la tienda Apps Samsung, Samsung TV Plus, Browser,
     Alexa, Volley, APL Launcher y Free My TV nunca se ocultan solas. */
  var SYSTEM_HIDDEN_RULES = [
    { id: "smartthings", re: /smartthings/ },
    { id: "gaming-hub", re: /gaming ?hub|gaminghub/ },
    { id: "cloud-pc", re: /windows ?365|win365|cloud ?pc|knox-browser/ },
    { id: "workspace", re: /\bworkspace\b|workspaceredi/ },
    { id: "technogym", re: /technogym/ },
    { id: "promotion", re: /samsung promotion|promotionapp|bixby-promotion/ },
    { id: "setting", re: /^(?:setting|settings|ajustes) \||\.coba\.|tv\.coba/ },
    { id: "glance", re: /\bglance\b/ },
    { id: "samsung-health", re: /samsung health|samsung-health/ },
    { id: "security-center", re: /security ?center|securitycenter/ },
    { id: "manual", re: /^(?:e-manual|user guide|guia del usuario) \||\.emanual$/ }
  ];
  var SYSTEM_HIDDEN_KEEP = /^(?:com\.samsung\.tv\.store|org\.tizen\.browser|hepsqfnie0\.tvplusstandalone|aqko41xykp\.amazonalexa|lfavolley\d\.volley|apllnch001\.apllauncher|freemytv01\.freemytv)$|^(?:apps samsung|samsung tv plus|browser|amazon alexa|volley.*|apl launcher|free my tv) \|/;
  function systemHiddenRule(app) {
    var key = app && typeof app === "object" ? fold(app.name) + " | " + text(app.id).toLowerCase() : "", i;
    if (!key || key === " | " || SYSTEM_HIDDEN_KEEP.test(text(app.id).toLowerCase()) || SYSTEM_HIDDEN_KEEP.test(key)) return "";
    for (i = 0; i < SYSTEM_HIDDEN_RULES.length; i++) if (SYSTEM_HIDDEN_RULES[i].re.test(key)) return SYSTEM_HIDDEN_RULES[i].id;
    return "";
  }
  function isSystemHidden(app) { return !!systemHiddenRule(app); }
  /* Ids que Home oculta sola: apps del sistema que el usuario no ha hecho
     suyas (favoritas, con historial de uso o restauradas) ni ha ocultado ya
     a mano (siguen en hidden, sin duplicar). Con hideSystemApps false, ninguna. */
  function autoHiddenIds(apps, prefs) {
    var result = [], seen = Object.create(null), list = function (value) { return Array.isArray(value) ? value : []; }, i, app;
    prefs = prefs && typeof prefs === "object" ? prefs : {};
    if (prefs.hideSystemApps === false) return result;
    var favorites = list(prefs.favorites), hidden = list(prefs.hidden), restored = list(prefs.restored);
    var usage = prefs.usage && typeof prefs.usage === "object" ? prefs.usage : {};
    apps = Array.isArray(apps) ? apps : [];
    for (i = 0; i < apps.length; i++) {
      app = apps[i];
      if (!app || typeof app.id !== "string" || !app.id || seen[app.id] || !isSystemHidden(app)) continue;
      if (favorites.indexOf(app.id) >= 0 || hidden.indexOf(app.id) >= 0 || restored.indexOf(app.id) >= 0 || own.call(usage, app.id)) continue;
      seen[app.id] = true; result.push(app.id);
    }
    return result;
  }
  /* Salvapantallas (1.9.0). screensaverDue decide si toca mostrarlo: N
     minutos (minutes > 0) sin pulsar teclas, Home visible, sin vídeo en el
     reproductor integrado, fuera de la vista de medios (media, media-add,
     media-manage) y sin un formulario editándose. */
  var SCREENSAVER_MINUTES = [0, 1, 2, 5, 10, 15, 30];
  function screensaverDue(state) {
    if (!state || typeof state !== "object") return false;
    var minutes = state.minutes, lastInput = state.lastInput, now = state.now;
    if (typeof minutes !== "number" || !isFinite(minutes) || minutes <= 0) return false;
    if (state.visible !== true || state.playing || state.editing) return false;
    if (typeof state.view === "string" && /^media(-|$)/.test(state.view)) return false;
    if (typeof lastInput !== "number" || typeof now !== "number" || !isFinite(lastInput) || !isFinite(now)) return false;
    return now - lastInput >= minutes * 60000;
  }
  /* Rejilla 3×3 (porcentajes del centro del bloque). El orden alterna
     esquinas y bordes para que cada salto de 60 s mueva bien los píxeles. */
  var SCREENSAVER_GRID = [{ x: 22, y: 28 }, { x: 50, y: 28 }, { x: 78, y: 28 }, { x: 22, y: 50 }, { x: 50, y: 50 }, { x: 78, y: 50 }, { x: 22, y: 72 }, { x: 50, y: 72 }, { x: 78, y: 72 }];
  var SCREENSAVER_ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5];
  function screensaverPosition(tick) {
    var n = typeof tick === "number" && isFinite(tick) ? Math.floor(tick) : 0, cell;
    n = ((n % SCREENSAVER_ORDER.length) + SCREENSAVER_ORDER.length) % SCREENSAVER_ORDER.length;
    cell = SCREENSAVER_GRID[SCREENSAVER_ORDER[n]];
    return { x: cell.x, y: cell.y };
  }

  /* Degradados de marca con iconos proporcionados por el televisor.
     BRAND_ART se busca por el nombre normalizado. logoScale expresa la
     fracción del alto que ocupa el icono. */
  var HEX = /^#[0-9a-f]{6}$/i;
  var BRAND_ART = [
    { key: "netflix", re: /^netflix$/, gradient: ["#3a0609", "#050505"], angle: 135, logoScale: .34, logoAlign: "center", logo: null },
    { key: "disney", re: /^disney\+?$/, gradient: ["#0d4b8c", "#07122c"], angle: 145, logoScale: .5, logoAlign: "center", logo: null },
    { key: "hbo", re: /^(?:hbo max|max)$/, gradient: ["#4a2ad0", "#0e0830"], angle: 140, logoScale: .5, logoAlign: "center", logo: null },
    { key: "prime", re: /^(?:amazon )?prime video$/, gradient: ["#1a86f0", "#08214f"], angle: 145, logoScale: .4, logoAlign: "center", logo: null },
    { key: "appletv", re: /^apple tv(?:\+)?$/, gradient: ["#45464d", "#0b0b0e"], angle: 150, logoScale: .44, logoAlign: "center", logo: null },
    { key: "youtube", re: /^youtube$/, gradient: ["#ffffff", "#e6e6e6"], angle: 160, logoScale: .3, logoAlign: "center", logo: null },
    { key: "youtubetv", re: /^youtube tv$/, gradient: ["#3a3a3a", "#0e0e0e"], angle: 150, logoScale: .5, logoAlign: "center", logo: null },
    { key: "plex", re: /^plex$/, gradient: ["#34363f", "#101115"], angle: 145, logoScale: .4, logoAlign: "center", logo: null },
    { key: "jellyfin", re: /^jellyfin$/, gradient: ["#5b2a91", "#0b3a66"], angle: 135, logoScale: .58, logoAlign: "center", logo: null },
    { key: "rakuten", re: /^rakuten(?: tv)?$/, gradient: ["#ffffff", "#ececec"], angle: 160, logoScale: .3, logoAlign: "center", logo: null },
    { key: "movistar", re: /^movistar(?:\+|plus)?$/, gradient: ["#0ba3e0", "#063f69"], angle: 145, logoScale: .44, logoAlign: "center", logo: null },
    { key: "atresplayer", re: /^atresplayer$/, gradient: ["#ffffff", "#ededed"], angle: 160, logoScale: .26, logoAlign: "center", logo: null },
    { key: "3cat", re: /^(?:3cat|tv3)$/, gradient: ["#26262c", "#060607"], angle: 145, logoScale: .36, logoAlign: "center", logo: null },
    { key: "spotify", re: /^spotify(?:\b.*)?$/, gradient: ["#1db954", "#08331a"], angle: 140, logoScale: .58, logoAlign: "center", logo: null },
    { key: "tvplus", re: /^samsung tv plus$/, gradient: ["#1f3fd1", "#0a1144"], angle: 145, logoScale: .58, logoAlign: "center", logo: null },
    { key: "volleyrusia", re: /^volley rusia$/, gradient: ["#2a4fb0", "#5c1018"], angle: 135, logoScale: .62, logoAlign: "center", logo: null },
    { key: "volleyturquia", re: /^volley turquia$/, gradient: ["#d90b18", "#4a0307"], angle: 140, logoScale: .62, logoAlign: "center", logo: null },
    { key: "nba", re: /^nba$/, gradient: ["#1d428a", "#0a1430"], angle: 140, logoScale: .6, logoAlign: "center", logo: null },
    { key: "vbtv", re: /^vbtv$/, gradient: ["#34421c", "#0b0e08"], angle: 140, logoScale: .62, logoAlign: "center", logo: null },
    { key: "espn", re: /^espn$/, gradient: ["#c8102e", "#3d0510"], angle: 140, logoScale: .56, logoAlign: "center", logo: null },
    { key: "nbcsports", re: /^nbc sports$/, gradient: ["#3d4150", "#0f1116"], angle: 145, logoScale: .6, logoAlign: "center", logo: null },
    { key: "browser", re: /^(?:internet|browser|samsung internet)$/, gradient: ["#2f6ef0", "#0b1c48"], angle: 145, logoScale: .58, logoAlign: "center", logo: null },
    { key: "twitch", re: /^twitch$/, gradient: ["#9146ff", "#25094f"], angle: 140, logoScale: .6, logoAlign: "center", logo: null }
  ];
  function brandArt(name) {
    var key = fold(name), i;
    if (!key) return null;
    for (i = 0; i < BRAND_ART.length; i++) if (BRAND_ART[i].re.test(key)) return BRAND_ART[i];
    return null;
  }
  function toHex(rgb) {
    var out = "#", i, v;
    for (i = 0; i < 3; i++) { v = Math.max(0, Math.min(255, Math.round(Number(rgb[i]) || 0))); out += (v < 16 ? "0" : "") + v.toString(16); }
    return out;
  }
  function fromHex(hex) { var v = parseInt(String(hex).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function luminance(rgb) { return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000; }
  function saturation(rgb) { var max = Math.max(rgb[0], rgb[1], rgb[2]), min = Math.min(rgb[0], rgb[1], rgb[2]); return max ? (max - min) / max : 0; }
  /* Dos colores dominantes de un icono a partir de sus píxeles RGBA (array
     o Uint8ClampedArray, p. ej. getImageData de 16×16). Se ignoran los
     píxeles casi transparentes; se agrupan en cubos de 32 niveles por
     canal y gana el cubo más poblado, con un pequeño extra para los colores
     saturados (un logo rojo sobre blanco da blanco y rojo, no dos grises).
     El segundo color debe diferir del primero; si no hay otro, se deriva
     una versión más oscura del primero. null si no hay píxeles opacos. */
  function dominantColors(pixels, options) {
    options = options || {};
    var minAlpha = typeof options.minAlpha === "number" ? options.minAlpha : 200;
    var buckets = Object.create(null), order = [], i, r, g, b, k, bucket, total = 0;
    if (!pixels || typeof pixels.length !== "number") return null;
    for (i = 0; i + 3 < pixels.length; i += 4) {
      if (pixels[i + 3] < minAlpha) continue;
      r = pixels[i]; g = pixels[i + 1]; b = pixels[i + 2];
      k = (r >> 5) + "," + (g >> 5) + "," + (b >> 5);
      bucket = buckets[k];
      if (!bucket) { bucket = buckets[k] = { n: 0, r: 0, g: 0, b: 0 }; order.push(k); }
      bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b; total++;
    }
    if (!total) return null;
    var ranked = order.map(function (key) {
      var x = buckets[key], rgb = [x.r / x.n, x.g / x.n, x.b / x.n];
      return { rgb: rgb, n: x.n, score: x.n * (1 + saturation(rgb) * .6) };
    });
    ranked.sort(function (a, c) { return c.score - a.score || c.n - a.n; });
    var first = ranked[0].rgb, second = null, d;
    for (i = 1; i < ranked.length; i++) {
      d = Math.abs(ranked[i].rgb[0] - first[0]) + Math.abs(ranked[i].rgb[1] - first[1]) + Math.abs(ranked[i].rgb[2] - first[2]);
      if (d >= 60 && ranked[i].n >= total * .04) { second = ranked[i].rgb; break; }
    }
    if (!second) second = [first[0] * .55, first[1] * .55, first[2] * .55];
    return [toHex(first), toHex(second)];
  }
  /* Degradado de TV a partir de dos colores: se oscurecen para que el icono
     destaque y nunca quedan blancos (el arte enriquecido es oscuro salvo las
     marcas que piden fondo claro). */
  function mixDark(hex, amount) { var c = fromHex(hex); return toHex([c[0] * (1 - amount), c[1] * (1 - amount), c[2] * (1 - amount)]); }
  function artGradient(colors) {
    if (!Array.isArray(colors) || colors.length < 2 || !HEX.test(colors[0]) || !HEX.test(colors[1])) return ["#2b3247", "#11141d"];
    var a = colors[0], b = colors[1], ca = fromHex(a), cb = fromHex(b);
    /* El color más saturado va arriba; el blanco o gris queda como sombra. */
    if (saturation(cb) > saturation(ca) + .15) { a = colors[1]; b = colors[0]; ca = cb; }
    var top = mixDark(a, luminance(ca) > 170 ? .55 : .3), bottom = mixDark(b, .72);
    return [top, bottom];
  }
  var ART_DEFAULT = { gradient: ["#2b3247", "#11141d"], angle: 145, logoScale: .6, logoAlign: "center" };
  /* Arte de una app: marca conocida (degradado + logo local o icono) o
     derivado (paleta del icono + icono ampliado y desenfocado de fondo).
     palette = [c1, c2] calculados en el lanzador (null si aún no hay). */
  function tileArtSpec(app, palette) {
    var name = app && app.name, entry = brandArt(name);
    /* tone «light»: fondo claro (YouTube, Rakuten…): viñeta más suave.
       darken: oscurecido del fondo desenfocado, 0,35; 0,55 si el icono es
       casi blanco (si no, el fondo quedaría gris claro bajo un icono blanco). */
    if (entry) return { kind: "brand", key: entry.key, gradient: entry.gradient.slice(), angle: entry.angle, logoScale: entry.logoScale, logoAlign: entry.logoAlign, logo: entry.logo, backdrop: false,
      tone: luminance(fromHex(entry.gradient[0])) > 200 ? "light" : "dark", darken: 0 };
    var light = !!(palette && HEX.test(palette[0]) && luminance(fromHex(palette[0])) > 200);
    return { kind: "derived", key: null, gradient: palette ? artGradient(palette) : ART_DEFAULT.gradient.slice(), angle: ART_DEFAULT.angle,
      logoScale: ART_DEFAULT.logoScale, logoAlign: ART_DEFAULT.logoAlign, logo: null, backdrop: true, tone: "dark", darken: light ? .55 : .35 };
  }
  function artBackground(spec) {
    if (!spec || !spec.gradient || !HEX.test(spec.gradient[0]) || !HEX.test(spec.gradient[1])) return "linear-gradient(145deg,#2b3247 0%,#11141d 100%)";
    return "linear-gradient(" + (Number(spec.angle) || 145) + "deg," + spec.gradient[0] + " 0%," + spec.gradient[1] + " 100%)";
  }
  /* Caja del logo/icono en porcentajes de una tarjeta 16:9 (tarjetas y
     ventana superior comparten proporción). Alto = logoScale; si la imagen
     es muy ancha, se limita a maxWidth y baja el alto. Conserva la
     proporción de la imagen (sin deformar ni recortar). */
  var ART_RATIO = 16 / 9;
  function artLayout(spec, width, height, options) {
    options = options || {};
    var scale = spec && typeof spec.logoScale === "number" && spec.logoScale > 0 && spec.logoScale <= 1 ? spec.logoScale : .6;
    var maxWidth = typeof options.maxWidth === "number" ? options.maxWidth : 78;
    /* options.ratio: proporción real del interior (sin el borde); 16:9 por defecto. */
    var box = options.ratio > 0 ? options.ratio : ART_RATIO;
    var ratio = width > 0 && height > 0 ? width / height : 1;
    /* options.boxWidth (px) + options.maxUpscale: no ampliar la imagen más
       de maxUpscale veces su tamaño natural (la ventana superior es grande y
       los logos locales miden ~200 px). */
    if (options.boxWidth > 0 && options.maxUpscale > 0 && width > 0 && height > 0) {
      maxWidth = Math.min(maxWidth, width * options.maxUpscale / options.boxWidth * 100);
      scale = Math.min(scale, height * options.maxUpscale / (options.boxWidth / box));
    }
    var h = scale * 100, w = h / box * ratio;
    if (w > maxWidth) { w = maxWidth; h = w * box / ratio; }
    var left = spec && spec.logoAlign === "left" ? 9 : (100 - w) / 2;
    var round = function (v) { return Math.round(v * 100) / 100; };
    return { width: round(w), height: round(h), left: round(left), top: round((100 - h) / 2) };
  }
  var TILE_ART_MODES = ["rich", "flat", "full"];
  function normalizeTileArt(value) { return TILE_ART_MODES.indexOf(value) >= 0 ? value : "rich"; }
  /* 1.13.0: «Atenuar interfaz». dimLevel(pref, date) → "off" | "soft" | "night".
     «auto» aplica «night» de 22:00 a 06:59 (hora local de date: Date o ms);
     sin fecha válida, «auto» no atenúa. Cualquier otra preferencia → "off". */
  var DIM_MODES = ["off", "soft", "night", "auto"];
  function dimLevel(pref, date) {
    if (pref === "soft" || pref === "night") return pref;
    if (pref !== "auto") return "off";
    if (typeof date === "number" && isFinite(date)) date = new Date(date);
    var hour = date && typeof date.getHours === "function" ? date.getHours() : NaN;
    if (typeof hour !== "number" || !isFinite(hour)) return "off";
    return hour >= 22 || hour < 7 ? "night" : "off";
  }
  /* 1.27.0: asignación de botones físicos del mando como acceso directo a LFA Home.
     En Samsung Tizen, el botón físico «Samsung TV Plus» lanza el ayudante efímero
     com.samsung.tv.tvPlusDeeplinker y el botón «Disney+» inicia MCmYXNxgcu.DisneyPlus
     si estaba cerrada; si el usuario las abre desde dentro de LFA Home, ignoreIds
     evita interceptarlas. También se permite capturar una tecla configurable del mando. */
  var SAMSUNG_HOME_BUTTONS = ["off", "tvplus", "disney", "both"];
  var TVPLUS_DEEPLINKER = "com.samsung.tv.tvPlusDeeplinker", TVPLUS_APP = "HEPsqFNie0.tvplusstandalone", TVPLUS_SYS = "com.samsung.tv.tvplus";
  var DISNEY_APP = "MCmYXNxgcu.DisneyPlus", DISNEY_SERVICE = "MCmYXNxgcu.DisneyPlusService", HOTKEY_SERVICE = "com.samsung.tv.hotkey-service";
  var NETFLIX_APP = "org.tizen.netflix-app", PRIME_APP = "org.tizen.primevideo";
  var RESERVED_NAV_KEYS = [8, 9, 13, 27, 32, 37, 38, 39, 40, 447, 448, 449, 461, 10009, 10182];
  var REMOTE_KEY_NAMES = {
    0: "Desactivado", 19: "Pausa", 48: "Tecla 0", 49: "Tecla 1", 50: "Tecla 2", 51: "Tecla 3", 52: "Tecla 4",
    53: "Tecla 5", 54: "Tecla 6", 55: "Tecla 7", 56: "Tecla 8", 57: "Tecla 9", 189: "Guion (-)",
    403: "Botón Rojo", 404: "Botón Verde", 405: "Botón Amarillo", 406: "Botón Azul",
    412: "Rebobinar", 413: "Detener", 415: "Reproducir", 416: "Grabar", 417: "Avance rápido",
    427: "Canal ▲", 428: "Canal ▼", 457: "Info", 458: "Guía (Guide)",
    10072: "Fuente (Source)", 10073: "Lista de canales", 10133: "Menú", 10135: "Herramientas (Tools)",
    10140: "Tamaño de imagen", 10146: "Manual (E-Manual)", 10190: "Canal anterior", 10195: "Audio (MTS)",
    10200: "Teletexto", 10221: "Subtítulos", 10225: "Buscar", 10228: "Deportes (Soccer)",
    10232: "Pista anterior", 10233: "Pista siguiente", 10252: "Play/Pausa", 10253: "Botón Extra"
  };
  var SAMSUNG_REGISTER_KEYS = ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "Info", "Guide",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "Minus",
    "ChannelUp", "ChannelDown", "ChannelList", "PreviousChannel", "MediaPlayPause", "MediaPlay", "MediaPause",
    "MediaStop", "MediaRewind", "MediaFastForward", "MediaTrackPrevious", "MediaTrackNext",
    "Tools", "Search", "Soccer", "Caption", "Extra"];
  function isConfigurableHomeKey(keyCode) {
    if (keyCode === 0) return true;
    return typeof keyCode === "number" && isFinite(keyCode) && Math.floor(keyCode) === keyCode && keyCode > 0 && keyCode <= 65535 && RESERVED_NAV_KEYS.indexOf(keyCode) < 0;
  }
  function remoteKeyLabel(keyCode) {
    if (keyCode === 0) return "Desactivado";
    if (!isConfigurableHomeKey(keyCode)) return "Botón Azul";
    return own.call(REMOTE_KEY_NAMES, keyCode) ? REMOTE_KEY_NAMES[keyCode] : "Tecla #" + keyCode;
  }
  function samsungHomeButtonLabel(mode) {
    var labels = { tvplus: "Samsung TV Plus", disney: "Disney+", both: "Disney+ y TV Plus", off: "Desactivado" };
    return own.call(labels, mode) ? labels[mode] : labels.off;
  }
  function isOtherBrandNew(running, prev) {
    function wasNew(id) { return running.indexOf(id) >= 0 && !!prev && prev.indexOf(id) < 0; }
    function isNew(id) { return running.indexOf(id) >= 0 && (!prev || prev.indexOf(id) < 0); }
    return wasNew(NETFLIX_APP) || wasNew(PRIME_APP) || isNew(TVPLUS_DEEPLINKER) || wasNew(TVPLUS_APP) || wasNew(TVPLUS_SYS);
  }
  function detectSamsungShortcut(state) {
    state = state || {};
    var mode = state.mode, running = state.runningIds, prev = Array.isArray(state.prevIds) ? state.prevIds : null;
    var ignore = state.ignoreUntil && typeof state.ignoreUntil === "object" ? state.ignoreUntil : null, now = Number(state.now) || 0;
    if (state.hidden !== true || SAMSUNG_HOME_BUTTONS.indexOf(mode) <= 0 || !Array.isArray(running)) return null;
    if (typeof state.cooldownUntil === "number" && state.cooldownUntil > now) return null;
    if (mode === "tvplus" || mode === "both") {
      var tvIgnored = !!(ignore && ((ignore[TVPLUS_APP] > now) || (ignore[TVPLUS_DEEPLINKER] > now) || (ignore[TVPLUS_SYS] > now)));
      if (!tvIgnored) {
        if (running.indexOf(TVPLUS_DEEPLINKER) >= 0 && (!prev || prev.indexOf(TVPLUS_DEEPLINKER) < 0)) return { button: "tvplus", appId: TVPLUS_DEEPLINKER, label: "Samsung TV Plus" };
        if (running.indexOf(TVPLUS_APP) >= 0 && prev && prev.indexOf(TVPLUS_APP) < 0) return { button: "tvplus", appId: TVPLUS_APP, label: "Samsung TV Plus" };
        if (running.indexOf(TVPLUS_SYS) >= 0 && prev && prev.indexOf(TVPLUS_SYS) < 0) return { button: "tvplus", appId: TVPLUS_SYS, label: "Samsung TV Plus" };
      }
    }
    if (mode === "disney" || mode === "both") {
      var disneyIgnored = !!(ignore && ((ignore[DISNEY_APP] > now) || (ignore[DISNEY_SERVICE] > now) || (ignore[HOTKEY_SERVICE] > now)));
      if (!disneyIgnored) {
        if (running.indexOf(DISNEY_APP) >= 0 && prev && prev.indexOf(DISNEY_APP) < 0) return { button: "disney", appId: DISNEY_APP, label: "Disney+" };
        if (running.indexOf(DISNEY_SERVICE) >= 0 && (!prev || prev.indexOf(DISNEY_SERVICE) < 0)) return { button: "disney", appId: DISNEY_SERVICE, label: "Disney+" };
        if (running.indexOf(HOTKEY_SERVICE) >= 0 && (!prev || prev.indexOf(HOTKEY_SERVICE) < 0) && !isOtherBrandNew(running, prev)) {
          return { button: "disney", appId: HOTKEY_SERVICE, label: "Disney+", confirm: true };
        }
      }
    }
    return null;
  }
  return { searchApps: searchApps, normalizeQuery: normalizeQuery, SEARCH_KEYS: SEARCH_KEYS, CATEGORIES: CATEGORIES, CATEGORY_IDS: CATEGORY_IDS,
    isCategory: isCategory, categoryLabel: categoryLabel, defaultCategory: defaultCategory, appCategory: appCategory, appDescription: appDescription, categoryCounts: categoryCounts,
    filterByCategory: filterByCategory, nextCategory: nextCategory,
    SYSTEM_HIDDEN_RULES: SYSTEM_HIDDEN_RULES, isSystemHidden: isSystemHidden, systemHiddenRule: systemHiddenRule, autoHiddenIds: autoHiddenIds,
    shouldReturnHome: shouldReturnHome, returnWatchStep: returnWatchStep, RETURN_RULES: RETURN_RULES, appendReturnLog: appendReturnLog, returnLogLines: returnLogLines, backAtRoot: backAtRoot, heroLines: heroLines, normalizeApps: normalizeApps, normalizeSources: normalizeSources, splitFavorites: splitFavorites,
    scrollFor: scrollFor, brandFor: brandFor, initials: initials, fold: fold, safeIcon: safeIcon, isRealApp: realApp,
    lastUseLabel: lastUseLabel, recentApps: recentApps, remoteAction: remoteAction, REMOTE_KEYS: REMOTE_KEYS,
    SAMSUNG_HOME_BUTTONS: SAMSUNG_HOME_BUTTONS, SAMSUNG_REGISTER_KEYS: SAMSUNG_REGISTER_KEYS, RESERVED_NAV_KEYS: RESERVED_NAV_KEYS,
    isConfigurableHomeKey: isConfigurableHomeKey, remoteKeyLabel: remoteKeyLabel, samsungHomeButtonLabel: samsungHomeButtonLabel, detectSamsungShortcut: detectSamsungShortcut,
    nextHomeMode: nextHomeMode, HOME_MODES: HOME_MODES,
    DIM_MODES: DIM_MODES, dimLevel: dimLevel,
    screensaverDue: screensaverDue, screensaverPosition: screensaverPosition, SCREENSAVER_MINUTES: SCREENSAVER_MINUTES,
    BRAND_ART: BRAND_ART, brandArt: brandArt, dominantColors: dominantColors, artGradient: artGradient, tileArtSpec: tileArtSpec,
    artBackground: artBackground, artLayout: artLayout, TILE_ART_MODES: TILE_ART_MODES, normalizeTileArt: normalizeTileArt };
});
