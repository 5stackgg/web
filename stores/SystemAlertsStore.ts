import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { order_by } from "@/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { systemAlertFields } from "~/graphql/systemAlertsGraphql";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";

export type SystemAlert = {
  id: string;
  type: "info" | "warning" | "critical";
  title: string | null;
  message: string;
  is_active: boolean;
  dismissible: boolean;
  expires_at: string | null;
  created_at: string;
};

const DISMISSED_KEY = "5stack:dismissed-system-alerts";

export const useSystemAlertsStore = defineStore("systemAlerts", () => {
  const alerts = ref<SystemAlert[]>([]);

  // Re-evaluated periodically so alerts with an `expires_at` drop off without
  // needing a server event.
  const now = ref(Date.now());

  const loadDismissed = (): string[] => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return [];
  };

  const dismissedIds = ref<string[]>(loadDismissed());

  const dismiss = (id: string) => {
    if (dismissedIds.value.includes(id)) {
      return;
    }
    dismissedIds.value = [...dismissedIds.value, id];
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds.value));
    } catch {}
  };

  const visibleAlerts = computed(() =>
    alerts.value.filter((alert) => {
      if (
        alert.expires_at &&
        new Date(alert.expires_at).getTime() <= now.value
      ) {
        return false;
      }
      if (alert.dismissible && dismissedIds.value.includes(alert.id)) {
        return false;
      }
      return true;
    }),
  );

  const subscribeToAlerts = async () => {
    const { subscribe } = useSubscriptionManager();
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        system_alerts: [
          {
            where: { is_active: { _eq: true } },
            order_by: [{ created_at: order_by.asc }],
          },
          systemAlertFields,
        ],
      }),
    });

    subscribe(
      "system-alerts:active",
      subscription.subscribe({
        next: ({ data }) => {
          alerts.value = data.system_alerts;
        },
      }),
    );
  };

  subscribeToAlerts();

  if (import.meta.client) {
    setInterval(() => {
      now.value = Date.now();
    }, 30 * 1000);
  }

  return {
    alerts,
    visibleAlerts,
    dismiss,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useSystemAlertsStore, import.meta.hot),
  );
}
