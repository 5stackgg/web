<template>
  <div>
    <label class="block text-sm font-medium mb-2 dark:text-white">
      {{ label }}
    </label>

    <div class="relative">
      <slot name="pre"></slot>
      <input
        :type="type"
        class="input"
        :class="{
          [`input--validation-error`]: !isValid,
          [`ps-11`]: !!$slots.pre,
        }"
        :required="required"
        :value="modelValue"
        @input="updateModelValue"
        :placeholder="placeholder"
      />

      <div
        v-if="!isValid || $slots.post"
        class="absolute inset-y-0 end-0 flex items-center pe-3"
      >
        <slot name="post"></slot>
        <template v-if="!isValid">
          <validation-icon></validation-icon>
        </template>
      </div>
    </div>

    <div class="text-sm text-red-600 mt-2" v-if="!isValid">
      Please enter a valid {{ label.toLowerCase() }}.
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
    placeholder: {
      type: String,
      required: false,
    },
    validation: {
      type: Function,
      default: null,
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    isValid() {
      return (
        (!this.required || this.modelValue.trim().length > 0) &&
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
