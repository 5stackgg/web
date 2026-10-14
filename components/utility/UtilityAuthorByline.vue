<script setup lang="ts">
import { computed } from "vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import type { UtilityAuthorRef } from "~/types/utility";

// PlayerDisplay's smallest avatar is as tall as two lines of text, which put
// a lineup's byline out of step with the lines beside it.
const props = withDefaults(
  defineProps<{ author: UtilityAuthorRef; contextMenu?: boolean }>(),
  { contextMenu: true },
);

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const src = computed(() =>
  resolveAvatarUrl(
    props.author.custom_avatar_url || props.author.avatar_url,
    apiDomain,
  ),
);
</script>

<template>
  <PlayerDisplay
    :player="author"
    size="xs"
    compact
    truncate-name
    :show-elo="false"
    :show-role="false"
    :show-online="false"
    :context-menu="contextMenu"
    class="min-w-0"
  >
    <template #avatar>
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
    </template>
  </PlayerDisplay>
</template>
