import json, os

manifest = {
    "name": "Wikimedia Input Tools",
    "description": "jQuery.IME based input method editor supporting more than 220 input methods across more than 120 languages.",
    "version": "0.1.0",
    "author": "Sai Karthik",
    "homepage_url": "https://gitlab.com/kskarthik/wikimedia-input-tools",
    "manifest_version": 2,
    # "icons": {"31": "icons/32.png", "64": "icons/64.png"},
    # "permissions": ["storage"],
    # "browser_action": {
    #     "default_icon": "icons/32.png",
    #     "default_title": "Indic Input",
    #     "default_popup": "options/options.html",
    # },
    # "background": {"scripts": ["src/background.js"]},
    # "commands": {
    #     "switch-layout": {
    #         "suggested_key": {"default": "Ctrl+Space", "linux": "Ctrl+Space"},
    #         "description": "Keyboard layout switch",
    #     }
    # },
    "content_scripts": [
        {
            "matches": ["<all_urls>"],
            "js": [
                # "src/jquery-1.10.2.js",
                "src/jquery-3.6.0.js",
                "jquery.ime/src/jquery.ime.js",
                "jquery.ime/src/jquery.ime.inputmethods.js",
                "jquery.ime/src/jquery.ime.preferences.js",
                "jquery.ime/src/jquery.ime.selector.js",
                "jquery.ime/src/jquery.ime.selector.js",
                "src/init.js",
            ],
            "css": ["jquery.ime/css/jquery.ime.css"],
        }
    ],
}

# auto generate content_script array
dir_list = os.listdir("jquery.ime/rules")
dir_list.remove("README.md")
for dir in dir_list:
    for file in os.listdir(f"jquery.ime/rules/{dir}"):
        if file.endswith(".js"):
            manifest["content_scripts"][0]["js"].append(
                f"jquery.ime/rules/{dir}/{file}"
            )

with open("manifest.json", "w") as f:
    f.write(json.dumps(manifest, indent=2))
