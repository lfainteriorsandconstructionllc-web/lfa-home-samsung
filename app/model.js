(function (root) {
  'use strict';
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (targetLength, padString) {
      var str = String(this);
      targetLength = targetLength >> 0;
      padString = String(padString !== undefined ? padString : ' ');
      if (str.length >= targetLength || !padString.length) return str;
      targetLength = targetLength - str.length;
      while (targetLength > padString.length) padString += padString;
      return padString.slice(0, targetLength) + str;
    };
  }
  var CHANNEL_ID = 'cc1b56aa4955a144f324ad58998513bb';
  var teams = [
    [/Заречье[-– ]Одинцово/gi, 'Zarechie Odintsovo'], [/Динамо[-– ]Ак Барс/gi, 'Dinamo Ak Bars'],
    [/Уралочка[-– ]НТМК/gi, 'Uralochka'], [/Ленинградка/gi, 'Leningradka'], [/Локомотив/gi, 'Lokomotiv'],
    [/Тулица/gi, 'Tulitsa'], [/Протон/gi, 'Proton'], [/Минчанка/gi, 'Minchanka'],
    [/Корабелка/gi, 'Korabelka'], [/Динамо/gi, 'Dinamo'], [/Краснодар/gi, 'Krasnodar'],
    [/Москва/gi, 'Moscú'], [/Енисей/gi, 'Yenisey'], [/Омичка/gi, 'Omichka'], [/Спарта/gi, 'Sparta']
  ];
  function timestamp(value) {
    if (typeof value !== 'string' || !value) return NaN;
    var s = value.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += '+03:00';
    return Date.parse(s);
  }
  function isWomen(title) {
    var t = String(title || '').toLowerCase();
    if (/мужчин|юнош|\bmen\b|зенит|белогор|кузбасс|газпром.югра|ярославич|мгту|оренбуржье|динамо.ло(?:[^а-я]|$)/.test(t)) return false;
    return /женщ|девуш|women|female|уралочка|заречье|ленинградка|тулица|протон|минчанка|корабелка|омичка|динамо.ак.барс/.test(t);
  }
  function parseId(url) {
    try {
      var u = new URL(String(url).trim());
      if (u.protocol !== 'https:' || !/^(www\.)?rutube\.ru$/.test(u.hostname) || u.username || u.password) return null;
      var match = u.pathname.match(/^\/(?:video|play\/embed|live\/video)\/([a-f0-9]{32})\/?$/i);
      if (match && !u.search) return match[1].toLowerCase();
      return null;
    } catch (_) { return null; }
  }
  function translate(title) {
    var result = String(title || '').split('|')[0].trim();
    teams.forEach(function (pair) { result = result.replace(pair[0], pair[1]); });
    return result || 'Partido de voleibol';
  }
  function normalize(v, now) {
    if (!v || !/^[a-f0-9]{32}$/i.test(v.id || '')) return null;
    now = now || Date.now();
    var start = timestamp(v.publication_ts);
    var status = 'recent';
    if (v.is_livestream === true && v.is_on_air === true) status = 'live';
    else if (v.is_livestream === true && start > now) status = 'upcoming';
    return {
      id: v.id, title: String(v.title || 'Partido de voleibol'), label: translate(v.title),
      thumbnail: /^https:\/\//.test(v.thumbnail_url || '') ? v.thumbnail_url : '',
      status: status, start: isNaN(start) ? null : start, women: isWomen(v.title),
      source: v.author && v.author.name || 'RUTUBE',
      highlight: /основные моменты|хайлайт|highlights/i.test(v.title || ''),
      continuous: v.id === CHANNEL_ID, kind: 'video',
      routes: [{ id: 'rutube-' + v.id, label: 'Ver en RUTUBE', provider: 'rutube', videoId: v.id, url: 'https://rutube.ru/video/' + v.id + '/' }]
    };
  }
  function selectStream(options) {
    if (!options || !options.acl_access || options.acl_access.allowed !== true || options.has_video !== true || options.drm_token || options.purchase_ttl) return null;
    var live = options.live_streams && options.live_streams.hls;
    var url = options.video_balancer && options.video_balancer.m3u8 || (Array.isArray(live) && live[0] && live[0].url);
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      if (!/(^|\.)(rutube\.ru|rtbcdn\.ru)$/.test(parsed.hostname)) return null;
      return parsed.href;
    } catch (_) { return null; }
  }
  function parseYouTubeId(value) {
    try {
      var u = new URL(String(value).trim());
      if (u.protocol !== 'https:' || u.username || u.password) return null;
      var id;
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
      else if (/^(www\.|m\.)?youtube\.com$/.test(u.hostname)) {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else { var m = u.pathname.match(/^\/(?:live|embed)\/([A-Za-z0-9_-]{11})\/?$/); id = m && m[1]; }
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    } catch (_) { return null; }
  }
  function savedItem(item) {
    var result = {};
    ['id', 'title', 'label', 'thumbnail', 'start', 'source', 'women', 'highlight', 'continuous', 'kind', 'score', 'gameId'].forEach(function (key) { if (item[key] !== undefined) result[key] = item[key]; });
    result.status = item.kind === 'match' ? 'schedule' : 'recent';
    result.routes = (item.routes || []).filter(function (r) { return r.provider !== 'hls'; }).map(function (route) {
      var saved = {}; ['id', 'label', 'provider', 'url', 'videoId', 'channelId', 'channelSlug', 'requiresLogin', 'note'].forEach(function (key) { if (route[key] !== undefined) saved[key] = route[key]; }); return saved;
    });
    return result;
  }
  function tabItems(items, tab, favorites, now) {
    var women = items.filter(function (v) { return v.women && !v.continuous; });
    if (tab === 'favorites') return (favorites || []).map(function (saved) { return items.find(function (v) { return v.id === saved.id; }) || savedItem(saved); });
    var list = women.filter(function (v) { return tab === 'agenda' ? v.kind === 'match' : v.status === tab; });
    list.sort(function (a, b) {
      if (tab === 'agenda') return Math.abs((a.start || now) - now) - Math.abs((b.start || now) - now);
      if (tab === 'upcoming') return (a.start || Infinity) - (b.start || Infinity);
      return (b.start || 0) - (a.start || 0);
    });
    return list;
  }
  function videoItems(items) {
    return (items || []).reduce(function (result, item) {
      if (!item || (item.kind && item.kind !== 'video' && item.kind !== 'channel')) return result;
      var routes = Array.isArray(item.routes) ? item.routes : [];
      // Favorites saved before providers existed have only the RUTUBE video ID.
      if (!routes.length && !item.kind && /^[a-f0-9]{32}$/i.test(item.id || '')) routes = [{ provider: 'rutube', videoId: item.id, label: 'Ver en RUTUBE', url: 'https://rutube.ru/video/' + item.id + '/' }];
      routes = routes.filter(function (route) {
        return route && !route.requiresLogin && (route.provider === 'rutube' && /^[a-f0-9]{32}$/i.test(route.videoId || '') || route.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(route.videoId || '') || route.provider === 'trt' && route.playable === true && /^(trtspor|trtsporyildiz)$/.test(route.channelSlug || ''));
      });
      if (routes.length) result.push(Object.assign({}, item, { kind: item.kind || 'video', routes: routes }));
      return result;
    }, []);
  }
  function partitionSources(sources, availableIds) {
    var result = { information: [], channels: [] };
    (sources || []).forEach(function (source) {
      if (!source) return;
      var route = Object.assign({}, source);
      if (route.provider === 'trt') route.playable = (availableIds || []).indexOf(source.id) >= 0;
      var channel = videoItems([{ id: source.id, title: source.name || source.label, label: source.name || source.label, description: source.description, source: source.name, kind: 'channel', continuous: true, women: false, routes: [route] }])[0];
      if (channel) { result.channels.push(channel); return; }
      // A directory, schedule or restricted player is informational, not a video.
      result.information.push(Object.assign({}, source, { provider: 'web', informationOnly: true, label: 'Abrir sitio oficial', note: 'Página de información o fuente sin reproducción directa confirmada en esta app.' }));
    });
    return result;
  }
  function catalogItems(items, tab, favorites, now, upcomingVideosOnly) {
    var list = tabItems(items, tab, favorites, now);
    if (tab === 'recent' || tab === 'live' || (tab === 'upcoming' && upcomingVideosOnly)) return videoItems(list);
    return list;
  }
  var api = { CHANNEL_ID: CHANNEL_ID, isWomen: isWomen, parseId: parseId, parseYouTubeId: parseYouTubeId, timestamp: timestamp, normalize: normalize, translate: translate, selectStream: selectStream, savedItem: savedItem, tabItems: tabItems, videoItems: videoItems, partitionSources: partitionSources, catalogItems: catalogItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VolleyModel = api;
}(typeof window === 'undefined' ? globalThis : window));
