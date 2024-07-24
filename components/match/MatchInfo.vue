<script setup lang="ts">
import CaptainInfo from "~/components/CaptainInfo.vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tv } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import BooleanToText from "~/components/BooleanToText.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { Separator } from "~/components/ui/separator";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <Card>
    <CardHeader class="bg-muted/50">
      <CardTitle class="relative">
        <div class="flex">
          <match-status :match="match"></match-status>
          <clip-board
            :data="match.tv_connection_string"
            v-if="match.tv_connection_string"
          >
            <Tv></Tv>
          </clip-board>
        </div>

        <div class="flex py-2 items-center justify-between">
          <div>
            {{ matchLineups.lineup1.name }} vs
            {{ matchLineups.lineup2.name }}
          </div>

          <MatchActions :match="match"></MatchActions>
        </div>

        <template
          v-if="
            match.status == e_match_status_enum.PickingPlayers ||
            match.status == e_match_status_enum.Scheduled
          "
        >
          <Button
            @click.prevent.stop="startMatch"
            class="-mr-2"
            :disabled="canAddToLineup1 || canAddToLineup2"
          >
            Start
            <template
              v-if="
                match.options.map_veto &&
                match.options.best_of != match.match_maps.length
              "
            >
              Veto
            </template>
            <template v-else> Match </template>
          </Button>
        </template>
      </CardTitle>
      <CardDescription>
        <QuickServerConnect :match="match"></QuickServerConnect>
      </CardDescription>
    </CardHeader>
    <CardContent class="p-6">
      <ul class="grid gap-3">
        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Match Type </span>
          <span>{{ match.options.type }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Best of </span>
          <span>{{ match.best_of }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Max Rounds </span>
          <span>{{ match.options.mr }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Coaches </span>
          <BooleanToText :value="match.options.coaches"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Overtime </span>
          <BooleanToText :value="match.options.overtime"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Knife Round </span>
          <BooleanToText :value="match.options.knife_round"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Map Veto </span>
          <BooleanToText :value="match.options.map_veto"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Map Pool </span>
          <span>
            {{ match.options.map_pool.type }}
          </span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Substitutes </span>
          <span>{{ match.options.number_of_substitutes }}</span>
        </li>
      </ul>

      <Separator class="my-8" />

      <div class="grid gap-3">
        <div class="font-semibold">Captains</div>
        <ul class="grid gap-3">
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ matchLineups.lineup1.name }}
            </span>
            <span>
              <captain-info
                :captain="matchLineups.lineup1.captain"
              ></captain-info>
            </span>
          </li>
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ matchLineups.lineup2.name }}
            </span>
            <span>
              <captain-info
                :captain="matchLineups.lineup2.captain"
              ></captain-info>
            </span>
          </li>
        </ul>
      </div>

      <div class="grid gap-3" v-if="match.options.coaches">
        <div class="font-semibold">Coaches</div>
        <ul class="grid gap-3">
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ matchLineups.lineup1.name }}
            </span>
            <div v-if="matchLineups.lineup1.coach">
              <Avatar>
                <AvatarImage
                  :src="matchLineups.lineup1.coach.avatar_url"
                  :alt="matchLineups.lineup1.coach.name"
                  v-if="matchLineups.lineup1.coach.avatar_url"
                />
                <AvatarFallback>{{
                  matchLineups.lineup1.coach.name
                }}</AvatarFallback>
              </Avatar>

              {{ matchLineups.lineup1.coach.name }}
            </div>
          </li>
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ matchLineups.lineup2.name }}
            </span>
            <div v-if="matchLineups.lineup2.coach">
              <Avatar>
                <AvatarImage
                  :src="matchLineups.lineup2.coach.avatar_url"
                  :alt="matchLineups.lineup2.coach.name"
                  v-if="matchLineups.lineup2.coach.avatar_url"
                />
                <AvatarFallback>{{
                  matchLineups.lineup2.coach.name
                }}</AvatarFallback>
              </Avatar>

              {{ matchLineups.lineup2.coach.name }}
            </div>
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import getMatchLineups from "~/utilities/getMatchLineups";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async scheduleMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          scheduleMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async startMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          startMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
    maxPlayersPerLineup() {
      return this.match?.type === "Wingman" ? 2 : 5;
    },
    canAddToLineup1() {
      return (
        this.matchLineups.lineup1?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    canAddToLineup2() {
      return (
        this.matchLineups.lineup2?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
  },
};
</script>
