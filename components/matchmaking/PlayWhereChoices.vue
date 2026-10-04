<script setup lang="ts">
import { Globe, Network } from "lucide-vue-next";

defineProps<{
  kind: "queue" | "room";
  lanPing: string | null;
  onlineSummary: string;
}>();

const emit = defineEmits<{ (e: "choose", where: "lan" | "online"): void }>();

const optionClasses =
  "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
const iconClasses = "grid size-9 shrink-0 place-items-center rounded-md";
</script>

<template>
  <div class="grid gap-2.5">
    <button
      type="button"
      :class="[
        optionClasses,
        'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] hover:bg-[hsl(var(--tac-amber)/0.14)]',
      ]"
      @click="emit('choose', 'lan')"
    >
      <span :class="[iconClasses, 'bg-[hsl(var(--tac-amber)/0.16)]']">
        <Network class="size-[18px] text-[hsl(var(--tac-amber))]" />
      </span>
      <span class="grid gap-0.5">
        <span class="text-sm font-bold">{{
          kind === "room"
            ? $t("matchmaking.where.lan_room")
            : $t("matchmaking.where.play_lan")
        }}</span>
        <span class="text-xs text-muted-foreground">
          {{
            kind === "room"
              ? $t("matchmaking.where.lan_room_hint")
              : $t("matchmaking.where.lan_hint")
          }}<template v-if="kind === 'queue' && lanPing">
            · {{ $t("pages.play.matchmaking.regions.ms", { ms: lanPing }) }}
          </template>
        </span>
      </span>
    </button>
    <button
      type="button"
      :class="[
        optionClasses,
        'border-border bg-white/[0.02] hover:bg-muted/40',
      ]"
      @click="emit('choose', 'online')"
    >
      <span :class="[iconClasses, 'bg-white/[0.06]']">
        <Globe class="size-[18px] text-foreground/80" />
      </span>
      <span class="grid gap-0.5">
        <span class="text-sm font-bold">{{
          kind === "room"
            ? $t("matchmaking.where.online_room")
            : $t("matchmaking.where.play_online")
        }}</span>
        <span class="text-xs text-muted-foreground">{{ onlineSummary }}</span>
      </span>
    </button>
  </div>
</template>
