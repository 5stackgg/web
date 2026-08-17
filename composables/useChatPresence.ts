import { computed, ref, watch } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import socket from "~/web-sockets/Socket";
import { useChatTabs } from "~/composables/useChatTabs";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { currentHub } from "~/composables/useHubState";
import { chatThreadKey } from "~/utilities/chatThread";

// A page that shows a conversation outside the hub -- the pop-out window, the
// inline chat on a match page -- claims focus here.
const pageFocus = ref<string | null>(null);

export function setPageChatFocus(thread: string | null) {
  pageFocus.value = thread;
}

// Tells the server what this tab is showing, so a push can be skipped for a
// conversation the recipient is already reading.
//
// Mounted once from the default layout. The pop-out window is a separate
// document with its own socket, so it runs its own copy and reports its own
// focus through setPageChatFocus.
export function useChatPresence() {
  const { tabs, activeTabId } = useChatTabs();
  const { rightSidebarOpen } = useRightSidebar();
  const visibility = useDocumentVisibility();

  const focus = computed(() => {
    // The open sidebar wins over a page's claim: if the chat hub is in front,
    // that is the conversation being read, whatever else is on the page behind
    // it.
    if (rightSidebarOpen.value && currentHub() === "chat" && activeTabId.value) {
      const tab = tabs.value.find(({ id }) => id === activeTabId.value);

      if (tab) {
        return chatThreadKey(tab.type, tab.lobbyId);
      }
    }

    return pageFocus.value;
  });

  watch(
    [focus, visibility],
    ([thread, visible]) => {
      socket.setPresence({
        visible: visible !== "hidden",
        focus: thread,
      });
    },
    { immediate: true },
  );
}
