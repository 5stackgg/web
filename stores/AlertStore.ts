import { defineStore } from "pinia";
import guid from "@/utilities/uuid";
import type { AlertStatuses } from "@/constants/AlertStatuses";

type Alert = {
  title: string;
  message?: string;
  severity: AlertStatuses;
  id?: null | number | string;
  duration: number | undefined | null;
};

export default defineStore("alert", {
  state: (): {
    alerts: Array<Alert>;
  } => {
    return {
      alerts: [],
    };
  },
  actions: {
    add(alert: Alert) {
      alert.id = guid();
      this.alerts.push(alert);
    },
    remove(alert: Alert) {
      this.alerts = this.alerts.filter((_alert) => {
        return alert.id !== _alert.id;
      });
    },
  },
});
