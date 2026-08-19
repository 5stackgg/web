import { ref, watch, onScopeDispose } from "vue";
import { useVoiceChannels } from "~/composables/useVoiceChannels";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import {
  fetchVoiceParticipants,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import socket from "~/web-sockets/Socket";

// "Your team just started talking."
//
// The API pushes `voice:participants` to every *member* of a channel, not only
// to the people currently in the call -- which is what makes this possible at
// all. Somebody sitting in a lobby with voice closed still hears about it, and
// that is the whole point: a voice channel nobody knows has started is a voice
// channel nobody joins.
//
// The card carries the join, so knowing and acting are one step. Deliberately
// a card and not a Picture-in-Picture window: a floating window appearing
// because a third party did something is the behaviour people turn a feature
// off over.
//
// Rendered by ActionToasts alongside lobby and friend invites rather than as a
// plain toast. They are the same sort of thing -- somebody is asking for a
// decision -- and they stack, group and fan the same way, which matters when a
// whole team joins at once.

// One entry per channel. A second person joining updates the card in place
// rather than adding another: the decision is "join this channel", and it does
// not change because more people arrived.
export type CallInvite = {
  id: string;
  channelId: string;
  channelLabel: string;
  channelKind: "lobby" | "match";
  who: string;
  video: boolean;
};

const invites = ref<Array<CallInvite>>([]);

export function useCallInvites() {
  function dismiss(id: string) {
    invites.value = invites.value.filter((invite) => invite.id !== id);
  }

  function dismissChannel(channelId: string) {
    invites.value = invites.value.filter(
      (invite) => invite.channelId !== channelId,
    );
  }

  return { invites, dismiss, dismissChannel };
}

export function useVoiceAnnouncements() {
  const { channels, find, mySteamId } = useVoiceChannels();
  const session = useVoiceSession();
  const registry = useActiveVoiceChannel();

  // Who we have already announced, per channel. Absence of a channel here means
  // "we have never seen this one", which is the case that must stay silent:
  // the first push after a page load lists everyone already in the call, and
  // announcing all of them would be a stack of toasts for news that is not new.
  const seen = new Map<string, { connected: Set<string>; video: Set<string> }>();

  // Seeded up front, and this is the whole reason the announcements were
  // unreliable: without a baseline, the *first* push for a channel is the one
  // that gets swallowed -- and when you are not already in a call, the first
  // push for a channel is exactly the moment somebody joined it. Sitting on a
  // draft page having never heard about that lineup channel, the one event
  // worth telling you about was the one guaranteed to be silent.
  //
  // Asking the API for the current roster gives something to diff against, so
  // a later push is a real change rather than a first sighting.
  async function seed(channelId: string) {
    if (seen.has(channelId)) {
      return;
    }

    // Claim it before awaiting: a push arriving mid-flight must not be treated
    // as a first sighting and announced twice.
    seen.set(channelId, { connected: new Set(), video: new Set() });

    try {
      const participants = await fetchVoiceParticipants(channelId);

      seen.set(channelId, {
        connected: new Set(
          participants
            .filter((participant) => participant.connected)
            .map((participant) => participant.steamId),
        ),
        video: new Set(
          participants
            .filter((participant) => participant.video)
            .map((participant) => participant.steamId),
        ),
      });
    } catch {
      // Not a member (yet), or the API is unreachable. The empty baseline
      // stands: the next push announces whoever is in there, which is a better
      // failure than silence.
    }
  }

  watch(
    channels,
    (list) => {
      for (const channel of list) {
        void seed(channel.id);
      }
    },
    { immediate: true, deep: true },
  );

  function announce(channelId: string, participant: VoiceParticipant, video: boolean) {
    const channel = find(channelId);

    // A channel we cannot name is one this player has no business being
    // offered -- the roster it came from is gone, or it is not theirs.
    if (!channel) {
      return;
    }

    // Already in it: nothing to ask for.
    if (registry.session.value?.id === channelId) {
      return;
    }

    const who = participant.name ?? participant.steamId;
    const existing = invites.value.find(
      (invite) => invite.channelId === channelId,
    );

    if (existing) {
      // Kept as one card, but named for whoever arrived last so it does not go
      // stale on a person who has since left.
      existing.who = who;
      existing.video = existing.video || video;
      return;
    }

    invites.value = [
      ...invites.value,
      {
        id: `voice:${channelId}`,
        channelId,
        channelLabel: channel.label,
        channelKind: channel.kind,
        who,
        video,
      },
    ];
  }

  const listener = socket.listen(
    "voice:participants",
    (data: { channelId: string; participants: Array<VoiceParticipant> }) => {
      if (!data?.channelId) {
        return;
      }

      const connected = new Set(
        (data.participants ?? [])
          .filter((participant) => participant.connected)
          .map((participant) => participant.steamId),
      );
      const onCamera = new Set(
        (data.participants ?? [])
          .filter((participant) => participant.video)
          .map((participant) => participant.steamId),
      );

      const previous = seen.get(data.channelId);
      seen.set(data.channelId, { connected, video: onCamera });

      // Everyone left, or we joined: the ask is answered either way.
      if (connected.size === 0 || registry.session.value?.id === data.channelId) {
        invites.value = invites.value.filter(
          (invite) => invite.channelId !== data.channelId,
        );
      }

      // Never seen it and the seed has not landed: record and say nothing
      // rather than announce a roster that may have been there all along.
      if (!previous) {
        return;
      }

      for (const participant of data.participants ?? []) {
        if (participant.steamId === mySteamId.value) {
          continue;
        }

        if (
          participant.connected &&
          !previous.connected.has(participant.steamId)
        ) {
          announce(data.channelId, participant, false);
          continue;
        }

        // Only announced separately when they were already in the call --
        // joining with a camera on is one event, not two.
        if (
          participant.video &&
          !previous.video.has(participant.steamId) &&
          previous.connected.has(participant.steamId)
        ) {
          announce(data.channelId, participant, true);
        }
      }
    },
  );

  onScopeDispose(() => {
    listener?.stop();
    seen.clear();
  });

  return { invites };
}
