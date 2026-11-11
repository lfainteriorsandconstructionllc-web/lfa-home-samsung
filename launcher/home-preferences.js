/* Preferencias de Home: datos locales, persistencia y orden. ES5 / UMD. */
(function (root, factory) {
  var media = root && root.HomeMedia, model = root && root.HomeModel, weather = root && root.HomeWeather;
  if (!media && typeof module === "object" && module.exports) media = require("./home-media.js");
  if (!model && typeof module === "object" && module.exports) model = require("./home-model.js");
  if (!weather && typeof module === "object" && module.exports) weather = require("./home-weather.js");
  var api = factory(media, model, weather);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HomePreferences = api;
})(typeof window !== "undefined" ? window : this, function (media, model, weather) {
  "use strict";
  var KEY = "hacktv.home.preferences.v1", own = Object.prototype.hasOwnProperty;
  var BASE = { version: 1, favorites: [], hidden: [], order: [], mediaSources: [], usage: {}, categories: {}, homeMode: "favorites", previewMode: "auto", background: "app", showClock: true, tileSize: "large", remoteLayout: "freestyle", returnHome: true, screensaver: 5, tileArt: "rich", pinnedMedia: null, resumeOnReturn: true, hideSystemApps: true, restored: [] };
  BASE.ambientIntensity = "vivid";
  BASE.hiddenMedia = [];
  var ENUMS = { homeMode: ["favorites", "all", "recent"], previewMode: ["auto", "logo", "off"], background: ["app", "dark"], ambientIntensity: ["soft", "normal", "vivid"], tileSize: ["large", "compact"],
    /* Leyenda del mando: «freestyle» (sin colores ni números, por defecto) o «full». */
    remoteLayout: ["freestyle", "full"],
    /* 1.10.0: arte de tarjetas «rich» (enriquecido, por defecto) o «flat» (aspecto de 1.9.0). */
    tileArt: ["rich", "flat", "full"] };
  function text(value) { return typeof value === "string" ? value.replace(/^\s+|\s+$/g, "") : ""; }
  function id(value) { value = text(value); return value && value.length <= 200 && !/[\x00-\x20\x7f]/.test(value) ? value : ""; }
  function ids(values) {
    var result = [], seen = Object.create(null), i, value;
    if (!Array.isArray(values)) return result;
    for (i = 0; i < values.length && result.length < 1000; i++) {
      value = id(values[i]);
      if (value && !seen[value]) { seen[value] = true; result.push(value); }
    }
    return result;
  }
  function fold(value) {
    return text(value).toLowerCase().replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/\s+/g, " ");
  }
  var USAGE_LIMIT = 60, MAX_TIME = 8.64e15;
  /* usage = { appId: { count, last } }. Se descarta lo que no sea un recuento
     entero positivo con una fecha válida; sólo quedan las 60 más recientes. */
  function normalizeUsage(value) {
    var list = [], result = {}, key, entry, count, last, i;
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (key in value) if (own.call(value, key)) {
      entry = value[key];
      if (!key || key === "__proto__" || id(key) !== key || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      count = entry.count; last = entry.last;
      if (typeof count !== "number" || !isFinite(count) || count < 1 || typeof last !== "number" || !isFinite(last) || last <= 0 || last > MAX_TIME) continue;
      list.push({ id: key, count: Math.min(1000000, Math.floor(count)), last: Math.floor(last) });
      if (list.length > 5000) break;
    }
    list.sort(function (a, b) { return b.last - a.last || b.count - a.count || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    for (i = 0; i < list.length && i < USAGE_LIMIT; i++) result[list[i].id] = { count: list[i].count, last: list[i].last };
    return result;
  }
  /* categories = { appId: categoryId } (1.8.0): categoría elegida por el
     usuario. Sólo ids de app válidos y categorías conocidas; máximo 1000. */
  var CATEGORY_IDS = model && model.CATEGORY_IDS ? model.CATEGORY_IDS : ["video", "sport", "music", "games", "tools", "system", "other"];
  function normalizeCategories(value) {
    var result = {}, key, total = 0;
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (key in value) if (own.call(value, key)) {
      if (!key || key === "__proto__" || id(key) !== key || typeof value[key] !== "string" || CATEGORY_IDS.indexOf(value[key]) < 0) continue;
      result[key] = value[key];
      if (++total >= 1000) break;
    }
    return result;
  }
  /* 1.11.0: fuente fija en el recuadro (id «media:…» o null). Sólo se valida
     la forma: si la fuente ya no existe, Home la ignora al arrancar. */
  function mediaId(value) { return typeof value === "string" && value.length <= 120 && /^media:[a-z]+:[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null; }
  /* 1.11.1: lo que se abre fuera de Home (youtube/web sin iframe) no se fija. */
  function pinnable(value) {
    var result = mediaId(value);
    return result && media && !media.WEB_FRAME_ENABLED && /^media:(?:youtube|web):/.test(result) ? null : result;
  }
  function rememberMedia(profile, value) {
    var valid = mediaId(value);
    if (valid && /^media:(hls|mp4):/.test(valid)) profile.lastMedia = valid;
    else delete profile.lastMedia;
  }
  var SCREENSAVER_MINUTES = model && model.SCREENSAVER_MINUTES ? model.SCREENSAVER_MINUTES : [0, 1, 2, 5, 10, 15, 30];
  /* 1.13.0: «Atenuar interfaz» (off por defecto | soft | night | auto). */
  BASE.dim = "off"; ENUMS.dim = model && model.DIM_MODES ? model.DIM_MODES : ["off", "soft", "night", "auto"];
  /* 1.27.0: botón físico Samsung para LFA Home, tecla capturable y canales favoritos. */
  BASE.samsungHomeButton = "off";
  ENUMS.samsungHomeButton = model && model.SAMSUNG_HOME_BUTTONS ? model.SAMSUNG_HOME_BUTTONS : ["off", "tvplus", "disney", "both"];
  BASE.customHomeKey = 406;
  BASE.favoriteMedia = [];
  function validHomeKey(value) {
    if (model && typeof model.isConfigurableHomeKey === "function") return model.isConfigurableHomeKey(value);
    return value === 0 || (typeof value === "number" && isFinite(value) && Math.floor(value) === value && value > 0 && value <= 65535 && [8, 9, 13, 27, 32, 37, 38, 39, 40, 461, 10009, 10182].indexOf(value) < 0);
  }
  function normalize(value, fallback) {
    var source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var base = fallback && typeof fallback === "object" ? fallback : BASE, result = { version: 1 }, key, list;
    if (own.call(source, "version") && source.version !== 1) source = {};
    for (key in ENUMS) if (own.call(ENUMS, key)) {
      list = ENUMS[key];
      result[key] = list.indexOf(source[key]) >= 0 ? source[key] : (list.indexOf(base[key]) >= 0 ? base[key] : BASE[key]);
    }
    result.showClock = typeof source.showClock === "boolean" ? source.showClock : (typeof base.showClock === "boolean" ? base.showClock : true);
    /* 1.7.3: volver a Home al cerrar una app lanzada desde Home (sí por defecto). */
    result.returnHome = typeof source.returnHome === "boolean" ? source.returnHome : (typeof base.returnHome === "boolean" ? base.returnHome : true);
    /* 1.9.0: minutos sin teclas hasta el salvapantallas (0 = desactivado).
       Ausente → el valor de respaldo (5 por defecto); no permitido → 5. */
    result.screensaver = own.call(source, "screensaver") ? (SCREENSAVER_MINUTES.indexOf(source.screensaver) >= 0 ? source.screensaver : 5)
      : (SCREENSAVER_MINUTES.indexOf(base.screensaver) >= 0 ? base.screensaver : 5);
    /* 1.11.0: ausente (datos de 1.10.x) → el valor de respaldo (null / true). */
    result.pinnedMedia = pinnable(own.call(source, "pinnedMedia") ? source.pinnedMedia : base.pinnedMedia);
    rememberMedia(result, own.call(source, "lastMedia") ? source.lastMedia : base.lastMedia);
    result.resumeOnReturn = typeof source.resumeOnReturn === "boolean" ? source.resumeOnReturn : (typeof base.resumeOnReturn === "boolean" ? base.resumeOnReturn : true);
    result.favorites = ids(Array.isArray(source.favorites) ? source.favorites : base.favorites);
    result.hidden = ids(Array.isArray(source.hidden) ? source.hidden : base.hidden);
    result.order = ids(Array.isArray(source.order) ? source.order : base.order);
    result.favorites = result.favorites.filter(function (value) { return result.hidden.indexOf(value) < 0; });
    result.order = ids(result.order.concat(result.favorites, result.hidden));
    result.mediaSources = media ? media.combine([], Array.isArray(source.mediaSources) ? source.mediaSources : base.mediaSources).slice(0, 25) : [];
    result.hiddenMedia = ids(Array.isArray(source.hiddenMedia) ? source.hiddenMedia : base.hiddenMedia).filter(mediaId);
    result.favoriteMedia = ids(Array.isArray(source.favoriteMedia) ? source.favoriteMedia : base.favoriteMedia).filter(mediaId).filter(function (entry) { return result.hiddenMedia.indexOf(entry) < 0; }).slice(0, 60);
    result.customHomeKey = own.call(source, "customHomeKey") && validHomeKey(source.customHomeKey) ? source.customHomeKey
      : (own.call(base, "customHomeKey") && validHomeKey(base.customHomeKey) ? base.customHomeKey : BASE.customHomeKey);
    result.usage = normalizeUsage(own.call(source, "usage") ? source.usage : base.usage);
    result.categories = normalizeCategories(own.call(source, "categories") ? source.categories : base.categories);
    /* 1.12.0: ocultar las apps del sistema (sí por defecto; datos de 1.11.x
       sin el campo → sí) y restored = ids que el usuario volvió a mostrar.
       Una app oculta a mano no puede estar a la vez en restored. */
    result.hideSystemApps = typeof source.hideSystemApps === "boolean" ? source.hideSystemApps : (typeof base.hideSystemApps === "boolean" ? base.hideSystemApps : true);
    result.restored = ids(Array.isArray(source.restored) ? source.restored : base.restored).filter(function (value) { return result.hidden.indexOf(value) < 0; });
    if (weather && (own.call(source, "weather") || own.call(base, "weather"))) result.weather = weather.settings(own.call(source, "weather") ? source.weather : base.weather);
    normalizeProfiles(result, source, base);
    return result;
  }
  /* 1.14.0: perfiles por persona. El objeto plano sigue siendo la vista del
     perfil ACTIVO (así el resto de funciones no cambia); profiles = [{ id,
     name }] (1–4, ids «p1»…), activeProfile = id del activo e inactive =
     { idDePerfil: { campos personales } } con los datos de los demás. Lo
     compartido (fuentes, apariencia, mando…) queda fuera de los perfiles.
     Datos de 1.13.x sin perfiles → un perfil «Principal» con lo actual. */
  var PERSONAL_FIELDS = ["favorites", "hidden", "order", "homeMode", "usage", "categories", "pinnedMedia", "lastMedia", "restored"];
  var MAX_PROFILES = 4, PROFILE_NAME_MAX = 16, DEFAULT_PROFILE = "Principal";
  var PROFILE_SUGGESTIONS = ["Principal", "Niños", "Invitados", "Pareja", "Deporte", "Cine", "Noche"];
  function profileId(value) { return typeof value === "string" && /^p[1-9][0-9]?$/.test(value) ? value : ""; }
  /* Nombre: 1–16 caracteres tras recortar, sin controles; espacios internos
     reducidos a uno. Devuelve "" si no vale. */
  function profileName(value) {
    if (typeof value !== "string" || value.length > 200) return "";
    value = text(value).replace(/\s+/g, " ");
    return value && value.length <= PROFILE_NAME_MAX && !/[\x00-\x1f\x7f<>]/.test(value) ? value : "";
  }
  /* Campos personales normalizados de un perfil inactivo; vacío si no hay datos. */
  function personal(value) {
    var source = value && typeof value === "object" && !Array.isArray(value) ? value : {}, result = {};
    result.favorites = ids(source.favorites);
    result.hidden = ids(source.hidden);
    result.favorites = result.favorites.filter(function (entry) { return result.hidden.indexOf(entry) < 0; });
    result.order = ids(ids(source.order).concat(result.favorites, result.hidden));
    result.homeMode = ENUMS.homeMode.indexOf(source.homeMode) >= 0 ? source.homeMode : BASE.homeMode;
    result.usage = normalizeUsage(source.usage);
    result.categories = normalizeCategories(source.categories);
    result.pinnedMedia = pinnable(source.pinnedMedia);
    rememberMedia(result, source.lastMedia);
    result.restored = ids(source.restored).filter(function (entry) { return result.hidden.indexOf(entry) < 0; });
    return result;
  }
  function pickPersonal(value) { var result = {}, i; for (i = 0; i < PERSONAL_FIELDS.length; i++) result[PERSONAL_FIELDS[i]] = value[PERSONAL_FIELDS[i]]; return personal(result); }
  function sameName(a, b) { return fold(a) === fold(b); }
  function normalizeProfiles(result, source, base) {
    var list = Array.isArray(source.profiles) ? source.profiles : (base && Array.isArray(base.profiles) && !own.call(source, "favorites") ? base.profiles : null);
    var profiles = [], seen = Object.create(null), i, entry, pid, name, j, duplicate, active, store, inactive = {};
    if (list) for (i = 0; i < list.length && i < 50 && profiles.length < MAX_PROFILES; i++) {
      entry = list[i]; if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      pid = profileId(entry.id); name = profileName(entry.name);
      if (!pid || !name || seen[pid]) continue;
      for (duplicate = false, j = 0; j < profiles.length; j++) if (sameName(profiles[j].name, name)) duplicate = true;
      if (duplicate) continue;
      seen[pid] = true; profiles.push({ id: pid, name: name });
    }
    if (!profiles.length) { profiles = [{ id: "p1", name: DEFAULT_PROFILE }]; seen = Object.create(null); seen.p1 = true; }
    active = profileId(list === source.profiles ? source.activeProfile : base && base.activeProfile);
    if (!active || !seen[active]) active = profiles[0].id;
    store = list === source.profiles ? source.inactive : base && base.inactive;
    store = store && typeof store === "object" && !Array.isArray(store) ? store : {};
    for (i = 0; i < profiles.length; i++) {
      pid = profiles[i].id; if (pid === active) continue;
      inactive[pid] = personal(own.call(store, pid) ? store[pid] : null);
    }
    result.profiles = profiles; result.activeProfile = active; result.inactive = inactive;
  }
  function listProfiles(value) {
    var prefs = normalize(value);
    return prefs.profiles.map(function (entry) { return { id: entry.id, name: entry.name, active: entry.id === prefs.activeProfile }; });
  }
  function activeProfile(value) {
    var prefs = normalize(value), i;
    for (i = 0; i < prefs.profiles.length; i++) if (prefs.profiles[i].id === prefs.activeProfile) return { id: prefs.profiles[i].id, name: prefs.profiles[i].name };
    return { id: prefs.profiles[0].id, name: prefs.profiles[0].name };
  }
  function findProfile(prefs, pid) { var i; for (i = 0; i < prefs.profiles.length; i++) if (prefs.profiles[i].id === pid) return prefs.profiles[i]; return null; }
  /* Guarda los campos personales del activo en inactive y carga los del
     nuevo (vacío: sin favoritas, orden vacío que reconcile completa). */
  function switchProfile(value, pid) {
    var result = normalize(value), next, i, key;
    pid = profileId(pid);
    if (!pid || pid === result.activeProfile || !findProfile(result, pid)) return result;
    result.inactive[result.activeProfile] = pickPersonal(result);
    next = personal(own.call(result.inactive, pid) ? result.inactive[pid] : null);
    delete result.inactive[pid];
    for (i = 0; i < PERSONAL_FIELDS.length; i++) { key = PERSONAL_FIELDS[i]; result[key] = next[key]; }
    result.activeProfile = pid;
    return normalize(result);
  }
  /* Nombre libre: si ya existe (sin distinguir mayúsculas ni acentos), se
     añade « 2», « 3»… recortando para no pasar de 16 caracteres. */
  function uniqueName(prefs, name, exceptId) {
    var candidate = name, n = 2, suffix, i, taken;
    function used(value) { for (i = 0; i < prefs.profiles.length; i++) if (prefs.profiles[i].id !== exceptId && sameName(prefs.profiles[i].name, value)) return true; return false; }
    while (used(candidate) && n < 100) { suffix = " " + n++; candidate = text(name.slice(0, PROFILE_NAME_MAX - suffix.length)) + suffix; }
    taken = used(candidate);
    return taken ? "" : candidate;
  }
  /* Añade un perfil vacío (no lo activa). Sin cambios si ya hay 4 o el
     nombre no vale; el nuevo queda al final con el primer id libre. */
  function addProfile(value, name) {
    var result = normalize(value), pid = "", i;
    name = profileName(name);
    if (!name || result.profiles.length >= MAX_PROFILES) return result;
    name = uniqueName(result, name, null); if (!name) return result;
    for (i = 1; i <= 99 && !pid; i++) if (!findProfile(result, "p" + i)) pid = "p" + i;
    result.profiles.push({ id: pid, name: name });
    result.inactive[pid] = personal(null);
    return normalize(result);
  }
  function renameProfile(value, pid, name) {
    var result = normalize(value), entry = findProfile(result, profileId(pid));
    name = profileName(name);
    if (!entry || !name) return result;
    name = uniqueName(result, name, entry.id); if (!name) return result;
    entry.name = name;
    return normalize(result);
  }
  /* Nunca se borra el último. Si es el activo, se activa el primero que quede. */
  function removeProfile(value, pid) {
    var result = normalize(value), entry = findProfile(result, profileId(pid)), first;
    if (!entry || result.profiles.length < 2) return result;
    if (entry.id === result.activeProfile) {
      first = result.profiles[0].id === entry.id ? result.profiles[1].id : result.profiles[0].id;
      result = switchProfile(result, first);
    }
    result.profiles = result.profiles.filter(function (candidate) { return candidate.id !== entry.id; });
    delete result.inactive[entry.id];
    return normalize(result);
  }
  function canAddProfile(value) { return normalize(value).profiles.length < MAX_PROFILES; }
  function recordLaunch(value, appId, now) {
    var result = normalize(value), previous;
    appId = id(appId); if (!appId || appId === "__proto__") return result;
    now = typeof now === "number" && isFinite(now) && now > 0 && now <= MAX_TIME ? Math.floor(now) : new Date().getTime();
    previous = own.call(result.usage, appId) ? result.usage[appId] : null;
    result.usage[appId] = { count: previous ? Math.min(1000000, previous.count + 1) : 1, last: now };
    result.usage = normalizeUsage(result.usage);
    return result;
  }
  /* Guarda la categoría elegida; si coincide con la de por defecto
     (defaultId) o no es válida, se borra el cambio y manda el patrón. */
  function setCategory(value, appId, categoryId, defaultId) {
    var result = normalize(value);
    appId = id(appId); if (!appId || appId === "__proto__") return result;
    if (CATEGORY_IDS.indexOf(categoryId) < 0 || categoryId === defaultId) delete result.categories[appId];
    else result.categories[appId] = categoryId;
    return result;
  }
  function clearUsage(value) { var result = normalize(value); result.usage = {}; return result; }
  function usageCount(value) { var usage = normalize(value).usage, key, total = 0; for (key in usage) if (own.call(usage, key)) total++; return total; }
  function addMediaSource(value, item) {
    var result = normalize(value), normalized = media && media.normalizeItem(item);
    if (!normalized) return result;
    result.mediaSources = result.mediaSources.filter(function (entry) { return entry.id !== normalized.id; });
    result.mediaSources.unshift(normalized); result.mediaSources = result.mediaSources.slice(0, 25);
    return result;
  }
  function updateMediaReferences(result, oldId, newId) {
    [result].concat(Object.keys(result.inactive).map(function (id) { return result.inactive[id]; })).forEach(function (profile) {
      if (profile.pinnedMedia === oldId) profile.pinnedMedia = newId;
      if (profile.lastMedia === oldId) rememberMedia(profile, newId);
    });
    if (Array.isArray(result.favoriteMedia)) {
      result.favoriteMedia = ids(result.favoriteMedia.map(function (entry) { return entry === oldId ? (newId || "") : entry; })).filter(mediaId);
    }
  }
  function replaceMediaSource(value, item, previousId, isDefault) {
    var normalized = media && media.normalizeItem(item);
    if (!normalized) return normalize(value);
    var result = normalize(value);
    if (previousId && previousId !== normalized.id) {
      result.mediaSources = result.mediaSources.filter(function (entry) { return entry.id !== previousId; });
      if (isDefault) result.hiddenMedia = ids(result.hiddenMedia.concat(previousId));
      updateMediaReferences(result, previousId, normalized.id);
    }
    result.hiddenMedia = result.hiddenMedia.filter(function (id) { return id !== normalized.id; });
    return addMediaSource(result, normalized);
  }
  /* Las fuentes incluidas se ocultan y las añadidas se borran. */
  function removeMediaSource(value, removedId, isDefault) {
    var result = normalize(value);
    result.mediaSources = result.mediaSources.filter(function (entry) { return entry.id !== removedId; });
    if (isDefault && mediaId(removedId)) result.hiddenMedia = ids(result.hiddenMedia.concat(removedId));
    updateMediaReferences(result, removedId, null);
    return result;
  }
  /* Fija (id válido) o quita (null) la fuente del recuadro. */
  function setPinnedMedia(value, id) { var result = normalize(value); result.pinnedMedia = id === null ? null : pinnable(id); return result; }
  function setLastMedia(value, id) { var result = normalize(value); rememberMedia(result, id); return result; }
  function defaults(apps, dockNames) {
    apps = Array.isArray(apps) ? apps : [];
    dockNames = Array.isArray(dockNames) ? dockNames : [];
    var favorites = [], order = [], i, j, wanted, app;
    for (i = 0; i < apps.length; i++) if (apps[i] && id(apps[i].id)) order.push(apps[i].id);
    for (i = 0; i < dockNames.length; i++) {
      wanted = fold(dockNames[i]);
      if (!wanted) continue;
      for (j = 0; j < apps.length; j++) {
        app = apps[j] || {};
        if (wanted === fold(app.id) || wanted === fold(app.packageId) || wanted === fold(app.name)) favorites.push(app.id);
      }
    }
    return normalize({ version: 1, favorites: favorites, hidden: [], order: order }, BASE);
  }
  function load(storage, fallback) {
    try {
      if (!storage || typeof storage.getItem !== "function") return normalize(null, fallback);
      var source = storage.getItem(KEY);
      if (!source || source.length > 262144) return normalize(null, fallback);
      return normalize(JSON.parse(source), fallback);
    } catch (ignored) { return normalize(null, fallback); }
  }
  function save(storage, value) {
    try {
      if (!storage || typeof storage.setItem !== "function") return false;
      var serialized = JSON.stringify(normalize(value));
      storage.setItem(KEY, serialized);
      return typeof storage.getItem !== "function" || storage.getItem(KEY) === serialized;
    } catch (ignored) { return false; }
  }
  function createStorage(environment) {
    environment = environment || {};
    if (environment.HomePlatform && typeof environment.HomePlatform.createStorage === "function") return environment.HomePlatform.createStorage(environment);
    var local = null, fs = environment.tizen && environment.tizen.filesystem;
    try { local = environment.localStorage || null; } catch (ignored) {}
    if (!fs || typeof fs.openFile !== "function") return local;
    /* Tizen puede descartar el Web Storage al terminar su proceso. Estos dos
       archivos privados se cierran y verifican antes de anunciar Guardado.
       Sólo se reemplaza el slot más antiguo: un cierre durante la escritura
       conserva la última revisión completa. No se usan áreas compartidas. */
    var paths = ["wgt-private/home-preferences-a.json", "wgt-private/home-preferences-b.json"];
    function slot(index) {
      var handle = null, value;
      try {
        handle = fs.openFile(paths[index], "r");
        value = handle.readString(262145); handle.close(); handle = null;
        if (typeof value !== "string" || value.length > 262144) return null;
        value = JSON.parse(value);
        if (!value || value.version !== 1 || typeof value.revision !== "number" || !isFinite(value.revision) || value.revision < 1 || Math.floor(value.revision) !== value.revision || typeof value.data !== "string") return null;
        var data = JSON.parse(value.data);
        if (!data || data.version !== 1 || typeof data !== "object" || Array.isArray(data)) return null;
        return { index: index, revision: value.revision, data: value.data };
      } catch (ignored) { return null; }
      finally { if (handle) try { handle.close(); } catch (ignoredClose) {} }
    }
    function latest() {
      var a = slot(0), b = slot(1);
      return !a ? b : !b ? a : (a.revision >= b.revision ? a : b);
    }
    return {
      backend: "tizen-private-files",
      getItem: function (key) {
        if (key !== KEY) return null;
        var best = latest();
        return best ? best.data : (local && typeof local.getItem === "function" ? local.getItem(key) : null);
      },
      setItem: function (key, serialized) {
        if (key !== KEY || typeof serialized !== "string" || serialized.length > 120000) throw new Error("Preferencias no válidas");
        var parsed = JSON.parse(serialized);
        if (!parsed || parsed.version !== 1) throw new Error("Versión de preferencias no válida");
        var best = latest(), index = best ? 1 - best.index : 0, revision = best ? best.revision + 1 : 1, handle = null;
        try {
          handle = fs.openFile(paths[index], "w");
          handle.writeString(JSON.stringify({ version: 1, revision: revision, data: serialized }));
          handle.close(); handle = null;
        } finally { if (handle) try { handle.close(); } catch (ignored) {} }
        var written = slot(index);
        if (!written || written.revision !== revision || written.data !== serialized) throw new Error("No se pudieron verificar las preferencias guardadas");
        /* Copia para migrar desde la versión web; el archivo nativo manda. */
        if (local && typeof local.setItem === "function") try { local.setItem(key, serialized); } catch (ignoredLocal) {}
      }
    };
  }
  /* Registro de retorno a Home (1.7.4): un archivo privado propio,
     wgt-private/home-return-log.json, con el mismo mecanismo de escritura que
     las preferencias (openFile "w", writeString, close y relectura). No toca
     los archivos a/b de preferencias. Máximo RETURN_LOG_LIMIT entradas. Sin
     sistema de archivos (navegador) usa Web Storage con otra clave. */
  var RETURN_LOG_PATH = "wgt-private/home-return-log.json", RETURN_LOG_KEY = "hacktv.home.return-log.v1", RETURN_LOG_LIMIT = 50;
  function trimLog(list, entry) {
    if (model && model.appendReturnLog) return model.appendReturnLog(list, entry, RETURN_LOG_LIMIT);
    list = (Array.isArray(list) ? list : []).concat(entry ? [entry] : []);
    return list.slice(Math.max(0, list.length - RETURN_LOG_LIMIT));
  }
  function createReturnLog(environment) {
    environment = environment || {};
    var local = null, fs = environment.tizen && environment.tizen.filesystem, useFs = !!(fs && typeof fs.openFile === "function");
    try { local = environment.localStorage || null; } catch (ignored) {}
    function parse(source) {
      if (typeof source !== "string" || !source || source.length > 65536) return [];
      var value = JSON.parse(source);
      return value && value.version === 1 && Array.isArray(value.entries) ? trimLog(value.entries, null) : [];
    }
    function readRaw() {
      var handle = null, value;
      if (!useFs) return local && typeof local.getItem === "function" ? local.getItem(RETURN_LOG_KEY) : null;
      try { handle = fs.openFile(RETURN_LOG_PATH, "r"); value = handle.readString(65537); handle.close(); handle = null; return value; }
      catch (missing) { return null; }
      finally { if (handle) try { handle.close(); } catch (ignoredClose) {} }
    }
    function read() { try { return parse(readRaw()); } catch (ignored) { return []; } }
    function write(entries) {
      var serialized = JSON.stringify({ version: 1, entries: entries }), handle = null;
      if (!useFs) { if (!local || typeof local.setItem !== "function") return false; local.setItem(RETURN_LOG_KEY, serialized); return local.getItem(RETURN_LOG_KEY) === serialized; }
      try { handle = fs.openFile(RETURN_LOG_PATH, "w"); handle.writeString(serialized); handle.close(); handle = null; }
      finally { if (handle) try { handle.close(); } catch (ignoredClose) {} }
      return readRaw() === serialized;
    }
    return {
      backend: useFs ? "tizen-private-files" : "web-storage", path: useFs ? RETURN_LOG_PATH : RETURN_LOG_KEY, limit: RETURN_LOG_LIMIT,
      read: read,
      append: function (entry) { var list = trimLog(read(), entry); try { return write(list) ? list : null; } catch (ignored) { return null; } }
    };
  }
  /* keepMissing: el catálogo es provisional (fallo de consulta) y no debe
     borrar el historial de apps que quizá siguen instaladas. */
  function reconcile(value, apps, options) {
    var result = normalize(value), installed = Object.create(null), usage = {}, categories = {}, key, i;
    apps = Array.isArray(apps) ? apps : [];
    for (i = 0; i < apps.length; i++) if (apps[i] && id(apps[i].id)) {
      installed[apps[i].id] = true;
      if (result.order.indexOf(apps[i].id) < 0) result.order.push(apps[i].id);
    }
    result.order = ids(result.order);
    /* Una lista vacía es una consulta fallida, no una desinstalación total. */
    if (apps.length && !(options && options.keepMissing)) {
      for (key in result.usage) if (own.call(result.usage, key) && installed[key]) usage[key] = result.usage[key];
      result.usage = usage;
      for (key in result.categories) if (own.call(result.categories, key) && installed[key]) categories[key] = result.categories[key];
      result.categories = categories;
      result.restored = result.restored.filter(function (value) { return installed[value] === true; });
    }
    /* 1.14.0: lo mismo en los perfiles inactivos (orden completado con lo
       instalado; usos, categorías y restauradas de apps desinstaladas fuera). */
    for (key in result.inactive) if (own.call(result.inactive, key)) {
      var other = result.inactive[key], kept = {}, keptCategories = {}, entry;
      for (i = 0; i < apps.length; i++) if (apps[i] && id(apps[i].id) && other.order.indexOf(apps[i].id) < 0) other.order.push(apps[i].id);
      other.order = ids(other.order);
      if (apps.length && !(options && options.keepMissing)) {
        for (entry in other.usage) if (own.call(other.usage, entry) && installed[entry]) kept[entry] = other.usage[entry];
        other.usage = kept;
        for (entry in other.categories) if (own.call(other.categories, entry) && installed[entry]) keptCategories[entry] = other.categories[entry];
        other.categories = keptCategories;
        other.restored = other.restored.filter(function (value) { return installed[value] === true; });
      }
    }
    return result;
  }
  function isFavorite(value, appId) { return !!(value && Array.isArray(value.favorites) && value.favorites.indexOf(appId) >= 0); }
  function isHidden(value, appId) { return !!(value && Array.isArray(value.hidden) && value.hidden.indexOf(appId) >= 0); }
  function toggleFavorite(value, appId) {
    var result = normalize(value), index;
    appId = id(appId); if (!appId) return result;
    index = result.favorites.indexOf(appId);
    if (index >= 0) result.favorites.splice(index, 1);
    else {
      result.favorites.push(appId);
      result.hidden = result.hidden.filter(function (entry) { return entry !== appId; });
      if (result.order.indexOf(appId) < 0) result.order.push(appId);
    }
    return result;
  }
  function toggleHidden(value, appId) {
    var result = normalize(value), index;
    appId = id(appId); if (!appId) return result;
    index = result.hidden.indexOf(appId);
    if (index >= 0) result.hidden.splice(index, 1);
    else {
      result.hidden.push(appId);
      result.favorites = result.favorites.filter(function (entry) { return entry !== appId; });
      result.restored = result.restored.filter(function (entry) { return entry !== appId; });
      if (result.order.indexOf(appId) < 0) result.order.push(appId);
    }
    return result;
  }
  /* 1.12.0: apps del sistema que Home oculta sola (calculadas, nunca
     escritas en hidden). */
  function autoHidden(apps, value) { return model && model.autoHiddenIds ? model.autoHiddenIds(apps, normalize(value)) : []; }
  function hiddenIds(apps, value) { var prefs = normalize(value); return ids(prefs.hidden.concat(autoHidden(apps, prefs))); }
  /* Mostrar una app oculta (a mano o por defecto). systemHidden: la app es
     del sistema y, sin restored, Home la volvería a ocultar sola. */
  function showApp(value, appId, systemHidden) {
    var result = normalize(value);
    appId = id(appId); if (!appId || appId === "__proto__") return result;
    result.hidden = result.hidden.filter(function (entry) { return entry !== appId; });
    if (systemHidden && result.restored.indexOf(appId) < 0) result.restored.push(appId);
    if (result.order.indexOf(appId) < 0) result.order.push(appId);
    return result;
  }
  function move(value, appId, delta, scope) {
    var result = normalize(value), list = scope === "favorites" ? result.favorites : result.order;
    appId = id(appId); delta = Number(delta);
    if (!appId || !isFinite(delta)) return result;
    var index = list.indexOf(appId), destination;
    if (index < 0) return result;
    delta = delta < 0 ? Math.ceil(delta) : Math.floor(delta);
    destination = Math.max(0, Math.min(list.length - 1, index + delta));
    if (destination !== index) { list.splice(index, 1); list.splice(destination, 0, appId); }
    return result;
  }
  function isFavoriteMedia(value, itemId) { return !!(value && Array.isArray(value.favoriteMedia) && value.favoriteMedia.indexOf(itemId) >= 0); }
  function toggleFavoriteMedia(value, itemId) {
    var result = normalize(value), valid = mediaId(itemId), index;
    if (!valid || result.hiddenMedia.indexOf(valid) >= 0) return result;
    index = result.favoriteMedia.indexOf(valid);
    if (index >= 0) result.favoriteMedia.splice(index, 1);
    else if (result.favoriteMedia.length < 60) result.favoriteMedia.unshift(valid);
    return result;
  }
  function withOption(value, key, choice) {
    var result = normalize(value);
    if (own.call(ENUMS, key) && ENUMS[key].indexOf(choice) >= 0) result[key] = choice;
    else if (key === "showClock" && typeof choice === "boolean") result.showClock = choice;
    else if (key === "returnHome" && typeof choice === "boolean") result.returnHome = choice;
    else if (key === "screensaver" && SCREENSAVER_MINUTES.indexOf(choice) >= 0) result.screensaver = choice;
    else if (key === "resumeOnReturn" && typeof choice === "boolean") result.resumeOnReturn = choice;
    else if (key === "hideSystemApps" && typeof choice === "boolean") result.hideSystemApps = choice;
    else if (key === "customHomeKey" && validHomeKey(choice)) result.customHomeKey = choice;
    else if (key === "weather" && weather) result.weather = weather.settings(choice);
    return result;
  }
  function sortApps(apps, order) {
    var byId = Object.create(null), result = [], used = Object.create(null), i, app;
    apps = Array.isArray(apps) ? apps : [];
    for (i = 0; i < apps.length; i++) if (apps[i] && id(apps[i].id)) byId[apps[i].id] = apps[i];
    for (i = 0; i < order.length; i++) {
      app = byId[order[i]];
      if (app && !used[app.id]) { result.push(app); used[app.id] = true; }
    }
    for (i = 0; i < apps.length; i++) {
      app = apps[i];
      if (app && id(app.id) && !used[app.id]) { result.push(app); used[app.id] = true; }
    }
    return result;
  }
  function orderedApps(apps, value) { return sortApps(apps, normalize(value).order); }
  function recentApps(apps, value) {
    var prefs = normalize(value);
    return model && model.recentApps ? model.recentApps(apps, prefs.usage, { hidden: hiddenIds(apps, prefs), order: prefs.order, limit: 12 }) : [];
  }
  /* En «Recientes» sin historial útil, la fila de favoritas hace de respaldo. */
  function getHomeApps(apps, value) {
    var prefs = normalize(value), result;
    if (prefs.homeMode === "recent") { result = recentApps(apps, prefs); if (result.length) return result; }
    if (prefs.homeMode === "all") result = orderedApps(apps, prefs);
    else {
      var favoriteIds = prefs.favorites;
      result = sortApps(apps, favoriteIds).filter(function (app) { return favoriteIds.indexOf(app.id) >= 0; });
    }
    var hidden = hiddenIds(apps, prefs);
    return result.filter(function (app) { return hidden.indexOf(app.id) < 0; });
  }
  return { KEY: KEY, defaults: defaults, normalize: normalize, load: load, save: save, createStorage: createStorage, reconcile: reconcile, addMediaSource: addMediaSource, replaceMediaSource: replaceMediaSource, removeMediaSource: removeMediaSource, setPinnedMedia: setPinnedMedia,
    setLastMedia: setLastMedia, isFavorite: isFavorite, isHidden: isHidden, isFavoriteMedia: isFavoriteMedia, toggleFavoriteMedia: toggleFavoriteMedia, toggleFavorite: toggleFavorite, toggleHidden: toggleHidden, autoHidden: autoHidden, hiddenIds: hiddenIds, showApp: showApp,
    move: move, withOption: withOption, getHomeApps: getHomeApps, orderedApps: orderedApps,
    recordLaunch: recordLaunch, setCategory: setCategory, clearUsage: clearUsage, usageCount: usageCount, recentApps: recentApps, USAGE_LIMIT: USAGE_LIMIT,
    PERSONAL_FIELDS: PERSONAL_FIELDS, MAX_PROFILES: MAX_PROFILES, PROFILE_NAME_MAX: PROFILE_NAME_MAX, PROFILE_SUGGESTIONS: PROFILE_SUGGESTIONS, profileName: profileName,
    listProfiles: listProfiles, activeProfile: activeProfile, switchProfile: switchProfile, addProfile: addProfile, renameProfile: renameProfile, removeProfile: removeProfile, canAddProfile: canAddProfile,
    SCREENSAVER_MINUTES: SCREENSAVER_MINUTES, createReturnLog: createReturnLog, RETURN_LOG_PATH: RETURN_LOG_PATH, RETURN_LOG_LIMIT: RETURN_LOG_LIMIT };
});
