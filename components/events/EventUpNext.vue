<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, Flag, GitBranch, Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { formatEventRange } from "~/utilities/watchEventCard";

// `hero` is for when it's the only thing on the page: the full card.
const props = defineProps<{ event: any; hero?: boolean }>();
defineEmits<{ (e: "quick-look"): void }>();

const { t } = useI18n();

const path = computed(() => `/events/${props.event.id}`);
const start = computed(() => new Date(props.event.starts_at));

const bannerSrc = computed(() =>
  props.event.banner && !props.event.banner.mime_type?.startsWith("video/")
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);

const until = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(start.value);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return t("pages.tournaments.next_lan.today");
  if (days === 1) return t("pages.tournaments.next_lan.tomorrow");
  return t("pages.tournaments.next_lan.in_days", { count: days }, days);
});

const month = computed(() =>
  new Intl.DateTimeFormat(undefined, { month: "short" }).format(start.value),
);
const days = computed(() =>
  props.event.ends_at
    ? Math.round(
        (new Date(props.event.ends_at).setHours(0, 0, 0, 0) -
          new Date(props.event.starts_at).setHours(0, 0, 0, 0)) /
          86_400_000,
      ) + 1
    : 1,
);

const facts = computed(() => {
  const count = (key: string) =>
    props.event[`${key}_aggregate`]?.aggregate?.count ?? 0;
  return [
    { key: "count_tournaments", value: count("tournaments") },
    { key: "players_signed_up", value: count("players") },
  ].filter((fact) => fact.value > 0);
});
</script>

<template>
  <article
    v-if="hero"
    class="grid overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-card/40 lg:grid-cols-[minmax(0,1fr)_21rem]"
  >
    <div
      class="relative isolate flex min-h-[18rem] items-end px-4 pb-5 pt-28 sm:px-6 sm:pb-6"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
      />
      <div aria-hidden="true" class="hero-scrim absolute inset-0 -z-10"></div>
      <div class="grid min-w-0 max-w-[40rem] gap-2.5">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-foreground/80"
        >
          <span class="font-semibold text-[hsl(var(--tac-amber))]">
            {{ $t("pages.events.sections.up_next") }}
          </span>
          <span aria-hidden="true">·</span>
          <span>{{ formatEventRange(event.starts_at, event.ends_at) }}</span>
        </p>
        <h2
          class="m-0 text-[clamp(1.875rem,3.4vw,3rem)] font-extrabold leading-none [text-wrap:balance]"
        >
          <NuxtLink
            :to="path"
            class="hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ event.name }}
          </NuxtLink>
        </h2>
      </div>
    </div>

    <aside
      class="flex flex-col gap-4 border-t border-border bg-muted/15 p-5 lg:border-l lg:border-t-0"
    >
      <div class="flex items-center gap-3.5">
        <div
          class="grid h-[3.75rem] w-14 shrink-0 place-content-center justify-items-center gap-0.5 rounded-md bg-[hsl(var(--tac-amber)/0.12)] leading-none"
        >
          <span
            class="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ month }}
          </span>
          <span class="text-2xl font-bold tabular-nums">{{ start.getDate() }}</span>
        </div>
        <div class="min-w-0">
          <b class="block text-base font-bold leading-tight">
            {{ formatEventRange(event.starts_at, event.ends_at) }}
          </b>
          <span class="text-[0.8125rem] text-muted-foreground">
            {{ $t("pages.events.days", { count: days }, days) }} · {{ until }}
          </span>
        </div>
      </div>

      <ul class="m-0 grid list-none gap-2.5 p-0 text-[0.8125rem] text-foreground/85">
        <li
          v-for="(fact, index) in facts"
          :key="fact.key"
          class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2"
        >
          <component
            :is="index === 0 ? GitBranch : Users"
            class="mt-0.5 h-3.5 w-3.5 text-muted-foreground"
          />
          <span class="tabular-nums">
            {{ fact.value }}
            {{ $t(`pages.watch.events.${fact.key}`, fact.value) }}
          </span>
        </li>
        <li
          v-if="!facts.length"
          class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2"
        >
          <Flag class="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <span>{{ $t("pages.events.no_tournaments") }}</span>
        </li>
      </ul>

      <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button
          as-child
          size="sm"
          class="h-9 flex-1 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
        >
          <NuxtLink :to="path">
            {{ $t("pages.watch.events.open_event") }}
            <ArrowRight class="h-3.5 w-3.5" />
          </NuxtLink>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          class="h-9"
          @click="$emit('quick-look')"
        >
          {{ $t("pages.watch.tournaments.details") }}
        </Button>
      </div>
    </aside>
  </article>

  <article
    v-else
    class="relative isolate overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-card/40"
  >
    <img
      v-if="bannerSrc"
      :src="bannerSrc"
      alt=""
      class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
    />
    <div aria-hidden="true" class="scrim absolute inset-0 -z-10"></div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4">
      <div
        class="grid h-[3.25rem] w-12 shrink-0 place-content-center justify-items-center gap-0.5 rounded-md bg-[hsl(var(--tac-amber)/0.12)] leading-none"
      >
        <span
          class="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
        >
          {{ month }}
        </span>
        <span class="text-xl font-bold tabular-nums">{{ start.getDate() }}</span>
      </div>

      <div class="grid min-w-0 flex-1 basis-56 gap-0.5">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-foreground/75"
        >
          <span class="font-semibold text-[hsl(var(--tac-amber))]">
            {{ $t("pages.events.sections.up_next") }}
          </span>
          <span aria-hidden="true">·</span>
          <span>{{ formatEventRange(event.starts_at, event.ends_at) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ until }}</span>
        </p>
        <h2 class="m-0 truncate text-base font-bold leading-tight">
          <NuxtLink
            :to="path"
            class="hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ event.name }}
          </NuxtLink>
        </h2>
        <p
          v-if="facts.length"
          class="m-0 truncate text-[0.8125rem] text-foreground/70"
        >
          <template v-for="(fact, index) in facts" :key="fact.key">
            <template v-if="index"> · </template>
            <span class="tabular-nums">{{ fact.value }}</span>
            {{ $t(`pages.watch.events.${fact.key}`, fact.value) }}
          </template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <Button
          as-child
          size="sm"
          class="h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
        >
          <NuxtLink :to="path">
            {{ $t("pages.watch.events.open_event") }}
            <ArrowRight class="h-3.5 w-3.5" />
          </NuxtLink>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          class="h-8"
          @click="$emit('quick-look')"
        >
          {{ $t("pages.watch.tournaments.details") }}
        </Button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.hero-scrim {
  background:
    linear-gradient(
      90deg,
      hsl(240 10% 2% / 0.92) 0%,
      hsl(240 10% 2% / 0.62) 55%,
      hsl(240 10% 2% / 0.2) 100%
    ),
    linear-gradient(180deg, transparent 40%, hsl(240 10% 2% / 0.72));
}
.scrim {
  background: linear-gradient(
    90deg,
    hsl(240 10% 2% / 0.95) 0%,
    hsl(240 10% 2% / 0.8) 55%,
    hsl(240 10% 2% / 0.5) 100%
  );
}
</style>
