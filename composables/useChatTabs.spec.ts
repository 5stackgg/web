import { useChatTabs } from "./useChatTabs";

function makeTab(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    label: `Tab ${id}`,
    instance: "inst-1",
    type: "match" as const,
    lobbyId: "lobby-1",
    ...overrides,
  };
}

describe("useChatTabs", () => {
  const { openTab, closeTab, setActiveTab, setPinned, incrementUnread, resetUnread, setUnread, clearAll, tabs, unreadCounts, activeTabId } = useChatTabs();

  afterEach(() => {
    clearAll();
  });

  it("opens a new tab and sets it active", () => {
    openTab(makeTab("t1"));
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].id).toBe("t1");
    expect(activeTabId.value).toBe("t1");
  });

  it("does not duplicate an existing tab", () => {
    openTab(makeTab("t1"));
    openTab(makeTab("t1"));
    expect(tabs.value).toHaveLength(1);
  });

  it("closes a tab and falls back to next tab", () => {
    openTab(makeTab("t1"));
    openTab(makeTab("t2"));
    setActiveTab("t1");
    closeTab("t1");
    expect(tabs.value).toHaveLength(1);
    expect(activeTabId.value).toBe("t2");
  });

  it("sets activeTabId to null when last tab is closed", () => {
    openTab(makeTab("t1"));
    closeTab("t1");
    expect(activeTabId.value).toBeNull();
  });

  it("sets pinned state", () => {
    openTab(makeTab("t1"));
    expect(tabs.value[0].pinned).toBe(false);
    setPinned("t1", true);
    expect(tabs.value[0].pinned).toBe(true);
  });

  it("increments unread count", () => {
    openTab(makeTab("t1"));
    incrementUnread("t1");
    incrementUnread("t1");
    expect(unreadCounts.value["t1"]).toBe(2);
  });

  it("resets unread count", () => {
    openTab(makeTab("t1"));
    incrementUnread("t1");
    resetUnread("t1");
    expect(unreadCounts.value["t1"]).toBe(0);
  });

  it("sets unread to arbitrary value", () => {
    openTab(makeTab("t1"));
    setUnread("t1", 10);
    expect(unreadCounts.value["t1"]).toBe(10);
  });

  it("clearAll removes all tabs and resets state", () => {
    openTab(makeTab("t1"));
    openTab(makeTab("t2"));
    incrementUnread("t1");
    clearAll();
    expect(tabs.value).toHaveLength(0);
    expect(activeTabId.value).toBeNull();
    expect(Object.keys(unreadCounts.value)).toHaveLength(0);
  });

  it("closeTab cleans up unread counts", () => {
    openTab(makeTab("t1"));
    incrementUnread("t1");
    closeTab("t1");
    expect(unreadCounts.value["t1"]).toBeUndefined();
  });
});
