<template>
  <div class="relative">
    <five-stack-text-input
      @keydown.enter="results.length === 1 && select(results[0])"
      :label="label"
      :placeholder="modelValue?.display || placeholder"
      :required="!modelValue && required"
      v-model="query"
    >
      <template v-slot:pre>
        <div
          class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4"
        >
          <div
            v-if="searching"
            class="animate-spin inline-block w-4 h-4 border-[3px] border-current border-t-transparent text-blue-600 rounded-full"
            role="status"
            aria-label="loading"
          >
            <span class="sr-only">Loading...</span>
          </div>
          <svg
            v-else
            class="flex-shrink-0 h-4 w-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </template>
      <template v-slot:post v-if="modelValue">
        <div
          @click="remove(modelValue)"
          class="cursor-pointer flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 bg-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-gray-700 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
        >
          <close-icon></close-icon>
        </div>
      </template>
    </five-stack-text-input>

    <template v-if="results">
      <template v-if="results.length === 0">
        <div
          class="absolute z-10 left-0 right-0 p-4 border border-gray-600 rounded-b bg-gray-800"
        >
          No Results
        </div>
      </template>
      <template v-for="result of results" v-else>
        <div
          @click="select(result)"
          class="absolute z-10 left-0 right-0 p-4 border border-gray-600 rounded-b cursor-pointer bg-gray-700 hover:bg-gray-800"
        >
          <div v-html="result.display"></div>
        </div>
      </template>
    </template>
  </div>

  <template v-if="Array.isArray(modelValue)">
    <div v-for="selected of modelValue" class="p-2">
      <div class="flex">
        <div v-html="selected.display" class="flex-auto"></div>
        <div
          @click="remove(selected)"
          class="cursor-pointer flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 bg-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-gray-700 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
        >
          <close-icon></close-icon>
        </div>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import ValidationIcon from "~/components/icons/ValidationIcon.vue";
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
import debounce from "~/utilities/debounce";
import CloseIcon from "~/components/icons/CloseIcon.vue";

export default {
  components: { CloseIcon, FiveStackTextInput, ValidationIcon },
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: [Array, String, Object],
      default: "",
    },
    type: {
      type: String,
      default: "text",
    },
    label: {
      type: String,
      required: false,
      default: "",
    },
    placeholder: {
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
    search: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      query: "",
      searching: false,
      results: undefined,
      searchDebounce: debounce(async (query) => {
        this.searching = true;
        try {
          this.results = await this.search(query);
        } finally {
          this.searching = false;
        }
      }, 300),
    };
  },
  watch: {
    query: {
      immediate: true,
      handler(query) {
        this.results = undefined;
        if (query.length > 0) {
          this.searchDebounce(query);
        }
      },
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
    remove(value: string) {
      if (!Array.isArray(this.modelValue)) {
        this.$emit("update:modelValue", undefined);
        return;
      }

      const values = Object.assign([], this.modelValue);
      const foundIndex = values.indexOf(value);

      values.splice(foundIndex, 1);

      this.$emit("update:modelValue", values);
    },
    select(value: string | Array<string>) {
      this.query = "";
      this.results = undefined;
      if (!Array.isArray(this.modelValue)) {
        this.$emit("update:modelValue", value);
        return;
      }

      const values = Object.assign([], this.modelValue);
      const foundIndex = values.indexOf(value);

      if (foundIndex === -1) {
        values.push(value);
      } else {
        values.splice(foundIndex, 1);
      }

      this.$emit("update:modelValue", values);
    },
  },
};
</script>
