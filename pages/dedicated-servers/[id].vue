<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  TriangleAlert,
} from "lucide-vue-next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ref, computed, onBeforeUnmount } from "vue";
import { useNow } from "@vueuse/core";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServerPlayerManagement from "~/components/servers/ServerPlayerManagement.vue";
import ServerRecentPlayers from "~/components/servers/ServerRecentPlayers.vue";
import ServerSettings from "~/components/servers/ServerSettings.vue";
import ServerCommunityOverview from "~/components/servers/ServerCommunityOverview.vue";
import PublicServerView from "~/components/servers/PublicServerView.vue";
import ServerMoveDialog from "~/components/servers/ServerMoveDialog.vue";
import ServerMigrationPanel from "~/components/servers/ServerMigrationPanel.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import LastChangedFor from "~/components/admin/LastChangedFor.vue";
import { useServerMigration } from "~/composables/useServerMigration";
import { ACTIVE_SERVER_MIGRATION_STATUSES } from "~/types/serverMigration";
import Clipboard from "~/components/ClipBoard.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Fold } from "~/components/ui/transitions";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

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

// A launched Steam link takes a few seconds to hand over; the button holds
// its spinner meanwhile, as QuickServerConnect does.
const joining = ref(false);
let joinTimer: ReturnType<typeof setTimeout> | null = null;
function onJoin() {
  joining.value = true;
  if (joinTimer) clearTimeout(joinTimer);
  joinTimer = setTimeout(() => (joining.value = false), 10_000);
}
onBeforeUnmount(() => {
  if (joinTimer) clearTimeout(joinTimer);
});

const toneText: Record<string, string> = {
  ok: "text-foreground",
  warn: "text-warning",
  bad: "text-destructive",
  off: "text-muted-foreground",
  info: "text-info",
};

const chipClasses =
  "inline-flex h-5 max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 text-[0.7rem] font-medium text-muted-foreground";

const runtimeOptions = [
  { key: "swiftlys2", label: "SwiftlyS2" },
  { key: "counterstrikesharp", label: "CounterStrikeSharp" },
];
</script>

<template>
  <template v-if="canManage">
    <PageTransition :delay="0">
      <header v-if="server" class="grid min-w-0 gap-1.5">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div class="flex min-w-[min(100%,14rem)] flex-1 items-center gap-2.5">
            <StatusDot
              :tone="status.tone"
              :live="status.live"
              :label="statusTip"
              side="bottom"
            />
            <h1
              class="min-w-0 truncate text-xl font-semibold leading-tight tracking-tight"
            >
              {{ server.label }}
            </h1>
          </div>

          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span
              class="inline-flex min-w-0 items-center gap-0.5 font-mono text-xs text-muted-foreground"
            >
              <span class="min-w-0 truncate">{{ shownAddress }}</span>
              <Clipboard
                :data="server.connection_string || shownAddress"
                class="h-8 w-8 shrink-0 border-transparent bg-transparent shadow-none hover:bg-muted [&_svg]:size-3.5"
                :aria-label="$t('pages.dedicated_servers.copy_address')"
              />
            </span>
            <Button
              v-if="server.connection_string && server.connection_link"
              as="a"
              :href="server.connection_link"
              size="sm"
              variant="outline"
              class="srv-primary"
              :loading="joining"
              data-testid="join-server"
              @click="onJoin"
            >
              <ExternalLink class="size-3.5" />
              {{ $t("pages.dedicated_servers.join_server") }}
            </Button>

            <template v-if="isManager">
              <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              <div class="inline-flex h-8 items-center gap-2">
                <Switch
                  id="server-enabled"
                  :model-value="server.enabled"
                  :disabled="isMigrating"
                  @click="toggleServerEnabled"
                />
                <Label
                  for="server-enabled"
                  class="text-xs font-normal text-muted-foreground"
                >
                  {{ $t("pages.dedicated_servers.detail.enabled") }}
                </Label>
              </div>
            </template>

            <FiveStackToolTip
              v-if="isManager && isAdmin && server.game_server_node_id"
              as-child
              :delay-duration="300"
              side="bottom"
            >
              <template #trigger>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="shrink-0 text-muted-foreground"
                  :disabled="isMigrating"
                  :aria-label="$t('pages.dedicated_servers.detail.files')"
                  @click="openFiles({ scope: 'server', id: server.id })"
                >
                  <FolderOpen class="size-4" />
                </Button>
              </template>
              {{ $t("pages.dedicated_servers.detail.files") }}
            </FiveStackToolTip>
          </div>
        </div>

        <div
          class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 pl-[1.125rem] text-xs text-muted-foreground"
        >
          <span
            class="inline-flex items-center whitespace-nowrap"
            :class="toneText[status.tone]"
          >
            {{ statusWord }}
          </span>
          <span v-if="statusSub" class="whitespace-nowrap tabular-nums">
            · {{ statusSub }}
          </span>
          <span aria-hidden="true" class="text-muted-foreground/50">·</span>
          <span :class="chipClasses" :title="$t('common.region')">{{
            server.region
          }}</span>
          <span v-if="server.type" :class="chipClasses">{{ typeLabel }}</span>
          <FiveStackToolTip
            v-if="pluginVersionMismatch"
            as-child
            :delay-duration="300"
          >
            <template #trigger>
              <span
                :class="chipClasses"
                class="border-warning/40 font-mono tabular-nums text-warning"
                tabindex="0"
              >
                <TriangleAlert class="size-3 shrink-0" />
                {{
                  server.plugin_version
                    ? $t("pages.dedicated_servers.detail.plugin_tag", {
                        version: server.plugin_version,
                      })
                    : $t(
                        "pages.dedicated_servers.detail.plugin_version_unknown",
                      )
                }}
                <template v-if="currentPluginVersion">
                  <span aria-hidden="true">&rarr;</span>
                  <a
                    :href="pluginReleaseLink"
                    target="_blank"
                    rel="noopener"
                    class="underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    v{{ currentPluginVersion }}
                  </a>
                </template>
              </span>
            </template>
            {{
              $t("pages.dedicated_servers.plugin_outdated_tip", {
                version: currentPluginVersion,
              })
            }}
          </FiveStackToolTip>
          <span
            v-else-if="server.plugin_version"
            :class="chipClasses"
            class="font-mono tabular-nums"
          >
            {{
              $t("pages.dedicated_servers.detail.plugin_tag", {
                version: server.plugin_version,
              })
            }}
          </span>
          <NuxtLink
            v-if="isAdmin && serverNode"
            to="/game-server-nodes"
            :class="chipClasses"
            class="font-mono transition-colors duration-150 hover:text-foreground"
            :title="$t('pages.dedicated_servers.open_node')"
          >
            <span class="truncate">{{
              serverNode.label || serverNode.id
            }}</span>
          </NuxtLink>
          <LastChangedFor type="servers" :row="server" dot />
        </div>
      </header>
    </PageTransition>

    <PageTransition
      v-if="server && isAdmin && visibleMigration"
      :delay="50"
      class="mt-5"
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
          class="sticky top-0 z-20 -mx-1 bg-background/90 px-1 backdrop-blur-sm"
        >
          <div class="overflow-x-auto border-b border-border/60">
            <TabsList
              variant="underline"
              class="h-auto flex-nowrap justify-start"
            >
              <TabsTrigger
                v-for="tab in tabs"
                :key="tab.key"
                :value="tab.key"
                class="py-2"
              >
                {{ tab.label }}
                <span
                  v-if="tab.key === 'players' && rosterStatus"
                  class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold tabular-nums"
                  :class="
                    rosterStatus.count
                      ? 'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]'
                      : 'bg-muted text-muted-foreground'
                  "
                  data-testid="players-tab-count"
                >
                  {{ rosterStatus.count }}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <!-- Every panel stays mounted (the console keeps its history, the
             roster feeds the tab count and the header), so this pans them
             like SlideSwap does instead of swapping keyed views. -->
        <div class="srv-panels mt-5">
          <Transition v-if="isCommunityServer" :name="panName">
            <div v-show="activeTab === 'overview'">
              <TabsContent value="overview" force-mount class="mt-0">
                <ServerCommunityOverview
                  :server-id="server.id"
                  :label="server.label"
                  :max-players="server.max_players"
                />
              </TabsContent>
            </div>
          </Transition>

          <Transition :name="panName">
            <div v-show="activeTab === 'players'">
              <TabsContent value="players" force-mount class="mt-0 grid gap-8">
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
            </div>
          </Transition>

          <Transition :name="panName">
            <div v-show="activeTab === 'console'">
              <TabsContent value="console" force-mount class="mt-0">
                <RconCommander
                  :server-id="server.id"
                  :online="rconOnline"
                  :plugin-runtime="server.plugin_runtime"
                />
              </TabsContent>
            </div>
          </Transition>

          <Transition v-if="showsLogs" :name="panName">
            <div v-show="activeTab === 'logs'">
              <TabsContent value="logs" force-mount class="mt-0">
                <ServiceLogs
                  :service="`dedicated-server-${server.id}`"
                  :compact="true"
                />
              </TabsContent>
            </div>
          </Transition>

          <Transition v-if="showsSettings" :name="panName">
            <div v-show="activeTab === 'settings'">
              <TabsContent value="settings" force-mount class="mt-0">
                <ManageSection
                  v-if="showsPluginConfig"
                  :label="$t('pages.dedicated_servers.detail.plugin_config')"
                >
                  <template #action>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8"
                      :aria-expanded="showConfig"
                      @click="showConfig = !showConfig"
                    >
                      <EyeOff v-if="showConfig" class="size-3.5" />
                      <Eye v-else class="size-3.5" />
                      {{
                        showConfig
                          ? $t(
                              "pages.dedicated_servers.detail.hide_plugin_config",
                            )
                          : $t(
                              "pages.dedicated_servers.detail.show_plugin_config",
                            )
                      }}
                    </Button>
                  </template>

                  <div class="grid max-w-3xl gap-3">
                    <AnimatedFilters
                      v-model="configRuntime"
                      square
                      class="w-fit"
                      :options="runtimeOptions"
                    />
                    <p
                      class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
                    >
                      {{ $t("pages.dedicated_servers.detail.config_location") }}
                      <span class="inline-flex min-w-0 items-center gap-0.5">
                        <code
                          class="min-w-0 break-all rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground"
                          >{{ configPath }}</code
                        >
                        <Clipboard
                          :data="configPath"
                          class="h-7 w-7 shrink-0 border-transparent bg-transparent shadow-none hover:bg-muted [&_svg]:size-3.5"
                        />
                      </span>
                    </p>
                    <Fold :open="showConfig">
                      <div class="relative">
                        <pre
                          class="w-full whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-4 pr-12 font-mono text-xs leading-relaxed"
                          >{{ config }}</pre>
                        <Clipboard
                          :data="config"
                          class="absolute right-2 top-2 h-8 w-8 border-transparent bg-transparent shadow-none hover:bg-muted [&_svg]:size-3.5"
                        />
                      </div>
                    </Fold>
                  </div>
                </ManageSection>

                <!-- csgo servers load no framework plugins, so only a community CS2
                     server gets the rotation, plugin and access sections. -->
                <ServerSettings
                  class="tac-section-sep"
                  :server="server"
                  :api-password="apiPassword"
                  :community="hasServerSettings"
                  :can-move="
                    !!migratingServer?.game_server_node_id && !isMigrating
                  "
                  :locked="isMigrating"
                  @move="moveDialog = true"
                  @delete="deleteServerAlertDialog = true"
                />
              </TabsContent>
            </div>
          </Transition>
        </div>
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
            $t("pages.dedicated_servers.delete_title", {
              label: server?.label ?? "",
            })
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{
              server?.game_server_node_id
                ? $t("pages.dedicated_servers.delete_body_node", {
                    node: serverNode?.label || server.game_server_node_id,
                  })
                : $t("pages.dedicated_servers.delete_body_external")
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <!-- Plain button: AlertDialogAction closes before the mutation runs. -->
          <Button variant="destructive" @click="deleteServer">
            {{ $t("pages.dedicated_servers.delete_server") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </template>
  <PublicServerView v-else :server-id="route.params.id as string" />
</template>

<style scoped>
.srv-primary {
  flex: none;
  gap: 6px;
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}
.srv-primary:hover {
  background: hsl(var(--tac-amber) / 0.2);
  color: hsl(var(--tac-amber));
}
/* SlideSwap's pan on kept-mounted panels: the tab to the right brings its
   panel in from the right while the old one leaves left, as one strip. */
.srv-panels {
  display: grid;
  overflow-x: clip;
}
.srv-panels > * {
  grid-area: 1 / 1;
  min-width: 0;
}
.srv-pan-next-enter-active,
.srv-pan-next-leave-active,
.srv-pan-prev-enter-active,
.srv-pan-prev-leave-active {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.srv-pan-next-leave-active,
.srv-pan-prev-leave-active {
  pointer-events: none;
}
.srv-pan-next-enter-from,
.srv-pan-prev-leave-to {
  transform: translateX(100%);
}
.srv-pan-next-leave-to,
.srv-pan-prev-enter-from {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .srv-pan-next-enter-active,
  .srv-pan-next-leave-active,
  .srv-pan-prev-enter-active,
  .srv-pan-prev-leave-active {
    transition: none;
  }
}
</style>

<script lang="ts">
import { useServerContext } from "~/composables/useServerContext";
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
import { serverStatus, serverType } from "~/components/servers/serverFleet";

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
              hibernating: true,
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
          useServerContext().value = this.server
            ? { id: this.server.id, name: this.server.label || this.server.id }
            : null;
        },
        // Most of these columns are staff-only, and the public view runs its
        // own subscription.
        skip: function () {
          return !useAuthStore().isRoleAbove(e_player_roles_enum.moderator);
        },
      },
    },
  },
  unmounted() {
    useServerContext().value = null;
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
      panDirection: "next" as "next" | "prev",
    };
  },
  watch: {
    // Pre-flush, so the panels pan the way this change went.
    activeTab: {
      handler(next: string, previous: string) {
        const index = (key: string) =>
          this.tabs.findIndex((tab: { key: string }) => tab.key === key);
        this.panDirection = index(next) >= index(previous) ? "next" : "prev";
      },
      flush: "pre",
    },
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
    // The list row's status: players on it right now is the one live state
    // this page can see (the roster reports it).
    status() {
      const settings = useApplicationSettingsStore();
      return serverStatus(this.server, {
        currentPluginVersion: settings.currentPluginVersion,
        pluginRuntime: settings.gameServerPluginRuntime,
        players: this.rosterStatus
          ? new Map([[this.server?.id, this.rosterStatus.count]])
          : undefined,
        now: Date.now(),
      });
    },
    statusWord(): string {
      return this.$t(...(this.status.word as [string, any]));
    },
    statusTip(): string {
      return this.$t(...(this.status.tip as [string, any]));
    },
    statusSub(): string {
      return this.status.sub
        ? this.$t(...(this.status.sub as [string, any]))
        : "";
    },
    typeLabel(): string {
      return serverType(this.server);
    },
    panName(): string {
      return `srv-pan-${this.panDirection}`;
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
        this.deleteServerAlertDialog = false;
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
