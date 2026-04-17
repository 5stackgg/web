<script setup lang="ts">
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-icons/vue";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationItem,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
} from "~/components/ui/pagination";

const navControlClass =
  "size-9 shrink-0 rounded-md p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground disabled:opacity-35";
const pageItemBaseClass =
  "size-9 shrink-0 rounded-md border text-sm font-semibold tabular-nums shadow-none";
const activePageItemClass =
  "border-border/80 bg-background text-foreground hover:bg-background";
const inactivePageItemClass =
  "border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/40 hover:text-foreground";
</script>

<template>
  <div
    class="mt-4 flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <PaginationRoot
      v-slot="{ page }"
      :key="`pagination-${current}`"
      class="mx-0 min-w-0 flex-1 justify-start overflow-x-auto"
      :total="total"
      :items-per-page="perPage"
      :sibling-count="1"
      show-edges
      :default-page="current"
      @update:page="paginate"
    >
      <PaginationContent v-slot="{ items }" class="flex-nowrap gap-1 pr-2">
        <PaginationFirst :class="navControlClass">
          <DoubleArrowLeftIcon class="size-3.5" />
          <span class="sr-only">First page</span>
        </PaginationFirst>
        <PaginationPrevious :class="navControlClass">
          <ChevronLeftIcon class="size-3.5" />
          <span class="sr-only">Previous page</span>
        </PaginationPrevious>

        <template v-for="(item, index) in items">
          <PaginationItem
            v-if="item.type === 'page'"
            :key="`page-${item.value}`"
            :value="item.value"
            :is-active="item.value === page"
            :class="[
              pageItemBaseClass,
              item.value === page ? activePageItemClass : inactivePageItemClass,
            ]"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis
            v-else
            :key="`ellipsis-${index}`"
            :index="index"
            class="h-9 w-7 shrink-0 text-muted-foreground"
          >
            <span aria-hidden="true" class="text-sm font-semibold">...</span>
            <span class="sr-only">More pages</span>
          </PaginationEllipsis>
        </template>

        <PaginationNext :class="navControlClass">
          <ChevronRightIcon class="size-3.5" />
          <span class="sr-only">Next page</span>
        </PaginationNext>
        <PaginationLast :class="navControlClass">
          <DoubleArrowRightIcon class="size-3.5" />
          <span class="sr-only">Last page</span>
        </PaginationLast>
      </PaginationContent>
    </PaginationRoot>

    <div v-if="showPerPageSelector" class="flex items-center gap-2">
      <Label
        for="per-page-select"
        class="text-sm text-muted-foreground whitespace-nowrap"
      >
        {{ $t("pagination.items_per_page") }}
      </Label>
      <Select
        :model-value="perPage.toString()"
        @update:model-value="onPerPageChange"
      >
        <SelectTrigger id="per-page-select" class="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10</SelectItem>
          <SelectItem value="25">25</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    total: {
      type: Number,
      required: true,
    },
    page: {
      type: Number,
      required: true,
    },
    perPage: {
      type: Number,
      required: true,
    },
    showPerPageSelector: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["page", "update:perPage"],
  methods: {
    paginate(page: number) {
      if (page) {
        this.$emit("page", page);
      }
    },
    onPerPageChange(value: any) {
      if (value != null) {
        const newPerPage =
          typeof value === "string" ? parseInt(value) : Number(value);
        if (!isNaN(newPerPage)) {
          this.$emit("update:perPage", newPerPage);
          // Reset to page 1 when per page changes
          this.$emit("page", 1);
        }
      }
    },
  },
  computed: {
    prev() {
      return this.page - 1;
    },
    next() {
      return this.page + 1;
    },
    current() {
      return this.page;
    },
  },
};
</script>
