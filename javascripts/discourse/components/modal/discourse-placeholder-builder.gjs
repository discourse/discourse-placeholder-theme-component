import Component, { Input } from "@ember/component";
import { fn, hash } from "@ember/helper";
import { on } from "@ember/modifier";
import EmberObject, { action } from "@ember/object";
import { service } from "@ember/service";
import { isBlank } from "@ember/utils";
import DButton from "discourse/components/d-button";
import DModal from "discourse/components/d-modal";
import { i18n } from "discourse-i18n";
import MultiSelect from "select-kit/components/multi-select";

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

  <template>
    <DModal
      @title={{i18n (themePrefix "builder.title")}}
      @closeModal={{@closeModal}}
      @tagName="form"
      class="placeholder-builder"
    >
      <:body>
        <div class="control">
          <span class="label">
            {{i18n (themePrefix "builder.key.label")}}
          </span>
          <div class="input">
            <Input
              {{on "input" this.updateKey}}
              @value={{readonly this.form.key}}
              class="placeholder-builder__key"
            />
          </div>
          <p class="description">{{i18n
              (themePrefix "builder.key.description")
            }}</p>
        </div>

        <div class="control">
          <span class="label">
            {{i18n (themePrefix "builder.description.label")}}
          </span>
          <div class="input">
            <Input
              {{on "input" this.updateDescription}}
              @value={{readonly this.form.description}}
              class="placeholder-builder__description"
            />
          </div>
          <p class="description">
            {{i18n (themePrefix "builder.description.description")}}
          </p>
        </div>

        <div class="control">
          <span class="label">
            {{i18n (themePrefix "builder.values.label")}}
          </span>
          <div class="input">
            <MultiSelect
              @valueProperty={{null}}
              @nameProperty={{null}}
              @value={{this.form.values}}
              @content={{this.form.values}}
              @options={{hash allowAny=true placementStrategy="absolute"}}
              @onChange={{fn (mut this.form.values)}}
              class="placeholder-builder__default-values"
            />
          </div>
          <p class="description">{{i18n
              (themePrefix "builder.values.description")
            }}</p>
        </div>
      </:body>

      <:footer>
        <DButton
          @action={{this.insertPlaceholder}}
          @label={{themePrefix "builder.insert"}}
          class="btn-primary"
        />
      </:footer>
    </DModal>
  </template>
}
