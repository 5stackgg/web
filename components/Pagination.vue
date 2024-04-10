<template>
  <div
    class="grid justify-center sm:flex sm:justify-between sm:items-center gap-1"
  >
    <nav class="flex items-center gap-x-1">
      <button
        @click="paginate(current - 1)"
        type="button"
        :disabled="current === 1"
        class="min-h-[38px] min-w-[38px] py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:border-transparent dark:text-white dark:hover:bg-white/10 dark:focus:bg-white/10"
      >
        <left-chevron></left-chevron>
        <span aria-hidden="true" class="sr-only">Previous</span>
      </button>

      <button
        @click="paginate(1)"
        type="button"
        :disabled="current === 1"
        class="min-h-[38px] min-w-[38px] flex justify-center items-center border border-transparent text-gray-800 py-2 px-3 text-sm rounded-lg focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white"
        :class="{
          [`border-gray-200 dark:border-gray-700`]: current === 1,
        }"
      >
        1
      </button>

      <div class="hs-tooltip inline-block" v-if="total > 10">
        <button
          type="button"
          @click="setQuickPages(quickPage - 3)"
          class="hs-tooltip-toggle group min-h-[38px] min-w-[38px] flex justify-center items-center text-gray-400 hover:text-blue-600 p-2 text-sm rounded-lg focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-gray-500 dark:hover:text-blue-500 dark:focus:bg-white/10"
        >
          <span class="group-hover:hidden text-xs">•••</span>
          <left-skip></left-skip>
          <span
            class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded shadow-sm dark:bg-slate-700"
            role="tooltip"
          >
            Previous 3 pages
          </span>
        </button>
      </div>

      <div class="flex items-center gap-x-1">
        <template v-for="page of quickPages">
          <button
            @click="paginate(page)"
            type="button"
            class="min-h-[38px] min-w-[38px] flex justify-center items-center border border-transparent text-gray-800 py-2 px-3 text-sm rounded-lg focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white"
            :class="{
              [`hover:bg-gray-100 dark:border-transparent dark:hover:bg-white/10 dark:focus:bg-white/10`]:
                current !== page,
              [`border-gray-200 dark:border-gray-700`]: current === page,
            }"
          >
            {{ page }}
          </button>
        </template>

        <div class="hs-tooltip inline-block" v-if="total > 10">
          <button
            type="button"
            @click="setQuickPages(quickPage + 3)"
            class="hs-tooltip-toggle group min-h-[38px] min-w-[38px] flex justify-center items-center text-gray-400 hover:text-blue-600 p-2 text-sm rounded-lg focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-gray-500 dark:hover:text-blue-500 dark:focus:bg-white/10"
          >
            <span class="group-hover:hidden text-xs">•••</span>
            <right-skip></right-skip>
            <span
              class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded shadow-sm dark:bg-slate-700"
              role="tooltip"
            >
              Next 3 pages
            </span>
          </button>
        </div>

        <button
          @click="paginate(total)"
          type="button"
          :disabled="current === total"
          v-if="total > 1"
          class="min-h-[38px] min-w-[38px] flex justify-center items-center border border-transparent text-gray-800 py-2 px-3 text-sm rounded-lg focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white"
          :class="{
            [`border-gray-200 dark:border-gray-700`]: current === total,
          }"
        >
          {{ total }}
        </button>
      </div>

      <button
        @click="paginate(current + 1)"
        :disabled="current === total"
        type="button"
        class="min-h-[38px] min-w-[38px] py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg border border-transparent text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:border-transparent dark:text-white dark:hover:bg-white/10 dark:focus:bg-white/10"
      >
        <span aria-hidden="true" class="sr-only">Next</span>
        <right-chevron></right-chevron>
      </button>
    </nav>

    <div class="flex justify-center sm:justify-start items-center gap-x-2">
      <span class="text-sm text-gray-800 whitespace-nowrap dark:text-white">
        Go to
      </span>
      <input
        type="number"
        class="min-h-[38px] py-2 px-2.5 block w-12 border-gray-200 rounded-lg text-sm text-center focus:border-blue-500 focus:ring-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-700 dark:text-gray-400 dark:focus:ring-gray-600"
        style="-moz-appearance: textfield"
      />
      <span class="text-sm text-gray-800 whitespace-nowrap dark:text-white">
        page
      </span>
    </div>
  </div>
</template>

<script>
import LeftChevron from "~/components/icons/LeftChevron.vue";
import RightChevron from "~/components/icons/RightChevron.vue";
import RightSkip from "~/components/icons/RightSkip.vue";
import LeftSkip from "~/components/icons/LeftSkip.vue";

export default {
  components: { LeftSkip, RightSkip, RightChevron, LeftChevron },
  props: {
    total: {
      type: Number,
      required: true,
    },
    page: {
      type: Number,
      required: true,
    },
  },
  emits: ["page"],
  watch: {
    current: {
      immediate: true,
      handler() {
        this.setQuickPages(this.current);
      },
    },
  },
  data() {
    return {
      quickPage: undefined,
    };
  },
  methods: {
    paginate(page) {
      if (page) {
        this.$emit("page", page);
      }
    },
    setQuickPages(page) {
      if (page < 4) {
        page = 4;
      }

      if (page > this.total - 3) {
        page = this.total - 3;
      }

      this.quickPage = page;
    },
  },
  computed: {
    quickPages() {
      if (this.total < 10) {
        return [];
      }

      const startPage = Math.max(this.quickPage - 2, 0);
      const endPage = this.quickPage + 3;

      return Array.from({ length: endPage - startPage }, (_, index) => {
        return startPage + index;
      });
    },
    current() {
      return this.page;
    },
  },
};
</script>
