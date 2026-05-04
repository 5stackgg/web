<script setup lang="ts">
import { computed, ref } from "vue";
import { Sparkles, Play, Info, Lock, Eye, Globe } from "lucide-vue-next";
import { Card, CardContent } from "~/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

// Reusable highlight card. Click anywhere = inline play. Hover the
// info icon = popover with extended metadata (creator, match, target
// player, visibility, created time). Default state is a still preview
// (poster + lifted hover); once clicked we mount an autoplaying
// <video controls> in the same slot. Re-clicking the play surface
// while the video is mounted toggles back to the preview.

type Clip = {
  id: string;
  title: string | null;
  duration_ms: number | null;
  download_url: string | null;
  thumbnail_url: string | null;
  visibility: string;
  created_at: string;
  user?: { steam_id: string; name: string; avatar_url: string | null } | null;
  target?: { steam_id: string; name: string; avatar_url: string | null } | null;
  match_map?: {
    id: string;
    map?: { name: string; poster: string | null; label: string | null } | null;
    match?: {
      id: string;
      lineup_1?: { name: string } | null;
      lineup_2?: { name: string } | null;
    } | null;
  } | null;
};

const props = defineProps<{
  clip: Clip;
  // When true, this card autoplays + shows controls immediately.
  // The parent toggles which clip is the "active" one — only one at
  // a time so we don't overload the network with 8 simultaneous
  // streams. Soft-coupling: the card still works standalone if the
  // parent doesn't manage activeness (each card flips its own
  // playing state on click).
  active?: boolean;
}>();
const emit = defineEmits<{
  (e: "activate"): void;
}>();

const localPlaying = ref(false);
const isPlaying = computed(() => props.active === true || localPlaying.value);

function onPlayClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!isPlaying.value) {
    localPlaying.value = true;
    emit("activate");
  }
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
const matchupLabel = computed(() => {
  const a = props.clip.match_map?.match?.lineup_1?.name;
  const b = props.clip.match_map?.match?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return (
    props.clip.match_map?.map?.label ??
    props.clip.match_map?.map?.name ??
    null
  );
});
</script>

<template>
  <Card class="overflow-hidden transition-all hover:border-foreground/30">
    <div
      class="relative aspect-video w-full overflow-hidden bg-black"
    >
      <!-- Active state: real <video> with controls. Mounted only on
           click so 8 cards in a grid don't all open WHEP-like
           connections at once — important on the highlights page
           where the user is browsing. -->
      <video
        v-if="isPlaying && clip.download_url"
        :src="clip.download_url"
        :poster="clip.thumbnail_url ?? clip.match_map?.map?.poster ?? undefined"
        class="absolute inset-0 h-full w-full object-cover"
        controls
        autoplay
        playsinline
        preload="auto"
      />

      <!-- Idle state: silent thumbnail teaser. Click anywhere flips
           to the active state. The hover scale gives the affordance
           "this is interactive". -->
      <template v-else>
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
          <Sparkles class="h-8 w-8 opacity-50" />
        </div>
        <button
          type="button"
          class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity hover:opacity-100"
          :class="isPlaying ? 'opacity-0' : 'opacity-60 hover:opacity-100'"
          :aria-label="`Play ${clip.title ?? 'clip'}`"
          @click="onPlayClick"
        >
          <span
            class="rounded-full bg-foreground/90 p-3 backdrop-blur-sm transition-transform hover:scale-110"
          >
            <Play class="h-5 w-5 text-background fill-background" />
          </span>
        </button>
      </template>

      <!-- Hover-only info popover. Sits in the top-right so it doesn't
           overlap the video's center play button. Clicking it doesn't
           navigate — it toggles the inline detail card. The detail
           page link is one click further in, for users who really
           want the full /clips/<id> view. -->
      <Popover>
        <PopoverTrigger
          class="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="`Details for ${clip.title ?? 'clip'}`"
          @click.stop
        >
          <Info class="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent
          class="w-72 text-sm"
          align="end"
          @click.stop
        >
          <div class="space-y-2">
            <div class="font-medium leading-tight">
              {{ clip.title ?? "Untitled clip" }}
            </div>
            <div
              v-if="matchupLabel"
              class="text-xs text-muted-foreground"
            >
              {{ matchupLabel }}
            </div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-1">
              <span class="text-muted-foreground">Duration</span>
              <span class="font-mono tabular-nums text-right">
                {{ formatDuration(clip.duration_ms) }}
              </span>
              <template v-if="clip.target?.name">
                <span class="text-muted-foreground">Player</span>
                <NuxtLink
                  :to="`/players/${clip.target.steam_id}`"
                  class="text-right truncate hover:underline"
                  @click.stop
                >
                  {{ clip.target.name }}
                </NuxtLink>
              </template>
              <template v-if="clip.user?.name">
                <span class="text-muted-foreground">Created by</span>
                <NuxtLink
                  :to="`/players/${clip.user.steam_id}`"
                  class="text-right truncate hover:underline"
                  @click.stop
                >
                  {{ clip.user.name }}
                </NuxtLink>
              </template>
              <span class="text-muted-foreground">Visibility</span>
              <span class="text-right inline-flex items-center justify-end gap-1 capitalize">
                <Lock
                  v-if="clip.visibility === 'private'"
                  class="h-3 w-3 text-muted-foreground"
                />
                <Eye
                  v-else-if="clip.visibility === 'unlisted'"
                  class="h-3 w-3 text-muted-foreground"
                />
                <Globe
                  v-else-if="clip.visibility === 'public'"
                  class="h-3 w-3 text-emerald-400"
                />
                {{ clip.visibility }}
              </span>
              <span class="text-muted-foreground">Created</span>
              <span class="text-right">{{ formatDate(clip.created_at) }}</span>
            </div>
            <div class="pt-2 flex items-center justify-end">
              <NuxtLink
                :to="`/clips/${clip.id}`"
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                Open detail page →
              </NuxtLink>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <span
        class="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[0.65rem] font-mono tabular-nums text-white pointer-events-none"
      >
        {{ formatDuration(clip.duration_ms) }}
      </span>
    </div>

    <CardContent class="p-3 space-y-1">
      <div class="truncate text-sm font-medium">
        {{ clip.title || "Untitled clip" }}
      </div>
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
