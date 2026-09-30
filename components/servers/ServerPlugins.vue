<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { Button } from "~/components/ui/button";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { toast } from "@/components/ui/toast";

type Choice = "default" | "on" | "off";

type Install = {
  plugin_slug: string;
  load_custom: boolean;
  load_tournaments: boolean;
  plugin: { name: string; map_rotation: unknown | null } | null;
};

const props = defineProps<{ serverId: string }>();

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

const choices = ref<Record<string, Choice>>({});
const dirty = ref(false);

function reset() {
  const overrides = (result.value as any)?.servers_by_pk?.plugin_overrides;

  choices.value = Object.fromEntries(
    (overrides ?? []).map(
      (override: { plugin_slug: string; enabled: boolean }) => [
        override.plugin_slug,
        override.enabled ? "on" : "off",
      ],
    ),
  );
  dirty.value = false;
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

const installs = computed<Array<Install>>(
  () => (result.value as any)?.game_plugin_installs ?? [],
);

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
  dirty.value = true;
}

// A community server has no match to scope by, so it takes every plugin
// flagged for tournaments or custom matches.
function defaultHint(install: Install) {
  return install.load_custom || install.load_tournaments
    ? t("pages.dedicated_servers.detail.plugins.loads_by_default")
    : t("pages.dedicated_servers.detail.plugins.off_by_default");
}

async function save() {
  const plugins = Object.entries(choices.value)
    .filter(
      ([slug, choice]) => choice !== "default" && !modePlugins.value.has(slug),
    )
    .map(([slug, choice]) => ({ slug, enabled: choice === "on" }));

  await nuxtApp.$apollo.defaultClient.mutate({
    mutation: SAVE,
    variables: { serverId: props.serverId, plugins },
  });

  dirty.value = false;

  toast({ title: t("pages.dedicated_servers.detail.plugins.saved") });

  await refetch();
}
</script>

<template>
  <div>
    <div
      class="mb-3 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
    >
      <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
      {{ $t("pages.dedicated_servers.detail.plugins.title") }}
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.plugins.description") }}
      </p>

      <ul v-if="installs.length" class="divide-y divide-border/60">
        <li
          v-for="install in installs"
          :key="install.plugin_slug"
          class="flex items-center justify-between gap-4 py-2.5 max-sm:flex-col max-sm:items-start"
        >
          <div class="min-w-0 space-y-0.5">
            <NuxtLink
              :to="`/plugins/${install.plugin_slug}`"
              class="text-sm font-medium hover:underline"
            >
              {{ install.plugin?.name ?? install.plugin_slug }}
            </NuxtLink>
            <p class="text-xs text-muted-foreground">
              {{ defaultHint(install) }}
              <template v-if="install.plugin?.map_rotation">
                ·
                {{ $t("pages.dedicated_servers.detail.plugins.map_rotation") }}
              </template>
            </p>
          </div>

          <span
            v-if="modePlugins.has(install.plugin_slug)"
            class="inline-flex shrink-0 items-center rounded border border-border/70 bg-muted/35 px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{
              $t("pages.dedicated_servers.detail.plugins.from_mode", {
                mode: gameMode?.name,
              })
            }}
          </span>
          <AnimatedFilters
            v-else
            square
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
        class="flex items-center justify-between gap-3 text-sm text-muted-foreground max-sm:flex-col max-sm:items-start"
      >
        <span>{{ $t("pages.dedicated_servers.detail.plugins.empty") }}</span>
        <Button as-child variant="outline" size="sm">
          <NuxtLink to="/plugins">
            {{ $t("pages.dedicated_servers.detail.plugins.browse") }}
          </NuxtLink>
        </Button>
      </div>

      <div
        class="flex items-center justify-end gap-3 border-t border-border/60 pt-4 max-sm:flex-col max-sm:items-stretch"
      >
        <p class="mr-auto text-xs text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.restart_hint") }}
        </p>
        <Button v-if="dirty" variant="ghost" @click="reset">
          {{ $t("pages.dedicated_servers.detail.discard") }}
        </Button>
        <Button :disabled="!dirty" @click="save">
          {{ $t("pages.dedicated_servers.detail.save_restart") }}
        </Button>
      </div>
    </div>
  </div>
</template>
