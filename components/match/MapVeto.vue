<script lang="ts" setup>
import {
  FormControl,
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
import { Button } from "~/components/ui/button";
import MapDisplay from "~/components/MapDisplay.vue";
import VetoPreview from "~/components/match/VetoPreview.vue";
</script>

<template>
  <div class="flex gap-4 h-[250px] overflow-hidden">
    <template v-for="pick of picks">
      <div v-if="pick.type !== 'Side'">
        <map-display :map="pick.map.name">
          <template v-slot:header>
            <div class="absolute top-3">
              <badge
                :variant="pick.type === 'Pick' ? 'default' : 'destructive'"
              >
                <template v-if="pick.type === 'LeftOver'"> Decider </template>
                <template v-else>
                  {{ pick.type }}
                </template>
              </badge>
            </div>
          </template>

          <template v-slot:default>
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
            </div>
          </template>
        </map-display>
      </div>
    </template>
  </div>

  <div v-if="match.match_maps.length < bestOf || 1 == 1">
    <Separator class="mt-8 mb-8"></Separator>
    <template v-if="match.status === 'Veto' || 1 == 1">
      <div class="flex justify-between">
        <h1>
          {{ teamName }} is Picking a
          <span class="underline">{{ pickType }}</span>
        </h1>

        <div
          class="flex items-center space-x-2 cursor-pointer"
          @click="override = !override"
          v-if="isMatchOrganizer"
        >
          <Label>Match Organizer Override</Label>
          <Switch :checked="override" />
        </div>
      </div>

      <form @submit.prevent="vetoPick" v-if="isPicking">
        <template v-if="pickType === 'Side'">
          <FormField v-slot="{ componentField }" name="side">
            <FormItem>
              <FormLabel>Side</FormLabel>

              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder="Select the Side your team wants to start on"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      v-for="sideOption in sideOptions"
                      :key="sideOption.value"
                      :value="sideOption.value"
                    >
                      {{ sideOption.display }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <veto-preview
          :model-value="form.values.map_id"
          :maps="maps"
          :picks="picks"
          @update:modelValue="
            (mapId) => {
              form.setFieldValue('map_id', mapId);
            }
          "
        ></veto-preview>

        <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
          {{ pickType }}
        </Button>
      </form>
      <template v-else>
        <veto-preview :maps="maps" :picks="picks"></veto-preview>
      </template>
    </template>
    <template v-else>
      <h1 class="text-center">Start the Match to Start Map Veto</h1>
    </template>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import {
  $,
  e_sides_enum,
  e_veto_pick_types_enum,
  order_by,
} from "~/generated/zeus/index";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    match_maps: {
      variables: function () {
        return {
          match_id: this.match.id,
        };
      },
      query: generateQuery({
        __alias: {
          match_maps: {
            matches_by_pk: [
              {
                id: $("match_id", "uuid!"),
              },
              {
                map_pool: [
                  {},
                  {
                    maps: {
                      id: true,
                      name: true,
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
    },
    $subscribe: {
      match_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_veto_picks: [
            {
              where: {
                match_id: {
                  _eq: $("matchId", "uuid!"),
                },
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by"),
                },
              ],
            },
            {
              id: true,
              map: {
                id: true,
                name: true,
              },
              side: true,
              type: true,
              match_lineup_id: true,
              match_lineup: [
                {},
                {
                  name: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          this.picks = data.match_veto_picks;
        },
      },
    },
  },
  data() {
    return {
      override: false,
      picks: undefined,
      // TODO - should be on or the other
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            map_id: z.string(),
            side: z
              .string()
              .optional()
              .refine(
                (value, data) => {
                  if (this.pickType === e_veto_pick_types_enum.Side) {
                    return typeof value === "string" && value.trim() !== "";
                  }
                  return true;
                },
                { message: "side is required" }
              ),
          })
        ),
      }),
    };
  },
  watch: {
    isPicking: {
      immediate: true,
      handler() {
        this.form.setValues({
          map_id: undefined,
        });
      },
    },
    pickType: {
      immediate: true,
      handler(pickType) {
        if (pickType === e_veto_pick_types_enum.Side) {
          const mapId = this.picks.at(-1).map.id;
          this.form.setValues({
            map_id: mapId,
          });
        }
      },
    },
  },
  methods: {
    async vetoPick() {
      const { map_id, side } = this.form.values;

      await this.$apollo.mutate({
        variables: {
          map_id,
          type: this.pickType,
          ...(side
            ? {
                side,
              }
            : {}),
          match_id: this.$route.params.id,
          match_lineup_id: this.match.veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_veto_picks_one: [
            {
              object: {
                map_id: $("map_id", "uuid!"),
                side: $("side", "String"),
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
  computed: {
    me() {
      return useAuthStore().me;
    },
    bestOf() {
      return this.match.best_of;
    },
    isCaptain() {
      return this.myLineup?.captain?.player.steam_id === this.me.steam_id;
    },
    myLineup() {
      return this.match?.lineups.find((lineup) => {
        return lineup?.lineup_players.find((player) => {
          return player.steam_id === this.me.steam_id;
        });
      });
    },
    isPicking() {
      if (this.override) {
        return true;
      }

      if (!this.match || !this.myLineup) {
        return false;
      }

      return (
        this.myLineup.id === this.match.veto_picking_lineup_id &&
        (this.isCaptain || this.isMatchOrganizer)
      );
    },
    isMatchOrganizer() {
      return this.match.organizer_steam_id === this.me.steam_id;
    },
    pickType() {
      if (!this.match || !this.picks) {
        return;
      }

      if (this.match.best_of === 1) {
        return e_veto_pick_types_enum.Ban;
      }

      const pattern = [
        e_veto_pick_types_enum.Ban,
        e_veto_pick_types_enum.Ban,
        e_veto_pick_types_enum.Pick,
        e_veto_pick_types_enum.Side,
        e_veto_pick_types_enum.Pick,
        e_veto_pick_types_enum.Side,
      ];
      return pattern[this.picks.length % pattern.length];
    },
    maps() {
      return this.match_maps?.map_pool?.maps;
    },

    sideOptions() {
      return [
        { value: e_sides_enum.CT, display: "Counter-Terrorist" },
        { value: e_sides_enum.TERRORIST, display: "Terrorist" },
      ];
    },
    teamName() {
      return this.match?.lineups.find((lineup) => {
        return lineup.id === this.match.veto_picking_lineup_id;
      })?.name;
    },
  },
};
</script>
