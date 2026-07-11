<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import EventMediaCard from "~/components/events/EventMediaCard.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// 3-column grid that grows with a "load more" button.
const PAGE_SIZE = 9;

const props = defineProps<{
  event: { id: string; banner_media_id?: string | null; media?: any[] };
}>();

const emit = defineEmits<{ (e: "go", tab: string): void }>();

const items = computed(() =>
  (props.event.media || []).filter(
    (item: any) => item.id !== props.event.banner_media_id,
  ),
);

const shown = ref(PAGE_SIZE);
watch(items, (list) => {
  if (shown.value > list.length) shown.value = Math.max(PAGE_SIZE, list.length);
});

const visible = computed(() => items.value.slice(0, shown.value));
const hasMore = computed(() => items.value.length > shown.value);

function loadMore() {
  shown.value += PAGE_SIZE;
}
</script>

<template>
  <section v-if="items.length > 0">
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-2">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.tabs.media") }}
      </span>
      <button
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] normal-case tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        @click="emit('go', 'media')"
      >
        {{ $t("common.see_all") }}
        <ArrowRight class="h-3 w-3" />
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <EventMediaCard
        v-for="item in visible"
        :key="item.id"
        :event="event"
        :item="item"
      />
    </div>

    <div v-if="hasMore" class="mt-4 flex justify-center">
      <Button variant="outline" size="sm" @click="loadMore">
        {{ $t("event.media.show_more") }}
        ({{ visible.length }}/{{ items.length }})
      </Button>
    </div>
  </section>
</template>
