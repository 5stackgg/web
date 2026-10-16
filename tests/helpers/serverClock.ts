import { useServerClockStore } from "~/stores/ServerClockStore";

export function setApiClockBehindBy(ms: number) {
  const clock = useServerClockStore();
  const now = Date.now();
  clock.reconnected();
  clock.observe(now - ms, now, now);
}
