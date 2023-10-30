<template>
  <div>
    <div class="relative">
      <label
        class="cursor-pointer flex p-3 block w-full bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-900 dark:border-gray-700 dark:text-gray-400"
      >
        <input
          :required="required"
          :checked="modelValue"
          @input="updateModelValue"
          type="checkbox"
          class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-gray-800 dark:border-gray-700 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800"
        />
        <span class="text-sm text-gray-500 ms-3 dark:text-gray-400">
          {{ label }}</span
        >
      </label>

      <template v-if="!isValid">
        <div
          class="absolute inset-y-0 end-0 flex items-center pointer-events-none pe-3"
        >
          <validation-icon></validation-icon>
        </div>
      </template>
    </div>

    <div class="text-sm text-red-600 mt-2" v-if="!isValid">Required.</div>
  </div>
</template>

<script lang="ts">
import ValidationIcon from "~/components/icons/ValidationIcon.vue";

export default {
  components: { ValidationIcon },
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: Boolean,
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
      this.$emit("update:modelValue", event.target.checked);
    },
  },
};
</script>
