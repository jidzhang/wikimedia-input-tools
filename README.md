## Wikimedia Input Tools - Firefox Add-on

### Features

- Enables tying in more than 220 input methods across more than 200 languages which [jquery.ime](https://github.com/wikimedia/jquery.ime) supports.

Contributions are welcome!

Origin: this project is based on
[wikimedia-input-tools](https://gitlab.com/kskarthik/wikimedia-input-tools)
by Sai Karthik (GPLv3).

### Chinese pinyin input (Simplified, toneless)

This extension bundles a `zh-latn-pinyin` (拼音) input method alongside
jquery.ime: type pinyin (`nihao`), pick candidates with `1-9`, `Space`
commits #1, `Enter` keeps the raw text, `Esc` cancels, `'` forces a
syllable split (`xi'an` → 西安). Dictionary: `@pinyin-pro/data` 1.3.1
(ISC), vendored under `src/pinyin-data/`.

Known v1 limits: no tone numbers, no fuzzy pinyin, Simplified only,
no learning of your picks.

### License: GPLv3
