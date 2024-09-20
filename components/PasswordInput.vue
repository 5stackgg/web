<script lang="ts" setup>
import { EyeIcon, EyeOffIcon } from "lucide-vue-next";
</script>

<template>
  <div>
    <Label v-if="label">{{ label }}</Label>
    <div class="relative w-full max-w-sm items-center">
      <Input
        class="pl-10"
        :type="showPassword ? 'text' : 'password'"
        :value="modelValue"
        @input="updateModelValue"
        :disabled="disabled"
      />
      <span
        @click="toggle"
        class="absolute start-0 inset-y-0 flex items-center justify-center px-2 cursor-pointer"
      >
        <EyeIcon v-if="showPassword" class="size-4" aria-hidden="true" />
        <EyeOffIcon v-else class="size-4" aria-hidden="true" />
      </span>
    </div>
    <p v-if="description" class="text-sm text-muted-foreground">
      {{ description }}
    </p>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    label: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    modelValue: {
      type: String,
      default: "",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      showPassword: false,
      inputValue: this.value,
    };
  },
  methods: {
    toggle() {
      this.showPassword = !this.showPassword;
    },
    updateModelValue(event) {
      this.$emit("update:modelValue", event.target.value);
    },
  },
};
</script>
