<script setup lang="ts">
import { computed } from "vue";
import { weaponBasename, weaponIconFallback } from "~/utilities/weaponIcon";

// Canonical icon first; if it 404s, retry the legacy strip-all path for old,
// already-parsed demos before hiding.
function onWeaponIconError(e: Event, weapon: string | null | undefined) {
  const img = e.target as HTMLImageElement;
  const fb = weaponIconFallback(weapon);
  if (fb && !img.dataset.fb && !img.src.endsWith(fb)) {
    img.dataset.fb = "1";
    img.src = fb;
  } else {
    img.style.display = "none";
  }
}

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
  member: RosterEntry;
  team: "ct" | "t";
  teamHsl: string;
  live: LiveState | null | undefined;
  loadout: Loadout | null | undefined;
  stats: Stats;
  isFocused: boolean;
  hasBomb: boolean;
  showAvatars: boolean;
  showC4: boolean;
}>();

defineEmits<{ (e: "focus"): void }>();

type GrenadeSlot = {
  key: "flash" | "smoke" | "he" | "molotov" | "decoy";
  baseIcon: string;
  label: string;
};

const GRENADE_SLOTS: GrenadeSlot[] = [
  { key: "flash", baseIcon: "flashbang", label: "Flash" },
  { key: "smoke", baseIcon: "smokegrenade", label: "Smoke" },
  { key: "he", baseIcon: "hegrenade", label: "HE" },
  { key: "molotov", baseIcon: "molotov", label: "Molotov" },
  { key: "decoy", baseIcon: "decoy", label: "Decoy" },
];

function grenadeIcon(slot: GrenadeSlot): string {
  if (slot.key === "molotov" && props.team === "ct") return "incgrenade";
  return slot.baseIcon;
}

function grenadeCount(slot: GrenadeSlot): number {
  if (!props.loadout) return 0;
  return (props.loadout as unknown as Record<string, number>)[slot.key] ?? 0;
}

function hpColor(hp: number): string {
  const clamped = Math.max(0, Math.min(100, hp));
  const hue = (clamped / 100) * 130;
  return `hsl(${hue}, 85%, 55%)`;
}

const isDead = computed(() => props.live?.alive === false);
const hp = computed(() =>
  typeof props.live?.health === "number" ? props.live!.health! : null,
);
const armor = computed(() =>
  typeof props.live?.armor === "number" ? props.live!.armor! : 0,
);

const primaryIcon = computed(
  () => weaponBasename(props.loadout?.primary) || null,
);
const secondaryIcon = computed(
  () => weaponBasename(props.loadout?.secondary) || null,
);
</script>

<template>
  <div
    class="group relative cursor-pointer transition-colors py-1 pl-1.5 pr-1.5 border-l-2 -ml-px"
    :class="[
      isDead ? 'opacity-55' : '',
      isFocused
        ? 'bg-[hsl(var(--tac-amber)/0.10)] border-[hsl(var(--tac-amber))]'
        : 'border-transparent hover:bg-muted/25',
    ]"
    :style="
      !isFocused
        ? ({ '--row-team': `hsl(${teamHsl})` } as Record<string, string>)
        : undefined
    "
    @click="$emit('focus')"
    @mouseenter="
      (e) =>
        !isFocused &&
        ((e.currentTarget as HTMLElement).style.borderLeftColor =
          `hsl(${teamHsl} / 0.55)`)
    "
    @mouseleave="
      (e) =>
        !isFocused &&
        ((e.currentTarget as HTMLElement).style.borderLeftColor = '')
    "
  >
    <div class="flex items-center gap-1.5 h-6">
      <img
        v-if="showAvatars && member.avatarUrl"
        :src="member.avatarUrl"
        :alt="member.name"
        class="w-6 h-6 rounded-full object-cover shrink-0 border-2 ring-1 ring-black/60"
        :style="{ borderColor: `hsl(${teamHsl})` }"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <span
        v-else
        class="w-6 h-6 rounded-full inline-flex items-center justify-center font-mono font-bold text-[10px] shrink-0"
        :style="{ background: `hsl(${teamHsl})`, color: 'hsl(0 0% 98%)' }"
      >
        {{ member.slot }}
      </span>
      <span
        class="truncate flex-1 min-w-0 font-mono text-[0.78rem] tracking-wider"
        :class="isDead ? 'line-through text-muted-foreground' : ''"
      >
        {{ member.name }}
      </span>
      <span
        v-if="showC4 && hasBomb"
        class="inline-flex items-center justify-center w-4 h-4 rounded-sm shrink-0"
        style="background: hsl(28 100% 55%)"
        title="Has C4"
      >
        <img src="/img/equipment/c4.svg" alt="C4" class="w-3 h-3" />
      </span>
    </div>

    <div
      class="pl-7 mt-1 flex items-center gap-3 font-mono tabular-nums h-[14px] leading-none"
    >
      <span class="inline-flex items-baseline gap-1" title="Kills">
        <span
          class="text-[0.5rem] tracking-[0.18em] uppercase text-muted-foreground/70"
          >K</span
        >
        <span class="text-[0.72rem] font-bold text-foreground/90">{{
          stats.k
        }}</span>
      </span>
      <span class="inline-flex items-baseline gap-1" title="Deaths">
        <span
          class="text-[0.5rem] tracking-[0.18em] uppercase text-muted-foreground/70"
          >D</span
        >
        <span class="text-[0.72rem] font-bold text-foreground/90">{{
          stats.d
        }}</span>
      </span>
      <span class="inline-flex items-baseline gap-1" title="Assists">
        <span
          class="text-[0.5rem] tracking-[0.18em] uppercase text-muted-foreground/70"
          >A</span
        >
        <span class="text-[0.72rem] font-bold text-foreground/90">{{
          stats.a
        }}</span>
      </span>
      <span
        class="inline-flex items-baseline gap-1 ml-auto"
        title="Damage this round"
      >
        <span
          class="text-[0.5rem] tracking-[0.18em] uppercase text-muted-foreground/70"
          >Dmg</span
        >
        <span class="text-[0.72rem] font-bold text-foreground/90">{{
          stats.dmg
        }}</span>
      </span>
    </div>

    <div class="pl-7 mt-1 flex items-center gap-1 h-[18px]">
      <span
        v-if="!isDead && hp != null"
        class="font-mono text-[0.65rem] font-bold tabular-nums w-7 text-right leading-none"
        :style="{ color: hpColor(hp) }"
        >{{ hp }}</span
      >
      <span
        v-else
        class="font-mono text-[0.55rem] font-bold tabular-nums w-7 text-right leading-none tracking-[0.1em] uppercase"
        style="color: hsl(0, 60%, 55%)"
        >kia</span
      >
      <div
        class="relative flex-1 h-[6px] rounded-[1px] overflow-hidden"
        style="background: hsl(0 0% 100% / 0.07)"
      >
        <div
          v-if="!isDead && hp != null"
          class="absolute inset-y-0 left-0 transition-[width,background] duration-150"
          :style="{ width: hp + '%', background: hpColor(hp) }"
        />
      </div>
      <span
        v-if="!isDead && armor > 0"
        class="inline-flex items-center gap-0.5 font-mono text-[0.55rem] tabular-nums px-1 py-px border leading-none"
        :style="{
          color: live?.helmet ? 'hsl(195, 100%, 75%)' : 'hsl(200, 70%, 70%)',
          borderColor: live?.helmet
            ? 'hsl(195, 100%, 70% / 0.55)'
            : 'hsl(200, 70%, 55% / 0.45)',
          background: live?.helmet
            ? 'hsl(195, 100%, 60% / 0.08)'
            : 'hsl(200, 70%, 50% / 0.06)',
        }"
        :title="live?.helmet ? 'Kevlar + helmet' : 'Kevlar only'"
      >
        <img
          :src="
            live?.helmet
              ? '/img/equipment/armor_helmet.svg'
              : '/img/equipment/armor.svg'
          "
          class="h-2.5 w-2.5"
          alt=""
        />
        {{ armor }}
      </span>
    </div>

    <div class="pl-7 mt-1 flex items-center gap-2 text-[0.6rem] h-[24px]">
      <template v-if="loadout">
        <div class="flex items-center gap-1 shrink-0" style="min-width: 76px">
          <img
            v-if="primaryIcon"
            :src="`/img/equipment/${primaryIcon}.svg`"
            :alt="loadout.primary ?? ''"
            :title="loadout.primary ?? ''"
            class="h-5 w-auto max-w-[48px] opacity-95"
            @error="onWeaponIconError($event, loadout.primary)"
          />
          <img
            v-if="secondaryIcon"
            :src="`/img/equipment/${secondaryIcon}.svg`"
            :alt="loadout.secondary ?? ''"
            :title="loadout.secondary ?? ''"
            class="h-4 w-auto max-w-[28px] opacity-85"
            @error="onWeaponIconError($event, loadout.secondary)"
          />
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <span
            v-for="slot of GRENADE_SLOTS"
            :key="slot.key"
            class="relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm"
            :class="
              grenadeCount(slot) > 0
                ? 'bg-[hsl(var(--card)/0.6)] ring-1 ring-white/10'
                : ''
            "
            :title="
              grenadeCount(slot) > 0
                ? `${slot.label} ×${grenadeCount(slot)}`
                : `${slot.label} (none)`
            "
          >
            <img
              :src="`/img/equipment/${grenadeIcon(slot)}.svg`"
              :alt="slot.label"
              class="h-3.5 w-3.5"
              :class="grenadeCount(slot) > 0 ? 'opacity-95' : 'opacity-[0.12]'"
            />
            <span
              v-if="grenadeCount(slot) > 1"
              class="absolute -bottom-1 -right-1 font-mono text-[9px] leading-none font-bold tabular-nums px-[3px] rounded-sm bg-[hsl(var(--background))] text-foreground/95 ring-1 ring-black/60"
              >{{ grenadeCount(slot) }}</span
            >
          </span>
        </div>

        <span
          v-if="loadout.kit"
          class="ml-auto inline-flex items-center gap-1 font-mono text-[0.55rem] font-bold tracking-[0.2em] uppercase px-2 py-1 leading-none rounded-sm"
          style="background: hsl(190 90% 55% / 0.18); color: hsl(190 90% 75%)"
          title="Defuse kit"
        >
          <img src="/img/equipment/defuser.svg" class="h-2.5 w-2.5" alt="" />
          kit
        </span>
      </template>
    </div>
  </div>
</template>
