<script setup lang="ts">
import { computed } from "vue";
import { NuxtLink } from "#components";
import type { TickerCellModel } from "~/components/watch/watchTicker";
import { streamPlatformMeta } from "~/components/watch/streamPlatform";

const props = defineProps<{
  model: TickerCellModel;
  // A live match the stage can show: the cell swaps it onto the stage
  // instead of linking to the match page.
  streamable?: boolean;
  // Named so it can't collide with the `@stage` listener (`onStage`).
  staged?: boolean;
}>();

defineEmits<{ (e: "stage", matchId: string): void }>();

const platform = computed(() => streamPlatformMeta(props.model.streams[0]));

// Team avatars are stored as paths on the API host.
const apiDomain = useRuntimeConfig().public.apiDomain;
function avatarSrc(path: string) {
  return /^https?:\/\//.test(path) ? path : `https://${apiDomain}/${path}`;
}
const ariaLabel = computed(() =>
  [
    `${props.model.teams[0].name} – ${props.model.teams[1].name}`,
    props.model.status.text,
    props.model.teams[0].score !== null
      ? `${props.model.teams[0].score}–${props.model.teams[1].score}`
      : null,
  ]
    .filter(Boolean)
    .join(", "),
);

const cellClasses = computed(() => [
  "relative flex h-[6.875rem] w-56 shrink-0 snap-start flex-col gap-1.5 rounded-lg border px-3 pb-2.5 pt-2 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  props.staged
    ? "border-[hsl(var(--tac-amber))] bg-muted/30 shadow-[inset_0_0_0_1px_hsl(var(--tac-amber))]"
    : "border-border bg-muted/20 hover:bg-muted/40",
]);
</script>

<template>
  <component
    :is="streamable ? 'button' : NuxtLink"
    v-bind="
      streamable
        ? { type: 'button' }
        : { to: { name: 'matches-id', params: { id: model.id } } }
    "
    :class="cellClasses"
    :aria-label="ariaLabel"
    :aria-current="staged ? 'true' : undefined"
    @click="streamable && $emit('stage', model.id)"
  >
    <span
      class="flex h-4 items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span
        class="inline-flex min-w-0 items-center gap-1.5 truncate tabular-nums"
        :class="
          model.kind === 'live' || model.kind === 'upcoming'
            ? 'font-semibold text-foreground'
            : ''
        "
      >
        <span
          v-if="model.status.dot === 'live'"
          class="relative inline-flex size-2 shrink-0"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
          ></span>
          <span
            class="relative inline-flex size-2 rounded-full bg-destructive"
          ></span>
        </span>
        <span
          v-else-if="model.status.dot === 'idle'"
          class="inline-flex size-2 shrink-0 rounded-full bg-muted-foreground/60"
        ></span>
        <span class="truncate">{{ model.status.text }}</span>
      </span>
      <span class="inline-flex shrink-0 items-center gap-1.5">
        <span v-if="staged" class="font-semibold text-[hsl(var(--tac-amber))]">
          {{ $t("pages.watch.ticker.on_stage") }}
        </span>
        <component
          :is="platform.icon"
          v-else-if="platform"
          class="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span
          v-if="model.you"
          class="inline-flex items-center gap-1 font-semibold text-[hsl(var(--tac-amber))]"
        >
          <span class="size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("pages.watch.ticker.you") }}
        </span>
      </span>
    </span>

    <span
      v-for="(team, i) in model.teams"
      :key="i"
      class="flex min-w-0 items-center gap-2 text-[13px] font-semibold"
      :class="
        team.emphasis === 'trail' ||
        (model.kind === 'result' && team.emphasis !== 'win')
          ? 'text-muted-foreground'
          : 'text-foreground'
      "
    >
      <img
        v-if="team.avatar"
        :src="avatarSrc(team.avatar)"
        alt=""
        class="size-5 shrink-0 rounded-[4px] object-cover"
        loading="lazy"
      />
      <span
        v-else
        aria-hidden="true"
        class="inline-grid size-5 shrink-0 place-items-center rounded-[4px] bg-muted text-[0.6rem] font-extrabold tracking-wide text-foreground/80"
        >{{ team.monogram }}</span
      >
      <span
        class="min-w-0 flex-1 truncate"
        :class="{ 'font-bold': team.emphasis === 'win' }"
        :title="team.name"
        >{{ team.name }}</span
      >
      <span v-if="team.pips" class="inline-flex shrink-0 gap-[3px]">
        <i
          v-for="p in team.pips.total"
          :key="p"
          class="size-1.5 rounded-[1px]"
          :class="
            p <= team.pips.won
              ? 'bg-[hsl(var(--tac-amber))]'
              : 'bg-muted-foreground/30'
          "
        ></i>
      </span>
      <span
        v-if="team.score !== null"
        class="min-w-[1.125rem] text-right text-sm tabular-nums"
        :class="{ 'font-bold': team.emphasis !== 'trail' }"
        >{{ team.score }}</span
      >
    </span>

    <span v-if="model.tag" class="truncate text-xs text-muted-foreground">
      {{ model.tag }}
    </span>
  </component>
</template>
