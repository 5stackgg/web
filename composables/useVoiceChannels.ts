import { computed } from "vue";
import { useI18n } from "vue-i18n";

// Every voice channel this player is entitled to, resolved once.
//
// Two surfaces need the same answer and must not disagree: the picker offers
// these to join, and the announcer names them when somebody else joins one. It
// used to live inside the picker, which meant a toast could only say "someone
// joined a call" without being able to say which.

export type VoiceChannel = {
  id: string;
  label: string;
  detail: string;
  kind: "lobby" | "match";
};

export function useVoiceChannels() {
  const { t } = useI18n();
  const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

  const partyLobby = computed(() => {
    if (!useApplicationSettingsStore().voiceChatLobbiesEnabled) {
      return null;
    }

    return (useMatchmakingStore().currentLobby as any) ?? null;
  });

  // Which side of a match this player is on. `is_on_lineup` is the computed
  // field the API already exposes for exactly this; a coach is on their side
  // too, and a channel is per-lineup, never per-match.
  function myLineup(match: any) {
    for (const lineup of [match?.lineup_1, match?.lineup_2]) {
      if (!lineup) {
        continue;
      }

      if (
        lineup.is_on_lineup ||
        (mySteamId.value && lineup.coach?.steam_id === mySteamId.value)
      ) {
        return lineup;
      }
    }

    return null;
  }

  function opponentOf(match: any, lineup: any) {
    const other =
      match?.lineup_1?.id === lineup?.id ? match?.lineup_2 : match?.lineup_1;

    return other?.team?.name ?? other?.name ?? null;
  }

  const channels = computed<Array<VoiceChannel>>(() => {
    const found: Array<VoiceChannel> = [];

    if (partyLobby.value?.id) {
      found.push({
        id: partyLobby.value.id,
        label: t("layouts.voice_panel.picker.party"),
        detail: t("layouts.voice_panel.picker.party_detail", {
          count: partyLobby.value.players?.length ?? 0,
        }),
        kind: "lobby",
      });
    }

    if (useApplicationSettingsStore().voiceChatMatchesEnabled) {
      for (const match of (useMatchLobbyStore().myMatches as Array<any>) ?? []) {
        const lineup = myLineup(match);

        if (!lineup?.id) {
          continue;
        }

        const opponent = opponentOf(match, lineup);

        found.push({
          id: lineup.id,
          label: t("layouts.voice_panel.picker.team"),
          detail: opponent
            ? t("layouts.voice_panel.picker.team_vs", { opponent })
            : (match.e_match_status?.description ?? ""),
          kind: "match",
        });
      }
    }

    return found;
  });

  function find(channelId: string) {
    return channels.value.find((channel) => channel.id === channelId) ?? null;
  }

  return { channels, find, mySteamId };
}
