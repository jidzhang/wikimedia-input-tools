import json, os

manifest = {
    "name": "Wikimedia Input Tools",
    "description": "jQuery.IME based input method editor supporting more than 220 input methods across more than 120 languages.",
    "version": "0.2",
    "author": "Sai Karthik",
    "homepage_url": "https://gitlab.com/kskarthik/wikimedia-input-tools",
    "manifest_version": 2,
    "permissions": ["storage"],
    "icons": {"48": "icons/logo.png", "64": "icons/logo.png", "128": "icons/logo.png"},
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
            "css": ["jquery.ime/css/jquery.ime.css"],
            "js": [
                "src/jquery-3.6.0.js",
                "jquery.ime/src/jquery.ime.js",
                "jquery.ime/src/jquery.ime.inputmethods.js",
                "jquery.ime/src/jquery.ime.preferences.js",
                "jquery.ime/src/jquery.ime.selector.js",
                "jquery.ime/src/jquery.ime.selector.js",
                "src/init.js",
            ],
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
