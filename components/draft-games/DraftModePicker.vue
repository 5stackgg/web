<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import { Check, Puzzle, ShieldAlert } from "lucide-vue-next";
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
        <div class="flex items-center gap-2">
          <span class="truncate font-medium">{{ mode.name }}</span>
          <Badge
            v-if="!mode.competitive_safe"
            variant="outline"
            class="shrink-0 gap-1 text-[0.6rem]"
          >
            <ShieldAlert class="h-3 w-3" />
            {{ $t("draft_games.bar.unranked") }}
          </Badge>
        </div>
        <p class="truncate text-xs text-muted-foreground">
          {{ mode.description }}
        </p>
      </div>
    </button>

    <p v-if="modes.length === 0" class="text-sm text-muted-foreground">
      {{ $t("draft_games.create.mode_empty") }}
    </p>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  props: {
    form: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      gameModes: [] as Array<Record<string, any>>,
    };
  },
  apollo: {
    gameModes: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        game_modes: [
          {},
          {
            id: true,
            name: true,
            description: true,
            enabled: true,
            competitive_safe: true,
          },
        ],
      }),
      update(data: { game_modes: Array<Record<string, any>> }) {
        return data.game_modes;
      },
      skip() {
        return !useApplicationSettingsStore().gamePluginsEnabled;
      },
    },
  },
  methods: {
    select(id: string) {
      this.form.setFieldValue("game_mode_id", id);
    },
  },
  computed: {
    selected(): string {
      return this.form.values.game_mode_id ?? "";
    },
    modes(): Array<Record<string, any>> {
      return (this.gameModes ?? []).filter(
        (mode: Record<string, any>) => mode.enabled,
      );
    },
  },
};
</script>
