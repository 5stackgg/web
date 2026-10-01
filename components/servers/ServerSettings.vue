<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import SettingsSideTabs from "~/components/settings/SettingsSideTabs.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import ServerMapRotation from "~/components/servers/ServerMapRotation.vue";
import ServerPlugins from "~/components/servers/ServerPlugins.vue";
import ServerAccess from "~/components/servers/ServerAccess.vue";
import ServerPlayerManagementPlugin from "~/components/servers/ServerPlayerManagementPlugin.vue";
import { toast } from "@/components/ui/toast";

type Change = { text: string; restart: boolean };

type SettingsPane = {
  changes: Array<Change>;
  payload: () => unknown;
  reset: () => void;
  saved: () => Promise<void>;
};

const props = defineProps<{
  server: {
    id: string;
    enabled: boolean;
    game_server_node_id: string | null;
    plugin_runtime?: string | null;
  };
  apiPassword?: string | null;
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const route = useRoute();
const router = useRouter();

// Raw document: setServerSettings is newer than ~/generated/zeus until codegen
// runs against a migrated database.
const SAVE = gql`
  mutation SetServerSettings(
    $serverId: uuid!
    $mapRotation: ServerMapRotationInput
    $plugins: [ServerPluginInput!]
    $access: ServerAccessInput
  ) {
    setServerSettings(
      server_id: $serverId
      map_rotation: $mapRotation
      plugins: $plugins
      access: $access
    ) {
      success
    }
  }
`;

// Rotation and plugins reach the server in its pod spec, so an external server
// only has access, which its Player Management plugin enforces.
const hasPod = computed(() => !!props.server.game_server_node_id);

const tabs = computed(() => [
  ...(hasPod.value
    ? [
        {
          key: "rotation",
          label: t("pages.dedicated_servers.detail.map_rotation.title"),
        },
        {
          key: "plugins",
          label: t("pages.dedicated_servers.detail.plugins.title"),
        },
      ]
    : []),
  { key: "access", label: t("pages.dedicated_servers.detail.access.title") },
  {
    key: "player-management",
    label: t("pages.dedicated_servers.detail.player_management"),
  },
]);

const activeTab = computed(() => {
  const requested = route.query.settings;

  return tabs.value.some((tab) => tab.key === requested)
    ? (requested as string)
    : tabs.value[0].key;
});

function tabPath(key: string): string {
  return router.resolve({ query: { ...route.query, settings: key } })
    .fullPath;
}

const tabGroups = computed(() => [
  {
    label: t("pages.dedicated_servers.detail.settings.group"),
    items: tabs.value.map((tab) => ({ path: tabPath(tab.key), label: tab.label })),
  },
]);

const mobileTab = computed({
  get: () => activeTab.value,
  set: (key: string) => {
    void router.replace({ query: { ...route.query, settings: key } });
  },
});

const rotation = ref<SettingsPane | null>(null);
const plugins = ref<SettingsPane | null>(null);
const access = ref<SettingsPane | null>(null);
const submitting = ref(false);

const sections = computed(() =>
  [rotation.value, plugins.value, access.value].filter(
    (section): section is SettingsPane => !!section,
  ),
);

const changes = computed<Array<Change>>(() =>
  sections.value.flatMap((section) => section.changes ?? []),
);

const restarts = computed(() => changes.value.some((change) => change.restart));

const summary = computed(() => {
  if (!changes.value.length) {
    return "";
  }

  const list = changes.value.map((change) => change.text).join(", ");

  return `${list}. ${t(
    restarts.value
      ? "pages.dedicated_servers.detail.settings.restart_note"
      : "pages.dedicated_servers.detail.settings.live_note",
  )}`;
});

function dirtyPayload(section: SettingsPane | null) {
  return section?.changes.length ? section.payload() : null;
}

async function save() {
  if (submitting.value || !changes.value.length) {
    return;
  }

  submitting.value = true;
  const restarting = restarts.value;

  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: SAVE,
      variables: {
        serverId: props.server.id,
        mapRotation: dirtyPayload(rotation.value),
        plugins: dirtyPayload(plugins.value),
        access: dirtyPayload(access.value),
      },
    });

    toast({
      title: t(
        !restarting
          ? "pages.dedicated_servers.detail.settings.saved_live"
          : props.server.enabled
            ? "pages.dedicated_servers.detail.settings.saved_restart"
            : "pages.dedicated_servers.detail.settings.saved_disabled",
      ),
    });

    await Promise.all(sections.value.map((section) => section.saved()));
  } finally {
    submitting.value = false;
  }
}

function discard() {
  for (const section of sections.value) {
    section.reset();
  }
}
</script>

<template>
  <section class="grid gap-4">
    <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside class="shrink-0">
        <div class="lg:hidden">
          <Select v-model="mobileTab">
            <SelectTrigger
              class="w-full"
              :aria-label="
                $t('pages.dedicated_servers.detail.settings.select_section')
              "
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tab in tabs" :key="tab.key" :value="tab.key">
                {{ tab.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SettingsSideTabs
          :groups="tabGroups"
          :active-path="tabPath(activeTab)"
          :aria-label="$t('pages.dedicated_servers.detail.settings.title')"
        />
      </aside>

      <!-- Every section stays mounted, so an edit survives switching tabs and
           one save sends all of them. Locked while saving so nothing typed
           mid-save is marked saved without having been sent. -->
      <div
        class="min-w-0 max-w-3xl flex-1"
        :inert="submitting || undefined"
        :aria-busy="submitting"
      >
        <ServerMapRotation
          v-if="hasPod"
          v-show="activeTab === 'rotation'"
          ref="rotation"
          :server-id="server.id"
        />
        <ServerPlugins
          v-if="hasPod"
          v-show="activeTab === 'plugins'"
          ref="plugins"
          :server-id="server.id"
        />
        <ServerAccess
          v-show="activeTab === 'access'"
          ref="access"
          :server-id="server.id"
        />
        <ServerPlayerManagementPlugin
          v-if="activeTab === 'player-management'"
          :server-id="server.id"
          :game-server-node-id="server.game_server_node_id"
          :api-password="apiPassword"
          :plugin-runtime="server.plugin_runtime"
        />
      </div>
    </div>

    <SettingsSaveBar
      :dirty="changes.length > 0"
      :submitting="submitting"
      :description="summary"
      :action-label="
        restarts
          ? $t('pages.dedicated_servers.detail.save_restart')
          : $t('pages.dedicated_servers.detail.settings.save')
      "
      @save="save"
      @discard="discard"
    />
  </section>
</template>
