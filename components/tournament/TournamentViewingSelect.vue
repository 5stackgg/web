<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Entry = {
  id: string;
  name?: string | null;
  checked_in_at?: string | null;
  team?: { name?: string | null } | null;
  roster?: Array<{ player?: { steam_id?: string | number } | null }>;
};

const props = defineProps<{
  teams: Entry[];
  steamId?: string | number | null;
  maxPlayers: number;
  checkIn?: "open" | "closed" | null;
}>();

const model = defineModel<string | null>({ default: null });

const checkInStatus = (checkedIn: boolean) => {
  if (!props.checkIn) {
    return null;
  }
  if (checkedIn) {
    return { key: "tournament.team.status.checked_in", class: "text-success" };
  }
  if (props.checkIn === "closed") {
    return { key: "tournament.team.status.missed", class: "text-destructive" };
  }
  return {
    key: "tournament.team.status.not_checked_in",
    class: "text-[hsl(var(--tac-amber))]",
  };
};

const entries = computed(() =>
  props.teams.map((team) => ({
    id: team.id,
    name: team.team?.name || team.name || "",
    plays:
      props.steamId != null &&
      (team.roster ?? []).some(
        (member) => String(member.player?.steam_id) === String(props.steamId),
      ),
    players: team.roster?.length ?? 0,
    status: checkInStatus(!!team.checked_in_at),
  })),
);

const selected = computed(
  () =>
    entries.value.find((entry) => entry.id === model.value) ??
    entries.value[0],
);

const playing = computed(() => entries.value.find((entry) => entry.plays));

const select = (id: unknown) => {
  if (typeof id === "string") {
    model.value = id;
  }
};

const triggerClasses = cn(
  buttonVariants({ variant: "outline" }),
  "min-w-0 max-w-full justify-start overflow-hidden px-3 sm:max-w-[18rem] max-sm:basis-full",
);

const roleTagClasses =
  "inline-flex h-[1.125rem] shrink-0 items-center rounded border px-1.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em]";
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button type="button" :class="triggerClasses" data-tournament-viewing>
        <span
          class="shrink-0 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("tournament.viewing.label") }}
        </span>
        <span class="min-w-0 truncate">{{ selected?.name }}</span>
        <ChevronDown class="ml-auto text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72">
      <DropdownMenuLabel
        class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("tournament.viewing.menu_title") }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        :model-value="selected?.id"
        @update:model-value="select"
      >
        <DropdownMenuRadioItem
          v-for="entry in entries"
          :key="entry.id"
          :value="entry.id"
          class="py-2"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate font-semibold">{{ entry.name }}</span>
              <span
                :class="[
                  roleTagClasses,
                  entry.plays
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                    : 'border-border text-muted-foreground',
                ]"
              >
                {{
                  entry.plays
                    ? $t("tournament.viewing.you_play")
                    : $t("tournament.viewing.owner")
                }}
              </span>
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                $t("tournament.viewing.players", {
                  count: entry.players,
                  max: maxPlayers,
                })
              }}
              <template v-if="entry.status">
                ·
                <span :class="entry.status.class">
                  {{ $t(entry.status.key) }}
                </span>
              </template>
            </span>
          </span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <p class="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
        {{
          playing
            ? $t("tournament.viewing.plays_hint", { team: playing.name })
            : $t("tournament.viewing.owner_hint")
        }}
      </p>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
