<script lang="ts" setup>
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
</script>

<template>
  <DropdownMenuLabel class="text-xs">
    {{ $t("match.map_winner.set") }}
  </DropdownMenuLabel>
  <DropdownMenuRadioGroup
    :model-value="matchMap.winning_lineup_id ?? ''"
    @update:model-value="updateMapWinner"
  >
    <DropdownMenuRadioItem
      v-for="lineup in availableLineups"
      :key="lineup.value"
      :value="lineup.value"
    >
      {{ lineup.display }}
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchMap: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async updateMapWinner(lineupId: string) {
      if (!lineupId) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          setMapWinner: [
            {
              match_id: this.match.id,
              match_map_id: this.matchMap.id,
              winning_lineup_id: lineupId,
            },
            { success: true },
          ],
        }),
      });

      toast({
        title: this.$t("match.map_winner.set"),
      });
    },
  },
  computed: {
    availableLineups() {
      return [
        {
          value: this.match.lineup_1.id,
          display: this.match.lineup_1.name,
        },
        {
          value: this.match.lineup_2.id,
          display: this.match.lineup_2.name,
        },
      ];
    },
  },
};
</script>
