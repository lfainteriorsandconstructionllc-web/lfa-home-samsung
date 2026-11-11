(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VolleyProviders = root.VolleyProviders || {};
  root.VolleyProviders.turkey = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var FIXTURES_URL = 'https://tvf.org.tr/lig/sultanlar-ligi?sekme=fikstur';
  var LEAGUE_IMAGE = 'https://tvf.org.tr/storage/90332/Vodafone-Sultanlar-Ligi-Logo.png';
  var DAY = 86400000;
  var SOURCES = [
    { id: 'tr-tvf-youtube', name: 'TVF Voleybol TV', label: 'TVF Voleybol TV · YouTube', provider: 'youtube', url: 'https://www.youtube.com/@tvfvoleyboltv/streams', channelId: 'UCTgQ8Bfq3AUuo1vWULdvRKw', description: 'Canal oficial de la Federación Turca. Directos y repeticiones; también emite otras divisiones.' },
    { id: 'tr-trt-youtube', name: 'TRT Spor Yıldız · YouTube', label: 'TRT Spor Yıldız · YouTube', provider: 'youtube', url: 'https://www.youtube.com/@trtsporyildiz/streams', channelId: 'UCebdo7-2NdjcktKzco64iNw', description: 'Canal oficial de TRT Spor Yıldız. La disponibilidad de cada partido depende de lo que publique el canal.' },
    { id: 'tr-trt-spor', name: 'TRT Spor', label: 'TRT Spor', provider: 'trt', channelSlug: 'trtspor', url: 'https://www.tabii.com/tr/watch/live/trtspor?trackId=150022', description: 'Señal oficial de TRT Spor en tabii; programación deportiva mixta.' },
    { id: 'tr-trt-yildiz', name: 'TRT Spor Yıldız', label: 'TRT Spor Yıldız', provider: 'trt', channelSlug: 'trtsporyildiz', url: 'https://www.tabii.com/tr/watch/live/trtsporyildiz?trackId=150028', description: 'Señal oficial que emite los encuentros asignados por TVF. Incluye otros deportes.' },
    { id: 'tr-tabii', name: 'tabii Spor', label: 'Abrir tabii Spor', provider: 'web', requiresLogin: true, url: 'https://www.tabii.com/tr/watch/live/tabiispor?trackId=419561', description: 'Plataforma oficial. Puede requerir cuenta y suscripción según el encuentro.' },
    { id: 'tr-trt-spor-youtube', name: 'TRT Spor · YouTube', label: 'TRT Spor · YouTube', provider: 'youtube', url: 'https://www.youtube.com/@trtspor/streams', channelId: 'UCfYNqluOf8EbQkL44otydMw', description: 'Canal oficial de TRT Spor. Solo se incluyen vídeos identificados expresamente como Sultanlar Ligi.' },
    { id: 'tr-tvf-agenda', name: 'Calendario oficial TVF', label: 'Consultar TVF', provider: 'web', url: FIXTURES_URL, description: 'Fecha, resultado y canal anunciado por la Federación. El horario no confirma una emisión en directo.' },
    { id: 'tr-tvstart', name: 'TV Start · cobertura internacional', label: 'Abrir TV Start', provider: 'web', requiresLogin: true, url: 'https://ru.tvstart.ru/sports/voleybol/', description: 'El operador ruso anuncia el campeonato femenino de Turquía. La emisión depende de derechos regionales, cuenta y suscripción.' }
  ];
  function copy(value) { return Object.assign({}, value); }
  function source(id) { return copy(SOURCES.find(function (s) { return s.id === id; })); }
  function decodeHtml(text) {
    return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, function (all, entity) {
      var named = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
      if (entity.charAt(0) !== '#') return named[entity.toLowerCase()] || all;
      var number = entity.charAt(1).toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return number >= 0 && number <= 1114111 ? String.fromCodePoint(number) : all;
    });
  }
  function walk(value, visit, depth) {
    depth = depth || 0;
    if (!value || typeof value !== 'object' || depth > 100) return;
    visit(value);
    Object.keys(value).forEach(function (key) { walk(value[key], visit, depth + 1); });
  }
  function objectAfter(text, start) {
    var i = start, quoted = false, escaped = false, depth = 0, first = -1;
    while (i < text.length && /\s/.test(text.charAt(i))) i++;
    if (text.charAt(i) !== '{') return null;
    first = i;
    for (; i < text.length; i++) {
      var ch = text.charAt(i);
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') quoted = false;
      } else if (ch === '"') quoted = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { return JSON.parse(text.slice(first, i + 1)); } catch (_) { return null; }
      }
    }
    return null;
  }
  function youtubeData(html) {
    var text = String(html || '');
    var assignment = /(?:var\s+)?(?:window\[['"]ytInitialData['"]\]|ytInitialData)\s*=\s*/g;
    var match;
    while ((match = assignment.exec(text))) {
      var data = objectAfter(text, assignment.lastIndex);
      if (data) return data;
    }
    return null;
  }
  function scriptData(html, id) {
    var re = new RegExp('<script\\b[^>]*\\bid\\s*=\\s*["\']' + id + '["\'][^>]*>([\\s\\S]*?)<\\/script>', 'i');
    var match = re.exec(String(html || ''));
    try { return match ? JSON.parse(match[1]) : null; } catch (_) { return null; }
  }
  function matchStart(row) {
    var date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(row.TARIH || '').trim());
    var time = /^(\d{1,2})[:.](\d{2})$/.exec(String(row.SAAT || '').trim());
    if (!date || !time) return null;
    var day = Number(date[1]), month = Number(date[2]), year = Number(date[3]), hour = Number(time[1]), minute = Number(time[2]);
    var check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
    // TVF publishes Turkish local times. Europe/Istanbul is UTC+03 for these fixtures.
    return Date.UTC(year, month - 1, day, hour - 3, minute);
  }
  function shortTeam(team) {
    var names = {
      'NİLÜFER BELEDİYESPOR EKER': 'Nilüfer Eker', 'ECZACIBAŞI PERON İSTANBUL': 'Eczacıbaşı',
      'SİNNADA HOTELS AFYON BELEDİYE YÜNTAŞ': 'Afyon', 'FENERBAHÇE MEDICANA': 'Fenerbahçe',
      'MANİSA BÜYÜKŞEHİR BELEDİYE SPOR': 'Manisa', 'TÜRK HAVA YOLLARI': 'Türk Hava Yolları',
      'VAKIFBANK': 'VakıfBank', 'BEŞİKTAŞ': 'Beşiktaş', 'GÖZTEPE YUPPO': 'Göztepe',
      'GALATASARAY DAIKIN': 'Galatasaray', 'ZEREN SPOR': 'Zeren Spor', 'ARAS KARGO': 'Aras Kargo',
      'KUZEYBORU': 'Kuzeyboru', 'İLBANK': 'İlbank'
    };
    return names[team] || String(team || 'Equipo');
  }
  function fixtureRoute(broadcaster, completed) {
    if (completed) return { id: 'tr-tvf-result', label: 'Ver resultado y fuente oficial', provider: 'web', url: FIXTURES_URL, note: 'Resultado publicado por TVF. El enlace exacto de la repetición no está confirmado.' };
    var name = String(broadcaster || '').toLocaleLowerCase('tr-TR');
    var route = name.indexOf('tabii') >= 0 ? source('tr-tabii') : name.indexOf('yıldız') >= 0 || name.indexOf('yildiz') >= 0 ? source('tr-trt-yildiz') : name.indexOf('trt') >= 0 ? source('tr-trt-spor') : name.indexOf('tvf') >= 0 ? source('tr-tvf-youtube') : { id: 'tr-tvf-agenda', label: 'Consultar TVF', provider: 'web', url: FIXTURES_URL };
    route.note = route.provider === 'youtube' ? 'Canal emisor anunciado por TVF; el enlace exacto del partido se publica cuando lo facilita el canal.' : 'Emisor anunciado por TVF. El horario del calendario no confirma que la señal esté en vivo.';
    return route;
  }
  function parseFixtures(html, now, strict) {
    now = typeof now === 'number' ? now : Date.now();
    var text = String(html || ''), snapshots = /\bwire:snapshot\s*=\s*(?:"([^"]*)"|'([^']*)')/g, match, rows = [], seen = {}, recognized = false;
    while ((match = snapshots.exec(text))) {
      var data;
      try { data = JSON.parse(decodeHtml(match[1] === undefined ? match[2] : match[1])); } catch (_) { continue; }
      if (!data || !data.data || !data.data.leagueFixture) continue;
      recognized = true;
      walk(data.data.leagueFixture, function (row) {
        if (!row.TARIH || !row.ATAKIMI || !row.BTAKIMI) return;
        if (row.KUMEID && String(row.KUMEID).trim().toUpperCase() !== 'SULTANLAR') return;
        var start = matchStart(row);
        if (start === null || start < now - 3 * DAY || start > now + 30 * DAY) return;
        var fixtureId = String(row.SEZON || '') + '-' + String(row.MACNO || row.SNO || row.HAFTA + '-' + row.ATAKIMIID + '-' + row.BTAKIMIID);
        if (seen[fixtureId]) return;
        seen[fixtureId] = true;
        var completed = String(row.SETA) === '3' || String(row.SETB) === '3';
        var status = completed ? 'recent' : start > now ? 'upcoming' : 'schedule';
        var score = completed ? ' ' + row.SETA + '–' + row.SETB : '';
        rows.push({
          id: 'tr-fixture-' + fixtureId, title: row.ATAKIMI + ' — ' + row.BTAKIMI,
          label: (status === 'recent' ? 'Resultado · ' : '') + shortTeam(row.ATAKIMI) + score + ' — ' + shortTeam(row.BTAKIMI),
          thumbnail: LEAGUE_IMAGE, status: status, start: start, source: 'TVF · ' + (row.TVKANAL || 'Emisor por anunciar'),
          score: completed ? String(row.SETA) + ':' + String(row.SETB) : null,
          women: true, highlight: false, continuous: false, kind: 'match',
          routes: [fixtureRoute(row.TVKANAL, completed && status === 'recent')]
        });
      });
    }
    if (strict && !recognized) throw new Error('TVF no devolvió un calendario reconocible');
    return rows.sort(function (a, b) { return a.start - b.start; }).slice(0, 60);
  }
  function rendererText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.content || value.simpleText || (value.runs || []).map(function (r) { return r.text || ''; }).join('');
  }
  function isSultanlar(title) {
    var folded = String(title || '').toLowerCase().normalize('NFD').replace(/\u0307/g, '').replace(/ı/g, 'i');
    return /sultanlar\s+ligi/.test(folded);
  }
  function parseYouTube(html, channelName, now, expectedChannel) {
    now = typeof now === 'number' ? now : Date.now();
    var data = youtubeData(html), items = [], seen = {};
    if (!data) {
      if (expectedChannel) throw new Error('YouTube no devolvió datos públicos del canal');
      return items;
    }
    var metadata = data.metadata && data.metadata.channelMetadataRenderer;
    if (expectedChannel && (!metadata || metadata.externalId !== expectedChannel)) throw new Error('YouTube no confirmó el canal oficial solicitado');
    function add(renderer, modern) {
      var id = modern ? renderer.contentId : renderer.videoId;
      var title = rendererText(modern ? renderer.metadata && renderer.metadata.lockupMetadataViewModel && renderer.metadata.lockupMetadataViewModel.title : renderer.title);
      if (!/^[A-Za-z0-9_-]{11}$/.test(id || '') || !isSultanlar(title) || seen[id]) return;
      var live = false, upcoming = !!renderer.upcomingEventData;
      walk(modern ? renderer.contentImage : renderer.thumbnailOverlays, function (entry) {
        var badge = entry.thumbnailBadgeViewModel;
        if (badge) {
          if (badge.badgeStyle === 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE') live = true;
          if (badge.badgeStyle === 'THUMBNAIL_OVERLAY_BADGE_STYLE_UPCOMING' || /^(upcoming|yakında|próximamente)$/i.test(badge.text || '')) upcoming = true;
        }
        var overlay = entry.thumbnailOverlayTimeStatusRenderer;
        if (overlay && overlay.style === 'LIVE') live = true;
        if (overlay && overlay.style === 'UPCOMING') upcoming = true;
      });
      (renderer.badges || []).forEach(function (entry) {
        if (entry.metadataBadgeRenderer && entry.metadataBadgeRenderer.style === 'BADGE_STYLE_TYPE_LIVE_NOW') live = true;
      });
      var thumbs = modern ? renderer.contentImage && renderer.contentImage.thumbnailViewModel && renderer.contentImage.thumbnailViewModel.image && renderer.contentImage.thumbnailViewModel.image.sources : renderer.thumbnail && renderer.thumbnail.thumbnails;
      var image = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : '';
      var eventStart = renderer.upcomingEventData && Number(renderer.upcomingEventData.startTime);
      var start = Number.isFinite(eventStart) && eventStart > 0 ? eventStart * 1000 : null;
      seen[id] = true;
      items.push({
        id: 'tr-yt-' + id, title: title, label: title.replace(/\s*Vodafone\s+Sultanlar\s+Ligi\s*$/i, '').trim(),
        thumbnail: /^https:\/\//.test(image || '') ? image : '', status: live ? 'live' : upcoming ? 'upcoming' : 'recent',
        start: start, source: channelName || 'YouTube · fuente oficial', women: true, highlight: /özet|highlights/i.test(title), continuous: false, kind: 'video',
        routes: [{ id: 'tr-youtube-' + id, label: 'Ver en YouTube', provider: 'youtube', url: 'https://www.youtube.com/watch?v=' + id, videoId: id }]
      });
    }
    walk(data, function (entry) {
      if (entry.lockupViewModel) add(entry.lockupViewModel, true);
      if (entry.videoRenderer) add(entry.videoRenderer, false);
      if (entry.gridVideoRenderer) add(entry.gridVideoRenderer, false);
    });
    return items;
  }
  function load(ctx) {
    var diagnostics = [];
    var jobs = [
      { name: 'Calendario TVF', url: FIXTURES_URL, parse: function (html) { return parseFixtures(html, ctx.now, true); } }
    ];
    SOURCES.filter(function (s) { return s.provider === 'youtube'; }).forEach(function (s) {
      jobs.push({ name: s.name, url: s.url + '?hl=en', parse: function (html) { return parseYouTube(html, s.label, ctx.now, s.channelId); } });
    });
    return Promise.all(jobs.map(function (job) {
      return ctx.request(job.url, 'text').then(job.parse).catch(function (error) { diagnostics.push(job.name + ': ' + String(error && error.message || error)); return []; });
    })).then(function (pages) {
      var byId = {};
      pages.forEach(function (items) { items.forEach(function (item) { byId[item.id] = item; }); });
      return { items: Object.keys(byId).map(function (id) { return byId[id]; }), sources: SOURCES.map(copy), diagnostics: diagnostics };
    });
  }
  function officialMediaUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password && (parsed.hostname === 'trt.daioncdn.net' || /(^|\.)medya\.trt\.com\.tr$/.test(parsed.hostname));
    } catch (_) { return false; }
  }
  function officialWebUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port && ['tvf.org.tr', 'www.youtube.com', 'youtube.com', 'www.tabii.com', 'tabii.com', 'ru.tvstart.ru'].indexOf(parsed.hostname) >= 0;
    } catch (_) { return false; }
  }
  function clearPlaylist(playlist) {
    var text = String(playlist || '').trim();
    if (!/^#EXTM3U(?:\r?\n|\s*$)/.test(text)) return false;
    return !text.split(/\r?\n/).some(function (line) {
      return /^#EXT-X-(?:SESSION-)?KEY:/.test(line) && !/(?:^|[:,])METHOD=NONE(?:,|\s*$)/.test(line);
    });
  }
  function mediaUrl(uri, base) {
    try {
      var url = new URL(uri, base).href;
      return officialMediaUrl(url) ? url : null;
    } catch (_) { return null; }
  }
  function selectVariant(playlist, base) {
    var lines = String(playlist || '').split(/\r?\n/), variants = [];
    lines.forEach(function (line, index) {
      if (!/^#EXT-X-STREAM-INF:/.test(line)) return;
      var resolution = /(?:[:,])RESOLUTION=(\d+)x(\d+)(?:,|$)/.exec(line);
      var codec = /(?:[:,])CODECS="([^"]*)"/.exec(line);
      var height = resolution ? Number(resolution[2]) : null;
      if (resolution && (Number(resolution[1]) > 1920 || height > 1080)) return;
      if (codec && !/\bavc[13]\./.test(codec[1])) return;
      var next = index + 1;
      while (next < lines.length && (!lines[next].trim() || lines[next].charAt(0) === '#')) next++;
      var url = next < lines.length ? mediaUrl(lines[next].trim(), base) : null;
      if (!url || url === base) return;
      // Prefer 720p, then lower resolutions. Avoid a 1440p rendition on a 1080p TV.
      var rank = height === null ? 20000 : height <= 720 ? 720 - height : 10000 + height - 720;
      variants.push({ url: url, rank: rank, separateAudio: /(?:[:,])AUDIO=/.test(line) });
    });
    variants.sort(function (a, b) { return a.rank - b.rank; });
    return variants[0] || null;
  }
  function playableMedia(url, playlist, ctx) {
    if (!clearPlaylist(playlist)) return Promise.reject(new Error('TRT no devolvió una lista HLS pública sin protección'));
    var master = /^#EXT-X-STREAM-INF:/m.test(playlist);
    var variant = master ? selectVariant(playlist, url) : null;
    if (master && !variant) return Promise.reject(new Error('TRT no publicó una variante compatible'));
    var selected = variant ? variant.url : url;
    return (variant ? ctx.request(selected, 'text') : Promise.resolve(playlist)).then(function (media) {
      if (!clearPlaylist(media) || /^#EXT-X-STREAM-INF:/m.test(media)) throw new Error('TRT no devolvió una lista de segmentos pública');
      var segment = String(media || '').split(/\r?\n/).find(function (line) { return line.trim() && line.charAt(0) !== '#'; });
      var segmentUrl = segment && mediaUrl(segment.trim(), selected);
      if (!segmentUrl || !/^#EXTINF:/m.test(media)) throw new Error('TRT no publicó segmentos reproducibles');
      return ctx.request(segmentUrl, 'probe').then(function (probe) {
        var type = String(probe && probe.contentType || '').toLowerCase();
        if (/text\/html|application\/(?:json|[^;]*mpegurl)|text\/plain/.test(type)) throw new Error('TRT no permitió acceder al vídeo');
        // A separate audio group needs the original master to preserve sound.
        return { provider: 'hls', url: variant && variant.separateAudio ? url : selected };
      });
    });
  }
  function resolve(route, ctx) {
    var slug = route && route.channelSlug;
    var known = slug === 'trtsporyildiz' ? source('tr-trt-yildiz') : slug === 'trtspor' ? source('tr-trt-spor') : null;
    var web = { provider: 'web', url: known ? known.url : route && officialWebUrl(route.url) ? route.url : FIXTURES_URL };
    if (!route || route.provider !== 'trt' || route.requiresLogin || !known) return Promise.resolve(web);
    return ctx.request(known.url, 'text').then(function (html) {
      var data = scriptData(html, '__NEXT_DATA__');
      var pp = data && data.props && data.props.pageProps;
      if (!pp) return web;
      var channel = pp.liveChannel && pp.liveChannel.slug === slug ? pp.liveChannel : (pp.liveChannels || []).find(function (c) { return c.slug === slug; });
      if (!channel || channel.loginStatus !== 'watched_before_login') return web;
      var media = (channel.media || []).filter(function (m) { return m.type === 'hls' && m.drmSchema === 'clear' && officialMediaUrl(m.url); });
      media.sort(function (a, b) { return Number(a.priority === undefined ? 999 : a.priority) - Number(b.priority === undefined ? 999 : b.priority); });
      media = media.slice(0, 2);
      function attempt(index) {
        if (index >= media.length) return Promise.resolve(web);
        var url = media[index].url;
        return ctx.request(url, 'text').then(function (playlist) {
          return playableMedia(url, playlist, ctx);
        }).catch(function () { return attempt(index + 1); });
      }
      return attempt(0);
    }).catch(function () { return web; });
  }
  return { load: load, parseFixtures: parseFixtures, fixturesUrl: FIXTURES_URL, parseYouTube: parseYouTube, resolve: resolve };
}));
