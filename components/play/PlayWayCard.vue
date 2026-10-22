<script setup lang="ts">
import type { Component } from "vue";
import PublicServerMap from "~/components/public-servers/PublicServerMap.vue";

// One way to play in "More ways to play", drawn one of three ways:
//   featured: the big card. Map art behind a fade, a kicker over the title,
//             one line, a preview (#preview) and the actions.
//   peek:     a half of the panel beside it. An icon tile, the title, one
//             line and one button over a preview of what's inside.
//   tile:     a plain card, its actions pinned to the bottom so cards of
//             different heights line their buttons up.
withDefaults(
  defineProps<{
    title: string;
    icon?: Component;
    layout?: "featured" | "peek" | "tile";
    // Raw map name (de_mirage) for the featured card's art.
    art?: string | null;
  }>(),
  { layout: "tile", icon: undefined, art: null },
);
</script>

<template>
  <article
    v-if="layout === 'featured'"
    class="way-featured relative isolate flex min-w-0 flex-col justify-end overflow-hidden rounded-[10px] border border-border bg-card"
  >
    <div class="way-art absolute inset-0 -z-20" aria-hidden="true">
      <PublicServerMap :map="art || 'default'" />
    </div>
    <div class="way-shade absolute inset-0 -z-10" aria-hidden="true"></div>

    <div class="way-body grid min-w-0 gap-1.5 p-4">
      <div
        v-if="$slots.kicker"
        class="flex min-w-0 items-center gap-[7px] text-[12.5px] font-semibold"
      >
        <slot name="kicker" />
      </div>
      <h3 class="way-title m-0 text-[19px] font-bold leading-tight">
        {{ title }}
      </h3>
      <div v-if="$slots.default" class="text-[13px] text-foreground/70">
        <slot />
      </div>
      <slot name="preview" />
      <div
        v-if="$slots.actions"
        class="mt-1.5 flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
  </article>

  <section
    v-else-if="layout === 'peek'"
    class="flex min-w-0 flex-1 flex-col justify-between gap-2 px-3.5 py-2.5"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        class="grid size-8 shrink-0 place-items-center rounded-md bg-muted/60 text-foreground/85"
      >
        <slot name="icon">
          <component :is="icon" class="size-4" />
        </slot>
      </span>
      <div class="grid min-w-0 flex-1 gap-px">
        <h3 class="m-0 line-clamp-2 break-words text-sm font-bold leading-snug">
          {{ title }}
        </h3>
        <span
          v-if="$slots.default"
          class="truncate text-xs text-muted-foreground"
        >
          <slot />
        </span>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot name="preview" />
  </section>

  <article
    v-else
    class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4"
  >
    <div class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="grid size-8 shrink-0 place-items-center rounded-md bg-muted/60 text-foreground/85"
      >
        <component :is="icon" class="size-4" />
      </span>
      <h3 class="m-0 text-[15px] font-bold">{{ title }}</h3>
    </div>

    <slot />

    <div v-if="$slots.actions" class="mt-auto flex flex-wrap gap-2 pt-1">
      <slot name="actions" />
    </div>
  </article>
</template>

<style scoped>
.way-featured {
  min-height: 236px;
}
/* Phones: the art fills the card and fades to the background at the
   bottom, where the text sits. */
.way-shade {
  background: linear-gradient(
    180deg,
    hsl(var(--background) / 0.1) 0%,
    hsl(var(--background) / 0.6) 42%,
    hsl(var(--background) / 0.95) 78%
  );
}

/* Wide: the art sits on the right and fades out to the left, under the
   text. The container is the "More ways to play" section. */
@container ways (min-width: 720px) {
  .way-featured {
    min-height: 220px;
    justify-content: center;
  }
  .way-shade {
    background: linear-gradient(
      90deg,
      hsl(var(--background) / 0.96) 0%,
      hsl(var(--background) / 0.82) 45%,
      hsl(var(--background) / 0.15) 100%
    );
  }
  .way-art {
    left: 28%;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 45%);
    mask-image: linear-gradient(90deg, transparent, #000 45%);
  }
  .way-body {
    max-width: 70%;
    padding: 20px 22px;
  }
  .way-title {
    font-size: 21px;
  }
}
</style>
