<script setup lang="ts">
import { computed } from "vue";
import { User } from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import SanctionStatusBadge from "~/components/SanctionStatusBadge.vue";
import PlayerVacBadge from "~/components/PlayerVacBadge.vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { activeSanctions } from "~/utilities/communityStats";

// One geometry for every row: a state never adds a tag or a line, it only
// changes what an existing slot shows (the one sanction pill, the avatar, the
// sub-line), so a roster of mixed players stays aligned.
const props = defineProps<{
  steamId: string;
  name?: string | null;
  player?: Record<string, any> | null;
  detail?: string | null;
  dim?: boolean;
}>();

const apiDomain = useRuntimeConfig().public.apiDomain;

// A players row exists for anyone 5stack has ever seen or imported; only a
// registered one has signed in and has an account worth linking to.
const hasAccount = computed(() => !!props.player?.is_registered);

const displayName = computed(() =>
  hasAccount.value
    ? props.player?.name || props.name || props.steamId
    : props.name || props.player?.name || props.steamId,
);

const inGameName = computed(() =>
  hasAccount.value && props.name && props.name !== props.player?.name
    ? props.name
    : null,
);

const avatarSrc = computed(() =>
  resolveAvatarUrl(props.player?.avatar_url, apiDomain),
);

const sanctions = computed(() => activeSanctions(props.player));

const profileLink = computed(() =>
  hasAccount.value
    ? { name: "players-id", params: { id: props.steamId } }
    : undefined,
);
</script>

<template>
  <div class="flex min-w-0 items-center gap-2.5">
    <NuxtLink
      v-if="hasAccount"
      :to="profileLink"
      class="shrink-0"
      tabindex="-1"
      aria-hidden="true"
    >
      <Avatar
        shape="square"
        class="h-8 w-8 transition-[filter] duration-200"
        :class="dim && 'brightness-75 grayscale-[0.6]'"
      >
        <AvatarImage
          v-if="avatarSrc"
          :src="avatarSrc"
          :alt="displayName"
          draggable="false"
        />
        <AvatarFallback class="text-xs font-bold">
          {{ displayName.slice(0, 2) }}
        </AvatarFallback>
      </Avatar>
    </NuxtLink>
    <span
      v-else
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      data-testid="steam-only-avatar"
    >
      <User class="h-3.5 w-3.5" />
    </span>

    <div class="min-w-0">
      <div class="flex min-w-0 items-center gap-1.5">
        <NuxtLink
          v-if="hasAccount"
          :to="profileLink"
          class="truncate font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
        >
          {{ displayName }}
        </NuxtLink>
        <span v-else class="truncate font-medium text-foreground/85">
          {{ displayName }}
        </span>
        <SanctionStatusBadge
          v-if="sanctions.length"
          :type="sanctions[0]"
          :active="sanctions"
        />
        <PlayerVacBadge v-if="player" :player="player" />
      </div>
      <div class="truncate font-mono text-[0.7rem] text-muted-foreground">
        <template v-if="!hasAccount">
          <span class="text-muted-foreground/80">{{
            $t("community.player.steam_only")
          }}</span>
          · {{ steamId }}
        </template>
        <template v-else-if="inGameName">
          {{ $t("community.player.in_game", { name: inGameName }) }}
        </template>
        <template v-else>{{ steamId }}</template>
        <template v-if="detail"> · {{ detail }}</template>
      </div>
    </div>
  </div>
</template>
