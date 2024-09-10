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
</script>

<template>
  <TableRow>
    <TableCell>
      <GameServerNodeDisplay
        :game-server-node="gameServerNode"
      ></GameServerNodeDisplay>
    </TableCell>
    <TableCell>
      {{ gameServerNode.public_ip }}
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
            <SelectItem
              :value="region.value"
              v-for="region of e_game_server_node_regions"
            >
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

        <Button type="submit">Update Ports</Button>
      </form>

      <Button
        @click="updateCs"
        v-if="gameServerNode.status === e_game_server_node_statuses_enum.Online"
        >Update CS</Button
      >
      <Button @click="removeGameNodeServer">Remove Game Node Server</Button>
    </TableCell>
    <TableCell>
      {{ gameServerNode.build_id }}
    </TableCell>
    <TableCell>
      <Switch
        class="cursor-pointer"
        :checked="gameServerNode.enabled"
        @click="toggleEnabled"
      />
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  props: {
    gameServerNode: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    e_game_server_node_regions: {
      query: generateQuery({
        e_game_server_node_regions: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  data() {
    return {
      regions: [],
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
              gameServerNodeId: this.gameServerNode.id,
            },
            {
              success: true,
            },
          ],
        }),
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
