<script setup lang="ts">
import { computed } from "vue";
import TrophyBadge from "./TrophyBadge.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface Trophy {
  id: string;
  placement: number;
  placement_tier?: string | null;
  tournament_id: string;
  tournament_name: string;
  tournament_start?: string | null;
  tournament_type?: string | null;
  custom_name?: string | null;
  silhouette?: number | null;
  image_url?: string | null;
}

interface Props {
  open: boolean;
  trophy: Trophy;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const placementLabelKey = computed(() => {
  if (props.trophy.placement === 0) return "trophies.mvp";
  if (props.trophy.placement === 1) return "trophies.first_place";
  if (props.trophy.placement === 2) return "trophies.second_place";
  return "trophies.third_place";
});

const tierColor = computed(() => {
  if (props.trophy.placement === 0) return "hsl(195 85% 60%)";
  if (props.trophy.placement === 1) return "hsl(45 95% 60%)";
  if (props.trophy.placement === 2) return "hsl(0 0% 78%)";
  return "hsl(28 70% 52%)";
});

const formattedDate = computed(() => {
  if (!props.trophy.tournament_start) return null;
  const d = new Date(props.trophy.tournament_start);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
});
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader class="gap-1">
        <div
          class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span class="text-[0.7rem]" :style="{ color: tierColor }">◢</span>
          {{ $t("trophies.title") }}
          <span class="text-muted-foreground/50">·</span>
          <span :style="{ color: tierColor }">{{ $t(placementLabelKey) }}</span>
        </div>
        <DialogTitle
          class="text-xl font-bold uppercase tracking-[0.04em] sm:text-2xl"
        >
          {{ trophy.tournament_name }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ trophy.tournament_name }} — {{ $t(placementLabelKey) }}
        </DialogDescription>
      </DialogHeader>

      <!-- Trophy hero with uplight + scanlines -->
      <div
        class="relative overflow-hidden rounded-sm border border-border bg-background/40 py-6"
      >
        <div
          class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.03)_3px,hsl(var(--tac-amber)_/_0.03)_4px)]"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 blur-3xl"
          :style="{
            background: `radial-gradient(ellipse at center bottom, ${tierColor} 0%, transparent 65%)`,
            opacity: 0.35,
          }"
          aria-hidden="true"
        ></div>
        <div class="relative z-[1] flex justify-center">
          <TrophyBadge
            :tournament-id="trophy.tournament_id"
            :placement="trophy.placement"
            :tournament-name="trophy.tournament_name"
            :tournament-start="trophy.tournament_start"
            :tournament-type="trophy.tournament_type"
            :custom-name="trophy.custom_name"
            :silhouette-override="trophy.silhouette"
            :image-url="trophy.image_url"
            size="lg"
            :interactive="false"
          />
        </div>
      </div>

      <!-- Metadata strip -->
      <dl
        class="grid grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-sm border border-border/70 bg-background/60 text-xs"
      >
        <div class="flex flex-col gap-1 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("trophies.placement") }}
          </dt>
          <dd
            class="font-semibold uppercase tracking-wide"
            :style="{ color: tierColor }"
          >
            <template v-if="trophy.placement === 0"
              >★ {{ $t(placementLabelKey) }}</template
            >
            <template v-else>
              #{{ String(trophy.placement).padStart(2, "0") }} ·
              {{ $t(placementLabelKey) }}
            </template>
          </dd>
        </div>
        <div class="flex flex-col gap-1 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("trophies.tournament") }}
          </dt>
          <dd class="font-semibold">{{ trophy.tournament_type || "—" }}</dd>
        </div>
        <div class="flex flex-col gap-1 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            DATE
          </dt>
          <dd class="font-mono text-[0.7rem] font-semibold tracking-[0.08em]">
            {{ formattedDate || "—" }}
          </dd>
        </div>
      </dl>

      <NuxtLink
        :to="`/tournaments/${trophy.tournament_id}`"
        class="group/link inline-flex items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]"
      >
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[-2px]"
          >▚</span
        >
        VIEW TOURNAMENT
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[2px]"
          >◢</span
        >
      </NuxtLink>
    </DialogContent>
  </Dialog>
</template>
