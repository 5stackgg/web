<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { FormControl } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import VetoBoard from "~/components/match/VetoBoard.vue";
</script>

<template>
  <div
    v-if="isRegionVeto && (isBanning || canSelectRegion)"
    class="flex flex-col gap-4"
  >
    <VetoBoard
      v-if="match.options.region_veto"
      kind="region"
      :items="items"
      :steps="steps"
      :lineups="lineups"
      :picking-lineup="pickingLineup"
      :is-picking="isPicking"
      :submitting="submitting"
      :deadline="vetoPickDeadline"
      :total="match.options.veto_pick_timeout"
      @confirm="({ itemId }) => itemId && vetoPick(itemId)"
    />
    <template v-else-if="canSelectRegion && !match.region">
      <Card class="sm:col-span-4 bg-card/20">
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
                          <span class="flex items-center gap-2">
                            <span
                              class="inline-block h-2 w-2 rounded-full"
                              :class="{
                                'bg-red-500': region.status === 'Offline',
                                'bg-green-500': region.status === 'Online',
                                'bg-yellow-500': region.status === 'Partial',
                              }"
                            ></span>
                            {{ region.description || region.value }}
                          </span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <Button
                type="submit"
                :disabled="Object.keys(form.errors).length > 0 || submitting"
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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import {
  $,
  order_by,
  e_match_status_enum,
  e_veto_pick_types_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useSound } from "~/composables/useSound";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { regionVetoOrder } from "~/utilities/vetoOrder";
import { lineupSlot, vetoLineups } from "~/utilities/vetoLineups";
import { isVetoOverrideEnabled } from "~/composables/useVetoOverride";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchId: {
      type: String,
      required: false,
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            matchId: this.matchId || this.$route.params.id,
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
              order_by: [
                {
                  created_at: order_by.asc,
                },
              ],
            },
            {
              region: true,
              type: true,
              auto_picked: true,
              match_lineup_id: true,
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
          this.finishSubmitting();
        }
      },
    },
  },
  beforeUnmount() {
    if (this.submitTimeout) {
      clearTimeout(this.submitTimeout);
    }
  },
  data() {
    return {
      picks: [],
      submitting: false,
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
    pickingLineup() {
      if (this.match.lineup_1?.is_picking_region_veto) {
        return 1;
      }
      if (this.match.lineup_2?.is_picking_region_veto) {
        return 2;
      }
      return null;
    },
    lineups() {
      return vetoLineups(this.match, this.$t);
    },
    items() {
      const matchmaking = useMatchmakingStore();
      return this.regions.map((region: any) => {
        const latency = matchmaking.getRegionlatencyResult(region.value);
        return {
          id: region.value,
          label: region.description || region.value,
          ping: latency ? Math.round(Number(latency.latency)) : null,
          serverStatus: region.status,
        };
      });
    },
    steps() {
      const picks = this.picks ?? [];
      return regionVetoOrder(this.regions.length).map((step, index) => {
        const pick = picks[index];
        const region = pick
          ? this.regions.find(
              ({ value }: { value: string }) =>
                value.toLowerCase() === pick.region.toLowerCase(),
            )
          : null;
        return {
          ...step,
          record: region
            ? {
                itemId: region.value,
                lineup: lineupSlot(this.match, pick.match_lineup_id),
                auto: pick.auto_picked,
              }
            : null,
        };
      });
    },
    vetoPickDeadline() {
      if (!this.match.options.veto_pick_timeout) {
        return null;
      }

      return this.match.veto_pick_expires_at ?? null;
    },
    override() {
      return isVetoOverrideEnabled(this.match?.id);
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
      const configuredRegions: string[] = this.match.options?.regions || [];
      const available = useApplicationSettingsStore().availableRegions;

      return configuredRegions.map((value) => {
        const existing = available.find(
          (region) => region.value.toLowerCase() === value.toLowerCase(),
        );
        if (existing) {
          return existing;
        }

        return {
          value,
          description: value,
          status: "Offline",
          is_lan: false,
        };
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
    finishSubmitting() {
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = undefined;
      }
      this.submitting = false;
      this.form.resetForm();
    },
    async setRegion() {
      if (this.submitting) {
        return;
      }

      let { region } = this.form.values;

      this.submitting = true;

      try {
        await this.$apollo.mutate({
          variables: {
            region,
          },
          mutation: generateMutation({
            update_matches_by_pk: [
              {
                pk_columns: {
                  id: this.matchId || this.$route.params.id,
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
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.submitting = false;
      }
    },
    async vetoPick(region: string) {
      if (this.submitting) {
        return;
      }

      this.submitting = true;

      try {
        await this.$apollo.mutate({
          variables: {
            region,
            type: e_veto_pick_types_enum.Ban,
            match_id: this.matchId || this.$route.params.id,
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

        this.submitTimeout = setTimeout(() => {
          this.finishSubmitting();
        }, 8000);
      } catch (error: any) {
        this.submitting = false;
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
  },
};
</script>
