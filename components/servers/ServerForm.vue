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
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  ArrowRightLeft,
  Eye,
  EyeOff,
  Globe,
  Info,
  Lock,
  Search,
  Server,
  X,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

const showConnectPassword = ref(false);
const showRconPassword = ref(false);

// Server secrets, not a login: keep password managers from offering to fill
// or save them.
const passwordManagerIgnore = {
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
};

const gameOptions = [
  { key: "cs2", label: "CS2" },
  { key: "csgo", label: "CS:GO" },
];

const subLabelClasses =
  "font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground";
const tagClasses =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase leading-none tracking-[0.12em] text-muted-foreground";
const noteClasses =
  "flex items-start gap-2.5 rounded-md bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground";
const iconBoxClasses =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors";
</script>

<template>
  <form
    @submit.prevent="updateCreateServer"
    class="grid gap-8"
    :class="{ 'pb-24': !server }"
  >
    <FormSection :title="$t('server.form.where_it_runs')">
      <div class="space-y-3">
        <!-- The region comes first whatever hosts the server: it is where
             an external server is listed, and it narrows the nodes below. -->
        <div v-if="!isEditingGameServerNode" class="grid sm:grid-cols-2">
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

        <!-- Inside a <form> reka's radio stops its click from bubbling,
             so a tile's @click never sees a click on the circle. -->
        <RadioGroup
          v-if="!server && gameServerNodes.length > 0"
          :model-value="hosting"
          class="grid gap-3 sm:grid-cols-2"
          @update:model-value="setHosting"
        >
          <div
            :class="tileClass(hosting === 'node')"
            class="flex-col gap-3 p-4"
            @click="setHosting('node')"
          >
            <div class="flex items-start justify-between gap-3">
              <span
                :class="[
                  iconBoxClasses,
                  hosting === 'node'
                    ? 'border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground',
                ]"
              >
                <Server class="h-4 w-4" />
              </span>
              <RadioGroupItem id="hosting-node" value="node" />
            </div>
            <div class="grid gap-1.5 leading-none">
              <label
                class="cursor-pointer text-sm font-medium leading-none"
                for="hosting-node"
              >
                {{ $t("server.form.game_server_node") }}
              </label>
              <p class="text-sm text-muted-foreground">
                {{ $t("server.form.game_server_node_hosting_description") }}
              </p>
            </div>
          </div>
          <div
            :class="tileClass(hosting === 'external')"
            class="flex-col gap-3 p-4"
            @click="setHosting('external')"
          >
            <div class="flex items-start justify-between gap-3">
              <span
                :class="[
                  iconBoxClasses,
                  hosting === 'external'
                    ? 'border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground',
                ]"
              >
                <Globe class="h-4 w-4" />
              </span>
              <RadioGroupItem id="hosting-external" value="external" />
            </div>
            <div class="grid gap-1.5 leading-none">
              <label
                class="cursor-pointer text-sm font-medium leading-none"
                for="hosting-external"
              >
                {{ $t("server.form.external_server") }}
              </label>
              <p class="text-sm text-muted-foreground">
                {{ $t("server.form.external_server_description") }}
              </p>
            </div>
          </div>
        </RadioGroup>

        <!-- Where an existing server runs is fixed; a node server changes
             nodes through the move dialog. -->
        <template v-if="server">
          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-muted/20 px-4 py-3"
          >
            <span
              :class="iconBoxClasses"
              class="border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]"
            >
              <Server v-if="isEditingGameServerNode" class="h-4 w-4" />
              <Globe v-else class="h-4 w-4" />
            </span>
            <div class="grid min-w-0 flex-1 gap-0.5">
              <span class="text-sm font-medium">
                {{
                  isEditingGameServerNode
                    ? $t("server.form.game_server_node")
                    : $t("server.form.external_server")
                }}
                <span
                  v-if="isEditingGameServerNode"
                  class="ml-1 font-mono"
                  data-testid="current-node"
                  >{{ currentNodeName }}</span
                >
              </span>
              <span
                v-if="isEditingGameServerNode && currentNodeDetail"
                class="break-words font-mono text-[0.7rem] text-muted-foreground"
              >
                {{ currentNodeDetail }}
              </span>
            </div>
            <Button
              v-if="canMoveNode"
              type="button"
              variant="outline"
              size="sm"
              class="shrink-0 gap-2"
              @click="$emit('move')"
            >
              <ArrowRightLeft class="h-4 w-4" />
              {{ $t("server.form.move_node") }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            {{
              isEditingGameServerNode
                ? $t("server.form.move_node_hint")
                : $t("server.form.external_server_fixed")
            }}
          </p>
        </template>

        <Fold
          :open="!server && useGameServerNode && gameServerNodes.length > 0"
        >
          <div class="server-form-drawer">
            <p
              v-if="regionNodeOptions.length === 0"
              class="py-2 text-center text-sm text-muted-foreground"
            >
              {{
                form.values.region
                  ? $t("server.form.no_nodes_in_region")
                  : $t("server.form.node_pick_region")
              }}
            </p>
            <div
              v-if="showNodeFilters"
              class="flex flex-wrap items-center gap-2"
            >
              <InputGroup class="h-8 min-w-[12rem] flex-1">
                <InputGroupAddon class="pl-2.5">
                  <Search class="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  v-model="nodeSearch"
                  :placeholder="$t('server.form.search_nodes')"
                  class="h-full text-sm"
                  data-testid="node-search"
                />
                <InputGroupAddon align="inline-end" class="pr-2">
                  <button
                    v-if="nodeSearch"
                    type="button"
                    class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    @click="nodeSearch = ''"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </InputGroupAddon>
              </InputGroup>
              <span
                class="ml-auto font-mono text-[0.65rem] tabular-nums text-muted-foreground"
              >
                {{
                  $t("server.form.nodes_shown", {
                    shown: visibleNodeOptions.length,
                    total: regionNodeOptions.length,
                  })
                }}
              </span>
            </div>
            <FormField
              v-if="regionNodeOptions.length > 0"
              v-slot="{ componentField }"
              name="game_server_node_id"
            >
              <FormItem>
                <FormControl>
                  <RadioGroup
                    v-bind="componentField"
                    class="grid max-h-[26rem] gap-2 overflow-y-auto"
                  >
                    <div
                      v-for="node in visibleNodeOptions"
                      :key="node.id"
                      :class="
                        tileClass(
                          componentField.modelValue === node.id,
                          !!node.reason,
                        )
                      "
                      class="items-start gap-3 px-3 py-2.5"
                      data-testid="node-option"
                      @click="
                        node.reason ||
                        componentField['onUpdate:modelValue'](node.id)
                      "
                    >
                      <RadioGroupItem
                        :id="`node-${node.id}`"
                        :value="node.id"
                        :disabled="!!node.reason"
                        class="mt-0.5"
                      />
                      <div class="grid min-w-0 flex-1 gap-1">
                        <div
                          class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        >
                          <label
                            :for="`node-${node.id}`"
                            class="text-sm font-medium leading-none"
                            :class="[
                              node.unlabeled && 'font-mono',
                              node.reason
                                ? 'cursor-not-allowed'
                                : 'cursor-pointer',
                            ]"
                          >
                            {{ node.name }}
                          </label>
                          <span
                            v-if="!node.unlabeled"
                            class="font-mono text-[0.7rem] text-muted-foreground/70"
                          >
                            {{ node.id }}
                          </span>
                          <span
                            v-if="node.region"
                            class="text-xs text-muted-foreground"
                          >
                            {{ node.region }}
                          </span>
                        </div>
                        <span
                          class="break-words font-mono text-[0.7rem] leading-snug text-muted-foreground"
                        >
                          {{ node.detail }}
                        </span>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          v-if="node.reason"
                          :class="tagClasses"
                          class="text-foreground"
                        >
                          <Lock
                            class="h-2.5 w-2.5 text-[hsl(var(--tac-amber))]"
                          />
                          {{ node.reason }}
                        </span>
                        <span v-if="node.gpu" :class="tagClasses">GPU</span>
                      </div>
                    </div>
                    <p
                      v-if="visibleNodeOptions.length === 0"
                      class="py-3 text-center text-sm text-muted-foreground"
                    >
                      {{ $t("server.form.no_nodes_match") }}
                    </p>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </Fold>

        <Fold :open="!useGameServerNode && !isEditingGameServerNode">
          <div
            :class="
              !server && gameServerNodes.length > 0
                ? 'server-form-drawer server-form-drawer--right'
                : 'grid gap-4'
            "
          >
            <div
              class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <FormField v-slot="{ componentField }" name="host" keep-value>
                <FormItem>
                  <FormLabel>{{ $t("server.form.host") }}</FormLabel>
                  <FormControl>
                    <Input v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="port" keep-value>
                <FormItem>
                  <FormLabel>{{ $t("server.form.port") }}</FormLabel>
                  <FormControl>
                    <Input type="number" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="tv_port" keep-value>
                <FormItem>
                  <FormLabel>{{ $t("server.form.tv_port") }}</FormLabel>
                  <FormControl>
                    <Input type="number" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <p v-if="!server" class="text-xs text-muted-foreground">
              {{ $t("server.form.external_plugin_hint") }}
            </p>
          </div>
        </Fold>
      </div>
    </FormSection>

    <FormSection :title="$t('server.form.what_it_plays')">
      <template #actions>
        <AnimatedFilters
          square
          :options="gameOptions"
          :model-value="form.values.game"
          @update:model-value="form.setFieldValue('game', $event)"
        />
      </template>

      <div class="space-y-3">
        <RadioGroup
          :model-value="serverKind"
          class="grid gap-3 sm:grid-cols-2"
          @update:model-value="setServerKind"
        >
          <div
            v-for="kind in kindOptions"
            :key="kind.value"
            :class="tileClass(serverKind === kind.value, !!kind.lock)"
            class="items-start gap-3 p-3"
            @click="kind.lock || setServerKind(kind.value)"
          >
            <RadioGroupItem
              :id="`kind-${kind.value}`"
              :value="kind.value"
              :disabled="!!kind.lock"
              class="mt-0.5"
            />
            <div class="grid min-w-0 flex-1 gap-1.5 leading-none">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label
                  :for="`kind-${kind.value}`"
                  class="text-sm font-medium leading-none"
                  :class="kind.lock ? 'cursor-not-allowed' : 'cursor-pointer'"
                >
                  {{ kind.label }}
                </label>
                <span v-if="kind.lock" :class="tagClasses">
                  <Lock class="h-2.5 w-2.5" />
                  {{ kind.lock }}
                </span>
              </div>
              <p class="text-sm leading-snug text-muted-foreground">
                {{ kind.description }}
              </p>
            </div>
          </div>
        </RadioGroup>

        <Fold :open="serverKind === 'valve'">
          <div class="server-form-drawer">
            <span :class="subLabelClasses">
              {{ $t("server.form.valve_preset_group") }}
            </span>
            <AnimatedFilters
              :options="valvePresetOptions"
              :model-value="form.values.type"
              @update:model-value="form.setFieldValue('type', $event)"
            />
          </div>
        </Fold>

        <Fold :open="serverKind === 'presets'">
          <div class="server-form-drawer server-form-drawer--right">
            <div class="flex items-center justify-between gap-3">
              <span :class="subLabelClasses">
                {{ $t("server.form.custom_mode_group") }}
              </span>
              <!-- What a mode loads and how it boots belongs to the mode,
                   not the server, so it is edited where modes live. -->
              <NuxtLink
                v-if="isAdmin && isCustomModeSelected"
                :to="editModeLink"
                class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
                data-testid="edit-game-mode"
              >
                {{ $t("server.form.edit_mode") }}
              </NuxtLink>
            </div>
            <RadioGroup
              v-if="customModes.length > 0"
              :model-value="form.values.type"
              class="grid gap-2"
              @update:model-value="form.setFieldValue('type', $event)"
            >
              <div
                v-for="gameMode in customModes"
                :key="gameMode.id"
                :class="
                  tileClass(form.values.type === gameMode.id, !runsOnNode)
                "
                class="items-start gap-3 px-3 py-2.5"
                data-testid="custom-mode-option"
                @click="!runsOnNode || form.setFieldValue('type', gameMode.id)"
              >
                <RadioGroupItem
                  :id="`mode-${gameMode.id}`"
                  :value="gameMode.id"
                  :disabled="!runsOnNode"
                  class="mt-0.5"
                />
                <div class="grid min-w-0 flex-1 gap-1 leading-none">
                  <label
                    :for="`mode-${gameMode.id}`"
                    class="cursor-pointer text-sm font-medium leading-none"
                  >
                    {{ gameMode.name }}
                  </label>
                  <p
                    v-if="gameMode.description"
                    class="text-xs leading-snug text-muted-foreground"
                  >
                    {{ gameMode.description }}
                  </p>
                </div>
              </div>
            </RadioGroup>
            <p v-else class="text-sm text-muted-foreground">
              {{ $t("server.form.no_custom_modes") }}
            </p>
          </div>
        </Fold>

        <Fold :open="!!kindNote">
          <p :class="noteClasses">
            <Info
              class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <span>
              {{ kindNote }}
              <button
                v-if="canRunOnNode"
                type="button"
                class="font-medium text-[hsl(var(--tac-amber))] underline decoration-[hsl(var(--tac-amber)/0.45)] underline-offset-4 hover:decoration-[hsl(var(--tac-amber))]"
                @click="runOnNode"
              >
                {{ $t("server.form.run_on_node") }}
              </button>
            </span>
          </p>
        </Fold>
      </div>
    </FormSection>

    <FormSection :title="$t('server.form.name_and_access')">
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField v-slot="{ componentField }" name="label">
            <FormItem>
              <FormLabel>{{ $t("server.form.label") }}</FormLabel>
              <FormControl>
                <Input
                  v-bind="{ ...componentField, ...passwordManagerIgnore }"
                  @input="labelTouched = true"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="rcon_password">
            <FormItem>
              <FormLabel>{{ $t("server.form.rcon_password") }}</FormLabel>
              <FormControl>
                <div class="relative">
                  <Input
                    :type="showRconPassword ? 'text' : 'password'"
                    v-bind="{ ...componentField, ...passwordManagerIgnore }"
                    class="pr-28"
                  />
                  <div
                    class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      tabindex="-1"
                      @click="showRconPassword = !showRconPassword"
                    >
                      <Eye v-if="!showRconPassword" class="h-4 w-4" />
                      <EyeOff v-else class="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-7 px-2 text-xs"
                      @click="
                        generateRconPassword();
                        showRconPassword = true;
                      "
                    >
                      {{ $t("server.form.generate") }}
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                {{
                  server
                    ? $t("server.form.rcon_password_description")
                    : $t("server.form.rcon_password_create_description")
                }}
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <Fold :open="!isManagedRankedServer">
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField v-slot="{ componentField }" name="connect_password">
              <FormItem>
                <FormLabel>{{ $t("server.form.connect_password") }}</FormLabel>
                <FormControl>
                  <div class="relative">
                    <Input
                      :type="showConnectPassword ? 'text' : 'password'"
                      v-bind="{ ...componentField, ...passwordManagerIgnore }"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
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
              keep-value
            >
              <FormItem>
                <FormLabel>{{ $t("server.form.max_players") }}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="32"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormDescription>{{
                  $t("server.form.max_players_description")
                }}</FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>
        </Fold>

        <Fold :open="isManagedRankedServer">
          <p :class="noteClasses">
            <Lock
              class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <span>{{ $t("server.form.ranked_access_managed") }}</span>
          </p>
        </Fold>
      </div>
    </FormSection>

    <SettingsSaveBar
      v-if="!server"
      force-visible
      hide-discard
      :valid="missingFields.length === 0"
      :submitting="submitting"
      :title="
        missingFields.length
          ? $t('server.form.create_bar.missing', {
              fields: missingFields.join(', '),
            })
          : $t('server.form.create_bar.ready')
      "
      :description="createSummary"
      :action-label="$t('server.form.create')"
      @save="updateCreateServer"
    />

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

<style scoped>
/* A choice's follow-up fields hang off it: the caret points up at the tile
   in the column the drawer belongs to. */
.server-form-drawer {
  position: relative;
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: color-mix(in hsl, hsl(var(--muted)) 22%, hsl(var(--background)));
}
.server-form-drawer::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 25%;
  width: 10px;
  height: 10px;
  background: inherit;
  border-left: 1px solid hsl(var(--border));
  border-top: 1px solid hsl(var(--border));
  transform: translateX(-50%) rotate(45deg);
}
.server-form-drawer--right::before {
  left: 75%;
}
/* Stacked tiles leave no column to point at. */
@media (max-width: 639px) {
  .server-form-drawer::before {
    display: none;
  }
}
</style>

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
import { useAuthStore } from "~/stores/AuthStore";
import { formatBytes, moveTargetIneligibility } from "~/types/serverMigration";

// Literals rather than the generated enum: a type added by a migration is
// absent from ~/generated/zeus until codegen runs against a migrated database,
// and a server holding one must not read as a custom mode id -- dropStaleMode
// would rewrite it to a preset and save that.
const SERVER_TYPE_RANKED = "Ranked";
const SERVER_TYPE_PRACTICE = "Practice";
const SERVER_TYPE_CUSTOM = "Custom";

// Past this many nodes the picker gets a search and a region filter.
const NODE_FILTER_THRESHOLD = 6;

export default {
  emits: ["updated", "move"],
  props: {
    server: {
      type: Object,
      required: false,
    },
    canMove: {
      type: Boolean,
      default: false,
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
              status: true,
              enabled: true,
              enabled_for_match_making: true,
              gpu: true,
              node_ip: true,
              public_ip: true,
              build_id: true,
              csgo_build_id: true,
              update_status: true,
              start_port_range: true,
              end_port_range: true,
              disk_available_gb: true,
              available_dedicated_slot_count: true,
              e_region: {
                description: true,
              },
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.gameServerNodes = data.game_server_nodes;
          // A new server starts on a node when one can take it.
          if (
            !this.server &&
            !this.hostingTouched &&
            this.nodeOptions.some((node) => !node.reason)
          ) {
            this.form.setFieldValue("use_game_server_node", true);
          }
        },
      },
    },
  },
  data() {
    return {
      submitting: false,
      hostingTouched: false,
      labelTouched: false,
      nodeSearch: "",
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
              port: z.number().min(2).max(65535).optional().default(27015),
              tv_port: z.number().min(2).max(65535).optional().default(27020),
              rcon_password: z.string().optional(),
              max_players: z.number().min(1).max(32).optional().default(16),
            })
            .refine(
              (data) => {
                if (!data.use_game_server_node) {
                  return data.host && data.port && data.tv_port;
                }
                return true;
              },
              {
                message:
                  "Host and ports are required when not using a game server node",
                path: ["host"],
              },
            )
            .refine(
              (data) => {
                // A node server's region is its node's.
                if (this.server?.game_server_node_id) {
                  return true;
                }
                return !!data.region;
              },
              {
                message: this.$t("server.form.select_region"),
                path: ["region"],
              },
            )
            .refine(
              (data) => {
                if (!data.use_game_server_node || this.server) {
                  return true;
                }
                return (
                  !!data.game_server_node_id &&
                  data.game_server_node_id !== "none"
                );
              },
              {
                message: this.$t("server.form.select_game_server_node"),
                path: ["game_server_node_id"],
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
          selected === SERVER_TYPE_RANKED || selected === SERVER_TYPE_PRACTICE;

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
    // Switching to a manual host leaves a custom mode with nothing to install
    // into; fall back to a preset rather than save a mode the server could
    // not boot with.
    runsOnNode(runs: boolean) {
      if (!runs && this.holdsModeId) {
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
    // Drop a pick that left the region or can no longer take the server
    // (the game flipped to csgo, say).
    regionNodeOptions(options: Array<Record<string, any>>) {
      const picked = this.form.values.game_server_node_id;
      if (
        !this.server &&
        picked &&
        !options.some((node) => node.id === picked && !node.reason)
      ) {
        this.form.setFieldValue("game_server_node_id", "");
      }
    },
    suggestedLabel: {
      immediate: true,
      handler(label: string) {
        if (!this.server && !this.labelTouched) {
          this.form.setFieldValue("label", label);
        }
      },
    },
  },
  computed: {
    isAdmin(): boolean {
      return useAuthStore().isAdmin;
    },
    editModeLink() {
      return {
        path: "/settings/application/game-modes",
        query: { mode: this.form.values.type },
      };
    },
    isManagedRankedServer() {
      return this.form.values.type === SERVER_TYPE_RANKED;
    },
    useGameServerNode() {
      return this.form.values.use_game_server_node;
    },
    hosting(): string {
      return this.useGameServerNode ? "node" : "external";
    },
    // Every node is listed, with the reason one can't take this server --
    // the same checks the move dialog makes, plus GPU-only nodes, which have
    // no region or game ports.
    nodeOptions(): Array<Record<string, any>> {
      return this.gameServerNodes
        .map((node: Record<string, any>) => ({
          id: node.id,
          name: node.label || node.id,
          unlabeled: !node.label,
          region: node.e_region?.description || node.region,
          regionValue: node.region,
          gpu: !!node.gpu,
          reason: this.nodeReason(node),
          detail: [
            node.public_ip || node.node_ip,
            node.start_port_range && node.end_port_range
              ? this.$t("server.form.node_ports", {
                  range: `${node.start_port_range}–${node.end_port_range}`,
                })
              : null,
            node.available_dedicated_slot_count != null
              ? this.$t("pages.dedicated_servers.detail.move.free_slots", {
                  count: node.available_dedicated_slot_count,
                })
              : null,
            node.disk_available_gb != null
              ? this.$t("pages.dedicated_servers.detail.move.free_disk", {
                  size: formatBytes(node.disk_available_gb * 1024 ** 3),
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))
        .sort(
          (a, b) =>
            Number(!!a.reason) - Number(!!b.reason) ||
            a.name.localeCompare(b.name),
        );
    },
    // A GPU-only node has no region, so it never lists here.
    regionNodeOptions(): Array<Record<string, any>> {
      const region = this.form.values.region;
      return region
        ? this.nodeOptions.filter((node) => node.regionValue === region)
        : [];
    },
    showNodeFilters(): boolean {
      return this.regionNodeOptions.length > NODE_FILTER_THRESHOLD;
    },
    // The picked node stays listed whatever the search says, so the choice
    // never disappears from under the form.
    visibleNodeOptions(): Array<Record<string, any>> {
      const search = this.nodeSearch.trim().toLowerCase();
      if (!this.showNodeFilters || !search) {
        return this.regionNodeOptions;
      }
      const picked = this.form.values.game_server_node_id;
      return this.regionNodeOptions.filter(
        (node) =>
          node.id === picked ||
          [node.name, node.id, node.detail].some((value) =>
            value?.toLowerCase().includes(search),
          ),
      );
    },
    // Region plus what it plays, until someone names the server themselves.
    suggestedLabel(): string {
      const region = this.server_regions?.find(
        (option: Record<string, any>) =>
          option.value === this.form.values.region,
      );
      return [region?.description || region?.value, this.playsLabel]
        .filter(Boolean)
        .join(" ");
    },
    playsLabel(): string | undefined {
      const values = this.form.values;
      if (this.serverKind === "presets") {
        return this.customModes.find((mode) => mode.id === values.type)?.name;
      }
      if (this.serverKind === "valve") {
        return values.type;
      }
      return this.kindOptions.find((kind) => kind.value === this.serverKind)
        ?.label;
    },
    currentNode(): Record<string, any> | undefined {
      return this.gameServerNodes.find(
        (node: Record<string, any>) =>
          node.id === this.server?.game_server_node_id,
      );
    },
    currentNodeName(): string {
      return (
        this.currentNode?.label ||
        this.currentNode?.id ||
        this.server?.game_server_node_id
      );
    },
    currentNodeDetail(): string {
      const node = this.currentNode;
      return node
        ? [
            node.e_region?.description || node.region,
            node.public_ip || node.node_ip,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
    },
    kindOptions(): Array<Record<string, any>> {
      return [
        {
          value: "ranked",
          label: this.$t("server.form.ranked_server"),
          description: this.$t("server.form.ranked_server_description"),
        },
        {
          value: "practice",
          label: this.$t("server.form.practice_server"),
          description: this.$t("server.form.practice_server_description"),
        },
        {
          value: "valve",
          label: this.$t("server.form.valve_modes"),
          description: this.$t("server.form.valve_modes_description"),
        },
        {
          value: "presets",
          label: this.$t("server.form.custom_presets"),
          description: this.$t("server.form.custom_presets_description"),
        },
      ].map((kind) => ({ ...kind, lock: this.kindLock(kind.value) }));
    },
    kindNote(): string {
      if (this.form.values.game === "csgo") {
        return this.$t("server.form.csgo_valve_only");
      }
      if (!this.runsOnNode) {
        return this.$t("server.form.custom_modes_need_node");
      }
      return "";
    },
    canRunOnNode(): boolean {
      return (
        !this.server &&
        this.form.values.game !== "csgo" &&
        (this.form.values.region
          ? this.regionNodeOptions
          : this.nodeOptions
        ).some((node) => !node.reason)
      );
    },
    valvePresetOptions(): Array<{ key: string; label: string }> {
      return this.valveModeTypes.map((type: string) => ({
        key: type,
        label: type,
      }));
    },
    missingFields(): Array<string> {
      const values = this.form.values;
      const missing = [];
      if (!values.region) {
        missing.push(this.$t("server.form.region"));
      }
      if (values.use_game_server_node) {
        const node = this.nodeOptions.find(
          (option) => option.id === values.game_server_node_id,
        );
        if (!node || node.reason) {
          missing.push(this.$t("server.form.game_server_node"));
        }
      } else if (!values.host) {
        missing.push(this.$t("server.form.host"));
      }
      if ((values.label ?? "").trim().length < 3) {
        missing.push(this.$t("server.form.label"));
      }
      if (!values.rcon_password) {
        missing.push(this.$t("server.form.rcon_password"));
      }
      return missing;
    },
    createSummary(): string {
      const values = this.form.values;
      const plays = this.playsLabel;
      const node = this.nodeOptions.find(
        (option) => option.id === values.game_server_node_id,
      );
      const where = values.use_game_server_node
        ? node && [node.name, node.region].filter(Boolean).join(" · ")
        : values.host && `${values.host}:${values.port}`;
      return [values.game === "csgo" ? "CS:GO" : "CS2", plays, where]
        .filter(Boolean)
        .join(" · ");
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
    canMoveNode() {
      return this.isEditingGameServerNode && this.canMove;
    },
    isEditingGameServerNode() {
      return !!(this.server && this.server.game_server_node_id);
    },
    // True before a node is picked: the schema requires one on submit, and
    // gating the modes on the pick greys them out in the meantime.
    runsOnNode(): boolean {
      if (this.server) {
        return this.isEditingGameServerNode;
      }
      return !!this.form.values.use_game_server_node;
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
    kindLock(kind: string): string | null {
      if (this.form.values.game === "csgo" && kind !== "valve") {
        return this.$t("server.form.cs2_only");
      }
      if (kind === "presets" && !this.runsOnNode) {
        return this.$t("server.form.needs_node");
      }
      return null;
    },
    nodeReason(node: Record<string, any>): string | null {
      if (node.gpu && !node.enabled_for_match_making) {
        return this.$t("server.form.node_gpu_only");
      }
      const reason = moveTargetIneligibility(node as any, {
        game: this.form.values.game,
        game_server_node_id: null,
      });
      return reason
        ? this.$t(`pages.dedicated_servers.detail.move.reason.${reason.key}`, {
            game: "game" in reason ? reason.game : "",
          })
        : null;
    },
    tileClass(selected: boolean, disabled = false): Array<string> {
      return [
        "flex rounded-lg border transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : selected
            ? "cursor-pointer"
            : "cursor-pointer hover:bg-muted/50",
        selected
          ? "border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]"
          : "",
      ];
    },
    setHosting(hosting: string) {
      this.hostingTouched = true;
      this.form.setFieldValue("use_game_server_node", hosting === "node");
    },
    runOnNode() {
      this.setHosting("node");
      this.setServerKind("presets");
    },
    generateRconPassword() {
      const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      this.form.setFieldValue(
        "rcon_password",
        Array.from(
          crypto.getRandomValues(new Uint8Array(20)),
          (byte) => chars[byte % chars.length],
        ).join(""),
      );
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

          const { data } = await this.$apollo.mutate({
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

          if (!data?.update_servers_by_pk) {
            toast({
              variant: "destructive",
              title: this.$t("common.error"),
              description: this.$t(
                "pages.dedicated_servers.detail.migration.locked",
              ),
            });
            return;
          }

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
