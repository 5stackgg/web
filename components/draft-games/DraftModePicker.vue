<script setup lang="ts">
import { computed } from "vue";
import { Check, Puzzle } from "lucide-vue-next";

const props = defineProps<{
  form: any;
  modes: Array<Record<string, any>>;
}>();

const selected = computed<string>(() => props.form.values.game_mode_id ?? "");

const select = (id: string) => {
  props.form.setFieldValue("game_mode_id", id);
};
</script>

<template>
  <div class="space-y-2">
    <!-- Cards rather than a dropdown: a mode is a set of plugins and cvars, and
         nobody picks "Retakes" from a list of names knowing what they get. -->
    <button
      type="button"
      class="group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
      :class="
        selected === ''
          ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.06)]'
          : 'border-border/60 hover:bg-accent/40'
      "
      @click="select('')"
    >
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60"
      >
        <Check v-if="selected === ''" class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
      </div>
      <div class="min-w-0">
        <p class="font-medium">{{ $t("draft_games.create.mode_none") }}</p>
        <p class="text-xs text-muted-foreground">
          {{ $t("draft_games.create.mode_none_hint") }}
        </p>
      </div>
    </button>

    <button
      v-for="mode in modes"
      :key="mode.id"
      type="button"
      class="group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
      :class="
        selected === mode.id
          ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.06)]'
          : 'border-border/60 hover:bg-accent/40'
      "
      @click="select(mode.id)"
    >
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60"
      >
        <Check
          v-if="selected === mode.id"
          class="h-4 w-4 text-[hsl(var(--tac-amber))]"
        />
        <Puzzle v-else class="h-4 w-4 text-muted-foreground" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-medium">{{ mode.name }}</p>
          <!-- Team size and whether the host may start short are the two things
               that change what the lobby asks of everyone in it, so they belong
               on the card rather than being discovered in the room. -->
          <span
            v-if="mode.players_per_team"
            class="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ mode.players_per_team }}v{{ mode.players_per_team }}
          </span>
          <span
            v-if="mode.allow_short_handed_start"
            class="rounded border border-[hsl(var(--tac-amber)/0.4)] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("draft_games.create.mode_short_handed") }}
          </span>
        </div>
        <!-- The description is the whole pitch for picking a mode; it wraps
             rather than truncating so a long one is still readable. -->
        <p class="text-xs leading-snug text-muted-foreground">
          {{ mode.description }}
        </p>
      </div>
    </button>
  </div>
</template>
