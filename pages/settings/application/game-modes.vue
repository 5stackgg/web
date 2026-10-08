<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import GameModeForm from "~/components/game-modes/GameModeForm.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="game-modes"
          :title="$t('pages.settings.application.game_modes.section')"
          :description="$t('pages.settings.application.game_modes.description')"
        >
          <p
            v-if="!gamePluginsEnabled"
            class="text-sm text-muted-foreground"
          >
            {{ $t("pages.settings.application.game_modes.requires_plugins") }}
          </p>

          <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="mode in sortedModes"
              :key="mode.id"
              :data-game-mode="mode.slug"
              class="relative flex min-h-[15rem] flex-col gap-3 rounded-lg border p-5 transition-colors"
              :class="[
                mode.system
                  ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.035)] hover:bg-[hsl(var(--tac-amber)/0.07)]'
                  : 'border-border bg-card/30 hover:border-muted-foreground/30 hover:bg-muted/40',
                mode.archived_at ? 'opacity-60' : '',
              ]"
            >
              <div class="flex items-center justify-between gap-3">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80"
                >
                  {{ $t("pages.settings.application.game_modes.runs_on") }}
                  <span
                    class="font-bold"
                    :class="
                      mode.valve_mode ? 'text-foreground' : 'text-muted-foreground'
                    "
                  >
                    {{ valveModeLabel(mode.valve_mode) }}
                  </span>
                </span>
                <span
                  v-if="mode.system"
                  class="rounded border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("pages.settings.application.game_modes.official") }}
                </span>
                <span
                  v-else-if="mode.archived_at"
                  class="rounded border border-border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.settings.application.game_modes.archived") }}
                </span>
              </div>

              <!-- The name stretches over the whole card, so a click anywhere
                   opens the editor while the switches below stay their own. -->
              <h3 class="text-xl font-bold uppercase leading-none tracking-[0.02em]">
                <button
                  type="button"
                  class="text-left after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[hsl(var(--tac-amber))]"
                  @click="edit(mode)"
                >
                  {{ mode.name }}
                </button>
              </h3>

              <p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {{ mode.description }}
              </p>

              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="plugin in mode.plugins"
                  :key="plugin.plugin_slug"
                  class="rounded border border-border bg-muted/30 px-2 py-0.5 font-mono text-[0.7rem] text-foreground/80"
                >
                  {{ plugin.plugin?.name ?? plugin.plugin_slug }}
                </span>
                <span
                  v-if="!mode.plugins?.length"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t("pages.settings.application.game_modes.no_plugins") }}
                </span>
              </div>

              <div class="flex-1"></div>

              <div
                class="relative z-[1] flex items-center justify-between gap-4 border-t border-border pt-3.5"
              >
                <span v-if="mode.system" class="text-xs text-muted-foreground">
                  {{ $t("pages.settings.application.game_modes.always_on") }}
                </span>
                <template v-else>
                  <label class="inline-flex items-center gap-2 text-xs">
                    <Switch
                      :model-value="valueOf(mode, 'enabled')"
                      :disabled="!!mode.archived_at"
                      :aria-label="$t('common.enabled')"
                      data-testid="mode-enabled"
                      @update:model-value="toggle(mode, 'enabled', $event)"
                    />
                    {{ $t("common.enabled") }}
                  </label>
                  <label
                    class="inline-flex items-center gap-2 text-xs"
                    :class="
                      valueOf(mode, 'competitive_safe')
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    "
                  >
                    {{ $t("pages.settings.application.game_modes.draft_lobbies") }}
                    <Switch
                      :model-value="valueOf(mode, 'competitive_safe')"
                      :disabled="!!mode.archived_at"
                      :aria-label="
                        $t('pages.settings.application.game_modes.draft_lobbies')
                      "
                      data-testid="mode-drafts"
                      @update:model-value="
                        toggle(mode, 'competitive_safe', $event)
                      "
                    />
                  </label>
                </template>
              </div>
            </article>

            <button
              type="button"
              class="flex min-h-[15rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-6 text-center text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.04)]"
              data-testid="new-mode"
              @click="create"
            >
              <span class="text-[0.95rem] font-semibold text-foreground">
                {{ $t("pages.settings.application.game_modes.create") }}
              </span>
              <span class="text-xs">
                {{ $t("pages.settings.application.game_modes.new_mode_hint") }}
              </span>
            </button>
          </div>
        </SettingsSection>
      </div>
    </PageTransition>

    <Sheet :open="editing !== undefined" @update:open="close">
      <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {{
              editing
                ? $t("pages.settings.application.game_modes.edit_title")
                : $t("pages.settings.application.game_modes.create_title")
            }}
          </SheetTitle>
          <SheetDescription>
            {{ $t("pages.settings.application.game_modes.sheet_description") }}
          </SheetDescription>
        </SheetHeader>

        <div class="py-6">
          <GameModeForm
            v-if="editing !== undefined"
            :key="editing?.id ?? 'new'"
            :game-mode="editing"
            @saved="onSaved"
          />
        </div>
      </SheetContent>
    </Sheet>
  </SettingsPage>
</template>

<script lang="ts">
import { order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { VALVE_MODES } from "~/constants/valveModes";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

type ToggleColumn = "enabled" | "competitive_safe";

export default {
  // ?mode=<id> opens that mode's editor, so a server can link to its mode.
  watch: {
    gameModes() {
      this.openRequested();
    },
    "$route.query.mode"() {
      this.openRequested();
    },
  },
  data() {
    return {
      editing: undefined as Record<string, any> | null | undefined,
      gameModes: [] as Array<Record<string, any>>,
      // A flipped switch shows its new value until the refetch confirms it;
      // the query's rows themselves are read-only.
      pending: {} as Record<string, Partial<Record<ToggleColumn, boolean>>>,
    };
  },
  apollo: {
    gameModes: {
      query: typedGql("query")({
        game_modes: [
          {},
          {
            id: true,
            slug: true,
            name: true,
            description: true,
            enabled: true,
            archived_at: true,
            competitive_safe: true,
            players_per_team: true,
            allow_short_handed_start: true,
            supported_runtimes: true,
            runtime_conflicts: true,
            cfg: true,
            extra_game_params: true,
            valve_mode: true,
            system: true,
            match_options: [{ limit: 1 }, { id: true }],
            plugins: [
              { order_by: [{ load_order: order_by.asc }] },
              {
                plugin_slug: true,
                load_order: true,
                plugin: { name: true },
              },
            ],
          },
        ],
      }),
      update(data: { game_modes: Array<Record<string, any>> }) {
        return data.game_modes;
      },
    },
  },
  methods: {
    valveModeLabel(value: string | null) {
      if (!value) {
        return this.$t("game_modes.form.valve_mode_custom");
      }

      return VALVE_MODES.find((mode) => mode.value === value)?.label ?? value;
    },
    valueOf(mode: Record<string, any>, column: ToggleColumn): boolean {
      return this.pending[mode.id]?.[column] ?? !!mode[column];
    },
    async toggle(
      mode: Record<string, any>,
      column: ToggleColumn,
      value: boolean,
    ) {
      this.pending = {
        ...this.pending,
        [mode.id]: { ...this.pending[mode.id], [column]: value },
      };

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_game_modes_by_pk: [
              { pk_columns: { id: mode.id }, _set: { [column]: value } },
              { id: true },
            ],
          }),
        });

        await (this as any).$apollo.queries.gameModes.refetch();
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        const { [column]: _done, ...rest } = this.pending[mode.id] ?? {};
        this.pending = { ...this.pending, [mode.id]: rest };
      }
    },
    create() {
      this.editing = null;
    },
    edit(mode: Record<string, any>) {
      this.editing = mode;
    },
    openRequested() {
      const requested = this.$route.query.mode;

      if (typeof requested !== "string" || this.editing !== undefined) {
        return;
      }

      const mode = (this.gameModes ?? []).find(
        (candidate: Record<string, any>) => candidate.id === requested,
      );

      if (mode) {
        this.edit(mode);
      }
    },
    close() {
      this.editing = undefined;

      if (this.$route.query.mode) {
        const query = { ...this.$route.query };
        delete query.mode;
        void this.$router.replace({ query });
      }
    },
    async onSaved() {
      this.close();
      await (this as any).$apollo.queries.gameModes.refetch();
    },
  },
  computed: {
    gamePluginsEnabled() {
      return useApplicationSettingsStore().gamePluginsEnabled;
    },
    // The official mode leads; archived ones stay listed (so they can be
    // restored or deleted) but sink below the live ones.
    sortedModes(): Array<Record<string, any>> {
      return [...this.gameModes].sort(
        (a, b) =>
          Number(!!a.archived_at) - Number(!!b.archived_at) ||
          Number(!!b.system) - Number(!!a.system),
      );
    },
  },
};
</script>
