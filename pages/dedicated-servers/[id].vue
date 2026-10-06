<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-vue-next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { ref, computed } from "vue";
import { useNow } from "@vueuse/core";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServerPlayerManagement from "~/components/servers/ServerPlayerManagement.vue";
import ServerRecentPlayers from "~/components/servers/ServerRecentPlayers.vue";
import ServerSettings from "~/components/servers/ServerSettings.vue";
import ServerCommunityOverview from "~/components/servers/ServerCommunityOverview.vue";
import PublicServerView from "~/components/servers/PublicServerView.vue";
import ServerMoveDialog from "~/components/servers/ServerMoveDialog.vue";
import ServerMigrationPanel from "~/components/servers/ServerMigrationPanel.vue";
import { useServerMigration } from "~/composables/useServerMigration";
import { ACTIVE_SERVER_MIGRATION_STATUSES } from "~/types/serverMigration";
import { Eye, EyeOff } from "lucide-vue-next";
import Clipboard from "~/components/ClipBoard.vue";
import ServerStatus from "~/components/servers/ServerStatus.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import {
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

const { openFiles } = useFilePopout();

// Any other query change remounts the page (utilities/pageKey.ts).
definePageMeta({ persistQueryKeys: ["settings"] });

const authStore = useAuthStore();
// Everyone else gets the public view, which only finds a server the public
// can see.
const canManage = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.moderator),
);
const isManager = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.match_organizer),
);
const isAdmin = computed(() => authStore.isAdmin);

const moveDialog = ref(false);
const dismissedMigrationId = ref<string | null>(null);

const route = useRoute();
const {
  server: migratingServer,
  node: serverNode,
  migration,
  isMigrating,
  sourceReachable,
} = useServerMigration(
  computed(() => route.params.id as string),
  isAdmin,
);

const MIGRATION_SHOWN_FOR_MS = 15 * 60 * 1000;
const now = useNow({ interval: 30_000 });

const visibleMigration = computed(() => {
  const latest = migration.value;

  if (!latest) {
    return null;
  }

  if (ACTIVE_SERVER_MIGRATION_STATUSES.includes(latest.status)) {
    return latest;
  }

  if (
    latest.id === dismissedMigrationId.value ||
    !latest.finished_at ||
    now.value.getTime() - new Date(latest.finished_at).getTime() >
      MIGRATION_SHOWN_FOR_MS
  ) {
    return null;
  }

  return latest;
});

const heroClasses =
  "relative min-w-0 max-w-full px-6 pt-5 pb-6 max-sm:p-4 border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const statusBaseClasses =
  "inline-flex items-center gap-2 px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase border rounded";

const statusTierClasses: Record<string, string> = {
  connected:
    "bg-[hsl(var(--success)/0.15)] border-[hsl(var(--success)/0.5)] text-success",
  warning:
    "bg-[hsl(var(--tac-amber)/0.12)] border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]",
  disconnected:
    "bg-[hsl(var(--destructive)/0.15)] border-[hsl(var(--destructive)/0.6)] text-destructive",
};

const chipClasses =
  "inline-flex items-center px-[0.7rem] py-[0.25rem] font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none rounded border border-border/70 bg-muted/35 text-muted-foreground";

const tabCountClasses =
  "inline-flex h-4 min-w-[1.1rem] items-center justify-center rounded-sm px-1 font-sans text-[0.6rem] font-bold leading-none tracking-normal tabular-nums";

const titleClasses =
  "relative m-0 font-sans font-bold [font-stretch:80%] text-[clamp(1.5rem,3.5vw,2.5rem)] leading-[0.95] tracking-[0.02em] uppercase break-words bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent";
</script>
<template>
  <template v-if="canManage">
    <PageTransition :delay="0">
      <header v-if="server" :class="heroClasses">
        <div class="flex items-center gap-3 flex-wrap mb-5 max-sm:mb-4">
          <span :class="[statusBaseClasses, statusTierClasses[statusTier]]">
            <ServerStatus :server="server" />
            {{ statusLabel }}
          </span>

          <span :class="chipClasses">{{ server.region }}</span>
          <span v-if="server.type" :class="chipClasses">{{ server.type }}</span>
          <span
            v-if="server.plugin_version || pluginVersionMismatch"
            :class="[
              chipClasses,
              'gap-1 normal-case tracking-[0.06em]',
              pluginVersionMismatch &&
                'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]',
            ]"
            :title="$t('common.plugin_version')"
          >
            {{
              server.plugin_version
                ? `v${server.plugin_version}`
                : $t("pages.dedicated_servers.detail.plugin_version_unknown")
            }}
            <template v-if="pluginVersionMismatch && currentPluginVersion">
              <span aria-hidden="true">&rarr;</span>
              <a
                :href="pluginReleaseLink"
                target="_blank"
                rel="noopener"
                class="underline underline-offset-2 hover:text-foreground"
              >
                v{{ currentPluginVersion }}
              </a>
            </template>
          </span>
          <span v-if="isAdmin && serverNode" :class="chipClasses">
            {{ serverNode.label || serverNode.id }}
          </span>

          <div v-if="isManager" class="inline-flex items-center gap-2 ml-auto">
            <div class="inline-flex items-center gap-2 mr-1 max-sm:hidden">
              <Switch
                :model-value="server.enabled"
                :disabled="isMigrating"
                @click="toggleServerEnabled"
              />
              <Label
                class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ $t("pages.dedicated_servers.detail.enabled") }}
              </Label>
            </div>

            <TooltipProvider v-if="isAdmin && server?.game_server_node_id">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="outline"
                    size="icon"
                    :disabled="isMigrating"
                    :aria-label="$t('pages.dedicated_servers.detail.files')"
                    @click="openFiles({ scope: 'server', id: server.id })"
                  >
                    <FolderOpen class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ $t("pages.dedicated_servers.detail.files") }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div class="flex flex-col gap-[0.4rem] min-w-0">
          <span
            class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
          >
            {{ $t("pages.dedicated_servers.detail.eyebrow") }}
          </span>
          <h1 :class="titleClasses">{{ server.label }}</h1>
          <div
            class="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[0.8rem] tracking-[0.05em] text-muted-foreground"
          >
            <span class="min-w-0 truncate">
              {{ shownAddress }}
            </span>
            <QuickServerConnect
              v-if="server.connection_string"
              :server="server"
              highlight
            />
            <Clipboard v-else :data="shownAddress" />
          </div>
        </div>

        <div
          v-if="isManager"
          class="sm:hidden mt-4 pt-4 border-t border-border flex items-center justify-between"
        >
          <Label
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.dedicated_servers.detail.enabled") }}
          </Label>
          <Switch
            :model-value="server.enabled"
            :disabled="isMigrating"
            @click="toggleServerEnabled"
          />
        </div>

      </header>
    </PageTransition>

    <PageTransition
      v-if="server && isAdmin && visibleMigration"
      :delay="50"
      class="mt-6"
    >
      <ServerMigrationPanel
        :server-id="server.id"
        :migration="visibleMigration"
        @dismiss="dismissedMigrationId = visibleMigration.id"
      />
    </PageTransition>

    <PageTransition v-if="server" :delay="100" class="mt-4">
      <Tabs v-model="activeTab" :scroll-floor="false">
        <div
          class="sticky top-0 z-20 -mx-1 bg-background/85 px-1 py-2 backdrop-blur-sm"
        >
          <TabsList
            variant="underline"
            :class="[
              tacticalTabsListClasses,
              'h-auto max-w-full justify-start overflow-x-auto',
            ]"
          >
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.key"
              :value="tab.key"
              :class="tacticalTabsTriggerClasses"
            >
              {{ tab.label }}
              <span
                v-if="tab.key === 'players' && rosterStatus"
                :class="[
                  tabCountClasses,
                  rosterStatus.count
                    ? 'bg-[hsl(var(--tac-amber))] text-black'
                    : 'bg-muted text-muted-foreground',
                ]"
                data-testid="players-tab-count"
              >
                {{ rosterStatus.count }}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          v-if="isCommunityServer"
          value="overview"
          force-mount
          class="mt-4 data-[state=inactive]:hidden"
        >
          <ServerCommunityOverview
            :server-id="server.id"
            :label="server.label"
            :max-players="server.max_players"
          />
        </TabsContent>

        <TabsContent
          value="players"
          force-mount
          class="mt-4 grid gap-8 data-[state=inactive]:hidden"
        >
          <ServerPlayerManagement
            :server-id="server.id"
            :game-server-node-id="server.game_server_node_id"
            :max-players="server.max_players"
            :online="rconOnline"
            @roster-change="rosterRevision++"
            @status="rosterStatus = $event"
          />
          <ServerRecentPlayers
            v-if="isCommunityServer"
            :server-id="server.id"
            :roster-revision="rosterRevision"
          />
        </TabsContent>

        <TabsContent
          value="console"
          force-mount
          class="mt-4 data-[state=inactive]:hidden"
        >
          <RconCommander
            :server-id="server.id"
            :online="rconOnline"
            :plugin-runtime="server.plugin_runtime"
          />
        </TabsContent>

        <TabsContent
          v-if="showsLogs"
          value="logs"
          force-mount
          class="mt-4 data-[state=inactive]:hidden"
        >
          <ServiceLogs
            :service="`dedicated-server-${server.id}`"
            :compact="true"
          />
        </TabsContent>

        <TabsContent
          v-if="showsSettings"
          value="settings"
          force-mount
          class="mt-4 grid gap-8 data-[state=inactive]:hidden"
        >
          <div
            v-if="showsPluginConfig"
            class="rounded-lg border border-border bg-muted/30 p-4"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ $t("pages.dedicated_servers.detail.server_plugin_config") }}
              </h3>
              <Button variant="ghost" size="sm" @click="showConfig = !showConfig">
                <Eye v-if="!showConfig" class="mr-2 h-4 w-4" />
                <EyeOff v-else class="mr-2 h-4 w-4" />
                {{
                  showConfig
                    ? $t("pages.dedicated_servers.detail.hide_config")
                    : $t("pages.dedicated_servers.detail.show_config")
                }}
              </Button>
            </div>

            <Tabs v-model="configRuntime" :scroll-floor="false" class="mt-3">
              <TabsList>
                <TabsTrigger value="swiftlys2">SwiftlyS2</TabsTrigger>
                <TabsTrigger value="counterstrikesharp">
                  CounterStrikeSharp
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <p class="mt-2 text-sm text-muted-foreground">
              {{ $t("pages.dedicated_servers.detail.config_location") }}
              <code class="rounded bg-secondary px-1.5 py-0.5 text-xs">
                {{ configPath }}
              </code>
              <Clipboard :data="configPath" />
            </p>

            <div v-if="showConfig" class="relative mt-3">
              <pre
                class="bg-secondary p-4 rounded-lg text-sm font-mono whitespace-pre-wrap w-full"
                >{{ config }}</pre
              >
              <div class="absolute top-2 right-2">
                <Clipboard :data="config"></Clipboard>
              </div>
            </div>
          </div>

          <!-- csgo servers load no framework plugins, so only a community CS2
               server gets the rotation, plugin and access sections. -->
          <ServerSettings
            :server="server"
            :api-password="apiPassword"
            :community="hasServerSettings"
            :can-move="!!migratingServer?.game_server_node_id && !isMigrating"
            :locked="isMigrating"
            @move="moveDialog = true"
            @delete="deleteServerAlertDialog = true"
          />
        </TabsContent>
      </Tabs>
    </PageTransition>


    <ServerMoveDialog
      v-if="isAdmin"
      v-model:open="moveDialog"
      :server="migratingServer"
      :server-label="server?.label ?? ''"
      :source-reachable="sourceReachable"
    />

    <AlertDialog
      :open="deleteServerAlertDialog"
      @update:open="(open) => (deleteServerAlertDialog = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("pages.dedicated_servers.detail.delete_confirm.title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.dedicated_servers.detail.delete_confirm.description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="deleteServer">{{
            $t("pages.dedicated_servers.detail.delete_confirm.continue")
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </template>
  <PublicServerView v-else :server-id="(route.params.id as string)" />
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { useAuthStore } from "~/stores/AuthStore";
import { getQueryString } from "~/composables/useRouteTab";
import { connectAddress } from "~/utilities/connectAddress";
import { effectivePluginRuntime } from "~/constants/rconCommands";
import { pluginReleaseUrl } from "~/constants/gameServerReleases";
import type { ServerRosterStatus } from "~/types/serverOverview";

// Literals, not the generated enum: a type added by a migration is absent
// from ~/generated/zeus until codegen has run against a migrated database.
const SERVER_TYPE_RANKED = "Ranked";
const SERVER_TYPE_PRACTICE = "Practice";

export default {
  apollo: {
    apiPassword: {
      query: generateQuery({
        servers_by_pk: [
          {
            id: $("serverId", "uuid!"),
          },
          {
            api_password: true,
          },
        ],
      }),
      variables: function () {
        return {
          serverId: this.$route.params.id,
        };
      },
      skip: function () {
        return !useAuthStore().isAdmin;
      },
      update: function (data: any) {
        return data.servers_by_pk?.api_password;
      },
    },
    $subscribe: {
      server: {
        query: generateSubscription({
          servers_by_pk: [
            {
              id: $("serverId", "uuid!"),
            },
            {
              type: true,
              game: true,
              id: true,
              host: true,
              region: true,
              port: true,
              label: true,
              tv_port: true,
              enabled: true,
              connected: true,
              plugin_version: true,
              plugin_runtime: true,
              rcon_status: true,
              game_server_node_id: true,
              game_mode_id: true,
              connection_link: true,
              connection_string: true,
              offline_at: true,
              max_players: true,
            },
          ],
        }),
        variables: function () {
          return {
            serverId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.server = data.servers_by_pk;
        },
        // Most of these columns are staff-only, and the public view runs its
        // own subscription.
        skip: function () {
          return !useAuthStore().isRoleAbove(e_player_roles_enum.moderator);
        },
      },
    },
  },
  data() {
    return {
      server: undefined,
      apiPassword: undefined,
      showConfig: false,
      selectedConfigRuntime: null as string | null,
      deleteServerAlertDialog: false,
      rosterRevision: 0,
      rosterStatus: null as ServerRosterStatus | null,
    };
  },
  computed: {
    // Not named connectAddress: an import in this block is a template binding
    // too, and it wins over a computed of the same name.
    shownAddress(): string {
      return connectAddress(
        this.server?.connection_string,
        this.server?.host,
        this.server?.port,
      );
    },
    showsLogs() {
      return (
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer) &&
        !!this.server?.game_server_node_id
      );
    },
    // Editing and deleting a server are administrator-only in Hasura, so the
    // tab that holds them is too.
    showsSettings() {
      return useAuthStore().isAdmin;
    },
    tabs() {
      return [
        ...(this.isCommunityServer
          ? [
              {
                key: "overview",
                label: this.$t("pages.dedicated_servers.detail.tabs.overview"),
              },
            ]
          : []),
        {
          key: "players",
          label: this.$t("pages.dedicated_servers.detail.tabs.players"),
        },
        {
          key: "console",
          label: this.$t("pages.dedicated_servers.detail.tabs.console"),
        },
        ...(this.showsLogs
          ? [
              {
                key: "logs",
                label: this.$t("pages.dedicated_servers.detail.tabs.logs"),
              },
            ]
          : []),
        ...(this.showsSettings
          ? [
              {
                key: "settings",
                label: this.$t("pages.dedicated_servers.detail.tabs.settings"),
              },
            ]
          : []),
      ];
    },
    // A public server opens on the same stats the public sees.
    defaultTab() {
      return this.isCommunityServer ? "overview" : "players";
    },
    // A settings deep link (?settings=plugins) predates the tabs, so it still
    // opens the Settings tab without a ?tab.
    activeTab: {
      get(): string {
        const query = this.$route.query;
        const requested =
          getQueryString(query, "tab") ??
          (getQueryString(query, "settings") ? "settings" : null);

        return this.tabs.some((tab) => tab.key === requested)
          ? (requested as string)
          : this.defaultTab;
      },
      set(tab: string) {
        const query = { ...this.$route.query };

        if (tab === this.defaultTab) {
          delete query.tab;
        } else {
          query.tab = tab;
        }

        if (tab !== "settings") {
          delete query.settings;
        }

        void this.$router.replace({ query });
      },
    },
    currentPluginVersion() {
      return useApplicationSettingsStore().currentPluginVersion;
    },
    pluginReleaseLink() {
      return pluginReleaseUrl(
        effectivePluginRuntime(
          this.server?.plugin_runtime,
          useApplicationSettingsStore().gameServerPluginRuntime,
        ),
        this.currentPluginVersion,
      );
    },
    pluginVersionMismatch() {
      if (!this.server || this.server.type !== "Ranked") {
        return false;
      }

      const applicationSettings = useApplicationSettingsStore();

      // A server on another framework is waiting to be recycled onto the
      // selected runtime; its version is from a lineage we can't compare against.
      if (
        this.server.plugin_runtime &&
        this.server.plugin_runtime !==
          applicationSettings.gameServerPluginRuntime
      ) {
        return false;
      }

      return (
        this.server.plugin_version != applicationSettings.currentPluginVersion
      );
    },
    rconOnline() {
      return !!(this.server?.connected && this.server?.rcon_status);
    },
    statusTier() {
      if (!this.server?.connected) {
        return "disconnected";
      }
      if (!this.server.rcon_status || this.pluginVersionMismatch) {
        return "warning";
      }
      return "connected";
    },
    statusLabel() {
      if (!this.server?.connected) {
        return this.$t(
          "pages.dedicated_servers.detail.status_label.disconnected",
        );
      }
      if (!this.server.rcon_status) {
        return this.$t("pages.dedicated_servers.detail.status_label.no_rcon");
      }
      if (this.pluginVersionMismatch) {
        return this.$t(
          "pages.dedicated_servers.detail.status_label.version_mismatch",
        );
      }
      return this.$t("pages.dedicated_servers.detail.status_label.connected");
    },
    configRuntime: {
      get(): string {
        return (
          this.selectedConfigRuntime ||
          this.server?.plugin_runtime ||
          useApplicationSettingsStore().gameServerPluginRuntime
        );
      },
      set(runtime: string) {
        this.selectedConfigRuntime = runtime;
      },
    },
    // A practice server runs the utility practice plugin instead of the match
    // plugin, so it needs its credentials too -- and they go somewhere else.
    showsPluginConfig() {
      return (
        this.server?.type === SERVER_TYPE_RANKED ||
        this.server?.type === SERVER_TYPE_PRACTICE
      );
    },
    // Ranked and Practice servers run 5Stack's own plugin set; an external
    // server still gets access, the console hides what needs a pod.
    hasServerSettings() {
      return (
        this.server?.game === "cs2" &&
        this.server.type !== SERVER_TYPE_RANKED &&
        this.server.type !== SERVER_TYPE_PRACTICE
      );
    },
    isPracticeServer() {
      return this.server?.type === SERVER_TYPE_PRACTICE;
    },
    // Only community servers report players through the Player Management
    // plugin, so only they have a session history to show.
    isCommunityServer() {
      return (
        !!this.server &&
        this.server.game !== "csgo" &&
        this.server.type !== SERVER_TYPE_RANKED &&
        this.server.type !== SERVER_TYPE_PRACTICE
      );
    },
    configPath() {
      const runtime =
        this.configRuntime === "counterstrikesharp"
          ? "counterstrikesharp"
          : "swiftlys2";

      if (this.isPracticeServer) {
        return `addons/${runtime}/configs/utility-practice.json`;
      }

      if (runtime === "counterstrikesharp") {
        return "addons/counterstrikesharp/configs/plugins/FiveStack/FiveStack.json";
      }
      return "addons/swiftlys2/configs/plugins/FiveStack/config.jsonc";
    },
    config() {
      if (this.isPracticeServer) {
        // Flat, and the same file for both runtimes -- the practice plugin
        // reads one shape. Env vars of the same names win over it.
        return JSON.stringify(
          {
            utility_url: `https://${useRuntimeConfig().public.apiDomain}`,
            server_id: this.server.id,
            server_api_password: this.apiPassword,
          },
          null,
          2,
        );
      }

      const settings = {
        WS_DOMAIN: `wss://${useRuntimeConfig().public.wsDomain}`,
        API_DOMAIN: `https://${useRuntimeConfig().public.apiDomain}`,
        RELAY_DOMAIN: `https://${useRuntimeConfig().public.relayDomain}`,
        DEMOS_DOMAIN: `https://${useRuntimeConfig().public.demosDomain}`,
        SERVER_ID: this.server.id,
        SERVER_API_PASSWORD: this.apiPassword,
      };

      // SwiftlyS2 binds the "FiveStack" section of config.jsonc, while
      // CounterStrikeSharp loads FiveStack.json as a flat object.
      return JSON.stringify(
        this.configRuntime === "counterstrikesharp"
          ? settings
          : { FiveStack: settings },
        null,
        2,
      );
    },
  },
  methods: {
    async toggleServerEnabled() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_servers_by_pk: [
            {
              pk_columns: {
                id: this.server.id,
              },
              _set: {
                enabled: !this.server.enabled,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async deleteServer() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          delete_servers_by_pk: [
            {
              id: this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      if (!data?.delete_servers_by_pk) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: this.$t(
            "pages.dedicated_servers.detail.migration.locked",
          ),
        });
        return;
      }

      this.$router.push("/dedicated-servers");
    },
  },
};
</script>
