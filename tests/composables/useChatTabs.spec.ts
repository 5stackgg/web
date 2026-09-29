import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";

function open(
  id: string,
  type: ChatTab["type"],
  label: string,
  position?: number,
) {
  useChatTabs().openTab({
    id,
    label,
    instance: type,
    type,
    lobbyId: id,
    position,
    activate: false,
  });
}

beforeEach(() => {
  useChatTabs().clearAll();
});

afterEach(() => {
  useChatTabs().clearAll();
});

describe("useChatTabs closeTab", () => {
  it("falls back to the room below it on the rail", () => {
    open("direct:a", "direct", "Dana", 0);
    open("organizers", "organizers", "Organizers");
    open("matchmaking:1", "matchmaking", "Lobby");
    open("match:1", "match", "A vs B");

    const { closeTab, setActiveTab, activeTabId } = useChatTabs();
    setActiveTab("match:1");
    closeTab("match:1");

    expect(activeTabId.value).toBe("organizers");
  });

  it("falls back to the room above it when it was the last on the rail", () => {
    open("direct:b", "direct", "Blake", 1);
    open("matchmaking:1", "matchmaking", "Lobby");
    open("direct:a", "direct", "Alex", 0);

    const { closeTab, setActiveTab, activeTabId } = useChatTabs();
    setActiveTab("direct:b");
    closeTab("direct:b");

    expect(activeTabId.value).toBe("direct:a");
  });

  it("leaves nothing selected once the last room is closed", () => {
    open("organizers", "organizers", "Organizers");

    const { closeTab, setActiveTab, activeTabId } = useChatTabs();
    setActiveTab("organizers");
    closeTab("organizers");

    expect(activeTabId.value).toBeNull();
  });

  it("keeps the selected room when another one closes", () => {
    open("organizers", "organizers", "Organizers");
    open("matchmaking:1", "matchmaking", "Lobby");

    const { closeTab, setActiveTab, activeTabId } = useChatTabs();
    setActiveTab("organizers");
    closeTab("matchmaking:1");

    expect(activeTabId.value).toBe("organizers");
  });
});

describe("useChatTabs incrementUnread", () => {
  const TAB = "organizers";

  const count = () => useChatTabs().unreadCounts.value[TAB] ?? 0;

  it("counts a message id once", () => {
    const { incrementUnread } = useChatTabs();

    expect(incrementUnread(TAB, "m1")).toBe(true);
    expect(incrementUnread(TAB, "m1")).toBe(false);
    expect(incrementUnread(TAB, "m2")).toBe(true);

    expect(count()).toBe(2);
  });

  it("counts a message with no id every time", () => {
    const { incrementUnread } = useChatTabs();

    incrementUnread(TAB);
    incrementUnread(TAB);

    expect(count()).toBe(2);
  });

  it("keeps what it counted through a non-zero recount", () => {
    const { incrementUnread, setUnread } = useChatTabs();

    incrementUnread(TAB, "m1");
    setUnread(TAB, 4);

    expect(incrementUnread(TAB, "m1")).toBe(false);
    expect(incrementUnread(TAB, "m2")).toBe(true);
    expect(count()).toBe(5);
  });

  it("forgets what it counted once the badge is cleared", () => {
    const { incrementUnread, resetUnread, setUnread } = useChatTabs();

    incrementUnread(TAB, "m1");
    resetUnread(TAB);
    expect(incrementUnread(TAB, "m1")).toBe(true);

    setUnread(TAB, 0);
    expect(incrementUnread(TAB, "m1")).toBe(true);

    expect(count()).toBe(1);
  });

  it("forgets what it counted once the tab is closed", () => {
    open(TAB, "organizers", "Organizers");
    const { incrementUnread, closeTab } = useChatTabs();

    incrementUnread(TAB, "m1");
    closeTab(TAB);
    open(TAB, "organizers", "Organizers");

    expect(incrementUnread(TAB, "m1")).toBe(true);
  });

  it("remembers only the latest 200 ids", () => {
    const { incrementUnread } = useChatTabs();

    for (let index = 0; index <= 200; index++) {
      incrementUnread(TAB, `m${index}`);
    }

    expect(incrementUnread(TAB, "m1")).toBe(false);
    expect(incrementUnread(TAB, "m0")).toBe(true);
  });
});
