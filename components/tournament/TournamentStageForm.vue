<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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
import { Switch } from "~/components/ui/switch";
import { Card } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "~/components/ui/collapsible";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "~/components/ui/number-field";
import {
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  SettingsIcon,
} from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";
import StageRoundBestOfConfig from "~/components/tournament/StageRoundBestOfConfig.vue";
import { $ } from "~/generated/zeus";
</script>

<template>
  <form @submit.prevent="updateCreateStage" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="groups">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.groups") }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="number"
            min="1"
            :placeholder="$t('tournament.stage.groups_placeholder')"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="stage_type">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.type") }}</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('tournament.stage.type_placeholder')"
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="type in e_tournament_stage_types"
                :key="type.value"
                :value="type.value"
              >
                {{ type.description }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="min_teams">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.min_teams") }}</FormLabel>
        <FormControl>
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue
                  :placeholder="$t('tournament.stage.min_teams_placeholder')"
                />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in minTeamOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.display }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="max_teams">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.max_teams") }}</FormLabel>
        <FormControl>
          <Select v-bind="componentField">
            <FormControl :disabled="!form.values.min_teams">
              <SelectTrigger>
                <SelectValue
                  :placeholder="$t('tournament.stage.max_teams_placeholder')"
                />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in maxTeamOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.display }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Section A: Default Best Of -->
    <Card>
      <div class="p-4 space-y-4">
        <FormField v-slot="{ componentField }" name="default_best_of">
          <FormItem>
            <FormLabel class="text-lg font-semibold">{{
              $t("tournament.stage.default_best_of")
            }}</FormLabel>
            <FormDescription>
              {{ $t("tournament.stage.default_best_of_description") }}
            </FormDescription>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Best of 1</SelectItem>
                  <SelectItem value="3">Best of 3</SelectItem>
                  <SelectItem value="5">Best of 5</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </Card>

    <!-- Section B: Per-Round Best Of + Stage Options -->
    <Card
      v-if="
        form.values.stage_type &&
        form.values.stage_type !== 'RoundRobin' &&
        form.values.max_teams
      "
    >
      <div class="p-4 space-y-4">
        <StageRoundBestOfConfig
          :stage-type="form.values.stage_type"
          :max-teams="parseInt(form.values.max_teams)"
          :groups="form.values.groups || 1"
          :default-best-of="form.values.default_best_of || '1'"
          :model-value="roundBestOf"
          @update:model-value="roundBestOf = $event"
        />

        <!-- 3rd Place Match toggle (SE only) -->
        <FormField
          v-if="form.values.stage_type === 'SingleElimination'"
          v-slot="{ value, handleChange }"
          name="third_place_match"
        >
          <FormItem>
            <div
              class="flex flex-row items-center justify-between cursor-pointer"
              @click="handleChange(!value)"
            >
              <div class="space-y-0.5">
                <FormLabel class="text-lg font-semibold">{{
                  $t("tournament.stage.third_place_match")
                }}</FormLabel>
                <FormDescription>
                  {{ $t("tournament.stage.third_place_match_description") }}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  class="pointer-events-none"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>

        <!-- 3rd Place Best Of selector (visible when toggle is on) -->
        <FormField
          v-if="form.values.stage_type === 'SingleElimination' && form.values.third_place_match"
          v-slot="{ componentField }"
          name="decider_best_of"
        >
          <FormItem>
            <FormLabel>{{ $t("tournament.stage.decider_best_of") }}</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Best of 1</SelectItem>
                  <SelectItem value="3">Best of 3</SelectItem>
                  <SelectItem value="5">Best of 5</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </Card>

    <!-- Section C: Advanced Settings (collapsible) -->
    <Collapsible v-model:open="showAdvancedSettings">
      <CollapsibleTrigger as-child>
        <div
          class="flex items-center justify-between p-4 mb-4 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <SettingsIcon name="settings" class="h-5 w-5 text-foreground" />
            <span class="text-lg font-semibold">{{
              $t("tournament.stage.advanced_settings")
            }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-sm text-muted-foreground">
              {{
                showAdvancedSettings
                  ? $t("match.options.advanced.hide")
                  : $t("match.options.advanced.show")
              }}
            </span>
            <Button type="button" variant="ghost" size="icon" class="h-8 w-8">
              <ChevronUp
                v-if="showAdvancedSettings"
                class="h-4 w-4 transition-transform duration-200"
              />
              <ChevronDown
                v-else
                class="h-4 w-4 transition-transform duration-200"
              />
              <span class="sr-only">{{
                $t("match.options.advanced.toggle")
              }}</span>
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div class="flex flex-col gap-4">
          <!-- TV Delay -->
          <Card>
            <div class="flex flex-col space-y-3 p-4">
              <FormField v-slot="{ value }" name="tv_delay">
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.tv_delay.label")
                  }}</FormLabel>
                  <NumberField
                    class="gap-2"
                    :min="0"
                    :max="120"
                    :model-value="value"
                    @update:model-value="
                      (delay) => {
                        form.setFieldValue('tv_delay', delay);
                      }
                    "
                  >
                    <NumberFieldContent>
                      <NumberFieldDecrement />
                      <FormControl>
                        <NumberFieldInput />
                      </FormControl>
                      <NumberFieldIncrement />
                    </NumberFieldContent>
                  </NumberField>
                  <FormDescription>
                    {{ $t("match.options.advanced.tv_delay.range") }}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </Card>

          <!-- Region Options -->
          <Card v-if="availableRegions.length > 1">
            <div class="p-6 space-y-6">
              <div class="text-lg font-semibold">
                {{ $t("match.options.advanced.region.title") }}
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  v-slot="{ value, handleChange }"
                  name="region_veto"
                >
                  <FormItem>
                    <Card
                      class="cursor-pointer"
                      @click="handleChange(!value)"
                    >
                      <div class="flex flex-col space-y-3 p-4">
                        <div class="flex justify-between items-center">
                          <FormLabel class="text-lg font-semibold">{{
                            $t("match.options.advanced.region.veto.label")
                          }}</FormLabel>
                          <FormControl>
                            <Switch
                              class="pointer-events-none"
                              :model-value="value"
                              @update:model-value="handleChange"
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          {{
                            $t(
                              "match.options.advanced.region.veto.description",
                            )
                          }}
                        </FormDescription>
                      </div>
                    </Card>
                  </FormItem>
                </FormField>

                <FormField name="regions">
                  <FormItem>
                    <FormLabel>
                      <div class="text-lg font-semibold">
                        <template v-if="form.values.region_veto">
                          {{ $t("match.options.advanced.region.preferred") }}
                        </template>
                        <template v-else>{{
                          $t("match.options.advanced.region.single")
                        }}</template>
                      </div>
                    </FormLabel>

                    <FormControl>
                      <template v-if="!form.values.region_veto">
                        <Select
                          v-model="select_single_region"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                :placeholder="
                                  $t(
                                    'match.options.advanced.region.placeholder',
                                  )
                                "
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem
                                v-for="region in regions"
                                :key="region.value"
                                :value="region.value"
                              >
                                {{ region.description || region.value }}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </template>
                      <Popover v-else>
                        <PopoverTrigger as-child>
                          <Button
                            variant="outline"
                            role="combobox"
                            class="justify-between w-full"
                          >
                            <span
                              v-if="
                                form.values.regions &&
                                form.values.regions.length
                              "
                            >
                              {{
                                form.values.regions
                                  .map(
                                    (r) =>
                                      regions.find(
                                        (region) => region.value === r,
                                      )?.description,
                                  )
                                  .join(", ")
                              }}
                            </span>
                            <span v-else class="text-muted-foreground">
                              {{ $t("match.options.advanced.region.any") }}
                            </span>
                            <ChevronsUpDown
                              class="ml-2 h-4 w-4 shrink-0 opacity-50"
                            />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-[200px] p-0">
                          <Command>
                            <CommandList>
                              <CommandGroup>
                                <CommandItem
                                  v-for="region in regions"
                                  :key="region.value"
                                  :value="region.value"
                                  @select="
                                    () => {
                                      const currentRegions =
                                        form.values.regions || [];
                                      const index = currentRegions.indexOf(
                                        region.value,
                                      );
                                      if (index === -1) {
                                        form.setFieldValue('regions', [
                                          ...currentRegions,
                                          region.value,
                                        ]);
                                      } else {
                                        const updatedRegions = [
                                          ...currentRegions,
                                        ];
                                        updatedRegions.splice(index, 1);
                                        form.setFieldValue(
                                          'regions',
                                          updatedRegions,
                                        );
                                      }
                                    }
                                  "
                                >
                                  {{ region.description || region.value }}
                                  <Check
                                    :class="[
                                      'mr-2 h-4 mx-auto',
                                      form.values.regions?.includes(
                                        region.value,
                                      )
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    ]"
                                  />
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormDescription>
                      {{ $t("match.options.advanced.region.description") }}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>
            </div>
          </Card>

          <!-- Check-in, Ready, Tech Timeout -->
          <Card>
            <div class="p-4 space-y-6">
              <FormField
                v-if="canSetCheckInSettings"
                v-slot="{ componentField }"
                name="check_in_setting"
              >
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.check_in_settings.label")
                  }}</FormLabel>
                  <FormDescription>{{
                    $t("match.options.advanced.check_in_settings.description")
                  }}</FormDescription>
                  <FormControl>
                    <Select v-bind="componentField">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem
                            :value="setting.value"
                            v-for="setting in checkInSettings"
                            :key="setting.value"
                          >
                            {{ setting.display }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="ready_setting">
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.ready_settings.label")
                  }}</FormLabel>
                  <FormDescription>{{
                    $t("match.options.advanced.ready_settings.description")
                  }}</FormDescription>
                  <FormControl>
                    <Select v-bind="componentField">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem
                            :value="setting.value"
                            v-for="setting in readySettings"
                            :key="setting.value"
                          >
                            {{ setting.display }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField
                v-slot="{ componentField }"
                name="tech_timeout_setting"
              >
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.timeouts.technical.label")
                  }}</FormLabel>
                  <FormDescription>{{
                    $t(
                      "match.options.advanced.timeouts.technical.description",
                    )
                  }}</FormDescription>
                  <FormControl>
                    <Select v-bind="componentField">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem
                            :value="setting.value"
                            v-for="setting in timeoutSettings"
                            :key="setting.value"
                          >
                            {{ setting.display }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </Card>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="stage">{{ $t("tournament.stage.update") }}</template>
      <template v-else>{{ $t("tournament.stage.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import {
  e_tournament_stage_types_enum,
  e_ready_settings_enum,
  e_timeout_settings_enum,
  e_check_in_settings_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import { toTypedSchema } from "@vee-validate/zod";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

interface Region {
  value: string;
  description: string;
  is_lan: boolean;
}

interface EnumSetting {
  value: string;
  display: string;
}

export default {
  emits: ["updated"],
  props: {
    stage: {
      type: Object,
      required: false,
    },
    order: {
      type: Number,
      required: true,
    },
    tournament: {
      type: Object,
      required: false,
    },
  },
  apollo: {
    e_tournament_stage_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_tournament_stage_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
      result({
        data,
      }: {
        data: {
          e_tournament_stage_types: Array<{
            value: string;
            description: string;
          }>;
        };
      }) {
        (this as any).e_tournament_stage_types = data.e_tournament_stage_types;
      },
    },
  },
  data() {
    return {
      showAdvancedSettings: false,
      select_single_region: null as string | null,
      roundBestOf: {} as Record<string, string>,
      e_tournament_stage_types: [] as Array<{
        value: string;
        description: string;
      }>,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          z
            .object({
              groups: z.number().default(1),
              stage_type: z.string(),
              min_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "min teams must be a number",
              }),
              max_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "max teams must be a number",
              }),
              default_best_of: z.string().default("1"),
              third_place_match: z.boolean().default(false),
              decider_best_of: z.string().nullable().default(null),
              // Advanced settings (5 overridable fields)
              tv_delay: z.number().min(0).max(120).default(115),
              region_veto: z.boolean().default(true),
              regions: z.string().array().default([]),
              check_in_setting: z
                .string()
                .default(e_check_in_settings_enum.Players),
              ready_setting: z
                .string()
                .default(e_ready_settings_enum.Players),
              tech_timeout_setting: z
                .string()
                .default(e_timeout_settings_enum.Admin),
            })
            .refine(
              (data) => parseInt(data.min_teams) <= parseInt(data.max_teams),
              {
                message: "max teams must be greater than min teams",
                path: ["min_teams"],
              },
            ),
        ),
      }),
    };
  },
  watch: {
    stage: {
      immediate: true,
      handler(stage) {
        if (stage) {
          this.form.setValues({
            stage_type: stage.type,
            groups: stage.groups,
            min_teams: stage.min_teams.toString(),
            max_teams: stage.max_teams.toString(),
            default_best_of: (stage.default_best_of || 1).toString(),
            third_place_match: stage.third_place_match || false,
            decider_best_of: stage.decider_best_of ? stage.decider_best_of.toString() : null,
          });

          // Load per-round best_of from settings
          if (stage.settings?.round_best_of) {
            this.roundBestOf = { ...stage.settings.round_best_of };
            // Convert numeric values to strings for the form
            for (const key in this.roundBestOf) {
              this.roundBestOf[key] = this.roundBestOf[key].toString();
            }
          } else {
            this.roundBestOf = {};
          }

          // Load advanced settings from stage options or tournament options
          const options = stage.options || this.tournament?.options;
          if (options) {
            this.form.setValues({
              tv_delay: stage.options?.tv_delay ?? this.tournament?.options?.tv_delay ?? 115,
              region_veto: stage.options?.region_veto ?? this.tournament?.options?.region_veto ?? true,
              regions: stage.options?.regions ?? this.tournament?.options?.regions ?? [],
              check_in_setting: stage.options?.check_in_setting ?? this.tournament?.options?.check_in_setting ?? e_check_in_settings_enum.Players,
              ready_setting: stage.options?.ready_setting ?? this.tournament?.options?.ready_setting ?? e_ready_settings_enum.Players,
              tech_timeout_setting: stage.options?.tech_timeout_setting ?? this.tournament?.options?.tech_timeout_setting ?? e_timeout_settings_enum.Admin,
            });
          }
        } else {
          this.form.setValues({
            groups: 1,
          });
          this.setDefaultAdvancedSettings();
        }
      },
    },
    tournament: {
      immediate: true,
      handler() {
        if (!this.stage) {
          this.setDefaultAdvancedSettings();
        }
      },
    },
    select_single_region: {
      handler(select_single_region) {
        if (!this.form.values.region_veto) {
          this.form.setFieldValue("regions", [select_single_region]);
        }
      },
    },
    ["form.values.third_place_match"]: {
      handler(enabled: boolean) {
        if (enabled && !this.form.values.decider_best_of) {
          this.form.setFieldValue("decider_best_of", this.form.values.default_best_of || "1");
        }
        if (!enabled) {
          this.form.setFieldValue("decider_best_of", null);
        }
      },
    },
    ["form.values.region_veto"]: {
      handler() {
        this.setDefaultRegion();
      },
    },
  },
  computed: {
    minTeamOptions() {
      return this.baseNumberOfTeamsOptions;
    },
    maxTeamOptions() {
      if (!this.form.values.min_teams) {
        return;
      }
      return this.baseNumberOfTeamsOptions.filter((option) => {
        return parseInt(option.value) >= parseInt(this.form.values.min_teams);
      });
    },
    baseNumberOfTeamsOptions() {
      let max = 256;
      let options = [];

      switch (this.form.values.stage_type) {
        case e_tournament_stage_types_enum.SingleElimination:
        case e_tournament_stage_types_enum.DoubleElimination:
          while (max > 2) {
            options.push({
              value: max.toString(),
              display: max,
            });

            max--;
          }

          if (this.order > 1) {
            options.push({
              value: "2",
              display: 2,
            });
          }

          break;
        case e_tournament_stage_types_enum.RoundRobin:
          for (let i = 16; i >= 4; i -= 2) {
            options.push({
              value: i.toString(),
              display: i,
            });
          }
          break;
        case e_tournament_stage_types_enum.Swiss:
          for (let i = 64; i >= 10; i -= 2) {
            options.push({
              value: i.toString(),
              display: i,
            });
          }
          break;
      }

      return options.reverse();
    },
    availableRegions(): Region[] {
      return useApplicationSettingsStore().availableRegions;
    },
    regions(): Region[] {
      return this.availableRegions.filter((region: Region) => {
        return region.is_lan === false;
      });
    },
    canSetCheckInSettings() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    timeoutSettings(): EnumSetting[] {
      return [
        {
          display: this.$t("match.options.advanced.timeouts.options.admins"),
          value: e_timeout_settings_enum.Admin,
        },
        {
          display: this.$t("match.options.advanced.timeouts.options.coaches"),
          value: e_timeout_settings_enum.Coach,
        },
        {
          display: this.$t("match.options.advanced.timeouts.options.captains"),
          value: e_timeout_settings_enum.CoachAndCaptains,
        },
        {
          display: this.$t("match.options.advanced.timeouts.options.everyone"),
          value: e_timeout_settings_enum.CoachAndPlayers,
        },
      ];
    },
    checkInSettings(): EnumSetting[] {
      return [
        {
          display: this.$t(
            "match.options.advanced.check_in_settings.options.admins",
          ),
          value: e_check_in_settings_enum.Admin,
        },
        {
          display: this.$t(
            "match.options.advanced.check_in_settings.options.captains",
          ),
          value: e_check_in_settings_enum.Captains,
        },
        {
          display: this.$t(
            "match.options.advanced.check_in_settings.options.everyone",
          ),
          value: e_check_in_settings_enum.Players,
        },
      ];
    },
    readySettings(): EnumSetting[] {
      return [
        {
          display: this.$t(
            "match.options.advanced.ready_settings.options.admins",
          ),
          value: e_ready_settings_enum.Admin,
        },
        {
          display: this.$t(
            "match.options.advanced.ready_settings.options.captains",
          ),
          value: e_ready_settings_enum.Captains,
        },
        {
          display: this.$t(
            "match.options.advanced.ready_settings.options.coaches",
          ),
          value: e_ready_settings_enum.Coach,
        },
        {
          display: this.$t(
            "match.options.advanced.ready_settings.options.everyone",
          ),
          value: e_ready_settings_enum.Players,
        },
      ];
    },
  },
  methods: {
    setDefaultAdvancedSettings() {
      if (!this.tournament?.options) return;
      const options = this.tournament.options;
      this.form.setValues({
        tv_delay: options.tv_delay ?? 115,
        region_veto: options.region_veto ?? true,
        regions: options.regions ?? [],
        check_in_setting:
          options.check_in_setting ?? e_check_in_settings_enum.Players,
        ready_setting:
          options.ready_setting ?? e_ready_settings_enum.Players,
        tech_timeout_setting:
          options.tech_timeout_setting ?? e_timeout_settings_enum.Admin,
      });
    },
    setDefaultRegion() {
      const { region_veto } = this.form.values;

      if (!region_veto && this.regions.length > 0) {
        this.select_single_region = this.regions[0]?.value || null;
        return;
      }

      this.select_single_region = null;
      this.form.setFieldValue("regions", []);
    },
    hasAdvancedSettingsChanged() {
      if (!this.tournament) return false;

      const form = this.form.values;
      const tournamentOptions = this.tournament.options;

      if (
        form.tv_delay !== tournamentOptions.tv_delay ||
        form.region_veto !== tournamentOptions.region_veto ||
        form.check_in_setting !== tournamentOptions.check_in_setting ||
        form.ready_setting !== tournamentOptions.ready_setting ||
        form.tech_timeout_setting !== tournamentOptions.tech_timeout_setting
      ) {
        return true;
      }

      // Check regions
      const formRegions = form.regions || [];
      const tournamentRegions = tournamentOptions.regions || [];
      if (
        formRegions.length !== tournamentRegions.length ||
        formRegions.some(
          (r: string, i: number) => r !== tournamentRegions[i],
        )
      ) {
        return true;
      }

      return false;
    },
    async updateMatchOptions(
      matchOptionsId: string,
      form: any,
    ): Promise<string> {
      if (!this.tournament) throw new Error("Tournament is required");
      const tournamentOptions = this.tournament.options;

      await (this as any).$apollo.mutate({
        variables: {
          id: matchOptionsId,
          tv_delay: form.tv_delay,
          region_veto: form.region_veto,
          regions: form.regions || [],
          check_in_setting: form.check_in_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          // Keep tournament defaults for all other fields
          mr: tournamentOptions.mr,
          type: tournamentOptions.type,
          best_of: tournamentOptions.best_of,
          knife_round: tournamentOptions.knife_round,
          default_models: tournamentOptions.default_models,
          overtime: tournamentOptions.overtime,
          coaches: tournamentOptions.coaches,
          number_of_substitutes: tournamentOptions.number_of_substitutes,
          timeout_setting: tournamentOptions.timeout_setting,
          map_pool_id: tournamentOptions.map_pool.id,
        },
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: $("id", "uuid!"),
              },
              _set: {
                tv_delay: $("tv_delay", "Int!"),
                region_veto: $("region_veto", "Boolean!"),
                regions: $("regions", "[String!]!"),
                check_in_setting: $("check_in_setting", "e_check_in_settings_enum!"),
                ready_setting: $("ready_setting", "e_ready_settings_enum!"),
                tech_timeout_setting: $("tech_timeout_setting", "e_timeout_settings_enum!"),
                mr: $("mr", "Int!"),
                type: $("type", "e_match_types_enum!"),
                best_of: $("best_of", "Int!"),
                knife_round: $("knife_round", "Boolean!"),
                default_models: $("default_models", "Boolean!"),
                overtime: $("overtime", "Boolean!"),
                coaches: $("coaches", "Boolean!"),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
                timeout_setting: $("timeout_setting", "e_timeout_settings_enum!"),
                map_pool_id: $("map_pool_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
      return matchOptionsId;
    },
    async createMatchOptions(form: any): Promise<string> {
      if (!this.tournament) throw new Error("Tournament is required");
      const tournamentOptions = this.tournament.options;

      const { data } = await (this as any).$apollo.mutate({
        variables: {
          tv_delay: form.tv_delay,
          region_veto: form.region_veto,
          regions: form.regions || [],
          check_in_setting: form.check_in_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          // Keep tournament defaults for all other fields
          mr: tournamentOptions.mr,
          type: tournamentOptions.type,
          best_of: tournamentOptions.best_of,
          knife_round: tournamentOptions.knife_round,
          default_models: tournamentOptions.default_models,
          overtime: tournamentOptions.overtime,
          coaches: tournamentOptions.coaches,
          number_of_substitutes: tournamentOptions.number_of_substitutes,
          timeout_setting: tournamentOptions.timeout_setting,
          map_pool_id: tournamentOptions.map_pool.id,
        },
        mutation: generateMutation({
          insert_match_options_one: [
            {
              object: {
                tv_delay: $("tv_delay", "Int!"),
                region_veto: $("region_veto", "Boolean!"),
                regions: $("regions", "[String!]!"),
                check_in_setting: $("check_in_setting", "e_check_in_settings_enum!"),
                ready_setting: $("ready_setting", "e_ready_settings_enum!"),
                tech_timeout_setting: $("tech_timeout_setting", "e_timeout_settings_enum!"),
                mr: $("mr", "Int!"),
                type: $("type", "e_match_types_enum!"),
                best_of: $("best_of", "Int!"),
                knife_round: $("knife_round", "Boolean!"),
                default_models: $("default_models", "Boolean!"),
                overtime: $("overtime", "Boolean!"),
                coaches: $("coaches", "Boolean!"),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
                timeout_setting: $("timeout_setting", "e_timeout_settings_enum!"),
                map_pool_id: $("map_pool_id", "uuid!"),
                map_veto: true,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
      return data.insert_match_options_one.id;
    },
    async deleteMatchOptions(matchOptionsId: string): Promise<void> {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_match_options_by_pk: [
            {
              id: matchOptionsId,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    buildSettings(): any {
      // Only include non-default round_best_of entries
      const roundBestOf: Record<string, number> = {};
      for (const [key, value] of Object.entries(this.roundBestOf)) {
        roundBestOf[key] = parseInt(value);
      }

      if (Object.keys(roundBestOf).length === 0) {
        return null;
      }

      return { round_best_of: roundBestOf };
    },
    async updateCreateStage() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const form = this.form.values;
      const customAdvancedSettings = this.hasAdvancedSettingsChanged();
      const settings = this.buildSettings();

      if (this.stage) {
        // Handle match options for advanced settings
        let matchOptionsId: string | null = null;

        if (this.stage.options?.id) {
          if (customAdvancedSettings) {
            matchOptionsId = await this.updateMatchOptions(
              this.stage.options.id,
              form,
            );
          } else {
            // Remove stage-level match_options (matches tournament defaults)
            await (this as any).$apollo.mutate({
              mutation: generateMutation({
                update_tournament_stages_by_pk: [
                  {
                    pk_columns: {
                      id: this.stage.id,
                    },
                    _set: {
                      match_options_id: null,
                    },
                  },
                  {
                    __typename: true,
                  },
                ],
              }),
            });
            await this.deleteMatchOptions(this.stage.options.id);
            matchOptionsId = null;
          }
        } else {
          if (customAdvancedSettings) {
            matchOptionsId = await this.createMatchOptions(form);
          }
        }

        // Update stage
        const updateSet: any = {
          order: this.order,
          groups: this.form.values.groups,
          type: this.form.values.stage_type,
          min_teams: this.form.values.min_teams,
          max_teams: this.form.values.max_teams,
          default_best_of: parseInt(this.form.values.default_best_of),
          third_place_match: this.form.values.third_place_match || false,
          settings: $("settings", "jsonb"),
          decider_best_of: this.form.values.third_place_match
            ? parseInt(this.form.values.decider_best_of || this.form.values.default_best_of)
            : null,
        };

        if (matchOptionsId !== null) {
          updateSet.match_options_id = matchOptionsId;
        } else {
          updateSet.match_options_id = null;
        }

        await (this as any).$apollo.mutate({
          variables: {
            settings: settings,
          },
          mutation: generateMutation({
            update_tournament_stages_by_pk: [
              {
                pk_columns: {
                  id: this.stage.id,
                },
                _set: updateSet,
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

      // Create new stage
      let matchOptionsId: string | null = null;

      const { data: stageData } = await (this as any).$apollo.mutate({
        variables: {
          settings: settings,
        },
        mutation: generateMutation({
          insert_tournament_stages_one: [
            {
              object: {
                order: this.order,
                groups: this.form.values.groups,
                type: this.form.values.stage_type,
                min_teams: this.form.values.min_teams,
                max_teams: this.form.values.max_teams,
                default_best_of: parseInt(this.form.values.default_best_of),
                third_place_match: this.form.values.third_place_match || false,
                decider_best_of: this.form.values.third_place_match
                  ? parseInt(this.form.values.decider_best_of || this.form.values.default_best_of)
                  : null,
                settings: $("settings", "jsonb"),
                tournament_id:
                  (this as any).$route.params.tournamentId ||
                  (this as any).$route.params.id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      const stageId = stageData.insert_tournament_stages_one.id;

      // Create match options if advanced settings differ from tournament defaults
      if (customAdvancedSettings) {
        matchOptionsId = await this.createMatchOptions(form);

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_tournament_stages_by_pk: [
              {
                pk_columns: {
                  id: stageId,
                },
                _set: {
                  match_options_id: matchOptionsId,
                } as any,
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      }

      this.$emit("updated", this.order);
    },
  },
};
</script>
