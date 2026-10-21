<script setup lang="ts">
import { computed } from "vue";
import { TriangleAlert } from "lucide-vue-next";
import AnimatedStat from "~/components/AnimatedStat.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { e_sides_enum } from "~/generated/zeus";
import type { RewindPlayer } from "~/utilities/rewind";
import { resolveWeapon } from "~/utilities/weaponIcon";

const props = defineProps<{
  name: string;
  side: e_sides_enum;
  players: RewindPlayer[];
  now?: RewindPlayer[];
  round?: number | null;
  offline?: string[];
}>();

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

const rows = computed(() =>
  props.players.map((player) => {
    const now = props.now?.find((other) => other.steam_id === player.steam_id);
    const changed = (pick: (p: RewindPlayer) => unknown) =>
      !!now && JSON.stringify(pick(player)) !== JSON.stringify(pick(now));
    return {
      player,
      now,
      offline: props.offline?.includes(player.name) ?? false,
      cashChanged: changed((p) => p.cash),
      armorChanged: changed((p) => [p.armor, p.helmet]),
      weaponsChanged: changed((p) => p.weapons),
      killsChanged: changed((p) => p.kills),
      deathsChanged: changed((p) => p.deaths),
    };
  }),
);

const bank = computed(() =>
  money(props.players.reduce((sum, player) => sum + player.cash, 0)),
);

const sideClasses = computed(() =>
  props.side === e_sides_enum.CT
    ? "bg-sky-500/15 text-sky-300"
    : "bg-amber-500/15 text-amber-300",
);

const changedClass = "text-[hsl(var(--tac-amber))]";
</script>

<template>
  <div
    class="min-w-0 overflow-hidden rounded-lg border bg-card/30 transition-colors duration-200"
    :class="round ? 'border-[hsl(var(--tac-amber)/0.35)]' : 'border-border/60'"
  >
    <div
      class="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5"
    >
      <span class="truncate text-sm font-bold">{{ name }}</span>
      <span
        class="rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em]"
        :class="sideClasses"
      >
        {{ side === e_sides_enum.CT ? "CT" : "T" }}
      </span>
      <span
        v-if="round"
        class="truncate font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("match.rewind.at_start_of", { round }) }}
      </span>
      <span class="flex-1" />
      <span class="shrink-0 text-xs text-muted-foreground">
        {{ $t("match.rewind.bank") }}
        <AnimatedStat class="tabular-nums text-success" :value="bank" />
      </span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[26rem] text-sm">
        <thead>
          <tr
            class="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            <th class="px-4 py-2 text-left font-medium">
              {{ $t("match.rewind.player") }}
            </th>
            <th class="px-2 py-2 text-right font-medium">
              {{ $t("match.rewind.cash") }}
            </th>
            <th class="px-2 py-2 text-left font-medium">
              {{ $t("match.rewind.armor") }}
            </th>
            <th class="px-2 py-2 text-left font-medium">
              {{ $t("match.rewind.carries") }}
            </th>
            <th class="px-2 py-2 text-right font-medium">K</th>
            <th class="py-2 pl-2 pr-4 text-right font-medium">D</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.player.steam_id"
            class="border-t border-border/40"
          >
            <td class="px-4 py-2">
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded bg-muted text-[0.68rem] font-bold text-muted-foreground"
                >
                  {{ row.player.name.charAt(0).toUpperCase() }}
                </span>
                <span class="truncate font-semibold">{{
                  row.player.name
                }}</span>
                <FiveStackToolTip v-if="row.offline" as-child side="top">
                  <template #trigger>
                    <span
                      tabindex="0"
                      class="inline-flex text-[hsl(var(--tac-amber))]"
                      :aria-label="$t('match.rewind.not_connected')"
                    >
                      <TriangleAlert class="size-3.5" />
                    </span>
                  </template>
                  {{ $t("match.rewind.not_connected_tip") }}
                </FiveStackToolTip>
              </span>
            </td>
            <td
              class="px-2 py-2 text-right tabular-nums"
              :class="row.cashChanged ? changedClass : 'text-success'"
              :title="
                row.cashChanged && row.now
                  ? $t('match.rewind.now_value', { value: money(row.now.cash) })
                  : undefined
              "
            >
              <AnimatedStat :value="money(row.player.cash)" />
            </td>
            <td class="px-2 py-2" :class="row.armorChanged && changedClass">
              <span
                v-if="row.player.armor > 0"
                class="equipment-mask inline-block size-4 bg-current align-middle"
                :class="!row.armorChanged && 'text-foreground/80'"
                :style="{
                  maskImage: `url(/img/equipment/${row.player.helmet ? 'armor_helmet' : 'kevlar'}.svg)`,
                  WebkitMaskImage: `url(/img/equipment/${row.player.helmet ? 'armor_helmet' : 'kevlar'}.svg)`,
                }"
                :title="
                  row.player.helmet
                    ? $t('match.rewind.armor_helmet')
                    : $t('match.rewind.armor_only')
                "
              />
              <span v-else class="text-xs text-muted-foreground/60">—</span>
            </td>
            <td class="px-2 py-2" :class="row.weaponsChanged && changedClass">
              <span
                v-if="row.player.weapons.length"
                class="flex items-center gap-2"
              >
                <span
                  v-for="weapon in row.player.weapons.slice(0, 2)"
                  :key="weapon"
                  class="equipment-mask inline-block h-4 w-9 bg-current"
                  :class="!row.weaponsChanged && 'text-foreground/80'"
                  :style="{
                    maskImage: `url(${resolveWeapon(weapon).icon})`,
                    WebkitMaskImage: `url(${resolveWeapon(weapon).icon})`,
                  }"
                  :title="resolveWeapon(weapon).label"
                  role="img"
                  :aria-label="resolveWeapon(weapon).label"
                />
              </span>
              <span v-else class="text-xs text-muted-foreground/70">
                {{ $t("match.rewind.buys_fresh") }}
              </span>
            </td>
            <td
              class="px-2 py-2 text-right tabular-nums"
              :class="row.killsChanged && changedClass"
            >
              <AnimatedStat :value="row.player.kills" />
            </td>
            <td
              class="py-2 pl-2 pr-4 text-right tabular-nums"
              :class="
                row.deathsChanged ? changedClass : 'text-muted-foreground'
              "
            >
              <AnimatedStat :value="row.player.deaths" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.equipment-mask {
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: left center;
  -webkit-mask-position: left center;
}
</style>
