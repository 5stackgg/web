<script setup lang="ts">
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
</script>

<template>
  <div class="flex items-center justify-between gap-4 mt-4">
    <PaginationRoot
      v-slot="{ page }"
      :key="`pagination-${current}`"
      :total="total"
      :items-per-page="perPage"
      :sibling-count="1"
      show-edges
      :default-page="current"
      @update:page="paginate"
    >
      <PaginationContent v-slot="{ items }" class="flex items-center gap-1">
        <PaginationFirst />
        <PaginationPrevious />

        <template v-for="(item, index) in items">
          <PaginationItem
            v-if="item.type === 'page'"
            :key="index"
            :value="item.value"
            :is-active="item.value === page"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else :key="item.type" :index="index" />
        </template>

        <PaginationNext />
        <PaginationLast />
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
