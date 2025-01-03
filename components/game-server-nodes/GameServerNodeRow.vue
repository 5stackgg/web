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
import { Trash2, RefreshCw } from "lucide-vue-next";
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
      <template v-if="gameServerNode.build_id">
        {{ gameServerNode.build_id }}
      </template>
      <template
        v-else-if="
          gameServerNode.status === e_game_server_node_statuses_enum.Online
        "
      >
        <Button size="sm" @click="updateCs">Install CS</Button>
      </template>
    </TableCell>
    <TableCell>
      <Select
        :model-value="form.region"
        @update:model-value="(value) => updateRegion(value)"
      >
        <SelectTrigger>
          <SelectValue placeholder="Select the round to restore" />
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
        :checked="gameServerNode.enabled"
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
              <span>Update CS</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </template>

          <DropdownMenuItem @click="removeGameNodeServer" class="text-red-500">
            <Trash2 class="mr-2 h-4 w-4" />
            <span>Remove Node</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    gameServerNode: {
      type: Object,
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
  data() {
    return {
      form: {
        region: null,
      },
      portForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            start_port_range: z
              .number()
              .min(30000)
              .max(32767) // https://kubernetes.io/docs/reference/networking/ports-and-protocols/
              .refine(
                () => {
                  return (
                    this.portForm.values.start_port_range <
                    this.portForm.values.end_port_range
                  );
                },
                {
                  message: "Start port range must be less than end port range",
                },
              ),
            end_port_range: z
              .number()
              .min(27000)
              .max(37000)
              .refine(
                () => {
                  return (
                    this.portForm.values.end_port_range >=
                    this.portForm.values.start_port_range + 2
                  );
                },
                {
                  message:
                    "End port range must be greater than start port range by at least 2",
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
      async (newValues) => {
        const { valid } = await this.portForm.validate();

        if (!valid) {
          return;
        }

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
        this.form.region = region;

        this.portForm.setValues({
          start_port_range,
          end_port_range,
        });
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

      toast({
        title: "CS2 is being updated on the node",
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
      const { valid } = await this.portForm.validate();

      if (!valid) {
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
        title: "Node Ports Updated",
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
};
</script>
