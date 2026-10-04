<script setup lang="ts">
import { computed, onUnmounted } from "vue";
import { Route } from "lucide-vue-next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useBracketView } from "~/composables/useBracketView";
import { SELECT_NONE } from "~/utilities/selectNone";

const props = defineProps<{
  teams: {
    id: string;
    name?: string | null;
    team?: { name?: string } | null;
  }[];
}>();

const { followTeamId } = useBracketView();

const options = computed(() =>
  props.teams
    .map((team) => ({ id: team.id, name: team.team?.name || team.name || "" }))
    .filter((team) => team.name)
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const value = computed({
  get: () => followTeamId.value ?? undefined,
  set: (next?: string) => {
    followTeamId.value = !next || next === SELECT_NONE ? null : next;
  },
});

onUnmounted(() => {
  followTeamId.value = null;
});
</script>

<template>
  <Select v-if="options.length > 1" v-model="value">
    <SelectTrigger
      class="h-9 w-[12rem] gap-2"
      :class="value && 'border-[hsl(var(--tac-amber)/0.55)]'"
      :aria-label="$t('tournament.bracket.follow_team')"
    >
      <Route class="h-4 w-4 shrink-0 text-muted-foreground" />
      <SelectValue :placeholder="$t('tournament.bracket.follow_team')" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-if="value" :value="SELECT_NONE">
        {{ $t("tournament.bracket.follow_none") }}
      </SelectItem>
      <SelectItem v-for="team in options" :key="team.id" :value="team.id">
        {{ team.name }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
