// reka-ui throws on a <SelectItem value="">: an empty model value is reserved
// for "nothing selected, show the placeholder", so an explicit "none" option
// has to carry a sentinel instead. Vue swallows the setup throw and the item
// renders as "Component is missing template or render function".
export const SELECT_NONE = "__none__";

// Wraps a vee-validate componentField so the form still stores "" for none
// while the Select sees the sentinel.
export function nullableSelectField(field: Record<string, any>) {
  return {
    ...field,
    modelValue: field.modelValue || SELECT_NONE,
    "onUpdate:modelValue": (value: string) => {
      field["onUpdate:modelValue"](value === SELECT_NONE ? "" : value);
    },
  };
}
