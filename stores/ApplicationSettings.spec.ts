import { createPinia, setActivePinia } from "pinia";

const authMock = {
  me: null as any,
  isRoleAbove: vi.fn(() => false),
};

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => authMock,
}));
vi.mock("~/stores/MatchmakingStore", () => ({
  useMatchmakingStore: () => ({ checkLatenies: vi.fn() }),
}));
vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({ subscribe: vi.fn() }),
  }),
}));
vi.mock("~/graphql/graphqlGen", () => ({
  generateSubscription: vi.fn(),
}));

import { useApplicationSettingsStore } from "./ApplicationSettings";
import { e_player_roles_enum, e_match_types_enum } from "~/generated/zeus";

describe("ApplicationSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authMock.me = null;
    authMock.isRoleAbove = vi.fn(() => false);
    localStorage.removeItem("5stack:application-settings");
  });

  describe("matchCreateRole", () => {
    it("returns false when settings is null", () => {
      const store = useApplicationSettingsStore();
      store.settings = null as any;
      expect(store.matchCreateRole).toBe(false);
    });

    it("returns setting value when present", () => {
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.create_matches_role", value: "administrator" },
      ];
      expect(store.matchCreateRole).toBe("administrator");
    });

    it("falls back to e_player_roles_enum.user when setting not found", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.matchCreateRole).toBe(e_player_roles_enum.user);
    });
  });

  describe("tournamentCreateRole", () => {
    it("returns false when settings is null", () => {
      const store = useApplicationSettingsStore();
      store.settings = null as any;
      expect(store.tournamentCreateRole).toBe(false);
    });

    it("returns setting value when present", () => {
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.create_tournaments_role", value: "tournament_organizer" },
      ];
      expect(store.tournamentCreateRole).toBe("tournament_organizer");
    });

    it("falls back to e_player_roles_enum.user", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.tournamentCreateRole).toBe(e_player_roles_enum.user);
    });
  });

  describe("matchmakingAllowed", () => {
    it("returns false when settings is null", () => {
      const store = useApplicationSettingsStore();
      store.settings = null as any;
      expect(store.matchmakingAllowed).toBe(false);
    });

    it("returns false when matchmaking setting is false", () => {
      const store = useApplicationSettingsStore();
      store.settings = [{ name: "public.matchmaking", value: "false" }];
      expect(store.matchmakingAllowed).toBe(false);
    });

    it("returns true when no matchmaking setting and no min role", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.matchmakingAllowed).toBe(true);
    });

    it("calls isRoleAbove with min role when setting exists", () => {
      authMock.isRoleAbove = vi.fn(() => true);
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.matchmaking", value: "true" },
        { name: "public.matchmaking_min_role", value: "verified_user" },
      ];
      expect(store.matchmakingAllowed).toBe(true);
      expect(authMock.isRoleAbove).toHaveBeenCalledWith("verified_user");
    });
  });

  describe("canCreateMatch", () => {
    it("returns false when me is null", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.canCreateMatch).toBe(false);
    });

    it("delegates to isRoleAbove with matchCreateRole", () => {
      authMock.me = { role: "administrator" };
      authMock.isRoleAbove = vi.fn(() => true);
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.create_matches_role", value: "match_organizer" },
      ];
      expect(store.canCreateMatch).toBe(true);
      expect(authMock.isRoleAbove).toHaveBeenCalledWith("match_organizer");
    });
  });

  describe("canAddWithoutInvite", () => {
    it("returns true when no setting", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.canAddWithoutInvite).toBe(true);
    });

    it("calls isRoleAbove when setting exists", () => {
      authMock.isRoleAbove = vi.fn(() => false);
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.lineup_add_without_invite", value: "administrator" },
      ];
      expect(store.canAddWithoutInvite).toBe(false);
      expect(authMock.isRoleAbove).toHaveBeenCalledWith("administrator");
    });
  });

  describe("isMatchmakingTypeEnabled", () => {
    it("returns true when setting not found", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.isMatchmakingTypeEnabled(e_match_types_enum.Competitive)).toBe(true);
    });

    it("returns false when setting is false", () => {
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.matchmaking_Competitive", value: "false" },
      ];
      expect(store.isMatchmakingTypeEnabled(e_match_types_enum.Competitive)).toBe(false);
    });

    it("returns true when setting is true", () => {
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.matchmaking_Competitive", value: "true" },
      ];
      expect(store.isMatchmakingTypeEnabled(e_match_types_enum.Competitive)).toBe(true);
    });
  });

  describe("showSeparators / showReportIssue", () => {
    it("showSeparators defaults to true", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.showSeparators).toBe(true);
    });

    it("showSeparators returns false when setting is false", () => {
      const store = useApplicationSettingsStore();
      store.settings = [{ name: "public.show_separators", value: "false" }];
      expect(store.showSeparators).toBe(false);
    });

    it("showReportIssue defaults to true", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.showReportIssue).toBe(true);
    });

    it("showReportIssue returns false when setting is false", () => {
      const store = useApplicationSettingsStore();
      store.settings = [{ name: "public.show_report_issue", value: "false" }];
      expect(store.showReportIssue).toBe(false);
    });
  });

  describe("githubUrl", () => {
    it("returns default URL when no setting", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.githubUrl).toBe("https://github.com/5stackgg/5stack-panel");
    });

    it("returns setting value when present", () => {
      const store = useApplicationSettingsStore();
      store.settings = [{ name: "public.github_url", value: "https://example.com" }];
      expect(store.githubUrl).toBe("https://example.com");
    });
  });

  describe("brandName / logoUrl / faviconUrl", () => {
    it("returns undefined when no setting", () => {
      const store = useApplicationSettingsStore();
      store.settings = [];
      expect(store.brandName).toBeUndefined();
      expect(store.logoUrl).toBeUndefined();
      expect(store.faviconUrl).toBeUndefined();
    });

    it("returns setting values when present", () => {
      const store = useApplicationSettingsStore();
      store.settings = [
        { name: "public.brand_name", value: "MyBrand" },
        { name: "public.logo_url", value: "https://logo.png" },
        { name: "public.favicon_url", value: "https://favicon.ico" },
      ];
      expect(store.brandName).toBe("MyBrand");
      expect(store.logoUrl).toBe("https://logo.png");
      expect(store.faviconUrl).toBe("https://favicon.ico");
    });
  });
});
