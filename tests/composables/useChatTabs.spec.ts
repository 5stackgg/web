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
