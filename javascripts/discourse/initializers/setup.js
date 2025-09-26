import { debounce, later } from "@ember/runloop";
import { withPluginApi } from "discourse/lib/plugin-api";
import DiscoursePlaceholderBuilder from "../components/modal/discourse-placeholder-builder";

const VALID_TAGS =
  "h1, h2, h3, h4, h5, h6, p, code, blockquote, .md-table, li, li > *";
const DELIMITER = "=";
const EXPIRE_AFTER_DAYS = 7;
const EXPIRE_AFTER_SECONDS = EXPIRE_AFTER_DAYS * 24 * 60 * 60;
const STORAGE_PREFIX = "d-placeholder-";

const originalContentMap = new WeakMap();

function buildInput(key, placeholder) {
  const input = document.createElement("input");
  input.classList.add("discourse-placeholder-value");
  input.dataset.key = key;
  input.dataset.delimiter = placeholder.delimiter;

  if (placeholder.description) {
    input.setAttribute("placeholder", placeholder.description);
  }

  if (placeholder.value) {
    input.value = placeholder.value;
  }

  return input;
}

function addSelectOption(select, options = {}) {
  const option = document.createElement("option");
  option.classList.add("discourse-placeholder-option");
  option.value = options.value;
  option.text = options.description || options.value;

  if (options.selected) {
    option.setAttribute("selected", true);
  }

  select.appendChild(option);
}

function buildSelect(key, placeholder) {
  const select = document.createElement("select");
  select.classList.add("discourse-placeholder-select");
  select.dataset.key = key;
  select.dataset.delimiter = placeholder.delimiter;

  if (placeholder.description) {
    addSelectOption(select, {
      value: "none",
      description: placeholder.description,
    });
  }

  placeholder.defaults.forEach((value) =>
    addSelectOption(select, {
      value,
      selected: placeholder.value === value,
    })
  );

  return select;
}

function replaceInText(text, placeholders) {
  for (const [key, { delimiter, value }] of Object.entries(placeholders)) {
    const placeholderWithDelimiter = `${delimiter}${key}${delimiter}`;

    let substitution = value;
    if (!substitution?.length || substitution === "none") {
      substitution = placeholderWithDelimiter;
    }

    text = text.replaceAll(placeholderWithDelimiter, substitution);
  }
  return text;
}

function performReplacements(cooked, placeholders) {
  cooked.querySelectorAll(VALID_TAGS).forEach((elem) => {
    const textNodeWalker = document.createTreeWalker(
      elem,
      NodeFilter.SHOW_TEXT
    );

    // Handle text nodes
    while (textNodeWalker.nextNode()) {
      const node = textNodeWalker.currentNode;

      if (!originalContentMap.has(node)) {
        // Haven't seen this node before. Get the text, and store it for future transformations
        originalContentMap.set(node, node.data);
      }

      const originalText = originalContentMap.get(node);
      const text = replaceInText(originalText, placeholders);

      if (node.data !== text) {
        node.data = text;
      }
    }

    // Handle a[href] attributes
    cooked.querySelectorAll("a[href]").forEach((link) => {
      const hrefAttr = link.attributes.getNamedItem("href");

      if (!originalContentMap.has(hrefAttr)) {
        // Haven't seen this attr before. Get the text, and store it for future transformations
        originalContentMap.set(hrefAttr, hrefAttr.value);
      }
      const originalUrl = originalContentMap.get(hrefAttr);
      const newUrl = replaceInText(originalUrl, placeholders);

      if (hrefAttr.value !== newUrl) {
        hrefAttr.value = newUrl;
      }
    });
  });
}

export default {
  name: "discourse-placeholder-theme-component",

  expireOldValues() {
    const now = Date.now();
    this.keyValueStore.removeKeys?.((k, v) => {
      if (!k.includes(STORAGE_PREFIX)) {
        return false;
      }

      return !v?.expires || v.expires < now;
    });
  },

  getValue(key) {
    const data = this.keyValueStore.getObject(`${STORAGE_PREFIX}${key}`);
    if (data) {
      data.expires = Date.now() + EXPIRE_AFTER_SECONDS;
      this.keyValueStore.setObject(`${STORAGE_PREFIX}${key}`, data);
      return data.value;
    }
  },

  setValue(key, value) {
    this.keyValueStore.setObject({
      key: `${STORAGE_PREFIX}${key}`,
      value: {
        expires: Date.now() + EXPIRE_AFTER_SECONDS,
        value,
      },
    });
  },

  removeValue(key) {
    this.keyValueStore.remove(`${STORAGE_PREFIX}${key}`);
  },

  initialize(container) {
    this.keyValueStore = container.lookup("service:key-value-store");
    this.expireOldValues();

    withPluginApi((api) => {
      api.decorateCookedElement(
        (cooked, helper) => {
          if (!helper) {
            return;
          }

          const postIdentifier = `${helper.model.topic?.id}-${helper.model.id}-`;
          const placeholders = {};

          const processChange = (inputEvent) => {
            const value = inputEvent.target.value;
            const key = inputEvent.target.dataset.key;
            const placeholder = placeholders[inputEvent.target.dataset.key];
            const placeholderIdentifier = `${postIdentifier}${key}`;

            if (value && value !== placeholder.default) {
              placeholder.value = value;
              this.setValue(placeholderIdentifier, value);
            } else {
              placeholder.value = placeholder.default;
              this.removeValue(placeholderIdentifier);
            }

            performReplacements(cooked, placeholders);
          };

          const placeholderNodes = cooked.querySelectorAll(
            ".d-wrap[data-wrap=placeholder]:not(.placeholdered)"
          );

          placeholderNodes.forEach((elem) => {
            const dataKey = elem.dataset.key;

            if (!dataKey) {
              return;
            }

            const placeholderIdentifier = `${postIdentifier}${dataKey}`;
            const valueFromStore = this.getValue(placeholderIdentifier);
            const defaultValues = (elem.dataset.defaults || "")
              .split(",")
              .filter(Boolean);

            placeholders[dataKey] = {
              default: elem.dataset.default,
              defaults: defaultValues,
              delimiter: elem.dataset.delimiter || DELIMITER,
              description: elem.dataset.description,
              value: valueFromStore || elem.dataset.default,
            };

            const span = document.createElement("span");
            span.classList.add("discourse-placeholder-name", "placeholdered");
            span.innerText = dataKey;

            // content has been set inside the [wrap][/wrap] block
            if (elem.querySelector("p")) {
              elem.querySelector("p").prepend(span);
            } else {
              elem.prepend(span);
            }

            if (defaultValues && defaultValues.length) {
              const select = buildSelect(dataKey, placeholders[dataKey]);
              elem.appendChild(select);
            } else {
              const input = buildInput(dataKey, placeholders[dataKey]);
              elem.appendChild(input);
            }
          });

          cooked
            .querySelectorAll(".discourse-placeholder-value")
            .forEach((el) => {
              el.addEventListener("input", (inputEvent) =>
                debounce(this, processChange, inputEvent, 150)
              );
            });

          cooked
            .querySelectorAll(".discourse-placeholder-select")
            .forEach((el) => {
              el.addEventListener("change", (inputEvent) =>
                debounce(this, processChange, inputEvent, 150)
              );
            });

          later(performReplacements, cooked, placeholders, 500);
        },
        { onlyStream: true, id: "discourse-placeholder-theme-component" }
      );

      api.addComposerToolbarPopupMenuOption({
        label: themePrefix("toolbar.builder"),
        icon: "file",
        action: (toolbarEvent) => {
          const modal = container.lookup("service:modal");
          modal.show(DiscoursePlaceholderBuilder, {
            model: {
              toolbarEvent,
            },
          });
        },
      });
    });
  },
};
