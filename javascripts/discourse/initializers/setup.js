import showModal from "discourse/lib/show-modal";
import { withPluginApi } from "discourse/lib/plugin-api";
import { later, debounce } from "@ember/runloop";
import cookie, { removeCookie } from "discourse/lib/cookie";

const VALID_TAGS =
  "h1, h2, h3, h4, h5, h6, p, code, blockquote, .md-table, li p";
const DELIMITER = "=";

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

  initialize() {
    withPluginApi("0.8.7", (api) => {
      api.decorateCooked(
        ($cooked, postWidget) => {
          if (!postWidget) return;

          const postIdentifier = `d-placeholder-${postWidget.widget.attrs.topicId}-${postWidget.widget.attrs.id}-`;
          const mappings = [];
          const placeholders = {};

          function processChange(inputEvent) {
            const value = inputEvent.target.value;
            const key = inputEvent.target.dataset.key;
            const placeholder = placeholders[inputEvent.target.dataset.key];
            const placeholderIdentifier = `${postIdentifier}${key}`;

            if (value) {
              if (value !== placeholder.default) {
                cookie(placeholderIdentifier, value);
              }
            } else {
              removeCookie(placeholderIdentifier);
            }

            let newValue;
            if (value && value.length && value !== "none") {
              newValue = value;
            } else {
              newValue = `${placeholder.delimiter}${key}${placeholder.delimiter}`;
            }

            $cooked.find(VALID_TAGS).each((index, elem) => {
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
          }

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

            $cooked.find(VALID_TAGS).each((index, elem) => {
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

          function _fillPlaceholders() {
            if (Object.keys(placeholders).length > 0) {
              processPlaceholders(placeholders, $cooked, mappings);

              // trigger fake event to setup initial state
              Object.keys(placeholders).forEach((placeholderKey) => {
                const placeholder = placeholders[placeholderKey];
                const placeholderIdentifier = `${postIdentifier}${placeholderKey}`;
                const value =
                  cookie(placeholderIdentifier) || placeholder.default;

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
          }

          const placeholderNodes = $cooked[0].querySelectorAll(
            ".d-wrap[data-wrap=placeholder]:not(.placeholdered)"
          );

          placeholderNodes.forEach((elem) => {
            const dataKey = elem.dataset.key;

            if (!dataKey) return;

            const placeholderIdentifier = `${postIdentifier}${dataKey}`;
            const valueFromCookie = cookie(placeholderIdentifier);
            const defaultValues = (elem.dataset.defaults || "")
              .split(",")
              .filter(Boolean);

            placeholders[dataKey] = {
              default: valueFromCookie || elem.dataset.default,
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

          $cooked
            .on("input", ".discourse-placeholder-value", (inputEvent) =>
              debounce(this, processChange, inputEvent, 150)
            )
            .on("change", ".discourse-placeholder-select", (inputEvent) =>
              debounce(this, processChange, inputEvent, 150)
            );

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
