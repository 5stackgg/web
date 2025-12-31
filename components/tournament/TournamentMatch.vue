<script lang="ts" setup>
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  e_tournament_stage_types_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import { Settings } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import TournamentBracketForm from "~/components/tournament/TournamentBracketForm.vue";

interface Bracket {
  id: string;
  bye?: boolean;
  match_number?: number;
  path?: string;
  scheduled_eta?: string;
  options?: any;
  match?: {
    id: string;
    options?: {
      best_of?: number;
    };
    lineup_1?: any;
    lineup_2?: any;
  };
  parent_bracket?: {
    round: number;
    match_number?: number;
  };
  loser_bracket?: {
    round: number;
    match_number?: number;
  };
  team_1?: {
    name?: string;
    team?: {
      name?: string;
    };
  };
  team_2?: {
    name?: string;
    team?: {
      name?: string;
    };
  };
  team_1_seed?: number;
  team_2_seed?: number;
  stage?: {
    options?: {
      best_of?: number;
    };
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    options?: {
      best_of?: number;
    };
  };
}

const props = defineProps<{
  round: number;
  brackets: Bracket[];
  stage: {
    type?: string;
    options?: {
      best_of?: number;
    };
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    options?: {
      best_of?: number;
    };
  };
}>();

const editBracketDialogs = ref<Record<string, boolean>>({});

const getBestOf = (
  bracket: Bracket,
  stage: any,
  tournament: any,
): number | null => {
  // Try to get best_of from bracket options first
  if (bracket.options?.best_of) {
    return bracket.options.best_of;
  }
  // Try to get best_of from match options
  if (bracket.match?.options?.best_of) {
    return bracket.match.options.best_of;
  }
  // If no match yet, try to get from stage options (if available)
  if (stage?.options?.best_of) {
    return stage.options.best_of;
  }
  // Fall back to tournament options (if available)
  if (tournament?.options?.best_of) {
    return tournament.options.best_of;
  }
  return null;
};

const getTeamName = (team: Bracket["team_1"]): string => {
  return team?.team?.name || team?.name || "";
};

const router = useRouter();

const handleClick = (event: MouseEvent, bracket: Bracket) => {
  if (!bracket.match) return;

  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    window.open(`/matches/${bracket.match.id}`, "_blank");
    return;
  }

  router.push({
    name: "matches-id",
    params: { id: bracket.match.id },
  });
};

const canEditBracket = (bracket: Bracket) => {
  return (
    props.tournament?.is_organizer &&
    props.tournament?.status === e_tournament_status_enum.Setup
  );
};

const openEditDialog = (bracket: Bracket, event: MouseEvent) => {
  event.stopPropagation();
  editBracketDialogs.value[bracket.id] = true;
};

const handleBracketUpdated = (bracketId: string) => {
  editBracketDialogs.value[bracketId] = false;
};
</script>

<template>
  <template v-for="bracket in props.brackets" :key="bracket.id">
    <div
      v-if="!(bracket.bye && !bracket.team_1 && !bracket.team_2)"
      :id="`bracket-${bracket.id}`"
      class="tournament-match cursor-pointer border-2 border-gray-700 rounded-lg p-1 transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm relative flex flex-col gap-2"
      :data-bracket-id="bracket.id"
      :data-round="props.round"
      @click="handleClick($event, bracket)"
    >
      <div class="flex items-center justify-between gap-2">
        <Badge v-if="bracket.bye">
          {{ $t("tournament.match.bye_round") }}
        </Badge>
        <Badge v-else class="flex items-center gap-2">
          {{
            $t("tournament.match.round_match", {
              round: props.round,
              match: bracket.match_number,
              prefix: bracket.path === "LB" ? "Losers" : "",
            })
          }}
          <span
            v-if="getBestOf(bracket, stage, tournament)"
            class="text-muted-foreground"
          >
            BO{{ getBestOf(bracket, stage, tournament) }}
          </span>
        </Badge>

        <Button
          v-if="canEditBracket(bracket)"
          class="h-5 w-5 p-1 flex-shrink-0"
          @click="openEditDialog(bracket, $event)"
        >
          <Settings />
        </Button>
      </div>

      <!-- Display scheduled ETA if available -->
      <div
        v-if="bracket.scheduled_eta && !bracket.match"
        class="text-xs text-muted-foreground flex flex-col items-center gap-1"
      >
        <span>{{ $t("tournament.match.scheduled_for") }}</span>
        <span class="text-blue-400 font-medium">
          <TimeAgo :date="bracket.scheduled_eta"></TimeAgo>
        </span>
      </div>

      <template
        v-if="stage.type === e_tournament_stage_types_enum.DoubleElimination"
      >
        <div v-if="bracket.parent_bracket" class="text-center">
          <div class="text-xs text-green-400 font-medium">
            <span class="inline-flex items-center gap-1">
              <span>Parent →</span>
              <span v-if="bracket.parent_bracket.match_number">
                Round {{ bracket.parent_bracket.round }}, Match
                {{ bracket.parent_bracket.match_number }}
              </span>
              <span v-else> Round {{ bracket.parent_bracket.round }} </span>
            </span>
          </div>
        </div>

        <div v-if="bracket.loser_bracket" class="text-center">
          <div class="text-xs text-red-400 font-medium">
            <span class="inline-flex items-center gap-1">
              <span>Loser →</span>
              <span v-if="bracket.loser_bracket.match_number">
                Round {{ bracket.loser_bracket.round }}, Match
                {{ bracket.loser_bracket.match_number }}
              </span>
              <span v-else> Round {{ bracket.loser_bracket.round }} </span>
            </span>
          </div>
        </div>
      </template>

      <!-- Team Display -->
      <div class="flex flex-col gap-2">
        <template v-if="bracket.bye">
          <!-- Bye round: show only the team that exists -->
          <div v-if="bracket.team_1 || bracket.team_2" class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
              <span class="flex items-center gap-2">
                {{ getTeamName(bracket.team_1 || bracket.team_2) }}
                <span
                  v-if="bracket.team_1_seed || bracket.team_2_seed"
                  class="text-muted-foreground"
                >
                  (#{{ bracket.team_1_seed || bracket.team_2_seed }})
                </span>
              </span>
            </div>
          </div>
        </template>
        <template v-else>
          <!-- Regular match: show both teams -->
          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
              <span v-if="bracket.match" class="flex items-center gap-2">
                <TournamentRoundLineup
                  :lineup_name="getTeamName(bracket.team_1)"
                  :match="bracket.match"
                  :lineup="bracket.match.lineup_1"
                />
                <span v-if="bracket.team_1_seed" class="text-muted-foreground">
                  (#{{ bracket.team_1_seed }})
                </span>
              </span>
              <template v-else>
                <span v-if="bracket.team_1" class="flex items-center gap-2">
                  {{ getTeamName(bracket.team_1) }}
                  <span
                    v-if="bracket.team_1_seed"
                    class="text-muted-foreground"
                  >
                    (#{{ bracket.team_1_seed }})
                  </span>
                </span>
                <span v-else class="flex items-center gap-2">
                  {{ $t("tournament.match.team_1") }}
                  <span
                    v-if="bracket.team_1_seed"
                    class="text-muted-foreground"
                  >
                    (#{{ bracket.team_1_seed }})
                  </span>
                </span>
              </template>
            </div>
          </div>

          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
              <span v-if="bracket.match" class="flex items-center gap-2">
                <TournamentRoundLineup
                  :lineup_name="getTeamName(bracket.team_2)"
                  :match="bracket.match"
                  :lineup="bracket.match.lineup_2"
                />
                <span v-if="bracket.team_2_seed" class="text-muted-foreground">
                  (#{{ bracket.team_2_seed }})
                </span>
              </span>
              <template v-else>
                <span v-if="bracket.team_2" class="flex items-center gap-2">
                  {{ getTeamName(bracket.team_2) }}
                  <span
                    v-if="bracket.team_2_seed"
                    class="text-muted-foreground"
                  >
                    (#{{ bracket.team_2_seed }})
                  </span>
                </span>
                <span v-else class="flex items-center gap-2">
                  {{ $t("tournament.match.team_2") }}
                  <span
                    v-if="bracket.team_2_seed"
                    class="text-muted-foreground"
                  >
                    (#{{ bracket.team_2_seed }})
                  </span>
                </span>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Edit Bracket Sheets -->
    <Sheet
      v-for="bracket in props.brackets"
      :key="`edit-bracket-${bracket.id}`"
      :open="editBracketDialogs[bracket.id]"
      @update:open="(open) => (editBracketDialogs[bracket.id] = open)"
    >
      <SheetContent
        side="right"
        class="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {{
              $t("tournament.bracket.edit_title", {
                round: props.round,
                match: bracket.match_number,
              })
            }}
          </SheetTitle>
          <SheetDescription>
            <TournamentBracketForm
              v-if="bracket"
              :bracket="bracket"
              :tournament="tournament"
              :stage="stage"
              @updated="handleBracketUpdated(bracket.id)"
            ></TournamentBracketForm>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  </template>
</template>
