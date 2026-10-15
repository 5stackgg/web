import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentAwardsManage from "~/components/tournament/TournamentAwardsManage.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import AwardPickerDialog from "~/components/award/AwardPickerDialog.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query, mutate: vi.fn() } }),
}));

const { computed } = TournamentAwardsManage as any;

const award = (id: string, systemKey: string | null = null) => ({
  id,
  name: id,
  description: null,
  tier: "special",
  allow_multiple: false,
  image_url: null,
  system_key: systemKey,
  tournament_id: null,
  event_id: null,
  season_id: null,
  league_season_id: null,
});

const catalog = [
  award("system-mvp", "tournament_mvp"),
  award("system-gold", "tournament_gold"),
  award("cup-mvp"),
  award("clutch-king"),
];

function manage(awardConfigs: any[]) {
  const self: any = {
    awards: catalog,
    tournament: { award_configs: awardConfigs },
  };
  self.mvpAwardIds = computed.mvpAwardIds.call(self);
  return self;
}

describe("hand grants inside a tournament", () => {
  it("keeps the tournament's MVP award, built-in or configured, out of them", () => {
    const self = manage([{ placement: 0, award_id: "cup-mvp" }]);

    expect(self.mvpAwardIds).toEqual(["system-mvp", "cup-mvp"]);
    expect(
      computed.grantableAwards.call(self).map((entry: any) => entry.id),
    ).toEqual(["clutch-king"]);
  });

  it("leaves a configured placement other than the MVP alone", () => {
    const self = manage([{ placement: 1, award_id: "cup-mvp" }]);

    expect(self.mvpAwardIds).toEqual(["system-mvp"]);
  });

  it("drops the excluded awards from the composer's picker", async () => {
    query.mockResolvedValue({ data: { awards: catalog } });
    const wrapper = await mountSuspended(AwardComposer, {
      props: {
        open: true,
        grant: true,
        tournamentId: "tournament-1",
        excludeAwardIds: ["system-mvp", "cup-mvp"],
      },
    });
    await flushPromises();

    const offered = wrapper
      .findComponent(AwardPickerDialog)
      .props("awards")
      .map((entry: any) => entry.id);
    expect(offered).toEqual(["system-gold", "clutch-king"]);
    wrapper.unmount();
  });
});
