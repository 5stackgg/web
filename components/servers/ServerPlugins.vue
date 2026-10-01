<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { Lock } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import SettingsSection from "~/components/settings/SettingsSection.vue";

type Choice = "default" | "on" | "off";

type Install = {
  plugin_slug: string;
  load_custom: boolean;
  load_tournaments: boolean;
  plugin: { name: string; map_rotation: unknown | null } | null;
};

const props = defineProps<{ serverId: string }>();

const { t } = useI18n();

// Raw documents: server_plugins is newer than ~/generated/zeus until codegen
// runs against a migrated database.
const QUERY = gql`
  query ServerPlugins($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      game_mode {
        id
        name
        plugins {
          plugin_slug
        }
      }
      plugin_overrides {
        plugin_slug
        enabled
      }
      map_rotation_aggregate(
        where: { map: { deleted_at: { _is_null: true } } }
      ) {
        aggregate {
          count
        }
      }
    }
    game_plugin_installs(
      where: { enabled: { _eq: true } }
      order_by: { plugin_slug: asc }
    ) {
      plugin_slug
      load_custom
      load_tournaments
      plugin {
        name
        map_rotation
      }
    }
  }
`;

const { result, refetch } = useQuery(
  QUERY,
  () => ({ serverId: props.serverId }),
  { fetchPolicy: "cache-and-network" },
);

const installs = computed<Array<Install>>(
  () => (result.value as any)?.game_plugin_installs ?? [],
);

const choices = ref<Record<string, Choice>>({});
const savedChoices = ref<Record<string, Choice>>({});

const gameMode = computed(
  () => (result.value as any)?.servers_by_pk?.game_mode,
);

// A mode's plugins load whenever the mode does; the api does not let a server
// switch them off, so they are shown rather than offered.
const modePlugins = computed(
  () =>
    new Set<string>(
      (gameMode.value?.plugins ?? []).map(
        (plugin: { plugin_slug: string }) => plugin.plugin_slug,
      ),
    ),
);

function choiceFor(slug: string): Choice {
  return choices.value[slug] ?? "default";
}

function savedChoiceFor(slug: string): Choice {
  return savedChoices.value[slug] ?? "default";
}

const changes = computed<Array<{ text: string; restart: boolean }>>(() =>
  installs.value
    .filter(
      (install) =>
        choiceFor(install.plugin_slug) !== savedChoiceFor(install.plugin_slug),
    )
    .map((install) => ({
      text: t(
        `pages.dedicated_servers.detail.settings.changes.plugin_${choiceFor(install.plugin_slug)}`,
        { plugin: install.plugin?.name ?? install.plugin_slug },
      ),
      restart: true,
    })),
);

function reset() {
  const overrides = (result.value as any)?.servers_by_pk?.plugin_overrides;

  savedChoices.value = Object.fromEntries(
    (overrides ?? []).map(
      (override: { plugin_slug: string; enabled: boolean }) => [
        override.plugin_slug,
        override.enabled ? "on" : "off",
      ],
    ),
  );
  choices.value = { ...savedChoices.value };
}

watch(
  result,
  () => {
    if (!changes.value.length) {
      reset();
    }
  },
  { immediate: true },
);

const hasRotation = computed(
  () =>
    ((result.value as any)?.servers_by_pk?.map_rotation_aggregate?.aggregate
      ?.count ?? 0) > 0,
);

function setChoice(slug: string, choice: Choice) {
  choices.value = { ...choices.value, [slug]: choice };
}

// A community server has no match to scope by, so it takes every plugin
// flagged for tournaments or custom matches.
function loadsWithoutRotation(install: Install) {
  const slug = install.plugin_slug;

  if (modePlugins.value.has(slug)) {
    return true;
  }

  const choice = choiceFor(slug);

  if (choice !== "default") {
    return choice === "on";
  }

  return install.load_custom || install.load_tournaments;
}

// Mirrors the api: when nothing already loading can play the rotation, the
// first rotation plugin the server has not switched off is added for it.
const rotationRunner = computed(() => {
  if (!hasRotation.value) {
    return null;
  }

  const players = installs.value.filter(
    (install) => install.plugin?.map_rotation,
  );

  if (players.some(loadsWithoutRotation)) {
    return null;
  }

  return (
    players.find((install) => choiceFor(install.plugin_slug) !== "off")
      ?.plugin_slug ?? null
  );
});

function status(install: Install): { loads: boolean; reason: string } {
  const slug = install.plugin_slug;

  if (modePlugins.value.has(slug)) {
    return {
      loads: true,
      reason: t("pages.dedicated_servers.detail.plugins.from_mode", {
        mode: gameMode.value?.name,
      }),
    };
  }

  const choice = choiceFor(slug);

  if (choice === "on") {
    return {
      loads: true,
      reason: t("pages.dedicated_servers.detail.plugins.forced_on"),
    };
  }

  if (choice === "off") {
    return {
      loads: false,
      reason: t("pages.dedicated_servers.detail.plugins.forced_off"),
    };
  }

  if (install.load_custom || install.load_tournaments) {
    return {
      loads: true,
      reason: t("pages.dedicated_servers.detail.plugins.loads_by_default"),
    };
  }

  if (rotationRunner.value === slug) {
    return {
      loads: true,
      reason: t("pages.dedicated_servers.detail.plugins.for_rotation"),
    };
  }

  return {
    loads: false,
    reason: t("pages.dedicated_servers.detail.plugins.off_by_default"),
  };
}

function payload() {
  return Object.entries(choices.value)
    .filter(
      ([slug, choice]) => choice !== "default" && !modePlugins.value.has(slug),
    )
    .map(([slug, choice]) => ({ slug, enabled: choice === "on" }));
}

async function saved() {
  savedChoices.value = { ...choices.value };

  await refetch();
}

defineExpose({ changes, payload, reset, saved });
</script>

<template>
  <SettingsSection
    id="server-plugins"
    :title="$t('pages.dedicated_servers.detail.plugins.title')"
    :description="$t('pages.dedicated_servers.detail.plugins.description')"
  >
    <ul
      v-if="installs.length"
      class="overflow-hidden rounded-md border border-border"
    >
      <li
        v-for="install in installs"
        :key="install.plugin_slug"
        class="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 max-sm:flex-col max-sm:items-start"
      >
        <div class="min-w-0 space-y-0.5">
          <NuxtLink
            :to="`/plugins/${install.plugin_slug}`"
            class="text-sm font-medium hover:underline"
          >
            {{ install.plugin?.name ?? install.plugin_slug }}
          </NuxtLink>
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="status(install).loads ? 'bg-success' : 'bg-muted-foreground/40'"
            />
            {{
              status(install).loads
                ? $t("pages.dedicated_servers.detail.plugins.status_loads")
                : $t("pages.dedicated_servers.detail.plugins.status_off")
            }}
            · {{ status(install).reason }}
          </p>
        </div>

        <span
          v-if="modePlugins.has(install.plugin_slug)"
          class="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Lock class="h-3 w-3" />
          {{
            $t("pages.dedicated_servers.detail.plugins.from_mode", {
              mode: gameMode?.name,
            })
          }}
        </span>
        <Select
          v-else
          :model-value="choiceFor(install.plugin_slug)"
          @update:model-value="
            (choice) => setChoice(install.plugin_slug, choice as Choice)
          "
        >
          <SelectTrigger
            class="h-8 w-32 shrink-0"
            :aria-label="install.plugin?.name ?? install.plugin_slug"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              {{ $t("pages.dedicated_servers.detail.plugins.default") }}
            </SelectItem>
            <SelectItem value="on">
              {{ $t("pages.dedicated_servers.detail.plugins.on") }}
            </SelectItem>
            <SelectItem value="off">
              {{ $t("pages.dedicated_servers.detail.plugins.off") }}
            </SelectItem>
          </SelectContent>
        </Select>
      </li>
    </ul>
    <div
      v-else
      class="flex items-center justify-between gap-3 text-sm text-muted-foreground max-sm:flex-col max-sm:items-start"
    >
      <span>{{ $t("pages.dedicated_servers.detail.plugins.empty") }}</span>
      <Button as-child variant="outline" size="sm">
        <NuxtLink to="/plugins">
          {{ $t("pages.dedicated_servers.detail.plugins.browse") }}
        </NuxtLink>
      </Button>
    </div>
  </SettingsSection>
</template>
