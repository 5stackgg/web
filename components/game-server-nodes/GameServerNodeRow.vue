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
import { Trash2, RefreshCw, Pencil, Activity, Cpu } from "lucide-vue-next";
import UpdateGameServerLabel from "~/components/game-server-nodes/UpdateGameServerLabel.vue";
</script>

<template>
  <TableRow>
    <TableCell>
      <GameServerNodeDisplay
        :game-server-node="gameServerNode"
      ></GameServerNodeDisplay>
    </TableCell>
    <TableCell>
      {{ gameServerNode.lan_ip }}
      {{ gameServerNode.lan_ip && gameServerNode.public_ip ? "/" : "" }}
      {{ gameServerNode.public_ip }}
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
    <TableCell>
      <template v-if="gameServerNode.update_status">
        <span class="capitalize">
          {{ gameServerNode.update_status }}
        </span>
      </template>
      <template v-else-if="gameServerNode.build_id">
        {{ gameServerNode.build_id }}
        <template v-if="gameServerNode.build_id != csVersion">
          <Button variant="destructive" size="sm" @click="updateCs">{{
            $t("game_server.update_cs")
          }}</Button>
        </template>
      </template>
      <template
        v-else-if="
          gameServerNode.status === e_game_server_node_statuses_enum.Online
        "
      >
        <Button size="sm" @click="updateCs">{{
          $t("game_server.install_cs")
        }}</Button>
      </template>
    </TableCell>
    <TableCell>
      <Select
        :model-value="regionForm.region"
        @update:model-value="(value) => updateRegion(value)"
      >
        <SelectTrigger>
          <SelectValue :placeholder="$t('game_server.select_region')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="region.value" v-for="region of server_regions">
              {{ region.description }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </TableCell>
    <TableCell>
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
              gameServerNode.status ===
                e_game_server_node_statuses_enum.Online &&
              gameServerNode.build_id
            "
          >
            <DropdownMenuItem @click="updateCs">
              <RefreshCw class="mr-2 h-4 w-4" />
              <span>{{ $t("game_server.update_cs") }}</span>
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
  build_id?: string;
  lan_ip?: string;
  public_ip?: string;
  start_port_range: number;
  end_port_range: number;
  label?: string;
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
  regionForm: {
    region: string | undefined;
  };
  editLabelSheet: boolean;
  portForm: ReturnType<typeof useForm>;
  server_regions: ServerRegion[];
}

export default defineComponent({
  props: {
    gameServerNode: {
      type: Object as () => GameServerNode,
      required: true,
    },
  },
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
  },
  data(): ComponentData {
    return {
      regionForm: {
        region: undefined,
      },
      editLabelSheet: false,
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
      },
    },
  },
  computed: {
    csVersion() {
      return useApplicationSettingsStore().csBuildInfo?.buildid;
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

      toast({
        title: this.$t("game_server.toast.cs_updating"),
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
  },
});
</script>
