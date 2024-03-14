<template>
  <div>
    <label class="block text-sm font-medium mb-2 dark:text-white">
      {{ label }}
    </label>

    <div class="relative">
      <select
        :disabled="disabled"
        :required="required"
        :value="modelValue"
        @input="updateModelValue"
        class="input"
        :class="{
          [`input--validation-error`]: !isValid,
        }"
        :multiple="multiple !== undefined ? multiple : expectsMultiple"
      >
        <option
          v-for="option of options"
          :class="{
            selected: expectsMultiple
              ? modelValue.includes(getValue(option))
              : false,
          }"
          :key="getValue(option)"
          :value="getValue(option)"
        >
          {{ option?.display || option }}
        </option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import ValidationIcon from "~/components/icons/ValidationIcon.vue";

export default {
  components: { ValidationIcon },
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: [String, Number, Array],
      default: "",
    },
    type: {
      type: String,
      default: "text",
    },
    label: {
      type: String,
      required: true,
    },
    validation: {
      type: Function,
      default: null,
    },
    options: {
      type: Object,
    },
    required: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    multiple: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    expectsMultiple() {
      return this.multiple || Array.isArray(this.modelValue);
    },
    isValid() {
      const length = this.expectsMultiple
        ? this.modelValue.length
        : this.modelValue?.toString().trim().length;

      return (
        (!this.required || length > 0) &&
        (!this.validation || this.validation(this.modelValue))
      );
    },
  },
  methods: {
    getValue(option) {
      return option.value !== undefined ? option?.value || "" : option;
    },
    updateModelValue(event) {
      let value = this.expectsMultiple
        ? Array.from(event.target.selectedOptions).map((option) => {
            return option.value;
          })
        : event.target.value;

      if (!this.expectsMultiple) {
        value = value.length === 0 ? null : value;
      }

      this.$emit("update:modelValue", value);
    },
  },
};
</script>

<style scoped>
.selected {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>
