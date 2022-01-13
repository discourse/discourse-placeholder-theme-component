import showModal from "discourse/lib/show-modal";
import { withPluginApi } from "discourse/lib/plugin-api";
import { later, debounce } from "@ember/runloop";
import cookie, { removeCookie } from "discourse/lib/cookie";

const VALID_TAGS =
  "h1, h2, h3, h4, h5, h6, p, code, blockquote, .md-table, li p";
const DELIMITER = "=";
const EXPIRE_AFTER_DAYS = 7;
const EXPIRE_AFTER_SECONDS = EXPIRE_AFTER_DAYS * 24 * 60 * 60;
const STORAGE_PREFIX = "d-placeholder-";

function buildInput(key, placeholder) {
  const input = document.createElement("input");
  input.classList.add("discourse-placeholder-value");
  input.dataset.key = key;
  input.dataset.delimiter = placeholder.delimiter;

  if (placeholder.description) {
    input.setAttribute("placeholder", placeholder.description);
  }

  if (placeholder.default) {
    input.value = placeholder.default;
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
      selected: placeholder.default === value,
    })
  );

  return select;
}

export default {
  name: "discourse-placeholder-theme-component",

  // TODO: Remove once this change has been live for a few months
  migrateCookiesToKeyValueStore() {
    const cookies = document.cookie.split("; ");
    const oldPlaceholderCookies = [];

    for (let i = 0, l = cookies.length; i < l; i++) {
      let parts = cookies[i].split("=");
      if (parts[0].startsWith(STORAGE_PREFIX)) {
        oldPlaceholderCookies.push(parts[0]);
      }
    }

    for (const key of oldPlaceholderCookies) {
      const value = cookie(key);

      this.setValue(key, value);
      removeCookie(key);
    }
  },

  expireOldValues() {
    const now = Date.now();
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => {
        const data = this.keyValueStore.getObject(k);
        if (!data?.expires || data.expires < now) {
          this.removeValue(k);
        }
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
        value: value,
      },
    });
  },

  removeValue(key) {
    this.keyValueStore.remove(`${STORAGE_PREFIX}${key}`);
  },

  initialize(container) {
    this.keyValueStore = container.lookup("key-value-store:main");

    this.migrateCookiesToKeyValueStore();
    this.expireOldValues();

    withPluginApi("0.8.7", (api) => {
      api.decorateCookedElement(
        (cooked, postWidget) => {
          if (!postWidget) return;

          const postIdentifier = `${postWidget.widget.attrs.topicId}-${postWidget.widget.attrs.id}-`;
          const mappings = [];
          const placeholders = {};

          const processChange = (inputEvent) => {
            const value = inputEvent.target.value;
            const key = inputEvent.target.dataset.key;
            const placeholder = placeholders[inputEvent.target.dataset.key];
            const placeholderIdentifier = `${postIdentifier}${key}`;

            if (value) {
              if (value !== placeholder.default) {
                this.setValue(placeholderIdentifier, value);
              }
            } else {
              this.removeValue(placeholderIdentifier);
            }

            let newValue;
            if (value && value.length && value !== "none") {
              newValue = value;
            } else {
              newValue = `${placeholder.delimiter}${key}${placeholder.delimiter}`;
            }

            cooked.querySelectorAll(VALID_TAGS).forEach((elem, index) => {
              const mapping = mappings[index];

              if (!mapping) return;

              let diff = 0;
              let replaced = false;
              let newInnnerHTML = elem.innerHTML;

              mapping.forEach((m) => {
                if (
                  m.pattern !==
                  `${placeholder.delimiter}${key}${placeholder.delimiter}`
                ) {
                  m.position = m.position + diff;
                  return;
                }

                replaced = true;

                const previousLength = m.length;
                const prefix = newInnnerHTML.slice(0, m.position + diff);
                const suffix = newInnnerHTML.slice(
                  m.position + diff + m.length,
                  newInnnerHTML.length
                );
                newInnnerHTML = `${prefix}${newValue}${suffix}`;

                m.length = newValue.length;
                m.position = m.position + diff;
                diff = diff + newValue.length - previousLength;
              });

              if (replaced) elem.innerHTML = newInnnerHTML;
            });
          };

          function processPlaceholders() {
            mappings.length = 0;

            const keys = Object.keys(placeholders);
            const pattern = keys
              .map((key) => {
                const placeholder = placeholders[key];
                return `(${placeholder.delimiter}${key}${placeholder.delimiter})`;
              })
              .join("|");
            const regex = new RegExp(pattern, "g");

            cooked.querySelectorAll(VALID_TAGS).forEach((elem, index) => {
              let match;

              mappings[index] = mappings[index] || [];

              while ((match = regex.exec(elem.innerHTML)) != null) {
                mappings[index].push({
                  pattern: match[0],
                  position: match.index,
                  length: match[0].length,
                });
              }
            });
          }

          const _fillPlaceholders = () => {
            if (Object.keys(placeholders).length > 0) {
              processPlaceholders(placeholders, cooked, mappings);

              // trigger fake event to setup initial state
              Object.keys(placeholders).forEach((placeholderKey) => {
                const placeholder = placeholders[placeholderKey];
                const placeholderIdentifier = `${postIdentifier}${placeholderKey}`;
                const value =
                  this.getValue(placeholderIdentifier) || placeholder.default;

                processChange({
                  target: {
                    value,
                    dataset: {
                      key: placeholderKey,
                      delimiter: placeholder.delimiter,
                    },
                  },
                });
              });
            }
          };

          const placeholderNodes = cooked.querySelectorAll(
            ".d-wrap[data-wrap=placeholder]:not(.placeholdered)"
          );

          placeholderNodes.forEach((elem) => {
            const dataKey = elem.dataset.key;

            if (!dataKey) return;

            const placeholderIdentifier = `${postIdentifier}${dataKey}`;
            const valueFromStore = this.getValue(placeholderIdentifier);
            const defaultValues = (elem.dataset.defaults || "")
              .split(",")
              .filter(Boolean);

            placeholders[dataKey] = {
              default: valueFromStore || elem.dataset.default,
              defaults: defaultValues,
              delimiter: elem.dataset.delimiter || DELIMITER,
              description: elem.dataset.description,
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
              el.addEventListener("change", (inputEvent) =>
                debounce(this, processChange, inputEvent, 150)
              );
            });

          later(_fillPlaceholders, 500);
        },
        { onlyStream: true, id: "discourse-placeholder-theme-component" }
      );

      api.addToolbarPopupMenuOptionsCallback(() => {
        return {
          action: "insertPlaceholder",
          icon: "file",
          label: themePrefix("toolbar.builder"),
        };
      });

      api.modifyClass("controller:composer", {
        pluginId: "discourse-placeholder-theme-component",

        actions: {
          insertPlaceholder() {
            showModal("discourse-placeholder-builder", {
              model: {
                toolbarEvent: this.toolbarEvent,
              },
            });
          },
        },
      });
    });
  },
};
