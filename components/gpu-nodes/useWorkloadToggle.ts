import { reactive } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { useToast } from "~/components/ui/toast/use-toast";
import { setNodeFields } from "~/components/game-server-nodes/nodeActions";
import type { GpuWorkload } from "~/components/gpu-nodes/gpuSessions";

type Pending = { target: boolean; sent: boolean };

// Shared by every control for a node's workloads (the table chips, the
// inspector chips and the NodeControlMenu switches), so a toggle in flight
// shows in all of them. A sent toggle holds its value until the subscription
// carries it back, so the control doesn't flick back for a beat.
const pending = reactive<Record<string, Pending>>({});
const SETTLE_MS = 3000;

const keyOf = (nodeId: string, workload: GpuWorkload) =>
  `${nodeId}:${workload}`;

export function useWorkloadToggle() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { client } = useApolloClient();

  /** The value to show: the one being sent, else the node's own. */
  function shown(nodeId: string, workload: GpuWorkload, saved: boolean) {
    return pending[keyOf(nodeId, workload)]?.target ?? saved;
  }

  function isPending(nodeId: string, workload: GpuWorkload, saved: boolean) {
    const entry = pending[keyOf(nodeId, workload)];
    return !!entry && !(entry.sent && entry.target === saved);
  }

  async function setWorkload(
    nodeId: string,
    workload: GpuWorkload,
    enabled: boolean,
  ) {
    const key = keyOf(nodeId, workload);
    if (pending[key] && !pending[key].sent) return;
    pending[key] = { target: enabled, sent: false };
    try {
      await setNodeFields(client, nodeId, {
        [`gpu_${workload}_enabled`]: enabled,
      });
      pending[key].sent = true;
      setTimeout(() => {
        if (pending[key]?.sent && pending[key].target === enabled) {
          delete pending[key];
        }
      }, SETTLE_MS);
    } catch (error: any) {
      delete pending[key];
      toast({
        variant: "destructive",
        title: t("pages.gpu_nodes.toggle_workload_failed"),
        description: error?.message,
      });
    }
  }

  return { shown, isPending, setWorkload };
}
