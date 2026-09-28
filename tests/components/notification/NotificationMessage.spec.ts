import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationMessage from "~/components/notification/NotificationMessage.vue";

describe("NotificationMessage", () => {
  it("keeps the lists CS2 build notices are written with", async () => {
    const wrapper = await mountSuspended(NotificationMessage, {
      props: {
        html: "broke <b>2</b>:<ul><li><code>ConnectClient</code> — fivestack</li><li><code>Other</code></li></ul>",
      },
    });

    expect(wrapper.findAll("ul li")).toHaveLength(2);
    expect(wrapper.find("li code").text()).toBe("ConnectClient");
  });
});
