<script lang="ts" setup>
import { computed } from "vue";
import { useNow } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Tv } from "lucide-vue-next";

const { t } = useI18n();

const props = defineProps<{
  match: {
    id: string;
    type: string | null;
    startedAt: string | null;
    hasLiveStream: boolean;
    bestOf: number;
    isSeries: boolean;
    mapName: string | null;
    friendScore: number | null;
    oppScore: number | null;
    friendMapsWon: number;
    oppMapsWon: number;
  };
}>();

const leading = computed(() => {
  const f = props.match.friendScore ?? 0;
  const o = props.match.oppScore ?? 0;
  return f === o ? 0 : f > o ? 1 : -1;
});

const now = useNow({ interval: 1000 });
const elapsed = computed(() => {
  if (!props.match.startedAt) return null;
  const start = new Date(props.match.startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const total = Math.max(0, Math.floor((now.value.getTime() - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
});
</script>

<template>
  <NuxtLink :to="`/matches/${match.id}`" class="match-readout">
    <span class="match-readout__rail" />

    <div class="relative flex flex-col gap-1 font-mono">
      <div
        class="flex items-center gap-1.5 text-[0.5rem] font-bold uppercase leading-none tracking-[0.18em]"
      >
        <span class="relative flex h-1.5 w-1.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/80"
          />
          <span
            class="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500"
          />
        </span>
        <span class="text-red-400">{{ t("matchmaking.friends.live") }}</span>

        <template v-if="match.type">
          <span class="text-muted-foreground/50">/</span>
          <span class="text-foreground/65">{{ match.type }}</span>
        </template>

        <template v-if="match.isSeries">
          <span class="text-muted-foreground/50">/</span>
          <span class="text-[hsl(var(--tac-amber))]"
            >BO{{ match.bestOf }} {{ match.friendMapsWon }}-{{
              match.oppMapsWon
            }}</span
          >
        </template>

        <span
          v-if="match.hasLiveStream"
          class="ml-auto flex items-center gap-1 text-red-400"
        >
          <Tv class="h-2.5 w-2.5" />
          <span>{{ t("matchmaking.friends.watch") }}</span>
        </span>

        <span
          v-if="elapsed"
          class="match-readout__clock tabular-nums tracking-[0.1em]"
          :class="{ 'ml-auto': !match.hasLiveStream }"
          >{{ elapsed }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="match.mapName"
          class="min-w-0 flex-1 truncate text-[0.7rem] font-semibold tracking-wide text-foreground/90"
        >
          {{ match.mapName }}
        </span>
        <span
          v-if="match.friendScore !== null"
          class="flex shrink-0 items-center gap-1 text-[0.8rem] font-extrabold tabular-nums"
        >
          <span
            :class="
              leading === 1
                ? 'text-green-400'
                : leading === -1
                  ? 'text-red-400'
                  : 'text-foreground'
            "
            >{{ match.friendScore }}</span
          >
          <span class="text-[0.65rem] font-normal text-muted-foreground/60"
            >:</span
          >
          <span class="text-foreground/70">{{ match.oppScore }}</span>
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.match-readout {
  display: block;
  position: relative;
  overflow: hidden;
  border-radius: 0.375rem;
  padding: 0.4rem 0.5rem 0.4rem 0.6rem;
  border: 1px solid hsl(var(--tac-amber) / 0.22);
  transition: border-color 0.2s ease;
  background:
    repeating-linear-gradient(
      0deg,
      hsl(var(--tac-amber) / 0.04) 0px,
      hsl(var(--tac-amber) / 0.04) 1px,
      transparent 1px,
      transparent 3px
    ),
    linear-gradient(
      100deg,
      hsl(var(--tac-amber) / 0.1),
      hsl(var(--tac-amber) / 0.02) 55%,
      transparent
    );
}

.match-readout:hover {
  border-color: hsl(var(--tac-amber) / 0.5);
}

.match-readout__rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 8px hsl(var(--tac-amber) / 0.7);
  animation: rail-pulse 2.4s ease-in-out infinite;
}

.match-readout__clock {
  color: hsl(var(--tac-amber));
  text-shadow: 0 0 8px hsl(var(--tac-amber) / 0.45);
}

@keyframes rail-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .match-readout__rail {
    animation: none;
  }
}
</style>
