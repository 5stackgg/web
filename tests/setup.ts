import { afterAll } from "vitest";

// vaul-vue's Drawer and plugins/preloader.client.ts leave real timers (up to
// 300ms) that read `document`, which the environment deletes on teardown.
afterAll(async () => {
  if (typeof document === "undefined") {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
});
