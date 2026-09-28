import { afterEach, describe, expect, it } from "vitest";
import { closeNotifications } from "~/composables/usePushNotifications";
import { fakeServiceWorker } from "../helpers/fakeServiceWorker";

let worker: ReturnType<typeof fakeServiceWorker> | undefined;

afterEach(() => {
  worker?.restore();
  worker = undefined;
});

describe("closeNotifications", () => {
  it("closes every notification with the tag and nothing else", async () => {
    worker = fakeServiceWorker({
      tags: ["MatchFound:c-1", "MatchFound:c-1", "chat:lobby:abc"],
    });

    await closeNotifications("MatchFound:c-1");

    expect(worker.registration.getNotifications).toHaveBeenCalledWith({
      tag: "MatchFound:c-1",
    });
    expect(worker.closed()).toEqual(["MatchFound:c-1", "MatchFound:c-1"]);
  });

  it("does nothing where there is no service worker", async () => {
    expect("serviceWorker" in navigator).toBe(false);

    await expect(closeNotifications("MatchFound:c-1")).resolves.toBeUndefined();
  });

  it("does nothing when no worker is registered", async () => {
    worker = fakeServiceWorker({
      tags: ["MatchFound:c-1"],
      registered: false,
    });

    await closeNotifications("MatchFound:c-1");

    expect(worker.registration.getNotifications).not.toHaveBeenCalled();
    expect(worker.closed()).toEqual([]);
  });

  it("swallows a platform that refuses to list notifications", async () => {
    worker = fakeServiceWorker({ tags: ["MatchFound:c-1"] });
    worker.registration.getNotifications.mockRejectedValueOnce(
      new Error("not allowed"),
    );

    await expect(closeNotifications("MatchFound:c-1")).resolves.toBeUndefined();
  });
});
