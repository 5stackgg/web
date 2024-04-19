<script lang="ts" setup>
import MapPreview from "~/components/match/MapPreview.vue";
import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {Button} from "~/components/ui/button";
</script>

<template>
  <Card class="sm:col-span-4">
    <CardHeader class="pb-3">
      <CardTitle>Map Veto</CardTitle>
      <CardContent>
        <div class="grid grid-cols-4">
          <match-map-preview :map="pick.map"  v-for="pick of picks" v-if="match.maps">
            <br />
            {{ pick.type }}ed by

            {{ pick.match_lineup.name }}

            <template v-if="pick.side"> ({{ pick.side }}) </template>
          </match-map-preview>
        </div>

        <template v-if="match.status === 'Veto' && match.match_maps.length < bestOf">
          <h1>{{ teamName }} Is Picking ({{ pickType }})</h1>

          <div @click="override = !override">
            <Switch :checked="override" />
            <Label>Match Organizer override</Label>
          </div>

          <form @submit.prevent="vetoPick" v-if="isPicking">
            <template v-if="pickType === 'Side'">
              <FormField v-slot="{ componentField }" name="side">
                <FormItem>
                  <FormLabel>Side</FormLabel>

                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select the Side your team wants to start on" />
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
            <template v-else>
              <div class="grid grid-cols-4" v-for="availableMap of availableMaps">
                <map-preview
                    :map="availableMap"
                    class="cursor-pointer"
                    :class="{
              'bg-red-500': form.values.map_id === availableMap.id,
            }"
                    @click="form.setFieldValue('map_id', availableMap.id)"
                ></map-preview>
              </div>
            </template>

            <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
              {{ pickType }}
            </Button>
          </form>
        </template>
      </CardContent>
    </CardHeader>
  </Card>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import {
  $,
  e_sides_enum, e_veto_pick_types_enum,
  order_by,
} from "~/generated/zeus/index";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
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
              side: z.string().optional().refine((value, data) => {
                if (this.pickType === e_veto_pick_types_enum.Side) {
                  return typeof value === "string" && value.trim() !== "";
                }
                return true;
              }, { message: "side is required" })
            })
        )
      }),
    };
  },
  watch: {
    pickType: {
      immediate: true,
      handler(pickType) {
        if (pickType === e_veto_pick_types_enum.Side) {
          const mapId = this.picks.at(-1).map.id;
          console.info("WEEEE", mapId)
          this.form.setValues({
            map_id: mapId
          })
        }
      }
    }
  },
  methods: {
    async vetoPick() {
      const { map_id, side } = this.form.values

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

      return this.myLineup.id === this.match.veto_picking_lineup_id;
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

      const pattern = [e_veto_pick_types_enum.Ban, e_veto_pick_types_enum.Ban, e_veto_pick_types_enum.Pick, e_veto_pick_types_enum.Side, e_veto_pick_types_enum.Pick, e_veto_pick_types_enum.Side];
      return pattern[this.picks.length % pattern.length];
    },
    availableMaps() {
      let maps = this.match_maps?.map_pool?.maps;

      if (!maps) {
        return;
      }

      return maps.filter((map) => {
        return (
          this.picks?.find((pick) => {
            return pick.map.id === map.id;
          }) === undefined
        );
      });
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
      }).name;
    },
  },
};
</script>
