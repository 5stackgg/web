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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "~/components/ui/dialog";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "../PlayerDisplay.vue";
import { PencilIcon } from "lucide-vue-next";
import JoinLineupForm from "~/components/match/JoinLineupForm.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  FormItem,
  FormControl,
  FormMessage,
  FormField,
} from "~/components/ui/form";
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
            <Dialog
              v-if="lineup.can_update_lineup"
              v-model:open="editModalOpen"
            >
              <DialogTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="prepareEditName()"
                >
                  <PencilIcon class="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>{{
                  $t("match.overview.update_team_name")
                }}</DialogTitle>
                <form @submit.prevent="saveTeamName" class="space-y-4 pt-2">
                  <FormField name="team_name" v-slot="{ componentField }">
                    <FormItem>
                      <FormControl>
                        <Input
                          v-bind="componentField"
                          v-model="editName"
                          :placeholder="
                            $t('match.overview.team_name') as string
                          "
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>
                  <div class="flex justify-end gap-2">
                    <DialogClose as-child>
                      <Button type="button" variant="outline">{{
                        $t("common.cancel")
                      }}</Button>
                    </DialogClose>
                    <Button type="submit" :disabled="!editName?.trim()">{{
                      $t("common.save")
                    }}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </TableHead>
        <template v-if="showStats">
          <TableHead class="w-[4ch] text-center">
            <span class="xl:hidden">K</span>
            <span class="hidden xl:inline">{{
              $t("match.overview.kills_full")
            }}</span>
          </TableHead>
          <TableHead class="hidden md:table-cell w-[4ch] text-center">
            <span class="xl:hidden">A</span>
            <span class="hidden xl:inline">{{
              $t("match.overview.assists_full")
            }}</span>
          </TableHead>
          <TableHead class="w-[4ch] text-center">
            <span class="xl:hidden">D</span>
            <span class="hidden xl:inline">{{
              $t("match.overview.deaths_full")
            }}</span>
          </TableHead>
          <TableHead class="hidden md:table-cell w-[16ch] text-center">{{
            $t("match.overview.kd")
          }}</TableHead>
          <TableHead class="hidden lg:table-cell w-[4ch] text-center">{{
            $t("match.overview.hs")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[16ch] text-center">{{
            $t("match.overview.team_damage")
          }}</TableHead>
          <TableHead class="hidden xl:table-cell w-[30ch] text-center">
            <span class="hidden 2xl:inline">
              {{ $t("match.overview.multi_kill_rounds") }}
            </span>
            <span class="2xl:hidden"> {{ $t("match.overview.mkr") }} </span>
          </TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.k2")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.k3")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.k4")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.k5")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.knifes")
          }}</TableHead>
          <TableHead class="hidden 2xl:table-cell w-[4ch] text-center">{{
            $t("match.overview.zeus")
          }}</TableHead>
          <TableHead class="text-center w-[24ch] text-center">{{
            $t("match.overview.total_damage")
          }}</TableHead>
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
        v-if="canViewEmptySlows"
      >
        <TableCell colspan="100%">
          <div class="flex gap-4">
            <PlayerDisplay
              :show-flag="false"
              :show-role="false"
              :player="{
                name: `${$t('match.overview.slot', { number: slot + lineup.lineup_players.length })} ${slot + lineup.lineup_players.length > match.min_players_per_lineup ? $t('match.overview.substitute') : ''}`,
              }"
            />
            <div v-if="slot === 1" class="flex gap-4">
              <template v-if="canAddToLineup">
                <AssignPlayerToLineup
                  :lineup="lineup"
                  :exclude="excludePlayers"
                  :match-id="match.id"
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
                <JoinLineupForm
                  :match="match"
                  :lineup="lineup"
                  @joined="$emit('joined')"
                ></JoinLineupForm>
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
import { $ } from "~/generated/zeus";
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
            team_name: z.string(),
          }),
        ),
      }),
      editModalOpen: false as boolean,
      editName: "" as string,
    };
  },
  computed: {
    canAddToLineup() {
      return (
        this.lineup.can_update_lineup &&
        this.lineup.lineup_players.length < this.maxPlayers
      );
    },
    canViewEmptySlows() {
      return ![
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ].includes(this.match.status);
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
    async updateLineupName(lineup_id: string, name: string) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          update_match_lineups_by_pk: [
            {
              pk_columns: { id: lineup_id },
              _set: { team_name: $("name", "String!") },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          name,
        },
      });
    },
    prepareEditName() {
      this.editName = this.lineup?.name ?? "";
    },
    async saveTeamName() {
      const newName = this.editName?.trim();
      if (!newName) {
        return;
      }
      await this.updateLineupName(this.lineup.id, newName);
      this.editModalOpen = false;
      this.$emit("joined");
    },
  },
};
</script>
