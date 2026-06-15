import { ref, h } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { gql } from "@apollo/client/core";
import { toast, ToastAction } from "~/components/ui/toast";
import formatBytes from "~/utilities/formatBytes";

export type OrphanObject = { key: string; size: number };
export type ScanResult = {
  found: boolean;
  scanning: boolean;
  scanned_at: string | null;
  bucket: string | null;
  total_objects: number;
  total_bytes: number;
  tracked_objects: number;
  tracked_bytes: number;
  demo_objects: number;
  demo_bytes: number;
  clip_objects: number;
  clip_bytes: number;
  orphan_objects: number;
  orphan_bytes: number;
  other_objects: number;
  other_bytes: number;
  orphans: OrphanObject[];
};

const SCAN_MUTATION = gql`
  mutation ScanOrphanedDemos {
    scanOrphanedDemos {
      success
      scanning
    }
  }
`;

const RESULT_MUTATION = gql`
  mutation OrphanedDemosScanResult {
    orphanedDemosScanResult {
      found
      scanning
      scanned_at
      bucket
      total_objects
      total_bytes
      tracked_objects
      tracked_bytes
      demo_objects
      demo_bytes
      clip_objects
      clip_bytes
      orphan_objects
      orphan_bytes
      other_objects
      other_bytes
      orphans {
        key
        size
      }
    }
  }
`;

const DELETE_MUTATION = gql`
  mutation DeleteOrphanedDemos {
    deleteOrphanedDemos {
      success
      deleted
      bytes_freed
      remaining_orphans
    }
  }
`;

// Singleton state so the scan survives the dialog closing or navigating between
// the demo/highlights settings pages — polling keeps running in the background
// and a toast fires on completion regardless of what's mounted.
const scanning = ref(false);
const deleting = ref(false);
const loading = ref(false);
const result = ref<ScanResult | null>(null);
const dialogOpen = ref(false);
const loaded = ref(false);

type Translate = (key: string, named?: Record<string, unknown>) => string;

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let client: ReturnType<typeof useApolloClient>["client"] | null = null;
let t: Translate | null = null;

function tr(key: string, named?: Record<string, unknown>): string {
  return t ? (named ? t(key, named) : t(key)) : key;
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function refreshResult(): Promise<ScanResult | null> {
  if (!client) return null;
  const { data } = await client.mutate({
    mutation: RESULT_MUTATION,
    fetchPolicy: "no-cache",
  });
  const next = ((data as any)?.orphanedDemosScanResult ?? null) as ScanResult | null;
  result.value = next;
  loaded.value = true;
  return next;
}

function notifyComplete(r: ScanResult) {
  const found = r.orphan_objects > 0;
  toast({
    title: tr("pages.settings.application.demo_settings.orphaned_complete_title"),
    description: found
      ? tr("pages.settings.application.demo_settings.orphaned_complete_found", {
          count: r.orphan_objects,
          size: formatBytes(r.orphan_bytes),
        })
      : tr("pages.settings.application.demo_settings.orphaned_complete_none"),
    action: found
      ? (h(
          ToastAction,
          {
            altText: tr(
              "pages.settings.application.demo_settings.orphaned_view_results",
            ),
            onClick: () => {
              dialogOpen.value = true;
            },
          },
          {
            default: () =>
              tr(
                "pages.settings.application.demo_settings.orphaned_view_results",
              ),
          },
        ) as any)
      : undefined,
  });
}

function poll() {
  stopPolling();
  pollTimer = setTimeout(async () => {
    const next = await refreshResult().catch(() => null);
    if (next?.scanning) {
      poll();
      return;
    }
    scanning.value = false;
    if (next) {
      notifyComplete(next);
    }
  }, 3000);
}

async function startScan() {
  if (scanning.value) return;
  scanning.value = true;
  try {
    await client?.mutate({ mutation: SCAN_MUTATION });
    toast({
      title: tr("pages.settings.application.demo_settings.orphaned_scan_started"),
    });
    poll();
  } catch (error) {
    scanning.value = false;
    toast({
      title: (error as Error)?.message ?? "scan failed",
      variant: "destructive",
    });
  }
}

async function deleteOrphans() {
  const orphanCount = result.value?.orphan_objects ?? 0;
  if (orphanCount === 0) return;
  const confirmed = window.confirm(
    tr("pages.settings.application.demo_settings.orphaned_delete_confirm", {
      count: orphanCount,
      size: formatBytes(result.value?.orphan_bytes ?? 0),
    }),
  );
  if (!confirmed) return;
  deleting.value = true;
  try {
    const { data } = await client!.mutate({ mutation: DELETE_MUTATION });
    const out = (data as any)?.deleteOrphanedDemos;
    toast({
      title: tr("pages.settings.application.demo_settings.orphaned_deleted", {
        count: out?.deleted ?? 0,
        size: formatBytes(out?.bytes_freed ?? 0),
      }),
    });
    await refreshResult();
  } catch (error) {
    toast({
      title: (error as Error)?.message ?? "delete failed",
      variant: "destructive",
    });
  } finally {
    deleting.value = false;
  }
}

// Pull the latest report once (e.g. when the dialog opens). If a scan is still
// running server-side, resume polling so completion is still announced.
async function ensureLoaded() {
  if (loaded.value) return;
  loading.value = true;
  try {
    const next = await refreshResult();
    if (next?.scanning) {
      scanning.value = true;
      poll();
    }
  } catch {
    // ignore — surfaced on next interaction
  } finally {
    loading.value = false;
  }
}

export function useOrphanedScan() {
  if (!client) {
    client = useApolloClient().client;
  }
  if (!t) {
    t = useI18n().t as unknown as Translate;
  }
  return {
    scanning,
    deleting,
    loading,
    result,
    dialogOpen,
    startScan,
    deleteOrphans,
    ensureLoaded,
  };
}
