<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Film,
  Play,
  Eye,
  Lock,
  Globe,
  Trophy,
  Check,
  Share2,
  Crosshair,
  Clock,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { useNuxtApp } from "#app";
import { Card } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import TimeAgo from "~/components/TimeAgo.vue";
import cleanMapName from "~/utilities/cleanMapName";
import type { Clip } from "~/types/clip";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";

const props = defineProps<{
  clip: Clip;
  // On the player page we already know whose clips these are, so the
  // featured-player footer is redundant — fall back to the clip title.
  hidePlayer?: boolean;
}>();

const { t } = useI18n();
const { openClip } = useClipModal();
const { copiedClipId, shareClip } = useClipShare();
const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
const nuxtApp = useNuxtApp();

function onPlayClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  e.stopPropagation();
  openClip(props.clip.id);
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// A single clip is identified by the player it features (the highlight's
// subject). The map + date live on the thumbnail; the footer is just the
// player display.
const featuredPlayer = computed(() => props.clip.target ?? null);
const apiDomain = computed(
  () => useRuntimeConfig().public.apiDomain as string | undefined,
);
const playerAvatarSrc = computed(() =>
  resolveAvatarUrl(featuredPlayer.value?.avatar_url ?? null, apiDomain.value),
);

const isTournament = computed(
  () => props.clip.match_map?.match?.is_tournament_match === true,
);

// Fade the thumbnail in once it decodes so swapping the grid on a filter
// change eases the new shot over the black frame instead of popping it in.
const thumbSrc = computed(
  () => props.clip.thumbnail_download_url ?? props.clip.match_map?.map?.poster,
);
const thumbLoaded = ref(false);
watch(thumbSrc, () => {
  thumbLoaded.value = false;
});

type Visibility = "public" | "private";
const VISIBILITY_OPTIONS = computed<
  Array<{
    value: Visibility;
    label: string;
    icon: any;
    hint: string;
  }>
>(() => [
  {
    value: "public",
    label: t("clips.visibility.public"),
    icon: Globe,
    hint: t("clips.visibility.public_hint"),
  },
  {
    value: "private",
    label: t("clips.visibility.private"),
    icon: Lock,
    hint: t("clips.visibility.private_hint"),
  },
]);
const saving = ref(false);
const visPopoverOpen = ref(false);

// The highlights/match lists load clips with a network-only query, so the
// updateClip mutation (which returns only { success }) never refreshes this
// card's prop. Track the displayed visibility locally, sync it when the prop
// changes, and set it on a successful toggle so the chip reflects the new
// state immediately instead of only after a page refresh.
const visibility = ref<Visibility>(props.clip.visibility as Visibility);
watch(
  () => props.clip.visibility,
  (v) => {
    visibility.value = v as Visibility;
  },
);

const currentVisibilityMeta = computed(() => {
  return (
    VISIBILITY_OPTIONS.value.find((o) => o.value === visibility.value) ??
    VISIBILITY_OPTIONS.value[2]
  );
});

async function setVisibility(v: Visibility) {
  if (saving.value || visibility.value === v) {
    visPopoverOpen.value = false;
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
    visPopoverOpen.value = false;
  } catch (e) {
    console.error("[highlight-card] visibility toggle failed:", e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="block">
    <Card
      class="flex flex-col overflow-hidden transition-all hover:border-foreground/30"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black group">
        <NuxtImg
          v-if="thumbSrc"
          :src="thumbSrc"
          :alt="clip.title ?? $t('clips.detail.default_title')"
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-500 group-hover:scale-[1.02]"
          :class="thumbLoaded ? 'opacity-100' : 'opacity-0'"
          @load="thumbLoaded = true"
        />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-muted-foreground"
        >
          <Film class="h-8 w-8 opacity-50" />
        </div>

        <button
          type="button"
          class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity opacity-60 hover:opacity-100 cursor-pointer"
          :aria-label="
            $t('ui_extras.play_clip', {
              title: clip.title ?? $t('clips.default_clip'),
            })
          "
          @click="onPlayClick"
        >
          <span
            class="rounded-full bg-foreground/90 p-3 backdrop-blur-sm transition-transform hover:scale-110"
          >
            <Play class="h-5 w-5 text-background fill-background" />
          </span>
        </button>

        <div class="absolute top-2 right-2 flex items-center gap-1">
          <span
            class="inline-flex h-7 items-center gap-1 rounded-full bg-black/75 px-2.5 font-mono text-[0.7rem] font-medium leading-none tabular-nums text-white/90 backdrop-blur-sm"
            :title="
              $t(
                'clips.plays_count',
                { count: clip.views_count ?? 0 },
                clip.views_count ?? 0,
              )
            "
          >
            <Eye class="h-3.5 w-3.5" />
            {{ clip.views_count ?? 0 }}
          </span>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 backdrop-blur-sm transition-all duration-200 hover:bg-black/90 hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            :class="
              copiedClipId === clip.id
                ? 'share-flash text-[hsl(var(--tac-amber))] scale-110'
                : 'text-white/90'
            "
            :title="
              copiedClipId === clip.id
                ? $t('clips.link_copied')
                : $t('clips.share_clip')
            "
            :aria-label="$t('clips.share_clip')"
            @click.stop="shareClip(clip.id)"
          >
            <Check v-if="copiedClipId === clip.id" class="h-3.5 w-3.5" />
            <Share2 v-else class="h-3.5 w-3.5" />
          </button>
          <Popover v-if="isAdmin" v-model:open="visPopoverOpen">
            <PopoverTrigger
              class="inline-flex h-7 items-center gap-1 rounded-full bg-black/75 pl-1.5 pr-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              :aria-label="
                $t('ui_extras.visibility_change_hint', {
                  value: visibility,
                })
              "
              :title="$t('ui_extras.visibility_label', { value: visibility })"
              @click.stop
            >
              <span
                class="inline-flex h-4 w-4 items-center justify-center rounded-full"
                :class="
                  visibility === 'public'
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : 'bg-white/10 text-white/80'
                "
              >
                <Spinner v-if="saving" class="h-3 w-3" />
                <component
                  v-else
                  :is="currentVisibilityMeta.icon"
                  class="h-3 w-3"
                />
              </span>
              <span
                class="font-mono text-[0.58rem] uppercase tracking-[0.14em]"
              >
                {{ currentVisibilityMeta.label }}
              </span>
            </PopoverTrigger>
            <PopoverContent class="w-56 p-1" align="end" @click.stop>
              <div
                class="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("clips.detail.visibility") }}
              </div>
              <button
                v-for="opt in VISIBILITY_OPTIONS"
                :key="opt.value"
                type="button"
                class="w-full text-left flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="visibility === opt.value ? 'bg-muted/40' : ''"
                :disabled="saving"
                @click="setVisibility(opt.value)"
              >
                <span
                  class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  :class="
                    opt.value === 'public'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-muted/40 text-muted-foreground'
                  "
                >
                  <component :is="opt.icon" class="h-3 w-3" />
                </span>
                <span class="flex-1 min-w-0">
                  <span class="flex items-center gap-1.5 font-medium">
                    {{ opt.label }}
                    <Check
                      v-if="visibility === opt.value"
                      class="h-3 w-3 text-[hsl(var(--tac-amber))]"
                    />
                  </span>
                  <span
                    class="block text-[0.7rem] text-muted-foreground leading-snug"
                  >
                    {{ opt.hint }}
                  </span>
                </span>
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <!-- Top-left stack: badge row, then the map name directly beneath the
             kill/duration count. -->
        <div
          class="pointer-events-none absolute top-2 left-2 flex max-w-[75%] flex-col items-start gap-1.5"
        >
          <div class="flex items-center gap-1">
            <span
              v-if="isTournament"
              class="inline-flex h-5 items-center gap-0.5 rounded bg-black/80 px-1.5 font-mono text-[0.62rem] leading-none text-[hsl(var(--tac-amber))] backdrop-blur-sm"
              :title="$t('ui.tournament_match')"
            >
              <Trophy class="h-2.5 w-2.5" />
            </span>
            <span
              v-if="clip.duration_ms != null"
              class="inline-flex h-5 items-center gap-0.5 rounded bg-black/80 px-1.5 font-mono text-[0.62rem] leading-none tabular-nums text-white backdrop-blur-sm"
            >
              {{ formatDuration(clip.duration_ms) }}
            </span>
            <span
              v-if="clip.kills_count"
              class="inline-flex h-5 items-center gap-1 rounded bg-black/80 px-1.5 font-mono text-[0.62rem] font-bold leading-none tabular-nums text-[hsl(var(--tac-amber))] backdrop-blur-sm"
              :title="$t('clips.kills_in_clip', { count: clip.kills_count })"
            >
              <Crosshair class="h-2.5 w-2.5" />
              {{ clip.kills_count }}
            </span>
          </div>
          <div
            v-if="clip.match_map?.map?.name"
            class="max-w-full truncate font-sans text-sm font-bold uppercase leading-tight text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
            :title="
              clip.match_map.map.label || cleanMapName(clip.match_map.map.name)
            "
          >
            {{
              clip.match_map.map.label || cleanMapName(clip.match_map.map.name)
            }}
          </div>
        </div>

        <!-- Frame footer: featured player anchored bottom-left (where the map
             used to sit), timestamp on the opposite side. On the player page
             the player is implied, so only the date shows. -->
        <div
          v-if="(featuredPlayer?.steam_id && !hidePlayer) || clip.created_at"
          class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1.5 pt-6"
        >
          <NuxtLink
            v-if="featuredPlayer?.steam_id && !hidePlayer"
            :to="{
              name: 'players-id',
              params: { id: featuredPlayer.steam_id },
            }"
            class="group/player pointer-events-auto relative z-10 flex min-w-0 items-center gap-1.5"
            :title="featuredPlayer.name"
            @click.stop
          >
            <Avatar
              shape="square"
              class="h-6 w-6 shrink-0 text-[0.55rem] ring-1 ring-white/20"
            >
              <AvatarImage
                v-if="playerAvatarSrc"
                :src="playerAvatarSrc"
                :alt="featuredPlayer.name"
              />
              <AvatarFallback>{{
                featuredPlayer.name.slice(0, 2)
              }}</AvatarFallback>
            </Avatar>
            <span
              class="min-w-0 truncate text-sm font-semibold text-white drop-shadow-md transition-colors group-hover/player:text-[hsl(var(--tac-amber))]"
            >
              {{ featuredPlayer.name }}
            </span>
          </NuxtLink>
          <span
            v-if="clip.created_at"
            class="ml-auto flex shrink-0 items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-white/55 drop-shadow-md"
          >
            <Clock class="h-3 w-3" />
            <TimeAgo :date="clip.created_at" hide-icon />
          </span>
        </div>
      </div>
    </Card>
  </div>
</template>
