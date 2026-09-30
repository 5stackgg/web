import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";

const state = vi.hoisted(() => ({ data: null as any }));

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<object>()),
    useQuery: () => ({ result: ref(state.data), refetch: vi.fn(async () => {}) }),
    useApolloClient: () => ({
      client: { query: vi.fn(async () => ({ data: { events: [] } })) },
    }),
  };
});

import ServerAccess from "~/components/servers/ServerAccess.vue";

const hour = 60 * 60 * 1000;

function server(extra: Record<string, unknown> = {}) {
  return {
    servers_by_pk: {
      id: "server-1",
      access_restricted: true,
      access_min_role: null,
      player_management_seen_at: new Date().toISOString(),
      access_players: [
        {
          steam_id: "76561198000000001",
          player: { steam_id: "76561198000000001", name: "Dana", avatar_url: null, country: null },
        },
      ],
      access_events: [
        {
          event: {
            id: "event-1",
            name: "Prophunt Night",
            starts_at: new Date(Date.now() - hour).toISOString(),
            ends_at: new Date(Date.now() + hour).toISOString(),
          },
        },
      ],
      ...extra,
    },
  };
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountCard() {
  const wrapper = await mountSuspended(ServerAccess, {
    props: { serverId: "server-1" },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("ServerAccess", () => {
  it("lists who a restricted server lets in", async () => {
    state.data = server();

    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("Dana");
    expect(wrapper.text()).toContain("Prophunt Night");
    expect(wrapper.text()).toContain("Moderators and above can always join");
    expect(wrapper.text()).not.toContain("hasn't checked in");
  });

  it("says anyone can join an open server", async () => {
    state.data = server({ access_restricted: false });

    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("Anyone can find and join this server");
    expect(wrapper.text()).not.toContain("Prophunt Night");
  });

  // A restriction nobody enforces would only hide the server in the panel.
  it("warns when the Player Management plugin has not checked in", async () => {
    for (const seenAt of [null, new Date(Date.now() - hour).toISOString()]) {
      state.data = server({ player_management_seen_at: seenAt });

      const wrapper = await mountCard();

      expect(wrapper.text()).toContain("hasn't checked in");

      unmount?.();
      unmount = undefined;
    }
  });
});
