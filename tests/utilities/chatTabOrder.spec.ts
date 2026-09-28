import { describe, expect, it } from "vitest";
import type { ChatTab } from "~/composables/useChatTabs";
import { orderChatTabs } from "~/utilities/chatTabOrder";

const tab = (
  id: string,
  type: ChatTab["type"],
  label: string,
  position?: number,
): ChatTab => ({
  id,
  label,
  instance: type,
  type,
  lobbyId: id,
  pinned: false,
  position,
});

const ids = (tabs: ChatTab[]) => tabs.map(({ id }) => id);

describe("orderChatTabs", () => {
  it("puts the lobby, then matches, then channels, then conversations", () => {
    const tabs = [
      tab("direct:a", "direct", "Dana", 0),
      tab("organizers", "organizers", "Organizers"),
      tab("match:1", "match", "A vs B"),
      tab("matchmaking:1", "matchmaking", "Lobby"),
    ];

    expect(ids(orderChatTabs(tabs))).toEqual([
      "matchmaking:1",
      "match:1",
      "organizers",
      "direct:a",
    ]);
  });

  it("sorts channels by label", () => {
    const tabs = [
      tab("tournament:2", "tournament", "Winter Cup"),
      tab("organizers", "organizers", "Organizers"),
      tab("tournament:1", "tournament", "Autumn Cup"),
    ];

    expect(ids(orderChatTabs(tabs))).toEqual([
      "tournament:1",
      "organizers",
      "tournament:2",
    ]);
  });

  it("sorts conversations by their rail position, not their name", () => {
    const tabs = [
      tab("direct:a", "direct", "Alex", 2),
      tab("direct:z", "direct", "Zoe", 0),
      tab("direct:m", "direct", "Mia", 1),
    ];

    expect(ids(orderChatTabs(tabs))).toEqual([
      "direct:z",
      "direct:m",
      "direct:a",
    ]);
  });

  it("puts a conversation with no position at the top of the rail", () => {
    const tabs = [
      tab("direct:a", "direct", "Alex", 1),
      tab("direct:b", "direct", "Blake"),
    ];

    expect(ids(orderChatTabs(tabs))).toEqual(["direct:b", "direct:a"]);
  });

  it("leaves the list it was given alone", () => {
    const tabs = [
      tab("direct:a", "direct", "Dana", 0),
      tab("matchmaking:1", "matchmaking", "Lobby"),
    ];

    orderChatTabs(tabs);

    expect(ids(tabs)).toEqual(["direct:a", "matchmaking:1"]);
  });
});
