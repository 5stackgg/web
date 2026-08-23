<script setup lang="ts">
import { ref } from "vue";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Fold } from "~/components/ui/transitions";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  FormSection,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  SelectItem as RekaSelectItem,
  SelectItemIndicator as RekaSelectItemIndicator,
  SelectItemText as RekaSelectItemText,
} from "reka-ui";
import { CheckIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Eye, EyeOff, Lock } from "lucide-vue-next";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

const showConnectPassword = ref(false);
</script>

<template>
  <form @submit.prevent="updateCreateServer" class="grid gap-5">
    <FormSection :title="$t('server.form.type')">
      <div class="grid gap-4">
        <FormField name="type">
          <FormItem>
            <FormLabel>
              {{ $t("server.form.type") }}
            </FormLabel>
            <FormControl>
              <RadioGroup :model-value="serverKind" class="grid gap-3">
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 transition-colors"
                  :class="
                    form.values.game === 'csgo'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-muted/50 cursor-pointer'
                  "
                  @click="form.values.game === 'csgo' || setServerKind('ranked')"
                >
                  <RadioGroupItem
                    id="kind-ranked"
                    value="ranked"
                    :disabled="form.values.game === 'csgo'"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none"
                      :class="
                        form.values.game === 'csgo'
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer'
                      "
                      for="kind-ranked"
                    >
                      {{ $t("server.form.ranked_server") }}
                    </label>
                    <p class="text-sm text-muted-foreground">
                      {{ $t("server.form.ranked_server_description") }}
                    </p>
                  </div>
                </div>
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 transition-colors"
                  :class="
                    form.values.game === 'csgo'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-muted/50 cursor-pointer'
                  "
                  @click="form.values.game === 'csgo' || setServerKind('practice')"
                >
                  <RadioGroupItem
                    id="kind-practice"
                    value="practice"
                    :disabled="form.values.game === 'csgo'"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none"
                      :class="
                        form.values.game === 'csgo'
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer'
                      "
                      for="kind-practice"
                    >
                      {{ $t("server.form.practice_server") }}
                    </label>
                    <p class="text-sm text-muted-foreground">
                      {{ $t("server.form.practice_server_description") }}
                    </p>
                  </div>
                </div>
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                  @click="setServerKind('valve')"
                >
                  <RadioGroupItem
                    id="kind-valve"
                    value="valve"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none"
                      for="kind-valve"
                    >
                      {{ $t("server.form.valve_modes") }}
                    </label>
                    <p class="text-sm text-muted-foreground">
                      {{ $t("server.form.valve_modes_description") }}
                    </p>
                  </div>
                </div>
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                  @click="setServerKind('presets')"
                >
                  <RadioGroupItem
                    id="kind-presets"
                    value="presets"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none"
                      for="kind-presets"
                    >
                      {{ $t("server.form.custom_presets") }}
                    </label>
                    <p class="text-sm text-muted-foreground">
                      {{ $t("server.form.custom_presets_description") }}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Fold :open="gameServerNodes.length > 0 && !server">
          <FormField v-slot="{ componentField }" name="use_game_server_node">
            <FormItem
              class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              @click="
                componentField['onUpdate:modelValue'](!componentField.modelValue)
              "
            >
              <div class="space-y-0.5">
                <FormLabel class="cursor-pointer">{{
                  $t("server.form.server_configuration")
                }}</FormLabel>
                <FormDescription class="cursor-pointer">
                  {{
                    useGameServerNode
                      ? $t("server.form.use_game_server_node")
                      : $t("server.form.use_manual_host_configuration")
                  }}
                </FormDescription>
              </div>
              <FormControl>
                <Switch @click.stop :model-value="componentField.modelValue" />
              </FormControl>
            </FormItem>
          </FormField>
        </Fold>

        <Fold :open="!useGameServerNode && !isEditingGameServerNode">
          <div class="grid gap-4">
            <FormField v-slot="{ componentField }" name="region">
              <FormItem>
                <FormLabel>{{ $t("server.form.region") }}</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        :placeholder="$t('server.form.select_region')"
                      />
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
          </div>
        </Fold>
      </div>
    </FormSection>

    <FormSection :title="$t('server.form.game')">
      <div class="grid gap-4">
        <FormField v-slot="{ componentField }" name="game">
          <FormItem>
            <FormLabel>{{ $t("server.form.game") }}</FormLabel>
            <FormControl>
              <RadioGroup v-bind="componentField" class="grid gap-3">
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  @click="componentField['onUpdate:modelValue']('cs2')"
                >
                  <RadioGroupItem id="game-cs2" value="cs2" />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none cursor-pointer"
                      for="game-cs2"
                      >CS2</label
                    >
                  </div>
                </div>
                <div
                  class="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  @click="componentField['onUpdate:modelValue']('csgo')"
                >
                  <RadioGroupItem id="game-csgo" value="csgo" />
                  <div class="grid gap-1.5 leading-none">
                    <label
                      class="text-sm font-medium leading-none cursor-pointer"
                      for="game-csgo"
                      >CS:GO</label
                    >
                  </div>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>


        <Fold
          :open="form.values.game === 'csgo' && !form.values.use_valve_modes"
        >
          <Alert variant="warning">
            <AlertTitle>{{
              $t("server.form.csgo_ranked_unavailable_title")
            }}</AlertTitle>
            <AlertDescription>{{
              $t("server.form.csgo_ranked_unavailable_description")
            }}</AlertDescription>
          </Alert>
        </Fold>

        <Fold :open="serverKind === 'valve'">
          <FormField v-slot="{ componentField }" name="type">
            <FormItem>
              <FormLabel>{{ $t("server.form.game_mode") }}</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('server.form.select_game_mode')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent class="w-[--reka-select-trigger-width]">
                  <SelectGroup>
                    <SelectItem
                      :value="serverType"
                      v-for="serverType in valveModeTypes"
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
        </Fold>

        <Fold :open="serverKind === 'presets'">
          <FormField v-slot="{ componentField }" name="type">
            <FormItem>
              <FormLabel>{{ $t("server.form.custom_mode_group") }}</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('server.form.select_custom_preset')"
                    />
                  </SelectTrigger>
                </FormControl>
                <!-- Width pinned to the trigger: the popper otherwise grows to
                     the longest mode description and the text never wraps. -->
                <SelectContent class="w-[--reka-select-trigger-width]">
                  <SelectGroup>
                    <!-- Built from the reka primitives rather than ui/SelectItem
                         so the description sits outside SelectItemText: the
                         trigger then echoes only the name. -->
                    <RekaSelectItem
                      v-for="gameMode in customModes"
                      :key="gameMode.id"
                      :value="gameMode.id"
                      :disabled="!hasGameServerNode"
                      class="relative flex w-full cursor-default select-none flex-col items-start rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <span
                        class="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center"
                      >
                        <RekaSelectItemIndicator>
                          <CheckIcon class="h-4 w-4" />
                        </RekaSelectItemIndicator>
                      </span>
                      <RekaSelectItemText>{{ gameMode.name }}</RekaSelectItemText>
                      <span
                        v-if="gameMode.description"
                        class="mt-0.5 block whitespace-normal text-xs leading-snug text-muted-foreground"
                      >
                        {{ gameMode.description }}
                      </span>
                    </RekaSelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </Fold>

        <!-- A custom mode is plugins the panel installs onto the container it
             runs; a third-party dedicated server gives it nothing to install
             into, so the modes stay locked until a node is attached. -->
        <Fold
          :open="
            serverKind === 'presets' &&
            customModes.length > 0 &&
            !hasGameServerNode
          "
        >
          <Alert variant="warning">
            <AlertTitle>{{
              $t("server.form.custom_modes_need_node_title")
            }}</AlertTitle>
            <AlertDescription>{{
              $t("server.form.custom_modes_need_node_description")
            }}</AlertDescription>
          </Alert>
        </Fold>
      </div>
    </FormSection>

    <FormSection :title="$t('server.form.identity')">
      <div class="grid gap-4">
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
            </FormControl>
            <FormDescription v-if="server">
              {{ $t("server.form.rcon_password_description") }}
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </FormSection>

    <FormSection :title="$t('server.form.connection')">
      <div class="grid gap-4">

        <Fold :open="!useGameServerNode && !isEditingGameServerNode">
        <div class="grid gap-4">

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField v-slot="{ componentField }" name="host">
              <FormItem>
                <FormLabel>{{ $t("server.form.host") }}</FormLabel>
                <FormControl>
                  <Input v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="port">
              <FormItem>
                <FormLabel>{{ $t("server.form.port") }}</FormLabel>
                <FormControl>
                  <Input type="number" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="tv_port">
              <FormItem>
                <FormLabel>{{ $t("server.form.tv_port") }}</FormLabel>
                <FormControl>
                  <Input type="number" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </div>
        </Fold>

        <Fold
          :open="
            (useGameServerNode && gameServerNodes.length > 0) ||
            isEditingGameServerNode
          "
        >
        <FormField
          v-slot="{ componentField }"
          name="game_server_node_id"
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
        </Fold>
      </div>
    </FormSection>

    <Fold :open="!isManagedRankedServer">
    <FormSection :title="$t('server.form.connect_password')">
      <div class="grid gap-4">
        <FormField
          v-slot="{ componentField }"
          name="connect_password"
          v-if="!isManagedRankedServer"
        >
          <FormItem>
            <FormLabel>{{ $t("server.form.connect_password") }}</FormLabel>
            <FormControl>
              <div class="relative">
                <Input
                  :type="showConnectPassword ? 'text' : 'password'"
                  v-bind="componentField"
                  autocomplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  @click="showConnectPassword = !showConnectPassword"
                  tabindex="-1"
                >
                  <Eye v-if="!showConnectPassword" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </Button>
              </div>
            </FormControl>
            <FormDescription>{{
              $t("server.form.connect_password_description")
            }}</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField
          v-slot="{ componentField }"
          name="max_players"
          v-if="!isManagedRankedServer"
        >
          <FormItem>
            <FormLabel>{{ $t("server.form.max_players") }}</FormLabel>
            <FormControl>
              <Input type="number" min="1" max="32" v-bind="componentField" />
            </FormControl>
            <FormDescription>{{
              $t("server.form.max_players_description")
            }}</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </FormSection>
    </Fold>

    <Button
      v-if="!server"
      variant="tactical"
      type="submit"
      :disabled="Object.keys(form.errors).length > 0"
      :loading="submitting"
    >
      {{ $t("server.form.create") }}
    </Button>

    <SettingsSaveBar
      v-else
      contained
      :dirty="isDirty"
      :submitting="submitting"
      @save="updateCreateServer"
      @discard="discardChanges"
    />
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { e_server_types_enum } from "~/generated/zeus";

import { toast } from "@/components/ui/toast";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// Literals rather than the generated enum: a type added by a migration is
// absent from ~/generated/zeus until codegen runs against a migrated database,
// and a server holding one must not read as a custom mode id -- dropStaleMode
// would rewrite it to a preset and save that.
const SERVER_TYPE_RANKED = "Ranked";
const SERVER_TYPE_PRACTICE = "Practice";
const SERVER_TYPE_CUSTOM = "Custom";

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
    gameModes: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        game_modes: [
          {},
          {
            id: true,
            name: true,
            description: true,
            enabled: true,
            supported_runtimes: [{}, true],
          },
        ],
      }),
      update(data: { game_modes: Array<Record<string, any>> }) {
        return data.game_modes;
      },
      skip() {
        return !useApplicationSettingsStore().gamePluginsEnabled;
      },
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
      submitting: false,
      baseline: null as string | null,
      isDirty: false,
      gameServerNodes: [],
      gameModes: [] as Array<Record<string, any>>,
      form: useForm({
        validationSchema: toTypedSchema(
          z
            .object({
              game: z.string().default("cs2"),
              use_valve_modes: z.boolean().default(false),
              host: z
                .ipv4()
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
              type: z.string().default(SERVER_TYPE_RANKED),
              connect_password: z.string().optional(),
              port: z.number().min(2).max(65535).default(27015).optional(),
              tv_port: z.number().min(2).max(65535).default(27020).optional(),
              rcon_password: z.string().optional(),
              max_players: z.number().min(1).max(32).optional(),
            })
            .refine(
              (data) => {
                if (!data.use_game_server_node) {
                  return data.host && data.region && data.port && data.tv_port;
                }
                return true;
              },
              {
                message:
                  "Host, region, and ports are required when not using a game server node",
                path: ["host"],
              },
            )
            .refine(
              (data) => {
                if (this.server) {
                  return true;
                }
                return !!data.rcon_password;
              },
              {
                message: this.$t("validation_extras.rcon_password_required"),
                path: ["rcon_password"],
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
        // `server` can refresh from its parent; don't clobber in-progress edits.
        if (server && (this.baseline === null || !this.isDirty)) {
          this.populateServer(server);
        }
      },
    },
    ["form.values"]: {
      deep: true,
      handler() {
        this.isDirty =
          this.baseline !== null &&
          JSON.stringify(this.form.values) !== this.baseline;
      },
    },
    "form.values.game": {
      handler(newGame) {
        if (newGame === "csgo" && !this.form.values.use_valve_modes) {
          this.form.setFieldValue("type", this.valveModeTypes[0]);
          this.form.setFieldValue("use_valve_modes", true);
        }
      },
    },
    "form.values.use_valve_modes": {
      immediate: true,
      handler(newValue) {
        const selected = this.form.values.type;
        // Ranked and Practice are the two that run no Valve preset, so they
        // are the two this watcher must leave alone in either direction.
        const runsNoPreset =
          selected === SERVER_TYPE_RANKED ||
          selected === SERVER_TYPE_PRACTICE;

        if (!newValue) {
          if (!runsNoPreset) {
            this.form.setFieldValue("type", SERVER_TYPE_RANKED);
          }
          return;
        }

        if (runsNoPreset) {
          const firstPreset = this.valveModeTypes[0];
          if (firstPreset) {
            this.form.setFieldValue("type", firstPreset);
          }
        }
      },
    },
    // Detaching the node (or never picking one) leaves a custom mode with
    // nothing to install into; fall back to a preset rather than save a mode
    // the server could not boot with.
    hasGameServerNode(has: boolean) {
      if (!has && this.holdsModeId) {
        this.form.setFieldValue("type", this.valveModeTypes[0]);
      }
    },
    // A mode the picker does not offer shows as an empty select; put the
    // preset that would be saved in its place so the form says what it does.
    // Covers the game flipping to csgo, a mode archived or disabled since the
    // server was saved, and game plugins being switched off.
    customModes() {
      this.dropStaleMode();
    },
    modesKnown() {
      this.dropStaleMode();
    },
    "form.values.game_server_node_id": {
      handler(newNodeId) {
        if (newNodeId && newNodeId !== "none" && this.useGameServerNode) {
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
          this.form.setFieldValue("region", "");
        }
      },
    },
  },
  computed: {
    isManagedRankedServer() {
      return this.form.values.type === SERVER_TYPE_RANKED;
    },
    useGameServerNode() {
      return this.form.values.use_game_server_node;
    },
    serverTypes() {
      return Object.values(e_server_types_enum);
    },
    knownServerTypes(): Array<string> {
      return Array.from(
        new Set([
          ...Object.values(e_server_types_enum),
          SERVER_TYPE_RANKED,
          SERVER_TYPE_PRACTICE,
          SERVER_TYPE_CUSTOM,
        ]),
      );
    },
    valveModeTypes() {
      return this.knownServerTypes.filter(
        (t) =>
          t !== SERVER_TYPE_RANKED &&
          t !== SERVER_TYPE_PRACTICE &&
          t !== SERVER_TYPE_CUSTOM,
      );
    },
    // Which of the four top-level choices the current `type` represents. The
    // field itself still holds either an enum value or a mode uuid; this is
    // only how the radios read it back.
    serverKind(): string {
      const selected = this.form.values.type;
      if (selected === SERVER_TYPE_RANKED) {
        return "ranked";
      }
      if (selected === SERVER_TYPE_PRACTICE) {
        return "practice";
      }
      if (this.holdsModeId || selected === SERVER_TYPE_CUSTOM) {
        return "presets";
      }
      return "valve";
    },
    // Custom game modes share the picker with the Valve presets: both answer
    // "what does this server play". A preset is stored in servers.type, a mode
    // in servers.game_mode_id, and the mode's uuid never collides with an enum
    // value. Modes are CS2 plugin sets, so csgo servers only see presets.
    customModes(): Array<Record<string, any>> {
      if (this.form.values.game === "csgo") {
        return [];
      }
      const runtime = useApplicationSettingsStore().gameServerPluginRuntime;
      return (this.gameModes ?? []).filter(
        (mode: Record<string, any>) =>
          mode.enabled && (mode.supported_runtimes ?? []).includes(runtime),
      );
    },
    isEditingGameServerNode() {
      return !!(this.server && this.server.game_server_node_id);
    },
    hasGameServerNode(): boolean {
      if (this.isEditingGameServerNode) {
        return true;
      }
      const nodeId = this.form.values.game_server_node_id;
      return (
        !!this.form.values.use_game_server_node && !!nodeId && nodeId !== "none"
      );
    },
    // Anything in `type` that is not a preset is a mode id. Whether the mode
    // is still one this server can run (enabled, this runtime, not csgo) is a
    // separate question -- see isCustomModeSelected.
    holdsModeId(): boolean {
      const selected = this.form.values.type;
      return !!selected && !this.knownServerTypes.includes(selected);
    },
    isCustomModeSelected(): boolean {
      const selected = this.form.values.type;
      return this.customModes.some((mode) => mode.id === selected);
    },
    // False until the mode list has been fetched (or the query skipped) and
    // the settings it is filtered on (plugin runtime) have arrived; a saved
    // mode must not be judged stale against a list that is not there yet.
    // Read from $apolloData rather than $apollo.queries: the form populates
    // from an immediate watcher, which runs before vue-apollo has created the
    // query, and only the data-backed entry is reactive from nothing.
    modesKnown(): boolean {
      return (
        useApplicationSettingsStore().settingsLoaded &&
        (this as any).$data.$apolloData?.queries?.gameModes?.loading === false
      );
    },
  },
  methods: {
    // The form's `type` field holds either a Valve preset (enum value) or a
    // custom mode's uuid; this splits it back into the two columns. A mode
    // the picker no longer offers -- archived, disabled, or the server moved
    // to csgo -- is not re-saved behind the placeholder it shows as.
    resolveTypeAndMode(): { type: string; game_mode_id: string | null } {
      const selected = this.form.values.type;
      if (this.isCustomModeSelected || (this.holdsModeId && !this.modesKnown)) {
        return { type: SERVER_TYPE_CUSTOM, game_mode_id: selected };
      }
      if (this.holdsModeId) {
        return { type: this.valveModeTypes[0], game_mode_id: null };
      }
      return { type: selected || "Ranked", game_mode_id: null };
    },
    setServerKind(kind: string) {
      if (kind === "ranked") {
        this.form.setFieldValue("use_valve_modes", false);
        this.form.setFieldValue("type", SERVER_TYPE_RANKED);
        return;
      }

      if (kind === "practice") {
        this.form.setFieldValue("use_valve_modes", false);
        this.form.setFieldValue("type", SERVER_TYPE_PRACTICE);
        return;
      }

      this.form.setFieldValue("use_valve_modes", true);

      if (kind === "valve") {
        if (!this.valveModeTypes.includes(this.form.values.type)) {
          this.form.setFieldValue("type", this.valveModeTypes[0]);
        }
        return;
      }

      if (!this.isCustomModeSelected) {
        this.form.setFieldValue(
          "type",
          this.customModes[0]?.id ?? SERVER_TYPE_CUSTOM,
        );
      }
    },
    dropStaleMode() {
      if (this.modesKnown && this.holdsModeId && !this.isCustomModeSelected) {
        this.form.setFieldValue("type", this.valveModeTypes[0]);
      }
    },
    populateServer(server) {
      const {
        host,
        label,
        port,
        tv_port,
        region,
        type,
        connect_password,
        game_server_node_id,
        game_mode_id,
        max_players,
      } = server;
      this.form.setValues({
        host,
        label,
        port,
        region,
        tv_port,
        game: server.game || "cs2",
        use_valve_modes:
          type !== SERVER_TYPE_RANKED && type !== SERVER_TYPE_PRACTICE,
        use_game_server_node: !!game_server_node_id,
        game_server_node_id: game_server_node_id
          ? game_server_node_id.toString()
          : undefined,
        type: game_mode_id || type || "Ranked",
        connect_password: connect_password || "",
        max_players: max_players || 32,
      });
      this.dropStaleMode();
      this.takeSnapshot();
    },
    takeSnapshot() {
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      if (this.server) {
        this.populateServer(this.server);
      }
    },
    async updateCreateServer() {
      if (this.submitLock) {
        return;
      }
      this.submitLock = true;
      try {
        const { valid, errors } = await this.form.validate();

        if (!valid) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: Object.values(errors ?? {})[0] as string,
          });
          return;
        }

        this.submitting = true;
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
                    ...this.resolveTypeAndMode(),
                    label: formValues.label,
                    game: formValues.game || "cs2",
                    rcon_password: formValues.rcon_password,
                    connect_password: formValues.connect_password,
                    max_players: formValues.max_players,
                    ...(!this.server.game_server_node_id
                      ? {
                          host: formValues.host,
                          port: formValues.port,
                          tv_port: formValues.tv_port,
                          region: formValues.region,
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
          this.takeSnapshot();
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
                  ...this.resolveTypeAndMode(),
                  label: formValues.label,
                  game: formValues.game || "cs2",
                  region: formValues.use_game_server_node
                    ? ""
                    : formValues.region,
                  game_server_node_id: formValues.use_game_server_node
                    ? formValues.game_server_node_id
                    : null,
                  host: formValues.use_game_server_node
                    ? "127.0.0.1"
                    : formValues.host,
                  port: formValues.use_game_server_node
                    ? 27015
                    : formValues.port,
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
      } finally {
        this.submitLock = false;
        this.submitting = false;
      }
    },
  },
};
</script>
