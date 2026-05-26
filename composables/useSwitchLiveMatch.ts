import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { generateMutation } from "~/graphql/graphqlGen";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useToast } from "~/components/ui/toast/use-toast";

const SWITCH_LIVE_MATCH_MUTATION = gql`
  mutation SwitchLiveMatch(
    $from_match_id: uuid!
    $to_match_id: uuid!
    $mode: String!
  ) {
    switchLiveMatch(
      from_match_id: $from_match_id
      to_match_id: $to_match_id
      mode: $mode
    ) {
      success
    }
  }
`;

export type SwitchTarget = {
  id: string;
  status?: string | null;
  server_id?: string | null;
  is_server_online?: boolean | null;
};

export type SwitchReadiness = { ready: boolean; reason: string | null };

export function useSwitchLiveMatch() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { client: apolloClient } = useApolloClient();
  const streamerStore = useStreamerStore();
  const { liveStreams } = storeToRefs(streamerStore);

  const activeStream = computed(() => liveStreams.value?.[0] ?? null);
  const activeMatchId = computed<string | null>(
    () => activeStream.value?.match_id ?? null,
  );

  const switching = ref<string | null>(null);

  function deckReadiness(target: SwitchTarget | null): SwitchReadiness {
    if (!target) {
      return { ready: false, reason: t("toasts.destination_not_ready") };
    }
    if (target.status !== "Live") {
      return {
        ready: false,
        reason: t("stream_deck.match_status_wait", {
          status: String(target.status ?? "").toLowerCase(),
        }),
      };
    }
    if (!target.server_id) {
      return { ready: false, reason: t("stream_deck.no_server_assigned") };
    }
    if (target.is_server_online !== true) {
      return {
        ready: false,
        reason: t("stream_deck.server_offline_waiting"),
      };
    }
    return { ready: true, reason: null };
  }

  async function switchTo(
    target: SwitchTarget,
    mode: "live" | "tv" = "live",
  ): Promise<boolean> {
    const { ready, reason } = deckReadiness(target);
    if (!ready) {
      toast({
        variant: "destructive",
        title: t("toasts.cant_switch"),
        description: reason ?? t("toasts.destination_not_ready"),
      });
      return false;
    }
    const fromMatchId = activeMatchId.value;
    if (!fromMatchId) {
      try {
        await apolloClient.mutate({
          mutation: generateMutation({
            startLive: [
              { match_id: target.id, mode },
              { success: true },
            ],
          }),
        });
        return true;
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: t("toasts.cant_switch"),
          description: error?.message ?? t("toasts.request_failed"),
        });
        return false;
      }
    }
    if (fromMatchId === target.id) return false;
    if (switching.value) return false;
    switching.value = target.id;
    try {
      await apolloClient.mutate({
        mutation: SWITCH_LIVE_MATCH_MUTATION,
        variables: {
          from_match_id: fromMatchId,
          to_match_id: target.id,
          mode,
        },
      });
      toast({
        title: t("toasts.stream_switched"),
        description: t("toasts.stream_switched_description"),
      });
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("toasts.switch_failed"),
        description: error?.message ?? t("toasts.request_failed"),
      });
      return false;
    } finally {
      switching.value = null;
    }
  }

  return {
    activeStream,
    activeMatchId,
    switching,
    deckReadiness,
    switchTo,
  };
}
