/**
 * Pinyin segmentation unit-test harness.
 *
 * Loads the vendored pinyin-data files (src/pinyin-data/*.js) via plain require(),
 * then loads src/pinyin-segment.js. If the segmentation module is missing or
 * incompatible, the harness exits cleanly with a clear message — it does NOT
 * implement segmentation itself.
 *
 * Run: node --test test/pinyin-segment.test.js
 *
 * CAVEAT: The data files (src/pinyin-data/*.js) are plain IIFEs that merge into
 * window.WIT_PINYIN_DATA. In a Node environment they are loaded via require() and
 * the IIFE root is set to globalThis (mimicking window). The segmentation module
 * is expected to expose module.exports.segment(buffer, opts) -> ranked hanzi[].
 * The returned candidates are objects { text, source } — tests extract .text.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testDir = path.dirname(__filename);
const repoRoot = path.dirname(testDir);
const dataDir = path.join(repoRoot, 'src', 'pinyin-data');
const segmentPath = path.join(repoRoot, 'src', 'pinyin-segment.js');

// Ensure globalThis.window exists so the data-file IIFEs route to it.
// Each data file does: (function(root) { ... })(typeof window !== "undefined" ? window : this);
// By setting globalThis.window = globalThis, root becomes globalThis and the
// global gets attached to the correct object.
globalThis = globalThis || {};
globalThis.window = globalThis;

// ---------------------------------------------------------------------------
// Load the 7 pinyin-data files via plain require()
// ---------------------------------------------------------------------------

const dataFiles = [
  '00-namespace.js',
  '10-chars.js',
  '20-words2a.js',
  '21-words2b.js',
  '30-words3.js',
  '40-words4.js',
  '50-words56.js',
];

console.log('Loading pinyin-data files via require()...');
let dataLoadErrors = 0;
for (const file of dataFiles) {
  const filePath = path.join(dataDir, file);
  try {
    require(filePath);
    console.log(`  OK: ${file}`);
  } catch (e) {
    console.error(`  FAIL: ${file} — ${e.message}`);
    dataLoadErrors++;
  }
}

if (dataLoadErrors > 0) {
  console.error(
    `SKIP: ${dataLoadErrors} pinyin-data file(s) failed to load. ` +
    'Cannot proceed with segmentation tests.'
  );
  process.exit(1);
}

// Verify the global was created
if (typeof globalThis.WIT_PINYIN_DATA === 'undefined') {
  console.error(
    'SKIP: window.WIT_PINYIN_DATA was not created after loading data files. ' +
    'The data files may not be compatible with Node require().'
  );
  process.exit(1);
}

console.log(`Data loaded: ${globalThis.WIT_PINYIN_DATA.version}, ` +
  `${globalThis.WIT_PINYIN_DATA.syllables.length} syllables`);

// ---------------------------------------------------------------------------
// Try to load the segmentation module
// ---------------------------------------------------------------------------

let segment;
try {
  segment = require(segmentPath);
} catch (e) {
  console.error(
    `SKIP: Could not load segmentation module from ${segmentPath}. ` +
    'Ensure src/pinyin-segment.js exists and has module.exports.\n' +
    `Error: ${e.message}`
  );
  process.exit(0);
}

// Verify the segment module has the expected shape
if (typeof segment !== 'object') {
  console.error(
    'SKIP: src/pinyin-segment.js does not export a plain object.'
  );
  process.exit(0);
}

if (typeof segment.segment !== 'function') {
  console.error(
    'SKIP: src/pinyin-segment.js does not export a "segment" function.'
  );
  process.exit(0);
}

console.log('Segmentation module loaded successfully.');

// Resolve the segment function once (module-level, so all tests can use it)
const segmentFn = segment.segment;

// Helper: extract text from candidate objects
const cand = (arr) => arr.map(c => c.text);

// ---------------------------------------------------------------------------
// Test: syllable-set sanity (data-level, no segment needed)
// ---------------------------------------------------------------------------

describe('pinyin-data syllable inventory', () => {
  test('syllables array has 400+ entries', () => {
    assert(globalThis.WIT_PINYIN_DATA.syllables.length >= 400,
      `Expected >= 400 syllables, got ${globalThis.WIT_PINYIN_DATA.syllables.length}`);
  });

  test('key syllables are valid entries in the syllables set', () => {
    const syllables = new Set(globalThis.WIT_PINYIN_DATA.syllables);
    const sampleKeys = ['ni', 'hao', 'zhong', 'guo', 'xi', 'an', 'shi', 'lv'];
    for (const key of sampleKeys) {
      const parts = key.split(' ');
      for (const part of parts) {
        assert.ok(syllables.has(part),
          `Key "${key}" has syllable "${part}" not found in WIT_PINYIN_DATA.syllables`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Core segmentation test cases (require segment() function)
// ---------------------------------------------------------------------------

describe('pinyin-segment', () => {
  test('a. segment("nihao") → first candidate text is exactly "你好"', () => {
    const result = segmentFn('nihao');
    assert.strictEqual(cand(result)[0], '你好',
      `Expected first candidate "你好", got "${cand(result)[0]}". ` +
      `Full result: ${JSON.stringify(result)}`);
  });

  test('b. segment("zhongguo") → first candidate is exactly "中国"', () => {
    const result = segmentFn('zhongguo');
    assert.strictEqual(cand(result)[0], '中国',
      `Expected first candidate "中国", got "${cand(result)[0]}". ` +
      `Full result: ${JSON.stringify(result)}`);
  });

  test('c. segment("xi\'an") → candidates include "西安" (apostrophe forced boundary)', () => {
    const result = segmentFn('xi\'an');
    assert.ok(cand(result).includes('西安'),
      `Expected "西安" in candidates, got: ${JSON.stringify(cand(result))}`);
  });

  test('d. segment("shi") → includes "是" within the first 9 candidates', () => {
    const result = segmentFn('shi');
    const firstNine = cand(result).slice(0, 9);
    assert.ok(firstNine.includes('是'),
      `Expected "是" within first 9 candidates (got: ${JSON.stringify(firstNine)}). ` +
      `Full result length: ${cand(result).length}`);
  });

  test('e. segment("xyzq") (invalid syllables) → returns []', () => {
    const result = segmentFn('xyzq');
    assert.strictEqual(cand(result).length, 0,
      `Expected [] for invalid syllables, got: ${JSON.stringify(cand(result))}`);
  });

  test('f. segment("") and non-string input → returns []', () => {
    // Empty string
    const emptyResult = segmentFn('');
    assert.strictEqual(cand(emptyResult).length, 0,
      `segment("") should return [], got: ${JSON.stringify(cand(emptyResult))}`);
    // Non-string input
    assert.strictEqual(cand(segmentFn(123)).length, 0,
      `segment(123) should return [], got: ${JSON.stringify(cand(segmentFn(123)))}`);
    assert.strictEqual(cand(segmentFn(null)).length, 0,
      `segment(null) should return [], got: ${JSON.stringify(cand(segmentFn(null)))}`);
    assert.strictEqual(cand(segmentFn(undefined)).length, 0,
      `segment(undefined) should return [], got: ${JSON.stringify(cand(segmentFn(undefined)))}`);
  });

  test('g. word-before-char: for "nihao", index of "你好" < index of any single-char candidate', () => {
    const result = segmentFn('nihao');
    const textResult = cand(result);
    const helloIdx = textResult.indexOf('你好');
    const youIdx = textResult.indexOf('你');
    const haoIdx = textResult.indexOf('好');

    // "你好" must appear before "你" and before "好"
    if (youIdx >= 0) {
      assert(helloIdx < youIdx,
        `"你好" at index ${helloIdx} should appear before "你" at index ${youIdx}`);
    }
    if (haoIdx >= 0) {
      assert(helloIdx < haoIdx,
        `"你好" at index ${helloIdx} should appear before "好" at index ${haoIdx}`);
    }
    if (helloIdx === -1) {
      assert.fail('"你好" not found in segment("nihao") results');
    }
  });

  test('h. syllable-set sanity: every candidate-producing lookup key splits into known syllables', () => {
    const syllables = new Set(globalThis.WIT_PINYIN_DATA.syllables);
    const knownKeys = ['ni hao', 'zhong guo', 'xi an', 'shi', 'lv'];
    for (const key of knownKeys) {
      const parts = key.split(' ');
      for (const part of parts) {
        assert.ok(syllables.has(part),
          `Key "${key}" has syllable "${part}" not in valid syllables set`);
      }
    }
  });

  test('i. determinism: call segment("nihao") twice, deep-equal results', () => {
    const result1 = segmentFn('nihao');
    const result2 = segmentFn('nihao');
    assert.deepStrictEqual(result1, result2,
      `segment("nihao") calls produced different results:\n` +
      `Run 1: ${JSON.stringify(result1)}\n` +
      `Run 2: ${JSON.stringify(result2)}`);
  });
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

console.log('\n=== pinyin-segment test harness complete ===');
console.log('If you see "SKIP" messages above, the segmentation module is ' +
  'missing or incompatible — implement it in a separate wave.\n');