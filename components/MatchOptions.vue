<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { FormControl } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import { Info } from "lucide-vue-next";
import {
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  SettingsIcon,
} from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "~/components/ui/collapsible";
import FiveStackToolTip from "./FiveStackToolTip.vue";
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Left Column -->
    <div class="space-y-6">
      <!-- Match Settings -->
      <div class="space-y-4">
        <slot name="left"></slot>

        <div class="grid grid-cols-1 gap-8 rounded-lg border p-4">
          <slot></slot>

          <FormField v-slot="{ componentField }" name="type">
            <FormItem>
              <FormLabel class="text-lg font-semibold">{{
                $t("match.options.type.label")
              }}</FormLabel>
              <RadioGroup
                v-bind="componentField"
                class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
              >
                <div
                  v-for="type in e_match_types"
                  :key="type.value"
                  class="flex items-center space-x-2 p-8 cursor-pointer"
                  @click="form.setFieldValue('type', type.value)"
                >
                  <RadioGroupItem :id="type.value" :value="type.value" />
                  <Label :for="type.value" class="flex flex-col cursor-pointer">
                    <span>{{ type.value }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{ type.description }}
                    </span>
                  </Label>
                </div>
              </RadioGroup>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="best_of">
            <FormItem>
              <FormLabel class="text-lg font-semibold">{{
                $t("match.options.best_of.label")
              }}</FormLabel>
              <FormDescription>
                {{ $t("match.options.best_of.description") }}
              </FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('match.options.best_of.placeholder')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      :value="bestOf.value"
                      v-for="bestOf in bestOfOptions"
                      :key="bestOf.value"
                    >
                      {{ bestOf.display }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <FormField
          v-slot="{ value, handleChange }"
          name="map_veto"
          v-if="!forceVeto"
        >
          <FormItem
            class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
            @click="handleChange(!value)"
          >
            <div class="flex justify-between items-center">
              <FormLabel class="text-lg font-semibold">{{
                $t("match.options.map_veto_settings.label")
              }}</FormLabel>
              <FormControl>
                <Switch
                  class="pointer-events-none"
                  :checked="value"
                  @update:checked="handleChange"
                />
              </FormControl>
            </div>
            <FormDescription>
              {{ $t("match.options.map_veto_settings.description") }}
            </FormDescription>
          </FormItem>
        </FormField>
      </div>

      <!-- Map Pool Selection -->
      <FormField name="map_pool">
        <FormItem>
          <Card>
            <CardHeader>
              <CardTitle class="flex justify-between items-center">
                <FormLabel class="text-lg font-semibold">
                  <template v-if="form.values.map_veto">
                    <template v-if="form.values.custom_map_pool">
                      {{ $t("match.options.map_veto_settings.custom_pool") }}
                      ({{ form.values.map_pool.length }})
                    </template>
                    <template v-else>{{
                      $t("match.options.map_veto_settings.active_duty")
                    }}</template>
                  </template>
                  <template v-else>{{ $t("maps.veto.pick") }}</template>
                </FormLabel>
                <div v-show="form.values.map_veto">
                  <FormField
                    v-slot="{ value, handleChange }"
                    name="custom_map_pool"
                  >
                    <FormControl>
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">
                          <FiveStackToolTip>
                            <template #trigger>
                              <Info :size="14"> </Info>
                              {{
                                $t(
                                  "match.options.map_veto_settings.custom_pool",
                                )
                              }}
                            </template>
                            {{
                              $t(
                                "match.options.map_veto_settings.custom_pool_tooltip",
                              )
                            }}
                          </FiveStackToolTip>
                        </span>
                        <Switch
                          :checked="value"
                          @update:checked="handleChange"
                        />
                      </div>
                    </FormControl>
                  </FormField>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-6">
                <template
                  v-for="(maps, type) in {
                    [$t('maps.official')]: availableMaps.official,
                    [$t('maps.workshop')]: availableMaps.workshop,
                  }"
                  :key="type"
                >
                  <div v-if="maps && maps.length > 0">
                    <Separator
                      v-if="type === 'Workshop Maps'"
                      class="text-2xl font-bold mb-4 text-center my-8"
                      :label="type"
                    ></Separator>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <template v-for="map in maps" :key="map.id">
                        <div
                          class="relative rounded-lg overflow-hidden transition-all duration-200 ease-in-out"
                          @click="updateMapPool(map.id)"
                          :class="{
                            'opacity-40':
                              form.values.custom_map_pool &&
                              !form.values.map_pool?.includes(map.id),
                            'cursor-pointer transform hover:scale-105':
                              form.values.custom_map_pool,
                          }"
                        >
                          <MapDisplay class="h-[150px]" :map="map">
                            <template v-slot:default v-if="map.active_pool">
                              <div class="absolute bottom-1">
                                <Badge variant="secondary" class="text-xs">{{
                                  $t("maps.active_duty")
                                }}</Badge>
                              </div>
                            </template>
                          </MapDisplay>
                          <div
                            class="absolute inset-0 flex items-center justify-center bg-opacity-40 transition-opacity duration-200"
                          ></div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </CardContent>
          </Card>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <!-- Server does not support coaches yet  -->
      <!-- <FormField v-slot="{ value, handleChange }" name="coaches">
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Allow Coaches</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription>
            Coaches will be spawned and killed at the start of each round.
          </FormDescription>
        </FormItem>
      </FormField> -->

      <Collapsible v-model:open="showAdvancedSettings">
        <CollapsibleTrigger as-child>
          <div
            class="flex items-center justify-between p-4 mb-4 bg-secondary rounded-lg cursor-pointer hover:bg-secondary-hover transition-colors duration-200 cursor-pointer"
          >
            <div class="flex items-center space-x-3">
              <SettingsIcon name="settings" class="h-5 w-5 text-primary" />
              <span class="text-lg font-semibold">{{
                $t("match.options.advanced.title")
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
                <ChevronDown
                  v-if="showAdvancedSettings"
                  class="h-4 w-4 transition-transform duration-200"
                />
                <ChevronUp
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
            <FormField v-slot="{ value, handleChange }" name="overtime">
              <FormItem
                class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                @click="handleChange(!value)"
              >
                <div class="flex justify-between items-center">
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.overtime.label")
                  }}</FormLabel>
                  <FormControl>
                    <Switch
                      class="pointer-events-none"
                      :checked="value"
                      @update:checked="handleChange"
                    />
                  </FormControl>
                </div>
                <FormDescription>
                  {{ $t("match.options.advanced.overtime.description") }}
                </FormDescription>
              </FormItem>
            </FormField>

            <FormField v-slot="{ value, handleChange }" name="knife_round">
              <FormItem
                class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                @click="handleChange(!value)"
              >
                <div class="flex justify-between items-center">
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.knife_round.label")
                  }}</FormLabel>
                  <FormControl>
                    <Switch
                      class="pointer-events-none"
                      :checked="value"
                      @update:checked="handleChange"
                    />
                  </FormControl>
                </div>
                <FormDescription>
                  {{ $t("match.options.advanced.knife_round.description") }}
                </FormDescription>
              </FormItem>
            </FormField>

            <div class="grid grid-cols-1 gap-8 rounded-lg border p-4">
              <FormField v-slot="{ componentField }" name="mr">
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.max_rounds.label")
                  }}</FormLabel>
                  <FormDescription>
                    {{ $t("match.options.advanced.max_rounds.description") }}
                  </FormDescription>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          :placeholder="
                            $t('match.options.advanced.max_rounds.placeholder')
                          "
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="rounds"
                          v-for="rounds in ['8', '12', '15']"
                          :key="rounds"
                        >
                          {{ rounds }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <Card v-if="availableRegions.length > 1">
              <CardHeader>
                <CardTitle class="flex justify-between items-center">
                  <div class="text-lg font-semibold">
                    {{ $t("match.options.advanced.region.title") }}
                  </div>
                  <div class="flex items-center gap-4" v-if="canSetLan">
                    <span>{{
                      $t("match.options.advanced.region.lan_match")
                    }}</span>
                    <Switch
                      :checked="form.values.lan"
                      @update:checked="
                        (checked) => form.setFieldValue('lan', checked)
                      "
                      aria-label="Toggle LAN Match"
                    />
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField v-slot="{ value, handleChange }" name="region_veto">
                  <FormItem
                    class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                    :class="{
                      'cursor-not-allowed': form.values.lan,
                    }"
                    @click="!form.values.lan && handleChange(!value)"
                  >
                    <div class="flex justify-between items-center">
                      <FormLabel class="text-lg font-semibold">{{
                        $t("match.options.advanced.region.veto.label")
                      }}</FormLabel>
                      <FormControl>
                        <Switch
                          class="pointer-events-none"
                          :checked="value"
                          @update:checked="
                            form.values.lan === false && handleChange
                          "
                          :disabled="form.values.lan"
                        />
                      </FormControl>
                    </div>
                    <FormDescription>
                      {{ $t("match.options.advanced.region.veto.description") }}
                    </FormDescription>
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
                      <template
                        v-if="form.values.lan || !form.values.region_veto"
                      >
                        <Select
                          v-model="select_single_region"
                          :options="regions"
                          option-label="description"
                          option-value="value"
                          class="w-full"
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
                                {{ region.description }}
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

                                        if (
                                          form.values.lan &&
                                          updatedRegions.length === 0
                                        ) {
                                          return;
                                        }

                                        form.setFieldValue(
                                          'regions',
                                          updatedRegions,
                                        );
                                      }
                                    }
                                  "
                                >
                                  {{ region.description }}
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
              </CardContent>
            </Card>

            <div class="flex flex-col space-y-3 rounded-lg border p-4">
              <FormField v-slot="{ value }" name="number_of_substitutes">
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.substitutes.label")
                  }}</FormLabel>
                  <FormDescription>
                    {{ $t("match.options.advanced.substitutes.description") }}
                  </FormDescription>
                  <NumberField
                    class="gap-2"
                    :min="0"
                    :max="5"
                    :model-value="value"
                    @update:model-value="
                      (number_of_substitutes) => {
                        form.setFieldValue(
                          'number_of_substitutes',
                          number_of_substitutes,
                        );
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
                    {{ $t("match.options.advanced.substitutes.range") }}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

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

            <div class="flex flex-col space-y-3 rounded-lg border p-4">
              <FormField v-slot="{ componentField }" name="timeout_setting">
                <FormItem>
                  <FormLabel class="text-lg font-semibold">{{
                    $t("match.options.advanced.timeouts.tactical.label")
                  }}</FormLabel>
                  <FormDescription>{{
                    $t("match.options.advanced.timeouts.tactical.description")
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
                            :value="timeoutSetting.value"
                            v-for="timeoutSetting in timeoutSettings"
                            :key="timeoutSetting.value"
                          >
                            {{ timeoutSetting.display }}
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
                    $t("match.options.advanced.timeouts.technical.description")
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
                            :value="timeoutSetting.value"
                            v-for="timeoutSetting in timeoutSettings"
                            :key="timeoutSetting.value"
                          >
                            {{ timeoutSetting.display }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum, e_timeout_settings_enum } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

interface Map {
  id: string;
  name: string;
  type: string;
  active_pool: boolean;
  workshop_map_id?: string;
}

interface MapPool {
  id: string;
  type: string;
  maps: Map[];
}

interface Region {
  value: string;
  description: string;
  is_lan: boolean;
}

interface BestOfOption {
  value: string;
  display: string;
}

interface TimeoutSetting {
  display: string;
  value: string;
}

export default {
  props: {
    form: {
      required: true,
      type: Object,
    },
    forceVeto: {
      required: false,
      type: Boolean,
      default: false,
    },
  },
  apollo: {
    e_match_types: {
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
    map_pools: {
      query: generateQuery({
        map_pools: [
          {
            where: {
              enabled: {
                _eq: true,
              },
              seed: {
                _eq: true,
              },
            },
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  data() {
    return {
      select_single_region: null as string | null,
      showAdvancedSettings: false,
    };
  },
  watch: {
    defaultMapPool: {
      immediate: true,
      handler(defaultMapPool) {
        if (!defaultMapPool) {
          return;
        }

        if (this.form.values.custom_map_pool) {
          return;
        }

        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    select_single_region: {
      handler(select_single_region) {
        if (this.form.values.lan || !this.form.values.region_veto) {
          this.form.setFieldValue("regions", [select_single_region]);
        }
      },
    },
    ["form.values.region_veto"]: {
      handler() {
        this.setDefaultRegion();
      },
    },
    ["form.values.lan"]: {
      handler(lan) {
        this.form.setFieldValue("region_veto", !lan);
        this.setDefaultRegion();
      },
    },
    ["form.values.type"]: {
      handler(type) {
        this.form.setFieldValue(
          "mr",
          type === e_match_types_enum.Competitive ? "12" : "8",
        );

        this.form.setFieldValue("map_pool", []);
        if (this.form.values.map_veto) {
          this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
        }
      },
    },
    ["form.values.custom_map_pool"]: {
      handler(custom_map_pool) {
        // only update if its a custom map pool and it matches the default
        // this helps the UI know wether to reset the map pool list or not
        if (
          custom_map_pool &&
          this.form.values.map_pool_id !== this.defaultMapPool.id
        ) {
          return;
        }

        this.form.setFieldValue("map_pool", []);

        if (!this.form.values.map_veto || custom_map_pool) {
          this.form.setFieldValue("map_pool_id", null);
          return;
        }

        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    ["form.values.map_veto"]: {
      handler(mapVeto) {
        if (mapVeto) {
          this.form.setFieldValue("custom_map_pool", false);
          return;
        }

        this.form.setFieldValue("custom_map_pool", true);
      },
    },
    ["form.values.map_pool"]: {
      handler() {
        if (this.form.values.map_veto) {
          return;
        }

        if (this.form.values.map_pool.length === 1) {
          return;
        }

        if (this.form.values.map_pool.length === 0) {
          return;
        }

        this.form.setFieldValue("map_pool", [this.form.values.map_pool.at(-1)]);
      },
    },
  },
  computed: {
    bestOfOptions(): BestOfOption[] {
      return [1, 3, 5].map((rounds) => {
        return {
          value: rounds.toString(),
          display: `Best of ${rounds}`,
        };
      });
    },
    timeoutSettings(): TimeoutSetting[] {
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
          display: this.$t("match.options.advanced.timeouts.options.everyone"),
          value: e_timeout_settings_enum.CoachAndPlayers,
        },
      ];
    },
    defaultMapPool(): MapPool | undefined {
      return this.map_pools?.find((pool: MapPool) => {
        return pool.type === this.form.values.type;
      });
    },
    availableMaps(): { official: Map[]; workshop: Map[] } {
      if (!this.maps) {
        return { official: [], workshop: [] };
      }

      const maps = this.maps
        .filter((map: Map) => {
          if (
            this.form.values.custom_map_pool === false &&
            map.active_pool === false
          ) {
            return false;
          }

          switch (this.form.values.type) {
            case e_match_types_enum.Competitive:
              return map.type === e_match_types_enum.Competitive;
            case e_match_types_enum.Wingman:
              return map.type === e_match_types_enum.Wingman;
            case e_match_types_enum.Duel:
              return map.type === e_match_types_enum.Duel;
          }
        })
        .sort((a: Map, b: Map) => {
          // First, sort active pool maps to the top
          if (a.active_pool && !b.active_pool) return -1;
          if (!a.active_pool && b.active_pool) return 1;

          // Finally, sort by name
          return a.name.localeCompare(b.name);
        });

      return {
        official: maps.filter((map: Map) => !map.workshop_map_id),
        workshop: maps.filter((map: Map) => map.workshop_map_id),
      };
    },
    availableRegions(): Region[] {
      return useApplicationSettingsStore().availableRegions;
    },
    lanRegions(): Region[] {
      return this.availableRegions.filter((region: Region) => {
        return region.is_lan === true;
      });
    },
    regions(): Region[] {
      return this.availableRegions.filter((region: Region) => {
        return this.form.values.lan
          ? region.is_lan === true
          : region.is_lan === false;
      });
    },
    canSetLan(): boolean {
      if (this.lanRegions.length === 0) {
        return false;
      }

      const { isAdmin, isMatchOrganizer, isTournamentOrganizer } =
        useAuthStore();
      return isAdmin || isMatchOrganizer || isTournamentOrganizer;
    },
  },
  methods: {
    updateMapPool(mapId: string) {
      if (!this.form.values.custom_map_pool) {
        return;
      }
      const pool = Object.assign([], this.form.values.map_pool);
      if (pool.includes(mapId)) {
        pool.splice(pool.indexOf(mapId), 1);
      } else {
        pool.push(mapId);
      }

      this.form.setFieldValue("map_pool", pool);
    },
    setDefaultRegion() {
      const { lan, region_veto } = this.form.values;

      let regions: string[] = [];

      if ((lan || !region_veto) && this.regions.length > 0) {
        this.select_single_region =
          this.regions.find((region: Region) => region.is_lan === !!lan)
            ?.value || null;

        return;
      }

      this.select_single_region = null;
      this.form.setFieldValue("regions", regions);
    },
  },
};
</script>
