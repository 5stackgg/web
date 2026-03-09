import { createPinia, setActivePinia } from "pinia";

vi.mock("~/stores/SearchStore", () => ({
  useSearchStore: vi.fn(),
}));
vi.mock("~/stores/MatchmakingStore", () => ({
  useMatchmakingStore: vi.fn(),
}));
vi.mock("~/stores/NotificationStore", () => ({
  useNotificationStore: vi.fn(),
}));
vi.mock("~/stores/ApplicationSettingsStore", () => ({
  useApplicationSettingsStore: vi.fn(),
}));
vi.mock("~/graphql/getGraphqlClient", () => ({
  default: vi.fn(),
}));
vi.mock("~/web-sockets/Socket", () => ({
  default: { connect: vi.fn() },
}));
vi.mock("~/graphql/graphqlGen", () => ({
  generateQuery: vi.fn(),
  generateSubscription: vi.fn(),
}));
vi.mock("~/graphql/meGraphql", () => ({
  meFields: {},
}));

// Provide Nuxt auto-imports as globals
(globalThis as any).useSearchStore = vi.fn();
(globalThis as any).useMatchmakingStore = vi.fn();
(globalThis as any).useNotificationStore = vi.fn();
(globalThis as any).useApplicationSettingsStore = vi.fn();
(globalThis as any).useMatchLobbyStore = vi.fn(() => ({
  subscribeToMyMatches: vi.fn(),
  subscribeToLiveMatches: vi.fn(),
  subscribeToLiveTournaments: vi.fn(),
  subscribeToOpenRegistrationTournaments: vi.fn(),
  subscribeToOpenMatches: vi.fn(),
  subscribeToChatTournaments: vi.fn(),
  subscribeToManagingMatches: vi.fn(),
  subscribeToManagingTournaments: vi.fn(),
}));
(globalThis as any).useNuxtApp = vi.fn(() => ({ $wsClient: { terminate: vi.fn(), on: vi.fn() } }));

import { useAuthStore } from "./AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

describe("AuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("isRoleAbove", () => {
    it("returns false when me is null", () => {
      const store = useAuthStore();
      expect(store.isRoleAbove(e_player_roles_enum.user)).toBe(false);
    });

    it("returns true when user role >= target role", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.administrator } as any;
      expect(store.isRoleAbove(e_player_roles_enum.match_organizer)).toBe(true);
    });

    it("returns false when user role < target role", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.user } as any;
      expect(store.isRoleAbove(e_player_roles_enum.administrator)).toBe(false);
    });

    it("returns true for same role", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.streamer } as any;
      expect(store.isRoleAbove(e_player_roles_enum.streamer)).toBe(true);
    });

    it("respects full hierarchy: user < verified_user < streamer < match_organizer < tournament_organizer < administrator", () => {
      const store = useAuthStore();
      const hierarchy = [
        e_player_roles_enum.user,
        e_player_roles_enum.verified_user,
        e_player_roles_enum.streamer,
        e_player_roles_enum.match_organizer,
        e_player_roles_enum.tournament_organizer,
        e_player_roles_enum.administrator,
      ];

      for (let i = 0; i < hierarchy.length; i++) {
        store.me = { role: hierarchy[i] } as any;
        for (let j = 0; j < hierarchy.length; j++) {
          expect(store.isRoleAbove(hierarchy[j])).toBe(i >= j);
        }
      }
    });
  });

  describe("computed role checks", () => {
    it("isAdmin true only for administrator", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.administrator } as any;
      expect(store.isAdmin).toBe(true);
      store.me = { role: e_player_roles_enum.user } as any;
      expect(store.isAdmin).toBe(false);
    });

    it("isUser true only for user role", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.user } as any;
      expect(store.isUser).toBe(true);
      store.me = { role: e_player_roles_enum.administrator } as any;
      expect(store.isUser).toBe(false);
    });

    it("isMatchOrganizer true only for match_organizer", () => {
      const store = useAuthStore();
      store.me = { role: e_player_roles_enum.match_organizer } as any;
      expect(store.isMatchOrganizer).toBe(true);
      store.me = { role: e_player_roles_enum.user } as any;
      expect(store.isMatchOrganizer).toBe(false);
    });
  });
});
