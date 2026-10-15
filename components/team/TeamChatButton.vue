<script setup lang="ts">
import { computed } from "vue";
import { AtSign, MessageSquare } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { cancelChatTabRestore } from "~/composables/useChatTabPersistence";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { setActiveHub } from "~/composables/useHubState";
import { chatTabBadge } from "~/utilities/chatBadges";
import { badgePopTransition, formatBadgeCount } from "~/utilities/badgeCount";
import { chatTeam, teamChatTab } from "~/utilities/teamChat";

const props = defineProps<{
  team: { id: string; name: string };
}>();

// Offered from the api's own rule, which `me.teams` is: the roster and the
// owner. Site staff off the roster see no button, as they get no room.
const member = computed(() =>
  chatTeam(useAuthStore().me?.teams, props.team.id),
);

const tab = computed(() => teamChatTab(props.team));

const badge = computed(() => {
  const { unreadCounts, mentionCounts } = useChatTabs();

  return chatTabBadge(
    tab.value,
    unreadCounts.value[tab.value.id] ?? 0,
    mentionCounts.value[tab.value.id] ?? 0,
  );
});

function openRoom() {
  cancelChatTabRestore();
  useChatTabs().openTab({ ...tab.value, activate: true });
  setActiveHub("chat");
  useRightSidebar().setRightSidebarOpen(true);
}
</script>

<template>
  <Button
    v-if="member"
    variant="outline"
    size="sm"
    class="h-8 gap-1.5"
    @click="openRoom"
  >
    <MessageSquare class="size-3.5" />
    {{ $t("team.pulse.hero.team_chat") }}
    <Transition v-bind="badgePopTransition">
      <span
        v-if="badge"
        data-chat-room-badge
        :data-tone="badge.tone"
        class="inline-flex h-4 min-w-4 origin-center items-center justify-center gap-px rounded-full px-1 text-[0.6rem] font-bold leading-none tabular-nums transition-colors duration-200 motion-reduce:transition-none"
        :class="
          badge.tone === 'red'
            ? 'bg-red-500 text-white'
            : 'bg-zinc-50 text-zinc-950'
        "
      >
        <AtSign v-if="badge.mention" class="size-[0.55rem] shrink-0" />
        <AnimatedStat :value="formatBadgeCount(badge.count)" />
      </span>
    </Transition>
  </Button>
</template>
