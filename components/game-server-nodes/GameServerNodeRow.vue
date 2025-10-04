<script lang="ts" setup>
import { Input } from "~/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import GameServerNodeDisplay from "~/components/game-server-nodes/GameServerNodeDisplay.vue";
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
import {
  ExternalLink,
  Trash2,
  RefreshCw,
  Pencil,
  Activity,
  Cpu,
  CircleFadingArrowUp,
  AlertCircle,
  Plus,
} from "lucide-vue-next";
import UpdateGameServerLabel from "~/components/game-server-nodes/UpdateGameServerLabel.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
import NodeMetrics from "@/components/system-metrics/NodeMetrics.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { AlertTriangle } from "lucide-vue-next";
</script>

<template>
  <TableRow class="border-b-0">
    <TableCell>
      <GameServerNodeDisplay
        :game-server-node="gameServerNode"
      ></GameServerNodeDisplay>
    </TableCell>
    <TableCell>
      <template v-if="gameServerNode.supports_low_latency">
        <Activity class="h-4 w-4" />
      </template>
    </TableCell>
    <TableCell>
      <template v-if="gameServerNode.supports_cpu_pinning">
        <Cpu class="h-4 w-4" />
      </template>
    </TableCell>
    <TableCell class="flex items-center gap-2">
      <FiveStackToolTip>
        <template #trigger>
          <Badge class="flex items-center gap-2" variant="outline">
            <AlertTriangle
              class="h-3 w-3"
              v-if="
                gameServerNode.cpu_governor_info.governor !== 'unknown' &&
                gameServerNode.cpu_governor_info.governor !== 'performance'
              "
            />
            <span class="capitalize">
              {{ gameServerNode.cpu_governor_info.governor }}
            </span>
          </Badge>
        </template>
        <div
          v-for="(governor, core) of gameServerNode.cpu_governor_info.cpus"
          :key="governor"
        >
          Core #{{ core }} {{ governor }}
        </div>
      </FiveStackToolTip>
    </TableCell>
    <TableCell>
      <template v-if="gameServerNode.update_status">
        <FiveStackToolTip>
          <template #trigger>
            <div class="flex items-center gap-1">
              <span class="capitalize">
                {{ gameServerNode.update_status }}
              </span>
              <Button variant="outline" size="sm" @click="toggleLogs">
                <Activity class="h-2 w-2" />
              </Button>
            </div>
          </template>
          {{ $t("game_server.show_update_logs") }}
        </FiveStackToolTip>
      </template>

      <div class="flex items-center gap-2" v-else>
        <div v-if="nodeBuildVersion">
          {{ nodeBuildVersion?.version }} ({{ nodeBuildVersion?.build_id }})
        </div>

        <template v-if="gameServerNode.build_id">
          <template
            v-if="
              (gameServerNode.pin_build_id &&
                gameServerNode.pin_build_id != gameServerNode?.build_id) ||
              (!gameServerNode.pin_build_id &&
                gameServerNode.build_id != currentGameVersion?.build_id)
            "
          >
            <FiveStackToolTip>
              {{ $t("game_server.update_cs") }}
              <template #trigger>
                <Button
                  variant="destructive"
                  size="icon"
                  @click="updateCs"
                  :disabled="
                    gameServerNode.status !==
                    e_game_server_node_statuses_enum.Online
                  "
                >
                  <CircleFadingArrowUp class="h-4 w-4" />
                </Button>
              </template>
            </FiveStackToolTip>
          </template>
        </template>
        <template v-else>
          <Button
            size="sm"
            @click="updateCs"
            :disabled="
              gameServerNode.status !== e_game_server_node_statuses_enum.Online
            "
            >{{ $t("game_server.install_cs") }}</Button
          >
        </template>
      </div>
    </TableCell>
    <TableCell>
      <div class="flex items-center gap-2 w-full">
        <FiveStackToolTip v-if="!supportsGameServerVersionPinning">
          <span>
            {{ $t("game_server.version_pinning_not_supported") }}
          </span>
          <template #trigger>
            <a
              href="https://docs.5stack.gg/servers/game-server-nodes/version-pinning"
              target="_blank"
              class="text-warning"
            >
              <ExternalLink class="h-4 w-4" />
            </a>
          </template>
        </FiveStackToolTip>

        <Select
          :model-value="pinBuildIdForm.values.pin_build_id"
          @update:model-value="(value) => pinBuildId(value)"
          v-slot="{ open }"
          :disabled="!supportsGameServerVersionPinning"
        >
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="$t('game_server.pin_build_id')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="null">
                <div class="flex flex-col gap-1">
                  <div>
                    {{ $t("game_server.unpin_build_id") }}
                  </div>
                </div>
              </SelectItem>
              <SelectItem
                :value="version.build_id"
                v-for="version of gameVersions"
              >
                <div class="flex flex-col gap-1">
                  <div>{{ version.version }} ({{ version.build_id }})</div>
                  <div class="text-xs text-muted-foreground" v-if="open">
                    {{ new Date(version.updated_at).toLocaleString() }}
                  </div>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </TableCell>
    <TableCell class="flex">
      <div class="flex items-center gap-2 w-full">
        <Select
          :model-value="pinPluginVersionForm.values.pin_plugin_version"
          @update:model-value="(value) => pinPluginVersion(value)"
          v-slot="{ open }"
        >
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="$t('game_server.pin_plugin_version')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="null">
                <div class="flex flex-col gap-1">
                  <div>
                    {{ $t("game_server.unpin_plugin_version") }}
                  </div>
                </div>
              </SelectItem>
              <SelectItem
                :value="version.version"
                v-for="version of pluginVersions"
                :key="version.version"
              >
                <div class="flex flex-col gap-1">
                  <div>{{ version.version }}</div>
                  <div class="text-xs text-muted-foreground" v-if="open">
                    <div
                      v-if="version.min_game_build_id"
                      class="text-green-500"
                    >
                      {{ $t("game_server.plugin_version_supports") }}:
                      {{ version.min_game_build_id }}+
                    </div>
                    <div>
                      {{ $t("game_server.plugin_version_published") }}:
                      {{ new Date(version.published_at).toLocaleString() }}
                    </div>
                  </div>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <template v-if="!gameServerNode.plugin_supported">
          <FiveStackToolTip>
            <template #trigger>
              <AlertCircle class="h-4 w-4 animate-pulse text-red-500" />
            </template>
            {{ $t("game_server.plugin_not_supported") }}
          </FiveStackToolTip>
        </template>
      </div>
    </TableCell>
    <TableCell>
      <Select
        :model-value="regionForm.region"
        @update:model-value="(value) => updateRegion(value)"
      >
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="$t('game_server.select_region')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="region.value" v-for="region of server_regions">
              {{ region.description || region.value }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </TableCell>
    <TableCell class="flex items-center gap-2">
      <FiveStackToolTip v-if="overPrevisionedServers">
        <template #trigger>
          <AlertCircle class="h-4 w-4 animate-pulse text-red-500" />
        </template>
        <div class="space-y-1">
          <div>
            <span class="font-semibold text-red-600">
              {{ $t("game_server.overprovisioned_warning") }}
            </span>
          </div>
          <div>
            {{
              $t("game_server.overprovisioned_warning_description", {
                total_server_count: gameServerNode.total_server_count,
                max_servers: maxServers,
              })
            }}
          </div>

          <div>
            <div
              class="flex items-center gap-4 text-xs"
              v-if="
                gameServerNode.status !== e_game_server_node_statuses_enum.Setup
              "
            >
              <div class="flex items-center gap-1">
                <div class="font-medium">
                  {{ $t("game_server.cpu_sockets") }}:
                </div>
                <div class="text-muted-foreground">
                  {{ gameServerNode.cpu_sockets || "-" }}
                </div>
              </div>
              <span class="text-muted-foreground">|</span>
              <div class="flex items-center gap-1">
                <div class="font-medium">
                  {{ $t("game_server.cpu_cores_per_socket") }}:
                </div>
                <div class="text-muted-foreground">
                  {{ gameServerNode.cpu_cores_per_socket || "-" }}
                </div>
              </div>
              <span class="text-muted-foreground">|</span>
              <div class="flex items-center gap-1">
                <div class="font-medium">
                  {{ $t("game_server.cpu_threads_per_core") }}:
                </div>
                <div class="text-muted-foreground">
                  {{ gameServerNode.cpu_threads_per_core || "-" }}
                </div>
              </div>
            </div>
            <div class="p-2 flex items-center gap-2 text-xs mt-2">
              <div class="flex items-center justify-center h-5 w-5">
                <AlertCircle class="h-3 w-3" />
              </div>
              <div>
                <span class="font-semibold">Note:</span>
                The panel reserves <span class="font-bold">1 CPU core</span> for
                Kubernetes to run.
              </div>
            </div>
          </div>
        </div>
      </FiveStackToolTip>

      {{ gameServerNode.available_server_count }} /
      {{ gameServerNode.total_server_count }}
    </TableCell>
    <TableCell>
      <form @submit.prevent="updateServerPorts" class="flex">
        <FormField v-slot="{ componentField }" name="start_port_range">
          <FormItem>
            <FormControl>
              <Input type="number" v-bind="componentField"></Input>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="end_port_range">
          <FormItem>
            <FormControl>
              <Input type="number" v-bind="componentField"></Input>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </form>
    </TableCell>
    <TableCell>
      <Select
        :model-value="gameServerNode.demo_network_limiter?.toString()"
        @update:model-value="(value) => updateNetworkLimiter(value)"
      >
        <SelectTrigger class="w-full">
          <SelectValue
            :placeholder="$t('demo_network_limiter.network_limit')"
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="null">
              {{ $t("demo_network_limiter.unlimited") }}
            </SelectItem>
            <SelectItem value="0">0 Mbps</SelectItem>
            <SelectItem value="1">1 Mbps</SelectItem>
            <SelectItem value="2">2 Mbps</SelectItem>
            <SelectItem value="5">5 Mbps</SelectItem>
            <SelectItem value="10">10 Mbps</SelectItem>
            <SelectItem value="20">20 Mbps</SelectItem>
            <SelectItem value="50">50 Mbps</SelectItem>
            <SelectItem value="100">100 Mbps</SelectItem>
            <SelectItem value="200">200 Mbps</SelectItem>
            <SelectItem value="500">500 Mbps</SelectItem>
            <SelectItem value="1000">1000 Mbps</SelectItem>
            <SelectItem value="2000">2000 Mbps</SelectItem>
            <SelectItem value="5000">5000 Mbps</SelectItem>
            <SelectItem value="10000">10000 Mbps</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </TableCell>
    <TableCell class="flex items-center space-x-2">
      <Switch
        class="cursor-pointer"
        :model-value="gameServerNode.enabled"
        @click="toggleEnabled"
      />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon">
            <PaginationEllipsis class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <template
            v-if="
              gameServerNode.status === e_game_server_node_statuses_enum.Online
            "
          >
            <DropdownMenuItem @click="updateCs">
              <template v-if="gameServerNode.build_id">
                <RefreshCw class="mr-2 h-4 w-4" />
                <span>{{ $t("game_server.update_cs") }}</span>
              </template>
              <template v-else>
                <Plus class="mr-2 h-4 w-4" />
                {{ $t("game_server.install_cs") }}
              </template>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </template>

          <DropdownMenuItem @click="editLabelSheet = true">
            <Pencil class="mr-2 h-4 w-4" />
            <span>{{ $t("game_server.edit_label") }}</span>
          </DropdownMenuItem>

          <DropdownMenuItem @click="removeGameNodeServer" class="text-red-500">
            <Trash2 class="mr-2 h-4 w-4" />
            <span>{{ $t("game_server.remove_node") }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>

  <TableRow class="border-t-0" v-if="showLogs">
    <TableCell :colspan="11">
      <ServiceLogs
        :service="`cs-update:${gameServerNode.id}`"
        :compact="true"
      />
    </TableCell>
  </TableRow>

  <!-- Expandable metrics row -->
  <TableRow class="border-t-0" v-if="displayMetrics">
    <TableCell :colspan="11">
      <NodeMetrics :game-server-node="gameServerNode" />
    </TableCell>
  </TableRow>

  <UpdateGameServerLabel
    :game-server-node="gameServerNode"
    :open="editLabelSheet"
    @close="editLabelSheet = false"
  />
</template>

<script lang="ts">
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { toast } from "@/components/ui/toast";
import { defineComponent } from "vue";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

interface ServerRegion {
  value: string;
  is_lan: boolean;
  description: string;
}

interface GameServerNode {
  id: string;
  status: string;
  region: string;
  enabled: boolean;
  demo_network_limiter?: number | null;
  build_id?: string;
  pin_build_id?: string;
  pin_plugin_version?: string;
  lan_ip?: string;
  public_ip?: string;
  start_port_range: number;
  end_port_range: number;
  label?: string;
  supports_low_latency?: boolean;
  supports_cpu_pinning?: boolean;
  cpu_governor_info?: string;
  plugin_supported?: boolean;
  update_status?: string;
  e_region?: {
    description: string;
  };
  e_status?: {
    description: string;
  };
  total_server_count: number;
  available_server_count: number;
}

interface ComponentData {
  showUpdateLogs: boolean;
  showLogs: boolean;
  gameVersions: any[];
  pluginVersions: any[];
  regionForm: {
    region: string | undefined;
  };
  editLabelSheet: boolean;
  pinBuildIdForm: ReturnType<typeof useForm>;
  pinPluginVersionForm: ReturnType<typeof useForm>;
  portForm: ReturnType<typeof useForm>;
  server_regions: ServerRegion[];
}

export default defineComponent({
  props: {
    gameServerNode: {
      type: Object as () => GameServerNode,
      required: true,
    },
    displayMetrics: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["toggle-metrics"],
  apollo: {
    server_regions: {
      query: generateQuery({
        server_regions: [
          {},
          {
            value: true,
            is_lan: true,
            description: true,
          },
        ],
      }),
    },
    $subscribe: {
      game_versions: {
        query: typedGql("subscription")({
          game_versions: [
            {
              order_by: {
                updated_at: "desc",
              },
            },
            {
              build_id: true,
              version: true,
              description: true,
              updated_at: true,
              current: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.gameVersions = data.game_versions;
        },
      },
      plugin_versions: {
        query: typedGql("subscription")({
          plugin_versions: [
            {
              order_by: {
                published_at: "desc",
              },
            },
            {
              version: true,
              min_game_build_id: true,
              published_at: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.pluginVersions = data.plugin_versions;
        },
      },
    },
    // metrics now fetched inside NodeMetrics component
  },
  data(): ComponentData {
    return {
      showUpdateLogs: false,
      showLogs: false,
      gameVersions: [],
      pluginVersions: [],
      regionForm: {
        region: undefined,
      },
      editLabelSheet: false,
      server_regions: [],
      pinBuildIdForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            pin_build_id: z.string().nullable(),
          }),
        ),
      }),
      pinPluginVersionForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            pin_plugin_version: z.string().nullable(),
          }),
        ),
      }),
      portForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            start_port_range: z
              .number()
              .min(30000)
              .max(32767) // https://kubernetes.io/docs/reference/networking/ports-and-protocols/
              .nullable()
              .refine(
                () => {
                  return (
                    !this.portForm.values.start_port_range ||
                    !this.portForm.values.end_port_range ||
                    this.portForm.values.start_port_range <
                      this.portForm.values.end_port_range
                  );
                },
                {
                  message: this.$t(
                    "game_server.validation.start_port_less_than_end",
                  ),
                },
              ),
            end_port_range: z
              .number()
              .min(30000)
              .max(32767)
              .nullable()
              .refine(
                () => {
                  return (
                    !this.portForm.values.start_port_range ||
                    !this.portForm.values.end_port_range ||
                    this.portForm.values.end_port_range >=
                      this.portForm.values.start_port_range + 2
                  );
                },
                {
                  message: this.$t(
                    "game_server.validation.end_port_greater_than_start",
                  ),
                },
              ),
          }),
        ),
      }),
    };
  },
  mounted() {
    this.$watch(
      () => this.portForm.values,
      async () => {
        this.updateServerPorts();
      },
      { deep: true },
    );
  },
  watch: {
    gameServerNode: {
      immediate: true,
      handler(gameServerNode) {
        if (!gameServerNode) {
          return;
        }

        const { region, start_port_range, end_port_range } = gameServerNode;
        this.regionForm.region = region;

        this.portForm.setValues({
          start_port_range,
          end_port_range,
        });

        if (this.gameServerNode.pin_build_id) {
          this.pinBuildIdForm.setValues({
            pin_build_id: this.gameServerNode.pin_build_id,
          });
        }

        if (this.gameServerNode.pin_plugin_version) {
          this.pinPluginVersionForm.setValues({
            pin_plugin_version: this.gameServerNode.pin_plugin_version,
          });
        }
      },
    },
  },
  methods: {
    async updateCs() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          updateCs: [
            {
              game_server_node_id: this.gameServerNode.id,
            },
            {
              success: true,
            },
          ],
        }),
      });

      this.showUpdateLogs = true;
      this.showLogs = true;

      toast({
        title: this.$t("game_server.toast.cs_updating"),
      });
    },
    async pinBuildId(buildId: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                pin_build_id: buildId ? parseInt(buildId) : null,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.pinBuildIdForm.setValues({
        pin_build_id: buildId,
      });

      toast({
        title: this.$t("game_server.pinned_build_id"),
      });
    },
    async pinPluginVersion(pluginVersion: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                pin_plugin_version: pluginVersion,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.pinPluginVersionForm.setValues({
        pin_plugin_version: pluginVersion,
      });

      toast({
        title: this.$t("game_server.pinned_plugin_version"),
      });
    },
    async removeGameNodeServer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_game_server_nodes_by_pk: [
            {
              id: this.gameServerNode.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async updateServerPorts() {
      const { start_port_range, end_port_range } = this.portForm.values;

      if (!start_port_range || !end_port_range) {
        return;
      }

      const { valid } = await this.portForm.validate();

      if (!valid) {
        return;
      }

      if (
        this.portForm.values.start_port_range ===
          this.gameServerNode.start_port_range &&
        this.portForm.values.end_port_range ===
          this.gameServerNode.end_port_range
      ) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                start_port_range: this.portForm.values.start_port_range,
                end_port_range: this.portForm.values.end_port_range,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("game_server.toast.ports_updated"),
      });
    },
    async updateRegion(region: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                region,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async updateNetworkLimiter(limit: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                demo_network_limiter: limit ? parseInt(limit) : null,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async toggleEnabled() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                enabled: !this.gameServerNode.enabled,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    toggleLogs() {
      this.showLogs = !this.showLogs;
    },
  },
  computed: {
    currentGameVersion() {
      return this.gameVersions.find((version) => {
        return version.current === true;
      });
    },
    nodeBuildVersion() {
      return (
        this.gameVersions.find((version) => {
          return version.build_id == this.gameServerNode.build_id;
        }) || null
      );
    },
    supportsGameServerVersionPinning() {
      return useApplicationSettingsStore().supportsGameServerVersionPinning;
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    overPrevisionedServers() {
      if (!this.gameServerNode.enabled) {
        return false;
      }
      return this.maxServers < this.gameServerNode.total_server_count;
    },
    maxServers() {
      const virtualCPUsAvailable =
        this.gameServerNode.cpu_sockets *
          this.gameServerNode.cpu_cores_per_socket *
          this.gameServerNode.cpu_threads_per_core -
        1;

      if (
        !this.gameServerNode.supports_cpu_pinning ||
        !this.cpuPinningEnabled
      ) {
        return virtualCPUsAvailable;
      }

      return Math.floor(virtualCPUsAvailable / this.numberOfCpusPerServer);
    },
    cpuPinningEnabled() {
      return (
        this.settings.find((setting) => {
          return setting.name === "enable_cpu_pinning";
        })?.value === "true"
      );
    },
    numberOfCpusPerServer() {
      return this.settings.find((setting) => {
        return setting.name === "number_of_cpus_per_server";
      })?.value;
    },
  },
});
</script>
