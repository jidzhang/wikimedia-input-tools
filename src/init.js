$(document).ready(function () {
  // apply jquery.ime to all input elements
  $imeData = $(
    "textarea, [contenteditable], input[type=text], input[type=search], input:not([type])"
  )
    .ime()
    .data("ime");

  console.log("applied IME to all input elements");

  // Use last selected IME layout, if exists
  browser.storage.sync
    .get("layoutCode")
    .then((r) => {
      $imeData.setIM(r.layoutCode);
    })
    .catch((e) => {
      console.log(e);
    });

  // listen for event change in IME method & save it to storage
  $imeData.$element.on("imeMethodChange", () => {
    const id = $imeData.inputmethod.id;
    // store the layout code in add-on storage
    browser.storage.sync
      .set({ layoutCode: id })
      .then(() => {
        console.log("Saved IME layout: ", id);
      })
      .catch((e) => {
        console.log(e);
      });
  });
});
