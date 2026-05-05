<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Film,
  Play,
  Lock,
  Eye,
  Globe,
  Trophy,
  ArrowUpRight,
  Loader2,
  Check,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { Card, CardContent } from "~/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { Clip } from "~/types/clip";
import { useClipModal } from "~/composables/useClipModal";
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";

const props = defineProps<{
  clip: Clip;
}>();

const { openClip } = useClipModal();
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

// Suppress 0:0 chips for in-progress maps.
const score1 = computed(() => props.clip.match_map?.lineup_1_score);
const score2 = computed(() => props.clip.match_map?.lineup_2_score);
const hasScore = computed(
  () =>
    typeof score1.value === "number" &&
    typeof score2.value === "number" &&
    !(score1.value === 0 && score2.value === 0),
);
const winningSide = computed<"1" | "2" | null>(() => {
  const w = props.clip.match_map?.winning_lineup_id;
  if (!w) return null;
  if (w === props.clip.match_map?.match?.lineup_1_id) return "1";
  if (w === props.clip.match_map?.match?.lineup_2_id) return "2";
  return null;
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
const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  label: string;
  icon: any;
  hint: string;
}> = [
  {
    value: "public",
    label: "Public",
    icon: Globe,
    hint: "Listed in the highlights feed",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    icon: Eye,
    hint: "Hidden from feeds — anyone with the link can view",
  },
  {
    value: "private",
    label: "Private",
    icon: Lock,
    hint: "Hidden from feeds — file URL still plays if shared",
  },
];
const saving = ref(false);
const visPopoverOpen = ref(false);

const currentVisibilityMeta = computed(() => {
  return (
    VISIBILITY_OPTIONS.find((o) => o.value === props.clip.visibility) ??
    VISIBILITY_OPTIONS[2]
  );
});

async function setVisibility(v: Visibility) {
  if (saving.value || props.clip.visibility === v) {
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
    visPopoverOpen.value = false;
  } catch (e) {
    console.error("[highlight-card] visibility toggle failed:", e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Card class="overflow-hidden transition-all hover:border-foreground/30">
    <div class="relative aspect-video w-full overflow-hidden bg-black group">
      <video
        v-if="clip.download_url"
        :src="clip.download_url"
        :poster="clip.thumbnail_url ?? clip.match_map?.map?.poster ?? undefined"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        muted
        playsinline
        preload="metadata"
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
        :aria-label="`Play ${clip.title ?? 'clip'}`"
        @click="onPlayClick"
      >
        <span
          class="rounded-full bg-foreground/90 p-3 backdrop-blur-sm transition-transform hover:scale-110"
        >
          <Play class="h-5 w-5 text-background fill-background" />
        </span>
      </button>

      <Popover v-if="isAdmin" v-model:open="visPopoverOpen">
        <PopoverTrigger
          class="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-full bg-black/75 pl-1.5 pr-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          :aria-label="`Visibility: ${clip.visibility}. Click to change.`"
          :title="`Visibility: ${clip.visibility}`"
          @click.stop
        >
          <span
            class="inline-flex h-4 w-4 items-center justify-center rounded-full"
            :class="
              clip.visibility === 'public'
                ? 'bg-emerald-400/20 text-emerald-300'
                : clip.visibility === 'unlisted'
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-white/10 text-white/80'
            "
          >
            <Loader2 v-if="saving" class="h-3 w-3 animate-spin" />
            <component
              v-else
              :is="currentVisibilityMeta.icon"
              class="h-3 w-3"
            />
          </span>
          <span class="font-mono text-[0.58rem] uppercase tracking-[0.14em]">
            {{ currentVisibilityMeta.label }}
          </span>
        </PopoverTrigger>
        <PopoverContent class="w-56 p-1" align="end" @click.stop>
          <div
            class="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Visibility
          </div>
          <button
            v-for="opt in VISIBILITY_OPTIONS"
            :key="opt.value"
            type="button"
            class="w-full text-left flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :class="clip.visibility === opt.value ? 'bg-muted/40' : ''"
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
                  v-if="clip.visibility === opt.value"
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
        class="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-full bg-black/75 pl-1.5 pr-2 text-white/90 backdrop-blur-sm pointer-events-none"
        :title="`Visibility: ${clip.visibility}`"
        :aria-label="`Visibility: ${clip.visibility}`"
      >
        <span
          class="inline-flex h-4 w-4 items-center justify-center rounded-full"
          :class="
            clip.visibility === 'public'
              ? 'bg-emerald-400/20 text-emerald-300'
              : clip.visibility === 'unlisted'
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

      <div
        class="absolute top-2 left-2 flex items-center gap-1 pointer-events-none"
      >
        <span
          v-if="isTournament"
          class="inline-flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 text-[0.6rem] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
          title="Tournament match"
        >
          <Trophy class="h-2.5 w-2.5" />
        </span>
        <span
          v-if="hasScore"
          class="inline-flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-white backdrop-blur-sm"
        >
          <span
            :class="
              winningSide === '1'
                ? 'text-[hsl(var(--tac-amber))] font-semibold'
                : ''
            "
          >
            {{ score1 }}
          </span>
          <span class="opacity-50">:</span>
          <span
            :class="
              winningSide === '2'
                ? 'text-[hsl(var(--tac-amber))] font-semibold'
                : ''
            "
          >
            {{ score2 }}
          </span>
        </span>
      </div>

      <span
        class="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[0.65rem] font-mono tabular-nums text-white pointer-events-none"
      >
        {{ formatDuration(clip.duration_ms) }}
      </span>
    </div>

    <CardContent class="p-3 space-y-1">
      <NuxtLink
        :to="`/clips/${clip.id}`"
        class="group/link flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-[hsl(var(--tac-amber))] transition-colors"
        :title="clip.title || 'Open clip'"
        @click="onTitleClick"
      >
        <span class="truncate">
          {{ clip.title || "Untitled clip" }}
        </span>
        <ArrowUpRight
          class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/link:text-[hsl(var(--tac-amber))] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
        />
      </NuxtLink>
      <div
        class="flex items-center justify-between gap-2 text-xs text-muted-foreground"
      >
        <span class="truncate">
          <span v-if="clip.target?.name" class="text-foreground/80">
            {{ clip.target.name }}
          </span>
          <span v-if="clip.target?.name && matchupLabel"> · </span>
          <span class="truncate">{{ matchupLabel }}</span>
        </span>
        <span
          v-if="clip.user?.name"
          class="shrink-0 truncate max-w-[40%]"
          :title="`Clipped by ${clip.user.name}`"
        >
          by {{ clip.user.name }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
