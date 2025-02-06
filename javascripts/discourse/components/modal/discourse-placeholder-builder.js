import Component from "@ember/component";
import EmberObject, { action } from "@ember/object";
import { service } from "@ember/service";
import { isBlank } from "@ember/utils";
import { i18n } from "discourse-i18n";

export default class DiscoursePlaceholderBuilder extends Component {
  @service dialog;

  form = EmberObject.create({
    key: null,
    description: null,
    values: [],
  });

  @action
  updateKey(event) {
    this.form.set("key", event.target.value);
  }

  @action
  updateDescription(event) {
    this.form.set("description", event.target.value);
  }

  @action
  insertPlaceholder() {
    if (isBlank(this.form.key)) {
      this.dialog.alert(i18n(themePrefix("builder.errors.no_key")));
      return;
    }

    let output = `[wrap=placeholder key="${this.form.key}"`;

    if (this.form.description) {
      output += ` description="${this.form.description}"`;
    }

    if (this.form.values.length) {
      if (this.form.values.length === 1) {
        output += ` default="${this.form.values.firstObject}"`;
      } else {
        output += ` defaults="${this.form.values.join(",")}"`;
      }
    }

    output += "][/wrap]";
    this.model.toolbarEvent.addText(output);

    this.closeModal();
  }
}
