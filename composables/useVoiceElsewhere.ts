import { ref, onScopeDispose } from "vue";

// "You are already in a call" -- asked of the server rather than the other tabs.
//
// useActiveVoiceChannel mirrors a running call between tabs over a
// BroadcastChannel, which is exactly right for muting and hanging up from
// whichever tab you happen to be looking at. What it cannot do is see past the
// browser profile it lives in: a second window signed in under another profile,
// a different browser, or a phone gets no mirror at all, and so offers to join
// a call the player is already sitting in.
//
// MediaMTX knows who is publishing regardless of where from, so this asks it.
// The tab bridge stays the fast path; this is the one that is actually true.

// The call does not move often, and every tab that is *not* in a call runs this.
const POLL_MS = 10_000;

// Module scope: one poll for the whole app however many surfaces ask.
const channelId = ref<string | null>(null);
const video = ref(false);
// False until the first answer, and again whenever MediaMTX cannot be reached.
// A caller must be able to tell "not in a call" from "we do not know yet",
// because drawing a join button for a call already running is the failure.
const known = ref(false);

let timer: ReturnType<typeof setTimeout> | null = null;
let watchers = 0;

async function load() {
  try {
    const response = await fetch(
      `https://${useRuntimeConfig().public.apiDomain}/voice/active`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = (await response.json()) as {
      known: boolean;
      channelId: string | null;
      video: boolean;
    };

    known.value = data.known;
    channelId.value = data.channelId;
    video.value = data.video;
  } catch {
    known.value = false;
  }
}

function schedule() {
  timer = setTimeout(async () => {
    await load();

    if (watchers > 0) {
      schedule();
    }
  }, POLL_MS);
}

export function useVoiceElsewhere() {
  watchers += 1;

  if (watchers === 1) {
    void load();
    schedule();
  }

  onScopeDispose(() => {
    watchers -= 1;

    if (watchers === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  });

  // Called after joining or leaving here, so the answer does not lag a poll
  // behind an action the player just took.
  function refresh() {
    return load();
  }

  return { known, channelId, video, refresh };
}
