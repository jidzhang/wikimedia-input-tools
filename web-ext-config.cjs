// web-ext build defaults: keep the shipped XPI lean.
// Runtime needs only icons/, src/, jquery.ime/{css,src,rules,images} + manifest.
// Excluded: upstream dev baggage (examples, tests, build files) and repo tooling.
module.exports = {
  ignoreFiles: [
    "jquery.ime/examples/**",
    "jquery.ime/test/**",
    "test/**",
    "jquery.ime/Gruntfile.js",
    "jquery.ime/package.json",
    "jquery.ime/package-lock.json",
    "generate_manifest.py",
    "package.json",
    "package-lock.json",
    ".gitmodules",
    ".omo/**",
  ],
};
