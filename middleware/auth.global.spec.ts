import { vi } from "vitest";

// vi.hoisted runs before imports so defineNuxtRouteMiddleware exists when the module loads
const { navigateToMock } = vi.hoisted(() => {
  const navigateToMock = vi.fn();
  (globalThis as any).defineNuxtRouteMiddleware = (fn: any) => fn;
  (globalThis as any).navigateTo = navigateToMock;
  (globalThis as any).useNuxtApp = () => ({ $i18n: { t: (k: string) => k } });
  return { navigateToMock };
});

const authStoreMock = {
  me: null as any,
  getMe: vi.fn().mockResolvedValue(false),
};

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock("@/components/ui/toast", () => ({
  toast: vi.fn(),
}));

// defineNuxtRouteMiddleware passes through the callback, so middleware IS the async function
import middleware from "./auth.global";

function route(path: string, query: Record<string, any> = {}) {
  return { path, query } as any;
}

describe("auth.global middleware", () => {
  beforeEach(() => {
    navigateToMock.mockReset();
    authStoreMock.me = null;
    authStoreMock.getMe.mockResolvedValue(false);
  });

  describe("public routes (unauthenticated)", () => {
    it.each([
      "/",
      "/login",
      "/watch",
      "/public-servers",
      "/players/76561198000000001",
      "/leaderboard/global",
      "/teams/abc",
      "/tournaments/t1",
      "/matches/m1",
    ])("allows access to %s without auth", async (path) => {
      await middleware(route(path), route("/"));

      expect(navigateToMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/login"),
      );
    });
  });

  describe("private routes (unauthenticated)", () => {
    it("redirects /settings to /login?redirect=/settings", async () => {
      await middleware(route("/settings"), route("/"));

      expect(navigateToMock).toHaveBeenCalledWith(
        "/login?redirect=/settings",
      );
    });

    it("redirects /dashboard to /login?redirect=/dashboard", async () => {
      await middleware(route("/dashboard"), route("/"));

      expect(navigateToMock).toHaveBeenCalledWith(
        "/login?redirect=/dashboard",
      );
    });
  });

  describe("authenticated user on /login", () => {
    beforeEach(() => {
      authStoreMock.me = { steam_id: "76561198000000001" };
      authStoreMock.getMe.mockResolvedValue(true);
    });

    it("redirects from /login to /", async () => {
      await middleware(route("/login"), route("/"));

      expect(navigateToMock).toHaveBeenCalledWith("/");
    });

    it("redirects from /login to redirect query param", async () => {
      await middleware(
        route("/login", { redirect: "/settings" }),
        route("/"),
      );

      expect(navigateToMock).toHaveBeenCalledWith("/settings");
    });
  });

  describe("error query parameter", () => {
    it("strips error from URL and navigates without it", async () => {
      await middleware(
        route("/some-page", { error: "Something went wrong", tab: "1" }),
        route("/"),
      );

      expect(navigateToMock).toHaveBeenCalledWith({
        path: "/some-page",
        query: { tab: "1" },
      });
    });
  });
});
