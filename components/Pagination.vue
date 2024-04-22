<script setup lang="ts"></script>

<template>
  <Pagination
    v-slot="{ page }"
    :total="total"
    :items-per-page="perPage"
    :sibling-count="1"
    show-edges
    :default-page="current"
    @update:page="paginate"
  >
    <PaginationList v-slot="{ items }" class="flex items-center gap-1">
      <PaginationFirst />
      <PaginationPrev />

      <template v-for="(item, index) in items">
        <PaginationListItem
          v-if="item.type === 'page'"
          :key="index"
          :value="item.value"
          as-child
        >
          <Button
            class="w-10 h-10 p-0"
            :variant="item.value === page ? 'default' : 'outline'"
          >
            {{ item.value }}
          </Button>
        </PaginationListItem>
        <PaginationEllipsis v-else :key="item.type" :index="index" />
      </template>

      <PaginationNext />
      <PaginationLast />
    </PaginationList>
  </Pagination>
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
  },
  emits: ["page"],
  methods: {
    paginate(page: number) {
      if (page) {
        this.$emit("page", page);
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
