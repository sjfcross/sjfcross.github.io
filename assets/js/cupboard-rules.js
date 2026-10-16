/*!
 * cupboard-rules.js: the climate controller's rules (firmware v2.4) and a simple humidity model,
 * used by cupboard-figure.js for the 24 h simulation.
 *
 * Firmware changes (v2.5+) are edited HERE and nowhere else.
 *
 * Two clearly separate parts:
 *  1. FIRMWARE: a mirror of the rules documented on pages/arachnid.html (priority order kept).
 *  2. MODEL: an illustrative humidity/temperature model so the rules have something to react to.
 *     Its numbers are invented to look plausible; they are not measurements.
 */
(function (global) {
  'use strict';

  var HOUR = 3600, DAY = 86400;

  // ---------------------------------------------------------------- 1. firmware v2.4
  var FIRMWARE = {
    version: 'v2.4',
    nightFrom: 23, nightTo: 7,                 // night is 23:00–07:00 (UK time)
    readEverySeconds: 1,                       // loop(): every 1000 ms readSensor() + manage*()
    fogger: {
      badReads: 3,                             // 3 bad reads → forced OFF
      blockAt: 90, releaseBelow: 85,           // ≥ 90 % → BLOCKED until below 85 %
      overrideSeconds: 180,                    // manual override: 3 min ON
      nightRunSeconds: 180                     // night: ON for the first 3 min of every hour
    },
    fan: {
      overrideSeconds: 180,                    // manual override: 3 min ON
      nightRunSeconds: 240,                    // night: 4 min per hour (ASSUMED: the first 4 min of the hour)
      dayHours: [7, 10, 13, 16, 19, 22],       // day: 3 min at these hours
      dayRunSeconds: 180
    },
    light: { shortSeconds: 600, longSeconds: 1800 } // "Light" output = Sea Monkey bubbler, manual 10 or 30 min
  };

  function hourOf(t) { return Math.floor(((t % DAY) + DAY) % DAY / HOUR); }
  function secInHour(t) { return ((t % HOUR) + HOUR) % HOUR; }
  function isNight(t) { var h = hourOf(t); return h >= FIRMWARE.nightFrom || h < FIRMWARE.nightTo; }

  // The humidity latch: ≥ blockAt blocks, only < releaseBelow releases (hysteresis).
  function latch(blocked, humidity) {
    if (humidity == null) return blocked;
    if (humidity >= FIRMWARE.fogger.blockAt) return true;
    if (blocked && humidity < FIRMWARE.fogger.releaseBelow) return false;
    return blocked;
  }

  // Fogger, highest priority first. c = { t, sensorOk, blocked, overrideLeft }
  function fogger(c) {
    var F = FIRMWARE.fogger;
    if (!c.sensorOk) return { on: false, state: 'OFF', why: 'sensor' };
    if (c.blocked) return { on: false, state: 'BLOCKED', why: 'humidity' };
    if (c.overrideLeft > 0) return { on: true, state: 'OVERRIDE', left: c.overrideLeft, why: 'override' };
    if (isNight(c.t) && secInHour(c.t) < F.nightRunSeconds) return { on: true, state: 'ON', left: F.nightRunSeconds - secInHour(c.t), why: 'schedule' };
    return { on: false, state: 'OFF', why: isNight(c.t) ? 'schedule' : 'day' };
  }

  // Fan. c = { t, overrideLeft }
  function fan(c) {
    var F = FIRMWARE.fan, s = secInHour(c.t);
    if (c.overrideLeft > 0) return { on: true, state: 'OVERRIDE', left: c.overrideLeft, why: 'override' };
    if (isNight(c.t)) return s < F.nightRunSeconds ? { on: true, state: 'ON', left: F.nightRunSeconds - s, why: 'night' } : { on: false, state: 'OFF', why: 'night' };
    if (F.dayHours.indexOf(hourOf(c.t)) >= 0 && s < F.dayRunSeconds) return { on: true, state: 'ON', left: F.dayRunSeconds - s, why: 'day' };
    return { on: false, state: 'OFF', why: 'day' };
  }

  // Light output (the Sea Monkey bubbler). c = { overrideLeft }
  function light(c) {
    return c.overrideLeft > 0 ? { on: true, state: 'ON', left: c.overrideLeft, why: 'override' } : { on: false, state: 'OFF', why: 'manual' };
  }

  // ---------------------------------------------------------------- 2. model (illustrative)
  var MODEL = {
    stepSeconds: 10,
    roomHumidity: 52,          // where the zone drifts to with nothing running
    leakMinutes: 110,          // time constant of that drift through the door gaps and vents
    fogPercentPerMinute: 7,    // humidity added per minute while the fogger runs
    fanMinutes: 35,            // extra drying while the fan runs
    ledDryingMinutes: 70,      // extra drying while the LED panels warm the zone
    baseTemp: 21.2, ledWarming: 1.9, warmMinutes: 45, fogCooling: 0.25
  };

  function minutesOf(hhmm) { var a = String(hhmm).split(':'); return parseInt(a[0], 10) * 60 + parseInt(a[1] || 0, 10); }
  function ledsOn(t, timer) {
    if (!timer) return false;
    var m = Math.floor((((t % DAY) + DAY) % DAY) / 60), on = minutesOf(timer.on), off = minutesOf(timer.off);
    return on <= off ? (m >= on && m < off) : (m >= on || m < off);
  }

  // Simulate one day in fixed steps. Interventions: [{ t, kind }] with kind
  // 'foggerOverride' | 'fanOverride' | 'bubbler10' | 'bubbler30' | 'pullSensor' | 'plugSensor'.
  function run(opts, init) {
    var step = MODEL.stepSeconds, n = DAY / step, timer = opts.ledTimer;
    var acts = (opts.interventions || []).slice().sort(function (a, b) { return a.t - b.t; }), ai = 0;
    var h = init.h, temp = init.temp, blocked = init.blocked, warm = init.warm;
    var fogLeft = 0, fanLeft = 0, lightLeft = 0, plugged = true, bad = 0;
    var tl = { step: step, n: n, h: new Float32Array(n), read: new Float32Array(n), temp: new Float32Array(n),
      fog: new Uint8Array(n), fan: new Uint8Array(n), light: new Uint8Array(n), leds: new Uint8Array(n), sensor: new Uint8Array(n),
      fogState: new Array(n), fogLeft: new Float32Array(n), fanLeft: new Float32Array(n), lightLeft: new Float32Array(n) };
    for (var i = 0; i < n; i++) {
      var t = i * step;
      while (ai < acts.length && acts[ai].t <= t) {
        var k = acts[ai++].kind;
        if (k === 'foggerOverride') fogLeft = FIRMWARE.fogger.overrideSeconds;
        else if (k === 'fanOverride') fanLeft = FIRMWARE.fan.overrideSeconds;
        else if (k === 'bubbler10') lightLeft = FIRMWARE.light.shortSeconds;
        else if (k === 'bubbler30') lightLeft = FIRMWARE.light.longSeconds;
        else if (k === 'pullSensor') plugged = false;
        else if (k === 'plugSensor') { plugged = true; bad = 0; }
      }
      // reads happen every second: over one step a pulled sensor racks up `step` bad reads
      bad = plugged ? 0 : Math.min(bad + step / FIRMWARE.readEverySeconds, 999);
      var sensorOk = bad < FIRMWARE.fogger.badReads;
      var reading = plugged ? h : null;
      blocked = latch(blocked, reading);
      var fg = fogger({ t: t, sensorOk: sensorOk, blocked: blocked, overrideLeft: fogLeft });
      var fn = fan({ t: t, overrideLeft: fanLeft });
      var lt = light({ overrideLeft: lightLeft });
      var led = ledsOn(t, timer);
      // record
      tl.h[i] = h; tl.read[i] = reading == null ? NaN : reading; tl.temp[i] = temp;
      tl.fog[i] = fg.on ? 1 : 0; tl.fan[i] = fn.on ? 1 : 0; tl.light[i] = lt.on ? 1 : 0; tl.leds[i] = led ? 1 : 0;
      tl.sensor[i] = plugged ? (sensorOk ? 1 : 0) : 2;   // 1 ok, 0 failing-but-plugged (n/a), 2 unplugged
      tl.fogState[i] = fg.state; tl.fogLeft[i] = fg.left || 0; tl.fanLeft[i] = fn.left || 0; tl.lightLeft[i] = lt.left || 0;
      // advance the model by one step
      var mins = step / 60;
      var dry = (h - MODEL.roomHumidity) * (mins / MODEL.leakMinutes + (fn.on ? mins / MODEL.fanMinutes : 0) + (led ? mins / MODEL.ledDryingMinutes : 0));
      h = Math.max(20, Math.min(99, h - dry + (fg.on ? MODEL.fogPercentPerMinute * mins : 0)));
      warm += ((led ? 1 : 0) - warm) * (1 - Math.exp(-mins / MODEL.warmMinutes));
      temp = MODEL.baseTemp + MODEL.ledWarming * warm - (fg.on ? MODEL.fogCooling : 0);
      fogLeft = Math.max(0, fogLeft - step); fanLeft = Math.max(0, fanLeft - step); lightLeft = Math.max(0, lightLeft - step);
    }
    tl.end = { h: h, temp: temp, blocked: blocked, warm: warm };
    return tl;
  }

  // One day, started from the state a normal day ends in, so midnight joins up when it loops.
  function simulateDay(opts) {
    opts = opts || {};
    var calm = run({ ledTimer: opts.ledTimer }, { h: 70, temp: MODEL.baseTemp, blocked: false, warm: 0 });
    calm = run({ ledTimer: opts.ledTimer }, calm.end);
    var tl = run(opts, calm.end);
    tl.events = eventsOf(tl);
    return tl;
  }

  // Every change of state, with a short caption, for the smart speed and the captions.
  function eventsOf(tl) {
    var ev = [], prev = null;
    function hhmm(t) { var m = Math.floor(t / 60); return ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
    for (var i = 0; i < tl.n; i++) {
      var cur = { fs: tl.fogState[i], fan: tl.fan[i], light: tl.light[i], leds: tl.leds[i], sensor: tl.sensor[i] };
      if (prev) {
        var t = i * tl.step, at = hhmm(t);
        if (cur.sensor !== prev.sensor) ev.push({ t: t, kind: 'sensor', text: cur.sensor === 2 ? at + ' Sensor unplugged: reads fail, fogger forced off' : at + ' Sensor back: readings return' });
        if (cur.fs !== prev.fs) {
          var txt = cur.fs === 'BLOCKED' ? 'Humidity reached 90 %: fogger BLOCKED' :
            prev.fs === 'BLOCKED' ? 'Humidity below 85 %: fogger allowed again' :
            cur.fs === 'OVERRIDE' ? 'Fogger override: 3 min on' :
            cur.fs === 'ON' ? 'Fogger on (night schedule, 3 min)' :
            cur.fs === 'OFF' && prev.fs === 'ON' ? 'Fogger off' :
            cur.fs === 'OFF' && prev.fs === 'OVERRIDE' ? 'Fogger override ended' : 'Fogger ' + cur.fs;
          if (!(cur.sensor === 2 && prev.sensor !== 2)) ev.push({ t: t, kind: 'fogger', text: at + ' ' + txt });
        }
        if (cur.fan !== prev.fan) ev.push({ t: t, kind: 'fan', text: at + (cur.fan ? ' Fan on' : ' Fan off') });
        if (cur.light !== prev.light) ev.push({ t: t, kind: 'bubbler', text: at + (cur.light ? ' Bubbler on' : ' Bubbler off (timer ran out)') });
        if (cur.leds !== prev.leds) ev.push({ t: t, kind: 'leds', text: at + (cur.leds ? ' LED panels on (timer)' : ' LED panels off (timer)') });
      }
      prev = cur;
    }
    return ev;
  }

  global.CupboardRules = {
    FIRMWARE: FIRMWARE, MODEL: MODEL, DAY: DAY,
    fogger: fogger, fan: fan, light: light, latch: latch, isNight: isNight,
    simulateDay: simulateDay
  };
})(typeof window !== 'undefined' ? window : globalThis);
