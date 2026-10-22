<script setup lang="ts">
import { computed } from "vue";
import { Crown, Mic, X } from "lucide-vue-next";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

// One taken seat in the /play seat row. `compact` is the half-height card used
// when the whole match is drawn in two rows.
const props = defineProps<{
  player: any;
  elo: number | null;
  invited: boolean;
  captain: boolean;
  me: boolean;
  compact: boolean;
  canRemove: boolean;
  inVoice: boolean;
  speaking: boolean;
}>();

defineEmits<{ (e: "remove"): void }>();

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const avatarSrc = computed(() =>
  resolveAvatarUrl(
    props.player.roster_image_url ||
      props.player.custom_avatar_url ||
      props.player.avatar_url,
    apiDomain,
    128,
  ),
);

const initials = computed(() =>
  (props.player.name ?? "?").slice(0, 2).toUpperCase(),
);
</script>

<template>
  <div
    class="group/seat relative flex h-full min-w-0 rounded-[10px] border"
    :class="[
      compact
        ? 'flex-row items-center gap-2.5 py-0 pl-3 pr-7 max-sm:flex-col max-sm:justify-center max-sm:gap-0.5 max-sm:p-0.5'
        : 'flex-col items-center justify-center gap-1.5 p-3 max-sm:gap-1 max-sm:px-1 max-sm:py-2',
      invited
        ? 'border-dashed border-[hsl(var(--tac-amber)/0.4)] bg-transparent'
        : me
          ? 'border-[hsl(var(--tac-amber)/0.28)] bg-[radial-gradient(120%_70%_at_50%_0%,hsl(var(--tac-amber)/0.13),transparent_70%),hsl(var(--muted)/0.2)]'
          : 'border-border bg-muted/20',
    ]"
  >
    <Crown
      v-if="captain"
      class="absolute fill-current text-[hsl(var(--tac-amber))]"
      :class="
        compact
          ? 'left-1.5 top-1.5 size-[11px] max-sm:hidden'
          : 'left-2.5 top-2.5 size-3.5 max-sm:left-1.5 max-sm:top-1.5 max-sm:size-3'
      "
    />
    <button
      v-if="canRemove"
      type="button"
      class="absolute grid size-[22px] place-items-center rounded-full border border-border bg-popover text-muted-foreground transition-[opacity,color,border-color] [transition-duration:150ms] hover:border-destructive/40 hover:text-destructive focus-visible:opacity-100 max-sm:size-4 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/seat:opacity-100"
      :class="
        compact
          ? 'right-1.5 top-1/2 -translate-y-1/2 max-sm:right-0.5 max-sm:top-0.5 max-sm:translate-y-0'
          : 'right-1.5 top-1.5 max-sm:right-1 max-sm:top-1'
      "
      :aria-label="
        invited
          ? $t('pages.play.matchmaking.seat_row.cancel_invite_for', {
              name: player.name,
            })
          : $t('layouts.party_room.remove', { name: player.name })
      "
      @click="$emit('remove')"
    >
      <X class="size-3 max-sm:size-2.5" />
    </button>

    <span class="relative shrink-0" :class="invited && 'opacity-40'">
      <Avatar
        shape="square"
        class="transition-shadow"
        :class="[
          compact
            ? 'size-[38px] text-[12px] max-sm:size-7 max-sm:text-[10px]'
            : 'size-14 rounded-[9px] text-[17px] max-sm:size-10 max-sm:text-[13px]',
          speaking &&
            'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_rgb(52_211_153)]',
        ]"
      >
        <AvatarImage v-if="avatarSrc" :src="avatarSrc" :alt="player.name" />
        <AvatarFallback>{{ initials }}</AvatarFallback>
      </Avatar>
      <span
        v-if="inVoice"
        class="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full bg-emerald-500 text-black shadow-[0_0_0_2px_hsl(var(--background))] max-sm:size-3.5"
      >
        <Mic class="size-2.5 max-sm:size-2" />
      </span>
    </span>

    <span
      class="grid min-w-0 max-w-full gap-0.5"
      :class="
        compact
          ? 'justify-items-start max-sm:justify-items-center'
          : 'justify-items-center'
      "
    >
      <NuxtLink
        :to="{ name: 'players-id', params: { id: player.steam_id } }"
        class="max-w-full truncate font-semibold hover:underline"
        :class="
          compact
            ? 'text-[13px] max-sm:text-[10.5px]'
            : 'mt-1 text-sm max-sm:mt-0.5 max-sm:text-[11.5px]'
        "
      >
        {{ player.name }}
      </NuxtLink>
      <span
        v-if="invited"
        class="text-[12.5px] text-[hsl(var(--tac-amber))] max-sm:text-[11px]"
        :class="compact && 'max-sm:hidden'"
      >
        {{ $t("matchmaking.lobby.invited") }}
      </span>
      <!-- Always drawn, so a player without a rating in this mode doesn't
           shift the seat when the mode changes. -->
      <span
        v-else
        class="text-[12.5px] tabular-nums text-muted-foreground max-sm:text-[11px]"
        :class="compact && 'text-[11.5px] max-sm:hidden'"
      >
        <template v-if="elo !== null"
          >{{ elo.toLocaleString()
          }}<small
            class="ml-1 text-[10px] tracking-[0.1em] text-muted-foreground/70 max-sm:hidden"
            >ELO</small
          ></template
        >
        <template v-else>{{
          $t("pages.play.matchmaking.seat_row.unranked")
        }}</template>
      </span>
    </span>
  </div>
</template>
