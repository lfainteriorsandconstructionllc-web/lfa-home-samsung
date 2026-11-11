/* Fuentes públicas de Home. No descarga listas de terceros ni evita restricciones. ES5 / UMD. */
/* 1.11.0: fuentes Volley (Turquía: TRT Spor y TRT Spor Yıldız en el recuadro y
   partidos de Sultanlar Ligi en la app YouTube; Rusia: RUTUBE) reutilizando
   los módulos de Volley sin modificarlos: app/providers/turkey.js y
   app/model.js. En el paquete son launcher/vendor/turkey.js y
   vendor/volley-model.js, copias que genera instalar.py (única fuente de
   verdad: app/ en la raíz del proyecto).
   1.11.1: el WebView de Tizen 9 del Freestyle bloquea todo iframe dentro del
   widget, así que WEB_FRAME_ENABLED es false: los enlaces youtube se abren en
   la app YouTube y los web en Internet (opensExternally). El motor «frame» del
   reproductor sólo se usa con la constante en true (y CSP frame-src https:). */
(function (root, factory) {
  var providers = root && root.VolleyProviders || {}, volley = providers.turkey, russia = providers.russia, volleyModel = root && root.VolleyModel;
  if (typeof module === "object" && module.exports) {
    try { if (!volley) volley = require("../app/providers/turkey.js"); } catch (ignoredTurkey) { volley = null; }
    try { if (!russia) russia = require("../app/providers/russia.js"); } catch (ignoredRussia) { russia = null; }
    try { if (!volleyModel) volleyModel = require("../app/model.js"); } catch (ignoredModel) { volleyModel = null; }
  }
  var api = factory(volley || null, russia || null, volleyModel || null, root && root.HomePlatform);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HomeMedia = api;
})(typeof window !== "undefined" ? window : this, function (turkey, russia, volleyModel, platform) {
  "use strict";
  /* Contenido web en el recuadro (iframe). false (1.11.1): youtube y web se
     aceptan igual, pero se abren fuera de Home y nunca entran en el recuadro. */
  var WEB_FRAME_ENABLED = false;
  var CHANNEL = "cc1b56aa4955a144f324ad58998513bb", cache = null, cachedAt = 0, CACHE_MS = 90000;
  var volleyCache = null, volleyCachedAt = 0;
  var TRT = {
    trtspor: { title: "TRT Spor", url: "https://www.tabii.com/tr/watch/live/trtspor?trackId=150022", description: "Señal oficial de TRT Spor (tabii). Programación deportiva mixta: no implica que haya voleibol." },
    trtsporyildiz: { title: "TRT Spor Yıldız", url: "https://www.tabii.com/tr/watch/live/trtsporyildiz?trackId=150028", description: "Señal oficial que emite los partidos de Sultanlar Ligi asignados por TVF. Incluye otros deportes." }
  };
  var YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  var GROUPS = ["volley", "news", "tvplus", "dominicana", "latam", "english", "featured", "cinema"];
  function text(value, limit) { return typeof value === "string" ? value.replace(/^\s+|\s+$/g, "").slice(0, limit || 200) : ""; }
  function safeURL(value) {
    try {
      var url = new URL(text(value, 4096));
      if (url.protocol !== "https:" || url.username || url.password || !url.hostname || /[\x00-\x20\x7f]/.test(value)) return "";
      return url.href;
    } catch (ignored) { return ""; }
  }
  function hash(value) { var n = 2166136261, i; for (i = 0; i < value.length; i++) { n ^= value.charCodeAt(i); n += (n << 1) + (n << 4) + (n << 7) + (n << 8) + (n << 24); } return (n >>> 0).toString(16); }
  function rutubeId(value) {
    var url = safeURL(value), parsed, match;
    if (!url) return "";
    parsed = new URL(url);
    if (!/^(?:www\.)?rutube\.ru$/.test(parsed.hostname)) return "";
    match = parsed.pathname.match(/^\/(?:video|live\/video|play\/embed)\/([a-f0-9]{32})\/?$/i);
    return match ? match[1].toLowerCase() : "";
  }
  /* Enlaces de YouTube: watch?v=, youtu.be/, embed/ (y live/). Usa el mismo
     analizador que Volley (app/model.js parseYouTubeId). */
  function youtubeId(value) {
    var url = safeURL(value);
    if (!url || !volleyModel || typeof volleyModel.parseYouTubeId !== "function") return "";
    return volleyModel.parseYouTubeId(url) || "";
  }
  function frameKind(kind) { return kind === "web" || kind === "youtube"; }
  /* 1.11.1: con el iframe desactivado, youtube y web se abren fuera de Home. */
  function opensExternally(item) { return !WEB_FRAME_ENABLED && !!item && frameKind(item.kind); }
  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var url = safeURL(raw.url), kind = raw.kind, videoId, title, slug, item, sourcePage;
    var group = GROUPS.indexOf(raw.group) >= 0 ? raw.group : "";
    if (kind === "trt") {
      slug = typeof raw.channelSlug === "string" && Object.prototype.hasOwnProperty.call(TRT, raw.channelSlug) ? raw.channelSlug : "";
      if (!slug) return null;
      return { id: "media:trt:" + slug, title: text(raw.title || raw.name, 160) || TRT[slug].title, kind: "trt", url: TRT[slug].url, videoId: "", channelSlug: slug,
        source: text(raw.source, 100) || "Volley Turquía · TRT", live: true, thumbnail: "", description: text(raw.description, 240) || TRT[slug].description, group: "volley", experimental: false };
    }
    if (kind === "youtube") {
      videoId = YOUTUBE_ID.test(raw.videoId || "") ? raw.videoId : youtubeId(url);
      if (!videoId) return null;
      return { id: "media:youtube:" + videoId, title: text(raw.title || raw.name, 160) || "Vídeo de YouTube", kind: "youtube", url: "https://www.youtube.com/watch?v=" + videoId, videoId: videoId,
        source: text(raw.source, 100) || "YouTube", live: raw.live === true, thumbnail: safeURL(raw.thumbnail), description: text(raw.description, 240), group: group, experimental: WEB_FRAME_ENABLED, external: !WEB_FRAME_ENABLED };
    }
    if (kind === "web") {
      if (!url) return null;
      return { id: "media:web:" + hash(url), title: text(raw.title || raw.name, 160) || new URL(url).hostname, kind: "web", url: url, videoId: "",
        source: text(raw.source, 100) || "Página web", live: raw.live === true, thumbnail: safeURL(raw.thumbnail), description: text(raw.description, 240), group: group, experimental: WEB_FRAME_ENABLED, external: !WEB_FRAME_ENABLED };
    }
    videoId = /^[a-f0-9]{32}$/i.test(raw.videoId || "") ? raw.videoId.toLowerCase() : rutubeId(url);
    if (videoId && (!kind || kind === "rutube")) { kind = "rutube"; url = "https://rutube.ru/video/" + videoId + "/"; }
    if (!url) return null;
    var pathname = new URL(url).pathname;
    if (kind !== "rutube") {
      if (/\.m3u8$/i.test(pathname)) kind = "hls";
      else if (/\.mp4$/i.test(pathname)) kind = "mp4";
      else return null;
    }
    if (kind === "rutube" && !videoId) return null;
    title = text(raw.title || raw.name, 160) || (kind === "rutube" ? "Vídeo de RUTUBE" : "Mi vídeo o canal");
    item = { id: kind === "rutube" ? "media:rutube:" + videoId : "media:" + kind + ":" + hash(url), title: title, kind: kind, url: url,
      videoId: kind === "rutube" ? videoId : "", source: text(raw.source, 100) || (kind === "rutube" ? "RUTUBE" : "Fuente añadida"),
      live: raw.live === true, thumbnail: safeURL(raw.thumbnail), description: text(raw.description, 240), group: group, experimental: false };
    sourcePage = group && group !== "volley" && safeURL(raw.sourcePage);
    if (sourcePage) item.sourcePage = sourcePage;
    if (raw.language === "es") item.language = "es";
    return item;
  }
  /* RUTUBE → YouTube → HLS/MP4 → cualquier otra página HTTPS (web). */
  function parseLink(url, title) {
    var value = text(url, 4096), item = normalizeItem({ url: value, title: title }), id;
    if (!item && safeURL(value)) {
      id = youtubeId(value);
      item = id ? normalizeItem({ kind: "youtube", videoId: id, title: title }) : normalizeItem({ kind: "web", url: value, title: title });
    }
    if (!item) throw new Error("Usa un enlace HTTPS: una señal .m3u8 o .mp4, un vídeo de RUTUBE o YouTube, o una página web.");
    return item;
  }
  /* Dirección que carga el iframe del recuadro. enablejsapi permite pausar y
     continuar YouTube con postMessage. */
  function frameURL(item) {
    if (!item || !WEB_FRAME_ENABLED) return "";
    if (item.kind === "youtube" && YOUTUBE_ID.test(item.videoId || "")) return "https://www.youtube-nocookie.com/embed/" + item.videoId + "?autoplay=1&playsinline=1&rel=0&enablejsapi=1";
    if (item.kind === "web") return safeURL(item.url);
    return "";
  }
  /* Dirección para «Abrir en Internet» (navegador del proyector). */
  function webURL(item) {
    if (!item) return "";
    if (item.kind === "trt" && TRT[item.channelSlug]) return TRT[item.channelSlug].url;
    if (item.kind === "youtube" && YOUTUBE_ID.test(item.videoId || "")) return "https://www.youtube.com/watch?v=" + item.videoId;
    return safeURL(item.sourcePage) || safeURL(item.url);
  }
  function combine(items, custom) {
    var out = [], seen = Object.create(null), list = (Array.isArray(custom) ? custom : []).concat(Array.isArray(items) ? items : []), i, item;
    for (i = 0; i < list.length && out.length < 160; i++) { item = normalizeItem(list[i]); if (item && !seen[item.id]) { out.push(item); seen[item.id] = true; } }
    return out;
  }
  function builtins() {
    return combine([
      { title: "24 Horas · RTVE", url: "https://rtvelivestream.rtve.es/rtvesec/24h/24h_main_dvr.m3u8", sourcePage: "https://www.rtve.es/play/videos/directo/24h/", source: "RTVE · señal oficial", live: true, group: "news", language: "es", description: "Noticias en español. La disponibilidad depende de RTVE y de la región." },
      { title: "Volley Rusia · Canal de la Federación", kind: "rutube", videoId: CHANNEL, source: "Volley Rusia · RUTUBE", live: true, group: "volley", description: "Canal Voleibol de la Federación Rusa. Señal continua con programación mixta; no implica que haya un partido en directo." },
      { kind: "trt", channelSlug: "trtspor", source: "Volley Turquía · TRT" },
      { kind: "trt", channelSlug: "trtsporyildiz", source: "Volley Turquía · TRT" },
      { title: "France 24 · Español", url: "https://live.france24.com/hls/live/2037220/F24_ES_HI_HLS/master_5000.m3u8", sourcePage: "https://www.france24.com/es/en-vivo", source: "France 24 · señal oficial", live: true, group: "news", language: "es" },
      { title: "CBS News 24/7", url: "https://news20e7hhcb.airspace-cdn.cbsivideo.com/index.m3u8", sourcePage: "https://www.cbsnews.com/live/", source: "CBS · inglés", live: true, group: "tvplus" },
      { title: "Bloomberg TV+", url: "https://www.bloomberg.com/media-manifest/streams/phoenix-us.m3u8", sourcePage: "https://www.bloomberg.com/live", source: "Bloomberg · inglés", live: true, group: "tvplus" },
      { title: "Noticias Telemundo AHORA", kind: "web", url: "https://www.telemundo.com/noticias/noticias-telemundo-ahora", source: "Telemundo · español", live: true, group: "news" },
      { title: "Euronews · Español", kind: "web", url: "https://es.euronews.com/live", source: "Euronews · español", live: true, group: "news" },
      { title: "N+ FORO · México", kind: "web", url: "https://www.nmas.com.mx/en-vivo/?canal=forotv", source: "N+ · español", live: true, group: "news" },
    ], []);
  }
  /* Manifiestos públicos que publican las emisoras en sus reproductores. */
  function spanishLive() {
    return [
      { title: "DW Español", url: "https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/master.m3u8", sourcePage: "https://www.dw.com/es/live-tv/channel-spanish", source: "Deutsche Welle · Alemania", group: "news" },
      { title: "RTVD · Canal 4", url: "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8", sourcePage: "https://rtvd.gob.do/", source: "RTVD · República Dominicana", group: "dominicana" },
      { title: "RTVD · Canal 17", url: "https://cdn.protvradiostream.com:443/rtvd17/ngrp:rtvd17_all/playlist.m3u8", sourcePage: "https://rtvdclic.com/rtvd-17-en-vivo/", source: "RTVD · República Dominicana", group: "dominicana" },
      { title: "Luna TV · Canal 25", url: "https://stream.lunatv.do/hls/prueba.m3u8", sourcePage: "https://lunatv.do/en-vivo", source: "Santiago · República Dominicana", group: "dominicana" },
      { title: "Microvisión", url: "https://streaming.telecablecentral.com.do/live/MicroHD/playlist.m3u8", sourcePage: "https://microvision.com.do/en-vivo/", source: "La Vega · República Dominicana", group: "dominicana" },
      { title: "Acento TV", url: "https://acentotv01.streamprolive.com/hls/live.m3u8", sourcePage: "https://acentotv.acento.com.do/", source: "República Dominicana", group: "dominicana" },
      { title: "RTN · Neuquén", url: "https://media.neuquen.gov.ar/rtn/television/playlist.m3u8", sourcePage: "https://www.rtnweb.gob.ar/", source: "Argentina", group: "latam" },
      { title: "Señal Colombia", url: "https://streaming.rtvc.gov.co/TV_Senal_Colombia_live/smil:live.smil/chunklist_b1500000.m3u8", sourcePage: "https://www.senalcolombia.tv/senal-en-vivo", source: "Colombia", group: "latam" },
      { title: "Canal Institucional", url: "https://streaming.rtvc.gov.co/TV_CanalInstitucional_live/smil:live.smil/playlist.m3u8", sourcePage: "https://www.canalinstitucional.tv/envivo", source: "Colombia", group: "latam" },
      { title: "Ecuador TV", url: "https://video-eu1.streamerr.co/hls/s64029a8fdf/live.m3u8", sourcePage: "https://www.ecuadortv.ec/en-vivo", source: "Ecuador", group: "latam" },
      { title: "Canal 23 · Guatemala", url: "https://ddycmnicl95kp.cloudfront.net/live/by1ualyjwslr/master.m3u8", sourcePage: "https://www.chapintv.com/envivo-canal-23/", source: "Chapin TV · Guatemala", group: "latam" },
      { title: "Canal Once · Once.3", url: "https://vivo.canaloncelive.tv/secureoncedos/oncedigital/playlist.m3u8", sourcePage: "https://canalonce.mx/en-vivo", source: "México", group: "latam" },
      { title: "Canal 12 · El Salvador", url: "https://ddycmnicl95kp.cloudfront.net/live/rury2ckyqgw9/master.m3u8", sourcePage: "https://www.canal12.com.sv/envivo/", source: "El Salvador", group: "latam" },
      { title: "Canal 10 · Nicaragua", url: "https://ddycmnicl95kp.cloudfront.net/live/ja5k3h31wv9r/master.m3u8", sourcePage: "https://www.canal10.com.ni/envivo/", source: "Nicaragua", group: "latam" },
      { title: "C9N", url: "https://ddycmnicl95kp.cloudfront.net/live/qnxsy62odjyb/master.m3u8", sourcePage: "https://www.c9n.com.py/envivo/", source: "Paraguay", group: "latam" },
      { title: "SNT", url: "https://dekjz69ytiztf.cloudfront.net/0_3/index.m3u8", sourcePage: "https://www.snt.com.py/envivo/", source: "Paraguay", group: "latam" }
    ].map(function (item) {
      item.live = true; item.language = "es";
      return normalizeItem(item);
    });
  }
  function englishLive() {
    return [
      { title: "DW News · English", url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8", sourcePage: "https://www.dw.com/en/live-tv/channel-english", source: "Deutsche Welle · Alemania" },
      { title: "Sky News", url: "https://linear901-oo-hls0-prd-gtm.delivery.skycdp.com/v1/master/6404a5d732e04991ed59ac7790b61cc065c9aabd/prod-gb-lin-skynews-hls-25-web/master.m3u8", sourcePage: "https://news.sky.com/watch-live", source: "Reino Unido" },
      { title: "TRT World", url: "https://tv-trtworld.medya.trt.com.tr/master.m3u8", sourcePage: "https://www.trtworld.com/", source: "Turquía" },
      { title: "CBS News · Boston", url: "https://bostoahhb12d.airspace-cdn.cbsivideo.com/live/manifest.m3u8", sourcePage: "https://www.cbsnews.com/boston/live/", source: "Estados Unidos" },
      { title: "CBS News · Los Ángeles", url: "https://losandd87138.airspace-cdn.cbsivideo.com/live/manifest.m3u8", sourcePage: "https://www.cbsnews.com/losangeles/live/", source: "Estados Unidos" },
      { title: "CBS News · Miami", url: "https://lineup.cbsivideo.com/playout/8796731e-7ce7-4bcf-bb04-41ef5a969c62/0/chunklist.m3u8", sourcePage: "https://www.cbsnews.com/miami/live/", source: "Estados Unidos" },
      { title: "CBS News · Bahía de San Francisco", url: "https://baya0f96heg.airspace-cdn.cbsivideo.com/live/manifest.m3u8", sourcePage: "https://www.cbsnews.com/sanfrancisco/live/", source: "Estados Unidos" }
    ].map(function (item) {
      item.live = true; item.group = "english";
      return normalizeItem(item);
    });
  }
  /* 1.27.0: canales especiales en HD (deporte, ciencia, cultura) y cine abierto bajo demanda. */
  function curatedLive() {
    return [
      { title: "Teledeporte · RTVE", url: "https://rtvelivestream.rtve.es/rtvesec/tdp/tdp_main_dvr.m3u8", sourcePage: "https://www.rtve.es/play/videos/directo/tdp/", source: "RTVE · Deporte en español", live: true, group: "featured", language: "es", description: "Canal deportivo de RTVE con competiciones nacionales e internacionales en directo." },
      { title: "La 1 · RTVE", url: "https://rtvelivestream.rtve.es/rtvesec/la1/la1_main_dvr.m3u8", sourcePage: "https://www.rtve.es/play/videos/directo/la-1/", source: "RTVE · España", live: true, group: "featured", language: "es", description: "Señal generalista principal de Televisión Española." },
      { title: "La 2 · Cultura y Documentales", url: "https://rtvelivestream.rtve.es/rtvesec/la2/la2_main_dvr.m3u8", sourcePage: "https://www.rtve.es/play/videos/directo/la-2/", source: "RTVE · Cultura", live: true, group: "featured", language: "es", description: "Documentales, ciencia, cine clásico y programación cultural en español." },
      { title: "NASA TV · Espacio en directo HD", url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8", sourcePage: "https://plus.nasa.gov/", source: "NASA · Señal pública HD", live: true, group: "featured", description: "Emisión oficial continua de la NASA: misiones espaciales, Estación Espacial Internacional y lanzamientos." },
      { title: "Red Bull TV · Deportes y Aventura HD", url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8", sourcePage: "https://www.redbull.com/int-en/live-events", source: "Red Bull Media · HD", live: true, group: "featured", description: "Competiciones deportivas internacionales, motor, montaña y documentales en alta definición." },
      { title: "Sintel · Fantasía 1080p", url: "https://download.blender.org/durian/trailer/sintel_trailer-1080p.mp4", sourcePage: "https://durian.blender.org/", source: "Blender Open Movie · 1080p", live: false, group: "cinema", description: "Cortometraje abierto de animación fantástica en alta definición." },
      { title: "Tears of Steel · Ciencia ficción HD", url: "https://test-streams.mux.dev/tos_ismc/main.m3u8", sourcePage: "https://mango.blender.org/", source: "Mango Open Movie · HD", live: false, group: "cinema", description: "Cortometraje abierto de ciencia ficción rodado en Ámsterdam." },
      { title: "Big Buck Bunny · Animación HD", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", sourcePage: "https://peach.blender.org/", source: "Peach Open Movie · HD", live: false, group: "cinema", description: "Clásico cortometraje abierto de comedia y animación en alta definición." }
    ].map(normalizeItem).filter(Boolean);
  }
  function selectStream(options) {
    if (!options || !options.acl_access || options.acl_access.allowed !== true || options.has_video !== true || options.drm_token || options.purchase_ttl) return "";
    var live = options.live_streams && options.live_streams.hls;
    var url = safeURL(options.video_balancer && options.video_balancer.m3u8 || (Array.isArray(live) && live[0] && live[0].url));
    return url && /(^|\.)(rutube\.ru|rtbcdn\.ru)$/.test(new URL(url).hostname) ? url : "";
  }
  function women(title) {
    title = String(title || "").toLowerCase();
    if (/мужчин|юнош|\bmen\b|зенит|белогор|кузбасс|газпром.югра|ярославич|мгту|оренбуржье|динамо.ло(?:[^а-я]|$)/.test(title)) return false;
    return /женщ|девуш|women|female|уралочка|заречье|ленинградка|тулица|протон|минчанка|корабелка|омичка|динамо.ак.барс/.test(title);
  }
  function translate(value) {
    var pairs = [[/Заречье[-– ]Одинцово/gi,"Zarechie Odintsovo"],[/Динамо[-– ]Ак Барс/gi,"Dinamo Ak Bars"],[/Уралочка[-– ]НТМК/gi,"Uralochka"],[/Ленинградка/gi,"Leningradka"],[/Локомотив/gi,"Lokomotiv"],[/Тулица/gi,"Tulitsa"],[/Протон/gi,"Proton"],[/Минчанка/gi,"Minchanka"],[/Корабелка/gi,"Korabelka"],[/Динамо/gi,"Dinamo"],[/Краснодар/gi,"Krasnodar"],[/Москва/gi,"Moscú"],[/Енисей/gi,"Yenisey"],[/Омичка/gi,"Omichka"]], i;
    value = text(value, 200).split("|")[0];
    for (i = 0; i < pairs.length; i++) value = value.replace(pairs[i][0], pairs[i][1]);
    return value;
  }
  function normalizeFeed(value) {
    var list = value && Array.isArray(value.results) ? value.results : [], out = [], i, item, raw;
    for (i = 0; i < list.length; i++) {
      raw = list[i]; if (!raw || !women(raw.title) || !/^[a-f0-9]{32}$/i.test(raw.id || "") || raw.is_livestream && !raw.is_on_air) continue;
      item = normalizeItem({ kind: "rutube", videoId: raw.id, title: translate(raw.title), source: "Volley Rusia · RUTUBE", group: "volley", live: raw.is_livestream === true && raw.is_on_air === true, thumbnail: raw.thumbnail_url });
      if (item) out.push(item);
    }
    return out;
  }
  /* type: "json" (por defecto), "text" o "probe" (sólo cabeceras, con Range;
     devuelve { contentType, status }), como el request() de Volley. */
  function request(url, callback, type) {
    if (platform && platform.request) return platform.request(url, callback, type || "json");
    var xhr, done = false, limit = type === "text" ? 6000000 : 1500000;
    function finish(error, value) { if (done) return; done = true; callback(error, value); }
    try {
      xhr = new XMLHttpRequest(); xhr.open("GET", url, true); xhr.timeout = type === "probe" ? 8000 : type === "text" ? 16000 : 10000;
      if (type === "probe") {
        xhr.setRequestHeader("Range", "bytes=0-1023");
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 2 || done) return;
          var status = xhr.status;
          if (status >= 200 && status < 300) { finish(null, { contentType: xhr.getResponseHeader("Content-Type") || "", status: status }); try { xhr.abort(); } catch (ignoredAbort) {} }
          else if (status > 0) { finish(new Error("La fuente respondió HTTP " + status + ".")); try { xhr.abort(); } catch (ignoredFail) {} }
        };
      }
      xhr.onload = function () {
        try {
          if (type === "probe") { if (xhr.status >= 200 && xhr.status < 300) finish(null, { contentType: xhr.getResponseHeader("Content-Type") || "", status: xhr.status }); else throw new Error("La fuente no respondió correctamente."); return; }
          if (xhr.status !== 200 || xhr.responseText.length > limit) throw new Error("La fuente no respondió correctamente.");
          finish(null, type === "text" ? xhr.responseText : JSON.parse(xhr.responseText));
        } catch (error) { finish(error); }
      };
      xhr.onerror = xhr.ontimeout = function () { finish(new Error("No se pudo conectar con la fuente. Comprueba Internet.")); };
      xhr.send();
    } catch (error) { finish(error); }
    return function () { done = true; if (xhr) try { xhr.abort(); } catch (ignored) {} };
  }
  /* Contexto de los módulos de Volley: request(url, type) devuelve una
     promesa. Todas las peticiones pendientes se cancelan con cancel(). */
  function volleyContext(query, now) {
    var cancels = [], cancelled = false;
    return { cancel: function () { cancelled = true; cancels.forEach(function (cancel) { if (typeof cancel === "function") try { cancel(); } catch (ignored) {} }); },
      cancelled: function () { return cancelled; },
      ctx: { now: typeof now === "number" ? now : Date.now(), request: function (url, type) {
        return new Promise(function (resolve, reject) {
          if (cancelled) { reject(new Error("Cancelado")); return; }
          cancels.push(query(url, function (error, value) { if (error) reject(error); else resolve(value); }, type || "json"));
        });
      } } };
  }
  function load(callback, options) {
    options = options || {}; var cancelled = false, pending = 4, items = builtins(), failures = 0, cancels = [], query = options.request || request;
    if (cache && Date.now() - cachedAt < CACHE_MS && !options.force) { var timer = setTimeout(function () { callback(null, combine(cache, [])); }, 0); return function () { clearTimeout(timer); }; }
    function received(error, data) {
      if (cancelled) return;
      if (error) failures++; else items = combine(items, normalizeFeed(data));
      pending--;
      if (!pending) { cache = items; cachedAt = failures ? 0 : Date.now(); callback(failures ? new Error("Algunos vídeos no se pudieron actualizar. Las fuentes guardadas siguen disponibles.") : null, combine(items, [])); }
    }
    [23493179, 39619003].forEach(function (channel) { [1, 2].forEach(function (page) { cancels.push(query("https://rutube.ru/api/video/person/" + channel + "/?page=" + page, received)); }); });
    return function () { cancelled = true; cancels.forEach(function (cancel) { if (typeof cancel === "function") cancel(); }); };
  }
  /* Partidos y vídeos de Sultanlar Ligi (turkey.load): sólo los que tienen un
     vídeo de YouTube; se abren en la app YouTube. Orden: en directo,
     próximos (antes primero) y recientes (más nuevos primero). */
  function volleyVideos(result) {
    var list = result && Array.isArray(result.items) ? result.items : [], out = [], seen = Object.create(null), i, raw, route, j;
    if (volleyModel && typeof volleyModel.videoItems === "function") list = volleyModel.videoItems(list);
    for (i = 0; i < list.length; i++) {
      raw = list[i]; route = null;
      for (j = 0; raw && Array.isArray(raw.routes) && j < raw.routes.length; j++) if (raw.routes[j] && raw.routes[j].provider === "youtube" && YOUTUBE_ID.test(raw.routes[j].videoId || "")) { route = raw.routes[j]; break; }
      if (!route || seen[route.videoId]) continue;
      seen[route.videoId] = true;
      out.push({ id: "volley:youtube:" + route.videoId, videoId: route.videoId, title: text(raw.label || raw.title, 160) || "Sultanlar Ligi", fullTitle: text(raw.title, 200),
        status: raw.status === "live" || raw.status === "upcoming" ? raw.status : "recent", start: typeof raw.start === "number" && isFinite(raw.start) ? raw.start : null,
        source: text(raw.source, 100) || "YouTube", thumbnail: safeURL(raw.thumbnail), highlight: raw.highlight === true });
    }
    function rank(item) { return item.status === "live" ? 0 : item.status === "upcoming" ? 1 : 2; }
    out.sort(function (a, b) {
      return rank(a) - rank(b) || (a.status === "upcoming" ? (a.start || Infinity) - (b.start || Infinity) : (b.start || 0) - (a.start || 0)) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
    });
    return out.slice(0, 30);
  }
  /* callback(error, { videos, diagnostics, offline }). Caché de 90 s, como el
     resto de fuentes. Con todas las consultas fallidas: offline = true. */
  function loadVolley(callback, options) {
    options = options || {};
    var provider = Object.prototype.hasOwnProperty.call(options, "provider") ? options.provider : turkey, timer, context;
    if (volleyCache && Date.now() - volleyCachedAt < CACHE_MS && !options.force) { timer = setTimeout(function () { callback(null, JSON.parse(JSON.stringify(volleyCache))); }, 0); return function () { clearTimeout(timer); }; }
    if (!provider || typeof provider.load !== "function") { timer = setTimeout(function () { callback(new Error("Las fuentes de Volley no están disponibles en este paquete."), { videos: [], diagnostics: [], offline: true }); }, 0); return function () { clearTimeout(timer); }; }
    context = volleyContext(options.request || request, options.now);
    var promise;
    try { promise = provider.load(context.ctx); } catch (error) { promise = Promise.reject(error); }
    Promise.resolve(promise).then(function (result) {
      if (context.cancelled()) return;
      var diagnostics = result && Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 10) : [], videos = volleyVideos(result);
      /* turkey.load consulta el calendario TVF y 3 canales de YouTube. */
      var offline = !videos.length && diagnostics.length >= 4, value = { videos: videos, diagnostics: diagnostics, offline: offline };
      if (!offline && !diagnostics.length) { volleyCache = value; volleyCachedAt = Date.now(); } else { volleyCache = null; volleyCachedAt = 0; }
      callback(offline ? new Error("Sin conexión con TVF ni con YouTube.") : null, JSON.parse(JSON.stringify(value)));
    }, function (error) {
      if (context.cancelled()) return;
      callback(error || new Error("Sin conexión."), { videos: [], diagnostics: [String(error && error.message || error)], offline: true });
    });
    return context.cancel;
  }
  function loadAgenda(callback, options) {
    options = options || {};
    var context = volleyContext(options.request || request, options.now), ctx = context.ctx;
    function loadCountry(country, fetch) {
      Promise.resolve().then(fetch).then(function (items) {
        if (context.cancelled()) return;
        var matches = items.filter(function (item) {
          return item.kind === "match" && item.status === "upcoming" && typeof item.start === "number" && isFinite(item.start) && item.start > ctx.now;
        }).map(function (item) { return { id: item.id, title: text(item.label || item.title, 160), start: item.start, country: country }; });
        callback(country, null, matches);
      }, function (error) { if (!context.cancelled()) callback(country, error, []); });
    }
    loadCountry("russia", function () {
      if (!russia || !russia.loadCalendar) throw new Error("Calendario de Rusia no disponible.");
      return russia.loadCalendar(ctx).then(function (result) { return result.items; });
    });
    loadCountry("turkey", function () {
      if (!turkey || !turkey.fixturesUrl) throw new Error("Calendario de Turquía no disponible.");
      return ctx.request(turkey.fixturesUrl, "text").then(function (html) { return turkey.parseFixtures(html, ctx.now, true); });
    });
    return context.cancel;
  }
  function resolve(item, callback, options) {
    options = options || {}; item = normalizeItem(item);
    if (!item) { var badTimer = setTimeout(function () { callback(new Error("La fuente no es compatible.")); }, 0); return function () { clearTimeout(badTimer); }; }
    if (opensExternally(item)) { var outTimer = setTimeout(function () { callback(new Error(item.kind === "youtube" ? "Este vídeo se abre en la app YouTube." : "Esta página se abre en Internet.")); }, 0); return function () { clearTimeout(outTimer); }; }
    if (frameKind(item.kind)) { var frameTimer = setTimeout(function () { var out = JSON.parse(JSON.stringify(item)); out.frameUrl = frameURL(item); callback(null, out); }, 0); return function () { clearTimeout(frameTimer); }; }
    if (item.kind === "trt") {
      var provider = Object.prototype.hasOwnProperty.call(options, "provider") ? options.provider : turkey, context, done = false;
      if (!provider || typeof provider.resolve !== "function") { var noTimer = setTimeout(function () { callback(new Error("Las fuentes de Volley no están disponibles en este paquete.")); }, 0); return function () { clearTimeout(noTimer); }; }
      context = volleyContext(options.request || request, options.now);
      Promise.resolve(provider.resolve({ provider: "trt", channelSlug: item.channelSlug }, context.ctx)).then(function (route) {
        if (context.cancelled() || done) return; done = true;
        var url = route && route.provider === "hls" ? safeURL(route.url) : "";
        if (!url) { callback(new Error("TRT no ofrece ahora una señal pública compatible para el recuadro. Prueba «Abrir en Internet».")); return; }
        callback(null, { id: item.id, title: item.title, kind: "hls", url: url, source: item.source, live: true, thumbnail: "" });
      }, function () { if (context.cancelled() || done) return; done = true; callback(new Error("No se pudo conectar con TRT. Comprueba Internet y reintenta.")); });
      return context.cancel;
    }
    if (item.kind !== "rutube") { var timer = setTimeout(function () { callback(null, item); }, 0); return function () { clearTimeout(timer); }; }
    return (options.request || request)("https://rutube.ru/api/play/options/" + item.videoId + "/?format=json", function (error, value) {
      if (error) { callback(error); return; }
      var url = selectStream(value);
      if (!url) { callback(new Error("Esta emisión no ofrece vídeo público compatible. Puede haber terminado, requerir acceso o no estar disponible en tu región.")); return; }
      callback(null, { id: item.id, title: item.title, kind: "hls", url: url, source: item.source, live: item.live, thumbnail: item.thumbnail });
    });
  }
  function clearCaches() { cache = null; cachedAt = 0; volleyCache = null; volleyCachedAt = 0; }
  return { WEB_FRAME_ENABLED: WEB_FRAME_ENABLED, normalizeItem: normalizeItem, parseLink: parseLink, fromURL: parseLink, combine: combine, builtins: builtins, spanishLive: spanishLive, englishLive: englishLive, curatedLive: curatedLive, load: load, resolve: resolve,
    selectStream: selectStream, normalizeFeed: normalizeFeed, request: request, loadVolley: loadVolley, loadAgenda: loadAgenda, volleyVideos: volleyVideos, frameURL: frameURL, webURL: webURL,
    isFrameKind: frameKind, opensExternally: opensExternally, youtubeId: youtubeId, clearCaches: clearCaches, hasVolley: !!(turkey && volleyModel) };
});
