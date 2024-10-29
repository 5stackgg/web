<script setup lang="ts">
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "~/components/ui/table";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "../PlayerDisplay.vue";
import { UserPlusIcon } from "lucide-vue-next";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[300px] text-left">
          <div class="flex items-center gap-4">
            <div
              v-if="match.status === e_match_status_enum.WaitingForCheckIn"
              class="relative inline-flex"
            >
              <span
                class="absolute inline-flex h-2 w-2 rounded-full animate-ping"
                :class="{
                  'bg-red-600': !lineup.is_ready,
                  'bg-green-600': lineup.is_ready,
                }"
              ></span>
              <span
                class="relative inline-flex h-2 w-2 rounded-full"
                :class="{
                  'bg-red-600': !lineup.is_ready,
                  'bg-green-600': lineup.is_ready,
                }"
              ></span>
            </div>
            <span>{{ lineup.name }}</span>
          </div>
        </TableHead>
        <template v-if="showStats">
          <TableHead class="w-[4ch] text-center">
            K<span class="hidden xl:inline">ills</span>
          </TableHead>
          <TableHead class="hidden md:table-cell w-[4ch] text-center">
            A<span class="hidden xl:inline">ssists</span>
          </TableHead>
          <TableHead class="w-[4ch] text-center">
            D<span class="hidden xl:inline">eaths</span>
          </TableHead>
          <TableHead class="hidden md:table-cell w-[16ch] text-center"
            >K/D</TableHead
          >
          <TableHead class="hidden lg:table-cell w-[4ch] text-center"
            >HS%</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[16ch] text-center"
            >Team Damage</TableHead
          >
          <TableHead class="hidden xl:table-cell w-[30ch] text-center">
            <span class="hidden 2xl:inline"> Multi Kill Rounds </span>
            <span class="2xl:hidden"> MKR </span>
          </TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >2K</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >3K</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >4K</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >5K</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >Knifes</TableHead
          >
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
            >Zeus</TableHead
          >
          <TableHead class="text-center w-[24ch] text-center"
            >Total Damage</TableHead
          >
          <TableHead v-if="lineup.can_update_lineup"> </TableHead>
        </template>
      </TableRow>
    </TableHeader>
    <TableBody>
      <LineupOverviewRow
        :match="match"
        :member="member"
        :lineup="lineup"
        :show-stats="showStats"
        v-for="member of lineup.lineup_players"
      ></LineupOverviewRow>
      <TableRow
        v-for="slot of Math.max(
          0,
          match.max_players_per_lineup - lineup.lineup_players.length,
        )"
      >
        <TableCell colspan="100%">
          <div class="flex gap-4">
            <PlayerDisplay
              :show-flag="false"
              :show-steam-id="false"
              :player="{
                name: `Slot ${slot + lineup.lineup_players.length} ${slot + lineup.lineup_players.length > match.min_players_per_lineup ? '(substitute)' : ''}`,
              }"
            />
            <div v-if="slot === 1" class="flex gap-4">
              <template v-if="lineup.can_update_lineup && canAddToLineup">
                <AssignPlayerToLineup
                  :lineup="lineup"
                  :exclude="excludePlayers"
                ></AssignPlayerToLineup>
              </template>
              <template
                v-if="
                  (match.options.lobby_access === e_lobby_access_enum.Open ||
                    match.options.lobby_access ===
                      e_lobby_access_enum.Invite) &&
                  !match.is_in_lineup &&
                  match.status === e_match_status_enum.PickingPlayers
                "
              >
                <form @submit.prevent="joinLineup" class="flex gap-4">
                  <FormField
                    v-slot="{ componentField }"
                    name="code"
                    v-if="
                      match.options.lobby_access === e_lobby_access_enum.Invite
                    "
                  >
                    <FormItem>
                      <FormControl>
                        <Input v-bind="componentField"></Input>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>
                  <Button variant="outline" class="flex gap-4">
                    <UserPlusIcon class="h-4 w-4" />
                    Join
                  </Button>
                </form>
              </template>
            </div>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  emits: ["joined"],
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    showStats: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            code: z.string(),
          }),
        ),
      }),
    };
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (!this.$route.query.invite) {
          return;
        }
        this.form.setFieldValue("code", this.$route.query.invite);
      },
    },
  },
  computed: {
    canAddToLineup() {
      return (
        this.lineup.can_update_lineup &&
        this.lineup.lineup_players.length < this.maxPlayers
      );
    },
    minPlayers() {
      return this.match.min_players_per_lineup;
    },
    maxPlayers() {
      return this.match.max_players_per_lineup;
    },
    excludePlayers() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      if (this.match.lineup_1.coach) {
        players.push(this.match.lineup_1.coach);
      }

      if (this.match.lineup_2.coach) {
        players.push(this.match.lineup_2.coach);
      }

      return players;
    },
  },
  methods: {
    async joinLineup() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          joinLineup: [
            {
              match_id: this.match.id,
              lineup_id: this.lineup.id,
              code: this.form.values.code,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$emit("joined");

      if (this.$route.query.invite) {
        const { invite, ...queryWithoutInvite } = this.$route.query;
        this.$router.replace({ query: queryWithoutInvite });
      }
    },
  },
};
</script>
