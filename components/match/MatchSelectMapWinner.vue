<script lang="ts" setup>
import { MoreVertical } from "lucide-vue-next";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import mapLabel from "~/utilities/mapLabel";
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        size="xs"
        variant="ghost"
        class="h-6 w-6 p-0 text-white/70 hover:text-white"
        @click.stop
      >
        <MoreVertical class="w-4 h-4" />
        <span class="sr-only">{{ $t("match.map_winner.set") }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-56">
      <DropdownMenuLabel
        class="px-2 pb-1 pt-1.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("match.map_winner.set") }}
      </DropdownMenuLabel>
      <!-- Each team reads as name + its score on this map; picking one opens
           the confirm below instead of saving straight away. -->
      <DropdownMenuItem
        v-for="lineup in lineups"
        :key="lineup.id"
        @click="ask(lineup.id)"
      >
        <span class="truncate">{{ lineup.name }}</span>
        <span
          v-if="lineup.id === matchMap.winning_lineup_id"
          class="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-muted-foreground"
        >
          {{ $t("match.admin_bar.current") }}
        </span>
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="lineup"
          :match-map="matchMap"
          :halves="false"
          class="ml-auto pl-6 tabular-nums"
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Outside the menu so it survives the menu closing as the dialog takes
       focus. -->
  <AlertDialog
    :open="open"
    @update:open="(value) => !value && !busy && (open = false)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t("match.map_winner.set") }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("match.map_winner.set_hint", { map: mapLabel(matchMap.map) }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <MatchSelectWinner
        :match="match"
        :match-map="matchMap"
        :selected="picked"
        @select="(choice) => (picked = choice.value)"
      />
      <p v-if="matchWinnerNote" class="text-sm text-muted-foreground">
        {{ matchWinnerNote }}
      </p>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="busy">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <!-- Plain button: AlertDialogAction closes the dialog before an async
             click handler gets to run. -->
        <Button :disabled="busy || !picked" @click="confirm">
          {{ $t("match.map_winner.set") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
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
  data() {
    return {
      open: false,
      busy: false,
      picked: null as string | null,
    };
  },
  methods: {
    ask(lineupId: string) {
      this.picked = lineupId;
      this.open = true;
    },
    async confirm() {
      if (this.busy || !this.picked) {
        return;
      }
      this.busy = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            setMapWinner: [
              {
                match_id: this.match.id,
                match_map_id: this.matchMap.id,
                winning_lineup_id: this.picked,
              },
              { success: true },
            ],
          }),
        });
        this.open = false;
        toast({
          title: this.$t("match.map_winner.set"),
        });
      } finally {
        this.busy = false;
      }
    },
  },
  computed: {
    lineups() {
      return [this.match.lineup_1, this.match.lineup_2];
    },
    // setMapWinner re-derives the match winner from the maps: a team with
    // enough of them takes the match, otherwise the match winner is cleared.
    // Say so when this pick changes it.
    matchWinnerNote() {
      if (!this.picked) {
        return null;
      }
      const needed = Math.floor((this.match.options?.best_of ?? 0) / 2) + 1;
      const winner = this.lineups.find((lineup) => {
        const wins = (this.match.match_maps ?? []).filter(
          (map) =>
            (map.id === this.matchMap.id
              ? this.picked
              : map.winning_lineup_id) === lineup.id,
        ).length;
        return wins >= needed;
      });

      if ((winner?.id ?? null) === (this.match.winning_lineup_id ?? null)) {
        return null;
      }
      return winner
        ? this.$t("match.map_winner.sets_match_winner", { team: winner.name })
        : this.$t("match.map_winner.clears_match_winner");
    },
  },
};
</script>
