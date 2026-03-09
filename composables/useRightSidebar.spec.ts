import { useRightSidebar } from "./useRightSidebar";

describe("useRightSidebar", () => {
  beforeEach(() => {
    const { setRightSidebarOpen, isPinned, togglePin } = useRightSidebar();
    setRightSidebarOpen(false);
    // Reset pin state if pinned
    if (isPinned.value) {
      togglePin();
    }
    localStorage.removeItem("right-hub-pinned");
  });

  it("setRightSidebarOpen(true) opens sidebar", () => {
    const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
    setRightSidebarOpen(true);
    expect(rightSidebarOpen.value).toBe(true);
  });

  it("toggleRightSidebar toggles open/closed", () => {
    const { toggleRightSidebar, rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();
    setRightSidebarOpen(false);
    toggleRightSidebar();
    expect(rightSidebarOpen.value).toBe(true);
    toggleRightSidebar();
    expect(rightSidebarOpen.value).toBe(false);
  });

  it("startHoverPeek opens sidebar when closed", () => {
    const { startHoverPeek, rightSidebarOpen } = useRightSidebar();
    expect(rightSidebarOpen.value).toBe(false);
    startHoverPeek();
    expect(rightSidebarOpen.value).toBe(true);
  });

  it("startHoverPeek does nothing when already open", () => {
    const { startHoverPeek, setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
    setRightSidebarOpen(true);
    startHoverPeek();
    expect(rightSidebarOpen.value).toBe(true);
  });

  it("endHoverPeek closes sidebar when not pinned", () => {
    const { startHoverPeek, endHoverPeek, rightSidebarOpen } = useRightSidebar();
    startHoverPeek();
    endHoverPeek();
    expect(rightSidebarOpen.value).toBe(false);
  });

  it("endHoverPeek keeps sidebar open when pinned", () => {
    const { startHoverPeek, endHoverPeek, togglePin, rightSidebarOpen } = useRightSidebar();
    startHoverPeek();
    togglePin();
    endHoverPeek();
    expect(rightSidebarOpen.value).toBe(true);
  });

  it("togglePin persists pin state to localStorage", () => {
    const { togglePin } = useRightSidebar();
    togglePin();
    expect(localStorage.getItem("right-hub-pinned")).toBe("1");
  });

  it("togglePin removes localStorage key when unpinning", () => {
    const { togglePin } = useRightSidebar();
    togglePin(); // pin
    togglePin(); // unpin
    expect(localStorage.getItem("right-hub-pinned")).toBeNull();
  });
});
