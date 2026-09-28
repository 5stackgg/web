import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  BUILD_MAP_ASSETS_MUTATION,
  VALIDATE_GAMEDATA_MUTATION,
} from "~/graphql/cs2BuildGraphql";

// A refusal (already running, node not on the build, …) comes back as a
// GraphQL error, which the global apollo error toast already shows verbatim.
export function useCs2BuildActions() {
  const { t } = useI18n();

  async function revalidate(gameServerNodeId: string | null) {
    try {
      await getGraphqlClient().mutate({
        mutation: VALIDATE_GAMEDATA_MUTATION,
        variables: { game_server_node_id: gameServerNodeId },
      });
      toast({
        title: t("pages.game_server_nodes.cs2_build.toast.queued_validation"),
      });
    } catch {
      return;
    }
  }

  async function rebuild(gameServerNodeId: string | null, force = false) {
    try {
      await getGraphqlClient().mutate({
        mutation: BUILD_MAP_ASSETS_MUTATION,
        variables: { game_server_node_id: gameServerNodeId, force },
      });
      toast({
        title: t("pages.game_server_nodes.cs2_build.toast.queued_build"),
      });
    } catch {
      return;
    }
  }

  return { revalidate, rebuild };
}
