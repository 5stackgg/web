import { createPinia, setActivePinia } from "pinia";

const authMock = {
  me: null as any,
};

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({ subscribe: vi.fn() }),
  }),
}));
vi.mock("~/graphql/playerFields", () => ({
  playerFields: {},
}));
vi.mock("~/generated/zeus/typedDocumentNode", () => ({
  typedGql: vi.fn(() => ({})),
}));

(globalThis as any).useAuthStore = () => authMock;

import { useNotificationStore } from "./NotificationStore";

describe("NotificationStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authMock.me = null;
  });

  describe("hasNotifications", () => {
    it("returns true when team_invites non-empty", () => {
      const store = useNotificationStore();
      store.team_invites = [{ id: "1" }] as any;
      expect(store.hasNotifications).toBe(true);
    });

    it("returns true when tournament_team_invites non-empty", () => {
      const store = useNotificationStore();
      store.tournament_team_invites = [{ id: "1" }] as any;
      expect(store.hasNotifications).toBe(true);
    });

    it("returns true when any notification has is_read: false", () => {
      const store = useNotificationStore();
      store.notifications = [
        { id: "1", is_read: true },
        { id: "2", is_read: false },
      ] as any;
      expect(store.hasNotifications).toBe(true);
    });

    it("returns false when all empty and all read", () => {
      const store = useNotificationStore();
      store.notifications = [{ id: "1", is_read: true }] as any;
      expect(store.hasNotifications).toBe(false);
    });
  });
});
