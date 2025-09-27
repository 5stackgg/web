<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
</script>

<template>
  <form @submit.prevent="updateCreateServer" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="type">
      <FormItem>
        <FormLabel>{{ $t("server.form.type") }}</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue :placeholder="$t('server.form.select_type')" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                :value="serverType"
                v-for="serverType in serverTypes"
                :key="serverType"
              >
                {{ serverType }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="label">
      <FormItem>
        <FormLabel>{{ $t("server.form.label") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="rcon_password">
      <FormItem>
        <FormLabel>{{ $t("server.form.rcon_password") }}</FormLabel>
        <FormControl>
          <Input type="password" v-bind="componentField" />
          <FormMessage />
          <FormDescription v-if="server">
            {{ $t("server.form.rcon_password_description") }}
          </FormDescription>
        </FormControl>
      </FormItem>
    </FormField>

    <template v-if="gameServerNodes.length > 0 && !server">
      <FormField v-slot="{ componentField }" name="use_game_server_node">
        <FormItem
          class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          @click="
            componentField['onUpdate:modelValue'](!componentField.modelValue)
          "
        >
          <div class="space-y-0.5">
            <FormLabel class="text-base cursor-pointer">{{
              $t("server.form.server_configuration")
            }}</FormLabel>
            <FormDescription class="cursor-pointer">
              {{
                useGameServerNode
                  ? $t("server.form.use_game_server_node")
                  : "Use Manual Host Configuration"
              }}
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              @click.stop
              :model-value="componentField.modelValue"
              @update:model-value="componentField['onUpdate:modelValue']"
            />
          </FormControl>
        </FormItem>
      </FormField>
    </template>

    <template v-if="!useGameServerNode && !isEditingGameServerNode">
      <FormField v-slot="{ componentField }" name="region">
        <FormItem>
          <FormLabel class="text-lg font-semibold">{{
            $t("server.form.region")
          }}</FormLabel>
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue :placeholder="$t('server.form.select_region')" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  :value="region.value"
                  v-for="region in server_regions"
                  :key="region.value"
                >
                  {{ region.description || region.value }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      </FormField>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField v-slot="{ componentField }" name="host">
          <FormItem>
            <FormLabel>{{ $t("server.form.host") }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
              <FormMessage />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="port">
          <FormItem>
            <FormLabel>{{ $t("server.form.port") }}</FormLabel>
            <FormControl>
              <Input type="number" v-bind="componentField" />
              <FormMessage />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="tv_port">
          <FormItem>
            <FormLabel>{{ $t("server.form.tv_port") }}</FormLabel>
            <FormControl>
              <Input type="number" v-bind="componentField" />
              <FormMessage />
            </FormControl>
          </FormItem>
        </FormField>
      </div>
    </template>

    <FormField
      v-slot="{ componentField }"
      name="game_server_node_id"
      v-if="
        (useGameServerNode && gameServerNodes.length > 0) ||
        isEditingGameServerNode
      "
    >
      <FormItem>
        <FormLabel>{{ $t("server.form.game_server_node") }}</FormLabel>
        <Select v-bind="componentField" :disabled="isEditingGameServerNode">
          <FormControl>
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('server.form.select_game_server_node')"
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                :value="node.id"
                v-for="node in gameServerNodes"
                :key="node.id"
              >
                {{ node.label }} ({{
                  node.e_region?.description || node.region
                }})
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
        <FormDescription>{{
          $t("server.form.game_server_node_description")
        }}</FormDescription>
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="connect_password"
      v-if="isPublicServerType"
    >
      <FormItem>
        <FormLabel>{{ $t("server.form.connect_password") }}</FormLabel>
        <FormControl>
          <Input type="password" v-bind="componentField" />
          <FormMessage />
          <FormDescription>{{
            $t("server.form.connect_password_description")
          }}</FormDescription>
        </FormControl>
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="max_players"
      v-if="isPublicServerType"
    >
      <FormItem>
        <FormLabel>{{ $t("server.form.max_players") }}</FormLabel>
        <FormControl>
          <Input type="number" min="1" max="32" v-bind="componentField" />
          <FormMessage />
          <FormDescription>{{
            $t("server.form.max_players_description")
          }}</FormDescription>
        </FormControl>
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="server">{{ $t("server.form.update") }}</template>
      <template v-else>{{ $t("server.form.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { e_server_types_enum } from "~/generated/zeus";

export default {
  emits: ["updated"],
  props: {
    server: {
      type: Object,
      required: false,
    },
  },
  apollo: {
    server_regions: {
      query: generateQuery({
        server_regions: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {
              where: {
                build_id: {
                  _is_null: false,
                },
                enabled: {
                  _eq: true,
                },
              },
              order_by: [
                {},
                {
                  id: order_by.asc,
                },
              ],
            },
            {
              id: true,
              label: true,
              region: true,
              build_id: true,
              lan_ip: true,
              public_ip: true,
              start_port_range: true,
              end_port_range: true,
              e_region: {
                description: true,
              },
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.gameServerNodes = data.game_server_nodes;
        },
      },
    },
  },
  data() {
    return {
      gameServerNodes: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z
            .object({
              host: z
                .string()
                .ip({ version: "v4" })
                .or(
                  z
                    .string()
                    .regex(/^(?!:\/\/)(?:[-A-Za-z0-9]+\.)+[A-Za-z]{2,6}$/),
                )
                .optional(),
              label: z.string().min(3),
              region: z.string().optional(),
              use_game_server_node: z.boolean().default(false),
              game_server_node_id: z.string().optional(),
              type: z.string().default(e_server_types_enum.Ranked),
              connect_password: z.string().optional(),
              port: z.number().min(2).max(65535).default(27015).optional(),
              tv_port: z.number().min(2).max(65535).default(27020).optional(),
              rcon_password: z.string().optional(),
              max_players: z.number().min(1).max(32).optional(),
            })
            .refine(
              (data) => {
                // If not using game server node, host, region, port, tv_port, and rcon_password are required
                if (!data.use_game_server_node) {
                  return (
                    data.host &&
                    data.region &&
                    data.port &&
                    data.tv_port &&
                    data.rcon_password
                  );
                }
                return true;
              },
              {
                message:
                  "Host, region, ports, and RCON password are required when not using a game server node",
                path: ["host"],
              },
            ),
        ),
      }),
    };
  },
  watch: {
    server: {
      immediate: true,
      handler(server) {
        if (server) {
          const {
            host,
            label,
            port,
            tv_port,
            region,
            type,
            connect_password,
            game_server_node_id,
            max_players,
          } = server;
          this.form.setValues({
            host,
            label,
            port,
            region,
            tv_port,
            use_game_server_node: !!game_server_node_id,
            game_server_node_id: game_server_node_id
              ? game_server_node_id.toString()
              : undefined,
            type: type || "Ranked",
            connect_password: connect_password || "",
            max_players: max_players || 32,
          });
          return;
        }
      },
    },
    "form.values.game_server_node_id": {
      handler(newNodeId) {
        if (newNodeId && newNodeId !== "none" && this.useGameServerNode) {
          // When a game server node is selected, auto-fill the region
          const selectedNode = this.gameServerNodes.find(
            (node) => node.id === newNodeId,
          );
          if (selectedNode) {
            this.form.setFieldValue("region", selectedNode.region);
          }
        } else if (
          (!newNodeId || newNodeId === "none") &&
          this.useGameServerNode
        ) {
          // When game server node is deselected, clear the region
          this.form.setFieldValue("region", "");
        }
      },
    },
  },
  computed: {
    isPublicServerType() {
      return this.form.values.type !== "Ranked";
    },
    useGameServerNode() {
      return this.form.values.use_game_server_node;
    },
    serverTypes() {
      return [
        e_server_types_enum.Ranked,
        e_server_types_enum.Deathmatch,
        e_server_types_enum.Custom,
      ];
    },
    isEditingGameServerNode() {
      return !!(this.server && this.server.game_server_node_id);
    },
  },
  methods: {
    async updateCreateServer() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.server) {
        const formValues = { ...this.form.values };
        if (
          !formValues.game_server_node_id ||
          formValues.game_server_node_id === "none"
        ) {
          formValues.game_server_node_id = null;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            update_servers_by_pk: [
              {
                pk_columns: {
                  id: this.server.id,
                },
                _set: {
                  type: formValues.type,
                  label: formValues.label,
                  rcon_password: formValues.rcon_password,
                  max_players: formValues.max_players,
                  ...(!this.server.game_server_node_id
                    ? {
                        host: formValues.host,
                        port: formValues.port,
                        tv_port: formValues.tv_port,
                        region: formValues.region,
                        connect_password: formValues.connect_password,
                      }
                    : {}),
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
        this.$emit("updated");
        return;
      }

      const formValues = this.form.values;

      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_servers_one: [
            {
              object: {
                enabled: true,
                type: formValues.type,
                label: formValues.label,
                region: formValues.use_game_server_node
                  ? null
                  : formValues.region,
                game_server_node_id: formValues.use_game_server_node
                  ? formValues.game_server_node_id
                  : null,
                host: formValues.use_game_server_node
                  ? "127.0.0.1"
                  : formValues.host,
                port: formValues.use_game_server_node ? 27015 : formValues.port,
                tv_port: formValues.use_game_server_node
                  ? 27020
                  : formValues.tv_port,
                rcon_password: formValues.rcon_password,
                connect_password: formValues.connect_password,
                max_players: formValues.max_players,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/dedicated-servers/${data.insert_servers_one.id}`);
    },
  },
};
</script>
