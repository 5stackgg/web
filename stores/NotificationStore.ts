import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";

export const useNotificationStore = defineStore("notifaicationStore", () => {
  const notificationsGranted = ref(false);
  const notificationsEnabled = ref(false);

  const setupNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      notificationsGranted.value = permission === "granted";
      notificationsEnabled.value = notificationsGranted.value;
    }
  };

  setupNotifications();

  return {
    notificationsGranted,
    notificationsEnabled,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useNotificationStore, import.meta.hot),
  );
}
