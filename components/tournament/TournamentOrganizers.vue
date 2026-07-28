<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentOrganizerRow from "~/components/tournament/TournamentOrganizerRow.vue";
import TournamentOrganizerTeams from "~/components/tournament/TournamentOrganizerTeams.vue";
import ManageSection from "~/components/common/ManageSection.vue";
</script>

<template>
  <div v-if="tournament" class="mx-auto grid max-w-3xl gap-8">
    <ManageSection
      :label="$t('tournament.organizer.title')"
      :hint="$t('tournament.organizer.description')"
    >
      <PlayerSearch
        :label="$t('tournament.organizer.add')"
        :ineligible="ineligibleOrganizers"
        @selected="addOrganizer"
      ></PlayerSearch>

      <Table v-if="tournament.organizers && tournament.organizers.length > 0">
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t("common.name") }}</TableHead>
            <TableHead>{{ $t("common.actions_label") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TournamentOrganizerRow
            :organizer="organizer"
            v-for="{ organizer } of tournament.organizers"
            :key="organizer.steam_id"
          ></TournamentOrganizerRow>
        </TableBody>
      </Table>

      <div
        v-else
        class="rounded-sm border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("tournament.organizer.no_organizers_description") }}
      </div>
    </ManageSection>

    <TournamentOrganizerTeams :tournament="tournament" />
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async addOrganizer(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_organizers_one: [
            {
              object: {
                steam_id: member.steam_id,
                tournament_id: this.$route.params.tournamentId,
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    ineligibleOrganizers() {
      const map: Record<string, string> = {};

      for (const { organizer } of this.tournament.organizers || []) {
        map[String(organizer.steam_id)] = this.$t(
          "player.search.ineligible.tournament_organizer",
        );
      }

      map[String(this.tournament.admin.steam_id)] = this.$t(
        "player.search.ineligible.tournament_admin",
      );

      return map;
    },
  },
};
</script>
