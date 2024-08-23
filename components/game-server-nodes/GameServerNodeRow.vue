<script lang="ts" setup>
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
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
</script>

<template>
  <TableRow>
    <TableCell>
      <div>
        <span
          class="ml-1 inline-block h-2 w-2 rounded-full"
          :class="{
            ['bg-red-600']:
              gameServerNode.status ===
              e_game_server_node_statuses_enum.Offline,
            ['bg-green-600']:
              gameServerNode.status === e_game_server_node_statuses_enum.Online,
            ['bg-yellow-600']:
              gameServerNode.status ===
                e_game_server_node_statuses_enum.Setup ||
              gameServerNode.status ===
                e_game_server_node_statuses_enum.NotAcceptingNewMatches,
          }"
        >
        </span>
        {{ gameServerNode.id }}
      </div>
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
              .min(27000)
              .max(28000)
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
              .max(28000)
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
      handler({ region, start_port_range, end_port_range }) {
        this.form.region = region;

        this.portForm.setValues({
          start_port_range,
          end_port_range,
        });
      },
    },
  },
  methods: {
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
