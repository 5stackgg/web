<script setup lang="ts">
import { computed } from "vue";
import { Grid } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { useHubState } from "@/composables/useHubState";
import { useChatTabs } from "~/composables/useChatTabs";
import { useNotificationBadge } from "~/composables/useNotificationBadge";
import { badgePopTransition, formatBadgeCount } from "~/utilities/badgeCount";

const { openLastOrDefaultHub } = useHubState();
const { tabs, unreadCounts, totalUnread } = useChatTabs();
const { unreadNotificationCount, unreadChatNotificationRooms } =
  useNotificationBadge();

const roomsCountedByTabs = computed(
  () =>
    new Set(
      tabs.value
        .filter((tab) => (unreadCounts.value[tab.id] ?? 0) > 0)
        .map((tab) => `${tab.type}:${tab.lobbyId}`),
    ),
);
const otherNotificationCount = computed(
  () =>
    unreadNotificationCount.value -
    unreadChatNotificationRooms.value.filter((room) =>
      roomsCountedByTabs.value.has(room),
    ).length,
);
const unreadCount = computed(
  () => totalUnread.value + otherNotificationCount.value,
);
const badgeLabel = computed(() => formatBadgeCount(unreadCount.value));
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="relative h-7 w-7 md:hidden"
    :aria-label="
      unreadCount > 0
        ? $t('ui.tooltips.toggle_right_sidebar_unread', { count: badgeLabel })
        : $t('ui.tooltips.toggle_right_sidebar')
    "
    @click="openLastOrDefaultHub()"
  >
    <Grid class="h-4 w-4" />
    <Transition v-bind="badgePopTransition">
      <span
        v-if="unreadCount > 0"
        aria-hidden="true"
        class="absolute -top-1 -right-1 flex origin-center"
      >
        <span
          v-if="otherNotificationCount > 0"
          class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-reduce:hidden"
        />
        <span
          class="relative inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.55rem] font-bold leading-none text-white shadow-sm ring-1 ring-background"
        >
          <AnimatedStat :value="badgeLabel" />
        </span>
      </span>
    </Transition>
  </Button>
</template>
