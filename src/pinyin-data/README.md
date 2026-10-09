# Vendored pinyin lookup data (`window.WIT_PINYIN_DATA`)

Plain `<script>`-loadable dictionary payloads for Simplified-Chinese pinyin
input. No modules, no bundler, no build step: every `.js` file in this
directory merges one chunk into a single global and is safe to load in
**any order** (later manifest wiring just lists them as content scripts).

## Upstream provenance

- Package: `@pinyin-pro/data` **version 1.3.1**
  (`https://registry.npmjs.org/@pinyin-pro/data/-/data-1.3.1.tgz`,
  shasum `0446c8e778d7630c90f10912297cc40e6f5d0093`)
- Source repo: `https://github.com/chinese-data/pinyin-pro-data`
- License: **ISC**, author field empty upstream; attribution preserved in the
  header comment of every `.js` file. No `LICENSE` file ships in the tarball.
- Upstream layout note: this version has **no `dict1`–`dict5` files**. It ships
  `json/complete.json` (348,838 entries, ~19 MB), `json/modern.json`
  (58,907 entries, ~1.9 MB), `json/traditional.json` (trad→simp map, no pinyin),
  `json/chars.json` (7 rare chars). There is **no factory/decoder** — the
  payloads are plain `{ word: [pinyin_with_diacritics, rate] }` maps, so no
  decoder was vendored; the inversion below replaces it.

## What was vendored (and why not exactly `modern.json`)

`modern.json` alone is **not usable**: it is missing ultra-common entries
(`是`, `也`, `一`, `一个`, `你好`, `中国`, `大家`, …). Backfill rule used:

1. Start from all of `json/modern.json` (Simplified, contemporary vocabulary).
2. Add `json/complete.json` entries missing from it when **single char
   (any rate)** or **multi-char word with corpus rate ≥ 1e-10**.
   On conflict modern wins (only 1 word differs upstream: `如一`).
3. Fold in the 7 single chars from `json/chars.json` (appended, no rate info).
4. Drop words longer than 6 hanzi (the segmentation consumer spans at most
   6 syllables, and 1 hanzi = 1 syllable — verified aligned on all entries).
5. Skipped: `traditional.json` (trad→simp map, not pinyin), tests/docs/factory
   (none needed), wubi/zhuyin (not in this package).

Result: **75,719 words → 48,620 keys → 408 syllables, ~1.42 MB total**.
The nominal "~500 KB" estimate assumed `dict1`–`dict5` shards that do not
exist in 1.3.1; an inverted toneless index of the real payloads cannot fit
that without deleting everyday vocabulary, so coverage was kept.

## Global shape

```js
window.WIT_PINYIN_DATA = {
  version: "1.3.1",                       // upstream data version
  source: { package: "@pinyin-pro/data", version: "1.3.1",
            upstream: "https://github.com/chinese-data/pinyin-pro-data" },
  syllables: ["a", "ai", "an", ...],      // 408 valid toneless syllables, sorted
  dicts: { "ni": [...], "ni hao": [...], ... },  // 48,620 keys (see below)
  lookup: function (key) { ... },         // dicts[key] || []
};
```

### Keys — toneless pinyin, space-joined

- One ASCII syllable per hanzi, joined with a **single space**:
  `"ni"` (1 hanzi), `"ni hao"` → `你好`, `"zhong guo"` → `中国`.
- Lowercase, **no tone marks or numbers**. Upstream diacritics are normalized:
  `āáǎà→a`, `ēéěèê→e`, `īíǐì→i`, `ōóǒò→o`, `ūúǔù→u`,
  **`ǖǘǚǜü→v`** (type `lv`, `nv` with a `v`, the standard ASCII typing),
  `ńňǹ→n`, `ɡ→g`, syllabic `ḿ→m` (syllables `"m"`, `"n"`, `"er"`, `"a"`,
  `"o"`, `"e"` all exist as keys).
- Key syllable count = hanzi count: keys with `N` spaces hold `(N+1)`-hanzi
  words. All keys are pure ASCII (`[a-z ]`).

### Values — rank-ordered Simplified-hanzi word arrays

- `dicts[key]` is an **array of strings**, most frequent first. Rank comes from
  the upstream corpus `rate`; the raw float rates are **not** stored (order is
  the ranking — index 0 is the top candidate).
- Single-syllable keys hold single chars (`"ni"` → `["你","泥","尼","拟",…]`,
  up to 115 candidates); multi-syllable keys hold words (`"ni hao"` →
  `["你好"]`). Both live in the same `dicts` object — split across files only
  for file-size comfort.
- `lookup(key)` returns the array, or `[]` for unknown keys (never undefined).

## Files

| File | Contents | Bytes |
|---|---|---|
| `00-namespace.js` | Creates the global: `version`, `source`, `syllables` (408), `lookup()` | 3,597 |
| `10-chars.js` | All 1-syllable keys (single-char candidates) | 73,632 |
| `20-words2a.js` / `21-words2b.js` | 2-syllable keys, alphabetical halves | 399,394 / 407,231 |
| `30-words3.js` | 3-syllable keys | 281,161 |
| `40-words4.js` | 4-syllable keys | 246,327 |
| `50-words56.js` | 5- and 6-syllable keys | 18,017 |
| **Total** | | **~1.42 MB** |

Each data file is `Object.assign(W.dicts, {…compact JSON…})` inside an IIFE;
no `import`/`export`/`require` tokens anywhere (`node --check` clean).

## Notes for the segmentation wave

- DP longest-match: for an input span of `n` syllables (`n ≤ 6`), join with
  spaces and do one hash lookup — e.g. syllables `[ni, hao]` → key `"ni hao"`.
- `'` (forced boundary) never appears in keys; split the input there first.
- `syllables` array is the valid-syllable inventory for segmenting raw
  letters (`nihao` → `ni|hao`); wrap it in a `Set`/trie as needed.
- Tone input is out of scope: keys are toneless by design.
- Verified: `ni`→`你/尼/泥…`, `hao`→`好/号…`, `ni hao`→`你好`,
  `zhong guo`→`中国`, `lv`→`绿`, `shi`→`是`, in forward and reversed load
  order.
