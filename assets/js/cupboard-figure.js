/*!
 * cupboard-figure.js: live isometric figure of the Expedit invertebrate cupboard.
 *
 * Embed:  <div data-cupboard-figure data-src="/assets/data/cupboard.json"></div>
 *         <script src="/assets/js/cupboard-figure.js" defer></script>
 *
 * Stage 1: the whole-cupboard overview. Everything that can change (parts, residents,
 * the ThingSpeak field mapping, the LED timer, labels) lives in cupboard.json; this
 * file only knows how to draw each part *kind* and how to animate each *effect*.
 * Structure and how-to: assets/js/FIGURE_NOTES.md.
 *
 * Read-only: the only network calls are the config JSON and ThingSpeak's public
 * feeds/last.json. Nothing here talks to the device.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var RAD = Math.PI / 180;
  var instanceCount = 0;

  // ----------------------------------------------------------------- small utils

  function r2(n) { return Math.round(n * 100) / 100; }
  function r4(n) { return Math.round(n * 10000) / 10000; }

  function hexRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbHex(c) {
    return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join('');
  }
  // mix(hex, '#000', .25) darkens by 25 %, mix(hex, '#fff', .15) lightens by 15 %.
  function mix(a, b, t) {
    var x = hexRgb(a), y = hexRgb(b);
    return rgbHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function tones(hex) { return { front: hex, right: mix(hex, '#000000', 0.28), top: mix(hex, '#ffffff', 0.14) }; }

  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
  function safeId(id) { return typeof id === 'string' && SAFE_ID.test(id); }

  function el(tag, attrs, parent) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(n, s) { n.textContent = s == null ? '' : String(s); return n; }

  // -------------------------------------------------------------------- camera
  // World: x to the right, y from the front into the cupboard, z up, in cm.
  // Orthographic view from the front-right, a little above.

  function camera(azimuth, elevation) {
    var c = Math.cos(azimuth * RAD), s = Math.sin(azimuth * RAD);
    var cp = Math.cos(elevation * RAD), sp = Math.sin(elevation * RAD);
    return {
      c: c, s: s, cp: cp, sp: sp,
      p: function (x, y, z) { return [x * c + y * s, -z * cp + (x * s - y * c) * sp]; },
      // Larger = nearer the viewer.
      depth: function (x, y, z) { return (x * s - y * c) * cp + z * sp; },
      toward: [s * cp, -c * cp, sp]
    };
  }

  // A frame is the camera shifted to a cube's inner corner (front-left-bottom).
  function frame(cam, ox, oy, oz) {
    var G = { cam: cam, R: cam.s >= 0 };
    // The camera sees +x faces when it looks from the right, -x faces from the left.
    // side(x0, x1): the x-plane of an object spanning x0..x1 that faces the viewer.
    G.side = function (x0, x1) { return G.R ? x1 : x0; };
    G.far = function (x0, x1) { return G.R ? x0 : x1; };
    G.P = function (x, y, z) { return cam.p(x + ox, y + oy, z + oz); };
    G.depth = function (x, y, z) { return cam.depth(x + ox, y + oy, z + oz); };
    G.d = function (pts, open) {
      var out = '';
      for (var i = 0; i < pts.length; i++) {
        var q = G.P(pts[i][0], pts[i][1], pts[i][2]);
        out += (i ? 'L' : 'M') + r2(q[0]) + ' ' + r2(q[1]);
      }
      return open ? out : out + 'Z';
    };
    G.rectX = function (x0, x1, y, z0, z1) { return G.d([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]); };
    G.rectY = function (x, y0, y1, z0, z1) { return G.d([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]); };
    G.rectZ = function (x0, x1, y0, y1, z) { return G.d([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]); };
    // Affine map of a flat local 2D system (a, b) onto a world plane: o + a*u + b*v.
    G.plane = function (o, u, v) {
      var a = G.P(o[0], o[1], o[2]), pu = cam.p(u[0], u[1], u[2]), pv = cam.p(v[0], v[1], v[2]);
      return 'matrix(' + r4(pu[0]) + ' ' + r4(pu[1]) + ' ' + r4(pv[0]) + ' ' + r4(pv[1]) + ' ' + r2(a[0]) + ' ' + r2(a[1]) + ')';
    };
    G.frontUp = function (x, y, z) { return G.plane([x, y, z], [1, 0, 0], [0, 0, 1]); };  // b points up
    G.frontDown = function (x, y, z) { return G.plane([x, y, z], [1, 0, 0], [0, 0, -1]); }; // b points down (text)
    G.floor = function (x, y, z) { return G.plane([x, y, z], [1, 0, 0], [0, 1, 0]); };
    return G;
  }

  function path(d, fill, extra) {
    return '<path d="' + d + '"' + (fill ? ' fill="' + fill + '"' : '') + (extra ? ' ' + extra : '') + '/>';
  }

  // A solid box with three visible faces (front, right, top) and an outline.
  function box(G, x, y, z, w, d, h, colour, opt) {
    opt = opt || {};
    var t = typeof colour === 'string' ? tones(colour) : colour;
    var s = path(G.rectX(x, x + w, y, z, z + h), t.front) +
      path(G.rectY(G.side(x, x + w), y, y + d, z, z + h), t.right) +
      path(G.rectZ(x, x + w, y, y + d, z + h), t.top);
    if (opt.edge !== false) s += path(boxEdges(G, x, y, z, w, d, h), null, 'class="' + (opt.edgeClass || 'cf-edge') + '"');
    return s;
  }
  // Outlines of the three visible faces of a box.
  function boxEdges(G, x, y, z, w, d, h) {
    var sx = G.side(x, x + w);
    return G.rectX(x, x + w, y, z, z + h) + G.rectY(sx, y, y + d, z, z + h) + G.rectZ(x, x + w, y, y + d, z + h);
  }

  // Round bodies (cylinders, cups, bottles) drawn in screen space: the axis is vertical,
  // so a ring of radius r at height z projects to an ellipse with radii (r, r*sin(elev)).
  // prof = [[r, z], ...] from bottom to top, relative to (cx, cy, z0).
  function lathe(G, cx, cy, z0, prof) {
    var cam = G.cam, base = G.P(cx, cy, z0), k = cam.sp, n = 18, i, a;
    var left = [], right = [];
    for (i = 0; i < prof.length; i++) {
      var yy = base[1] - prof[i][1] * cam.cp;
      left.push([base[0] - prof[i][0], yy]);
      right.push([base[0] + prof[i][0], yy]);
    }
    var b0 = prof[0], bt = prof[prof.length - 1];
    var by = base[1] - b0[1] * cam.cp, ty = base[1] - bt[1] * cam.cp;
    // outline: left side top→bottom, front half of the bottom ring, right side bottom→top, front half of the top ring
    var pts = [];
    for (i = left.length - 1; i >= 0; i--) pts.push(left[i]);
    for (i = 1; i < n; i++) { a = Math.PI - (Math.PI * i) / n; pts.push([base[0] + b0[0] * Math.cos(a), by + b0[0] * k * Math.sin(a)]); }
    for (i = 0; i < right.length; i++) pts.push(right[i]);
    for (i = 1; i < n; i++) { a = (Math.PI * i) / n; pts.push([base[0] + bt[0] * Math.cos(a), ty + bt[0] * k * Math.sin(a)]); }
    var d = 'M' + pts.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z';
    return {
      d: d,
      top: { cx: r2(base[0]), cy: r2(ty), rx: r2(bt[0]), ry: r2(bt[0] * k) },
      bottom: { cx: r2(base[0]), cy: r2(by), rx: r2(b0[0]), ry: r2(b0[0] * k) },
      base: base,
      at: function (z) { return [base[0], base[1] - z * cam.cp]; }
    };
  }
  function ellipse(e, fill, extra) {
    return '<ellipse cx="' + e.cx + '" cy="' + e.cy + '" rx="' + e.rx + '" ry="' + e.ry + '"' +
      (fill ? ' fill="' + fill + '"' : '') + (extra ? ' ' + extra : '') + '/>';
  }
  // Front half of an ellipse as an open path (for rims and bands).
  function frontArc(e) {
    var s = '', n = 20;
    for (var i = 0; i <= n; i++) {
      var a = Math.PI - (Math.PI * i) / n;
      s += (i ? 'L' : 'M') + r2(e.cx + e.rx * Math.cos(a)) + ' ' + r2(e.cy + e.ry * Math.sin(a));
    }
    return s;
  }
  // A band round a lathe body between two heights (same radius r).
  function band(L, r, z0, z1, k) {
    var a = L.at(z0), b = L.at(z1), n = 20, pts = [], i, t;
    for (i = 0; i <= n; i++) { t = Math.PI - (Math.PI * i) / n; pts.push([a[0] + r * Math.cos(t), a[1] + r * k * Math.sin(t)]); }
    for (i = 0; i <= n; i++) { t = (Math.PI * i) / n; pts.push([b[0] + r * Math.cos(t), b[1] + r * k * Math.sin(t)]); }
    return 'M' + pts.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z';
  }

  // ------------------------------------------------------------- part painters
  // Each painter gets the cube frame G, the part p from the JSON and a context X.
  // It returns markup, or {under, main, over} when the part has to wrap others
  // (an insert's walls go under everything in the cube, its front edges over it).
  // `split` on a painter means the part is a shelf: parts above it are painted after it.

  var PAINTERS = {};

  PAINTERS.whiteInsert = function (G, p, X) {
    var t = 1, W = X.cube.w, H = X.cube.h, back = p.back || 37.5;
    var wx = G.far(t, W - t); // the side panel whose inner face we see
    var under = path(G.rectY(wx, 0, back, 0, H), 'url(#' + X.uid + '-wall-l)') +
      path(G.rectX(t, W - t, back, 0, H), 'url(#' + X.uid + '-wall-b)') +
      path(G.d([[wx, back, 0], [wx, back, H]], true), null, 'class="cf-line" stroke="#b9bab4"');
    // hinge-plate screws on that panel
    [[3.2, 5], [3.2, H - 5]].forEach(function (q) {
      var c = G.P(wx, q[0], q[1]);
      under += '<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r=".45" fill="#9a9c98"/>';
    });
    var over = path(G.rectX(0, t, 0, 0, H), '#ecede9') + path(G.rectX(W - t, W, 0, 0, H), '#ecede9');
    if (p.topTrim) over += path(G.rectX(t, W - t, 0, H - 0.7, H), '#e6e7e2');
    return { under: under, over: over };
  };

  PAINTERS.glassShelf = function (G, p, X) {
    var z = p.z, t = 0.6, x0 = p.x0, x1 = p.x1, y0 = p.y0, y1 = p.y1, top = z + t, n = p.notch;
    var outline = n ?
      [[x0, y0, top], [x1, y0, top], [x1, y1 - n[1], top], [x1 - n[0], y1 - n[1], top], [x1 - n[0], y1, top], [x0, y1, top]] :
      [[x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]];
    var s = path(G.d(outline), 'rgba(170,225,215,.11)') +
      path(G.rectX(x0, x1, y0, z, top), 'rgba(70,165,145,.55)') +
      (G.R ? path(G.rectY(x1, y0, n ? y1 - n[1] : y1, z, top), 'rgba(70,165,145,.35)') : path(G.rectY(x0, y0, y1, z, top), 'rgba(70,165,145,.35)')) +
      path(G.d(outline), null, 'class="cf-glass-edge"');
    if (n && G.R) s += path(G.rectY(x1 - n[0], y1 - n[1], y1, z, top), 'rgba(70,165,145,.4)');
    // support pins on the visible side wall
    [y0 + 2.5, y1 - 3].forEach(function (y) {
      var c = G.P(G.far(x0, x1), y, z - 0.3);
      s += '<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r=".45" fill="#b8bcbf"/>';
    });
    return s;
  };
  PAINTERS.glassShelf.split = function (p) { return p.z; };

  PAINTERS.ledPanel = function (G, p, X) {
    var x0 = p.x0, x1 = p.x1, y0 = p.y0, y1 = p.y1, z = p.z, L = y1 - y0, a = (p.tilt || 0) * RAD, th = 0.35;
    var F, B; // front and back edge points [y, z] of the underside
    if (a > 0) { B = [y1, z - th]; F = [y1 - L * Math.cos(a), z - th - L * Math.sin(a)]; }
    else if (a < 0) { F = [y0, z - th]; B = [y0 + L * Math.cos(-a), z - th - L * Math.sin(-a)]; }
    else { F = [y0, z - th]; B = [y1, z - th]; }
    var vy = (B[0] - F[0]) / L, vz = (B[1] - F[1]) / L;   // unit vector front→back in the plate
    var nrm = [0, -vz, vy]; if (nrm[2] > 0) nrm = [0, vz, -vy]; // underside normal, pointing down
    var cam = G.cam, faceVisible = nrm[1] * cam.toward[1] + nrm[2] * cam.toward[2] > 0.02;
    var FL = [x0, F[0], F[1]], FR = [x1, F[0], F[1]], BR = [x1, B[0], B[1]], BL = [x0, B[0], B[1]];
    var up = [0, -nrm[1] * th, -nrm[2] * th];
    function add(q, v) { return [q[0] + v[0], q[1] + v[1], q[2] + v[2]]; }
    var s = '';
    // light cone, drawn first so the plate sits on top of it
    var floorZ = 0.2, grow = 3;
    var cone = [FL, FR, BR, BL, [x0 - grow, F[0] - grow, floorZ], [x1 + grow, F[0] - grow, floorZ], [x1 + grow, B[0] + grow, floorZ], [x0 - grow, B[0] + grow, floorZ]]
      .map(function (q) { return G.P(q[0], q[1], q[2]); });
    s += '<path class="cf-cone" d="' + hullD(cone) + '" fill="url(#' + X.uid + '-cone)"/>';
    // hanger wire for a tilted panel
    if (a !== 0) {
      var low = a > 0 ? F : B, xm = (x0 + x1) / 2;
      s += path(G.d([[xm, low[0], z], [xm, low[0], low[1]]], true), null, 'class="cf-line" stroke="#6b6b6b"');
    }
    if (faceVisible) {
      s += path(G.d([FL, FR, BR, BL]), null, 'class="cf-led-face"');
      var m = G.plane(FL, [1, 0, 0], [0, vy, vz]), dots = '', cols = Math.floor((x1 - x0 - 1.6) / 2.4), rows = Math.floor((L - 1.4) / 1.25);
      for (var i = 0; i <= cols; i++) {
        var u = 0.8 + i * ((x1 - x0 - 1.6) / cols);
        dots += '<path d="M' + r2(u) + ' 0.5L' + r2(u) + ' ' + r2(L - 0.5) + '" class="cf-led-strip"/>';
        for (var j = 0; j <= rows; j++) dots += '<rect x="' + r2(u - 0.2) + '" y="' + r2(0.7 + j * 1.25 - 0.15) + '" width=".4" height=".3" class="cf-led-dot"/>';
      }
      s += '<g transform="' + m + '">' + dots + '</g>';
    }
    // edges: front edge strip and right edge strip
    s += path(G.d([FL, FR, add(FR, up), add(FL, up)]), null, 'class="cf-led-edge"');
    s += G.R ? path(G.d([FR, BR, add(BR, up), add(FR, up)]), '#8f8f8a') : path(G.d([FL, BL, add(BL, up), add(FL, up)]), '#8f8f8a');
    s += path(G.d([FL, FR, BR, BL]), null, 'class="cf-edge-soft"');
    return s;
  };
  PAINTERS.ledPanel.level = 3;

  function hullD(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [], i;
    for (i = 0; i < p.length; i++) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p[i]) <= 0) lower.pop(); lower.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop(); upper.push(p[i]); }
    var h = lower.slice(0, -1).concat(upper.slice(0, -1));
    return 'M' + h.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z';
  }

  // --- terrarium contents, drawn in a front-parallel plane through the middle of the terra.
  // Local coordinates: u from the terra's left side, b up from the substrate surface.

  var SUBSTRATE = {
    coco: { top: '#4a3626', front: '#3a291d', band: '#2a1d14' },
    pale: { top: '#c3ae93', front: '#a08a6e', band: '#4a3424' },
    dark: { top: '#3a2c22', front: '#2c2119', band: '#1e1611' },
    sandRed: { top: '#dccab0', front: '#c8b496', band: '#b0563f' }
  };

  function decorSvg(kind, w, H, rnd, flip) {
    var s = '', u = function (f) { return r2(flip ? w * (1 - f) : w * f); }, b = function (f) { return r2(H * f); };
    if (kind === 'bark') {
      s += '<path d="M' + u(.08) + ' 0C' + u(.06) + ' ' + b(.42) + ' ' + u(.42) + ' ' + b(.66) + ' ' + u(.9) + ' ' + b(.5) +
        'L' + u(.92) + ' ' + b(.36) + 'C' + u(.6) + ' ' + b(.5) + ' ' + u(.3) + ' ' + b(.4) + ' ' + u(.26) + ' 0Z" fill="#8c4636"/>';
      s += '<path d="M' + u(.14) + ' ' + b(.18) + 'C' + u(.2) + ' ' + b(.45) + ' ' + u(.5) + ' ' + b(.58) + ' ' + u(.88) + ' ' + b(.45) + '" class="cf-texture" stroke="#5c2a20"/>';
    } else if (kind === 'wood') {
      s += '<path d="M' + u(.06) + ' ' + b(.02) + 'L' + u(.2) + ' ' + b(.02) + 'C' + u(.42) + ' ' + b(.22) + ' ' + u(.6) + ' ' + b(.5) + ' ' + u(.78) + ' ' + b(.78) +
        'L' + u(.66) + ' ' + b(.82) + 'C' + u(.48) + ' ' + b(.58) + ' ' + u(.3) + ' ' + b(.3) + ' ' + u(.06) + ' ' + b(.02) + 'Z" fill="#5d4029"/>';
      s += '<path d="M' + u(.14) + ' ' + b(.05) + 'C' + u(.4) + ' ' + b(.3) + ' ' + u(.55) + ' ' + b(.5) + ' ' + u(.72) + ' ' + b(.79) + '" class="cf-texture" stroke="#7b5a3d"/>';
    } else if (kind === 'corkTube') {
      s += '<path d="M' + u(.3) + ' 0L' + u(.3) + ' ' + b(.78) + 'Q' + u(.46) + ' ' + b(.92) + ' ' + u(.62) + ' ' + b(.8) + 'L' + u(.62) + ' 0Z" fill="#62432d"/>';
      for (var i = 0; i < 3; i++) {
        var x = .36 + i * .09;
        s += '<path d="M' + u(x) + ' 0L' + u(x + .01) + ' ' + b(.8) + '" class="cf-texture" stroke="#3f2a1b"/>';
      }
      s += '<path d="M' + u(.34) + ' ' + b(.8) + 'Q' + u(.46) + ' ' + b(.88) + ' ' + u(.58) + ' ' + b(.8) + '" fill="#2a1c12"/>';
    } else if (kind === 'plant') {
      var cx = flip ? .72 : .28;
      s += '<path d="M' + r2(w * cx) + ' 0Q' + r2(w * (cx + .04)) + ' ' + b(.3) + ' ' + r2(w * cx) + ' ' + b(.5) + '" class="cf-texture" stroke="#3c6a2c"/>';
      for (var j = 0; j < 7; j++) {
        var lx = w * (cx + (rnd() - .5) * .3), ly = H * (.18 + rnd() * .38), rot = r2((rnd() - .5) * 120);
        s += '<ellipse cx="' + r2(lx) + '" cy="' + r2(ly) + '" rx="1.1" ry=".55" transform="rotate(' + rot + ' ' + r2(lx) + ' ' + r2(ly) + ')" fill="' + (j % 2 ? '#5f9a46' : '#4b8238') + '"/>';
      }
    } else if (kind === 'succulent') {
      var sx = w * (flip ? .2 : .8);
      for (var k = -3; k <= 3; k++) {
        var ang = k * 20 * RAD, len = 2.4 - Math.abs(k) * .25;
        s += '<path d="M' + r2(sx - .35) + ' 0L' + r2(sx + Math.sin(ang) * len) + ' ' + r2(Math.cos(ang) * len) + 'L' + r2(sx + .35) + ' 0Z" fill="' + (k % 2 ? '#8db4c0' : '#7aa3b1') + '"/>';
      }
    } else if (kind === 'web') {
      for (var m = 0; m < 5; m++) {
        var y1 = H * (.55 + rnd() * .4), y2 = H * (.3 + rnd() * .5);
        s += '<path d="M' + r2(w * .02) + ' ' + r2(y1) + 'Q' + r2(w * (.3 + rnd() * .3)) + ' ' + r2((y1 + y2) / 2 - H * .12) + ' ' + r2(w * (.55 + rnd() * .4)) + ' ' + r2(y2) + '" class="cf-web"/>';
      }
    } else if (kind === 'moss') {
      for (var q = 0; q < 6; q++) s += '<ellipse cx="' + r2(w * (.1 + rnd() * .8)) + '" cy="' + r2(.25) + '" rx="' + r2(.6 + rnd() * .6) + '" ry=".35" fill="#5d6b34"/>';
    }
    return s;
  }

  function critterSvg(c, w, H) {
    if (!c) return '';
    var x = w * (c.u == null ? .5 : c.u), y = H * (c.b || 0) + .5, s = '';
    if (c.type === 'spider') {
      var span = c.span || 5, leg = span / 2, body = c.body || '#222', acc = c.accent || '#c66';
      for (var side = -1; side <= 1; side += 2) {
        for (var i = 0; i < 4; i++) {
          var ang = (-35 + i * 26) * RAD, kx = x + side * Math.cos(ang) * leg * .55, ky = y + Math.sin(ang) * leg * .3 + leg * .28;
          var fx = x + side * Math.cos(ang) * leg, fy = y - .05 + (i - 1.5) * .25;
          s += '<path d="M' + r2(x) + ' ' + r2(y + .3) + 'L' + r2(kx) + ' ' + r2(ky) + 'L' + r2(fx) + ' ' + r2(fy) + '" class="cf-leg" stroke="' + body + '"/>';
          s += '<circle cx="' + r2(kx) + '" cy="' + r2(ky) + '" r=".16" fill="' + acc + '"/>';
        }
      }
      s += '<ellipse cx="' + r2(x - span * .1) + '" cy="' + r2(y + .35) + '" rx="' + r2(span * .12) + '" ry="' + r2(span * .09) + '" fill="' + body + '"/>';
      s += '<ellipse cx="' + r2(x + span * .14) + '" cy="' + r2(y + .3) + '" rx="' + r2(span * .16) + '" ry="' + r2(span * .12) + '" fill="' + mix(body, '#000000', .2) + '"/>';
    } else if (c.type === 'beetle') {
      s += '<ellipse cx="' + r2(x) + '" cy="' + r2(y + .25) + '" rx=".9" ry=".42" fill="#16130f"/><circle cx="' + r2(x - .95) + '" cy="' + r2(y + .3) + '" r=".25" fill="#16130f"/>';
    }
    return s;
  }

  PAINTERS.acrylicTerra = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], w = p.size[0], d = p.size[1], h = p.size[2];
    var rnd = seeded(p.id), sub = SUBSTRATE[p.substrate] || SUBSTRATE.coco, subH = p.substrate === 'sandRed' ? h * 0.3 : h * 0.3;
    var s = '';
    // back and left panels seen through the front (faint), with vent holes on the back
    s += path(G.rectX(x, x + w, y + d, z, z + h), 'rgba(225,235,240,.05)');
    s += path(G.rectY(G.far(x, x + w), y, y + d, z, z + h), 'rgba(225,235,240,.035)');
    var vb = '';
    for (var row = 0; row < 2; row++) for (var i = 0; i < Math.floor(w / 1.1) - 1; i++) {
      vb += '<circle cx="' + r2(1 + i * 1.1) + '" cy="' + r2(1.1 + row * .9) + '" r=".15"/>';
    }
    s += '<g transform="' + G.frontDown(x, y + d, z + h) + '" class="cf-vents">' + vb + '</g>';
    // substrate
    s += path(G.rectX(x + .3, x + w - .3, y + .3, z + .3, z + subH), sub.front) +
      path(G.rectX(x + .3, x + w - .3, y + .3, z + .3, z + subH * .38), sub.band) +
      path(G.rectY(G.side(x + .3, x + w - .3), y + .3, y + d - .3, z + .3, z + subH), mix(sub.front, '#000000', .25)) +
      path(G.rectZ(x + .3, x + w - .3, y + .3, y + d - .3, z + subH), sub.top);
    if (p.substrate === 'sandRed') {
      s += '<g transform="' + G.floor(x, y, z + subH) + '"><ellipse cx="' + r2(w * .55) + '" cy="' + r2(d * .45) + '" rx="' + r2(w * .22) + '" ry="' + r2(d * .2) + '" fill="#b5503b" opacity=".75"/></g>';
    }
    // decor in the mid plane
    var Hs = h - subH - .4, deco = '';
    (p.decor || []).forEach(function (k, idx) {
      if (k === 'dish') return;
      if (k === 'burrow') return;
      deco += decorSvg(k, w, Hs, rnd, idx % 2 === 1 && k !== 'web');
    });
    deco += critterSvg(p.critter, w, Hs);
    if (deco) s += '<g transform="' + G.frontUp(x, y + d * .55, z + subH) + '">' + deco + '</g>';
    if ((p.decor || []).indexOf('dish') >= 0) {
      s += '<g transform="' + G.floor(x, y, z + subH) + '"><circle cx="' + r2(w * .75) + '" cy="' + r2(d * .3) + '" r="1.5" fill="#e6e1d5"/><circle cx="' + r2(w * .75) + '" cy="' + r2(d * .3) + '" r="1.05" fill="#a9b28d"/></g>';
    }
    if ((p.decor || []).indexOf('burrow') >= 0) {
      s += '<g transform="' + G.frontUp(x, y + .25, z) + '"><ellipse cx="' + r2(w * .62) + '" cy="' + r2(subH * .55) + '" rx="2" ry="1.1" fill="#120c08"/></g>';
    }
    // lid (beetle box) or acrylic top
    if (p.lid) s += box(G, x - .2, y - .2, z + h, w + .4, d + .4, .8, p.lid);
    // front, right and top panels: clear acrylic
    s += path(G.rectX(x, x + w, y, z, z + h), 'rgba(225,238,242,.07)', 'class="cf-acrylic"') +
      path(G.rectY(G.side(x, x + w), y, y + d, z, z + h), 'rgba(225,238,242,.05)') +
      (p.lid ? '' : path(G.rectZ(x, x + w, y, y + d, z + h), 'rgba(235,242,245,.07)'));
    // vents on the right panel
    var vr = '';
    for (var j = 0; j < Math.floor(d / 1.1) - 1; j++) vr += '<circle cx="' + r2(1 + j * 1.1) + '" cy="1.1" r=".2"/>';
    s += '<g transform="' + G.plane([G.side(x, x + w), y, z + h], [0, 1, 0], [0, 0, -1]) + '" class="cf-vents">' + vr + '</g>';
    // edges, including the see-through back ones
    var fx = G.far(x, x + w);
    s += path(G.d([[fx, y + d, z], [fx, y + d, z + h]], true) + G.d([[x, y + d, z], [x + w, y + d, z]], true) + G.d([[fx, y, z], [fx, y + d, z]], true), null, 'class="cf-acrylic-edge cf-faint"');
    s += path(boxEdges(G, x, y, z, w, d, h), null, 'class="cf-acrylic-edge"');
    // the hinged front door: hinge clips on the left, top latch, bottom foot clips
    if (p.door !== false) {
      var f = G.frontDown(x, y - .05, z + h), hw = r2(w * .16);
      var door = '<rect x="-.15" y="' + r2(h * .2) + '" width=".5" height="1.6" class="cf-clip"/><rect x="-.15" y="' + r2(h * .7) + '" width=".5" height="1.6" class="cf-clip"/>' +
        '<path d="M' + r2(w / 2 - hw / 2) + ' -.4L' + r2(w / 2 + hw / 2) + ' -.4L' + r2(w / 2 + hw / 2 - .4) + ' 1.4L' + r2(w / 2 - hw / 2 + .4) + ' 1.4Z" class="cf-clip"/>' +
        '<circle cx="' + r2(w / 2) + '" cy=".55" r=".3" fill="#2a2a2e"/>' +
        '<rect x="' + r2(w * .18) + '" y="' + r2(h - 1) + '" width="' + r2(w * .2) + '" height=".55" rx=".27" class="cf-foot"/>' +
        '<rect x="' + r2(w * .62) + '" y="' + r2(h - 1) + '" width="' + r2(w * .2) + '" height=".55" rx=".27" class="cf-foot"/>' +
        '<path d="M' + r2(w * .12) + ' ' + r2(h * .12) + 'L' + r2(w * .2) + ' ' + r2(h * .12) + 'L' + r2(w * .04) + ' ' + r2(h * .88) + 'L' + r2(-0.04 + w * .0) + ' ' + r2(h * .88) + 'Z" class="cf-shine"/>';
      s += '<g transform="' + f + '">' + door + '</g>';
    }
    return s;
  };

  PAINTERS.glassTerra = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], w = p.size[0], d = p.size[1], h = p.size[2], rnd = seeded(p.id), sub = SUBSTRATE.dark;
    var s = '', subH = h * .32, fr = 1.4;
    s += path(G.rectX(x, x + w, y + d, z, z + h), 'rgba(160,215,205,.05)');
    s += path(G.rectX(x + .3, x + w - .3, y + .3, z + .3, z + subH), sub.front) +
      path(G.rectY(G.side(x + .3, x + w - .3), y + .3, y + d - .3, z + .3, z + subH), mix(sub.front, '#000000', .25)) +
      path(G.rectZ(x + .3, x + w - .3, y + .3, y + d - .3, z + subH), sub.top);
    // bark pieces lying on the substrate, and the orange isopods
    var deco = '';
    deco += '<path d="M' + r2(w * .08) + ' .2L' + r2(w * .3) + ' 1.8L' + r2(w * .34) + ' 1L' + r2(w * .14) + ' -.2Z" fill="#7b5b45"/>';
    deco += '<path d="M' + r2(w * .45) + ' .2L' + r2(w * .9) + ' .9L' + r2(w * .88) + ' -.1L' + r2(w * .48) + ' -.4Z" fill="#b7a58f"/>';
    deco += '<path d="M' + r2(w * .55) + ' 0Q' + r2(w * .6) + ' ' + r2(h * .35) + ' ' + r2(w * .52) + ' ' + r2(h * .55) + '" class="cf-texture" stroke="#4d6b33"/>';
    s += '<g transform="' + G.frontUp(x, y + d * .5, z + subH) + '">' + deco + '</g>';
    var iso = '';
    for (var i = 0; i < 9; i++) iso += '<ellipse cx="' + r2(1 + rnd() * (w - 2)) + '" cy="' + r2(1.5 + rnd() * (d - 3)) + '" rx=".42" ry=".26" fill="#e8892d"/>';
    s += '<g transform="' + G.floor(x, y, z + subH + .02) + '">' + iso + '</g>';
    // glass walls
    s += path(G.rectX(x, x + w, y, z, z + h), 'rgba(170,220,210,.06)') + path(G.rectY(G.side(x, x + w), y, y + d, z, z + h), 'rgba(170,220,210,.05)');
    s += path(boxEdges(G, x, y, z, w, d, h), null, 'class="cf-glass-edge"');
    // white aluminium frame lid with mesh
    s += box(G, x - .2, y - .2, z + h, w + .4, d + .4, .9, '#dfe0dc');
    s += path(G.rectZ(x + fr, x + w - fr, y + fr, y + d - fr, z + h + .92), '#2b2d2f');
    var mesh = '';
    for (var k = 1; k < 8; k++) mesh += '<path d="M' + r2(k * (w - 2 * fr) / 8) + ' 0L' + r2(k * (w - 2 * fr) / 8) + ' ' + r2(d - 2 * fr) + '" class="cf-mesh"/>';
    s += '<g transform="' + G.floor(x + fr, y + fr, z + h + .93) + '">' + mesh + '</g>';
    return s;
  };

  PAINTERS.zooMedTerra = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], w = p.size[0], d = p.size[1], h = p.size[2], rnd = seeded(p.id);
    var baseH = 2.4, lidH = 2.2, gz = z + baseH, gh = h - baseH - lidH, s = '', subH = 5;
    s += box(G, x - .6, y - .6, z, w + 1.2, d + 1.2, baseH, '#1d1d20');
    s += path(G.rectX(x, x + w, y + d, gz, gz + gh), 'rgba(160,210,200,.05)');
    s += path(G.rectX(x + .3, x + w - .3, y + .3, gz, gz + subH), '#3a2a1e') +
      path(G.rectX(x + .3, x + w - .3, y + .3, gz, gz + subH * .5), '#2a1e15') +
      path(G.rectY(G.side(x + .3, x + w - .3), y + .3, y + d - .3, gz, gz + subH), '#2a1e15') +
      path(G.rectZ(x + .3, x + w - .3, y + .3, y + d - .3, gz + subH), '#4b3829');
    // water cup with a white lid, bramble stems and leaves, two stick insects
    var cup = lathe(G, x + w * .38, y + d * .45, gz + subH, [[1.7, 0], [2, 5]]);
    s += '<path d="' + cup.d + '" fill="rgba(225,230,210,.35)"/>' +
      '<path d="' + band({ at: cup.at }, 1.85, .2, 2.6, G.cam.sp) + '" fill="rgba(196,170,70,.55)"/>' + ellipse(cup.top, '#e8e6df');
    var H = gh - subH - .5, br = '';
    var stems = [[.22, .02, .15, .45, .05, .92], [.45, .05, .5, .5, .4, .95], [.38, .05, .7, .4, .78, .82]];
    stems.forEach(function (q, i) {
      br += '<path d="M' + r2(w * q[0]) + ' ' + r2(H * q[1]) + 'Q' + r2(w * q[2]) + ' ' + r2(H * q[3]) + ' ' + r2(w * q[4]) + ' ' + r2(H * q[5]) + '" class="cf-stem"/>';
      for (var j = 0; j < 7; j++) {
        var t = .25 + j * .11, lx = w * ((1 - t) * (1 - t) * q[0] + 2 * (1 - t) * t * q[2] + t * t * q[4]), ly = H * ((1 - t) * (1 - t) * q[1] + 2 * (1 - t) * t * q[3] + t * t * q[5]);
        var side = j % 2 ? 1 : -1, rot = r2(side * (30 + rnd() * 30));
        br += '<ellipse cx="' + r2(lx + side * 1.1) + '" cy="' + r2(ly) + '" rx="1.35" ry=".95" transform="rotate(' + rot + ' ' + r2(lx + side * 1.1) + ' ' + r2(ly) + ')" fill="' + ['#8d8a86', '#6f8a4e', '#9a7a7a', '#b5b0aa'][(i + j) % 4] + '"/>';
      }
    });
    br += '<path d="M' + r2(w * .3) + ' ' + r2(H * .58) + 'L' + r2(w * .66) + ' ' + r2(H * .74) + '" class="cf-stick"/>';
    br += '<path d="M' + r2(w * .4) + ' ' + r2(H * .62) + 'L' + r2(w * .36) + ' ' + r2(H * .45) + 'M' + r2(w * .55) + ' ' + r2(H * .69) + 'L' + r2(w * .6) + ' ' + r2(H * .52) + 'M' + r2(w * .5) + ' ' + r2(H * .67) + 'L' + r2(w * .46) + ' ' + r2(H * .83) + '" class="cf-stick-leg"/>';
    br += '<path d="M' + r2(w * .72) + ' ' + r2(H * .25) + 'L' + r2(w * .74) + ' ' + r2(H * .75) + '" class="cf-stick"/>';
    br += '<path d="M' + r2(w * .73) + ' ' + r2(H * .4) + 'L' + r2(w * .86) + ' ' + r2(H * .3) + 'M' + r2(w * .735) + ' ' + r2(H * .55) + 'L' + r2(w * .62) + ' ' + r2(H * .47) + '" class="cf-stick-leg"/>';
    s += '<g transform="' + G.frontUp(x, y + d * .5, gz + subH) + '">' + br + '</g>';
    // glass, then the black lid with a mesh top
    s += path(G.rectX(x, x + w, y, gz, gz + gh), 'rgba(170,220,210,.06)') + path(G.rectY(G.side(x, x + w), y, y + d, gz, gz + gh), 'rgba(170,220,210,.05)');
    s += path(boxEdges(G, x, y, gz, w, d, gh), null, 'class="cf-glass-edge"');
    s += '<g transform="' + G.frontDown(x, y - .05, gz + gh) + '"><path d="M' + r2(w * .08) + ' ' + r2(gh * .1) + 'L' + r2(w * .15) + ' ' + r2(gh * .1) + 'L' + r2(w * .05) + ' ' + r2(gh * .9) + 'L0 ' + r2(gh * .9) + 'Z" class="cf-shine"/></g>';
    s += box(G, x - .5, y - .5, gz + gh, w + 1, d + 1, lidH, '#202024');
    s += path(G.rectZ(x + 1.5, x + w - 1.5, y + 1.5, y + d - 1.5, gz + gh + lidH + .02), '#131316');
    return s;
  };

  PAINTERS.roundTub = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, k = G.cam.sp;
    var L = lathe(G, cx, cy, z, [[r - .3, 0], [r, h]]);
    var sand = lathe(G, cx, cy, z, [[r - .35, .2], [r - .2, h * .38]]);
    var s = '<path d="' + L.d + '" fill="rgba(225,235,240,.06)"/>';
    s += '<path d="' + sand.d + '" fill="#c9b190"/>' + ellipse(sand.top, '#d8c4a4');
    var bark = sand.at(h * .38);
    s += '<path d="M' + r2(bark[0] - r * .5) + ' ' + r2(bark[1] + .2) + 'Q' + r2(bark[0]) + ' ' + r2(bark[1] - 2.2) + ' ' + r2(bark[0] + r * .55) + ' ' + r2(bark[1] - .2) + 'L' + r2(bark[0] + r * .4) + ' ' + r2(bark[1] + .6) + 'Q' + r2(bark[0]) + ' ' + r2(bark[1] - 1.1) + ' ' + r2(bark[0] - r * .4) + ' ' + r2(bark[1] + .9) + 'Z" fill="#8a6a4a"/>';
    s += '<path d="' + L.d + '" fill="url(#' + X.uid + '-glass)"/>';
    s += '<path d="' + band(L, r + .05, h - 1.3, h, k) + '" fill="#d9d8d2"/>';
    s += ellipse(L.top, '#3b3d40') + ellipse({ cx: L.top.cx, cy: L.top.cy, rx: r2(r - .9), ry: r2((r - .9) * k) }, '#55585b');
    s += '<path d="' + L.d + '" fill="none" class="cf-acrylic-edge"/>';
    return s;
  };

  PAINTERS.cup = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, k = G.cam.sp;
    var L = lathe(G, cx, cy, z, [[r * .86, 0], [r, h]]);
    var s = '<path d="' + L.d + '" fill="rgba(238,236,228,.55)"/>' + '<path d="' + L.d + '" fill="url(#' + X.uid + '-glass)"/>';
    s += '<path d="' + band(L, r + .05, h - .7, h, k) + '" fill="' + mix(p.lid || '#eeeeee', '#000000', .1) + '"/>';
    s += ellipse({ cx: L.top.cx, cy: L.top.cy, rx: r2(r + .15), ry: r2((r + .15) * k) }, p.lid || '#eeeeee');
    if (p.drape) {
      var t = L.at(h), dr = '';
      for (var i = 0; i < 4; i++) {
        var x0 = t[0] - r + i * (2 * r / 4);
        dr += 'M' + r2(x0) + ' ' + r2(t[1] + .3) + 'L' + r2(x0 + r / 4) + ' ' + r2(t[1] + 2 + (i % 2) * .6) + 'L' + r2(x0 + r / 2) + ' ' + r2(t[1] + .3) + 'Z';
      }
      s += '<path d="' + dr + '" fill="' + p.lid + '" opacity=".75"/>';
    }
    return s;
  };

  PAINTERS.plantPot = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, rnd = seeded(p.id), k = G.cam.sp;
    var saucer = lathe(G, cx, cy, z, [[r * .9, 0], [r * 1.05, 1.4]]);
    var pot = lathe(G, cx, cy, z + .6, [[r * .72, 0], [r, h]]);
    var s = '<path d="' + saucer.d + '" fill="rgba(230,235,238,.3)"/>' + ellipse(saucer.top, 'rgba(230,235,238,.18)');
    s += '<path d="' + pot.d + '" fill="url(#' + X.uid + '-pot)"/>' + ellipse(pot.top, '#3a2b20');
    var t = pot.at(h), leaves = '';
    for (var i = 0; i < 16; i++) {
      var a = rnd() * Math.PI * 2, rr = rnd() * r * 1.5, lx = t[0] + Math.cos(a) * rr, ly = t[1] - 1.2 - rnd() * 5.2 + Math.sin(a) * rr * k;
      var rot = r2((rnd() - .5) * 140);
      leaves += '<ellipse cx="' + r2(lx) + '" cy="' + r2(ly) + '" rx="1.5" ry=".85" transform="rotate(' + rot + ' ' + r2(lx) + ' ' + r2(ly) + ')" fill="' + (i % 3 ? '#c98aa2' : '#b56f8c') + '"/>';
      leaves += '<circle cx="' + r2(lx + .3) + '" cy="' + r2(ly - .1) + '" r=".28" fill="#3f6d3a"/>';
    }
    s += '<path d="M' + r2(t[0]) + ' ' + r2(t[1]) + 'L' + r2(t[0] - .6) + ' ' + r2(t[1] - 4) + 'M' + r2(t[0]) + ' ' + r2(t[1]) + 'L' + r2(t[0] + .9) + ' ' + r2(t[1] - 3.4) + '" class="cf-stem"/>' + leaves;
    return s;
  };

  PAINTERS.seaMonkeyTank = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, rnd = seeded(p.id), k = G.cam.sp;
    var L = lathe(G, cx, cy, z, [[r, 0], [r, h]]);
    var water = lathe(G, cx, cy, z, [[r - .25, .4], [r - .25, h * .86]]);
    var s = '<path d="' + L.d + '" fill="rgba(225,235,240,.05)"/>';
    s += '<path d="' + water.d + '" fill="url(#' + X.uid + '-water)"/>';
    // algae, ornament and plant inside the water
    var b = water.at(.4), alg = '';
    for (var i = 0; i < 26; i++) {
      var ax = b[0] + (rnd() * 2 - 1) * (r - .6), ay = b[1] - rnd() * h * .35 + Math.abs(ax - b[0]) * .05;
      alg += '<circle cx="' + r2(ax) + '" cy="' + r2(ay) + '" r="' + r2(.18 + rnd() * .28) + '" fill="' + (i % 3 ? '#2f6a2a' : '#4c8a2e') + '"/>';
    }
    s += '<ellipse cx="' + r2(b[0]) + '" cy="' + r2(b[1] - .3) + '" rx="' + r2(r - .5) + '" ry="' + r2((r - .5) * k) + '" fill="#a7c07a" opacity=".55"/>' + alg;
    s += '<path d="M' + r2(b[0] - 2.6) + ' ' + r2(b[1] - .4) + 'Q' + r2(b[0] - 2.8) + ' ' + r2(b[1] - 3.4) + ' ' + r2(b[0]) + ' ' + r2(b[1] - 3.6) + 'Q' + r2(b[0] + 2.9) + ' ' + r2(b[1] - 3.2) + ' ' + r2(b[0] + 2.5) + ' ' + r2(b[1] - .4) + 'Z" fill="#df7438"/>';
    s += '<path d="M' + r2(b[0] - 1.2) + ' ' + r2(b[1] - 2.2) + 'Q' + r2(b[0]) + ' ' + r2(b[1] - 3) + ' ' + r2(b[0] + 1.3) + ' ' + r2(b[1] - 2.1) + '" class="cf-texture" stroke="#a84f22"/>';
    for (var j = 0; j < 5; j++) {
      var px = b[0] - 1 + j * .6, top = b[1] - 6 - rnd() * 4;
      s += '<path d="M' + r2(px) + ' ' + r2(b[1] - 3.3) + 'Q' + r2(px + (rnd() - .5) * 3) + ' ' + r2((top + b[1]) / 2 - 2) + ' ' + r2(px + (rnd() - .5) * 2) + ' ' + r2(top) + '" class="cf-frond"/>';
    }
    // bubbles from the airstone, clipped to the water (only shown while the bubbler runs)
    var stone = water.at(.9), stoneX = stone[0] - r * .45, rise = (h * .86 - 1.2) * G.cam.cp, bub = '';
    for (var q = 0; q < 9; q++) {
      var bx = stoneX + (rnd() - .5) * .6, dur = 1.7 + rnd() * 1.1, del = -(q / 9) * dur;
      bub += '<circle class="cf-bubble" cx="' + r2(bx) + '" cy="' + r2(stone[1]) + '" r="' + r2(.18 + rnd() * .2) + '" style="--rise:' + r2(-rise) + 'px;--dx:' + r2((rnd() - .5) * 1.2) + 'px;--s0:' + r2(-rise * (q + .5) / 9) + 'px;animation-duration:' + r2(dur) + 's;animation-delay:' + r2(del) + 's"/>';
    }
    s += '<clipPath id="' + X.uid + '-' + p.id + '-water"><path d="' + water.d + '"/></clipPath>';
    s += '<g class="cf-fx cf-fx-bubbles" clip-path="url(#' + X.uid + '-' + p.id + '-water)">' + bub + '</g>';
    // airstone and the clear air tube arcing in from the back
    s += '<rect x="' + r2(stoneX - .5) + '" y="' + r2(stone[1] - .3) + '" width="1" height=".6" rx=".25" fill="#8b8f93"/>';
    var tf = p.tubeFrom || [cx - 5, 37.4, z + h + 4], a0 = G.P(tf[0], tf[1], tf[2]), rim = G.P(cx - r * .45, cy, z + h + 1.2);
    s += '<path d="M' + r2(a0[0]) + ' ' + r2(a0[1]) + 'C' + r2(a0[0] + 1) + ' ' + r2(a0[1] - 6) + ' ' + r2(rim[0] - 1) + ' ' + r2(rim[1] - 5) + ' ' + r2(rim[0]) + ' ' + r2(rim[1]) + 'L' + r2(stoneX) + ' ' + r2(stone[1] - .3) + '" class="cf-tube"/>';
    // glass body, rim, highlight
    s += '<path d="' + L.d + '" fill="url(#' + X.uid + '-glass)"/>';
    s += ellipse(water.top, 'rgba(190,220,150,.35)');
    s += ellipse(L.top, 'none', 'class="cf-acrylic-edge"') + '<path d="' + L.d + '" fill="none" class="cf-acrylic-edge"/>';
    s += '<path d="M' + r2(L.top.cx + r * .55) + ' ' + r2(L.top.cy + 1) + 'L' + r2(L.top.cx + r * .55) + ' ' + r2(L.bottom.cy - 1) + '" class="cf-glint"/>';
    return s;
  };

  PAINTERS.electronicsBox = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], w = p.size[0], d = p.size[1], h = p.size[2];
    var s = '';
    // steel bracket under the box
    s += box(G, x, y + 1.5, z - .5, w * .8, 1.2, .5, '#9a9ea2');
    s += box(G, x, y, z, w, d, h, { front: '#cdb894', right: '#ab9673', top: '#dccaa7' }, { edgeClass: 'cf-edge-wood' });
    var grain = '';
    for (var i = 1; i < 6; i++) grain += '<path d="M0 ' + r2(i * h / 6 + (i % 2) * .15) + 'L' + r2(w) + ' ' + r2(i * h / 6) + '" class="cf-grain"/>';
    grain += '<path d="M0 ' + r2(h * .32) + 'L' + r2(w) + ' ' + r2(h * .32) + '" class="cf-seam"/>';
    s += '<g transform="' + G.frontDown(x, y, z + h) + '">' + grain + '</g>';
    var side = '';
    for (var j = 1; j < 5; j++) side += '<path d="M0 ' + r2(j * h / 5) + 'L' + r2(d) + ' ' + r2(j * h / 5 + .1) + '" class="cf-grain"/>';
    if (G.R) s += '<g transform="' + G.plane([x + w, y, z + h], [0, 1, 0], [0, 0, -1]) + '">' + side + '</g>';
    return s;
  };

  PAINTERS.oled = function (G, p, X) {
    var x = p.at[0], y = p.at[1] - .06, z = p.at[2], w = p.size[0], h = p.size[1];
    // centred on (x, z) of the box front face; local b runs down
    var m = G.frontDown(x - w / 2, y, z + h / 2);
    return '<g transform="' + m + '">' +
      '<rect x="-.35" y="-.35" width="' + r2(w + .7) + '" height="' + r2(h + .7) + '" rx=".15" fill="#1d4f8f"/>' +
      '<rect x="0" y="0" width="' + r2(w) + '" height="' + r2(h) + '" fill="#04070b"/>' +
      '<text class="cf-oled-title" data-oled-title x=".22" y=".62"></text>' +
      '<text class="cf-oled-value" data-oled-value x=".22" y="' + r2(h - .32) + '"></text>' +
      '</g>';
  };

  PAINTERS.fogger = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, k = G.cam.sp;
    var L = lathe(G, cx, cy, z, [[r, 0], [r, h * .82], [r * .82, h * .95], [r * .55, h]]);
    var s = '<path d="' + L.d + '" fill="url(#' + X.uid + '-white)"/>';
    s += '<path d="' + band(L, r + .04, h * .3, h * .55, k) + '" fill="#e2b322"/>';
    s += '<path d="' + band(L, r + .06, h * .6, h * .64, k) + '" fill="#141414"/>';
    s += ellipse(L.top, '#d9d9d6') + ellipse({ cx: L.top.cx, cy: L.top.cy, rx: r2(r * .25), ry: r2(r * .25 * k) }, '#9aa0a4');
    var wq = L.at(h * .62);
    s += '<path d="M' + r2(wq[0] + r) + ' ' + r2(wq[1]) + 'Q' + r2(wq[0] + r + 1.6) + ' ' + r2(wq[1] - 1.6) + ' ' + r2(wq[0] + r + .6) + ' ' + r2(wq[1] - 2.4) + '" class="cf-wire-red"/>';
    // mist: puffs rising from the nozzle through the broken shelf corner
    var top = L.at(h), puffs = '';
    for (var i = 0; i < 6; i++) {
      var dur = 5.2, del = -(i / 6) * dur;
      puffs += '<ellipse class="cf-puff" cx="' + r2(top[0]) + '" cy="' + r2(top[1] - 1) + '" rx="3.2" ry="2.1" fill="url(#' + X.uid + '-puff)" style="--my:' + r2(-(p.rise || 24)) + 'px;--mx:' + r2((i % 2 ? 1 : -1) * 1.5) + 'px;--s0:' + r2(-(p.rise || 24) * (i + .5) / 6) + 'px;animation-duration:' + dur + 's;animation-delay:' + r2(del) + 's"/>';
    }
    s += '<g class="cf-fx cf-fx-mist">' + puffs + '</g>';
    return s;
  };

  PAINTERS.fan = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], a = p.size || 4, half = a / 2, t = 1;
    var s = box(G, x - half, y - t, z - half, a, t, a, { front: '#18181a', right: '#0c0c0d', top: '#26262a' });
    // the rotor lives in the fan's front plane, centred on the hub, so it can spin in that plane
    var m = G.plane([x, y - t - .02, z], [1, 0, 0], [0, 0, -1]), blades = '';
    for (var i = 0; i < 7; i++) {
      var ang = i * 360 / 7;
      blades += '<path d="M.35 -.15Q1.2 -.9 1.75 -.25L1.6 .35Q1 0 .35 .2Z" transform="rotate(' + r2(ang) + ')" fill="#2f2f33"/>';
    }
    s += '<g transform="' + m + '">' +
      '<circle r="' + r2(half * .92) + '" fill="#050506"/>' +
      '<circle r="' + r2(half * .92) + '" fill="none" class="cf-fan-ring"/>' +
      '<g class="cf-fx cf-fx-spin">' + blades + '<circle r=".62" fill="#3a3a3f"/></g>' +
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (q) { return '<circle cx="' + r2(q[0] * half * .78) + '" cy="' + r2(q[1] * half * .78) + '" r=".2" fill="#555"/>'; }).join('') +
      '</g>';
    return s;
  };
  PAINTERS.fan.layer = 0;

  PAINTERS.sensor = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2];
    return '<g transform="' + G.frontDown(x - .9, y - .05, z + .6) + '">' +
      '<rect width="1.8" height="1.2" rx=".08" fill="#1f4fd6"/><rect x=".55" y=".3" width=".7" height=".55" fill="#0d0d10"/>' +
      [.25, .55, .85, 1.15, 1.45].map(function (u) { return '<circle cx="' + u + '" cy="1.05" r=".07" fill="#d8c27a"/>'; }).join('') + '</g>';
  };
  PAINTERS.sensor.layer = 0;

  PAINTERS.moodLed = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], r = p.r || 2, leds = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      leds += '<rect x="' + r2(Math.cos(a) * r * .62 - .22) + '" y="' + r2(Math.sin(a) * r * .62 - .22) + '" width=".44" height=".44" fill="#55575c"/>';
    }
    return '<g transform="' + G.frontDown(x, y - .05, z) + '">' +
      '<circle r="' + r2(r * 2.6) + '" fill="url(#' + X.uid + '-glow)" class="cf-fx cf-fx-glow" style="--glow:' + (p.glow || '#c4b5fd') + '"/>' +
      '<circle r="' + r + '" fill="#e9e9e6"/><circle r="' + r + '" fill="none" class="cf-edge"/>' + leds +
      '<rect x="-.35" y="-.35" width=".7" height=".7" fill="#1a1a1c"/></g>';
  };
  PAINTERS.moodLed.layer = 0;

  PAINTERS.cableHole = function (G, p) {
    return '<g transform="' + G.frontDown(p.at[0], p.at[1] - .02, p.at[2]) + '"><ellipse rx="1" ry=".85" fill="#0a0a0b"/><ellipse rx="1" ry=".85" fill="none" class="cf-edge"/></g>';
  };
  PAINTERS.cableHole.layer = 0;

  PAINTERS.cable = function (G, p) {
    var pts = p.points.map(function (q) { return G.P(q[0], q[1], q[2]); }), d = 'M' + r2(pts[0][0]) + ' ' + r2(pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      if (i < pts.length - 1) {
        var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += 'Q' + r2(pts[i][0]) + ' ' + r2(pts[i][1]) + ' ' + r2(mx) + ' ' + r2(my);
      } else d += 'L' + r2(pts[i][0]) + ' ' + r2(pts[i][1]);
    }
    return '<path d="' + d + '" class="cf-cable" stroke="' + (p.colour || '#111') + '" style="stroke-width:' + (p.width || 1) + 'px"/>';
  };
  PAINTERS.cable.layer = 0;

  PAINTERS.compartmentInsert = function (G, p, X) {
    var W = X.cube.w, H = X.cube.h, t = .8, back = p.back || 37, dx = p.divider, sz = p.split, c = '#2c221e';
    var under = path(G.rectX(t, W - t, back, t, H - t), '#140f0d') +
      path(G.rectY(G.far(t, W - t), 0, back, t, H - t), '#1f1815') +
      path(G.rectZ(t, W - t, 0, back, t), '#3a2e28') +
      path(G.rectY(G.side(dx, dx + 1), 0, back, t, H - t), '#211a16');
    var main = path(G.rectZ(t, W - t, 0, back, sz + 1), '#3a2e28');
    var over = path(G.rectX(dx, dx + 1, 0, t, H - t), c) + path(G.rectX(t, W - t, 0, sz, sz + 1), c) +
      path(G.rectX(0, t, 0, 0, H), c) + path(G.rectX(W - t, W, 0, 0, H), c) + path(G.rectX(0, W, 0, 0, t), c) + path(G.rectX(0, W, 0, H - t, H), c) +
      path(G.rectX(t, W - t, 0, t, H - t) + G.rectX(dx, dx + 1, 0, t, H - t) + G.rectX(t, W - t, 0, sz, sz + 1), null, 'class="cf-edge-soft"');
    return { under: under, main: main, over: over };
  };
  PAINTERS.compartmentInsert.split = function (p) { return p.split; };

  PAINTERS.glencairn = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h;
    var L = lathe(G, cx, cy, z, [[r * .9, 0], [r * .9, .5], [r * .3, .8], [r * .3, h * .3], [r, h * .5], [r * .95, h * .7], [r * .62, h]]);
    return '<path d="' + L.d + '" fill="rgba(220,232,240,.10)"/><path d="' + L.d + '" fill="url(#' + X.uid + '-glass)"/>' +
      '<path d="' + L.d + '" fill="none" class="cf-acrylic-edge"/>' + ellipse(L.top, 'none', 'class="cf-acrylic-edge"');
  };

  PAINTERS.flask = function (G, p, X) {
    var x = p.at[0], y = p.at[1], z = p.at[2], w = p.size[0], d = p.size[1], h = p.size[2];
    var s = box(G, x, y, z, w, d, h, { front: '#a7abaf', right: '#7d8185', top: '#c4c8cb' });
    s += box(G, x + w * .62, y + d * .3, z + h, 1.6, 1.2, 1, '#9a9ea2');
    s += '<g transform="' + G.frontDown(x, y - .02, z + h) + '"><ellipse cx="' + r2(w / 2) + '" cy="' + r2(h * .55) + '" rx="' + r2(w * .28) + '" ry="' + r2(h * .22) + '" fill="none" class="cf-engrave"/><path d="M' + r2(w * .1) + ' .5L' + r2(w * .2) + ' ' + r2(h - .5) + '" class="cf-shine-line"/></g>';
    return s;
  };

  PAINTERS.plush = function (G, p, X) {
    var c = G.P(p.at[0], p.at[1], p.at[2]), r = p.r, rnd = seeded(p.id), s = '';
    s += '<ellipse cx="' + r2(c[0]) + '" cy="' + r2(c[1] - r * .1) + '" rx="' + r2(r * 1.1) + '" ry="' + r2(r * .35) + '" fill="rgba(0,0,0,.35)"/>';
    for (var i = 0; i < 7; i++) {
      s += '<circle cx="' + r2(c[0] + (rnd() - .5) * r * 1.2) + '" cy="' + r2(c[1] - r * .9 - (rnd() - .3) * r * .8) + '" r="' + r2(r * (.42 + rnd() * .2)) + '" fill="' + (i % 2 ? p.body : mix(p.body, '#000000', .12)) + '"/>';
    }
    s += '<ellipse cx="' + r2(c[0] - r * .85) + '" cy="' + r2(c[1] - r * 1.15) + '" rx="' + r2(r * .42) + '" ry="' + r2(r * .5) + '" fill="' + p.face + '"/>';
    s += '<circle cx="' + r2(c[0] - r * .98) + '" cy="' + r2(c[1] - r * 1.22) + '" r="' + r2(r * .07) + '" fill="#111"/>';
    return s;
  };

  PAINTERS.bottle = function (G, p, X) {
    var cx = p.at[0], cy = p.at[1], z = p.at[2], r = p.r, h = p.h, nk = p.neck || .3, k = G.cam.sp;
    var L = lathe(G, cx, cy, z, [[r, 0], [r, h * .62], [r * .9, h * .68], [r * .48, h * .76], [r * nk, h * .82], [r * nk, h * .93], [r * nk * 1.1, h]]);
    var liquid = lathe(G, cx, cy, z, [[r - .25, .3], [r - .25, h * .55]]);
    var s = '<path d="' + L.d + '" fill="' + p.glass + '"/>';
    s += '<path d="' + liquid.d + '" fill="' + p.liquid + '" opacity=".8"/>' + ellipse(liquid.top, mix(p.liquid, '#ffffff', .1), 'opacity=".6"');
    if (p.tag) s += bottleTag(L, r, h, k, p.tag);
    s += '<path d="' + L.d + '" fill="url(#' + X.uid + '-bottle)"/>';
    s += '<path d="' + band(L, r * nk * 1.12, h * .84, h + .2, k) + '" fill="' + p.cap + '"/>' + ellipse({ cx: L.top.cx, cy: r2(L.at(h + .2)[1]), rx: r2(r * nk * 1.12), ry: r2(r * nk * 1.12 * k) }, mix(p.cap, '#ffffff', .15));
    s += '<path d="M' + r2(L.base[0] + r * .5) + ' ' + r2(L.at(h * .58)[1]) + 'L' + r2(L.base[0] + r * .5) + ' ' + r2(L.at(1)[1]) + '" class="cf-glint"/>';
    s += '<path d="' + L.d + '" fill="none" class="cf-bottle-edge"/>';
    return s;
  };

  // A paper label wrapped round the front of a bottle: tag = {from, to (fractions of h), colour,
  // lines: [{text, at (0 top .. 1 bottom), size (cm), colour, serif, bold}], mark: "skull"}.
  function bottleTag(L, r, h, k, t) {
    var a = L.at(h * t.from), b = L.at(h * t.to), m = .3, n = 16, pts = [], i, ang;
    for (i = 0; i <= n; i++) { ang = Math.PI - m - (Math.PI - 2 * m) * i / n; pts.push([a[0] + r * Math.cos(ang), a[1] + r * k * Math.sin(ang)]); }
    for (i = 0; i <= n; i++) { ang = m + (Math.PI - 2 * m) * i / n; pts.push([b[0] + r * Math.cos(ang), b[1] + r * k * Math.sin(ang)]); }
    var s = '<path d="M' + pts.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z" fill="' + t.colour + '"/>';
    var top = b[1] + r * k, bottom = a[1] + r * k, cx = a[0];
    if (t.band) s += '<rect x="' + r2(cx - r * .95) + '" y="' + r2(bottom - (bottom - top) * t.band.height) + '" width="' + r2(r * 1.9) + '" height="' + r2((bottom - top) * t.band.height) + '" fill="' + t.band.colour + '"/>';
    if (t.mark === 'skull') {
      var sy = top + (bottom - top) * .4, sr = r * .42;
      s += '<path d="M' + r2(cx - sr) + ' ' + r2(sy) + 'a' + r2(sr) + ' ' + r2(sr) + ' 0 1 1 ' + r2(2 * sr) + ' 0l' + r2(-sr * .2) + ' ' + r2(sr * .7) + 'h' + r2(-sr * 1.6) + 'Z" fill="#e39a32"/>' +
        '<circle cx="' + r2(cx - sr * .38) + '" cy="' + r2(sy) + '" r="' + r2(sr * .24) + '" fill="#111"/><circle cx="' + r2(cx + sr * .38) + '" cy="' + r2(sy) + '" r="' + r2(sr * .24) + '" fill="#111"/>';
    }
    (t.lines || []).forEach(function (ln) {
      s += '<text class="cf-bottle-text" x="' + r2(cx) + '" y="' + r2(top + (bottom - top) * ln.at) + '" font-size="' + ln.size + '" fill="' + (ln.colour || '#111') + '"' +
        (ln.serif ? ' data-serif' : '') + (ln.bold ? ' font-weight="700"' : '') + '>' + escapeXml(ln.text) + '</text>';
    });
    return s;
  }
  function escapeXml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Kinds that stand in front of the fog and are copied into the front SVG of the fog cube.
  var FOG_FRONT_KINDS = ['acrylicTerra', 'glassShelf', 'whiteInsert'];

  PAINTERS.door = function (G, p, X) {
    var W = X.cube.w, H = X.cube.h, g = 0, kn = p.knob || [.85, .2];
    var s = path(G.rectX(g, W - g, -.4, g, H - g), '#2e2420') + path(G.rectZ(g, W - g, -.4, 0, H - g), '#3b2f29') +
      path(G.rectX(g, W - g, -.4, g, H - g), null, 'class="cf-edge-soft"');
    var kx = W * kn[0], kz = H * kn[1];
    s += '<g transform="' + G.frontDown(kx, -.4, kz) + '"><circle r=".9" fill="rgba(0,0,0,.35)" transform="translate(.25 .25)"/><circle r=".75" fill="url(#' + X.uid + '-chrome)"/><circle r=".75" fill="none" class="cf-edge"/></g>';
    return s;
  };
  PAINTERS.door.front = true;

  PAINTERS.glassDoor = function (G, p, X) {
    var W = X.cube.w, H = X.cube.h, s = '', y = -.5, hx = p.hinge === 'right' ? W - 2.4 : 2.4;
    s += path(G.rectX(.2, W - .2, y, .2, H - .2), 'rgba(165,220,210,.05)');
    s += '<g transform="' + G.frontDown(0, y, H) + '"><path d="M' + r2(W * .52) + ' .6L' + r2(W * .66) + ' .6L' + r2(W * .3) + ' ' + r2(H - .6) + 'L' + r2(W * .16) + ' ' + r2(H - .6) + 'Z" class="cf-door-shine"/>' +
      '<path d="M' + r2(W * .72) + ' .6L' + r2(W * .76) + ' .6L' + r2(W * .4) + ' ' + r2(H - .6) + 'L' + r2(W * .36) + ' ' + r2(H - .6) + 'Z" class="cf-door-shine"/></g>';
    s += path(G.rectX(.2, W - .2, y, .2, H - .2), null, 'class="cf-door-edge"');
    s += path(G.rectZ(.2, W - .2, y - .5, y, H - .2), 'rgba(80,170,150,.5)') + path(G.rectY(G.side(.2, W - .2), y - .5, y, .2, H - .2), 'rgba(80,170,150,.5)');
    [4.2, H - 4.2].forEach(function (zz) {
      s += '<g transform="' + G.frontDown(hx, y - .5, zz) + '"><circle r="1.55" fill="url(#' + X.uid + '-chrome)"/><circle r="1.55" fill="none" class="cf-edge"/><circle r=".6" fill="none" class="cf-edge-soft"/></g>';
    });
    return s;
  };
  PAINTERS.glassDoor.front = true;

  // ------------------------------------------------------------------- styles

  var CSS = [
    '.cf-root{--cf-bg:var(--bg,#080812);--cf-bg2:var(--bg2,#0d0d1c);--cf-panel:var(--panel,#1a1a2e);--cf-border:var(--border,rgba(99,102,241,.15));',
    '--cf-accent:var(--accent,#6366f1);--cf-accent2:var(--accent2,#c4b5fd);--cf-amber:var(--amber,#f59e0b);--cf-green:var(--green,#34d399);--cf-red:var(--red,#ef4444);',
    '--cf-text:var(--text,#e2e8f0);--cf-dim:var(--text-dim,#94a3b8);--cf-bright:var(--text-bright,#f1f5f9);',
    '--cf-serif:"Playfair Display",Georgia,serif;--cf-body:"Lora",Georgia,serif;--cf-mono:"DM Mono",ui-monospace,Menlo,Consolas,monospace;',
    'container-type:inline-size;color:var(--cf-text);font-family:var(--cf-body);display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}',
    '@container (min-width:760px){.cf-root .cf-layout{grid-template-columns:minmax(0,1.35fr) minmax(250px,1fr)}}',
    '.cf-layout{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);align-items:start}',
    '.cf-card{position:relative;margin:0;padding:40px 14px 44px;background:var(--cf-bg2);border:1px solid var(--cf-border);border-radius:4px;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}',
    '.cf-corner{position:absolute;font-family:var(--cf-mono);font-size:10.5px;letter-spacing:.06em;line-height:1;color:var(--cf-dim);white-space:nowrap;pointer-events:none}',
    '.cf-corner[data-c="fig"]{top:16px;left:16px;color:var(--cf-text)}',
    '.cf-corner[data-c="title"]{top:16px;right:16px;text-transform:uppercase;letter-spacing:.12em}',
    '.cf-corner[data-c="hint"]{bottom:16px;left:16px;text-transform:uppercase;letter-spacing:.12em}',
    '.cf-corner[data-c="readout"]{bottom:16px;right:16px;color:var(--cf-accent2);font-variant-numeric:tabular-nums}',
    '@container (max-width:420px){.cf-root .cf-corner[data-c="hint"]{display:none}}',
    '@container (max-width:600px){.cf-root[data-zoom] .cf-corner[data-c="title"]{display:none}}',
    '.cf-stage{display:grid;position:relative}',
    '.cf-stage>*{grid-area:1/1}',
    '.cf-svg{display:block;width:100%;height:auto;max-height:min(82vh,940px);margin:0 auto;overflow:hidden;touch-action:manipulation}',
    '.cf-fog,.cf-front{pointer-events:none}',
    '.cf-fog{width:100%;height:100%;display:block;transition:opacity .5s}',
    '.cf-root[data-gl] .cf-fx-mist{display:none}',
    // zoom: the rest of the cupboard steps back, the zoomed cube's glass door fades so the inside reads
    '.cf-cube,.cf-svg>.cf-part[data-cube]{transition:opacity .5s}',
    '.cf-root[data-zoom] .cf-cube:not([data-zoomed]),.cf-root[data-zoom] .cf-svg>.cf-part[data-cube]:not([data-zoomed]){opacity:.18}',
    '.cf-root[data-zoom] .cf-svg>.cf-part[data-cube][data-zoomed]{opacity:.35}',
    '.cf-root[data-zoom] .cf-hl{opacity:0!important}',
    '.cf-back{position:absolute;z-index:3;top:10px;left:50%;transform:translateX(-50%);padding:5px 12px;border-radius:999px;border:1px solid var(--cf-border);background:rgba(13,13,28,.92);color:var(--cf-accent2);font-family:var(--cf-mono);font-size:11px;letter-spacing:.06em;cursor:pointer}',
    '.cf-back:hover{border-color:var(--cf-accent2)}',
    '.cf-back:focus-visible,.cf-chip-btn:focus-visible{outline:2px solid var(--cf-accent2);outline-offset:2px}',
    '.cf-chip-btn{background:none;cursor:pointer}',
    '.cf-chip-btn:hover{border-color:var(--cf-accent2);color:var(--cf-text)}',
    '.cf-demo{border-style:dashed;border-color:rgba(245,158,11,.4)}',
    '.cf-demo .cf-kicker{color:var(--cf-amber)}',
    '.cf-demo-note{margin:10px 0 0;font-size:12.5px;line-height:1.5;color:var(--cf-dim)}',
    '.cf-badge[data-net="demo"]{color:var(--cf-amber)}',
    '.cf-svg path,.cf-svg circle,.cf-svg ellipse,.cf-svg rect{vector-effect:non-scaling-stroke}',
    '.cf-svg [data-cube]{cursor:pointer;outline:none}',
    '.cf-edge{fill:none;stroke:rgba(0,0,0,.55);stroke-width:.6px;stroke-linejoin:round}',
    '.cf-edge-soft{fill:none;stroke:rgba(255,255,255,.07);stroke-width:.6px}',
    '.cf-edge-wood{fill:none;stroke:#7d6a4c;stroke-width:.6px;stroke-linejoin:round}',
    '.cf-carcass-edge{fill:none;stroke:rgba(255,236,220,.08);stroke-width:.6px;stroke-linejoin:round}',
    '.cf-line{fill:none;stroke-width:.6px}',
    '.cf-texture{fill:none;stroke-width:.6px;stroke-linecap:round}',
    '.cf-grain{fill:none;stroke:rgba(120,92,58,.35);stroke-width:.5px}',
    '.cf-seam{fill:none;stroke:#8f7a58;stroke-width:.6px}',
    '.cf-glass-edge{fill:none;stroke:rgba(140,215,200,.55);stroke-width:.7px;stroke-linejoin:round}',
    '.cf-acrylic-edge{fill:none;stroke:rgba(230,240,245,.5);stroke-width:.6px;stroke-linejoin:round}',
    '.cf-faint{stroke:rgba(230,240,245,.16)}',
    '.cf-bottle-edge{fill:none;stroke:rgba(255,255,255,.14);stroke-width:.6px}',
    '.cf-bottle-text{font-family:var(--cf-mono);text-anchor:middle;dominant-baseline:middle;letter-spacing:.02em}',
    '.cf-bottle-text[data-serif]{font-family:var(--cf-serif)}',
    '.cf-vents{fill:rgba(20,20,24,.28)}',
    '.cf-clip{fill:rgba(235,242,245,.22);stroke:rgba(235,242,245,.5);stroke-width:.5px}',
    '.cf-foot{fill:rgba(255,255,255,.75)}',
    '.cf-shine{fill:rgba(255,255,255,.05)}',
    '.cf-door-shine{fill:rgba(220,255,245,.045)}',
    '.cf-door-edge{fill:none;stroke:rgba(110,195,175,.55);stroke-width:1px}',
    '.cf-glint{fill:none;stroke:rgba(255,255,255,.22);stroke-width:1.2px;stroke-linecap:round}',
    '.cf-shine-line{fill:none;stroke:rgba(255,255,255,.4);stroke-width:.8px;stroke-linecap:round}',
    '.cf-engrave{stroke:#6d7276;stroke-width:.6px}',
    '.cf-web{fill:none;stroke:rgba(240,240,240,.38);stroke-width:.5px}',
    '.cf-stem{fill:none;stroke:#6e3b33;stroke-width:.8px;stroke-linecap:round}',
    '.cf-frond{fill:none;stroke:#3f7a35;stroke-width:1.2px;stroke-linecap:round}',
    '.cf-stick{fill:none;stroke:#9a9a72;stroke-width:1.3px;stroke-linecap:round}',
    '.cf-stick-leg{fill:none;stroke:#9a9a72;stroke-width:.6px;stroke-linecap:round}',
    '.cf-leg{fill:none;stroke-width:.7px;stroke-linecap:round;stroke-linejoin:round}',
    '.cf-mesh{fill:none;stroke:#4a4d50;stroke-width:.4px}',
    '.cf-tube{fill:none;stroke:rgba(225,238,240,.65);stroke-width:1.3px;stroke-linecap:round}',
    '.cf-cable{fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.cf-wire-red{fill:none;stroke:#b0302a;stroke-width:.8px;stroke-linecap:round}',
    '.cf-fan-ring{stroke:#2a2a2e;stroke-width:.8px;transition:stroke .4s}',
    '.cf-part[data-active="on"] .cf-fan-ring{stroke:var(--cf-green)}',
    '.cf-oled-title{font-family:var(--cf-mono);font-size:.5px;fill:#7fdcff;letter-spacing:.02em}',
    '.cf-oled-value{font-family:var(--cf-mono);font-size:.95px;fill:#d9f6ff;font-weight:500}',
    // LED panels follow the timer: root[data-leds]
    '.cf-led-face{fill:#b9b9b4;transition:fill .8s}',
    '.cf-led-dot{fill:#8a8a80;transition:fill .8s}',
    '.cf-led-strip{fill:none;stroke:rgba(0,0,0,.18);stroke-width:.5px}',
    '.cf-led-edge{fill:#cfcfca;transition:fill .8s}',
    '.cf-cone{opacity:0;transition:opacity 1.2s;mix-blend-mode:screen;pointer-events:none}',
    '.cf-dim{fill:#04030a;opacity:.34;transition:opacity 1.2s;pointer-events:none}',
    '.cf-root[data-leds="on"] .cf-led-face{fill:#fffaf0}',
    '.cf-root[data-leds="on"] .cf-led-dot{fill:#fff3c4}',
    '.cf-root[data-leds="on"] .cf-led-edge{fill:#fff8e8}',
    '.cf-root[data-leds="on"] .cf-cone{opacity:1}',
    '.cf-root[data-leds="on"] .cf-dim{opacity:0}',
    // live effects: a part bound to a ThingSpeak output gets data-active="on|off|unknown"
    '.cf-fx-mist,.cf-fx-bubbles{opacity:0;transition:opacity .8s}',
    '.cf-part[data-active="on"] .cf-fx-mist,.cf-part[data-active="on"] .cf-fx-bubbles{opacity:1}',
    '.cf-fx-glow{opacity:0;transition:opacity .8s}',
    '.cf-part[data-active="on"] .cf-fx-glow{opacity:.9}',
    '.cf-fx-spin{transform-box:view-box;transform-origin:0 0}',
    '.cf-part[data-active="on"] .cf-fx-spin{animation:cf-spin .42s linear infinite}',
    '.cf-puff{transform-box:fill-box;transform-origin:50% 50%;animation:cf-mist 5.2s ease-out infinite;opacity:0}',
    '.cf-bubble{fill:rgba(240,250,255,.85);animation:cf-bubble 2s ease-in infinite;opacity:0}',
    '.cf-part:not([data-active="on"]) .cf-puff,.cf-part:not([data-active="on"]) .cf-bubble{animation-play-state:paused}',
    '@keyframes cf-spin{to{transform:rotate(360deg)}}',
    '@keyframes cf-mist{0%{transform:translate(0,0) scale(.85);opacity:0}12%{opacity:1}70%{opacity:.55}100%{transform:translate(var(--mx),var(--my)) scale(2.6);opacity:0}}',
    '@keyframes cf-bubble{0%{transform:translate(0,0);opacity:0}10%{opacity:.95}85%{opacity:.85}100%{transform:translate(var(--dx),var(--rise));opacity:0}}',
    '.cf-root[data-offscreen] .cf-svg *{animation-play-state:paused!important}',
    '@media (prefers-reduced-motion:reduce){',
    '.cf-svg *{animation:none!important;transition:none!important}',
    '.cf-puff{opacity:.4;transform:translate(0,var(--s0)) scale(1.6)}',
    '.cf-bubble{opacity:.85;transform:translate(0,var(--s0))}',
    '.cf-fx-spin{transform:rotate(14deg)}',
    '}',
    // highlight + tooltip
    '.cf-hl{fill:none;stroke:var(--cf-accent2);stroke-width:1.4px;opacity:0;transition:opacity .25s;pointer-events:none}',
    '.cf-hl[data-on]{opacity:.9}',
    '.cf-hl[data-pinned]{opacity:1;stroke:var(--cf-accent2);stroke-width:2px}',
    '.cf-tip{position:absolute;z-index:2;pointer-events:none;max-width:240px;padding:6px 9px;border-radius:3px;background:rgba(13,13,28,.94);border:1px solid var(--cf-border);',
    'font-family:var(--cf-mono);font-size:11px;line-height:1.35;color:var(--cf-bright);transform:translate(-50%,calc(-100% - 12px));white-space:normal}',
    '.cf-tip[hidden]{display:none}',
    '.cf-tip small{display:block;color:var(--cf-dim);font-size:10px}',
    // side panel
    '.cf-panel{display:grid;gap:14px;align-content:start;min-width:0}',
    '.cf-box{background:var(--cf-panel);border:1px solid var(--cf-border);border-radius:4px;padding:14px 16px;min-width:0}',
    '.cf-kicker{font-family:var(--cf-mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--cf-dim);margin:0 0 10px}',
    '.cf-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:var(--cf-mono);font-size:12px;color:var(--cf-dim)}',
    '.cf-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;border:1px solid currentColor;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}',
    '.cf-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
    '.cf-badge[data-net="live"]{color:var(--cf-green)}.cf-badge[data-net="stale"]{color:var(--cf-amber)}.cf-badge[data-net="offline"]{color:var(--cf-red)}.cf-badge[data-net="connecting"]{color:var(--cf-dim)}',
    '.cf-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}',
    '.cf-metric{font-family:var(--cf-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cf-dim)}',
    '.cf-metric b{display:block;margin-top:4px;font-family:var(--cf-serif);font-size:28px;font-weight:700;letter-spacing:0;text-transform:none;color:var(--cf-bright);font-variant-numeric:tabular-nums}',
    '.cf-metric b[data-level="warn"]{color:var(--cf-amber)}.cf-metric b[data-level="danger"]{color:var(--cf-red)}',
    '.cf-root[data-net="stale"] .cf-metric b,.cf-root[data-net="offline"] .cf-metric b{opacity:.45}',
    '.cf-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}',
    '.cf-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-family:var(--cf-mono);font-size:11px;border:1px solid rgba(148,163,184,.25);color:var(--cf-dim)}',
    '.cf-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:rgba(148,163,184,.4)}',
    '.cf-chip[data-state="on"]{color:var(--cf-green);border-color:rgba(52,211,153,.4)}.cf-chip[data-state="on"]::before{background:var(--cf-green)}',
    '.cf-chip[data-state="unknown"]{opacity:.6}',
    '.cf-info h3{font-family:var(--cf-serif);font-size:19px;font-weight:700;line-height:1.25;color:var(--cf-bright);margin:0 0 6px}',
    '.cf-info p{margin:0 0 10px;font-size:14px;line-height:1.55;color:var(--cf-dim)}',
    '.cf-info ul{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:7px}',
    '.cf-res{font-size:14px;line-height:1.4;padding-left:10px;border-left:2px solid rgba(99,102,241,.35);transition:border-color .2s,background .2s}',
    '.cf-res[data-hot]{border-left-color:var(--cf-accent2);background:rgba(196,181,253,.06)}',
    '.cf-res i{color:var(--cf-bright)}',
    '.cf-res span{display:block;font-family:var(--cf-mono);font-size:11px;color:var(--cf-dim)}',
    '.cf-res em{font-style:normal;color:var(--cf-amber)}',
    '.cf-parts li{font-family:var(--cf-mono);font-size:11.5px;color:var(--cf-dim)}',
    '.cf-parts li b{font-weight:500;color:var(--cf-accent2)}',
    '.cf-caption{margin:0;font-size:13px;line-height:1.6;color:var(--cf-dim);max-width:72ch}',
    '.cf-error{padding:16px;border:1px solid var(--cf-red);border-radius:4px;font-family:var(--cf-mono);font-size:12px;color:var(--cf-red)}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('cf-style')) return;
    var st = document.createElement('style');
    st.id = 'cf-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------- build

  function defsSvg(uid) {
    function lin(id, stops, vertical) {
      return '<linearGradient id="' + uid + '-' + id + '"' + (vertical ? ' x1="0" y1="0" x2="0" y2="1"' : ' x1="0" y1="0" x2="1" y2="0"') + '>' +
        stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>';
    }
    function rad(id, stops) {
      return '<radialGradient id="' + uid + '-' + id + '">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '" stop-opacity="' + s[2] + '"/>'; }).join('') + '</radialGradient>';
    }
    return '<defs>' +
      lin('glass', [[0, '#ffffff', .16], [.18, '#ffffff', .03], [.6, '#ffffff', 0], [.85, '#ffffff', .07], [1, '#ffffff', .18]]) +
      lin('bottle', [[0, '#000000', .45], [.25, '#ffffff', .12], [.4, '#ffffff', .02], [.8, '#000000', .2], [1, '#000000', .5]]) +
      lin('white', [[0, '#a9aaa6'], [.3, '#f4f4f1'], [.7, '#dededa'], [1, '#9c9d99']]) +
      lin('pot', [[0, '#5c5f63'], [.32, '#a3a6aa'], [.7, '#86898d'], [1, '#55585b']]) +
      lin('chrome', [[0, '#f2f4f6'], [.5, '#9ea4aa'], [1, '#d9dde0']], true) +
      lin('water', [[0, '#7fa36a', .35], [.3, '#cfe3b0', .32], [.7, '#a9c88a', .3], [1, '#6f9658', .38]]) +
      lin('wall-l', [[0, '#e6e7e2'], [1, '#c9cac4']]) +
      lin('wall-b', [[0, '#cfd0ca'], [1, '#bfc0ba']], true) +
      lin('cone', [[0, '#fff6dc', .36], [.55, '#fff2d0', .1], [1, '#fff2d0', 0]], true) +
      rad('puff', [[0, '#d6efff', .95], [.55, '#a9d8f5', .55], [1, '#9fd0ef', 0]]) +
      rad('glow', [[0, '#c4b5fd', .9], [1, '#c4b5fd', 0]]) +
      '<filter id="' + uid + '-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
      '</defs>';
  }

  function cubeGeom(cfg) {
    var cb = cfg.cupboard, to = cb.outerBoard, ti = cb.innerBoard;
    var w = (cb.width - 2 * to - ti) / 2, h = (cb.height - 2 * to - 3 * ti) / 4;
    return {
      w: w, h: h, d: cb.depth,
      origin: function (row, col) { return [to + col * (w + ti), 0, to + (row - 1) * (h + ti)]; }
    };
  }

  function build(root, cfg, opts) {
    var uid = 'cf' + (++instanceCount);
    var prefix = instanceCount === 1 ? '' : uid + '-';
    var cam = camera(cfg.camera.azimuth, cfg.camera.elevation);
    var CG = cubeGeom(cfg), cb = cfg.cupboard, Wc = cb.width, Hc = cb.height, Dc = cb.depth;
    var world = frame(cam, 0, 0, 0);

    // view box from the carcass corners plus a margin
    var xs = [], ys = [];
    [0, Wc].forEach(function (x) { [0, Dc].forEach(function (y) { [0, Hc].forEach(function (z) { var q = cam.p(x, y, z); xs.push(q[0]); ys.push(q[1]); }); }); });
    var pad = 3, vb = [Math.min.apply(0, xs) - pad, Math.min.apply(0, ys) - pad, 0, 0];
    vb[2] = Math.max.apply(0, xs) + pad - vb[0]; vb[3] = Math.max.apply(0, ys) + pad + 2 - vb[1];

    var parts = (cfg.parts || []).filter(function (p) {
      if (!safeId(p.id) || !safeId(p.cube)) { console.warn('[cupboard-figure] skipped part with a bad id', p.id); return false; }
      if (!PAINTERS[p.kind]) { console.warn('[cupboard-figure] no painter for kind "' + p.kind + '" (' + p.id + ')'); return false; }
      return true;
    });

    var svg = '<svg class="cf-svg" xmlns="' + NS + '" viewBox="' + vb.map(r2).join(' ') + '" role="group" aria-label="Isometric drawing of the cupboard">' + defsSvg(uid);
    // soft shadow under the cupboard
    svg += '<path d="' + world.rectZ(-3, Wc + 3, -3, Dc + 4, 0) + '" fill="#000" opacity=".55" filter="url(#' + uid + '-blur)"/>';

    var frontLayer = '', hlLayer = '', boxes = {}, fogFront = '', fogDoor = '', fogGeom = null;
    var fogCfg = cfg.fog && safeId(cfg.fog.cube) ? cfg.fog : null;
    cfg.cubes.forEach(function (cube) {
      if (!safeId(cube.id)) return;
      var o = CG.origin(cube.row, cube.col), G = frame(cam, o[0], o[1], o[2]);
      var X = { uid: uid, cube: { w: CG.w, h: CG.h, d: CG.d }, cam: cam };
      var mine = parts.filter(function (p) { return p.cube === cube.id; });
      var opening = G.rectX(0, CG.w, 0, 0, CG.h);
      // screen box of the whole cube, for zooming
      var bx = [], by = [];
      [0, CG.w].forEach(function (x) { [0, CG.d].forEach(function (y) { [0, CG.h].forEach(function (z) { var q = G.P(x, y, z); bx.push(q[0]); by.push(q[1]); }); }); });
      boxes[cube.id] = [Math.min.apply(0, bx), Math.min.apply(0, by), Math.max.apply(0, bx), Math.max.apply(0, by)];
      // shell: the cupboard's own inner surfaces (open back = dark void)
      var shell = path(G.rectX(0, CG.w, CG.d, 0, CG.h), '#0b0909') +
        path(G.rectY(G.far(0, CG.w), 0, CG.d, 0, CG.h), '#1b1512') +
        path(G.rectZ(0, CG.w, 0, CG.d, 0), '#2d231f') +
        path(G.d([[G.far(0, CG.w), 0, 0], [G.far(0, CG.w), CG.d, 0], [G.side(0, CG.w), CG.d, 0]], true), null, 'class="cf-edge"');

      // levels: shelves split the cube; walls/cables first in each level; LED panels on top
      var split = null;
      mine.forEach(function (p) { if (PAINTERS[p.kind].split) split = PAINTERS[p.kind].split(p); });
      var items = mine.filter(function (p) { return !PAINTERS[p.kind].front; }).map(function (p) {
        var P = PAINTERS[p.kind], at = p.at || [p.x0 != null ? (p.x0 + p.x1) / 2 : CG.w / 2, p.y0 != null ? (p.y0 + p.y1) / 2 : CG.d / 2, p.z || 0];
        var cx = at[0] + (p.size && p.size.length === 3 ? p.size[0] / 2 : 0), cy = at[1] + (p.size && p.size.length === 3 ? p.size[1] / 2 : 0);
        var level = P.level != null ? P.level : P.split ? 1 : (split != null && at[2] >= split ? 2 : 0);
        if (p.level != null) level = p.level;
        var out = P(G, p, X);
        if (typeof out === 'string') out = { main: out };
        return { p: p, level: level, layer: P.layer != null ? P.layer : 1, key: G.depth(cx, cy, 0), out: out };
      });
      items.sort(function (a, b) { return a.level - b.level || a.layer - b.layer || a.key - b.key; });

      function grp(p, inner, suffix) {
        return '<g class="cf-part" id="' + prefix + p.id + (suffix || '') + '" data-part="' + p.id + '"' + (suffix ? ' data-part-piece="' + suffix.slice(2) + '"' : '') + '>' + inner + '</g>';
      }
      var under = '', main = '', over = '';
      items.forEach(function (it) {
        if (it.out.under) under += grp(it.p, it.out.under, it.out.main ? '--back' : '');
        if (it.out.main) main += grp(it.p, it.out.main, '');
        if (it.out.over) over += grp(it.p, it.out.over, '--front');
      });
      var dim = cube.lit ? '<path class="cf-dim" d="' + opening + '"/>' : '';
      svg += '<g class="cf-cube" id="' + prefix + cube.id + '" data-cube="' + cube.id + '" tabindex="0" role="button">' +
        '<clipPath id="' + uid + '-clip-' + cube.id + '"><path d="' + opening + '"/></clipPath>' +
        '<g clip-path="url(#' + uid + '-clip-' + cube.id + ')">' + shell + under + main + over + dim + '</g></g>';

      mine.filter(function (p) { return PAINTERS[p.kind].front; }).forEach(function (p) {
        var door = PAINTERS[p.kind](G, p, X);
        frontLayer += '<g class="cf-part" id="' + prefix + p.id + '" data-part="' + p.id + '" data-cube="' + cube.id + '"' +
          (p.kind === 'glassDoor' ? ' style="pointer-events:none"' : '') + '>' + door + '</g>';
        if (fogCfg && fogCfg.cube === cube.id) fogDoor += '<g class="cf-part" data-cube="' + cube.id + '" data-door>' + door + '</g>';
      });

      // The fog cube: a copy of everything that stands in front of the fog (terras, shelf, insert edges, door)
      // goes into a front SVG above the fog canvas, and the shader gets the same numbers as the drawing.
      if (fogCfg && fogCfg.cube === cube.id) {
        items.forEach(function (it) {
          if (FOG_FRONT_KINDS.indexOf(it.p.kind) < 0) return;
          var inner = (it.out.main || '') + (it.out.over || '');
          if (inner) fogFront += '<g data-front-of="' + it.p.id + '">' + inner + '</g>';
        });
        var byId = {};
        mine.forEach(function (p) { byId[p.id] = p; });
        var fg = byId[fogCfg.fogger], sh = byId[fogCfg.shelf], fan = byId[fogCfg.fan];
        var ins = mine.filter(function (p) { return p.kind === 'whiteInsert'; })[0];
        if (fg && sh) {
          fogGeom = {
            origin: cam.p(o[0], o[1], o[2]), cam: cam,
            cube: [CG.w, ins ? (ins.back || 37.5) : CG.d, CG.h], wall: ins ? 1 : 0,
            fogger: [fg.at[0], fg.at[1], fg.at[2] + fg.h, fg.r],
            shelf: [sh.z, sh.z + 0.6],
            notch: sh.notch ? [sh.x1 - sh.notch[0], sh.y1 - sh.notch[1], sh.x1, sh.y1] : [sh.x1 - 6, sh.y1 - 6, sh.x1, sh.y1],
            fan: fan ? fan.at : null,
            terras: mine.filter(function (p) { return p.kind === 'acrylicTerra'; }).slice(0, 4).map(function (p) {
              return { min: [p.at[0], p.at[1], p.at[2]], max: [p.at[0] + p.size[0], p.at[1] + p.size[1], p.at[2] + p.size[2]], sub: p.at[2] + p.size[2] * 0.3 };
            }),
            clip: opening
          };
        }
      }
      hlLayer += '<path class="cf-hl" data-hl="' + cube.id + '" d="' + opening + '"/>';
    });

    // the carcass: board fronts (outer rect minus the 8 openings), right side, top
    var fronts = world.rectX(0, Wc, 0, 0, Hc);
    cfg.cubes.forEach(function (cube) { var o = CG.origin(cube.row, cube.col); fronts += world.rectX(o[0], o[0] + CG.w, 0, o[2], o[2] + CG.h); });
    var finish = tones(cb.finish || '#2b211d'), grain = '';
    var sideX = world.side(0, Wc);
    for (var gy = 4; gy < Dc; gy += 5.5) grain += path(world.d([[sideX, gy, 0], [sideX, gy + .4, Hc]], true), null, 'class="cf-line" stroke="rgba(255,230,210,.035)"');
    for (var gx = 6; gx < Wc; gx += 7) grain += path(world.d([[gx, 0, Hc], [gx + .5, Dc, Hc]], true), null, 'class="cf-line" stroke="rgba(255,230,210,.035)"');
    svg += '<g class="cf-part" id="' + prefix + 'part-cupboard" data-part="part-cupboard">' +
      '<path d="' + fronts + '" fill="' + finish.front + '" fill-rule="evenodd"/>' +
      path(world.rectY(sideX, 0, Dc, 0, Hc), finish.right) + path(world.rectZ(0, Wc, 0, Dc, Hc), finish.top) + grain +
      path(fronts, null, 'class="cf-carcass-edge" fill-rule="evenodd"') +
      path(boxEdges(world, 0, 0, 0, Wc, Dc, Hc), null, 'class="cf-edge"') +
      '</g>';
    svg += frontLayer + '<g class="cf-hls">' + hlLayer + '</g></svg>';
    var front = fogGeom ? '<svg class="cf-svg cf-front" xmlns="' + NS + '" viewBox="' + vb.map(r2).join(' ') + '" aria-hidden="true" focusable="false">' +
      '<clipPath id="' + uid + '-fclip"><path d="' + fogGeom.clip + '"/></clipPath>' +
      '<g class="cf-cube" data-cube="' + fogCfg.cube + '"><g clip-path="url(#' + uid + '-fclip)">' + fogFront + '</g></g>' + fogDoor + '</svg>' : '';
    return { svg: svg, front: front, uid: uid, prefix: prefix, vb: vb, boxes: boxes, fog: fogGeom };
  }

  // ------------------------------------------------------------- live data

  function ukNow(tz) {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var h = parseInt(o.hour, 10) % 24, m = parseInt(o.minute, 10), s = parseInt(o.second, 10);
    return { h: h, m: m, s: s, minutes: h * 60 + m, text: o.hour.replace('24', '00') + ':' + o.minute + ':' + o.second };
  }
  function hm(str) { var a = String(str).split(':'); return parseInt(a[0], 10) * 60 + parseInt(a[1] || 0, 10); }
  function timerOn(t, minutes) {
    var on = hm(t.on), off = hm(t.off);
    return on <= off ? (minutes >= on && minutes < off) : (minutes >= on || minutes < off);
  }
  function parseBool(v) { if (v == null || v === '') return null; return String(v).trim() === '1'; }
  function parseNum(v) { if (v == null || v === '') return null; var n = parseFloat(v); return isFinite(n) ? n : null; }
  function clockTime(d, tz) { return d.toLocaleTimeString('en-GB', { timeZone: tz || 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

  // ------------------------------------------------------------- WebGL fog
  // A volume ray-marched in the fog cube's own coordinates (cm), so it registers with the drawing:
  // a plume from the fogger, up through the broken shelf corner, spreading in the upper level;
  // a layer along the floor that the fan pushes left to right; a little fog seeping into the terras.
  // The substrate blocks are opaque occluders; terras, shelf and door sit in the front SVG above the canvas.

  var FOG_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FOG_FS = [
    'precision highp float;',
    'uniform vec2 uCanvas;uniform vec4 uVB;uniform vec3 uMap;uniform vec2 uO;uniform vec4 uCam;',
    'uniform float uTime,uLevel,uUpper,uPool,uSeep,uFan,uAdv,uLight;',
    'uniform vec3 uCube;uniform float uWall;uniform vec4 uFogger;uniform vec4 uNotch;uniform vec2 uShelf;uniform vec3 uColour;',
    'uniform vec4 uTMin[4];uniform vec4 uTMax[4];',
    'float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
    'float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
    'float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),',
    '  mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    'float win(float x,float a,float b,float s){return smoothstep(a-s,a+s,x)*(1.-smoothstep(b-s,b+s,x));}',
    'float density(vec3 p){',
    ' float t=uTime;',
    // the plume: centre and radius follow the height
    ' float hz=clamp((p.z-uFogger.z)/(uShelf.x-uFogger.z),0.,1.);',
    ' vec2 nc=(uNotch.xy+uNotch.zw)*.5;',
    ' float up=max(p.z-uShelf.y,0.);',
    ' float above=smoothstep(uShelf.x,uShelf.y+.5,p.z);',
    ' vec2 lowC=mix(uFogger.xy,nc,smoothstep(0.,1.,hz))+vec2(uFan*1.1*hz,0.);',
    ' vec2 cen=mix(lowC,nc+vec2(-.38*up,-.8*up),above);',
    ' float r=mix(uFogger.w*.6+1.5*hz,2.4+.6*up,above);',
    ' vec2 dq=p.xy-cen;',
    ' float wisp=noise3(vec3(p.x*.3,p.y*.3,p.z*.24-t*.8))*.6+noise3(vec3(p.x*.75+3.1,p.y*.75,p.z*.55-t*1.4))*.3+noise3(vec3(p.x*1.6,p.y*1.6,p.z*1.2-t*2.2))*.1;',
    ' wisp=smoothstep(.28,.82,wisp);',
    ' float plume=exp(-dot(dq,dq)/(r*r))*smoothstep(uFogger.z-.2,uFogger.z+1.4,p.z)*(.08+1.3*wisp)*mix(uLevel,.55*uLevel+.45*uUpper,above);',
    // the shelf stops the fog everywhere but the broken corner
    ' float slab=win(p.z,uShelf.x,uShelf.y,.2);',
    ' float notch=win(p.x,uNotch.x,uNotch.z,.35)*win(p.y,uNotch.y,uNotch.w,.35);',
    ' float block=1.-slab*(1.-notch);',
    // the floor layer, pushed left to right by the fan
    ' float reach=uPool*28.;',
    ' float pool=uPool*smoothstep(6.5,.5,p.z)*smoothstep(uFogger.x-reach-3.,uFogger.x-reach+3.,p.x)',
    '  *smoothstep(.3,.85,noise3(vec3((p.x-uAdv)*.22,p.y*.28,p.z*.35+t*.07))*.7+noise3(vec3((p.x-uAdv)*.6,p.y*.6,p.z*.8))*.3)*1.4;',
    // haze in the upper and lower levels
    ' float upper=uUpper*.55*smoothstep(uShelf.y,uShelf.y+2.5,p.z)*smoothstep(.4,.9,noise3(vec3(p.x*.2+t*.05,p.y*.2,p.z*.25-t*.12))*.7+noise3(vec3(p.x*.55,p.y*.55,p.z*.6-t*.3))*.3);',
    ' float lower=uPool*.25*(1.-above)*smoothstep(.4,.9,noise3(vec3((p.x-uAdv)*.16,p.y*.16,p.z*.22))*.7+noise3(vec3((p.x-uAdv)*.5,p.y*.5,p.z*.5))*.3);',
    // fade to zero at every wall, floor and ceiling (real surfaces the drawing shows)
    ' float walls=smoothstep(uWall,uWall+1.,p.x)*smoothstep(uWall,uWall+1.,uCube.x-p.x)*smoothstep(0.,.6,p.z)*smoothstep(0.,1.2,uCube.z-p.z)*smoothstep(0.,1.,uCube.y-p.y);',
    ' return (plume*1.7+pool+upper+lower)*block*walls;',
    '}',
    'void main(){',
    ' vec2 fc=vec2(gl_FragCoord.x,uCanvas.y-gl_FragCoord.y);',
    ' vec2 vb=uVB.xy+(fc-uMap.yz)/uMap.x;',
    ' vec2 S=vb-uO;',
    ' float c=uCam.x,s=uCam.y,cp=uCam.z,sp=uCam.w;',
    ' float x0=S.x/c,z0=(x0*s*sp-S.y)/cp;',
    ' float px=1./(uMap.x);',
    ' float open=win(x0,0.,uCube.x,px*.7)*win(z0,0.,uCube.z,px*.7);',
    ' if(open<=0.||uLevel+uUpper+uPool<.0005){gl_FragColor=vec4(0.);return;}',
    ' const int N=44;float y0=.6,dy=(uCube.y-y0)/float(N);',
    ' float j=hash12(gl_FragCoord.xy+fract(uTime*.37)*61.);',
    ' float acc=0.;',
    ' for(int i=0;i<N;i++){',
    '  float y=y0+(float(i)+j)*dy;',
    '  float x=(S.x-y*s)/c;float z=((x*s-y*c)*sp-S.y)/cp;',
    '  if(x<0.||x>uCube.x||z<0.||z>uCube.z)break;',
    '  bool hit=false;float inT=0.;',
    '  for(int k=0;k<4;k++){',
    '   vec4 a=uTMin[k],b=uTMax[k];',
    '   if(b.x>a.x&&x>a.x&&x<b.x&&y>a.y&&y<b.y&&z>a.z&&z<b.z){inT=1.;if(z<a.w)hit=true;}',
    '  }',
    '  if(hit)break;',
    '  float d=density(vec3(x,y,z));',
    '  acc+=d*mix(1.,uSeep*.55,inT)*dy;',
    ' }',
    ' float alpha=(1.-exp(-acc*.55))*open;',
    ' vec3 col=uColour*mix(.62,1.,uLight)*(.82+.25*alpha);',
    ' float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.29)*57.)-1.)/255.;',
    ' alpha=max(alpha+n*smoothstep(0.,1.5/255.,alpha),0.);',
    ' gl_FragColor=vec4(col*alpha,alpha);',
    '}'
  ].join('\n');

  function createFog(canvas, geom, opts) {
    var gl = null;
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false }); } catch (e) { gl = null; }
    if (!gl) return null;
    function sh(type, src) {
      var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn('[cupboard-figure] fog shader:', gl.getShaderInfoLog(o)); return null; }
      return o;
    }
    var vs = sh(gl.VERTEX_SHADER, FOG_VS), fs = sh(gl.FRAGMENT_SHADER, FOG_FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[cupboard-figure] fog link failed'); return null; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uCanvas', 'uVB', 'uMap', 'uO', 'uCam', 'uTime', 'uLevel', 'uUpper', 'uPool', 'uSeep', 'uFan', 'uAdv', 'uLight', 'uCube', 'uWall', 'uFogger', 'uNotch', 'uShelf', 'uColour', 'uTMin', 'uTMax']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    var cam = geom.cam, col = hexRgb(opts.colour || '#dcecff').map(function (v) { return v / 255; });
    gl.uniform2f(U.uO, geom.origin[0], geom.origin[1]);
    gl.uniform4f(U.uCam, cam.c, cam.s, cam.cp, cam.sp);
    gl.uniform3f(U.uCube, geom.cube[0], geom.cube[1], geom.cube[2]);
    gl.uniform1f(U.uWall, geom.wall);
    gl.uniform4f(U.uFogger, geom.fogger[0], geom.fogger[1], geom.fogger[2], geom.fogger[3]);
    gl.uniform4f(U.uNotch, geom.notch[0], geom.notch[1], geom.notch[2], geom.notch[3]);
    gl.uniform2f(U.uShelf, geom.shelf[0], geom.shelf[1]);
    gl.uniform3f(U.uColour, col[0], col[1], col[2]);
    var tmin = new Float32Array(16), tmax = new Float32Array(16);
    geom.terras.forEach(function (t, i) {
      tmin.set([t.min[0], t.min[1], t.min[2], t.sub], i * 4);
      tmax.set([t.max[0], t.max[1], t.max[2], 0], i * 4);
    });
    gl.uniform4fv(U.uTMin, tmin); gl.uniform4fv(U.uTMax, tmax);

    // envelopes: every level eases toward its target, so nothing pops
    var env = { level: 0, upper: 0, pool: 0, seep: 0, fan: 0, adv: 0 };
    var target = { fog: 0, fan: 0, light: 1 }, light = 1;
    var attack = opts.attackSeconds || 6, linger = opts.lingerSeconds || 45;
    var view = null, raf = 0, last = 0, t0 = performance.now(), visible = true, reduced = false, size = [0, 0];
    function ease(cur, to, dt, up, down) { var tau = to > cur ? up : down; return cur + (to - cur) * (1 - Math.exp(-dt / tau)); }
    function step(dt) {
      env.level = ease(env.level, target.fog, dt, attack, linger);
      env.upper = ease(env.upper, env.level, dt, attack * 2, linger * 1.3);
      env.pool = ease(env.pool, env.level, dt, attack * 3, linger * 1.4);
      env.seep = ease(env.seep, env.upper, dt, attack * 5, linger * 2);
      env.fan = ease(env.fan, target.fan, dt, 1.2, 2.5);
      env.adv += env.fan * 3.2 * dt;
      light = ease(light, target.light, dt, 1.2, 1.2);
    }
    function settled() {
      return Math.abs(env.level - target.fog) < 1e-3 && Math.abs(env.upper - env.level) < 1e-3 && Math.abs(env.pool - env.level) < 1e-3 &&
        Math.abs(env.seep - env.upper) < 1e-3 && Math.abs(env.fan - target.fan) < 1e-3 && Math.abs(light - target.light) < 1e-3;
    }
    function resize() {
      var r = canvas.getBoundingClientRect(), k = Math.min(global.devicePixelRatio || 1, 1.5) * (opts.quality || 0.75);
      var w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
      if (w !== size[0] || h !== size[1]) { canvas.width = w; canvas.height = h; size = [w, h]; }
      return r;
    }
    function draw(time) {
      var r = resize();
      if (!view || !r.width) return;
      var w = size[0], h = size[1], sc = Math.min(w / view[2], h / view[3]);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.uCanvas, w, h);
      gl.uniform4f(U.uVB, view[0], view[1], view[2], view[3]);
      gl.uniform3f(U.uMap, sc, (w - view[2] * sc) / 2, (h - view[3] * sc) / 2);
      gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uLevel, env.level); gl.uniform1f(U.uUpper, env.upper); gl.uniform1f(U.uPool, env.pool);
      gl.uniform1f(U.uSeep, env.seep); gl.uniform1f(U.uFan, env.fan); gl.uniform1f(U.uAdv, env.adv); gl.uniform1f(U.uLight, light);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frameLoop(now) {
      raf = 0;
      var dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
      step(dt);
      draw((now - t0) / 1000);
      var idle = env.level + env.upper + env.pool < 1e-3 && settled();
      if (visible && !reduced && !idle) raf = requestAnimationFrame(frameLoop);
    }
    function kick() {
      if (reduced) {
        // one representative still frame at the target state
        env.level = env.upper = env.pool = target.fog * 0.7; env.seep = target.fog * 0.5; env.fan = target.fan; light = target.light;
        draw(4.0);
        return;
      }
      if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frameLoop); }
    }
    return {
      set: function (fogOn, fanOn, lightsOn) { target.fog = fogOn ? 1 : 0; target.fan = fanOn ? 1 : 0; target.light = lightsOn ? 1 : 0; kick(); },
      view: function (vb) { view = vb.slice(); if (!raf) { if (reduced) kick(); else draw((performance.now() - t0) / 1000); } kick(); },
      visible: function (v) { visible = v; if (v) kick(); },
      reduced: function (v) { reduced = v; kick(); },
      resize: function () { if (!raf) draw(reduced ? 4.0 : (performance.now() - t0) / 1000); },
      levels: function () { return { level: env.level, upper: env.upper, pool: env.pool, seep: env.seep, fan: env.fan }; }
    };
  }

  // ------------------------------------------------------------------ sound
  // Generated with Web Audio, no files: fan hum, the fogger's hiss and gurgle, the bubbler's pump buzz and bubbles.
  // Off until the viewer switches it on (browsers only allow sound after a click anyway).

  function createSound() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    var ctx = null, master = null, ch = {}, on = false, want = { fogger: false, fan: false, bubbler: false }, bubbleTimer = 0, gurgleTimer = 0;
    function noiseBuffer() {
      var b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0), last = 0;
      for (var i = 0; i < d.length; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
      return b;
    }
    function loopNoise() { var n = ctx.createBufferSource(); n.buffer = ch.noise; n.loop = true; n.start(); return n; }
    function init() {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
      ch.noise = noiseBuffer();
      // fan: band-passed air plus a soft motor tone
      ch.fan = ctx.createGain(); ch.fan.gain.value = 0; ch.fan.connect(master);
      var fanBand = ctx.createBiquadFilter(); fanBand.type = 'bandpass'; fanBand.frequency.value = 700; fanBand.Q.value = 0.6;
      loopNoise().connect(fanBand); fanBand.connect(ch.fan);
      var motor = ctx.createOscillator(); motor.type = 'triangle'; motor.frequency.value = 118;
      var motorG = ctx.createGain(); motorG.gain.value = 0.18; motor.connect(motorG); motorG.connect(ch.fan); motor.start();
      // fogger: thin high hiss (the ultrasonic disc and the mist), gurgles scheduled below
      ch.fogger = ctx.createGain(); ch.fogger.gain.value = 0; ch.fogger.connect(master);
      var hiss = ctx.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 3200;
      var hissG = ctx.createGain(); hissG.gain.value = 0.35;
      loopNoise().connect(hiss); hiss.connect(hissG); hissG.connect(ch.fogger);
      // bubbler: air pump buzz, bubbles scheduled below
      ch.bubbler = ctx.createGain(); ch.bubbler.gain.value = 0; ch.bubbler.connect(master);
      var pump = ctx.createOscillator(); pump.type = 'sawtooth'; pump.frequency.value = 100;
      var pumpLp = ctx.createBiquadFilter(); pumpLp.type = 'lowpass'; pumpLp.frequency.value = 260;
      var pumpG = ctx.createGain(); pumpG.gain.value = 0.12;
      pump.connect(pumpLp); pumpLp.connect(pumpG); pumpG.connect(ch.bubbler); pump.start();
    }
    function blip(dest, f0, f1, dur, vol) {
      var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
    }
    function schedule() {
      clearTimeout(bubbleTimer); clearTimeout(gurgleTimer);
      if (!on) return;
      if (want.bubbler) (function bub() {
        var f = 380 + Math.random() * 500;
        blip(ch.bubbler, f, f * (2 + Math.random()), 0.05 + Math.random() * 0.05, 0.5 + Math.random() * 0.4);
        bubbleTimer = setTimeout(bub, 40 + Math.random() * 140);
      })();
      if (want.fogger) (function gurgle() {
        var f = 160 + Math.random() * 200;
        blip(ch.fogger, f, f * 1.6, 0.09 + Math.random() * 0.08, 0.25);
        gurgleTimer = setTimeout(gurgle, 500 + Math.random() * 1500);
      })();
    }
    function apply() {
      if (!ctx) return;
      var t = ctx.currentTime;
      ch.fan.gain.setTargetAtTime(on && want.fan ? 0.09 : 0, t, 0.4);
      ch.fogger.gain.setTargetAtTime(on && want.fogger ? 0.06 : 0, t, 0.6);
      ch.bubbler.gain.setTargetAtTime(on && want.bubbler ? 0.07 : 0, t, 0.3);
      schedule();
    }
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
    });
    return {
      // call from a click handler: creating/resuming the context needs a user gesture
      enable: function (v) {
        on = v;
        if (on && !ctx) init();
        if (ctx) { if (on) ctx.resume(); apply(); if (!on) setTimeout(function () { if (!on && ctx) ctx.suspend(); }, 1500); }
      },
      set: function (fog, fan, bub) { want.fogger = !!fog; want.fan = !!fan; want.bubbler = !!bub; apply(); },
      isOn: function () { return on; }
    };
  }

  // ---------------------------------------------------------------- mount

  function mount(host, cfg, opts) {
    opts = opts || {};
    injectStyle();
    var labels = cfg.labels || {};
    host.innerHTML = '';
    var root = el('div', { class: 'cf-root', 'data-net': 'connecting', 'data-leds': 'off' }, host);
    var layout = el('div', { class: 'cf-layout' }, root);
    var card = el('figure', { class: 'cf-card' }, layout);
    text(el('div', { class: 'cf-corner', 'data-c': 'fig' }, card), labels.fig || 'Fig 1');
    text(el('div', { class: 'cf-corner', 'data-c': 'title' }, card), labels.title || 'The cupboard');
    var built = build(root, cfg);
    // layer stack: the drawing, the fog canvas, then a front copy of what stands in front of the fog
    var stage = el('div', { class: 'cf-stage' }, card);
    stage.innerHTML = built.svg;
    var svgEl = stage.firstChild, fogCanvas = null, frontEl = null, fog = null;
    if (built.fog && !opts.noWebgl) {
      fogCanvas = el('canvas', { class: 'cf-fog', 'aria-hidden': 'true' }, stage);
      fog = createFog(fogCanvas, built.fog, cfg.fog || {});
      if (fog) {
        var tmp = document.createElement('div');
        tmp.innerHTML = built.front;
        frontEl = tmp.firstChild;
        stage.appendChild(frontEl);
        root.setAttribute('data-gl', '');
      } else { stage.removeChild(fogCanvas); fogCanvas = null; }
    }
    var backBtn = el('button', { class: 'cf-back', type: 'button', hidden: '' }, card);
    text(backBtn, '← ' + (labels.back || 'Whole cupboard'));
    var tip = el('div', { class: 'cf-tip', hidden: '' }, card);
    var hintEl = text(el('div', { class: 'cf-corner', 'data-c': 'hint' }, card), labels.hint || 'Hover or tap a cube');
    var readout = el('div', { class: 'cf-corner', 'data-c': 'readout', 'data-readout': '', 'aria-live': 'off' }, card);

    // side panel
    var panel = el('aside', { class: 'cf-panel' }, layout);
    var liveBox = el('div', { class: 'cf-box' }, panel);
    text(el('p', { class: 'cf-kicker' }, liveBox), 'Climate zone · live');
    var status = el('div', { class: 'cf-status' }, liveBox);
    var badge = text(el('span', { class: 'cf-badge', 'data-net': 'connecting' }, status), 'Connecting');
    var when = text(el('span', null, status), '');
    var metrics = el('div', { class: 'cf-metrics' }, liveBox), metricEls = {};
    (cfg.thingspeak.readings || []).forEach(function (r) {
      var m = el('div', { class: 'cf-metric' }, metrics);
      text(m, r.label);
      metricEls[r.key] = text(el('b', null, m), '--');
    });
    var chips = el('div', { class: 'cf-chips' }, liveBox), chipEls = {};
    (cfg.thingspeak.outputs || []).forEach(function (o) {
      chipEls[o.key] = text(el('span', { class: 'cf-chip', 'data-state': 'unknown', title: o.gpio ? o.gpio + ' · ' + o.field : o.field }, chips), o.label);
    });
    var ledTimer = cfg.ledTimer;
    var ledChip = ledTimer ? text(el('span', { class: 'cf-chip', 'data-state': 'off', title: 'Own timer ' + ledTimer.on + '–' + ledTimer.off + ' UK time, not ThingSpeak' }, chips), ledTimer.label || 'LED panels') : null;
    // sound: off until the viewer clicks it on
    var sound = createSound(), soundBtn = null;
    if (sound) {
      soundBtn = text(el('button', { type: 'button', class: 'cf-chip cf-chip-btn cf-sound', 'data-state': 'off', 'aria-pressed': 'false', title: 'Hear the fan, fogger and bubbler while they run' }, chips), 'Sound off');
      soundBtn.addEventListener('click', function () {
        var v = !sound.isOn();
        sound.enable(v);
        soundBtn.setAttribute('data-state', v ? 'on' : 'off'); soundBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
        soundBtn.textContent = v ? 'Sound on' : 'Sound off';
        render();
      });
    }

    var cubeBox = el('section', { class: 'cf-box cf-info', 'aria-live': 'polite' }, panel);
    var captionEl = el('p', { class: 'cf-caption' }, root);
    captionEl.textContent = labels.caption || '';

    // preview-only controls: switch the outputs by hand to review the effects (never on the real page)
    var demoBox = null, demoBtns = {};
    if (opts.demo) {
      demoBox = el('div', { class: 'cf-box cf-demo' }, panel);
      text(el('p', { class: 'cf-kicker' }, demoBox), 'Preview only · not live data');
      var row = el('div', { class: 'cf-chips' }, demoBox);
      (cfg.thingspeak.outputs || []).forEach(function (o) {
        demoBtns[o.key] = text(el('button', { type: 'button', class: 'cf-chip cf-chip-btn', 'data-state': 'off', 'aria-pressed': 'false' }, row), o.label);
        demoBtns[o.key].addEventListener('click', function () {
          if (!state.demo) state.demo = {};
          state.demo[o.key] = !state.demo[o.key];
          syncDemo(); render();
        });
      });
      var liveBtn = text(el('button', { type: 'button', class: 'cf-chip cf-chip-btn', 'data-state': 'off' }, row), 'Back to live');
      liveBtn.addEventListener('click', function () { state.demo = null; syncDemo(); render(); tick(); });
      text(el('p', { class: 'cf-demo-note' }, demoBox), 'Turns the fogger, fan and bubbler on or off in the drawing so you can see and hear the effects. Fog builds up over a few seconds and lingers after the fogger stops. Zoom into the climate zone to see it best.');
      panel.insertBefore(demoBox, panel.firstChild);
    }
    function syncDemo() {
      Object.keys(demoBtns).forEach(function (k) {
        var on = !!(state.demo && state.demo[k]);
        demoBtns[k].setAttribute('data-state', on ? 'on' : 'off');
        demoBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      setNet(state.demo ? 'demo' : (state.readAt ? state.liveNet || 'live' : state.liveNet || 'connecting'));
    }

    var cubes = {}, partsById = {};
    cfg.cubes.forEach(function (c) { cubes[c.id] = c; });
    cfg.parts.forEach(function (p) { partsById[p.id] = p; });
    var outputsByPart = {};
    (cfg.thingspeak.outputs || []).forEach(function (o) { outputsByPart[o.part] = o; });

    function q(sel) { return svgEl.querySelector(sel); }
    function partEl(id) { return svgEl.querySelector('[data-part="' + id + '"]:not([data-part-piece])'); }
    (cfg.thingspeak.outputs || []).forEach(function (o) {
      var pe = partEl(o.part);
      if (!pe) console.warn('[cupboard-figure] output "' + o.key + '" drives missing part ' + o.part);
      else if (!pe.querySelector('.cf-fx-' + o.effect)) console.warn('[cupboard-figure] part ' + o.part + ' has no "' + o.effect + '" effect');
    });

    // cube labels for keyboard users
    cfg.cubes.forEach(function (c) {
      var g = q('[data-cube="' + c.id + '"].cf-cube');
      if (g) g.setAttribute('aria-label', c.name + (c.residents && c.residents.length ? ', ' + c.residents.length + ' residents' : ''));
    });

    // ---- state
    var state = { net: 'connecting', readAt: null, values: {}, outputs: {}, lastFetch: 0 };
    var hover = null, pinned = null;

    function showCube(id) {
      cubeBox.innerHTML = '';
      var c = cubes[id];
      if (!c) { text(el('p', { class: 'cf-kicker' }, cubeBox), 'Residents'); text(el('p', null, cubeBox), labels.emptyCube || ''); return; }
      text(el('p', { class: 'cf-kicker' }, cubeBox), pinned === id ? 'Selected cube' : 'Cube');
      text(el('h3', null, cubeBox), c.name);
      if (c.desc) text(el('p', null, cubeBox), c.desc);
      if (c.residents && c.residents.length) {
        text(el('p', { class: 'cf-kicker' }, cubeBox), 'Residents (' + c.residents.length + ')');
        var ul = el('ul', null, cubeBox);
        c.residents.forEach(function (r) {
          var li = el('li', { class: 'cf-res', 'data-in': r.in || '' }, ul);
          text(el('i', null, li), r.scientific);
          li.appendChild(document.createTextNode(' · ' + r.common));
          var meta = el('span', null, li);
          meta.appendChild(document.createTextNode(r.where || ''));
          if (r.visible === false) { meta.appendChild(document.createTextNode(' · ')); text(el('em', null, meta), 'not visible in the drawing'); }
        });
      } else {
        text(el('p', null, cubeBox), 'No animals in this cube.');
      }
      var ps = cfg.parts.filter(function (p) { return p.cube === id && p.list !== false && p.label; });
      if (ps.length) {
        text(el('p', { class: 'cf-kicker' }, cubeBox), 'Parts');
        var pl = el('ul', { class: 'cf-parts' }, cubeBox), seen = {};
        ps.forEach(function (p) {
          if (seen[p.label]) return; seen[p.label] = 1;
          var li = text(el('li', null, pl), p.label);
          var o = outputsByPart[p.id];
          if (o) { li.appendChild(document.createTextNode(' · ')); text(el('b', null, li), o.field + (o.gpio ? ' · ' + o.gpio : '')); }
          if (p.timer && ledTimer) { li.appendChild(document.createTextNode(' · ')); text(el('b', null, li), ledTimer.on + '–' + ledTimer.off); }
        });
      }
    }
    function markHl() {
      Array.prototype.forEach.call(svgEl.querySelectorAll('.cf-hl'), function (h) {
        var id = h.getAttribute('data-hl');
        if (id === hover || id === pinned) h.setAttribute('data-on', ''); else h.removeAttribute('data-on');
        if (id === pinned) h.setAttribute('data-pinned', ''); else h.removeAttribute('data-pinned');
      });
      showCube(hover || pinned);
    }
    function hotResident(partId) {
      Array.prototype.forEach.call(cubeBox.querySelectorAll('.cf-res'), function (li) {
        if (partId && li.getAttribute('data-in') === partId) li.setAttribute('data-hot', ''); else li.removeAttribute('data-hot');
      });
    }
    function tipFor(partId, ev) {
      var p = partsById[partId];
      if (!p || !p.label || partId === 'part-cupboard') { tip.hidden = true; return; }
      tip.innerHTML = '';
      tip.appendChild(document.createTextNode(p.label));
      var o = outputsByPart[partId], extra = '';
      if (o) extra = o.label + ' · ' + o.field + (o.gpio ? ' · ' + o.gpio : '') + ' · ' + (state.outputs[o.key] == null ? 'unknown' : state.outputs[o.key] ? 'ON' : 'OFF');
      else if (p.timer && ledTimer) extra = 'Timer ' + ledTimer.on + '–' + ledTimer.off + ' UK · ' + (root.getAttribute('data-leds') === 'on' ? 'ON' : 'OFF');
      else if (p.note) extra = p.note;
      if (extra) text(el('small', null, tip), extra);
      var r = card.getBoundingClientRect();
      tip.style.left = Math.max(70, Math.min(r.width - 70, ev.clientX - r.left)) + 'px';
      tip.style.top = (ev.clientY - r.top) + 'px';
      tip.hidden = false;
    }

    svgEl.addEventListener('pointermove', function (ev) {
      var t = ev.target, c = t.closest && t.closest('[data-cube]'), pe = t.closest && t.closest('[data-part]');
      var id = c ? c.getAttribute('data-cube') : null;
      if (id !== hover) { hover = id; markHl(); }
      var pid = pe ? pe.getAttribute('data-part') : null;
      hotResident(pid);
      if (pid) tipFor(pid, ev); else tip.hidden = true;
    });
    svgEl.addEventListener('pointerleave', function () { hover = null; tip.hidden = true; markHl(); });
    svgEl.addEventListener('click', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-cube]');
      var id = c ? c.getAttribute('data-cube') : null;
      if (zoomed && id === zoomed) return;
      if (id && cubes[id] && cubes[id].zoom) { pinned = id; hover = null; zoomTo(id); markHl(); return; }
      if (zoomed) zoomTo(null);
      pinned = id && pinned !== id ? id : (id ? null : pinned);
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') hover = null;
      markHl();
    });
    var order = cfg.cubes.slice().sort(function (a, b) { return b.row - a.row || a.col - b.col; }).map(function (c) { return c.id; });
    svgEl.addEventListener('focusin', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-cube]');
      if (c) { pinned = c.getAttribute('data-cube'); markHl(); }
    });
    svgEl.addEventListener('keydown', function (ev) {
      var cur = pinned ? order.indexOf(pinned) : -1, c = cubes[pinned], next = null;
      if (ev.key === 'Escape') { if (zoomed) { zoomTo(null); return; } pinned = null; hover = null; markHl(); return; }
      if (!c) return;
      var find = function (row, col) { var m = cfg.cubes.filter(function (x) { return x.row === row && x.col === col; })[0]; return m ? m.id : null; };
      if (ev.key === 'ArrowUp') next = find(c.row + 1, c.col);
      else if (ev.key === 'ArrowDown') next = find(c.row - 1, c.col);
      else if (ev.key === 'ArrowLeft') next = find(c.row, c.col - 1);
      else if (ev.key === 'ArrowRight') next = find(c.row, c.col + 1);
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (c.zoom && zoomed !== c.id) zoomTo(c.id); markHl(); return; }
      if (next) { ev.preventDefault(); var g = q('[data-cube="' + next + '"].cf-cube'); if (g) g.focus(); }
      void cur;
    });
    markHl();

    // ---- zoom: the same drawing, the camera moves by animating the viewBox (aspect kept, so the card never resizes)
    var homeVB = built.vb.slice(), curVB = homeVB.slice(), zoomed = null, zoomAnim = 0;
    var reducedMQ = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function isReduced() { return !!(reducedMQ && reducedMQ.matches); }
    function setVB(v) {
      curVB = v;
      var str = v.map(r2).join(' ');
      svgEl.setAttribute('viewBox', str);
      if (frontEl) frontEl.setAttribute('viewBox', str);
      if (fog) fog.view(v);
    }
    function vbFor(id) {
      var b = built.boxes[id], m = 2.5, A = homeVB[2] / homeVB[3];
      var bw = b[2] - b[0] + 2 * m, bh = b[3] - b[1] + 2 * m, w = Math.max(bw, bh * A), h = w / A;
      return [(b[0] + b[2]) / 2 - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h];
    }
    function zoomTo(id) {
      var c = id ? cubes[id] : null;
      zoomed = c ? id : null;
      if (zoomed) root.setAttribute('data-zoom', zoomed); else root.removeAttribute('data-zoom');
      Array.prototype.forEach.call(stage.querySelectorAll('[data-cube]'), function (g) {
        if (zoomed && g.getAttribute('data-cube') === zoomed) g.setAttribute('data-zoomed', ''); else g.removeAttribute('data-zoomed');
      });
      backBtn.hidden = !zoomed;
      if (fogCanvas) fogCanvas.style.opacity = zoomed && cfg.fog && zoomed !== cfg.fog.cube ? '.18' : '';
      hintEl.textContent = zoomed ? (labels.zoomHint || 'Esc or ← to go back') : (labels.hint || 'Hover or tap a cube');
      captionEl.textContent = zoomed && c.zoomCaption ? c.zoomCaption : (labels.caption || '');
      if (zoomed) pinned = zoomed;
      markHl();
      var from = curVB.slice(), to = zoomed ? vbFor(zoomed) : homeVB, t0 = performance.now(), dur = 700;
      cancelAnimationFrame(zoomAnim);
      if (isReduced()) { setVB(to); return; }
      (function stepZoom(now) {
        var k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setVB(from.map(function (v, i) { return v + (to[i] - v) * e; }));
        if (k < 1) zoomAnim = requestAnimationFrame(stepZoom);
      })(t0);
    }
    backBtn.addEventListener('click', function () { zoomTo(null); var g = q('[data-cube="' + pinned + '"].cf-cube'); if (g) g.focus({ preventScroll: true }); });
    if (fog) {
      fog.reduced(isReduced());
      if (reducedMQ && reducedMQ.addEventListener) reducedMQ.addEventListener('change', function () { fog.reduced(isReduced()); });
      if ('ResizeObserver' in global) new ResizeObserver(function () { fog.resize(); }).observe(stage);
      fog.view(curVB);
    }
    if (opts.start) {
      var startCube = cfg.cubes.filter(function (c) { return c.id === opts.start || c.zoomKey === opts.start; })[0];
      if (startCube) { setVB(vbFor(startCube.id)); zoomTo(startCube.id); }
    }

    // ---- live rendering
    function setNet(net) {
      if (net !== 'demo') state.liveNet = net;
      if (state.demo && net !== 'demo') net = 'demo';
      state.net = net;
      root.setAttribute('data-net', net);
      badge.setAttribute('data-net', net);
      badge.textContent = { live: 'Live', stale: 'Stale', offline: 'Offline', connecting: 'Connecting', demo: 'Demo' }[net];
    }
    function outputsKnown() { return state.net === 'live' || state.net === 'demo'; }
    function outputValue(key) { return state.demo ? !!state.demo[key] : state.outputs[key]; }
    function render() {
      (cfg.thingspeak.readings || []).forEach(function (r) {
        var v = state.values[r.key], b = metricEls[r.key];
        b.textContent = v == null ? '--' : v.toFixed(r.decimals || 0) + (r.unit || '');
        var lvl = v == null ? '' : r.dangerAbove != null && v > r.dangerAbove ? 'danger' : r.warnAbove != null && v > r.warnAbove ? 'warn' : '';
        if (lvl) b.setAttribute('data-level', lvl); else b.removeAttribute('data-level');
      });
      (cfg.thingspeak.outputs || []).forEach(function (o) {
        var v = outputsKnown() ? outputValue(o.key) : null, st = v == null ? 'unknown' : v ? 'on' : 'off';
        chipEls[o.key].setAttribute('data-state', st);
        chipEls[o.key].textContent = o.label + (st === 'unknown' ? ' ?' : st === 'on' ? ' on' : ' off');
        var pe = partEl(o.part);
        if (pe) pe.setAttribute('data-active', st);
      });
      fogInputs();
    }
    function soundInputs() {
      if (!sound) return;
      var known = outputsKnown(), by = {};
      (cfg.thingspeak.outputs || []).forEach(function (o) { by[o.effect] = known && !!outputValue(o.key); });
      sound.set(by.mist, by.spin, by.bubbles);
    }
    function fogInputs() {
      soundInputs();
      if (!fog) return;
      var fc = cfg.fog || {}, known = outputsKnown();
      fog.set(known && !!outputValue(fc.output || 'fogger'), known && !!outputValue(fc.fanOutput || 'fan'), root.getAttribute('data-leds') === 'on');
    }
    function tick() {
      var now = ukNow(ledTimer && ledTimer.timeZone);
      // LED panels: own timer, UK local time
      if (ledTimer) {
        var on = timerOn(ledTimer, now.minutes);
        if (root.getAttribute('data-leds') !== (on ? 'on' : 'off')) { root.setAttribute('data-leds', on ? 'on' : 'off'); fogInputs(); }
        ledChip.setAttribute('data-state', on ? 'on' : 'off');
        ledChip.textContent = (ledTimer.label || 'LED panels') + (on ? ' on' : ' off') + ' · ' + (on ? 'off ' + ledTimer.off : 'on ' + ledTimer.on);
      }
      // freshness
      if (state.readAt) {
        var age = (Date.now() - state.readAt.getTime()) / 1000;
        var fresh = age <= (cfg.thingspeak.staleAfterSeconds || 120);
        if (state.liveNet !== 'offline') { var want = fresh ? 'live' : 'stale'; if (want !== state.liveNet) { setNet(want); render(); } }
        when.textContent = 'Reading ' + clockTime(state.readAt, ledTimer && ledTimer.timeZone) + ' · ' + (age < 90 ? Math.max(0, Math.round(age)) + ' s ago' : Math.round(age / 60) + ' min ago') + (state.liveNet === 'offline' ? ' · ThingSpeak unreachable, retrying' : '');
      } else {
        when.textContent = state.liveNet === 'offline' ? 'ThingSpeak unreachable, retrying' : '';
      }
      if (state.demo) when.textContent = 'Demo: outputs switched by hand, not live';
      // OLED: 6 screens, in step with the clock
      var o = cfg.oled;
      if (o && o.screens && o.screens.length) {
        var secs = o.secondsPerScreen || 10, idx = Math.floor(Date.now() / 1000 / secs) % o.screens.length, sc = o.screens[idx], val = '--';
        if (sc.show === 'clock') val = now.text;
        else if (sc.show === 'reading') {
          var rd = (cfg.thingspeak.readings || []).filter(function (r) { return r.key === sc.key; })[0], v = state.values[sc.key];
          if (state.readAt && v == null && sc.key === 'humidity') val = 'ERR';
          else if (v != null && rd) val = v.toFixed(rd.decimals || 0) + (rd.unit === '°C' ? 'C' : rd.unit || '');
        } else if (sc.show === 'output') {
          var ov = state.demo ? !!state.demo[sc.key] : state.readAt ? state.outputs[sc.key] : null;
          val = ov == null ? '--' : ov ? 'ON' : 'OFF';
        }
        var tEl = q('[data-part="' + o.part + '"] [data-oled-title]'), vEl = q('[data-part="' + o.part + '"] [data-oled-value]');
        if (tEl) tEl.textContent = sc.title;
        if (vEl) vEl.textContent = val;
        readout.textContent = 'OLED ' + (idx + 1) + '/' + o.screens.length + ' · ' + sc.title + ' ' + val;
      }
    }

    var ts = cfg.thingspeak, timer = null, busy = false;
    function poll() {
      clearTimeout(timer);
      timer = setTimeout(poll, (ts.pollSeconds || 25) * 1000);
      if (document.hidden || busy) return;
      busy = true;
      state.lastFetch = Date.now();
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, (ts.timeoutSeconds || 10) * 1000);
      fetch(ts.url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          var at = new Date(d.created_at);
          state.readAt = isNaN(at.getTime()) ? null : at;
          (ts.readings || []).forEach(function (r) { state.values[r.key] = parseNum(d[r.field]); });
          (ts.outputs || []).forEach(function (o) { state.outputs[o.key] = parseBool(d[o.field]); });
          setNet(state.readAt ? 'live' : 'stale');
          tick(); render();
        })
        .catch(function () { setNet('offline'); tick(); render(); })
        .then(function () { clearTimeout(to); busy = false; });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - state.lastFetch > (ts.pollSeconds || 25) * 1000) poll();
    });
    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) root.removeAttribute('data-offscreen'); else root.setAttribute('data-offscreen', ''); if (fog) fog.visible(e.isIntersecting); });
      }).observe(card);
    }
    render(); tick();
    setInterval(tick, 1000);
    poll();
    return { root: root, svg: svgEl, state: state, zoomTo: zoomTo, fog: fog };
  }

  function mountFrom(host) {
    if (host.__cupboardFigure) return;
    host.__cupboardFigure = true;
    var src = host.getAttribute('data-src') || 'assets/data/cupboard.json';
    fetch(src, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (cfg) {
        mount(host, cfg, { start: host.getAttribute('data-start'), demo: host.hasAttribute('data-demo'), noWebgl: host.hasAttribute('data-no-webgl') });
      })
      .catch(function (e) {
        injectStyle();
        host.innerHTML = '';
        var box = el('div', { class: 'cf-root' }, host);
        text(el('div', { class: 'cf-error' }, box), 'Could not load the cupboard data (' + src + '): ' + e.message + '. Open the page through a web server, not as a file.');
      });
  }

  function auto() { Array.prototype.forEach.call(document.querySelectorAll('[data-cupboard-figure]'), mountFrom); }
  global.CupboardFigure = { mount: mount, mountFrom: mountFrom, painters: PAINTERS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})(window);
