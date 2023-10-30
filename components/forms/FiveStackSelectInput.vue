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
      >
        <option v-for="option of options" :value="option?.value || option">
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
      type: String,
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
  },
  computed: {
    isValid() {
      return (
        (!this.required || this.modelValue?.trim().length > 0) &&
        (!this.validation || this.validation(this.modelValue))
      );
    },
  },
  methods: {
    updateModelValue(event) {
      this.$emit("update:modelValue", event.target.value);
    },
  },
};
</script>
