<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Check } from "lucide-vue-next";
import { FormControl } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div
    v-if="isRegionVeto && (isBanning || canSelectRegion)"
    class="flex flex-col gap-4"
  >
    <template v-if="match.options.region_veto">
      <div
        class="relative rounded-lg border-l-4 border border-border/50 px-5 py-3 mx-auto max-w-lg w-full flex flex-col items-center gap-2 transition-colors duration-300"
        :class="
          isPicking
            ? 'border-l-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
            : 'border-l-primary bg-muted/40'
        "
      >
        <Badge
          v-if="isPicking"
          variant="default"
          class="absolute top-2 right-3 text-xs bg-blue-500 animate-pulse"
        >
          {{ $t("match.map_veto.your_turn") }}
        </Badge>

        <div class="flex items-center gap-2 text-center">
          <span
            class="text-lg font-bold"
            :class="isPicking ? 'text-blue-400' : 'text-primary'"
          >
            <template v-if="match.lineup_1.is_picking_region_veto">
              {{ match.lineup_1.name }}
            </template>
            <template v-else-if="match.lineup_2.is_picking_region_veto">
              {{ match.lineup_2.name }}
            </template>
          </span>
          <span class="text-muted-foreground">{{
            $t("match.region_veto.banning")
          }}</span>
          <Badge variant="destructive" class="text-sm">Ban</Badge>
        </div>

        <div
          class="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"
          @click="override = !override"
          v-if="canOverride"
        >
          <Label class="text-xs text-muted-foreground cursor-pointer">{{
            $t("match.region_veto.organizer_override")
          }}</Label>
          <Switch :model-value="override" />
        </div>
      </div>

      <div class="container mx-auto px-4">
        <div class="flex flex-wrap justify-center gap-6">
          <div
            v-for="region in regions"
            :key="region.value"
            class="relative group w-[180px]"
          >
            <div
              @click="isPicking && form.setFieldValue('region', region.value)"
              class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px] h-[180px] transition-all duration-300 ease-in-out transform"
              :class="{
                'cursor-pointer': isPicking,
                'scale-105 ring-2 ring-primary':
                  form.values.region === region.value,
                'hover:scale-105':
                  isPicking &&
                  (!form.values.region || form.values.region !== region.value),
                'opacity-30 pointer-events-none filter grayscale':
                  !availableRegions.includes(region.value),
              }"
            >
              <NuxtImg
                src="/img/maps/screenshots/default.webp"
                class="w-full h-full object-cover min-w-[150px]"
                sizes="sm:200px md:400px lg:600"
              />
              <div class="absolute inset-0 bg-black bg-opacity-45"></div>

              <div class="absolute inset-x-0 bottom-0 px-2 py-2 text-center">
                <span
                  class="text-white text-sm font-bold uppercase font-sans drop-shadow-lg"
                >
                  {{ region.description || region.value }}
                </span>
              </div>
            </div>

            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              leave-active-class="transition-all duration-150 ease-in"
              enter-from-class="opacity-0 scale-50"
              enter-to-class="opacity-100 scale-100"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-50"
            >
              <div
                v-if="form.values.region === region.value"
                class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[3px] cursor-pointer rounded-lg"
                @click.stop="vetoPick"
              >
                <div
                  class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 backdrop-blur-xl border border-white/30 shadow-xl shadow-black/30 ring-1 ring-white/10"
                >
                  <Check class="w-4 h-4 text-green-400" />
                  <span class="text-sm font-semibold text-white">{{
                    $t("match.region_veto.confirm_ban")
                  }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
      <Separator></Separator>
    </template>
    <template v-else-if="canSelectRegion && !match.region">
      <Card class="sm:col-span-4">
        <CardHeader class="pb-3">
          <CardContent>
            <form @submit.prevent="setRegion">
              <FormField v-slot="{ componentField }" name="region">
                <FormItem>
                  <FormLabel>{{
                    $t("match.region_veto.server_region")
                  }}</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          :placeholder="$t('match.region_veto.select_region')"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="region.value"
                          v-for="region of regions"
                        >
                          {{ region.description || region.value }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <Button
                type="submit"
                :disabled="Object.keys(form.errors).length > 0"
              >
                {{ $t("match.region_veto.set_server_region") }}
              </Button>
            </form>
          </CardContent>
        </CardHeader>
      </Card>
      <Separator></Separator>
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import {
  $,
  e_match_status_enum,
  e_veto_pick_types_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useSound } from "~/composables/useSound";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_region_veto_picks: [
            {
              where: {
                match_id: {
                  _eq: $("matchId", "uuid!"),
                },
              },
            },
            {
              region: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.picks = data.match_region_veto_picks;
        },
      },
    },
  },
  watch: {
    isPicking: {
      immediate: true,
      handler(isPicking) {
        this.form.setValues({
          region: undefined,
        });

        if (!isPicking) {
          return;
        }

        this.playMatchFoundSound();
      },
    },
    picks: {
      handler(currentPicks, oldPicks) {
        if (oldPicks && currentPicks.length > oldPicks.length) {
          this.playTickSound();
        }
      },
    },
  },
  data() {
    return {
      picks: [],
      override: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            region: z.string(),
          }),
        ),
      }),
      playTickSound: useSound().playTickSound,
      playMatchFoundSound: useSound().playMatchFoundSound,
    };
  },
  computed: {
    canOverride() {
      return (
        this.match.is_organizer &&
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    isPicking() {
      if (this.canOverride && this.override) {
        return true;
      }

      return (
        this.match.lineup_1.can_pick_region_veto ||
        this.match.lineup_2.can_pick_region_veto
      );
    },
    regions() {
      return useApplicationSettingsStore().availableRegions.filter((region) => {
        return region.is_lan === false;
      });
    },
    availableRegions() {
      return this.regions
        .filter(({ value }) => {
          if (
            this.picks.find(({ region }) => {
              return region === value;
            })
          ) {
            return false;
          }
          return true;
        })
        .map(({ value }) => {
          return value;
        });
    },
    isBanning() {
      return this.match.options.region_veto && !this.match.region;
    },
    isRegionVeto() {
      return this.match.status == e_match_status_enum.Veto;
    },
    canSelectRegion() {
      return (
        this.match.is_organizer &&
        !this.match.options.region_veto &&
        this.regions.length > 1
      );
    },
  },
  methods: {
    async setRegion() {
      let { region } = this.form.values;

      await this.$apollo.mutate({
        variables: {
          region,
        },
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.$route.params.id,
              },
              _set: {
                region: $("region", "String!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.resetForm();
    },
    async vetoPick() {
      let { region } = this.form.values;

      await this.$apollo.mutate({
        variables: {
          region,
          type: e_veto_pick_types_enum.Ban,
          match_id: this.$route.params.id,
          match_lineup_id: this.match.region_veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_region_veto_picks_one: [
            {
              object: {
                region: $("region", "String!"),
                type: $("type", "e_veto_pick_types_enum!"),
                match_id: $("match_id", "uuid!"),
                match_lineup_id: $("match_lineup_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.resetForm();
    },
  },
};
</script>
