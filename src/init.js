(function () {
  "use strict";

  $(document).ready(function () {
    var $inputs = $(
      "textarea, [contenteditable], input[type=text], input[type=search], input:not([type])"
    );
    if (!$inputs.length) {
      return;
    }

    var imeData = $inputs.ime().data("ime");
    if (!imeData) {
      return;
    }

    function getStorage() {
      try {
        if (typeof browser !== "undefined" && browser.storage) {
          return browser.storage.sync || browser.storage.local;
        }
      } catch (e) {
        /* storage unavailable (e.g. private mode restrictions) */
      }
      return null;
    }

    var storage = getStorage();

    // Restore last selected IME layout, if any.
    if (storage) {
      storage
        .get("layoutCode")
        .then(function (r) {
          if (r && r.layoutCode) {
            try {
              imeData.setIM(r.layoutCode);
            } catch (e) {
              /* unknown layout code from older version, ignore */
            }
          }
        })
        .catch(function () {
          /* no saved layout yet, ignore */
        });

      // Persist IME method changes.
      imeData.$element.on("imeMethodChange", function () {
        if (!imeData.inputmethod) {
          return;
        }
        storage.set({ layoutCode: imeData.inputmethod.id }).catch(function () {
          /* quota / shutdown race, ignore */
        });
      });
    }
  });
})();
