vi.hoisted(() => {
  (globalThis as any).useRuntimeConfig = () => ({
    public: {
      webDomain: "example.5stack.gg",
    },
  });
});

import { loginLinks } from "./loginLinks";

describe("loginLinks", () => {
  it("steam link uses webDomain from runtime config", () => {
    expect(loginLinks.steam).toBe("https://example.5stack.gg/auth/steam");
  });

  it("discord link uses webDomain from runtime config", () => {
    expect(loginLinks.discord).toBe("https://example.5stack.gg/auth/discord");
  });
});
