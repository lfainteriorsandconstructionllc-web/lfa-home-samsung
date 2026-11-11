/* Fondo completo según la app, sin DOM ni APIs de Tizen. ES5 / UMD. */
(function (root, factory) {
  var theme = factory();
  if (typeof module === "object" && module.exports) module.exports = theme;
  if (root) root.HomeTheme = theme;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  var HEX = /^#[0-9a-f]{6}$/i;
  var INTENSITIES = ["soft", "normal", "vivid"];
  var WHITE = "#ffffff", MUTED = "#f6f8fc", NEUTRAL = "#173457";
  var MIN_CONTRAST = 4.5;
  /* Los tres colores se ordenan inicio, centro y final. Las marcas de la
     maqueta aprobada conservan sus tonos, incluidos logos negros/blancos. */
  var BRANDS = [
    { key: "netflix", re: /^netflix$/, colors: ["#bd253c", "#a73343", "#752f66"] },
    { key: "youtube", re: /^youtube(?: tv| kids)?$/, colors: ["#c13e31", "#ac3644", "#8a305e"] },
    { key: "prime", re: /^(?:amazon )?prime video$/, colors: ["#126db5", "#2468a6", "#474aa2"] },
    { key: "disney", re: /^disney\+?$/, colors: ["#146f8e", "#2f699f", "#6251ab"] },
    { key: "max", re: /^(?:hbo max|max)$/, colors: ["#8552c3", "#6a43a6", "#533888"] },
    { key: "jellyfin", re: /^jellyfin$/, colors: ["#963d9c", "#6652ab", "#286fa3"] },
    { key: "appletv", re: /^apple tv(?:\+)?$/, colors: ["#5c587b", "#4e587c", "#384d75"] },
    { key: "spotify", re: /^spotify(?:\b.*)?$/, colors: ["#167d45", "#26764f", "#235b6c"] },
    { key: "plex", re: /^plex$/, colors: ["#8a651e", "#8c4b39", "#61476f"] },
    { key: "rakuten", re: /^rakuten(?: tv)?$/, colors: ["#b5264e", "#963b60", "#634d8b"] },
    { key: "movistar", re: /^movistar(?:\+|plus)?$/, colors: ["#08788d", "#256d9b", "#405894"] },
    { key: "atres", re: /^atresplayer$/, colors: ["#b23e36", "#974b53", "#694e7b"] },
    { key: "twitch", re: /^twitch$/, colors: ["#8150bb", "#70449e", "#4b4797"] },
    { key: "tvplus", re: /^samsung tv plus$/, colors: ["#3b58b6", "#5358a9", "#7e438b"] },
    { key: "volleyrusia", re: /^volley rusia$/, colors: ["#315fb1", "#6d4895", "#963c63"] },
    { key: "volleyturquia", re: /^volley turquia$/, colors: ["#bb293e", "#a03a58", "#773e76"] },
    { key: "latina", re: /^(?:latina|latina tv)$/, colors: ["#94680e", "#a33952", "#673b84"] },
    { key: "vbtv", re: /^(?:vbtv|volleyball world)$/, colors: ["#b64622", "#8e3b5c", "#3a4999"] },
    { key: "espn", re: /^espn(?:\+)?$/, colors: ["#bd262d", "#9a2f45", "#5f3668"] },
    { key: "paramount", re: /^paramount\+?$/, colors: ["#0b62c2", "#2358ad", "#3f4799"] },
    { key: "peacock", re: /^peacock$/, colors: ["#1d7758", "#3b6599", "#78449a"] },
    { key: "hulu", re: /^hulu$/, colors: ["#12794e", "#1b6d67", "#2a5585"] },
    { key: "pluto", re: /^pluto(?: tv)?$/, colors: ["#8a6612", "#7b4c63", "#4c4394"] },
    { key: "tubi", re: /^tubi(?: tv)?$/, colors: ["#b64628", "#9d3464", "#5c3896"] },
    { key: "roku", re: /^(?:the )?roku(?: channel)?$/, colors: ["#6f3fb8", "#5d43a3", "#3e4b91"] },
    { key: "instagram", re: /^instagram(?:\b.*)?$/, colors: ["#b63068", "#a64438", "#6d3da6"] },
    { key: "tiktok", re: /^tiktok(?:\b.*)?$/, colors: ["#127483", "#5e4689", "#ac2b59"] },
    { key: "applemusic", re: /^apple music$/, colors: ["#bb2b4f", "#9c3764", "#6b3e87"] },
    { key: "amazonmusic", re: /^amazon music$/, colors: ["#0e758a", "#22669c", "#494d9c"] },
    { key: "luna", re: /^amazon luna$/, colors: ["#7b3ec0", "#6145ab", "#3d4d96"] },
    { key: "alexa", re: /(?:^| )amazon alexa$/, colors: ["#0d729a", "#2164a1", "#3d5196"] },
    { key: "xbox", re: /^xbox(?:\b.*)?$/, colors: ["#167939", "#1f6b51", "#265573"] },
    { key: "geforce", re: /^geforce now$/, colors: ["#3c7518", "#2b6c48", "#255773"] },
    { key: "cleanframe", re: /^cleanframe$/, colors: ["#8a6425", "#745138", "#48456e"] },
    { key: "lgchannels", re: /^lg channels$/, colors: ["#b32352", "#903766", "#594587"] },
    { key: "lgstore", re: /^(?:lg content store|apps samsung)$/, colors: ["#a62b5c", "#74438a", "#35589c"] },
    { key: "televen", re: /^televen$/, colors: ["#bb2c34", "#98384e", "#613f78"] },
    { key: "sling", re: /^sling(?: tv)?$/, colors: ["#1468ab", "#3d5ca3", "#855138"] },
    { key: "vidio", re: /^vidio$/, colors: ["#bc283c", "#9b3654", "#633f7d"] },
    { key: "amc", re: /^amc\+?$/, colors: ["#167176", "#286085", "#474c85"] },
    { key: "browser", re: /^(?:internet|browser|samsung internet)$/, colors: ["#2b6bb0", "#3e62a7", "#5b51a3"] }
  ];
  function valid(value) { return typeof value === "string" && HEX.test(value); }
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(values) {
    var result = "#", i, n;
    for (i = 0; i < 3; i++) {
      n = Math.max(0, Math.min(255, Math.round(values[i])));
      result += (n < 16 ? "0" : "") + n.toString(16);
    }
    return result;
  }
  function linear(channel) {
    channel /= 255;
    return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
  }
  function luminance(value) {
    var c = rgb(value);
    return .2126 * linear(c[0]) + .7152 * linear(c[1]) + .0722 * linear(c[2]);
  }
  function contrast(first, second) {
    if (!valid(first) || !valid(second)) return 1;
    var a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }
  function blend(first, second, amount) {
    var a = rgb(first), b = rgb(second);
    return hex([a[0] * (1 - amount) + b[0] * amount, a[1] * (1 - amount) + b[1] * amount, a[2] * (1 - amount) + b[2] * amount]);
  }
  /* Límite por luminancia relativa, no por el promedio RGB de las tarjetas.
     Busca el mayor brillo que conserva el contraste, evitando un fondo
     casi negro y conservando la relación entre canales del color original. */
  function readable(value) {
    if (contrast(value, MUTED) >= MIN_CONTRAST) return value.toLowerCase();
    var c = rgb(value), low = 0, high = 1, best = "#000000", i, amount, next;
    for (i = 0; i < 18; i++) {
      amount = (low + high) / 2;
      next = hex([c[0] * amount, c[1] * amount, c[2] * amount]);
      if (contrast(next, MUTED) >= MIN_CONTRAST) { best = next; low = amount; } else high = amount;
    }
    return best;
  }
  function hsl(value) {
    var c = rgb(value), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, l = (max + min) / 2, h = 0, s = 0;
    if (delta) {
      s = delta / (1 - Math.abs(2 * l - 1));
      h = max === r ? ((g - b) / delta + (g < b ? 6 : 0)) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, values;
    if (h < 60) values = [c, x, 0]; else if (h < 120) values = [x, c, 0]; else if (h < 180) values = [0, c, x];
    else if (h < 240) values = [0, x, c]; else if (h < 300) values = [x, 0, c]; else values = [c, 0, x];
    return hex([(values[0] + m) * 255, (values[1] + m) * 255, (values[2] + m) * 255]);
  }
  function fold(value) {
    return typeof value === "string" ? value.toLowerCase().replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ") : "";
  }
  function normalizeIntensity(value) { return INTENSITIES.indexOf(value) >= 0 ? value : "vivid"; }
  function paletteColors(app, palette) {
    var choices = [], i, candidate, best = null, bestScore = -1, spec, score;
    if (Array.isArray(palette)) for (i = 0; i < Math.min(palette.length, 8); i++) if (valid(palette[i])) choices.push(palette[i]);
    if (app && valid(app.color)) choices.push(app.color);
    for (i = 0; i < choices.length; i++) {
      candidate = choices[i]; spec = hsl(candidate);
      /* Blancos, grises y píxeles casi negros no definen un color de marca. */
      if (spec.s < .16 || spec.l < .04 || spec.l > .96) continue;
      score = spec.s * (1 - Math.abs(spec.l - .48));
      if (score > bestScore) { best = spec; bestScore = score; }
    }
    if (!best) return ["#286ba8", "#3d61a0", "#59529c"];
    var saturation = Math.max(.48, Math.min(.8, best.s));
    return [fromHsl(best.h, saturation, .43), fromHsl(best.h + 12, saturation * .86, .40), fromHsl(best.h + 32, saturation * .72, .37)];
  }
  function themeFor(app, palette, intensity) {
    intensity = normalizeIntensity(intensity);
    var name = fold(app && app.name), brand = null, colors, i;
    for (i = 0; i < BRANDS.length; i++) if (BRANDS[i].re.test(name)) { brand = BRANDS[i]; break; }
    colors = brand ? brand.colors.slice() : paletteColors(app, palette);
    var soften = intensity === "soft" ? .46 : intensity === "normal" ? .20 : 0, least = Infinity;
    for (i = 0; i < colors.length; i++) {
      colors[i] = readable(soften ? blend(colors[i], NEUTRAL, soften) : colors[i]);
      least = Math.min(least, contrast(colors[i], WHITE));
    }
    var surface = blend(colors[1], "#101c30", .30);
    return { key: (brand ? brand.key : "icon") + ":" + intensity + ":" + colors.join(","), colors: colors,
      background: "linear-gradient(135deg," + colors[0] + " 0%," + colors[1] + " 48%," + colors[2] + " 100%)",
      surface: surface, text: WHITE, muted: MUTED, accent: colors[0], contrast: least };
  }
  /* Completa los márgenes de una imagen proporcionada con sus propios bordes. */
  function artworkBackdrop(pixels, relativeRatio) {
    if (!pixels || !isFinite(relativeRatio) || relativeRatio <= 0) return null;
    var size = Math.sqrt(pixels.length / 4);
    if (size < 2 || size !== Math.floor(size)) return null;
    var end = size - 1;
    function colorAt(x, y) {
      var p = (y * size + x) * 4;
      return pixels[p + 3] >= 230 ? [pixels[p], pixels[p + 1], pixels[p + 2]] : null;
    }
    var corners = [colorAt(0, 0), colorAt(end, 0), colorAt(0, end), colorAt(end, end)];
    if (corners.some(function (color) { return !color; })) return null;
    if (corners.every(function (color) {
      return color.every(function (value, channel) { return Math.abs(value - corners[0][channel]) <= 20; });
    })) return { color: hex(corners[0]) };

    var side = relativeRatio < 1, span = side ? relativeRatio : 1 / relativeRatio;
    var band = Math.min(50, Math.round((1 - span) * 5000) / 100 + .25) + "%";
    var stops = [[], []], i, first, last;
    for (i = 0; i < size; i++) {
      first = side ? colorAt(0, i) : colorAt(i, 0);
      last = side ? colorAt(end, i) : colorAt(i, end);
      if (!first || !last) return null;
      stops[0].push(hex(first));
      stops[1].push(hex(last));
    }
    var direction = side ? "to bottom" : "to right";
    var dimensions = side ? band + " 100%" : "100% " + band;
    return {
      image: "linear-gradient(" + direction + "," + stops[0].join(",") + "),linear-gradient(" + direction + "," + stops[1].join(",") + ")",
      size: dimensions + "," + dimensions,
      position: side ? "left top,right top" : "left top,left bottom"
    };
  }
  function paleArtworkEdges(pixels) {
    if (!pixels) return false;
    var size = Math.sqrt(pixels.length / 4), pale = 0, opaque = 0, x, y, i, low, high;
    if (size < 2 || size !== Math.floor(size)) return false;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      if (x !== 0 && y !== 0 && x !== size - 1 && y !== size - 1) continue;
      i = (y * size + x) * 4;
      if (pixels[i + 3] < 220) continue;
      opaque++;
      low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (low >= 220 && high - low <= 27) pale++;
    }
    return opaque >= size && pale >= opaque * .65;
  }
  return { themeFor: themeFor, contrast: contrast, normalizeIntensity: normalizeIntensity, artworkBackdrop: artworkBackdrop, paleArtworkEdges: paleArtworkEdges, INTENSITIES: INTENSITIES.slice() };
});
