<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Lock } from "lucide-vue-next";

// Additional season settings beyond series format. Almost everything stays
// editable; only the match-week count and games-per-week lock once the season
// starts, since those regenerate the tournament brackets.
defineProps<{
  scheduleLocked?: boolean;
  weeksCount: number;
  gamesPerWeek: number;
  startsAt: string;
  signupOpens: string;
  signupCloses: string;
  rosterLockAt: string;
}>();

const emit = defineEmits<{
  (e: "update:weeksCount", v: number): void;
  (e: "update:gamesPerWeek", v: number): void;
  (e: "update:startsAt", v: string): void;
  (e: "update:signupOpens", v: string): void;
  (e: "update:signupCloses", v: string): void;
  (e: "update:rosterLockAt", v: string): void;
}>();

function num(e: Event) {
  return Number((e.target as HTMLInputElement).value);
}
function str(e: Event) {
  return (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="grid items-start gap-5 lg:grid-cols-2">
    <!-- Schedule -->
    <section
      class="overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--card)/0.5)]"
    >
      <header
        class="flex items-center gap-2 border-b border-border/50 px-4 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("league.settings.schedule") }}
        <span
          v-if="scheduleLocked"
          class="ml-auto inline-flex items-center gap-1 text-[0.62rem] normal-case tracking-normal text-muted-foreground/70"
        >
          <Lock class="h-3 w-3" />
          {{ $t("league.settings.locked_started") }}
        </span>
      </header>
      <div class="divide-y divide-border/40">
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.weeks_count") }}</span>
          <Input
            type="number"
            min="1"
            class="h-8 w-[84px]"
            :disabled="scheduleLocked"
            :model-value="weeksCount"
            @input="emit('update:weeksCount', num($event))"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.games_per_week") }}</span>
          <Input
            type="number"
            min="1"
            class="h-8 w-[84px]"
            :disabled="scheduleLocked"
            :model-value="gamesPerWeek"
            @input="emit('update:gamesPerWeek', num($event))"
          />
        </label>
      </div>
    </section>

    <!-- Dates -->
    <section
      class="overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--card)/0.5)]"
    >
      <header
        class="border-b border-border/50 px-4 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("league.settings.dates") }}
      </header>
      <div class="divide-y divide-border/40">
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.signup_opens") }}</span>
          <Input
            type="datetime-local"
            style="color-scheme: dark"
            class="h-8 w-[210px]"
            :model-value="signupOpens"
            @input="emit('update:signupOpens', str($event))"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.signup_closes") }}</span>
          <Input
            type="datetime-local"
            style="color-scheme: dark"
            class="h-8 w-[210px]"
            :model-value="signupCloses"
            @input="emit('update:signupCloses', str($event))"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.starts_at") }}</span>
          <Input
            type="datetime-local"
            style="color-scheme: dark"
            class="h-8 w-[210px]"
            :model-value="startsAt"
            @input="emit('update:startsAt', str($event))"
          />
        </label>
        <label class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-sm">{{ $t("league.settings.roster_lock") }}</span>
          <Input
            type="datetime-local"
            style="color-scheme: dark"
            class="h-8 w-[210px]"
            :model-value="rosterLockAt"
            @input="emit('update:rosterLockAt', str($event))"
          />
        </label>
      </div>
    </section>
  </div>
</template>
