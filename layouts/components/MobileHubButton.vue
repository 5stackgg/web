<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Grid } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { useHubState } from "@/composables/useHubState";
import { useChatTabs } from "~/composables/useChatTabs";
import { useInvites } from "~/composables/useInvites";
import { useNotificationBadge } from "~/composables/useNotificationBadge";
import { badgePopTransition, formatBadgeCount } from "~/utilities/badgeCount";
import { chatBadgeFor } from "~/utilities/chatBadges";

const { openLastOrDefaultHub } = useHubState();
const { tabs, unreadCounts, mentionCounts } = useChatTabs();
const { unreadNotificationCount } = useNotificationBadge();
const { pendingFriends } = useInvites();

const chatBadge = computed(() =>
  chatBadgeFor(tabs.value, unreadCounts.value, mentionCounts.value),
);

// Red for what needs you, the dock's rule: chatter shows in white only while
// nothing else is waiting.
const urgentCount = computed(
  () =>
    unreadNotificationCount.value +
    (pendingFriends.value?.length ?? 0) +
    (chatBadge.value?.tone === "red" ? chatBadge.value.count : 0),
);
const unreadCount = computed(() =>
  urgentCount.value > 0 ? urgentCount.value : (chatBadge.value?.count ?? 0),
);
const badgeLabel = computed(() => formatBadgeCount(unreadCount.value));

// A new notification rings the badge once; a standing count sits still.
const ringing = ref(0);
watch(unreadNotificationCount, (count, previous) => {
  if (count > (previous ?? 0)) ringing.value++;
});
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
          v-if="ringing"
          :key="ringing"
          class="absolute inset-0 rounded-full bg-red-400 opacity-60 motion-safe:animate-[ping_1s_cubic-bezier(0,0,0.2,1)_forwards] motion-reduce:hidden"
          @animationend="ringing = 0"
        />
        <span
          class="relative inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[0.55rem] font-bold leading-none shadow-sm ring-1 ring-background transition-colors duration-200 motion-reduce:transition-none"
          :class="
            urgentCount > 0
              ? 'bg-red-500 text-white'
              : 'bg-zinc-50 text-zinc-950'
          "
        >
          <AnimatedStat :value="badgeLabel" />
        </span>
      </span>
    </Transition>
  </Button>
</template>
