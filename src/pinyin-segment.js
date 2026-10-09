/**
 * WIT pinyin segmentation + candidate ranking (pure, dependency-free).
 *
 * Runs in two environments with no build step:
 *   - browser content script: reads window.WIT_PINYIN_DATA, exposes
 *     window.WIT_PINYIN_SEG = { segment }
 *   - plain node (unit tests): data files are loaded first (any order, they
 *     merge via Object.assign), this file exposes { segment } on
 *     module.exports. No DOM, no jQuery, no browser.*, no fetch, no network.
 *
 * API:
 *   segment(buffer)       -> Array<{ text, source }>
 *   segment(buffer, opts) -> same; opts.fuzzy (object, default null) is a
 *     documented-but-inactive seam reserved for future z~=zh style mappings.
 *     It is accepted and ignored; no fuzzy matching is performed here.
 *   source is "word" for full-key hits, "char" for per-syllable hits.
 *   Dict order IS the rank: values are used as-is, never re-sorted.
 *   Deterministic: same input always yields the same output.
 *
 * Examples:
 *   segment("nihao")  -> [ { text: "你好", source: "word" }, ... ] ("你好" first)
 *   segment("xi'an")  -> [ { text: "西安", source: "word" }, ... ] ("'" forces xi|an)
 *   segment("zzzqx")  -> []
 */
(function (root, factory) {
  var api = factory();
  root.WIT_PINYIN_SEG = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  var MAX_BUFFER = 64;       // buffers longer than this return []
  var MAX_SYLLABLE_LEN = 6;  // longest toneless syllable ("shuang", "chuang")
  var MAX_CANDIDATES = 50;   // popup shows 9 per page; driver pages the rest
  var MAX_SEGMENTATIONS = 8; // best 8 by syllable count survive to lookup

  var cachedSyllables = null;
  var cachedSet = null;

  function getData() {
    if (typeof window !== "undefined" && window.WIT_PINYIN_DATA) {
      return window.WIT_PINYIN_DATA;
    }
    if (typeof globalThis !== "undefined" && globalThis.WIT_PINYIN_DATA) {
      return globalThis.WIT_PINYIN_DATA;
    }
    return null;
  }

  function getSyllableSet(data) {
    if (cachedSyllables !== data.syllables) {
      cachedSyllables = data.syllables;
      cachedSet = {};
      for (var i = 0; i < data.syllables.length; i++) {
        cachedSet[data.syllables[i]] = true;
      }
    }
    return cachedSet;
  }

  function lookupOf(data, key) {
    if (typeof data.lookup === "function") {
      var hit = data.lookup(key);
      return hit ? hit : [];
    }
    if (data.dicts && Object.prototype.hasOwnProperty.call(data.dicts, key)) {
      return data.dicts[key] || [];
    }
    return [];
  }

  // All full coverings of `part` by valid syllables, fewest-syllables-first,
  // truncated to MAX_SEGMENTATIONS. Memoized DFS with a hard overflow breaker
  // so adversarial buffers cannot blow up exponentially.
  function segmentPart(part, sylSet) {
    var n = part.length;
    var memo = new Array(n + 1);
    var overflow = false;

    function rec(pos) {
      if (pos === n) {
        return [[]];
      }
      if (memo[pos]) {
        return memo[pos];
      }
      var out = [];
      var maxL = MAX_SYLLABLE_LEN < (n - pos) ? MAX_SYLLABLE_LEN : (n - pos);
      for (var len = 1; len <= maxL && !overflow; len++) {
        var sub = part.substring(pos, pos + len);
        if (!sylSet[sub]) {
          continue;
        }
        var tails = rec(pos + len);
        for (var i = 0; i < tails.length && !overflow; i++) {
          out.push([sub].concat(tails[i]));
          if (out.length > 64) {
            overflow = true;
          }
        }
      }
      memo[pos] = out;
      return out;
    }

    var all = rec(0);
    all.sort(function (a, b) { return a.length - b.length; });
    if (all.length > MAX_SEGMENTATIONS) {
      all.length = MAX_SEGMENTATIONS;
    }
    return all;
  }

  function byLength(a, b) {
    return a.length - b.length;
  }

  function segment(buffer, opts) {
    // opts.fuzzy: reserved seam for future fuzzy mappings; ignored.
    void opts;
    if (typeof buffer !== "string") {
      return [];
    }
    if (buffer.length === 0 || buffer.length > MAX_BUFFER) {
      return [];
    }
    var lower = buffer.toLowerCase();
    if (/[^a-z']/.test(lower)) {
      return [];
    }
    var data = getData();
    if (!data || !data.syllables || !data.dicts) {
      return [];
    }
    var sylSet = getSyllableSet(data);

    // "'" is a forced syllable boundary: split first, segment each part.
    var rawParts = lower.split("'");
    var parts = [];
    for (var p = 0; p < rawParts.length; p++) {
      if (rawParts[p].length > 0) {
        parts.push(rawParts[p]);
      }
    }
    if (parts.length === 0) {
      return [];
    }

    var combined = [[]];
    for (var s = 0; s < parts.length; s++) {
      var segs = segmentPart(parts[s], sylSet);
      if (segs.length === 0) {
        return [];
      }
      var next = [];
      for (var a = 0; a < combined.length; a++) {
        for (var b = 0; b < segs.length; b++) {
          next.push(combined[a].concat(segs[b]));
          if (next.length > MAX_SEGMENTATIONS * MAX_SEGMENTATIONS) {
            break;
          }
        }
      }
      next.sort(byLength);
      if (next.length > MAX_SEGMENTATIONS) {
        next.length = MAX_SEGMENTATIONS;
      }
      combined = next;
    }

    var words = [];
    var chars = [];
    for (var c = 0; c < combined.length; c++) {
      var syls = combined[c];
      // Only multi-syllable full-key hits are words; a single-syllable full
      // key duplicates its per-syllable lookup, so skip it (do not double-add).
      if (syls.length > 1) {
        var full = lookupOf(data, syls.join(" "));
        for (var w = 0; w < full.length; w++) {
          words.push({ text: full[w], source: "word" });
        }
      }
      for (var y = 0; y < syls.length; y++) {
        var singles = lookupOf(data, syls[y]);
        for (var k = 0; k < singles.length; k++) {
          chars.push({ text: singles[k], source: "char" });
        }
      }
    }

    var seen = Object.create(null);
    var out = [];
    var lists = [words, chars];
    for (var l = 0; l < lists.length && out.length < MAX_CANDIDATES; l++) {
      var list = lists[l];
      for (var m = 0; m < list.length && out.length < MAX_CANDIDATES; m++) {
        var cand = list[m];
        if (!seen[cand.text]) {
          seen[cand.text] = true;
          out.push(cand);
        }
      }
    }
    return out;
  }

  return { segment: segment };
});
