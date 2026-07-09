<script setup lang="ts">
import { ref, computed } from "vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Plus, X } from "lucide-vue-next";

interface Member {
  steamId: string;
  player: { steam_id: string; name: string; avatar_url: string | null };
}

// Draft-style roster picker: fixed starter/sub slots are the UI. Empty slots
// open a searchable picker of unassigned team members, so a 3-person team and a
// 30-person team look identical (no wall of "available" rows). Shared by the
// league register + tournament join flows via v-model on the assignment map.
const props = defineProps<{
  members: Member[];
  startersCap: number;
  subsCap: number;
  // steamId -> "Starter" | "Substitute"; absent = not on the roster.
  modelValue: Record<string, string>;
  // Render the slots but block interaction (e.g. before a team is picked) so the
  // modal doesn't jump in size once a team is chosen.
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Record<string, string>): void;
}>();

// Which empty slot's picker is open (e.g. "Starter-2"); only one at a time.
const openKey = ref<string | null>(null);

function sortByName(list: Member[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

const starters = computed(() =>
  sortByName(
    props.members.filter((m) => props.modelValue[m.steamId] === "Starter"),
  ),
);
const substitutes = computed(() =>
  sortByName(
    props.members.filter((m) => props.modelValue[m.steamId] === "Substitute"),
  ),
);
const available = computed(() =>
  sortByName(props.members.filter((m) => !props.modelValue[m.steamId])),
);

const emptyStarters = computed(() =>
  Math.max(0, props.startersCap - starters.value.length),
);
const emptySubs = computed(() =>
  Math.max(0, props.subsCap - substitutes.value.length),
);

function assign(steamId: string, role: string) {
  emit("update:modelValue", { ...props.modelValue, [steamId]: role });
  openKey.value = null;
}
function remove(steamId: string) {
  const next = { ...props.modelValue };
  delete next[steamId];
  emit("update:modelValue", next);
}
function setOpen(key: string, open: boolean) {
  openKey.value = open ? key : null;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Starters -->
    <div class="space-y-1.5">
      <div
        class="flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("team.members.starters") }}
        <span
          class="tabular-nums"
          :class="
            starters.length === startersCap
              ? 'text-success'
              : 'text-[hsl(var(--tac-amber))]'
          "
        >
          {{ starters.length }}/{{ startersCap }}
        </span>
      </div>
      <div class="grid gap-1.5 sm:grid-cols-2">
        <!-- Filled starter slots -->
        <div
          v-for="member in starters"
          :key="member.steamId"
          class="flex h-14 items-center gap-2 rounded-lg border border-border border-l-2 border-l-[hsl(var(--tac-amber)/0.8)] bg-card/60 pl-3 pr-2 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <PlayerDisplay
              :player="member.player"
              :show-online="false"
              :show-role="false"
              :show-flag="true"
              :show-elo="true"
              :truncate-name="true"
              size="sm"
            />
          </div>
          <button
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            :title="$t('common.remove')"
            @click="remove(member.steamId)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <!-- Empty starter slots -->
        <Popover
          v-for="i in emptyStarters"
          :key="`starter-empty-${i}`"
          :open="openKey === `Starter-${i}`"
          @update:open="(v: boolean) => setOpen(`Starter-${i}`, v)"
        >
          <PopoverTrigger as-child>
            <button
              type="button"
              :disabled="disabled || !available.length"
              class="flex h-14 w-full items-center gap-2 rounded-lg border border-dashed border-border/70 pl-3 pr-2 text-left text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.05)] hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border/70 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <span
                class="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-dashed border-border/70"
              >
                <Plus class="h-4 w-4" />
              </span>
              <span class="text-sm">{{ $t("roster_picker.add_starter") }}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-[280px] p-0" align="start">
            <Command>
              <CommandInput :placeholder="$t('roster_picker.search')" />
              <CommandEmpty>{{ $t("roster_picker.none") }}</CommandEmpty>
              <CommandList>
                <CommandGroup>
                  <CommandItem
                    v-for="m in available"
                    :key="m.steamId"
                    :value="m.player.name"
                    class="cursor-pointer"
                    @select="assign(m.steamId, 'Starter')"
                  >
                    <PlayerDisplay :player="m.player" size="sm" />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>

    <!-- Substitutes -->
    <div v-if="subsCap > 0" class="space-y-1.5">
      <div
        class="flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("team.members.substitutes") }}
        <span class="tabular-nums text-muted-foreground">
          {{ substitutes.length }}/{{ subsCap }}
        </span>
      </div>
      <div class="grid gap-1.5 sm:grid-cols-2">
        <!-- Filled sub slots -->
        <div
          v-for="member in substitutes"
          :key="member.steamId"
          class="flex h-14 items-center gap-2 rounded-lg border border-border border-l-2 border-l-border bg-card/40 pl-3 pr-2 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <PlayerDisplay
              :player="member.player"
              :show-online="false"
              :show-role="false"
              :show-flag="true"
              :show-elo="true"
              :truncate-name="true"
              size="sm"
            />
          </div>
          <button
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            :title="$t('common.remove')"
            @click="remove(member.steamId)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <!-- Empty sub slots -->
        <Popover
          v-for="i in emptySubs"
          :key="`sub-empty-${i}`"
          :open="openKey === `Substitute-${i}`"
          @update:open="(v: boolean) => setOpen(`Substitute-${i}`, v)"
        >
          <PopoverTrigger as-child>
            <button
              type="button"
              :disabled="disabled || !available.length"
              class="flex h-14 w-full items-center gap-2 rounded-lg border border-dashed border-border/70 pl-3 pr-2 text-left text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.05)] hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border/70 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <span
                class="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-dashed border-border/70"
              >
                <Plus class="h-4 w-4" />
              </span>
              <span class="text-sm">{{
                $t("roster_picker.add_substitute")
              }}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-[280px] p-0" align="start">
            <Command>
              <CommandInput :placeholder="$t('roster_picker.search')" />
              <CommandEmpty>{{ $t("roster_picker.none") }}</CommandEmpty>
              <CommandList>
                <CommandGroup>
                  <CommandItem
                    v-for="m in available"
                    :key="m.steamId"
                    :value="m.player.name"
                    class="cursor-pointer"
                    @select="assign(m.steamId, 'Substitute')"
                  >
                    <PlayerDisplay :player="m.player" size="sm" />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  </div>
</template>
