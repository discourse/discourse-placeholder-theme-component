import Component from "@ember/component";
import EmberObject, { action } from "@ember/object";
import { isBlank } from "@ember/utils";
import I18n from "I18n";
import { inject as service } from "@ember/service";

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
      this.dialog.alert(I18n.t(themePrefix("builder.errors.no_key")));
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
