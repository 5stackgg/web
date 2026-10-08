<script setup lang="ts">
import { Clapperboard, Link2, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import AutoHighlightsCover from "~/components/notification/AutoHighlightsCover.vue";
import type { FeatureSpotlight } from "~/composables/useFeatureSpotlights";

const props = defineProps<{ spotlight: FeatureSpotlight }>();

const dismiss = () => {
  useNotificationStore().dismissFeatureSpotlight(props.spotlight.key);
};

const actionClasses = "h-7 shrink-0 gap-1.5 px-2.5 text-[0.7rem] font-medium";
</script>

<template>
  <div
    class="overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-card/60"
  >
    <AutoHighlightsCover v-if="spotlight.key === 'auto_highlights'" />
    <div class="space-y-2 p-3">
      <div
        class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        <Clapperboard class="h-3 w-3 shrink-0" />
        <span class="truncate">{{ $t("feature_spotlights.label") }}</span>
      </div>
      <p class="text-sm font-semibold leading-snug text-foreground">
        {{ $t(spotlight.title) }}
      </p>
      <p class="text-xs leading-snug text-muted-foreground">
        {{ $t(spotlight.teaser) }}
      </p>

      <div class="flex flex-wrap items-center gap-1.5 pt-1">
        <Button as-child size="sm" :class="['tac-amber-cta', actionClasses]">
          <NuxtLink :to="spotlight.to" @click="dismiss">
            <Link2 class="h-3.5 w-3.5" />
            {{ $t(spotlight.action) }}
          </NuxtLink>
        </Button>
        <Button
          size="sm"
          variant="outline"
          :class="[actionClasses, 'text-muted-foreground']"
          @click="dismiss"
        >
          <X class="h-3.5 w-3.5" />
          {{ $t("layouts.notifications.dismiss") }}
        </Button>
      </div>
    </div>
  </div>
</template>
