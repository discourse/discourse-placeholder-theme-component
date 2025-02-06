import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { i18n } from "discourse-i18n";

acceptance("Discourse Placeholder | Add a placeholder", function (needs) {
  needs.user();

  test("add a placeholder through the modal", async function (assert) {
    await visit("/");
    await click("#create-topic");
    const categoryChooser = selectKit(".category-chooser");
    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(2);

    await click(".d-editor-button-bar .options");
    await selectKit(".toolbar-popup-menu-options").expand();
    const buttonSelector = `.select-kit-row[data-name='${i18n(
      themePrefix("toolbar.builder")
    )}']`;
    assert.dom(buttonSelector).exists("it shows the composer button");
    await click(buttonSelector);

    assert.dom(".d-modal.placeholder-builder").exists();

    await click(".d-modal .btn-primary");
    assert
      .dom(".dialog-body")
      .hasText(i18n(themePrefix("builder.errors.no_key")));
    await click(".dialog-footer .btn-primary");

    await fillIn(".placeholder-builder__key", "password");
    await fillIn(".placeholder-builder__description", "A secret password");

    const dropdown = selectKit(".placeholder-builder__default-values");
    await dropdown.expand();
    await dropdown.fillInFilter("one");
    await dropdown.keyboard("Enter");
    await dropdown.fillInFilter("two");
    await dropdown.keyboard("Enter");

    await click(".d-modal .btn-primary");
    assert.dom(".d-modal.placeholder-builder").doesNotExist();

    assert
      .dom("textarea.d-editor-input")
      .hasValue(
        `[wrap=placeholder key="password" description="A secret password" defaults="one,two"][/wrap]`
      );
  });
});
