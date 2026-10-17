<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { TriangleAlert } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createButtonClasses } from "~/utilities/tacticalClasses";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";

// Grant from inside the award's sheet: pick a player or a team, add a note,
// and the new holder lands in the list underneath.
const props = defineProps<{
  award: any;
  holders: any[];
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "granted", name: string): void;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

const kind = ref<"player" | "team">("player");
const player = ref<any>(null);
const team = ref<any>(null);
const note = ref("");
const error = ref<string | null>(null);

const kinds = computed(() => [
  { key: "player", label: t("awards_manage_form.player") },
  { key: "team", label: t("awards_manage_form.team") },
]);

const pickedName = computed(() =>
  kind.value === "player"
    ? (player.value?.name ?? null)
    : (team.value?.name ?? null),
);

const duplicate = computed(() => {
  if (props.award?.allow_multiple) return false;
  if (kind.value === "player" && player.value) {
    return props.holders.some(
      (row) => String(row.player_steam_id) === String(player.value.steam_id),
    );
  }
  if (kind.value === "team" && team.value) {
    return props.holders.some(
      (row) => !row.player_steam_id && row.team_id === team.value.id,
    );
  }
  return false;
});

const ready = computed(
  () =>
    !duplicate.value &&
    (kind.value === "player" ? !!player.value : !!team.value),
);

function selectKind(value: unknown) {
  kind.value = value as "player" | "team";
  player.value = null;
  team.value = null;
}

function reset() {
  player.value = null;
  team.value = null;
  note.value = "";
  error.value = null;
}

async function grant() {
  if (!ready.value) return;
  error.value = null;
  const name = pickedName.value ?? "";
  try {
    await client.mutate({
      mutation: typedGql("mutation")({
        grantAward: [
          {
            award_id: $("award_id", "uuid!"),
            tournament_id: $("tournament_id", "uuid"),
            season_id: $("season_id", "uuid"),
            event_id: $("event_id", "uuid"),
            league_season_id: $("league_season_id", "uuid"),
            player_steam_id: $("player_steam_id", "String"),
            team_id: $("team_id", "uuid"),
            note: $("note", "String"),
          },
          { id: true },
        ],
      }),
      variables: {
        award_id: props.award.id,
        tournament_id: props.award.tournament_id ?? null,
        season_id: props.award.season_id ?? null,
        event_id: props.award.event_id ?? null,
        league_season_id: props.award.league_season_id ?? null,
        player_steam_id:
          kind.value === "player" ? String(player.value.steam_id) : null,
        team_id: kind.value === "team" ? team.value.id : null,
        note: note.value.trim() || null,
      },
    });
    reset();
    emit("granted", name);
  } catch (err: any) {
    error.value = err?.message ?? String(err);
  }
}
</script>

<template>
  <div
    class="grid gap-3 rounded-lg border border-border bg-muted/20 p-3.5"
    data-award-grant-inline
  >
    <AnimatedFilters
      class="justify-self-start"
      :model-value="kind"
      square
      :options="kinds"
      @update:model-value="selectKind"
    />

    <PlayerSearch
      v-if="kind === 'player'"
      :label="$t('ui_extras.select_player_placeholder')"
      :self="true"
      :selected="player"
      @selected="(picked: any) => (player = picked)"
    />
    <template v-else>
      <TeamSearch
        :label="$t('ui_extras.select_team_placeholder')"
        :model-value="team?.id ?? ''"
        @selected="(picked: any) => (team = picked)"
      />
      <p class="text-xs text-muted-foreground">
        {{ $t("awards.composer.team_fans_out") }}
      </p>
    </template>

    <p
      v-if="duplicate"
      class="flex items-start gap-1.5 text-xs text-warning"
      role="status"
    >
      <TriangleAlert class="mt-px size-3.5 shrink-0" />
      {{
        $t("pages.awards.already_holds", {
          name: pickedName,
          award: award.name,
        })
      }}
    </p>

    <label class="grid gap-1.5">
      <span class="text-xs font-medium text-muted-foreground">
        {{ $t("pages.awards.note") }}
      </span>
      <Input v-model="note" maxlength="140" autocomplete="off" />
    </label>

    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <span
        v-if="pickedName"
        class="mr-auto min-w-0 truncate text-xs text-muted-foreground"
      >
        &rarr; {{ pickedName }}
      </span>
      <Button variant="ghost" size="sm" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </Button>
      <Button
        size="sm"
        :class="createButtonClasses"
        :disabled="!ready"
        @click="grant"
      >
        {{ $t("pages.awards.grant") }}
      </Button>
    </div>
  </div>
</template>
