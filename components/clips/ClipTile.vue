<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import {
  ArrowUpRight,
  Check,
  Eye,
  Film,
  Globe,
  Lock,
  Play,
  Share2,
  Users,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import TimeAgo from "~/components/TimeAgo.vue";
import ClipKillBadge from "~/components/clips/ClipKillBadge.vue";
import cleanMapName from "~/utilities/cleanMapName";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { clipDisplayTitle, formatClipDuration } from "~/utilities/clipDisplay";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import type { Clip } from "~/types/clip";

const props = withDefaults(
  defineProps<{
    clip: Clip;
    variant?: "tile" | "hero";
    // Every clip from the same match, lead first. Draws a stack behind the
    // tile and plays the whole group.
    group?: Clip[];
    // The list this tile was picked from; seeds the modal's playlist.
    queue?: Clip[];
    queueScope?: string;
    hidePlayer?: boolean;
    // Amber corner chip, e.g. "Play of the day".
    tag?: string;
    // Fill the parent's box (bento cells size tiles themselves) instead of
    // holding 16:9.
    fill?: boolean;
  }>(),
  { variant: "tile" },
);

const { t } = useI18n();
const { playClips } = useClipModal();
const { copiedClipId, shareClip } = useClipShare();
const auth = useAuthStore();
const nuxtApp = useNuxtApp();

const hero = computed(() => props.variant === "hero");
const isGroup = computed(() => (props.group?.length ?? 0) > 1);

const player = computed(() => props.clip.target ?? null);
const title = computed(
  () =>
    clipDisplayTitle(props.clip.title, player.value?.name) ??
    t("clips.untitled_clip"),
);
const duration = computed(() => formatClipDuration(props.clip.duration_ms));

const apiDomain = computed(
  () => useRuntimeConfig().public.apiDomain as string | undefined,
);
const avatarSrc = computed(() =>
  resolveAvatarUrl(player.value?.avatar_url ?? null, apiDomain.value),
);

const thumbSrc = computed(() => {
  for (const c of isGroup.value ? props.group! : [props.clip]) {
    if (c.thumbnail_download_url) return c.thumbnail_download_url;
  }
  return props.clip.match_map?.map?.poster ?? null;
});
// Fade the shot in once it decodes so a grid swap eases in over the frame
// instead of popping.
const thumbLoaded = ref(false);
watch(thumbSrc, () => {
  thumbLoaded.value = false;
});

const matchMap = computed(() => props.clip.match_map ?? null);
const match = computed(() => matchMap.value?.match ?? null);
const mapLabel = computed(() => {
  const map = matchMap.value?.map;
  if (!map) return null;
  return map.label || cleanMapName(map.name);
});

const metaLine = computed(() =>
  [
    props.clip.round != null
      ? t("clips.tile.round", { round: props.clip.round })
      : null,
    mapLabel.value,
    match.value?.event_links?.[0]?.event?.name ?? null,
    match.value?.tournament_brackets?.[0]?.stage?.tournament?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · "),
);

// The play happened on this map, so a single clip shows that map's score;
// a whole-match group shows the series when there is one.
const scoreLine = computed(() => {
  const m = match.value;
  const name1 = m?.lineup_1?.name;
  const name2 = m?.lineup_2?.name;
  if (!m || !name1 || !name2) return null;
  let score1: number | null = null;
  let score2: number | null = null;
  let winnerId: string | null = null;
  if (isGroup.value && (m.options?.best_of ?? 1) > 1 && m.match_maps?.length) {
    score1 = m.match_maps.filter(
      (mm) => mm.winning_lineup_id && mm.winning_lineup_id === m.lineup_1_id,
    ).length;
    score2 = m.match_maps.filter(
      (mm) => mm.winning_lineup_id && mm.winning_lineup_id === m.lineup_2_id,
    ).length;
    winnerId = m.winning_lineup_id;
  } else if (matchMap.value) {
    score1 = matchMap.value.lineup_1_score;
    score2 = matchMap.value.lineup_2_score;
    winnerId = matchMap.value.winning_lineup_id;
  }
  return {
    name1,
    name2,
    score: score1 != null && score2 != null ? `${score1}–${score2}` : null,
    winner:
      winnerId === m.lineup_1_id ? 1 : winnerId === m.lineup_2_id ? 2 : null,
  };
});

const views = computed(() =>
  isGroup.value
    ? props.group!.reduce((sum, c) => sum + (c.views_count ?? 0), 0)
    : (props.clip.views_count ?? 0),
);

const playLabel = computed(() =>
  player.value && !props.hidePlayer
    ? t("clips.tile.play_by", { title: title.value, player: player.value.name })
    : t("clips.tile.play", { title: title.value }),
);

function onPlay(e: MouseEvent) {
  // Modifier and middle clicks follow the href (new tab / window).
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
    return;
  }
  e.preventDefault();
  const list = props.queue ?? (isGroup.value ? props.group! : [props.clip]);
  playClips(list, props.clip.id, props.queueScope ?? null);
}

type Visibility = "public" | "private";
const VISIBILITY_OPTIONS = computed(() => [
  {
    value: "public" as Visibility,
    label: t("clips.visibility.public"),
    icon: Globe,
    hint: t("clips.visibility.public_hint"),
  },
  {
    value: "private" as Visibility,
    label: t("clips.visibility.private"),
    icon: Lock,
    hint: t("clips.visibility.private_hint"),
  },
]);

const isOwner = computed(
  () =>
    !!auth.me?.steam_id &&
    props.clip.user_steam_id === String(auth.me.steam_id),
);
const canEditVisibility = computed(() => isOwner.value || auth.isAdmin);

// List queries are network-only, so updateClip (which returns only
// { success }) never refreshes the prop; track the shown value locally.
const visibility = ref(props.clip.visibility);
watch(
  () => props.clip.visibility,
  (v) => {
    visibility.value = v;
  },
);
// "match" clips are only visible to the match's players; they can be made
// public or private but never picked back as "match" here.
const visibilityMeta = computed(
  () =>
    VISIBILITY_OPTIONS.value.find((o) => o.value === visibility.value) ?? {
      value: visibility.value,
      label: t("clips.tile.visibility_match"),
      icon: Users,
      hint: "",
    },
);
const saving = ref(false);
const visOpen = ref(false);

async function setVisibility(v: Visibility) {
  if (saving.value || visibility.value === v) {
    visOpen.value = false;
    return;
  }
  saving.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        updateClip: [
          { clip_id: props.clip.id, visibility: v },
          { success: true },
        ],
      } as any),
    });
    visibility.value = v;
    visOpen.value = false;
  } catch (e) {
    console.error("[clip-tile] visibility change failed:", e);
  } finally {
    saving.value = false;
  }
}

const chipClasses = computed(() => [
  "inline-flex shrink-0 items-center gap-1 rounded-md bg-black/60 font-semibold tabular-nums text-white/90 backdrop-blur-sm",
  hero.value
    ? "h-[30px] px-[9px] text-xs sm:h-9 sm:px-[11px] sm:text-[13px]"
    : "h-[26px] px-2 text-xs",
]);
const actionBase =
  "relative inline-flex h-8 items-center justify-center rounded-md bg-black/55 text-white/85 backdrop-blur-sm transition-colors duration-150 hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] clip-action";
const actionClasses = `${actionBase} w-8`;
</script>

<template>
  <div
    class="group/clip relative w-full min-w-0"
    :class="fill ? 'h-full' : 'aspect-video'"
  >
    <template v-if="isGroup">
      <span
        aria-hidden="true"
        class="absolute inset-x-6 top-0 h-4 rounded-t-lg border border-b-0 border-white/[0.06] bg-card/50"
      />
      <span
        aria-hidden="true"
        class="absolute inset-x-3 top-[5px] h-4 rounded-t-lg border border-b-0 border-white/[0.08] bg-card/80"
      />
    </template>

    <div
      class="absolute inset-x-0 bottom-0 isolate overflow-hidden rounded-lg border border-white/[0.07] bg-card transition-colors duration-150 group-focus-within/clip:border-[hsl(var(--tac-amber)/0.45)] group-hover/clip:border-[hsl(var(--tac-amber)/0.45)]"
      :class="isGroup ? 'top-2.5' : 'top-0'"
    >
      <NuxtImg
        v-if="thumbSrc"
        :src="thumbSrc"
        alt=""
        loading="lazy"
        class="absolute inset-0 -z-20 h-full w-full object-cover transition-[transform,opacity] duration-500 motion-safe:group-hover/clip:scale-[1.03]"
        :class="thumbLoaded ? 'opacity-100' : 'opacity-0'"
        @load="thumbLoaded = true"
      />
      <div
        v-else
        class="absolute inset-0 -z-20 grid place-items-center text-muted-foreground"
      >
        <Film class="h-8 w-8 opacity-50" />
      </div>
      <div
        aria-hidden="true"
        class="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/0.5)_0%,rgb(0_0_0/0)_26%,rgb(0_0_0/0.08)_42%,rgb(0_0_0/0.93)_100%)]"
      />

      <a
        :href="`/clips/${clip.id}`"
        class="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber))]"
        :aria-label="playLabel"
        @click="onPlay"
      />

      <span
        aria-hidden="true"
        class="pointer-events-none absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 scale-90 place-items-center rounded-full bg-white/90 text-black opacity-0 transition-[opacity,transform] duration-150 group-focus-within/clip:scale-100 group-focus-within/clip:opacity-100 group-hover/clip:scale-100 group-hover/clip:opacity-100 motion-reduce:transition-none"
        :class="hero ? 'h-16 w-16' : 'h-12 w-12'"
      >
        <Play
          class="ml-0.5 fill-current"
          :class="hero ? 'h-6 w-6' : 'h-5 w-5'"
        />
      </span>

      <!-- Corner chips share one height per size and one inset. -->
      <div
        class="pointer-events-none absolute z-20 flex items-center justify-between gap-2"
        :class="
          hero ? 'inset-x-3 top-3 sm:inset-x-4 sm:top-4' : 'inset-x-2.5 top-2.5'
        "
      >
        <ClipKillBadge
          :kills="clip.kills_count"
          :round="clip.round"
          :size="hero ? 'lg' : 'sm'"
        />
        <div class="ml-auto flex min-w-0 items-center gap-1.5">
          <span
            v-if="tag"
            :class="[
              chipClasses,
              'bg-black/70 text-[hsl(var(--tac-amber))] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.55)]',
            ]"
          >
            <span class="clip-cap-trim whitespace-nowrap">{{ tag }}</span>
          </span>
          <span v-if="isGroup" :class="chipClasses">
            <Film class="h-3.5 w-3.5 shrink-0" />
            <span class="clip-cap-trim">{{
              $t(
                "clips.tile.group_plays",
                { count: group!.length },
                group!.length,
              )
            }}</span>
          </span>
          <span v-if="duration" :class="chipClasses">
            <span class="clip-cap-trim">{{ duration }}</span>
          </span>
        </div>
      </div>

      <div
        class="pointer-events-none absolute z-20 grid"
        :class="
          hero
            ? 'inset-x-4 bottom-4 gap-1.5 sm:inset-x-5 sm:bottom-5'
            : 'inset-x-3 bottom-3 gap-1'
        "
      >
        <p
          class="min-w-0 font-bold text-white [text-wrap:balance]"
          :class="
            hero
              ? 'line-clamp-2 text-[clamp(1.375rem,2.3vw,2rem)] leading-[1.1]'
              : 'truncate text-[15px] leading-tight'
          "
          :title="title"
        >
          {{ title }}
        </p>

        <NuxtLink
          v-if="player?.steam_id && !hidePlayer"
          :to="{ name: 'players-id', params: { id: player.steam_id } }"
          class="group/player pointer-events-auto flex w-fit max-w-full min-w-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
          :class="hero ? 'gap-2 text-[15px]' : 'gap-1.5 text-[13px]'"
          :title="player.name"
        >
          <Avatar
            class="shrink-0 ring-1 ring-white/20"
            :class="
              hero ? 'h-[26px] w-[26px] text-[10px]' : 'h-5 w-5 text-[9px]'
            "
          >
            <AvatarImage v-if="avatarSrc" :src="avatarSrc" alt="" />
            <AvatarFallback>{{ player.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <span
            class="min-w-0 truncate font-bold text-white transition-colors group-hover/player:text-[hsl(var(--tac-amber))]"
          >
            {{ player.name }}
          </span>
        </NuxtLink>

        <!-- At rest a tile shows only the play; the context opens on hover
             or focus. The hero keeps it open. -->
        <div
          class="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
          :class="
            hero
              ? 'grid-rows-[1fr]'
              : 'grid-rows-[0fr] opacity-0 group-focus-within/clip:grid-rows-[1fr] group-focus-within/clip:opacity-100 group-hover/clip:grid-rows-[1fr] group-hover/clip:opacity-100'
          "
        >
          <div class="min-h-0 overflow-hidden">
            <div class="grid gap-1 pt-1">
              <p
                v-if="metaLine"
                class="truncate text-white/70"
                :class="hero ? 'text-[13px]' : 'text-xs'"
                :title="metaLine"
              >
                {{ metaLine }}
              </p>
              <div
                class="flex min-w-0 items-center justify-between gap-2.5 text-white/60"
                :class="hero ? 'text-[13px]' : 'text-xs'"
              >
                <span v-if="scoreLine" class="min-w-0 truncate">
                  <span
                    :class="
                      scoreLine.winner === 1 ? 'font-bold text-white' : ''
                    "
                    >{{ scoreLine.name1 }}</span
                  >
                  <span
                    v-if="scoreLine.score"
                    class="mx-1 font-bold tabular-nums text-white"
                    >{{ scoreLine.score }}</span
                  >
                  <span v-else class="mx-1">vs</span>
                  <span
                    :class="
                      scoreLine.winner === 2 ? 'font-bold text-white' : ''
                    "
                    >{{ scoreLine.name2 }}</span
                  >
                </span>
                <div
                  class="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5"
                >
                  <span
                    class="mr-1 inline-flex items-center gap-1 tabular-nums"
                    :title="$t('clips.tile.views', { count: views }, views)"
                  >
                    <Eye class="h-3.5 w-3.5" />
                    {{ views }}
                  </span>
                  <button
                    type="button"
                    :class="[
                      actionClasses,
                      copiedClipId === clip.id
                        ? 'text-[hsl(var(--tac-amber))]'
                        : '',
                    ]"
                    :title="
                      copiedClipId === clip.id
                        ? $t('clips.link_copied')
                        : $t('clips.share_clip')
                    "
                    :aria-label="$t('clips.share_clip')"
                    @click="shareClip(clip.id)"
                  >
                    <Check v-if="copiedClipId === clip.id" class="h-4 w-4" />
                    <Share2 v-else class="h-4 w-4" />
                  </button>
                  <Popover v-if="canEditVisibility" v-model:open="visOpen">
                    <PopoverTrigger
                      :class="actionClasses"
                      :title="
                        $t('clips.tile.visibility', {
                          value: visibilityMeta.label,
                        })
                      "
                      :aria-label="
                        $t('clips.tile.visibility', {
                          value: visibilityMeta.label,
                        })
                      "
                    >
                      <Spinner v-if="saving" class="h-4 w-4" />
                      <component
                        :is="visibilityMeta.icon"
                        v-else
                        class="h-4 w-4"
                        :class="visibility === 'public' ? 'text-success' : ''"
                      />
                    </PopoverTrigger>
                    <PopoverContent class="w-60 p-1" align="end">
                      <button
                        v-for="opt in VISIBILITY_OPTIONS"
                        :key="opt.value"
                        type="button"
                        class="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                        :class="visibility === opt.value ? 'bg-muted/40' : ''"
                        :disabled="saving"
                        @click="setVisibility(opt.value)"
                      >
                        <component
                          :is="opt.icon"
                          class="mt-0.5 h-3.5 w-3.5 shrink-0"
                          :class="
                            opt.value === 'public'
                              ? 'text-success'
                              : 'text-muted-foreground'
                          "
                        />
                        <span class="min-w-0 flex-1">
                          <span class="flex items-center gap-1.5 font-medium">
                            {{ opt.label }}
                            <Check
                              v-if="visibility === opt.value"
                              class="h-3 w-3 text-[hsl(var(--tac-amber))]"
                            />
                          </span>
                          <span
                            class="block leading-snug text-muted-foreground"
                          >
                            {{ opt.hint }}
                          </span>
                        </span>
                      </button>
                    </PopoverContent>
                  </Popover>
                  <NuxtLink
                    v-if="isGroup && match?.id"
                    :to="`/matches/${match.id}`"
                    :class="[actionBase, 'gap-1 px-2.5 text-xs font-semibold']"
                  >
                    {{ $t("clips.tile.open_match") }}
                    <ArrowUpRight class="h-3.5 w-3.5" />
                  </NuxtLink>
                </div>
              </div>
              <p
                v-if="hero && clip.user?.name"
                class="truncate text-xs text-white/55"
              >
                {{ $t("clips.tile.clipped_by", { name: clip.user.name }) }}
                ·
                <TimeAgo :date="clip.created_at" hide-icon />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.clip-cap-trim {
  display: block;
  line-height: 1;
  text-box: trim-both cap alphabetic;
}

@supports not (text-box: trim-both cap alphabetic) {
  .clip-cap-trim {
    padding-top: 0.11em;
  }
}

/* 32px controls, 44px touch targets. */
@media (pointer: coarse) {
  .clip-action::after {
    content: "";
    position: absolute;
    inset: -6px;
  }
}
</style>
