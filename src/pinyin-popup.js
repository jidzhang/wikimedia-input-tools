/* WIT pinyin candidate popup scaffold (content script, <all_urls>).
 * Renders/positions a floating candidate window; the driver (next wave) owns
 * segmentation/ranking/keys. This module only renders, positions, clicks.
 * Same-origin iframe note: each frame runs its own content-script copy, so
 * mirror-div/Range coords + scrollX/Y are correct per-frame. Cross-origin
 * inner docs are unreachable from the parent; fallback there is anchoring at
 * the <iframe> element's own bounding rect (still sane per-frame position).
 * Isolation: only wit- prefixed ids/classes, scoped under #wit-popup (see
 * pinyin-popup.css); never steals focus (no tabindex/focus calls, mousedown
 * is preventDefaulted so clicks don't blur the field). */
(function () {
  "use strict";
  var ROOT_ID = "wit-popup", GAP = 4;
  var rootEl = null, listEl = null, candidates = [], activeIndex = -1;
  var anchorEl = null, selectCb = null, visible = false, blurHandler = null;
  function ensureDom() {
    if (rootEl && document.contains(rootEl)) { return; }
    rootEl = document.createElement("div");
    rootEl.id = ROOT_ID;
    rootEl.className = "wit-popup";
    rootEl.style.display = "none";
    listEl = document.createElement("div");
    listEl.className = "wit-popup-list";
    rootEl.appendChild(listEl);
    rootEl.addEventListener("mousedown", function (e) { e.preventDefault(); });
    rootEl.addEventListener("click", function (e) {
      var t = e.target, i;
      while (t && t !== rootEl && !t.getAttribute("data-wit-index")) { t = t.parentNode; }
      if (t && t !== rootEl) {
        i = parseInt(t.getAttribute("data-wit-index"), 10);
        if (!isNaN(i) && typeof selectCb === "function") { selectCb(i); }
      }
    });
    document.documentElement.appendChild(rootEl);
  }
  function render() {
    ensureDom();
    listEl.textContent = "";
    candidates.forEach(function (c, i) {
      var item = document.createElement("div");
      item.className = "wit-popup-item" + (i === activeIndex ? " wit-cand-active" : "");
      item.setAttribute("data-wit-index", String(i));
      var label = document.createElement("span");
      label.className = "wit-popup-label";
      label.textContent = c && c.label != null ? String(c.label) : String(i + 1);
      var text = document.createElement("span");
      text.className = "wit-popup-text";
      text.textContent = c && c.text != null ? String(c.text) : "";
      item.appendChild(label);
      item.appendChild(text);
      listEl.appendChild(item);
    });
  }
  function rectFallback(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, height: r.height };
  }
  function caretInput(el) { // mirror-div technique for input/textarea
    try {
      var cs = window.getComputedStyle(el), mirror = document.createElement("div"), s = mirror.style;
      s.position = "absolute"; s.visibility = "hidden"; s.top = "0"; s.left = "-9999px";
      s.whiteSpace = el.tagName === "INPUT" ? "pre" : "pre-wrap"; s.wordWrap = "break-word";
      ["fontFamily","fontSize","fontWeight","fontStyle","letterSpacing","textTransform",
       "wordSpacing","textIndent","lineHeight","paddingTop","paddingRight","paddingBottom",
       "paddingLeft","borderTopWidth","borderRightWidth","borderBottomWidth",
       "borderLeftWidth","boxSizing"].forEach(function (p) { s[p] = cs[p]; });
      s.width = el.clientWidth + "px";
      var val = el.value || "", pos = el.selectionStart != null ? el.selectionStart : val.length;
      mirror.textContent = val.substring(0, pos);
      var marker = document.createElement("span");
      marker.textContent = "​";
      mirror.appendChild(marker);
      document.documentElement.appendChild(mirror);
      var r = el.getBoundingClientRect();
      var out = { x: r.left + window.scrollX + marker.offsetLeft - (el.scrollLeft || 0),
        y: r.top + window.scrollY + marker.offsetTop - (el.scrollTop || 0),
        height: marker.offsetHeight || parseInt(cs.lineHeight, 10) || 18 };
      document.documentElement.removeChild(mirror);
      return out;
    } catch (e) { return rectFallback(el); }
  }
  function caretEditable(el) { // contenteditable via Range rects
    try {
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        var range = sel.getRangeAt(0).cloneRange();
        range.collapse(false);
        var rects = range.getClientRects();
        if (rects && rects.length > 0) {
          var rc = rects[rects.length - 1];
          return { x: rc.left + window.scrollX, y: rc.top + window.scrollY, height: rc.height || 18 };
        }
      }
    } catch (e) { /* fall through */ }
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.bottom + window.scrollY - r.height, height: 18 };
  }
  function caretCoords(el) {
    if (!el || !el.tagName) { return { x: window.scrollX, y: window.scrollY, height: 18 }; }
    var tag = el.tagName.toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA") { return caretInput(el); }
    if (el.isContentEditable) { return caretEditable(el); }
    return rectFallback(el);
  }
  function place() {
    if (!visible || !anchorEl || !rootEl) { return; }
    var c = caretCoords(anchorEl);
    rootEl.style.display = "block";
    rootEl.style.visibility = "hidden";
    var popH = rootEl.offsetHeight, popW = rootEl.offsetWidth;
    var viewTop = c.y - window.scrollY, top = c.y + c.height + GAP;
    if (viewTop + c.height + GAP + popH > window.innerHeight && viewTop - GAP - popH >= 0) {
      top = c.y - popH - GAP; // flip above caret: no room below
    }
    var left = c.x, maxLeft = window.scrollX + window.innerWidth - popW - 8;
    if (left > maxLeft) { left = Math.max(window.scrollX + 8, maxLeft); }
    rootEl.style.left = left + "px";
    rootEl.style.top = top + "px";
    rootEl.style.visibility = "";
  }
  function detachBlur() {
    if (anchorEl && blurHandler) { try { anchorEl.removeEventListener("blur", blurHandler); } catch (e) {} }
    blurHandler = null;
  }
  function show(cands, anchor, opts) {
    ensureDom();
    candidates = Array.isArray(cands) ? cands.slice(0, 9) : [];
    var el = anchor && anchor.element ? anchor.element : anchor || null;
    anchorEl = el && el.tagName ? el : document.activeElement;
    activeIndex = -1;
    var ai = opts && opts.activeIndex != null ? opts.activeIndex : anchor && anchor.activeIndex;
    if (typeof ai === "number" && ai >= 0 && ai < candidates.length) { activeIndex = ai; }
    detachBlur();
    if (anchorEl && anchorEl.addEventListener) {
      blurHandler = function () { hide(); }; // defensive; driver owns commit/cancel
      anchorEl.addEventListener("blur", blurHandler);
    }
    render();
    visible = true;
    place();
    rootEl.style.display = "block";
  }
  function hide() {
    visible = false; activeIndex = -1; detachBlur();
    if (rootEl) { rootEl.style.display = "none"; }
  }
  function reposition() { if (visible) { place(); } }
  function setActive(i) {
    if (typeof i !== "number" || i < 0 || i >= candidates.length || !listEl) { return; }
    activeIndex = i;
    var kids = listEl.childNodes;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k] && kids[k].className !== undefined) {
        kids[k].className = "wit-popup-item" + (k === activeIndex ? " wit-cand-active" : "");
      }
    }
  }
  function onSelect(cb) { selectCb = typeof cb === "function" ? cb : null; }
  window.addEventListener("scroll", reposition, true); // capture: inner scrollers too
  window.addEventListener("resize", reposition);
  window.WIT_PINYIN_POPUP = { show: show, hide: hide, reposition: reposition, onSelect: onSelect, setActive: setActive };
})();

// Demo self-test: never runs in production (needs ?wit-popup-demo in URL).
(function () {
  "use strict";
  var q = "";
  try { q = window.location.search || ""; } catch (e) { return; }
  if (q.indexOf("wit-popup-demo") === -1) { return; }
  function run() {
    var api = window.WIT_PINYIN_POPUP;
    if (!api) { return; }
    var words = ["你", "好", "中", "文", "拼", "音", "输", "入", "法"];
    var cands = words.map(function (w, i) { return { text: w, label: String(i + 1) }; });
    var anchor = document.activeElement;
    if (!anchor || anchor === document.body) {
      anchor = document.querySelector("textarea, input, [contenteditable]") || document.body;
    }
    api.show(cands, { element: anchor }, { activeIndex: 0 });
    api.onSelect(function (i) { api.setActive(i); });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", run); }
  else { run(); }
})();
