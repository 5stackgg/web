import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchLiveStreams from "~/components/match/MatchLiveStreams.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const MESSAGE = "Enter a link that starts with http:// or https://";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

async function mountStreams(links: string[]) {
  wrapper = await mountSuspended(MatchLiveStreams, {
    props: {
      match: {
        id: "m-1",
        is_organizer: true,
        streams: links.map((link, index) => ({
          id: `s-${index}`,
          link,
          title: `Feed ${index}`,
          priority: index,
          is_game_streamer: false,
        })),
      },
    },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { StreamEmbed: true, LiveStreamPlayer: true },
    },
  });
  await flushPromises();
  return wrapper;
}

const openButtons = () =>
  wrapper!
    .findAll("button")
    .filter((button) => button.find(".lucide-external-link").exists());

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: e_player_roles_enum.user,
  } as any;
});

afterEach(() => {
  vi.restoreAllMocks();
  wrapper?.unmount();
  wrapper = undefined;
});

describe("MatchLiveStreams links", () => {
  it("opens an http(s) stream in a new tab without an opener", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await mountStreams(["https://twitch.tv/caster"]);

    await openButtons()[0].trigger("click");

    expect(open).toHaveBeenCalledWith(
      "https://twitch.tv/caster",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("never opens a javascript: link", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await mountStreams(["javascript:alert(document.cookie)"]);

    expect(openButtons()[0].attributes("disabled")).toBeDefined();
    (wrapper!.vm as any).openStream("javascript:alert(document.cookie)");

    expect(open).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(document.cookie)", "data:text/html,<p>x</p>"])(
    "won't save %s as a stream link",
    async (link) => {
      await mountStreams([]);
      const form = (wrapper!.vm as any).form;

      form.setValues({ link, title: "Feed" });
      const { valid, errors } = await form.validate();

      expect(valid).toBe(false);
      expect(errors.link).toBe(MESSAGE);
    },
  );

  it("saves an https stream link", async () => {
    await mountStreams([]);
    const form = (wrapper!.vm as any).form;

    form.setValues({ link: "https://stream.example.com/live", title: "Feed" });
    const { valid } = await form.validate();

    expect(valid).toBe(true);
  });
});
