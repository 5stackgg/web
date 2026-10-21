<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Check, ChevronDown, Swords } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { PlayedWith } from "~/utilities/bans";
import {
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

// Signed-in only: narrows the ledger to players the viewer shared a match
// with, by side, and optionally to the matches the viewer lost.
const playedWith = defineModel<PlayedWith>("playedWith", { required: true });
const lostOnly = defineModel<boolean>("lostOnly", { required: true });

const { t } = useI18n();

const options = computed(() => [
  { key: "any" as const, label: t("pages.bans.played_with.everyone") },
  {
    key: "either" as const,
    label: t("pages.bans.played_with.either"),
    hint: t("pages.bans.played_with.either_hint"),
  },
  {
    key: "opponent" as const,
    label: t("pages.bans.played_with.opponent"),
    hint: t("pages.bans.played_with.opponent_hint"),
  },
  {
    key: "teammate" as const,
    label: t("pages.bans.played_with.teammate"),
    hint: t("pages.bans.played_with.teammate_hint"),
  },
]);

const active = computed(() => playedWith.value !== "any" || lostOnly.value);
const label = computed(() => {
  const side =
    playedWith.value === "any"
      ? t("pages.bans.played_with.either")
      : options.value.find((option) => option.key === playedWith.value)!.label;
  if (!active.value) return t("pages.bans.played_with.label");
  return lostOnly.value
    ? t("pages.bans.played_with.lost_label", { side })
    : side;
});

function pick(key: PlayedWith) {
  playedWith.value = key;
  if (key === "any") lostOnly.value = false;
}

function toggleLost() {
  lostOnly.value = !lostOnly.value;
  if (lostOnly.value && playedWith.value === "any") playedWith.value = "either";
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="[
          filterTriggerBase,
          active ? filterTriggerActive : filterTriggerIdle,
        ]"
      >
        <Swords class="h-3.5 w-3.5" />
        <span class="max-w-[12rem] truncate">{{ label }}</span>
        <ChevronDown class="h-3 w-3 opacity-50" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-64 p-1.5">
      <div role="radiogroup" :aria-label="$t('pages.bans.played_with.label')">
        <button
          v-for="option in options"
          :key="option.key"
          type="button"
          role="radio"
          :aria-checked="playedWith === option.key"
          class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          @click="pick(option.key)"
        >
          <Check
            class="h-3.5 w-3.5 shrink-0"
            :class="
              playedWith === option.key
                ? 'text-[hsl(var(--tac-amber))]'
                : 'invisible'
            "
          />
          <span class="truncate">{{ option.label }}</span>
          <span
            v-if="option.hint"
            class="ml-auto shrink-0 text-xs text-muted-foreground"
            >{{ option.hint }}</span
          >
        </button>
      </div>
      <div class="mt-1 border-t border-border/50 pt-1">
        <button
          type="button"
          :aria-pressed="lostOnly"
          class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          @click="toggleLost"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
            :class="
              lostOnly
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black'
                : 'border-border'
            "
          >
            <Check v-if="lostOnly" class="h-3 w-3" />
          </span>
          {{ $t("pages.bans.played_with.lost_only") }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
