import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlaySeatRow from "~/components/play/PlaySeatRow.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { e_match_types_enum } from "~/generated/zeus";

const me = {
  steam_id: "76561198000000001",
  name: "nightowl",
  role: "user",
  elo: { competitive: 5240, wingman: 5115, duel: 4980, rush: 5060 },
};

function player(steamId: string, name: string) {
  return {
    steam_id: steamId,
    name,
    elo: { competitive: 5410, wingman: 5290, duel: 5020, rush: 5180 },
  };
}

// You lead; `joined` friends accepted, `invited` friends haven't answered.
function party(joined: number, invited = 0) {
  const players = [{ status: "Accepted", captain: true, player: me }];
  for (let i = 0; i < joined; i++) {
    players.push({
      status: "Accepted",
      captain: false,
      player: player(`7656119800000010${i}`, `friend${i}`) as any,
    });
  }
  for (let i = 0; i < invited; i++) {
    players.push({
      status: "Invited",
      captain: false,
      player: player(`7656119800000020${i}`, `invitee${i}`) as any,
    });
  }
  useMatchmakingStore().lobbies = [
    { id: "lobby-1", access: "Invite", players },
  ] as any;
}

function filledSeats(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findAll('a[href^="/players/"]');
}

function inviteSeats(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findAll('button[aria-label="Invite Player to Lobby"]');
}

afterEach(() => {
  useAuthStore().me = undefined as any;
  useMatchmakingStore().lobbies = [] as any;
});

describe("PlaySeatRow", () => {
  it("gives a solo player their side of the mode, with invite seats", async () => {
    useAuthStore().me = me as any;

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Competitive },
    });

    expect(wrapper.text()).toContain("Your side");
    expect(wrapper.text()).toContain("1 of 5");
    expect(filledSeats(wrapper)).toHaveLength(1);
    expect(inviteSeats(wrapper)).toHaveLength(4);
    expect(wrapper.text()).toContain("5,240");
    expect(wrapper.text()).toContain("Playing each other? Open all 10 seats");
  });

  it("draws fewer seats for a smaller mode and says where the rest come from", async () => {
    useAuthStore().me = me as any;

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Wingman },
    });

    expect(wrapper.text()).toContain("1 of 2");
    expect(inviteSeats(wrapper)).toHaveLength(1);
    expect(wrapper.text()).toContain("2 opponents from the queue");
  });

  it("keeps a pending invite that doesn't fit behind a pill", async () => {
    useAuthStore().me = me as any;
    party(1, 1);

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Wingman },
    });

    expect(filledSeats(wrapper)).toHaveLength(2);
    expect(wrapper.text()).toContain("+1 invited");
    expect(wrapper.text()).not.toContain("invitee0");
  });

  it("opens the whole match when the party outgrows one side", async () => {
    useAuthStore().me = me as any;
    party(3);

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Rush },
    });

    expect(wrapper.text()).toContain("All 6 seats");
    expect(filledSeats(wrapper)).toHaveLength(4);
    expect(inviteSeats(wrapper)).toHaveLength(2);
    expect(wrapper.text()).toContain(
      "A party of 4 is too big for one side. Fill all 6 seats to play each other, or remove 1.",
    );
  });

  it("says you play each other once every seat is filled", async () => {
    useAuthStore().me = me as any;
    party(3);

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Wingman },
    });

    expect(wrapper.text()).toContain("All 4 seats");
    expect(inviteSeats(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain("Teams are picked at random");
  });

  it("keeps the rating line for a player with no rating in the mode", async () => {
    useAuthStore().me = { ...me, elo: { competitive: 5240 } } as any;

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Rush },
    });

    expect(wrapper.text()).toContain("Unranked");
    expect(wrapper.text()).not.toContain("5,240");
  });

  it("lets the leader open both sides on purpose", async () => {
    useAuthStore().me = me as any;

    const wrapper = await mountSuspended(PlaySeatRow, {
      props: { type: e_match_types_enum.Duel },
    });

    expect(wrapper.text()).toContain("Just you");
    const open = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Open both seats"));
    await open!.trigger("click");

    expect(wrapper.text()).toContain("Both seats");
    expect(inviteSeats(wrapper)).toHaveLength(1);
    expect(wrapper.text()).toContain("Just your side");
  });
});
