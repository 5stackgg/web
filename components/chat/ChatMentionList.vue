<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { AtSign, CornerDownLeft } from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Spinner } from "~/components/ui/spinner";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  MAX_CHAT_MENTIONS,
  type ChatMentionCandidate,
  type ChatMentionListState,
  type RankedMentionCandidate,
} from "~/utilities/chatMentions";

const props = defineProps<{
  listId: string;
  state: ChatMentionListState;
  rows: RankedMentionCandidate<ChatMentionCandidate>[];
  activeIndex: number;
  query: string;
}>();

defineEmits<{
  (e: "pick", index: number): void;
  (e: "hover", index: number): void;
}>();

const { t } = useI18n();

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);

function avatar(candidate: ChatMentionCandidate) {
  return resolveAvatarUrl(candidate.avatar_url, apiDomain.value) ?? undefined;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function label(candidate: ChatMentionCandidate) {
  if (candidate.team) {
    return candidate.team;
  }

  return candidate.organizer ? t("chat.mentions.organizer") : "";
}

function parts({ candidate, start, length }: (typeof props.rows)[number]) {
  return {
    before: candidate.name.slice(0, start),
    match: candidate.name.slice(start, start + length),
    after: candidate.name.slice(start + length),
  };
}
</script>

<template>
  <div
    :id="listId"
    data-chat-mention-list
    role="listbox"
    :aria-label="$t('chat.mentions.list')"
  >
    <div
      v-if="state === 'limit'"
      class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground"
    >
      <AtSign class="size-3.5 shrink-0" />
      {{ $t("chat.mentions.limit", { max: MAX_CHAT_MENTIONS }) }}
    </div>
    <div
      v-else-if="state === 'loading'"
      class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <Spinner class="size-3.5 shrink-0 motion-reduce:animate-none" />
      {{ $t("chat.mentions.finding") }}
    </div>
    <div
      v-else-if="state === 'failed'"
      class="px-2 py-1.5 text-xs text-muted-foreground"
    >
      {{ $t("chat.mentions.failed") }}
    </div>
    <div
      v-else-if="state === 'empty'"
      class="px-2 py-1.5 text-xs text-muted-foreground"
    >
      {{ $t("chat.mentions.no_match", { query }) }}
    </div>
    <template v-else>
      <!-- mousedown is held back so the caret stays in the message box. -->
      <button
        v-for="(row, index) in rows"
        :id="`${listId}-option-${index}`"
        :key="row.candidate.steam_id"
        type="button"
        role="option"
        data-chat-mention-option
        :aria-selected="index === activeIndex"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-150 motion-reduce:transition-none"
        :class="
          index === activeIndex ? 'bg-accent text-accent-foreground' : ''
        "
        @mousedown.prevent
        @click="$emit('pick', index)"
        @pointermove="$emit('hover', index)"
      >
        <Avatar class="h-5 w-5 text-[0.5rem] font-bold">
          <AvatarImage
            v-if="avatar(row.candidate)"
            :src="avatar(row.candidate)!"
            alt=""
          />
          <AvatarFallback>{{ initials(row.candidate.name) }}</AvatarFallback>
        </Avatar>
        <span class="min-w-0 flex-1 truncate text-xs">
          <span class="text-foreground/80">{{ parts(row).before }}</span>
          <b class="font-semibold text-foreground">{{ parts(row).match }}</b>
          <span class="text-foreground/80">{{ parts(row).after }}</span>
        </span>
        <span
          v-if="label(row.candidate)"
          class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ label(row.candidate) }}
        </span>
        <CornerDownLeft
          v-if="index === activeIndex"
          class="size-3 shrink-0 text-muted-foreground/70 [@media(hover:none)]:hidden"
        />
      </button>
    </template>
  </div>
</template>
