import { computed } from "vue";

export function useNotificationBadge() {
  const hasNotifications = computed(
    () => useNotificationStore().hasNotifications,
  );
  return { hasNotifications };
}
