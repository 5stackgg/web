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

  it("shows a news comment reply's player text as text, with only its own link", async () => {
    const wrapper = await mountSuspended(NotificationMessage, {
      props: {
        html:
          "<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b> replied on " +
          '<a href="/news/autumn-cup#comment-c1">Autumn Cup</a>: ' +
          "“&lt;script&gt;alert(1)&lt;/script&gt;&lt;a href=&quot;javascript:alert(3)&quot;&gt;x&lt;/a&gt;”",
      },
    });

    expect(wrapper.findAll("script, img, [onerror]")).toHaveLength(0);
    expect(wrapper.findAll("a").map((a) => a.attributes("href"))).toEqual([
      "/news/autumn-cup#comment-c1",
    ]);
    expect(wrapper.text()).toContain('<img src=x onerror="alert(1)">');
    expect(wrapper.text()).toContain(
      '“<script>alert(1)</script><a href="javascript:alert(3)">x</a>”',
    );
  });
});
