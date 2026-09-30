<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { Lock, Puzzle } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { toast } from "@/components/ui/toast";

type Choice = "default" | "on" | "off";

type Install = {
  plugin_slug: string;
  load_custom: boolean;
  load_tournaments: boolean;
  plugin: { name: string; map_rotation: unknown | null } | null;
};

const props = defineProps<{ serverId: string; enabled?: boolean }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

// Raw documents: server_plugins and setServerPlugins are newer than
// ~/generated/zeus until codegen runs against a migrated database.
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

const SAVE = gql`
  mutation SetServerPlugins(
    $serverId: uuid!
    $plugins: [ServerPluginInput!]!
  ) {
    setServerPlugins(server_id: $serverId, plugins: $plugins) {
      success
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
const saved = ref<Record<string, Choice>>({});
const revision = ref(0);
const submitting = ref(false);

const dirty = computed(() =>
  installs.value.some(
    (install) =>
      choiceFor(install.plugin_slug) !==
      (saved.value[install.plugin_slug] ?? "default"),
  ),
);

function fromServer(): Record<string, Choice> {
  const overrides = (result.value as any)?.servers_by_pk?.plugin_overrides;

  return Object.fromEntries(
    (overrides ?? []).map(
      (override: { plugin_slug: string; enabled: boolean }) => [
        override.plugin_slug,
        override.enabled ? "on" : "off",
      ],
    ),
  );
}

function reset() {
  saved.value = fromServer();
  choices.value = { ...saved.value };
}

watch(
  result,
  () => {
    if (!dirty.value) {
      reset();
    }
  },
  { immediate: true },
);

const gameMode = computed(
  () => (result.value as any)?.servers_by_pk?.game_mode,
);

const hasRotation = computed(
  () =>
    ((result.value as any)?.servers_by_pk?.map_rotation_aggregate?.aggregate
      ?.count ?? 0) > 0,
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

const options = computed(() => [
  {
    key: "default",
    label: t("pages.dedicated_servers.detail.plugins.default"),
  },
  { key: "on", label: t("pages.dedicated_servers.detail.plugins.on") },
  { key: "off", label: t("pages.dedicated_servers.detail.plugins.off") },
]);

function choiceFor(slug: string): Choice {
  return choices.value[slug] ?? "default";
}

function setChoice(slug: string, choice: Choice) {
  choices.value = { ...choices.value, [slug]: choice };
  revision.value++;
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

const activeCount = computed(
  () => installs.value.filter((install) => status(install).loads).length,
);

function changed(slug: string) {
  return choiceFor(slug) !== (saved.value[slug] ?? "default");
}

async function save() {
  if (submitting.value) {
    return;
  }

  submitting.value = true;
  const startedAt = revision.value;

  try {
    const plugins = Object.entries(choices.value)
      .filter(
        ([slug, choice]) =>
          choice !== "default" && !modePlugins.value.has(slug),
      )
      .map(([slug, choice]) => ({ slug, enabled: choice === "on" }));

    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: SAVE,
      variables: { serverId: props.serverId, plugins },
    });

    toast({
      title: t(
        props.enabled === false
          ? "pages.dedicated_servers.detail.plugins.saved_disabled"
          : "pages.dedicated_servers.detail.plugins.saved",
      ),
    });

    // Changes made while the server was restarting stay pending.
    if (revision.value === startedAt) {
      await refetch();
      reset();
    } else {
      saved.value = Object.fromEntries(
        plugins.map((plugin) => [plugin.slug, plugin.enabled ? "on" : "off"]),
      );
    }
  } finally {
    submitting.value = false;
  }
}

const cardClasses =
  "relative isolate overflow-hidden rounded-lg border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const microLabelClasses =
  "font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground";

const pillClasses =
  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]";
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-3">
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("pages.dedicated_servers.detail.plugins.title") }}
      </div>
      <span class="h-px flex-1 bg-border" />
      <span :class="microLabelClasses">
        {{ $t("pages.dedicated_servers.detail.plugins.active") }}
        <span class="ml-1 tabular-nums text-foreground">{{
          activeCount
        }}</span>
      </span>
    </div>

    <div :class="cardClasses">
      <p class="border-b border-border/60 p-4 text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.plugins.description") }}
      </p>

      <ul v-if="installs.length" class="divide-y divide-border/60">
        <li
          v-for="install in installs"
          :key="install.plugin_slug"
          class="relative flex items-center justify-between gap-4 px-4 py-3 max-sm:flex-col max-sm:items-start"
        >
          <span
            class="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[hsl(var(--tac-amber))] transition-opacity duration-200 motion-reduce:transition-none"
            :class="changed(install.plugin_slug) ? 'opacity-100' : 'opacity-0'"
          />
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink
                :to="`/plugins/${install.plugin_slug}`"
                class="truncate text-sm font-semibold hover:underline"
              >
                {{ install.plugin?.name ?? install.plugin_slug }}
              </NuxtLink>
              <span
                :class="[
                  pillClasses,
                  status(install).loads
                    ? 'border-[hsl(var(--success)/0.5)] bg-[hsl(var(--success)/0.12)] text-success'
                    : 'border-border/70 bg-muted/35 text-muted-foreground',
                ]"
              >
                <span
                  class="h-1 w-1 rounded-full"
                  :class="
                    status(install).loads
                      ? 'bg-success'
                      : 'bg-muted-foreground/60'
                  "
                />
                {{
                  status(install).loads
                    ? $t("pages.dedicated_servers.detail.plugins.status_loads")
                    : $t("pages.dedicated_servers.detail.plugins.status_off")
                }}
              </span>
              <span
                v-if="install.plugin?.map_rotation"
                :class="[
                  pillClasses,
                  'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]',
                ]"
              >
                {{ $t("pages.dedicated_servers.detail.plugins.map_rotation") }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ status(install).reason }}
            </p>
          </div>

          <span
            v-if="modePlugins.has(install.plugin_slug)"
            :class="[
              pillClasses,
              'shrink-0 border-border/70 bg-muted/35 px-2.5 py-1.5 text-muted-foreground',
            ]"
          >
            <Lock class="h-3 w-3" />
            {{
              $t("pages.dedicated_servers.detail.plugins.from_mode", {
                mode: gameMode?.name,
              })
            }}
          </span>
          <AnimatedFilters
            v-else
            square
            class="shrink-0"
            :options="options"
            :model-value="choiceFor(install.plugin_slug)"
            @update:model-value="
              (choice) => setChoice(install.plugin_slug, choice as Choice)
            "
          />
        </li>
      </ul>
      <div
        v-else
        class="flex flex-col items-center gap-2 px-6 py-8 text-center"
      >
        <Puzzle class="h-6 w-6 text-muted-foreground/50" />
        <p class="max-w-sm text-sm text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.plugins.empty") }}
        </p>
        <Button as-child variant="outline" size="sm">
          <NuxtLink to="/plugins">
            {{ $t("pages.dedicated_servers.detail.plugins.browse") }}
          </NuxtLink>
        </Button>
      </div>

      <SettingsSaveBar
        contained
        :dirty="dirty"
        :submitting="submitting"
        :description="$t('pages.dedicated_servers.detail.restart_hint')"
        :action-label="$t('pages.dedicated_servers.detail.save_restart')"
        @save="save"
        @discard="reset"
      />
    </div>
  </section>
</template>
