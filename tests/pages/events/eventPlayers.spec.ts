import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import EventPage from "~/pages/events/[eventId]/index.vue";
import EventOverview from "~/components/events/EventOverview.vue";
import { selectFields } from "../../helpers/fakeHasura";

const DAY = 86_400_000;
const EVENT_ID = "6f1c3c4e-2f0a-4c55-9a8e-1b2c3d4e5f60";

const event = {
  id: EVENT_ID,
  name: "Vulkan LAN",
  description: null,
  starts_at: new Date(Date.now() + DAY).toISOString(),
  ends_at: new Date(Date.now() + 2 * DAY).toISOString(),
  visibility: "Public",
  media_access: "Organizers",
  hide_creator_organizer: false,
  banner_media_id: null,
  banner: null,
  is_organizer: false,
  can_upload_media: false,
  organizer_steam_id: "76561198000000001",
  organizer: {
    steam_id: "76561198000000001",
    name: "alex",
    avatar_url: null,
  },
  organizers: [],
  tournaments: [],
  teams: [],
  media: [],
  players: [
    {
      steam_id: "76561198000000002",
      player: {
        steam_id: "76561198000000002",
        name: "Notschi",
        avatar_url: null,
        country: "DE",
      },
    },
  ],
  tournaments_aggregate: { aggregate: { count: 0 } },
  teams_aggregate: { aggregate: { count: 0 } },
  players_aggregate: { aggregate: { count: 1 } },
  media_aggregate: { aggregate: { count: 0 } },
};

async function mountPage() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      const operation = options.query.definitions[0];
      if (operation.selectionSet.selections[0].name.value === "events_by_pk") {
        const data = selectFields(
          { events_by_pk: event },
          operation.selectionSet,
        );
        Promise.resolve().then(() => observer.next({ data }));
      }
      return { unsubscribe() {}, closed: false };
    },
  }));
  vi.spyOn(client, "query").mockImplementation(async () => ({ data: {} }));

  const wrapper = await mountSuspended(EventPage, {
    route: `/events/${EVENT_ID}`,
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

describe("event page players", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows each attending player's country flag", async () => {
    const wrapper = await mountPage();

    const overview = wrapper.findComponent(EventOverview);
    expect(overview.text()).toContain("Notschi");
    expect(overview.text()).toContain("🇩🇪");
  });
});
