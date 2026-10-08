<script setup lang="ts" generic="T">
import { computed } from "vue";
import UtilityTypeHeader from "~/components/utility/UtilityTypeHeader.vue";
import { UTILITY_TYPES } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

/**
 * A list of throws cut into types, each under a heading that pins while you
 * read its rows and is that type's filter -- the same list the Lineups tab
 * is, for anything that can say which utility it is. The rows keep the order
 * they were given in.
 */
const props = defineProps<{
  items: T[];
  typeOf: (item: T) => UtilityType;
  keyOf: (item: T) => string;
  /** The types the list is narrowed to. None is all of them. */
  types: UtilityType[];
}>();

const emit = defineEmits<{ (e: "toggle-type", type: UtilityType): void }>();

const sections = computed(() =>
  UTILITY_TYPES.map((type) => ({
    type,
    items: props.items.filter((item) => props.typeOf(item) === type),
  })).filter(
    (section) =>
      section.items.length &&
      (!props.types.length || props.types.includes(section.type)),
  ),
);
</script>

<template>
  <div class="flex flex-col">
    <template v-for="section of sections" :key="section.type">
      <div
        class="sticky top-[var(--utility-list-head,0px)] z-10 bg-sidebar pt-2 max-md:bg-background"
      >
        <UtilityTypeHeader
          :type="section.type"
          :count="section.items.length"
          :active="types.includes(section.type)"
          @toggle="emit('toggle-type', section.type)"
        />
      </div>
      <div class="flex flex-col gap-2 pt-2">
        <template v-for="item of section.items" :key="keyOf(item)">
          <slot :item="item" />
        </template>
      </div>
    </template>
  </div>
</template>
