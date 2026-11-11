(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VolleyProviders = root.VolleyProviders || {};
  root.VolleyProviders.russia = api;
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var ORIGIN = 'https://volley.ru';
  var FALLBACK_COMPETITION = '01KWET28MC2ZEE11MC1RD41T97';
  var DISCOVERY = ORIGIN + '/calendar?year=-1&sex=0&league=01FVCNYYYGT7BW1NHSSYRC0AJ2';
  var CLUB_BROADCASTS = 'https://vldinamo.ru/broadcasts/?print=1';
  var DAY = 86400000;
  function decode(value) {
    var named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', laquo: '«', raquo: '»', ndash: '–', mdash: '—' };
    return String(value || '').replace(/&#(x[0-9a-f]+|\d+);|&([a-z]+);/gi, function (match, number, name) {
      if (number) { var code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : parseInt(number, 10); return code <= 0x10ffff ? String.fromCodePoint(code) : ''; }
      return named[name.toLowerCase()] || match;
    });
  }
  function text(html) { return decode(String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
  function attr(attrs, name) {
    var match = String(attrs).match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\\\'])([\\s\\S]*?)\\1', 'i'));
    return match ? decode(match[2]) : '';
  }
  function absolute(url, base) { try { return new URL(decode(url), base || ORIGIN).href; } catch (_) { return ''; } }
  function moscow(date, time) {
    var d = String(date || '').match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    var t = String(time || '').match(/\b(\d{1,2}):(\d{2})\b/);
    if (!d || !t) return null;
    var value = Date.parse(d[3] + '-' + d[2] + '-' + d[1] + 'T' + t[1].padStart(2, '0') + ':' + t[2] + ':00+03:00');
    return Number.isFinite(value) ? value : null;
  }
  function teamLabel(team) {
    var value = String(team || '');
    if (/^Динамо\s*\(Москва\)/i.test(value)) return 'Dinamo Moscú';
    if (/^Динамо\s*\(Краснодар\)/i.test(value)) return 'Dinamo Krasnodar';
    var short = value.replace(/\s*\([^)]*\)/g, '').trim();
    var names = { 'Динамо-Ак Барс': 'Dinamo Ak Bars', 'Динамо-Метар': 'Dinamo Metar', 'Уралочка-НТМК': 'Uralochka', 'Заречье-Одинцово': 'Zarechie Odintsovo', 'Локомотив': 'Lokomotiv', 'Ленинградка': 'Leningradka', 'Тулица': 'Tulitsa', 'Корабелка': 'Korabelka', 'Омичка': 'Omichka', 'Енисей': 'Yenisey', 'Минчанка': 'Minchanka', 'Протон': 'Proton' };
    return names[short] || value;
  }
  function matchRoute(id) {
    return { id: 'ru-vfv-route-' + id, label: 'Ver partido en Volley.ru', provider: 'vfv', url: ORIGIN + '/games/' + id, requiresLogin: true, note: 'Reproductor oficial de la Federación. Puede requerir cuenta y la suscripción Premium de Volley.ru.' };
  }
  function discoverCompetition(html) {
    var candidates = [];
    String(html || '').replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, function (_, attrs, body) {
      var classes = attr(attrs, 'class'), href = attr(attrs, 'href'), id = attr(attrs, 'data-competitionid'), content = text(body);
      if (!/(^|\s)vl-table-line(?:\s|$)/.test(classes) || !/^[A-Z0-9]{26}$/.test(id) || !/Женщины/i.test(content) || !/Суперлига/i.test(content) || !/Чемпионат России/i.test(content)) return _;
      var url = absolute(href), base = ORIGIN + '/calendar/' + id;
      if (url !== base && url.indexOf(base + '/') !== 0) return _;
      var year = content.match(/Чемпионат России\s+(\d{4})/i);
      candidates.push({ id: id, url: url, active: /vl-table-line--now/.test(classes) || /Ид[её]т/.test(content), year: year ? Number(year[1]) : 0 });
      return _;
    });
    candidates.sort(function (a, b) { return Number(b.active) - Number(a.active) || b.year - a.year; });
    return candidates[0] || null;
  }
  function parseCalendar(html, now) {
    now = Number.isFinite(now) ? now : Date.now();
    var items = [], seen = {};
    String(html || '').replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi, function (_, attrs, body) {
      if (!/(^|\s)table-game(?:\s|$)/.test(attr(attrs, 'class'))) return _;
      var id = attr(attrs, 'data-id');
      if (!/^[A-Z0-9]{26}$/.test(id) || seen[id]) return _;
      var cells = [], td;
      var re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
      while ((td = re.exec(body))) cells.push(text(td[1]));
      if (cells.length < 8 || !cells[3] || !cells[5]) return _;
      seen[id] = true;
      var start = moscow(cells[0], cells[1]);
      var result = cells[7].match(/^(\d+)\s*:\s*(\d+)/);
      var completed = !!(result && (Number(result[1]) >= 3 || Number(result[2]) >= 3));
      // Results establish completed games; an elapsed scheduled time NEVER establishes a live game.
      var status = completed ? 'recent' : start !== null && start > now ? 'upcoming' : 'schedule';
      items.push({
        id: 'ru-vfv-' + id, gameId: id, title: cells[3] + ' — ' + cells[5], label: teamLabel(cells[3]) + ' — ' + teamLabel(cells[5]),
        home: cells[3], away: cells[5], thumbnail: ORIGIN + '/api/gameimage/' + id, status: status, start: start,
        source: 'Federación Rusa · Volley.ru', women: true, highlight: false, continuous: false, kind: 'match',
        score: result ? result[1] + ':' + result[2] : '', round: cells[2], routes: [matchRoute(id)]
      });
      return _;
    });
    return items;
  }
  function parseGame(html, url) {
    var result = { url: url, title: '', thumbnail: '', requiresLogin: false, routes: [] };
    String(html || '').replace(/<meta\b([^>]*)>/gi, function (_, attrs) {
      var key = attr(attrs, 'property');
      if (key === 'og:title') result.title = attr(attrs, 'content');
      if (key === 'og:image') result.thumbnail = attr(attrs, 'content').replace(/^https:\/\/volley\.ru\/(https:\/\/)/, '$1');
      return _;
    });
    result.requiresLogin = /(?:const|var)\s+__game\s*=\s*\{[^}]*:\s*1\s*\}/.test(String(html || ''));
    String(html || '').replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, function (_, attrs, body) {
      var target = absolute(attr(attrs, 'href'), url);
      if (/^https:\/\/(?:www\.)?volley\.ru\/stream\/[A-Z0-9]{26}\/?$/.test(target)) result.routes.push({ id: 'ru-vfv-stream-' + target.split('/').filter(Boolean).pop(), label: text(body) || 'Reproductor oficial de Volley.ru', provider: 'web', url: target, requiresLogin: result.requiresLogin });
      return _;
    });
    return result;
  }
  function parseClubBroadcasts(html) {
    var months = { января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6, июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12 };
    var fixtures = [];
    String(html || '').replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, function (_, table) {
      var head = table.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i), title = table.match(/<td\b[^>]*colspan=["']3["'][^>]*>([\s\S]*?)<\/td>/i);
      var date = head && text(head[1]).match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})\s*-\s*(\d{1,2}:\d{2})/i);
      if (!date || !months[date[2].toLowerCase()] || !title) return _;
      var names = text(title[1]).replace(/[«»]/g, '').split(/\s+[—–]\s+/);
      if (names.length !== 2) return _;
      var dateString = date[1].padStart(2, '0') + '.' + String(months[date[2].toLowerCase()]).padStart(2, '0') + '.' + date[3];
      var fixture = { home: names[0], away: names[1], start: moscow(dateString, date[4]), routes: [] };
      table.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, function (a, attrs, body) {
        var url = absolute(attr(attrs, 'href'), CLUB_BROADCASTS), parsed;
        try { parsed = new URL(url); } catch (_) { return a; }
        if (parsed.protocol !== 'https:' || !/^(?:www\.)?(?:volley\.ru|matchtv\.ru|rutube\.ru)$/.test(parsed.hostname)) return a;
        if (parsed.hostname === 'volley.ru' && !/^\/(?:stream|games)\/[A-Z0-9]{26}\/?$/.test(parsed.pathname)) return a;
        var label = text(body) || parsed.hostname;
        var r = { id: 'ru-club-' + fixture.routes.length + '-' + fixture.start, label: label, provider: 'web', url: url, note: 'Enlace publicado por el club Dinamo Moscú.' };
        if (parsed.hostname === 'volley.ru') { r.provider = 'vfv'; r.requiresLogin = true; }
        var rutube = parsed.hostname === 'rutube.ru' && parsed.pathname.match(/^\/video\/([a-f0-9]{32})\/?$/i);
        if (rutube) { r.provider = 'rutube'; r.videoId = rutube[1]; r.note += ' Canal continuo de programación mixta; comprueba la emisión actual.'; }
        fixture.routes.push(r); return a;
      });
      if (fixture.routes.length) fixtures.push(fixture);
      return _;
    });
    return fixtures;
  }
  function teamKey(value) { return String(value || '').replace(/\([^)]*\)/g, '').replace(/[^а-яёa-z0-9]/gi, '').toLowerCase(); }
  function sourceList(competitionUrl) {
    return [
      { id: 'ru-vfv', name: 'Volley.ru · Federación Rusa', label: 'Abrir la Federación', provider: 'web', url: competitionUrl || ORIGIN + '/calendar', requiresLogin: true, description: 'Calendario y reproductor oficial de cada partido. Las emisiones pueden requerir cuenta y Premium.' },
      { id: 'ru-matchtv', name: 'Match TV / Match! Igra', label: 'Ver programación oficial', provider: 'web', url: 'https://matchtv.ru/tvguide', description: 'Partidos seleccionados en los canales Match. La disponibilidad depende del canal, la región y el paquete contratado.' },
      { id: 'ru-tricolor-volley', name: 'Tricolor · Canal Voleibol', label: 'Abrir el canal en Tricolor', provider: 'web', url: 'https://kino.tricolor.ru/channels/watch/voleybol/', description: 'Señal del canal Voleibol. Algunos partidos se emiten en diferido; programación femenina y masculina.' },
      { id: 'ru-tricolor-myach', name: 'Tricolor · Myach', label: 'Abrir Myach', provider: 'web', url: 'https://kino.tricolor.ru/channels/watch/myach-hd/', description: 'Otro canal deportivo enlazado por Dinamo Moscú. Comprueba la programación del encuentro.' },
      { id: 'ru-tricolor-sport', name: 'Tricolor · TV Sport', label: 'Abrir TV Sport', provider: 'web', url: 'https://kino.tricolor.ru/channels/watch/tv-sport-hd', description: 'Canal deportivo enlazado por Dinamo Moscú. La programación no es exclusivamente de voleibol.' },
      { id: 'ru-wink', name: 'Wink · Voleibol', label: 'Abrir Wink', provider: 'web', url: 'https://wink.ru/tv/voleybol', requiresLogin: true, description: 'Distribuidor oficial del canal Voleibol; requiere una suscripción compatible.' },
      { id: 'ru-okko', name: 'Okko · Voleibol', label: 'Abrir Okko', provider: 'web', url: 'https://okko.tv/tv_channels/tvchannels_sport/599909920', requiresLogin: true, description: 'Distribuidor listado por la Federación. La disponibilidad depende de la región y del catálogo de Okko.' },
      { id: 'ru-okko-league', name: 'Okko · Superliga femenina', label: 'Abrir Superliga femenina en Okko', provider: 'web', url: 'https://okko.sport/tournament/pari-superliga-26-27-preliminary-stage-women', requiresLogin: true, description: 'Página de la Superliga femenina 2026/27 en Okko. Requiere acceso compatible y disponibilidad en tu región.' },
      { id: 'ru-smotreshka', name: 'Smotreshka · Voleibol HD', label: 'Abrir Smotreshka', provider: 'web', url: 'https://smotreshka.tv/channels/67585b18f639d34826f73d11/about', requiresLogin: true, description: 'Canal Voleibol HD en Smotreshka; requiere acceso del operador o una suscripción compatible.' },
      { id: 'ru-ntvplus', name: 'NTV Plus · Voleibol', label: 'Abrir NTV Plus', provider: 'web', url: 'https://ntvplus.tv/channel/volejbol-672', requiresLogin: true, description: 'Distribuidor oficial del canal Voleibol. Cuenta y paquete de televisión según el servicio.' },
      { id: 'ru-vfv-vk', name: 'Federación · VK Video', label: 'Abrir la comunidad oficial', provider: 'web', url: 'https://vk.com/volleyvfv', description: 'Comunidad oficial de la Federación en VK. Vídeos y enlaces publicados por el emisor.' },
      { id: 'ru-vfv-youtube', name: 'VolleyRu Live · YouTube', label: 'Abrir VolleyRu Live', provider: 'web', url: 'https://www.youtube.com/channel/UC-MwQL22JqgIfoA4lYGEBfQ/streams', description: 'Canal enlazado en el sitio oficial de la Federación. Comprueba qué emisiones están disponibles.' },
      { id: 'ru-dinamo', name: 'Dinamo Moscú · Emisiones', label: 'Ver emisiones del club', provider: 'web', url: 'https://vldinamo.ru/broadcasts/', description: 'Enlaces de cada partido publicados por el club: Federación, RUTUBE, Match y Tricolor.' },
      { id: 'ru-leningradka', name: 'Leningradka · Vídeos', label: 'Abrir vídeos del club', provider: 'web', url: 'https://www.leningradka.spb.ru/video/', description: 'Videoteca oficial del club, con enlaces e integraciones de sus emisores.' }
    ];
  }
  function loadCalendar(ctx, diagnostics) {
    diagnostics = diagnostics || [];
    var now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
    return ctx.request(DISCOVERY, 'text').then(function (html) {
      var discovered = discoverCompetition(html);
      if (!discovered) { diagnostics.push('VFV: no se identificó la temporada; se intenta el calendario 2026/27 conocido.'); return { id: FALLBACK_COMPETITION, url: ORIGIN + '/calendar/' + FALLBACK_COMPETITION + '/current' }; }
      return discovered;
    }).catch(function () { diagnostics.push('VFV: no se pudo comprobar la temporada; se intenta el calendario 2026/27 conocido.'); return { id: FALLBACK_COMPETITION, url: ORIGIN + '/calendar/' + FALLBACK_COMPETITION + '/current' }; }).then(function (season) {
      return ctx.request(season.url, 'text').then(function (html) {
        var items = parseCalendar(html, now);
        if (!items.length) throw new Error('VFV no devolvió un calendario reconocible');
        return { season: season, items: items };
      });
    });
  }
  function load(ctx) {
    var diagnostics = [], now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
    var club = ctx.request(CLUB_BROADCASTS, 'text').then(parseClubBroadcasts).catch(function () { diagnostics.push('Dinamo Moscú: no se pudieron consultar sus enlaces de emisión.'); return []; });
    var calendar = loadCalendar(ctx, diagnostics).catch(function () { diagnostics.push('VFV: no se pudo actualizar el calendario oficial.'); return { season: null, items: [] }; });
    return Promise.all([calendar, club]).then(function (values) {
      var agenda = values[0], broadcasts = values[1];
      var items = agenda.items.filter(function (item) { return item.start === null || (item.start >= now - 3 * DAY && item.start <= now + 30 * DAY); });
      items.sort(function (a, b) { return (a.start === null ? Infinity : a.start) - (b.start === null ? Infinity : b.start); });
      items = items.slice(0, 60);
      items.forEach(function (item) {
        broadcasts.forEach(function (broadcast) {
          if (item.start === null || Math.abs(item.start - broadcast.start) >= DAY || teamKey(item.home) !== teamKey(broadcast.home) || teamKey(item.away) !== teamKey(broadcast.away)) return;
          broadcast.routes.forEach(function (r) { if (!item.routes.some(function (old) { return old.url === r.url; })) item.routes.push(r); });
        });
      });
      return { items: items, sources: sourceList(agenda.season && agenda.season.url), diagnostics: diagnostics };
    });
  }
  function resolve(route, ctx) {
    var url = String(route && route.url || '');
    if (!/^https:\/\/(?:www\.)?volley\.ru\/(?:games|stream)\/[A-Z0-9]{26}\/?$/.test(url)) return Promise.reject(new Error('Enlace de Volley.ru no válido'));
    // Keep the official authenticated player intact. Never decode its obfuscated player
    // configuration or return a protected HLS URL from this provider.
    return Promise.resolve({ provider: 'web', url: url, requiresLogin: true, note: 'Abre el reproductor oficial de Volley.ru; puede requerir cuenta y Premium.' });
  }
  return { load: load, loadCalendar: loadCalendar, resolve: resolve, parseCalendar: parseCalendar, parseGame: parseGame, parseClubBroadcasts: parseClubBroadcasts, discoverCompetition: discoverCompetition, sources: sourceList, discoveryUrl: DISCOVERY };
}));
