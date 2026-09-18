import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatParticipants from "~/components/chat/ChatParticipants.vue";

const participants = [
  {
    steam_id: "76561198000000001",
    name: "Keith",
    avatar_url: "https://avatars.example/keith.jpg",
  },
  { steam_id: "76561198000000002", name: "Dana", avatar_url: null },
];

describe("ChatParticipants", () => {
  it("links every participant to their profile", async () => {
    const wrapper = await mountSuspended(ChatParticipants, {
      props: { participants },
    });

    const links = wrapper.findAllComponents({ name: "NuxtLink" });

    expect(links).toHaveLength(2);
    expect(links[0].props("to")).toEqual({
      name: "players-id",
      params: { id: "76561198000000001" },
    });
    expect(wrapper.text()).toContain("Keith");
    expect(wrapper.text()).toContain("Dana");
  });

  it("does not link a participant with no steam id", async () => {
    // the room's member list is built from chat sessions, so an entry can
    // arrive before its player is resolved
    const wrapper = await mountSuspended(ChatParticipants, {
      props: { participants: [{ name: "Unknown" }] },
    });

    const [link] = wrapper.findAllComponents({ name: "NuxtLink" });

    expect(link.props("to")).toBeNull();
    expect(wrapper.text()).toContain("Unknown");
  });

  it("shows an avatar only when there is one", async () => {
    const wrapper = await mountSuspended(ChatParticipants, {
      props: { participants },
    });

    expect(wrapper.findAll("img")).toHaveLength(1);
  });

  it("lays out as a row of pills when asked", async () => {
    const wrapper = await mountSuspended(ChatParticipants, {
      props: { participants, variant: "pills" },
    });

    expect(wrapper.get("div").classes()).toContain("overflow-x-auto");
  });
});
