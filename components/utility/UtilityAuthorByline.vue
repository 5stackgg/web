<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import type { UtilityAuthorRef } from "~/types/utility";

// One line of text tall. PlayerDisplay holds a 48px grid with a 32px avatar
// column even when compact, which made a tile's last line three lines tall.
const props = defineProps<{ author: UtilityAuthorRef }>();

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const src = computed(() =>
  resolveAvatarUrl(
    props.author.custom_avatar_url || props.author.avatar_url,
    apiDomain,
  ),
);
</script>

<template>
  <NuxtLink
    :to="{ name: 'players-id', params: { id: author.steam_id } }"
    class="group/byline flex h-4 min-w-0 items-center gap-1.5 text-xs"
    @click.stop
  >
    <Avatar shape="square" class="h-4 w-4 rounded-[3px]">
      <AvatarImage
        v-if="src"
        :src="src"
        :alt="author.name"
        draggable="false"
        class="select-none"
      />
      <AvatarFallback class="text-[0.45rem]">
        {{ author.name.slice(0, 2) }}
      </AvatarFallback>
    </Avatar>
    <span
      class="truncate transition-colors group-hover/byline:text-[hsl(var(--tac-amber))]"
    >
      {{ author.name }}
    </span>
  </NuxtLink>
</template>
