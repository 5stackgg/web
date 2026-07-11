import { reactive, ref, type Ref } from "vue";
import { toast } from "@/components/ui/toast";
import { useEventMediaUpload } from "~/composables/useEventMediaUpload";

export type MediaQueueItem = {
  name: string;
  size: number;
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
};

type QueueState = {
  queue: Ref<MediaQueueItem[]>;
  working: Ref<boolean>;
  pending: Array<{ file: File; item: MediaQueueItem }>;
  enqueue: (files: FileList | File[]) => void;
  clearQueue: () => void;
};

// Parallel uploads: big batches shouldn't crawl one file at a time, but
// unbounded parallelism would saturate the connection and the API.
const CONCURRENCY = 3;

// Module-level state keyed by event: uploads keep running when the media tab
// (or the whole event page) unmounts — navigating within the app is safe and
// coming back re-attaches the same live queue UI.
const states = new Map<string, QueueState>();

// Hard exits (tab close / refresh) DO kill in-flight uploads; warn while any
// queue is busy. Registered imperatively so it outlives component scopes.
let activeWorkerPools = 0;
function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}
function workersStarted() {
  activeWorkerPools += 1;
  if (activeWorkerPools === 1) {
    window.addEventListener("beforeunload", onBeforeUnload);
  }
}
function workersFinished() {
  activeWorkerPools -= 1;
  if (activeWorkerPools === 0) {
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
}

export function useEventMediaQueue(eventId: string): QueueState {
  const existing = states.get(eventId);
  if (existing) {
    return existing;
  }

  // Created inside component setup so the upload closure captures a valid
  // Nuxt context; workers reuse it after any unmount.
  const { upload } = useEventMediaUpload(() => eventId);
  const nuxtApp = useNuxtApp();

  const queue = ref<MediaQueueItem[]>([]);
  const working = ref(false);
  const pending: QueueState["pending"] = [];

  async function runWorkers() {
    working.value = true;
    workersStarted();
    try {
      const worker = async () => {
        for (;;) {
          const next = pending.shift();
          if (!next) return;
          next.item.status = "uploading";
          const result = await upload(next.file, {
            silent: true,
            onProgress: (percent) => {
              next.item.progress = percent;
            },
          });
          next.item.status = result ? "done" : "error";
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    } finally {
      working.value = false;
      workersFinished();
    }

    if (queue.value.every((item) => item.status === "done")) {
      toast({
        title: nuxtApp.$i18n.t("event.media.uploaded") as string,
      });
      setTimeout(() => {
        if (
          !working.value &&
          queue.value.every((item) => item.status === "done")
        ) {
          queue.value = [];
        }
      }, 4000);
    }
  }

  function enqueue(files: FileList | File[]) {
    const items = Array.from(files);
    if (items.length === 0) return;
    for (const file of items) {
      const item = reactive<MediaQueueItem>({
        name: file.name,
        size: file.size,
        status: "waiting",
        progress: 0,
      });
      queue.value.push(item);
      pending.push({ file, item });
    }
    if (!working.value) {
      void runWorkers();
    }
  }

  function clearQueue() {
    if (working.value) return;
    queue.value = [];
    pending.length = 0;
  }

  const state: QueueState = { queue, working, pending, enqueue, clearQueue };
  states.set(eventId, state);
  return state;
}
