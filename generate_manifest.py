import json, os

manifest = {
    "name": "Wikimedia Input Tools",
    "description": "jQuery.IME based input method editor supporting more than 220 input methods across more than 120 languages.",
    "version": "0.2.7",
    "author": "Sai Karthik",
    "homepage_url": "https://gitlab.com/kskarthik/wikimedia-input-tools",
    "manifest_version": 2,
    "permissions": ["storage"],
    "icons": {"128": "icons/logo.png"},
    # "browser_action": {
    #     "default_icon": "icons/32.png",
    #     "default_title": "Indic Input",
    #     "default_popup": "options/options.html",
    # },
    # "background": {"scripts": ["src/background.js"]},
    # "commands": {
    #     "switch-layout": {
    #         "suggested_key": {"default": "Ctrl+Space", "linux": "Ctrl+Space"},
    #         "description": "Switch Keyboard Layout",
    #     }
    # },
    "browser_specific_settings": {
        "gecko": {
            "id": "{dbd3dbd9-b292-48d8-8640-c7e9715abc97}",
        }
    },
    "content_scripts": [
        {
            "matches": ["<all_urls>"],
            "all_frames": True,
            "css": ["jquery.ime/css/jquery.ime.css", "src/pinyin-popup.css"],
            "js": [
                "src/jquery-3.7.1.min.js",
                "jquery.ime/src/jquery.ime.js",
                "jquery.ime/src/jquery.ime.inputmethods.js",
                "jquery.ime/src/jquery.ime.preferences.js",
                "jquery.ime/src/jquery.ime.selector.js",
                "src/pinyin-data/00-namespace.js",
                "src/pinyin-data/10-chars.js",
                "src/pinyin-data/20-words2a.js",
                "src/pinyin-data/21-words2b.js",
                "src/pinyin-data/30-words3.js",
                "src/pinyin-data/40-words4.js",
                "src/pinyin-data/50-words56.js",
                "src/pinyin-segment.js",
                "src/pinyin-popup.js",
                "src/zh-latn-pinyin.js",
                "src/init.js",
            ],
        }
    ],
}

# collect rule files, then append in strict path order for deterministic output
rule_files = []
dir_list = sorted(os.listdir("jquery.ime/rules"))
if "README.md" in dir_list:
    dir_list.remove("README.md")
for dir in dir_list:
    for file in sorted(os.listdir(f"jquery.ime/rules/{dir}")):
        if file.endswith(".js"):
            rule_files.append(f"jquery.ime/rules/{dir}/{file}")
manifest["content_scripts"][0]["js"].extend(sorted(rule_files))

with open("manifest.json", "w") as f:
    f.write(json.dumps(manifest, indent=2) + "\n")
