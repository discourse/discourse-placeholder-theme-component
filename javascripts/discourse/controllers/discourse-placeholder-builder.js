import Controller from "@ember/controller";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import EmberObject, { action } from "@ember/object";
import { isBlank } from "@ember/utils";
import I18n from "I18n";
import bootbox from "bootbox";

export default Controller.extend(ModalFunctionality, {
  form: null,

  onShow() {
    this.set(
      "form",
      EmberObject.create({
        key: null,
        description: null,
        values: [],
      })
    );
  },

  onClose() {},

  @action
  insertPlaceholder() {
    if (isBlank(this.form.key)) {
      bootbox.alert(I18n.t(themePrefix("builder.errors.no_key")));
      return;
    }

    let output = `[wrap=placeholder key="${this.form.key}"`;

    if (this.form.description) {
      output = `${output} description="${this.form.description}"`;
    }

    if (this.form.values.length) {
      if (this.form.values.length === 1) {
        output = `${output} default="${this.form.values.firstObject}"`;
      } else {
        output = `${output} defaults="${this.form.values.join(",")}"`;
      }
    }

    this.model.toolbarEvent.addText(`${output}][/wrap]`);

    this.send("closeModal");
  },
});
