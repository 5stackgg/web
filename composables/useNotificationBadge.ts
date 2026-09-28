import { computed } from "vue";

export function useNotificationBadge() {
  const hasNotifications = computed(
    () => useNotificationStore().hasNotifications,
  );
  const hasPersonalNotifications = computed(
    () => useNotificationStore().hasPersonalNotifications,
  );
  const hasAdminNotifications = computed(
    () => useNotificationStore().hasAdminNotifications,
  );
  const unreadNotificationCount = computed(
    () => useNotificationStore().unreadNotificationCount,
  );
  const unreadChatNotificationRooms = computed(
    () => useNotificationStore().unreadChatNotificationRooms,
  );
  return {
    hasNotifications,
    hasPersonalNotifications,
    hasAdminNotifications,
    unreadNotificationCount,
    unreadChatNotificationRooms,
  };
}
