<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { Plus, ShieldCheck, ShieldAlert, Archive } from "lucide-vue-next";

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
          <template #action>
            <Button class="gap-2" @click="create">
              <Plus class="h-4 w-4" />
              {{ $t("pages.settings.application.game_modes.create") }}
            </Button>
          </template>

          <p
            v-if="!gamePluginsEnabled"
            class="text-sm text-muted-foreground"
          >
            {{ $t("pages.settings.application.game_modes.requires_plugins") }}
          </p>

          <p
            v-else-if="gameModes.length === 0"
            class="text-sm text-muted-foreground"
          >
            {{ $t("pages.settings.application.game_modes.empty") }}
          </p>

          <div class="space-y-2" v-else>
            <button
              v-for="mode in sortedModes"
              :key="mode.id"
              type="button"
              class="flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors hover:bg-accent"
              :class="mode.archived_at ? 'opacity-60' : ''"
              @click="edit(mode)"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium truncate">{{ mode.name }}</span>
                  <Badge variant="outline" class="gap-1" v-if="mode.archived_at">
                    <Archive class="h-3 w-3" />
                    {{ $t("pages.settings.application.game_modes.archived") }}
                  </Badge>
                  <Badge variant="outline" v-else-if="!mode.enabled">
                    {{ $t("pages.settings.application.game_modes.disabled") }}
                  </Badge>
                  <Badge
                    v-if="mode.competitive_safe"
                    variant="secondary"
                    class="gap-1"
                  >
                    <ShieldCheck class="h-3 w-3" />
                    {{ $t("pages.settings.application.game_modes.competitive") }}
                  </Badge>
                  <Badge v-else variant="outline" class="gap-1">
                    <ShieldAlert class="h-3 w-3" />
                    {{ $t("pages.settings.application.game_modes.casual_only") }}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground truncate">
                  {{ mode.description }}
                </p>
              </div>

              <span class="text-xs text-muted-foreground shrink-0">
                {{
                  $t("pages.settings.application.game_modes.plugin_count", {
                    count: mode.plugins?.length ?? 0,
                  })
                }}
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

export default {
  data() {
    return {
      editing: undefined as Record<string, any> | null | undefined,
      gameModes: [] as Array<Record<string, any>>,
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
            match_options: [{ limit: 1 }, { id: true }],
            plugins: [
              { order_by: [{ load_order: order_by.asc }] },
              {
                plugin_slug: true,
                load_order: true,
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
    create() {
      this.editing = null;
    },
    edit(mode: Record<string, any>) {
      this.editing = mode;
    },
    close() {
      this.editing = undefined;
    },
    async onSaved() {
      this.editing = undefined;
      await (this as any).$apollo.queries.gameModes.refetch();
    },
  },
  computed: {
    gamePluginsEnabled() {
      return useApplicationSettingsStore().gamePluginsEnabled;
    },
    // Archived modes stay listed (so they can be restored or deleted) but sink
    // below the live ones.
    sortedModes(): Array<Record<string, any>> {
      return [...this.gameModes].sort(
        (a, b) => Number(!!a.archived_at) - Number(!!b.archived_at),
      );
    },
  },
};
</script>
