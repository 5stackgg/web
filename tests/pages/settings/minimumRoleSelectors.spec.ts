import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import PlayersSettings from "~/pages/settings/application/players.vue";
import MatchmakingSettings from "~/pages/settings/application/matchmaking.vue";
import StreamingSettings from "~/pages/settings/application/streaming.vue";
import { e_player_roles_enum } from "~/generated/zeus";

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  await flushPromises();
});

describe("application settings minimum-role selectors", () => {
  it.each([
    ["players", PlayersSettings],
    ["matchmaking", MatchmakingSettings],
    ["streaming", StreamingSettings],
  ])(
    "offers moderator between streamer and match organizer on %s",
    async (_name, page) => {
      provideApolloClient((useNuxtApp() as any).$apollo.defaultClient);
      const wrapper = await mountSuspended(page as any, { shallow: true });
      unmount = () => wrapper.unmount();

      const roles = (
        (wrapper.vm as any).roles as Array<{ value: string }>
      ).map((role) => role.value);
      const streamer = roles.indexOf(e_player_roles_enum.streamer);

      expect(streamer).toBeGreaterThanOrEqual(0);
      expect(roles.slice(streamer, streamer + 3)).toEqual([
        e_player_roles_enum.streamer,
        e_player_roles_enum.moderator,
        e_player_roles_enum.match_organizer,
      ]);
    },
  );
});
