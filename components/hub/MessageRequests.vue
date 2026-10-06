<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { X } from "lucide-vue-next";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import HubEmptyState from "~/components/hub/HubEmptyState.vue";
import { toast } from "~/components/ui/toast";
import {
  useMessageRequests,
  type MessageRequest,
} from "~/composables/useMessageRequests";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

// First messages from players who are not friends, inside Chat itself like
// New message. Opening one shows the conversation; replying there accepts it.
// Denying hides it here without the sender being told.
const emit = defineEmits<{
  (e: "close"): void;
  (e: "open", request: MessageRequest): void;
}>();

const { t } = useI18n();
const { requests, decline } = useMessageRequests();
const apiDomain = useRuntimeConfig().public.apiDomain as string;
const declining = ref<string | null>(null);

function avatar(request: MessageRequest) {
  return resolveAvatarUrl(request.peer?.avatar_url, apiDomain);
}

function nameOf(request: MessageRequest) {
  return request.peer?.name ?? request.peer?.steam_id ?? "";
}

async function deny(request: MessageRequest) {
  declining.value = request.roomId;

  try {
    await decline(request.roomId);
  } catch {
    toast({
      title: t("layouts.chat_panel.requests.deny_failed"),
      variant: "destructive",
    });
  } finally {
    declining.value = null;
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex items-center justify-between gap-3 border-b border-border bg-card/30 px-3 py-3"
    >
      <div class="min-w-0">
        <div class="truncate text-xs font-semibold text-foreground">
          {{ $t("layouts.chat_panel.requests.title") }}
        </div>
        <div class="truncate text-[10px] text-muted-foreground">
          {{ $t("layouts.chat_panel.requests.hint") }}
        </div>
      </div>
      <button
        type="button"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="$t('layouts.chat_panel.requests.close')"
        @click="emit('close')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-2">
      <div
        v-for="request in requests"
        :key="request.roomId"
        class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          @click="emit('open', request)"
        >
          <Avatar shape="square" class="h-8 w-8 shrink-0 text-[0.6rem]">
            <AvatarImage
              v-if="avatar(request)"
              :src="avatar(request)!"
              :alt="nameOf(request)"
            />
            <AvatarFallback>
              {{ (nameOf(request) || "?").slice(0, 2).toUpperCase() }}
            </AvatarFallback>
          </Avatar>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-foreground">
              {{ nameOf(request) }}
            </span>
            <span class="block truncate text-[0.7rem] text-muted-foreground">
              {{ $t("layouts.chat_panel.requests.wants_to_message") }}
            </span>
          </span>
        </button>
        <button
          type="button"
          class="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-card/50 px-2 text-xs text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive disabled:opacity-50"
          :disabled="declining === request.roomId"
          @click="deny(request)"
        >
          <X class="h-3 w-3" />
          {{ $t("layouts.chat_panel.requests.deny") }}
        </button>
      </div>

      <HubEmptyState
        v-if="!requests.length"
        :title="$t('layouts.chat_panel.requests.empty_title')"
        :description="$t('layouts.chat_panel.requests.empty_description')"
      />
    </div>
  </div>
</template>
