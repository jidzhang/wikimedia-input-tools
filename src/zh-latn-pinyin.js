/* WIT zh-latn-pinyin: Simplified-Chinese toneless pinyin input method.
 * REQUIRED load order (generate_manifest.py, later wave): jquery.ime core +
 * inputmethods.js -> pinyin-data/* -> pinyin-segment.js -> pinyin-popup.js
 * -> THIS FILE -> init.js -> jquery.ime rules.
 * ACTIVATION (no init.js change, nothing under jquery.ime/): the selector
 * does NOT auto-list registered methods; prepareInputMethods() renders
 * languages[code].inputmethods filtered by sources[id], and selectIM() needs
 * sources[id].name. So this file registers, adds a sources entry, and pushes
 * the id onto every zh* inputmethods array. ime.load() then resolves
 * immediately (no ajax); init.js layoutCode restore works untouched.
 * UX: a-z appends (passthrough, raw pinyin inline) + popup; "'" = boundary;
 * Backspace/Esc via keydown; 1-9 = candidate N (else passthrough); Space =
 * cand 1; Enter = raw buffer (swallowed); uppercase/punct commits then
 * passes through; Ctrl/Alt/Meta + Ctrl+M always pass; only consumed keys
 * are stopped. Missing WIT_PINYIN_* globals -> silent passthrough, no throw.
 */
(function () {
  "use strict";

  var METHOD_ID = "zh-latn-pinyin";
  var MAX_KEYS = 64; // >= engine MAX_BUFFER so `input` covers the whole tail
  var ZH_LANGS = ["zh", "zh-cn", "zh-hans", "zh-hant",
    "zh-hk", "zh-mo", "zh-my", "zh-sg", "zh-tw"];

  var root = typeof window !== "undefined" ? window :
    (typeof globalThis !== "undefined" ? globalThis : null);
  if (!root) {
    return;
  }

  function jq() {
    try {
      if (root.jQuery && root.jQuery.ime) {
        return root.jQuery;
      }
      if (typeof jQuery !== "undefined" && jQuery.ime) {
        return jQuery;
      }
    } catch (e) { /* unavailable (e.g. node import) */ }
    return null;
  }

  function seg() {
    try {
      var s = root.WIT_PINYIN_SEG;
      if (s && typeof s.segment === "function") {
        return s;
      }
    } catch (e) { /* wrong load order: degrade to passthrough */ }
    return null;
  }

  function popup() {
    try {
      var p = root.WIT_PINYIN_POPUP;
      if (p && typeof p.show === "function" && typeof p.hide === "function") {
        return p;
      }
    } catch (e) { /* wrong load order: compose without popup */ }
    return null;
  }

  // Per-element composing state. WeakMap: entries die with their elements.
  var states = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var fallbackState = null; // only if WeakMap is missing (never in Firefox)
  function stateFor(el, create) {
    if (!el) { return null; }
    if (!states) { // non-Firefox fallback: single shared slot
      if (create && !fallbackState) { fallbackState = { buffer: "", cands: [] }; }
      return fallbackState;
    }
    var st = states.get(el);
    if (!st && create) { st = { buffer: "", cands: [] }; states.set(el, st); }
    return st || null;
  }
  function composing(st) { return !!st && st.buffer.length > 0; }

  // Last composing context, for popup click-to-select (popup owns one cb).
  var activeCtx = null;

  function fire(el, type, data) {
    if (!el) { return; }
    try {
      var ev = null;
      if (type.indexOf("composition") === 0 && root.CompositionEvent) {
        try {
          ev = new root.CompositionEvent(type,
            { bubbles: true, cancelable: true, data: data || "" });
        } catch (e) { ev = null; }
      }
      if (!ev) { ev = root.document.createEvent("Event"); ev.initEvent(type, true, true); }
      el.dispatchEvent(ev);
    } catch (e) { /* headless/test DOM: ignore */ }
    try { var $ = jq(); if ($) { $(el).trigger(type); } } catch (e2) { /* ignore */ }
  }

  function refresh(ime, el, st) {
    var engine = seg(), pop = popup(), cands = [];
    try {
      cands = (engine && st.buffer) ? (engine.segment(st.buffer) || []) : [];
    } catch (e) {
      cands = [];
    }
    st.cands = cands;
    activeCtx = { ime: ime, el: el };
    if (pop) {
      try {
        pop.onSelect(onPick);
        if (cands.length) {
          pop.show(cands.slice(0, 9).map(function (c, i) {
            return { text: c.text, label: String(i + 1) };
          }), { element: el, activeIndex: 0 });
        } else {
          pop.hide();
        }
      } catch (e2) { /* popup failure must not break typing */ }
    }
    fire(el, "compositionupdate", st.buffer);
  }

  function endQuiet(el, st) {
    st.buffer = "";
    st.cands = [];
    if (activeCtx && activeCtx.el === el) { activeCtx = null; }
    var pop = popup();
    if (pop) { try { pop.hide(); } catch (e) { /* ignore */ } }
    fire(el, "compositionend", "");
    fire(el, "input");
  }

  // Replace the inline raw buffer with `text` and finish the composition.
  function commit(ime, el, st, text) {
    try {
      ime.textEntry.replaceTextAtSelection(st.buffer.length, text);
    } catch (e) { /* entry mismatch: state still resets below */ }
    endQuiet(el, st);
  }

  function onPick(i) {
    try {
      var ctx = activeCtx;
      if (!ctx || typeof i !== "number") { return; }
      var st = stateFor(ctx.el, false);
      if (!composing(st) || !st.cands[i]) { return; }
      commit(ctx.ime, ctx.el, st, st.cands[i].text);
    } catch (e) { /* never throw from a popup callback */ }
  }

  // Core keypress flow calls patterns.call(ime, input, context), where
  // input = textBeforeSelection(maxKeyLength) + the new char (not yet in DOM).
  function handleKey(input, context) {
    void context;
    var ime = this;
    var $ = jq();
    if (!$) { return { noop: true, output: input }; }
    try {
      var el = ime.$element && ime.$element.get(0);
      var engine = seg();
      if (!el || !engine) { return { noop: true, output: input }; }
      var c = input.charAt(input.length - 1);
      var tail = input.slice(0, -1);
      var st = stateFor(el, false);
      if (composing(st) && tail.slice(-st.buffer.length) !== st.buffer) {
        // Field changed behind our back (click-away, framework rerender):
        // drop the stale composition, then handle this key fresh.
        endQuiet(el, st);
        st = null;
      }
      if (!composing(st)) {
        if (c >= "a" && c <= "z") {
          st = stateFor(el, true);
          st.buffer = c;
          fire(el, "compositionstart", c);
          refresh(ime, el, st);
        }
        return { noop: true, output: input };
      }
      // --- composing from here on ---
      if ((c >= "a" && c <= "z") || c === "'") {
        st.buffer += c;
        refresh(ime, el, st);
        return { noop: true, output: input }; // native insert keeps it inline
      }
      var pre = tail.slice(0, tail.length - st.buffer.length);
      if (c >= "1" && c <= "9") {
        var n = c.charCodeAt(0) - 48;
        if (n <= st.cands.length) {
          var out = pre + st.cands[n - 1].text;
          endQuiet(el, st);
          return { noop: false, output: out }; // core swaps buffer -> candidate
        }
        endQuiet(el, st);
        return { noop: true, output: input };
      }
      if (c === " ") {
        if (st.cands.length) {
          var outS = pre + st.cands[0].text;
          endQuiet(el, st);
          return { noop: false, output: outS }; // swallow the space
        }
        endQuiet(el, st);
        return { noop: true, output: input };
      }
      if (c === "\r") {
        endQuiet(el, st);
        return { noop: false, output: tail }; // raw buffer inline; swallow Enter
      }
      // Uppercase, punctuation, CJK, etc: commit top candidate (raw if none),
      // then let the key insert natively.
      commit(ime, el, st, st.cands.length ? st.cands[0].text : st.buffer);
      return { noop: true, output: input };
    } catch (e) {
      return { noop: true, output: input };
    }
  }

  // Backspace/Esc never reach keypress: own them here, only when composing.
  function onKeyDown(e) {
    try {
      if (!e || e.ctrlKey || e.metaKey || e.altKey) { return; } // combos pass
      var which = e.which || e.keyCode;
      if (which !== 8 && which !== 27) { return; }
      var $ = jq();
      if (!$ || !root.document) { return; }
      var el = (e.target && e.target.tagName) ? e.target : root.document.activeElement;
      if (!el) { return; }
      var ime = $(el).data("ime");
      if (!ime || !ime.active ||
        !ime.inputmethod || ime.inputmethod.id !== METHOD_ID) { return; }
      var st = stateFor(el, false);
      if (!composing(st)) { return; } // idle -> native Backspace/Esc
      e.preventDefault();
      e.stopPropagation(); // consumed: keep core + page handlers out
      if (which === 27) {
        try { ime.textEntry.replaceTextAtSelection(st.buffer.length, ""); }
        catch (e2) { /* keep state consistent regardless */ }
        endQuiet(el, st);
        return;
      }
      st.buffer = st.buffer.slice(0, -1);
      try { ime.textEntry.replaceTextAtSelection(1, ""); }
      catch (e3) { /* self-heals: letters passthrough natively */ }
      if (!st.buffer) { endQuiet(el, st); return; }
      refresh(ime, el, st);
    } catch (e4) { /* never break the page's keyboard */ }
  }

  var bound = false;
  function activate() {
    var $ = jq();
    if (!$ || !$.ime || typeof $.ime.register !== "function" ||
      !$.ime.languages || !$.ime.sources) { return false; }
    $.ime.register({
      id: METHOD_ID,
      name: "拼音",
      description: "Simplified Chinese pinyin input (toneless)",
      date: "2026-10-09",
      URL: "https://www.mediawiki.org/wiki/Help:Extension:" +
        "UniversalLanguageSelector/Input_methods/zh-latn-pinyin",
      author: "Wikimedia Input Tools contributors",
      license: "MIT",
      version: "1.0",
      contextLength: 0,
      maxKeyLength: MAX_KEYS,
      patterns: handleKey
    });
    // Selector + getInputMethods()/getInputMethodName() read this for display;
    // no `source` path: the method is already registered, so $.ime.load()
    // short-circuits and never ajax-loads it.
    $.ime.sources[METHOD_ID] = { name: "拼音" };
    ZH_LANGS.forEach(function (code) {
      var lang = $.ime.languages[code];
      if (lang && Array.isArray(lang.inputmethods) &&
        lang.inputmethods.indexOf(METHOD_ID) === -1) { lang.inputmethods.push(METHOD_ID); }
    });
    if (!bound && root.document && root.document.addEventListener) {
      root.document.addEventListener("keydown", onKeyDown, true);
      bound = true;
    }
    return true;
  }

  if (!activate()) {
    try {
      var retry = function (ev, fn) {
        root.document.addEventListener(ev, function go() {
          root.document.removeEventListener(ev, go);
          fn();
        });
      };
      if (root.document && root.document.readyState !== "loading") { activate(); }
      else if (root.document) { retry("DOMContentLoaded", activate); }
      else if (root.addEventListener) {
        root.addEventListener("load", function go2() {
          root.removeEventListener("load", go2);
          activate();
        });
      }
    } catch (e) { /* static parse (node --check) with no DOM: nothing to do */ }
  }
})();
