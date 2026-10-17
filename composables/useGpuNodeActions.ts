import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import { useToast } from "~/components/ui/toast/use-toast";
import { generateMutation } from "~/graphql/graphqlGen";

// Shared by the page, its rows and the node sheet, so a bake started in one
// shows busy in the others.
const bakeBusy = reactive<Record<string, boolean>>({});

/**
 * Every write the GPU nodes page makes: node switches (the same mutations as
 * NodeControlMenu; workloads go through useWorkloadToggle), shader bakes,
 * stopping a session and the Steam pool.
 * Each resolves after the request, so a ui Button awaiting it spins.
 */
export function useGpuNodeActions() {
  const { t } = useI18n();
  const { toast } = useToast();
  const client = useNuxtApp().$apollo.defaultClient;

  async function run(
    mutation: Record<string, unknown>,
    failure: string,
    success?: string,
  ) {
    try {
      const { data } = await client.mutate({
        mutation: generateMutation(mutation as any),
      });
      if (success) toast({ title: success });
      return data as any;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: failure,
        description: error?.message,
      });
      return null;
    }
  }

  const setEnabled = (nodeId: string, enabled: boolean) =>
    run(
      {
        update_game_server_nodes_by_pk: [
          { pk_columns: { id: nodeId }, _set: { enabled } },
          { id: true },
        ],
      },
      t("pages.gpu_nodes.toggle_enabled_failed"),
    );

  async function setScheduling(nodeId: string, accepting: boolean) {
    const data = await run(
      {
        setGameNodeSchedulingState: [
          { game_server_node_id: nodeId, enabled: accepting },
          { success: true },
        ],
      },
      t("pages.gpu_nodes.toggle_scheduling_failed"),
    );
    if (data && !data.setGameNodeSchedulingState?.success) {
      toast({
        variant: "destructive",
        title: t("pages.gpu_nodes.toggle_scheduling_failed"),
      });
    }
  }

  async function bakeShaders(nodeId: string) {
    if (bakeBusy[nodeId]) return;
    bakeBusy[nodeId] = true;
    await run(
      { bakeShaders: [{ game_server_node_id: nodeId }, { success: true }] },
      t("pages.gpu_nodes.bake.failed"),
      t("pages.gpu_nodes.bake.started"),
    );
    bakeBusy[nodeId] = false;
  }

  async function cancelBake(nodeId: string) {
    if (bakeBusy[nodeId]) return;
    bakeBusy[nodeId] = true;
    await run(
      {
        cancelBakeShaders: [{ game_server_node_id: nodeId }, { success: true }],
      },
      t("pages.gpu_nodes.bake.cancel_failed"),
      t("pages.gpu_nodes.bake.cancelled"),
    );
    bakeBusy[nodeId] = false;
  }

  const stopSession = (nodeId: string) =>
    run(
      { stopGpuSession: [{ game_server_node_id: nodeId }, { success: true }] },
      t("toasts.stop_gpu_session"),
      t("toasts.gpu_session_stopped"),
    );

  const addSteamAccount = (username: string, password: string) =>
    run(
      {
        insert_steam_accounts_one: [
          { object: { username, password } },
          { id: true },
        ],
      },
      t("pages.gpu_nodes.steam_pool.add_failed"),
      t("pages.gpu_nodes.steam_pool.added"),
    );

  const deleteSteamAccount = (id: string) =>
    run(
      { delete_steam_accounts_by_pk: [{ id }, { id: true }] },
      t("pages.gpu_nodes.steam_pool.delete_failed"),
      t("pages.gpu_nodes.steam_pool.deleted"),
    );

  return {
    bakeBusy,
    setEnabled,
    setScheduling,
    bakeShaders,
    cancelBake,
    stopSession,
    addSteamAccount,
    deleteSteamAccount,
  };
}
