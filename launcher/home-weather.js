/* Tiempo local: Open-Meteo, ajustes compartidos y actualización cancelable. ES5 / UMD. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HomeWeather = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  var INTERVAL = 15 * 60 * 1000, QUERY_LIMIT = 56;
  function clean(value, max) {
    return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
  }
  function numeric(value, min, max) {
    return typeof value === "number" && isFinite(value) && value >= min && value <= max;
  }
  function city(value) {
    if (!value || !numeric(value.lat, -90, 90) || !numeric(value.lon, -180, 180)) return null;
    var name = clean(value.name, 60);
    return name ? { name: name, region: clean(value.region, 120), lat: value.lat, lon: value.lon } : null;
  }
  function settings(value) {
    value = value || {};
    var place = city(value.city), mode = value.mode;
    if (mode !== "off" && mode !== "auto" && mode !== "city") mode = "setup";
    if (mode === "city" && !place) mode = "setup";
    return { mode: mode, unit: value.unit === "F" ? "F" : "C", city: place };
  }
  function query(value) { return clean(value, QUERY_LIMIT); }
  function searchResults(value) {
    var list = value && value.results, result = [], seen = Object.create(null);
    if (!Array.isArray(list)) return result;
    list.slice(0, 10).forEach(function (row) {
      if (!row) return;
      var region = [row.admin1, row.country].filter(function (part, index, parts) {
        return typeof part === "string" && part !== row.name && parts.indexOf(part) === index;
      }).join(", ");
      var place = city({ name: row.name, region: region, lat: row.latitude, lon: row.longitude });
      if (!place) return;
      var key = place.name + "|" + place.region;
      if (!seen[key]) { seen[key] = true; result.push(place); }
    });
    return result;
  }
  function getJSON(environment, url, done) {
    if (environment && environment.HomePlatform && typeof environment.HomePlatform.request === "function") {
      return environment.HomePlatform.request(url, function (error, data) {
        done(error ? new Error("Servicio del tiempo no disponible.") : null, data);
      }, "json");
    }
    var xhr, active = true;
    function finish(error, value) { if (active) { active = false; done(error, value); } }
    try {
      xhr = new environment.XMLHttpRequest();
      xhr.open("GET", url);
      xhr.timeout = 9000;
      xhr.onload = function () {
        if (xhr.status !== 200) { finish(new Error("Servicio del tiempo no disponible.")); return; }
        var data;
        try { data = JSON.parse(xhr.responseText); }
        catch (error) { finish(error); return; }
        finish(null, data);
      };
      xhr.onerror = xhr.ontimeout = function () { finish(new Error("Servicio del tiempo no disponible.")); };
      xhr.send();
    } catch (error) { finish(error); }
    return function () { active = false; if (xhr) xhr.abort(); };
  }
  function search(environment, value, done) {
    return getJSON(environment, "https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name=" + encodeURIComponent(query(value)),
      function (error, response) { done(error, searchResults(response)); });
  }
  function forecastURL(point) {
    return "https://api.open-meteo.com/v1/forecast?latitude=" + point.lat + "&longitude=" + point.lon +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto";
  }
  function condition(code, day) {
    if (code === 0) return { icon: day ? "sun" : "moon", label: "Despejado" };
    if (code === 1 || code === 2) return { icon: day ? "partly" : "night-cloud", label: "Parcialmente nublado" };
    if (code === 3) return { icon: "cloud", label: "Nublado" };
    if (code === 45 || code === 48) return { icon: "fog", label: "Niebla" };
    if (code >= 95) return { icon: "storm", label: "Tormenta" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "snow", label: "Nieve" };
    if (code >= 51) return { icon: "rain", label: code <= 57 ? "Llovizna" : "Lluvia" };
    return { icon: "cloud", label: "Condición variable" };
  }
  function forecast(value) {
    var current = value && value.current, daily = value && value.daily;
    if (!current || !numeric(current.temperature_2m, -100, 100) || !numeric(current.weather_code, 0, 99)) return null;
    var result = condition(current.weather_code, current.is_day !== 0);
    var max = daily && daily.temperature_2m_max && daily.temperature_2m_max[0];
    var min = daily && daily.temperature_2m_min && daily.temperature_2m_min[0];
    result.temp = current.temperature_2m;
    result.max = numeric(max, -100, 100) ? max : null;
    result.min = numeric(min, -100, 100) ? min : null;
    return result;
  }
  function temp(value, unit) {
    return typeof value === "number" ? Math.round(unit === "F" ? value * 1.8 + 32 : value) + "°" : "";
  }
  var SUN = '<g fill="none" stroke="#ffd17a" stroke-width="2.8"><circle cx="32" cy="32" r="12" fill="#ffb850" fill-opacity=".35"/><path d="M32 7v7m0 36v7M7 32h7m36 0h7M14.5 14.5l5 5m25 25 5 5m0-35-5 5m-25 25-5 5"/></g>';
  var MOON = '<path d="M43 44a17 17 0 0 1-20-23 18 18 0 1 0 20 23Z" fill="#d8dcff" stroke="#f4efff" stroke-width="2.5"/><path d="M42 14v8m-4-4h8m5 5v6m-3-3h6" stroke="#e3e8ff" stroke-width="2"/>';
  var CLOUD = '<path d="M18 42a10 10 0 1 1 .6-20 14 14 0 0 1 26.7 3 8.5 8.5 0 1 1 1 17Z" fill="#dbeaff" fill-opacity=".92" stroke="#f1f7ff" stroke-width="2.3"/>';
  function icon(kind) {
    var art = CLOUD;
    if (kind === "sun") art = SUN;
    if (kind === "moon") art = MOON;
    if (kind === "partly") art = '<g transform="translate(-5 -9) scale(.75)">' + SUN + '</g><g transform="translate(5 7)">' + CLOUD + '</g>';
    if (kind === "night-cloud") art = '<g transform="translate(7 -9) scale(.85)">' + MOON + '</g><g transform="translate(-3 9)">' + CLOUD + '</g>';
    if (kind === "rain") art += '<path d="m24 48-3 7m13-7-3 7m13-7-3 7" stroke="#76dcff" stroke-width="3"/>';
    if (kind === "snow") art += '<path d="M22 49v8m-4-4h8m7-4v8m-4-4h8m7-4v8m-4-4h8" stroke="#a9eeff" stroke-width="2"/>';
    if (kind === "storm") art += '<path d="m34 39-9 12h8l-2 10 12-15h-8l3-7Z" fill="#ffdc79" stroke="#ffeaaf" stroke-width="1.5"/>';
    if (kind === "fog") art += '<path d="M14 48h33m-26 7h34" stroke="#a9c8e5" stroke-width="2.5"/>';
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">' + art + '</svg>';
  }
  function approximate(position) {
    var coords = position && position.coords;
    if (!coords || !numeric(coords.latitude, -90, 90) || !numeric(coords.longitude, -180, 180)) return null;
    return { name: "Ubicación aproximada", lat: Math.round(coords.latitude * 10) / 10, lon: Math.round(coords.longitude * 10) / 10 };
  }
  function create(environment, changed) {
    var options = settings(), position = null, data = null, request = null, attempt = 0;
    var state = "setup", detail = "", locationToken = 0, locationTimer = 0, locating = false, destroyed = false;
    function paint(status, message) {
      state = status;
      detail = message || "";
      changed({ status: state, detail: detail, data: data, unit: options.unit, place: position && position.name });
    }
    function stop() {
      locationToken++;
      clearTimeout(locationTimer);
      locating = false;
      if (request && request.cancel) request.cancel();
      request = null;
    }
    function load() {
      attempt = Date.now();
      var pending = { cancel: null };
      request = pending;
      paint(data ? "ready" : "loading");
      pending.cancel = getJSON(environment, forecastURL(position), function (error, response) {
        if (request !== pending || destroyed) return;
        request = null;
        var next = !error && forecast(response);
        if (next) { data = next; paint("ready"); }
        else paint(data ? "stale" : "error", "Pronóstico sin conexión");
      });
    }
    function locate() {
      var geolocation = environment.navigator && environment.navigator.geolocation, token = ++locationToken;
      locating = true;
      paint("locating");
      function failed() {
        if (!locating || token !== locationToken || destroyed) return;
        clearTimeout(locationTimer); locating = false;
        paint("unavailable", "Ubicación no disponible · elige una ciudad");
      }
      if (!geolocation || typeof geolocation.getCurrentPosition !== "function") { failed(); return; }
      locationTimer = setTimeout(failed, 8000);
      try {
        geolocation.getCurrentPosition(function (value) {
          if (!locating || token !== locationToken || destroyed) return;
          position = approximate(value);
          if (!position) { failed(); return; }
          clearTimeout(locationTimer); locating = false; load();
        }, failed, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 7000 });
      } catch (error) { failed(); }
    }
    function refresh(force) {
      if (destroyed || (options.mode !== "city" && options.mode !== "auto")) return;
      if (request || locating) return;
      if (options.mode === "auto" && !position) {
        if (state !== "unavailable" || force) locate();
      } else if (force || !attempt || Date.now() - attempt >= INTERVAL) load();
    }
    function configure(value) {
      if (destroyed) return;
      var next = settings(value), oldUnit = options.unit;
      var changedLocation = next.mode !== options.mode || (next.mode === "city" && JSON.stringify(next.city) !== JSON.stringify(options.city));
      options = next;
      if (changedLocation) {
        stop();
        data = null; attempt = 0; position = options.mode === "city" ? options.city : null;
        paint(options.mode === "auto" ? "locating" : options.mode === "city" ? "loading" : options.mode);
      } else if (options.unit !== oldUnit) paint(state, detail);
      refresh(false);
    }
    return { configure: configure, refresh: refresh, destroy: function () { destroyed = true; stop(); } };
  }
  return { QUERY_LIMIT: QUERY_LIMIT, settings: settings, city: city, query: query, searchResults: searchResults, search: search, forecast: forecast, condition: condition, temp: temp, icon: icon, approximate: approximate, create: create };
});
