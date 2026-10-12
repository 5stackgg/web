<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { UserPlus } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { runTournamentAction } from "~/utilities/tournamentActions";

type Agent = Record<string, any>;

const props = withDefaults(
  defineProps<{
    tournament: Record<string, any>;
    // The viewer's own pool row, if they have one. Passed in rather than looked
    // up so this renders the same answer as whatever surface hosts it.
    myEntry?: Agent | null;
  }>(),
  { myEntry: null },
);

const emit = defineEmits<{ joined: [] }>();

const { t } = useI18n();
const { client } = useApolloClient();

const me = computed(() => useAuthStore().me);

const teamSize = computed(
  () =>
    Number(props.tournament?.min_players_per_lineup) ||
    Number(props.tournament?.max_players_per_lineup) ||
    0,
);

// joinTournamentAsFreeAgent requires exactly RegistrationOpen, while the leave
// rule also allows Setup. Offering Sign up during Setup produces a button that
// can only ever fail, so the two windows are kept apart.
//
// joined_tournament with no pool row is a player already on a team (or owning
// one), whom the API refuses: a player is in a tournament once.
const canSignUp = computed(
  () =>
    !!me.value &&
    props.tournament?.status === e_tournament_status_enum.RegistrationOpen &&
    !props.myEntry &&
    !props.tournament?.joined_tournament,
);

async function joinPool() {
  const data = await runTournamentAction(
    client,
    {
      joinTournamentAsFreeAgent: [
        {
          tournament_id: props.tournament.id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.free_agents.join_failed"),
  );

  if (!data) {
    return;
  }

  toast({ title: t("tournament.free_agents.joined") });
  emit("joined");
}
</script>

<template>
  <div
    v-if="canSignUp"
    class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card/45 p-3.5"
  >
    <p
      class="min-w-[18ch] flex-1 text-[0.78rem] leading-relaxed text-muted-foreground"
    >
      {{ $t("tournament.free_agents.sign_up_hint", { size: teamSize }) }}
    </p>
    <Button type="button" size="sm" class="h-8 shrink-0" @click="joinPool()">
      <UserPlus class="mr-1.5 h-3.5 w-3.5" />
      {{ $t("tournament.free_agents.sign_up") }}
    </Button>
  </div>
</template>
