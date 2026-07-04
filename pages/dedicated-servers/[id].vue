<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MoreVertical, Trash2, FolderOpen, Pencil } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
import { ref, computed } from "vue";
import ServerForm from "~/components/servers/ServerForm.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServerPlayerManagement from "~/components/servers/ServerPlayerManagement.vue";
import { Eye, EyeOff } from "lucide-vue-next";
import Clipboard from "~/components/ClipBoard.vue";
import ServerStatus from "~/components/servers/ServerStatus.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

definePageMeta({ middleware: "moderator" });

const authStore = useAuthStore();
const isManager = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.match_organizer),
);
const isAdmin = computed(() => authStore.isAdmin);

const serverMenu = ref(false);

const heroClasses =
  "relative min-w-0 max-w-full px-6 pt-5 pb-6 max-sm:p-4 border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)] before:content-[''] before:absolute before:w-[14px] before:h-[14px] before:border-[hsl(var(--tac-amber))] before:border-solid before:top-2 before:left-2 before:border-t-2 before:border-l-2 after:content-[''] after:absolute after:w-[14px] after:h-[14px] after:border-[hsl(var(--tac-amber))] after:border-solid after:bottom-2 after:right-2 after:border-b-2 after:border-r-2";

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

const titleClasses =
  "relative m-0 font-sans font-bold [font-stretch:80%] text-[clamp(1.5rem,3.5vw,2.5rem)] leading-[0.95] tracking-[0.02em] uppercase break-words bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent";
</script>
<template>
  <PageTransition :delay="0">
    <header v-if="server" :class="heroClasses">
      <!-- Status + meta chips + primary actions -->
      <div class="flex items-center gap-3 flex-wrap mb-5 max-sm:mb-4">
        <span :class="[statusBaseClasses, statusTierClasses[statusTier]]">
          <ServerStatus :server="server" />
          {{ statusLabel }}
        </span>

        <span :class="chipClasses">{{ server.region }}</span>
        <span v-if="server.type" :class="chipClasses">{{ server.type }}</span>

        <div class="inline-flex items-center gap-2 ml-auto">
          <div
            v-if="isManager"
            class="inline-flex items-center gap-2 mr-1 max-sm:hidden"
          >
            <Switch
              :model-value="server.enabled"
              @click="toggleServerEnabled"
            />
            <Label
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.dedicated_servers.detail.enabled") }}
            </Label>
          </div>

          <QuickServerConnect :server="server" highlight />

          <template v-if="isManager">
            <TooltipProvider v-if="server?.game_server_node_id">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="outline"
                    size="icon"
                    @click="
                      $router.push(`/dedicated-servers/${server.id}/files`)
                    "
                  >
                    <FolderOpen class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ $t("pages.dedicated_servers.detail.files") }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu v-model:open="serverMenu">
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="icon">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-[200px]">
                <DropdownMenuGroup>
                  <DropdownMenuItem @click="editServerSheet = true">
                    <Pencil />
                    {{ $t("common.actions.edit") }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="deleteServerAlertDialog = true"
                  >
                    <Trash2 />
                    {{ $t("common.delete") }}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </template>
        </div>
      </div>

      <!-- Title + address -->
      <div class="flex flex-col gap-[0.4rem] min-w-0">
        <span
          class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
        >
          {{ $t("pages.dedicated_servers.detail.eyebrow") }}
        </span>
        <h1 :class="titleClasses">{{ server.label }}</h1>
        <div
          class="flex items-center gap-2 font-mono text-[0.8rem] tracking-[0.05em] text-muted-foreground"
        >
          <span class="truncate">{{ server.host }}:{{ server.port }}</span>
          <Clipboard :data="`${server.host}:${server.port}`" />
        </div>
      </div>

      <!-- Enabled toggle (mobile, full-width row) -->
      <div
        v-if="isManager"
        class="sm:hidden mt-4 pt-4 border-t border-border flex items-center justify-between"
      >
        <Label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.dedicated_servers.detail.enabled") }}
        </Label>
        <Switch :model-value="server.enabled" @click="toggleServerEnabled" />
      </div>
    </header>
  </PageTransition>

  <PageTransition
    v-if="server && server.type === 'Ranked' && isAdmin"
    :delay="100"
    class="mt-6"
  >
    <div class="rounded-lg border border-border bg-muted/30 p-4">
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

      <p class="mt-2 text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.config_location") }}
        <code class="rounded bg-secondary px-1.5 py-0.5 text-xs">
          addons/counterstrikesharp/config/plugins/FiveStack/FiveStack.json
        </code>
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
  </PageTransition>

  <PageTransition :delay="150" class="mt-6">
    <ServerPlayerManagement
      v-if="server"
      :server-id="$route.params.id as string"
    />
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <RconCommander
      :server-id="$route.params.id as string"
      :online="rconOnline"
    />
  </PageTransition>

  <PageTransition
    v-if="isManager && server?.game_server_node_id"
    :delay="300"
    class="mt-8"
  >
    <div
      class="mb-3 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
    >
      <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
      {{ $t("ui.logs.title") }}
    </div>
    <ServiceLogs
      :service="`dedicated-server-${$route.params.id}`"
      :compact="true"
    />
  </PageTransition>

  <Sheet
    :open="editServerSheet"
    @update:open="(open) => (editServerSheet = open)"
  >
    <SheetContent class="flex flex-col gap-0 sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>{{ $t("common.actions.edit") }}</SheetTitle>
      </SheetHeader>
      <div class="-mx-4 mt-4 flex-1 overflow-y-auto px-4 py-1">
        <ServerForm :server="server" @updated="editServerSheet = false" />
      </div>
    </SheetContent>
  </Sheet>

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

<script lang="ts">
import { $ } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { useAuthStore } from "~/stores/AuthStore";

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
              rcon_status: true,
              game_server_node_id: true,
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
      },
    },
  },
  data() {
    return {
      server: undefined,
      apiPassword: undefined,
      showConfig: false,
      editServerSheet: false,
      deleteServerAlertDialog: false,
    };
  },
  computed: {
    pluginVersionMismatch() {
      if (!this.server || this.server.type !== "Ranked") {
        return false;
      }
      return (
        this.server.plugin_version !=
        useApplicationSettingsStore().currentPluginVersion
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
    config() {
      return `
{
  "WS_DOMAIN": "wss://${useRuntimeConfig().public.wsDomain}",
  "API_DOMAIN": "https://${useRuntimeConfig().public.apiDomain}",
  "RELAY_DOMAIN": "https://${useRuntimeConfig().public.relayDomain}",
  "DEMOS_DOMAIN": "https://${useRuntimeConfig().public.demosDomain}",
  "SERVER_ID": "${this.server.id}",
  "SERVER_API_PASSWORD": "${this.apiPassword}"
}
`;
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
      await this.$apollo.mutate({
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

      this.$router.push("/dedicated-servers");
    },
  },
};
</script>
