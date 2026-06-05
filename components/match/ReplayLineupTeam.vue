<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import ReplayLineupRow from "~/components/match/ReplayLineupRow.vue";

type RosterEntry = {
  steamId: string;
  name: string;
  team: "ct" | "t" | null;
  slot: number;
  avatarUrl: string | null;
};

type LiveState = {
  alive?: boolean;
  health?: number | null;
  armor?: number | null;
  helmet?: boolean;
  hasBomb?: boolean;
  hasDefuser?: boolean;
  bombAction?: string | null;
};

type Loadout = {
  team: string | null;
  primary: string | null;
  secondary: string | null;
  armor: number;
  helmet: boolean;
  kit: boolean;
  flash: number;
  smoke: number;
  he: number;
  molotov: number;
  decoy: number;
};

type Stats = { k: number; d: number; a: number; dmg: number };

const props = defineProps<{
  team: "ct" | "t";
  label: string;
  score?: number | null;
  members: RosterEntry[];
  liveStateBySteam: Map<string, LiveState>;
  loadoutBySteam: Map<string, Loadout>;
  focusedPlayerId: string | null;
  showAvatars: boolean;
  showC4: boolean;
  statsFor: (sid: string) => Stats;
  hasBombFor: (sid: string) => boolean;
  followLabel: (focused: boolean, name: string) => string;
}>();

defineEmits<{ (e: "focus", sid: string): void }>();

const TEAM_HSL = {
  ct: "210, 80%, 60%",
  t: "33, 94%, 58%",
} as const;

const teamHsl = TEAM_HSL[props.team];
</script>

<template>
  <div>
    <div
      class="flex items-center justify-between gap-2 font-mono mb-1"
      :style="{ color: `hsl(${teamHsl})` }"
    >
      <span class="text-[0.55rem] tracking-[0.22em] uppercase truncate">
        {{ label }}
      </span>
      <span
        v-if="score != null"
        class="text-sm font-bold tabular-nums leading-none"
      >
        {{ score }}
      </span>
    </div>
    <Tooltip v-for="m of members" :key="m.steamId">
      <TooltipTrigger as-child>
        <ReplayLineupRow
          :member="m"
          :team="team"
          :team-hsl="teamHsl"
          :live="liveStateBySteam.get(m.steamId)"
          :loadout="loadoutBySteam.get(m.steamId)"
          :stats="statsFor(m.steamId)"
          :is-focused="focusedPlayerId === m.steamId"
          :has-bomb="hasBombFor(m.steamId)"
          :show-avatars="showAvatars"
          :show-c4="showC4"
          @focus="$emit('focus', m.steamId)"
        />
      </TooltipTrigger>
      <TooltipContent>
        {{ followLabel(focusedPlayerId === m.steamId, m.name) }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
