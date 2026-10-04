<script setup lang="ts">
import { computed } from "vue";
import { ImagePlus, Lock } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import {
  daysUntil,
  eventDay,
  formatEventDate,
  formatEventRange,
  type EventPhase,
} from "~/utilities/eventDisplay";

// One lifted surface: the whole banner (never cropped; the art usually carries
// the event's own title), then who/when/what, then the page's tabs.
const props = defineProps<{
  event: any;
  phase: EventPhase;
  organizers: any[];
  counts: { players: number; teams: number; matches: number };
  canManage?: boolean;
}>();

const emit = defineEmits<{ (e: "add-banner"): void }>();

const bannerSrc = computed(() =>
  props.event.banner
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);
const bannerIsImage = computed(
  () => props.event.banner?.mime_type?.startsWith("image/") ?? true,
);

const day = computed(() =>
  props.phase === "live" ? eventDay(props.event) : null,
);
const startsIn = computed(() =>
  props.phase === "upcoming" ? daysUntil(props.event.starts_at) : null,
);
const range = computed(() =>
  formatEventRange(props.event.starts_at, props.event.ends_at),
);

const { t } = useI18n();
const countItems = computed(() =>
  [
    props.event.visibility && props.event.visibility !== "Public"
      ? {
          key: "visibility",
          label: t(`event.visibility.${props.event.visibility.toLowerCase()}`),
        }
      : null,
    props.counts.players
      ? {
          key: "players",
          label: t("event.header.players", props.counts.players),
        }
      : null,
    props.counts.teams
      ? { key: "teams", label: t("event.header.teams", props.counts.teams) }
      : null,
    props.counts.matches
      ? {
          key: "matches",
          label: t("event.header.matches", props.counts.matches),
        }
      : null,
  ].filter((item): item is { key: string; label: string } => !!item),
);
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-border bg-muted/20"
    :class="
      bannerSrc
        ? ''
        : 'bg-[radial-gradient(90%_140%_at_50%_-40%,hsl(var(--tac-amber)/0.12),transparent_60%)]'
    "
  >
    <div
      v-if="bannerSrc"
      class="relative isolate flex aspect-[3/1] max-h-[440px] w-full items-center justify-center overflow-hidden border-b border-border bg-black"
    >
      <!-- The blurred copy only shows when an off-ratio banner letterboxes. -->
      <img
        v-if="bannerIsImage"
        :src="bannerSrc"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
      />
      <video
        v-else
        :src="bannerSrc"
        aria-hidden="true"
        class="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
        muted
        playsinline
      />
      <img
        v-if="bannerIsImage"
        :src="bannerSrc"
        :alt="event.name"
        width="1920"
        height="640"
        class="h-full w-full object-contain"
      />
      <video
        v-else
        :src="bannerSrc"
        class="h-full w-full object-contain"
        autoplay
        muted
        loop
        playsinline
      />
    </div>
    <template v-else>
      <div
        aria-hidden="true"
        class="h-1 bg-[linear-gradient(90deg,transparent,hsl(var(--tac-amber)/0.55)_30%,hsl(var(--tac-amber)/0.55)_70%,transparent)]"
      ></div>
      <button
        v-if="canManage"
        type="button"
        class="mx-3.5 mt-3.5 flex h-[5.5rem] w-[calc(100%-1.75rem)] items-center justify-center gap-2.5 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/10 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.05)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="emit('add-banner')"
      >
        <ImagePlus class="h-4 w-4" />
        <span>
          <span class="text-foreground">{{
            $t("event.header.add_banner")
          }}</span>
          <span class="font-medium tabular-nums"> · 1920 × 640</span>
        </span>
      </button>
    </template>

    <div
      class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pt-4 sm:px-6 sm:pt-5"
    >
      <div class="grid min-w-0 flex-[1_1_28rem] gap-2">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted-foreground"
        >
          <template v-if="phase === 'live'">
            <span class="relative mr-0.5 inline-flex h-2 w-2 shrink-0">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
              ></span>
              <span
                class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
              ></span>
            </span>
            <span class="font-semibold text-destructive">
              {{ $t("event.phase.live") }}
            </span>
            <template v-if="day">
              <span aria-hidden="true">·</span>
              <span>{{
                day.total
                  ? $t("event.header.day_of", day)
                  : $t("event.header.day", day)
              }}</span>
            </template>
          </template>
          <template v-else-if="phase === 'upcoming'">
            <span class="font-semibold text-[hsl(var(--tac-amber))]">
              {{ $t("event.phase.upcoming") }}
            </span>
            <template v-if="formatEventDate(event.starts_at)">
              <span aria-hidden="true">·</span>
              <span>{{ range }}</span>
            </template>
            <template v-if="startsIn !== null">
              <span aria-hidden="true">·</span>
              <span>{{ $t("event.header.starts_in", startsIn) }}</span>
            </template>
          </template>
          <template v-else>
            <span class="font-semibold text-foreground/85">
              {{ $t("event.phase.finished") }}
            </span>
            <template v-if="range">
              <span aria-hidden="true">·</span>
              <span>{{ range }}</span>
            </template>
          </template>
        </p>

        <h1
          class="m-0 text-[clamp(1.625rem,3vw,2.5rem)] font-extrabold leading-[1.05] [text-wrap:balance]"
        >
          {{ event.name }}
        </h1>

        <p
          class="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.8125rem] text-muted-foreground"
        >
          <span
            v-if="organizers.length"
            class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1"
          >
            <span>{{ $t("event.card.organized_by") }}</span>
            <span
              v-for="(organizer, index) in organizers"
              :key="organizer.steam_id"
              class="inline-flex items-center whitespace-nowrap"
            >
              <PlayerDisplay
                :player="organizer"
                size="xs"
                compact
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
                :tooltip="false"
                linkable
              />
              <span v-if="index < organizers.length - 1" aria-hidden="true"
                >,</span
              >
            </span>
          </span>
          <!-- The counts travel as one unit; on phones they take their own
               line rather than orphaning the last one. -->
          <span
            v-if="countItems.length"
            class="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 max-sm:basis-full"
          >
            <template v-for="(item, index) in countItems" :key="item.key">
              <span
                v-if="index > 0 || organizers.length"
                aria-hidden="true"
                class="text-muted-foreground/45"
                :class="index === 0 && 'max-sm:hidden'"
                >·</span
              >
              <span
                v-if="item.key === 'visibility'"
                class="inline-flex h-[1.375rem] items-center gap-1.5 rounded-md bg-[hsl(var(--tac-amber)/0.08)] px-[0.4375rem] text-xs font-semibold text-[hsl(var(--tac-amber))] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.35)]"
              >
                <Lock class="h-3 w-3" />
                {{ item.label }}
              </span>
              <span v-else class="whitespace-nowrap text-foreground/85">{{
                item.label
              }}</span>
            </template>
          </span>
        </p>

        <p
          v-if="event.description"
          class="m-0 max-w-[70ch] text-sm text-muted-foreground"
        >
          {{ event.description }}
        </p>
      </div>

      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div class="mt-3 px-2 sm:px-4">
      <slot name="tabs" />
    </div>
  </section>
</template>
