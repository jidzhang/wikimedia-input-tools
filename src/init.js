$(document).ready(function () {
  $(
    "textarea, [contenteditable], input[type=text], input[type=search], input:not([type])"
  ).ime();
  console.log("applied IME to all input elements");
});
