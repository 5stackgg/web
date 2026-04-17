<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

defineProps<{ compact?: boolean }>();

const baseClasses =
  "group/cm relative flex items-start gap-4 border border-border [background:linear-gradient(135deg,hsl(var(--card)/0.7)_0%,hsl(var(--card)/0.35)_60%,hsl(var(--tac-amber)/0.05)_100%)] text-foreground overflow-hidden isolate [transition:border-color_180ms_ease,background_220ms_ease,transform_180ms_ease,box-shadow_220ms_ease] cursor-pointer hover:border-[hsl(var(--tac-amber)/0.55)] hover:[background:linear-gradient(135deg,hsl(var(--card)/0.8)_0%,hsl(var(--card)/0.45)_55%,hsl(var(--tac-amber)/0.12)_100%)] hover:shadow-[0_0_24px_hsl(var(--tac-amber)/0.12)] focus-visible:outline-none focus-visible:border-[hsl(var(--tac-amber))] focus-visible:shadow-[0_0_0_2px_hsl(var(--tac-amber)/0.35)]";

const fullClasses =
  "px-[1.75rem] py-6 gap-5 items-center [clip-path:polygon(0_0,calc(100%_-_18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%_-_18px))] max-sm:!flex-col max-sm:!items-start max-sm:!p-5";

const compactClasses =
  "flex-1 flex-col gap-3 px-[1.1rem] pt-4 pb-5 min-h-[120px]";
</script>

<template>
  <NuxtLink
    :to="{ name: 'matches-create' }"
    :class="[baseClasses, compact ? compactClasses : fullClasses]"
  >
    <span
      class="absolute top-2 left-2 w-[14px] h-[14px] border-0 border-solid border-[hsl(var(--tac-amber))] border-t-2 border-l-2 pointer-events-none z-[2] [transition:border-color_180ms_ease]"
      aria-hidden="true"
    ></span>
    <span
      class="absolute bottom-2 right-2 w-[14px] h-[14px] border-0 border-solid border-[hsl(var(--tac-amber))] border-b-2 border-r-2 pointer-events-none z-[2] [transition:border-color_180ms_ease]"
      aria-hidden="true"
    ></span>
    <span
      class="absolute inset-0 z-0 pointer-events-none opacity-0 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.03)_3px,hsl(var(--tac-amber)/0.03)_4px)] transition-opacity [transition-duration:220ms] group-hover/cm:opacity-100"
      aria-hidden="true"
    ></span>

    <div class="relative z-[1] flex-1 min-w-0 flex flex-col gap-[0.35rem]">
      <div
        :class="[
          'inline-flex items-center gap-[0.55rem] font-mono font-bold tracking-[0.24em] uppercase transition-colors [transition-duration:180ms] group-hover/cm:text-[hsl(var(--tac-amber))]',
          compact
            ? 'text-[0.72rem] text-muted-foreground'
            : 'text-base tracking-[0.22em] text-foreground',
        ]"
      >
        <span
          class="inline-block w-[10px] h-[2px] bg-[hsl(var(--tac-amber))]"
          aria-hidden="true"
        ></span>
        CUSTOM.MATCH
      </div>
      <p
        :class="[
          'm-0 leading-[1.5] text-muted-foreground',
          compact ? 'text-[0.78rem]' : 'text-[0.82rem]',
        ]"
      >
        {{ $t("custom_match.description") }}
      </p>
    </div>

    <div
      v-if="!compact"
      class="relative z-[1] inline-flex items-center gap-2 flex-shrink-0 px-4 py-[0.65rem] border border-border bg-card/60 font-mono text-[0.72rem] font-bold tracking-[0.2em] uppercase text-muted-foreground [transition:color_180ms_ease,border-color_180ms_ease,background_180ms_ease,transform_180ms_ease] group-hover/cm:text-[hsl(var(--tac-amber))] group-hover/cm:border-[hsl(var(--tac-amber)/0.5)] group-hover/cm:bg-[hsl(var(--tac-amber)/0.1)] max-sm:w-full max-sm:justify-center"
      aria-hidden="true"
    >
      <span class="leading-none">{{ $t("common.create") }}</span>
      <ArrowRight
        class="size-4 transition-transform [transition-duration:180ms] group-hover/cm:translate-x-0.5"
      />
    </div>
  </NuxtLink>
</template>

<script lang="ts">
export default {
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
