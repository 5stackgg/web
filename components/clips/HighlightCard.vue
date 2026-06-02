<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Film,
  Play,
  Lock,
  Eye,
  Globe,
  Trophy,
  ArrowUpRight,
  Check,
  Share2,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { useNuxtApp } from "#app";
import { Card, CardContent } from "~/components/ui/card";
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

const matchupLabel = computed(() => {
  const a = props.clip.match_map?.match?.lineup_1?.name;
  const b = props.clip.match_map?.match?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return (
    props.clip.match_map?.map?.label ?? props.clip.match_map?.map?.name ?? null
  );
});

const isTournament = computed(
  () => props.clip.match_map?.match?.is_tournament_match === true,
);

function onTitleClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  openClip(props.clip.id);
}

type Visibility = "public" | "unlisted" | "private";
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
    value: "unlisted",
    label: t("clips.visibility.unlisted"),
    icon: Eye,
    hint: t("clips.visibility.unlisted_hint"),
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
  <div class="block h-full">
    <Card
      class="flex h-full flex-col overflow-hidden transition-all hover:border-foreground/30"
    >
      <div class="relative aspect-video w-full overflow-hidden bg-black group">
        <NuxtImg
          v-if="clip.thumbnail_download_url ?? clip.match_map?.map?.poster"
          :src="
            clip.thumbnail_download_url ?? clip.match_map?.map?.poster ?? ''
          "
          :alt="clip.title ?? $t('clips.detail.default_title')"
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
              :title="
                $t('ui_extras.visibility_label', { value: visibility })
              "
              @click.stop
            >
              <span
                class="inline-flex h-4 w-4 items-center justify-center rounded-full"
                :class="
                  visibility === 'public'
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : visibility === 'unlisted'
                      ? 'bg-amber-400/20 text-amber-300'
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
                      : opt.value === 'unlisted'
                        ? 'bg-amber-400/15 text-amber-300'
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
          <span
            v-else
            class="inline-flex h-7 items-center gap-1 rounded-full bg-black/75 pl-1.5 pr-2 text-white/90 backdrop-blur-sm pointer-events-none"
            :title="
              $t('ui_extras.visibility_label', { value: visibility })
            "
            :aria-label="
              $t('ui_extras.visibility_label', { value: visibility })
            "
          >
            <span
              class="inline-flex h-4 w-4 items-center justify-center rounded-full"
              :class="
                visibility === 'public'
                  ? 'bg-emerald-400/20 text-emerald-300'
                  : visibility === 'unlisted'
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'bg-white/10 text-white/80'
              "
            >
              <component :is="currentVisibilityMeta.icon" class="h-3 w-3" />
            </span>
            <span class="font-mono text-[0.58rem] uppercase tracking-[0.14em]">
              {{ currentVisibilityMeta.label }}
            </span>
          </span>
        </div>

        <!-- Top-left badges share the same h-5 / px-1.5 / text-[0.62rem]
           pill chrome so the trophy doesn't look like a smaller skinny
           sibling of the score. -->
        <div
          class="absolute top-2 left-2 flex items-center gap-1 pointer-events-none"
        >
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
        </div>

        <div
          v-if="clip.match_map?.map?.name"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1.5 pt-4"
        >
          <div
            class="truncate font-sans text-sm font-bold uppercase leading-tight text-white/70 drop-shadow-md"
            :title="
              clip.match_map.map.label || cleanMapName(clip.match_map.map.name)
            "
          >
            {{
              clip.match_map.map.label || cleanMapName(clip.match_map.map.name)
            }}
          </div>
        </div>
      </div>

      <CardContent class="flex flex-1 flex-col gap-1 p-3">
        <NuxtLink
          :to="`/clips/${clip.id}`"
          class="group/link flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-[hsl(var(--tac-amber))] transition-colors"
          :title="clip.title || $t('ui_extras.open_clip')"
          @click="onTitleClick"
        >
          <span class="truncate">
            {{ clip.title || $t("clips.untitled_clip") }}
          </span>
          <ArrowUpRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/link:text-[hsl(var(--tac-amber))] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
          />
        </NuxtLink>
        <div
          class="mt-auto flex items-end justify-between gap-2 text-xs text-muted-foreground"
        >
          <span class="min-w-0 flex-1">
            <span
              v-if="matchupLabel"
              class="block truncate font-semibold text-foreground/85"
              :title="matchupLabel"
            >
              {{ matchupLabel }}
            </span>
          </span>
          <TimeAgo
            v-if="clip.created_at"
            :date="clip.created_at"
            class="shrink-0 text-[0.65rem] text-muted-foreground/70"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
